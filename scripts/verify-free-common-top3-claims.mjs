import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const server = read("server/routes/economyIntegrity.routes.ts");
const awards = read("scripts/apply-free-card-cup-auto-awards.mjs");
const entries = read("client/src/pages/my-entries.tsx");
const nativeClub = read("client/src/components/native/NativeClubPage.tsx");
const notificationClient = read("client/src/lib/notifications.ts");
const nativePush = read("server/services/nativePush.ts");
const webPush = read("server/services/webPush.ts");

const need = (source, token, message) => assert.ok(source.includes(token), message);

need(server, 'app.post("/api/competitions/prizes/:entryId/claim"', "Authenticated card-prize claim endpoint is missing.");
need(server, "pg_advisory_xact_lock(99241", "Prize claims must serialize per entry.");
need(server, "const rarity = rank === 1 ? \"rare\" : \"common\"", "FREE Common Cup rank rewards must be Rare/Common/Common.");
need(server, "rank >= 1 && rank <= 3", "Only the top three FREE Common Cup entries may claim.");
need(server, "ce.prize_card_id as \"prizeCardId\"", "Claims must reuse an existing awarded card.");
need(server, "where id=${entryId} and user_id=${userId} and prize_card_id is null", "One-card-only database guard is missing.");
need(server, "${prizeTitle}::text", "Prize metadata title must have an explicit PostgreSQL type.");
need(server, "${rarity}::text", "Prize metadata rarity must have an explicit PostgreSQL type.");
need(server, "${Number(card.id)}::integer", "Prize metadata card ID must have an explicit PostgreSQL type.");
need(server, "Exactly one card was added to your Collection.", "Claim confirmation must state the one-card result.");

need(awards, "FREE_CARD_CUP_AUTO_AWARD_V3_TOP3_CLAIMS", "Top-three settlement patch marker is missing.");
need(awards, "for (let index = 1; index < Math.min(3, ranked.length); index += 1)", "Second and third prize creation is missing.");
need(awards, 'title: "Random Common Player Card"', "Second and third must receive Common-card claim rights.");
need(awards, "free-card-claim-ready", "Congratulations claim-ready notification is missing.");

need(entries, "Claim prize card", "My Teams & Prizes must expose a real claim button.");
need(entries, '/api/competitions/prizes/${entryId}/claim', "Claim button must call the authenticated claim endpoint.");
assert.ok(!entries.includes("mailto:support@fantasyarena.com?subject="), "Card prizes must not use an email-only claim.");

need(nativeClub, "selectedPrizeEntryId", "Inbox must recognize claim-ready prize messages.");
need(nativeClub, "Claim prize card", "Inbox prize message must include a direct claim button.");
need(nativeClub, "requestedNotificationId", "Inbox must auto-open an exact notification deep link.");
need(notificationClient, "free-card-claim-ready", "Claim-ready Inbox alerts must deep-link to their exact message.");
need(notificationClient, '/account?tab=inbox&notification=', "In-app prize alerts must open the exact Inbox message containing the claim button.");
need(nativePush, '/account?tab=inbox&notification=', "Native prize pushes must open the exact Inbox claim message.");
need(webPush, '/account?tab=inbox&notification=', "Web prize pushes must open the exact Inbox claim message.");

console.log("FREE Common Cup top-three prizes verified: 1st Rare, 2nd/3rd Common, atomic one-card claims and Inbox congratulations.");
