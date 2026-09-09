import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";

const SUPPLY_BY_RARITY: Record<string, number> = {
  common: 1000,
  rare: 100,
  unique: 10,
  epic: 3,
  legendary: 1,
};

let schemaPromise: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function currentSeasonStartYear() {
  const now = new Date();
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function normalizeTeam(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isPremierLeague(value: unknown) {
  return String(value || "").trim().toLowerCase() === "premier league";
}

export async function ensurePlayerTransferMonitoringSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await ensureNotificationsSchema();
      await db.execute(sql`create schema if not exists app`);
      await db.execute(sql`
        create table if not exists app.player_transfer_events (
          id bigserial primary key,
          player_id integer not null references app.players(id),
          fpl_id integer,
          player_name text not null,
          from_team text,
          to_team text,
          left_premier_league boolean not null default false,
          event_key text not null unique,
          detected_at timestamp not null default now()
        )
      `);
      await db.execute(sql`
        create table if not exists app.player_replacement_claims (
          id bigserial primary key,
          user_id varchar(255) not null references app.users(id),
          source_card_id integer not null references app.player_cards(id),
          source_player_id integer not null references app.players(id),
          source_player_name text not null,
          rarity text not null,
          transfer_event_id bigint references app.player_transfer_events(id),
          replacement_card_id integer references app.player_cards(id),
          claimed_at timestamp,
          created_at timestamp not null default now(),
          unique (source_card_id)
        )
      `);
      await db.execute(sql`create index if not exists player_transfer_events_player_idx on app.player_transfer_events (player_id, detected_at desc)`);
      await db.execute(sql`create index if not exists player_replacement_claims_user_idx on app.player_replacement_claims (user_id, claimed_at, created_at desc)`);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function ensureTransferEvent(input: {
  playerId: number;
  fplId: number | null;
  playerName: string;
  fromTeam: string;
  toTeam: string;
  leftPremierLeague: boolean;
  eventKey: string;
}) {
  const result = await db.execute(sql`
    insert into app.player_transfer_events (
      player_id, fpl_id, player_name, from_team, to_team, left_premier_league, event_key, detected_at
    ) values (
      ${input.playerId}, ${input.fplId}, ${input.playerName}, ${input.fromTeam || null}, ${input.toTeam || null},
      ${input.leftPremierLeague}, ${input.eventKey}, now()
    )
    on conflict (event_key) do update set
      player_name=excluded.player_name,
      from_team=excluded.from_team,
      to_team=excluded.to_team
    returning id
  `);
  return Number(rowsOf(result)[0]?.id || 0);
}

async function notifyPremierLeagueMove(input: {
  eventId: number;
  eventKey: string;
  playerId: number;
  playerName: string;
  fromTeam: string;
  toTeam: string;
}) {
  const owners = rowsOf(await db.execute(sql`
    select pc.owner_id as "userId", count(*)::int as cards
    from app.player_cards pc
    where pc.player_id=${input.playerId} and pc.owner_id is not null
    group by pc.owner_id
  `));

  for (const owner of owners) {
    const cardCount = Math.max(1, Number(owner.cards || 1));
    await createNotificationOnce(db, {
      userId: String(owner.userId),
      title: `${input.playerName} joined ${input.toTeam}`,
      message: `${input.playerName} moved from ${input.fromTeam} to ${input.toTeam}. ${cardCount === 1 ? "Your card remains" : `Your ${cardCount} cards remain`} eligible for Premier League tournaments and now represent${cardCount === 1 ? "s" : ""} ${input.toTeam}.`,
      dedupeKey: `player-transfer:${input.eventKey}`,
    });
  }
}

async function createDepartureClaims(input: {
  eventId: number;
  eventKey: string;
  playerId: number;
  playerName: string;
  fromTeam: string;
}) {
  const cards = rowsOf(await db.execute(sql`
    select pc.id, pc.owner_id as "ownerId", pc.rarity::text as rarity
    from app.player_cards pc
    where pc.player_id=${input.playerId} and pc.owner_id is not null
    order by pc.id asc
  `));

  let claimsCreated = 0;
  for (const card of cards) {
    const sourceCardId = Number(card.id || 0);
    const userId = String(card.ownerId || "");
    const rarity = String(card.rarity || "common").toLowerCase();
    if (!sourceCardId || !userId || !SUPPLY_BY_RARITY[rarity]) continue;

    const inserted = rowsOf(await db.execute(sql`
      insert into app.player_replacement_claims (
        user_id, source_card_id, source_player_id, source_player_name, rarity, transfer_event_id, created_at
      ) values (
        ${userId}, ${sourceCardId}, ${input.playerId}, ${input.playerName}, ${rarity}, ${input.eventId || null}, now()
      )
      on conflict (source_card_id) do nothing
      returning id
    `))[0];
    if (inserted?.id) claimsCreated += 1;

    const claim = inserted || rowsOf(await db.execute(sql`
      select id, replacement_card_id as "replacementCardId"
      from app.player_replacement_claims
      where source_card_id=${sourceCardId}
      limit 1
    `))[0];
    if (!claim?.id) continue;

    const prettyRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1);
    await createNotificationOnce(db, {
      userId,
      title: `${input.playerName} left the Premier League`,
      message: `${input.playerName} is no longer in the Premier League. Your ${prettyRarity} card stays in your collection as a record, but it is no longer eligible for Premier League tournaments. Mint one free ${prettyRarity} replacement from the current Premier League player pool for future entries.`,
      dedupeKey: `replacement-claim:${Number(claim.id)}`,
    });
  }

  await db.execute(sql`
    update app.player_cards
    set for_sale=false, price=0
    where player_id=${input.playerId}
  `);

  return claimsCreated;
}

export async function processFplRosterChanges(existingRows: any[], currentFplIds: number[]) {
  await ensurePlayerTransferMonitoringSchema();
  const season = currentSeasonStartYear();
  const currentIds = new Set(currentFplIds.filter((id) => Number.isInteger(id) && id > 0));
  const beforeById = new Map<number, any>();
  for (const row of existingRows || []) beforeById.set(Number(row.id || 0), row);

  const postRows = rowsOf(await db.execute(sql`
    select p.id, p.name, p.team, p.league, p.status, p.fpl_id as "fplId"
    from app.players p
    where p.fpl_id is not null
  `));

  let movedWithinLeague = 0;
  let leftLeague = 0;
  let replacementClaims = 0;

  for (const after of postRows) {
    const playerId = Number(after.id || 0);
    const fplId = Number(after.fplId || 0);
    const before = beforeById.get(playerId);
    if (!playerId || !fplId || !before) continue;

    if (currentIds.has(fplId)) {
      const fromTeam = String(before.team || "").trim();
      const toTeam = String(after.team || "").trim();
      if (isPremierLeague(before.league) && fromTeam && toTeam && normalizeTeam(fromTeam) !== normalizeTeam(toTeam)) {
        const eventKey = `pl-transfer:${season}:${playerId}:${normalizeTeam(fromTeam)}:${normalizeTeam(toTeam)}`;
        const eventId = await ensureTransferEvent({
          playerId,
          fplId,
          playerName: String(after.name || before.name || "Player"),
          fromTeam,
          toTeam,
          leftPremierLeague: false,
          eventKey,
        });
        await notifyPremierLeagueMove({
          eventId,
          eventKey,
          playerId,
          playerName: String(after.name || before.name || "Player"),
          fromTeam,
          toTeam,
        });
        movedWithinLeague += 1;
      }
    }
  }

  for (const row of postRows) {
    const playerId = Number(row.id || 0);
    const fplId = Number(row.fplId || 0);
    if (!playerId || !fplId || currentIds.has(fplId) || !isPremierLeague(row.league)) continue;

    const playerName = String(row.name || "Player");
    const fromTeam = String(row.team || "Premier League club");
    const eventKey = `left-pl:${season}:${playerId}:${normalizeTeam(fromTeam)}`;
    const eventId = await ensureTransferEvent({
      playerId,
      fplId,
      playerName,
      fromTeam,
      toTeam: "Outside Premier League",
      leftPremierLeague: true,
      eventKey,
    });

    replacementClaims += await createDepartureClaims({ eventId, eventKey, playerId, playerName, fromTeam });
    await db.execute(sql`
      update app.players
      set league='Outside Premier League',
          status='departed',
          news=case
            when coalesce(news,'') ilike '%no longer in the Premier League%' then news
            else concat_ws(' ', nullif(news,''), 'No longer in the Premier League; replacement-card protection applies to existing owners.')
          end,
          synced_at=now()
      where id=${playerId}
    `);
    leftLeague += 1;
  }

  return { movedWithinLeague, leftLeague, replacementClaims };
}

export async function listUserReplacementClaims(userId: string) {
  await ensurePlayerTransferMonitoringSchema();
  return rowsOf(await db.execute(sql`
    select pr.id,
           pr.source_card_id as "sourceCardId",
           pr.source_player_id as "sourcePlayerId",
           pr.source_player_name as "sourcePlayerName",
           pr.rarity,
           pr.replacement_card_id as "replacementCardId",
           pr.claimed_at as "claimedAt",
           pr.created_at as "createdAt"
    from app.player_replacement_claims pr
    where pr.user_id=${userId}
    order by pr.created_at desc, pr.id desc
  `));
}

export async function claimReplacementCard(userId: string, claimId: number) {
  await ensurePlayerTransferMonitoringSchema();
  if (!userId || !Number.isInteger(claimId) || claimId <= 0) throw new Error("Valid replacement claim required");

  return db.transaction(async (tx: any) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`player-replacement:${claimId}`}))`);
    const claim = rowsOf(await tx.execute(sql`
      select pr.id, pr.user_id as "userId", pr.source_card_id as "sourceCardId",
             pr.source_player_id as "sourcePlayerId", pr.source_player_name as "sourcePlayerName",
             pr.rarity, pr.replacement_card_id as "replacementCardId", pr.claimed_at as "claimedAt"
      from app.player_replacement_claims pr
      where pr.id=${claimId} and pr.user_id=${userId}
      for update
    `))[0];
    if (!claim) throw new Error("Replacement claim not found");

    if (claim.replacementCardId) {
      const existing = rowsOf(await tx.execute(sql`
        select pc.id, pc.rarity::text as rarity, pc.serial_id as "serialId", pc.serial_number as "serialNumber",
               p.id as "playerId", p.name as "playerName", p.team
        from app.player_cards pc
        join app.players p on p.id=pc.player_id
        where pc.id=${Number(claim.replacementCardId)} and pc.owner_id=${userId}
        limit 1
      `))[0];
      return { alreadyClaimed: true, claim, card: existing || null };
    }

    const rarity = String(claim.rarity || "common").toLowerCase();
    const supplyLimit = SUPPLY_BY_RARITY[rarity];
    if (!supplyLimit) throw new Error("Unsupported replacement rarity");

    const candidates = rowsOf(await tx.execute(sql`
      select p.id, p.name, p.team
      from app.players p
      where lower(p.league)='premier league'
        and p.fpl_id is not null
        and p.id <> ${Number(claim.sourcePlayerId)}
        and coalesce(p.status,'a') <> 'departed'
        and not exists (
          select 1 from app.player_cards owned
          where owned.owner_id=${userId}
            and owned.player_id=p.id
            and owned.rarity::text=${rarity}
        )
        and (
          select count(*)::int from app.player_cards minted
          where minted.player_id=p.id and minted.rarity::text=${rarity}
        ) < ${supplyLimit}
      order by random()
      limit 50
    `));
    const chosen = candidates[0];
    if (!chosen?.id) throw new Error(`No ${rarity} replacement supply is currently available. Your claim remains open.`);

    const card = rowsOf(await tx.execute(sql`
      insert into app.player_cards (
        player_id, owner_id, rarity, level, xp, decisive_score, last_5_scores, for_sale, price, acquired_at
      ) values (
        ${Number(chosen.id)}, ${userId}, ${rarity}::public.rarity, 1, 0, 35, '[0,0,0,0,0]'::jsonb, false, 0, now()
      )
      returning id, rarity::text as rarity, serial_id as "serialId", serial_number as "serialNumber"
    `))[0];
    if (!card?.id) throw new Error("Replacement card mint failed");

    await tx.execute(sql`
      update app.player_replacement_claims
      set replacement_card_id=${Number(card.id)}, claimed_at=now()
      where id=${claimId} and user_id=${userId}
    `);

    return {
      alreadyClaimed: false,
      claim: { ...claim, replacementCardId: Number(card.id), claimedAt: new Date().toISOString() },
      card: {
        ...card,
        playerId: Number(chosen.id),
        playerName: String(chosen.name || "Premier League Player"),
        team: String(chosen.team || "Premier League"),
      },
    };
  });
}
