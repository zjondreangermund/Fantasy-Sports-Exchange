#!/usr/bin/env node
import { randomInt } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const REPAIR_KEY = "four-test-accounts-starter-common-v1";
const TARGET_EMAILS = [
  "lbcplaya@gmail.com",
  "joeberber2580@gmail.com",
  "zaylon2580@gmail.com",
  "zjondreangermund@gmail.com",
];
const REQUIRED_POSITIONS = ["GK", "DEF", "MID", "FWD"];

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(norm(value).split(" ").filter((token) => token.length > 1));
}

function nameScore(player, apiPlayer) {
  const sourceNames = [player.name, player.web_name].map(norm).filter(Boolean);
  const apiNames = [apiPlayer.name, `${apiPlayer.first_name || ""} ${apiPlayer.last_name || ""}`].map(norm).filter(Boolean);
  let best = 0;
  for (const source of sourceNames) {
    for (const target of apiNames) {
      if (source === target) best = Math.max(best, 120);
      const shorter = source.length <= target.length ? source : target;
      const longer = source.length > target.length ? source : target;
      if (shorter.split(" ").length >= 2 && longer.includes(shorter)) best = Math.max(best, 105);

      const sourceTokens = tokenSet(source);
      const targetTokens = tokenSet(target);
      const sourceList = [...sourceTokens];
      const targetList = [...targetTokens];
      if (!sourceList.length || !targetList.length) continue;
      const overlap = sourceList.filter((token) => targetTokens.has(token));
      const firstMatches = sourceList[0] === targetList[0];
      const surnameOverlap = overlap.filter((token) => token !== sourceList[0]).length;
      if (firstMatches && surnameOverlap >= 1) best = Math.max(best, 96);
      else if (surnameOverlap >= 2) best = Math.max(best, 90);
    }
  }
  return best;
}

function teamScore(playerTeam, apiTeam) {
  const source = norm(playerTeam);
  const target = norm(apiTeam);
  if (!source || !target) return 0;
  if (source === target) return 28;
  if (source.includes(target) || target.includes(source)) return 20;
  return 0;
}

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function tableExists(client, qualified) {
  const result = await client.query("select to_regclass($1) as name", [qualified]);
  return Boolean(result.rows?.[0]?.name);
}

async function columnExists(client, schema, table, column) {
  const result = await client.query(
    "select 1 from information_schema.columns where table_schema=$1 and table_name=$2 and column_name=$3 limit 1",
    [schema, table, column],
  );
  return result.rowCount > 0;
}

function bestApiLink(player, directory) {
  const position = String(player.position || "").toUpperCase();
  const ranked = directory
    .filter((candidate) => String(candidate.position || "").toUpperCase() === position)
    .map((candidate) => {
      const n = nameScore(player, candidate);
      const t = teamScore(player.team, candidate.team_name);
      return { candidate, name: n, team: t, score: n + t };
    })
    .filter((row) => row.name >= 90 && row.team >= 20)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < 110) return null;
  if (second && best.name < 120 && best.score - second.score < 10) return null;
  return best.candidate;
}

