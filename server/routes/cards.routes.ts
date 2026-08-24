import type { Express } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { fplApi } from "../services/fplApi.js";
import { buildFplPlayerIndex, overallFromFplElement } from "../services/fplPlayerIdentity.js";
import { apiFootballPhotoUrl, getApiFootballPlayerProfileSnapshot, loadApiFootballPlayerDirectory, resolveApiFootballPlayer } from "../services/apiFootballPlayerDirectory.js";
import { loadDetailedScoringContext, resolveDetailedStatsForPlayer } from "../services/apiFootballScoringBridge.js";
import {
  calculatePlayerScore,
  mapFplStatsToPlayerStats,
  mergePlayerStatsWithDetailedStats,
} from "../services/scoring.js";
import { db } from "../db.js";
import { auditLogs, transactions } from "../../shared/schema.js";
import { getMarketplaceFloorPrice, isMarketplaceTradableRarity } from "../../shared/card-economy.js";

interface RegisterCardsRoutesDeps {
  requireAuth: any;
  storage: any;
}

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL).split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);

function normalizeLookupText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function lastScoresFallback(_card: any) {
  return [];
}

function safeClientEvent(raw: unknown) {
  return String(raw || "").trim().replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80) || "client_event";
}

async function isAdminUserForAudit(storage: any, req: any) {
  const userId = String(req.authUserId || "");
  if (!userId) return false;
  if (ADMIN_USER_IDS.includes(userId)) return true;
  try {
    const user = await storage.getUser(userId);
    const email = String(user?.email || req.user?.email || req.user?.claims?.email || "").trim().toLowerCase();
    return Boolean(email && ADMIN_EMAILS.includes(email));
  } catch {
    return false;
  }
}

