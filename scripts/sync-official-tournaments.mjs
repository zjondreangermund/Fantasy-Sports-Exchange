import pg from "pg";

const { Client } = pg;
const SEASON = "2026-27";
const CAT_OFFSET_MS = 2 * 60 * 60 * 1000;
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

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function resolveEnumSchema(client, enumName) {
  const result = await client.query(
    `SELECT n.nspname AS enum_schema
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = $1
        AND t.typtype = 'e'
      ORDER BY CASE WHEN n.nspname = 'app' THEN 0 WHEN n.nspname = 'public' THEN 1 ELSE 2 END
      LIMIT 1`,
    [enumName],
  );
  return String(result.rows?.[0]?.enum_schema || "");
}

function catTuesdayBefore(date) {
  const shifted = new Date(date.getTime() + CAT_OFFSET_MS);
  const day = shifted.getUTCDay();
  const daysBack = (day - 2 + 7) % 7;
  shifted.setUTCDate(shifted.getUTCDate() - daysBack);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - CAT_OFFSET_MS);
}

function catEndOfFollowingDay(date) {
  const shifted = new Date(date.getTime() + CAT_OFFSET_MS);
  shifted.setUTCDate(shifted.getUTCDate() + 1);
  shifted.setUTCHours(23, 59, 0, 0);
  return new Date(shifted.getTime() - CAT_OFFSET_MS);
}

