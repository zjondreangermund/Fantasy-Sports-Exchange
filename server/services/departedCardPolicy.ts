import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { claimReplacementCard, ensurePlayerTransferMonitoringSchema } from "./playerTransferMonitoring.js";
import { createNotificationOnce } from "./notifications.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function toPgIntArrayLiteral(ids: number[]): string {
  return `{${ids.join(",")}}`;
}

// EPL_REPLACEMENT_CLAIM_WINDOW_V1
// Managers get a manual claim window first. A reminder is sent after one week,
// and any still-unclaimed replacement is minted automatically after two weeks.
export const EPL_REPLACEMENT_REMINDER_DAYS = 7;
export const EPL_REPLACEMENT_AUTO_MINT_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function claimDeadline(createdAt: unknown, days: number) {
  const created = new Date(String(createdAt || ""));
  return Number.isFinite(created.getTime())
    ? new Date(created.getTime() + days * DAY_MS)
    : null;
}

let policySchemaPromise: Promise<void> | null = null;

export async function ensureDepartedCardPolicySchema() {
  if (!policySchemaPromise) {
    policySchemaPromise = (async () => {
      await ensurePlayerTransferMonitoringSchema();
      await db.execute(sql`
        alter table app.player_replacement_claims
          add column if not exists decision text not null default 'pending'
      `);
      await db.execute(sql`
        create index if not exists player_replacement_claims_decision_idx
        on app.player_replacement_claims (user_id, decision, claimed_at)
      `);
    })().catch((error) => {
      policySchemaPromise = null;
      throw error;
    });
  }
  return policySchemaPromise;
}

async function purchasedCardIds(userId: string, cardIds: number[]) {
  const ids = cardIds.filter((id) => Number.isInteger(id) && id > 0);
  const purchased = new Set<number>();
  if (!ids.length) return purchased;
  const idArray = toPgIntArrayLiteral(ids);

  const marketplace = rowsOf(await db.execute(sql`
    select distinct (meta->>'cardId')::int as "cardId"
    from app.audit_logs
    where user_id=${userId}
      and action='marketplace.purchase.completed'
      and meta ? 'cardId'
      and (meta->>'cardId') ~ '^[0-9]+$'
      and (meta->>'cardId')::int = any(${idArray}::int[])
  `));
  for (const row of marketplace) purchased.add(Number(row.cardId));

  try {
    const auctions = rowsOf(await db.execute(sql`
      select distinct a.card_id as "cardId"
      from app.auction_escrow_holds h
      join app.auctions a on a.id=h.auction_id
      where h.bidder_user_id=${userId}
        and h.status='settled'
        and a.card_id = any(${idArray}::int[])
    `));
    for (const row of auctions) purchased.add(Number(row.cardId));
  } catch {
    // Older databases may not yet have auction escrow history. Marketplace
    // purchase evidence still protects every known direct purchase.
  }

  const legacyAuctionAudits = rowsOf(await db.execute(sql`
    select distinct (meta->>'cardId')::int as "cardId"
    from app.audit_logs
    where user_id=${userId}
      and action in ('auction.purchase.completed','auction.win.completed')
      and meta ? 'cardId'
      and (meta->>'cardId') ~ '^[0-9]+$'
      and (meta->>'cardId')::int = any(${idArray}::int[])
  `).catch(() => ({ rows: [] } as any)));
  for (const row of legacyAuctionAudits) purchased.add(Number(row.cardId));

  return purchased;
}

async function activeLockCardIds(cardIds: number[]) {
  const ids = cardIds.filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return new Set<number>();
  const idArray = toPgIntArrayLiteral(ids);
  const rows = rowsOf(await db.execute(sql`
    select distinct cl.card_id as "cardId"
    from app.card_locks cl
    where cl.card_id = any(${idArray}::int[])
      and (cl.expires_at is null or cl.expires_at > now())
      and not (
        cl.reason::text = 'competition'
        and coalesce(cl.ref_id,'') ~ '^[0-9]+$'
        and (
          not exists (select 1 from app.competitions c where c.id=cl.ref_id::int)
          or exists (
            select 1 from app.competitions c
            where c.id=cl.ref_id::int
              and lower(c.status::text) in ('completed','cancelled')
          )
        )
      )
  `));
  return new Set(rows.map((row) => Number(row.cardId)).filter(Boolean));
}

