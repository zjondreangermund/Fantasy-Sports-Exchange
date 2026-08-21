import fs from "node:fs";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
}

function insertAfter(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`API-Football site linkage anchor not found: ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

function insertBeforeLast(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  const index = source.lastIndexOf(anchor);
  if (index < 0) throw new Error(`API-Football site linkage anchor not found: ${label}`);
  return `${source.slice(0, index)}${insertion}${source.slice(index)}`;
}

patchFile("server/services/apiFootballSync.ts", (source) => {
  if (!source.includes("API_FOOTBALL_PRO_MODE_V1")) throw new Error("API-Football Pro patch must run before site linkage");
  const providerEnd = '  throw new Error("API-Football request failed after rate-limit backoff");\n}\n';
  const wrapper = `\n// API_FOOTBALL_PUBLIC_PROVIDER_V1\nexport async function fetchApiFootballProvider(\n  path: string,\n  params: Record<string, string | number | undefined> = {},\n) {\n  return providerGet(path, params);\n}\n`;
  return insertAfter(source, providerEnd, wrapper, "API_FOOTBALL_PUBLIC_PROVIDER_V1", "central provider export");
});

patchFile("server/index.ts", (original) => {
  let source = original;
  source = insertAfter(
    source,
    'import { registerAdminInsightsRoutes } from "./routes/adminInsights.routes.js";\n',
    'import { registerFootballDataRoutes } from "./routes/footballData.routes.js";\n',
    'registerFootballDataRoutes } from "./routes/footballData.routes.js"',
    "football data route import",
  );
  source = insertAfter(
    source,
    '  registerSecurityAdminRoutes(app, { requireAuth, isAdmin });\n',
    '  registerFootballDataRoutes(app);\n',
    'registerFootballDataRoutes(app);',
    "football data route registration",
  );
  return source;
});

patchFile("client/src/pages/premier-league.tsx", (original) => {
  let source = original;
  source = insertAfter(
    source,
    'import LiveGames from "../components/LiveGames";\n',
    'import FootballDataCentre from "../components/FootballDataCentre";\n',
    'FootballDataCentre from "../components/FootballDataCentre"',
    "Football Data Centre import",
  );

  const injuryTrigger = `              <TabsTrigger value="injuries" className="flex items-center gap-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white">\n                <AlertTriangle className="w-4 h-4" /> Injuries\n              </TabsTrigger>`;
  const dataTrigger = `${injuryTrigger}\n              <TabsTrigger value="data-centre" className="flex items-center gap-1 data-[state=active]:bg-violet-600 data-[state=active]:text-white">\n                <Activity className="w-4 h-4" /> Pro Data Centre\n              </TabsTrigger>`;
  if (!source.includes('value="data-centre"')) {
    if (!source.includes(injuryTrigger)) throw new Error("API-Football site linkage anchor not found: data-centre tab trigger");
    source = source.replace(injuryTrigger, dataTrigger);
  }

  const dataContent = `          {/* API_FOOTBALL_SITE_TAB_V1 */}\n          <TabsContent value="data-centre">\n            <FootballDataCentre />\n          </TabsContent>\n\n`;
  source = insertBeforeLast(source, "          </Tabs>", dataContent, "API_FOOTBALL_SITE_TAB_V1", "data-centre tab content");

  source = source.replace(
    "Live tracking for Premier League — {currentSeasonLabel} Season",
    "Premier League fantasy tracking + API-Football Pro intelligence — {currentSeasonLabel} Season",
  );
  return source;
});

console.log("Linked API-Football Pro match intelligence, leaderboards, clubs and player histories into the public site.");
