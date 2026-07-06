#!/usr/bin/env node
import { Client } from "pg";

const DEMO_ACCOUNTS = [
  "lbcplaya@gmail.com",
  "joeberber2580@gmail.com",
  "zaylon2580@gmail.com",
  "zjondreangermund@gmail.com",
];

const RARITIES = ["common", "rare", "epic", "unique", "legendary"];
const POSITION_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

function serialId(email, rarity, playerId, clubIndex, playerIndex) {
  return `demo-${email.split("@")[0]}-${clubIndex}-${playerIndex}-${rarity}-${playerId}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

function maxSupplyFor(rarity) {
  if (rarity === "common") return 1000;
  if (rarity === "rare") return 100;
  if (rarity === "epic") return 25;
  if (rarity === "unique") return 10;
  return 1;
}

function rarityFor(accountIndex, clubIndex, playerIndex) {
  return RARITIES[(accountIndex + clubIndex + playerIndex) % RARITIES.length];
}

async function getPremierLeagueClubs(client) {
  const { rows } = await client.query(
    `select team, count(*)::int as player_count
     from app.players
     where coalesce(team, '') <> ''
     group by team
     having count(*) >= 5
     order by team asc`,
  );
  return rows.map((row) => row.team);
}

async function getPlayersForClub(client, club) {
  const { rows } = await client.query(
    `select id, name, team, position, coalesce(total_points, overall, 0) as score
     from app.players
     where lower(team) = lower($1)
     order by coalesce(total_points, overall, 0) desc, id asc`,
    [club],
  );
  return rows.sort((a, b) => {
    const posA = POSITION_ORDER[String(a.position || "").toUpperCase()] ?? 99;
    const posB = POSITION_ORDER[String(b.position || "").toUpperCase()] ?? 99;
    if (posA !== posB) return posA - posB;
    return Number(b.score || 0) - Number(a.score || 0);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("begin");

    const clubs = await getPremierLeagueClubs(client);
    if (!clubs.length) throw new Error("No clubs found in app.players");

    const clubsWithPlayers = [];
    for (const club of clubs) {
      const players = await getPlayersForClub(client, club);
      if (players.length) clubsWithPlayers.push({ club, players });
    }

    const results = [];

    for (let accountIndex = 0; accountIndex < DEMO_ACCOUNTS.length; accountIndex++) {
      const email = DEMO_ACCOUNTS[accountIndex];
      let user = await client.query(`select id, email, name from app.users where lower(email) = lower($1) limit 1`, [email]);
      if (user.rowCount === 0) {
        await client.query(
          `insert into app.users (id, email, name, manager_team_name) values ($1, $1, $2, $3) on conflict (id) do nothing`,
          [email, email.split("@")[0], `Demo All Clubs ${accountIndex + 1}`],
        );
        user = await client.query(`select id, email, name from app.users where lower(email) = lower($1) or id = $1 limit 1`, [email]);
      }

      const userId = user.rows[0]?.id;
      if (!userId) throw new Error(`Could not find or create user ${email}`);

      await client.query(
        `insert into app.wallets (user_id, balance, locked_balance)
         values ($1, 5000, 0)
         on conflict (user_id) do update set balance = greatest(app.wallets.balance, 5000), locked_balance = 0`,
        [userId],
      );

      const accountCardIds = [];
      const clubSummaries = [];

      for (let clubIndex = 0; clubIndex < clubsWithPlayers.length; clubIndex++) {
        const { club, players } = clubsWithPlayers[clubIndex];
        const clubCardIds = [];

        for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
          const player = players[playerIndex];
          const rarity = rarityFor(accountIndex, clubIndex, playerIndex);
          const stableSerialId = serialId(email, rarity, player.id, clubIndex, playerIndex + 1);
          const existing = await client.query(`select id from app.player_cards where serial_id = $1 limit 1`, [stableSerialId]);
          if (existing.rowCount > 0) {
            clubCardIds.push(existing.rows[0].id);
            accountCardIds.push(existing.rows[0].id);
            continue;
          }

          const inserted = await client.query(
            `insert into app.player_cards
               (player_id, owner_id, rarity, serial_id, serial_number, max_supply, level, xp, decisive_score, last_5_scores, for_sale, price)
             values ($1, $2, $3, $4, $5, $6, 1, 0, $7, '[0,0,0,0,0]'::jsonb, false, 0)
             returning id`,
            [player.id, userId, rarity, stableSerialId, playerIndex + 1, maxSupplyFor(rarity), Number(player.score || 35)],
          );
          clubCardIds.push(inserted.rows[0].id);
          accountCardIds.push(inserted.rows[0].id);
        }

        clubSummaries.push({ club, playersGranted: clubCardIds.length });
      }

      const lineupIds = accountCardIds.slice(0, 5);
      if (lineupIds.length) {
        await client.query(
          `insert into app.lineups (user_id, card_ids, captain_id)
           values ($1, $2::jsonb, $3)
           on conflict (user_id) do update set card_ids = excluded.card_ids, captain_id = excluded.captain_id`,
          [userId, JSON.stringify(lineupIds), lineupIds[0]],
        );
      }

      results.push({ email, userId, clubs: clubSummaries.length, cardsReady: accountCardIds.length, clubSummaries });
    }

    const totals = await client.query(`select count(*)::int as total_cards from app.player_cards`);
    await client.query("commit");

    console.log(JSON.stringify({
      success: true,
      mode: "all-club-players-per-demo-account",
      clubs: clubsWithPlayers.map((club) => ({ club: club.club, players: club.players.length })),
      totalCardsAfterGrant: Number(totals.rows[0]?.total_cards || 0),
      accounts: results,
    }, null, 2));
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
