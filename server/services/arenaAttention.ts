import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { fplApi } from "./fplApi.js";
import { getActivePrizeForEntries, RARITIES } from "./prizeEngine.js";
import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";

const rows = (r: any): any[] => Array.isArray(r?.rows) ? r.rows : [];
type AlertCategory = "tournament" | "players" | "prizes" | "marketplace" | "community" | "marketing";
export const ALERT_CATEGORIES: AlertCategory[] = ["tournament", "players", "prizes", "marketplace", "community", "marketing"];
const DEFAULTS: Record<AlertCategory, boolean> = {
  tournament:true,players:true,prizes:true,marketplace:true,community:true,marketing:false,
};
let initialized: Promise<void> | null = null;
export async function ensureArenaAttentionSchema() {
  if (!initialized) initialized=(async()=>{
    await ensureNotificationsSchema();
    await db.execute(sql`CREATE TABLE IF NOT EXISTS app.arena_alert_checkpoints(
      key text primary key, value text not null, checked_at timestamptz not null default now()
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS app.arena_alert_preferences(
      user_id varchar(255) primary key references app.users(id) on delete cascade,
      preferences jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS app.arena_price_watches(
      user_id varchar(255) not null references app.users(id) on delete cascade,
      card_id integer not null references app.player_cards(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key(user_id,card_id)
    )`);
  })().catch(error=>{initialized=null;throw error;});
  await initialized;
}
export async function getArenaAlertPreferences(userId: string):Promise<Record<AlertCategory,boolean>>{
  await ensureArenaAttentionSchema();
  const value=rows(await db.execute(sql`SELECT preferences FROM app.arena_alert_preferences WHERE user_id=${userId}`))[0]?.preferences || {};
  return {...DEFAULTS,...Object.fromEntries(ALERT_CATEGORIES.filter(k=>typeof value[k] === "boolean").map(k=>[k,value[k]]))} as Record<AlertCategory,boolean>;
}
export async function setArenaAlertPreferences(userId:string, input:any){
  const preferences=await getArenaAlertPreferences(userId);
  for(const key of ALERT_CATEGORIES) if(typeof input?.[key] === "boolean") preferences[key]=input[key];
  await db.execute(sql`INSERT INTO app.arena_alert_preferences(user_id,preferences) VALUES(${userId},${JSON.stringify(preferences)}::jsonb)
    ON CONFLICT(user_id) DO UPDATE SET preferences=EXCLUDED.preferences,updated_at=now()`);
  return preferences;
}
async function interestedUsers(people: any[], category: AlertCategory): Promise<string[]> {
  const ids=[...new Set(people.map(x=>String(x.userId || "")).filter(Boolean))];
  if(!ids.length)return [];
  const prefs=rows(await db.execute(sql`SELECT user_id AS "userId",preferences FROM app.arena_alert_preferences
    WHERE user_id IN (SELECT value FROM jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))`));
  const blocked=new Set(prefs.filter(x=>x.preferences?.[category]===false).map(x=>String(x.userId)));
  if(!DEFAULTS[category])return prefs.filter(x=>x.preferences?.[category]===true).map(x=>String(x.userId));
  return ids.filter(id=>!blocked.has(id));
}
async function sendMany(people:any[],category:AlertCategory,title:string,message:string,key:string) {
  let count=0;
  for(const userId of await interestedUsers(people,category)){
    const result=await createNotificationOnce(db,{userId,title,message,dedupeKey:key});
    if(result?.id)count++;
  }
  return count;
}
async function adminUser() {
  const email=String(process.env.FANTASY_ARENA_ADMIN_NOTIFICATION_EMAIL || "lbcplaya@gmail.com").toLowerCase();
  return rows(await db.execute(sql`SELECT id AS "userId" FROM app.users
    WHERE lower(coalesce(email,''))=${email} LIMIT 1`))[0]?.userId || "";
}
async function adminAlert(title:string,message:string,key:string){
  const userId=await adminUser();
  if(userId)await createNotificationOnce(db,{userId,title,message,dedupeKey:`admin:${key}`});
}
/** First observation sets a baseline without blasting users with historical events.
 * Subsequent real changes are persisted before queuing deduped notices.
 */
