import fs from "node:fs";

const TRANSFER = "server/services/playerTransferMonitoring.ts";
const RETENTION = "server/routes/retention.routes.ts";
const BACKOFFICE = "client/src/components/admin/AdminBackofficePanel.tsx";
const SCROLL = "client/src/unified-scroll.css";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`[transfer-admin-pan] patched ${file}`);
  } else {
    console.log(`[transfer-admin-pan] ${file} already patched`);
  }
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Transfer/admin/pan patch anchor not found: ${label}`);
  return source.replace(from, to);
}

patchFile(TRANSFER, (original) => {
  let source = original;

  const premierLeagueAnchor = `function isPremierLeague(value: unknown) {\n  return String(value || "").trim().toLowerCase() === "premier league";\n}`;
  const canonicalHelpers = `// PLAYER_TRANSFER_CANONICAL_TEAM_V2\n// Different providers use club display-name variants (for example Nottingham\n// Forest / Nottingham or Tottenham Hotspur / Tottenham). Transfer monitoring\n// must compare one canonical club identity before notifying card owners.\nconst PREMIER_LEAGUE_TEAM_ALIAS_GROUPS: string[][] = [\n  ["arsenal", "arsenal-fc"],\n  ["aston-villa", "aston-villa-fc", "villa"],\n  ["afc-bournemouth", "bournemouth", "bournemouth-afc"],\n  ["brentford", "brentford-fc"],\n  ["brighton-and-hove-albion", "brighton-hove-albion", "brighton", "brighton-hove"],\n  ["chelsea", "chelsea-fc"],\n  ["coventry-city", "coventry", "coventry-city-fc"],\n  ["crystal-palace", "crystal-palace-fc", "palace"],\n  ["everton", "everton-fc"],\n  ["fulham", "fulham-fc"],\n  ["hull-city", "hull", "hull-city-afc"],\n  ["ipswich-town", "ipswich", "ipswich-town-fc"],\n  ["leeds-united", "leeds", "leeds-utd"],\n  ["liverpool", "liverpool-fc"],\n  ["manchester-city", "man-city", "man-city-fc", "mancity"],\n  ["manchester-united", "man-united", "man-utd", "manchester-utd", "manutd"],\n  ["newcastle-united", "newcastle", "newcastle-utd"],\n  ["nottingham-forest", "nottingham", "nottm-forest", "nottmforest", "notts-forest"],\n  ["sunderland", "sunderland-afc"],\n  ["tottenham-hotspur", "tottenham", "spurs", "tottenham-hotspur-fc"],\n  ["west-ham-united", "west-ham", "west-ham-utd"],\n  ["wolverhampton-wanderers", "wolves", "wolverhampton", "wolverhampton-wanderers-fc"],\n  ["burnley", "burnley-fc"],\n  ["leicester-city", "leicester", "leicester-city-fc"],\n  ["southampton", "southampton-fc"],\n  ["sheffield-united", "sheffield-utd"],\n  ["luton-town", "luton"],\n];\n\nconst PREMIER_LEAGUE_TEAM_ALIAS_INDEX = new Map<string, string>();\nfor (const aliases of PREMIER_LEAGUE_TEAM_ALIAS_GROUPS) {\n  const canonical = aliases[0];\n  for (const alias of aliases) PREMIER_LEAGUE_TEAM_ALIAS_INDEX.set(alias, canonical);\n}\n\nexport function canonicalTeamIdentity(value: unknown) {\n  const normalized = normalizeTeam(value);\n  if (!normalized) return "";\n  const direct = PREMIER_LEAGUE_TEAM_ALIAS_INDEX.get(normalized);\n  if (direct) return direct;\n  const simplified = normalized\n    .replace(/^afc-/, "")\n    .replace(/-(?:football-club|fc|afc)$/, "")\n    .replace(/-the$/, "");\n  return PREMIER_LEAGUE_TEAM_ALIAS_INDEX.get(simplified) || simplified;\n}\n\n${premierLeagueAnchor}`;
  source = replaceRequired(source, premierLeagueAnchor, canonicalHelpers, "canonical club identity helpers");

  const schemaIndexAnchor = `      await db.execute(sql\`create index if not exists player_transfer_events_player_idx on app.player_transfer_events (player_id, detected_at desc)\`);`;
  const schemaIndexReplacement = `      await db.execute(sql\`alter table app.player_transfer_events add column if not exists suppressed boolean not null default false\`);\n      await db.execute(sql\`alter table app.player_transfer_events add column if not exists suppression_reason text\`);\n      ${schemaIndexAnchor}`;
  source = replaceRequired(source, schemaIndexAnchor, schemaIndexReplacement, "transfer suppression schema");

  const processAnchor = `export async function processFplRosterChanges(existingRows: any[], currentFplIds: number[]) {`;
  const cleanupAndProcess = `async function suppressHistoricalTeamAliasNoise() {\n  const candidates = rowsOf(await db.execute(sql\`\n    select id, event_key as "eventKey", from_team as "fromTeam", to_team as "toTeam"\n    from app.player_transfer_events\n    where left_premier_league=false and coalesce(suppressed,false)=false\n    order by detected_at desc\n  \`));\n\n  let suppressed = 0;\n  for (const event of candidates) {\n    const fromTeam = String(event.fromTeam || "");\n    const toTeam = String(event.toTeam || "");\n    if (!fromTeam || !toTeam) continue;\n    if (normalizeTeam(fromTeam) === normalizeTeam(toTeam)) continue;\n    if (canonicalTeamIdentity(fromTeam) !== canonicalTeamIdentity(toTeam)) continue;\n\n    await db.execute(sql\`\n      update app.player_transfer_events\n      set suppressed=true, suppression_reason='club_alias_only'\n      where id=\${Number(event.id)}\n    \`);\n    await db.execute(sql\`\n      delete from app.notifications\n      where dedupe_key=\${\`player-transfer:\${String(event.eventKey || "")}\`}\n    \`);\n    suppressed += 1;\n  }\n  return suppressed;\n}\n\n${processAnchor}`;
  source = replaceRequired(source, processAnchor, cleanupAndProcess, "alias-only cleanup");

  source = replaceRequired(
    source,
    `  await ensurePlayerTransferMonitoringSchema();\n  const season = currentSeasonStartYear();`,
    `  await ensurePlayerTransferMonitoringSchema();\n  const suppressedHistoricalAliasEvents = await suppressHistoricalTeamAliasNoise();\n  const season = currentSeasonStartYear();`,
    "run historical alias cleanup",
  );

  source = replaceRequired(
    source,
    `  let movedWithinLeague = 0;\n  let leftLeague = 0;\n  let replacementClaims = 0;`,
    `  let movedWithinLeague = 0;\n  let leftLeague = 0;\n  let replacementClaims = 0;\n  let suppressedTeamAliasChanges = suppressedHistoricalAliasEvents;`,
    "alias suppression counter",
  );

  const oldTransferBlock = `      const fromTeam = String(before.team || "").trim();\n      const toTeam = String(after.team || "").trim();\n      if (isPremierLeague(before.league) && fromTeam && toTeam && normalizeTeam(fromTeam) !== normalizeTeam(toTeam)) {\n        const eventKey = \`pl-transfer:\${season}:\${playerId}:\${normalizeTeam(fromTeam)}:\${normalizeTeam(toTeam)}\`;`;
  const newTransferBlock = `      const fromTeam = String(before.team || "").trim();\n      const toTeam = String(after.team || "").trim();\n      const fromTeamIdentity = canonicalTeamIdentity(fromTeam);\n      const toTeamIdentity = canonicalTeamIdentity(toTeam);\n      const displayNameChanged = normalizeTeam(fromTeam) !== normalizeTeam(toTeam);\n      if (isPremierLeague(before.league) && fromTeam && toTeam && displayNameChanged && fromTeamIdentity === toTeamIdentity) {\n        // Same club, different provider spelling/display name. Never notify the\n        // owner and never treat this as a transfer.\n        suppressedTeamAliasChanges += 1;\n        continue;\n      }\n      if (isPremierLeague(before.league) && fromTeam && toTeam && fromTeamIdentity && toTeamIdentity && fromTeamIdentity !== toTeamIdentity) {\n        const eventKey = \`pl-transfer:\${season}:\${playerId}:\${fromTeamIdentity}:\${toTeamIdentity}\`;`;
  source = replaceRequired(source, oldTransferBlock, newTransferBlock, "canonical transfer comparison");

  source = replaceRequired(
    source,
    `  return { movedWithinLeague, leftLeague, replacementClaims };`,
    `  return { movedWithinLeague, leftLeague, replacementClaims, suppressedTeamAliasChanges };`,
    "transfer sync report",
  );

  const userClaimsAnchor = `export async function listUserReplacementClaims(userId: string) {`;
  const adminReport = `export async function listAdminPlayerTransferReport(limit = 150) {\n  await ensurePlayerTransferMonitoringSchema();\n  await suppressHistoricalTeamAliasNoise();\n  const safeLimit = Math.max(20, Math.min(250, Number(limit) || 150));\n\n  const events = rowsOf(await db.execute(sql\`\n    select e.id, e.player_id as "playerId", e.fpl_id as "fplId", e.player_name as "playerName",\n           e.from_team as "fromTeam", e.to_team as "toTeam", e.left_premier_league as "leftPremierLeague",\n           coalesce(e.suppressed,false) as suppressed, e.suppression_reason as "suppressionReason", e.detected_at as "detectedAt",\n           p.league as "currentLeague", p.status as "currentStatus",\n           (select count(distinct pc.owner_id)::int from app.player_cards pc where pc.player_id=e.player_id and pc.owner_id is not null) as "affectedUsers",\n           (select count(*)::int from app.player_cards pc where pc.player_id=e.player_id and pc.owner_id is not null) as "affectedCards",\n           (select count(*)::int from app.player_replacement_claims pr where pr.transfer_event_id=e.id and pr.replacement_card_id is null) as "openClaims",\n           (select count(*)::int from app.player_replacement_claims pr where pr.transfer_event_id=e.id and pr.replacement_card_id is not null) as "claimedClaims"\n    from app.player_transfer_events e\n    left join app.players p on p.id=e.player_id\n    order by e.detected_at desc, e.id desc\n    limit \${safeLimit}\n  \`));\n\n  const ownerRows = rowsOf(await db.execute(sql\`\n    with recent as (\n      select id, player_id\n      from app.player_transfer_events\n      order by detected_at desc, id desc\n      limit \${safeLimit}\n    )\n    select recent.id as "eventId", pc.owner_id as "userId", u.email, u.name, u.manager_team_name as "managerTeamName",\n           pc.id as "cardId", pc.rarity::text as rarity,\n           pr.id as "claimId", pr.replacement_card_id as "replacementCardId", pr.claimed_at as "claimedAt"\n    from recent\n    join app.player_cards pc on pc.player_id=recent.player_id and pc.owner_id is not null\n    left join app.users u on u.id=pc.owner_id\n    left join app.player_replacement_claims pr on pr.source_card_id=pc.id and pr.transfer_event_id=recent.id\n    order by recent.id desc, pc.owner_id, pc.id\n  \`));\n\n  const ownersByEvent = new Map<number, Map<string, any>>();\n  for (const row of ownerRows) {\n    const eventId = Number(row.eventId || 0);\n    const userId = String(row.userId || "");\n    if (!eventId || !userId) continue;\n    let users = ownersByEvent.get(eventId);\n    if (!users) { users = new Map(); ownersByEvent.set(eventId, users); }\n    let owner = users.get(userId);\n    if (!owner) {\n      owner = {\n        userId,\n        email: row.email || null,\n        name: row.name || null,\n        managerTeamName: row.managerTeamName || null,\n        cards: [],\n      };\n      users.set(userId, owner);\n    }\n    owner.cards.push({\n      cardId: Number(row.cardId || 0),\n      rarity: String(row.rarity || ""),\n      claimId: row.claimId ? Number(row.claimId) : null,\n      replacementCardId: row.replacementCardId ? Number(row.replacementCardId) : null,\n      claimedAt: row.claimedAt || null,\n    });\n  }\n\n  const enrichedEvents = events.map((event: any) => {\n    const aliasOnly = !Boolean(event.leftPremierLeague)\n      && Boolean(event.fromTeam)\n      && Boolean(event.toTeam)\n      && canonicalTeamIdentity(event.fromTeam) === canonicalTeamIdentity(event.toTeam)\n      && normalizeTeam(event.fromTeam) !== normalizeTeam(event.toTeam);\n    return {\n      ...event,\n      suspectedAliasOnly: aliasOnly,\n      owners: [...(ownersByEvent.get(Number(event.id))?.values() || [])],\n    };\n  });\n\n  const affectedUserIds = new Set<string>();\n  for (const event of enrichedEvents) {\n    for (const owner of event.owners || []) affectedUserIds.add(String(owner.userId));\n  }\n\n  return {\n    summary: {\n      events: enrichedEvents.length,\n      realTransfers: enrichedEvents.filter((event: any) => !event.leftPremierLeague && !event.suppressed && !event.suspectedAliasOnly).length,\n      departures: enrichedEvents.filter((event: any) => Boolean(event.leftPremierLeague)).length,\n      aliasOnlySuppressed: enrichedEvents.filter((event: any) => Boolean(event.suppressed || event.suspectedAliasOnly)).length,\n      affectedUsers: affectedUserIds.size,\n      affectedCards: enrichedEvents.reduce((sum: number, event: any) => sum + Number(event.affectedCards || 0), 0),\n      openClaims: enrichedEvents.reduce((sum: number, event: any) => sum + Number(event.openClaims || 0), 0),\n      claimedClaims: enrichedEvents.reduce((sum: number, event: any) => sum + Number(event.claimedClaims || 0), 0),\n    },\n    events: enrichedEvents,\n  };\n}\n\n${userClaimsAnchor}`;
  source = replaceRequired(source, userClaimsAnchor, adminReport, "admin player-transfer report");

  return source;
});