export async function ensureDepartedOwnedCardClaims(userId?: string) {
  await ensureDepartedCardPolicySchema();
  const candidates = rowsOf(await db.execute(sql`
    select pc.id as "cardId", pc.owner_id as "userId", pc.player_id as "playerId",
           pc.rarity::text as rarity, p.name as "playerName", p.position::text as "sourcePosition"
    from app.player_cards pc
    join app.players p on p.id=pc.player_id
    where pc.owner_id is not null
      and (${userId || null}::text is null or pc.owner_id=${userId || null})
      and (lower(coalesce(p.league,'')) <> 'premier league' or lower(coalesce(p.status,''))='departed')
      and not exists (
        select 1
        from app.card_loans active_loan
        where active_loan.card_id=pc.id
          and active_loan.status='active'
          and active_loan.borrower_user_id=pc.owner_id
      )
      and not exists (
        select 1 from app.player_replacement_claims pr where pr.source_card_id=pc.id
      )
    order by pc.id
    limit 1000
  `));

  let created = 0;
  for (const card of candidates) {
    const inserted = rowsOf(await db.execute(sql`
      insert into app.player_replacement_claims (
        user_id, source_card_id, source_player_id, source_player_name, rarity,
        transfer_event_id, decision, created_at
      ) values (
        ${String(card.userId)}, ${Number(card.cardId)}, ${Number(card.playerId)},
        ${String(card.playerName || "Player")}, ${String(card.rarity || "common")},
        null, 'pending', now()
      )
      on conflict (source_card_id) do nothing
      returning id
    `))[0];
    if (inserted?.id) {
      created += 1;
      const claimId = Number(inserted.id);
      const prettyRarity = String(card.rarity || "common").replace(/^./, (ch) => ch.toUpperCase());
      const sourcePosition = String(card.sourcePosition || "").toUpperCase();
      await createNotificationOnce(db, {
        userId: String(card.userId),
        title: `${String(card.playerName || "Your player")} left the Premier League`,
        message: `${String(card.playerName || "Your player")} is no longer eligible for Premier League tournaments. You can mint one free current Premier League ${sourcePosition || "same-position"} card of the same ${prettyRarity} rarity now. If you do not claim it within 14 days, Fantasy Arena will mint it automatically.`,
        dedupeKey: `replacement-claim:${claimId}`,
      });
    }
  }
  return created;
}

export async function decorateReplacementClaims(userId: string, claims: any[]) {
  await ensureDepartedCardPolicySchema();
  const sourceIds = claims.map((claim) => Number(claim.sourceCardId || 0)).filter(Boolean);
  const [purchased, locked] = await Promise.all([
    purchasedCardIds(userId, sourceIds),
    activeLockCardIds(sourceIds),
  ]);
  const decisions = rowsOf(await db.execute(sql`
    select id, decision
    from app.player_replacement_claims
    where user_id=${userId}
  `));
  const decisionById = new Map(decisions.map((row) => [Number(row.id), String(row.decision || "pending")]));

  return claims.map((claim) => {
    const reminderAt = claimDeadline(claim.createdAt, EPL_REPLACEMENT_REMINDER_DAYS);
    const autoMintAt = claimDeadline(claim.createdAt, EPL_REPLACEMENT_AUTO_MINT_DAYS);
    return {
      ...claim,
      ownerChoice: purchased.has(Number(claim.sourceCardId || 0)),
      locked: locked.has(Number(claim.sourceCardId || 0)),
      decision: decisionById.get(Number(claim.id || 0)) || "pending",
      reminderAt: reminderAt?.toISOString() || null,
      autoMintAt: autoMintAt?.toISOString() || null,
      autoMintOverdue: Boolean(autoMintAt && autoMintAt.getTime() <= Date.now() && !claim.replacementCardId),
    };
  });
}

