#!/usr/bin/env node
import fs from "node:fs";

const MARKER = "API_FOOTBALL_PLAYER_CARDS_ONLY_V2";

const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, source) => fs.writeFileSync(file, source);

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not patch ${label}: source anchor missing`);
  return source.replace(from, to);
}

function replaceBetween(source, start, end, replacement, label) {
  if (source.includes(replacement.trim())) return source;
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || b <= a) throw new Error(`Could not patch ${label}: section anchors missing`);
  return `${source.slice(0, a)}${replacement}${source.slice(b)}`;
}

// Preserve onboarding pack order exactly: GK, DEF, MID, FWD, Utility.
{
  const file = "server/routes/onboarding.routes.ts";
  let source = read(file);
  source = replaceRequired(
    source,
    "      const grantResult = await ensureStarterCards(userId, selected);\n      await storage.updateOnboarding(userId, { selectedCards: selected, completed: true } as any);",
    [
      `      // ${MARKER}: pack order is the canonical Collection order.`,
      "      const orderedSelected = ob.packCards",
      "        .map((pack: number[]) => selected.find((id) => pack.includes(id)))",
      "        .filter((id): id is number => Number.isInteger(id));",
      "      if (orderedSelected.length !== 5) return res.status(400).json({ message: \"Could not resolve starter pack order\" });",
      "",
      "      const grantResult = await ensureStarterCards(userId, orderedSelected);",
      "      await storage.updateOnboarding(userId, { selectedCards: orderedSelected, completed: true } as any);",
    ].join("\n"),
    "onboarding pack order",
  );
  write(file, source);
}

