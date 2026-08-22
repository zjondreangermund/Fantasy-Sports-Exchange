#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;
const REPAIR_KEY = "restore-confirmed-starter-selections-v1";
const RESET_ACTION = "admin.test_account_starter_reset";
const REQUIRED_POSITIONS = ["GK", "DEF", "MID", "FWD"];

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function positiveIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))]
    : [];
}

function normalizePosition(value) {
  return String(value || "").trim().toUpperCase();
}

function validStarterPacks(packCards, selectedCards) {
  const packs = Array.isArray(packCards) ? packCards.map(positiveIds) : [];
  const selected = positiveIds(selectedCards);
  if (packs.length !== 5 || packs.some((pack) => !pack.length) || selected.length !== 5) return null;
  const ordered = packs.map((pack) => selected.filter((playerId) => pack.includes(playerId)));
  if (ordered.some((choices) => choices.length !== 1)) return null;
  return { packs, selectedPlayerIds: ordered.map((choices) => choices[0]) };
}

function validOrderedLineup(cardIds, cardRows, userId) {
  const ids = positiveIds(cardIds);
  if (ids.length !== 5 || cardRows.length !== 5) return false;
  const byId = new Map(cardRows.map((card) => [Number(card.id), card]));
  const ordered = ids.map((id) => byId.get(id));
  if (ordered.some((card) => !card || String(card.owner_id || "") !== String(userId))) return false;
  return REQUIRED_POSITIONS.every((position, index) => normalizePosition(ordered[index]?.position) === position);
}

async function tableExists(client, qualifiedName) {
  const result = await client.query("select to_regclass($1) as name", [qualifiedName]);
  return Boolean(result.rows?.[0]?.name);
}

async function backupAccount(client, user) {
  const onboarding = rows(await client.query(
    "select completed, pack_cards, selected_cards from app.user_onboarding where user_id=$1 limit 1",
    [user.user_id],
  ))[0] || null;
  const lineup = rows(await client.query(
    "select card_ids, captain_id from app.lineups where user_id=$1 limit 1",
    [user.user_id],
  ))[0] || null;
  const cards = rows(await client.query(`
    select id, player_id, owner_id, rarity::text as rarity, for_sale, price, acquired_at
    from app.player_cards
    where owner_id=$1
    order by id
  `, [user.user_id]));

  await client.query(`
    insert into app.starter_selection_restoration_backups
      (repair_key, user_id, email, onboarding, lineup, owned_cards)
    values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)
    on conflict (repair_key, user_id) do nothing
  `, [
    REPAIR_KEY,
    user.user_id,
    user.email,
    JSON.stringify(onboarding),
    JSON.stringify(lineup),
    JSON.stringify(cards),
  ]);
}

async function loadLineupCards(client, cardIds) {
  const ids = positiveIds(cardIds);
  if (!ids.length) return [];
  return rows(await client.query(`
    select pc.id, pc.owner_id, p.position::text as position
    from app.player_cards pc
    join app.players p on p.id=pc.player_id
    where pc.id=any($1::int[])
  `, [ids]));
}

async function ensureEligibleLineup(client, userId, starterCardIds) {
  const current = rows(await client.query(
    "select card_ids, captain_id from app.lineups where user_id=$1 limit 1",
    [userId],
  ))[0] || null;
  const currentIds = positiveIds(current?.card_ids);
  const currentRows = await loadLineupCards(client, currentIds);
  if (validOrderedLineup(currentIds, currentRows, userId)) {
    return { updated: false, beforeCardIds: currentIds, cardIds: currentIds };
  }

  const ordered = positiveIds(starterCardIds);
  if (ordered.length !== 5) throw new Error(`Cannot create eligible starter lineup for ${userId}: five cards required`);
  const starterRows = await loadLineupCards(client, ordered);
  if (!validOrderedLineup(ordered, starterRows, userId)) {
    throw new Error(`Cannot create eligible starter lineup for ${userId}: required GK/DEF/MID/FWD order is not valid`);
  }
  const captainId = ordered[3];
  await client.query(`
    insert into app.lineups (user_id, card_ids, captain_id)
    values ($1, $2::jsonb, $3)
    on conflict (user_id) do update
      set card_ids=excluded.card_ids, captain_id=excluded.captain_id
  `, [userId, JSON.stringify(ordered), captainId]);
  return { updated: true, beforeCardIds: currentIds, cardIds: ordered };
}

