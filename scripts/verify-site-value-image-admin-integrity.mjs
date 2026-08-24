import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const reward = read("server/services/dailyLoginReward.ts");
const forge = read("server/services/forgeOperation.ts");
const simulator = read("server/routes/testSimulator.routes.ts");
const creator = read("server/routes/tournamentCreator.routes.ts");
const images = read("client/src/lib/card-image.ts");
const proxy = read("server/index.ts");
const imageComponent = read("client/src/components/CardPlayerImage.tsx");
const stableCard = read("client/src/components/cards/CollectionStableCard.tsx");
const premiumCard = read("client/src/components/cards/PremiumFootballCard.tsx");
const cardAdapter = read("client/src/lib/fantasy-card-adapter.ts");
const cardApi = read("server/routes/cards.routes.ts");
const cardEnrichment = read("server/services/playerCardEnrichment.ts");
const scoring = read("server/services/scoreUpdater.ts");
const collection = read("client/src/pages/collection-clean.tsx");
const marketplace = read("client/src/pages/marketplace-v2.tsx");
const marketplaceServer = read("server/routes/marketplace.routes.ts");
const entries = read("client/src/pages/my-entries.tsx");
const competitions = read("client/src/pages/competitions-vault.tsx");
const admin = read("server/routes/admin.routes.ts");
const adminUi = read("client/src/components/admin/AdminTournamentManager.tsx");
const view = read("client/src/lib/site-view.ts");
const app = read("client/src/App.tsx");
const main = read("client/src/main.tsx");
const rules = read("server/services/tournamentRules.ts");
const economy = read("server/routes/economyIntegrity.routes.ts");
const routes = read("server/routes.ts");

function includes(source, text, message) {
  assert.ok(source.includes(text), message);
}

includes(reward, "last_reward_day + ${WEEKLY_COMMON_REWARD_INTERVAL_DAYS}::integer", "Weekly rewards must bind a typed PostgreSQL integer.");
includes(forge, "const cardIdArray = `{${normalizeForgeCardIds(cardIds).join(\",\")}}`;", "Forge checks must bind one PostgreSQL integer-array literal.");
includes(forge, "ANY(${cardIdArray}::int[])", "Forge card lookups must use the safe typed array parameter.");
assert.ok(!forge.includes("ANY(${cardIds}::int[])") && !forge.includes("ANY(${normalizeForgeCardIds(cardIds)}::int[])") , "Forge must never cast expanded Drizzle arrays to integer[].");
includes(simulator, "jsonb_array_elements_text(${JSON.stringify(cardIds)}::jsonb)::integer", "Admin simulation must bind JSON arrays rather than record casts.");
includes(creator, "any(${deletableIdArray}::int[])", "Tournament cleanup must use one validated PostgreSQL array literal.");

includes(images, "media.api-sports.io/football/players/${apiFootballId}.png", "API-Football portraits must be available before unreliable FPL photos.");
includes(images, "&strict=1", "Official portrait candidates must request strict proxy failures.");
includes(proxy, 'String(req.query.strict || "") === "1"', "Image proxy must allow official-image fallback after a provider 403.");
includes(proxy, 'return res.status(404).json({ message: "Verified player portrait unavailable" })', "Missing provider portraits must not masquerade as successful placeholders.");
includes(imageComponent, "setIndex((prev) => prev + 1)", "Card photos must retry their next verified portrait.");
includes(stableCard, "setImageIndex((previous)", "Collection cards must recover from rejected official photos.");
includes(cardAdapter, "Prefer the independently linked API-Football portrait", "Every card surface must prioritize the independent verified portrait.");
includes(entries, "<CardPlayerImage card={card}", "Submitted-team photos must use the resilient official-image pipeline.");
includes(competitions, "<CardPlayerImage card={card}", "Tournament squad selections must use the resilient official-image pipeline.");

