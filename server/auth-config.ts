import { randomBytes } from "node:crypto";

export const isProduction = process.env.NODE_ENV === "production";
export const isReplit = Boolean(process.env.REPL_ID);

const mockAuthRequested = process.env.USE_MOCK_AUTH === "true";
export const useMockAuth = mockAuthRequested && !isProduction;

export const appUrl = String(process.env.APP_URL || "http://localhost:5000").replace(/\/$/, "");
export const googleClientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
export const googleClientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();

const productionAppUrlConfigured = !isProduction || Boolean(String(process.env.APP_URL || "").trim());
export const googleAuthEnabled = !isReplit
  && !useMockAuth
  && Boolean(googleClientId && googleClientSecret && productionAppUrlConfigured);

export const authConfigurationError = !isReplit && !useMockAuth && !googleAuthEnabled
  ? "Authentication is temporarily unavailable because Google OAuth is not fully configured."
  : null;

const configuredSessionSecret = String(process.env.SESSION_SECRET || "").trim();
const ephemeralSessionSecret = randomBytes(48).toString("hex");

export function getSessionSecret(): string {
  return configuredSessionSecret.length >= 32 ? configuredSessionSecret : ephemeralSessionSecret;
}

export const authStartupWarnings: string[] = [
  ...(isProduction && mockAuthRequested
    ? ["USE_MOCK_AUTH was requested in production and has been disabled. Configure Google OAuth instead."]
    : []),
  ...(configuredSessionSecret.length < 32
    ? [isProduction
      ? "SESSION_SECRET is missing or shorter than 32 characters. An ephemeral secret is being used; sessions will reset after a restart."
      : "SESSION_SECRET is missing or shorter than 32 characters. Using an ephemeral development secret."]
    : []),
  ...(authConfigurationError ? [authConfigurationError] : []),
];
