export const GW4_PROMO_CAMPAIGN = "gw4_free_common_2026";
export const GW4_PROMO_PATH = "/gw4-free";
export const GW4_PROMO_TARGET = "/competitions?tab=open&gameweek=4&rarity=common&promo=gw4_free_common_2026";

const VISITOR_KEY = "fantasy_arena_marketing_visitor_id";
const SESSION_KEY = "fantasy_arena_marketing_session_id";
const ATTRIBUTION_KEY = "fantasy_arena_gw4_promo_attribution";
const POST_SIGNUP_KEY = "fantasy_arena_post_signup_target";
const INSTALL_ID_KEY = "fantasy_arena_native_install_id";
const FIRST_OPEN_KEY = "fantasy_arena_native_first_open_reported";

type StoredAttribution = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
};

export type Gw4PromoEvent =
  | "promo_click"
  | "promo_signup_click"
  | "tournament_open_after_signup"
  | "app_download_click"
  | "app_install_first_open"
  | "app_install_account_linked";

function clean(value: unknown, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function safeStorageGet(key: string) {
  try { return window.localStorage.getItem(key) || ""; } catch { return ""; }
}

function safeStorageSet(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* storage can be restricted in social browsers */ }
}

function safeSessionGet(key: string) {
  try { return window.sessionStorage.getItem(key) || ""; } catch { return ""; }
}

function safeSessionSet(key: string, value: string) {
  try { window.sessionStorage.setItem(key, value); } catch { /* storage can be restricted in social browsers */ }
}

function normalizeSource(value: string) {
  const raw = clean(value, 200).toLowerCase();
  if (/instagram/.test(raw)) return "instagram";
  if (/facebook|fb\.com|m\.facebook|l\.facebook/.test(raw)) return "facebook";
  if (/tiktok|bytedance/.test(raw)) return "tiktok";
  if (/whatsapp/.test(raw)) return "whatsapp";
  if (!raw) return "direct";
  return raw.replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 40) || "other";
}

function generateId(prefix: string) {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getMarketingVisitorId() {
  if (typeof window === "undefined") return "";
  const existing = safeStorageGet(VISITOR_KEY);
  if (existing) return existing;
  const generated = generateId("fa");
  safeStorageSet(VISITOR_KEY, generated);
  return generated;
}

export function getMarketingSessionId() {
  if (typeof window === "undefined") return "";
  const existing = safeSessionGet(SESSION_KEY);
  if (existing) return existing;
  const generated = generateId("session");
  safeSessionSet(SESSION_KEY, generated);
  return generated;
}

function freshMetaTrafficSource() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const explicitSource = normalizeSource(params.get("utm_source") || params.get("source") || "");
  const referrer = typeof document !== "undefined" ? document.referrer.toLowerCase() : "";

  if (params.has("fbclid")) return /instagram/.test(referrer) ? "instagram" : "facebook";
  if (params.has("igshid")) return "instagram";
  if (["facebook", "instagram", "meta"].includes(explicitSource)) return explicitSource;
  if (/instagram/.test(referrer)) return "instagram";
  if (/facebook|fb\.com|m\.facebook|l\.facebook/.test(referrer)) return "facebook";
  return "";
}

export function currentGw4Attribution(): StoredAttribution {
  if (typeof window === "undefined") return { source: "direct", medium: "", campaign: GW4_PROMO_CAMPAIGN, content: "" };
  const params = new URLSearchParams(window.location.search);
  let stored: Partial<StoredAttribution> = {};
  try { stored = JSON.parse(safeStorageGet(ATTRIBUTION_KEY) || "{}"); } catch { stored = {}; }
  const explicitSource = params.get("utm_source") || params.get("source") || "";
  const referrer = typeof document !== "undefined" ? document.referrer : "";
  const metaSignal = params.has("fbclid")
    ? (/instagram/i.test(referrer) ? "instagram" : "facebook")
    : params.has("igshid")
      ? "instagram"
      : "";
  return {
    source: normalizeSource(explicitSource || metaSignal || String(stored.source || "") || referrer),
    medium: clean(params.get("utm_medium") || stored.medium || "", 80),
    campaign: clean(params.get("utm_campaign") || stored.campaign || GW4_PROMO_CAMPAIGN, 160) || GW4_PROMO_CAMPAIGN,
    content: clean(params.get("utm_content") || stored.content || "", 160),
  };
}