// Use API-Football only for player identity, portraits and displayed player statistics.
// FPL is intentionally retained elsewhere for Fantasy Arena scoring/gameweek mechanics.
{
  const file = "server/routes/cards.routes.ts";
  let source = read(file);
  source = source
    .replace('import { fplApi } from "../services/fplApi.js";\n', "")
    .replace('import { buildFplPlayerIndex, overallFromFplElement } from "../services/fplPlayerIdentity.js";\n', "")
    .replace('import {\n  calculatePlayerScore,\n  mapFplStatsToPlayerStats,\n} from "../services/scoring.js";\n', "");

  const sendReplacement = [
    "  const sendUserCards = async (req: any, res: any) => {",
    "    try {",
    "      const userId = String(req.authUserId || \"\");",
    "      const cards = await ensureStarterCards(userId);",
    "      const [apiFootballDirectory, onboardingResult] = await Promise.all([",
    "        loadApiFootballPlayerDirectory().catch(() => []),",
    "        db.execute(sql`",
    "          SELECT selected_cards AS \"selectedCards\"",
    "          FROM app.user_onboarding",
    "          WHERE user_id = ${userId}",
    "          LIMIT 1",
    "        `).catch(() => ({ rows: [] } as any)),",
    "      ]);",
    "",
    `      // ${MARKER}: saved onboarding player IDs control the first five Collection slots.`,
    "      const onboardingRows = Array.isArray((onboardingResult as any)?.rows) ? (onboardingResult as any).rows : [];",
    "      const selectedCardsRaw = onboardingRows[0]?.selectedCards;",
    "      const starterPlayerIds = Array.isArray(selectedCardsRaw)",
    "        ? selectedCardsRaw.map((value: any) => Number(value)).filter((value: number) => Number.isInteger(value) && value > 0).slice(0, 5)",
    "        : [];",
    "      const starterOrder = new Map(starterPlayerIds.map((playerId: number, index: number) => [playerId, index]));",
    "      const starterSlots = [\"GK\", \"DEF\", \"MID\", \"FWD\", \"UTILITY\"] as const;",
    "",
    "      const enrichedCards = cards.map((card: any) => {",
    "        const player = card.player as any;",
    "        if (!player) return card;",
    "        const apiFootballPlayer = resolveApiFootballPlayer(player, apiFootballDirectory);",
    "        const apiFootballImage = apiFootballPlayer ? apiFootballPhotoUrl(apiFootballPlayer.apiPlayerId, apiFootballPlayer.photo) : \"\";",
    "        const slotIndex = starterOrder.get(Number(card.playerId || player.id));",
    "        return {",
    "          ...card,",
    "          totalPoints: null,",
    "          last5Scores: [],",
    "          onboardingSlot: slotIndex === undefined ? null : starterSlots[slotIndex],",
    "          player: {",
    "            ...player,",
    "            name: apiFootballPlayer?.name || player.name,",
    "            team: apiFootballPlayer?.team || player.team,",
    "            position: apiFootballPlayer?.position || player.position,",
    "            nationality: apiFootballPlayer?.nationality || player.nationality,",
    "            apiFootballId: apiFootballPlayer?.apiPlayerId || null,",
    "            imageUrl: apiFootballImage || null,",
    "            verifiedImageUrl: apiFootballImage || null,",
    "            identityVerified: Boolean(apiFootballPlayer),",
    "            identitySource: apiFootballPlayer ? \"api-football-current-squad\" : \"unverified-card-data\",",
    "            statsVerified: false,",
    "            totalPoints: null,",
    "            form: null,",
    "          },",
    "        };",
    "      }).sort((a: any, b: any) => {",
    "        const aIndex = starterOrder.get(Number(a.playerId || a.player?.id));",
    "        const bIndex = starterOrder.get(Number(b.playerId || b.player?.id));",
    "        if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;",
    "        if (aIndex !== undefined) return -1;",
    "        if (bIndex !== undefined) return 1;",
    "        return Number(a.id || 0) - Number(b.id || 0);",
    "      });",
    "",
    "      return res.json({ cards: enrichedCards });",
    "    } catch (error: any) {",
    "      console.error(\"Fetch my cards failed:\", error);",
    "      return res.status(500).json({ message: \"Failed to fetch my cards\" });",
    "    }",
    "  };",
    "",
  ].join("\n");
  source = replaceBetween(source, "  const sendUserCards = async (req: any, res: any) => {", "  app.post(\"/api/audit/client-event\"", sendReplacement, "collection player provider");

  const profileReplacement = [
    "  app.get(\"/api/cards/:cardId/profile\", requireAuth, async (req: any, res: any) => {",
    "    try {",
    "      const viewerUserId = String(req.authUserId || \"\");",
    "      const cardId = Number(req.params.cardId);",
    "      if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: \"Valid cardId required\" });",
    "      let card = await storage.getPlayerCardWithPlayer(cardId, viewerUserId);",
    "      if (!card) {",
    "        const rawCard = await storage.getPlayerCard(cardId);",
    "        const player = rawCard ? await storage.getPlayer(Number(rawCard.playerId)) : null;",
    "        if (rawCard && player) card = { ...rawCard, player } as any;",
    "      }",
    "      if (!card) return res.status(404).json({ message: \"Card not found\" });",
    "",
    "      const player = card.player || {};",
    "      const [lastSaleTransaction] = await db",
    "        .select({ grossAmount: transactions.grossAmount, amount: transactions.amount })",
    "        .from(transactions)",
    "        .where(and(eq(transactions.type, \"sale\" as any), sql`${transactions.description} ilike ${`%card:${cardId}%`}`))",
    "        .orderBy(desc(transactions.createdAt))",
    "        .limit(1);",
    "      const lastSaleValue = Number(lastSaleTransaction?.grossAmount || lastSaleTransaction?.amount || 0) || null;",
    "",
    "      const apiFootballDirectory = await loadApiFootballPlayerDirectory().catch(() => []);",
    "      const apiSnapshot = await getApiFootballPlayerProfileSnapshot(player, apiFootballDirectory).catch(() => null);",
    "      if (apiSnapshot) {",
    "        return res.json({",
    "          ...apiSnapshot,",
    "          source: \"api-football\",",
    "          providers: {",
    "            identity: \"API-Football current squads\",",
    "            stats: \"API-Football Premier League match statistics\",",
    "            fantasyPoints: \"Fantasy Arena scoring\",",
    "          },",
    "          stats: { ...apiSnapshot.stats, value: lastSaleValue },",
    "        });",
    "      }",
    "",
    "      return res.json({",
    "        source: \"card-fallback\",",
    "        providers: {",
    "          identity: \"Awaiting API-Football current-squad link\",",
    "          stats: \"No API-Football Premier League match link\",",
    "          fantasyPoints: \"Unavailable until API-Football identity is verified\",",
    "        },",
    "        player: {",
    "          name: player.name, team: player.team, position: player.position,",
    "          imageUrl: null, verifiedImageUrl: null, identityVerified: false, identitySource: \"unverified-card-data\",",
    "        },",
    "        last10: [],",
    "        stats: {",
    "          matchesPlayed: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0,",
    "          yellowCards: 0, redCards: 0, bonus: 0, totalPoints: 0, selectedBy: null,",
    "          value: lastSaleValue, saves: 0, averageRating: null,",
    "        },",
    "      });",
    "    } catch (error: any) {",
    "      console.error(\"Failed to fetch card profile:\", error);",
    "      return res.status(500).json({ message: error?.message || \"Failed to fetch card profile\" });",
    "    }",
    "  });",
    "",
  ].join("\n");
  source = replaceBetween(source, "  app.get(\"/api/cards/:cardId/profile\"", "  app.post(\"/api/marketplace/list\"", profileReplacement, "player profile endpoint");
  write(file, source);
}