export function registerCardsRoutes(app: Express, deps: RegisterCardsRoutesDeps) {
  const { requireAuth, storage } = deps;

  const sendUserCards = async (req: any, res: any) => {
    try {
      const userId = req.authUserId;
      // Collection is strictly read-only: starter cards are minted only after
      // the owner confirms their exact five onboarding player selections.
      const cards = await storage.getUserCards(userId);
      const [bootstrap, liveData, apiFootballDirectory] = await Promise.all([fplApi.bootstrap().catch(() => null), fplApi.getLiveGameweek().catch(() => null), loadApiFootballPlayerDirectory().catch(() => [])]);
      const fplIndex = buildFplPlayerIndex(bootstrap || {});
      const currentGameweek = Number((bootstrap as any)?.events?.find((event: any) => event?.is_current)?.id || await fplApi.getCurrentGameweek().catch(() => 0));
      const detailedScoringContext = await loadDetailedScoringContext(bootstrap || {}, currentGameweek);
      const liveElements = Array.isArray((liveData as any)?.elements) ? (liveData as any).elements : [];
      const liveByElementId = new Map<number, any>();
      for (const liveElement of liveElements) liveByElementId.set(Number(liveElement.id), liveElement);

      const enrichedCards = cards.map((card: any) => {
        const player = card.player as any;
        if (!player) return card;
        const matchedElement = fplIndex.resolve(player);
        const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;
        const apiFootballPlayer = resolveApiFootballPlayer({ ...player, ...(canonical || {}) }, apiFootballDirectory);
        const liveElement = matchedElement ? liveByElementId.get(Number(matchedElement.id)) : null;
        const identityVerified = Boolean(apiFootballPlayer || matchedElement);
        const currentPosition = canonical?.position || String(player.position || "") || apiFootballPlayer?.position || "MID";
        const outsidePremierLeague = !identityVerified
          && (String(player.league || "").toLowerCase() === "outside premier league"
            || String(player.status || "").toLowerCase() === "departed");
        const selectionProvider = apiFootballPlayer
          ? "api-football"
          : matchedElement
            ? "fpl-fallback"
            : null;
        let currentGameweekPoints = 0;
        let last5Scores = Array.isArray(card.last5Scores) ? card.last5Scores.map((value: any) => Number(value || 0)).slice(0, 5) : [];
        if (liveElement) {
          const verifiedPlayer = { ...player, ...(canonical || {}) };
          const detailedStats = resolveDetailedStatsForPlayer(verifiedPlayer, detailedScoringContext);
          const combinedStats = mergePlayerStatsWithDetailedStats(mapFplStatsToPlayerStats(liveElement), detailedStats);
          const verifiedPosition = String(canonical?.position || currentPosition || (detailedStats as any)?.api_position || "MID");
          const calculatedScore = calculatePlayerScore(combinedStats, verifiedPosition);
          currentGameweekPoints = Number(calculatedScore?.total_score || 0);
          const latestLiveScore = currentGameweekPoints;
          last5Scores = [latestLiveScore, ...last5Scores];
        }
        last5Scores = last5Scores.map((value: any) => Number(value || 0)).slice(0, 5);
        while (last5Scores.length < 5) last5Scores.push(0);

        const officialFplSeasonPoints = matchedElement ? Number(matchedElement.total_points || 0) : null;
        const totalPoints = identityVerified ? currentGameweekPoints : null;
        const form = identityVerified ? currentGameweekPoints : null;
        const overall = matchedElement ? overallFromFplElement(matchedElement) : null;
        const apiFootballImage = apiFootballPlayer ? apiFootballPhotoUrl(apiFootballPlayer.apiPlayerId, apiFootballPlayer.photo) : "";
        const fplImage = matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : "";

        return {
          ...card,
          totalPoints,
          currentGameweekPoints,
          officialFplSeasonPoints,
          last5Scores,
          player: {
            ...player,
            ...(canonical || {}),
            name: apiFootballPlayer?.name || canonical?.name || player.name,
            team: apiFootballPlayer?.team || canonical?.team || player.team,
            league: identityVerified ? "Premier League" : player.league,
            position: canonical?.position || player.position || apiFootballPlayer?.position || "MID",
            nationality: apiFootballPlayer?.nationality || player.nationality,
            apiFootballId: apiFootballPlayer?.apiPlayerId || null,
            officialPortraitUrl: fplImage || null,
            cutoutUrl: apiFootballImage || null,
            imageCandidates: Array.from(new Set([apiFootballImage, fplImage].filter(Boolean))),
            imageUrl: apiFootballImage || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null),
            verifiedImageUrl: apiFootballImage || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null),
            identityVerified: Boolean(apiFootballPlayer || matchedElement),
            premierLeagueEligible: identityVerified,
            premierLeagueStatus: identityVerified
              ? "active"
              : outsidePremierLeague
                ? "outside-premier-league"
                : "unverified",
            selectionEligibility: {
              eligible: identityVerified,
              provider: selectionProvider,
              code: identityVerified ? "eligible" : outsidePremierLeague ? "outside-premier-league" : "identity-unlinked",
              message: identityVerified
                ? `Eligible: linked by ${selectionProvider === "api-football" ? "API-Football current squads" : "FPL fallback"}.`
                : outsidePremierLeague
                  ? `${player.name} is outside the Premier League; use the same-position replacement card in this collection.`
                  : `${player.name} is not linked to API-Football or the FPL fallback yet.`,
            },
            identitySource: apiFootballPlayer && matchedElement ? "fpl+api-football" : apiFootballPlayer ? "api-football-current-squad" : matchedElement ? "fpl" : "unverified-card-data",
            totalPoints,
            currentGameweekPoints,
            officialFplSeasonPoints,
            form,
            overall,
          },
        };
      });
      return res.json({ cards: enrichedCards });
    } catch (error: any) {
      console.error("Fetch my cards failed:", error);
      return res.status(500).json({ message: "Failed to fetch my cards" });
    }
  };

  app.post("/api/audit/client-event", requireAuth, async (req: any, res: any) => {
    try {
      const userId = String(req.authUserId || "");
      const event = safeClientEvent(req.body?.event);
      const path = String(req.body?.path || "").slice(0, 250);
      const meta = { event, path, title: String(req.body?.title || "").slice(0, 200), ts: req.body?.ts || null, userAgent: String(req.headers["user-agent"] || "").slice(0, 240), ip: String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").slice(0, 120) };
      await db.insert(auditLogs).values({ userId, action: `client.${event}`, meta } as any);
      return res.json({ success: true });
    } catch (error) {
      console.warn("Client audit event failed:", error);
      return res.json({ success: false });
    }
  });

  app.get("/api/admin/audit-events", requireAuth, async (req: any, res: any) => {
    try {
      if (!(await isAdminUserForAudit(storage, req))) return res.status(403).json({ message: "Admin access required" });
      const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200)));
      const userId = String(req.query.userId || "").trim();
      const action = String(req.query.action || "").trim();
      const userPattern = userId ? `%${userId}%` : "%%";
      const actionPattern = action ? `%${action}%` : "%%";
      const result = await db.execute(sql`
        select l.id, l.user_id as "userId", u.email as "userEmail", coalesce(u.name, concat_ws(' ', u.first_name, u.last_name)) as "userName", l.action, l.meta, l.created_at as "createdAt"
        from app.audit_logs l
        left join app.users u on u.id = l.user_id
        where (${userId} = '' or l.user_id ilike ${userPattern} or coalesce(u.email, '') ilike ${userPattern})
          and (${action} = '' or l.action ilike ${actionPattern})
        order by l.created_at desc nulls last, l.id desc
        limit ${limit}
      `);
      const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : [];
      return res.json({ auditEvents: rows, limit, filters: { userId, action } });
    } catch (error: any) {
      console.error("Failed to fetch audit events:", error);
      return res.status(500).json({ message: "Failed to fetch audit events" });
    }
  });

  app.get("/api/cards/my", requireAuth, sendUserCards);
  app.get("/api/user/cards", requireAuth, sendUserCards);

  app.get("/api/cards/:cardId/profile", requireAuth, async (req: any, res: any) => {
    try {
      const viewerUserId = String(req.authUserId || "");
      const cardId = Number(req.params.cardId);
      if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Valid cardId required" });
      let card = await storage.getPlayerCardWithPlayer(cardId, viewerUserId);
      if (!card) {
        const rawCard = await storage.getPlayerCard(cardId);
        const player = rawCard ? await storage.getPlayer(Number(rawCard.playerId)) : null;
        if (rawCard && player) card = { ...rawCard, player } as any;
      }
      if (!card) return res.status(404).json({ message: "Card not found" });
      const player = card.player || {};
      const [lastSaleTransaction] = await db
        .select({ grossAmount: transactions.grossAmount, amount: transactions.amount })
        .from(transactions)
        .where(and(sql`${transactions.type}::text in ('sale', 'marketplace_sale')`, sql`${transactions.description} ilike ${`%card:${cardId}%`}`))
        .orderBy(desc(transactions.createdAt))
        .limit(1);
      const lastSaleValue = Number(lastSaleTransaction?.grossAmount || lastSaleTransaction?.amount || 0) || null;
      const replacementTable = await db.execute(sql`select to_regclass('app.departed_player_card_replacements') as name`);
      const replacementTableRows = Array.isArray((replacementTable as any)?.rows) ? (replacementTable as any).rows : [];
      let departureReplacement: any = null;
      if (replacementTableRows[0]?.name) {
        const replacementResult = await db.execute(sql`
          select replacement.id as "cardId", replacement.serial_id as "serialId",
            replacement.rarity::text as rarity, replacement_player.id as "playerId",
            replacement_player.name as "playerName", replacement_player.team,
            replacement_player.position::text as position
          from app.departed_player_card_replacements link
          join app.player_cards replacement on replacement.id=link.replacement_card_id
          join app.players replacement_player on replacement_player.id=replacement.player_id
          where link.source_card_id=${cardId}
          limit 1
        `);
        const replacementRows = Array.isArray((replacementResult as any)?.rows) ? (replacementResult as any).rows : [];
        departureReplacement = replacementRows[0] || null;
      }
      const [bootstrap, apiFootballDirectory, liveData, ownershipResult] = await Promise.all([
        fplApi.bootstrap().catch(() => null),
        loadApiFootballPlayerDirectory().catch(() => []),
        fplApi.getLiveGameweek().catch(() => null),
        db.execute(sql`
          select
            count(distinct pc.owner_id)::integer as "owners",
            (select count(*)::integer from app.users) as "managers"
          from app.player_cards pc
          where pc.player_id = ${Number(card.playerId || player.id || 0)}
            and pc.owner_id is not null
        `).catch(() => null),
      ]);
      const ownershipRow = Array.isArray((ownershipResult as any)?.rows) ? (ownershipResult as any).rows[0] || {} : {};
      const arenaOwners = Number(ownershipRow.owners || 0);
      const arenaManagers = Number(ownershipRow.managers || 0);
      const arenaOwnership = arenaManagers > 0 ? Number(((arenaOwners / arenaManagers) * 100).toFixed(2)) : null;
      const fplIndex = buildFplPlayerIndex(bootstrap || {});
      const teamShortById = new Map<number, string>();
      for (const team of fplIndex.teams) teamShortById.set(Number(team.id), String(team.short_name || team.name || `T${team.id}`));
      const matchedElement = fplIndex.resolve(player);
      const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;
      const apiSnapshot = await getApiFootballPlayerProfileSnapshot({ ...player, ...(canonical || {}) }, apiFootballDirectory).catch(() => null);

      if (!matchedElement) {
        if (apiSnapshot) return res.json({ ...apiSnapshot, stats: { ...apiSnapshot.stats, selectedBy: arenaOwnership, ownershipCount: arenaOwners, ownershipManagerCount: arenaManagers, value: lastSaleValue } });
        const outsidePremierLeague = String(player.league || "").toLowerCase() === "outside premier league"
          || String(player.status || "").toLowerCase() === "departed";
        return res.json({
          source: "card-fallback",
          replacement: departureReplacement,
          providers: { identity: outsidePremierLeague ? "Outside Premier League" : "Unverified legacy card data", stats: "No official match link" },
          player: {
            name: player.name,
            team: player.team,
            league: player.league,
            position: player.position,
            status: player.status,
            news: player.news || (outsidePremierLeague ? `${player.name} is no longer in a current Premier League squad.` : ""),
            imageUrl: null,
            verifiedImageUrl: null,
            identityVerified: false,
            premierLeagueEligible: false,
            premierLeagueStatus: outsidePremierLeague ? "outside-premier-league" : "unverified",
            identitySource: "unverified-card-data",
          },
          last10: [],
          stats: { matchesPlayed: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, bonus: 0, totalPoints: 0, selectedBy: null, value: lastSaleValue, saves: 0, averageRating: null },
        });
      }

      const currentGameweek = Number((bootstrap as any)?.events?.find((event: any) => event?.is_current)?.id || await fplApi.getCurrentGameweek().catch(() => 0));
      const liveElement = (Array.isArray((liveData as any)?.elements) ? (liveData as any).elements : []).find((element: any) => Number(element.id) === Number(matchedElement.id));
      const detailedScoringContext = liveElement ? await loadDetailedScoringContext(bootstrap || {}, currentGameweek) : null;
      const detailedStats = liveElement && detailedScoringContext ? resolveDetailedStatsForPlayer({ ...player, ...(canonical || {}) }, detailedScoringContext) : null;
      const scoringPosition = String(canonical?.position || player.position || (detailedStats as any)?.api_position || "MID");
      const arenaGameweekPoints = liveElement
        ? Number(calculatePlayerScore(mergePlayerStatsWithDetailedStats(mapFplStatsToPlayerStats(liveElement), detailedStats), scoringPosition).total_score || 0)
        : 0;
      const summary = await fplApi.playerSummary(Number(matchedElement.id));
      const history = Array.isArray(summary?.history) ? summary.history : [];
      const verifiedApiHistory = new Map<number, any>((Array.isArray(apiSnapshot?.last10) ? apiSnapshot.last10 : []).map((match: any): [number, any] => [Number(match.gameweek), match]));
      const last10 = history.slice(-10).map((row: any) => ({
        gameweek: Number(row.round || row.event || 0),
        opponent: teamShortById.get(Number(row.opponent_team)) || `T${row.opponent_team}`,
        points: Number(verifiedApiHistory.get(Number(row.round || row.event || 0))?.points
          ?? calculatePlayerScore(mapFplStatsToPlayerStats({ stats: row }), scoringPosition).total_score
          ?? 0),
        minutes: Number(row.minutes || 0),
        goals: Number(row.goals_scored || 0),
        assists: Number(row.assists || 0),
        cleanSheets: Number(row.clean_sheets || 0),
        yellowCards: Number(row.yellow_cards || 0),
        redCards: Number(row.red_cards || 0),
        bonus: Number(row.bonus || 0),
        kickoffTime: row.kickoff_time || null,
        wasHome: Boolean(row.was_home),
      }));
      const verifiedIdentity = apiSnapshot?.player || null;
      const verifiedImageUrl = verifiedIdentity?.imageUrl || fplApi.playerPhotoUrl(matchedElement, 250);
      return res.json({
        source: "fpl-live",
        fplElementId: Number(matchedElement.id),
        season: apiSnapshot?.season || null,
        providers: {
          identity: verifiedIdentity ? "API-Football current squads" : "Fantasy Premier League player list",
          stats: "API-Football match actions with official FPL fallback",
          fantasyPoints: "Fantasy Arena scoring",
        },
        player: {
          ...canonical,
          name: canonical?.name,
          team: canonical?.team || verifiedIdentity?.team,
          position: canonical?.position || player.position || verifiedIdentity?.position,
          imageUrl: verifiedImageUrl,
          verifiedImageUrl,
          nationality: verifiedIdentity?.nationality,
          apiFootballId: verifiedIdentity?.apiFootballId,
          status: matchedElement.status,
          news: matchedElement.news || "",
        },
        last10,
        stats: {
          matchesPlayed: Number(matchedElement.starts || 0), minutes: Number(matchedElement.minutes || 0),
          goals: Number(matchedElement.goals_scored || 0), assists: Number(matchedElement.assists || 0),
          cleanSheets: Number(matchedElement.clean_sheets || 0), yellowCards: Number(matchedElement.yellow_cards || 0),
          redCards: Number(matchedElement.red_cards || 0), bonus: Number(matchedElement.bonus || 0),
          totalPoints: arenaGameweekPoints, arenaGameweekPoints,
          officialFplSeasonPoints: Number(matchedElement.total_points || 0),
          selectedBy: arenaOwnership, ownershipCount: arenaOwners, ownershipManagerCount: arenaManagers,
          value: lastSaleValue, saves: Number(matchedElement.saves || 0), averageRating: apiSnapshot?.stats?.averageRating || null,
        },
      });
    } catch (error: any) {
      console.error("Failed to fetch card profile:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch card profile" });
    }
  });

  app.post("/api/marketplace/list", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const cardId = Number(req.body?.cardId);
      const price = toMoney(req.body?.price);
      if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Valid cardId required" });
      const card = await storage.getPlayerCard(cardId);
      if (!card) return res.status(404).json({ message: "Card not found" });
      if (String(card.ownerId || "") !== userId) return res.status(403).json({ message: "You do not own this card" });
      if (!isMarketplaceTradableRarity(String(card.rarity))) return res.status(400).json({ message: "Common cards cannot be sold" });
      const floor = getMarketplaceFloorPrice(String(card.rarity));
      if (floor > 0 && price < floor) return res.status(400).json({ message: `Minimum price for ${card.rarity} cards is N$${floor}` });
      await storage.updatePlayerCard(cardId, { forSale: true, price } as any);
      return res.json({ success: true, cardId, price });
    } catch (error: any) {
      console.error("Failed to list marketplace card:", error);
      return res.status(500).json({ message: error?.message || "Failed to list card" });
    }
  });

  app.post("/api/marketplace/cancel/:cardId", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const cardId = Number(req.params.cardId);
      if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Valid cardId required" });
      const card = await storage.getPlayerCard(cardId);
      if (!card) return res.status(404).json({ message: "Card not found" });
      if (String(card.ownerId || "") !== userId) return res.status(403).json({ message: "You do not own this card" });
      await storage.updatePlayerCard(cardId, { forSale: false, price: 0 } as any);
      return res.json({ success: true, cardId });
    } catch (error: any) {
      console.error("Failed to cancel marketplace listing:", error);
      return res.status(500).json({ message: error?.message || "Failed to cancel listing" });
    }
  });
}
