import fs from "node:fs";

const path = "client/src/hooks/use-auth.ts";
let source = fs.readFileSync(path, "utf8");

const marker = "LOGOUT_SIGNIN_REDIRECT_V1";
if (!source.includes(marker)) {
  const from = `async function logout(): Promise<void> {\n  await fetch("/api/auth/logout", {\n    method: "POST",\n    credentials: "include",\n  }).catch(() => undefined);\n}`;
  const to = `async function logout(): Promise<void> {\n  await fetch("/api/auth/logout", {\n    method: "POST",\n    credentials: "include",\n  }).catch(() => undefined);\n\n  // LOGOUT_SIGNIN_REDIRECT_V1: a signed-out user must never remain on an authenticated app route.\n  // replace() also prevents Android's Back button from reopening the previous private screen.\n  if (typeof window !== "undefined") window.location.replace("/");\n}`;
  if (!source.includes(from)) throw new Error("Logout redirect patch anchor not found");
  source = source.replace(from, to);
  fs.writeFileSync(path, source);
  console.log("Logout now redirects to the public sign-in screen.");
} else {
  console.log("Logout sign-in redirect already applied.");
}