async function restoreConfirmedAccount(client, account) {
  const proof = validStarterPacks(account.pack_cards, account.selected_cards);
  if (!proof) {
    return { restored: false, reason: "selection-not-proven-by-five-packs" };
  }

  const allPackPlayerIds = positiveIds(proof.packs.flat());
  const players = rows(await client.query(`
    select id, name, team, position::text as position, league
    from app.players
    where id=any($1::int[])
  `, [allPackPlayerIds]));
  const byPlayerId = new Map(players.map((player) => [Number(player.id), player]));
  if (proof.selectedPlayerIds.some((playerId) => !byPlayerId.has(playerId))) {
    return { restored: false, reason: "selected-player-row-missing" };
  }

  await backupAccount(client, account);
  const existing = rows(await client.query(`
    select id, player_id
    from app.player_cards
    where owner_id=$1
      and rarity::text='common'
      and player_id=any($2::int[])
    order by acquired_at asc nulls last, id
  `, [account.user_id, allPackPlayerIds]));
  const cardByPlayerId = new Map();
  for (const card of existing) {
    const playerId = Number(card.player_id);
    if (!cardByPlayerId.has(playerId)) cardByPlayerId.set(playerId, Number(card.id));
  }

  const mintedPlayerIds = [];
  const ensureCommonCard = async (playerId) => {
    if (cardByPlayerId.has(playerId)) return;
    const created = rows(await client.query(`
      insert into app.player_cards
        (player_id, owner_id, rarity, level, xp, decisive_score, for_sale, price)
      values ($1, $2, 'common', 1, 0, 35, false, 0)
      returning id
    `, [playerId, account.user_id]))[0];
    if (!created?.id) throw new Error(`Could not restore selected player ${playerId} for ${account.email}`);
    cardByPlayerId.set(playerId, Number(created.id));
    mintedPlayerIds.push(playerId);
  };

  for (const playerId of proof.selectedPlayerIds) {
    await ensureCommonCard(playerId);
  }

  const starterCardIds = proof.selectedPlayerIds.map((playerId) => cardByPlayerId.get(playerId));
  const lineupPlayerIds = [];
  const eligibilitySubstitutePlayerIds = [];
  for (let index = 0; index < REQUIRED_POSITIONS.length; index += 1) {
    const selectedPlayerId = proof.selectedPlayerIds[index];
    const requiredPosition = REQUIRED_POSITIONS[index];
    if (normalizePosition(byPlayerId.get(selectedPlayerId)?.position) === requiredPosition) {
      lineupPlayerIds.push(selectedPlayerId);
      continue;
    }

    const alternatives = proof.packs[index]
      .filter((playerId) => normalizePosition(byPlayerId.get(playerId)?.position) === requiredPosition)
      .sort((left, right) => {
        const leftOwned = cardByPlayerId.has(left) ? 0 : 1;
        const rightOwned = cardByPlayerId.has(right) ? 0 : 1;
        return leftOwned - rightOwned || left - right;
      });
    const substitutePlayerId = alternatives[0];
    if (!substitutePlayerId) {
      return { restored: false, reason: `no-current-${requiredPosition}-in-original-pack-${index + 1}` };
    }
    await ensureCommonCard(substitutePlayerId);
    lineupPlayerIds.push(substitutePlayerId);
    eligibilitySubstitutePlayerIds.push(substitutePlayerId);
  }
  lineupPlayerIds.push(proof.selectedPlayerIds[4]);
  const lineupCardIds = lineupPlayerIds.map((playerId) => cardByPlayerId.get(playerId));
  const lineup = await ensureEligibleLineup(client, account.user_id, lineupCardIds);
  await client.query(`
    insert into app.audit_logs (user_id, action, meta)
    values ($1, 'admin.confirmed_starter_selection_restored', $2::jsonb)
  `, [account.user_id, JSON.stringify({
    repairKey: REPAIR_KEY,
    proof: "completed onboarding selection; exactly one selected player from each original pack",
    selectedPlayerIds: proof.selectedPlayerIds,
    starterCardIds,
    mintedPlayerIds,
    existingPlayerIds: proof.selectedPlayerIds.filter((id) => !mintedPlayerIds.includes(id)),
    eligibilitySubstitutePlayerIds,
    lineupUpdated: lineup.updated,
    lineupCardIds: lineup.cardIds,
    previousLineupCardIds: lineup.beforeCardIds,
  })]);

  console.log(
    `STARTER_RESTORE_CONFIRMED email=${account.email}`
    + ` selectedPlayerIds=${proof.selectedPlayerIds.join(",")}`
    + ` starterCardIds=${starterCardIds.join(",")}`
    + ` minted=${mintedPlayerIds.length}`
    + ` eligibilitySubstitutes=${eligibilitySubstitutePlayerIds.join(",") || "none"}`
    + ` lineupUpdated=${lineup.updated}`,
  );
  return { restored: true, minted: mintedPlayerIds.length, lineupUpdated: lineup.updated };
}

