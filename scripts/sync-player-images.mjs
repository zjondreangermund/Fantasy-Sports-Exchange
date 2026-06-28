import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
const SPORTS_DB_KEY = process.env.THESPORTSDB_API_KEY || "3";

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bestImage(players = [], requestedTeam = "") {
  const teamNeedle = normalize(requestedTeam);
  const scored = players
    .map((player) => {
      const cutout = player?.strCutout || player?.strRender || "";
      const headshot = player?.strThumb || player?.strFanart1 || "";
      const image = cutout || headshot;
      const team = normalize(player?.strTeam || "");
      const sport = normalize(player?.strSport || "");
      let score = 0;
      if (image) score += 20;
      if (sport.includes("soccer")) score += 10;
      if (teamNeedle && team && (team.includes(teamNeedle) || teamNeedle.includes(team))) score += 12;
      if (player?.strCutout) score += 8;
      if (player?.strRender) score += 5;
      return { player, image, score, cutout, headshot };
    })
    .filter((item) => item.image);
  scored.sort((a, b) => b.score - a.score);
  return scored[0] || null;
}

async function ensureColumns() {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS app`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS official_portrait_url text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS headshot_url text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS cutout_url text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS fallback_image_url text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS image_source text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS image_updated_at timestamp`);
}

async function searchPlayer(name) {
  const url = `https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchplayers.php?p=${encodeURIComponent(name)}`;
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "FantasyArena/1.0" } });
  if (!response.ok) throw new Error(`TheSportsDB ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload?.player) ? payload.player : [];
}

async function main() {
  await ensureColumns();

  const limit = Number(process.env.PLAYER_IMAGE_SYNC_LIMIT || 0);
  const { rows } = await pool.query(
    `SELECT id, name, team, image_url, official_portrait_url, headshot_url, cutout_url
     FROM app.players
     WHERE COALESCE(official_portrait_url, cutout_url, headshot_url, image_url, '') = ''
     ORDER BY id
     ${limit > 0 ? `LIMIT ${limit}` : ""}`,
  );

  console.log(`Found ${rows.length} players needing images.`);

  let updated = 0;
  let missing = 0;

  for (const player of rows) {
    try {
      const results = await searchPlayer(player.name);
      const match = bestImage(results, player.team);

      if (!match) {
        missing += 1;
        await pool.query(
          `UPDATE app.players
           SET fallback_image_url = COALESCE(fallback_image_url, '/players/fallback.svg'), image_source = 'fallback', image_updated_at = NOW()
           WHERE id = $1`,
          [player.id],
        );
        console.log(`MISS ${player.name} (${player.team})`);
        continue;
      }

      await pool.query(
        `UPDATE app.players
         SET official_portrait_url = $2,
             cutout_url = $3,
             headshot_url = $4,
             image_url = COALESCE(NULLIF(image_url, ''), $2),
             fallback_image_url = '/players/fallback.svg',
             image_source = 'thesportsdb',
             image_updated_at = NOW()
         WHERE id = $1`,
        [player.id, match.image, match.cutout || null, match.headshot || null],
      );
      updated += 1;
      console.log(`OK   ${player.name} (${player.team})`);

      await new Promise((resolve) => setTimeout(resolve, 180));
    } catch (error) {
      missing += 1;
      console.warn(`ERR  ${player.name}: ${error?.message || error}`);
    }
  }

  console.log(`Done. Updated ${updated}; missing/fallback ${missing}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
