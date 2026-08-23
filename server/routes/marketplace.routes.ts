import type { Express } from "express";
import { db } from "../db.js";
import { auditLogs, idempotencyKeys, playerCards, transactions, users } from "../../shared/schema.js";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getMarketplaceFloorPrice, isMarketplaceTradableRarity } from "../../shared/card-economy.js";
import { registerCompetitionCancellationRoutes } from "./competitionCancellation.routes.js";
import { registerTournamentCreatorRoutes } from "./tournamentCreator.routes.js";
import { ensureTournamentSchema } from "./tournamentSchema.ensure.js";
import { applyMarketplaceTradeLedger } from "../services/walletLedger.js";
import { fplApi } from "../services/fplApi.js";
import { buildFplPlayerIndex, overallFromFplElement } from "../services/fplPlayerIdentity.js";
import { apiFootballPhotoUrl, loadApiFootballPlayerDirectory, resolveApiFootballPlayer } from "../services/apiFootballPlayerDirectory.js";
import { calculatePlayerScore, mapFplStatsToPlayerStats } from "../services/scoring.js";

interface RegisterMarketplaceRoutesDeps { requireAuth: any; }

const BUY_TX_TYPE = "marketplace_buy" as any;
const SALE_TX_TYPE = "marketplace_sale" as any;
const TOURNAMENT_FEE_RATE = 0.2;
const PIN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const TOURNAMENT_RARITIES = new Set(["common", "rare", "unique", "epic", "legendary"]);

function toMoney(amount: unknown): number { const value = Number(amount); if (!Number.isFinite(value)) return 0; return Math.round(value * 100) / 100; }
function parseCardId(rawCardId: unknown): number { if (typeof rawCardId === "number") return rawCardId; const normalized = String(rawCardId ?? "").trim(); if (!normalized) return Number.NaN; if (/^\d+$/.test(normalized)) return Number(normalized); const match = normalized.match(/(\d+)/); return match ? Number(match[1]) : Number.NaN; }
function normalizePin(raw: unknown) { return String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function randomPin(length = 6) { let pin = ""; for (let i = 0; i < length; i += 1) pin += PIN_ALPHABET[Math.floor(Math.random() * PIN_ALPHABET.length)]; return pin; }
async function generateUniqueTournamentPin() { await ensureTournamentSchema(); for (let i = 0; i < 25; i += 1) { const pin = randomPin(); const existing = await db.execute(sql`select id from app.competitions where join_pin = ${pin} limit 1`); const rows = Array.isArray((existing as any)?.rows) ? (existing as any).rows : []; if (rows.length === 0) return pin; } throw new Error("Could not generate tournament PIN"); }
async function resolveCard(rawCardId: unknown, rawSerialId?: unknown) { const cardId = parseCardId(rawCardId); const serialId = String(rawSerialId ?? "").trim(); if (Number.isInteger(cardId) && cardId > 0) return { cardId, serialId }; if (serialId) { const [card] = await db.select({ id: playerCards.id }).from(playerCards).where(eq(playerCards.serialId, serialId)); if (card?.id) return { cardId: Number(card.id), serialId }; } return { cardId: Number.NaN, serialId }; }
function marketplacePurchaseKey(buyerId: string, cardId: number, rawKey?: unknown) { const supplied = String(rawKey ?? "").trim().slice(0, 120); if (supplied) return `${buyerId}:marketplace-buy:${supplied}`; const fiveMinuteBucket = Math.floor(Date.now() / (5 * 60 * 1000)); return `${buyerId}:marketplace-buy:card:${cardId}:bucket:${fiveMinuteBucket}`; }
function rowsFromResult(result: any): any[] { return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : []; }
function parseAuditMeta(raw: unknown): Record<string, any> { if (raw && typeof raw === "object") return raw as Record<string, any>; if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } } return {}; }

