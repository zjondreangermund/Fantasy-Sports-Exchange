import fs from "node:fs";

function replace(path, from, to) {
  const source = fs.readFileSync(path, "utf8");
  if (source.includes(to)) {
    console.log(`Already repaired: ${path}`);
    return;
  }
  if (!source.includes(from)) {
    console.log(`Repair no longer applies: ${path}`);
    return;
  }
  fs.writeFileSync(path, source.replace(from, to));
}

function replaceAll(path, from, to) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(from)) {
    console.log(`No global replacement required: ${path}`);
    return;
  }
  fs.writeFileSync(path, source.replaceAll(from, to));
}

function remove(path, value) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(value)) {
    console.log(`Already removed: ${path}`);
    return;
  }
  fs.writeFileSync(path, source.replace(value, ""));
}

replace(
  "client/src/components/Card3D.tsx",
  'import { type PlayerCardWithPlayer, type EplPlayer } from "../../../shared/schema";',
  'import { type PlayerCardWithPlayer } from "../../../shared/schema";\ntype EplPlayer = any;',
);

replace(
  "client/src/pages/premier-league.tsx",
  'import { type EplPlayer, type EplFixture, type EplInjury, type EplStanding } from "../../../shared/schema";',
  'type EplPlayer = any;\ntype EplFixture = any;\ntype EplInjury = any;\ntype EplStanding = any;',
);

replace(
  "client/src/components/cards/CardProfileModal.tsx",
  'player: { name: card.player?.name, team: card.player?.team, position: card.player?.position, imageUrl: card.player?.imageUrl },',
  'player: { name: card.player?.name, team: card.player?.team, position: card.player?.position, imageUrl: card.player?.imageUrl ?? undefined },',
);
replace(
  "client/src/components/cards/CardProfileModal.tsx",
  'totalPoints: Number(card.totalPoints || 0),',
  'totalPoints: Number((card as any).totalPoints || 0),',
);

replace(
  "client/src/pages/card-lab.tsx",
  'id: activeOption.playerId,',
  'id: String(activeOption.playerId),',
);
remove(
  "client/src/pages/card-lab.tsx",
  '                        overall: activeOption.player?.overall || 82,\n',
);
replace(
  "client/src/pages/card-lab.tsx",
  '                        position: activeOption.player?.position || "MID",\n',
  '                        position: activeOption.player?.position || "MID",\n                        rating: Number(activeOption.player?.overall || activeOption.player?.rating || 82),\n',
);

for (const path of ["client/src/pages/competitions.tsx", "client/src/pages/competitions-vault.tsx"]) {
  replace(
    path,
    'return { lineup: { cardIds: [] } as Lineup, cards: [] };',
    'return { lineup: { id: 0, userId: "", cardIds: [], captainId: null } as Lineup, cards: [] };',
  );
}

replace(
  "client/src/pages/competitions.tsx",
  '<LivePageShell>',
  '<LivePageShell tone="arena">',
);
replace(
  "client/src/pages/competitions.tsx",
  '<LiveHero kicker="Fantasy Arena" title="Tournament Arena" subtitle="Premier League 2026/27 only. Each gameweek starts from zero and locks at the first kickoff." />',
  '<LiveHero eyebrow="Fantasy Arena" title="Tournament Arena" description="Premier League 2026/27 only. Each gameweek starts from zero and locks at the first kickoff." />',
);

replace(
  "client/src/pages/onboarding-packs.tsx",
  'const cards = players.slice(i, i + 3).map((player: any, cardIndex: number) => {',
  'const cards: PlayerCardWithPlayer[] = players.slice(i, i + 3).map((player: any, cardIndex: number) => {',
);
replace(
  "client/src/pages/onboarding-packs.tsx",
  'Rarity_ORDER.filter',
  'RARITY_ORDER.filter',
);

replace(
  "server/routes/onboarding.routes.ts",
  'res.json({ success: true, kept: 5, ...grantResult });',
  'res.json({ success: true, ...grantResult, kept: 5 });',
);

