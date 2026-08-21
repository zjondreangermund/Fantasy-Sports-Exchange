#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;
const FULL_SET_EMAILS = [
  "lbcplaya@gmail.com",
  "joeberber2580@gmail.com",
  "zaylon2580@gmail.com",
  "zjondreangermund@gmail.com",
];

function rows(result) {
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
  return result.rowCount > 0;
}

function keepCard(keep, rawId, reason) {
  const id = Number(rawId || 0);
  if (!Number.isInteger(id) || id <= 0) return;
  const reasons = keep.get(id) || [];
  if (!reasons.includes(reason)) reasons.push(reason);
  keep.set(id, reasons);
}

async function collectProtectedCards(client, userId) {
  const keep = new Map();

  // Signup/onboarding cards: selected_cards stores the five selected player IDs.
  if (await tableExists(client, "app.user_onboarding")) {
    const onboarding = rows(await client.query(
      `select selected_cards from app.user_onboarding where user_id=$1 limit 1`,
      [userId],
    ))[0];
    const selected = Array.isArray(onboarding?.selected_cards)
      ? onboarding.selected_cards.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    for (const playerId of selected) {
      const card = rows(await client.query(
        `select id from app.player_cards
         where owner_id=$1 and player_id=$2 and rarity::text='common'
         order by acquired_at asc nulls last, id asc limit 1`,
        [userId, playerId],
      ))[0];
      keepCard(keep, card?.id, "signup");
    }
  }

  // Tournament/card-cup winning cards are explicitly attached to the winning entry.
  if (
    await tableExists(client, "app.competition_entries")
    && await columnExists(client, "app", "competition_entries", "prize_card_id")
  ) {
    for (const row of rows(await client.query(
      `select prize_card_id as id from app.competition_entries
       where user_id=$1 and prize_card_id is not null`,
      [userId],
    ))) keepCard(keep, row.id, "tournament-win");
  }

  // Preserve other real earned/replacement cards. These are not part of the old full-set grant.
  if (await tableExists(client, "app.daily_login_rewards")) {
    for (const row of rows(await client.query(
      `select card_id as id from app.daily_login_rewards where user_id=$1 and card_id is not null`,
      [userId],
    ))) keepCard(keep, row.id, "weekly-reward");
  }
  if (await tableExists(client, "app.referrals")) {
    for (const row of rows(await client.query(
      `select reward_card_id as id from app.referrals where referrer_user_id=$1 and reward_card_id is not null`,
      [userId],
    ))) keepCard(keep, row.id, "referral-reward");
  }
  if (await tableExists(client, "app.player_replacement_claims")) {
    for (const row of rows(await client.query(
      `select replacement_card_id as id from app.player_replacement_claims
       where user_id=$1 and replacement_card_id is not null`,
      [userId],
    ))) keepCard(keep, row.id, "replacement-card");
  }

  // Preserve cards the user actually bought/traded for. The mass test-grant script created no wallet transaction.
  if (await tableExists(client, "app.transactions")) {
    const txRows = rows(await client.query(
      `select coalesce(description,'') as description from app.transactions where user_id=$1`,
      [userId],
    ));
    for (const row of txRows) {
      const text = String(row.description || "");
      for (const match of text.matchAll(/card:([0-9]+)/g)) keepCard(keep, Number(match[1]), "wallet-transaction");
    }
  }
  if (await tableExists(client, "app.audit_logs")) {
    for (const row of rows(await client.query(
      `select (meta->>'cardId')::bigint as id
       from app.audit_logs
       where user_id=$1
         and action in ('marketplace.purchase.completed','auction.purchase.completed','auction.win.completed')
         and meta ? 'cardId'
         and (meta->>'cardId') ~ '^[0-9]+$'`,
      [userId],
    ))) keepCard(keep, row.id, "purchase-audit");
  }

  // Future-proof explicit prize/reward tables that store user_id + card_id.
  const awardTables = rows(await client.query(`
    select table_name
    from information_schema.columns
    where table_schema='app' and table_name ~ '(prize|award|reward)'
    group by table_name
    having bool_or(column_name='user_id') and bool_or(column_name='card_id')
  `));
  for (const tableRow of awardTables) {
    const table = String(tableRow.table_name || "");
    if (!/^[a-z0-9_]+$/i.test(table)) continue;
    for (const row of rows(await client.query(
      `select card_id as id from app."${table}" where user_id=$1 and card_id is not null`,
      [userId],
    ))) keepCard(keep, row.id, `earned:${table}`);
  }

  // Older accounts may pre-date onboarding records. Preserve the earliest five non-demo Common cards as signup fallback.
  if (![...keep.values()].some((reasons) => reasons.includes("signup"))) {
    const fallback = rows(await client.query(
      `select id from app.player_cards
       where owner_id=$1 and rarity::text='common'
         and coalesce(serial_id,'') not like 'demo-%'
       order by acquired_at asc nulls last, id asc limit 5`,
      [userId],
    ));
    for (const row of fallback) keepCard(keep, row.id, "signup-fallback");
  }

  return keep;
}

