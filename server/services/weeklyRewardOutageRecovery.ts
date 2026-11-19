/**
 * November 2026 football-data interruption recovery.
 * Original signup-anchored 7-day windows are the source of truth.
 * Only windows overlapping the interruption AND already expired can be
 * recovered. Current windows stay on the normal weekly claim endpoint.
 *
 * Never issue cards unless the normal current-EPL roster validator succeeds.
 * Claims are opt-in and serialized with the normal weekly mint advisory lock.
 */
import {sql} from "drizzle-orm";
import {db} from "../db.js";
import {currentPremierLeagueMintIds} from "./currentPremierLeagueMintPool.js";
import {ensureNotificationsSchema,createNotificationOnce} from "./notifications.js";
import {ensureDailyLoginRewardSchema,DAILY_LOGIN_COMMON_CARD_CAP} from "./dailyLoginReward.js";

export const MINT_RECOVERY_START="2026-11-09";
export const MINT_RECOVERY_END_EXCLUSIVE="2026-11-20";
export const MINT_RECOVERY_CLAIM_DEADLINE="2026-12-10";
export const MINT_RECOVERY_NOTICE_KEY="football-data:2026-11:missed-weekly-recovery:v1";
const rows=(value:any):any[]=>Array.isArray(value?.rows)?value.rows:[];
let ready:Promise<void>|null=null;

export async function ensureOutageRecoverySchema(){
  if(!ready)ready=(async()=>{
    await ensureDailyLoginRewardSchema();
    await ensureNotificationsSchema();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app.weekly_reward_recovery (
        user_id varchar(255) NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        window_start date NOT NULL,
        card_id integer NOT NULL UNIQUE REFERENCES app.player_cards(id) ON DELETE RESTRICT,
        claimed_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(user_id,window_start)
      )
    `);
  })().catch(e=>{ready=null;throw e;});
  await ready;
}

async function pendingWindows(executor:any,userId:string){
  // Calculate original scheduled windows. No arbitrary historical gifts: the
  // full weekly window must intersect the documented interruption interval.
  const result=await executor.execute(sql`
    WITH account AS (
      SELECT ((u.created_at AT TIME ZONE current_setting('TIMEZONE')) AT TIME ZONE 'Africa/Windhoek')::date + 1 AS first_day
      FROM app.users u WHERE u.id=${userId} AND COALESCE(u.is_banned,false)=false
    ), windows AS (
      SELECT (a.first_day + (7 * g.n))::date AS window_start
      FROM account a CROSS JOIN LATERAL generate_series(
        GREATEST(0, ((${MINT_RECOVERY_START}::date-a.first_day)/7)-1),
        GREATEST(0, ((${MINT_RECOVERY_END_EXCLUSIVE}::date-a.first_day)/7)+1)
      ) AS g(n)
    )
    SELECT to_char(w.window_start,'YYYY-MM-DD') AS "windowStart"
    FROM windows w
    WHERE w.window_start < ${MINT_RECOVERY_END_EXCLUSIVE}::date
      AND w.window_start + 7 > ${MINT_RECOVERY_START}::date
      AND w.window_start + 7 <= (now() AT TIME ZONE 'Africa/Windhoek')::date
      AND (now() AT TIME ZONE 'Africa/Windhoek')::date < ${MINT_RECOVERY_CLAIM_DEADLINE}::date
      AND NOT EXISTS(
        SELECT 1 FROM app.daily_login_rewards claimed
        WHERE claimed.user_id=${userId}
          AND claimed.reward_day>=w.window_start
          AND claimed.reward_day<w.window_start+7
      )
      AND NOT EXISTS(
        SELECT 1 FROM app.weekly_reward_recovery issued
        WHERE issued.user_id=${userId} AND issued.window_start=w.window_start
      )
    ORDER BY w.window_start
  `);
  return rows(result).map(row=>String(row.windowStart||"")).filter(Boolean);
}

async function commonCount(executor:any,userId:string){
  const result=rows(await executor.execute(sql`
    SELECT count(*)::int AS count FROM app.player_cards
    WHERE owner_id=${userId} AND rarity::text='common'
  `))[0];
  return Number(result?.count||0);
}

export async function getOutageRecoveryStatus(userId:string){
  await ensureOutageRecoverySchema();
  const [windows,count]=await Promise.all([pendingWindows(db,userId),commonCount(db,userId)]);
  return {pendingWindows:windows,commonCount:count,cap:DAILY_LOGIN_COMMON_CARD_CAP,
    capReached:count>=DAILY_LOGIN_COMMON_CARD_CAP,
    claimDeadline:MINT_RECOVERY_CLAIM_DEADLINE,
    interruptionStart:MINT_RECOVERY_START,interruptionEndExclusive:MINT_RECOVERY_END_EXCLUSIVE};
}

export async function claimOutageWeeklyCard(userId:string,windowStart:string){
  if(!/^2026-11-\d{2}$/.test(windowStart))throw new Error("Invalid missed reward window");
  await ensureOutageRecoverySchema();
  return db.transaction(async tx=>{
    // Same per-account lock as normal weekly mint. Protect cap + double-clicks.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`weekly-common:${userId}`}))`);
    const available=await pendingWindows(tx,userId);
    if(!available.includes(windowStart)){
      const prior=rows(await tx.execute(sql`
        SELECT r.card_id AS "cardId",p.name AS "playerName"
        FROM app.weekly_reward_recovery r
        JOIN app.player_cards c ON c.id=r.card_id
        JOIN app.players p ON p.id=c.player_id
        WHERE r.user_id=${userId} AND r.window_start=${windowStart}::date
      `))[0];
      if(prior)return {claimed:false,alreadyClaimed:true,windowStart,cardId:Number(prior.cardId),playerName:String(prior.playerName)};
      throw new Error("This window is not eligible for recovery, was already claimed, or its deadline has passed.");
    }
    const count=await commonCount(tx,userId);
    if(count>=DAILY_LOGIN_COMMON_CARD_CAP)throw new Error(
      "Your Common collection is full (20/20). Your missed reward is still reserved; make space before claiming."
    );
    const eligibleIds=await currentPremierLeagueMintIds(tx);
    // Reuse current official FPL + fresh API-Football roster gating and database
    // mint guard, preserving supply and duplicate preferences.
    const positions=rows(await tx.execute(sql`
      SELECT p.position::text AS position,count(*)::int AS count
      FROM app.player_cards pc JOIN app.players p ON p.id=pc.player_id
      WHERE pc.owner_id=${userId} AND pc.rarity::text='common'
      AND p.position::text IN ('GK','DEF','MID','FWD')
      GROUP BY p.position::text
    `));
    const tally=new Map<string,number>(positions.map(p=>[String(p.position),Number(p.count)] as [string,number]));
    const priority=['GK','DEF','MID','FWD'].sort((a,b)=>(tally.get(a)||0)-(tally.get(b)||0));
    let chosen:any=null;
    for(const position of priority){
      for(const avoidOwned of [true,false]){
        chosen=rows(await tx.execute(sql`
          SELECT p.id,p.name FROM app.players p
          WHERE p.id=ANY(${`{${eligibleIds.join(",")}}`}::int[])
            AND p.position::text=${position}
            AND COALESCE(p.fpl_id,0)>0
            AND (NOT ${avoidOwned}::boolean OR NOT EXISTS(
              SELECT 1 FROM app.player_cards owned
              WHERE owned.owner_id=${userId} AND owned.player_id=p.id AND owned.rarity::text='common'
            ))
            AND (SELECT count(*) FROM app.player_cards supply
                 WHERE supply.player_id=p.id AND supply.rarity::text='common')<1000
          ORDER BY random() LIMIT 1
        `))[0];
        if(chosen)break;
      }
      if(chosen)break;
    }
    if(!chosen)throw new Error("No verified current Premier League player is available; your recovery remains pending.");
    const card=rows(await tx.execute(sql`
      INSERT INTO app.player_cards(player_id,owner_id,rarity,level,xp,decisive_score,for_sale,price)
      VALUES(${Number(chosen.id)},${userId},'common',1,0,35,false,0)
      RETURNING id
    `))[0];
    if(!card?.id)throw new Error("Could not create the recovered Common card");
    await tx.execute(sql`
      INSERT INTO app.weekly_reward_recovery(user_id,window_start,card_id)
      VALUES(${userId},${windowStart}::date,${Number(card.id)})
    `);
    await createNotificationOnce(tx,{userId,title:"Missed weekly Common card recovered",
      message:`${String(chosen.name)} was added to your Collection for the weekly window starting ${windowStart}.`,
      dedupeKey:`card:outage-recovered:${windowStart}`});
    await tx.execute(sql`
      INSERT INTO app.audit_logs(user_id,action,meta)
      VALUES(${userId},'reward.weekly_common.recovered',
        ${JSON.stringify({windowStart,cardId:Number(card.id),playerId:Number(chosen.id)})}::jsonb)
    `);
    return {claimed:true,alreadyClaimed:false,windowStart,cardId:Number(card.id),playerName:String(chosen.name)};
  });
}

