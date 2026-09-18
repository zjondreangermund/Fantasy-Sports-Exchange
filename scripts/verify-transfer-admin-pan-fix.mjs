import assert from "node:assert/strict";
import fs from "node:fs";
import "./verify-current-epl-community-entry-notifications.mjs";
import "./apply-departed-card-archive.mjs";
import "./apply-production-console-repairs.mjs";

const read = (path) => fs.readFileSync(path, "utf8");
const transfer = read("server/services/playerTransferMonitoring.ts");
const retention = read("server/routes/retention.routes.ts");
const route = read("server/routes/adminPlayerTransfers.routes.ts");
const panel = read("client/src/components/admin/AdminPlayerTransfersPanel.tsx");
const backoffice = read("client/src/components/admin/AdminBackofficePanel.tsx");
const scroll = read("client/src/unified-scroll.css");
const browserPan = read("client/src/browser-zoom-pan.css");
const siteView = read("client/src/lib/site-view.ts");
const security = read("server/services/securityControl.ts");
const serverIndex = read("server/index.ts");
const fplApi = read("server/services/fplApi.ts");
const cardImage = read("client/src/lib/card-image.ts");

const need = (source, token, message) => assert.ok(source.includes(token), message);

need(transfer, "PLAYER_TRANSFER_CANONICAL_TEAM_V2", "canonical team-identity transfer guard is missing");
need(transfer, '["nottingham-forest", "nottingham", "nottm-forest"', "Nottingham naming variants are not canonicalized");
need(transfer, '["manchester-united", "man-united", "man-utd"', "Manchester United naming variants are not canonicalized");
need(transfer, '["tottenham-hotspur", "tottenham", "spurs"', "Tottenham naming variants are not canonicalized");
need(transfer, "const fromTeamIdentity = canonicalTeamIdentity(fromTeam);", "old club name is not converted to canonical identity");
need(transfer, "const toTeamIdentity = canonicalTeamIdentity(toTeam);", "new club name is not converted to canonical identity");
need(transfer, "fromTeamIdentity === toTeamIdentity", "same-club aliases are not identified");
need(transfer, "suppressedTeamAliasChanges += 1", "alias-only changes are not suppressed before notifications");
need(transfer, "suppression_reason='club_alias_only'", "historical alias-noise events are not marked");
need(transfer, "delete from app.notifications", "false transfer notifications are not cleaned up");
need(transfer, "listAdminPlayerTransferReport", "admin transfer report is missing");
need(transfer, 'u.manager_team_name as "managerTeamName"', "affected manager team names are not exposed");
need(transfer, 'pc.rarity::text as rarity', "affected card rarities are not exposed");
need(transfer, 'pr.replacement_card_id as "replacementCardId"', "replacement claim status is not exposed");

need(transfer, "TRANSFER_SOURCE_CARD_ARCHIVE_V2", "departed replacement source cards are not archived with tournament-lock safety");
need(transfer, "set owner_id=null, for_sale=false, price=0", "departed cards are not detached from user ownership");
need(transfer, "pr.source_card_id=pc.id", "archived card row is no longer linked to its replacement claim");
need(transfer, "pc.owner_id=pr.user_id", "historical source-card cleanup is not scoped to the original claimant");
need(transfer, "pr.replacement_card_id is not null", "departed source cards must remain owned until a replacement is actually finalized");
need(transfer, "cl.card_id=pc.id", "departed-card archive is not checking the source card's tournament lock");
need(transfer, "cl.expires_at is null or cl.expires_at > now()", "active tournament locks are not protected during departed-card archive");

