#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;
const APPLY = /^(1|true|yes)$/i.test(String(process.env.RUN_REFERRAL_DUPLICATE_REPAIR_20260907 || ""));
const TARGET_EMAIL = String(process.env.REFERRAL_DUPLICATE_REPAIR_EMAIL || "michaelmentile2475@gmail.com").trim().toLowerCase();
const FAILURE_WINDOWS = [
  { label: "failed-referral-20260907-095831z", at: new Date("2026-09-07T09:58:31.046Z") },
  { label: "failed-referral-20260907-112028z", at: new Date("2026-09-07T11:20:28.421Z") },
  { label: "failed-referral-20260907-132301z", at: new Date("2026-09-07T13:23:01.799Z") },
];
const WINDOW_MS = 15_000;

function qident(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
function rows(result) { return Array.isArray(result?.rows) ? result.rows : []; }
function nearFailure(value) {
  const time = new Date(value).getTime();
  const match = FAILURE_WINDOWS.find((window) => Math.abs(time - window.at.getTime()) <= WINDOW_MS);
  return match?.label || null;
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

async function foreignKeyReferences(client, cardId) {
  const refs = rows(await client.query(`
    select ns.nspname as schema_name, cls.relname as table_name, att.attname as column_name
    from pg_constraint fk
    join pg_class cls on cls.oid=fk.conrelid
    join pg_namespace ns on ns.oid=cls.relnamespace
    join lateral unnest(fk.conkey) with ordinality keycols(attnum, ord) on true
    join pg_attribute att on att.attrelid=fk.conrelid and att.attnum=keycols.attnum
    where fk.contype='f'
      and fk.confrelid='app.player_cards'::regclass
    order by ns.nspname, cls.relname, keycols.ord
  `));
  const found = [];
  for (const ref of refs) {
    const sql = `select count(*)::int as count from ${qident(ref.schema_name)}.${qident(ref.table_name)} where ${qident(ref.column_name)}=$1`;
    const count = Number(rows(await client.query(sql, [cardId]))[0]?.count || 0);
    if (count > 0) found.push({ table: `${ref.schema_name}.${ref.table_name}`, column: ref.column_name, count });
  }
  return found;
}

async function looseReferences(client, cardId) {
  const found = [];
  if (await tableExists(client, "app.audit_logs") && await columnExists(client, "app", "audit_logs", "meta")) {
    const result = rows(await client.query(`
      select action, count(*)::int as count
      from app.audit_logs
      where meta->>'cardId'=$1
      group by action
      order by action
    `, [String(cardId)]));
    for (const row of result) found.push({ source: "audit_logs", action: row.action, count: Number(row.count || 0) });
  }
  if (await tableExists(client, "app.competition_entries") && await columnExists(client, "app", "competition_entries", "lineup_card_ids")) {
    const result = rows(await client.query(`
      select count(*)::int as count
      from app.competition_entries
      where exists (
        select 1 from jsonb_array_elements_text(coalesce(lineup_card_ids, '[]'::jsonb)) item(value)
        where item.value=$1
      )
    `, [String(cardId)]))[0];
    if (Number(result?.count || 0) > 0) found.push({ source: "competition_entries.lineup_card_ids", count: Number(result.count) });
  }
  if (await tableExists(client, "app.transactions") && await columnExists(client, "app", "transactions", "description")) {
    const result = rows(await client.query(`
      select count(*)::int as count from app.transactions
      where coalesce(description,'') ~ $1
    `, [`card:${cardId}([^0-9]|$)`]))[0];
    if (Number(result?.count || 0) > 0) found.push({ source: "transactions.description", count: Number(result.count) });
  }
  return found;
}

async function inspectCandidate(client, card) {
  const failureWindow = nearFailure(card.acquired_at);
  const fkRefs = await foreignKeyReferences(client, card.id);
  const looseRefs = await looseReferences(client, card.id);
  return {
    id: Number(card.id),
    player: card.player_name,
    team: card.player_team,
    position: card.player_position,
    rarity: card.rarity,
    acquiredAt: new Date(card.acquired_at).toISOString(),
    failureWindow,
    foreignKeyReferences: fkRefs,
    looseReferences: looseRefs,
    safeFailedReferralLeak: Boolean(failureWindow) && fkRefs.length === 0 && looseRefs.length === 0,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    const user = rows(await client.query(`
      select id::text as id, lower(coalesce(email,'')) as email, name
      from app.users where lower(coalesce(email,''))=$1 limit 1
    `, [TARGET_EMAIL]))[0];
    if (!user) throw new Error(`Target account not found: ${TARGET_EMAIL}`);

    const cards = rows(await client.query(`
      select pc.id, pc.owner_id, pc.rarity::text as rarity, pc.acquired_at,
             p.name as player_name, p.team as player_team, p.position::text as player_position
      from app.player_cards pc
      left join app.players p on p.id=pc.player_id
      where pc.owner_id::text=$1
        and pc.acquired_at >= timestamp '2026-09-07 00:00:00'
      order by pc.acquired_at asc, pc.id asc
    `, [String(user.id)]));

    const inspected = [];
    for (const card of cards) inspected.push(await inspectCandidate(client, card));
    const candidates = inspected.filter((card) => card.safeFailedReferralLeak);
    const repaired = [];
    const skipped = [];

    if (APPLY && candidates.length) {
      await client.query("begin");
      try {
        await client.query("select pg_advisory_xact_lock(hashtext('fantasy-arena:failed-referral-repair-20260907'))");
        for (const candidate of candidates) {
          const current = rows(await client.query(`
            select pc.id, pc.owner_id, pc.acquired_at
            from app.player_cards pc
            where pc.id=$1 and pc.owner_id::text=$2
            for update
          `, [candidate.id, String(user.id)]))[0];
          if (!current || nearFailure(current.acquired_at) !== candidate.failureWindow) {
            skipped.push({ id: candidate.id, reason: "ownership-or-acquisition-window-changed" });
            continue;
          }
          const fkRefs = await foreignKeyReferences(client, candidate.id);
          const looseRefs = await looseReferences(client, candidate.id);
          if (fkRefs.length || looseRefs.length) {
            skipped.push({ id: candidate.id, reason: "card-became-referenced", fkRefs, looseRefs });
            continue;
          }

          const result = await client.query(`
            update app.player_cards
            set owner_id=null, for_sale=false, price=0
            where id=$1 and owner_id::text=$2
            returning id
          `, [candidate.id, String(user.id)]);
          if (result.rowCount !== 1) {
            skipped.push({ id: candidate.id, reason: "card-update-not-applied" });
            continue;
          }
          await client.query(`
            insert into app.audit_logs (user_id, action, meta)
            values ($1, 'admin.failed_referral_card_leak_repaired', $2::jsonb)
          `, [String(user.id), JSON.stringify({
            cardId: candidate.id,
            player: candidate.player,
            acquiredAt: candidate.acquiredAt,
            failureWindow: candidate.failureWindow,
            reason: "card mint occurred immediately before a failed /api/referrals/claim and had no durable reward/referral/lineup/wallet reference",
          })]);
          repaired.push(candidate.id);
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      }
    }

    const finalCount = Number(rows(await client.query(`
      select count(*)::int as count from app.player_cards where owner_id::text=$1
    `, [String(user.id)]))[0]?.count || 0);

    console.log(`REFERRAL_DUPLICATE_REPAIR target=${TARGET_EMAIL} apply=${APPLY} cardsToday=${cards.length} candidates=${candidates.map(x => x.id).join(',') || 'none'} repaired=${repaired.join(',') || 'none'} finalOwnedCards=${finalCount}`);
    console.log(`REFERRAL_DUPLICATE_AUDIT=${JSON.stringify({ user: { id: user.id, email: user.email, name: user.name }, inspected, repaired, skipped, finalOwnedCards: finalCount })}`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`REFERRAL_DUPLICATE_REPAIR_FAILED ${error?.stack || error}`);
  process.exit(1);
});