function distributionPreset(raw: unknown, customRules?: unknown) {
  const preset = String(raw || "winner_takes_all").toLowerCase().trim();
  const presets: Record<string, Array<{ rank: number; percent: number }>> = {
    winner_takes_all: [{ rank: 1, percent: 100 }],
    top_3: [{ rank: 1, percent: 60 }, { rank: 2, percent: 30 }, { rank: 3, percent: 10 }],
    top_5: [{ rank: 1, percent: 45 }, { rank: 2, percent: 25 }, { rank: 3, percent: 15 }, { rank: 4, percent: 10 }, { rank: 5, percent: 5 }],
    top_10: [{ rank: 1, percent: 30 }, { rank: 2, percent: 20 }, { rank: 3, percent: 15 }, { rank: 4, percent: 10 }, { rank: 5, percent: 8 }, { rank: 6, percent: 5 }, { rank: 7, percent: 4 }, { rank: 8, percent: 3 }, { rank: 9, percent: 3 }, { rank: 10, percent: 2 }],
  };
  if (preset === "custom" && Array.isArray(customRules)) {
    const rules = customRules.map((r: any, index) => ({ rank: Number(r?.rank || index + 1), percent: Number(r?.percent || 0) })).filter((r) => Number.isInteger(r.rank) && r.rank > 0 && Number.isFinite(r.percent) && r.percent > 0).slice(0, 20);
    const total = Math.round(rules.reduce((sum, rule) => sum + rule.percent, 0) * 100) / 100;
    if (rules.length && total === 100) return { distribution: "custom", rules };
  }
  const safePreset = presets[preset] ? preset : "winner_takes_all";
  return { distribution: safePreset, rules: presets[safePreset] };
}

