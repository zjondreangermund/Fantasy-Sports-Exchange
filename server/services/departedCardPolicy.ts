import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { claimReplacementCard, ensurePlayerTransferMonitoringSchema } from "./playerTransferMonitoring.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
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

  const marketplace = rowsOf(await db.execute(sql`
    select distinct (meta->>'cardId')::int as "cardId"
    from app.audit_logs
    where user_id=${userId}
      and action='marketplace.purchase.completed'
      and meta ? 'cardId'
      and (meta->>'cardId') ~ '^[0-9]+$'
      and (meta->>'cardId')::int = any(${ids}::int[])
  `));
  for (const row of marketplace) purchased.add(Number(row.cardId));

  try {
    const auctions = rowsOf(await db.execute(sql`
      select distinct a.card_id as "cardId"
      from app.auction_escrow_holds h
      join app.auctions a on a.id=h.auction_id
      where h.bidder_user_id=${userId}
        and h.status='settled'
        and a.card_id = any(${ids}::int[])
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
      and (meta->>'cardId')::int = any(${ids}::int[])
  `).catch(() => ({ rows: [] } as any)));
  for (const row of legacyAuctionAudits) purchased.add(Number(row.cardId));

  return purchased;
}

async function activeLockCardIds(cardIds: number[]) {
  const ids = cardIds.filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return new Set<number>();
  const rows = rowsOf(await db.execute(sql`
    select distinct card_id as "cardId"
    from app.card_locks
    where card_id = any(${ids}::int[])
      and (expires_at is null or expires_at > now())
  `));
  return new Set(rows.map((row) => Number(row.cardId)).filter(Boolean));
}

export async function ensureDepartedOwnedCardClaims(userId?: string) {
  await ensureDepartedCardPolicySchema();
  const candidates = rowsOf(await db.execute(sql`
    select pc.id as "cardId", pc.owner_id as "userId", pc.player_id as "playerId",
           pc.rarity::text as rarity, p.name as "playerName"
    from app.player_cards pc
    join app.players p on p.id=pc.player_id
    where pc.owner_id is not null
      and (${userId || null}::text is null or pc.owner_id=${userId || null})
      and (lower(coalesce(p.league,'')) <> 'premier league' or lower(coalesce(p.status,''))='departed')
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
    if (inserted?.id) created += 1;
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

  return claims.map((claim) => ({
    ...claim,
    ownerChoice: purchased.has(Number(claim.sourceCardId || 0)),
    locked: locked.has(Number(claim.sourceCardId || 0)),
    decision: decisionById.get(Number(claim.id || 0)) || "pending",
  }));
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

  const locked = await activeLockCardIds([sourceCardId]);
  if (locked.has(sourceCardId)) return false;

  await db.execute(sql`
    update app.player_cards
    set owner_id=null, for_sale=false, price=0
    where id=${sourceCardId} and owner_id=${userId}
  `);
  return true;
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

export async function autoReplaceUnlockedCommonDepartures(userId?: string) {
  await ensureDepartedCardPolicySchema();
  await ensureDepartedOwnedCardClaims(userId);

  const pending = rowsOf(await db.execute(sql`
    select pr.id, pr.user_id as "userId", pr.source_card_id as "sourceCardId"
    from app.player_replacement_claims pr
    join app.players source on source.id=pr.source_player_id
    where pr.replacement_card_id is null
      and pr.claimed_at is null
      and coalesce(pr.decision,'pending')='pending'
      and lower(pr.rarity)='common'
      and (${userId || null}::text is null or pr.user_id=${userId || null})
      and (lower(coalesce(source.league,'')) <> 'premier league' or lower(coalesce(source.status,''))='departed')
      and not exists (
        select 1 from app.card_locks cl
        where cl.card_id=pr.source_card_id
          and (cl.expires_at is null or cl.expires_at > now())
      )
    order by pr.created_at, pr.id
    limit 250
  `));

  let reminted = 0;
  let ownerChoice = 0;
  let failed = 0;
  for (const claim of pending) {
    const claimUserId = String(claim.userId || "");
    const sourceCardId = Number(claim.sourceCardId || 0);
    if (!claimUserId || !sourceCardId) continue;
    const purchased = await purchasedCardIds(claimUserId, [sourceCardId]);
    if (purchased.has(sourceCardId)) {
      ownerChoice += 1;
      continue;
    }
    try {
      await claimReplacementCard(claimUserId, Number(claim.id));
      await finalizeReplacementChoice(claimUserId, Number(claim.id));
      reminted += 1;
    } catch (error) {
      failed += 1;
      console.warn(`Automatic Common EPL departure remint failed for claim ${Number(claim.id)}:`, error);
    }
  }

  return { reminted, ownerChoice, failed };
}