async function restoreDocumentedResetTeam(client, account) {
  const cardIds = positiveIds(account.reset_meta?.starterCardIds);
  const playerIds = positiveIds(account.reset_meta?.starterPlayerIds);
  if (cardIds.length !== 5 || playerIds.length !== 5) {
    return { restored: false, reason: "reset-audit-does-not-contain-five-cards" };
  }

  const cards = rows(await client.query(`
    select pc.id, pc.player_id, pc.owner_id, p.position::text as position
    from app.player_cards pc
    join app.players p on p.id=pc.player_id
    where pc.id=any($1::int[])
  `, [cardIds]));
  const byId = new Map(cards.map((card) => [Number(card.id), card]));
  const existingOrdered = cardIds.map((id) => byId.get(id));
  if (existingOrdered.some((card) => card?.owner_id != null && String(card.owner_id) !== String(account.user_id))) {
    return { restored: false, reason: "documented-reset-card-now-owned-by-another-user" };
  }
  if (existingOrdered.some((card, index) => card && Number(card.player_id) !== playerIds[index])) {
    return { restored: false, reason: "documented-reset-card-player-changed" };
  }

  const players = rows(await client.query(`
    select id, position::text as position
    from app.players
    where id=any($1::int[])
  `, [playerIds]));
  const playerById = new Map(players.map((player) => [Number(player.id), player]));
  if (players.length !== 5) return { restored: false, reason: "documented-reset-player-row-missing" };
  if (!REQUIRED_POSITIONS.every((position, index) => normalizePosition(playerById.get(playerIds[index])?.position) === position)) {
    return { restored: false, reason: "documented-reset-team-is-not-position-valid" };
  }

  await backupAccount(client, account);
  const effectiveCardIds = [];
  let reassignedCards = 0;
  let remintedCards = 0;
  for (let index = 0; index < cardIds.length; index += 1) {
    const documentedCardId = cardIds[index];
    const playerId = playerIds[index];
    const existingCard = byId.get(documentedCardId);
    if (existingCard) {
      const reassigned = await client.query(`
        update app.player_cards
        set owner_id=$1, for_sale=false, price=0
        where id=$2 and owner_id is null
      `, [account.user_id, documentedCardId]);
      reassignedCards += Number(reassigned.rowCount || 0);
      effectiveCardIds.push(documentedCardId);
      continue;
    }

    const created = rows(await client.query(`
      insert into app.player_cards
        (player_id, owner_id, rarity, level, xp, decisive_score, for_sale, price)
      values ($1, $2, 'common', 1, 0, 35, false, 0)
      returning id
    `, [playerId, account.user_id]))[0];
    if (!created?.id) throw new Error(`Could not remint documented reset player ${playerId} for ${account.email}`);
    effectiveCardIds.push(Number(created.id));
    remintedCards += 1;
  }

  const lineup = await ensureEligibleLineup(client, account.user_id, effectiveCardIds);
  await client.query(`
    insert into app.audit_logs (user_id, action, meta)
    values ($1, 'admin.documented_reset_starter_team_repaired', $2::jsonb)
  `, [account.user_id, JSON.stringify({
    repairKey: REPAIR_KEY,
    proof: "admin.test_account_starter_reset audit record",
    documentedStarterCardIds: cardIds,
    starterCardIds: effectiveCardIds,
    starterPlayerIds: playerIds,
    reassignedCards,
    remintedCards,
    lineupUpdated: lineup.updated,
    lineupCardIds: lineup.cardIds,
    previousLineupCardIds: lineup.beforeCardIds,
  })]);
  console.log(
    `STARTER_RESTORE_RESET_TEAM email=${account.email}`
    + ` documentedCardIds=${cardIds.join(",")} cardIds=${effectiveCardIds.join(",")}`
    + ` reassigned=${reassignedCards} reminted=${remintedCards}`
    + ` lineupUpdated=${lineup.updated}`,
  );
  return { restored: true, reassigned: reassignedCards, reminted: remintedCards, lineupUpdated: lineup.updated };
}