function fallbackFirstKickoff(gw) {
  return new Date(Date.UTC(2026, 7, 21 + (Math.max(1, gw) - 1) * 7, 19, 0, 0));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "FantasyArena/2026-27" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function ensureCompetitionTierValues(client) {
  const enumSchema = await resolveEnumSchema(client, "competition_tier");
  if (!enumSchema) {
    throw new Error("Base schema is missing the competition_tier enum; database schema push must complete before tournament sync");
  }
  const qualifiedType = `${quoteIdentifier(enumSchema)}.${quoteIdentifier("competition_tier")}`;
  for (const value of ["common", "rare", "unique", "epic", "legendary"]) {
    await client.query(`ALTER TYPE ${qualifiedType} ADD VALUE IF NOT EXISTS '${value}'`);
  }
}

function plannedStatus({ first, start, settlement, now }) {
  if (now.getTime() >= settlement.getTime()) return "closed";
  if (now.getTime() >= first.getTime()) return "active";
  if (now.getTime() >= start.getTime()) return "open";
  return "upcoming";
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    await ensureCompetitionTierValues(client);
    const statusEnumSchema = await resolveEnumSchema(client, "competition_status");
    if (!statusEnumSchema) throw new Error("Base schema is missing the competition_status enum");
    const competitionStatusType = `${quoteIdentifier(statusEnumSchema)}.${quoteIdentifier("competition_status")}`;

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

    const firstKickoffByGw = new Map();
    for (let gw = 1; gw <= 38; gw += 1) {
      const kickoffs = [...(byGw.get(gw) || [])].sort((a, b) => a.getTime() - b.getTime());
      if (kickoffs[0]) firstKickoffByGw.set(gw, kickoffs[0]);
    }

    const now = new Date();
    const currentEvent =
      events.find((event) => event.is_current) ||
      events.find((event) => event.is_next) ||
      [...events].reverse().find((event) => event.finished) ||
      events[0];
    const currentGw = Math.max(1, Math.min(38, Number(currentEvent?.id || 1)));

    const windows = [];
    for (let gw = 1; gw <= 38; gw += 1) {
      const scheduledKickoffs = [...(byGw.get(gw) || [])].sort((a, b) => a.getTime() - b.getTime());
      const nextFirst = firstKickoffByGw.get(gw + 1) || null;
      const eligibleKickoffs = scheduledKickoffs.filter((kickoff) => !nextFirst || kickoff.getTime() < nextFirst.getTime());
      const first = eligibleKickoffs[0] || scheduledKickoffs[0] || fallbackFirstKickoff(gw);
      const last = eligibleKickoffs[eligibleKickoffs.length - 1] || first;
      const start = catTuesdayBefore(first);
      const settlement = catEndOfFollowingDay(last);
      windows.push({
        gw,
        first,
        last,
        start,
        settlement,
        nextFirst,
        excludedPostponed: Math.max(0, scheduledKickoffs.length - eligibleKickoffs.length),
      });
    }

    await client.query("BEGIN");
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS created_by_user_id varchar(255)`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_type text DEFAULT 'goods'`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_description text`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_key text`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public'`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS max_entries integer`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS platform_fee_rate real DEFAULT 0.2`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS platform_fee_total real DEFAULT 0`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS season text`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS gameweek_label text`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS fixture_window_start timestamp`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS fixture_window_end timestamp`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS reschedule_alerts_enabled boolean DEFAULT true`);

    let created = 0;
    let updated = 0;
    let preservedEntries = 0;
    let excludedPostponed = 0;

    for (const window of windows) {
      const status = plannedStatus({ ...window, now });
      excludedPostponed += window.excludedPostponed;
      for (const rarity of RARITIES) {
        const name = `GW${window.gw} ${title(rarity.tier)} Prize Ladder`;
        const scheduleNote = `${title(rarity.tier)} Prize Vault ladder. Entries lock at the first Premier League kickoff. Scores freeze at 23:59 CAT on the day after the last eligible Premier League fixture in this gameweek. A postponed fixture moved to or beyond the start of the next gameweek is excluded. FA Cup matches do not count.`;

        const existing = await client.query(
          `select c.id, c.status::text as status,
             (select count(*)::int from app.competition_entries ce where ce.competition_id = c.id) as entry_count
           from app.competitions c
           where c.created_by_user_id is null
             and c.game_week = $1
             and c.tier::text = $2
             and (c.season = $4 or c.season is null)
             and (
               c.name = $3
               or c.name ~* ('^' || initcap($2) || ' Tournament - GW' || $1 || '$')
               or c.name ~* ('^GW' || $1 || ' ' || initcap($2) || ' (Prize )?Ladder$')
             )
           order by case when c.name = $3 then 0 else 1 end, c.id asc
           limit 1`,
          [window.gw, rarity.tier, name, SEASON],
        );

        if (existing.rows.length) {
          const row = existing.rows[0];
          const nextStatus = ["completed", "cancelled"].includes(String(row.status || "")) ? String(row.status) : status;
          preservedEntries += Number(row.entry_count || 0);
          await client.query(
            `update app.competitions
             set name = $1,
                 entry_fee = $2,
                 status = $3::text::${competitionStatusType},
                 start_date = $4,
                 end_date = $5,
                 prize_card_rarity = $6,
                 visibility = 'public',
                 max_entries = 100000,
                 platform_fee_rate = 0,
                 platform_fee_total = 0,
                 prize_type = 'goods',
                 prize_description = $7,
                 prize_key = 'ladder',
                 season = $8,
                 gameweek_label = $9,
                 fixture_window_start = $10,
                 fixture_window_end = $11,
                 reschedule_alerts_enabled = true
             where id = $12`,
            [
              name,
              rarity.fee,
              nextStatus,
              window.start,
              window.settlement,
              rarity.prizeCardRarity,
              scheduleNote,
              SEASON,
              `GW ${window.gw}`,
              window.first,
              window.last,
              Number(row.id),
            ],
          );
          updated += 1;
        } else {
          await client.query(
            `insert into app.competitions
              (name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity, visibility, max_entries,
               platform_fee_rate, platform_fee_total, prize_type, prize_description, prize_key, season, gameweek_label,
               fixture_window_start, fixture_window_end, reschedule_alerts_enabled)
             values ($1,$2,$3,$4,$5,$6,$7,$8,'public',100000,0,0,'goods',$9,'ladder',$10,$11,$12,$13,true)`,
            [
              name,
              rarity.tier,
              rarity.fee,
              status,
              window.gw,
              window.start,
              window.settlement,
              rarity.prizeCardRarity,
              scheduleNote,
              SEASON,
              `GW ${window.gw}`,
              window.first,
              window.last,
            ],
          );
          created += 1;
        }
      }
    }

    await client.query("COMMIT");
    console.log(`Official tournaments synced for ${SEASON}. Current GW: ${currentGw}. Created ${created}, updated ${updated}.`);
    console.log(`Preserved ${preservedEntries} existing official tournament entries; startup sync did not delete user teams.`);
    console.log(`Excluded ${excludedPostponed} postponed fixture assignment(s) that fall on or after the next gameweek starts.`);
    console.log("Created/updated 5 official Prize Ladder tournaments per gameweek (190 total season slots) with no admin platform fee.");
    console.log("Official scores freeze at 23:59 CAT on the day after the last eligible Premier League fixture; FA Cup and late postponed fixtures are excluded.");
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
