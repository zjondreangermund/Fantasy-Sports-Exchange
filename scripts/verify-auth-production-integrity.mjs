import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const authConfig = read("server/auth-config.ts");
const authRoutes = read("server/routes/auth.routes.ts");
const routes = read("server/routes.ts");
const index = read("server/index.ts");
const envExample = read(".env.example");

expect(authConfig.includes('mockAuthRequested && !isProduction'), "Mock auth must be disabled in production");
expect(authConfig.includes('randomBytes(48)'), "A secure ephemeral fallback secret must be generated");
expect(authConfig.includes('configuredSessionSecret.length >= 32'), "Configured session secrets must be at least 32 characters");
expect(routes.includes('from "./auth-config.js"'), "Routes must use the central auth configuration");
expect(!routes.includes('!process.env.SESSION_SECRET'), "Missing SESSION_SECRET must never auto-enable mock auth");
expect(authRoutes.includes('if (!googleAuthEnabled)'), "Missing OAuth configuration must fail closed");
expect(authRoutes.includes('status(503)'), "Misconfigured authentication must return a service-unavailable response");
expect(index.includes('secret: getSessionSecret()'), "Session middleware must use the hardened secret provider");
expect(index.includes('if (googleAuthEnabled)'), "Google strategy registration must be conditional");
expect(!index.includes('dev_secret_change_me'), "Known development session secret must not remain");
expect(!index.includes('capturedJsonResponse'), "API response bodies must not be captured for logs");
expect(!index.includes('JSON.stringify(capturedJsonResponse)'), "Private API response bodies must not be logged");
expect(index.includes('API response bodies are intentionally excluded'), "Private logging policy comment is missing");
expect(envExample.includes('USE_MOCK_AUTH=false'), "Environment example must default mock authentication off");

if (failures.length) {
  console.error("Production authentication integrity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production authentication integrity verified.");
