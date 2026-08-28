import pg from "pg";

const { Client } = pg;
const SEASON = "2026-27";
const GW2_FREE_COMMON_TEST_CUTOFF_UTC = Date.parse("2026-08-28T19:00:00.000Z"); // 21:00 CAT/Namibia on 28 Aug 2026
const FREE_CUP_RARITIES = [
  { tier: "common", prizeCardRarity: "rare" },
  { tier: "rare", prizeCardRarity: "unique" },
  { tier: "unique", prizeCardRarity: "epic" },
  { tier: "epic", prizeCardRarity: "legendary" },
  // Legendary is already the highest rarity, so its winner receives another Legendary card.
  { tier: "legendary", prizeCardRarity: "legendary" },
];

function title(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function forceGw2FreeCommonOpen(gw, tier, currentStatus) {
  return Number(gw) === 2
    && String(tier) === "common"
    && Date.now() < GW2_FREE_COMMON_TEST_CUTOFF_UTC
    && !["completed", "cancelled"].includes(String(currentStatus || "").toLowerCase());
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

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    const [statusSchema, tierSchema, raritySchema] = await Promise.all([
      resolveEnumSchema(client, "competition_status"),
      resolveEnumSchema(client, "competition_tier"),
      resolveEnumSchema(client, "rarity"),
    ]);
    if (!statusSchema || !tierSchema || !raritySchema) {
      throw new Error("Required tournament/card enums are missing; database compatibility startup must finish first");
    }
    const statusType = `${quoteIdentifier(statusSchema)}.${quoteIdentifier("competition_status")}`;
    const tierType = `${quoteIdentifier(tierSchema)}.${quoteIdentifier("competition_tier")}`;
    const rarityType = `${quoteIdentifier(raritySchema)}.${quoteIdentifier("rarity")}`;

    // The paid official calendar sync runs immediately before this script. Clone its
    // exact gameweek windows so FREE cups always open/close/settle with the same GW.
    const paidRows = await client.query(
      `select c.id, c.game_week, c.tier::text as tier, c.status::text as status,
              c.start_date, c.end_date, c.gameweek_label,
              c.fixture_window_start, c.fixture_window_end,
              coalesce(c.reschedule_alerts_enabled, true) as reschedule_alerts_enabled
         from app.competitions c
        where c.created_by_user_id is null
          and c.season = $1
          and c.prize_key = 'ladder'
          and c.game_week between 1 and 38
          and c.tier::text in ('common','rare','unique','epic','legendary')
        order by c.game_week, c.tier::text, c.id`,
      [SEASON],
    );

    const officialBySlot = new Map();
    for (const row of paidRows.rows) {
      const key = `${Number(row.game_week)}:${String(row.tier)}`;
      if (!officialBySlot.has(key)) officialBySlot.set(key, row);
    }
    if (officialBySlot.size !== 190) {
      throw new Error(`Cannot sync FREE Card Cups until paid official coverage is complete; expected 190 slots, found ${officialBySlot.size}`);
    }

    await client.query("BEGIN");
    let created = 0;
    let updated = 0;
    let preservedEntries = 0;
    let gw2CommonForcedOpen = false;

    for (let gw = 1; gw <= 38; gw += 1) {
      for (const rarity of FREE_CUP_RARITIES) {
        const source = officialBySlot.get(`${gw}:${rarity.tier}`);
        if (!source) throw new Error(`Missing paid source window for GW${gw} ${rarity.tier}`);

        const name = `GW${gw} FREE ${title(rarity.tier)} Card Cup`;
        const prizeKey = `free-${rarity.prizeCardRarity}-card`;
        const prizeDescription = rarity.tier === "legendary"
          ? `FREE ${title(rarity.tier)} Card Cup. Winner receives a randomized Legendary player card because Legendary is the highest rarity. The player is drawn fairly from all eligible current Premier League players across all clubs.`
          : `FREE ${title(rarity.tier)} Card Cup. Winner receives a randomized ${title(rarity.prizeCardRarity)} player card — the next higher rarity. The player is drawn fairly from all eligible current Premier League players across all clubs.`;

        const existing = await client.query(
          `select c.id, c.status::text as status,
                  (select count(*)::int from app.competition_entries ce where ce.competition_id = c.id) as entry_count
             from app.competitions c
            where c.created_by_user_id is null
              and c.game_week = $1
              and c.tier::text = $2
              and coalesce(c.entry_fee, 0) = 0
              and (c.season = $3 or c.season is null)
              and (c.name = $4 or coalesce(c.prize_key, '') like 'free-%-card')
            order by case when c.name = $4 then 0 else 1 end, c.id
            limit 1`,
          [gw, rarity.tier, SEASON, name],
        );

        if (existing.rows.length) {
          const row = existing.rows[0];
          const forceOpen = forceGw2FreeCommonOpen(gw, rarity.tier, row.status);
          const nextStatus = ["completed", "cancelled"].includes(String(row.status || ""))
            ? String(row.status)
            : forceOpen
              ? "open"
              : String(source.status || "upcoming");
          if (forceOpen) gw2CommonForcedOpen = true;
          preservedEntries += Number(row.entry_count || 0);
          await client.query(
            `update app.competitions
                set name = $1,
                    entry_fee = 0,
                    status = $2::text::${statusType},
                    start_date = $3,
                    end_date = $4,
                    prize_card_rarity = $5::text::${rarityType},
                    visibility = 'public',
                    max_entries = 100000,
                    platform_fee_rate = 0,
                    platform_fee_total = 0,
                    prize_type = 'goods',
                    prize_description = $6,
                    prize_key = $7,
                    season = $8,
                    gameweek_label = $9,
                    fixture_window_start = $10,
                    fixture_window_end = $11,
                    reschedule_alerts_enabled = $12
              where id = $13`,
            [
              name,
              nextStatus,
              source.start_date,
              source.end_date,
              rarity.prizeCardRarity,
              prizeDescription,
              prizeKey,
              SEASON,
              source.gameweek_label || `GW ${gw}`,
              source.fixture_window_start,
              source.fixture_window_end,
              Boolean(source.reschedule_alerts_enabled),
              Number(row.id),
            ],
          );
          updated += 1;
        } else {
          const forceOpen = forceGw2FreeCommonOpen(gw, rarity.tier, source.status);
          if (forceOpen) gw2CommonForcedOpen = true;
          await client.query(
            `insert into app.competitions
              (name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity,
               visibility, max_entries, platform_fee_rate, platform_fee_total, prize_type, prize_description,
               prize_key, season, gameweek_label, fixture_window_start, fixture_window_end,
               reschedule_alerts_enabled, created_by_user_id)
             values
              ($1, $2::text::${tierType}, 0, $3::text::${statusType}, $4, $5, $6, $7::text::${rarityType},
               'public', 100000, 0, 0, 'goods', $8, $9, $10, $11, $12, $13, $14, null)`,
            [
              name,
              rarity.tier,
              forceOpen ? "open" : String(source.status || "upcoming"),
              gw,
              source.start_date,
              source.end_date,
              rarity.prizeCardRarity,
              prizeDescription,
              prizeKey,
              SEASON,
              source.gameweek_label || `GW ${gw}`,
              source.fixture_window_start,
              source.fixture_window_end,
              Boolean(source.reschedule_alerts_enabled),
            ],
          );
          created += 1;
        }
      }
    }

    const coverage = await client.query(
      `select count(*)::int as coverage_pairs
         from (
           select c.game_week, c.tier::text as tier
             from app.competitions c
            where c.created_by_user_id is null
              and c.season = $1
              and coalesce(c.entry_fee, 0) = 0
              and coalesce(c.prize_key, '') like 'free-%-card'
              and c.game_week between 1 and 38
              and c.tier::text in ('common','rare','unique','epic','legendary')
            group by c.game_week, c.tier::text
         ) slots`,
      [SEASON],
    );
    const coveragePairs = Number(coverage.rows?.[0]?.coverage_pairs || 0);
    if (coveragePairs !== 190) {
      throw new Error(`FREE Card Cup coverage incomplete: expected 190 GW/rarity slots, found ${coveragePairs}`);
    }

    await client.query("COMMIT");
    console.log(`FREE Card Cups synced for ${SEASON}: created ${created}, updated ${updated}, verified ${coveragePairs}/190 slots.`);
    console.log("Prize progression: Common→Rare, Rare→Unique, Unique→Epic, Epic→Legendary, Legendary→Legendary.");
    console.log(`Preserved ${preservedEntries} existing FREE Cup entries; no tournament entry rows were deleted or moved.`);
    if (gw2CommonForcedOpen) {
      console.log("GW2 FREE Common Card Cup forced OPEN until 21:00 CAT on 28 Aug 2026 for entry testing.");
    }
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to sync FREE Card Cups:", error);
  process.exit(1);
});