async function historicalOwnershipEvidence(client, userId, resetAt) {
  const evidence = new Map();
  const add = (cardId, source) => {
    const id = Number(cardId);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    const sources = evidence.get(id) || new Set();
    sources.add(source);
    evidence.set(id, sources);
  };

  if (await tableExists(client, "app.competition_entries")) {
    for (const row of rows(await client.query(
      "select lineup_card_ids, prize_card_id from app.competition_entries where user_id=$1",
      [userId],
    ))) {
      for (const cardId of positiveIds(row.lineup_card_ids)) add(cardId, "competition-entry");
      add(row.prize_card_id, "competition-prize");
    }
  }
  if (await tableExists(client, "app.audit_logs")) {
    for (const row of rows(await client.query(
      "select meta from app.audit_logs where user_id=$1 and created_at < $2::timestamptz",
      [userId, resetAt],
    ))) {
      const meta = row.meta && typeof row.meta === "object" ? row.meta : {};
      add(meta.cardId ?? meta.card_id, "account-audit");
      for (const field of ["cardIds", "starterCardIds", "lineupCardIds"]) {
        for (const cardId of positiveIds(meta[field])) add(cardId, "account-audit");
      }
    }
  }
  if (await tableExists(client, "app.transactions")) {
    for (const row of rows(await client.query(`
      select description from app.transactions
      where user_id=$1 and created_at < $2::timestamptz
        and coalesce(description,'') ~ 'card:[0-9]+'
    `, [userId, resetAt]))) {
      for (const match of String(row.description || "").matchAll(/card:([0-9]+)/g)) {
        add(Number(match[1]), "wallet-transaction");
      }
    }
  }
  if (await tableExists(client, "app.card_ownership_snapshot_items")) {
    for (const row of rows(await client.query(
      "select distinct card_id from app.card_ownership_snapshot_items where user_id=$1",
      [userId],
    ))) add(row.card_id, "ownership-snapshot");
  }
  return evidence;
}

