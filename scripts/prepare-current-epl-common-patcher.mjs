import fs from "node:fs";

const file = "scripts/apply-common-reward-position-balance.mjs";
let source = fs.readFileSync(file, "utf8");
const leagueLine = "      WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')\\n";
const strict = "        AND coalesce(p.fpl_id, 0) > 0\\n        AND lower(coalesce(p.status, 'a')) NOT IN ('departed', 'superseded', 'unlinked', 'archived')\\n";

if (!source.includes("CURRENT_EPL_WEEKLY_ANCHOR_V1")) {
  const count = source.split(leagueLine).length - 1;
  if (count < 2) throw new Error("[current-epl-weekly] expected both legacy weekly reward selection anchors");
  source = source.replaceAll(leagueLine, `${leagueLine}${strict}`);
  source = source.replace(
    "  const oldPlayerBlock = `",
    "  // CURRENT_EPL_WEEKLY_ANCHOR_V1: legacy selector anchor is strict too.\\n  const oldPlayerBlock = `",
  );
  fs.writeFileSync(file, source);
  console.log("[current-epl-weekly] prepared strict legacy selector anchors");
} else {
  console.log("[current-epl-weekly] strict legacy selector anchors already prepared");
}
