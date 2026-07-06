import { db } from "../db.js";
import { sql } from "drizzle-orm";

const TEST_TEAMS = [
  { email: "lbcplaya@gmail.com", club: "Aston Villa", rarity: "common" },
  { email: "joeberber2580@gmail.com", club: "Chelsea", rarity: "rare" },
  { email: "zaylon2580@gmail.com", club: "Arsenal", rarity: "unique" },
  { email: "zjondreangermund@gmail.com", club: "Liverpool", rarity: "legendary" },
];

const POSITION_PLAN: Array<[string, number]> = [["GK", 1], ["DEF", 4], ["MID", 4], ["FWD", 2]];

function serialId(email: string, rarity: string, playerId: number, index: number) {
  return `test-${email.split("@")[0]}-${rarity}-${playerId}-${index}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

async function pickFullTeam(club: string) {
  const picked: any[] = [];
  const used = new Set<number>();

  for (const [position, limit] of POSITION_PLAN) {
    const result = await db.execute(sql`
      select id, name, team, position, coalesce(total_points, overall, 0) as score
      from app.players
      where lower(team) = lower(${club}) and position = ${position}
      order by coalesce(total_points, overall, 0) desc, id asc
      limit ${limit}
    `);
    for (const row of Array.isArray((result as any).rows) ? (result as any).rows : []) {
      picked.push(row);
      used.add(Number(row.id));
    }
  }

  if (picked.length < 11) {
    const usedIds = Array.from(used);
    const result = await db.execute(sql`
      select id, name, team, position, coalesce(total_points, overall, 0) as score
      from app.players
      where lower(team) = lower(${club}) and not (id = any(${usedIds}::int[]))
      order by coalesce(total_points, overall, 0) desc, id asc
      limit ${11 - picked.length}
    `);
    for (const row of Array.isArray((result as any).rows) ? (result as any).rows : []) {
      picked.push(row);
      used.add(Number(row.id));
    }
  }

  if (picked.length < 11) {
    const usedIds = Array.from(used);
    const result = await db.execute(sql`
      select id, name, team, position, coalesce(total_points, overall, 0) as score
      from app.players
      where not (id = any(${usedIds}::int[]))
      order by coalesce(total_points, overall, 0) desc, id asc
      limit ${11 - picked.length}
    `);
    picked.push(...(Array.isArray((result as any).rows) ? (result as any).rows : []));
  }

  return picked.slice(0, 11);
}

export async function grantAdminTestTeams() {
  const results: any[] = [];

  for (const assignment of TEST_TEAMS) {
    let userResult = await db.execute(sql`
      select id, email, name from app.users where lower(email) = lower(${assignment.email}) limit 1
    `);
    let user = (userResult as any).rows?.[0];

    if (!user) {
      await db.execute(sql`
        insert into app.users (id, email, name, manager_team_name)
        values (${assignment.email}, ${assignment.email}, ${assignment.email.split("@")[0]}, ${`${assignment.club} ${assignment.rarity} Test`})
        on conflict (id) do nothing
      `);
      userResult = await db.execute(sql`
        select id, email, name from app.users where lower(email) = lower(${assignment.email}) or id = ${assignment.email} limit 1
      `);
      user = (userResult as any).rows?.[0];
    }

    const userId = String(user?.id || "");
    if (!userId) throw new Error(`Could not find or create user ${assignment.email}`);

    await db.execute(sql`
      insert into app.wallets (user_id, balance, locked_balance)
      values (${userId}, 1000, 0)
      on conflict (user_id) do update set balance = greatest(app.wallets.balance, 1000), locked_balance = 0
    `);

    const team = await pickFullTeam(assignment.club);
    if (team.length < 11) throw new Error(`Could not build 11-card team for ${assignment.email}`);

    const cardIds: number[] = [];
    for (let i = 0; i < team.length; i++) {
      const player = team[i];
      const stableSerialId = serialId(assignment.email, assignment.rarity, Number(player.id), i + 1);
      const existing = await db.execute(sql`select id from app.player_cards where serial_id = ${stableSerialId} limit 1`);
      const existingId = Number((existing as any).rows?.[0]?.id || 0);
      if (existingId) {
        cardIds.push(existingId);
        continue;
      }

      const maxSupply = assignment.rarity === "common" ? 1000 : assignment.rarity === "rare" ? 100 : assignment.rarity === "unique" ? 10 : 1;
      const inserted = await db.execute(sql`
        insert into app.player_cards
          (player_id, owner_id, rarity, serial_id, serial_number, max_supply, level, xp, decisive_score, last_5_scores, for_sale, price)
        values (${Number(player.id)}, ${userId}, ${assignment.rarity}::app.rarity, ${stableSerialId}, ${i + 1}, ${maxSupply}, 1, 0, ${Number(player.score || 35)}, '[0,0,0,0,0]'::jsonb, false, 0)
        returning id
      `);
      cardIds.push(Number((inserted as any).rows?.[0]?.id));
    }

    await db.execute(sql`
      insert into app.lineups (user_id, card_ids, captain_id)
      values (${userId}, ${JSON.stringify(cardIds.slice(0, 5))}::jsonb, ${cardIds[0]})
      on conflict (user_id) do update set card_ids = excluded.card_ids, captain_id = excluded.captain_id
    `);

    results.push({ email: assignment.email, userId, club: assignment.club, rarity: assignment.rarity, cardsReady: cardIds.length });
  }

  const totals = await db.execute(sql`select count(*)::int as total_cards from app.player_cards`);
  return { success: true, totalCardsAfterGrant: Number((totals as any).rows?.[0]?.total_cards || 0), teams: results };
}
