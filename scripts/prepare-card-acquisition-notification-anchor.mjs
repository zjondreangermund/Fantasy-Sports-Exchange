import fs from "node:fs";

const file = "server/services/dailyLoginReward.ts";
const source = fs.readFileSync(file, "utf8");

const guarded = `    // The reward row and owned card were created in this same transaction before
    // the alert, so a rolled-back/failed reward can never leave a success notification.
    await createNotificationOnce(tx, {
      userId,
      title: "Weekly common card collected",
      message: \`You received \${String(player.name || "a Premier League player")} as this week's free common-card reward.\`,
      dedupeKey: \`weekly-common:\${rewardDay}:card:\${Number(card.id)}\`,
    });`;

const raw = `    await tx.execute(sql\`
      INSERT INTO app.notifications (user_id, type, title, message)
      VALUES (
        \${userId},
        'system',
        'Weekly common card collected',
        \${\`You received \${String(player.name || "a Premier League player")} as this week's free common-card reward.\`}
      )
    \`);`;

if (source.includes("card:weekly-minted:")) {
  console.log("[card-acquisition-anchor] weekly claim notification already finalized");
} else if (source.includes(guarded)) {
  fs.writeFileSync(file, source.replace(guarded, raw));
  console.log("[card-acquisition-anchor] normalized notification-truth weekly claim anchor");
} else if (source.includes(raw)) {
  console.log("[card-acquisition-anchor] raw weekly claim anchor already available");
} else {
  throw new Error("[card-acquisition-anchor] weekly claim notification anchor not found");
}