// API-Football/Arena-only labels and metrics in the full card profile modal.
{
  const file = "client/src/components/cards/CardProfileModal.tsx";
  let source = read(file);
  source = replaceRequired(
    source,
    [
      "function sourceLabel(data: CardProfileData) {",
      "  if (data.source === \"api-football\") return \"API-Football verified\";",
      "  if (data.source === \"fpl-live\" && data.providers?.identity?.includes(\"API-Football\")) return \"FPL + API verified\";",
      "  if (data.source === \"fpl-live\") return \"FPL live linked\";",
      "  return \"Awaiting official link\";",
      "}",
    ].join("\n"),
    [
      "function sourceLabel(data: CardProfileData) {",
      "  if (data.source === \"api-football\") return \"API-Football verified\";",
      "  return \"Awaiting API-Football link\";",
      "}",
    ].join("\n"),
    "provider badge",
  );
  source = source.replace('identitySource: identityVerified ? (data.source === "api-football" ? "api-football" : "fpl") : "unverified-card-data",', 'identitySource: identityVerified ? "api-football" : "unverified-card-data",');
  source = source.replace('const totalPointsLabel = data.source === "fpl-live" ? "FPL Points" : data.source === "api-football" ? "Arena Score" : "Points";', 'const totalPointsLabel = data.source === "api-football" ? "Arena Score" : "Points";');
  source = source.replace('<HeroStat icon={<TrendingUp className="h-4 w-4" />} label="Ownership" value={data.stats.selectedBy ? `${data.stats.selectedBy}%` : "—"} />', '<HeroStat icon={<TrendingUp className="h-4 w-4" />} label="Matches" value={officialStat(data, data.stats.matchesPlayed)} />');
  source = source.replace('<HeroStat icon={<Award className="h-4 w-4" />} label={data.source === "api-football" ? "Avg Rating" : "Bonus"} value={data.source === "api-football" ? officialStat(data, data.stats.averageRating, 1) : officialStat(data, data.stats.bonus)} />', '<HeroStat icon={<Award className="h-4 w-4" />} label="Avg Rating" value={officialStat(data, data.stats.averageRating, 1)} />');
  source = source.replace('<th className="px-3 py-3">B</th>', '<th className="px-3 py-3">RTG</th>');
  source = source.replace('<td className="px-3 py-3">{item.bonus || 0}</td>', '<td className="px-3 py-3">{item.rating == null ? "—" : Number(item.rating).toFixed(1)}</td>');
  source = source.replace('<Stat icon={<Award className="h-4 w-4" />} label="Bonus" value={officialStat(data, data.stats.bonus)} />', '<Stat icon={<Award className="h-4 w-4" />} label="Avg rating" value={officialStat(data, data.stats.averageRating, 1)} />');
  if (!source.includes(MARKER)) source = source.replace("export type CardProfileData = {", `// ${MARKER}: displayed player data comes from API-Football, not FPL.\nexport type CardProfileData = {`);
  write(file, source);
}

// Hydrate compact card stats from the API-Football-backed profile endpoint.
{
  const file = "client/src/components/cards/PremiumFootballCard.tsx";
  let source = read(file);
  source = source.replace("    totalPoints?: number;\n  };", "    totalPoints?: number;\n    averageRating?: number | null;\n    matchesPlayed?: number;\n  };");
  source = replaceRequired(
    source,
    "      totalPoints: data.stats?.totalPoints ?? player.totalPoints,",
    [
      "      totalPoints: data.stats?.totalPoints ?? player.totalPoints,",
      "      rating: data.stats?.averageRating ?? player.rating,",
      "      form: data.stats?.averageRating ?? player.form,",
      "      matchesPlayed: data.stats?.matchesPlayed ?? (player as any).matchesPlayed,",
    ].join("\n"),
    "compact API-Football stats",
  );
  if (!source.includes(MARKER)) source = source.replace("type ProfileData = {", `// ${MARKER}: compact cards hydrate their stats from API-Football.\ntype ProfileData = {`);
  write(file, source);
}

