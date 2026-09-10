import fs from "node:fs";

function patchFile(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[gw4-promo] patched ${path}`);
  } else {
    console.log(`[gw4-promo] ${path} already ready`);
  }
}

function insertAfter(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`[gw4-promo] anchor not found: ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function insertBefore(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`[gw4-promo] anchor not found: ${label}`);
  return source.replace(anchor, `${insertion}${anchor}`);
}

function replaceOnce(source, from, to, marker, label) {
  if (source.includes(marker || to)) return source;
  if (!source.includes(from)) throw new Error(`[gw4-promo] anchor not found: ${label}`);
  return source.replace(from, to);
}

// Register fixed campaign analytics routes. They intentionally stay separate from
// tournament-entry totals so an existing user entering a cup is never counted as a signup.
patchFile("server/routes.ts", (original) => {
  let source = original;
  source = insertAfter(
    source,
    'import { registerAdminRoutes } from "./routes/admin.routes.js";\n',
    'import { registerGw4PromoRoutes } from "./routes/gw4Promo.routes.js";\n',
    'registerGw4PromoRoutes } from "./routes/gw4Promo.routes.js"',
    "GW4 promo import",
  );
  source = insertAfter(
    source,
    '  registerAdminRoutes(app, { requireAuth, isAdmin, isAdminUser: isAdminRequest });\n',
    '  registerGw4PromoRoutes(app, { requireAuth, isAdmin });\n',
    'registerGw4PromoRoutes(app, { requireAuth, isAdmin });',
    "GW4 promo registration",
  );
  return source;
});

// The generic source-attribution layer already distinguishes new signups from returning
// logins. Reuse those production actions and simply filter them to this campaign.
patchFile("server/routes/gw4Promo.routes.ts", (source) => source
  .replaceAll("marketing.gw4_auth_started", "marketing.auth_started")
  .replaceAll("marketing.gw4_signup_completed", "marketing.signup_completed")
  .replaceAll("marketing.gw4_login_completed", "marketing.login_completed"));

// Premier League changed its current player-photo path. Keep API-Football first, but make
// official PL fallbacks tolerate both the current no-prefix asset path and legacy URLs.
patchFile("server/services/fplApi.ts", (source) => source.replace(
  'return `https://resources.premierleague.com/premierleague/photos/players/${dimensions}/p${id}.png`;',
  'return `https://resources.premierleague.com/premierleague25/photos/players/${dimensions}/${id}.png`; // CURRENT_PL_PLAYER_PHOTO_PATH',
));

patchFile("client/src/lib/card-image.ts", (source) => source.replace(
  'return `https://resources.premierleague.com/premierleague/photos/players/250x250/p${match[1]}.png`;',
  'return `https://resources.premierleague.com/premierleague25/photos/players/250x250/${match[1]}.png`; // CURRENT_PL_PLAYER_PHOTO_PATH',
));

patchFile("server/index.ts", (original) => {
  let source = original;
  const oldBlock = `  const urlsToTry = [target.toString()];\n  const codeMatch = target.pathname.match(/\\/players\\/(?:\\d+x\\d+)\\/p(\\d+)\\.(?:png|jpg|jpeg|webp)$/i);\n  if (codeMatch?.[1]) {\n    const code = codeMatch[1];\n    for (const size of ["500x500", "250x250", "110x110", "40x40"]) urlsToTry.push(\`https://resources.premierleague.com/premierleague/photos/players/\${size}/p\${code}.png\`);\n  }`;
  const newBlock = `  const urlsToTry = [target.toString()];\n  // CURRENT_PL_PLAYER_PHOTO_FALLBACKS: the official PL CDN moved current player\n  // portraits from /premierleague/.../p<code>.png to /premierleague25/.../<code>.png.\n  // Try current assets first, then tolerate older cached/stored URLs.\n  const codeMatch = target.pathname.match(/\\/players\\/(?:\\d+x\\d+)\\/p?(\\d+)\\.(?:png|jpg|jpeg|webp)$/i);\n  if (codeMatch?.[1]) {\n    const code = codeMatch[1];\n    for (const size of ["500x500", "250x250", "110x140", "110x110", "40x40"]) {\n      urlsToTry.push(\`https://resources.premierleague.com/premierleague25/photos/players/\${size}/\${code}.png\`);\n      urlsToTry.push(\`https://resources.premierleague.com/premierleague/photos/players/\${size}/p\${code}.png\`);\n    }\n  }`;
  if (!source.includes("CURRENT_PL_PLAYER_PHOTO_FALLBACKS")) {
    if (!source.includes(oldBlock)) throw new Error("[gw4-promo] image-proxy fallback block not found");
    source = source.replace(oldBlock, newBlock);
  }
  return source;
});

