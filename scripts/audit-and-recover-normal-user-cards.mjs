#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;
const TEST_EMAILS = [
  "lbcplaya@gmail.com",
  "joeberber2580@gmail.com",
  "zaylon2580@gmail.com",
  "zjondreangermund@gmail.com",
];
const APPLY = /^(1|true|yes)$/i.test(String(process.env.CARD_RECOVERY_APPLY || ""));
const SOURCE_DATABASE_URL = String(process.env.CARD_RECOVERY_SOURCE_DATABASE_URL || "").trim();

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function makeClient(connectionString) {
  return new Client({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
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

function comparableIdentity(row) {
  return {
    playerId: row?.player_id == null ? null : Number(row.player_id),
    rarity: String(row?.rarity || ""),
    serialId: row?.serial_id == null ? null : String(row.serial_id),
    serialNumber: row?.serial_number == null ? null : Number(row.serial_number),
  };
}

function identityChanged(source, target) {
  return JSON.stringify(comparableIdentity(source)) !== JSON.stringify(comparableIdentity(target));
}

async function loadNormalUsers(client) {
  return rows(await client.query(`
    select id::text as id, lower(coalesce(email,'')) as email
    from app.users
    where lower(coalesce(email,'')) <> all($1::text[])
  `, [TEST_EMAILS]));
}

async function loadCards(client, normalOnly = true) {
  const filter = normalOnly
    ? "and lower(coalesce(u.email,'')) <> all($1::text[])"
    : "";
  const params = normalOnly ? [TEST_EMAILS] : [];
  return rows(await client.query(`
    select
      pc.id::bigint as card_id,
      pc.owner_id::text as owner_id,
      lower(coalesce(u.email,'')) as owner_email,
      pc.player_id::bigint as player_id,
      pc.rarity::text as rarity,
      pc.serial_id,
      pc.serial_number,
      pc.max_supply,
      pc.for_sale,
      pc.price,
      p.name as player_name,
      p.team as player_team,
      p.league as player_league,
      p.fpl_id as player_fpl_id
    from app.player_cards pc
    left join app.users u on u.id::text = pc.owner_id::text
    left join app.players p on p.id = pc.player_id
    where 1=1 ${filter}
    order by pc.id
  `, params));
}

async function loadBackupOwnedCards(source) {
  return rows(await source.query(`
    select
      pc.id::bigint as card_id,
      pc.owner_id::text as owner_id,
      lower(coalesce(u.email,'')) as owner_email,
      pc.player_id::bigint as player_id,
      pc.rarity::text as rarity,
      pc.serial_id,
      pc.serial_number,
      pc.max_supply,
      pc.for_sale,
      pc.price,
      p.name as player_name,
      p.team as player_team,
      p.league as player_league,
      p.fpl_id as player_fpl_id
    from app.player_cards pc
    join app.users u on u.id::text = pc.owner_id::text
    left join app.players p on p.id = pc.player_id
    where pc.owner_id is not null
      and lower(coalesce(u.email,'')) <> all($1::text[])
    order by pc.id
  `, [TEST_EMAILS]));
}

async function snapshotEvidence(client) {
  if (!(await tableExists(client, "app.card_ownership_snapshot_batches"))
      || !(await tableExists(client, "app.card_ownership_snapshot_items"))) {
    return { available: false, candidates: [] };
  }

  const candidates = rows(await client.query(`
    with latest_per_card as (
      select distinct on (i.card_id)
        i.card_id,
        i.user_id,
        i.user_email,
        i.state,
        b.batch_id,
        b.captured_at
      from app.card_ownership_snapshot_items i
      join app.card_ownership_snapshot_batches b on b.batch_id=i.batch_id
      order by i.card_id, b.captured_at desc
    )
    select
      l.card_id::bigint as card_id,
      l.user_id,
      l.user_email,
      l.batch_id,
      l.captured_at,
      l.state,
      pc.player_id::bigint as current_player_id,
      pc.rarity::text as current_rarity,
      pc.serial_id as current_serial_id,
      pc.serial_number as current_serial_number
    from latest_per_card l
    join app.player_cards pc on pc.id=l.card_id
    where pc.owner_id is null
      and lower(coalesce(l.user_email,'')) <> all($1::text[])
    order by l.captured_at desc, l.card_id
    limit 1000
  `, [TEST_EMAILS]));

  return { available: true, candidates };
}

async function historicalEvidence(client) {
  const evidence = [];
  if (await tableExists(client, "app.competition_entries")
      && await columnExists(client, "app", "competition_entries", "user_id")
      && await columnExists(client, "app", "competition_entries", "lineup_card_ids")) {
    const competition = rows(await client.query(`
      select
        v.value::bigint as card_id,
        ce.user_id::text as user_id,
        lower(coalesce(u.email,'')) as email,
        count(*)::int as references
      from app.competition_entries ce
      join app.users u on u.id::text=ce.user_id::text
      cross join lateral jsonb_array_elements_text(coalesce(ce.lineup_card_ids,'[]'::jsonb)) v(value)
      join app.player_cards pc on pc.id=v.value::bigint
      where v.value ~ '^[0-9]+$'
        and pc.owner_id is null
        and lower(coalesce(u.email,'')) <> all($1::text[])
      group by v.value, ce.user_id, u.email
      order by references desc
      limit 1000
    `, [TEST_EMAILS]));
    for (const row of competition) evidence.push({ source: "competition_entry_history", ...row });
  }

  if (await tableExists(client, "app.audit_logs")
      && await columnExists(client, "app", "audit_logs", "user_id")
      && await columnExists(client, "app", "audit_logs", "meta")) {
    const audit = rows(await client.query(`
      select
        (al.meta->>'cardId')::bigint as card_id,
        al.user_id::text as user_id,
        lower(coalesce(u.email,'')) as email,
        count(*)::int as references
      from app.audit_logs al
      join app.users u on u.id::text=al.user_id::text
      join app.player_cards pc on pc.id=(al.meta->>'cardId')::bigint
      where al.meta ? 'cardId'
        and (al.meta->>'cardId') ~ '^[0-9]+$'
        and pc.owner_id is null
        and lower(coalesce(u.email,'')) <> all($1::text[])
      group by (al.meta->>'cardId')::bigint, al.user_id, u.email
      order by references desc
      limit 1000
    `, [TEST_EMAILS]));
    for (const row of audit) evidence.push({ source: "audit_log_history", ...row });
  }

  if (await tableExists(client, "app.transactions")
      && await columnExists(client, "app", "transactions", "user_id")
      && await columnExists(client, "app", "transactions", "description")) {
    const transaction = rows(await client.query(`
      select
        (regexp_match(coalesce(t.description,''), 'card:([0-9]+)'))[1]::bigint as card_id,
        t.user_id::text as user_id,
        lower(coalesce(u.email,'')) as email,
        count(*)::int as references
      from app.transactions t
      join app.users u on u.id::text=t.user_id::text
      join app.player_cards pc on pc.id=(regexp_match(coalesce(t.description,''), 'card:([0-9]+)'))[1]::bigint
      where coalesce(t.description,'') ~ 'card:[0-9]+'
        and pc.owner_id is null
        and lower(coalesce(u.email,'')) <> all($1::text[])
      group by (regexp_match(coalesce(t.description,''), 'card:([0-9]+)'))[1]::bigint, t.user_id, u.email
      order by references desc
      limit 1000
    `, [TEST_EMAILS]));
    for (const row of transaction) evidence.push({ source: "wallet_transaction_history", ...row });
  }

  return evidence;
}

async function compareBackup(source, target) {
  const [sourceCards, targetCards, targetUsers] = await Promise.all([
    loadBackupOwnedCards(source),
    loadCards(target, false),
    loadNormalUsers(target),
  ]);
  const targetByCard = new Map(targetCards.map((card) => [String(card.card_id), card]));
  const targetUserByEmail = new Map(targetUsers.map((user) => [String(user.email), String(user.id)]));

  const unowned = [];
  const missingRows = [];
  const ownerConflicts = [];
  const identityDrift = [];
  const unchanged = [];

  for (const sourceCard of sourceCards) {
    const email = String(sourceCard.owner_email || "").toLowerCase();
    const targetUserId = targetUserByEmail.get(email);
    if (!targetUserId) {
      ownerConflicts.push({ reason: "user_missing_from_live_database", source: sourceCard });
      continue;
    }
    const targetCard = targetByCard.get(String(sourceCard.card_id));
    if (!targetCard) {
      missingRows.push({ source: sourceCard, targetUserId });
      continue;
    }
    if (targetCard.owner_id == null) {
      unowned.push({ source: sourceCard, target: targetCard, targetUserId, identityChanged: identityChanged(sourceCard, targetCard) });
      continue;
    }
    if (String(targetCard.owner_id) !== String(targetUserId)) {
      ownerConflicts.push({ reason: "card_is_currently_owned_by_someone_else", source: sourceCard, target: targetCard, targetUserId });
      continue;
    }
    if (identityChanged(sourceCard, targetCard)) {
      identityDrift.push({ source: sourceCard, target: targetCard, targetUserId });
    } else {
      unchanged.push(String(sourceCard.card_id));
    }
  }

  return { sourceCards: sourceCards.length, unowned, missingRows, ownerConflicts, identityDrift, unchangedCount: unchanged.length };
}

async function restoreUnownedFromBackup(target, comparison) {
  const restored = [];
  const failed = [];
  const hasForSale = await columnExists(target, "app", "player_cards", "for_sale");
  const hasPrice = await columnExists(target, "app", "player_cards", "price");
  const assignments = ["owner_id=$1"];
  if (hasForSale) assignments.push("for_sale=false");
  if (hasPrice) assignments.push("price=0");

  await target.query("begin");
  try {
    await target.query("select pg_advisory_xact_lock(hashtext('fantasy-arena:normal-user-card-recovery-v1'))");
    let index = 0;
    for (const candidate of comparison.unowned) {
      index += 1;
      const savepoint = `restore_card_${index}`;
      await target.query(`savepoint ${savepoint}`);
      try {
        const result = await target.query(
          `update app.player_cards set ${assignments.join(", ")} where id=$2 and owner_id is null returning id`,
          [String(candidate.targetUserId), String(candidate.source.card_id)],
        );
        if (result.rowCount === 1) {
          restored.push({
            cardId: String(candidate.source.card_id),
            email: String(candidate.source.owner_email),
            player: String(candidate.target.player_name || candidate.source.player_name || ""),
            rarity: String(candidate.target.rarity || candidate.source.rarity || ""),
            identityChanged: Boolean(candidate.identityChanged),
          });
        } else {
          failed.push({ cardId: String(candidate.source.card_id), reason: "card changed while recovery was running" });
        }
        await target.query(`release savepoint ${savepoint}`);
      } catch (error) {
        await target.query(`rollback to savepoint ${savepoint}`);
        await target.query(`release savepoint ${savepoint}`);
        failed.push({ cardId: String(candidate.source.card_id), reason: String(error?.message || error) });
      }
    }
    await target.query("commit");
  } catch (error) {
    await target.query("rollback").catch(() => undefined);
    throw error;
  }
  return { restored, failed };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (APPLY && !SOURCE_DATABASE_URL) {
    throw new Error("CARD_RECOVERY_APPLY requires CARD_RECOVERY_SOURCE_DATABASE_URL. Live historical evidence alone is intentionally never used to auto-restore ownership.");
  }

  const target = makeClient(process.env.DATABASE_URL);
  await target.connect();
  let source = null;

  try {
    if (!(await tableExists(target, "app.users")) || !(await tableExists(target, "app.player_cards"))) {
      console.log(JSON.stringify({ success: true, skipped: true, reason: "core card tables are not available yet" }));
      return;
    }

    const [snapshots, history] = await Promise.all([
      snapshotEvidence(target),
      historicalEvidence(target),
    ]);

    let backupComparison = null;
    let recovery = null;
    if (SOURCE_DATABASE_URL) {
      source = makeClient(SOURCE_DATABASE_URL);
      await source.connect();
      if (!(await tableExists(source, "app.users")) || !(await tableExists(source, "app.player_cards"))) {
        throw new Error("Recovery source database does not contain app.users and app.player_cards");
      }
      backupComparison = await compareBackup(source, target);
      if (APPLY) recovery = await restoreUnownedFromBackup(target, backupComparison);
    }

    const historicalByCard = new Map();
    for (const item of history) {
      const key = String(item.card_id);
      const list = historicalByCard.get(key) || [];
      list.push(item);
      historicalByCard.set(key, list);
    }
    const forensicCandidates = [...historicalByCard.entries()].map(([cardId, evidence]) => ({ cardId, evidence }));

    console.log(JSON.stringify({
      success: true,
      dryRun: !APPLY,
      scope: "normal-users-only",
      excludedTestAccounts: TEST_EMAILS.length,
      sourceMode: SOURCE_DATABASE_URL ? "backup-database-comparison" : "live-forensic-audit",
      snapshotEvidence: {
        available: snapshots.available,
        unownedCardsPreviouslySeenOwned: snapshots.candidates.length,
        candidates: snapshots.candidates.slice(0, 500),
      },
      historicalEvidence: {
        orphanedCardsWithHistoricalUserReferences: forensicCandidates.length,
        warning: "Competition, audit and transaction references are historical evidence only. They are reported for investigation and are never used by this script for automatic ownership restoration.",
        candidates: forensicCandidates.slice(0, 500),
      },
      backupComparison: backupComparison ? {
        sourceOwnedCards: backupComparison.sourceCards,
        unchangedCount: backupComparison.unchangedCount,
        restorableUnownedCount: backupComparison.unowned.length,
        missingCardRowCount: backupComparison.missingRows.length,
        ownerConflictCount: backupComparison.ownerConflicts.length,
        identityDriftCount: backupComparison.identityDrift.length,
        restorableUnowned: backupComparison.unowned.slice(0, 1000),
        missingCardRows: backupComparison.missingRows.slice(0, 1000),
        ownerConflicts: backupComparison.ownerConflicts.slice(0, 1000),
        identityDrift: backupComparison.identityDrift.slice(0, 1000),
      } : null,
      recovery,
      safety: {
        appliesOnlyWithExplicitFlag: "CARD_RECOVERY_APPLY=true",
        requiresBackupSourceForApply: true,
        automaticRestoreCondition: "same card row exists in live DB, backup shows a normal user owned it, and live owner_id is currently NULL",
        neverOverwritesCurrentOwner: true,
        neverDeletesCards: true,
        neverTouchesFourTestAccounts: true,
        missingRowsNeedBackupOrManualRestore: true,
      },
    }, null, 2));
  } finally {
    if (source) await source.end().catch(() => undefined);
    await target.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("Normal-user card ownership audit/recovery failed:", error);
  process.exit(1);
});
