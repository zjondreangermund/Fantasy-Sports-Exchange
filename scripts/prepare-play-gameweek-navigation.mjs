import fs from "node:fs";

// Compact xs cards must be patched before Vite builds the client bundle. Running
// this here keeps Android/PWA/native collection cards off the 3D glow compositor
// path instead of applying the stabilization only after the client was built.
await import("./apply-starter-draft-mobile-rendering.mjs");

const landingPath = "client/src/pages/landing.tsx";
let landing = fs.readFileSync(landingPath, "utf8");

if (!landing.includes('data-auth-copy="login-signup"')) {
  const variants = [
    [
      '<a href={loginHref} onClick={trackStartFree}><Button data-testid="button-login">Start Free</Button></a>',
      '<a href={loginHref} onClick={trackStartFree}><Button data-testid="button-login" data-auth-copy="login-signup">Login / Sign Up</Button></a>',
    ],
    [
      '<a href={loginHref} onClick={trackStartFree}><Button data-testid="button-login">Enter Free</Button></a>',
      '<a href={loginHref} onClick={trackStartFree}><Button data-testid="button-login" data-auth-copy="login-signup">Login / Sign Up</Button></a>',
    ],
    [
      '<a href={loginHref}><Button data-testid="button-login">Start Free</Button></a>',
      '<a href={loginHref}><Button data-testid="button-login" data-auth-copy="login-signup">Login / Sign Up</Button></a>',
    ],
    [
      '<a href={loginHref}><Button data-testid="button-login">Enter Free</Button></a>',
      '<a href={loginHref}><Button data-testid="button-login" data-auth-copy="login-signup">Login / Sign Up</Button></a>',
    ],
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
await import("./apply-lineup-rarity-glows.mjs");