export async function archiveReplacedSourceCard(userId: string, claimId: number) {
  await ensureDepartedCardPolicySchema();
  const claim = rowsOf(await db.execute(sql`
    select source_card_id as "sourceCardId", replacement_card_id as "replacementCardId"
    from app.player_replacement_claims
    where id=${claimId} and user_id=${userId}
    limit 1
  `))[0];
  const sourceCardId = Number(claim?.sourceCardId || 0);
  if (!sourceCardId || !claim?.replacementCardId) return false;

  const activeBorrow = rowsOf(await db.execute(sql`
    select l.id
    from app.card_loans l
    where l.card_id=${sourceCardId}
      and l.status='active'
      and l.borrower_user_id=${userId}
    limit 1
  `))[0];
  if (activeBorrow?.id) return false;

  const locked = await activeLockCardIds([sourceCardId]);
  if (locked.has(sourceCardId)) return false;

  try {
    await db.execute(sql`
      update app.player_cards
      set owner_id=null, for_sale=false, price=0
      where id=${sourceCardId} and owner_id=${userId}
    `);
    return true;
  } catch (error) {
    // The replacement card has already been minted and recorded. A legacy or
    // concurrent lock must never roll that replacement back; leave the old card
    // owned and let a later archival sweep clean it up after settlement.
    console.warn(`Departed source card ${sourceCardId} could not be archived yet:`, error);
    return false;
  }
}

export async function finalizeReplacementChoice(userId: string, claimId: number) {
  await ensureDepartedCardPolicySchema();
  await db.execute(sql`
    update app.player_replacement_claims
    set decision='replace'
    where id=${claimId} and user_id=${userId}
  `);
  return archiveReplacedSourceCard(userId, claimId);
}

export async function keepPurchasedDepartedCard(userId: string, claimId: number) {
  await ensureDepartedCardPolicySchema();
  const claim = rowsOf(await db.execute(sql`
    select id, source_card_id as "sourceCardId", replacement_card_id as "replacementCardId", decision
    from app.player_replacement_claims
    where id=${claimId} and user_id=${userId}
    limit 1
  `))[0];
  if (!claim?.id) throw new Error("Replacement choice not found");
  if (claim.replacementCardId) throw new Error("A replacement has already been minted for this card");

  const sourceCardId = Number(claim.sourceCardId || 0);
  const [purchased, locked] = await Promise.all([
    purchasedCardIds(userId, [sourceCardId]),
    activeLockCardIds([sourceCardId]),
  ]);
  if (!purchased.has(sourceCardId)) throw new Error("Only a purchased card can be kept instead of reminted");
  if (locked.has(sourceCardId)) throw new Error("This card is still locked in the current gameweek. Choose after settlement.");

  await db.execute(sql`
    update app.player_replacement_claims
    set decision='keep', claimed_at=now()
    where id=${claimId} and user_id=${userId}
  `);
  await db.execute(sql`
    update app.player_cards
    set for_sale=false, price=0
    where id=${sourceCardId} and owner_id=${userId}
  `);
  return { kept: true, sourceCardId };
}

export async function archiveReadyReplacedSourceCards(userId?: string) {
  await ensureDepartedCardPolicySchema();
  const ready = rowsOf(await db.execute(sql`
    select pr.id, pr.user_id as "userId"
    from app.player_replacement_claims pr
    join app.player_cards source on source.id=pr.source_card_id
    where pr.replacement_card_id is not null
      and source.owner_id=pr.user_id
      and not exists (
        select 1
        from app.card_loans active_loan
        where active_loan.card_id=pr.source_card_id
          and active_loan.status='active'
          and active_loan.borrower_user_id=pr.user_id
      )
      and (${userId || null}::text is null or pr.user_id=${userId || null})
    order by pr.id
    limit 500
  `));

  let archived = 0;
  for (const row of ready) {
    if (await archiveReplacedSourceCard(String(row.userId || ""), Number(row.id || 0))) archived += 1;
  }
  return archived;
}

