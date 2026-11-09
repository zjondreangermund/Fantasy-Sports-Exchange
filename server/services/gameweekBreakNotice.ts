/**
 * Separate member communications:
 * 1. Once GW10 is fully settled, its ENTRANTS receive a results/awards note.
 * 2. When GW11 opens (not before 18:00 CAT on 9 Nov, and never while GW10
 *    remains unsettled), EVERY real registered user receives an international
 *    break + lineup reminder, irrespective of tournament entry.
 *
 * Prize congratulations are the existing, separate winner notifications.
 */
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";
import { openNextGameweekIfComplete } from "./gameweekRollover.js";

export const GW11_OPEN_AT_MS = Date.parse("2026-11-09T16:00:00.000Z"); // 18:00 CAT
export const GW10_SETTLEMENT_TITLE = "🏆 GW10 Settled — Your Results Are Ready!";
export const GW10_SETTLEMENT_MESSAGE =
  "Gameweek 10 is officially settled! 🏆 Thank you for taking part in Fantasy Arena. Open My Teams & Prizes to review your final points, tournament standings and any prize claims. Congratulations and prize-claim details are sent separately to winners. Thank you for playing!";
export const GW10_SETTLEMENT_DEDUPE_KEY = "gameweek:2026-27:10:settlement-results";
export const GW11_OPEN_TITLE = "🌍⚽ GW11 Is Open — Enjoy the International Break!";
export const GW11_OPEN_MESSAGE =
  "GW11 tournaments are now OPEN! 🎉⚽ We're entering the international break (9–17 November), so enjoy the national-team action while we prepare for the Premier League's return on Saturday, 21 November. 🌍 Before GW11 kicks off, check your players for international-duty injuries, fitness, suspensions and fixture changes. You can build your five-card Fantasy Arena lineups now, then review them again as players return — make sure to submit before the lineup deadline. Enjoy the break and let's get our teams ready for GW11! 💙🏆 — The Fantasy Arena Team";
// Reuse the existing opening key, so an individual Inbox refresh and the
// all-member broadcast can never double-notify the same account.
export const GW11_OPEN_DEDUPE_KEY = "gameweek:11:entries-open";

type NoticeResult = {
  eligible: boolean;
  title: string;
  message: string;
  created: number;
  recipients: number;
  reason?: string;
};

const rowsOf = (r: any): any[] => Array.isArray(r?.rows) ? r.rows : [];
async function gw10State() {
  return rowsOf(await db.execute(sql`
    select
      count(*) filter(where created_by_user_id is null
        and coalesce(prize_key,'') in ('ladder','free-weighted-card'))::int as "officialCount",
      count(*) filter(where created_by_user_id is null
        and coalesce(prize_key,'') in ('ladder','free-weighted-card')
        and status::text='completed')::int as "completedOfficialCount",
      count(*) filter(where status::text not in ('completed','cancelled'))::int as "unsettledCount"
    from app.competitions
    where game_week=10 and season='2026-27' and name not like '[TEST]%'
  `))[0];
}
function gw10FullySettled(row: any) {
  return Number(row?.officialCount || 0) >= 6 &&
    Number(row?.completedOfficialCount || 0) === Number(row?.officialCount || 0) &&
    Number(row?.unsettledCount || 0) === 0;
}

