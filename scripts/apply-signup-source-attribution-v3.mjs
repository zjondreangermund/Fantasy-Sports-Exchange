import fs from "node:fs";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Signup attribution patch anchor not found: ${label}`);
  return source.replace(from, to);
}

function insertBefore(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`Signup attribution patch anchor not found: ${label}`);
  return source.replace(anchor, `${insertion}${anchor}`);
}

function insertAfter(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`Signup attribution patch anchor not found: ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function replaceBetween(source, startAnchor, endAnchor, replacement, marker, label) {
  if (source.includes(marker)) return source;
  const start = source.indexOf(startAnchor);
  const end = source.indexOf(endAnchor, start + startAnchor.length);
  if (start < 0 || end < 0) throw new Error(`Signup attribution patch anchors not found: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

patchFile("client/src/pages/landing.tsx", (original) => {
  let source = original;
  const sourceHelper = `function resolveMarketingSource(params: URLSearchParams) {\n  const explicit = String(params.get("utm_source") || params.get("source") || "").trim().toLowerCase();\n  const referrer = typeof document !== "undefined" ? String(document.referrer || "").toLowerCase() : "";\n  const candidate = explicit || referrer;\n  if (/tiktok|bytedance/.test(candidate)) return "tiktok";\n  if (/instagram/.test(candidate)) return "instagram";\n  if (/facebook|fb\\.com|m\\.facebook|l\\.facebook/.test(candidate)) return "facebook";\n  if (/whatsapp/.test(candidate)) return "whatsapp";\n  if (/personal/.test(candidate)) return "personal";\n  if (!candidate || candidate === "direct") return "direct";\n  if (explicit) return explicit.replace(/[^a-z0-9_-]/g, "-").slice(0, 40) || "other";\n  return "other";\n}\n\n`;
  source = insertBefore(source, "function sendMarketingEvent(event: string, visitorId: string) {", sourceHelper, "function resolveMarketingSource", "landing source resolver");
  source = replaceOnce(
    source,
    '    source: params.get("utm_source") || params.get("source") || document.referrer || "direct",',
    '    source: resolveMarketingSource(params),',
    "normalized landing source",
  );
  source = replaceOnce(
    source,
    '  const authError = pageParams.get("auth_error") || "";\n  const visitorId = getMarketingVisitorId();',
    '  const authError = pageParams.get("auth_error") || "";\n  const marketingSource = resolveMarketingSource(pageParams);\n  const visitorId = getMarketingVisitorId();',
    "landing source variable",
  );
  source = replaceOnce(
    source,
    '  if (visitorId) loginQuery.set("vid", visitorId);\n  const loginHref =',
    '  if (visitorId) loginQuery.set("vid", visitorId);\n  if (marketingSource) loginQuery.set("source", marketingSource);\n  for (const key of ["utm_campaign", "utm_medium", "utm_content"] as const) {\n    const value = pageParams.get(key);\n    if (value) loginQuery.set(key, value);\n  }\n  const loginHref =',
    "carry attribution into Google login",
  );
  return source;
});

patchFile("server/index.ts", (original) => {
  let source = original;
  source = replaceOnce(
    source,
    '      let user = await storage.getUser(userId);\n      if (!user) { await storage.createUser({ id: userId, email, name, avatarUrl: profile.photos?.[0]?.value }); user = await storage.getUser(userId); }',
    '      let user = await storage.getUser(userId);\n      let isNewUser = false;\n      if (!user) { await storage.createUser({ id: userId, email, name, avatarUrl: profile.photos?.[0]?.value }); user = await storage.getUser(userId); isNewUser = true; }',
    "Google new-user flag",
  );
  source = replaceOnce(
    source,
    '      return done(null, { id: userId, name, email, photo: profile.photos?.[0]?.value });',
    '      return done(null, { id: userId, name, email, photo: profile.photos?.[0]?.value, isNewUser });',
    "Google new-user identity flag",
  );
  return source;
});

patchFile("server/routes/auth.routes.ts", (original) => {
  let source = original;
  source = insertAfter(
    source,
    'import type passport from "passport";\n',
    'import { sql } from "drizzle-orm";\nimport { db } from "../db.js";\n',
    'from "../db.js"',
    "auth attribution imports",
  );

  const helpers = `\ntype MarketingAttribution = {\n  visitorId: string;\n  source: string;\n  campaign: string;\n  medium: string;\n  content: string;\n  startedAt: string;\n};\n\nfunction cleanAttributionValue(value: unknown, max = 160) {\n  return String(value || "").trim().replace(/[\\u0000-\\u001F\\u007F]/g, "").slice(0, max);\n}\n\nfunction normalizeAttributionSource(value: unknown) {\n  const raw = cleanAttributionValue(value, 300).toLowerCase();\n  if (/tiktok|bytedance/.test(raw)) return "tiktok";\n  if (/instagram/.test(raw)) return "instagram";\n  if (/facebook|fb\\.com|m\\.facebook|l\\.facebook/.test(raw)) return "facebook";\n  if (/whatsapp/.test(raw)) return "whatsapp";\n  if (/personal/.test(raw)) return "personal";\n  if (!raw || raw === "direct") return "direct";\n  return raw.replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 40) || "other";\n}\n\nasync function latestVisitorAttribution(visitorId: string) {\n  if (!visitorId) return null;\n  const result: any = await db.execute(sql\`\n    select meta\n    from app.audit_logs\n    where action = 'marketing.funnel' and meta->>'visitorId' = \${visitorId}\n    order by created_at desc\n    limit 1\n  \`);\n  const row = Array.isArray(result?.rows) ? result.rows[0] : undefined;\n  return row?.meta && typeof row.meta === "object" ? row.meta : null;\n}\n\nasync function writeMarketingAttribution(action: string, userId: string | null, attribution: MarketingAttribution) {\n  await db.execute(sql\`\n    insert into app.audit_logs (user_id, action, meta)\n    values (\${userId}, \${action}, \${JSON.stringify(attribution)}::jsonb)\n  \`);\n}\n\nasync function captureMarketingAttribution(req: any): Promise<MarketingAttribution | null> {\n  const visitorId = cleanAttributionValue(req.query?.vid, 96).replace(/[^a-zA-Z0-9._:-]/g, "");\n  if (!visitorId) return null;\n  const previous = await latestVisitorAttribution(visitorId).catch(() => null);\n  const attribution: MarketingAttribution = {\n    visitorId,\n    source: normalizeAttributionSource(req.query?.source || previous?.source || req.get?.("referer") || "direct"),\n    campaign: cleanAttributionValue(req.query?.utm_campaign || previous?.campaign || "", 160),\n    medium: cleanAttributionValue(req.query?.utm_medium || previous?.medium || "", 80),\n    content: cleanAttributionValue(req.query?.utm_content || previous?.content || "", 160),\n    startedAt: new Date().toISOString(),\n  };\n  if (req.session) (req.session as any).marketingAttribution = attribution;\n  await writeMarketingAttribution("marketing.auth_started", null, attribution).catch((error) => console.warn("Marketing auth-start attribution failed:", error));\n  return attribution;\n}\n\n// SIGNUP_SOURCE_ATTRIBUTION_V3\n`;
  source = insertBefore(source, "export async function registerAuthModeRoutes", helpers, "SIGNUP_SOURCE_ATTRIBUTION_V3", "auth attribution helpers");

  const oldGoogleRoutes = `  app.get("/api/login", passport.authenticate("google", { scope: ["profile", "email"] }));\n  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));\n\n  app.get(\n    "/api/auth/google/callback",\n    passport.authenticate("google", { failureRedirect: "/?auth_error=google" }),\n    (_req, res) => res.redirect("/"),\n  );`;
  const newGoogleRoutes = `  const beginGoogleAuth = async (req: any, _res: any, next: any) => {\n    try { await captureMarketingAttribution(req); } catch (error) { console.warn("Marketing attribution capture failed:", error); }\n    next();\n  };\n\n  app.get("/api/login", beginGoogleAuth, passport.authenticate("google", { scope: ["profile", "email"] }));\n  app.get("/api/auth/google", beginGoogleAuth, passport.authenticate("google", { scope: ["profile", "email"] }));\n\n  app.get(\n    "/api/auth/google/callback",\n    passport.authenticate("google", { failureRedirect: "/?auth_error=google" }),\n    async (req: any, res) => {\n      const attribution = (req.session as any)?.marketingAttribution as MarketingAttribution | undefined;\n      if (attribution?.visitorId) {\n        const userId = String(req.user?.id || req.user?.claims?.sub || "");\n        const action = req.user?.isNewUser ? "marketing.signup_completed" : "marketing.login_completed";\n        if (userId) await writeMarketingAttribution(action, userId, attribution).catch((error) => console.warn("Marketing Google attribution write failed:", error));\n        delete (req.session as any).marketingAttribution;\n      }\n      return res.redirect("/");\n    },\n  );`;
  source = replaceOnce(source, oldGoogleRoutes, newGoogleRoutes, "Google attribution routes");
  return source;
});

patchFile("server/routes/admin.routes.ts", (original) => {
  const startAnchor = '  app.get("/api/admin/signup-funnel", requireAuth, isAdmin, async (req: any, res) => {';
  const endAnchor = '  app.get("/api/admin/stats", requireAuth, isAdmin, async (_req: any, res) => {';
  const route = `  // SIGNUP_SOURCE_ATTRIBUTION_ADMIN_V3\n  app.get("/api/admin/signup-funnel", requireAuth, isAdmin, async (req: any, res) => {\n    try {\n      const hours = Math.min(24 * 30, Math.max(1, Number(req.query.hours || 168) || 168));\n      const intervalText = \`\${hours} hours\`;\n      const eventRows = rowsOf(await db.execute(sql\`\n        select meta->>'event' as event, count(distinct coalesce(nullif(meta->>'visitorId', ''), id::text))::int as count\n        from app.audit_logs\n        where action = 'marketing.funnel' and created_at >= now() - \${intervalText}::interval\n        group by meta->>'event'\n      \`));\n      const eventCounts = Object.fromEntries(eventRows.map((row: any) => [String(row.event || ""), Number(row.count || 0)]));\n\n      const authStartedRow = rowsOf(await db.execute(sql\`\n        select count(distinct coalesce(nullif(meta->>'visitorId', ''), id::text))::int as count\n        from app.audit_logs\n        where action = 'marketing.auth_started' and created_at >= now() - \${intervalText}::interval\n      \`))[0] || {};\n      const authStarted = Number(authStartedRow.count || 0);\n\n      const cohort = rowsOf(await db.execute(sql\`\n        with attributed as (\n          select distinct on (user_id) user_id, created_at, meta\n          from app.audit_logs\n          where action = 'marketing.signup_completed'\n            and user_id is not null\n            and created_at >= now() - \${intervalText}::interval\n          order by user_id, created_at asc\n        )\n        select\n          count(*)::int as "accountsCreated",\n          count(*) filter (where nullif(btrim(u.manager_team_name), '') is not null)::int as "teamNamesCreated",\n          count(*) filter (where coalesce(o.completed, false) = true)::int as "starter5Completed"\n        from attributed a\n        join app.users u on u.id = a.user_id\n        left join app.user_onboarding o on o.user_id = u.id\n      \`))[0] || {};\n\n      const unattributedRow = rowsOf(await db.execute(sql\`\n        select count(*)::int as count\n        from app.users u\n        where u.created_at >= now() - \${intervalText}::interval\n          and not exists (\n            select 1 from app.audit_logs a\n            where a.action = 'marketing.signup_completed' and a.user_id = u.id\n          )\n      \`))[0] || {};\n      const unattributedAccounts = Number(unattributedRow.count || 0);\n\n      const sourceRows = rowsOf(await db.execute(sql\`\n        with attributed as (\n          select distinct on (user_id) user_id, created_at, meta\n          from app.audit_logs\n          where action = 'marketing.signup_completed'\n            and user_id is not null\n            and created_at >= now() - \${intervalText}::interval\n          order by user_id, created_at asc\n        )\n        select\n          coalesce(nullif(lower(a.meta->>'source'), ''), 'direct') as source,\n          count(*)::int as signups,\n          count(*) filter (where nullif(btrim(u.manager_team_name), '') is not null)::int as "teamNames",\n          count(*) filter (where coalesce(o.completed, false) = true)::int as "starter5"\n        from attributed a\n        join app.users u on u.id = a.user_id\n        left join app.user_onboarding o on o.user_id = u.id\n        group by coalesce(nullif(lower(a.meta->>'source'), ''), 'direct')\n        order by signups desc, source asc\n      \`));\n      const sourceBreakdown = sourceRows.map((row: any) => ({\n        source: String(row.source || "direct"),\n        signups: Number(row.signups || 0),\n        teamNames: Number(row.teamNames || 0),\n        starter5: Number(row.starter5 || 0),\n      }));\n\n      const landingViews = Number(eventCounts.landing_view || 0);\n      const startFreeClicks = Number(eventCounts.start_free_click || 0);\n      const accountsCreated = Number(cohort.accountsCreated || 0);\n      const teamNamesCreated = Number(cohort.teamNamesCreated || 0);\n      const starter5Completed = Number(cohort.starter5Completed || 0);\n      const rate = (value: number, base: number) => base > 0 ? Math.round((value / base) * 1000) / 10 : null;\n      const stages = [\n        { key: "landing", label: "Landing visitors", value: landingViews, rateFromPrevious: null },\n        { key: "start", label: "Start Free taps", value: startFreeClicks, rateFromPrevious: rate(startFreeClicks, landingViews) },\n        { key: "auth", label: "Google login started", value: authStarted, rateFromPrevious: rate(authStarted, startFreeClicks) },\n        { key: "account", label: "Tracked new accounts", value: accountsCreated, rateFromPrevious: rate(accountsCreated, authStarted) },\n        { key: "team", label: "Team names created", value: teamNamesCreated, rateFromPrevious: rate(teamNamesCreated, accountsCreated) },\n        { key: "starter", label: "Starter 5 completed", value: starter5Completed, rateFromPrevious: rate(starter5Completed, teamNamesCreated) },\n      ];\n      const configuredAppUrl = String(process.env.APP_URL || "").replace(/\\/$/, "");\n      return res.json({\n        hours, generatedAt: new Date().toISOString(), stages, events: eventCounts, authStarted, sourceBreakdown, unattributedAccounts,\n        cohort: { accountsCreated, teamNamesCreated, starter5Completed },\n        authErrors: { google: Number(eventCounts.auth_error_google || 0), configuration: Number(eventCounts.auth_error_configuration || 0) },\n        auth: {\n          appUrl: configuredAppUrl,\n          expectedAppUrl: "https://fantasy-sports-exchange-production-d05c.up.railway.app",\n          appUrlMatchesExpected: configuredAppUrl === "https://fantasy-sports-exchange-production-d05c.up.railway.app",\n          googleConfigured: Boolean(String(process.env.GOOGLE_CLIENT_ID || "").trim() && String(process.env.GOOGLE_CLIENT_SECRET || "").trim()),\n          expectedCallbackUrl: configuredAppUrl ? \`\${configuredAppUrl}/api/auth/google/callback\` : "",\n        },\n      });\n    } catch (error: any) {\n      console.error("Failed to fetch signup funnel:", error);\n      return res.status(500).json({ message: error?.message || "Failed to fetch signup funnel" });\n    }\n  });\n\n`;
  return replaceBetween(original, startAnchor, endAnchor, route, "SIGNUP_SOURCE_ATTRIBUTION_ADMIN_V3", "admin attributed funnel route");
});

patchFile("client/src/pages/admin.tsx", (original) => {
  let source = original;
  const oldType = `type SignupFunnel = {\n  hours: number;\n  generatedAt: string;\n  stages: Array<{ key: string; label: string; value: number; rateFromPrevious: number | null }>;\n  authErrors: { google: number; configuration: number };\n  auth: { appUrl: string; expectedAppUrl: string; appUrlMatchesExpected: boolean; googleConfigured: boolean; expectedCallbackUrl: string };\n};`;
  const newType = `type SignupFunnel = {\n  hours: number;\n  generatedAt: string;\n  stages: Array<{ key: string; label: string; value: number; rateFromPrevious: number | null }>;\n  authStarted: number;\n  unattributedAccounts: number;\n  sourceBreakdown: Array<{ source: string; signups: number; teamNames: number; starter5: number }>;\n  authErrors: { google: number; configuration: number };\n  auth: { appUrl: string; expectedAppUrl: string; appUrlMatchesExpected: boolean; googleConfigured: boolean; expectedCallbackUrl: string };\n};`;
  source = replaceOnce(source, oldType, newType, "admin attributed funnel type");
  source = replaceOnce(source, '          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">', '          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">', "six-stage funnel grid");
  source = replaceOnce(
    source,
    '              <p className="mt-1 text-xs leading-5 text-white/45">Internal Fantasy Arena data. New-account, team-name and Starter 5 counts come directly from the production database.</p>',
    '              <p className="mt-1 text-xs leading-5 text-white/45">Only marketing-attributed new accounts count in the conversion chain. Older or untracked accounts are shown separately so promotions are not credited for signups they did not generate.</p>',
    "attribution explanation",
  );
  const diagnosticsEnd = `          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">\n            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-white/55">\n              <b className="text-white">Google login errors:</b> {Number(signupFunnel?.authErrors?.google || 0)} failed · {Number(signupFunnel?.authErrors?.configuration || 0)} configuration\n            </div>\n            <div className={"rounded-xl border p-3 " + (signupFunnel?.auth?.appUrlMatchesExpected ? "border-emerald-300/15 bg-emerald-400/5 text-emerald-100/75" : "border-amber-300/20 bg-amber-400/8 text-amber-100")}>\n              <b>APP_URL:</b> {signupFunnel?.auth?.appUrl || "Not configured"}<br />\n              <span className="break-all"><b>Expected callback:</b> {signupFunnel?.auth?.expectedCallbackUrl || "Unavailable until APP_URL is configured"}</span>\n            </div>\n          </div>`;
  const attributionUi = `${diagnosticsEnd}\n          <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.06] p-3 text-xs text-amber-100/80">\n            <b className="text-amber-50">Pre-tracking / unattributed accounts:</b> {Number(signupFunnel?.unattributedAccounts || 0)}. These are deliberately excluded from promotion conversions.\n          </div>\n          <div className="mt-4">\n            <div className="text-[10px] font-black uppercase tracking-[.14em] text-white/40">Completed tracked signups by source</div>\n            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">\n              {(signupFunnel?.sourceBreakdown || []).length ? (signupFunnel?.sourceBreakdown || []).map((row) => (\n                <div key={row.source} className="rounded-2xl border border-white/10 bg-black/25 p-3">\n                  <div className="flex items-center justify-between gap-2"><span className="font-black capitalize">{row.source}</span><span className="text-xl font-black text-cyan-100">{row.signups}</span></div>\n                  <div className="mt-1 text-[10px] text-white/45">{row.teamNames} team names · {row.starter5} Starter 5 completed</div>\n                </div>\n              )) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-white/35 sm:col-span-2 lg:col-span-4">No marketing-attributed signup has completed yet. New completed signups will appear here as TikTok, Facebook, Instagram, direct, personal or another tracked source.</div>}\n            </div>\n          </div>`;
  source = replaceOnce(source, diagnosticsEnd, attributionUi, "admin source attribution UI");
  return source;
});

console.log("Applied account-level signup source attribution and campaign-safe funnel reporting.");
