import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { GW4_PROMO_CAMPAIGN } from "../routes/gw4Promo.routes.js";

type Gw4Attribution = {
  visitorId: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  startedAt: string;
};

function clean(value: unknown, max = 160) {
  return String(value || "").trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}

function normalizeSource(value: unknown) {
  const raw = clean(value, 240).toLowerCase();
  if (/instagram/.test(raw)) return "instagram";
  if (/facebook|fb\.com|m\.facebook|l\.facebook/.test(raw)) return "facebook";
  if (/tiktok|bytedance/.test(raw)) return "tiktok";
  if (/whatsapp/.test(raw)) return "whatsapp";
  if (!raw) return "direct";
  return raw.replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 40) || "other";
}

async function write(action: string, userId: string | null, attribution: Gw4Attribution) {
  await db.execute(sql`insert into app.audit_logs (user_id, action, meta) values (${userId}, ${action}, ${JSON.stringify(attribution)}::jsonb)`);
}

export async function captureGw4PromoAuth(req: any) {
  const campaign = clean(req.query?.utm_campaign || req.query?.promo, 160);
  if (campaign !== GW4_PROMO_CAMPAIGN) return null;
  const visitorId = clean(req.query?.vid, 96).replace(/[^a-zA-Z0-9._:-]/g, "");
  if (!visitorId) return null;
  const attribution: Gw4Attribution = {
    visitorId,
    source: normalizeSource(req.query?.source || req.query?.utm_source || req.get?.("referer") || "direct"),
    medium: clean(req.query?.utm_medium, 80),
    campaign: GW4_PROMO_CAMPAIGN,
    content: clean(req.query?.utm_content, 160),
    startedAt: new Date().toISOString(),
  };
  if (req.session) req.session.gw4PromoAttribution = attribution;
  await write("marketing.gw4_auth_started", null, attribution).catch((error) => console.warn("GW4 auth-start attribution failed:", error));
  return attribution;
}

export async function completeGw4PromoAuth(req: any, user: any) {
  const attribution = req.session?.gw4PromoAttribution as Gw4Attribution | undefined;
  if (!attribution?.visitorId || attribution.campaign !== GW4_PROMO_CAMPAIGN) return;
  const userId = String(user?.id || user?.claims?.sub || "").trim();
  if (!userId) return;
  const action = user?.isNewUser ? "marketing.gw4_signup_completed" : "marketing.gw4_login_completed";
  await write(action, userId, attribution).catch((error) => console.warn("GW4 auth completion attribution failed:", error));
  delete req.session.gw4PromoAttribution;
}
