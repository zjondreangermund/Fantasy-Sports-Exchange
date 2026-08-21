#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;

const FPL_BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const FULL_SET_GRANT_EMAILS = [
  "lbcplaya@gmail.com",
  "joeberber2580@gmail.com",
  "zaylon2580@gmail.com",
  "zjondreangermund@gmail.com",
];
const SUPPLY = { common: 1000, rare: 100, unique: 10, epic: 3, legendary: 1 };
const POSITION = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fullName(element) {
  return `${String(element?.first_name || "").trim()} ${String(element?.second_name || "").trim()}`.trim() || String(element?.web_name || "").trim();
}

function imageUrl(element) {
  const code = Number(element?.code || 0);
  if (!code) return null;
  return `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png`;
}

function overall(element) {
  const cost = Number(element?.now_cost || 50) / 10;
  const points = Number(element?.total_points || 0);
  const form = Number(element?.form || 0);
  return Math.max(55, Math.min(95, Math.round(58 + cost * 2.5 + Math.min(12, points / 18) + Math.min(8, form))));
}

function rowsOf(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function tableExists(client, qualified) {
  const result = await client.query("select to_regclass($1) as name", [qualified]);
  return Boolean(result.rows?.[0]?.name);
}

async function columnExists(client, schema, table, column) {
  const result = await client.query(
    `select 1 from information_schema.columns where table_schema=$1 and table_name=$2 and column_name=$3 limit 1`,
    [schema, table, column],
  );
  return Boolean(result.rowCount);
}

async function fetchCurrentPremierLeague() {
  const response = await fetch(FPL_BOOTSTRAP_URL, {
    headers: { Accept: "application/json", "User-Agent": "FantasyArena/1.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`FPL bootstrap failed (${response.status})`);
  const bootstrap = await response.json();
  const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];
  if (teams.length < 20 || elements.length < 300) {
    throw new Error(`FPL bootstrap is incomplete (${teams.length} teams, ${elements.length} players); refusing destructive reconciliation`);
  }
  return { teams, elements };
}

function addMap(map, key, row) {
  if (!key) return;
  const list = map.get(key) || [];
  list.push(row);
  map.set(key, list);
}

async function canonicalizeCurrentPlayers(client, fpl) {
  await client.query(`alter table app.players add column if not exists fpl_id integer`);
  await client.query(`alter table app.players add column if not exists code integer`);
  await client.query(`alter table app.players add column if not exists photo text`);
  await client.query(`alter table app.players add column if not exists web_name text`);
  await client.query(`alter table app.players add column if not exists status text`);
  await client.query(`alter table app.players add column if not exists news text`);
  await client.query(`alter table app.players add column if not exists now_cost real`);
  await client.query(`alter table app.players add column if not exists selected_by_percent real`);
  await client.query(`alter table app.players add column if not exists total_points integer`);
  await client.query(`alter table app.players add column if not exists form real`);
  await client.query(`alter table app.players add column if not exists synced_at timestamp`);

  const teamsById = new Map(fpl.teams.map((team) => [Number(team.id), team]));
  const existing = rowsOf(await client.query(`
    select p.*, coalesce(count(pc.id),0)::int as card_count
    from app.players p
    left join app.player_cards pc on pc.player_id=p.id
    group by p.id
    order by p.id asc
  `));
  const byFpl = new Map();
  const byCode = new Map();
  const byName = new Map();
  const claimedRows = new Set();
  for (const row of existing) {
    addMap(byFpl, Number(row.fpl_id || 0), row);
    addMap(byCode, Number(row.code || 0), row);
    addMap(byName, normalize(row.name), row);
    addMap(byName, normalize(row.web_name), row);
  }

  const duplicateToCanonical = new Map();
  const currentCanonicalIds = new Set();
  const canonicalByFpl = new Map();
  let inserted = 0;
  let updated = 0;
  let duplicates = 0;

  for (const element of fpl.elements) {
    const fplId = Number(element?.id || 0);
    const code = Number(element?.code || 0);
    const name = fullName(element);
    const webName = String(element?.web_name || name).trim();
    const team = teamsById.get(Number(element?.team));
    const teamName = String(team?.name || team?.short_name || "").trim();
    const position = POSITION[Number(element?.element_type)] || "MID";
    if (!fplId || !name || !teamName) continue;

    const candidates = new Map();
    const consider = (row, strength) => {
      if (!row || claimedRows.has(Number(row.id))) return;
      const linked = Number(row.fpl_id || 0);
      if (linked && linked !== fplId) return;
      const current = candidates.get(Number(row.id));
      if (!current || strength > current.strength) candidates.set(Number(row.id), { row, strength });
    };
    for (const row of byFpl.get(fplId) || []) consider(row, 1000);
    for (const row of byCode.get(code) || []) consider(row, 800);
    const exactNames = new Set([normalize(name), normalize(webName)].filter(Boolean));
    for (const key of exactNames) {
      for (const row of byName.get(key) || []) {
        const teamMatch = normalize(row.team) === normalize(teamName);
        consider(row, teamMatch ? 650 : 500);
      }
    }

    let selected = [...candidates.values()].sort((a, b) =>
      b.strength - a.strength || Number(b.row.card_count || 0) - Number(a.row.card_count || 0) || Number(a.row.id) - Number(b.row.id),
    );
    let primary = selected[0]?.row || null;

    if (!primary) {
      const result = await client.query(`
        insert into app.players (
          name, team, league, position, nationality, age, overall, image_url,
          fpl_id, code, photo, web_name, status, news, now_cost,
          selected_by_percent, total_points, form, synced_at
        ) values ($1,$2,'Premier League',$3::public.position,'Unknown',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())
        returning id
      `, [
        name, teamName, position, Math.max(16, Math.min(45, Number(element?.age || 25) || 25)), overall(element), imageUrl(element),
        fplId, code || null, String(element?.photo || code || "") || null, webName, String(element?.status || "a"), String(element?.news || ""),
        Number(element?.now_cost || 0) / 10, Number(element?.selected_by_percent || 0), Number(element?.total_points || 0), Number(element?.form || 0),
      ]);
      primary = { id: Number(result.rows[0].id), card_count: 0 };
      selected = [{ row: primary, strength: 1000 }];
      inserted += 1;
    }

    const primaryId = Number(primary.id);
    currentCanonicalIds.add(primaryId);
    canonicalByFpl.set(fplId, primaryId);
    claimedRows.add(primaryId);

    await client.query(`
      update app.players set
        name=$1, team=$2, league='Premier League', position=$3::public.position,
        nationality=coalesce(nullif(nationality,''),'Unknown'),
        age=case when age is null or age <= 0 then $4 else age end,
        overall=$5, image_url=$6, fpl_id=$7, code=$8, photo=$9, web_name=$10,
        status=$11, news=$12, now_cost=$13, selected_by_percent=$14,
        total_points=$15, form=$16, synced_at=now()
      where id=$17
    `, [
      name, teamName, position, Math.max(16, Math.min(45, Number(element?.age || 25) || 25)), overall(element), imageUrl(element), fplId,
      code || null, String(element?.photo || code || "") || null, webName, String(element?.status || "a"), String(element?.news || ""),
      Number(element?.now_cost || 0) / 10, Number(element?.selected_by_percent || 0), Number(element?.total_points || 0), Number(element?.form || 0), primaryId,
    ]);
    updated += 1;

    for (const item of selected.slice(1)) {
      const sourceId = Number(item.row.id);
      if (!sourceId || sourceId === primaryId || claimedRows.has(sourceId)) continue;
      duplicateToCanonical.set(sourceId, primaryId);
      claimedRows.add(sourceId);
      duplicates += 1;
    }
  }

  return { duplicateToCanonical, currentCanonicalIds, canonicalByFpl, inserted, updated, duplicates };
}

async function getProtectedCardIds(client, targetUsers) {
  const protectedIds = new Set();
  const reasons = new Map();
  const protect = (id, reason) => {
    const cardId = Number(id || 0);
    if (!cardId) return;
    protectedIds.add(cardId);
    const list = reasons.get(cardId) || [];
    if (!list.includes(reason)) list.push(reason);
    reasons.set(cardId, list);
  };

  const fkRows = rowsOf(await client.query(`
    select tc.table_schema, tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema
    where tc.constraint_type='FOREIGN KEY'
      and ccu.table_schema='app' and ccu.table_name='player_cards' and ccu.column_name='id'
  `));
  for (const fk of fkRows) {
    if (fk.table_schema === "app" && fk.table_name === "lineups") continue;
    const schema = String(fk.table_schema).replace(/"/g, '""');
    const table = String(fk.table_name).replace(/"/g, '""');
    const column = String(fk.column_name).replace(/"/g, '""');
    const rows = rowsOf(await client.query(`select distinct "${column}"::bigint as id from "${schema}"."${table}" where "${column}" is not null`));
    for (const row of rows) protect(row.id, `fk:${schema}.${table}.${column}`);
  }

  if (await tableExists(client, "app.competition_entries")) {
    const rows = rowsOf(await client.query(`
      select distinct value::bigint as id
      from app.competition_entries ce,
           lateral jsonb_array_elements_text(coalesce(ce.lineup_card_ids,'[]'::jsonb)) value
      where value ~ '^[0-9]+$'
    `));
    for (const row of rows) protect(row.id, "competition-lineup-history");
  }

  if (await tableExists(client, "app.audit_logs")) {
    const rows = rowsOf(await client.query(`
      select distinct (meta->>'cardId')::bigint as id
      from app.audit_logs
      where meta ? 'cardId' and (meta->>'cardId') ~ '^[0-9]+$'
    `));
    for (const row of rows) protect(row.id, "audit-history");
  }

  if (await tableExists(client, "app.transactions")) {
    const rows = rowsOf(await client.query(`
      select distinct (regexp_match(coalesce(description,''), 'card:([0-9]+)'))[1]::bigint as id
      from app.transactions
      where coalesce(description,'') ~ 'card:[0-9]+'
    `));
    for (const row of rows) protect(row.id, "wallet-trade-history");
  }

  if (await tableExists(client, "app.user_onboarding")) {
    for (const user of targetUsers) {
      const onboarding = rowsOf(await client.query(`select selected_cards from app.user_onboarding where user_id=$1 limit 1`, [user.id]))[0];
      const selected = Array.isArray(onboarding?.selected_cards) ? onboarding.selected_cards.map(Number).filter((id) => id > 0) : [];
      for (const playerId of selected) {
        const row = rowsOf(await client.query(`
          select id from app.player_cards
          where owner_id=$1 and player_id=$2 and rarity::text='common'
          order by acquired_at asc nulls last, id asc limit 1
        `, [user.id, playerId]))[0];
        if (row?.id) protect(row.id, "signup-card");
      }
    }
  }

  return { protectedIds, reasons };
}

async function cleanLineups(client, deletedIds) {
  if (!deletedIds.size || !(await tableExists(client, "app.lineups"))) return 0;
  const lineups = rowsOf(await client.query(`select id, card_ids, captain_id from app.lineups`));
  let changed = 0;
  for (const lineup of lineups) {
    const ids = Array.isArray(lineup.card_ids) ? lineup.card_ids.map(Number).filter((id) => id > 0) : [];
    const next = ids.filter((id) => !deletedIds.has(id));
    const captain = Number(lineup.captain_id || 0);
    const nextCaptain = captain && !deletedIds.has(captain) ? captain : (next[0] || null);
    if (next.length !== ids.length || nextCaptain !== (captain || null)) {
      await client.query(`update app.lineups set card_ids=$1::jsonb, captain_id=$2 where id=$3`, [JSON.stringify(next), nextCaptain, Number(lineup.id)]);
      changed += 1;
    }
  }
  return changed;
}

async function removeKnownFullSetGrants(client) {
  const targetUsers = rowsOf(await client.query(`
    select id, lower(coalesce(email,'')) as email
    from app.users where lower(coalesce(email,'')) = any($1::text[])
  `, [FULL_SET_GRANT_EMAILS]));
  if (!targetUsers.length) return { targetUsers: 0, removed: 0, protected: 0, deletedIds: new Set(), affectedPairs: new Set(), summaries: [] };

  const { protectedIds, reasons } = await getProtectedCardIds(client, targetUsers);
  const deletedIds = new Set();
  const affectedPairs = new Set();
  const summaries = [];

  for (const user of targetUsers) {
    const cards = rowsOf(await client.query(`
      select pc.id, pc.player_id, pc.rarity::text as rarity, pc.serial_id, pc.serial_number, pc.acquired_at,
             p.name as player_name, p.team, p.league, p.fpl_id
      from app.player_cards pc join app.players p on p.id=pc.player_id
      where pc.owner_id=$1
      order by pc.id asc
    `, [user.id]));
    const candidates = cards.filter((card) => !protectedIds.has(Number(card.id)));
    let removed = 0;
    let blocked = 0;
    for (const card of candidates) {
      const cardId = Number(card.id);
      await client.query("savepoint remove_bulk_card");
      try {
        const result = await client.query(`delete from app.player_cards where id=$1 and owner_id=$2 returning id`, [cardId, user.id]);
        if (result.rowCount) {
          deletedIds.add(cardId);
          affectedPairs.add(`${Number(card.player_id)}:${String(card.rarity)}`);
          removed += 1;
        }
        await client.query("release savepoint remove_bulk_card");
      } catch (error) {
        await client.query("rollback to savepoint remove_bulk_card");
        await client.query("release savepoint remove_bulk_card");
        blocked += 1;
        protectedIds.add(cardId);
        reasons.set(cardId, ["database-reference"]);
      }
    }
    summaries.push({ email: user.email, cardsBefore: cards.length, removed, protected: cards.length - removed, blocked });
  }

  return { targetUsers: targetUsers.length, removed: deletedIds.size, protected: protectedIds.size, deletedIds, affectedPairs, summaries };
}

async function migrateDuplicatePlayerCards(client, duplicateToCanonical, affectedPairs) {
  if (!duplicateToCanonical.size) return { cardsMigrated: 0, playerRowsSuperseded: 0 };
  await client.query(`drop trigger if exists player_cards_mint_identity_guard on app.player_cards`);
  await client.query(`drop trigger if exists player_cards_serial_supply_guard on app.player_cards`);

  let cardsMigrated = 0;
  let playerRowsSuperseded = 0;
  for (const [sourceId, canonicalId] of duplicateToCanonical.entries()) {
    const sourceCards = rowsOf(await client.query(`select id, rarity::text as rarity from app.player_cards where player_id=$1`, [sourceId]));
    for (const card of sourceCards) {
      affectedPairs.add(`${canonicalId}:${String(card.rarity)}`);
      affectedPairs.add(`${sourceId}:${String(card.rarity)}`);
    }
    const result = await client.query(`
      update app.player_cards
      set player_id=$1, serial_id=null, serial_number=null, max_supply=0
      where player_id=$2
    `, [canonicalId, sourceId]);
    cardsMigrated += Number(result.rowCount || 0);
    await client.query(`
      update app.players
      set league='Legacy Duplicate', status='superseded',
          news='Merged into the current Premier League player identity; no active cards remain on this legacy row.', synced_at=now()
      where id=$1 and not exists (select 1 from app.player_cards pc where pc.player_id=$1)
    `, [sourceId]);
    playerRowsSuperseded += 1;
  }
  return { cardsMigrated, playerRowsSuperseded };
}

async function normalizeLegacySerials(client, affectedPairs) {
  await client.query(`
    update app.player_cards
    set serial_id=null, serial_number=null, max_supply=0
    where serial_number is null or serial_number <= 0
       or serial_number > case rarity::text
         when 'common' then 1000 when 'rare' then 100 when 'unique' then 10 when 'epic' then 3 when 'legendary' then 1 else 0 end
  `);

  if (await tableExists(client, "app.player_card_serial_counters")) {
    for (const pair of affectedPairs) {
      const [playerText, rarity] = String(pair).split(":");
      const playerId = Number(playerText);
      if (!playerId || !SUPPLY[rarity]) continue;
      const row = rowsOf(await client.query(`
        select coalesce(max(serial_number),0)::int as max_serial
        from app.player_cards where player_id=$1 and rarity::text=$2 and serial_number is not null and serial_number > 0
      `, [playerId, rarity]))[0];
      const maxSerial = Number(row?.max_serial || 0);
      await client.query(`
        insert into app.player_card_serial_counters (player_id, rarity, last_serial_number, max_supply, updated_at)
        values ($1,$2,$3,$4,now())
        on conflict (player_id,rarity) do update set last_serial_number=excluded.last_serial_number,max_supply=excluded.max_supply,updated_at=now()
      `, [playerId, rarity, maxSerial, SUPPLY[rarity]]);
    }
  }
}

async function applyApiFootballImages(client) {
  if (!(await tableExists(client, "app.api_football_players"))) return { directoryPlayers: 0, linkedPlayers: 0, cardsLinked: 0 };
  const seasonRow = rowsOf(await client.query(`select max(season)::int as season from app.api_football_players where active=true`))[0];
  const season = Number(seasonRow?.season || 0);
  if (!season) return { directoryPlayers: 0, linkedPlayers: 0, cardsLinked: 0 };

  const directory = rowsOf(await client.query(`
    select api_player_id, name, team_name, position, photo, nationality
    from app.api_football_players where season=$1 and active=true
  `, [season]));
  const byName = new Map();
  for (const item of directory) addMap(byName, normalize(item.name), item);
  const current = rowsOf(await client.query(`select id,name,team,position::text as position from app.players where lower(league)='premier league' and fpl_id is not null`));
  let linkedPlayers = 0;
  let cardsLinked = 0;
  for (const player of current) {
    const candidates = (byName.get(normalize(player.name)) || []).filter((item) => normalize(item.team_name) === normalize(player.team));
    const exact = candidates.length === 1 ? candidates[0] : null;
    if (!exact) continue;
    const photo = String(exact.photo || "").trim();
    if (photo) await client.query(`update app.players set image_url=$1, nationality=coalesce(nullif($2,''),nationality), synced_at=now() where id=$3`, [photo, String(exact.nationality || ""), Number(player.id)]);
    linkedPlayers += 1;
    const count = rowsOf(await client.query(`select count(*)::int as count from app.player_cards where player_id=$1`, [Number(player.id)]))[0];
    cardsLinked += Number(count?.count || 0);
  }
  return { directoryPlayers: directory.length, linkedPlayers, cardsLinked, season };
}

async function auditInventory(client) {
  const summary = rowsOf(await client.query(`
    select
      count(*) filter (where pc.owner_id is not null)::int as owned_cards,
      count(*) filter (where pc.owner_id is not null and lower(p.league)='premier league' and p.fpl_id is not null)::int as current_epl_cards,
      count(*) filter (where pc.owner_id is not null and not (lower(p.league)='premier league' and p.fpl_id is not null))::int as historical_or_unlinked_cards,
      count(*) filter (where pc.owner_id is not null and (pc.serial_number is null or pc.serial_number <= 0 or coalesce(pc.serial_id,'')=''))::int as cards_waiting_for_serial,
      count(*) filter (where pc.owner_id is not null and lower(p.league)='premier league' and p.fpl_id is not null and coalesce(p.image_url,'')='')::int as current_epl_cards_missing_image
    from app.player_cards pc join app.players p on p.id=pc.player_id
  `))[0] || {};
  const unresolved = rowsOf(await client.query(`
    select p.id,p.name,p.team,p.league,p.fpl_id,count(pc.id)::int as cards
    from app.players p join app.player_cards pc on pc.player_id=p.id
    where pc.owner_id is not null and not (lower(p.league)='premier league' and p.fpl_id is not null)
    group by p.id order by count(pc.id) desc,p.name asc limit 50
  `));
  return { ...summary, unresolvedExamples: unresolved };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  let fpl;
  try {
    fpl = await fetchCurrentPremierLeague();
  } catch (error) {
    console.warn(`[card-reconcile] ${String(error?.message || error)}. No cards were changed.`);
    await client.end();
    return;
  }

  try {
    await client.query("begin");
    await client.query(`select pg_advisory_xact_lock(hashtext('fantasy-arena:epl-card-inventory-reconcile'))`);

    const canonical = await canonicalizeCurrentPlayers(client, fpl);
    const grants = await removeKnownFullSetGrants(client);
    const migrated = await migrateDuplicatePlayerCards(client, canonical.duplicateToCanonical, grants.affectedPairs);
    const lineupsCleaned = await cleanLineups(client, grants.deletedIds);
    await normalizeLegacySerials(client, grants.affectedPairs);
    const apiFootball = await applyApiFootballImages(client);

    // Any owned card not tied to a current FPL player is historical/non-current. Keep legitimate assets,
    // but never expose them for sale while the replacement/history flow resolves them.
    await client.query(`
      update app.player_cards pc set for_sale=false, price=0
      from app.players p
      where p.id=pc.player_id and pc.owner_id is not null
        and not (lower(p.league)='premier league' and p.fpl_id is not null)
    `);

    const inventory = await auditInventory(client);
    await client.query("commit");

    console.log(JSON.stringify({
      success: true,
      source: "official-fpl-current-premier-league",
      fplTeams: fpl.teams.length,
      fplPlayers: fpl.elements.length,
      canonicalPlayers: { inserted: canonical.inserted, updated: canonical.updated, duplicateRowsFound: canonical.duplicates },
      fullSetCleanup: { targetUsers: grants.targetUsers, removedCards: grants.removed, summaries: grants.summaries },
      duplicateMigration: migrated,
      lineupsCleaned,
      apiFootball,
      inventory,
      note: "Remaining legitimate historical/non-current cards are preserved but removed from sale; runtime serial preflight assigns current canonical serials to repaired legacy cards next."
    }, null, 2));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Production card inventory reconciliation failed:", error);
  process.exit(1);
});
