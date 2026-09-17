import fs from "node:fs";

await import("./apply-starter-draft-mobile-rendering.mjs");
await import("./apply-stable-collection-portrait-state.mjs");
await import("./apply-starter-draft-player-details.mjs");

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

await import("./apply-play-gameweek-navigation.mjs");
await import("./apply-native-play-leaderboard-25.mjs");
await import("./apply-common-open-entry-ui.mjs");
await import("./apply-native-prize-vault-button.mjs");
await import("./apply-lineup-rarity-glows-v2.mjs");
await import("./repair-common-reward-desktop-only-anchor.mjs");
await import("./apply-squad-hub-premier-desktop-web.mjs");
await import("./apply-responsive-web-default.mjs");
await import("./repair-squad-hub-jsx.mjs");
await import("./apply-match-centre-popup.mjs");
await import("./fix-native-prize-links-premier-label.mjs");
await import("./apply-free-cup-prize-overlay-polish.mjs");
await import("./apply-marketplace-club-identities.mjs");
await import("./apply-featured-cup-entry-details.mjs");
await import("./apply-native-logout-signup-polish.mjs");
await import("./apply-native-admin-safe-logout.mjs");
await import("./apply-native-tournament-player-image-fallback.mjs");
await import("./enforce-starter-draft-team-label.mjs");
await import("./apply-starter-confirm-single-tap.mjs");
await import("./apply-current-tournament-ui-policy.mjs");

// The full-page scroll source from #355 is already committed. Do not re-run its
// legacy GitHub/browser updater patch over the new native 1.1.11 updater.
await import("./apply-native-in-app-updater.mjs");
await import("./verify-native-full-scroll-app-updates.mjs");
