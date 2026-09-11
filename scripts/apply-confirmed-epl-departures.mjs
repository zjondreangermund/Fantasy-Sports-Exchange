import fs from "node:fs";

const TRANSFER = "server/services/playerTransferMonitoring.ts";
const FPL_SYNC = "server/services/fplPlayerSync.ts";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[confirmed-epl-departure] anchor not found: ${label}`);
  return source.replace(from, to);
}

function patchFile(path, transform) {
  const original = fs.readFileSync(path, "utf8");
  const next = transform(original);
  if (next !== original) {
    fs.writeFileSync(path, next);
    console.log(`[confirmed-epl-departure] patched ${path}`);
  } else {
    console.log(`[confirmed-epl-departure] ${path} already ready`);
  }
}

patchFile(TRANSFER, (original) => {
  if (original.includes("CONFIRMED_EPL_DEPARTURE_EVIDENCE_V1")) return original;
  let source = original;

  source = replaceRequired(
    source,
    'import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";',
    'import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";\nimport { apiFootballSeasonNow, loadApiFootballPlayerDirectory, resolveApiFootballPlayer } from "./apiFootballPlayerDirectory.js";',
    "API-Football directory import",
  );

  const processAnchor = "export async function processFplRosterChanges(existingRows: any[], currentFplIds: number[]) {";
  const helperBlock = [
    "// CONFIRMED_EPL_DEPARTURE_EVIDENCE_V1",
    "// A missing FPL element alone is not proof that a player left the Premier League.",
    "// Require a recent, complete API-Football current-squad snapshot before creating",
    "// departure claims. This also repairs historical false exits caused by provider-ID churn.",
    "type DepartureEvidence = { ready: boolean; directory: any[]; reason: string };",
    "let departureEvidenceCache: { at: number; value: Promise<DepartureEvidence> } | null = null;",
    "",
    "async function loadDepartureEvidence(): Promise<DepartureEvidence> {",
    "  const now = Date.now();",
    "  if (departureEvidenceCache && now - departureEvidenceCache.at < 5 * 60_000) return departureEvidenceCache.value;",
    "  const value = (async () => {",
    "    try {",
    "      const recent = rowsOf(await db.execute(sql`",
    "        select finished_at as \"finishedAt\"",
    "        from app.api_football_sync_runs",
    "        where job_type='players'",
    "          and status='success'",
    "          and coalesce((details->>'complete')::boolean, false)=true",
    "          and finished_at > now()-interval '36 hours'",
    "        order by finished_at desc",
    "        limit 1",
    "      `))[0];",
    "      if (!recent?.finishedAt) return { ready: false, directory: [], reason: \"no_recent_complete_api_football_squad_sync\" };",
    "      const directory = await loadApiFootballPlayerDirectory(apiFootballSeasonNow());",
    "      const activeTeams = new Set(directory.map((player: any) => String(player?.team || \"\").trim().toLowerCase()).filter(Boolean));",
    "      if (directory.length < 300 || activeTeams.size < 18) {",
    "        return { ready: false, directory, reason: \"api_football_squad_coverage_incomplete\" };",
    "      }",
    "      return { ready: true, directory, reason: \"recent_complete_api_football_squads\" };",
    "    } catch (error: any) {",
    "      return { ready: false, directory: [], reason: `api_football_verification_unavailable:${String(error?.message || error || \"unknown\")}` };",
    "    }",
    "  })();",
    "  departureEvidenceCache = { at: now, value };",
    "  return value;",
    "}",
    "",
    "function resolveCurrentPremierLeagueRosterPlayer(row: any, directory: any[]) {",
    "  return resolveApiFootballPlayer({",
    "    name: row?.name,",
    "    webName: row?.webName || row?.web_name,",
    "    web_name: row?.webName || row?.web_name,",
    "    team: row?.team,",
    "    position: row?.position,",
    "  }, directory);",
    "}",
    "",
    "async function repairFalseDeparture(row: any, currentPlayer: any) {",
    "  const playerId = Number(row?.id || 0);",
    "  if (!playerId || !currentPlayer?.team) return 0;",
    "  const playerName = String(row?.name || currentPlayer?.name || \"Player\");",
    "  const claims = rowsOf(await db.execute(sql`",
    "    select pr.id, pr.user_id as \"userId\", pr.source_card_id as \"sourceCardId\",",
    "           pr.replacement_card_id as \"replacementCardId\"",
    "    from app.player_replacement_claims pr",
    "    join app.player_transfer_events e on e.id=pr.transfer_event_id",
    "    where e.player_id=${playerId}",
    "      and e.left_premier_league=true",
    "      and coalesce(e.suppressed,false)=false",
    "  `));",
    "  const events = rowsOf(await db.execute(sql`",
    "    select id",
    "    from app.player_transfer_events",
    "    where player_id=${playerId}",
    "      and left_premier_league=true",
    "      and coalesce(suppressed,false)=false",
    "  `));",
    "  if (!events.length) return 0;",
    "",
    "  await db.execute(sql`",
    "    update app.player_transfer_events",
    "    set suppressed=true, suppression_reason='confirmed_current_epl_api_football', to_team=${String(currentPlayer.team)}",
    "    where player_id=${playerId}",
    "      and left_premier_league=true",
    "      and coalesce(suppressed,false)=false",
    "  `);",
    "",
    "  await db.execute(sql`",
    "    update app.players",
    "    set team=${String(currentPlayer.team)},",
    "        league='Premier League',",
    "        position=${String(currentPlayer.position || row?.position || \"MID\")}::public.position,",
    "        status=case when status='departed' or status is null then 'a' else status end,",
    "        image_url=case when ${String(currentPlayer.photo || \"\")} <> '' then ${String(currentPlayer.photo || \"\")} else image_url end,",
    "        news=case",
    "          when coalesce(news,'') ilike '%No longer in the Premier League; replacement-card protection applies%' then null",
    "          else news",
    "        end,",
    "        synced_at=now()",
    "    where id=${playerId}",
    "  `);",
    "",
    "  const correctedUsers = new Set<string>();",
    "  for (const claim of claims) {",
    "    const claimId = Number(claim.id || 0);",
    "    const userId = String(claim.userId || \"\");",
    "    const sourceCardId = Number(claim.sourceCardId || 0);",
    "    if (sourceCardId && userId) {",
    "      await db.execute(sql`",
    "        update app.player_cards",
    "        set owner_id=${userId}, for_sale=false, price=0",
    "        where id=${sourceCardId} and owner_id is null",
    "      `);",
    "      correctedUsers.add(userId);",
    "    }",
    "    if (claimId) {",
    "      await db.execute(sql`delete from app.notifications where dedupe_key=${`replacement-claim:${claimId}`}`);",
    "    }",
    "    if (claimId && !claim.replacementCardId) {",
    "      await db.execute(sql`delete from app.player_replacement_claims where id=${claimId} and replacement_card_id is null`);",
    "    }",
    "  }",
    "",
    "  const season = currentSeasonStartYear();",
    "  for (const userId of correctedUsers) {",
    "    await createNotificationOnce(db, {",
    "      userId,",
    "      title: `${playerName} remains in the Premier League`,",
    "      message: `${playerName} is currently registered with ${String(currentPlayer.team)}. An earlier departure alert was caused by a roster identity mismatch and has been corrected. Your original card remains eligible for Premier League play.`,",
    "      dedupeKey: `replacement-correction:${season}:${playerId}:${userId}`,",
    "    });",
    "  }",
    "  return events.length;",
    "}",
    "",
    "export async function reconcileFalsePremierLeagueDepartures() {",
    "  await ensurePlayerTransferMonitoringSchema();",
    "  const evidence = await loadDepartureEvidence();",
    "  if (!evidence.ready) return { repaired: 0, ready: false, reason: evidence.reason };",
    "  const candidates = rowsOf(await db.execute(sql`",
    "    select distinct p.id, p.name, p.team, p.league, p.status, p.web_name as \"webName\", p.position::text as position",
    "    from app.players p",
    "    join app.player_transfer_events e on e.player_id=p.id",
    "    where e.left_premier_league=true and coalesce(e.suppressed,false)=false",
    "  `));",
    "  let repaired = 0;",
    "  for (const row of candidates) {",
    "    const currentPlayer = resolveCurrentPremierLeagueRosterPlayer(row, evidence.directory);",
    "    if (!currentPlayer) continue;",
    "    repaired += await repairFalseDeparture(row, currentPlayer);",
    "  }",
    "  return { repaired, ready: true, reason: evidence.reason };",
    "}",
    "",
    processAnchor,
  ].join("\n");
  source = replaceRequired(source, processAnchor, helperBlock, "confirmed departure helpers");

  source = replaceRequired(
    source,
    "  await ensurePlayerTransferMonitoringSchema();\n  const suppressedHistoricalAliasEvents = await suppressHistoricalTeamAliasNoise();",
    "  await ensurePlayerTransferMonitoringSchema();\n  const falseDepartureRepair = await reconcileFalsePremierLeagueDepartures();\n  const suppressedHistoricalAliasEvents = await suppressHistoricalTeamAliasNoise();",
    "historical false-departure repair",
  );

  source = replaceRequired(
    source,
    '    select p.id, p.name, p.team, p.league, p.status, p.fpl_id as "fplId"',
    '    select p.id, p.name, p.team, p.league, p.status, p.web_name as "webName", p.position::text as position, p.fpl_id as "fplId"',
    "current player identity fields",
  );

  source = replaceRequired(
    source,
    "  let replacementClaims = 0;",
    "  let replacementClaims = 0;\n  let unconfirmedDepartures = 0;\n  let preventedFalseDepartures = Number(falseDepartureRepair?.repaired || 0);\n  const departureEvidence = await loadDepartureEvidence();",
    "departure evidence counters",
  );

  const departureLoopAnchor = [
    "  for (const row of postRows) {",
    "    const playerId = Number(row.id || 0);",
    "    const fplId = Number(row.fplId || 0);",
    "    if (!playerId || !fplId || currentIds.has(fplId) || !isPremierLeague(row.league)) continue;",
    "",
    "    const playerName = String(row.name || \"Player\");",
  ].join("\n");
  const departureLoopReplacement = [
    "  for (const row of postRows) {",
    "    const playerId = Number(row.id || 0);",
    "    const fplId = Number(row.fplId || 0);",
    "    if (!playerId || !fplId || currentIds.has(fplId) || !isPremierLeague(row.league)) continue;",
    "",
    "    // Never interpret a single-provider FPL omission as a confirmed EPL exit.",
    "    // A fresh complete API-Football squad directory is the independent proof layer.",
    "    const currentPlayer = resolveCurrentPremierLeagueRosterPlayer(row, departureEvidence.directory);",
    "    if (currentPlayer) {",
    "      await db.execute(sql`",
    "        update app.players",
    "        set team=${String(currentPlayer.team)}, league='Premier League',",
    "            position=${String(currentPlayer.position || row.position || \"MID\")}::public.position,",
    "            status=case when status='departed' or status is null then 'a' else status end,",
    "            synced_at=now()",
    "        where id=${playerId}",
    "      `);",
    "      preventedFalseDepartures += 1;",
    "      continue;",
    "    }",
    "    if (!departureEvidence.ready) {",
    "      unconfirmedDepartures += 1;",
    "      continue;",
    "    }",
    "",
    "    const playerName = String(row.name || \"Player\");",
  ].join("\n");
  source = replaceRequired(source, departureLoopAnchor, departureLoopReplacement, "two-provider departure gate");

  if (source.includes("return { movedWithinLeague, leftLeague, replacementClaims, suppressedTeamAliasChanges };")) {
    source = source.replace(
      "return { movedWithinLeague, leftLeague, replacementClaims, suppressedTeamAliasChanges };",
      "return { movedWithinLeague, leftLeague, replacementClaims, suppressedTeamAliasChanges, unconfirmedDepartures, preventedFalseDepartures, departureEvidence: departureEvidence.reason };",
    );
  } else {
    source = replaceRequired(
      source,
      "return { movedWithinLeague, leftLeague, replacementClaims };",
      "return { movedWithinLeague, leftLeague, replacementClaims, unconfirmedDepartures, preventedFalseDepartures, departureEvidence: departureEvidence.reason };",
      "departure report",
    );
  }

  source = replaceRequired(
    source,
    "export async function listUserReplacementClaims(userId: string) {\n  await ensurePlayerTransferMonitoringSchema();",
    "export async function listUserReplacementClaims(userId: string) {\n  await ensurePlayerTransferMonitoringSchema();\n  await reconcileFalsePremierLeagueDepartures();",
    "claim-list correction pass",
  );

  return source;
});

