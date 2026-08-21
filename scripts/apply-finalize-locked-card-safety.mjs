#!/usr/bin/env node
import fs from "node:fs";

const file = "scripts/finalize-full-set-test-card-cleanup.mjs";
const marker = "FINAL_FULL_SET_LOCK_SAFETY_V1";
let source = fs.readFileSync(file, "utf8");

if (source.includes(marker)) {
  console.log("Final full-set locked-card safety already applied.");
  process.exit(0);
}

const userLoopAnchor = `      const keep = await collectProtectedCards(client, userId);\n      const remove = owned.filter((card) => !keep.has(Number(card.id)));`;
if (!source.includes(userLoopAnchor)) throw new Error("Locked-card safety anchor not found in final cleanup");

const replacement = `      const keep = await collectProtectedCards(client, userId);\n\n      // FINAL_FULL_SET_LOCK_SAFETY_V1\n      // Never transfer ownership of a card while the competition lock guard is active.\n      // Old test cards can still be referenced by a live/closed tournament entry; moving\n      // them would invalidate that submitted team and the database correctly blocks it.\n      // Expired locks and locks belonging to cancelled/completed competitions are safe to\n      // release first, then only genuinely active competition locks are deferred.\n      if (await tableExists(client, \"app.card_locks\")) {\n        await client.query(\`\n          delete from app.card_locks cl\n          where cl.user_id=$1\n            and cl.reason::text='competition'\n            and (\n              (cl.expires_at is not null and cl.expires_at <= now())\n              or (\n                coalesce(cl.ref_id,'') ~ '^[0-9]+$'\n                and exists (\n                  select 1 from app.competitions c\n                  where c.id=cl.ref_id::int\n                    and lower(c.status::text) in ('completed','cancelled')\n                )\n              )\n              or (\n                coalesce(cl.ref_id,'') ~ '^[0-9]+$'\n                and not exists (select 1 from app.competitions c where c.id=cl.ref_id::int)\n              )\n            )\n        \`, [userId]);\n\n        const activeLocks = rows(await client.query(\`\n          select distinct cl.card_id as id, coalesce(cl.ref_id,'') as \"refId\"\n          from app.card_locks cl\n          where cl.user_id=$1\n            and cl.reason::text='competition'\n            and (cl.expires_at is null or cl.expires_at > now())\n        \`, [userId]));\n        for (const lock of activeLocks) {\n          keepCard(keep, lock.id, \`active-competition-lock:\${String(lock.refId || 'unknown')}\`);\n        }\n      }\n\n      const remove = owned.filter((card) => !keep.has(Number(card.id)));`;
source = source.replace(userLoopAnchor, replacement);

const summaryAnchor = `        kept: keep.size,\n        archivedTestCards: archived,`;
if (!source.includes(summaryAnchor)) throw new Error("Locked-card safety summary anchor not found");
source = source.replace(summaryAnchor, `        kept: keep.size,\n        deferredLockedTestCards: [...keep.values()].filter((reasons) => reasons.some((reason) => String(reason).startsWith("active-competition-lock:"))).length,\n        archivedTestCards: archived,`);

const noteAnchor = `      note: "Removed test cards remain as unowned legacy archive rows only so historic references are not broken. They are isolated from current Premier League mint supply and never appear in Collection or Marketplace.",`;
if (!source.includes(noteAnchor)) throw new Error("Locked-card safety note anchor not found");
source = source.replace(noteAnchor, `      note: "Removed test cards remain as unowned legacy archive rows only so historic references are not broken. Active competition-locked test cards are temporarily deferred until their tournament settles/cancels, so submitted tournament entries are never altered. A later startup removes them automatically once the lock is safely released.",`);

fs.writeFileSync(file, source);
console.log("Applied competition-lock safety to final full-set test-card cleanup.");
