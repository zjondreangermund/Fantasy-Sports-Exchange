/**
 * GW10 2026/27 international-break message. Sent after ALL official cups
 * settle, never on a failed/partial settlement or a player-score refresh.
 * Per-member deduplication makes retries and individual-cup settlement safe.
 */
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";

export const GW10_BREAK_TITLE = "🌍⚽ GW10 Complete — Enjoy the International Break!";
export const GW10_BREAK_MESSAGE =
  "GW10 is officially settled! 🏆 We're heading into the international break, so enjoy the international football while we wait for the Premier League to return. Before GW11 kicks off, please review your players for injuries, suspensions, availability and fixture changes — and update your Fantasy Arena lineup before the entry deadline. Enjoy the break, recharge, and let's get our lineups ready for GW11! ⚽💙 — The Fantasy Arena Team";
export const GW10_BREAK_DEDUPE_KEY = "gameweek:2026-27:10:international-break";

type BreakNoticeResult = {
  eligible: boolean;
  title: string;
  message: string;
  created: number;
  recipients: number;
  reason?: string;
};

function rowsOf(value: any): any[] {
  return Array.isArray(value?.rows) ? value.rows : [];
}

/** Database-backed integrity check: never send before all GW10 cups are done. */
export async function notifyGw10InternationalBreakIfSettled(gameWeek: number): Promise<BreakNoticeResult | null> {
  if (gameWeek !== 10) return null;
  const base = { title: GW10_BREAK_TITLE, message: GW10_BREAK_MESSAGE, recipients: 0, created: 0 };
  const status = rowsOf(await db.execute(sql`
    select
      count(*) filter (where c.created_by_user_id is null
        and coalesce(c.prize_key,'') in ('ladder','free-weighted-card'))::int as "officialCount",
      count(*) filter (where c.created_by_user_id is null
        and coalesce(c.prize_key,'') in ('ladder','free-weighted-card')
        and c.status::text='completed')::int as "completedOfficialCount",
      count(*) filter (where c.status::text not in ('completed','cancelled'))::int as "unsettledCount"
    from app.competitions c
    where c.game_week=10 and c.season='2026-27'
      and c.name not like '[TEST]%'
  `))[0];
  if (Number(status?.officialCount || 0) < 6 ||
    Number(status?.completedOfficialCount || 0) !== Number(status?.officialCount || 0) ||
    Number(status?.unsettledCount || 0) > 0) {
    return { ...base, eligible:false, reason:"GW10 has not finished settling every eligible tournament" };
  }

  await ensureNotificationsSchema();
  const audience = rowsOf(await db.execute(sql`
    select distinct ce.user_id as "userId"
    from app.competition_entries ce
    join app.competitions c on c.id=ce.competition_id
    join app.users u on u.id=ce.user_id
    where c.game_week=10 and c.season='2026-27'
      and c.status::text='completed'
      and c.name not like '[TEST]%'
      and ce.user_id not like 'test-bot-%'
      and ce.user_id not like 'qa-onboarding-%'
      and coalesce(u.is_banned,false)=false
    order by ce.user_id
  `));
  let created = 0;
  for (const member of audience) {
    try {
      const delivered = await createNotificationOnce(db,{
        userId:String(member.userId || ""), type:"system",
        title:GW10_BREAK_TITLE, message:GW10_BREAK_MESSAGE,
        dedupeKey:GW10_BREAK_DEDUPE_KEY,
      });
      if (delivered?.id) created += 1;
    } catch(error) {
      // Keep prize settlement independent of push delivery failures. A
      // successful retry will fill missing inbox notices exactly once.
      console.error("[gw10-break] Could not queue manager notice:", error);
    }
  }
  return { ...base, eligible:true, recipients:audience.length, created };
}