// Only GW10 participants. A separate congratulations/award notification is
// already created atomically by the tournament settlement code for winners.
export async function notifyGw10EntrantsSettlementIfSettled(gameWeek: number): Promise<NoticeResult | null> {
  if (gameWeek !== 10) return null;
  const base = { title:GW10_SETTLEMENT_TITLE, message:GW10_SETTLEMENT_MESSAGE, created:0, recipients:0 };
  if (!gw10FullySettled(await gw10State()))
    return { ...base, eligible:false, reason:"GW10 has uncompleted cups" };
  await ensureNotificationsSchema();
  const entrants = rowsOf(await db.execute(sql`
    select distinct ce.user_id as "userId"
    from app.competition_entries ce
    join app.competitions c on c.id=ce.competition_id
    join app.users u on u.id=ce.user_id
    where c.game_week=10 and c.season='2026-27'
      and c.status::text='completed' and c.name not like '[TEST]%'
      and ce.user_id not like 'test-bot-%'
      and ce.user_id not like 'qa-onboarding-%'
      and coalesce(u.is_banned,false)=false
    order by ce.user_id
  `));
  let created=0;
  for(const entrant of entrants) {
    try {
      const notification = await createNotificationOnce(db, {
        userId:String(entrant.userId || ""), type:"system",
        title:GW10_SETTLEMENT_TITLE, message:GW10_SETTLEMENT_MESSAGE,
        dedupeKey:GW10_SETTLEMENT_DEDUPE_KEY,
      });
      if(notification?.id) created++;
    } catch(error) { console.error("[gw10-results] Notification delivery could not be queued:",error); }
  }
  return { ...base, eligible:true, recipients:entrants.length, created };
}

// All actual registered users — not only those who entered GW10. Deliver in
// bounded batches. The 15-minute worker repeats until everyone has a durable
// Inbox item; device pushes follow their existing opt-in and retry policies.
export async function notifyGw11OpeningAllUsersIfOpen(): Promise<NoticeResult> {
  const base = { title:GW11_OPEN_TITLE, message:GW11_OPEN_MESSAGE, created:0, recipients:0 };
  if (Date.now() < GW11_OPEN_AT_MS)
    return { ...base, eligible:false, reason:"GW11 opening time not yet reached" };
  if (!gw10FullySettled(await gw10State()))
    return { ...base, eligible:false, reason:"GW10 settlement is incomplete" };
  const active = rowsOf(await db.execute(sql`
    select count(*)::int as count
    from app.competitions
    where game_week=11 and season='2026-27'
      and created_by_user_id is null
      and coalesce(prize_key,'') in ('ladder','free-weighted-card')
      and coalesce(visibility,'public')='public'
      and status::text='open' and name not like '[TEST]%'
  `))[0];
  if (Number(active?.count || 0) < 6)
    return { ...base, eligible:false, reason:"Six official GW11 cups are not yet open" };

  await ensureNotificationsSchema();
  const pending = rowsOf(await db.execute(sql`
    select u.id as "userId" from app.users u
    where coalesce(u.is_banned,false)=false
      and u.id not like 'test-bot-%'
      and u.id not like 'qa-onboarding-%'
      and not exists(
        select 1 from app.notifications n
        where n.user_id=u.id and n.dedupe_key=${GW11_OPEN_DEDUPE_KEY}
      )
    order by u.id limit 250
  `));
  let created=0;
  for (const member of pending) {
    try {
      const event = await createNotificationOnce(db,{
        userId:String(member.userId || ""),type:"system",
        title:GW11_OPEN_TITLE,message:GW11_OPEN_MESSAGE,
        dedupeKey:GW11_OPEN_DEDUPE_KEY,
      });
      if(event?.id)created++;
    } catch(error) { console.error("[gw11-opening] Could not queue a user's notice (will retry):",error); }
  }
  return { ...base, eligible:true, recipients:pending.length, created };
}

/** Safe to call on a recurring 15-minute notification worker. */
export async function runGw11OpeningCycle() {
  if(Date.now() < GW11_OPEN_AT_MS) return { status:"scheduled", opened:0, gameWeek:11 };
  const next = await openNextGameweekIfComplete(10);
  if (next.status === "opened" || next.status === "already_open") {
    const notices = await notifyGw11OpeningAllUsersIfOpen();
    if (next.opened || notices.created)
      console.info(`[gw11-launch] GW11 ${next.status}; official cups ${next.opened}; new member notices ${notices.created}/${notices.recipients}`);
    return { ...next, notices };
  }
  return next;
}
