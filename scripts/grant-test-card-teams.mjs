#!/usr/bin/env node
import { Client } from "pg";

const TEST_TEAMS = [
  { email: "lbcplaya@gmail.com", club: "Aston Villa", rarity: "common" },
  { email: "joeberber2580@gmail.com", club: "Chelsea", rarity: "rare" },
  { email: "zaylon2580@gmail.com", club: "Arsenal", rarity: "unique" },
  { email: "zjondreangermund@gmail.com", club: "Liverpool", rarity: "legendary" },
];

const POSITION_PLAN = [["GK", 1], ["DEF", 4], ["MID", 4], ["FWD", 2]];

function serialId(email, rarity, playerId, index) {
  return `test-${email.split("@")[0]}-${rarity}-${playerId}-${index}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

async function pickFullTeam(client, club) {
  const picked = [];
  const used = new Set();
  for (const [position, limit] of POSITION_PLAN) {
    const { rows } = await client.query(
      `select id, name, team, position, coalesce(total_points, overall, 0) as score
       from app.players
       where lower(team) = lower($1) and position = $2
       order by coalesce(total_points, overall, 0) desc, id asc
       limit $3`,
      [club, position, limit],
    );
    for (const row of rows) {
      picked.push(row);
      used.add(Number(row.id));
    }
  }
  if (picked.length < 11) {
    const { rows } = await client.query(
      `select id, name, team, position, coalesce(total_points, overall, 0) as score
       from app.players
       where lower(team) = lower($1) and not (id = any($2::int[]))
       order by coalesce(total_points, overall, 0) desc, id asc
       limit $3`,
      [club, Array.from(used), 11 - picked.length],
    );
    picked.push(...rows);
    rows.forEach((row) => used.add(Number(row.id)));
  }
  if (picked.length < 11) {
    const { rows } = await client.query(
      `select id, name, team, position, coalesce(total_points, overall, 0) as score
       from app.players
       where not (id = any($1::int[]))
       order by coalesce(total_points, overall, 0) desc, id asc
       limit $2`,
      [Array.from(used), 11 - picked.length],
    );
    picked.push(...rows);
  }
  return picked.slice(0, 11);
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
    const results = [];

    for (const assignment of TEST_TEAMS) {
      let user = await client.query(`select id, email, name from app.users where lower(email) = lower($1) limit 1`, [assignment.email]);
      if (user.rowCount === 0) {
        await client.query(
          `insert into app.users (id, email, name, manager_team_name) values ($1, $1, $2, $3) on conflict (id) do nothing`,
          [assignment.email, assignment.email.split("@")[0], `${assignment.club} ${assignment.rarity} Test`],
        );
        user = await client.query(`select id, email, name from app.users where lower(email) = lower($1) or id = $1 limit 1`, [assignment.email]);
      }

      const userId = user.rows[0]?.id;
      if (!userId) throw new Error(`Could not find or create user ${assignment.email}`);

      await client.query(
        `insert into app.wallets (user_id, balance, locked_balance)
         values ($1, 1000, 0)
         on conflict (user_id) do update set balance = greatest(app.wallets.balance, 1000), locked_balance = 0`,
        [userId],
      );

      const team = await pickFullTeam(client, assignment.club);
      if (team.length < 11) throw new Error(`Could not build 11-card team for ${assignment.email}`);

      const cardIds = [];
      for (let i = 0; i < team.length; i++) {
        const player = team[i];
        const maxSupply = assignment.rarity === "common" ? 1000 : assignment.rarity === "rare" ? 100 : assignment.rarity === "unique" ? 10 : 1;
        const existing = await client.query(`select id from app.player_cards where serial_id = $1 limit 1`, [serialId(assignment.email, assignment.rarity, player.id, i + 1)]);
        if (existing.rowCount > 0) {
          cardIds.push(existing.rows[0].id);
          continue;
        }
        const inserted = await client.query(
          `insert into app.player_cards
             (player_id, owner_id, rarity, serial_id, serial_number, max_supply, level, xp, decisive_score, last_5_scores, for_sale, price)
           values ($1, $2, $3::app.rarity, $4, $5, $6, 1, 0, $7, '[0,0,0,0,0]'::jsonb, false, 0)
           returning id`,
          [player.id, userId, assignment.rarity, serialId(assignment.email, assignment.rarity, player.id, i + 1), i + 1, maxSupply, Number(player.score || 35)],
        );
        cardIds.push(inserted.rows[0].id);
      }

      await client.query(
        `insert into app.lineups (user_id, card_ids, captain_id)
         values ($1, $2::jsonb, $3)
         on conflict (user_id) do update set card_ids = excluded.card_ids, captain_id = excluded.captain_id`,
        [userId, JSON.stringify(cardIds.slice(0, 5)), cardIds[0]],
      );

      results.push({ email: assignment.email, userId, club: assignment.club, rarity: assignment.rarity, cardsReady: cardIds.length });
    }

    const totals = await client.query(`select count(*)::int as total_cards from app.player_cards`);
    await client.query("commit");
    console.log(JSON.stringify({ success: true, totalCardsAfterGrant: Number(totals.rows[0]?.total_cards || 0), teams: results }, null, 2));
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
