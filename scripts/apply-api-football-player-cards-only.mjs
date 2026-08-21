#!/usr/bin/env node
import fs from "node:fs";

const MARKER = "API_FOOTBALL_PLAYER_CARDS_ONLY_V1";

function read(file) { return fs.readFileSync(file, "utf8"); }
function write(file, source) { fs.writeFileSync(file, source); }
function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not patch ${label}: source anchor missing`);
  return source.replace(from, to);
}
function replaceBetween(source, start, end, replacement, label) {
  if (source.includes(replacement.trim())) return source;
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0 || to <= from) throw new Error(`Could not patch ${label}: section anchors missing`);
  return `${source.slice(0, from)}${replacement}${source.slice(to)}`;
}

// 1) Persist onboarding selections in the actual pack order: GK, DEF, MID, FWD, Utility.
{
  const file = "server/routes/onboarding.routes.ts";
  let source = read(file);
  source = replaceRequired(
    source,
    `      const grantResult = await ensureStarterCards(userId, selected);\n      await storage.updateOnboarding(userId, { selectedCards: selected, completed: true } as any);`,
    `      // ${MARKER}: pack order is the canonical starter order shown in Collection.\n      const orderedSelected = ob.packCards\n        .map((pack: number[]) => selected.find((id) => pack.includes(id)))\n        .filter((id): id is number => Number.isInteger(id));\n      if (orderedSelected.length !== 5) return res.status(400).json({ message: "Could not resolve starter pack order" });\n\n      const grantResult = await ensureStarterCards(userId, orderedSelected);\n      await storage.updateOnboarding(userId, { selectedCards: orderedSelected, completed: true } as any);`,
    "onboarding selection order",
  );
  write(file, source);
}

