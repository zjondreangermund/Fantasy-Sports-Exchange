#!/usr/bin/env node
import { randomUUID } from "node:crypto";
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

function cardFingerprint(state) {
  const card = state && typeof state === "object" ? state : {};
  return JSON.stringify({
    owner_id: card.owner_id == null ? null : String(card.owner_id),
    player_id: card.player_id == null ? null : Number(card.player_id),
    rarity: String(card.rarity || ""),
    serial_id: card.serial_id == null ? null : String(card.serial_id),
    serial_number: card.serial_number == null ? null : Number(card.serial_number),
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
      console.log(JSON.stringify({ success: true, skipped: true, reason: "core card tables are not available yet" }));
      return;
    }

    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('fantasy-arena:normal-user-card-snapshot-v1'))");
    await client.query(`
      create table if not exists app.card_ownership_snapshot_batches (
        batch_id text primary key,
        captured_at timestamptz not null default now(),
        deployment_ref text,
        card_count integer not null default 0,
        changed_since_previous integer not null default 0,
        missing_since_previous integer not null default 0
      )
    `);
    await client.query(`
      create table if not exists app.card_ownership_snapshot_items (
        batch_id text not null references app.card_ownership_snapshot_batches(batch_id) on delete cascade,
        card_id bigint not null,
        user_id text not null,
        user_email text not null,
        state jsonb not null,
        primary key (batch_id, card_id)
      )
    `);
    await client.query(`
      create index if not exists card_ownership_snapshot_items_card_idx
      on app.card_ownership_snapshot_items(card_id)
    `);
    await client.query(`
      create index if not exists card_ownership_snapshot_items_user_idx
      on app.card_ownership_snapshot_items(user_id)
    `);

    const previousBatch = rows(await client.query(`
      select batch_id, captured_at
      from app.card_ownership_snapshot_batches
      order by captured_at desc
      limit 1
    `))[0] || null;

    const current = rows(await client.query(`
      select
        pc.id::bigint as card_id,
        pc.owner_id::text as user_id,
        lower(coalesce(u.email, '')) as user_email,
        to_jsonb(pc) || jsonb_build_object(
          '_player', jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'team', p.team,
            'league', p.league,
            'fpl_id', p.fpl_id
          )
        ) as state
      from app.player_cards pc
      join app.users u on u.id::text = pc.owner_id::text
      left join app.players p on p.id = pc.player_id
      where pc.owner_id is not null
        and lower(coalesce(u.email, '')) <> all($1::text[])
      order by pc.id
    `, [TEST_EMAILS]));

    let missingSincePrevious = [];
    let changedSincePrevious = [];
    if (previousBatch?.batch_id) {
      const previous = rows(await client.query(`
        select card_id::bigint as card_id, user_id, user_email, state
        from app.card_ownership_snapshot_items
        where batch_id=$1
        order by card_id
      `, [String(previousBatch.batch_id)]));
      const currentByCard = new Map(current.map((item) => [String(item.card_id), item]));
      for (const before of previous) {
        const now = currentByCard.get(String(before.card_id));
        if (!now) {
          missingSincePrevious.push({
            cardId: String(before.card_id),
            userId: String(before.user_id),
            email: String(before.user_email),
            previousState: before.state,
          });
          continue;
        }
        if (String(now.user_id) !== String(before.user_id) || cardFingerprint(now.state) !== cardFingerprint(before.state)) {
          changedSincePrevious.push({
            cardId: String(before.card_id),
            email: String(before.user_email),
            before: before.state,
            after: now.state,
          });
        }
      }
    }

    const batchId = randomUUID();
    const deploymentRef = String(
      process.env.RAILWAY_DEPLOYMENT_ID
      || process.env.RAILWAY_GIT_COMMIT_SHA
      || process.env.GIT_COMMIT_SHA
      || process.env.COMMIT_SHA
      || "startup",
    );
    await client.query(`
      insert into app.card_ownership_snapshot_batches
        (batch_id, deployment_ref, card_count, changed_since_previous, missing_since_previous)
      values ($1,$2,$3,$4,$5)
    `, [batchId, deploymentRef, current.length, changedSincePrevious.length, missingSincePrevious.length]);

    for (const item of current) {
      await client.query(`
        insert into app.card_ownership_snapshot_items
          (batch_id, card_id, user_id, user_email, state)
        values ($1,$2,$3,$4,$5::jsonb)
      `, [batchId, String(item.card_id), String(item.user_id), String(item.user_email), JSON.stringify(item.state || {})]);
    }

    await client.query("commit");
    console.log(JSON.stringify({
      success: true,
      scope: "normal-users-only",
      excludedTestAccounts: TEST_EMAILS.length,
      batchId,
      deploymentRef,
      capturedCards: current.length,
      previousBatchId: previousBatch?.batch_id || null,
      missingSincePreviousCount: missingSincePrevious.length,
      changedSincePreviousCount: changedSincePrevious.length,
      missingSincePrevious: missingSincePrevious.slice(0, 200),
      changedSincePrevious: changedSincePrevious.slice(0, 200),
      note: "This snapshot never changes player_cards ownership. It records normal-user ownership so future unexpected changes can be detected and recovered exactly.",
    }, null, 2));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Normal-user card ownership snapshot failed:", error);
  process.exit(1);
});