for (const [label, source] of [["collection card API", cardApi], ["shared marketplace enrichment", cardEnrichment]]) {
  includes(source, "officialFplSeasonPoints", `${label} must distinguish external FPL season totals from Arena points.`);
  includes(source, "const totalPoints = identityVerified ? currentGameweekPoints : null", `${label} must expose Fantasy Arena points as the ordinary card points.`);
}
includes(premiumCard, "data.stats?.arenaGameweekPoints ?? player.totalPoints", "Profile loading must never overwrite Arena card points with external FPL totals.");
includes(stableCard, "maximumFractionDigits: 4", "Card points must preserve the same scoring precision as leaderboards.");
includes(stableCard, '<StatChip label="LEVEL" value={level}', "Card value chips must show actual Fantasy Arena level, not invented external overall values.");
includes(cardAdapter, "Card form is calculated only from recorded Fantasy Arena match scores", "Displayed card form must come from Fantasy Arena matches.");
includes(cardApi, "'marketplace_sale'", "Card sale history must recognize actual Fantasy Arena marketplace sales.");
includes(cardApi, "ownershipManagerCount", "Player ownership must use Fantasy Arena managers, not FPL ownership.");
includes(marketplaceServer, 'const position = canonical?.position || String(card.position || "") || apiPlayer?.position || "MID"', "Tournament lineups must respect the canonical Premier League player position before external position guesses.");
includes(marketplaceServer, "mergePlayerStatsWithDetailedStats(mapFplStatsToPlayerStats(liveElement), detailedStats)", "Tournament leaderboard fallback points must use the same detailed Fantasy Arena scoring as owned cards.");
includes(marketplaceServer, "const officialFplSeasonPoints = matchedElement ? Number(matchedElement.total_points || 0) : null", "Marketplace listings must label external season points separately from Fantasy Arena points.");
includes(marketplaceServer, "const totalPoints = identityVerified ? currentGameweekPoints : null", "Marketplace listings must show the same Fantasy Arena gameweek scores as collections and tournament teams.");
includes(scoring, "mergePlayerStatsWithDetailedStats(fplStats, detailedStats)", "Persisted tournament standings must use the same official detailed Fantasy Arena scoring as owned cards.");
includes(scoring, "const verifiedPosition = String(canonical.position ||", "Persisted tournament scoring must use the canonical Premier League position before any external position guess.");
includes(scoring, "detailedStatsCards", "Tournament scoring snapshots must identify how many cards used verified API-Football match actions.");
assert.ok(!scoring.includes("card?.player?.nowCost") && !rules.includes("card?.player?.nowCost"), "Tournament squad values must never use another site's player prices.");
includes(collection, "return card.forSale ? Math.max(0, Number(card.price || 0)) : 0", "Collection values must sum real active listing prices only.");
includes(collection, 'label="Listed value"', "Collection totals must accurately describe what they measure.");
includes(marketplace, 'label="Average Asking"', "Marketplace averages must not claim unsold listings are completed sales.");
includes(marketplace, "Arena GW points", "Marketplace card performance must display Fantasy Arena gameweek scores.");
assert.ok(!marketplace.includes(">Season points<"), "Marketplace must not label external FPL season totals as Arena performance.");
includes(entries, 'queryKey: ["/api/competitions/my-entries", user?.id || "anonymous"]', "Submitted teams must remain private to their authenticated owner.");
includes(entries, 'label="All entries"', "Submitted teams must expose the same public tournament entry count shown elsewhere.");
includes(entries, 'label="Entry paid"', "Submitted teams must show the actual recorded entry payment.");
includes(routes, "const recordedEntrantRevenue = toMoney(entries.reduce", "Public tournament revenue must add actual entry payments rather than estimate them.");

includes(admin, 'app.get("/api/admin/tournament-financials", requireAuth, isAdmin', "Tournament finances must have a dedicated admin-protected contract.");
includes(admin, "sum(coalesce(ce.entry_fee_paid, 0)) as gross", "Admin tournament totals must come from recorded entry payments.");
includes(admin, "entryAmountDifference", "Admin must expose expected-versus-paid tournament reconciliation.");
includes(admin, "source_type = 'marketplace_sale'", "Marketplace volumes must count the seller-side transaction exactly once.");
assert.ok(!admin.includes("marketplaceVolume * 0.08"), "Admin revenue must never invent marketplace fees from an estimated percentage.");
includes(adminUi, "/api/admin/tournament-financials", "The admin interface must consume the authoritative tournament financial endpoint.");
includes(adminUi, "Tournament entries &amp; financial reconciliation", "Admin must expose searchable real tournament entries, fees, pools, refunds and payouts.");
includes(rules, "platformFeeRate: 0.1", "User-created tournaments must use the canonical 10% fee.");
includes(rules, "prizePoolRate: 0.9", "User-created tournaments must allocate 90% to their prize pools.");
includes(economy, "competition.platformFeeRate ??", "Official tournament zero-percent fees must not be replaced by a truthy fallback.");

includes(view, "(display-mode: standalone)", "Installed mobile apps must be detected independently of ordinary browsers.");
includes(view, "return isInstalledMobileApp() ? \"desktop\" : \"mobile\"", "Installed mobile apps must default to the desktop website layout.");
includes(view, "SITE_VIEW_STORAGE_KEY", "The desktop/mobile preference must persist.");
includes(app, "Switch to desktop site view", "Managers must be able to toggle between desktop and mobile views.");
includes(main, "initializeSiteView();", "The chosen app layout must be applied before React renders.");

console.log("Fantasy Arena image fallbacks, exact scores and values, SQL safety, private entries, mobile desktop view, and admin tournament reconciliation verified.");