// 2) Player collection/profile payloads use API-Football only. FPL remains elsewhere for fantasy scoring/fixtures.
{
  const file = "server/routes/cards.routes.ts";
  let source = read(file);
  source = source
    .replace(`import { fplApi } from "../services/fplApi.js";\n`, "")
    .replace(`import { buildFplPlayerIndex, overallFromFplElement } from "../services/fplPlayerIdentity.js";\n`, "")
    .replace(`import {\n  calculatePlayerScore,\n  mapFplStatsToPlayerStats,\n} from "../services/scoring.js";\n`, "");

  const sendReplacement = `  const sendUserCards = async (req: any, res: any) => {\n    try {\n      const userId = String(req.authUserId || "");\n      const cards = await ensureStarterCards(userId);\n      const apiFootballDirectory = await loadApiFootballPlayerDirectory().catch(() => []);\n      const onboardingRow = (Array.isArray((await db.execute(sql\`\n        SELECT selected_cards AS "selectedCards"\n        FROM app.user_onboarding\n        WHERE user_id = \${userId}\n        LIMIT 1\n      \`) as any)?.rows) ? (await Promise.resolve(null)) : null);\n\n      // Read once without any FPL bootstrap/live request.\n      const onboardingResult = await db.execute(sql\`\n        SELECT selected_cards AS "selectedCards"\n        FROM app.user_onboarding\n        WHERE user_id = \${userId}\n        LIMIT 1\n      \`);\n      const onboardingRows = Array.isArray((onboardingResult as any)?.rows) ? (onboardingResult as any).rows : [];\n      const selectedCardsRaw = onboardingRows[0]?.selectedCards;\n      const starterPlayerIds = Array.isArray(selectedCardsRaw)\n        ? selectedCardsRaw.map((value: any) => Number(value)).filter((value: number) => Number.isInteger(value) && value > 0).slice(0, 5)\n        : [];\n      const starterOrder = new Map(starterPlayerIds.map((playerId: number, index: number) => [playerId, index]));\n      const starterSlots = ["GK", "DEF", "MID", "FWD", "UTILITY"] as const;\n\n      const enrichedCards = cards.map((card: any) => {\n        const player = card.player as any;\n        if (!player) return card;\n        const apiFootballPlayer = resolveApiFootballPlayer(player, apiFootballDirectory);\n        const apiFootballImage = apiFootballPlayer ? apiFootballPhotoUrl(apiFootballPlayer.apiPlayerId, apiFootballPlayer.photo) : "";\n        const slotIndex = starterOrder.get(Number(card.playerId || player.id));\n        return {\n          ...card,\n          totalPoints: null,\n          last5Scores: [],\n          onboardingSlot: slotIndex === undefined ? null : starterSlots[slotIndex],\n          player: {\n            ...player,\n            name: apiFootballPlayer?.name || player.name,\n            team: apiFootballPlayer?.team || player.team,\n            position: apiFootballPlayer?.position || player.position,\n            nationality: apiFootballPlayer?.nationality || player.nationality,\n            apiFootballId: apiFootballPlayer?.apiPlayerId || null,\n            imageUrl: apiFootballImage || null,\n            verifiedImageUrl: apiFootballImage || null,\n            identityVerified: Boolean(apiFootballPlayer),\n            identitySource: apiFootballPlayer ? "api-football-current-squad" : "unverified-card-data",\n            statsVerified: false,\n            totalPoints: null,\n            form: null,\n          },\n        };\n      }).sort((a: any, b: any) => {\n        const aIndex = starterOrder.get(Number(a.playerId || a.player?.id));\n        const bIndex = starterOrder.get(Number(b.playerId || b.player?.id));\n        if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;\n        if (aIndex !== undefined) return -1;\n        if (bIndex !== undefined) return 1;\n        return Number(a.id || 0) - Number(b.id || 0);\n      });\n\n      return res.json({ cards: enrichedCards });\n    } catch (error: any) {\n      console.error("Fetch my cards failed:", error);\n      return res.status(500).json({ message: "Failed to fetch my cards" });\n    }\n  };\n\n`;
  source = replaceBetween(source, "  const sendUserCards = async (req: any, res: any) => {", "  app.post(\"/api/audit/client-event\"", sendReplacement, "API-Football collection payload");

  // Remove one accidental no-op query expression from the generated replacement while keeping the readable single query below.
  source = source.replace(/      const onboardingRow = \(Array\.isArray\([\s\S]*?await Promise\.resolve\(null\)\) : null\);\n\n      \/\/ Read once without any FPL bootstrap\/live request\.\n/, `      // ${MARKER}: collection order comes from the saved onboarding player IDs.\n      // Read once without any FPL bootstrap/live request.\n`);

  const profileReplacement = `  app.get("/api/cards/:cardId/profile", requireAuth, async (req: any, res: any) => {\n    try {\n      const viewerUserId = String(req.authUserId || "");\n      const cardId = Number(req.params.cardId);\n      if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Valid cardId required" });\n      let card = await storage.getPlayerCardWithPlayer(cardId, viewerUserId);\n      if (!card) {\n        const rawCard = await storage.getPlayerCard(cardId);\n        const player = rawCard ? await storage.getPlayer(Number(rawCard.playerId)) : null;\n        if (rawCard && player) card = { ...rawCard, player } as any;\n      }\n      if (!card) return res.status(404).json({ message: "Card not found" });\n\n      const player = card.player || {};\n      const [lastSaleTransaction] = await db\n        .select({ grossAmount: transactions.grossAmount, amount: transactions.amount })\n        .from(transactions)\n        .where(and(eq(transactions.type, "sale" as any), sql\`\${transactions.description} ilike \${\`%card:\${cardId}%\`}\`))\n        .orderBy(desc(transactions.createdAt))\n        .limit(1);\n      const lastSaleValue = Number(lastSaleTransaction?.grossAmount || lastSaleTransaction?.amount || 0) || null;\n\n      const apiFootballDirectory = await loadApiFootballPlayerDirectory().catch(() => []);\n      const apiSnapshot = await getApiFootballPlayerProfileSnapshot(player, apiFootballDirectory).catch(() => null);\n      if (apiSnapshot) {\n        return res.json({\n          ...apiSnapshot,\n          source: "api-football",\n          providers: {\n            identity: "API-Football current squads",\n            stats: "API-Football Premier League match statistics",\n            fantasyPoints: "Fantasy Arena scoring",\n          },\n          stats: { ...apiSnapshot.stats, value: lastSaleValue },\n        });\n      }\n\n      return res.json({\n        source: "card-fallback",\n        providers: {\n          identity: "Awaiting API-Football current-squad link",\n          stats: "No API-Football Premier League match link",\n          fantasyPoints: "Unavailable until API-Football identity is verified",\n        },\n        player: {\n          name: player.name,\n          team: player.team,\n          position: player.position,\n          imageUrl: null,\n          verifiedImageUrl: null,\n          identityVerified: false,\n          identitySource: "unverified-card-data",\n        },\n        last10: [],\n        stats: {\n          matchesPlayed: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0,\n          yellowCards: 0, redCards: 0, bonus: 0, totalPoints: 0, selectedBy: null,\n          value: lastSaleValue, saves: 0, averageRating: null,\n        },\n      });\n    } catch (error: any) {\n      console.error("Failed to fetch card profile:", error);\n      return res.status(500).json({ message: error?.message || "Failed to fetch card profile" });\n    }\n  });\n\n`;
  source = replaceBetween(source, "  app.get(\"/api/cards/:cardId/profile\"", "  app.post(\"/api/marketplace/list\"", profileReplacement, "API-Football card profile endpoint");
  write(file, source);
}

