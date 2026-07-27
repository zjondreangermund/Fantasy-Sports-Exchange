#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(file, before, after) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`${file}: expected block not found`);
  write(file, source.replace(before, after));
}

const adminFile = "client/src/pages/admin-live-data.tsx";
let source = read(adminFile);
if (!source.includes("Sync Players & Photos")) {
  source = source.replace(
    'import { Activity, CalendarDays, CheckCircle2, Clock3, Database, History, Play, RefreshCw, Search, ServerCog, ShieldCheck, Table2, XCircle } from "lucide-react";',
    'import { Activity, CalendarDays, CheckCircle2, Clock3, Database, History, Image, Play, RefreshCw, Search, ServerCog, ShieldCheck, Table2, Users, XCircle } from "lucide-react";',
  );
  source = source.replace(
    '  { key: "teams", label: "Sync Teams & Logos", description: "Refreshes team details through the fixture feed." },\n] as const;',
    '  { key: "teams", label: "Sync Teams & Logos", description: "Refreshes team details through the fixture feed." },\n  { key: "players", label: "Sync Players & Photos", description: "Imports current Premier League squads and API-Football player portraits." },\n] as const;',
  );
  source = source.replace(
    '  const status = useQuery<any>({ queryKey: ["/api/admin/live-data/status"], refetchInterval: 60_000 });',
    '  const status = useQuery<any>({ queryKey: ["/api/admin/live-data/status"], refetchInterval: 60_000 });\n  const playerImageHealth = useQuery<any>({ queryKey: ["/api/admin/live-data/player-images"], refetchInterval: 5 * 60_000 });',
  );
  source = source.replace(
    '        queryClient.invalidateQueries({ queryKey: ["/api/admin/live-data/status"] }),\n      ]);',
    '        queryClient.invalidateQueries({ queryKey: ["/api/admin/live-data/status"] }),\n        queryClient.invalidateQueries({ queryKey: ["/api/admin/live-data/player-images"] }),\n        queryClient.invalidateQueries({ queryKey: ["/api/my-cards"] }),\n        queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] }),\n      ]);',
  );
  source = source.replace(
    '            <Button onClick={() => { syncCentre.refetch(); status.refetch(); }} variant="outline" className="border-white/15 bg-white/5 text-white"><RefreshCw className="mr-2 h-4 w-4" />Refresh dashboard</Button>',
    '            <Button onClick={() => { syncCentre.refetch(); status.refetch(); playerImageHealth.refetch(); }} variant="outline" className="border-white/15 bg-white/5 text-white"><RefreshCw className="mr-2 h-4 w-4" />Refresh dashboard</Button>',
  );
  source = source.replace('        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">', '        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">');
  source = source.replace(
    '          <Metric label="Safe requests left" value={remaining} good={remaining > 0} />\n        </section>',
    '          <Metric label="Safe requests left" value={remaining} good={remaining > 0} />\n          <Metric label="Player images" value={playerImageHealth.data?.healthy ? "Working" : playerImageHealth.isLoading ? "Checking" : "Needs sync"} good={Boolean(playerImageHealth.data?.healthy)} />\n        </section>',
  );
  source = source.replace(
    '        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">\n          <DatabaseMetric icon={CalendarDays} label="Fixtures stored" value={counts.fixtures || 0} />\n          <DatabaseMetric icon={ServerCog} label="Teams stored" value={counts.teams || 0} />\n          <DatabaseMetric icon={Activity} label="Player stat rows" value={counts.playerStats || 0} />\n          <DatabaseMetric icon={Table2} label="Standing rows" value={counts.standings || 0} />\n        </section>',
    '        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">\n          <DatabaseMetric icon={CalendarDays} label="Fixtures stored" value={counts.fixtures || 0} />\n          <DatabaseMetric icon={ServerCog} label="Teams stored" value={counts.teams || 0} />\n          <DatabaseMetric icon={Users} label="Players stored" value={counts.players || 0} />\n          <DatabaseMetric icon={Image} label="Player photos" value={counts.playerPhotos || 0} />\n          <DatabaseMetric icon={Activity} label="Player stat rows" value={counts.playerStats || 0} />\n          <DatabaseMetric icon={Table2} label="Standing rows" value={counts.standings || 0} />\n        </section>\n\n        <Card className="border-white/10 bg-white/[.06] p-4 text-white sm:p-6">\n          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">\n            <div><div className="flex items-center gap-2 text-xl font-black"><Image className="h-5 w-5 text-fuchsia-200" />API-Football player portraits</div><p className="mt-1 text-sm text-white/45">Only exact squad matches receive a provider portrait. Unresolved cards keep the neutral silhouette.</p></div>\n            <Badge className={playerImageHealth.data?.healthy ? "bg-emerald-500/20 text-emerald-100" : "bg-amber-500/20 text-amber-100"}>{playerImageHealth.data?.healthy ? "Image feed online" : "Run Players & Photos sync"}</Badge>\n          </div>\n          <div className="mt-4 grid gap-3 sm:grid-cols-4"><Info label="Directory players" value={playerImageHealth.data?.players || counts.players || 0} /><Info label="Photos available" value={playerImageHealth.data?.photos || counts.playerPhotos || 0} /><Info label="Coverage" value={`${playerImageHealth.data?.coveragePercent ?? counts.photoCoveragePercent ?? 0}%`} /><Info label="Sample image" value={playerImageHealth.data?.imageProbe?.reachable ? `HTTP ${playerImageHealth.data?.imageProbe?.status || 200}` : "Not verified"} /></div>\n        </Card>',
  );
  source = source.replace('          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">', '          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">');
  write(adminFile, source);
}

for (const file of [
  "client/src/main.tsx",
  "client/public/sw.js",
  "scripts/verify-card-data-integrity.mjs",
  "scripts/verify-unified-scroll-architecture.mjs",
  "scripts/verify-verified-player-profiles.mjs",
  "scripts/verify-strict-player-identity-fixtures.mjs",
  "scripts/verify-collection-actions-dialog.mjs",
]) {
  write(file, read(file).replaceAll("fantasy-site-v14", "fantasy-site-v15"));
}

console.log("API-Football player image client patch applied.");