export function rememberGw4Promo() {
  if (typeof window === "undefined") return;
  const attribution = { ...currentGw4Attribution(), campaign: GW4_PROMO_CAMPAIGN };
  safeStorageSet(ATTRIBUTION_KEY, JSON.stringify(attribution));
  safeStorageSet(POST_SIGNUP_KEY, GW4_PROMO_TARGET);
}

export function captureGw4MetaHomepageVisit() {
  if (typeof window === "undefined" || window.location.pathname !== "/") return;
  const source = freshMetaTrafficSource();
  if (!source) return;

  const sessionId = getMarketingSessionId();
  const sessionKey = `fantasy_arena_meta_home_landing:${GW4_PROMO_CAMPAIGN}:${sessionId}`;
  if (safeSessionGet(sessionKey)) return;

  const attribution = {
    ...currentGw4Attribution(),
    source,
    campaign: GW4_PROMO_CAMPAIGN,
  };
  safeStorageSet(ATTRIBUTION_KEY, JSON.stringify(attribution));
  safeStorageSet(POST_SIGNUP_KEY, GW4_PROMO_TARGET);
  safeSessionSet(sessionKey, "1");
  void sendGw4PromoEvent("promo_click");
}

export function getPostSignupTarget() {
  if (typeof window === "undefined") return "";
  const target = safeStorageGet(POST_SIGNUP_KEY);
  return target.startsWith("/competitions") ? target : "";
}

export function clearPostSignupTarget() {
  try { window.localStorage.removeItem(POST_SIGNUP_KEY); } catch { /* ignore */ }
}

export function gw4PromoLoginHref() {
  if (typeof window === "undefined") return "/api/login";
  rememberGw4Promo();
  const attribution = currentGw4Attribution();
  const params = new URLSearchParams({
    promo: GW4_PROMO_CAMPAIGN,
    vid: getMarketingVisitorId(),
    source: attribution.source,
    utm_campaign: GW4_PROMO_CAMPAIGN,
  });
  if (attribution.medium) params.set("utm_medium", attribution.medium);
  if (attribution.content) params.set("utm_content", attribution.content);
  return `/api/login?${params.toString()}`;
}

export function sendGw4PromoEvent(event: Gw4PromoEvent, extra: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return Promise.resolve();
  const attribution = currentGw4Attribution();
  const payload = {
    event,
    visitorId: getMarketingVisitorId(),
    sessionId: getMarketingSessionId(),
    path: `${window.location.pathname}${window.location.search}`,
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    content: attribution.content,
    ...extra,
  };
  return fetch("/api/promo/gw4-free/event", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).then(() => undefined).catch(() => undefined);
}

function getNativeInstallationId() {
  if (typeof window === "undefined") return "";
  const existing = safeStorageGet(INSTALL_ID_KEY);
  if (existing) return existing;
  const value = generateId("install");
  safeStorageSet(INSTALL_ID_KEY, value);
  return value;
}

export function reportNativeFirstOpen() {
  if (typeof window === "undefined" || safeStorageGet(FIRST_OPEN_KEY)) return;
  safeStorageSet(FIRST_OPEN_KEY, new Date().toISOString());
  void sendGw4PromoEvent("app_install_first_open", { installationId: getNativeInstallationId() });
}

export function reportNativeAccountLinked(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  const installationId = getNativeInstallationId();
  const key = `fantasy_arena_native_install_linked:${installationId}:${userId}`;
  if (safeStorageGet(key)) return;
  safeStorageSet(key, new Date().toISOString());
  void sendGw4PromoEvent("app_install_account_linked", { installationId });
}
