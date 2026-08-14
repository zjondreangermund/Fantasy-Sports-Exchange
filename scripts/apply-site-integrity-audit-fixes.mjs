import fs from "node:fs";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Site integrity patch anchor not found: ${label}`);
  return source.replace(from, to);
}

function insertBefore(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`Site integrity patch anchor not found: ${label}`);
  return source.replace(anchor, `${insertion}${anchor}`);
}

function insertAfter(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`Site integrity patch anchor not found: ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

// The live /competitions route uses competitions-vault.tsx. Its displayed entrant
// totals must come from /api/competitions (all tournament entries), never from the
// current user's /my-entries payload.
patchFile("client/src/pages/competitions-vault.tsx", (original) => {
  let source = original;
  source = replaceOnce(source, 'import { useMemo, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";', "competition useEffect import");

  const helperAnchor = `const entryLineupCardIds = (entry: CompetitionEntry) => {\n  const raw = (entry as any).lineupCardIds ?? (entry as any).lineup_card_ids;\n  return Array.isArray(raw) ? raw.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];\n};`;
  const helper = `\n// SITE_AUDIT_TOTAL_ENTRY_COUNT_V1\nconst tournamentEntryCount = (competition: Tournament | null | undefined) => Math.max(0, Number(competition?.entryCount ?? competition?.entry_count ?? 0) || 0);`;
  source = insertAfter(source, helperAnchor, helper, "SITE_AUDIT_TOTAL_ENTRY_COUNT_V1", "tournament total entry helper");

  const userCountBlock = `  const entryCounts = useMemo(() => {\n    const counts = new Map<number, number>();\n    for (const entry of entries) {\n      const competitionId = entryCompetitionId(entry);\n      counts.set(competitionId, (counts.get(competitionId) || 0) + 1);\n    }\n    return counts;\n  }, [entries]);\n`;
  if (source.includes(userCountBlock)) source = source.replace(userCountBlock, "");
  source = source.replaceAll('entryCount={entryCounts.get(Number(pinTournament.id)) || 0}', 'entryCount={tournamentEntryCount(pinTournament)}');
  source = source.replaceAll('entryCount={entryCounts.get(Number(comp.id)) || 0}', 'entryCount={tournamentEntryCount(comp)}');

  const pinState = '  const [pin, setPin] = useState("");';
  const pinStateReplacement = `  const initialInvitePin = typeof window !== "undefined"\n    ? (window.location.pathname.match(/^\\/join\\/([A-Z0-9]+)/i)?.[1] || new URLSearchParams(window.location.search).get("pin") || "").toUpperCase()\n    : "";\n  const [pin, setPin] = useState(initialInvitePin);`;
  source = replaceOnce(source, pinState, pinStateReplacement, "invite PIN initialization");

  const joinMutationAnchor = `  const joinMutation = useMutation({`;
  const inviteEffect = `  // SITE_AUDIT_INVITE_AUTO_LOOKUP_V1\n  useEffect(() => {\n    if (!initialInvitePin || pinTournament || findPinMutation.isPending) return;\n    findPinMutation.mutate();\n  }, [initialInvitePin]);\n\n`;
  source = insertBefore(source, joinMutationAnchor, inviteEffect, "SITE_AUDIT_INVITE_AUTO_LOOKUP_V1", "invite auto lookup");
  return source;
});

// The Matchday quick action says Edit Lineup, so send it to the dedicated lineup
// editor rather than merely opening Collection with an unused query string.
patchFile("client/src/components/MatchdayQuickDock.tsx", (source) =>
  replaceOnce(source, '<Link href="/collection?editLineup=1">', '<Link href="/live-lineup">', "matchday edit-lineup link"),
);

// Make permanent private-tournament invite links routable for signed-in users and
// preserve the PIN through Google OAuth for signed-out visitors.
patchFile("client/src/App.tsx", (original) => {
  let source = original;
  source = replaceOnce(
    source,
    '        <Route path="/competitions" component={CompetitionsPage} />',
    '        <Route path="/join/:pin" component={CompetitionsPage} />\n        <Route path="/competitions" component={CompetitionsPage} />',
    "join PIN route",
  );

  const appContentAnchor = `function AppContent() {\n  const { user, isLoading } = useAuth();`;
  const invitePersistence = `\n  // SITE_AUDIT_PENDING_INVITE_V1\n  React.useEffect(() => {\n    const match = window.location.pathname.match(/^\\/join\\/([A-Z0-9]+)/i);\n    if (match?.[1]) localStorage.setItem("fantasy_pending_tournament_pin", match[1].toUpperCase());\n  }, []);\n  React.useEffect(() => {\n    if (!user) return;\n    const pendingPin = String(localStorage.getItem("fantasy_pending_tournament_pin") || "").trim().toUpperCase();\n    if (!pendingPin) return;\n    const currentPath = window.location.pathname || "/";\n    if (/^\\/join\\//i.test(currentPath)) {\n      localStorage.removeItem("fantasy_pending_tournament_pin");\n      return;\n    }\n    if (currentPath === "/" || currentPath === "/dashboard") {\n      localStorage.removeItem("fantasy_pending_tournament_pin");\n      window.location.replace(\`/join/\${encodeURIComponent(pendingPin)}\`);\n    }\n  }, [user]);`;
  source = insertAfter(source, appContentAnchor, invitePersistence, "SITE_AUDIT_PENDING_INVITE_V1", "pending invite persistence");
  return source;
});

// Only official Fantasy Arena prize-ladder tournaments may advance the shared
// Prize Vault. User-created cash tournaments are a separate economy.
patchFile("server/routes/prizeVault.routes.ts", (source) => {
  const filterAnchor = `          and c.name not like '[TEST]%'`;
  const officialFilters = `\n          and coalesce(lower(c.visibility), 'public') = 'public'\n          and c.created_by_user_id is null\n          and lower(coalesce(c.prize_key, '')) = 'ladder'\n          and lower(coalesce(c.prize_type, 'goods')) = 'goods'`;
  return insertAfter(source, filterAnchor, officialFilters, "and c.created_by_user_id is null", "official Prize Vault filters");
});

// Marketplace must own marketplace routes only. It previously registered the
// tournament creator module and a second /api/user-tournaments/create handler.
// Because Marketplace is registered first, that shadow handler could apply a 20%
// fee even though the canonical creator rules and UI say 10% / 90%.
patchFile("server/routes/marketplace.routes.ts", (original) => {
  let source = original;
  source = source.replace('import { registerTournamentCreatorRoutes } from "./tournamentCreator.routes.js";\n', "");
  source = source.replace('  registerTournamentCreatorRoutes(app, { requireAuth });\n', "");

  const createStart = source.indexOf('  app.post("/api/user-tournaments/create", requireAuth, async (req: any, res) => {');
  const pinStart = source.indexOf('  app.get("/api/user-tournaments/pin/:pin", requireAuth', Math.max(0, createStart));
  if (createStart >= 0 && pinStart > createStart) source = source.slice(0, createStart) + source.slice(pinStart);

  return source;
});

console.log("Applied site integrity audit fixes: tournament totals, Prize Vault isolation, invite routes, lineup shortcut, and canonical tournament creation.");
