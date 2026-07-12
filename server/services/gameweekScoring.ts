import { sql } from "drizzle-orm";
import { db } from "../db.js";

export type GameweekPlayerScore = {
  playerId: number;
  gameWeek: number;
  score: number;
  decisiveScore: number;
  allAroundScore: number;
  breakdown: Record<string, number | string | boolean>;
  source: "simulator" | "live" | "manual";
};

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

export async function ensureGameweekScoreTable() {
  await db.execute(sql`
    create table if not exists app.player_gameweek_scores (
      id integer generated always as identity primary key,
      player_id integer not null references app.players(id) on delete cascade,
      game_week integer not null,
      score real not null default 0,
      decisive_score real not null default 35,
      all_around_score real not null default 0,
      breakdown jsonb not null default '{}'::jsonb,
      source text not null default 'simulator',
      is_final boolean not null default false,
      created_at timestamp default now(),
      updated_at timestamp default now(),
      unique(player_id, game_week)
    )
  `);
  await db.execute(sql`create index if not exists idx_player_gameweek_scores_gw on app.player_gameweek_scores(game_week)`);
}

function seededUnit(playerId: number, gameWeek: number, salt: number) {
  const value = Math.sin(playerId * 12.9898 + gameWeek * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function positionBase(position: string) {
  if (position === "GK") return 48;
  if (position === "DEF") return 47;
  if (position === "MID") return 46;
  return 45;
}

function buildSimulatedScore(player: any, gameWeek: number): GameweekPlayerScore {
  const playerId = Number(player.id);
  const position = String(player.position || "MID");
  const overall = Number(player.overall || 70);
  const form = Number(player.form || 0);
  const seasonPoints = Number(player.totalPoints || 0);

  const played = seededUnit(playerId, gameWeek, 1) > 0.07;
  const minutes = played ? (seededUnit(playerId, gameWeek, 2) > 0.16 ? 90 : 45 + Math.floor(seededUnit(playerId, gameWeek, 3) * 40)) : 0;
  const quality = Math.max(0, Math.min(1, (overall - 55) / 40));
  const formBoost = Math.max(-0.12, Math.min(0.18, form / 50));

  const goalChance = position === "FWD" ? 0.28 : position === "MID" ? 0.18 : position === "DEF" ? 0.07 : 0.01;
  const assistChance = position === "MID" ? 0.24 : position === "FWD" ? 0.18 : position === "DEF" ? 0.11 : 0.02;
  const cleanSheetChance = position === "GK" || position === "DEF" ? 0.36 : position === "MID" ? 0.26 : 0;

  const goals = minutes > 0 && seededUnit(playerId, gameWeek, 4) < goalChance + quality * 0.12 + formBoost ? (seededUnit(playerId, gameWeek, 5) > 0.92 ? 2 : 1) : 0;
  const assists = minutes > 0 && seededUnit(playerId, gameWeek, 6) < assistChance + quality * 0.1 + formBoost ? (seededUnit(playerId, gameWeek, 7) > 0.95 ? 2 : 1) : 0;
  const cleanSheet = minutes >= 60 && seededUnit(playerId, gameWeek, 8) < cleanSheetChance + quality * 0.08;
  const redCard = minutes > 0 && seededUnit(playerId, gameWeek, 9) < 0.012;
  const yellowCard = !redCard && minutes > 0 && seededUnit(playerId, gameWeek, 10) < 0.13;
  const ownGoal = minutes > 0 && seededUnit(playerId, gameWeek, 11) < 0.008;
  const penaltyMiss = (position === "MID" || position === "FWD") && minutes > 0 && seededUnit(playerId, gameWeek, 12) < 0.012;
  const penaltySave = position === "GK" && minutes > 0 && seededUnit(playerId, gameWeek, 13) < 0.025;

  let decisiveScore = played ? 35 : 0;
  decisiveScore += goals * (position === "GK" || position === "DEF" ? 15 : position === "MID" ? 12 : 10);
  decisiveScore += assists * 9;
  decisiveScore += cleanSheet ? (position === "GK" || position === "DEF" ? 10 : 4) : 0;
  decisiveScore += penaltySave ? 15 : 0;
  decisiveScore -= redCard ? 15 : 0;
  decisiveScore -= ownGoal ? 8 : 0;
  decisiveScore -= penaltyMiss ? 8 : 0;

  const passes = minutes ? Math.floor(18 + seededUnit(playerId, gameWeek, 14) * 72) : 0;
  const keyPasses = minutes ? Math.floor(seededUnit(playerId, gameWeek, 15) * (position === "MID" ? 6 : 4)) : 0;
  const tackles = minutes ? Math.floor(seededUnit(playerId, gameWeek, 16) * (position === "DEF" ? 7 : 5)) : 0;
  const interceptions = minutes ? Math.floor(seededUnit(playerId, gameWeek, 17) * (position === "DEF" ? 6 : 4)) : 0;
  const duelsWon = minutes ? Math.floor(seededUnit(playerId, gameWeek, 18) * 10) : 0;
  const shotsOnTarget = minutes ? Math.floor(seededUnit(playerId, gameWeek, 19) * (position === "FWD" ? 5 : 3)) : 0;
  const saves = position === "GK" && minutes ? Math.floor(seededUnit(playerId, gameWeek, 20) * 8) : 0;
  const possessionLost = minutes ? Math.floor(seededUnit(playerId, gameWeek, 21) * 18) : 0;

  let allAroundScore = 0;
  allAroundScore += Math.min(8, passes / 12);
  allAroundScore += keyPasses * 2.2;
  allAroundScore += tackles * 1.4;
  allAroundScore += interceptions * 1.6;
  allAroundScore += duelsWon * 0.65;
  allAroundScore += shotsOnTarget * 1.5;
  allAroundScore += saves * 1.2;
  allAroundScore -= possessionLost * 0.35;
  allAroundScore -= yellowCard ? 2 : 0;
  allAroundScore += quality * 5 + Math.min(5, seasonPoints / 60);
  allAroundScore += (seededUnit(playerId, gameWeek, 22) - 0.5) * 8;

  decisiveScore = Math.max(0, Math.min(80, decisiveScore));
  allAroundScore = Math.max(-15, Math.min(45, allAroundScore));
  const score = Math.max(0, Math.min(100, Math.round((decisiveScore + allAroundScore) * 10) / 10));

  return {
    playerId,
    gameWeek,
    score,
    decisiveScore: Math.round(decisiveScore * 10) / 10,
    allAroundScore: Math.round(allAroundScore * 10) / 10,
    breakdown: {
      playerName: String(player.name || "Player"), position, minutes, goals, assists,
      cleanSheet, penaltySave, penaltyMiss, redCard, yellowCard, ownGoal,
      passes, keyPasses, tackles, interceptions, duelsWon, shotsOnTarget, saves, possessionLost,
    },
    source: "simulator",
  };
}

export async function generateSimulatedGameweekScores(gameWeek: number, force = false) {
  await ensureGameweekScoreTable();
  if (!force) {
    const existing = Number(rowsOf(await db.execute(sql`select count(*)::int as count from app.player_gameweek_scores where game_week=${gameWeek}`))[0]?.count || 0);
    if (existing > 0) return existing;
  }

  const players = rowsOf(await db.execute(sql`
    select id,name,position::text as position,overall,form,total_points as "totalPoints"
    from app.players order by id
  `));
  const scores = players.map((player) => buildSimulatedScore(player, gameWeek));

  for (let start = 0; start < scores.length; start += 500) {
    const chunk = scores.slice(start, start + 500);
    await db.execute(sql`
      insert into app.player_gameweek_scores (
        player_id,game_week,score,decisive_score,all_around_score,breakdown,source,is_final,updated_at
      )
      select x."playerId",x."gameWeek",x.score,x."decisiveScore",x."allAroundScore",x.breakdown,x.source,false,now()
      from jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb)
        as x("playerId" int,"gameWeek" int,score real,"decisiveScore" real,"allAroundScore" real,breakdown jsonb,source text)
      on conflict (player_id,game_week) do update set
        score=excluded.score,decisive_score=excluded.decisive_score,all_around_score=excluded.all_around_score,
        breakdown=excluded.breakdown,source=excluded.source,updated_at=now()
    `);
  }
  return scores.length;
}

export async function getGameweekScores(gameWeek: number) {
  await ensureGameweekScoreTable();
  return rowsOf(await db.execute(sql`
    select pgs.player_id as "playerId",pgs.game_week as "gameWeek",pgs.score::float as score,
      pgs.decisive_score::float as "decisiveScore",pgs.all_around_score::float as "allAroundScore",
      pgs.breakdown,pgs.source,p.name,p.team,p.position::text as position
    from app.player_gameweek_scores pgs join app.players p on p.id=pgs.player_id
    where pgs.game_week=${gameWeek}
  `));
}
