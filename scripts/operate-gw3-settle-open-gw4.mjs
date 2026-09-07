import express from "express";
import pg from "pg";

const { Client } = pg;
const SEASON = "2026-27";
const SETTLE_GW = 3;
const OPEN_GW = 4;
const EXPECTED_OFFICIAL_PER_GAMEWEEK = 10; // 5 paid Prize Ladders + 5 FREE Card Cups

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function csv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function officialGameweekRows(client, gameWeek) {
  const result = await client.query(
    `select c.id,
            c.name,
            c.status::text as status,
            c.tier::text as tier,
            coalesce(c.entry_fee, 0)::float as entry_fee,
            coalesce(c.prize_key, '') as prize_key,
            c.start_date,
            c.end_date,
            count(ce.id)::int as entry_count
       from app.competitions c
       left join app.competition_entries ce on ce.competition_id = c.id
      where c.created_by_user_id is null
        and c.season = $1
        and c.game_week = $2
      group by c.id, c.name, c.status, c.tier, c.entry_fee, c.prize_key, c.start_date, c.end_date
      order by c.id asc`,
    [SEASON, gameWeek],
  );
  return rows(result).map((row) => ({
    ...row,
    id: Number(row.id),
    entry_count: Number(row.entry_count || 0),
    entry_fee: Number(row.entry_fee || 0),
  }));
}

async function resolveAdminId(client) {
  const configuredIds = csv(process.env.ADMIN_USER_IDS);
  if (configuredIds.length) {
    const result = await client.query(
      `select id from app.users where id = any($1::varchar[]) order by id limit 1`,
      [configuredIds],
    );
    if (result.rows[0]?.id) return String(result.rows[0].id);
  }

  const configuredEmails = csv(process.env.ADMIN_EMAILS || "lbcplaya@gmail.com").map((email) => email.toLowerCase());
  const result = await client.query(
    `select id
       from app.users
      where lower(coalesce(email, '')) = any($1::text[])
      order by id
      limit 1`,
    [configuredEmails],
  );
  if (result.rows[0]?.id) return String(result.rows[0].id);
  throw new Error("No user matches the settlement route's configured admin identity; refusing to bypass admin authorization");
}

async function realGameweekDeadline(gameWeek) {
  const [bootstrapResponse, fixturesResponse] = await Promise.all([
    fetch("https://fantasy.premierleague.com/api/bootstrap-static/", {
      headers: { "user-agent": "FantasyArena-GW3-Operator/2026" },
      signal: AbortSignal.timeout(10000),
    }),
    fetch("https://fantasy.premierleague.com/api/fixtures/", {
      headers: { "user-agent": "FantasyArena-GW3-Operator/2026" },
      signal: AbortSignal.timeout(10000),
    }),
  ]);
  if (!bootstrapResponse.ok || !fixturesResponse.ok) {
    throw new Error(`Unable to verify live FPL gameweek deadline (bootstrap ${bootstrapResponse.status}, fixtures ${fixturesResponse.status})`);
  }

  const bootstrap = await bootstrapResponse.json();
  const fixtures = await fixturesResponse.json();
  const event = (Array.isArray(bootstrap?.events) ? bootstrap.events : []).find((row) => Number(row?.id) === Number(gameWeek));
  const eventDeadline = event?.deadline_time ? new Date(String(event.deadline_time)) : null;
  if (eventDeadline && Number.isFinite(eventDeadline.getTime())) return eventDeadline;

  const firstKickoff = (Array.isArray(fixtures) ? fixtures : [])
    .filter((fixture) => Number(fixture?.event) === Number(gameWeek) && fixture?.kickoff_time)
    .map((fixture) => new Date(String(fixture.kickoff_time)))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  if (firstKickoff) return firstKickoff;
  throw new Error(`Unable to determine the live FPL deadline for GW${gameWeek}`);
}

