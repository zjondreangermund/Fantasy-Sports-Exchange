import fs from "node:fs";

// This compatibility patch runs immediately before the desktop-only website
// transition. Production validation may already have inserted InstallAppButton
// beside the legacy mobile/desktop toggle, while Android builds start clean.
// Normalize both paths, then update older build patches/verifiers so the new
// product split is enforced consistently.

const appPath = "client/src/App.tsx";
let app = fs.readFileSync(appPath, "utf8");
const installBeforeLegacyToggle = '<div className="flex shrink-0 items-center gap-1.5"><InstallAppButton /><button type="button" onClick={() => setSiteView(';
const legacyToggle = '<div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={() => setSiteView(';
if (app.includes(installBeforeLegacyToggle)) {
  app = app.replace(installBeforeLegacyToggle, legacyToggle);
  console.log("[desktop-only-install-app] normalized the already-patched legacy header before removing the browser mobile toggle.");
}

// PATCH_CHAIN_TOGGLE_NORMALIZER_V2
// Other check-time patches can reformat the old view-toggle callback. Remove
// the complete toggle block by its stable accessibility copy instead of relying
// on the exact callback text, while preserving ThemeToggle as the header anchor
// that the desktop-only patch expects.
if (app.includes("Switch to desktop site view") || app.includes("Switch to mobile site view")) {
  const headerStart = '<div className="flex shrink-0 items-center gap-1.5">';
  const marker = app.includes("Switch to desktop site view") ? "Switch to desktop site view" : "Switch to mobile site view";
  const markerIndex = app.indexOf(marker);
  const start = app.lastIndexOf(headerStart, markerIndex);
  const themeClose = '<ThemeToggle /></div>';
  const end = app.indexOf(themeClose, markerIndex);
  if (start < 0 || end < 0) throw new Error("[desktop-only-install-app] could not normalize the legacy browser view toggle");
  app = app.slice(0, start) + `${headerStart}<ThemeToggle /></div>` + app.slice(end + themeClose.length);
  console.log("[desktop-only-install-app] removed the retired browser mobile/desktop toggle using its stable accessibility marker.");
}
fs.writeFileSync(appPath, app);

const patchPath = "scripts/apply-common-reward-position-balance.mjs";
let source = fs.readFileSync(patchPath, "utf8");
const marker = "DESKTOP_ONLY_INSTALL_APP_COMPAT_V1";

if (!source.includes(marker)) {
  const oldBlock = `  source = replaceRequired(\n    source,\n    '<div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={() => setSiteView(',\n    '<div className="flex shrink-0 items-center gap-1.5"><InstallAppButton /><button type="button" onClick={() => setSiteView(',\n    "authenticated Install App control",\n  );`;

  const newBlock = `  // ${marker}\n  // Browser traffic is desktop-only now, so the retired mobile/desktop toggle\n  // may already be gone by the time this idempotent build patch runs. Keep the\n  // signed-in Install App control in either layout.\n  if (!source.includes("<InstallAppButton />")) {\n    const legacyInstallAnchor = '<div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={() => setSiteView(';\n    const desktopOnlyInstallAnchor = '<div className="flex shrink-0 items-center gap-1.5"><ThemeToggle /></div>';\n    if (source.includes(legacyInstallAnchor)) {\n      source = source.replace(legacyInstallAnchor, '<div className="flex shrink-0 items-center gap-1.5"><InstallAppButton /><button type="button" onClick={() => setSiteView(');\n    } else if (source.includes(desktopOnlyInstallAnchor)) {\n      source = source.replace(desktopOnlyInstallAnchor, '<div className="flex shrink-0 items-center gap-1.5"><InstallAppButton /><ThemeToggle /></div>');\n    } else {\n      throw new Error("Common reward position-balance anchor not found: authenticated Install App control");\n    }\n  }`;

  if (!source.includes(oldBlock)) throw new Error("[desktop-only-install-app] legacy Install App patch block not found");
  source = source.replace(oldBlock, newBlock);
  fs.writeFileSync(patchPath, source);
  console.log("[desktop-only-install-app] Install App patch now supports the desktop-only website header.");
} else {
  console.log("[desktop-only-install-app] Install App compatibility already applied.");
}

const verifierPath = "scripts/verify-weekly-common-legendary-refresh.mjs";
let verifier = fs.readFileSync(verifierPath, "utf8");
const oldComment = `// Every fresh installed-app session is desktop-first, while a temporary Mobile\n// view switch remains possible for that session. Pinch zoom must allow panning\n// in both directions in Desktop view.`;
const newComment = `// The dedicated native APK owns the compact mobile UI. Browser/PWA traffic is\n// desktop-only and cannot revive the retired phone web layout. Existing desktop\n// viewport/panning guards remain available for the normal website.`;
verifier = verifier.replace(oldComment, newComment);
verifier = verifier.replace(
  'expect(siteView.includes(\'if (isInstalledMobileApp()) return "desktop";\'), "Installed mobile app must default to Desktop view on a fresh app session");',
  'expect(siteView.includes(\'return isNativeMobileApp() ? "mobile" : "desktop";\'), "Native APK must own mobile UI while browser/PWA traffic defaults to Desktop view");',
);
verifier = verifier.replace(
  'console.log("Common rewards verified: weekly and referral cards balance tournament positions while player identity remains random; referral rewards are atomic/idempotent; signed-in web users retain Install App access; installed app sessions default to Desktop view and support two-axis panning while zoomed.");',
  'console.log("Common rewards verified: weekly and referral cards balance tournament positions while player identity remains random; referral rewards are atomic/idempotent; signed-in web users retain Install App access; native APK owns compact mobile UI and browser/PWA traffic is desktop-only.");',
);
fs.writeFileSync(verifierPath, verifier);
console.log("[desktop-only-install-app] weekly reward verifier now matches the APK-only mobile product split.");

const integrityPath = "scripts/verify-site-value-image-admin-integrity.mjs";
let integrity = fs.readFileSync(integrityPath, "utf8");
integrity = integrity.replace(
  'includes(view, \'if (isInstalledMobileApp()) return "desktop";\', "Installed mobile apps must default to the desktop website layout on each fresh session.");',
  'includes(view, \'return isNativeMobileApp() ? "mobile" : "desktop";\', "Native APK must own the compact mobile UI while browser/PWA traffic stays desktop-only.");',
);
integrity = integrity.replace(
  'includes(app, "Switch to desktop site view", "Managers must be able to toggle between desktop and mobile views.");',
  'assert.ok(!app.includes("Switch to desktop site view") && !app.includes("Switch to mobile site view"), "The retired browser desktop/mobile view toggle must not be rendered.");\nassert.ok(!app.includes("MobileNavDock"), "The retired browser mobile navigation dock must not be mounted.");',
);
fs.writeFileSync(integrityPath, integrity);
console.log("[desktop-only-install-app] site integrity verifier now requires desktop web plus native-APK mobile UI.");
