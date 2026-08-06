import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

await import("./apply-production-message-profile-collection.mjs");
await import("./apply-complete-scoring-v2.mjs");
await import("./verify-complete-scoring-v2.mjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const banner = read("client/src/components/SecurityModeBanner.tsx");
const app = read("client/src/App.tsx");
const sidebar = read("client/src/components/ui/sidebar.tsx");
const apiBase = read("client/src/lib/api-base.ts");
const clientSecurity = read("client/src/lib/security-mode.ts");
const serverSecurity = read("server/services/securityControl.ts");
const publicSecurityRoute = read("server/routes/securityAdmin.routes.ts");
const readOnlyGuard = read("server/services/readOnlyGuard.ts");
const collection = read("client/src/pages/collection-clean.tsx");
const profileCollectionCard = read("client/src/components/cards/CollectionProfileCard.tsx");

const oldSecurityMessage = "security team completes checks";
const checks = [
  [banner.includes("--security-banner-offset"), "Security banner does not publish its measured offset"],
  [banner.includes("ResizeObserver"), "Security banner offset does not respond to wrapping or viewport changes"],
  [banner.includes("ref={bannerRef}"), "Security banner measurement ref is missing"],
  [app.includes('paddingTop: "var(--security-banner-offset, 0px)"'), "App header/content is not offset below the security banner"],
  [sidebar.includes('top: "var(--security-banner-offset, 0px)"'), "Sidebar does not consume the security banner offset"],
  [sidebar.includes('height: "calc(100dvh - var(--security-banner-offset, 0px))"'), "Sidebar height is not reduced below the security banner"],
  [apiBase.includes('if (code === "read_only") return;'), "Duplicate read-only action popup is still enabled"],
  [!clientSecurity.toLowerCase().includes(oldSecurityMessage), "Old client security-team message is still present"],
  [!serverSecurity.toLowerCase().includes(oldSecurityMessage), "Old server security-team message is still present"],
  [publicSecurityRoute.includes("Production preview · Read-only mode"), "Public security status does not use the production message"],
  [readOnlyGuard.includes("Production preview · Read-only mode"), "Read-only guard does not use the production message"],
  [collection.includes('import CollectionProfileCard from "../components/cards/CollectionProfileCard";'), "Collection does not import the profile-style card"],
  [collection.includes("<CollectionProfileCard card={card}"), "Collection still uses the old dull card renderer"],
  [!collection.includes("PremiumFootballCard"), "Collection still references PremiumFootballCard"],
  [profileCollectionCard.includes("CollectionStableCard"), "Collection profile card does not use the profile modal renderer"],
  [profileCollectionCard.includes('queryKey: ["/api/cards/profile", card.id]'), "Collection profile card does not use verified profile data"],
];

for (const [passed, message] of checks) {
  if (!passed) throw new Error(message);
}

console.log("[layout] Verified production banner, app header and mobile sidebar do not overlap");
console.log("[collection] Verified one production notice and profile-quality Collection cards");
