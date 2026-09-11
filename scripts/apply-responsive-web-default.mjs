import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const write = (path, source) => fs.writeFileSync(path, source);

function replaceBetween(source, startToken, endToken, replacement, label) {
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`[responsive-web] ${label} start anchor not found`);
  const end = source.indexOf(endToken, start);
  if (end < 0) throw new Error(`[responsive-web] ${label} end anchor not found`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// Browser layout must follow the real device viewport again. The old desktop-only
// web patch used a fixed 1280px layout on phones, shrinking Starter Draft cards
// until names and clubs were unreadable. "mobile" here means the normal
// width=device-width responsive viewport; desktop browsers still render at their
// full desktop width through the existing responsive CSS breakpoints.
{
  const path = "client/src/lib/site-view.ts";
  let source = read(path);
  const replacement = `export function getSiteViewMode(): SiteViewMode {\n  // Use the browser/device viewport naturally. Responsive CSS decides the layout.\n  return \"mobile\";\n}\n\n`;
  source = replaceBetween(
    source,
    "export function getSiteViewMode(): SiteViewMode {",
    "export function applySiteView",
    replacement,
    "site view mode",
  );

  const forcedDesktop = '  const effectiveMode: SiteViewMode = isNativeMobileApp() ? "mobile" : "desktop";';
  const legacySwitchable = '  const effectiveMode: SiteViewMode = isNativeMobileApp() ? "mobile" : mode;';
  const responsiveMode = '  const effectiveMode: SiteViewMode = "mobile";';
  if (source.includes(forcedDesktop)) source = source.replace(forcedDesktop, responsiveMode);
  else if (source.includes(legacySwitchable)) source = source.replace(legacySwitchable, responsiveMode);
  else if (!source.includes(responsiveMode)) throw new Error("[responsive-web] effective viewport mode anchor not found");

  write(path, source);
}

// The Desktop/Mobile switch is retired. Device width is automatic, so there is
// no user preference that can accidentally reopen a 1280px canvas on a phone.
{
  const path = "client/src/App.tsx";
  const source = read(path);
  if (source.includes("Switch to desktop site view") || source.includes("Switch to mobile site view")) {
    throw new Error("[responsive-web] manual desktop/mobile switch is still rendered");
  }
  if (source.includes("MobileNavDock")) {
    throw new Error("[responsive-web] retired manual mobile-view dock is still mounted");
  }
}

// Production validation previously rewrote these checks to enforce desktop-only
// browser traffic. Update those generated verifier expectations after that legacy
// compatibility patch has run so CI now protects the responsive default instead.
{
  const path = "scripts/verify-weekly-common-legendary-refresh.mjs";
  let source = read(path);
  source = source.replace(
    `// The dedicated native APK owns the compact mobile UI. Browser/PWA traffic is\n// desktop-only and cannot revive the retired phone web layout. Existing desktop\n// viewport/panning guards remain available for the normal website.`,
    `// Browser/PWA and native sessions use the real device viewport. Responsive CSS\n// chooses the phone or desktop layout automatically; no fixed desktop canvas is\n// allowed on mobile browsers.`,
  );
  source = source.replace(
    `expect(siteView.includes('return isNativeMobileApp() ? "mobile" : "desktop";'), "Native APK must own mobile UI while browser/PWA traffic defaults to Desktop view");`,
    `expect(siteView.includes('const effectiveMode: SiteViewMode = "mobile";'), "Browser/PWA traffic must use the normal device-width responsive viewport");`,
  );
  source = source.replace(
    `console.log("Common rewards verified: weekly and referral cards balance tournament positions while player identity remains random; referral rewards are atomic/idempotent; signed-in web users retain Install App access; native APK owns compact mobile UI and browser/PWA traffic is desktop-only.");`,
    `console.log("Common rewards verified: weekly and referral cards balance tournament positions while player identity remains random; referral rewards are atomic/idempotent; signed-in web users retain Install App access; browser/PWA traffic uses the normal responsive device viewport.");`,
  );
  write(path, source);
}

{
  const path = "scripts/verify-site-value-image-admin-integrity.mjs";
  let source = read(path);
  source = source.replace(
    `includes(view, 'return isNativeMobileApp() ? "mobile" : "desktop";', "Native APK must own the compact mobile UI while browser/PWA traffic stays desktop-only.");`,
    `includes(view, 'const effectiveMode: SiteViewMode = "mobile";', "Browser/PWA traffic must use the normal device-width responsive viewport.");`,
  );
  source = source.replace(
    `console.log("Fantasy Arena image fallbacks, exact scores and values, SQL safety, private entries, install access, desktop-first app sessions, zoom panning, and admin tournament reconciliation verified.");`,
    `console.log("Fantasy Arena image fallbacks, exact scores and values, SQL safety, private entries, install access, responsive browser sessions, zoom support, and admin tournament reconciliation verified.");`,
  );
  write(path, source);
}

const finalSiteView = read("client/src/lib/site-view.ts");
const finalApp = read("client/src/App.tsx");
const checks = [
  [finalSiteView.includes('const effectiveMode: SiteViewMode = "mobile";'), "fixed desktop viewport is still active"],
  [finalSiteView.includes('const MOBILE_VIEWPORT = "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=yes";'), "standard device-width viewport is missing"],
  [!finalSiteView.includes('return isNativeMobileApp() ? "mobile" : "desktop";'), "desktop-only browser mode is still present"],
  [!finalApp.includes("Switch to desktop site view") && !finalApp.includes("Switch to mobile site view"), "manual view toggle is still present"],
];
const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) throw new Error(`[responsive-web] verification failed: ${failures.join("; ")}`);

console.log("[responsive-web] Browser/PWA restored to normal device-width responsive layout; native APK routing remains unchanged.");
