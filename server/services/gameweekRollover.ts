import { db } from "../db.js";
import { sql } from "drizzle-orm";

const GW11_OPEN_AT_MS = Date.parse("2026-11-09T16:00:00.000Z"); // 18:00 CAT
let nextGameweekSchemaPromise: Promise<void> | null = null;
function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

// Shared by GW settlement AND the periodic announcement scheduler. Keep the
// six official cup readiness, recorded points, frozen awards and all user cup
// settlement rules unchanged. An admin manual status override is respected.
export const openNextGameweekIfComplete = async (gameWeek: number) => {
    if (gameWeek < 1 || gameWeek >= 38) return { status: "season_complete", opened: 0, gameWeek: gameWeek + 1 };
    if (!nextGameweekSchemaPromise) {
      nextGameweekSchemaPromise = db.execute(sql`alter table app.competitions add column if not exists auto_opened_after_settlement boolean not null default false`)
        .then(() => {}).catch((error) => { nextGameweekSchemaPromise = null; throw error; });
    }
    await nextGameweekSchemaPromise;
    return db.transaction(async (tx) => {
      const official = rowsOf(await tx.execute(sql`
        select season from app.competitions
        where game_week=${gameWeek} and created_by_user_id is null
          and coalesce(prize_key,'')='ladder' and name not like '[TEST]%'
        order by id limit 1
      `))[0];
      const season = String(official?.season || "");
      if (!season) return { status: "not_prepared", opened: 0, gameWeek: gameWeek + 1 };
      const incomplete = rowsOf(await tx.execute(sql`
        select id from app.competitions where game_week=${gameWeek}
          and (season=${season} or season is null)
          and name not like '[TEST]%'
          and status::text not in ('completed','cancelled')
        limit 1
      `));
      if (incomplete.length) return { status: "settlement_incomplete", opened: 0, gameWeek: gameWeek + 1 };

      const targetWeek = gameWeek + 1;
      // Special 2026/27 international-break launch: plan GW11 for 18:00
      // Namibia time on Mon 9 Nov. Never open before GW10 is fully settled.
      if (gameWeek === 10 && season === "2026-27" &&
          Date.now() < GW11_OPEN_AT_MS) {
        return { status: "scheduled", opened: 0, gameWeek: targetWeek,
          openAt: new Date(GW11_OPEN_AT_MS).toISOString() };
      }

      const prepared = rowsOf(await tx.execute(sql`
        select id, status::text as status from app.competitions
        where game_week=${targetWeek} and season=${season}
          and created_by_user_id is null and coalesce(visibility,'public')='public'
          and coalesce(prize_key,'') in ('ladder','free-weighted-card')
          and name not like '[TEST]%' and status::text not in ('cancelled','completed')
        for update
      `));
      // Five paid rarity ladders plus the single FREE Common Card Cup must exist.
      // Never partially launch a week while the official calendar is incomplete.
      if (prepared.length < 6) return { status: "not_prepared", opened: 0, gameWeek: targetWeek };
      const updated = rowsOf(await tx.execute(sql`
        update app.competitions
        set status='open', start_date=least(start_date,now()),
          auto_opened_after_settlement=true
        where game_week=${targetWeek} and season=${season}
          and created_by_user_id is null and coalesce(visibility,'public')='public'
          and coalesce(prize_key,'') in ('ladder','free-weighted-card')
          and name not like '[TEST]%'
          and status::text='upcoming' and admin_status_override is null
          and coalesce(fixture_window_start,start_date)>now()
        returning id
      `));
      return {
        status: updated.length ? "opened" : prepared.every((row: any) => row.status === "open") ? "already_open" : "not_open",
        opened: updated.length, gameWeek: targetWeek,
      };
    });
  };
