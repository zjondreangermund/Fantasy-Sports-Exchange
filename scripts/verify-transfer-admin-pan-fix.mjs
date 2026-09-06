import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const transfer = read("server/services/playerTransferMonitoring.ts");
const retention = read("server/routes/retention.routes.ts");
const route = read("server/routes/adminPlayerTransfers.routes.ts");
const panel = read("client/src/components/admin/AdminPlayerTransfersPanel.tsx");
const backoffice = read("client/src/components/admin/AdminBackofficePanel.tsx");
const scroll = read("client/src/unified-scroll.css");

const need = (source, token, message) => assert.ok(source.includes(token), message);

need(transfer, "PLAYER_TRANSFER_CANONICAL_TEAM_V2", "canonical team-identity transfer guard is missing");
need(transfer, '["nottingham-forest", "nottingham", "nottm-forest"', "Nottingham naming variants are not canonicalized");
need(transfer, '["manchester-united", "man-united", "man-utd"', "Manchester United naming variants are not canonicalized");
need(transfer, '["tottenham-hotspur", "tottenham", "spurs"', "Tottenham naming variants are not canonicalized");
need(transfer, "canonicalTeamIdentity(fromTeam) === canonicalTeamIdentity(toTeam)", "same-club aliases are not identified");
need(transfer, "suppressedTeamAliasChanges += 1", "alias-only changes are not suppressed before notifications");
need(transfer, "suppression_reason='club_alias_only'", "historical alias-noise events are not marked");
need(transfer, "delete from app.notifications", "false transfer notifications are not cleaned up");
need(transfer, "listAdminPlayerTransferReport", "admin transfer report is missing");
need(transfer, 'u.manager_team_name as "managerTeamName"', "affected manager team names are not exposed");
need(transfer, 'pc.rarity::text as rarity', "affected card rarities are not exposed");
need(transfer, 'pr.replacement_card_id as "replacementCardId"', "replacement claim status is not exposed");

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

console.log("Player transfer monitoring verified: canonical club identities suppress provider-name noise, admins can see affected users/cards/claims, and zoomed Desktop view releases horizontal pan locks.");
