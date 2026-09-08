import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const app = read("client/src/App.tsx");
const shell = read("client/src/components/native/NativeMobileShell.tsx");
const boundary = read("client/src/components/native/NativeRouteBoundary.tsx");
const nativeCss = read("client/src/native-mobile.css");
const play = read("client/src/components/native/NativePlayPage.tsx");
const squad = read("client/src/components/native/NativeSquadPage.tsx");
const cards = read("client/src/components/native/NativeCardsPage.tsx");
const thumbnail = read("client/src/components/CardThumbnail.tsx");
const wallet = read("client/src/components/native/NativeWalletPage.tsx");

const requiredWebsiteRoutes = [
  "/",
  "/competitions",
  "/live-lineup",
  "/collection",
  "/marketplace",
  "/prize-vault",
  "/wallet",
  "/premier-league",
  "/account",
  "/legal/scoring",
  "/help",
];

const requiredCompactMappings = [
  "NativeHomePage",
  "NativePlayPage",
  "NativeSquadPage",
  "NativeCardsPage",
  "NativeMarketPage",
  "NativeVaultPage",
  "NativeWalletPage",
  "NativePremierLeaguePage",
  "NativeClubPage",
];

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

for (const route of requiredWebsiteRoutes) {
  if (!shell.includes(`href: \"${route}\"`) && !shell.includes(`href=\"${route}\"`) && !shell.includes(`href=\"${route}?`)) {
    failures.push(`APK shell no longer links to required route ${route}`);
  }
  if (route !== "/" && !app.includes(`\"${route}\"`)) {
    failures.push(`Website router no longer declares required route ${route}`);
  }
}

for (const component of requiredCompactMappings) {
  if (!shell.includes(component)) failures.push(`APK compact mapping missing ${component}`);
}

const shellCanSwitchToFull = shell.includes('get("nativeFull")') && shell.includes('=== "1"');
const recoveryCanOpenFull = boundary.includes('searchParams.set("nativeFull", "1")') && boundary.includes("window.location.replace(fullWebsiteUrl())");
expect(shellCanSwitchToFull && recoveryCanOpenFull, "APK lost its automatic live website/full-route escape hatch");
expect(shell.includes("NativeRouteBoundary"), "APK shell lost its blank-route recovery boundary");

/* Bottom navigation must reserve real layout height. If it floats over the
   scroller again, the last tournament/card/entry disappears behind the tabs. */
expect(nativeCss.includes(".arena-bottom-dock"), "Native CSS no longer owns bottom dock clearance");
expect(nativeCss.includes("position: relative !important"), "Bottom dock is floating over native page content again");
expect(nativeCss.includes("main[data-app-scroll-root]"), "Native app scroll root override is missing");
expect(nativeCss.includes("-webkit-overflow-scrolling: touch"), "Native momentum scrolling guard is missing");
expect(nativeCss.includes("touch-action: pan-y"), "Native vertical touch scrolling guard is missing");
expect(nativeCss.includes("scroll-padding-bottom"), "Native app lost bottom scroll clearance");

/* Compact pages share a React Query cache with full website pages. Response
   objects and arrays must be normalized before array methods are called. */
expect(play.includes("listFrom<Tournament>(competitionsRaw"), "Play does not normalize cached competition response shapes");
expect(play.includes("listFrom<PlayerCardWithPlayer>(cardsRaw"), "Play does not normalize cached card response shapes");
expect(play.includes("listFrom<CompetitionEntry>(entriesRaw"), "Play does not normalize cached entry response shapes");
expect(squad.includes("listFrom<Tournament>(competitionsRaw"), "Squad does not normalize cached competition response shapes");
expect(squad.includes("listFrom<CompetitionEntry>(entriesRaw"), "Squad does not normalize cached entry response shapes");
expect(cards.includes("normalizeCards(cardsRaw)"), "Collection does not normalize cached card response shapes");
expect(wallet.includes("arrayFrom<Transaction>(transactionsRaw"), "Wallet does not normalize cached transaction response shapes");

/* Every tournament/gameweek surface should retain the rarity neon language. */
for (const token of ["text-slate-100", "text-sky-200", "text-violet-200", "text-rose-200", "text-amber-200"]) {
  expect(play.includes(token), `Play rarity neon palette is missing ${token}`);
  expect(squad.includes(token), `Squad rarity neon palette is missing ${token}`);
}
expect(play.includes("Gameweek {currentGameweek} · {rarity}"), "Play hero no longer shows rarity-colored gameweek context");
expect(play.includes("GW{gameweek || \"-\"}"), "Tournament cards no longer show gameweek badges");

/* Collection should be dense and deterministic: one fixed tile footer for
   position + points, no nested interactive intelligence button floating over
   the compact grid, and no duplicated position/team line below the card. */
expect(thumbnail.includes("showMeta?: boolean"), "CardThumbnail lost compact metadata control");
expect(cards.includes('size="xs" showMeta={false}'), "Native Collection is not using compact metadata-free cards");
expect(cards.includes("grid-cols-3 items-start gap-1.5"), "Native Collection card spacing is no longer compact");
expect(!cards.includes('size="xs" selectable'), "Native Collection reintroduced nested/floating card controls");
expect(cards.includes("gameweekPoints(card).toFixed(2)"), "Native Collection no longer anchors GW points to each card tile");

if (failures.length) {
  console.error("Native mobile route/layout verification failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`Native mobile route/layout verification passed (${requiredWebsiteRoutes.length} live routes, ${requiredCompactMappings.length} compact mappings, scroll clearance, cache normalization, rarity neon and compact cards).`);