// Dedicated campaign route + automatic post-signup return to the tournament tab.
patchFile("client/src/App.tsx", (original) => {
  let source = original;
  source = insertAfter(
    source,
    'const FreeGameweekLandingPage = React.lazy(() => import("./pages/free-gameweek"));\n',
    'const Gw4FreePromoPage = React.lazy(() => import("./pages/gw4-free-promo"));\n',
    'Gw4FreePromoPage = React.lazy',
    "promo lazy route",
  );
  source = insertAfter(
    source,
    'import { Skeleton } from "./components/ui/skeleton";\n',
    'import { GW4_PROMO_CAMPAIGN, GW4_PROMO_TARGET, clearPostSignupTarget, rememberGw4Promo, reportNativeAccountLinked, sendGw4PromoEvent } from "./lib/gw4-promo";\n',
    'from "./lib/gw4-promo"',
    "promo helpers import",
  );
  source = insertBefore(
    source,
    'function AuthenticatedRouter() {',
    `function Gw4PromoAuthenticatedRedirect() {\n  React.useEffect(() => {\n    rememberGw4Promo();\n    window.location.replace(GW4_PROMO_TARGET);\n  }, []);\n  return <RouteFallback />;\n}\n\n`,
    "function Gw4PromoAuthenticatedRedirect",
    "authenticated promo redirect",
  );
  source = insertAfter(
    source,
    '      <Switch>\n        {legalRouteElements()}\n',
    '        <Route path="/gw4-free" component={Gw4PromoAuthenticatedRedirect} />\n',
    '<Route path="/gw4-free" component={Gw4PromoAuthenticatedRedirect}',
    "authenticated promo route",
  );
  source = replaceOnce(
    source,
    'function PublicRouter() {\n  return <React.Suspense fallback={<RouteFallback />}><Switch>{legalRouteElements()}<Route path="/free" component={FreeGameweekLandingPage} />',
    'function PublicRouter() {\n  return <React.Suspense fallback={<RouteFallback />}><Switch>{legalRouteElements()}<Route path="/gw4-free" component={Gw4FreePromoPage} /><Route path="/free" component={FreeGameweekLandingPage} />',
    '<Route path="/gw4-free" component={Gw4FreePromoPage}',
    "public promo route",
  );

  const appContentAnchor = '  React.useEffect(() => { if (!user) return; const code = localStorage.getItem("fantasy_referral_code"); if (!code) return; fetch("/api/referrals/claim", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).then(() => localStorage.removeItem("fantasy_referral_code")).catch(() => {}); }, [user]);\n';
  const effects = `  React.useEffect(() => {\n    if (!user) return;\n    if (isNativeMobileApp()) reportNativeAccountLinked(String((user as any)?.id || (user as any)?.claims?.sub || ""));\n    const params = new URLSearchParams(window.location.search);\n    if (window.location.pathname === "/competitions" && params.get("promo") === GW4_PROMO_CAMPAIGN) {\n      void sendGw4PromoEvent("tournament_open_after_signup");\n      clearPostSignupTarget();\n    }\n  }, [user]);\n`;
  source = insertAfter(source, appContentAnchor, effects, "reportNativeAccountLinked", "promo completion/native link effect");
  return source;
});

patchFile("client/src/pages/onboarding.tsx", (original) => {
  let source = original;
  source = insertAfter(
    source,
    'import { useLocation } from "wouter";\n',
    'import { clearPostSignupTarget, getPostSignupTarget } from "../lib/gw4-promo";\n',
    'getPostSignupTarget } from "../lib/gw4-promo"',
    "onboarding promo target import",
  );
  const oldSuccess = `      onSuccess: () => {\n        setStep("done");\n        refetch();\n      },`;
  const newSuccess = `      onSuccess: () => {\n        setStep("done");\n        refetch();\n        const target = getPostSignupTarget();\n        if (target) {\n          queryClient.setQueryData(["/api/onboarding/status"], { completed: true });\n          window.setTimeout(() => {\n            clearPostSignupTarget();\n            setLocation(target);\n          }, 250);\n        }\n      },`;
  if (!source.includes("queryClient.setQueryData([\"/api/onboarding/status\"]")) {
    if (!source.includes(oldSuccess)) throw new Error("[gw4-promo] onboarding confirm success anchor not found");
    source = source.replace(oldSuccess, newSuccess);
  }
  source = source.replace(
    '  }, [selectedPlayerIds, chooseMutation, refetch]);',
    '  }, [selectedPlayerIds, chooseMutation, refetch, setLocation]);',
  );
  return source;
});

// Track APK download taps and actual installed-app first opens/account links.
patchFile("client/src/components/InstallAppButton.tsx", (original) => {
  let source = original;
  source = insertAfter(
    source,
    'import { isInstalledMobileApp } from "../lib/site-view";\n',
    'import { sendGw4PromoEvent } from "../lib/gw4-promo";\n',
    'sendGw4PromoEvent } from "../lib/gw4-promo"',
    "install tracking import",
  );
  source = replaceOnce(
    source,
    '    if (isAndroidBrowser) {\n      setPromptOpen(false);\n      window.location.assign(freshAndroidApkUrl());',
    '    if (isAndroidBrowser) {\n      setPromptOpen(false);\n      void sendGw4PromoEvent("app_download_click", { androidVersion: ANDROID_VERSION });\n      window.location.assign(freshAndroidApkUrl());',
    'sendGw4PromoEvent("app_download_click"',
    "APK download tracking",
  );
  return source;
});