async function restoreProvenHistoricalCards(client, account) {
  const packs = Array.isArray(account.pack_cards) ? account.pack_cards.map(positiveIds) : [];
  const offeredPlayerIds = positiveIds(packs.flat());
  if (packs.length !== 5 || !offeredPlayerIds.length) return { restored: 0 };
  const evidence = await historicalOwnershipEvidence(client, account.user_id, account.reset_at);
  if (!evidence.size) return { restored: 0 };

  const candidates = rows(await client.query(`
    select pc.id, pc.player_id, pc.owner_id, p.name, p.team, p.position::text as position
    from app.player_cards pc
    join app.players p on p.id=pc.player_id
    where pc.player_id=any($1::int[])
      and pc.rarity::text='common'
      and pc.acquired_at < $2::timestamptz
      and (pc.owner_id is null or pc.owner_id=$3)
    order by pc.id
  `, [offeredPlayerIds, account.reset_at, account.user_id]))
    .filter((card) => evidence.has(Number(card.id)));
  if (!candidates.length) return { restored: 0 };

  await backupAccount(client, account);
  let restored = 0;
  for (const card of candidates) {
    const sources = [...(evidence.get(Number(card.id)) || [])];
    const result = await client.query(`
      update app.player_cards
      set owner_id=$1, for_sale=false, price=0
      where id=$2 and owner_id is null
    `, [account.user_id, Number(card.id)]);
    if (result.rowCount) restored += 1;
    await client.query(`
      insert into app.audit_logs (user_id, action, meta)
      values ($1, 'admin.proven_historical_starter_card_restored', $2::jsonb)
    `, [account.user_id, JSON.stringify({
      repairKey: REPAIR_KEY,
      cardId: Number(card.id),
      playerId: Number(card.player_id),
      player: String(card.name || ""),
      team: String(card.team || ""),
      position: normalizePosition(card.position),
      evidence: sources,
      ownershipChanged: Boolean(result.rowCount),
    })]);
    console.log(
      `STARTER_RESTORE_PROVEN email=${account.email} cardId=${Number(card.id)}`
      + ` playerId=${Number(card.player_id)} player=${JSON.stringify(String(card.name || ""))}`
      + ` evidence=${sources.join(",")} ownershipChanged=${Boolean(result.rowCount)}`,
    );
  }
  return { restored };
}

