import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { COMMON_COLLECTION_CAP, supportsTwoCommonTeams, validateCommonKeepTeams, canKeepTwoCommonTeams } from '../../shared/common-collection.js';
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

export async function assertCommonCardsRemovable(tx:any,userId:string,ids:number[],ignoreSavedDraft=false) {
  if ((await findBlockedCards(tx,userId,ids,!ignoreSavedDraft)).length)
    throw new Error('A selected card is in a lineup, loan, auction or swap. Remove it from protected use first.');
}

export async function getCommonCollectionPlan(userId:string) {
  const cards=await loadCommonCollection(db,userId);
  const protections=await findBlockedCards(db,userId,cards.map(c=>Number(c.id)));
  const blocked=new Set(protections.filter(row=>row.reason!=='active_lineup').map(row=>Number(row.cardId)));
  const replacementBlocked=new Set(protections.map(row=>Number(row.cardId)));
  const excess=Math.max(0,cards.length-COMMON_COLLECTION_CAP);
  // Use the exact same verified roster as the final reduction, not a stale club label.
  // A provider outage must not mark every owned card ineligible or allow a burn.
  let eligibleIds:Set<number>|null=null;
  if(excess>0) {
    try{eligibleIds=new Set(await currentPremierLeagueMintIds(db));}
    catch(error){console.warn('Common keep roster verification unavailable',error);}
  }
  const annotated=cards.map(card=>({...card,eligible:eligibleIds===null?undefined:eligibleIds.has(Number(card.playerId)),
      blocked:blocked.has(Number(card.id))||Boolean(card.forSale),replacementBlocked:replacementBlocked.has(Number(card.id))||Boolean(card.forSale)}));
  return {cap:COMMON_COLLECTION_CAP,eligibilityVerified:eligibleIds!==null,
    canKeepTwoTeams:eligibleIds===null?null:canKeepTwoCommonTeams(annotated),cards:annotated,excess};
}

export async function reduceCommonCollection(userId:string,raw:unknown, selectKept = false, teamCardIds?: unknown, collectionOnly=false) {
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
    await assertCommonCardsRemovable(tx,userId,ids,true);
    let eligibleIds:Set<number>;
    try{eligibleIds=new Set(await currentPremierLeagueMintIds(tx));}
    catch{throw new Error("Current Premier League eligibility could not be verified. No cards were sacrificed. Recheck player eligibility and try again.");}
    const kept=cards.filter(c=>!ids.includes(Number(c.id))).map(c=>({...c,eligible:eligibleIds.has(Number(c.playerId))}));
    if(collectionOnly) {
      if(!selectKept || teamCardIds !== undefined)throw new Error('Choose exactly ten cards to keep in collection-only mode.');
      const protection=await findBlockedCards(tx,userId,cards.map(c=>Number(c.id)),false);
      const protectedIds=new Set(protection.filter(row=>row.reason!=='active_lineup').map(row=>Number(row.cardId)));
      const annotated=cards.map(c=>({...c,eligible:eligibleIds.has(Number(c.playerId)),blocked:protectedIds.has(Number(c.id))||Boolean(c.forSale)}));
      if(canKeepTwoCommonTeams(annotated))throw new Error('Your collection can form two valid teams. Choose those teams instead. No cards were sacrificed.');
    } else if(teamCardIds !== undefined) {
      const teamError = validateCommonKeepTeams(kept, teamCardIds);
      if(teamError) throw new Error(teamError + ' No cards were sacrificed.');
    }
    if(!collectionOnly&&!supportsTwoCommonTeams(kept))throw new Error('Keep two GK, two DEF, two MID, two FWD and two extra outfield cards, all current Premier League players, for two teams. No cards were sacrificed.');
    // Saved default lineups are drafts, not tournament entries. Remove only
    // discarded IDs from that draft; submitted teams remain protected above.
    const discardedIds=`{${ids.join(',')}}`;
    await tx.execute(sql`
      UPDATE app.lineups SET card_ids=COALESCE((
        SELECT jsonb_agg(draft.value::int ORDER BY draft.ordinality)
        FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(card_ids)='array' THEN card_ids ELSE '[]'::jsonb END)
          WITH ORDINALITY AS draft(value,ordinality)
        WHERE NOT (draft.value::int=ANY(${discardedIds}::int[]))
      ),'[]'::jsonb), captain_id=CASE WHEN captain_id=ANY(${discardedIds}::int[]) THEN NULL ELSE captain_id END
      WHERE user_id=${userId}
    `);
    // Retain historical rows and reward references; sacrifice removes ownership.
    await tx.execute(sql`update app.player_cards set owner_id=null,for_sale=false,price=0 where owner_id=${userId} and id=any(${`{${ids.join(',')}}`}::int[])`);
    await tx.execute(sql`insert into app.audit_logs(user_id,action,meta) values(${userId},'collection.common_limit.sacrificed',${JSON.stringify({cardIds:ids,keptCardIds:kept.map(c=>c.id),teamCardIds:teamCardIds || null,collectionOnly})}::jsonb)`);
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