/** One stable key per user, every attempt safe to retry. Never auto-mints. */
export async function notifyNovemberMintInterruption(){
  await ensureOutageRecoverySchema();
  // Do not announce claim recovery until the authoritative active EPL roster
  // is healthy. A paid API-Football subscription alone is not verification.
  // The normal claim continues to recheck eligibility in its own transaction.
  await currentPremierLeagueMintIds(db);
  const recipients=rows(await db.execute(sql`
    SELECT u.id AS "userId" FROM app.users u
    WHERE COALESCE(u.is_banned,false)=false
      AND u.id NOT LIKE 'test-bot-%' AND u.id NOT LIKE 'qa-onboarding-%'
      AND NOT EXISTS(SELECT 1 FROM app.notifications n
                     WHERE n.user_id=u.id AND n.dedupe_key=${MINT_RECOVERY_NOTICE_KEY})
    ORDER BY u.id LIMIT 200
  `));
  let sent=0;
  for(const row of recipients){
    const note=await createNotificationOnce(db,{
      userId:String(row.userId),
      title:"Football-data interruption — missed Common rewards",
      message:"During the November international break, football-data access was interrupted and some card mints could not complete. Your Inbox now lets you reopen card actions and claim any eligible expired weekly Common reward that was missed during this interruption. A reward is issued only after current Premier League membership can be verified. Already claimed cards will not be repeated.",
      dedupeKey:MINT_RECOVERY_NOTICE_KEY,
    });
    if(note?.id)sent++;
  }
  return {pending:recipients.length,created:sent};
}
