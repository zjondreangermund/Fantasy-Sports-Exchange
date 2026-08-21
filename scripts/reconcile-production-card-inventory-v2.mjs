#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;
const FPL_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const FULL_SET_EMAILS = [
  "lbcplaya@gmail.com",
  "joeberber2580@gmail.com",
  "zaylon2580@gmail.com",
  "zjondreangermund@gmail.com",
];
const SUPPLY = { common: 1000, rare: 100, unique: 10, epic: 3, legendary: 1 };
const POSITIONS = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

function rows(result) { return Array.isArray(result?.rows) ? result.rows : []; }
function norm(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function nameOf(element) {
  return `${String(element?.first_name || "").trim()} ${String(element?.second_name || "").trim()}`.trim() || String(element?.web_name || "").trim();
}
function photoOf(element) {
  const code = Number(element?.code || 0);
  return code ? `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png` : null;
}
function overallOf(element) {
  const cost = Number(element?.now_cost || 50) / 10;
  const points = Number(element?.total_points || 0);
  const form = Number(element?.form || 0);
  return Math.max(55, Math.min(95, Math.round(58 + cost * 2.5 + Math.min(12, points / 18) + Math.min(8, form))));
}
function initial3(value) {
  return (String(value || "PLAYER").replace(/[^A-Za-z0-9]+/g, "").slice(0, 3).toUpperCase() || "PLY");
}
function canonicalSerial(playerName, playerId, rarity, number) {
  return `${initial3(playerName)}-${playerId}-${rarity[0].toUpperCase()}-${String(number).padStart(4, "0")}`;
}
async function tableExists(client, qualified) {
  const result = await client.query("select to_regclass($1) as name", [qualified]);
  return Boolean(result.rows?.[0]?.name);
}
async function fetchFpl() {
  const response = await fetch(FPL_URL, { headers: { Accept: "application/json", "User-Agent": "FantasyArena/1.0" }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`FPL bootstrap failed (${response.status})`);
  const body = await response.json();
  const teams = Array.isArray(body?.teams) ? body.teams : [];
  const elements = Array.isArray(body?.elements) ? body.elements : [];
  if (teams.length < 20 || elements.length < 300) throw new Error(`FPL roster incomplete (${teams.length} teams, ${elements.length} players)`);
  return { teams, elements };
}
function add(map, key, value) {
  if (!key) return;
  const list = map.get(key) || [];
  list.push(value);
  map.set(key, list);
}

async function ensurePlayerColumns(client) {
  for (const ddl of [
    "alter table app.players add column if not exists fpl_id integer",
    "alter table app.players add column if not exists code integer",
    "alter table app.players add column if not exists photo text",
    "alter table app.players add column if not exists web_name text",
    "alter table app.players add column if not exists status text",
    "alter table app.players add column if not exists news text",
    "alter table app.players add column if not exists now_cost real",
    "alter table app.players add column if not exists selected_by_percent real",
    "alter table app.players add column if not exists total_points integer",
    "alter table app.players add column if not exists form real",
    "alter table app.players add column if not exists synced_at timestamp",
  ]) await client.query(ddl);
}

async function canonicalizeFplRoster(client, fpl) {
  await ensurePlayerColumns(client);
  const teamById = new Map(fpl.teams.map((team) => [Number(team.id), team]));
  const existing = rows(await client.query(`
    select p.*, coalesce(count(pc.id),0)::int as card_count
    from app.players p left join app.player_cards pc on pc.player_id=p.id
    group by p.id order by p.id
  `));
  const byFpl = new Map(); const byCode = new Map(); const byName = new Map();
  for (const row of existing) {
    add(byFpl, Number(row.fpl_id || 0), row);
    add(byCode, Number(row.code || 0), row);
    add(byName, norm(row.name), row);
    add(byName, norm(row.web_name), row);
  }

  const usedRows = new Set();
  const duplicateMap = new Map();
  const currentIds = new Set();
  const currentFplIds = new Set();
  let inserted = 0; let updated = 0; let duplicateRows = 0;

  for (const element of fpl.elements) {
    const fplId = Number(element?.id || 0); const code = Number(element?.code || 0);
    const playerName = nameOf(element); const webName = String(element?.web_name || playerName).trim();
    const teamName = String(teamById.get(Number(element?.team))?.name || "").trim();
    const position = POSITIONS[Number(element?.element_type)] || "MID";
    if (!fplId || !playerName || !teamName) continue;
    currentFplIds.add(fplId);

    const candidates = new Map();
    const consider = (row, score) => {
      if (!row || usedRows.has(Number(row.id))) return;
      const linked = Number(row.fpl_id || 0);
      if (linked && linked !== fplId) return;
      const prev = candidates.get(Number(row.id));
      if (!prev || score > prev.score) candidates.set(Number(row.id), { row, score });
    };
    for (const row of byFpl.get(fplId) || []) consider(row, 1000);
    for (const row of byCode.get(code) || []) consider(row, 850);
    for (const key of new Set([norm(playerName), norm(webName)].filter(Boolean))) {
      for (const row of byName.get(key) || []) consider(row, norm(row.team) === norm(teamName) ? 700 : 520);
    }
    let ranked = [...candidates.values()].sort((a,b) => b.score-a.score || Number(b.row.card_count||0)-Number(a.row.card_count||0) || Number(a.row.id)-Number(b.row.id));
    let primary = ranked[0]?.row || null;

    if (!primary) {
      const result = await client.query(`
        insert into app.players (name,team,league,position,nationality,age,overall,image_url,fpl_id,code,photo,web_name,status,news,now_cost,selected_by_percent,total_points,form,synced_at)
        values ($1,$2,'Premier League',$3::public.position,'Unknown',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now()) returning id
      `, [
        playerName, teamName, position, Math.max(16,Math.min(45,Number(element?.age||25)||25)), overallOf(element), photoOf(element), fplId, code||null,
        String(element?.photo || code || "") || null, webName, String(element?.status||"a"), String(element?.news||""), Number(element?.now_cost||0)/10,
        Number(element?.selected_by_percent||0), Number(element?.total_points||0), Number(element?.form||0),
      ]);
      primary = { id: Number(result.rows[0].id), card_count: 0 };
      ranked = [{ row: primary, score: 1000 }];
      inserted += 1;
    }

    const primaryId = Number(primary.id);
    usedRows.add(primaryId); currentIds.add(primaryId);
    await client.query(`
      update app.players set name=$1,team=$2,league='Premier League',position=$3::public.position,
        nationality=coalesce(nullif(nationality,''),'Unknown'), age=case when age is null or age<=0 then $4 else age end,
        overall=$5,image_url=$6,fpl_id=$7,code=$8,photo=$9,web_name=$10,status=$11,news=$12,now_cost=$13,
        selected_by_percent=$14,total_points=$15,form=$16,synced_at=now() where id=$17
    `, [
      playerName,teamName,position,Math.max(16,Math.min(45,Number(element?.age||25)||25)),overallOf(element),photoOf(element),fplId,code||null,
      String(element?.photo||code||"")||null,webName,String(element?.status||"a"),String(element?.news||""),Number(element?.now_cost||0)/10,
      Number(element?.selected_by_percent||0),Number(element?.total_points||0),Number(element?.form||0),primaryId,
    ]);
    updated += 1;

    for (const item of ranked.slice(1)) {
      const sourceId = Number(item.row.id);
      if (!sourceId || sourceId===primaryId || usedRows.has(sourceId)) continue;
      duplicateMap.set(sourceId, primaryId); usedRows.add(sourceId); duplicateRows += 1;
    }
  }

  // Anything outside the canonical current FPL roster is not an active EPL player record.
  const canonicalIds = [...currentIds];
  if (canonicalIds.length) {
    await client.query(`
      update app.players set
        league=case when fpl_id is not null then 'Outside Premier League' else 'Legacy / Non-current' end,
        status=case when fpl_id is not null then 'departed' else 'unlinked' end,
        synced_at=now()
      where not (id = any($1::int[])) and id not in (select source_id from (select unnest($2::int[]) as source_id) q)
    `, [canonicalIds, [...duplicateMap.keys()]]);
  }
  return { duplicateMap, currentIds, currentFplIds, inserted, updated, duplicateRows };
}

async function protectCardIds(client, targetUsers) {
  const protectedIds = new Set(); const reason = new Map();
  const protect = (id, why) => {
    const n = Number(id||0); if (!n) return;
    protectedIds.add(n); const list = reason.get(n)||[]; if (!list.includes(why)) list.push(why); reason.set(n,list);
  };

  const fks = rows(await client.query(`
    select tc.table_schema,tc.table_name,kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema
    where tc.constraint_type='FOREIGN KEY' and ccu.table_schema='app' and ccu.table_name='player_cards' and ccu.column_name='id'
  `));
  for (const fk of fks) {
    if (fk.table_schema === "app" && fk.table_name === "lineups") continue;
    const schema=String(fk.table_schema).replace(/"/g,'""'); const table=String(fk.table_name).replace(/"/g,'""'); const column=String(fk.column_name).replace(/"/g,'""');
    for (const row of rows(await client.query(`select distinct "${column}"::bigint as id from "${schema}"."${table}" where "${column}" is not null`))) protect(row.id,`fk:${schema}.${table}.${column}`);
  }

  if (await tableExists(client,"app.competition_entries")) {
    for (const row of rows(await client.query(`select distinct value::bigint as id from app.competition_entries ce,lateral jsonb_array_elements_text(coalesce(ce.lineup_card_ids,'[]'::jsonb)) value where value ~ '^[0-9]+$'`))) protect(row.id,"competition-lineup-history");
  }
  if (await tableExists(client,"app.audit_logs")) {
    for (const row of rows(await client.query(`select distinct (meta->>'cardId')::bigint as id from app.audit_logs where meta ? 'cardId' and (meta->>'cardId') ~ '^[0-9]+$'`))) protect(row.id,"audit-history");
  }
  if (await tableExists(client,"app.transactions")) {
    for (const row of rows(await client.query(`select distinct (regexp_match(coalesce(description,''),'card:([0-9]+)'))[1]::bigint as id from app.transactions where coalesce(description,'') ~ 'card:[0-9]+'`))) protect(row.id,"wallet-trade-history");
  }
  if (await tableExists(client,"app.user_onboarding")) {
    for (const user of targetUsers) {
      const ob=rows(await client.query(`select selected_cards from app.user_onboarding where user_id=$1 limit 1`,[user.id]))[0];
      const selected=Array.isArray(ob?.selected_cards)?ob.selected_cards.map(Number).filter(n=>n>0):[];
      for (const playerId of selected) {
        const card=rows(await client.query(`select id from app.player_cards where owner_id=$1 and player_id=$2 and rarity::text='common' order by acquired_at asc nulls last,id asc limit 1`,[user.id,playerId]))[0];
        if (card?.id) protect(card.id,"signup-card");
      }
    }
  }
  return { protectedIds, reason };
}

async function rewriteLineupWithout(client,userId,removeIds) {
  if (!(await tableExists(client,"app.lineups")) || !removeIds.size) return false;
  const row=rows(await client.query(`select id,card_ids,captain_id from app.lineups where user_id=$1 limit 1`,[userId]))[0];
  if (!row) return false;
  const current=Array.isArray(row.card_ids)?row.card_ids.map(Number).filter(n=>n>0):[];
  const next=current.filter(id=>!removeIds.has(id));
  const captain=Number(row.captain_id||0); const nextCaptain=captain&&!removeIds.has(captain)?captain:(next[0]||null);
  if (next.length===current.length && nextCaptain===(captain||null)) return false;
  await client.query(`update app.lineups set card_ids=$1::jsonb,captain_id=$2 where id=$3`,[JSON.stringify(next),nextCaptain,Number(row.id)]);
  return true;
}

async function removeFullSetTestCards(client) {
  const users=rows(await client.query(`select id,lower(coalesce(email,'')) as email from app.users where lower(coalesce(email,''))=any($1::text[])`,[FULL_SET_EMAILS]));
  if (!users.length) return { users:0, removed:0, affectedPairs:new Set(), summaries:[], lineupsRewritten:0 };
  const { protectedIds }=await protectCardIds(client,users);
  const affectedPairs=new Set(); let removed=0; let lineupsRewritten=0; const summaries=[];

  for (const user of users) {
    const cards=rows(await client.query(`select pc.id,pc.player_id,pc.rarity::text as rarity from app.player_cards pc where pc.owner_id=$1 order by pc.id`,[user.id]));
    const candidates=cards.filter(card=>!protectedIds.has(Number(card.id)));
    const removeIds=new Set(candidates.map(card=>Number(card.id)));
    if (await rewriteLineupWithout(client,user.id,removeIds)) lineupsRewritten+=1;
    let userRemoved=0; let blocked=0;
    for (const card of candidates) {
      await client.query("savepoint remove_test_card");
      try {
        const result=await client.query(`delete from app.player_cards where id=$1 and owner_id=$2 returning id`,[Number(card.id),user.id]);
        if (result.rowCount) { removed+=1; userRemoved+=1; affectedPairs.add(`${Number(card.player_id)}:${String(card.rarity)}`); }
        await client.query("release savepoint remove_test_card");
      } catch {
        await client.query("rollback to savepoint remove_test_card"); await client.query("release savepoint remove_test_card"); blocked+=1;
      }
    }
    summaries.push({email:user.email,cardsBefore:cards.length,removed:userRemoved,kept:cards.length-userRemoved,blocked});
  }
  return {users:users.length,removed,affectedPairs,summaries,lineupsRewritten};
}

async function migrateDuplicatePlayerCards(client,duplicateMap,affectedPairs) {
  await client.query(`drop trigger if exists player_cards_mint_identity_guard on app.player_cards`);
  await client.query(`drop trigger if exists player_cards_serial_supply_guard on app.player_cards`);
  let cardsMigrated=0; let rowsSuperseded=0;
  for (const [sourceId,targetId] of duplicateMap.entries()) {
    for (const card of rows(await client.query(`select rarity::text as rarity from app.player_cards where player_id=$1`,[sourceId]))) {
      affectedPairs.add(`${sourceId}:${card.rarity}`); affectedPairs.add(`${targetId}:${card.rarity}`);
    }
    const result=await client.query(`update app.player_cards set player_id=$1,serial_id=null,serial_number=null,max_supply=0 where player_id=$2`,[targetId,sourceId]);
    cardsMigrated+=Number(result.rowCount||0);
    await client.query(`update app.players set league='Legacy Duplicate',status='superseded',news='Merged into the current Premier League player identity.',synced_at=now() where id=$1`,[sourceId]);
    rowsSuperseded+=1;
  }
  return {cardsMigrated,rowsSuperseded};
}

async function repairAffectedSerials(client,affectedPairs) {
  await client.query(`drop trigger if exists player_cards_mint_identity_guard on app.player_cards`);
  await client.query(`drop trigger if exists player_cards_serial_supply_guard on app.player_cards`);
  for (const row of rows(await client.query(`
    select distinct player_id,rarity::text as rarity from app.player_cards
    where serial_number is null or serial_number<=0 or coalesce(serial_id,'')=''
       or serial_number>case rarity::text when 'common' then 1000 when 'rare' then 100 when 'unique' then 10 when 'epic' then 3 when 'legendary' then 1 else 0 end
  `))) affectedPairs.add(`${Number(row.player_id)}:${String(row.rarity)}`);

  let repaired=0;
  for (const key of affectedPairs) {
    const [playerText,rarity]=String(key).split(":"); const playerId=Number(playerText); const cap=SUPPLY[rarity]; if (!playerId||!cap) continue;
    const player=rows(await client.query(`select name from app.players where id=$1 limit 1`,[playerId]))[0]; if (!player) continue;
    const cards=rows(await client.query(`select id,serial_number from app.player_cards where player_id=$1 and rarity::text=$2 order by id`,[playerId,rarity]));
    if (cards.length>cap) throw new Error(`Supply cap exceeded after test-card cleanup for player ${playerId} ${rarity}: ${cards.length}/${cap}`);
    const used=new Set(); const assignment=new Map();
    for (const card of cards) {
      const n=Number(card.serial_number||0);
      if (n>0&&n<=cap&&!used.has(n)) { used.add(n); assignment.set(Number(card.id),n); }
    }
    let cursor=1;
    for (const card of cards) {
      const id=Number(card.id); if (assignment.has(id)) continue;
      while (used.has(cursor)&&cursor<=cap) cursor+=1;
      if (cursor>cap) throw new Error(`No serial available for player ${playerId} ${rarity}`);
      assignment.set(id,cursor); used.add(cursor); cursor+=1;
    }
    await client.query(`update app.player_cards set serial_id=null where player_id=$1 and rarity::text=$2`,[playerId,rarity]);
    for (const card of cards) {
      const id=Number(card.id); const number=assignment.get(id); const serialId=canonicalSerial(player.name,playerId,rarity,number);
      await client.query(`update app.player_cards set serial_number=$1,serial_id=$2,max_supply=$3 where id=$4`,[number,serialId,cap,id]); repaired+=1;
    }
    if (await tableExists(client,"app.player_card_serial_counters")) {
      const maxNumber=cards.length?Math.max(...[...assignment.values()]):0;
      await client.query(`insert into app.player_card_serial_counters(player_id,rarity,last_serial_number,max_supply,updated_at) values($1,$2,$3,$4,now()) on conflict(player_id,rarity) do update set last_serial_number=excluded.last_serial_number,max_supply=excluded.max_supply,updated_at=now()`,[playerId,rarity,maxNumber,cap]);
    }
  }
  return repaired;
}

async function applyApiFootballPortraits(client) {
  if (!(await tableExists(client,"app.api_football_players"))) return {directory:0,linkedPlayers:0,linkedOwnedCards:0,season:null};
  const season=Number(rows(await client.query(`select max(season)::int as season from app.api_football_players where active=true`))[0]?.season||0);
  if (!season) return {directory:0,linkedPlayers:0,linkedOwnedCards:0,season:null};
  const directory=rows(await client.query(`select api_player_id,name,team_name,position,photo,nationality from app.api_football_players where season=$1 and active=true`,[season]));
  const byName=new Map(); for (const item of directory) add(byName,norm(item.name),item);
  const current=rows(await client.query(`select id,name,team,position::text as position from app.players where lower(league)='premier league' and fpl_id is not null`));
  let linkedPlayers=0; let linkedOwnedCards=0;
  for (const player of current) {
    const matches=(byName.get(norm(player.name))||[]).filter(item=>norm(item.team_name)===norm(player.team));
    if (matches.length!==1) continue;
    const match=matches[0]; const photo=String(match.photo||"").trim();
    if (photo) await client.query(`update app.players set image_url=$1,nationality=coalesce(nullif($2,''),nationality),synced_at=now() where id=$3`,[photo,String(match.nationality||""),Number(player.id)]);
    linkedPlayers+=1;
    linkedOwnedCards+=Number(rows(await client.query(`select count(*)::int as count from app.player_cards where player_id=$1 and owner_id is not null`,[Number(player.id)]))[0]?.count||0);
  }
  return {directory:directory.length,linkedPlayers,linkedOwnedCards,season};
}

async function audit(client) {
  const counts=rows(await client.query(`
    select
      count(*) filter(where pc.owner_id is not null)::int as owned_cards,
      count(*) filter(where pc.owner_id is not null and lower(p.league)='premier league' and p.fpl_id is not null)::int as current_epl_cards,
      count(*) filter(where pc.owner_id is not null and not(lower(p.league)='premier league' and p.fpl_id is not null))::int as historical_or_unlinked_cards,
      count(*) filter(where pc.owner_id is not null and (pc.serial_number is null or pc.serial_number<=0 or coalesce(pc.serial_id,'')=''))::int as missing_serials,
      count(*) filter(where pc.owner_id is not null and lower(p.league)='premier league' and p.fpl_id is not null and coalesce(p.image_url,'')='')::int as current_epl_missing_images
    from app.player_cards pc join app.players p on p.id=pc.player_id
  `))[0]||{};
  const unresolved=rows(await client.query(`select p.id,p.name,p.team,p.league,p.fpl_id,count(pc.id)::int as owned_cards from app.players p join app.player_cards pc on pc.player_id=p.id where pc.owner_id is not null and not(lower(p.league)='premier league' and p.fpl_id is not null) group by p.id order by count(pc.id) desc,p.name limit 50`));
  return {...counts,unresolved};
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client=new Client({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:undefined});
  await client.connect();
  if (!(await tableExists(client,"app.players")) || !(await tableExists(client,"app.player_cards"))) {
    console.log("[card-reconcile] Core player/card tables do not exist yet; skipping until schema creation completes."); await client.end(); return;
  }
  let fpl;
  try { fpl=await fetchFpl(); }
  catch(error) { console.warn(`[card-reconcile] ${String(error?.message||error)}. No destructive card cleanup was performed.`); await client.end(); return; }

  try {
    await client.query("begin"); await client.query(`select pg_advisory_xact_lock(hashtext('fantasy-arena:epl-card-inventory-v2'))`);
    const roster=await canonicalizeFplRoster(client,fpl);
    const cleanup=await removeFullSetTestCards(client);
    const migration=await migrateDuplicatePlayerCards(client,roster.duplicateMap,cleanup.affectedPairs);
    const serialsRepaired=await repairAffectedSerials(client,cleanup.affectedPairs);
    const apiFootball=await applyApiFootballPortraits(client);
    await client.query(`update app.player_cards pc set for_sale=false,price=0 from app.players p where p.id=pc.player_id and pc.owner_id is not null and not(lower(p.league)='premier league' and p.fpl_id is not null)`);
    const inventory=await audit(client);
    await client.query("commit");
    console.log(JSON.stringify({success:true,officialRoster:{teams:fpl.teams.length,players:fpl.elements.length},roster:{inserted:roster.inserted,updated:roster.updated,duplicateRows:roster.duplicateRows},fullSetCleanup:{targetUsers:cleanup.users,removedCards:cleanup.removed,lineupsRewritten:cleanup.lineupsRewritten,summaries:cleanup.summaries},duplicateMigration:migration,serialsRepaired,apiFootball,inventory,note:"Signup, prize, replacement, reward, referral, trade/auction and tournament-history referenced cards are preserved. Remaining historical/non-current cards are retained but not saleable. The standard startup serial preflight runs next for every other legacy card."},null,2));
  } catch(error) { await client.query("rollback").catch(()=>undefined); throw error; }
  finally { await client.end(); }
}

main().catch(error=>{console.error("Production EPL/card reconciliation failed:",error);process.exit(1);});