need(security, "https://fonts.googleapis.com", "production CSP does not allow the configured Google Fonts stylesheet");
need(security, "https://fonts.gstatic.com", "production CSP does not allow Google Fonts files");
assert.ok(!security.includes("unsafe-eval"), "production CSP must not be weakened with unsafe-eval");
need(serverIndex, "CURRENT_PL_PLAYER_PHOTO_FALLBACKS_V2", "current Premier League portrait proxy fallback V2 is missing");
need(serverIndex, '["110x140", "500x500", "250x250", "40x40"]', "image proxy does not prefer known current Premier League portrait sizes");
need(fplApi, "CURRENT_PL_PLAYER_PHOTO_PRIMARY_V2", "FPL player-photo helper still prefers an unreliable current size");
need(cardImage, "premierleague25/photos/players/110x140", "card image fallback does not use the current Premier League portrait path");

need(route, 'app.get("/api/admin/player-transfers", requireAuth, isAdmin', "admin player-transfer endpoint is not admin protected");
need(retention, 'registerAdminPlayerTransferRoutes(app, { requireAuth, isAdmin: walletAdmin })', "admin transfer route is not registered with the existing admin guard");
need(panel, 'queryKey: ["/api/admin/player-transfers?limit=150"]', "admin UI does not consume the transfer report");
need(panel, "Outside Premier League", "admin UI lacks departure filtering");
need(panel, "Club-name aliases", "admin UI lacks alias-only filtering");
need(panel, "claim pending", "admin UI does not expose pending replacement claims");
need(backoffice, "<AdminPlayerTransfersPanel />", "player-transfer admin panel is not integrated into Backoffice");

need(scroll, "APP_DESKTOP_VIEW_PAN_V2", "Desktop-view pan V2 guard is missing");
need(scroll, 'html[data-site-view="desktop"].app-scroll-locked body', "Desktop view does not release body clipping");
need(scroll, "overflow: visible !important", "Desktop view does not release shell clipping");
need(scroll, "overflow-x: auto !important", "Desktop app scroll root does not permit horizontal movement");
need(scroll, "touch-action: auto !important", "Desktop view still restricts native pinch/pan gestures");

need(browserPan, "DESKTOP_TOUCH_DOCUMENT_SCROLL_V1", "Desktop-on-phone document scroll fallback is missing");
need(browserPan, "@media (hover: none) and (pointer: coarse)", "Desktop-on-phone scroll fallback must stay touch-device scoped");
need(browserPan, 'html[data-site-view="desktop"] [data-app-scroll-root]', "Desktop-on-phone fallback does not target the authenticated page scroll root");
need(browserPan, "overflow-y: visible !important", "Desktop-on-phone fallback must release the nested vertical scroller");
need(browserPan, "min-height: 100dvh !important", "Desktop-on-phone document scroll must keep full viewport coverage");
need(browserPan, "touch-action: pan-x pan-y pinch-zoom !important", "Desktop-on-phone fallback must preserve pan and pinch gestures");

need(siteView, 'document.documentElement.dataset.appRuntime = isNativeMobileApp() ? "native" : "web";', "site-view bootstrap does not distinguish web browser from native APK");
need(browserPan, "BROWSER_REQUESTED_DESKTOP_SCROLL_V2", "browser-requested Desktop site scroll fallback is missing");
need(browserPan, "@media (hover: none) and (pointer: coarse) and (min-width: 768px)", "browser Desktop-site fallback must be scoped to wide touch viewports");
need(browserPan, 'html[data-app-runtime="web"].app-scroll-locked', "browser Desktop-site fallback is not web-runtime scoped");
need(browserPan, 'html[data-app-runtime="web"] [data-app-scroll-root]', "browser Desktop-site fallback does not release the authenticated page root");
need(browserPan, 'data-app-runtime="native"', "browser Desktop-site fallback must document native APK exclusion");
need(browserPan, "height: auto !important", "browser Desktop-site fallback must release fixed heights");
need(browserPan, "max-height: none !important", "browser Desktop-site fallback must release max-height caps");

console.log("Player transfer/runtime repairs verified: canonical club identities suppress provider-name noise, departed source cards wait for tournament locks before archive, notification/replacement reads stay safe, Google Fonts match CSP, current Premier League portrait fallbacks are ordered, and both Fantasy Arena Desktop view and browser-requested Desktop site can scroll the full document without changing the native APK.");
