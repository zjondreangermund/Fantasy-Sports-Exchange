import fs from "node:fs";

const MARKER = "CARD_ACQUISITION_NOTIFICATIONS_V1";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`[card-acquisition-notifications] patched ${file}`);
  } else {
    console.log(`[card-acquisition-notifications] ${file} already ready`);
  }
}

function addImport(source, importLine, afterLine, label) {
  if (source.includes(importLine)) return source;
  if (!source.includes(afterLine)) throw new Error(`Card notification import anchor not found: ${label}`);
  return source.replace(afterLine, `${afterLine}\n${importLine}`);
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Card notification anchor not found: ${label}`);
  return source.replace(from, to);
}

function replaceBetween(source, startNeedle, endNeedle, replacement, label) {
  if (source.includes(replacement)) return source;
  const start = source.indexOf(startNeedle);
  if (start < 0) throw new Error(`Card notification start anchor not found: ${label}`);
  const end = source.indexOf(endNeedle, start);
  if (end < 0) throw new Error(`Card notification end anchor not found: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

patchFile("server/services/dailyLoginReward.ts", (original) => {
  let source = original;
  source = addImport(
    source,
    'import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";',
    'import { db } from "../db.js";',
    "weekly reward notifications",
  );

  if (!source.includes("WEEKLY_COMMON_REWARD_WINDOW_DAYS")) {
    source = replaceOnce(
      source,
      "export const WEEKLY_COMMON_REWARD_INTERVAL_DAYS = 7;",
      "export const WEEKLY_COMMON_REWARD_INTERVAL_DAYS = 7;\nexport const WEEKLY_COMMON_REWARD_WINDOW_DAYS = 7;",
      "weekly reward window constant",
    );
  }

  const eligibilityReplacement = `async function weeklyEligibility(executor: any, userId: string) {
  const row = rowsOf(await executor.execute(sql\`
    WITH account AS (
      SELECT ((u.created_at AT TIME ZONE current_setting('TIMEZONE')) AT TIME ZONE 'Africa/Windhoek')::date AS signup_day
      FROM app.users u
      WHERE u.id = \${userId}
      LIMIT 1
    ), clock AS (
      SELECT
        signup_day,
        (signup_day + 1)::date AS first_eligible_day,
        (now() AT TIME ZONE 'Africa/Windhoek')::date AS today
      FROM account
    ), reward_window AS (
      SELECT
        signup_day,
        first_eligible_day,
        today,
        CASE
          WHEN today < first_eligible_day THEN first_eligible_day
          ELSE (first_eligible_day + (((today - first_eligible_day) / \${WEEKLY_COMMON_REWARD_INTERVAL_DAYS}::integer) * \${WEEKLY_COMMON_REWARD_INTERVAL_DAYS}::integer))::date
        END AS window_start
      FROM clock
    ), state AS (
      SELECT
        rw.*,
        (rw.window_start + \${WEEKLY_COMMON_REWARD_WINDOW_DAYS}::integer)::date AS window_end,
        (
          SELECT max(dlr.reward_day)::date
          FROM app.daily_login_rewards dlr
          WHERE dlr.user_id = \${userId}
        ) AS last_reward_day,
        EXISTS (
          SELECT 1
          FROM app.daily_login_rewards dlr
          WHERE dlr.user_id = \${userId}
            AND dlr.reward_day >= rw.window_start
            AND dlr.reward_day < (rw.window_start + \${WEEKLY_COMMON_REWARD_WINDOW_DAYS}::integer)::date
        ) AS claimed_this_window
      FROM reward_window rw
    )
    SELECT
      to_char(signup_day, 'YYYY-MM-DD') AS "signupDay",
      to_char(first_eligible_day, 'YYYY-MM-DD') AS "firstEligibleFrom",
      to_char(window_start, 'YYYY-MM-DD') AS "eligibleFrom",
      to_char(window_start, 'YYYY-MM-DD') AS "windowStart",
      to_char(window_end, 'YYYY-MM-DD') AS "windowEndExclusive",
      to_char(last_reward_day, 'YYYY-MM-DD') AS "lastRewardDay",
      (today >= window_start AND today < window_end AND NOT claimed_this_window) AS "eligibleForWeeklyReward",
      claimed_this_window AS "claimedThisWeek",
      ((window_start::timestamp) AT TIME ZONE 'Africa/Windhoek') AS "eligibleAt",
      ((window_end::timestamp) AT TIME ZONE 'Africa/Windhoek') AS "expiresAt",
      CASE
        WHEN today < first_eligible_day THEN ((first_eligible_day::timestamp) AT TIME ZONE 'Africa/Windhoek')
        WHEN claimed_this_window THEN ((window_end::timestamp) AT TIME ZONE 'Africa/Windhoek')
        ELSE NULL
      END AS "nextEligibleAt"
    FROM state
  \`))[0];

  if (!row) throw new Error("User account was not found for weekly reward eligibility");
  return {
    signupDay: String(row.signupDay || ""),
    firstEligibleFrom: String(row.firstEligibleFrom || ""),
    eligibleFrom: String(row.eligibleFrom || ""),
    windowStart: String(row.windowStart || ""),
    windowEndExclusive: String(row.windowEndExclusive || ""),
    lastRewardDay: row.lastRewardDay ? String(row.lastRewardDay) : null,
    eligibleForWeeklyReward: Boolean(row.eligibleForWeeklyReward),
    claimedThisWeek: Boolean(row.claimedThisWeek),
    eligibleAt: row.eligibleAt ? new Date(row.eligibleAt).toISOString() : null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    nextEligibleAt: row.nextEligibleAt ? new Date(row.nextEligibleAt).toISOString() : null,
  };
}

`;
  source = replaceBetween(
    source,
    "async function weeklyEligibility(executor: any, userId: string) {",
    "async function loadRewardCard",
    eligibilityReplacement,
    "fixed weekly claim window",
  );

  source = source.replaceAll(
    "nextEligibleAt: capReached || canClaim ? null : eligibility.eligibleAt,",
    "nextEligibleAt: capReached || canClaim ? null : eligibility.nextEligibleAt,",
  );
  source = source.replaceAll(
    "nextEligibleAt: eligibility.eligibleAt,",
    "nextEligibleAt: eligibility.nextEligibleAt,",
  );
  source = source.replaceAll(
    "nextEligibleAt: commonCountAfter >= DAILY_LOGIN_COMMON_CARD_CAP ? null : nextEligibility.eligibleAt,",
    "nextEligibleAt: commonCountAfter >= DAILY_LOGIN_COMMON_CARD_CAP ? null : nextEligibility.nextEligibleAt,",
  );

  if (!source.includes("expiresAt: eligibility.expiresAt,")) {
    source = source.replace(
      "    eligibleFrom: eligibility.eligibleFrom,\n    eligibleForWeeklyReward:",
      "    eligibleFrom: eligibility.eligibleFrom,\n    expiresAt: eligibility.expiresAt,\n    eligibleForWeeklyReward:",
    );
  }

  const rawClaimNotification = `    await tx.execute(sql\`
      INSERT INTO app.notifications (user_id, type, title, message)
      VALUES (
        \${userId},
        'system',
        'Weekly common card collected',
        \${\`You received \${String(player.name || "a Premier League player")} as this week's free common-card reward.\`}
      )
    \`);`;
  const pipelineClaimNotification = `    await createNotificationOnce(tx, {
      userId,
      type: "system",
      title: "Weekly Common card minted",
      message: \`\${String(player.name || "Your Premier League player")} was minted and added to your collection.\`,
      dedupeKey: \`card:weekly-minted:\${rewardDay}:\${Number(card.id)}\`,
    });`;
  source = replaceOnce(
    source,
    rawClaimNotification,
    pipelineClaimNotification,
    "weekly reward claim notification pipeline",
  );

  source = replaceOnce(
    source,
    "export async function claimDailyLoginReward(userId: string) {\n  await ensureDailyLoginRewardSchema();",
    "export async function claimDailyLoginReward(userId: string) {\n  await ensureDailyLoginRewardSchema();\n  await ensureNotificationsSchema();",
    "weekly claim notification schema",
  );

  if (!source.includes("export async function notifyWeeklyCommonRewardWindows")) {
    source += `

// ${MARKER}: notify users while their current weekly card is available, without minting it.
export async function notifyWeeklyCommonRewardWindows() {
  await ensureDailyLoginRewardSchema();
  await ensureNotificationsSchema();

  const candidates = rowsOf(await db.execute(sql\`
    WITH accounts AS (
      SELECT
        u.id AS user_id,
        ((u.created_at AT TIME ZONE current_setting('TIMEZONE')) AT TIME ZONE 'Africa/Windhoek')::date AS signup_day,
        (now() AT TIME ZONE 'Africa/Windhoek')::date AS today,
        (
          SELECT count(*)::int
          FROM app.player_cards pc
          WHERE pc.owner_id = u.id AND pc.rarity::text = 'common'
        ) AS common_count
      FROM app.users u
    ), windows AS (
      SELECT
        user_id,
        today,
        common_count,
        (signup_day + 1)::date AS first_eligible_day,
        CASE
          WHEN today < (signup_day + 1)::date THEN (signup_day + 1)::date
          ELSE ((signup_day + 1)::date + (((today - (signup_day + 1)::date) / \${WEEKLY_COMMON_REWARD_INTERVAL_DAYS}::integer) * \${WEEKLY_COMMON_REWARD_INTERVAL_DAYS}::integer))::date
        END AS window_start
      FROM accounts
    ), active AS (
      SELECT
        *,
        (window_start + \${WEEKLY_COMMON_REWARD_WINDOW_DAYS}::integer)::date AS window_end
      FROM windows
    )
    SELECT
      user_id AS "userId",
      to_char(window_start, 'YYYY-MM-DD') AS "windowStart",
      to_char(window_end, 'YYYY-MM-DD') AS "windowEndExclusive",
      to_char(window_end - 1, 'DD Mon YYYY') AS "lastClaimDay",
      (today = window_end - 1) AS "expiringToday"
    FROM active
    WHERE today >= first_eligible_day
      AND today >= window_start
      AND today < window_end
      AND common_count < \${DAILY_LOGIN_COMMON_CARD_CAP}
      AND NOT EXISTS (
        SELECT 1
        FROM app.daily_login_rewards dlr
        WHERE dlr.user_id = active.user_id
          AND dlr.reward_day >= active.window_start
          AND dlr.reward_day < active.window_end
      )
  \`));

  let readyNotifications = 0;
  let expiryNotifications = 0;
  for (const row of candidates) {
    const userId = String(row.userId || "");
    const windowStart = String(row.windowStart || "");
    if (!userId || !windowStart) continue;

    const ready = await createNotificationOnce(db, {
      userId,
      type: "system",
      title: "Weekly Common card ready to mint",
      message: \`Your weekly Common card is ready. Open Fantasy Arena and mint it by \${String(row.lastClaimDay || "the end of this weekly window")} (Namibia time). Unclaimed weekly cards expire and do not carry over.\`,
      dedupeKey: \`card:weekly-ready:\${windowStart}\`,
    });
    if (ready) readyNotifications += 1;

    if (Boolean(row.expiringToday)) {
      const expiring = await createNotificationOnce(db, {
        userId,
        type: "system",
        title: "Weekly card expires today",
        message: "Open Fantasy Arena and mint your weekly Common card before midnight Namibia time. If you miss this window, the card falls away.",
        dedupeKey: \`card:weekly-expiring:\${windowStart}\`,
      });
      if (expiring) expiryNotifications += 1;
    }
  }

  return { candidates: candidates.length, readyNotifications, expiryNotifications };
}
`;
  }

  return source;
});

patchFile("server/routes/dailyLoginReward.routes.ts", (original) => {
  let source = original;
  source = replaceOnce(
    source,
    'import { claimDailyLoginReward, getDailyLoginRewardStatus } from "../services/dailyLoginReward.js";',
    'import { claimDailyLoginReward, getDailyLoginRewardStatus, notifyWeeklyCommonRewardWindows } from "../services/dailyLoginReward.js";',
    "weekly notification scheduler import",
  );

  if (!source.includes("weeklyRewardNotificationTimer")) {
    source = replaceOnce(
      source,
      "export function registerDailyLoginRewardRoutes(app: Express) {\n  // Keep the existing API path",
      `export function registerDailyLoginRewardRoutes(app: Express) {
  const runWeeklyRewardNotifications = () => {
    notifyWeeklyCommonRewardWindows()
      .then((result) => {
        if (result.readyNotifications || result.expiryNotifications) {
          console.log("Weekly reward notifications:", result);
        }
      })
      .catch((error) => console.error("Weekly reward notification scan failed:", error));
  };
  void runWeeklyRewardNotifications();
  const weeklyRewardNotificationTimer = setInterval(runWeeklyRewardNotifications, 60 * 60 * 1000);
  weeklyRewardNotificationTimer.unref?.();

  // Keep the existing API path`,
      "weekly notification scheduler",
    );
  }
  return source;
});

patchFile("server/routes/marketplace.routes.ts", (original) => {
  let source = original;
  source = addImport(
    source,
    'import { createNotificationOnce, ensureNotificationsSchema } from "../services/notifications.js";',
    'import { loadDetailedScoringContext, resolveDetailedStatsForPlayer } from "../services/apiFootballScoringBridge.js";',
    "marketplace notifications",
  );
  source = replaceOnce(
    source,
    "  const idempotencyKey = marketplacePurchaseKey(buyerId, resolvedCardId, rawIdempotencyKey);\n  try {",
    "  const idempotencyKey = marketplacePurchaseKey(buyerId, resolvedCardId, rawIdempotencyKey);\n  await ensureNotificationsSchema();\n  try {",
    "marketplace notification schema",
  );

  const auditNeedle = '      await tx.insert(auditLogs).values({ userId: buyerId, action: "marketplace.purchase.completed"';
  if (!source.includes("marketplace:buyer:")) {
    const start = source.indexOf(auditNeedle);
    if (start < 0) throw new Error("Card notification anchor not found: marketplace completed audit");
    const lineEnd = source.indexOf("\n", start);
    if (lineEnd < 0) throw new Error("Card notification line end not found: marketplace completed audit");
    const insert = `
      const cardLabel = String(card.serialId || serialId || \`#\${resolvedCardId}\`);
      await createNotificationOnce(tx, {
        userId: buyerId,
        type: "system",
        title: "Card purchased",
        message: \`Your \${String(card.rarity || "card")} card \${cardLabel} was bought and is now in your collection.\`,
        dedupeKey: \`marketplace:buyer:\${idempotencyKey}\`,
      });
      await createNotificationOnce(tx, {
        userId: sellerId,
        type: "system",
        title: "Card sold",
        message: \`Your card \${cardLabel} was sold for N$\${Number(ledger.price || 0).toFixed(2)}.\`,
        dedupeKey: \`marketplace:seller:\${idempotencyKey}\`,
      });`;
    source = source.slice(0, lineEnd) + insert + source.slice(lineEnd);
  }
  return source;
});

patchFile("server/routes/loanMarket.routes.ts", (original) => {
  let source = original;
  source = addImport(
    source,
    'import { createNotificationOnce, ensureNotificationsSchema } from "../services/notifications.js";',
    'import { ensureLoanPaymentSchema } from "../services/loanPaymentSchema.js";',
    "loan notifications",
  );
  source = replaceOnce(
    source,
    "async function ensureLoanMarketTables() {\n  await ensureLoanPaymentSchema();\n}",
    "async function ensureLoanMarketTables() {\n  await ensureLoanPaymentSchema();\n  await ensureNotificationsSchema();\n}",
    "loan notification schema",
  );

  if (!source.includes("loan:${Number(loan.id)}:owner-returned")) {
    source = replaceOnce(
      source,
      "      returned.push({ loanId: Number(loan.id), cardId });",
      `      await createNotificationOnce(tx, {
        userId: ownerId,
        type: "system",
        title: "Loan card returned",
        message: \`Card #\${cardId} has returned to your collection after the loan ended.\`,
        dedupeKey: \`loan:\${Number(loan.id)}:owner-returned\`,
      });
      await createNotificationOnce(tx, {
        userId: borrowerId,
        type: "system",
        title: "Card loan ended",
        message: \`Your loan of card #\${cardId} has ended and the card was returned to its owner.\`,
        dedupeKey: \`loan:\${Number(loan.id)}:borrower-ended\`,
      });
      returned.push({ loanId: Number(loan.id), cardId });`,
      "expired loan return notifications",
    );
  }

  if (!source.includes("loan:${loanId}:borrower-active")) {
    source = replaceOnce(
      source,
      "        replayed = payment.replayed;\n\n        await tx.execute(sql`",
      `        replayed = payment.replayed;

        await createNotificationOnce(tx, {
          userId: borrowerId,
          type: "system",
          title: "Loan card received",
          message: \`Card #\${cardId} is now available in your collection for \${Number(loan.gameweeks || 1)} gameweek(s).\`,
          dedupeKey: \`loan:\${loanId}:borrower-active\`,
        });
        await createNotificationOnce(tx, {
          userId: ownerId,
          type: "system",
          title: "Your card was loaned",
          message: \`Card #\${cardId} was loaned successfully. Your loan proceeds are N$\${ownerReceives.toFixed(2)}.\`,
          dedupeKey: \`loan:\${loanId}:owner-active\`,
        });

        await tx.execute(sql\``,
      "loan activation notifications",
    );
  }
  return source;
});

patchFile("server/routes/referrals.routes.ts", (original) => {
  let source = original;
  source = addImport(
    source,
    'import { createNotificationOnce, ensureNotificationsSchema } from "../services/notifications.js";',
    'import { db } from "../db.js";',
    "referral card notifications",
  );
  source = replaceOnce(
    source,
    "async function ensureReferralSchema() {\n  await db.execute(sql`",
    "async function ensureReferralSchema() {\n  await ensureNotificationsSchema();\n  await db.execute(sql`",
    "referral notification schema",
  );
  if (!source.includes("referral-card:${referredUserId}:")) {
    source = replaceOnce(
      source,
      "        const reward = await grantPositionBalancedCommonCard(storage, referrerUserId, tx);\n\n        await tx.execute(sql`",
      `        const reward = await grantPositionBalancedCommonCard(storage, referrerUserId, tx);

        if (reward?.id) {
          await createNotificationOnce(tx, {
            userId: referrerUserId,
            type: "system",
            title: "Referral card received",
            message: "Your referral reward Common card was minted and added to your collection.",
            dedupeKey: \`referral-card:\${referredUserId}:\${Number(reward.id)}\`,
          });
        }

        await tx.execute(sql\``,
      "referral reward card notification",
    );
  }
  return source;
});

patchFile("server/services/forgeOperation.ts", (original) => {
  let source = original;
  source = addImport(
    source,
    'import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";',
    'import { db } from "../db.js";',
    "forge card notifications",
  );
  source = replaceOnce(
    source,
    "export async function executeCommonToRareForge(tx: any, input: { userId: string; cardIds: number[] }): Promise<any> {\n  await ensureForgeOperationSchema();",
    "export async function executeCommonToRareForge(tx: any, input: { userId: string; cardIds: number[] }): Promise<any> {\n  await ensureForgeOperationSchema();\n  await ensureNotificationsSchema();",
    "forge notification schema",
  );
  if (!source.includes("forge-card:${Number(minted.id)}")) {
    source = replaceOnce(
      source,
      "  if (!minted?.id) throw new Error(\"Rare forge card was not minted\");\n\n  await tx.execute(sql`",
      `  if (!minted?.id) throw new Error("Rare forge card was not minted");

  await createNotificationOnce(tx, {
    userId,
    type: "system",
    title: "Rare card minted",
    message: "Your forged Rare card was minted and added to your collection.",
    dedupeKey: \`forge-card:\${Number(minted.id)}\`,
  });

  await tx.execute(sql\``,
      "forge mint notification",
    );
  }
  return source;
});

console.log("Card acquisition notifications + expiring weekly mint windows are ready.");
