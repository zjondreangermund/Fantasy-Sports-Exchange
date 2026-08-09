import fs from "node:fs";

const landing = fs.readFileSync("client/src/pages/landing.tsx", "utf8");
const adminRoutes = fs.readFileSync("server/routes/admin.routes.ts", "utf8");
const adminPage = fs.readFileSync("client/src/pages/admin.tsx", "utf8");
const indexHtml = fs.readFileSync("client/index.html", "utf8");
const capacitor = fs.readFileSync("capacitor.config.ts", "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

requireText(landing, "MARKETING_VISITOR_KEY", "anonymous marketing visitor tracking");
requireText(landing, 'sendMarketingEvent("landing_view"', "landing view event");
requireText(landing, 'sendMarketingEvent("start_free_click"', "Start Free click event");
requireText(landing, "Google sign-in did not complete", "visible Google auth error");
requireText(adminRoutes, "SIGNUP_FUNNEL_OBSERVABILITY_V2", "marketing funnel endpoint marker");
requireText(adminRoutes, '/api/admin/signup-funnel', "admin signup funnel endpoint");
requireText(adminRoutes, "left join app.user_onboarding", "database Starter 5 cohort");
requireText(adminRoutes, "appUrlMatchesExpected", "APP_URL diagnostic");
requireText(adminPage, "Signup Funnel · Last 7 days", "admin signup funnel UI");
requireText(adminPage, "Google accounts created", "admin account conversion stage");
requireText(indexHtml, "https://fantasy-sports-exchange-production-d05c.up.railway.app/", "live public metadata URL");
requireText(capacitor, "https://fantasy-sports-exchange-production-d05c.up.railway.app", "live Capacitor URL");

console.log("Signup funnel observability and live URL alignment verified.");