async function processMarketplacePurchase(buyerId: string, rawCardId: unknown, rawSerialId?: unknown, rawIdempotencyKey?: unknown) {
  const { cardId: resolvedCardId, serialId } = await resolveCard(rawCardId, rawSerialId);
  if (!buyerId) return { ok: false as const, status: 401, message: "Authentication required" };
  if (!Number.isInteger(resolvedCardId) || resolvedCardId <= 0) return { ok: false as const, status: 400, message: "Valid cardId required" };
  const idempotencyKey = marketplacePurchaseKey(buyerId, resolvedCardId, rawIdempotencyKey);
  try {
    const purchase = await db.transaction(async (tx) => {
      const [claimedKey] = await tx.insert(idempotencyKeys)
        .values({ key: idempotencyKey, userId: buyerId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } as any)
        .onConflictDoNothing({ target: idempotencyKeys.key })
        .returning({ key: idempotencyKeys.key });

      if (!claimedKey) {
        const existingResult = await tx.execute(sql`
          select meta
          from app.audit_logs
          where user_id = ${buyerId}
            and action = 'marketplace.purchase.completed'
            and meta ->> 'idempotencyKey' = ${idempotencyKey}
          order by id desc
          limit 1
        `);
        const existingMeta = parseAuditMeta(rowsFromResult(existingResult)[0]?.meta);
        if (!existingMeta.cardId) throw new Error("Marketplace purchase is already being processed");
        if (Number(existingMeta.cardId) !== resolvedCardId) throw new Error("Idempotency key was already used for another marketplace purchase");
        return { duplicate: true, price: toMoney(existingMeta.price), fee: toMoney(existingMeta.fee), sellerReceives: toMoney(existingMeta.sellerReceives) };
      }

      const [card] = await tx.select().from(playerCards).where(eq(playerCards.id, resolvedCardId)).for("update");
      if (!card) throw new Error("Card does not exist or was already sold");
      if (!card.forSale) throw new Error("Card is not for sale");
      if (!isMarketplaceTradableRarity(String(card.rarity))) throw new Error("Common cards cannot be traded");
      const sellerId = String(card.ownerId || ""); const price = toMoney(card.price || 0);
      if (!sellerId) throw new Error("Card seller is invalid");
      if (sellerId === buyerId) throw new Error("Cannot buy your own card");
      if (price <= 0) throw new Error("Invalid price");
      const floor = getMarketplaceFloorPrice(String(card.rarity)); if (floor > 0 && price < floor) throw new Error(`Below floor price (N$${floor})`);
      const [buyerUser] = await tx.select().from(users).where(eq(users.id, buyerId)); const [sellerUser] = await tx.select().from(users).where(eq(users.id, sellerId));
      if (buyerUser?.email && sellerUser?.email && String(buyerUser.email).trim().toLowerCase() === String(sellerUser.email).trim().toLowerCase()) throw new Error("Potential linked-account trade blocked");
      const pairTx = await tx.select().from(transactions).where(and(eq(transactions.type, BUY_TX_TYPE), sql`${transactions.createdAt} >= now() - interval '7 days'`, or(sql`${transactions.description} ilike ${`%buyer:${buyerId}% seller:${sellerId}%`}`, sql`${transactions.description} ilike ${`%buyer:${sellerId}% seller:${buyerId}%`}`))).orderBy(desc(transactions.createdAt)).limit(25);
      const sameCardPairTx = pairTx.filter((row: any) => String(row.description || "").includes(`card:${resolvedCardId}`));
      if (pairTx.length >= 6 || sameCardPairTx.length >= 2) { await tx.insert(auditLogs).values({ userId: buyerId, action: "risk.wash_trade_blocked", meta: { cardId: resolvedCardId, buyerId, sellerId, pairTrades7d: pairTx.length, sameCardPairTrades7d: sameCardPairTx.length } } as any); throw new Error("Trade blocked by anti-abuse controls"); }
      const saleHistory = await tx.select().from(transactions).where(and(eq(transactions.type, SALE_TX_TYPE), sql`${transactions.description} ilike ${`%card:${resolvedCardId}%`}`)).orderBy(desc(transactions.createdAt)).limit(5);
      const lastSale = Number(saleHistory[0]?.grossAmount || saleHistory[0]?.amount || 0);
      if (lastSale > 0 && price > lastSale * 3) await tx.insert(auditLogs).values({ userId: buyerId, action: "risk.price_spike_trade", meta: { cardId: resolvedCardId, buyerId, sellerId, listedPrice: price, lastSale } } as any);
      const ledger = await applyMarketplaceTradeLedger(tx, { buyerId, sellerId, amount: price, cardId: resolvedCardId, feeRate: 0.08 });
      const [transferredCard] = await tx.update(playerCards)
        .set({ ownerId: buyerId, forSale: false, price: 0 } as any)
        .where(and(eq(playerCards.id, resolvedCardId), eq(playerCards.ownerId, sellerId), eq(playerCards.forSale, true)))
        .returning({ id: playerCards.id });
      if (!transferredCard) throw new Error("Card was no longer available for transfer");
      await tx.insert(auditLogs).values({ userId: buyerId, action: "marketplace.purchase.completed", meta: { cardId: resolvedCardId, serialId, buyerId, sellerId, price: ledger.price, fee: ledger.fee, sellerReceives: ledger.sellerReceives, idempotencyKey } } as any);
      return { duplicate: false, price: ledger.price, fee: ledger.fee, sellerReceives: ledger.sellerReceives };
    });
    return { ok: true as const, cardId: resolvedCardId, duplicate: purchase.duplicate };
  } catch (error: any) {
    const message = String(error?.message || "Failed to buy card");
    const status = message.includes("not found") || message.includes("does not exist") ? 404 : message.includes("already being processed") || message.includes("Idempotency key") ? 409 : 400;
    try { await db.insert(auditLogs).values({ userId: buyerId, action: "marketplace.purchase.failed", meta: { cardId: resolvedCardId, serialId, idempotencyKey, message } } as any); } catch (auditError) { console.error("Failed to write marketplace purchase failure audit:", auditError); }
    return { ok: false as const, status, message };
  }
}

