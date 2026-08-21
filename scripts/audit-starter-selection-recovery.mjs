#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;
const RESET_ACTION = "admin.test_account_starter_reset";

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function tableExists(client, qualifiedName) {
  const result = await client.query("select to_regclass($1) as name", [qualifiedName]);
  return Boolean(result.rows?.[0]?.name);
}

function positiveIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))]
    : [];
}

function addEvidence(evidence, cardId, source) {
  const id = Number(cardId);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  const sources = evidence.get(id) || new Set();
  sources.add(source);
  evidence.set(id, sources);
}

async function ownershipEvidence(client, userId, resetAt) {
  const evidence = new Map();

  if (await tableExists(client, "app.competition_entries")) {
    const entries = rows(await client.query(`
      select lineup_card_ids, prize_card_id
      from app.competition_entries
      where user_id=$1
    `, [userId]));
    for (const entry of entries) {
      for (const cardId of positiveIds(entry.lineup_card_ids)) {
        addEvidence(evidence, cardId, "competition-entry");
      }
      addEvidence(evidence, entry.prize_card_id, "competition-prize");
    }
  }

  if (await tableExists(client, "app.audit_logs")) {
    const history = rows(await client.query(`
      select action, meta
      from app.audit_logs
      where user_id=$1
        and created_at < $2::timestamptz
    `, [userId, resetAt]));
    for (const event of history) {
      const meta = event.meta && typeof event.meta === "object" ? event.meta : {};
      addEvidence(evidence, meta.cardId ?? meta.card_id, "account-audit");
      for (const field of ["cardIds", "starterCardIds", "lineupCardIds"]) {
        for (const cardId of positiveIds(meta[field])) addEvidence(evidence, cardId, "account-audit");
      }
    }
  }

  if (await tableExists(client, "app.transactions")) {
    const transactions = rows(await client.query(`
      select description
      from app.transactions
      where user_id=$1
        and created_at < $2::timestamptz
        and coalesce(description,'') ~ 'card:[0-9]+'
    `, [userId, resetAt]));
    for (const transaction of transactions) {
      for (const match of String(transaction.description || "").matchAll(/card:([0-9]+)/g)) {
        addEvidence(evidence, Number(match[1]), "wallet-transaction");
      }
    }
  }

  if (await tableExists(client, "app.card_ownership_snapshot_items")) {
    const snapshots = rows(await client.query(`
      select distinct card_id
      from app.card_ownership_snapshot_items
      where user_id=$1
    `, [userId]));
    for (const snapshot of snapshots) addEvidence(evidence, snapshot.card_id, "ownership-snapshot");
  }

  return evidence;
}

async function auditResetAccount(client, account) {
  const packCards = Array.isArray(account.pack_cards)
    ? account.pack_cards.map(positiveIds)
    : [];
  const offeredPlayerIds = positiveIds(packCards.flat());
  const recordedPlayerIds = positiveIds(account.selected_cards);
  const currentCards = rows(await client.query(`
    select pc.id::bigint as card_id, pc.player_id::bigint as player_id,
           pc.rarity::text as rarity, p.name as player_name, p.team as player_team
    from app.player_cards pc
    left join app.players p on p.id=pc.player_id
    where pc.owner_id=$1
    order by pc.id
  `, [account.user_id]));

  const evidence = await ownershipEvidence(client, account.user_id, account.reset_at);
  const historicalCards = offeredPlayerIds.length ? rows(await client.query(`
    select pc.id::bigint as card_id, pc.player_id::bigint as player_id,
           pc.owner_id::text as current_owner_id, pc.rarity::text as rarity,
           pc.acquired_at, p.name as player_name, p.team as player_team,
           p.position::text as position
    from app.player_cards pc
    left join app.players p on p.id=pc.player_id
    where pc.player_id=any($1::int[])
      and pc.rarity::text='common'
      and pc.acquired_at < $2::timestamptz
      and (pc.owner_id is null or pc.owner_id=$3)
    order by pc.acquired_at asc nulls last, pc.id
  `, [offeredPlayerIds, account.reset_at, account.user_id])) : [];

  const candidates = historicalCards
    .map((card) => ({
      cardId: Number(card.card_id),
      playerId: Number(card.player_id),
      player: String(card.player_name || ""),
      team: String(card.player_team || ""),
      position: String(card.position || ""),
      owner: card.current_owner_id == null ? "unowned" : "already-owned",
      sources: [...(evidence.get(Number(card.card_id)) || [])],
    }))
    .filter((card) => card.sources.length > 0);

  const perPack = packCards.map((pack, index) => ({
    pack: index + 1,
    candidates: candidates.filter((card) => pack.includes(card.playerId)),
  }));
  const exactRecovery = perPack.length === 5 && perPack.every((pack) => pack.candidates.length === 1);

  console.log(
    `STARTER_RECOVERY_ACCOUNT email=${account.email} resetAt=${new Date(account.reset_at).toISOString()}`
    + ` owned=${currentCards.length} recordedSelections=${recordedPlayerIds.join(",") || "none"}`
    + ` originalOfferPlayers=${offeredPlayerIds.length} provenCandidates=${candidates.length}`
    + ` exactRecovery=${exactRecovery}`,
  );

  for (const pack of perPack) {
    for (const candidate of pack.candidates) {
      console.log(
        `STARTER_RECOVERY_CANDIDATE email=${account.email} pack=${pack.pack}`
        + ` cardId=${candidate.cardId} playerId=${candidate.playerId}`
        + ` player=${JSON.stringify(candidate.player)} team=${JSON.stringify(candidate.team)}`
        + ` position=${candidate.position} owner=${candidate.owner}`
        + ` evidence=${candidate.sources.join(",")}`,
      );
    }
  }

  if (exactRecovery) {
    const exactCards = perPack.map((pack) => pack.candidates[0]);
    console.log(
      `STARTER_RECOVERY_EXACT email=${account.email}`
      + ` cardIds=${exactCards.map((card) => card.cardId).join(",")}`
      + ` playerIds=${exactCards.map((card) => card.playerId).join(",")}`
      + " action=manual-approval-required",
    );
  }

  return { exactRecovery, candidates: candidates.length };
}