patchFile("client/src/main.tsx", (original) => {
  let source = original;
  source = insertAfter(
    source,
    'import { initializeSiteView, isNativeMobileApp } from "./lib/site-view";\n',
    'import { reportNativeFirstOpen } from "./lib/gw4-promo";\n',
    'reportNativeFirstOpen } from "./lib/gw4-promo"',
    "native first-open import",
  );
  source = insertAfter(
    source,
    'patchFetchForApiBase();\n',
    'if (isNativeMobileApp()) reportNativeFirstOpen();\n',
    'if (isNativeMobileApp()) reportNativeFirstOpen();',
    "native first-open event",
  );
  return source;
});

// Wallet funding/payout forms are visible for transparency, but public cash movement is
// still preparing for launch. Say that clearly on both product surfaces.
patchFile("client/src/pages/wallet.tsx", (original) => {
  let source = original;
  source = replaceOnce(
    source,
    '        <h1 className="mb-6 text-2xl font-bold text-foreground">Wallet</h1>',
    '        <div className="mb-3 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-foreground">Wallet</h1><Badge className="border border-amber-300/25 bg-amber-300/10 text-amber-200">COMING SOON</Badge></div>\n        <div data-wallet-coming-soon className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-300/[.07] px-4 py-3 text-sm leading-6 text-amber-50"><strong>Public deposits & withdrawals are coming soon.</strong> Wallet balances, tournament charges, prizes and transaction history remain visible for transparency. Please do not send funds until public wallet funding is announced.</div>',
    'data-wallet-coming-soon',
    "desktop wallet coming-soon notice",
  );
  return source;
});

patchFile("client/src/components/native/NativeWalletPage.tsx", (original) => {
  let source = original;
  source = replaceOnce(
    source,
    '<div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-200/70">Arena wallet</p><h2 className="mt-1 text-2xl font-black">{isLoading ? "Loading…" : money(balance)}</h2><p className="mt-1 text-xs text-slate-500">Available to enter tournaments or buy cards.</p></div>',
    '<div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-200/70">Arena wallet</p><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[.12em] text-amber-100">Coming soon</span></div><h2 className="mt-1 text-2xl font-black">{isLoading ? "Loading…" : money(balance)}</h2><p className="mt-1 text-xs text-slate-500">Available to enter tournaments or buy cards.</p></div>',
    'text-amber-100">Coming soon</span>',
    "native wallet coming-soon badge",
  );
  source = insertAfter(
    source,
    '        <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-black/20 p-3"><div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.12em] text-slate-600"><ShieldCheck className="h-3.5 w-3.5" />Available</div><p className="mt-1 text-sm font-black text-emerald-200">{money(balance)}</p></div><div className="rounded-2xl bg-black/20 p-3"><div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.12em] text-slate-600"><Lock className="h-3.5 w-3.5" />Locked</div><p className="mt-1 text-sm font-black text-amber-100">{money(locked)}</p></div></div>\n',
    '        <div data-native-wallet-coming-soon className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.06] px-3 py-2 text-[10px] leading-4 text-amber-50/80"><strong>Public deposits & withdrawals are coming soon.</strong> Balance and transaction history remain visible while payment launch preparations are completed.</div>\n',
    'data-native-wallet-coming-soon',
    "native wallet coming-soon notice",
  );
  return source;
});

// Promotion analytics gets its own admin card so generic activity, tournament entries and
// existing-user play do not pollute acquisition numbers.
patchFile("client/src/pages/admin.tsx", (original) => {
  let source = original;
  source = insertAfter(
    source,
    'import AdminTournamentDirectory from "../components/admin/AdminTournamentDirectory";\n',
    'import Gw4PromoAnalyticsCard from "../components/admin/Gw4PromoAnalyticsCard";\n',
    'Gw4PromoAnalyticsCard from "../components/admin/Gw4PromoAnalyticsCard"',
    "promo analytics import",
  );
  const anchor = '        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">';
  source = insertBefore(source, anchor, '        <Gw4PromoAnalyticsCard />\n\n', '<Gw4PromoAnalyticsCard />', "promo analytics panel");
  return source;
});

// Retired browser desktop/mobile copy must not leak back into the product after previous
// compatibility patches run. The native APK and website now have their own presentation.
patchFile("client/src/App.tsx", (source) => source
  .replace('aria-label={siteView === "desktop" ? "Switch to mobile site view" : "Switch to desktop site view"}', 'aria-label="Change site view"')
  .replace('title={siteView === "desktop" ? "Switch to mobile view" : "Switch to desktop view"}', 'title="Change site view"')
  .replace('<span className="hidden sm:inline">{siteView === "desktop" ? "Mobile view" : "Desktop view"}</span>', '<span className="hidden sm:inline">View</span>'));

console.log("GW4 promotion launch applied: dedicated ad funnel, post-signup tournament return, wallet transparency, install tracking and current Premier League image fallbacks.");
