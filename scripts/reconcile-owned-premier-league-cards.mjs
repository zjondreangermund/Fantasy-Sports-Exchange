#!/usr/bin/env node
import { randomInt } from "node:crypto";
import pg from "pg";
import {
  buildFplPlayerIndex,
  normalizePlayerText,
  strongPlayerNameMatch,
} from "../dist/server/server/services/fplPlayerIdentity.js";

const { Client } = pg;
const LOCK_KEY = "fantasy-arena:owned-premier-league-card-eligibility-v1";
const SUPPLY_BY_RARITY = { common: 1000, rare: 100, unique: 10, epic: 3, legendary: 1 };
const CURRENT_SEASON = new Date().getUTCMonth() >= 6
  ? new Date().getUTCFullYear()
  : new Date().getUTCFullYear() - 1;

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function positionOf(value) {
  const normalized = String(value || "").toUpperCase();
  return ["GK", "DEF", "MID", "FWD"].includes(normalized) ? normalized : "";
}

function compatibleNames(left, right) {
  if (strongPlayerNameMatch(left, right)) return true;
  const source = normalizePlayerText(left).split(" ").filter(Boolean);
  const candidate = normalizePlayerText(right).split(" ").filter(Boolean);
  if (source.length < 2 || candidate.length < 2) return false;
  if (source[0][0] !== candidate[0][0]) return false;
  return source.slice(1).some((surname) => surname.length > 2 && candidate.slice(1).includes(surname));
}

function directoryMatch(player, directory) {
  const sourceNames = [player?.name, player?.webName, player?.web_name].filter(Boolean);
  const sourceTeam = normalizePlayerText(player?.team);
  const sourcePosition = positionOf(player?.position);
  const matches = directory.filter((candidate) => {
    if (sourcePosition && sourcePosition !== candidate.position) return false;
    const aliases = [candidate.name, `${candidate.firstName} ${candidate.lastName}`].filter(Boolean);
    return sourceNames.some((name) => aliases.some((alias) => compatibleNames(name, alias)));
  });
  if (matches.length === 1) return matches[0];
  const sameTeam = matches.filter((candidate) => normalizePlayerText(candidate.team) === sourceTeam);
  return sameTeam.length === 1 ? sameTeam[0] : null;
}