patchFile(RETENTION, (original) => {
  let source = original;
  source = replaceRequired(
    source,
    `import { registerNotificationRoutes } from "./notifications.routes.js";`,
    `import { registerNotificationRoutes } from "./notifications.routes.js";\nimport { registerAdminPlayerTransferRoutes } from "./adminPlayerTransfers.routes.js";`,
    "admin transfer route import",
  );
  source = replaceRequired(
    source,
    `  registerNotificationRoutes(app, { requireAuth });`,
    `  registerNotificationRoutes(app, { requireAuth });\n  registerAdminPlayerTransferRoutes(app, { requireAuth, isAdmin: walletAdmin });`,
    "admin transfer route registration",
  );
  return source;
});

patchFile(BACKOFFICE, (original) => {
  let source = original;
  source = replaceRequired(
    source,
    `import AdminTournamentManager from "./AdminTournamentManager";`,
    `import AdminTournamentManager from "./AdminTournamentManager";\nimport AdminPlayerTransfersPanel from "./AdminPlayerTransfersPanel";`,
    "admin transfer panel import",
  );
  source = replaceRequired(
    source,
    `      <AdminTournamentManager />\n\n      <Card`,
    `      <AdminTournamentManager />\n      <AdminPlayerTransfersPanel />\n\n      <Card`,
    "admin transfer panel placement",
  );
  return source;
});