// 3) Player-card modal shows API-Football/Arena metrics only.
{
  const file = "client/src/components/cards/CardProfileModal.tsx";
  let source = read(file);
  source = replaceRequired(
    source,
    `function sourceLabel(data: CardProfileData) {\n  if (data.source === "api-football") return "API-Football verified";\n  if (data.source === "fpl-live" && data.providers?.identity?.includes("API-Football")) return "FPL + API verified";\n  if (data.source === "fpl-live") return "FPL live linked";\n  return "Awaiting official link";\n}`,
    `function sourceLabel(data: CardProfileData) {\n  if (data.source === "api-football") return "API-Football verified";\n  return "Awaiting API-Football link";\n}`,
    "profile provider badge",
  );
  source = source.replace(`identitySource: identityVerified ? (data.source === "api-football" ? "api-football" : "fpl") : "unverified-card-data",`, `identitySource: identityVerified ? "api-football" : "unverified-card-data",`);
  source = source.replace(`const totalPointsLabel = data.source === "fpl-live" ? "FPL Points" : data.source === "api-football" ? "Arena Score" : "Points";`, `const totalPointsLabel = data.source === "api-football" ? "Arena Score" : "Points";`);
  source = source.replace(`<HeroStat icon={<TrendingUp className="h-4 w-4" />} label="Ownership" value={data.stats.selectedBy ? \`\${data.stats.selectedBy}%\` : "—"} />`, `<HeroStat icon={<TrendingUp className="h-4 w-4" />} label="Matches" value={officialStat(data, data.stats.matchesPlayed)} />`);
  source = source.replace(`<HeroStat icon={<Award className="h-4 w-4" />} label={data.source === "api-football" ? "Avg Rating" : "Bonus"} value={data.source === "api-football" ? officialStat(data, data.stats.averageRating, 1) : officialStat(data, data.stats.bonus)} />`, `<HeroStat icon={<Award className="h-4 w-4" />} label="Avg Rating" value={officialStat(data, data.stats.averageRating, 1)} />`);
  source = source.replace(`<th className="px-3 py-3">B</th>`, `<th className="px-3 py-3">RTG</th>`);
  source = source.replace(`<td className="px-3 py-3">{item.bonus || 0}</td>`, `<td className="px-3 py-3">{item.rating == null ? "—" : Number(item.rating).toFixed(1)}</td>`);
  source = source.replace(`<Stat icon={<Award className="h-4 w-4" />} label="Bonus" value={officialStat(data, data.stats.bonus)} />`, `<Stat icon={<Award className="h-4 w-4" />} label="Avg rating" value={officialStat(data, data.stats.averageRating, 1)} />`);
  if (!source.includes(MARKER)) source = source.replace(`export type CardProfileData = {`, `// ${MARKER}: player identities, portraits and displayed player statistics use API-Football only.\nexport type CardProfileData = {`);
  write(file, source);
}

// 4) Every card surface uses API rating/match data from the profile endpoint once loaded.
{
  const file = "client/src/components/cards/PremiumFootballCard.tsx";
  let source = read(file);
  source = source.replace(`    totalPoints?: number;\n  };`, `    totalPoints?: number;\n    averageRating?: number | null;\n    matchesPlayed?: number;\n  };`);
  source = replaceRequired(
    source,
    `      totalPoints: data.stats?.totalPoints ?? player.totalPoints,`,
    `      totalPoints: data.stats?.totalPoints ?? player.totalPoints,\n      rating: data.stats?.averageRating ?? player.rating,\n      form: data.stats?.averageRating ?? player.form,\n      matchesPlayed: data.stats?.matchesPlayed ?? (player as any).matchesPlayed,`,
    "API-Football card metrics",
  );
  if (!source.includes(MARKER)) source = source.replace(`type ProfileData = {`, `// ${MARKER}: visual card stats are hydrated from the API-Football-backed profile endpoint.\ntype ProfileData = {`);
  write(file, source);
}

