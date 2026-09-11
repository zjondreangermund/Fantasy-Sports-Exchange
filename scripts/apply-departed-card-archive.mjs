import fs from "node:fs";

const FILE = "server/services/playerTransferMonitoring.ts";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[departed-card-archive] anchor not found: ${label}`);
  return source.replace(from, to);
}

const original = fs.readFileSync(FILE, "utf8");
let source = original;

if (!source.includes("TRANSFER_SOURCE_CARD_ARCHIVE_V2")) {
  const schemaAnchor = '      await db.execute(sql`create index if not exists player_replacement_claims_user_idx on app.player_replacement_claims (user_id, claimed_at, created_at desc)`);';
  source = replaceRequired(
    source,
    schemaAnchor,
    `${schemaAnchor}\n      // TRANSFER_SOURCE_CARD_ARCHIVE_V2\n      // A player who leaves the Premier League is preserved in the card/claim\n      // database for admin and audit history. Archive the old card only after any\n      // active tournament lock clears; changing ownership while a card is locked\n      // is deliberately blocked by app.prevent_locked_card_transfer().\n      await db.execute(sql\`\n        update app.player_cards pc\n        set owner_id=null, for_sale=false, price=0\n        from app.player_replacement_claims pr\n        where pr.source_card_id=pc.id\n          and pc.owner_id=pr.user_id\n          and not exists (\n            select 1\n            from app.card_locks cl\n            where cl.card_id=pc.id\n              and (cl.expires_at is null or cl.expires_at > now())\n          )\n      \`);`,
    "historical source-card archive",
  );
}

const claimAnchor = `    if (!claim?.id) continue;\n\n    const prettyRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1);`;
const claimReplacement = `    if (!claim?.id) continue;\n\n    // Detach the departed card as soon as it is safe. A card that is still locked\n    // into an active competition stays owned until that lock clears, so settlement\n    // integrity is never broken and notification/replacement reads cannot fail.\n    await db.execute(sql\`\n      update app.player_cards pc\n      set owner_id=null, for_sale=false, price=0\n      where pc.id=\${sourceCardId}\n        and pc.owner_id=\${userId}\n        and not exists (\n          select 1\n          from app.card_locks cl\n          where cl.card_id=pc.id\n            and (cl.expires_at is null or cl.expires_at > now())\n        )\n    \`);\n\n    const prettyRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1);`;
source = replaceRequired(source, claimAnchor, claimReplacement, "archive source card after creating departure claim");

// The same-position replacement patch runs later in the production generator
// chain. Leave its original notification anchor untouched until then, and only
// rewrite the final same-position copy once that patch is present.
if (source.includes("EPL_REPLACEMENT_SAME_POSITION_V1")) {
  const oldMessage = '      message: `${input.playerName} is no longer in the Premier League. Your ${prettyRarity} ${sourcePosition} card stays in your collection as a record, but it is no longer eligible for Premier League tournaments. Claim one free random current Premier League ${sourcePosition} card of the same ${prettyRarity} rarity. Fantasy Arena will keep reminding you until the replacement is claimed.`,'.replace(/\\`/g, "`");
  const newMessage = '      message: `${input.playerName} is no longer in the Premier League. Your ${prettyRarity} ${sourcePosition} card is no longer eligible for new Premier League entries and is archived from your playable collection as soon as any active tournament lock clears. Claim one free random current Premier League ${sourcePosition} card of the same ${prettyRarity} rarity. Fantasy Arena will keep reminding you until the replacement is claimed.`,'.replace(/\\`/g, "`");
  source = replaceRequired(source, oldMessage, newMessage, "final same-position departure notification copy");
}

if (source !== original) {
  fs.writeFileSync(FILE, source);
  console.log("[departed-card-archive] departed source cards are archived only after active tournament locks clear; card and claim history remains preserved.");
} else {
  console.log("[departed-card-archive] lock-safe source-card archive behavior already applied.");
}

// A missing FPL roster row is not sufficient evidence that a player left the EPL.
// Apply the independent current-squad verification and false-departure repair only
// after the lock-safe archive transformation above has established its final anchors.
await import("./apply-confirmed-epl-departures.mjs");
await import("./normalize-confirmed-epl-departure-idempotency.mjs");
