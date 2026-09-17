import fs from "node:fs";
import "./apply-common-reward-position-balance.mjs";
import "./verify-referral-history-integrity.mjs";
import "./apply-admin-referral-monitoring.mjs";
import "./apply-current-epl-referral-postguard.mjs";
import "./verify-admin-referral-monitoring.mjs";
import "./prepare-card-acquisition-notification-anchor.mjs";
import "./apply-card-acquisition-notifications.mjs";
import "./verify-card-acquisition-notifications.mjs";
import "./apply-weekly-common-mint-popup.mjs";
import "./verify-weekly-common-mint-popup.mjs";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Weekly reward / Legendary refresh anchor not found: ${label}`);
  return source.replace(from, to);
}

// Keep APK-only verification semantic: comments may document the retired browser
// install event, but the app must not register a real handler for it.
patchFile("scripts/verify-weekly-common-legendary-refresh.mjs", (original) => {
  const oldCheck = `expect(!installApp.includes("beforeinstallprompt"), "APK-only install flow must not capture the browser install prompt");`;
  const newCheck = `expect(!/addEventListener\\s*\\(\\s*["']beforeinstallprompt["']/.test(installApp) && !/onbeforeinstallprompt\\s*=/.test(installApp), "APK-only install flow must not capture the browser install prompt");`;
  return replaceOnce(original, oldCheck, newCheck, "APK-only browser install verifier");
});

// The site-wide verifier still carried two pre-APK assumptions. Keep it aligned
// with the current component: APK-only delivery and an `installed` boolean that
// hides the install control inside the native app.
patchFile("scripts/verify-site-value-image-admin-integrity.mjs", (original) => {
  let source = original;
  source = replaceOnce(
    source,
    `includes(installApp, "beforeinstallprompt", "Install App must use the browser installation flow when available.");`,
    `assert.ok(!/addEventListener\\s*\\(\\s*["']beforeinstallprompt["']/.test(installApp) && !/onbeforeinstallprompt\\s*=/.test(installApp), "Install App must stay APK-only and must not register a browser install prompt handler.");`,
    "site integrity APK-only browser install verifier",
  );
  source = replaceOnce(
    source,
    `includes(installApp, "if (isInstalledMobileApp()) return null", "Install App option must disappear inside an installed app.");`,
    `includes(installApp, "const installed = isInstalledMobileApp();", "Install App must detect installed-app sessions.");\nincludes(installApp, "if (installed) return null", "Install App option must disappear inside an installed app.");`,
    "site integrity installed-app hide verifier",
  );
  return source;
});

patchFile("server/services/prizeEngine.ts", (original) => {
  let source = original;
  source = replaceOnce(
    source,
    '  makePrize("legendary-world-cup", "FIFA World Cup VIP Trip", 250000, "Travel", "legendary"),',
    '  makePrize("legendary-world-cup", "N$250,000 Cash", 250000, "Cash", "legendary"),',
    "replace World Cup VIP trip",
  );
  source = replaceOnce(
    source,
    '  makePrize("legendary-tiny-home", "Tiny Home / Equivalent Value", 350000, "Property", "legendary"),',
    '  makePrize("legendary-tiny-home", "N$350,000 Vehicle Deposit / Equivalent Value", 350000, "Vehicle", "legendary"),',
    "replace Tiny Home",
  );
  return source;
});

patchFile("client/src/components/prize-vault/prizeArtworkCatalogLegacy.ts", (original) => {
  let source = original;
  source = replaceOnce(
    source,
    '    { pattern: /^FIFA\\s+World\\s+Cup\\s+VIP\\s+Trip$/i, src: "/prizes/legendary/legendary-05-cash-250000.png" },',
    '    { pattern: /^N\\$250,?000\\s+Cash$/i, src: "/prizes/legendary/legendary-05-cash-250000.png" },',
    "map N$250,000 Cash artwork",
  );
  source = replaceOnce(
    source,
    '    { pattern: /^Tiny\\s+Home\\s*\\/\\s*Equivalent\\s+Value$/i, src: "/prizes/legendary/legendary-08-tiny-home.png" },',
    '    { pattern: /^N\\$350,?000\\s+Vehicle\\s+Deposit\\s*\\/\\s*Equivalent\\s+Value$/i, src: "/prizes/legendary/legendary-08-vehicle-deposit-350000.svg" },',
    "map vehicle deposit artwork",
  );
  return source;
});

console.log("Applied weekly Common reward / Legendary prize refresh: Common rewards balance tournament positions; N$250k Cash and N$350k Vehicle Deposit replace World Cup VIP Trip and Tiny Home.");