async function loadEligiblePlayers(client) {
  if (!(await tableExists(client, "app.api_football_players"))) {
    throw new Error("API-Football player directory is missing; refusing to mint unlinked starter cards");
  }

  const latestSeason = Number(rows(await client.query(
    "select max(season)::int as season from app.api_football_players where active=true",
  ))[0]?.season || 0);
  if (!latestSeason) throw new Error("API-Football current squad directory is empty");

  const directory = rows(await client.query(`
    select api_player_id, name, first_name, last_name, team_name, upper(coalesce(position,'MID')) as position,
           coalesce(photo,'') as photo
    from app.api_football_players
    where season=$1 and active=true
  `, [latestSeason]));

  const players = rows(await client.query(`
    select p.id, p.name, coalesce(p.web_name,'') as web_name, p.team,
           upper(p.position::text) as position, p.fpl_id, coalesce(p.status,'') as status,
           coalesce(p.image_url,'') as image_url
    from app.players p
    where regexp_replace(lower(coalesce(p.league,'')), '[^a-z0-9]+', '', 'g') in ('premierleague','englishpremierleague','epl')
      and coalesce(p.fpl_id,0) > 0
      and lower(coalesce(p.status,'')) not in ('departed','unlinked','archived')
      and upper(p.position::text) in ('GK','DEF','MID','FWD')
    order by p.id
  `));

  const eligible = [];
  for (const player of players) {
    const api = bestApiLink(player, directory);
    if (!api) continue;

    let mintedCommon = 0;
    if (await tableExists(client, "app.player_card_serial_counters")) {
      mintedCommon = Number(rows(await client.query(
        "select coalesce(last_serial_number,0)::int as used from app.player_card_serial_counters where player_id=$1 and rarity='common' limit 1",
        [Number(player.id)],
      ))[0]?.used || 0);
    } else {
      mintedCommon = Number(rows(await client.query(
        "select count(*)::int as used from app.player_cards where player_id=$1 and rarity::text='common'",
        [Number(player.id)],
      ))[0]?.used || 0);
    }
    if (mintedCommon >= 1000) continue;

    eligible.push({
      ...player,
      apiPlayerId: Number(api.api_player_id),
      apiPhoto: String(api.photo || ""),
      apiSeason: latestSeason,
    });
  }

  const counts = Object.fromEntries(REQUIRED_POSITIONS.map((position) => [
    position,
    eligible.filter((player) => player.position === position).length,
  ]));
  for (const position of REQUIRED_POSITIONS) {
    if (Number(counts[position] || 0) < TARGET_EMAILS.length) {
      throw new Error(`Not enough API-Football-linked current EPL ${position} players for starter reset (${counts[position] || 0})`);
    }
  }
  if (eligible.length < TARGET_EMAILS.length * 5) {
    throw new Error(`Not enough API-Football-linked current EPL players for starter reset (${eligible.length})`);
  }

  return { eligible, counts, latestSeason };
}

function pickPlayer(pool, localUsed, globalUsed) {
  const fresh = shuffle(pool.filter((player) => !localUsed.has(Number(player.id)) && !globalUsed.has(Number(player.id))));
  if (fresh.length) return fresh[0];
  const reusable = shuffle(pool.filter((player) => !localUsed.has(Number(player.id))));
  return reusable[0] || null;
}

async function resetUser(client, user, eligible, globalUsed) {
  const userId = String(user.id);
  const beforeCards = rows(await client.query(`
    select id from app.player_cards where owner_id=$1 order by id
  `, [userId]));
  const oldCardIds = beforeCards.map((card) => Number(card.id)).filter((id) => id > 0);

  let releasedLocks = 0;
  if (oldCardIds.length && await tableExists(client, "app.card_locks")) {
    const released = await client.query(
      "delete from app.card_locks where card_id=any($1::int[])",
      [oldCardIds],
    );
    releasedLocks = Number(released.rowCount || 0);
  }

  if (await tableExists(client, "app.lineups")) {
    await client.query(
      "update app.lineups set card_ids='[]'::jsonb, captain_id=null where user_id=$1",
      [userId],
    );
  }

  const removed = await client.query(`
    update app.player_cards
    set owner_id=null, for_sale=false, price=0
    where owner_id=$1
  `, [userId]);

  const selected = [];
  const localUsed = new Set();
  for (const position of REQUIRED_POSITIONS) {
    const candidate = pickPlayer(eligible.filter((player) => player.position === position), localUsed, globalUsed);
    if (!candidate) throw new Error(`Could not select a ${position} starter for ${user.email}`);
    selected.push(candidate);
    localUsed.add(Number(candidate.id));
    globalUsed.add(Number(candidate.id));
  }

  const wildcard = pickPlayer(eligible, localUsed, globalUsed);
  if (!wildcard) throw new Error(`Could not select a wildcard starter for ${user.email}`);
  selected.push(wildcard);
  localUsed.add(Number(wildcard.id));
  globalUsed.add(Number(wildcard.id));

  const newCards = [];
  for (const player of selected) {
    const card = rows(await client.query(`
      insert into app.player_cards
        (player_id, owner_id, rarity, level, xp, decisive_score, for_sale, price)
      values ($1, $2, 'common', 1, 0, 35, false, 0)
      returning id, serial_id, serial_number
    `, [Number(player.id), userId]))[0];
    if (!card?.id) throw new Error(`Starter card could not be created for ${user.email}`);
    newCards.push({
      cardId: Number(card.id),
      playerId: Number(player.id),
      name: String(player.name),
      team: String(player.team),
      position: String(player.position),
      fplId: Number(player.fpl_id),
      apiFootballId: Number(player.apiPlayerId),
      serialId: card.serial_id || null,
      serialNumber: card.serial_number == null ? null : Number(card.serial_number),
    });
  }

  if (
    await tableExists(client, "app.user_onboarding")
    && await columnExists(client, "app", "user_onboarding", "selected_cards")
  ) {
    await client.query(
      "update app.user_onboarding set selected_cards=$1::jsonb where user_id=$2",
      [JSON.stringify(selected.map((player) => Number(player.id))), userId],
    );
  }

  if (await tableExists(client, "app.audit_logs")) {
    await client.query(`
      insert into app.audit_logs (user_id, action, meta)
      values ($1, 'admin.test_account_starter_reset', $2::jsonb)
    `, [userId, JSON.stringify({
      repairKey: REPAIR_KEY,
      removedOwnedCards: Number(removed.rowCount || 0),
      releasedLocks,
      starterCardIds: newCards.map((card) => card.cardId),
      starterPlayerIds: newCards.map((card) => card.playerId),
      rarity: "common",
      sellable: false,
    })]);
  }

  const verification = rows(await client.query(`
    select count(*)::int as total,
           count(*) filter (where rarity::text='common')::int as common,
           count(*) filter (where rarity::text<>'common')::int as other,
           count(*) filter (where for_sale=true)::int as for_sale
    from app.player_cards where owner_id=$1
  `, [userId]))[0] || {};

  if (Number(verification.total || 0) !== 5 || Number(verification.common || 0) !== 5 || Number(verification.other || 0) !== 0 || Number(verification.for_sale || 0) !== 0) {
    throw new Error(`Starter reset verification failed for ${user.email}: ${JSON.stringify(verification)}`);
  }

  return {
    email: String(user.email),
    previousOwnedCards: beforeCards.length,
    removedFromCollection: Number(removed.rowCount || 0),
    releasedLocks,
    finalOwnedCards: 5,
    finalCommonCards: 5,
    sellableCards: 0,
    starters: newCards,
  };
}

