import fs from "node:fs";

const file = "server/routes/economyIntegrity.routes.ts";
let source = fs.readFileSync(file, "utf8");
const marker = "TOURNAMENT_MILESTONE_BROADCAST_V1";

if (!source.includes(marker)) {
  const ladderRecipients = `    recipients = rowsOf(await db.execute(sql\`\n      select distinct ce.user_id as "userId"\n      from app.competition_entries ce\n      join app.competitions c on c.id = ce.competition_id\n      where c.game_week = \${gameWeek}\n        and c.tier::text = \${String(context.tier || "common")}\n        and coalesce(c.visibility, 'public') = 'public'\n        and coalesce(c.prize_key, '') = 'ladder'\n        and c.created_by_user_id is null\n    \`));`;
  const tournamentRecipients = `    recipients = rowsOf(await db.execute(sql\`\n      select distinct user_id as "userId" from app.competition_entries where competition_id = \${competitionId}\n    \`));`;
  const allManagers = `    // ${marker}: milestone energy is acquisition/engagement messaging, so every\n    // active Fantasy Arena manager can see that a tournament is filling up.\n    recipients = rowsOf(await db.execute(sql\`\n      select id as "userId"\n      from app.users\n      where coalesce(is_banned, false) = false\n    \`));`;

  if (!source.includes(ladderRecipients)) throw new Error("[milestone-broadcast] Prize Ladder recipient anchor missing");
  source = source.replace(ladderRecipients, allManagers);
  if (!source.includes(tournamentRecipients)) throw new Error("[milestone-broadcast] tournament recipient anchor missing");
  source = source.replace(tournamentRecipients, allManagers);
  fs.writeFileSync(file, source);
  console.log("[milestone-broadcast] every 25-entry milestone now reaches all active managers");
} else {
  console.log("[milestone-broadcast] active-manager milestone broadcast already applied");
}
