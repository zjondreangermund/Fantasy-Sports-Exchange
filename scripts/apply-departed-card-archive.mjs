import fs from "node:fs";

const FILE = "server/services/playerTransferMonitoring.ts";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[departed-card-archive] anchor not found: ${label}`);
  return source.replace(from, to);
}

const original = fs.readFileSync(FILE, "utf8");
let source = original;

if (!source.includes("TRANSFER_SOURCE_CARD_ARCHIVE_V1")) {
  const schemaAnchor = '      await db.execute(sql`create index if not exists player_replacement_claims_user_idx on app.player_replacement_claims (user_id, claimed_at, created_at desc)`);';
  source = replaceRequired(
    source,
    schemaAnchor,
    `${schemaAnchor}\n      // TRANSFER_SOURCE_CARD_ARCHIVE_V1\n      // A player who leaves the Premier League is preserved in transfer/admin history,\n      // but the old card must not remain in a manager collection once a replacement\n      // claim exists. This also repairs historical claims created before this rule.\n      await db.execute(sql\`\n        update app.player_cards pc\n        set owner_id=null, for_sale=false, price=0\n        from app.player_replacement_claims pr\n        where pr.source_card_id=pc.id\n          and pc.owner_id=pr.user_id\n      \`);`,
    "historical source-card archive",
  );
}

const claimAnchor = `    if (!claim?.id) continue;\n\n    const prettyRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1);`;
const claimReplacement = `    if (!claim?.id) continue;\n\n    // Remove the departed card from the user's collection immediately while\n    // keeping the card row and claim linkage intact for admin/audit history.\n    await db.execute(sql\`\n      update app.player_cards\n      set owner_id=null, for_sale=false, price=0\n      where id=\${sourceCardId} and owner_id=\${userId}\n    \`);\n\n    const prettyRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1);`;
source = replaceRequired(source, claimAnchor, claimReplacement, "archive source card after creating departure claim");

const oldMessage = '      message: `${input.playerName} is no longer in the Premier League. Your ${prettyRarity} card stays in your collection as a record, but it is no longer eligible for Premier League tournaments. Mint one free ${prettyRarity} replacement from the current Premier League player pool for future entries.`,'.replace(/\\`/g, "`");
const newMessage = '      message: `${input.playerName} is no longer in the Premier League. Your ${prettyRarity} card has been removed from your playable collection and archived in transfer history. Mint one free ${prettyRarity} replacement from the current Premier League player pool for future entries.`,'.replace(/\\`/g, "`");
source = replaceRequired(source, oldMessage, newMessage, "departure notification copy");

// The admin transfer report is injected by apply-transfer-admin-pan-fix.mjs before
// this patch runs. Preserve historical affected-user/card counts after owner_id is
// cleared from archived departed cards.
if (source.includes("listAdminPlayerTransferReport")) {
  const oldCounts = `           (select count(distinct pc.owner_id)::int from app.player_cards pc where pc.player_id=e.player_id and pc.owner_id is not null) as \"affectedUsers\",\n           (select count(*)::int from app.player_cards pc where pc.player_id=e.player_id and pc.owner_id is not null) as \"affectedCards\",`;
  const newCounts = `           case when e.left_premier_league then\n             (select count(distinct pr.user_id)::int from app.player_replacement_claims pr where pr.transfer_event_id=e.id)\n           else\n             (select count(distinct pc.owner_id)::int from app.player_cards pc where pc.player_id=e.player_id and pc.owner_id is not null)\n           end as \"affectedUsers\",\n           case when e.left_premier_league then\n             (select count(*)::int from app.player_replacement_claims pr where pr.transfer_event_id=e.id)\n           else\n             (select count(*)::int from app.player_cards pc where pc.player_id=e.player_id and pc.owner_id is not null)\n           end as \"affectedCards\",`;
  source = replaceRequired(source, oldCounts, newCounts, "admin historical affected counts");

  if (!source.includes("const archivedClaimRows = rowsOf")) {
    const ownerRowsTail = `    order by recent.id desc, pc.owner_id, pc.id\n  \`));\n\n  const ownersByEvent = new Map<number, Map<string, any>>();`;
    const ownerRowsReplacement = `    order by recent.id desc, pc.owner_id, pc.id\n  \`));\n\n  const archivedClaimRows = rowsOf(await db.execute(sql\`\n    select pr.transfer_event_id as \"eventId\", pr.user_id as \"userId\", u.email, u.name,\n           u.manager_team_name as \"managerTeamName\", pc.id as \"cardId\", pc.rarity::text as rarity,\n           pr.id as \"claimId\", pr.replacement_card_id as \"replacementCardId\", pr.claimed_at as \"claimedAt\"\n    from app.player_replacement_claims pr\n    join app.player_cards pc on pc.id=pr.source_card_id\n    left join app.users u on u.id=pr.user_id\n    where pr.transfer_event_id in (\n      select id from app.player_transfer_events\n      order by detected_at desc, id desc\n      limit \${safeLimit}\n    )\n      and pc.owner_id is null\n    order by pr.transfer_event_id desc, pr.user_id, pc.id\n  \`));\n  ownerRows.push(...archivedClaimRows);\n\n  const ownersByEvent = new Map<number, Map<string, any>>();`;
    source = replaceRequired(source, ownerRowsTail, ownerRowsReplacement, "admin archived claim owner history");
  }
}

if (source !== original) {
  fs.writeFileSync(FILE, source);
  console.log("[departed-card-archive] archived departed source cards from user collections while preserving admin history.");
} else {
  console.log("[departed-card-archive] source-card archive behavior already applied.");
}
