import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// These are CLI scripts: their idempotent process.exit(0) must not terminate
// this orchestrator and silently skip the remaining production repairs.
function runPreparationScript(path) {
  execFileSync(process.execPath, [fileURLToPath(new URL(path, import.meta.url))], { stdio: "inherit" });
}

runPreparationScript("./apply-starter-draft-mobile-rendering.mjs");
runPreparationScript("./apply-stable-collection-portrait-state.mjs");
runPreparationScript("./apply-starter-draft-player-details.mjs");

const landingPath = "client/src/pages/landing.tsx";
let landing = fs.readFileSync(landingPath, "utf8");

if (!landing.includes('data-auth-copy="login-signup"')) {
  const variants = [
    ['<a href={loginHref} onClick={trackStartFree}><Button data-testid="button-login">Start Free</Button></a>', '<a href={loginHref} onClick={trackStartFree}><Button data-testid="button-login" data-auth-copy="login-signup">Login / Sign Up</Button></a>'],
    ['<a href={loginHref} onClick={trackStartFree}><Button data-testid="button-login">Enter Free</Button></a>', '<a href={loginHref} onClick={trackStartFree}><Button data-testid="button-login" data-auth-copy="login-signup">Login / Sign Up</Button></a>'],
    ['<a href={loginHref}><Button data-testid="button-login">Start Free</Button></a>', '<a href={loginHref}><Button data-testid="button-login" data-auth-copy="login-signup">Login / Sign Up</Button></a>'],
    ['<a href={loginHref}><Button data-testid="button-login">Enter Free</Button></a>', '<a href={loginHref}><Button data-testid="button-login" data-auth-copy="login-signup">Login / Sign Up</Button></a>'],
  ];
  let changed = false;
  for (const [from, to] of variants) {
    if (!landing.includes(from)) continue;
    landing = landing.replace(from, to);
    changed = true;
    break;
  }
  if (!changed) throw new Error("[play-gameweek-navigation] landing auth CTA could not be located");
  fs.writeFileSync(landingPath, landing);
  console.log("[play-gameweek-navigation] landing auth CTA changed to Login / Sign Up without removing funnel tracking");
}

runPreparationScript("./apply-play-gameweek-navigation.mjs");
runPreparationScript("./apply-native-play-leaderboard-25.mjs");
runPreparationScript("./apply-common-open-entry-ui.mjs");
runPreparationScript("./apply-native-prize-vault-button.mjs");
runPreparationScript("./apply-lineup-rarity-glows-v2.mjs");
runPreparationScript("./repair-common-reward-desktop-only-anchor.mjs");
runPreparationScript("./apply-squad-hub-premier-desktop-web.mjs");
runPreparationScript("./apply-responsive-web-default.mjs");
runPreparationScript("./repair-squad-hub-jsx.mjs");
runPreparationScript("./apply-match-centre-popup.mjs");
runPreparationScript("./fix-native-prize-links-premier-label.mjs");
runPreparationScript("./apply-free-cup-prize-overlay-polish.mjs");
runPreparationScript("./apply-marketplace-club-identities.mjs");
runPreparationScript("./apply-featured-cup-entry-details.mjs");
runPreparationScript("./apply-native-logout-signup-polish.mjs");
runPreparationScript("./apply-native-admin-safe-logout.mjs");
runPreparationScript("./apply-native-tournament-player-image-fallback.mjs");
runPreparationScript("./enforce-starter-draft-team-label.mjs");
runPreparationScript("./apply-starter-confirm-single-tap.mjs");
runPreparationScript("./apply-current-tournament-ui-policy.mjs");

// Apply the #355 scroll/version-registration patch first, then immediately layer
// the 1.1.11 updater safety gate over it. Both patchers are required to be
// idempotent because the production build invokes this preparation repeatedly.
runPreparationScript("./apply-native-full-scroll-app-updates.mjs");
runPreparationScript("./apply-native-in-app-updater.mjs");
runPreparationScript("./verify-native-full-scroll-app-updates.mjs");

// Run after all legacy patchers so regenerated scripts cannot drop this gate.
runPreparationScript("./verify-marketplace-account-price-integrity.mjs");
