import pg from "pg";

const { Client } = pg;
const SEASON = "2026-27";
const RARITIES = [
  { tier: "common", fee: 10, prizeCardRarity: "rare" },
  { tier: "rare", fee: 50, prizeCardRarity: "rare" },
  { tier: "unique", fee: 100, prizeCardRarity: "unique" },
  { tier: "epic", fee: 250, prizeCardRarity: "epic" },
  { tier: "legendary", fee: 500, prizeCardRarity: "legendary" },
];

function title(tier) {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function catTuesdayBefore(date) {
  const shifted = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  const day = shifted.getUTCDay();
  const daysBack = (day - 2 + 7) % 7;
  shifted.setUTCDate(shifted.getUTCDate() - daysBack);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - 2 * 60 * 60 * 1000);
}

function catTuesdayAfter(date) {
  const shifted = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  const day = shifted.getUTCDay();
  let daysForward = (2 - day + 7) % 7;
  if (daysForward === 0) daysForward = 7;
  shifted.setUTCDate(shifted.getUTCDate() + daysForward);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - 2 * 60 * 60 * 1000);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "FantasyArena/2026-27" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function ensureCompetitionTierValues(client) {
  const values = ["unique", "epic", "legendary"];
  for (const value of values) {
    await client.query(`ALTER TYPE app.competition_tier ADD VALUE IF NOT EXISTS '${value}'`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
  await client.connect();

  try {
    // PostgreSQL enum additions must be committed before the values can be used
    // by inserts. Run them outside the tournament transaction.
    await ensureCompetitionTierValues(client);

    const [fixtures, bootstrap] = await Promise.all([
      fetchJson("https://fantasy.premierleague.com/api/fixtures/"),
      fetchJson("https://fantasy.premierleague.com/api/bootstrap-static/"),
    ]);

    const events = Array.isArray(bootstrap?.events) ? bootstrap.events : [];
    const byGw = new Map();
    for (const fixture of Array.isArray(fixtures) ? fixtures : []) {
      const gw = Number(fixture?.event);
      if (!gw || !fixture?.kickoff_time) continue;
      const kickoff = new Date(fixture.kickoff_time);
      if (!Number.isFinite(kickoff.getTime())) continue;
      const row = byGw.get(gw) || [];
      row.push(kickoff);
      byGw.set(gw, row);
    }

    const now = new Date();
    const currentEvent = events.find((event) => event.is_current) || events.find((event) => event.is_next) || events.find((event) => new Date(event.deadline_time).getTime() > now.getTime()) || events[0];
    const currentGw = Math.max(1, Math.min(38, Number(currentEvent?.id || 1)));

    const windows = [];
    for (let gw = 1; gw <= 38; gw += 1) {
      const kickoffs = [...(byGw.get(gw) || [])].sort((a, b) => a.getTime() - b.getTime());
      const first = kickoffs[0] || new Date(Date.UTC(2026, 7, 21 + (gw - 1) * 7, 17, 0, 0));
      const last = kickoffs[kickoffs.length - 1] || new Date(first.getTime() + 3 * 24 * 60 * 60 * 1000);
      const previousLast = gw > 1 ? [...(byGw.get(gw - 1) || [])].sort((a, b) => a.getTime() - b.getTime()).at(-1) : null;
      const nextFirst = gw < 38 ? [...(byGw.get(gw + 1) || [])].sort((a, b) => a.getTime() - b.getTime())[0] : null;

      const preferredStart = catTuesdayBefore(first);
      const preferredEnd = catTuesdayAfter(last);
      const start = previousLast && previousLast.getTime() >= preferredStart.getTime() ? new Date(previousLast.getTime() + 60 * 1000) : preferredStart;
      const end = nextFirst && nextFirst.getTime() < preferredEnd.getTime() ? new Date(nextFirst.getTime() - 60 * 1000) : preferredEnd;
      const adjusted = start.getTime() !== preferredStart.getTime() || end.getTime() !== preferredEnd.getTime();
      windows.push({ gw, first, last, start, end, adjusted });
    }

    await client.query("BEGIN");
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_type text DEFAULT 'goods'`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_description text`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_key text`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public'`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS max_entries integer`);

    const officialRows = await client.query(`
      select id from app.competitions
      where prize_key = 'ladder'
         or name ~* '^GW[0-9]+ (Common|Rare|Unique|Epic|Legendary) (Prize )?Ladder$'
         or name ~* '^Common Tournament - GW[0-9]+$'
         or name ~* '^GW[0-9]+ Community Cup$'
    `);
    const officialIds = officialRows.rows.map((row) => Number(row.id)).filter(Number.isFinite);
    if (officialIds.length) {
      await client.query(`delete from app.competition_entries where competition_id = any($1::int[])`, [officialIds]);
      await client.query(`delete from app.competitions where id = any($1::int[])`, [officialIds]);
    }

    for (const window of windows) {
      const status = window.gw < currentGw ? "completed" : window.gw === currentGw ? "open" : "upcoming";
      for (const rarity of RARITIES) {
        const name = `GW${window.gw} ${title(rarity.tier)} Prize Ladder`;
        const scheduleNote = window.adjusted
          ? `Fixture-adjusted ${title(rarity.tier)} Prize Vault ladder. Tuesday window shortened to avoid overlapping Premier League fixtures.`
          : `${title(rarity.tier)} Prize Vault ladder. Runs Tuesday to Tuesday; entries lock at the first Premier League kickoff.`;
        await client.query(
          `insert into app.competitions
            (name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity, visibility, max_entries, prize_type, prize_description, prize_key)
           values ($1,$2,$3,$4,$5,$6,$7,$8,'public',100000,'goods',$9,'ladder')`,
          [name, rarity.tier, rarity.fee, status, window.gw, window.start, window.end, rarity.prizeCardRarity, scheduleNote],
        );
      }
    }

    await client.query("COMMIT");
    const adjusted = windows.filter((window) => window.adjusted).map((window) => window.gw);
    console.log(`Official tournaments synced for ${SEASON}. Current GW: ${currentGw}. Created ${38 * RARITIES.length} rarity tournaments.`);
    console.log(adjusted.length ? `Fixture-overlap adjustments applied to GW: ${adjusted.join(", ")}` : "No Tuesday-window overlaps required adjustment.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Official tournament sync failed:", error);
  process.exitCode = 1;
});