patchFile(SCROLL, (original) => {
  if (original.includes("APP_DESKTOP_VIEW_PAN_V2")) return original;
  return `${original.trimEnd()}\n\n/* APP_DESKTOP_VIEW_PAN_V2\n * Desktop view is a 1280px layout viewed through a much smaller phone visual\n * viewport. The authenticated shell previously kept html/body/root and the\n * shell clipped/hidden, which lets pinch zoom happen but prevents the browser\n * from moving the zoomed visual viewport horizontally. In Desktop view only,\n * release those clipping locks and let Chromium/WebView own the pan gesture. */\nhtml[data-site-view="desktop"].app-scroll-locked,\nhtml[data-site-view="desktop"].app-scroll-locked body,\nhtml[data-site-view="desktop"].app-scroll-locked #root {\n  overflow: visible !important;\n  overflow-x: visible !important;\n  overflow-y: visible !important;\n  overscroll-behavior: auto !important;\n  touch-action: auto !important;\n}\n\nhtml[data-site-view="desktop"] .app-shell,\nhtml[data-site-view="desktop"] .app-content {\n  overflow: visible !important;\n  touch-action: auto !important;\n}\n\nhtml[data-site-view="desktop"] [data-app-scroll-root] {\n  overflow-x: auto !important;\n  overflow-y: auto !important;\n  overscroll-behavior: auto !important;\n  touch-action: auto !important;\n}\n\nhtml[data-site-view="desktop"] [data-page-scroll-content],\nhtml[data-site-view="desktop"] [data-page-scroll-content] > :where(main, section, article, div),\nhtml[data-site-view="desktop"] [data-scroll-region="true"],\nhtml[data-site-view="desktop"] [role="dialog"] {\n  touch-action: auto !important;\n}\n`;
});

console.log("Transfer identity, admin affected-user reporting, alias-noise suppression and Desktop-view zoom panning are ready.");
