import fs from "node:fs";

const NOTIFICATIONS = "server/services/notifications.ts";
const AUTH_STORAGE = "server/replit_integrations/auth/storage.ts";
const ECONOMY = "server/routes/economyIntegrity.routes.ts";
const MARKER = "ADMIN_LIVE_OPS_PUSH_V1";

function patch(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[admin-live-push] patched ${path}`);
  } else {
    console.log(`[admin-live-push] ${path} already ready`);
  }
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[admin-live-push] anchor not found: ${label}`);
  return source.replace(from, to);
}

patch(NOTIFICATIONS, (original) => {
  if (original.includes(MARKER)) return original;
  const anchor = `export type ArenaNotificationType = "win" | "runner_up" | "system";\n`;
  const replacement = `${anchor}\n// ${MARKER}: operational alerts go only to the Fantasy Arena owner/admin account.\n// They use the normal notification pipeline so a registered Android device receives\n// an FCM notification even while the Fantasy Arena app is closed.\nexport const FANTASY_ARENA_ADMIN_NOTIFICATION_EMAIL = String(\n  process.env.FANTASY_ARENA_ADMIN_NOTIFICATION_EMAIL || "lbcplaya@gmail.com",\n).trim().toLowerCase();\n`;
  let source = replaceRequired(original, anchor, replacement, "admin notification identity");

  const createAnchor = `export async function createNotificationOnce(tx: any, input: {\n`;
  if (!source.includes(createAnchor)) throw new Error("[admin-live-push] createNotificationOnce anchor missing");
  const helper = `export async function createFantasyArenaAdminNotificationOnce(tx: any, input: {\n  title: string;\n  message: string;\n  dedupeKey: string;\n  type?: ArenaNotificationType;\n}) {\n  await ensureNotificationsSchema();\n  const result = await tx.execute(sql\`\n    select id as "userId"\n    from app.users\n    where lower(coalesce(email, '')) = \${FANTASY_ARENA_ADMIN_NOTIFICATION_EMAIL}\n    limit 1\n  \`);\n  const admin = Array.isArray(result?.rows) ? result.rows[0] || null : null;\n  const adminUserId = String(admin?.userId || "");\n  if (!adminUserId) return null;\n  return createNotificationOnce(tx, {\n    userId: adminUserId,\n    type: input.type,\n    title: input.title,\n    message: input.message,\n    dedupeKey: input.dedupeKey,\n  });\n}\n\n`;
  source = source.replace(createAnchor, `${helper}${createAnchor}`);
  return source;
});

patch(AUTH_STORAGE, (original) => {
  if (original.includes(MARKER)) return original;
  let source = original;
  source = replaceRequired(
    source,
    'import { eq } from "drizzle-orm";\n',
    'import { eq } from "drizzle-orm";\nimport { createFantasyArenaAdminNotificationOnce } from "../../services/notifications.js";\n\n// ADMIN_LIVE_OPS_PUSH_V1: notify the owner only when a genuinely new account is created.\n',
    "auth notification import",
  );
  source = replaceRequired(
    source,
    `  async upsertUser(userData: UpsertUser): Promise<User> {\n    const [user] = await db\n`,
    `  async upsertUser(userData: UpsertUser): Promise<User> {\n    const incomingUserId = String((userData as any)?.id || "");\n    const existingUser = incomingUserId ? await this.getUser(incomingUserId) : undefined;\n    const [user] = await db\n`,
    "new-account detection",
  );
  source = replaceRequired(
    source,
    `      .returning();\n\n    return user;\n`,
    `      .returning();\n\n    if (!existingUser && user) {\n      const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();\n      const identity = displayName || user.email || "New Arena manager";\n      await createFantasyArenaAdminNotificationOnce(db, {\n        title: "🚀 New Fantasy Arena signup",\n        message: \`${'${identity}'} just created a Fantasy Arena account. Open Admin to follow their onboarding and campaign journey.\`,\n        dedupeKey: \`admin:new-signup:${'${user.id}'}\`,\n      }).catch((error) => {\n        console.error("Admin signup notification failed:", error);\n      });\n    }\n\n    return user;\n`,
    "new-account admin push",
  );
  return source;
});

patch(ECONOMY, (original) => {
  if (original.includes(MARKER)) return original;
  let source = original;
  source = replaceRequired(
    source,
    'import { createNotificationOnce, ensureNotificationsSchema } from "../services/notifications.js";\n',
    'import { createFantasyArenaAdminNotificationOnce, createNotificationOnce, ensureNotificationsSchema } from "../services/notifications.js";\n',
    "economy admin notification import",
  );

  const personalBlock = `  await createNotificationOnce(db, {\n    userId,\n    title: \`✅ \${teamName} is entered!\`,\n    message: \`\${teamName} has been entered into \${tournamentName}. Your 5-player team is locked in and ready for Gameweek \${gameWeek}. ⚽🔥\`,\n    dedupeKey: \`competition:\${competitionId}:entry:\${entryId}:submitted\`,\n  });\n`;
  if (!source.includes(personalBlock)) throw new Error("[admin-live-push] generated tournament entry notification block missing");
  const adminBlock = `${personalBlock}\n  // ${MARKER}: every real tournament submission also alerts the owner/admin.\n  // This is separate from public momentum broadcasts and fires for every entry.\n  await createFantasyArenaAdminNotificationOnce(db, {\n    title: \`🎟️ New tournament entry — \${teamName}\`,\n    message: \`\${teamName} just entered \${tournamentName} for Gameweek \${gameWeek}. Open Admin to view the tournament and entry activity.\`,\n    dedupeKey: \`admin:competition:\${competitionId}:entry:\${entryId}\`,\n  });\n`;
  source = source.replace(personalBlock, adminBlock);
  return source;
});

console.log("Admin-only signup and every-tournament-entry Fantasy Arena push notifications are ready for the owner account.");