// 5) Fade/multiply white API-Football portrait backgrounds into the card art.
{
  const file = "client/src/components/cards/CollectionStableCard.tsx";
  let source = read(file);
  source = replaceRequired(
    source,
    `function isFallbackImage(image: string) {\n  return image.includes("/players/fallback") || image.includes("fallback.svg");\n}`,
    `function isFallbackImage(image: string) {\n  return image.includes("/players/fallback") || image.includes("fallback.svg");\n}\n\nfunction isApiFootballPortrait(image: string) {\n  return image.includes("media.api-sports.io/football/players/");\n}`,
    "API-Football portrait detection",
  );
  source = source.replace(`  const fallback = isFallbackImage(image);\n  const rarityLabel`, `  const fallback = isFallbackImage(image);\n  const apiFootballPortrait = isApiFootballPortrait(image);\n  const rarityLabel`);
  source = source.replace(`  const ovr: number | string = statsVerified ? numberStat(player.rating) : "—";\n  const points: number | string = statsVerified ? numberStat(player.totalPoints) : "—";\n  const form: number | string = statsVerified ? decimalStat(player.form) : "—";`, `  const rating: number | string = statsVerified ? decimalStat(player.rating) : "—";\n  const points: number | string = statsVerified ? numberStat(player.totalPoints) : "—";\n  const matches: number | string = statsVerified ? numberStat((player as any).matchesPlayed) : "—";`);
  source = source.replace(`<StatChip label="A-OVR" value={ovr} scale={scale} glow={palette.glow} />\n            <StatChip label="PTS" value={points} scale={scale} glow={palette.glow} />\n            <StatChip label="FORM" value={form} scale={scale} glow={palette.glow} />`, `<StatChip label="RTG" value={rating} scale={scale} glow={palette.glow} />\n            <StatChip label="PTS" value={points} scale={scale} glow={palette.glow} />\n            <StatChip label="MATCH" value={matches} scale={scale} glow={palette.glow} />`);
  const oldImg = `<img src={image} alt={player.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: fallback ? "contain" : "cover", objectPosition: "center top", display: "block", padding: fallback ? \`\${18 * scale}px \${18 * scale}px 0\` : 0, filter: fallback ? "saturate(.94) contrast(1.08) brightness(1.06)" : "saturate(1.12) contrast(1.10) brightness(1.05)", transform: fallback ? "scale(.78)" : "scale(.86)" }} />`;
  const newImg = `<img src={image} alt={player.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: fallback ? "contain" : "cover", objectPosition: "center top", display: "block", padding: fallback ? \`\${18 * scale}px \${18 * scale}px 0\` : 0, filter: fallback ? "saturate(.94) contrast(1.08) brightness(1.06)" : apiFootballPortrait ? "saturate(1.18) contrast(1.20) brightness(1.18)" : "saturate(1.12) contrast(1.10) brightness(1.05)", transform: fallback ? "scale(.78)" : apiFootballPortrait ? "scale(.92)" : "scale(.86)", mixBlendMode: apiFootballPortrait ? "multiply" : "normal", WebkitMaskImage: apiFootballPortrait ? "radial-gradient(ellipse 72% 92% at 50% 38%, #000 45%, rgba(0,0,0,.94) 58%, rgba(0,0,0,.48) 77%, transparent 100%)" : undefined, maskImage: apiFootballPortrait ? "radial-gradient(ellipse 72% 92% at 50% 38%, #000 45%, rgba(0,0,0,.94) 58%, rgba(0,0,0,.48) 77%, transparent 100%)" : undefined }} />`;
  source = replaceRequired(source, oldImg, newImg, "API-Football portrait fade");
  if (!source.includes(MARKER)) source = source.replace(`import { normalizeRarity } from "./cardTheme";`, `import { normalizeRarity } from "./cardTheme";\n\n// ${MARKER}: API-Football portraits are blended into card art to suppress white provider backgrounds.`);
  write(file, source);
}

console.log("Applied API-Football-only player profiles, onboarding card order and portrait background fade.");