export function registerMarketplaceRoutes(app: Express, deps: RegisterMarketplaceRoutesDeps) {
  const { requireAuth } = deps;
  registerCompetitionCancellationRoutes(app, { requireAuth });
  registerTournamentCreatorRoutes(app, { requireAuth });

  app.post("/api/user-tournaments/create", requireAuth, async (req: any, res) => {
    try {
      await ensureTournamentSchema();
      const userId = String(req.authUserId || ""); const name = String(req.body?.name || "").trim().slice(0, 80); const tier = String(req.body?.tier || "common").toLowerCase().trim(); const entryFee = toMoney(req.body?.entryFee);
      const maxEntriesRaw = Number(req.body?.maxEntries || 0); const maxEntries = Number.isInteger(maxEntriesRaw) && maxEntriesRaw > 1 ? Math.min(maxEntriesRaw, 500) : null;
      const visibility = String(req.body?.visibility || "private").toLowerCase() === "public" ? "public" : "private";
      const gameWeek = Number.isInteger(Number(req.body?.gameWeek)) && Number(req.body?.gameWeek) > 0 ? Number(req.body?.gameWeek) : 1;
      const startDate = req.body?.startDate ? new Date(String(req.body.startDate)) : new Date(); const endDate = req.body?.endDate ? new Date(String(req.body.endDate)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const payout = distributionPreset(req.body?.prizeDistribution || req.body?.distribution, req.body?.prizeDistributionRules || req.body?.distributionRules);
      if (!name) return res.status(400).json({ message: "Tournament name required" }); if (!TOURNAMENT_RARITIES.has(tier)) return res.status(400).json({ message: "Invalid rarity tier" }); if (entryFee < 0) return res.status(400).json({ message: "Entry fee cannot be negative" }); if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) return res.status(400).json({ message: "Valid start and end dates required" });
      const pin = visibility === "private" ? await generateUniqueTournamentPin() : null; const prizeRarity = tier === "common" ? "rare" : tier; const gameweekLabel = `GW ${gameWeek}`;
      const result = await db.execute(sql`insert into app.competitions (name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity, created_by_user_id, join_pin, visibility, max_entries, platform_fee_rate, platform_fee_total, prize_pool_total, prize_distribution, prize_distribution_rules, gameweek_label, fixture_window_start, fixture_window_end, reschedule_alerts_enabled) values (${name}, ${tier}, ${entryFee}, 'open', ${gameWeek}, ${startDate}, ${endDate}, ${prizeRarity}, ${userId}, ${pin}, ${visibility}, ${maxEntries}, ${TOURNAMENT_FEE_RATE}, 0, 0, ${payout.distribution}, ${JSON.stringify(payout.rules)}::jsonb, ${gameweekLabel}, ${startDate}, ${endDate}, true) returning *`);
      const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : []; return res.json({ success: true, tournament: rows[0] || null, pin, prizeDistribution: payout.distribution, prizeDistributionRules: payout.rules });
    } catch (error: any) { console.error("Failed to create user tournament:", error); return res.status(500).json({ message: error?.message || "Failed to create tournament" }); }
  });

  app.get("/api/user-tournaments/pin/:pin", requireAuth, async (req: any, res) => { try { await ensureTournamentSchema(); const pin = normalizePin(req.params.pin); if (!pin) return res.status(400).json({ message: "PIN required" }); const result = await db.execute(sql`select c.*, count(ce.id)::int as entry_count from app.competitions c left join app.competition_entries ce on ce.competition_id = c.id where c.join_pin = ${pin} group by c.id limit 1`); const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : []; if (!rows[0]) return res.status(404).json({ message: "Tournament PIN not found" }); return res.json({ tournament: rows[0] }); } catch (error: any) { console.error("Failed to find tournament PIN:", error); return res.status(500).json({ message: error?.message || "Failed to find tournament" }); } });
  app.get("/api/competitions/:id/leaderboard", requireAuth, async (req: any, res) => {
    try {
      const competitionId = Number(req.params.id);
      if (!Number.isInteger(competitionId) || competitionId <= 0) {
        return res.status(400).json({ message: "Valid competition ID required" });
      }
      const requestedPage = Number(req.query?.page || 1);
      const requestedPageSize = Number(req.query?.pageSize || 100);
      const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const pageSize = Number.isInteger(requestedPageSize)
        ? Math.max(1, Math.min(requestedPageSize, 100))
        : 100;
      const offset = (page - 1) * pageSize;
      const viewerId = String(req.authUserId || "");
      const result = await db.execute(sql`
        with ranked as (
          select
            ce.id as "entryId",
            ce.user_id as "userId",
            coalesce(u.manager_team_name, u.name, u.email, 'Manager') as "teamName",
            coalesce(ce.total_score, 0)::float as "totalScore",
            ce.lineup_card_ids as "lineupCardIds",
            ce.captain_id as "captainId",
            ce.joined_at as "joinedAt",
            row_number() over (
              order by
                coalesce(ce.total_score, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'captainBasePoints', '')::float, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'squadValue', '')::float, 0) asc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'totalXp', '')::float, 0) desc,
                coalesce(nullif(ce.tiebreak_meta->'scoring'->>'rarityPrestige', '')::float, 0) desc,
                ce.joined_at asc,
                ce.id asc
            )::int as rank
          from app.competition_entries ce
          left join app.users u on u.id = ce.user_id
          where ce.competition_id = ${competitionId}
        ), paginated as (
          select * from ranked order by rank asc limit ${pageSize} offset ${offset}
        )
        select
          coalesce(
            (select jsonb_agg(to_jsonb(paginated) order by paginated.rank) from paginated),
            '[]'::jsonb
          ) as leaderboard,
          (select count(*)::int from ranked) as "totalEntries",
          (
            select to_jsonb(viewer)
            from ranked viewer
            where viewer."userId" = ${viewerId}
            order by viewer.rank asc
            limit 1
          ) as "viewerEntry"
      `);
      const payload = rowsFromResult(result)[0] || {};
      const totalEntries = Number(payload.totalEntries || 0);
      return res.json({
        leaderboard: Array.isArray(payload.leaderboard) ? payload.leaderboard : [],
        viewerEntry: payload.viewerEntry || null,
        totalEntries,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalEntries / pageSize)),
      });
    } catch (error: any) {
      console.error("Failed to fetch competition leaderboard:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/competitions/:id/entries/:entryId", requireAuth, async (req: any, res) => {
    try {
      const competitionId = Number(req.params.id);
      const entryId = Number(req.params.entryId);
      if (!Number.isInteger(competitionId) || competitionId <= 0
          || !Number.isInteger(entryId) || entryId <= 0) {
        return res.status(400).json({ message: "Valid tournament and team IDs are required" });
      }

      const entryResult = await db.execute(sql`
        select
          ce.id as "entryId",
          ce.user_id as "userId",
          coalesce(u.manager_team_name, u.name, u.email, 'Manager') as "teamName",
          coalesce(ce.total_score, 0)::float as "totalScore",
          ce.lineup_card_ids as "lineupCardIds",
          ce.captain_id as "captainId",
          coalesce(ce.tiebreak_meta, '{}'::jsonb) as "tiebreakMeta",
          ce.joined_at as "joinedAt",
          c.name as "competitionName",
          c.game_week as "gameWeek",
          c.status::text as "competitionStatus"
        from app.competition_entries ce
        join app.competitions c on c.id = ce.competition_id
        left join app.users u on u.id = ce.user_id
        where ce.competition_id = ${competitionId} and ce.id = ${entryId}
        limit 1
      `);
      const entry = rowsFromResult(entryResult)[0];
      if (!entry) return res.status(404).json({ message: "Tournament team not found" });

      const lineupCardIds = Array.isArray(entry.lineupCardIds)
        ? entry.lineupCardIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0)
        : [];
      const cardsResult = await db.execute(sql`
        select
          pc.id as "cardId",
          pc.player_id as "playerId",
          pc.rarity::text as rarity,
          pc.serial_id as "serialId",
          p.name,
          p.team,
          p.position::text as position,
          p.league,
          p.fpl_id as "fplId",
          p.code,
          p.web_name as "webName",
          p.image_url as "imageUrl",
          ordered.ordinality::int as "lineupOrder"
        from jsonb_array_elements_text(${JSON.stringify(lineupCardIds)}::jsonb)
          with ordinality as ordered(card_id, ordinality)
        join app.player_cards pc on pc.id = ordered.card_id::integer
        join app.players p on p.id = pc.player_id
        order by ordered.ordinality asc
      `);
      const [bootstrap, liveData, apiFootballDirectory] = await Promise.all([
        fplApi.bootstrap().catch(() => null),
        fplApi.getLiveGameweek(Number(entry.gameWeek || 1)).catch(() => null),
        loadApiFootballPlayerDirectory().catch(() => []),
      ]);
      const fplIndex = buildFplPlayerIndex(bootstrap || {});
      const liveByElementId = new Map<number, any>(
        (Array.isArray(liveData?.elements) ? liveData.elements : [])
          .map((element: any) => [Number(element.id), element]),
      );
      const snapshot = entry.tiebreakMeta?.scoring && Number(entry.tiebreakMeta.scoring.gameWeek || 0) === Number(entry.gameWeek || 0)
        ? entry.tiebreakMeta.scoring
        : null;
      const savedScores = new Map<number, any>(
        (Array.isArray(snapshot?.cardScores) ? snapshot.cardScores : [])
          .map((score: any) => [Number(score.cardId), score]),
      );
      const captainId = Number(entry.captainId || 0);
      const players = rowsFromResult(cardsResult).map((card: any) => {
        const matchedElement = fplIndex.resolve(card);
        const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;
        const apiPlayer = resolveApiFootballPlayer({ ...card, ...(canonical || {}) }, apiFootballDirectory);
        const position = apiPlayer?.position || canonical?.position || String(card.position || "");
        const elementId = Number(matchedElement?.id || 0);
        const liveElement = elementId ? liveByElementId.get(elementId) : null;
        const calculated = liveElement
          ? calculatePlayerScore(mapFplStatsToPlayerStats(liveElement), position)
          : null;
        const saved = savedScores.get(Number(card.cardId));
        const points = Number(saved?.score ?? calculated?.total_score ?? 0);
        const captain = Number(card.cardId) === captainId;
        const captainBonus = captain
          ? Number(snapshot?.captainBonus ?? Math.round(points * 0.1 * 100) / 100)
          : 0;
        const apiImage = apiPlayer ? apiFootballPhotoUrl(apiPlayer.apiPlayerId, apiPlayer.photo) : "";

        return {
          cardId: Number(card.cardId),
          playerId: Number(card.playerId),
          name: apiPlayer?.name || canonical?.name || String(card.name || "Unknown player"),
          team: apiPlayer?.team || canonical?.team || String(card.team || "Unknown club"),
          position,
          rarity: String(card.rarity || "common"),
          serialId: card.serialId || null,
          imageUrl: apiImage || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null),
          apiFootballId: apiPlayer?.apiPlayerId || null,
          elementId: elementId || null,
          captain,
          points,
          captainBonus,
          contribution: Math.round((points + captainBonus) * 100) / 100,
          breakdown: saved?.breakdown || calculated?.breakdown || {
            decisive: 0, performance: 0, penalties: 0, bonus: 0,
          },
          reasons: Array.isArray(saved?.reasons)
            ? saved.reasons
            : Array.isArray(calculated?.reasons)
              ? calculated.reasons
              : [],
          minutes: Number(liveElement?.stats?.minutes || 0),
          source: saved ? "official-gameweek-snapshot" : calculated ? "live-fpl-fallback" : "awaiting-match-data",
        };
      });

      return res.json({
        entryId: Number(entry.entryId),
        competitionId,
        competitionName: String(entry.competitionName || "Tournament"),
        gameWeek: Number(entry.gameWeek || 0),
        teamName: String(entry.teamName || "Manager"),
        totalScore: Number(entry.totalScore || 0),
        captainId,
        captainBonus: Number(snapshot?.captainBonus || 0),
        updatedAt: snapshot?.updatedAt || null,
        finalized: Boolean(snapshot?.final),
        players,
      });
    } catch (error: any) {
      console.error("Failed to fetch tournament team scoring:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch team scoring" });
    }
  });
  app.get("/api/marketplace", async (_req, res) => {
    try {
      const [result, bootstrap, apiFootballDirectory] = await Promise.all([
        db.execute(sql`select pc.*, p.name as player_name, p.team as player_team, p.position as player_position, p.image_url as player_image_url, p.fpl_id as player_fpl_id, p.code as player_code, p.photo as player_photo, p.web_name as player_web_name, p.nationality as player_nationality, p.league as player_league, p.overall as player_overall, p.total_points as player_total_points, p.form as player_form from app.player_cards pc join app.players p on p.id = pc.player_id where pc.for_sale = true order by pc.price asc nulls last, pc.id desc`),
        fplApi.bootstrap().catch(() => null),
        loadApiFootballPlayerDirectory().catch(() => []),
      ]);
      const fplIndex = buildFplPlayerIndex(bootstrap || {});
      const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : [];
      const listings = rows.map((row: any) => {
        const storedPlayer = { id: row.player_id, name: row.player_name, team: row.player_team, position: row.player_position, imageUrl: row.player_image_url, fplId: row.player_fpl_id, code: row.player_code, photo: row.player_photo, webName: row.player_web_name, nationality: row.player_nationality, league: row.player_league, overall: row.player_overall, totalPoints: row.player_total_points, form: row.player_form };
        const matchedElement = fplIndex.resolve(storedPlayer);
        const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;
        const apiFootballPlayer = resolveApiFootballPlayer({ ...storedPlayer, ...(canonical || {}) }, apiFootballDirectory);
        const apiFootballImage = apiFootballPlayer ? apiFootballPhotoUrl(apiFootballPlayer.apiPlayerId, apiFootballPlayer.photo) : "";
        const verifiedImageUrl = apiFootballImage || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null);
        const identityVerified = Boolean(apiFootballPlayer || matchedElement);
        const officialTotalPoints = matchedElement ? Number(matchedElement.total_points || 0) : null;
        const officialForm = matchedElement ? Number(matchedElement.form || 0) : null;
        const officialOverall = matchedElement ? overallFromFplElement(matchedElement) : null;
        return {
          ...row,
          totalPoints: officialTotalPoints,
          player: {
            ...storedPlayer,
            ...(canonical || {}),
            name: apiFootballPlayer?.name || canonical?.name || storedPlayer.name,
            team: apiFootballPlayer?.team || canonical?.team || storedPlayer.team,
            league: identityVerified ? "Premier League" : storedPlayer.league,
            position: apiFootballPlayer?.position || canonical?.position || storedPlayer.position,
            apiFootballId: apiFootballPlayer?.apiPlayerId || null,
            imageUrl: verifiedImageUrl,
            verifiedImageUrl,
            identityVerified,
            premierLeagueEligible: identityVerified,
            identitySource: apiFootballPlayer && matchedElement ? "fpl+api-football" : apiFootballPlayer ? "api-football-current-squad" : matchedElement ? "fpl" : "unverified-card-data",
            totalPoints: officialTotalPoints,
            form: officialForm,
            overall: officialOverall,
          },
        };
      });
      return res.json({ listings, cards: listings });
    } catch (error: any) {
      console.error("Failed to fetch marketplace listings:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch marketplace" });
    }
  });

  app.post("/api/marketplace/buy", requireAuth, async (req: any, res) => { const result = await processMarketplacePurchase(String(req.authUserId || ""), req.body?.cardId, req.body?.serialId, req.headers?.["x-idempotency-key"] || req.body?.idempotencyKey); if (!result.ok) return res.status(result.status).json({ message: result.message }); return res.json({ success: true, cardId: result.cardId, duplicate: result.duplicate }); });
  app.post("/api/marketplace/buy/:cardId", requireAuth, async (req: any, res) => { const result = await processMarketplacePurchase(String(req.authUserId || ""), req.params.cardId, req.body?.serialId, req.headers?.["x-idempotency-key"] || req.body?.idempotencyKey); if (!result.ok) return res.status(result.status).json({ message: result.message }); return res.json({ success: true, cardId: result.cardId, duplicate: result.duplicate }); });
}
