#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;
const TEST_EMAILS = [
  "lbcplaya@gmail.com",
  "joeberber2580@gmail.com",
  "zaylon2580@gmail.com",
  "zjondreangermund@gmail.com",
];

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

const rows = (r) => Array.isArray(r?.rows) ? r.rows : [];

async function table(name) {
  return Boolean(rows(await client.query("select to_regclass($1) as n", [name]))[0]?.n);
}

async function column(schema, tableName, columnName) {
  return Boolean(rows(await client.query(
    "select 1 from information_schema.columns where table_schema=$1 and table_name=$2 and column_name=$3 limit 1",
    [schema, tableName, columnName],
  ))[0]);
}

function addEvidence(map, row, source) {
  const key = `${row.card_id}:${row.user_id}`;
  const existing = map.get(key) || {
    cardId: String(row.card_id),
    userId: String(row.user_id),
    email: String(row.email || "").toLowerCase(),
    sources: [],
  };
  existing.sources.push(`${source}:${Number(row.evidence_count || 0)}`);
  map.set(key, existing);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  await client.connect();
  try {
    const ownership = rows(await client.query(`
      select u.id::text user_id, lower(coalesce(u.email,'')) email,
             count(pc.id)::int owned_cards,
             count(pc.id) filter (where lower(pc.rarity::text)='common')::int common_cards,
             count(pc.id) filter (where lower(pc.rarity::text)='rare')::int rare_cards,
             count(pc.id) filter (where lower(pc.rarity::text)='unique')::int unique_cards,
             count(pc.id) filter (where lower(pc.rarity::text)='epic')::int epic_cards,
             count(pc.id) filter (where lower(pc.rarity::text)='legendary')::int legendary_cards
      from app.users u
      left join app.player_cards pc on pc.owner_id::text=u.id::text
      where lower(coalesce(u.email,'')) <> all($1::text[])
      group by u.id,u.email
      order by owned_cards asc,email asc
    `, [TEST_EMAILS]));

    const evidence = new Map();
    if (await table("app.competition_entries")
      && await column("app", "competition_entries", "user_id")
      && await column("app", "competition_entries", "lineup_card_ids")) {
      const found = rows(await client.query(`
        select v.value::bigint card_id, ce.user_id::text user_id,
               lower(coalesce(u.email,'')) email, count(*)::int evidence_count
        from app.competition_entries ce
        join app.users u on u.id::text=ce.user_id::text
        cross join lateral jsonb_array_elements_text(coalesce(ce.lineup_card_ids,'[]'::jsonb)) v(value)
        where v.value ~ '^[0-9]+$'
          and lower(coalesce(u.email,'')) <> all($1::text[])
        group by v.value,ce.user_id,u.email
      `, [TEST_EMAILS]));
      for (const row of found) addEvidence(evidence, row, "entry");
    }

    if (await table("app.audit_logs")
      && await column("app", "audit_logs", "user_id")
      && await column("app", "audit_logs", "meta")) {
      const found = rows(await client.query(`
        select (al.meta->>'cardId')::bigint card_id, al.user_id::text user_id,
               lower(coalesce(u.email,'')) email, count(*)::int evidence_count
        from app.audit_logs al
        join app.users u on u.id::text=al.user_id::text
        where al.meta ? 'cardId'
          and (al.meta->>'cardId') ~ '^[0-9]+$'
          and lower(coalesce(u.email,'')) <> all($1::text[])
        group by (al.meta->>'cardId')::bigint,al.user_id,u.email
      `, [TEST_EMAILS]));
      for (const row of found) addEvidence(evidence, row, "audit");
    }

    if (await table("app.transactions")
      && await column("app", "transactions", "user_id")
      && await column("app", "transactions", "description")) {
      const found = rows(await client.query(`
        select (regexp_match(coalesce(t.description,''),'card:([0-9]+)'))[1]::bigint card_id,
               t.user_id::text user_id, lower(coalesce(u.email,'')) email,
               count(*)::int evidence_count
        from app.transactions t
        join app.users u on u.id::text=t.user_id::text
        where coalesce(t.description,'') ~ 'card:[0-9]+'
          and lower(coalesce(u.email,'')) <> all($1::text[])
        group by (regexp_match(coalesce(t.description,''),'card:([0-9]+)'))[1]::bigint,t.user_id,u.email
      `, [TEST_EMAILS]));
      for (const row of found) addEvidence(evidence, row, "wallet");
    }

    const ids = [...new Set([...evidence.values()].map(x => x.cardId))];
    const cards = ids.length ? rows(await client.query(`
      select pc.id::text card_id, pc.owner_id::text current_owner_id,
             lower(coalesce(cu.email,'')) current_owner_email,
             pc.rarity::text rarity, pc.serial_id, pc.serial_number,
             p.name player_name, p.team player_team
      from app.player_cards pc
      left join app.users cu on cu.id::text=pc.owner_id::text
      left join app.players p on p.id=pc.player_id
      where pc.id::text=any($1::text[])
    `, [ids])) : [];
    const cardById = new Map(cards.map(c => [String(c.card_id), c]));

    const candidates = [];
    for (const item of evidence.values()) {
      const card = cardById.get(item.cardId) || null;
      let state = "card_row_missing";
      if (card?.current_owner_id == null) state = "orphaned_unowned";
      else if (String(card.current_owner_id) === item.userId) state = "still_owned";
      else state = "owner_conflict";
      if (state !== "still_owned") candidates.push({ ...item, state, card });
    }

    let snapshotDrift = [];
    let latestBatch = null;
    if (await table("app.card_ownership_snapshot_batches") && await table("app.card_ownership_snapshot_items")) {
      latestBatch = rows(await client.query(`select batch_id::text batch_id,captured_at from app.card_ownership_snapshot_batches order by captured_at desc limit 1`))[0] || null;
      if (latestBatch) {
        snapshotDrift = rows(await client.query(`
          select i.card_id::text card_id,i.user_id::text expected_user_id,
                 lower(coalesce(i.user_email,'')) expected_email,
                 pc.owner_id::text current_owner_id,lower(coalesce(cu.email,'')) current_owner_email,
                 p.name player_name,pc.rarity::text rarity,pc.serial_id,pc.serial_number
          from app.card_ownership_snapshot_items i
          left join app.player_cards pc on pc.id=i.card_id
          left join app.users cu on cu.id::text=pc.owner_id::text
          left join app.players p on p.id=pc.player_id
          where i.batch_id=$1
            and lower(coalesce(i.user_email,'')) <> all($2::text[])
            and (pc.id is null or pc.owner_id is null or pc.owner_id::text<>i.user_id::text)
          order by i.user_email,i.card_id
        `, [latestBatch.batch_id, TEST_EMAILS]));
      }
    }

    const zero = ownership.filter(x => Number(x.owned_cards) === 0);
    const low = ownership.filter(x => Number(x.owned_cards) > 0 && Number(x.owned_cards) < 5);
    const orphaned = candidates.filter(x => x.state === "orphaned_unowned");
    const missing = candidates.filter(x => x.state === "card_row_missing");
    const conflicts = candidates.filter(x => x.state === "owner_conflict");

    console.log(`CARD_AUDIT_SUMMARY normalUsers=${ownership.length} totalOwned=${ownership.reduce((s,x)=>s+Number(x.owned_cards||0),0)} zeroUsers=${zero.length} lowUsers=${low.length} evidencePairs=${evidence.size} orphaned=${orphaned.length} missingRows=${missing.length} ownerConflicts=${conflicts.length} snapshotDrift=${snapshotDrift.length} snapshotBatch=${latestBatch?.batch_id || 'none'}`);
    for (const u of [...zero, ...low]) {
      console.log(`CARD_AUDIT_USER email=${u.email} owned=${u.owned_cards} common=${u.common_cards} rare=${u.rare_cards} unique=${u.unique_cards} epic=${u.epic_cards} legendary=${u.legendary_cards}`);
    }
    for (const c of candidates.slice(0, 500)) {
      console.log(`CARD_AUDIT_CANDIDATE state=${c.state} email=${c.email} cardId=${c.cardId} player=${JSON.stringify(c.card?.player_name || '')} team=${JSON.stringify(c.card?.player_team || '')} rarity=${c.card?.rarity || ''} serial=${c.card?.serial_id || c.card?.serial_number || ''} currentOwner=${c.card?.current_owner_email || c.card?.current_owner_id || 'none'} sources=${c.sources.join(',')}`);
    }
    for (const d of snapshotDrift.slice(0, 500)) {
      console.log(`CARD_AUDIT_SNAPSHOT_DRIFT email=${d.expected_email} cardId=${d.card_id} player=${JSON.stringify(d.player_name || '')} rarity=${d.rarity || ''} currentOwner=${d.current_owner_email || d.current_owner_id || 'none'}`);
    }
    console.log("CARD_AUDIT_SAFETY readOnly=true testAccountsExcluded=4 ownershipChanges=0");
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`CARD_AUDIT_FAILED ${error?.message || error}`);
  process.exit(1);
});