export async function autoReplaceUnlockedDepartures(userId?: string) {
  // DELAYED_EPL_DEPARTURE_REPLACEMENT_V1
  // A departure creates a manual replacement claim immediately. The manager
  // has 14 days to mint it from Inbox. After 7 days an idempotent reminder is
  // sent. After 14 days, any still-unclaimed card is minted automatically.
  // Position and rarity remain protected in both manual and automatic flows.
  await ensureDepartedCardPolicySchema();
  await ensureDepartedOwnedCardClaims(userId);
  await archiveReadyReplacedSourceCards(userId);

  const pending = rowsOf(await db.execute(sql`
    select pr.id, pr.user_id as "userId", pr.source_card_id as "sourceCardId",
           pr.source_player_name as "sourcePlayerName", pr.rarity,
           pr.created_at as "createdAt", source.position::text as "sourcePosition"
    from app.player_replacement_claims pr
    join app.players source on source.id=pr.source_player_id
    where pr.replacement_card_id is null
      and (${userId || null}::text is null or pr.user_id=${userId || null})
      and not exists (
        select 1
        from app.card_loans active_loan
        where active_loan.card_id=pr.source_card_id
          and active_loan.status='active'
          and active_loan.borrower_user_id=pr.user_id
      )
      and (lower(coalesce(source.league,'')) <> 'premier league' or lower(coalesce(source.status,''))='departed')
    order by pr.created_at, pr.id
    limit 500
  `));

  let reminted = 0;
  let failed = 0;
  let reminders = 0;
  let waiting = 0;
  const now = Date.now();

  for (const claim of pending) {
    const claimUserId = String(claim.userId || "");
    const claimId = Number(claim.id || 0);
    if (!claimUserId || !claimId) continue;

    const createdAt = new Date(String(claim.createdAt || ""));
    const createdMs = createdAt.getTime();
    const reminderMs = Number.isFinite(createdMs) ? createdMs + EPL_REPLACEMENT_REMINDER_DAYS * DAY_MS : Number.POSITIVE_INFINITY;
    const autoMintMs = Number.isFinite(createdMs) ? createdMs + EPL_REPLACEMENT_AUTO_MINT_DAYS * DAY_MS : Number.POSITIVE_INFINITY;
    const prettyRarity = String(claim.rarity || "card").replace(/^./, (ch) => ch.toUpperCase());
    const position = String(claim.sourcePosition || "same-position").toUpperCase();

    if (now >= reminderMs && now < autoMintMs) {
      await createNotificationOnce(db, {
        userId: claimUserId,
        title: "Replacement card reminder",
        message: `Your ${prettyRarity} ${position} replacement for ${String(claim.sourcePlayerName || "your departed player")} is still waiting. Mint it from Inbox before the 14-day deadline, otherwise Fantasy Arena will mint it automatically.`,
        dedupeKey: `replacement-reminder:${claimId}`,
      });
      reminders += 1;
    }

    if (now < autoMintMs) {
      waiting += 1;
      continue;
    }

    try {
      const result = await claimReplacementCard(claimUserId, claimId);
      await finalizeReplacementChoice(claimUserId, claimId);

      const replacementName = String(result?.card?.playerName || "Premier League Player");
      const replacementPosition = String(result?.card?.position || position).toUpperCase();
      await createNotificationOnce(db, {
        userId: claimUserId,
        title: "Replacement minted automatically",
        message: `The 14-day claim window for ${String(claim.sourcePlayerName || "your departed player")} ended. ${replacementName} (${replacementPosition}) has now been added to your Collection as the automatic ${prettyRarity} replacement.`,
        dedupeKey: `replacement-complete:${claimId}`,
      });

      reminted += 1;
      console.info(
        `DELAYED_EPL_DEPARTURE_REPLACED claim=${claimId} user=${claimUserId}`
        + ` source="${String(claim.sourcePlayerName || "Player")}" rarity=${String(claim.rarity || "")}`
        + ` replacement="${replacementName}" position=${replacementPosition}`,
      );
    } catch (error) {
      failed += 1;
      console.warn(`Delayed EPL departure replacement failed for claim ${claimId}:`, error);
    }
  }

  return { reminted, failed, reminders, waiting };
}

// Backward-compatible export for any older build/runtime import.
export const autoReplaceUnlockedCommonDepartures = autoReplaceUnlockedDepartures;
