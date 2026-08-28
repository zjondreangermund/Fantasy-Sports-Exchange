import fs from "node:fs";

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