// Heavy edge fade + multiply blend suppresses white provider image backgrounds without generating new images.
{
  const file = "client/src/components/cards/CollectionStableCard.tsx";
  let source = read(file);
  source = replaceRequired(
    source,
    "function isFallbackImage(image: string) {\n  return image.includes(\"/players/fallback\") || image.includes(\"fallback.svg\");\n}",
    "function isFallbackImage(image: string) {\n  return image.includes(\"/players/fallback\") || image.includes(\"fallback.svg\");\n}\n\nfunction isApiFootballPortrait(image: string) {\n  return image.includes(\"media.api-sports.io/football/players/\");\n}",
    "API-Football portrait detector",
  );
  source = source.replace("  const fallback = isFallbackImage(image);\n  const rarityLabel", "  const fallback = isFallbackImage(image);\n  const apiFootballPortrait = isApiFootballPortrait(image);\n  const rarityLabel");
  source = source.replace(
    "  const ovr: number | string = statsVerified ? numberStat(player.rating) : \"—\";\n  const points: number | string = statsVerified ? numberStat(player.totalPoints) : \"—\";\n  const form: number | string = statsVerified ? decimalStat(player.form) : \"—\";",
    "  const rating: number | string = statsVerified ? decimalStat(player.rating) : \"—\";\n  const points: number | string = statsVerified ? numberStat(player.totalPoints) : \"—\";\n  const matches: number | string = statsVerified ? numberStat((player as any).matchesPlayed) : \"—\";",
  );
  source = source.replace(
    '<StatChip label="A-OVR" value={ovr} scale={scale} glow={palette.glow} />\n            <StatChip label="PTS" value={points} scale={scale} glow={palette.glow} />\n            <StatChip label="FORM" value={form} scale={scale} glow={palette.glow} />',
    '<StatChip label="RTG" value={rating} scale={scale} glow={palette.glow} />\n            <StatChip label="PTS" value={points} scale={scale} glow={palette.glow} />\n            <StatChip label="MATCH" value={matches} scale={scale} glow={palette.glow} />',
  );
  const oldImg = '<img src={image} alt={player.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: fallback ? "contain" : "cover", objectPosition: "center top", display: "block", padding: fallback ? `${18 * scale}px ${18 * scale}px 0` : 0, filter: fallback ? "saturate(.94) contrast(1.08) brightness(1.06)" : "saturate(1.12) contrast(1.10) brightness(1.05)", transform: fallback ? "scale(.78)" : "scale(.86)" }} />';
  const newImg = '<img src={image} alt={player.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: fallback ? "contain" : "cover", objectPosition: "center top", display: "block", padding: fallback ? `${18 * scale}px ${18 * scale}px 0` : 0, filter: fallback ? "saturate(.94) contrast(1.08) brightness(1.06)" : apiFootballPortrait ? "saturate(1.18) contrast(1.20) brightness(1.18)" : "saturate(1.12) contrast(1.10) brightness(1.05)", transform: fallback ? "scale(.78)" : apiFootballPortrait ? "scale(.92)" : "scale(.86)", mixBlendMode: apiFootballPortrait ? "multiply" : "normal", WebkitMaskImage: apiFootballPortrait ? "radial-gradient(ellipse 72% 92% at 50% 38%, #000 45%, rgba(0,0,0,.94) 58%, rgba(0,0,0,.48) 77%, transparent 100%)" : undefined, maskImage: apiFootballPortrait ? "radial-gradient(ellipse 72% 92% at 50% 38%, #000 45%, rgba(0,0,0,.94) 58%, rgba(0,0,0,.48) 77%, transparent 100%)" : undefined }} />';
  source = replaceRequired(source, oldImg, newImg, "portrait background fade");
  if (!source.includes(MARKER)) source = source.replace('import { normalizeRarity } from "./cardTheme";', `import { normalizeRarity } from "./cardTheme";\n\n// ${MARKER}: API-Football portraits use CSS blend/mask fading to suppress white backgrounds.`);
  write(file, source);
}

console.log("Applied API-Football-only player cards, onboarding order and portrait fade.");