patchFile(FPL_SYNC, (original) => {
  if (original.includes("FPL_STABLE_CODE_RELINK_V1")) return original;
  return replaceRequired(
    original,
    "    for (const row of byFplId.get(fplId) || []) addCandidate(row);\n    for (const row of byCode.get(code) || []) addCandidate(row);",
    "    for (const row of byFplId.get(fplId) || []) addCandidate(row);\n    // FPL_STABLE_CODE_RELINK_V1\n    // FPL element IDs can churn around transfers/provider refreshes. The stable player\n    // code is stronger identity evidence, so allow it to relink an existing card-owning\n    // player row even when that row still carries the previous FPL element ID.\n    for (const row of byCode.get(code) || []) {\n      if (code > 0 && toNumber(row.code, 0) === code) matches.set(Number(row.id), row);\n    }",
    "stable FPL code relink",
  );
});

const transfer = fs.readFileSync(TRANSFER, "utf8");
const sync = fs.readFileSync(FPL_SYNC, "utf8");
for (const [source, token, label] of [
  [transfer, "CONFIRMED_EPL_DEPARTURE_EVIDENCE_V1", "two-provider departure marker"],
  [transfer, "reconcileFalsePremierLeagueDepartures", "historical false-departure reconciliation"],
  [transfer, "no_recent_complete_api_football_squad_sync", "fresh complete squad gate"],
  [transfer, "unconfirmedDepartures += 1", "unsafe departure suppression"],
  [transfer, "replacement-correction:", "owner correction notification"],
  [sync, "FPL_STABLE_CODE_RELINK_V1", "stable FPL identity relink"],
]) {
  if (!source.includes(token)) throw new Error(`[confirmed-epl-departure] verification failed: ${label}`);
}

console.log("Confirmed EPL departure protection ready: FPL omissions require fresh complete current-squad corroboration, stale IDs relink by stable code, and historical false exits are repaired with owner corrections.");