async function changed(key:string,value:string):Promise<{old:string|null; changed:boolean}>{
  const previous=rows(await db.execute(sql`SELECT value FROM app.arena_alert_checkpoints WHERE key=${key}`))[0];
  if(previous?.value===value)return{old:value,changed:false};
  await db.execute(sql`INSERT INTO app.arena_alert_checkpoints(key,value) VALUES(${key},${value})
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,checked_at=now()`);
  return {old:previous?String(previous.value):null,changed:previous!==undefined};
}
function gameweekSeason(kickoff:Date){
  const y=kickoff.getUTCFullYear()-(kickoff.getUTCMonth()<6?1:0);
  return `${y}-${String((y+1)%100).padStart(2,"0")}`;
}
async function prizeProgress(){
  const records=rows(await db.execute(sql`
    SELECT c.game_week AS "gameWeek",c.tier::text AS rarity,
      min(c.start_date) AS "opening",count(ce.id)::int AS entries,
      COALESCE(sum(ce.entry_fee_paid),0)::float AS funding
    FROM app.competitions c
    LEFT JOIN app.competition_entries ce ON ce.competition_id=c.id
      AND coalesce(ce.entry_fee_paid,0)>0 AND ce.user_id NOT LIKE 'test-bot-%'
    WHERE c.status::text IN ('open','active')
      AND coalesce(c.prize_key,'')='ladder' AND c.created_by_user_id IS NULL
      AND coalesce(c.visibility,'public')='public' AND coalesce(c.entry_fee,0)>0
      AND c.start_date BETWEEN now()-interval '8 days' AND now()+interval '38 days'
    GROUP BY c.game_week,c.tier
  `));
  for(const row of records){
    const rarity=String(row.rarity || "").toLowerCase();
    if(!RARITIES.includes(rarity as any))continue;
    const gw=Number(row.gameWeek || 0), entries=Number(row.entries || 0);
    const prize=getActivePrizeForEntries(rarity,entries).activePrize;
    const newKey=String(prize?.key || "no-prize");
    const season=gameweekSeason(new Date(row.opening));
    const id=`prize-level:${season}:GW${gw}:${rarity}`;
    const state=await changed(id,newKey);
    if(!state.changed)continue; // baseline: no old push on first deployment
    const title=prize?`🎁 GW${gw} ${rarity.toUpperCase()} prize upgraded!`:`GW${gw} ${rarity.toUpperCase()} prize level changed`;
    const message=prize?`${prize.title} (N$${prize.value.toLocaleString("en-NA")}) is now the highest unlocked prize, backed by ${entries} confirmed paid entries. Check Prize Vault for details.`:
      "The funded prize level has changed. Open Prize Vault for the updated rules and qualifying entry count.";
    const people=rows(await db.execute(sql`
      SELECT DISTINCT ce.user_id AS "userId" FROM app.competition_entries ce
      JOIN app.competitions c ON c.id=ce.competition_id
      WHERE c.game_week=${gw} AND c.tier::text=${rarity}
        AND coalesce(c.prize_key,'')='ladder' AND c.created_by_user_id IS NULL
        AND c.start_date BETWEEN now()-interval '8 days' AND now()+interval '38 days'
    `));
    await sendMany(people,"prizes",title,message,`${id}:${newKey}`);
    await adminAlert(prize && Number(prize.value)>=25000?"🚨 High-value Prize Vault level unlocked":title,
      `GW${gw} ${rarity}: ${entries} paid entries, N$${Number(row.funding).toFixed(2)} collected. ${message} Confirm reserves and fulfilment before awarding.`,`${id}:${newKey}`);
  }
}
async function fixtureAndDeadlineChanges(fixtures:any[]){
  const next=Date.now();
  for(const f of fixtures){
    const gw=Number(f?.event||0),id=Number(f?.id||0),kickoff=Date.parse(String(f?.kickoff_time||""));
    if(gw<1||gw>38||!id||!Number.isFinite(kickoff)||kickoff<next||kickoff>next+45*86400000)continue;
    const newVal=new Date(kickoff).toISOString();
    const key=`fixture-date:${id}`;
    const state=await changed(key,newVal);
    if(!state.changed||!state.old||Math.abs(Date.parse(state.old)-kickoff)<5*60_000)continue;
    const people=rows(await db.execute(sql`SELECT DISTINCT ce.user_id AS "userId" FROM app.competition_entries ce
      JOIN app.competitions c ON c.id=ce.competition_id WHERE c.game_week=${gw}
      AND c.status::text in ('open','upcoming','active')`));
    const when=new Date(kickoff).toLocaleString("en-NA",{timeZone:"Africa/Windhoek",dateStyle:"medium",timeStyle:"short"});
    await sendMany(people,"tournament",`📅 GW${gw} fixture schedule changed`,
      `A Premier League fixture has moved to ${when} Namibia time. Check your selected players and updated entry cutoff before kickoff.`,`fixture-change:${id}:${newVal}`);
    await adminAlert("📅 Premier League fixture rescheduled",`GW${gw} fixture ${id} moved from ${state.old} to ${newVal}; verify affected competition close times.`,`fixture-change:${id}:${newVal}`);
  }
}
async function unavailablePlayers(bootstrap:any,fixtures:any[]){
  const events=(Array.isArray(bootstrap?.elements)?bootstrap.elements:[]) as any[];
  const changedPlayers=events.filter(e=>["i","s","u"].includes(String(e.status || "").toLowerCase()));
  if(!changedPlayers.length)return;
  const map=new Map(changedPlayers.map(e=>[Number(e.id),e]));
  const now=Date.now();
  const weeks=[...new Set(fixtures.filter(f=>Number.isFinite(Date.parse(String(f.kickoff_time || "")))
    && Date.parse(String(f.kickoff_time))>now && Date.parse(String(f.kickoff_time))<now+24*3600000).map(f=>Number(f.event)).filter(Boolean))];
  for(const week of weeks){
    const affected=rows(await db.execute(sql`SELECT DISTINCT ce.user_id AS "userId", p.fpl_id AS "fplId", p.name AS "playerName"
      FROM app.competition_entries ce JOIN app.competitions c ON c.id=ce.competition_id
      CROSS JOIN LATERAL jsonb_array_elements_text(ce.lineup_card_ids) selected(card_id)
      JOIN app.player_cards pc ON pc.id=selected.card_id::integer
      JOIN app.players p ON p.id=pc.player_id
      WHERE c.game_week=${week} AND c.status::text='open' AND p.fpl_id IS NOT NULL
        AND c.start_date >= now()-interval '14 days'`));
    for(const a of affected){
      const element=map.get(Number(a.fplId));
      if(!element)continue;
      const st=String(element.status);
      if(!["i","s","u"].includes(st))continue;
      const label=st==="s"?"suspended":st==="i"?"listed as injured":"listed as unavailable";
      await sendMany([a],"players",`🚨 GW${week} lineup warning — ${a.playerName}`,
        `${a.playerName} is ${label} in the official Premier League data. This player is in your submitted team. Review and edit before first kickoff; a replacement cannot be guaranteed.`,
        `player-availability:GW${week}:${Number(a.fplId)}:${st}`);
    }
  }
}
async function pendingActions(){
  const expiringLoans=rows(await db.execute(sql`SELECT id, original_owner_id AS "ownerId",
    borrower_user_id AS "borrowerId",expires_at AS "expiresAt",card_id AS "cardId"
    FROM app.card_loans WHERE status='active' AND expires_at BETWEEN now() AND now()+interval '24 hours' LIMIT 200`));
  for(const loan of expiringLoans){
    const message=`Card #${loan.cardId} loan ends within 24 hours. Review any upcoming tournament lineups and the return rules.`;
    await sendMany([{userId:loan.ownerId},{userId:loan.borrowerId}],"marketplace","⏳ Card loan ending soon",message,`loan:${loan.id}:expires-in-24h`);
  }
  const claims=rows(await db.execute(sql`SELECT id,user_id AS "userId",prize_title AS "title",
    competition_id AS "competitionId",created_at AS "createdAt"
    FROM app.competition_prize_awards WHERE status='pending_claim'
      AND created_at >= now()-interval '14 days' LIMIT 200`));
  for(const claim of claims){
    await sendMany([claim],"prizes","🎁 Your prize is ready to claim",
      `You won ${claim.title}. Open My Entries to submit your claim and contact details. No deadline is implied unless one is shown in your official prize rules.`,
      `prize-award:${claim.id}:claim-action`);
    const age=Date.now()-Date.parse(String(claim.createdAt));
    if(age>24*3600000)await adminAlert("⚠️ Prize fulfilment needs attention",
      `Prize claim #${claim.id}, competition #${claim.competitionId}, still awaits processing.`,
      `prize-claim:${claim.id}:pending-24h`);
  }
  const withdrawals=rows(await db.execute(sql`SELECT id,user_id AS "userId",amount,created_at AS "createdAt"
    FROM app.withdrawal_requests WHERE status='pending' AND created_at >= now()-interval '14 days' LIMIT 100`));
  for(const w of withdrawals)await adminAlert("💰 Withdrawal awaiting review",
    `Withdrawal #${w.id} for N$${Number(w.amount).toFixed(2)} is pending. Verify player eligibility and payment-provider approval.`,
    `withdrawal:${w.id}:new-pending`);
}
let running=false,lastRun=0;
export async function runArenaAttentionScan(){
  if(running||Date.now()-lastRun<4*60_000)return;
  running=true;lastRun=Date.now();
  try{
    await ensureArenaAttentionSchema();
    const [fixtures,bootstrap]=await Promise.all([fplApi.fixturesLive(),fplApi.bootstrap()]);
    for(const [name,job] of [
      ["Prize Vault unlocks",()=>prizeProgress()],
      ["fixture changes",()=>fixtureAndDeadlineChanges(Array.isArray(fixtures)?fixtures:[])],
      ["player availability",()=>unavailablePlayers(bootstrap,Array.isArray(fixtures)?fixtures:[])],
      ["pending actions",()=>pendingActions()],
    ] as const){
      try{await job()}catch(error){console.warn(`[arena-attention] ${name} check failed:`,error);}
    }
  }finally{running=false;}
}
let timer:NodeJS.Timeout|null=null;
export function startArenaAttentionWorker(){
  if(timer)return;
  const start=setTimeout(()=>void runArenaAttentionScan().catch(e=>console.error("[arena-attention] initial scan failed",e)),25_000);
  start.unref?.();
  timer=setInterval(()=>void runArenaAttentionScan().catch(e=>console.error("[arena-attention] scan failed",e)),5*60_000);
  timer.unref?.();
}
