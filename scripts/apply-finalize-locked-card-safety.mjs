#!/usr/bin/env node
import fs from "node:fs";

const file = "scripts/finalize-full-set-test-card-cleanup.mjs";
const marker = "FINAL_FULL_SET_LOCK_SAFETY_V2";
let source = fs.readFileSync(file, "utf8");

if (source.includes(marker)) {
  console.log("Final full-set locked-card safety already applied.");
  process.exit(0);
}

const userLoopAnchor = `      const keep = await collectProtectedCards(client, userId);\n      const remove = owned.filter((card) => !keep.has(Number(card.id)));`;
if (!source.includes(userLoopAnchor)) throw new Error("Locked-card safety anchor not found in final cleanup");

const replacement = `      const keep = await collectProtectedCards(client, userId);\n\n      // FINAL_FULL_SET_LOCK_SAFETY_V2\n      // The database transfer trigger blocks ownership changes whenever ANY unexpired\n      // app.card_locks row exists for the card. Do not assume the lock has the current\n      // owner_id or reason='competition': older rows may be malformed or use another\n      // reason, but the trigger still blocks the transfer by card_id alone.\n      // Release only stale competition locks that are provably safe, then defer every\n      // remaining active lock on cards currently owned by this account.\n      if (await tableExists(client, "app.card_locks")) {\n        await client.query(\n          "delete from app.card_locks cl " +\n          "where cl.reason::text='competition' " +\n          "and exists (select 1 from app.player_cards owned_pc where owned_pc.id=cl.card_id and owned_pc.owner_id=$1) " +\n          "and ((cl.expires_at is not null and cl.expires_at <= now()) " +\n          "or (coalesce(cl.ref_id,'') ~ '^[0-9]+$' and exists (" +\n          "select 1 from app.competitions c where c.id=cl.ref_id::int " +\n          "and lower(c.status::text) in ('completed','cancelled'))) " +\n          "or (coalesce(cl.ref_id,'') ~ '^[0-9]+$' and not exists (" +\n          "select 1 from app.competitions c where c.id=cl.ref_id::int)))",\n          [userId],\n        );\n\n        const activeLocks = rows(await client.query(\n          "select distinct cl.card_id as id, coalesce(cl.ref_id,'') as \\\"refId\\\", " +\n          "coalesce(cl.reason::text,'unknown') as reason " +\n          "from app.card_locks cl " +\n          "join app.player_cards locked_pc on locked_pc.id=cl.card_id " +\n          "where locked_pc.owner_id=$1 " +\n          "and (cl.expires_at is null or cl.expires_at > now())",\n          [userId],\n        ));\n        for (const lock of activeLocks) {\n          keepCard(\n            keep,\n            lock.id,\n            "active-card-lock:" + String(lock.reason || "unknown") + ":" + String(lock.refId || "unknown"),\n          );\n        }\n      }\n\n      const remove = owned.filter((card) => !keep.has(Number(card.id)));`;
// Use a replacement callback because String.replace interprets `$'` inside the
// generated SQL regex as a special replacement token. A callback preserves the
// SQL text literally and keeps the generated cleanup script valid JavaScript.
source = source.replace(userLoopAnchor, () => replacement);

const summaryAnchor = `        kept: keep.size,\n        archivedTestCards: archived,`;
if (!source.includes(summaryAnchor)) throw new Error("Locked-card safety summary anchor not found");
source = source.replace(summaryAnchor, `        kept: keep.size,\n        deferredLockedTestCards: [...keep.values()].filter((reasons) => reasons.some((reason) => String(reason).startsWith("active-card-lock:"))).length,\n        archivedTestCards: archived,`);

const noteAnchor = `      note: "Removed test cards remain as unowned legacy archive rows only so historic references are not broken. They are isolated from current Premier League mint supply and never appear in Collection or Marketplace.",`;
if (!source.includes(noteAnchor)) throw new Error("Locked-card safety note anchor not found");
source = source.replace(noteAnchor, `      note: "Removed test cards remain as unowned legacy archive rows only so historic references are not broken. Any test card with a remaining active card lock is temporarily deferred, regardless of lock owner/reason, so the database transfer guard is never bypassed. A later startup removes it automatically once the lock is safely gone or stale competition lock is released.",`);

fs.writeFileSync(file, source);
console.log("Applied all-active-lock safety to final full-set test-card cleanup.");