async function auditSelectionMismatches(client) {
  const mismatches = rows(await client.query(`
    select lower(coalesce(u.email,'')) as email,
           count(*)::int as missing_selected_cards,
           array_agg(distinct selected.value::int order by selected.value::int) as missing_player_ids
    from app.user_onboarding ob
    join app.users u on u.id=ob.user_id
    cross join lateral jsonb_array_elements_text(coalesce(ob.selected_cards,'[]'::jsonb)) selected(value)
    left join app.player_cards pc
      on pc.owner_id=ob.user_id
     and pc.player_id=selected.value::int
     and pc.rarity::text='common'
    where ob.completed=true
      and selected.value ~ '^[0-9]+$'
      and pc.id is null
    group by u.email
    order by missing_selected_cards desc, email
  `));

  for (const mismatch of mismatches) {
    console.log(
      `STARTER_SELECTION_MISMATCH email=${mismatch.email}`
      + ` missing=${mismatch.missing_selected_cards}`
      + ` playerIds=${positiveIds(mismatch.missing_player_ids).join(",")}`,
    );
  }

  return mismatches.length;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    await client.query("begin read only");
    const requiredTables = ["app.users", "app.player_cards", "app.players", "app.user_onboarding", "app.audit_logs"];
    for (const table of requiredTables) {
      if (!(await tableExists(client, table))) {
        console.log(`STARTER_RECOVERY_SKIPPED missingTable=${table} readOnly=true`);
        await client.query("commit");
        return;
      }
    }

    const resetAccounts = rows(await client.query(`
      select distinct on (u.id)
        u.id::text as user_id, lower(coalesce(u.email,'')) as email,
        ob.pack_cards, ob.selected_cards, ob.completed,
        al.created_at as reset_at, al.meta as reset_meta
      from app.audit_logs al
      join app.users u on u.id=al.user_id
      left join app.user_onboarding ob on ob.user_id=u.id
      where al.action=$1
      order by u.id, al.created_at desc, al.id desc
    `, [RESET_ACTION]));

    let exactRecoveries = 0;
    let provenCandidates = 0;
    for (const account of resetAccounts) {
      const result = await auditResetAccount(client, account);
      exactRecoveries += Number(result.exactRecovery);
      provenCandidates += result.candidates;
    }

    const mismatchedAccounts = await auditSelectionMismatches(client);
    await client.query("commit");
    console.log(
      `STARTER_RECOVERY_SUMMARY resetAccounts=${resetAccounts.length}`
      + ` provenCandidates=${provenCandidates} exactRecoveries=${exactRecoveries}`
      + ` mismatchedAccounts=${mismatchedAccounts} readOnly=true ownershipChanges=0`,
    );
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`STARTER_RECOVERY_AUDIT_FAILED ${error?.message || error}`);
  process.exit(1);
});
