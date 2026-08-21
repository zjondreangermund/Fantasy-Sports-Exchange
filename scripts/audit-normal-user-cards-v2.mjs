#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;
const TEST_EMAILS = [
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
    "select 1 from information_schema.columns where table_schema=$1 and table_name=$2 and column_name=$3 limit 1",
    [schema, table, column],
  );
  return result.rowCount > 0;
}

async function currentOwnership(client) {
  return rows(await client.query(`
    select
      u.id::text as user_id,
      lower(coalesce(u.email,'')) as email,
      count(pc.id)::int as owned_cards,
      count(pc.id) filter (where lower(pc.rarity::text) = 'common')::int as common_cards,
      count(pc.id) filter (where lower(pc.rarity::text) = 'rare')::int as rare_cards,
      count(pc.id) filter (where lower(pc.rarity::text) = 'unique')::int as unique_cards,
      count(pc.id) filter (where lower(pc.rarity::text) = 'epic')::int as epic_cards,
      count(pc.id) filter (where lower(pc.rarity::text) = 'legendary')::int as legendary_cards
    from app.users u
    left join app.player_cards pc on pc.owner_id::text = u.id::text
    where lower(coalesce(u.email,'')) <> all($1::text[])
    group by u.id, u.email
    order by owned_cards desc, email
  `, [TEST_EMAILS]));
}

async function snapshotDrift(client) {
  if (!(await tableExists(client, "app.card_ownership_snapshot_batches"))
      || !(await tableExists(client, "app.card_ownership_snapshot_items"))) {
    return { available: false, latestBatch: null, missing: [], changed: [] };
  }

  const batch = rows(await client.query(`
    select batch_id::text as batch_id, captured_at
    from app.card_ownership_snapshot_batches
    order by captured_at desc
    limit 1
  `))[0] || null;
  if (!batch) return { available: true, latestBatch: null, missing: [], changed: [] };

  const missing = rows(await client.query(`
    select
      i.card_id::bigint as card_id,
      i.user_id::text as expected_user_id,
      lower(coalesce(i.user_email,'')) as expected_email,
      i.state as prior_state,
      pc.owner_id::text as current_owner_id,
      lower(coalesce(cu.email,'')) as current_owner_email,
      p.name as current_player_name,
      pc.rarity::text as current_rarity,
      pc.serial_id as current_serial_id,
      pc.serial_number as current_serial_number
    from app.card_ownership_snapshot_items i
    left join app.player_cards pc on pc.id=i.card_id
    left join app.users cu on cu.id::text=pc.owner_id::text
    left join app.players p on p.id=pc.player_id
    where i.batch_id=$1
      and lower(coalesce(i.user_email,'')) <> all($2::text[])
      and (pc.id is null or pc.owner_id is null or pc.owner_id::text <> i.user_id::text)
    order by i.user_email, i.card_id
    limit 2000
  `, [batch.batch_id, TEST_EMAILS]));

  const changed = rows(await client.query(`
    select
      i.card_id::bigint as card_id,
      i.user_id::text as user_id,
      lower(coalesce(i.user_email,'')) as email,
      i.state as prior_state,
      pc.player_id::bigint as current_player_id,
      p.name as current_player_name,
      pc.rarity::text as current_rarity,
      pc.serial_id as current_serial_id,
      pc.serial_number as current_serial_number
    from app.card_ownership_snapshot_items i
    join app.player_cards pc on pc.id=i.card_id and pc.owner_id::text=i.user_id::text
    left join app.players p on p.id=pc.player_id
    where i.batch_id=$1
      and lower(coalesce(i.user_email,'')) <> all($2::text[])
      and (
        coalesce((i.state->>'playerId')::bigint, -1) <> coalesce(pc.player_id::bigint, -1)
        or coalesce(i.state->>'rarity','') <> coalesce(pc.rarity::text,'')
        or coalesce(i.state->>'serialId','') <> coalesce(pc.serial_id::text,'')
        or coalesce((i.state->>'serialNumber')::int, -1) <> coalesce(pc.serial_number::int, -1)
      )
    order by i.user_email, i.card_id
    limit 2000
  `, [batch.batch_id, TEST_EMAILS]));

  return { available: true, latestBatch: batch, missing, changed };
}

function addEvidence(map, row) {
  const cardId = String(row.card_id ?? "");
  const userId = String(row.user_id ?? "");
  if (!cardId || !userId) return;
  const key = `${cardId}:${userId}`;
  const current = map.get(key) || {
    cardId,
    userId,
    email: String(row.email || "").toLowerCase(),
    sources: [],
  };
  current.sources.push({
    source: row.source,
    evidenceCount: Number(row.evidence_count || 0),
  });
  map.set(key, current);
}

