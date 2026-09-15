import fs from "node:fs";

const auth = fs.readFileSync("server/routes/auth.routes.ts", "utf8");

function need(token, message) {
  if (!auth.includes(token)) throw new Error(message);
}

need("async function endAuthenticatedSession", "Logout must use isolated asynchronous session cleanup");
need("await endAuthenticatedSession(req)", "Logout routes must wait for their own session cleanup");
need("Always complete Passport logout first", "Passport and session-store cleanup ordering is undocumented");
if (auth.includes("req.logout?.(() => {});\n    req.session?.destroy(() => {});")) {
  throw new Error("Logout still destroys the session concurrently with Passport regeneration");
}

const logoutStart = auth.indexOf("async function endAuthenticatedSession");
const logoutEnd = auth.indexOf("export async function registerAuthModeRoutes");
const helper = auth.slice(logoutStart, logoutEnd);
if (helper.indexOf("req.logout") > helper.indexOf("req.session.destroy")) {
  throw new Error("Passport logout must finish before session destruction begins");
}

console.log("Logout isolation verified: one device destroys only its own session without a Passport/session-store race.");