async function main() {
  if (process.env.ALLOW_HISTORICAL_TEST_ACCOUNT_RESET !== "true") {
    throw new Error(
      "Historical test-account starter resets are disabled. This destructive offline tool requires explicit ALLOW_HISTORICAL_TEST_ACCOUNT_RESET=true approval.",
    );
  }
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

    const already = rows(await client.query(
      "select repair_key, applied_at, details from app.runtime_data_repairs where repair_key=$1 limit 1",
      [REPAIR_KEY],
    ))[0];
    if (already) {
      await client.query("commit");
      console.log(JSON.stringify({ success: true, skipped: true, repairKey: REPAIR_KEY, appliedAt: already.applied_at, details: already.details }, null, 2));
      return;
    }

    const users = rows(await client.query(`
      select id, lower(coalesce(email,'')) as email
      from app.users
      where lower(coalesce(email,''))=any($1::text[])
      order by lower(coalesce(email,''))
    `, [TARGET_EMAILS]));
    if (users.length !== TARGET_EMAILS.length) {
      const found = new Set(users.map((user) => String(user.email)));
      const missing = TARGET_EMAILS.filter((email) => !found.has(email));
      throw new Error(`Starter reset requires all four target accounts. Missing: ${missing.join(", ")}`);
    }

    const { eligible, counts, latestSeason } = await loadEligiblePlayers(client);
    const globalUsed = new Set();
    const summaries = [];
    for (const user of users) {
      summaries.push(await resetUser(client, user, eligible, globalUsed));
    }

    const details = {
      scope: "four-known-full-set-test-accounts-only",
      apiFootballSeason: latestSeason,
      eligiblePool: eligible.length,
      eligibleByPosition: counts,
      rule: "remove all previous collection ownership and grant exactly five random non-sellable Common current-EPL starter cards: GK, DEF, MID, FWD plus one wildcard",
      users: summaries,
    };
    await client.query(
      "insert into app.runtime_data_repairs (repair_key, details) values ($1,$2::jsonb)",
      [REPAIR_KEY, JSON.stringify(details)],
    );
    await client.query("commit");
    console.log(JSON.stringify({ success: true, repairKey: REPAIR_KEY, ...details }, null, 2));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Four-account starter Common reset failed:", error);
  process.exit(1);
});
