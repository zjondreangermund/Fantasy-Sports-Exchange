#!/usr/bin/env node
import fs from "node:fs";

const file = "client/src/pages/premier-league.tsx";
const marker = "PREMIER_LEAGUE_DATA_CENTRE_ONLY_V1";
let source = fs.readFileSync(file, "utf8");

if (source.includes(marker)) {
  console.log("Premier League Data Centre-only UI already applied.");
  process.exit(0);
}

if (!source.includes('FootballDataCentre from "../components/FootballDataCentre"')) {
  const anchor = 'import LiveGames from "../components/LiveGames";\n';
  if (!source.includes(anchor)) throw new Error("Premier League Data Centre-only patch could not find the FootballDataCentre import anchor");
  source = source.replace(anchor, `${anchor}import FootballDataCentre from "../components/FootballDataCentre";\n`);
}

const tabsStart = '          <Tabs defaultValue="live" className="w-full">';
const start = source.indexOf(tabsStart);
if (start < 0) throw new Error("Premier League Data Centre-only patch could not find the legacy outer tabs");

const close = '          </Tabs>';
const end = source.lastIndexOf(close);
if (end < start) throw new Error("Premier League Data Centre-only patch could not find the legacy outer tabs closing tag");

// Keep the original API linkage marker/value as comments so the upstream linkage
// patch and verifier remain idempotent on later npm check/build invocations.
const replacement = `          {/* API_FOOTBALL_SITE_TAB_V1 compatibility: value="data-centre" */}\n          {/* ${marker} */}\n          <FootballDataCentre />`;
source = `${source.slice(0, start)}${replacement}${source.slice(end + close.length)}`;
source = source.replace("Top 5 Leagues", "Premier League");
source = source.replace(
  "Live tracking for Premier League — {currentSeasonLabel} Season",
  "Premier League fantasy tracking + API-Football Pro intelligence — {currentSeasonLabel} Season",
);

fs.writeFileSync(file, source);
console.log("Premier League now opens the Pro Data Centre directly; redundant Live Games, Standings, Fixtures and Injuries outer tabs were removed.");