async function main() {
  if (process.env.RUN_GW3_SETTLE_OPEN_GW4 !== "1") {
    console.log("[gw3-gw4-operator] disabled; no production tournament changes requested");
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (process.env.NODE_ENV !== "production") throw new Error("GW3/GW4 operator is production-only");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let server;
  try {
    let gw3 = await officialGameweekRows(client, SETTLE_GW);
    let gw4 = await officialGameweekRows(client, OPEN_GW);
    if (gw3.length !== EXPECTED_OFFICIAL_PER_GAMEWEEK) {
      throw new Error(`GW${SETTLE_GW} official coverage mismatch: expected ${EXPECTED_OFFICIAL_PER_GAMEWEEK}, found ${gw3.length}`);
    }
    if (gw4.length !== EXPECTED_OFFICIAL_PER_GAMEWEEK) {
      throw new Error(`GW${OPEN_GW} official coverage mismatch: expected ${EXPECTED_OFFICIAL_PER_GAMEWEEK}, found ${gw4.length}`);
    }

    const gw4Deadline = await realGameweekDeadline(OPEN_GW);
    if (Date.now() >= gw4Deadline.getTime()) {
      throw new Error(`GW${OPEN_GW} live Premier League entry deadline has already passed; refusing to reopen entries`);
    }

    const adminId = await resolveAdminId(client);
    const { registerEconomyIntegrityRoutes } = await import("../dist/server/server/routes/economyIntegrity.routes.js");
    const app = express();
    app.use(express.json());
    const requireAuth = (req, _res, next) => {
      req.authUserId = adminId;
      next();
    };
    registerEconomyIntegrityRoutes(app, { requireAuth });
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
      listener.on("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Unable to start local settlement route");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    console.log(`[gw3-gw4-operator] GW${SETTLE_GW} preflight: ${gw3.length} official tournaments; ${gw3.reduce((sum, row) => sum + row.entry_count, 0)} total entries`);

    // Entry deadlines have passed for GW3. Closing lifecycle status first prevents
    // any accidental new submission while the existing settlement route verifies
    // all eligible fixtures and final scoring snapshots.
    await client.query(
      `update app.competitions
          set status = 'closed'
        where created_by_user_id is null
          and season = $1
          and game_week = $2
          and status::text not in ('completed', 'cancelled')`,
      [SEASON, SETTLE_GW],
    );
    gw3 = await officialGameweekRows(client, SETTLE_GW);

    const settlementResults = [];
    for (const competition of gw3) {
      if (competition.status === "cancelled") {
        settlementResults.push({ id: competition.id, name: competition.name, result: "cancelled-skip", entries: competition.entry_count });
        continue;
      }
      if (competition.status === "completed") {
        settlementResults.push({ id: competition.id, name: competition.name, result: "already-completed", entries: competition.entry_count });
        continue;
      }
      if (competition.entry_count <= 0) {
        settlementResults.push({ id: competition.id, name: competition.name, result: "closed-no-entries", entries: 0 });
        continue;
      }

      const response = await fetch(`${baseUrl}/api/admin/competitions/settle/${competition.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ forceManual: true }),
      });
      const raw = await response.text();
      let payload;
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw }; }
      if (!response.ok) {
        throw new Error(`GW${SETTLE_GW} settlement failed for #${competition.id} ${competition.name}: ${response.status} ${payload?.message || raw || "unknown error"}`);
      }
      settlementResults.push({
        id: competition.id,
        name: competition.name,
        result: "settled",
        entries: competition.entry_count,
        manualSettlement: Boolean(payload?.manualSettlement ?? payload?.settlement?.manualSettlement ?? true),
      });
    }

    gw3 = await officialGameweekRows(client, SETTLE_GW);
    const enteredNotCompleted = gw3.filter((row) => row.entry_count > 0 && row.status !== "completed" && row.status !== "cancelled");
    if (enteredNotCompleted.length) {
      throw new Error(`GW${SETTLE_GW} verification failed: entered tournaments not completed: ${enteredNotCompleted.map((row) => `#${row.id}:${row.status}`).join(", ")}`);
    }

    // Only after every entered GW3 official tournament is safely settled do we
    // bring forward GW4. Existing rows, fees, rarity rules, dates and prizes are
    // untouched; the real FPL deadline still controls entryOpen in the API.
    await client.query(
      `update app.competitions
          set status = 'open'
        where created_by_user_id is null
          and season = $1
          and game_week = $2
          and status::text not in ('completed', 'cancelled')`,
      [SEASON, OPEN_GW],
    );
    gw4 = await officialGameweekRows(client, OPEN_GW);
    const gw4NotOpen = gw4.filter((row) => !["open", "completed", "cancelled"].includes(row.status));
    if (gw4NotOpen.length) {
      throw new Error(`GW${OPEN_GW} verification failed: ${gw4NotOpen.map((row) => `#${row.id}:${row.status}`).join(", ")}`);
    }

    console.log(`[gw3-gw4-operator] GW${SETTLE_GW}_SETTLEMENT_RESULTS=${JSON.stringify(settlementResults)}`);
    console.log(`[gw3-gw4-operator] GW${SETTLE_GW}_FINAL=${JSON.stringify(gw3.map((row) => ({ id: row.id, name: row.name, status: row.status, entries: row.entry_count })))}`);
    console.log(`[gw3-gw4-operator] GW${OPEN_GW}_OPEN_UNTIL=${gw4Deadline.toISOString()}`);
    console.log(`[gw3-gw4-operator] GW${OPEN_GW}_FINAL=${JSON.stringify(gw4.map((row) => ({ id: row.id, name: row.name, status: row.status, entries: row.entry_count, entryFee: row.entry_fee, startDate: row.start_date, endDate: row.end_date })))}`);
    console.log(`[gw3-gw4-operator] SUCCESS: settled entered GW${SETTLE_GW} official tournaments and opened GW${OPEN_GW} official entries without changing fees, rules, prizes or deadlines`);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[gw3-gw4-operator] FAILED: ${error?.stack || error}`);
  process.exit(1);
});
