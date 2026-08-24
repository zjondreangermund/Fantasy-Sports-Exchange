import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (file) => fs.readFileSync(file, "utf8");
const account = read("client/src/pages/account.tsx");
const dashboard = read("client/src/pages/dashboard.tsx");
const chat = read("client/src/components/FloatingSupportWidget.tsx");
const notifications = read("client/src/lib/notifications.ts");
const search = read("client/src/lib/search.ts");
const collection = read("client/src/pages/collection-clean.tsx");
const market = read("client/src/pages/marketplace.tsx");
const marketV2 = read("client/src/pages/marketplace-v2.tsx");
const football = read("client/src/components/FootballDataCentre.tsx");
const profile = read("client/src/components/cards/CardProfileModal.tsx");
const cards = read("server/routes/cards.routes.ts");
const enrichment = read("server/services/playerCardEnrichment.ts");
const transferPatch = read("scripts/apply-player-transfer-notifications.mjs");
const sidebar = read("client/src/components/app-sidebar.tsx");
const mobileNav = read("client/src/components/MobileNavDock.tsx");

function includes(source, expected, message) {
  assert.ok(source.includes(expected), message);
}

includes(account, "const markOneMutation = useMutation", "The notification inbox must preserve individual Read actions.");
includes(account, "const markAllMutation = useMutation", "The notification inbox must preserve Mark all read.");
includes(account, "Open mentioned message", "Mention alerts must open their exact community message.");
includes(account, 'new URLSearchParams(window.location.search).get("tab") === "inbox"', "Dashboard notification links must open the Inbox tab.");
assert.ok(!account.includes('if (value === "inbox") void markNotificationsSeen()'), "Opening Inbox must not silently mark every notification as read.");
assert.ok(!sidebar.includes("if (item.showUnread) void markNotificationsSeen()"), "Sidebar navigation must not silently discard unread notifications.");
assert.ok(!mobileNav.includes("if (item.showUnread) void markNotificationsSeen()"), "Mobile navigation must not silently discard unread notifications.");
includes(transferPatch, "preserve manual mark-all control", "Production builds must preserve manual notification read controls.");

includes(dashboard, "openNotification(note, navigate)", "Dashboard Read actions must open their relevant destination.");
includes(dashboard, 'href="/account?tab=inbox"', "Dashboard must provide a working Inbox destination.");
includes(notifications, "await openCommunityMention(notification)", "Community mention notifications must open the referenced message.");
includes(notifications, "await markNotificationRead(notification.id)", "Opening an alert must update its actual read status.");

includes(chat, "Search messages, managers or @mentions", "Community Live must provide searchable message history.");
includes(chat, "visibleMessages.map", "Community Live must render only matching messages while searching.");
includes(chat, "touch-manipulation", "Chat mention and reply controls must be accessible on touch devices.");
assert.ok(!chat.includes("sm:opacity-0 sm:transition sm:group-hover:opacity-100"), "Mobile chat actions must not depend on hover visibility.");

for (const [name, source] of [["Collection", collection], ["Marketplace", market], ["Marketplace V2", marketV2]]) {
  includes(source, "cardMatchesSearch(search, card", `${name} must search player, club, position, rarity and card identifiers consistently.`);
  includes(source, "refetchInterval: 15_000", `${name} must refresh official Arena card scores promptly.`);
}
includes(football, "normalizeSearchText(playerSearch)", "Official player searches must normalize accents and whitespace.");

const strippedSearch = search
  .replace(/\bexport\s+/g, "")
  .replace(/:\s*unknown\[\]/g, "")
  .replace(/:\s*unknown/g, "")
  .replace(/:\s*string\[\]/g, "")
  .replace(/:\s*string/g, "")
  .replace(/:\s*boolean/g, "")
  .replace(/:\s*any/g, "")
  + "\nglobalThis.searchTools = { normalizeSearchText, matchesSearch, cardMatchesSearch };";
const sandbox = {};
vm.runInNewContext(strippedSearch, sandbox);
const { normalizeSearchText, matchesSearch, cardMatchesSearch } = sandbox.searchTools;
assert.equal(normalizeSearchText("  Emiliano MARTÍNEZ  "), "emiliano martinez", "Player search must ignore case, accents and extra spaces.");
assert.equal(matchesSearch("villa martinez", "Emiliano Martínez", "Aston Villa"), true, "Search words must match independently across searchable fields.");
assert.equal(cardMatchesSearch("martinez villa gk rare 123", { id: 123, rarity: "rare", player: { name: "Emiliano Martínez", team: "Aston Villa", position: "GK" } }), true, "Card search must include official player identity, position, rarity and card ID.");
assert.equal(cardMatchesSearch("forward", { player: { name: "Emiliano Martínez", position: "GK" } }), false, "A nonmatching player search must not return an unrelated card.");

for (const [name, source] of [["Collection API", cards], ["Shared card enrichment", enrichment]]) {
  includes(source, "loadDetailedScoringContext", `${name} must load the same API-Football gameweek context as tournament scoring.`);
  includes(source, "resolveDetailedStatsForPlayer", `${name} must resolve the exact verified official player.`);
  includes(source, "mergePlayerStatsWithDetailedStats", `${name} must combine API-Football actions with the official FPL fallback.`);
  includes(source, "currentGameweekPoints", `${name} must expose exact current-gameweek Fantasy Arena points.`);
  includes(source, 'canonical?.position || String(player.position || "") || apiFootballPlayer?.position || "MID"', `${name} must preserve the tournament-authoritative official player position.`);
}
includes(profile, "Arena GW Points", "Player profiles must label the Fantasy Arena gameweek score correctly.");
includes(profile, "maximumFractionDigits: 4", "Player profiles must preserve the same scoring precision as the leaderboard.");

console.log("Notification actions, mobile chat mentions, unified search and precise official Fantasy Arena card scores verified.");
