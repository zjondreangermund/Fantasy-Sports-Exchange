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
const market = read("client/src/components/native/NativeMarketPage.tsx");
const updatePrompt = read("client/src/components/native/NativeAppUpdatePrompt.tsx");
const routeBridge = read("client/src/components/native/NativeFullRouteBridge.tsx");
const prebuild = read("scripts/prepare-play-gameweek-navigation.mjs");

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

/* Query-only routes need a hard same-WebView navigation because Wouter's route
   location is path-based. Without this, Full tools and /account?tab=inbox can
   look like dead buttons while the compact component remains mounted. */
expect(updatePrompt.includes("useNativeFullRouteBridge"), "Native shell lifecycle no longer mounts the full-route/query bridge");
expect(routeBridge.includes('get("nativeFull") === "1"'), "Native route bridge no longer recognizes Full tools routes");
expect(routeBridge.includes("samePathQueryChange"), "Native route bridge no longer handles same-path query navigation");
expect(routeBridge.includes("window.location.assign"), "Native route bridge no longer performs a same-WebView hard navigation");

const nativeDir = path.join(root, "client/src/components/native");
for (const file of fs.readdirSync(nativeDir).filter((name) => name.endsWith(".tsx"))) {
  const source = fs.readFileSync(path.join(nativeDir, file), "utf8");
  const fullRouteLinks = source.match(/href=(?:\"[^\"]*nativeFull=1[^\"]*\"|\{`[^`]*nativeFull=1[^`]*`\})/g) || [];
  for (const link of fullRouteLinks) {
    const route = link.match(/\/(?:competitions|live-lineup|collection|marketplace|prize-vault|wallet|premier-league|account|legal\/scoring|help)/)?.[0];
    if (!route || !requiredWebsiteRoutes.includes(route)) failures.push(`${file} has an unverified nativeFull destination: ${link}`);
  }
}

/* Bottom navigation must reserve real layout height. If it floats over the
   scroller again, the last tournament/card/entry disappears behind the tabs. */
expect(nativeCss.includes(".arena-bottom-dock"), "Native CSS no longer owns bottom dock clearance");
expect(nativeCss.includes("position: relative !important"), "Bottom dock is floating over native page content again");
expect(nativeCss.includes("main[data-app-scroll-root]"), "Native app scroll root override is missing");
expect(nativeCss.includes("-webkit-overflow-scrolling: touch"), "Native momentum scrolling guard is missing");
expect(nativeCss.includes("touch-action: pan-y"), "Native vertical touch scrolling guard is missing");
expect(nativeCss.includes("scroll-padding-bottom"), "Native app lost bottom scroll clearance");
expect(nativeCss.includes("z-index: auto !important"), "Native content still traps fixed sub-screens below the bottom dock");
expect(nativeCss.includes('[role="dialog"][class*="fixed"][class*="inset-0"] > section'), "Native dialogs lost their independent scroll guard");
expect(nativeCss.includes('[data-native-market] > [class*="fixed"][class*="inset-0"] > section'), "Marketplace purchase sheet lost its independent scroll guard");
expect(nativeCss.includes(":has([role=\"dialog\"])") || nativeCss.includes(':has([role="dialog"])'), "Native dock is no longer hidden while a modal/sub-screen is open");
expect(market.includes("fixed inset-0 z-[120] flex items-end"), "Marketplace purchase sheet structure changed without updating the native scroll guard");

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

/* Collection must stay static and centered on Android. The xs stabilization
   patch must run before Vite, otherwise the old animated glow/3D compositor is
   already baked into the client bundle by the time the server build patches it. */
expect(prebuild.includes('await import("./apply-starter-draft-mobile-rendering.mjs")'), "Compact xs card stabilization no longer runs before the client build");
expect(thumbnail.includes("showMeta?: boolean"), "CardThumbnail lost compact metadata control");
expect(cards.includes('size="xs" showMeta={false}'), "Native Collection is not using compact metadata-free cards");
expect(cards.includes("data-native-static-card-grid"), "Native Collection lost its static card grid marker");
expect(cards.includes("justify-items-center gap-x-1 gap-y-2.5"), "Native Collection cards are no longer centered in their grid blocks");
expect(cards.includes('className="w-[96px] max-w-full" data-native-static-card'), "Native Collection card/footer width is no longer locked together");
expect(cards.includes("grid-cols-[minmax(0,1fr)_auto]"), "Native Collection position and GW points are no longer anchored to the same card width");
expect(!cards.includes("active:scale-[.985]"), "Native Collection reintroduced animated card tile scaling");
expect(nativeCss.includes("[data-native-static-card-grid] *"), "Native Collection lost its transition/animation compositor guard");
expect(nativeCss.includes(".fa-card-lift > span[aria-hidden=\"true\"]"), "Native Collection no longer suppresses the legacy moving glow fallback");
expect(cards.includes("gameweekPoints(card).toFixed(2)"), "Native Collection no longer anchors GW points to each card tile");

if (failures.length) {
  console.error("Native mobile route/layout verification failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`Native mobile route/layout verification passed (${requiredWebsiteRoutes.length} live routes, ${requiredCompactMappings.length} compact mappings, query/full-route bridge, sub-screen scrolling, cache normalization, rarity neon and static centered cards).`);
