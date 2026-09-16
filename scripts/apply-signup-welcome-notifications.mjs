import fs from "node:fs";

const NOTIFICATIONS = "server/services/notifications.ts";
const AUTH_STORAGE = "server/replit_integrations/auth/storage.ts";
const DATABASE_STORAGE = "server/storage.ts";
const NOTIFICATION_ROUTES = "server/routes/notifications.routes.ts";
const MARKER = "SIGNUP_WELCOME_NOTIFICATION_V1";

function patch(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[signup-welcome] patched ${path}`);
  } else {
    console.log(`[signup-welcome] ${path} already ready`);
  }
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[signup-welcome] anchor not found: ${label}`);
  return source.replace(from, to);
}

patch(NOTIFICATIONS, (original) => {
  if (original.includes(MARKER)) return original;
  const anchor = "export async function createNotificationOnce(tx: any, input: {\n";
  if (!original.includes(anchor)) throw new Error("[signup-welcome] createNotificationOnce anchor missing");

  const helper = [
    `// ${MARKER}: every genuine new account receives one permanent Inbox welcome.`,
    "// If a web/PWA/native subscription appears after signup, the existing welcome is queued",
    "// to that device without creating a duplicate Inbox notification.",
    "export const FANTASY_ARENA_SIGNUP_WELCOME_TITLE = \"🏟️ Welcome to Fantasy Arena!\";",
    "export const FANTASY_ARENA_SIGNUP_WELCOME_MESSAGE = [",
    "  \"🏟️ Welcome to Fantasy Arena!\",",
    "  \"\",",
    "  \"You’ve joined a digital football card platform where your player cards are more than just collectibles — they’re part of the game.\",",
    "  \"\",",
    "  \"⚽ Build your collection with real Premier League player cards.\",",
    "  \"📈 Earn fantasy points from your players’ real match performances.\",",
    "  \"🏆 Enter tournaments and compete against other managers.\",",
    "  \"💰 Buy and sell cards in the Marketplace.\",",
    "  \"🤝 Loan cards to other players or borrow cards you need for your squad.\",",
    "  \"🎁 Earn and mint new cards through weekly rewards, referrals, tournaments and special events.\",",
    "  \"🔄 Trade and improve your collection as you build stronger tournament lineups.\",",
    "  \"\",",
    "  \"Every card you own has a purpose — collect it, play it, trade it, loan it or use it to compete.\",",
    "  \"\",",
    "  \"Start building your squad and see where your cards can take you.\",",
    "  \"\",",
    "  \"PLAY. COLLECT. COMPETE. WIN.\",",
    "  \"Welcome to Fantasy Arena ⚽🔥\",",
    "].join(\"\\n\");",
    "",
    "function signupWelcomeDedupeKey(userId: string) {",
    "  return `welcome:new-user:${String(userId || \"\").trim()}`;",
    "}",
    "",
    "export async function enqueueSignupWelcomeDeliveries(tx: any, userId: string) {",
    "  await ensureNotificationsSchema();",
    "  const normalizedUserId = String(userId || \"\").trim();",
    "  if (!normalizedUserId) return null;",
    "  const dedupeKey = signupWelcomeDedupeKey(normalizedUserId);",
    "  const result = await tx.execute(sql`",
    "    select id",
    "    from app.notifications",
    "    where user_id = ${normalizedUserId} and dedupe_key = ${dedupeKey}",
    "    limit 1",
    "  `);",
    "  const notification = Array.isArray(result?.rows) ? result.rows[0] || null : null;",
    "  const notificationId = Number(notification?.id || 0);",
    "  if (!notificationId) return null;",
    "",
    "  await tx.execute(sql`",
    "    insert into app.notification_push_deliveries (notification_id, subscription_id, status, next_attempt_at, created_at, updated_at)",
    "    select ${notificationId}, subscription.id, 'pending', now(), now(), now()",
    "    from app.web_push_subscriptions subscription",
    "    where subscription.user_id = ${normalizedUserId} and subscription.disabled_at is null",
    "    on conflict (notification_id, subscription_id) do nothing",
    "  `);",
    "  await tx.execute(sql`",
    "    insert into app.notification_native_push_deliveries (notification_id, subscription_id, status, next_attempt_at, created_at, updated_at)",
    "    select ${notificationId}, subscription.id, 'pending', now(), now(), now()",
    "    from app.native_push_subscriptions subscription",
    "    where subscription.user_id = ${normalizedUserId} and subscription.disabled_at is null",
    "    on conflict (notification_id, subscription_id) do nothing",
    "  `);",
    "  return notificationId;",
    "}",
    "",
    "export async function createSignupWelcomeNotificationOnce(tx: any, userId: string) {",
    "  const normalizedUserId = String(userId || \"\").trim();",
    "  if (!normalizedUserId) return null;",
    "  const notification = await createNotificationOnce(tx, {",
    "    userId: normalizedUserId,",
    "    title: FANTASY_ARENA_SIGNUP_WELCOME_TITLE,",
    "    message: FANTASY_ARENA_SIGNUP_WELCOME_MESSAGE,",
    "    dedupeKey: signupWelcomeDedupeKey(normalizedUserId),",
    "  });",
    "  await enqueueSignupWelcomeDeliveries(tx, normalizedUserId);",
    "  return notification;",
    "}",
    "",
  ].join("\n");

  return original.replace(anchor, `${helper}${anchor}`);
});

