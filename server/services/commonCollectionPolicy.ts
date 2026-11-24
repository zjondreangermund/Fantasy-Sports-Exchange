import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { COMMON_COLLECTION_CAP, supportsTwoCommonTeams } from '../../shared/common-collection.js';
import { findBlockedCards } from './commonCardProtection.js';
import { createNotificationOnce, ensureNotificationsSchema } from './notifications.js';
import { currentPremierLeagueMintIds } from './currentPremierLeagueMintPool.js';
const rowsOf = (r:any):any[] => r?.rows || (Array.isArray(r) ? r : []);

export async function lockCommonCollection(tx:any,userId:string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`common-cap:${userId}`}))`);
  await tx.execute(sql`select id from app.player_cards where owner_id=${userId} order by id for update`);
}

export async function loadCommonCollection(tx:any,userId:string) {
  return rowsOf(await tx.execute(sql`
    select pc.id,pc.player_id as "playerId",pc.level,pc.xp,pc.for_sale as "forSale",
      p.name,p.position::text as position,p.team,p.overall,p.status,p.image_url as "imageUrl"
    from app.player_cards pc join app.players p on p.id=pc.player_id
    where pc.owner_id=${userId} and pc.rarity::text='common' order by pc.id
  `));
}

export async function assertCommonCardsRemovable(tx:any,userId:string,ids:number[]) {
  if ((await findBlockedCards(tx,userId,ids)).length)
    throw new Error('A selected card is in a lineup, loan, auction or swap. Remove it from protected use first.');
}

export async function getCommonCollectionPlan(userId:string) {
  const cards=await loadCommonCollection(db,userId);
  const blocked=new Set((await findBlockedCards(db,userId,cards.map(c=>Number(c.id)))).map(c=>Number(c.cardId)));
  return {cap:COMMON_COLLECTION_CAP,cards:cards.map(card=>({...card,blocked:blocked.has(Number(card.id))||Boolean(card.forSale)})),
    excess:Math.max(0,cards.length-COMMON_COLLECTION_CAP)};
}

export async function reduceCommonCollection(userId:string,raw:unknown, selectKept = false) {
  if(!Array.isArray(raw)||raw.some(id=>!Number.isInteger(id)||id<=0)||new Set(raw).size!==raw.length)
    throw new Error('Select the Common cards you want to sacrifice.');
  const selection=raw as number[];
  return db.transaction(async tx=>{
    await lockCommonCollection(tx,userId);
    const cards=await loadCommonCollection(tx,userId);
    if(cards.length<=COMMON_COLLECTION_CAP)throw new Error('Your Common collection is already within the limit.');
    if(selectKept && (selection.length!==COMMON_COLLECTION_CAP || selection.some(id=>!cards.some(c=>Number(c.id)===id))))
      throw new Error('Choose exactly 10 of your Common cards to keep.');
    const ids=selectKept ? cards.filter(c=>!selection.includes(Number(c.id))).map(c=>Number(c.id)) : selection;
    if(ids.length!==cards.length-COMMON_COLLECTION_CAP)throw new Error(`Select exactly ${cards.length-COMMON_COLLECTION_CAP} cards to keep your best 10.`);
    if(ids.some(id=>!cards.some(c=>Number(c.id)===id&&!c.forSale)))throw new Error('Only your unlisted Common cards can be sacrificed.');
    await assertCommonCardsRemovable(tx,userId,ids);
    const eligibleIds=new Set(await currentPremierLeagueMintIds(tx));
    const kept=cards.filter(c=>!ids.includes(Number(c.id))).map(c=>({...c,eligible:eligibleIds.has(Number(c.playerId))}));
    if(!supportsTwoCommonTeams(kept))throw new Error('Keep two GK, two DEF, two MID, two FWD and two extra outfield cards, all current Premier League players, for two teams. No cards were sacrificed.');
    // Retain historical rows and reward references; sacrifice removes ownership.
    await tx.execute(sql`update app.player_cards set owner_id=null,for_sale=false,price=0 where owner_id=${userId} and id=any(${`{${ids.join(',')}}`}::int[])`);
    await tx.execute(sql`insert into app.audit_logs(user_id,action,meta) values(${userId},'collection.common_limit.sacrificed',${JSON.stringify({cardIds:ids,keptCardIds:kept.map(c=>c.id)})}::jsonb)`);
    return {sacrificed:ids.length,commonCount:COMMON_COLLECTION_CAP};
  });
}

export async function notifyCommonLimitChange() {
  await ensureNotificationsSchema();
  const users=rowsOf(await db.execute(sql`select owner_id as id from app.player_cards where owner_id is not null and rarity::text='common' group by owner_id having count(*)>${COMMON_COLLECTION_CAP}`));
  for(const user of users)await createNotificationOnce(db,{userId:String(user.id),type:'system',
    title:'Common card limit is changing to 10',
    message:'From GW12, the Common card limit is 10 per user, allowing at most two teams per Common tournament. This limit does not apply to other rarities. Open this message to choose your best 10 Common cards to keep. Review previous game points on each player card; the remaining cards will be burned only after you confirm. Keep at least 2 GK, 2 DEF, 2 MID, 2 FWD and 2 extra outfield players so you can enter two teams. Choosing your 10 is required on login even if you have not opened this notice. The app checks your selection before any sacrifice. At the limit, your weekly mint can replace a selected Common with a random Premier League player of the same position and rarity, retaining its level and XP.',
    dedupeKey:'collection:common-limit-10:2026-11:v1'});
}
