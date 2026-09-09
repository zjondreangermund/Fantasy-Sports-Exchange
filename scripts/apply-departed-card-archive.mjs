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
    `${schemaAnchor}\n      // TRANSFER_SOURCE_CARD_ARCHIVE_V1\n      // A player who leaves the Premier League is preserved in the card/claim\n      // database for admin and audit history, but the old card must not remain\n      // in a manager collection once a replacement claim exists. This also\n      // repairs historical claims created before this rule.\n      await db.execute(sql\`\n        update app.player_cards pc\n        set owner_id=null, for_sale=false, price=0\n        from app.player_replacement_claims pr\n        where pr.source_card_id=pc.id\n          and pc.owner_id=pr.user_id\n      \`);`,
    "historical source-card archive",
  );
}

const claimAnchor = `    if (!claim?.id) continue;\n\n    const prettyRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1);`;
const claimReplacement = `    if (!claim?.id) continue;\n\n    // Remove the departed card from the user's collection immediately while\n    // keeping the card row and replacement-claim linkage intact for admin/audit history.\n    await db.execute(sql\`\n      update app.player_cards\n      set owner_id=null, for_sale=false, price=0\n      where id=\${sourceCardId} and owner_id=\${userId}\n    \`);\n\n    const prettyRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1);`;
source = replaceRequired(source, claimAnchor, claimReplacement, "archive source card after creating departure claim");

// The same-position replacement patch runs later in the production generator
// chain. Leave its original notification anchor untouched until then, and only
// rewrite the final same-position copy once that patch is present.
if (source.includes("EPL_REPLACEMENT_SAME_POSITION_V1")) {
  const oldMessage = '      message: `${input.playerName} is no longer in the Premier League. Your ${prettyRarity} ${sourcePosition} card stays in your collection as a record, but it is no longer eligible for Premier League tournaments. Claim one free random current Premier League ${sourcePosition} card of the same ${prettyRarity} rarity. Fantasy Arena will keep reminding you until the replacement is claimed.`,'.replace(/\\`/g, "`");
  const newMessage = '      message: `${input.playerName} is no longer in the Premier League. Your ${prettyRarity} ${sourcePosition} card has been removed from your playable collection and archived in transfer history. Claim one free random current Premier League ${sourcePosition} card of the same ${prettyRarity} rarity. Fantasy Arena will keep reminding you until the replacement is claimed.`,'.replace(/\\`/g, "`");
  source = replaceRequired(source, oldMessage, newMessage, "final same-position departure notification copy");
}

if (source !== original) {
  fs.writeFileSync(FILE, source);
  console.log("[departed-card-archive] departed source cards are removed from user collections while card and claim records remain in the database.");
} else {
  console.log("[departed-card-archive] source-card archive behavior already applied.");
}