async function historicalEvidence(client) {
  const map = new Map();

  if (await tableExists(client, "app.competition_entries")
      && await columnExists(client, "app", "competition_entries", "user_id")
      && await columnExists(client, "app", "competition_entries", "lineup_card_ids")) {
    const found = rows(await client.query(`
      select
        v.value::bigint as card_id,
        ce.user_id::text as user_id,
        lower(coalesce(u.email,'')) as email,
        count(*)::int as evidence_count
      from app.competition_entries ce
      join app.users u on u.id::text=ce.user_id::text
      cross join lateral jsonb_array_elements_text(coalesce(ce.lineup_card_ids,'[]'::jsonb)) v(value)
      where v.value ~ '^[0-9]+$'
        and lower(coalesce(u.email,'')) <> all($1::text[])
      group by v.value, ce.user_id, u.email
      order by evidence_count desc
      limit 3000
    `, [TEST_EMAILS]));
    for (const row of found) addEvidence(map, { source: "competition_entry_history", ...row });
  }

  if (await tableExists(client, "app.audit_logs")
      && await columnExists(client, "app", "audit_logs", "user_id")
      && await columnExists(client, "app", "audit_logs", "meta")) {
    const found = rows(await client.query(`
      select
        (al.meta->>'cardId')::bigint as card_id,
        al.user_id::text as user_id,
        lower(coalesce(u.email,'')) as email,
        count(*)::int as evidence_count
      from app.audit_logs al
      join app.users u on u.id::text=al.user_id::text
      where al.meta ? 'cardId'
        and (al.meta->>'cardId') ~ '^[0-9]+$'
        and lower(coalesce(u.email,'')) <> all($1::text[])
      group by (al.meta->>'cardId')::bigint, al.user_id, u.email
      order by evidence_count desc
      limit 3000
    `, [TEST_EMAILS]));
    for (const row of found) addEvidence(map, { source: "audit_log_history", ...row });
  }

  if (await tableExists(client, "app.transactions")
      && await columnExists(client, "app", "transactions", "user_id")
      && await columnExists(client, "app", "transactions", "description")) {
    const found = rows(await client.query(`
      select
        (regexp_match(coalesce(t.description,''), 'card:([0-9]+)'))[1]::bigint as card_id,
        t.user_id::text as user_id,
        lower(coalesce(u.email,'')) as email,
        count(*)::int as evidence_count
      from app.transactions t
      join app.users u on u.id::text=t.user_id::text
      where coalesce(t.description,'') ~ 'card:[0-9]+'
        and lower(coalesce(u.email,'')) <> all($1::text[])
      group by (regexp_match(coalesce(t.description,''), 'card:([0-9]+)'))[1]::bigint, t.user_id, u.email
      order by evidence_count desc
      limit 3000
    `, [TEST_EMAILS]));
    for (const row of found) addEvidence(map, { source: "wallet_transaction_history", ...row });
  }

  return [...map.values()];
}

async function classifyEvidence(client, evidence) {
  if (!evidence.length) return [];
  const cardIds = [...new Set(evidence.map((item) => item.cardId))];
  const cards = rows(await client.query(`
    select
      pc.id::bigint as card_id,
      pc.owner_id::text as current_owner_id,
      lower(coalesce(cu.email,'')) as current_owner_email,
      pc.player_id::bigint as player_id,
      p.name as player_name,
      p.team as player_team,
      pc.rarity::text as rarity,
      pc.serial_id,
      pc.serial_number,
      pc.for_sale,
      pc.price
    from app.player_cards pc
    left join app.users cu on cu.id::text=pc.owner_id::text
    left join app.players p on p.id=pc.player_id
    where pc.id::text = any($1::text[])
  `, [cardIds]));
  const byId = new Map(cards.map((card) => [String(card.card_id), card]));

  return evidence.map((item) => {
    const card = byId.get(item.cardId) || null;
    let state = "card_row_missing";
    if (card?.current_owner_id == null) state = "orphaned_unowned";
    else if (String(card.current_owner_id) === String(item.userId)) state = "still_owned_by_historical_user";
    else state = "currently_owned_by_different_user";
    return { ...item, state, card };
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    if (!(await tableExists(client, "app.users")) || !(await tableExists(client, "app.player_cards"))) {
      console.log(JSON.stringify({ success: true, skipped: true, reason: "core tables unavailable" }));
      return;
    }

    const [ownership, drift, history] = await Promise.all([
      currentOwnership(client),
      snapshotDrift(client),
      historicalEvidence(client),
    ]);
    const classified = await classifyEvidence(client, history);
    const orphaned = classified.filter((item) => item.state === "orphaned_unowned");
    const missingRows = classified.filter((item) => item.state === "card_row_missing");
    const ownerConflicts = classified.filter((item) => item.state === "currently_owned_by_different_user");
    const zeroCardUsers = ownership.filter((item) => Number(item.owned_cards) === 0);
    const lowCardUsers = ownership.filter((item) => Number(item.owned_cards) > 0 && Number(item.owned_cards) < 5);

    console.log("NORMAL_USER_CARD_FORENSIC_AUDIT_V2=" + JSON.stringify({
      success: true,
      readOnly: true,
      scope: "normal-users-only",
      excludedTestAccounts: TEST_EMAILS.length,
      current: {
        normalUsers: ownership.length,
        totalOwnedCards: ownership.reduce((sum, item) => sum + Number(item.owned_cards || 0), 0),
        zeroCardUsers,
        lowCardUsers,
        ownership,
      },
      snapshot: {
        available: drift.available,
        latestBatch: drift.latestBatch,
        missingSinceLatestSnapshotCount: drift.missing.length,
        changedSinceLatestSnapshotCount: drift.changed.length,
        missing: drift.missing,
        changed: drift.changed,
      },
      historical: {
        evidencePairs: classified.length,
        orphanedUnownedCount: orphaned.length,
        missingCardRowCount: missingRows.length,
        currentOwnerConflictCount: ownerConflicts.length,
        orphanedUnowned: orphaned,
        missingCardRows: missingRows,
        currentOwnerConflicts: ownerConflicts,
        note: "Historical references prove prior association, not necessarily present ownership. No ownership is changed by this audit.",
      },
    }));
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("NORMAL_USER_CARD_FORENSIC_AUDIT_V2_FAILED", error);
  process.exit(1);
});
