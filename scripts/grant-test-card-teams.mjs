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
const LINEUP_SHAPE = { GK: 1, DEF: 2, MID: 1, FWD: 1 };

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

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

function normalizePosition(position) {
  const value = String(position || "").toUpperCase();
  if (value.includes("GOAL") || value === "GKP") return "GK";
  if (value.includes("DEF")) return "DEF";
  if (value.includes("MID")) return "MID";
  if (value.includes("FWD") || value.includes("FOR") || value.includes("ATT") || value === "ST") return "FWD";
  return value || "MID";
}

function buildValidLineup(cards) {
  const byPosition = new Map();
  for (const card of cards) {
    const position = normalizePosition(card.position);
    if (!byPosition.has(position)) byPosition.set(position, []);
    byPosition.get(position).push(card);
  }

  const lineup = [];
  const used = new Set();
  for (const [position, required] of Object.entries(LINEUP_SHAPE)) {
    const options = byPosition.get(position) || [];
    for (const card of options) {
      if (lineup.filter((item) => normalizePosition(item.position) === position).length >= required) break;
      if (!used.has(card.id)) {
        lineup.push(card);
        used.add(card.id);
      }
    }
  }

  for (const card of cards) {
    if (lineup.length >= 5) break;
    if (!used.has(card.id)) {
      lineup.push(card);
      used.add(card.id);
    }
  }

  return lineup.slice(0, 5);
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
     where lower(team::text) = lower($1::text)
     order by coalesce(total_points, overall, 0) desc, id asc`,
    [club],
  );
  return rows.sort((a, b) => {
    const posA = POSITION_ORDER[normalizePosition(a.position)] ?? 99;
    const posB = POSITION_ORDER[normalizePosition(b.position)] ?? 99;
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
      let user = await client.query(
        `select id, email, name
         from app.users
         where lower(email::text) = lower($1::text)
         limit 1`,
        [email],
      );

      if (user.rowCount === 0) {
        await client.query(
          `insert into app.users (id, email, name, manager_team_name)
           values ($1, $2, $3, $4)
           on conflict (id) do nothing`,
          [email, email, email.split("@")[0], `Demo All Clubs ${accountIndex + 1}`],
        );
        user = await client.query(
          `select id, email, name
           from app.users
           where lower(email::text) = lower($1::text) or id::text = $2::text
           limit 1`,
          [email, email],
        );
      }

      const userId = user.rows[0]?.id;
      if (!userId) throw new Error(`Could not find or create user ${email}`);

      await client.query(
        `insert into app.wallets (user_id, balance, locked_balance)
         values ($1, 5000, 0)
         on conflict (user_id) do update set balance = greatest(app.wallets.balance, 5000), locked_balance = 0`,
        [userId],
      );

      const accountCards = [];
      const clubSummaries = [];

      for (let clubIndex = 0; clubIndex < clubsWithPlayers.length; clubIndex++) {
        const { club, players } = clubsWithPlayers[clubIndex];
        const clubCardIds = [];

        for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
          const player = players[playerIndex];
          const rarity = rarityFor(accountIndex, clubIndex, playerIndex);
          const stableSerialId = serialId(email, rarity, player.id, clubIndex, playerIndex + 1);
          const existing = await client.query(`select id from app.player_cards where serial_id::text = $1::text limit 1`, [stableSerialId]);
          let cardId;

          if (existing.rowCount > 0) {
            cardId = existing.rows[0].id;
            await client.query(
              `update app.player_cards
               set owner_id = $1, for_sale = false, price = 0
               where id = $2`,
              [userId, cardId],
            );
          } else {
            const inserted = await client.query(
              `insert into app.player_cards
                 (player_id, owner_id, rarity, serial_id, serial_number, max_supply, level, xp, decisive_score, last_5_scores, for_sale, price)
               values ($1, $2, ${quoteLiteral(rarity)}, $3, $4, $5, 1, 0, $6, '[0,0,0,0,0]'::jsonb, false, 0)
               returning id`,
              [player.id, userId, stableSerialId, playerIndex + 1, maxSupplyFor(rarity), Number(player.score || 35)],
            );
            cardId = inserted.rows[0].id;
          }

          clubCardIds.push(cardId);
          accountCards.push({ id: cardId, position: player.position, score: Number(player.score || 0) });
        }

        clubSummaries.push({ club, playersGranted: clubCardIds.length });
      }

      const lineup = buildValidLineup(accountCards.sort((a, b) => Number(b.score || 0) - Number(a.score || 0)));
      if (lineup.length) {
        const lineupIds = lineup.map((card) => card.id);
        await client.query(
          `insert into app.lineups (user_id, card_ids, captain_id)
           values ($1, $2::jsonb, $3)
           on conflict (user_id) do update set card_ids = excluded.card_ids, captain_id = excluded.captain_id`,
          [userId, JSON.stringify(lineupIds), lineupIds[0]],
        );
      }

      results.push({ email, userId, clubs: clubSummaries.length, cardsReady: accountCards.length, lineupCards: lineup.length, clubSummaries });
    }

    const totals = await client.query(`select count(*)::int as total_cards from app.player_cards`);
    await client.query("commit");

    console.log(JSON.stringify({
      success: true,
      mode: "all-premier-league-players-per-demo-account",
      enumCastSafe: true,
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