async function currentFplBootstrap() {
  const response = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/", {
    headers: { "user-agent": "Mozilla/5.0 FantasyArena/1.0" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Official FPL roster request failed: HTTP ${response.status}`);
  const bootstrap = await response.json();
  if (!Array.isArray(bootstrap?.elements) || bootstrap.elements.length < 300
      || !Array.isArray(bootstrap?.teams) || bootstrap.teams.length !== 20) {
    throw new Error("Official FPL roster is incomplete; refusing to change player eligibility or mint replacements");
  }
  return bootstrap;
}

async function loadCurrentDirectory(client) {
  const table = rows(await client.query("select to_regclass('app.api_football_players') as name"))[0]?.name;
  if (!table) return [];
  return rows(await client.query(`
    select api_player_id as "apiPlayerId", api_team_id as "apiTeamId",
      name, coalesce(first_name,'') as "firstName", coalesce(last_name,'') as "lastName",
      team_name as team, coalesce(position,'MID') as position
    from app.api_football_players
    where season=$1 and active=true
  `, [CURRENT_SEASON])).map((player) => ({
    ...player,
    apiPlayerId: Number(player.apiPlayerId || 0),
    apiTeamId: Number(player.apiTeamId || 0),
    position: positionOf(player.position),
  })).filter((player) => player.position && player.apiPlayerId);
}

async function ensureReplacementLedger(client) {
  await client.query(`
    create table if not exists app.departed_player_card_replacements (
      source_card_id integer primary key references app.player_cards(id),
      replacement_card_id integer not null unique references app.player_cards(id),
      user_id varchar(255) not null references app.users(id),
      source_player_id integer not null references app.players(id),
      replacement_player_id integer not null references app.players(id),
      position text not null,
      rarity text not null,
      created_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create index if not exists departed_player_card_replacements_user_idx
    on app.departed_player_card_replacements(user_id,created_at desc)
  `);
}

async function repairActivePlayer(client, playerId, identity, element) {
  const canonicalPosition = positionOf(identity.position);
  if (!canonicalPosition) throw new Error(`Invalid official position for player ${playerId}`);
  const requestedFplId = element ? Number(element.id || 0) || null : null;
  const requestedCode = element ? Number(element.code || 0) || null : null;
  const providerConflicts = rows(await client.query(`
    select fpl_id,code from app.players
    where id<>$3 and (($1::integer is not null and fpl_id=$1::integer)
      or ($2::integer is not null and code=$2::integer))
  `, [requestedFplId, requestedCode, playerId]));
  const usableFplId = providerConflicts.some((player) => Number(player.fpl_id || 0) === requestedFplId)
    ? null
    : requestedFplId;
  const usableCode = providerConflicts.some((player) => Number(player.code || 0) === requestedCode)
    ? null
    : requestedCode;
  const updated = await client.query(`
    update app.players
    set name=$2, team=$3, league='Premier League', position=$4::public.position,
      fpl_id=coalesce($5::integer,fpl_id), code=coalesce($6::integer,code),
      web_name=coalesce($7::text,web_name), status=$8, news=$9, synced_at=now()
    where id=$1
      and (
        name is distinct from $2 or team is distinct from $3
        or league is distinct from 'Premier League'
        or position::text is distinct from $4
        or ($5::integer is not null and fpl_id is distinct from $5::integer)
        or ($6::integer is not null and code is distinct from $6::integer)
        or ($7::text is not null and web_name is distinct from $7::text)
        or status is distinct from $8 or news is distinct from $9
      )
  `, [
    playerId,
    String(identity.name || "").trim(),
    String(identity.team || "").trim(),
    canonicalPosition,
    usableFplId,
    usableCode,
    element ? String(element.web_name || identity.name || "").trim() || null : null,
    element ? String(element.status || "a") : "a",
    element ? String(element.news || "") : "",
  ]);
  return Number(updated.rowCount || 0);
}

async function randomEligibleReplacement(client, card, fplIndex, directory) {
  const supplyLimit = Number(SUPPLY_BY_RARITY[card.rarity] || 0);
  if (!supplyLimit) throw new Error(`Unsupported rarity ${card.rarity} for card ${card.cardId}`);
  const candidates = rows(await client.query(`
    select p.id,p.name,p.team,p.league,p.position::text as position,
      p.fpl_id,p.code,p.web_name
    from app.players p
    left join app.player_card_serial_counters counter
      on counter.player_id=p.id and counter.rarity=$3
    where p.position=$2::public.position
      and p.league='Premier League'
      and coalesce(counter.last_serial_number,0)<$4
      and not exists (
        select 1 from app.player_cards owned
        where owned.owner_id=$1 and owned.player_id=p.id
      )
    order by random()
    limit 80
  `, [card.ownerId, card.position, card.rarity, supplyLimit]));

  const verified = candidates.map((candidate) => {
    const element = fplIndex.resolve(candidate);
    const canonical = element ? fplIndex.canonical(element) : null;
    const apiPlayer = directoryMatch({ ...candidate, ...(canonical || {}) }, directory);
    if (!element && !apiPlayer) return null;
    const identity = apiPlayer || canonical;
    if (positionOf(identity?.position) !== card.position) return null;
      return { candidate, identity, element };
  }).filter(Boolean);

  if (!verified.length) {
    throw new Error(`No verified Premier League ${card.position} replacement is available for card ${card.cardId}`);
  }
  return verified[randomInt(verified.length)];
}

async function replaceDepartedCard(client, card, fplIndex, directory) {
  const previous = rows(await client.query(`
    select replacement_card_id as "replacementCardId"
    from app.departed_player_card_replacements where source_card_id=$1
  `, [card.cardId]))[0];
  if (previous?.replacementCardId) return { minted: false, cardId: Number(previous.replacementCardId) };

  const replacement = await randomEligibleReplacement(client, card, fplIndex, directory);
  await repairActivePlayer(client, Number(replacement.candidate.id), replacement.identity, replacement.element);
  const minted = rows(await client.query(`
    insert into app.player_cards
      (player_id,owner_id,rarity,level,xp,decisive_score,for_sale,price)
    values ($1,$2,$3::public.rarity,1,0,35,false,0)
    returning id,serial_id as "serialId"
  `, [replacement.candidate.id, card.ownerId, card.rarity]))[0];
  if (!minted?.id) throw new Error(`Could not mint replacement for departed card ${card.cardId}`);

  await client.query(`
    insert into app.departed_player_card_replacements
      (source_card_id,replacement_card_id,user_id,source_player_id,replacement_player_id,position,rarity)
    values ($1,$2,$3,$4,$5,$6,$7)
  `, [card.cardId, minted.id, card.ownerId, card.playerId, replacement.candidate.id, card.position, card.rarity]);

  const lineup = rows(await client.query(`
    select card_ids as "cardIds",captain_id as "captainId"
    from app.lineups where user_id=$1 for update
  `, [card.ownerId]))[0];
  if (Array.isArray(lineup?.cardIds) && lineup.cardIds.some((id) => Number(id) === card.cardId)) {
    const nextCardIds = lineup.cardIds.map((id) => Number(id) === card.cardId ? Number(minted.id) : Number(id));
    const nextCaptain = Number(lineup.captainId || 0) === card.cardId ? Number(minted.id) : Number(lineup.captainId || 0) || null;
    await client.query(`
      update app.lineups set card_ids=$2::jsonb,captain_id=$3 where user_id=$1
    `, [card.ownerId, JSON.stringify(nextCardIds), nextCaptain]);
  }

  const message = `${card.name} is no longer in the Premier League. A ${String(card.rarity).toUpperCase()} ${card.position} replacement, ${replacement.identity.name} (${replacement.identity.team}), has been added to your collection.`;
  await client.query(`
    insert into app.notifications (user_id,type,title,message,read)
    values ($1,'system','Premier League player replaced',$2,false)
  `, [card.ownerId, message]);
  await client.query(`
    insert into app.audit_logs (user_id,action,meta)
    values ($1,'system.departed_premier_league_card_replaced',$2::jsonb)
  `, [card.ownerId, JSON.stringify({
    sourceCardId: card.cardId,
    sourcePlayerId: card.playerId,
    sourcePlayerName: card.name,
    replacementCardId: Number(minted.id),
    replacementPlayerId: Number(replacement.candidate.id),
    replacementPlayerName: replacement.identity.name,
    position: card.position,
    rarity: card.rarity,
    preservedOriginalCard: true,
  })]);

  console.log(
    `PREMIER_LEAGUE_CARD_REPLACED email=${card.email} sourceCard=${card.cardId}`
    + ` departed="${card.name}" replacementCard=${minted.id}`
    + ` replacement="${replacement.identity.name}" position=${card.position}`
    + ` rarity=${card.rarity} originalPreserved=true`,
  );
  return { minted: true, cardId: Number(minted.id) };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const bootstrap = await currentFplBootstrap();
  const fplIndex = buildFplPlayerIndex(bootstrap);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [LOCK_KEY]);
    await ensureReplacementLedger(client);
    const directory = await loadCurrentDirectory(client);
    const directoryTeams = new Set(directory.map((player) => player.apiTeamId)).size;
    const dualSourceHealthy = directory.length >= 250 && directoryTeams >= 15;
    const owned = rows(await client.query(`
      select pc.id as "cardId",pc.player_id as "playerId",pc.owner_id as "ownerId",
        pc.rarity::text as rarity,lower(coalesce(u.email,'')) as email,
        p.name,p.team,p.league,p.position::text as position,p.fpl_id,p.code,p.web_name,p.status
      from app.player_cards pc
      join app.users u on u.id=pc.owner_id
      join app.players p on p.id=pc.player_id
      where pc.owner_id is not null
      order by pc.id
      for update of pc
    `)).map((card) => ({
      ...card,
      cardId: Number(card.cardId),
      playerId: Number(card.playerId),
      position: positionOf(card.position),
    }));

    const classified = owned.map((card) => {
      const element = fplIndex.resolve(card);
      const canonical = element ? fplIndex.canonical(element) : null;
      const apiPlayer = directoryMatch({ ...card, ...(canonical || {}) }, directory);
      return { card, element, canonical, apiPlayer, active: Boolean(element || apiPlayer) };
    });
    const departed = classified.filter((item) => !item.active);
    const suspiciousDepartureCount = departed.length > 60
      || (owned.length >= 10 && departed.length / owned.length > 0.45);

    let repaired = 0;
    const updatedPlayerIds = new Set();
    for (const item of classified.filter((candidate) => candidate.active)) {
      if (updatedPlayerIds.has(item.card.playerId)) continue;
      repaired += await repairActivePlayer(
        client,
        item.card.playerId,
        item.apiPlayer || item.canonical,
        item.element,
      );
      updatedPlayerIds.add(item.card.playerId);
      if (["zjondreangermund@gmail.com", "zaylon2018@gmail.com"].includes(item.card.email)
          || /fernandes|mart[ií]nez|romero/i.test(item.card.name)) {
        const identity = item.apiPlayer || item.canonical;
        console.log(`PREMIER_LEAGUE_CARD_LINKED email=${item.card.email} card=${item.card.cardId} player="${identity.name}" team="${identity.team}" position=${identity.position} league="Premier League"`);
      }
    }

    let marked = 0;
    let minted = 0;
    let replacementErrors = 0;
    if (!dualSourceHealthy || suspiciousDepartureCount) {
      console.warn(
        `PREMIER_LEAGUE_REPLACEMENT_GUARD reason=${!dualSourceHealthy ? "api-football-directory-incomplete" : "unusually-many-unmatched-cards"}`
        + ` directoryPlayers=${directory.length} directoryTeams=${directoryTeams}`
        + ` unmatched=${departed.length} owned=${owned.length}; original cards preserved and no replacements minted`,
      );
    } else {
      for (const item of departed) {
        if (!item.card.position) continue;
        await client.query("savepoint departed_card_replacement");
        try {
          const departureMessage = `${item.card.name} is no longer listed in a current Premier League squad.`;
          const changed = await client.query(`
            update app.players
            set league='Outside Premier League',status='departed',news=$2,synced_at=now()
            where id=$1
              and (league is distinct from 'Outside Premier League'
                   or status is distinct from 'departed' or news is distinct from $2)
          `, [item.card.playerId, departureMessage]);
          const result = await replaceDepartedCard(client, item.card, fplIndex, directory);
          marked += Number(changed.rowCount || 0);
          if (result.minted) minted += 1;
          await client.query("release savepoint departed_card_replacement");
        } catch (error) {
          await client.query("rollback to savepoint departed_card_replacement");
          await client.query("release savepoint departed_card_replacement");
          replacementErrors += 1;
          console.warn(`PREMIER_LEAGUE_CARD_REPLACEMENT_SKIPPED email=${item.card.email} card=${item.card.cardId} reason=${String(error?.message || error)}`);
        }
      }
    }

    await client.query("commit");
    console.log(
      `PREMIER_LEAGUE_CARD_ELIGIBILITY_SUMMARY fplPlayers=${fplIndex.elements.length}`
      + ` apiPlayers=${directory.length} apiTeams=${directoryTeams} ownedCards=${owned.length}`
      + ` linkedPlayers=${repaired} departedCards=${departed.length}`
      + ` apiLinked=${classified.filter((item) => item.apiPlayer).length}`
      + ` fplFallback=${classified.filter((item) => !item.apiPlayer && item.element).length}`
      + ` markedDeparted=${marked} replacementsMinted=${minted} replacementErrors=${replacementErrors}`,
    );
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`PREMIER_LEAGUE_CARD_ELIGIBILITY_FAILED ${error?.stack || error}`);
  process.exit(1);
});
