#!/usr/bin/env node
import fs from "node:fs";

const file = "scripts/reconcile-production-card-inventory-v2.mjs";
const marker = "LEGACY_SUPPLY_OVERFLOW_RECOVERY_V1";
const d = "$";
let source = fs.readFileSync(file, "utf8");

if (source.includes(marker)) {
  console.log("Legacy supply overflow recovery already applied.");
  process.exit(0);
}

const helperAnchor = "async function repairAffectedSerials(client,affectedPairs) {";
if (!source.includes(helperAnchor)) throw new Error("Reconciliation overflow patch anchor not found: repairAffectedSerials");

const helper = `// LEGACY_SUPPLY_OVERFLOW_RECOVERY_V1
function strongCardProvenance(reasons) {
  const values = Array.isArray(reasons) ? reasons.map((value) => String(value || "").toLowerCase()) : [];
  return values.some((value) =>
    value === "signup-card" ||
    value === "wallet-trade-history" ||
    (value.startsWith("fk:") && /(prize|reward|referral|replacement|auction|market|loan|swap|forge)/.test(value))
  );
}

async function ensureSupplyArchivePlayer(client,sourcePlayerId,cardId) {
  const archiveFplId = -Math.max(1,Number(cardId||0));
  const existing = rows(await client.query(\`select id from app.players where fpl_id=$1 limit 1\`,[archiveFplId]))[0];
  if (existing?.id) return Number(existing.id);
  const inserted = rows(await client.query(\`
    insert into app.players (
      name,team,league,position,nationality,age,overall,image_url,fpl_id,code,photo,web_name,status,news,
      now_cost,selected_by_percent,total_points,form,synced_at
    )
    select
      name,team,'Legacy / Supply Archive',position,nationality,age,overall,image_url,$2,null,photo,web_name,'archived',
      concat_ws(' ',nullif(news,''),'Historical card preserved during legacy supply repair; excluded from active Premier League mint supply.'),
      now_cost,selected_by_percent,total_points,form,now()
    from app.players where id=$1
    returning id
  \`,[Number(sourcePlayerId),archiveFplId]))[0];
  if (!inserted?.id) throw new Error(\`Could not create legacy supply archive for card ${d}{cardId}\`);
  return Number(inserted.id);
}

async function resolveSupplyOverflow(client,playerId,rarity,cap) {
  const targetUsers = rows(await client.query(\`
    select id,lower(coalesce(email,'')) as email
    from app.users
    where lower(coalesce(email,''))=any($1::text[])
  \`,[FULL_SET_EMAILS]));
  const targetEmailById = new Map(targetUsers.map((user)=>[String(user.id),String(user.email||'').toLowerCase()]));
  const protection = await protectCardIds(client,targetUsers);
  const details = rows(await client.query(\`
    select pc.id,pc.owner_id,pc.serial_number,pc.serial_id,pc.acquired_at,lower(coalesce(u.email,'')) as email
    from app.player_cards pc
    left join app.users u on u.id=pc.owner_id
    where pc.player_id=$1 and pc.rarity::text=$2
    order by pc.id asc
  \`,[playerId,rarity]));

  if (details.length<=cap) return { archived:0, removedFromTestUsers:0, preservedHistorical:0 };

  const ranked = details.map((card)=>{
    const ownerId = card.owner_id==null ? '' : String(card.owner_id);
    const email = String(card.email||targetEmailById.get(ownerId)||'').toLowerCase();
    const knownTestUser = FULL_SET_EMAILS.includes(email);
    const reasons = protection.reason.get(Number(card.id)) || [];
    const strong = strongCardProvenance(reasons);
    const serial = Number(card.serial_number||0);
    const validSerial = serial>0 && serial<=cap && String(card.serial_id||'').trim()!=='';
    let score = 0;
    if (ownerId && !knownTestUser) score += 1400;
    else if (strong) score += 1200;
    else if (ownerId) score += 250;
    else score += 50;
    if (validSerial) score += 120;
    return { card, ownerId, email, knownTestUser, reasons, strong, score };
  }).sort((a,b)=>b.score-a.score || Number(a.card.id)-Number(b.card.id));

  const keepIds = new Set(ranked.slice(0,cap).map((item)=>Number(item.card.id)));
  const overflow = ranked.filter((item)=>!keepIds.has(Number(item.card.id)));
  let archived=0; let removedFromTestUsers=0; let preservedHistorical=0;

  for (const item of overflow) {
    const cardId = Number(item.card.id);
    const archivePlayerId = await ensureSupplyArchivePlayer(client,playerId,cardId);
    const removeOwnership = item.knownTestUser && !item.strong;
    if (removeOwnership && item.ownerId) {
      await rewriteLineupWithout(client,item.ownerId,new Set([cardId]));
    }
    await client.query(\`
      update app.player_cards
      set player_id=$1,
          owner_id=case when $2::boolean then null else owner_id end,
          serial_id=null,serial_number=null,max_supply=0,for_sale=false,price=0
      where id=$3
    \`,[archivePlayerId,removeOwnership,cardId]);
    archived+=1;
    if (removeOwnership) removedFromTestUsers+=1; else preservedHistorical+=1;
    console.warn(\`[card-reconcile] Archived overflow ${d}{rarity} card ${d}{cardId} from player ${d}{playerId}; ownership ${d}{removeOwnership?'removed from legacy full-set user':'preserved as historical'}; provenance=${d}{item.reasons.join(',')||'none'}\`);
  }

  return { archived,removedFromTestUsers,preservedHistorical };
}

`;
source = source.replace(helperAnchor, `${helper}${helperAnchor}`);

const oldBlock = `    const cards=rows(await client.query(\`select id,serial_number from app.player_cards where player_id=$1 and rarity::text=$2 order by id\`,[playerId,rarity]));
    if (cards.length>cap) throw new Error(\`Supply cap exceeded after test-card cleanup for player ${d}{playerId} ${d}{rarity}: ${d}{cards.length}/${d}{cap}\`);`;
const newBlock = `    let cards=rows(await client.query(\`select id,serial_number from app.player_cards where player_id=$1 and rarity::text=$2 order by id\`,[playerId,rarity]));
    if (cards.length>cap) {
      const overflow=await resolveSupplyOverflow(client,playerId,rarity,cap);
      console.warn(\`[card-reconcile] Resolved supply overflow for player ${d}{playerId} ${d}{rarity}: archived=${d}{overflow.archived}, removedFromTestUsers=${d}{overflow.removedFromTestUsers}, preservedHistorical=${d}{overflow.preservedHistorical}\`);
      cards=rows(await client.query(\`select id,serial_number from app.player_cards where player_id=$1 and rarity::text=$2 order by id\`,[playerId,rarity]));
      if (cards.length>cap) throw new Error(\`Supply cap still exceeded after overflow recovery for player ${d}{playerId} ${d}{rarity}: ${d}{cards.length}/${d}{cap}\`);
    }`;
if (!source.includes(oldBlock)) throw new Error("Reconciliation overflow patch anchor not found: supply cap failure block");
source = source.replace(oldBlock,newBlock);

fs.writeFileSync(file,source);
console.log("Applied legacy supply overflow recovery to production card reconciliation.");
