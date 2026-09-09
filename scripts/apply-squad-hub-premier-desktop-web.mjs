import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, source) {
  fs.writeFileSync(path, source);
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[squad-premier-web] ${label} anchor not found`);
  return source.replace(from, to);
}

function replaceBetween(source, startToken, endToken, replacement, label) {
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`[squad-premier-web] ${label} start anchor not found`);
  const end = source.indexOf(endToken, start);
  if (end < 0) throw new Error(`[squad-premier-web] ${label} end anchor not found`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// WEB_DESKTOP_ONLY_V1
// Browser/PWA traffic always gets the desktop site. The dedicated mobile UI is
// reserved for the native Capacitor APK, so an old mobile-view preference can no
// longer make playfantasyarena.com reopen the retired phone web layout.
{
  const path = "client/src/lib/site-view.ts";
  let source = read(path);
  const replacement = `export function getSiteViewMode(): SiteViewMode {\n  if (typeof window === \"undefined\") return \"desktop\";\n  return isNativeMobileApp() ? \"mobile\" : \"desktop\";\n}\n\n`;
  source = replaceBetween(source, "export function getSiteViewMode(): SiteViewMode {", "export function applySiteView", replacement, "desktop-only website mode");
  source = replaceRequired(
    source,
    '  const effectiveMode: SiteViewMode = isNativeMobileApp() ? "mobile" : mode;',
    '  const effectiveMode: SiteViewMode = isNativeMobileApp() ? "mobile" : "desktop";',
    "desktop-only effective site mode",
  );
  write(path, source);
}

// Remove the retired browser mobile-view controls/dock. The normal website now
// has one responsive product mode: desktop. Native APK routing stays untouched.
{
  const path = "client/src/App.tsx";
  let source = read(path);
  source = source.replace('import { Monitor, Smartphone } from "lucide-react";\n', "");
  source = source.replace('import MobileNavDock from "./components/MobileNavDock";\n', "");
  source = source.replace(
    'import { applySiteView, getSiteViewMode, isNativeMobileApp, type SiteViewMode } from "./lib/site-view";',
    'import { isNativeMobileApp } from "./lib/site-view";',
  );
  source = source.replace('  const [siteView, setSiteView] = React.useState<SiteViewMode>(() => getSiteViewMode());\n', "");
  const togglePattern = /<div className="flex shrink-0 items-center gap-1\.5"><button type="button" onClick=\{\(\) => setSiteView\(applySiteView\(siteView === "desktop" \? "mobile" : "desktop"\)\)\}[\s\S]*?<\/button><ThemeToggle \/><\/div>/;
  if (togglePattern.test(source)) {
    source = source.replace(togglePattern, '<div className="flex shrink-0 items-center gap-1.5"><ThemeToggle /></div>');
  } else if (!source.includes('<div className="flex shrink-0 items-center gap-1.5"><ThemeToggle /></div>')) {
    throw new Error("[squad-premier-web] desktop/mobile toggle anchor not found");
  }
  source = source.replace('          {!isInfoRoute && <MobileNavDock />}\n', "");
  write(path, source);
}

// Replace the old Cards bottom tab with Premier League. Collection remains a
// Squad-zone destination and is still directly reachable for deep links.
{
  const path = "client/src/components/native/NativeMobileShell.tsx";
  let source = read(path);
  source = replaceRequired(source, "  Bell,\n", "  Activity,\n  Bell,\n", "Premier League nav icon import");
  source = replaceRequired(
    source,
    '  { label: "Cards", href: "/collection", icon: Gem },',
    '  { label: "Premier", href: "/premier-league", icon: Activity },',
    "Premier League primary nav",
  );
  source = replaceRequired(
    source,
    '  { label: "Premier League", href: "/premier-league", icon: Trophy, description: "Matches & table" },',
    '  { label: "Collection & Trades", href: "/collection", icon: Gem, description: "Inside Squad · buy / sell / loan" },',
    "Collection moved under Squad menu",
  );
  source = replaceRequired(
    source,
    '  if (href === "/live-lineup") return location.startsWith("/live-lineup") || location.startsWith("/select-squad") || location.startsWith("/my-entries");',
    '  if (href === "/live-lineup") return location.startsWith("/live-lineup") || location.startsWith("/select-squad") || location.startsWith("/my-entries") || location.startsWith("/collection");',
    "Squad active state includes collection",
  );
  source = replaceRequired(source, '  if (location.startsWith("/collection")) return "My Cards";', '  if (location.startsWith("/collection")) return "Squad Collection";', "collection route title");
  source = replaceRequired(source, '  if (location.startsWith("/collection")) return "OWN • BUILD • UPGRADE";', '  if (location.startsWith("/collection")) return "OWN • BUY • SELL • LOAN";', "collection route subtitle");
  source = replaceRequired(source, '  if (location.startsWith("/collection")) return "cards";', '  if (location.startsWith("/collection")) return "squad";', "collection route arena zone");
  write(path, source);
}

// Squad is now the single place for entered tournament teams and the user's
// Collection. The existing NativeCardsPage is embedded so Buy/Sell/Loan uses the
// same working trade sheet and marketplace logic already used by the Cards page.
{
  const path = "client/src/components/native/NativeSquadPage.tsx";
  let source = read(path);
  source = replaceRequired(
    source,
    'import TournamentEntryTeamCard from "../tournaments/TournamentEntryTeamCard";',
    'import TournamentEntryTeamCard from "../tournaments/TournamentEntryTeamCard";\nimport NativeCardsPage from "./NativeCardsPage";',
    "Squad collection import",
  );
  source = replaceRequired(
    source,
    '  const loading = entriesLoading || competitionsLoading;',
    '  const loading = entriesLoading || competitionsLoading;\n  const [section, setSection] = React.useState<"teams" | "collection">("teams");',
    "Squad hub section state",
  );
  source = replaceRequired(
    source,
    '<div><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/70">Tournament squads</p><h2 className="mt-1 text-2xl font-black">Your entered teams</h2><p className="mt-1 text-xs leading-5 text-slate-400">Every submitted five-card team is tied to the tournament it entered. Live scores and captain contributions stay with that exact entry.</p></div>',
    '<div><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200/70">Squad hub</p><h2 className="mt-1 text-2xl font-black">Your entered teams & collection</h2><p className="mt-1 text-xs leading-5 text-slate-400">Fantasy Arena points come from real Premier League match performance and verified in-game actions. Each submitted five-card team keeps its exact live score and captain contribution.</p></div>',
    "real performance Squad copy",
  );
  const firstTeamsSection = '      <section className="rounded-[1.45rem] border border-white/[.08] bg-white/[.03] p-3.5">';
  const hubTabs = `      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[.07] bg-black/20 p-1" data-squad-hub-tabs>\n        <button type="button" onClick={() => setSection("teams")} className={\`rounded-xl px-3 py-2.5 text-[11px] font-black \${section === "teams" ? "bg-cyan-300/12 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,.12)]" : "text-slate-500"}\`}>Entered Teams</button>\n        <button type="button" onClick={() => setSection("collection")} className={\`rounded-xl px-3 py-2.5 text-[11px] font-black \${section === "collection" ? "bg-violet-300/12 text-violet-100 shadow-[0_0_18px_rgba(167,139,250,.14)]" : "text-slate-500"}\`}>Collection & Trade</button>\n      </div>\n\n      {section === "collection" ? <div className="-mx-3"><NativeCardsPage /></div> : <>\n\n`;
  if (!source.includes("data-squad-hub-tabs")) {
    if (!source.includes(firstTeamsSection)) throw new Error("[squad-premier-web] entered teams section anchor not found");
    source = source.replace(firstTeamsSection, hubTabs + firstTeamsSection);
  }
  const finalLink = '      <Link href="/competitions" className="flex items-center justify-between rounded-[1.35rem] bg-violet-300/[.07] px-4 py-3.5 text-xs font-black text-violet-100"><span>Enter another tournament</span><ChevronRight className="h-4 w-4" /></Link>';
  if (!source.includes('      </> : null}\n    </div>')) {
    if (!source.includes(finalLink)) throw new Error("[squad-premier-web] Squad final action anchor not found");
    source = source.replace(finalLink, `${finalLink}\n      </> : null}`);
  }
  write(path, source);
}

// Make the real-match scoring source explicit anywhere users inspect cards.
{
  const path = "client/src/components/native/NativeCardsPage.tsx";
  let source = read(path);
  source = replaceRequired(
    source,
    'Tap any card to manage it directly. Sale and loan fees use the same live rules as the full website.',
    'Tap any card to buy, sell or loan. PTS and GW scores come from the player’s real Premier League match performance; sale and loan fees use the same live rules as the full website.',
    "Collection real performance copy",
  );
  write(path, source);
}

// Tournament entry should also explain that scoring is driven by real football.
{
  const path = "client/src/components/native/NativePlayPage.tsx";
  let source = read(path);
  source = replaceRequired(
    source,
    'Pick a cup, build five eligible Premier League cards, choose your captain and you are in.',
    'Pick a cup, build five eligible Premier League cards and choose your captain. Tournament points come from those players’ real in-game Premier League performances.',
    "Play real performance copy",
  );
  write(path, source);
}

// The APK Premier tab now exposes the same Pro Intelligence Centre as desktop:
// live/results, table, availability, leaders, clubs, squads/transfers, coaches,
// stadiums and player profiles. The separate desktop-only build patch restricts
// FootballDataCentre to Premier League data before Vite bundles production.
{
  const path = "client/src/components/native/NativePremierLeaguePage.tsx";
  const source = `import { Activity, ShieldCheck } from "lucide-react";\nimport FootballDataCentre from "../FootballDataCentre";\n\nexport default function NativePremierLeaguePage() {\n  return (\n    <div className="mx-auto w-full max-w-xl px-3 pb-4 pt-3" data-native-premier-league data-premier-hub-full-intelligence>\n      <section className="overflow-hidden rounded-[1.55rem] border border-indigo-300/15 bg-[radial-gradient(circle_at_90%_0%,rgba(99,102,241,.2),transparent_34%),linear-gradient(145deg,#0a0e20,#070916)] p-4">\n        <div className="flex items-start justify-between gap-3">\n          <div>\n            <p className="text-[10px] font-black uppercase tracking-[.22em] text-indigo-200/70">Premier League Hub</p>\n            <h2 className="mt-1 text-2xl font-black">Real football. Live fantasy intelligence.</h2>\n            <p className="mt-1 text-xs leading-5 text-slate-400">The same Premier League intelligence as desktop: live matches and results, table, player availability, leaders, clubs, squads, transfers, coaches, stadiums and player profiles.</p>\n          </div>\n          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-indigo-300/15 bg-indigo-300/[.08] text-indigo-100"><Activity className="h-5 w-5" /></div>\n        </div>\n        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[.045] px-3 py-2.5 text-[10px] font-bold leading-4 text-emerald-100">\n          <ShieldCheck className="h-4 w-4 shrink-0" />Fantasy Arena card and tournament points are calculated from real Premier League in-game performance.\n        </div>\n      </section>\n      <div className="mt-3 min-w-0 overflow-hidden" data-premier-desktop-intelligence-in-apk>\n        <FootballDataCentre />\n      </div>\n    </div>\n  );\n}\n`;
  write(path, source);
}

// Final build-time assertions: fail loudly rather than silently shipping an old
// phone web view or a disconnected Squad/Premier tab.
{
  const site = read("client/src/lib/site-view.ts");
  const app = read("client/src/App.tsx");
  const shell = read("client/src/components/native/NativeMobileShell.tsx");
  const squad = read("client/src/components/native/NativeSquadPage.tsx");
  const cards = read("client/src/components/native/NativeCardsPage.tsx");
  const play = read("client/src/components/native/NativePlayPage.tsx");
  const premier = read("client/src/components/native/NativePremierLeaguePage.tsx");
  const checks = [
    [site.includes('return isNativeMobileApp() ? "mobile" : "desktop";'), "website is not desktop-only"],
    [site.includes('isNativeMobileApp() ? "mobile" : "desktop"'), "site view can still select browser mobile mode"],
    [!app.includes("MobileNavDock"), "retired browser mobile dock is still mounted"],
    [!app.includes("Switch to mobile site view"), "retired mobile-view toggle is still visible"],
    [shell.includes('{ label: "Premier", href: "/premier-league", icon: Activity }'), "Premier League did not replace Cards in primary nav"],
    [shell.includes('{ label: "Collection & Trades", href: "/collection", icon: Gem'), "Collection is not retained under Squad"],
    [squad.includes("data-squad-hub-tabs") && squad.includes("<NativeCardsPage />"), "Squad does not contain both entered teams and Collection"],
    [cards.includes("real Premier League match performance"), "Collection does not explain real-match points"],
    [play.includes("real in-game Premier League performances"), "Play does not explain real-match tournament points"],
    [premier.includes("FootballDataCentre") && premier.includes("player availability"), "APK Premier League tab is not the full intelligence hub"],
  ];
  const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
  if (failures.length) throw new Error(`[squad-premier-web] verification failed: ${failures.join("; ")}`);
}

console.log("[squad-premier-web] Squad now owns entered teams + Collection/trading, Premier League replaces Cards in the APK nav, real-match scoring is explicit, and browser/PWA traffic is desktop-only.");