async function ensureArchivePlayer(client, sourcePlayerId, cardId) {
  const archiveFplId = -(1_000_000_000 + Number(cardId));
  const existing = rows(await client.query(`select id from app.players where fpl_id=$1 limit 1`, [archiveFplId]))[0];
  if (existing?.id) return Number(existing.id);

  const inserted = rows(await client.query(`
    insert into app.players (
      name, team, league, position, nationality, age, overall, image_url,
      fpl_id, code, photo, web_name, status, news, now_cost,
      selected_by_percent, total_points, form, synced_at
    )
    select
      name, team, 'Legacy / Test Grant Archive', position, nationality, age, overall, image_url,
      $2, null, photo, web_name, 'archived',
      concat_ws(' ', nullif(news,''), 'Removed from a historical full-set test grant; retained only for immutable audit/tournament references.'),
      now_cost, selected_by_percent, total_points, form, now()
    from app.players where id=$1
    returning id
  `, [sourcePlayerId, archiveFplId]))[0];

  if (!inserted?.id) throw new Error(`Could not archive full-set test card ${cardId}`);
  return Number(inserted.id);
}

async function removeFromCurrentLineup(client, userId, removeIds) {
  if (!(await tableExists(client, "app.lineups")) || !removeIds.length) return false;
  const lineup = rows(await client.query(
    `select id, card_ids, captain_id from app.lineups where user_id=$1 limit 1`,
    [userId],
  ))[0];
  if (!lineup) return false;

  const removed = new Set(removeIds.map(Number));
  const cards = Array.isArray(lineup.card_ids) ? lineup.card_ids.map(Number).filter((id) => id > 0) : [];
  const next = cards.filter((id) => !removed.has(id));
  const captain = Number(lineup.captain_id || 0);
  const nextCaptain = captain && !removed.has(captain) ? captain : (next[0] || null);
  if (next.length === cards.length && nextCaptain === (captain || null)) return false;

  await client.query(
    `update app.lineups set card_ids=$1::jsonb, captain_id=$2 where id=$3`,
    [JSON.stringify(next), nextCaptain, Number(lineup.id)],
  );
  return true;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  if (!(await tableExists(client, "app.users")) || !(await tableExists(client, "app.player_cards"))) {
    console.log("[full-set-finalize] Core user/card tables do not exist; skipping.");
    await client.end();
    return;
  }

  try {
    await client.query("begin");
    await client.query(`select pg_advisory_xact_lock(hashtext('fantasy-arena:finalize-full-set-test-cleanup-v1'))`);

    const users = rows(await client.query(
      `select id, lower(coalesce(email,'')) as email
       from app.users where lower(coalesce(email,''))=any($1::text[])`,
      [FULL_SET_EMAILS],
    ));

    const summaries = [];
    for (const user of users) {
      const userId = String(user.id);
      const owned = rows(await client.query(`
        select pc.id, pc.player_id, pc.rarity::text as rarity, pc.serial_id
        from app.player_cards pc where pc.owner_id=$1 order by pc.id
      `, [userId]));
      const keep = await collectProtectedCards(client, userId);
      const remove = owned.filter((card) => !keep.has(Number(card.id)));
      const removeIds = remove.map((card) => Number(card.id));
      const lineupRewritten = await removeFromCurrentLineup(client, userId, removeIds);

      let archived = 0;
      let obviousDemoSerials = 0;
      for (const card of remove) {
        if (String(card.serial_id || "").toLowerCase().startsWith("demo-")) obviousDemoSerials += 1;
        const archivePlayerId = await ensureArchivePlayer(client, Number(card.player_id), Number(card.id));
        await client.query(`
          update app.player_cards
          set player_id=$1,
              owner_id=null,
              serial_id=$2,
              serial_number=1,
              max_supply=1,
              for_sale=false,
              price=0
          where id=$3 and owner_id=$4
        `, [archivePlayerId, `LEGACY-TEST-${Number(card.id)}`, Number(card.id), userId]);
        archived += 1;
      }

      const finalOwned = Number(rows(await client.query(
        `select count(*)::int as count from app.player_cards where owner_id=$1`,
        [userId],
      ))[0]?.count || 0);
      const reasonCounts = {};
      for (const reasons of keep.values()) {
        for (const reason of reasons) reasonCounts[reason] = Number(reasonCounts[reason] || 0) + 1;
      }
      summaries.push({
        email: user.email,
        before: owned.length,
        kept: keep.size,
        archivedTestCards: archived,
        obviousDemoSerials,
        finalOwned,
        lineupRewritten,
        keptByReason: reasonCounts,
      });
    }

    await client.query("commit");
    console.log(JSON.stringify({
      success: true,
      scope: "known-full-set-test-accounts-only",
      rule: "keep signup, tournament wins and other explicit earned/purchased provenance; remove all remaining historical full-set ownership",
      users: summaries,
      note: "Removed test cards remain as unowned legacy archive rows only so historic references are not broken. They are isolated from current Premier League mint supply and never appear in Collection or Marketplace.",
    }, null, 2));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Final full-set test-card cleanup failed:", error);
  process.exit(1);
});
