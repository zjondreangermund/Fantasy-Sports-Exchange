import fs from "node:fs";

const STRICT_STATUS = "NOT IN ('departed', 'superseded', 'unlinked', 'archived')";

function patchFile(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[current-epl-rewards] patched ${path}`);
  } else console.log(`[current-epl-rewards] ${path} already ready`);
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[current-epl-rewards] anchor not found: ${label}`);
  return source.replace(from, to);
}

// The weekly Common patcher generates the real runtime selector later in the build.
// Tighten that generated helper, not merely the legacy selector anchor.
patchFile("scripts/apply-common-reward-position-balance.mjs", (original) => {
  let source = original;
  const fnStart = source.indexOf("async function findWeeklyCommonPlayerForPosition");
  if (fnStart < 0) throw new Error("[current-epl-rewards] generated weekly player helper missing");
  const fnEnd = source.indexOf("async function", fnStart + 20);
  const end = fnEnd > fnStart ? fnEnd : source.indexOf("`;", fnStart);
  const segmentEnd = end > fnStart ? end : source.length;
  const segment = source.slice(fnStart, segmentEnd);
  if (!segment.includes("coalesce(p.fpl_id, 0) > 0")) {
    const old = "    WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')\\n      AND p.position::text = \\${position}\\n";
    const next = "    WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')\\n      AND coalesce(p.fpl_id, 0) > 0\\n      AND lower(coalesce(p.status, 'a')) NOT IN ('departed', 'superseded', 'unlinked', 'archived')\\n      AND p.position::text = \\${position}\\n";
    if (!segment.includes(old)) throw new Error("[current-epl-rewards] generated weekly SQL anchor missing");
    source = source.slice(0, fnStart) + segment.replace(old, next) + source.slice(segmentEnd);
  }
  return source;
});

// On the first build, dailyLoginReward still contains the legacy selector. The
// prepare script updates the old patcher's expected anchor, so both must receive
// the same strict FPL/status predicates before the later position-balance patch.
patchFile("server/services/dailyLoginReward.ts", (original) => {
  let source = original;
  if (source.includes("COMMON_REWARD_POSITION_BALANCE_V1")) {
    const fnStart = source.indexOf("async function findWeeklyCommonPlayerForPosition");
    if (fnStart < 0) throw new Error("[current-epl-rewards] runtime weekly helper missing");
    const fnEnd = source.indexOf("async function", fnStart + 20);
    const end = fnEnd > fnStart ? fnEnd : source.length;
    const segment = source.slice(fnStart, end);
    if (!segment.includes("coalesce(p.fpl_id, 0) > 0")) {
      const old = "    WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')\n      AND p.position::text = ${position}\n";
      const next = "    WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')\n      AND coalesce(p.fpl_id, 0) > 0\n      AND lower(coalesce(p.status, 'a')) NOT IN ('departed', 'superseded', 'unlinked', 'archived')\n      AND p.position::text = ${position}\n";
      if (!segment.includes(old)) throw new Error("[current-epl-rewards] runtime generated weekly SQL anchor missing");
      source = source.slice(0, fnStart) + segment.replace(old, next) + source.slice(end);
    }
    return source;
  }

  const leagueLine = "      WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')\n";
  const strictLines = "        AND coalesce(p.fpl_id, 0) > 0\n        AND lower(coalesce(p.status, 'a')) NOT IN ('departed', 'superseded', 'unlinked', 'archived')\n";
  if (!source.includes(STRICT_STATUS)) {
    const count = source.split(leagueLine).length - 1;
    if (count < 2) throw new Error("[current-epl-rewards] expected both legacy weekly selection paths");
    source = source.replaceAll(leagueLine, `${leagueLine}${strictLines}`);
  }
  return source;
});

// Referral rewards are tightened after the existing admin referral patch runs.
// Keeping that downstream order avoids invalidating its exact source anchor while
// still making the final runtime referral selector reject archived players.

// Repairing a missing tournament prize must not accidentally mint from stale local rows.
patchFile("server/services/tournamentRewards.ts", (original) => {
  let source = original;
  const old = "  const allPlayers = shuffle(await storage.getPlayers());";
  const next = `  const allPlayers = shuffle((await storage.getPlayers()).filter((player: any) => {\n    const league = String(player?.league || "").toLowerCase().replace(/[^a-z0-9]+/g, "");\n    const fplId = Number(player?.fplId ?? player?.fpl_id ?? 0);\n    const status = String(player?.status || "a").toLowerCase();\n    return ["premierleague", "englishpremierleague", "epl"].includes(league)\n      && fplId > 0\n      && !["departed", "superseded", "unlinked", "archived"].includes(status);\n  })); // CURRENT_EPL_REWARD_REPAIR_V2`;
  source = replaceRequired(source, old, next, "tournament reward repair pool");
  return source;
});

// Free Card Cups primarily draw from the live FPL bootstrap. Their local fallback is
// now fail-closed to official FPL identities which transfer monitoring still marks active.
patchFile("scripts/apply-free-card-cup-auto-awards.mjs", (original) => {
  let source = original;
  const leagueLine = "                where regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') in ('premierleague','englishpremierleague','epl')\n";
  const strictLines = "                  and coalesce(p.fpl_id, 0) > 0\n                  and lower(coalesce(p.status, 'a')) not in ('departed','superseded','unlinked','archived')\n";
  if (!source.includes("not in ('departed','superseded','unlinked','archived')")) {
    if (!source.includes(leagueLine)) throw new Error("[current-epl-rewards] Free Cup local fallback anchor missing");
    source = source.replace(leagueLine, `${leagueLine}${strictLines}`);
  }
  return source;
});
