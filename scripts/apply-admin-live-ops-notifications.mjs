import fs from "node:fs";

const NOTIFICATIONS = "server/services/notifications.ts";
const AUTH_STORAGE = "server/replit_integrations/auth/storage.ts";
const DATABASE_STORAGE = "server/storage.ts";
const ECONOMY = "server/routes/economyIntegrity.routes.ts";
const NOTIFICATION_ROUTES = "server/routes/notifications.routes.ts";
const MARKER = "ADMIN_LIVE_OPS_PUSH_V1";
const STORAGE_MARKER = "ADMIN_LIVE_OPS_STORAGE_PUSH_V1";
const TIMING_MARKER = "PRODUCTION_NOTIFICATION_TIMING_V1";

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

// Some authentication/onboarding paths create users through DatabaseStorage rather
// than Replit Auth's upsertUser. Cover that path too. The shared dedupe key makes
// this safe even if both creation paths run for the same account.
patch(DATABASE_STORAGE, (original) => {
  if (original.includes(STORAGE_MARKER)) return original;
  let source = original;
  source = replaceRequired(
    source,
    'import { db } from "./db.js";\n',
    `import { db } from "./db.js";\nimport { createFantasyArenaAdminNotificationOnce } from "./services/notifications.js";\n\n// ${STORAGE_MARKER}: every genuine account-creation path alerts the owner exactly once.\n`,
    "database storage admin notification import",
  );
  source = replaceRequired(
    source,
    `    } as any).returning();\n    return created;\n  }\n\n  async updateUser`,
    `    } as any).returning();\n    if (created) {\n      const identity = created.name || created.email || "New Arena manager";\n      await createFantasyArenaAdminNotificationOnce(db, {\n        title: "🚀 New Fantasy Arena signup",\n        message: \`${'${identity}'} just created a Fantasy Arena account. Open Admin to follow their onboarding and campaign journey.\`,\n        dedupeKey: \`admin:new-signup:${'${created.id}'}\`,\n      }).catch((error) => {\n        console.error("Admin signup notification failed:", error);\n      });\n    }\n    return created;\n  }\n\n  async updateUser`,
    "database storage new-account admin push",
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

patch(NOTIFICATION_ROUTES, (original) => {
  if (original.includes(TIMING_MARKER)) return original;
  let source = original;
  const oldBlock = `    if (typeof minutes === "number" && minutes > 0 && minutes <= 24 * 60) {\n      await createNotificationOnce(db, {\n        userId,\n        title: \`Gameweek \${nextGameweek} starts soon\`,\n        message: \`Gameweek \${nextGameweek} starts within 24 hours. Check submitted teams, captains and unused eligible cards in My Teams & Prizes.\`,\n        dedupeKey: \`gameweek:\${nextGameweek}:starts-within-24h\`,\n      });\n    }`;
  const newBlock = `    // ${TIMING_MARKER}: the first 24-hour reminder is explicitly a lineup-lock warning.\n    // The scheduler runs every 15 minutes and createNotificationOnce keeps it exactly-once per gameweek.\n    if (openRows.length && typeof minutes === "number" && minutes > 0 && minutes <= 24 * 60) {\n      await createNotificationOnce(db, {\n        userId,\n        title: \`Gameweek \${nextGameweek} lineup locks within 24 hours\`,\n        message: \`Gameweek \${nextGameweek} locks within 24 hours. Review your submitted teams and captains, or complete any remaining tournament entries before the deadline.\`,\n        dedupeKey: \`gameweek:\${nextGameweek}:locks-within-24h\`,\n      });\n    }`;
  source = replaceRequired(source, oldBlock, newBlock, "24-hour lineup-lock notification");
  return source;
});

console.log("Production signup, tournament-entry and 24h/2h lineup-lock notifications are ready; existing live, result, refund, mention and player-change notifications stay unchanged.");