async function countConfirmedMismatches(client) {
  return Number(rows(await client.query(`
    select count(distinct ob.user_id)::int as count
    from app.user_onboarding ob
    cross join lateral jsonb_array_elements_text(coalesce(ob.selected_cards,'[]'::jsonb)) selected(value)
    left join app.player_cards pc
      on pc.owner_id=ob.user_id
     and pc.player_id=selected.value::int
     and pc.rarity::text='common'
    where ob.completed=true
      and selected.value ~ '^[0-9]+$'
      and pc.id is null
      and not exists (
        select 1 from app.audit_logs al
        where al.user_id=ob.user_id and al.action=$1
      )
  `, [RESET_ACTION]))[0]?.count || 0);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [REPAIR_KEY]);
    await client.query(`
      create table if not exists app.runtime_data_repairs (
        repair_key text primary key,
        applied_at timestamptz not null default now(),
        details jsonb not null default '{}'::jsonb
      )
    `);
    await client.query(`
      create table if not exists app.starter_selection_restoration_backups (
        repair_key text not null,
        user_id varchar(255) not null,
        email text,
        onboarding jsonb,
        lineup jsonb,
        owned_cards jsonb not null default '[]'::jsonb,
        created_at timestamptz not null default now(),
        primary key (repair_key, user_id)
      )
    `);

    const existingRepair = rows(await client.query(
      "select details from app.runtime_data_repairs where repair_key=$1 limit 1",
      [REPAIR_KEY],
    ))[0];
    if (existingRepair) {
      await client.query("commit");
      console.log(`STARTER_RESTORE_ALREADY_APPLIED repairKey=${REPAIR_KEY} details=${JSON.stringify(existingRepair.details || {})}`);
      return;
    }

    const confirmedAccounts = rows(await client.query(`
      select u.id::text as user_id, lower(coalesce(u.email,'')) as email,
             ob.pack_cards, ob.selected_cards
      from app.user_onboarding ob
      join app.users u on u.id=ob.user_id
      where ob.completed=true
        and not exists (
          select 1 from app.audit_logs al
          where al.user_id=ob.user_id and al.action=$1
        )
      order by lower(coalesce(u.email,''))
    `, [RESET_ACTION]));

    let confirmedRestored = 0;
    let cardsMinted = 0;
    let lineupsRepaired = 0;
    const skipped = [];
    for (const account of confirmedAccounts) {
      const result = await restoreConfirmedAccount(client, account);
      if (!result.restored) {
        skipped.push({ email: account.email, reason: result.reason });
        console.log(`STARTER_RESTORE_SKIPPED email=${account.email} reason=${result.reason}`);
        continue;
      }
      confirmedRestored += 1;
      cardsMinted += Number(result.minted || 0);
      lineupsRepaired += Number(result.lineupUpdated);
    }

    const resetAccounts = rows(await client.query(`
      select distinct on (u.id)
        u.id::text as user_id, lower(coalesce(u.email,'')) as email,
        ob.pack_cards, al.created_at as reset_at, al.meta as reset_meta
      from app.audit_logs al
      join app.users u on u.id=al.user_id
      left join app.user_onboarding ob on ob.user_id=u.id
      where al.action=$1
      order by u.id, al.created_at desc, al.id desc
    `, [RESET_ACTION]));

    let resetTeamsRepaired = 0;
    let resetCardsReassigned = 0;
    let resetCardsReminted = 0;
    let provenHistoricalCardsRestored = 0;
    for (const account of resetAccounts) {
      const resetResult = await restoreDocumentedResetTeam(client, account);
      if (resetResult.restored) {
        resetTeamsRepaired += 1;
        resetCardsReassigned += Number(resetResult.reassigned || 0);
        resetCardsReminted += Number(resetResult.reminted || 0);
        lineupsRepaired += Number(resetResult.lineupUpdated);
      } else {
        console.log(`STARTER_RESTORE_RESET_SKIPPED email=${account.email} reason=${resetResult.reason}`);
      }
      const proven = await restoreProvenHistoricalCards(client, account);
      provenHistoricalCardsRestored += Number(proven.restored || 0);
    }

    const remainingConfirmedMismatches = await countConfirmedMismatches(client);
    if (remainingConfirmedMismatches > 0) {
      throw new Error(`${remainingConfirmedMismatches} proven completed onboarding accounts still lack selected Common cards`);
    }

    const details = {
      confirmedAccountsInspected: confirmedAccounts.length,
      confirmedAccountsRestored: confirmedRestored,
      cardsMinted,
      lineupsRepaired,
      resetAccountsInspected: resetAccounts.length,
      resetTeamsRepaired,
      resetCardsReassigned,
      resetCardsReminted,
      provenHistoricalCardsRestored,
      skipped,
      remainingConfirmedMismatches,
    };
    await client.query(
      "insert into app.runtime_data_repairs (repair_key, details) values ($1, $2::jsonb)",
      [REPAIR_KEY, JSON.stringify(details)],
    );
    await client.query("commit");
    console.log(
      `STARTER_RESTORE_SUMMARY repairKey=${REPAIR_KEY}`
      + ` confirmedRestored=${confirmedRestored} cardsMinted=${cardsMinted}`
      + ` lineupsRepaired=${lineupsRepaired} resetTeamsRepaired=${resetTeamsRepaired}`
      + ` resetCardsReassigned=${resetCardsReassigned}`
      + ` resetCardsReminted=${resetCardsReminted}`
      + ` provenHistoricalCardsRestored=${provenHistoricalCardsRestored}`
      + ` remainingConfirmedMismatches=${remainingConfirmedMismatches}`,
    );
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`STARTER_SELECTION_RESTORE_FAILED ${error?.message || error}`);
  process.exit(1);
});
