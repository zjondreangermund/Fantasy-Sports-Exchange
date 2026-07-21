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
  const enumSchema = await resolveEnumSchema(client, "competition_tier");
  if (!enumSchema) {
    throw new Error("Base schema is missing the competition_tier enum; database schema push must complete before tournament sync");
  }
  const qualifiedType = `${quoteIdentifier(enumSchema)}.${quoteIdentifier("competition_tier")}`;
  for (const value of ["common", "rare", "unique", "epic", "legendary"]) {
    await client.query(`ALTER TYPE ${qualifiedType} ADD VALUE IF NOT EXISTS '${value}'`);
  }
}

function plannedStatus({ gw, currentGw, first, last, event, now }) {
  if (gw < currentGw) return "closed";
  if (gw > currentGw) return "upcoming";
  if (Boolean(event?.finished || event?.data_checked) || now.getTime() > last.getTime() + 24 * 60 * 60 * 1000) return "closed";
  if (now.getTime() >= first.getTime()) return "active";
  return "open";
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
    const eventByGw = new Map(events.map((event) => [Number(event?.id), event]));
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
    const currentEvent =
      events.find((event) => event.is_current) ||
      events.find((event) => event.is_next) ||
      [...events].reverse().find((event) => event.finished) ||
      events[0];
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
      const start = previousLast && previousLast.getTime() >= preferredStart.getTime()
        ? new Date(previousLast.getTime() + 60 * 1000)
        : preferredStart;
      const end = nextFirst && nextFirst.getTime() < preferredEnd.getTime()
        ? new Date(nextFirst.getTime() - 60 * 1000)
        : preferredEnd;
      windows.push({
        gw,
        first,
        last,
        start,
        end,
        event: eventByGw.get(gw),
        adjusted: start.getTime() !== preferredStart.getTime() || end.getTime() !== preferredEnd.getTime(),
      });
    }

    await client.query("BEGIN");
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS created_by_user_id varchar(255)`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_type text DEFAULT 'goods'`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_description text`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_key text`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public'`);
    await client.query(`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS max_entries integer`);

    let created = 0;
    let updated = 0;
    let preservedEntries = 0;

    for (const window of windows) {
      const status = plannedStatus({ ...window, currentGw, now });
      for (const rarity of RARITIES) {
        const name = `GW${window.gw} ${title(rarity.tier)} Prize Ladder`;
        const scheduleNote = window.adjusted
          ? `Fixture-adjusted ${title(rarity.tier)} Prize Vault ladder. Tuesday window shortened to avoid overlapping Premier League fixtures.`
          : `${title(rarity.tier)} Prize Vault ladder. Runs Tuesday to Tuesday; entries lock at the first Premier League kickoff.`;

        const existing = await client.query(
          `select c.id, c.status::text as status,
             (select count(*)::int from app.competition_entries ce where ce.competition_id = c.id) as entry_count
           from app.competitions c
           where c.created_by_user_id is null
             and c.game_week = $1
             and c.tier::text = $2
             and (
               c.name = $3
               or c.name ~* ('^' || initcap($2) || ' Tournament - GW' || $1 || '$')
               or c.name ~* ('^GW' || $1 || ' ' || initcap($2) || ' (Prize )?Ladder$')
             )
           order by case when c.name = $3 then 0 else 1 end, c.id asc
           limit 1`,
          [window.gw, rarity.tier, name],
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
                 prize_type = 'goods',
                 prize_description = $7,
                 prize_key = 'ladder'
             where id = $8`,
            [name, rarity.fee, nextStatus, window.start, window.end, rarity.prizeCardRarity, scheduleNote, Number(row.id)],
          );
          updated += 1;
        } else {
          await client.query(
            `insert into app.competitions
              (name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity, visibility, max_entries, prize_type, prize_description, prize_key)
             values ($1,$2,$3,$4,$5,$6,$7,$8,'public',100000,'goods',$9,'ladder')`,
            [name, rarity.tier, rarity.fee, status, window.gw, window.start, window.end, rarity.prizeCardRarity, scheduleNote],
          );
          created += 1;
        }
      }
    }

    await client.query("COMMIT");
    const adjusted = windows.filter((window) => window.adjusted).map((window) => window.gw);
    console.log(`Official tournaments synced for ${SEASON}. Current GW: ${currentGw}. Created ${created}, updated ${updated}.`);
    console.log(`Preserved ${preservedEntries} existing official tournament entries; startup sync did not delete user teams.`);
    console.log("Admin-created tournaments were preserved and remain visible in Play.");
    console.log(adjusted.length
      ? `Fixture-overlap adjustments applied to GW: ${adjusted.join(", ")}`
      : "No Tuesday-window overlaps required adjustment.");
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