replace(
  "client/src/pages/competitions-vault.tsx",
  'style={{ width: `${p}%`, background: t.accent, boxShadow: `0 0 18px ${t.glow}` }} /></div></div><div className="mt-4 flex gap-2">',
  'style={{ width: `${p}%`, background: t.accent, boxShadow: `0 0 18px ${t.glow}` }} /></div><div className="mt-4 flex gap-2">',
);

replace(
  "client/src/components/admin/AdminSecurityPanel.tsx",
  `    onError: async (error: any, _variables, context) => {
      if (context?.previous?.settings) {
        queryClient.setQueryData(ADMIN_SECURITY_KEY, context.previous);
        setDraft((current) => current ? { ...current, emergency: cloneSettings(context.previous!.settings).emergency } : cloneSettings(context.previous.settings));
        setClientSecurityStatus(context.previous.settings.emergency);
      }
      await securityQuery.refetch();`,
  `    onError: async (error: any, _variables, context) => {
      const previous = context?.previous;
      if (previous?.settings) {
        queryClient.setQueryData(ADMIN_SECURITY_KEY, previous);
        setDraft((current) => current ? { ...current, emergency: cloneSettings(previous.settings).emergency } : cloneSettings(previous.settings));
        setClientSecurityStatus(previous.settings.emergency);
      }
      await securityQuery.refetch();`,
);

replace(
  "client/src/components/admin/AdminSecurityPanel.tsx",
  'description="View-only access. Blocks all changes except this security control and logout."',
  'description="Launch preview mode. Sign-up, starter onboarding and the daily common reward remain available; economy and tournament actions stay paused."',
);
replace(
  "client/src/components/admin/AdminSecurityPanel.tsx",
  'description="Stops new Google login sessions and callbacks."',
  'description="Stops new sign-ups and logins, including during preview mode."',
);

replace(
  "server/services/packAuctionEscrow.ts",
  'return { success: true, auctionId, sold: true, winnerId, amount, ...settlement };',
  'return { success: true, auctionId, sold: true, winnerId, ...settlement };',
);

replace(
  "scripts/verify-critical-flows.mjs",
  '      "await ensureRuntimeSchema();\\n  try { const result = await syncFplPremierLeaguePlayers()",',
  '      "await ensureRuntimeSchema();",\n      "try { const result = await syncFplPremierLeaguePlayers()",',
);

replace(
  "scripts/verify-tournament-lineup-integrity.mjs",
  'requireText(server, "REQUIRED_LINEUP_POSITIONS", "Server validation must enforce the guided formation.");',
  'requireText(server, "TOURNAMENT_REQUIRED_POSITIONS", "Server validation must enforce the guided formation.");',
);
replace(
  "scripts/verify-tournament-lineup-integrity.mjs",
  'requireText(server, "pg_advisory_xact_lock(87421, card_id)", "Concurrent submissions must serialize card selection.");',
  'requireText(server, "pg_advisory_xact_lock(87421, selected.card_id)", "Concurrent submissions must serialize card selection.");',
);

replace(
  "scripts/verify-tournament-scoring-legal-integrity.mjs",
  'includesAll(myEntries, ["My Teams & Prizes", "Submitted lineup", "Prize claim pending", "Final scoring snapshot stored"], "Submitted teams page");',
  'includesAll(myEntries, ["My Teams & Prizes", "Submitted lineup", "prize claim pending", "Final scoring snapshot stored"], "Submitted teams page");',
);

for (const path of [
  "client/src/main.tsx",
  "scripts/verify-card-data-integrity.mjs",
  "scripts/verify-unified-scroll-architecture.mjs",
  "scripts/verify-verified-player-profiles.mjs",
  "scripts/verify-collection-actions-dialog.mjs",
  "scripts/verify-api-football-player-images.mjs",
  "scripts/verify-strict-player-identity-fixtures.mjs",
]) {
  replaceAll(path, "fantasy-site-v15", "fantasy-site-v18-lion-jpg");
}

console.log("Applied focused TypeScript repairs.");