patch(AUTH_STORAGE, (original) => {
  if (original.includes(MARKER)) return original;
  let source = original;
  source = replaceRequired(
    source,
    'import { createFantasyArenaAdminNotificationOnce } from "../../services/notifications.js";\n',
    'import { createFantasyArenaAdminNotificationOnce, createSignupWelcomeNotificationOnce } from "../../services/notifications.js";\n',
    "auth welcome notification import",
  );
  const anchor = `      }).catch((error) => {\n        console.error("Admin signup notification failed:", error);\n      });\n    }\n\n    return user;`;
  const replacement = `      }).catch((error) => {\n        console.error("Admin signup notification failed:", error);\n      });\n      await createSignupWelcomeNotificationOnce(db, String(user.id || "")).catch((error) => {\n        console.error("New-user welcome notification failed:", error);\n      });\n    }\n\n    return user;`;
  source = replaceRequired(source, anchor, replacement, "auth new-user welcome notification");
  source = source.replace(
    "// ADMIN_LIVE_OPS_PUSH_V1: notify the owner only when a genuinely new account is created.\n",
    `// ADMIN_LIVE_OPS_PUSH_V1: notify the owner only when a genuinely new account is created.\n// ${MARKER}: the same genuine-new-account guard also creates the user's permanent welcome.\n`,
  );
  return source;
});

patch(DATABASE_STORAGE, (original) => {
  if (original.includes(MARKER)) return original;
  let source = original;
  source = replaceRequired(
    source,
    'import { createFantasyArenaAdminNotificationOnce } from "./services/notifications.js";\n',
    'import { createFantasyArenaAdminNotificationOnce, createSignupWelcomeNotificationOnce } from "./services/notifications.js";\n',
    "database storage welcome notification import",
  );
  const anchor = `      }).catch((error) => {\n        console.error("Admin signup notification failed:", error);\n      });\n    }\n    return created;`;
  const replacement = `      }).catch((error) => {\n        console.error("Admin signup notification failed:", error);\n      });\n      await createSignupWelcomeNotificationOnce(db, String(created.id || "")).catch((error) => {\n        console.error("New-user welcome notification failed:", error);\n      });\n    }\n    return created;`;
  source = replaceRequired(source, anchor, replacement, "database storage new-user welcome notification");
  source = source.replace(
    "// ADMIN_LIVE_OPS_STORAGE_PUSH_V1: every genuine account-creation path alerts the owner exactly once.\n",
    `// ADMIN_LIVE_OPS_STORAGE_PUSH_V1: every genuine account-creation path alerts the owner exactly once.\n// ${MARKER}: DatabaseStorage-created users receive the same exactly-once welcome.\n`,
  );
  return source;
});

patch(NOTIFICATION_ROUTES, (original) => {
  if (original.includes(MARKER)) return original;
  let source = original;
  source = replaceRequired(
    source,
    'import { createNotificationOnce, ensureNotificationsSchema } from "../services/notifications.js";\n',
    'import { createNotificationOnce, enqueueSignupWelcomeDeliveries, ensureNotificationsSchema } from "../services/notifications.js";\n',
    "notification route welcome delivery import",
  );
  source = replaceRequired(
    source,
    `      const subscription = await upsertWebPushSubscription(userId, req.body?.subscription, req.get?.("user-agent"));\n      await createNotificationOnce(db, {`,
    `      const subscription = await upsertWebPushSubscription(userId, req.body?.subscription, req.get?.("user-agent"));\n      // ${MARKER}: a just-created account may have received its Inbox welcome before this device subscribed.\n      // Queue that existing welcome for this newly registered PWA/web device without creating a second Inbox row.\n      await enqueueSignupWelcomeDeliveries(db, userId);\n      await createNotificationOnce(db, {`,
    "web push welcome delivery recovery",
  );
  source = replaceRequired(
    source,
    `      const subscription = await upsertNativePushSubscription(userId, req.body?.token, req.body?.platform);\n      await createNotificationOnce(db, {`,
    `      const subscription = await upsertNativePushSubscription(userId, req.body?.token, req.body?.platform);\n      // ${MARKER}: queue the existing signup welcome for the newly registered Android device.\n      await enqueueSignupWelcomeDeliveries(db, userId);\n      await createNotificationOnce(db, {`,
    "native push welcome delivery recovery",
  );
  return source;
});

console.log("New Fantasy Arena signups receive one permanent Inbox welcome, with delayed PWA/native push delivery when an installed device registers after signup.");
