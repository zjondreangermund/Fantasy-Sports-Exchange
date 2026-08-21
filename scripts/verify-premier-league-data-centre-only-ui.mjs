#!/usr/bin/env node
import fs from "node:fs";

const page = fs.readFileSync("client/src/pages/premier-league.tsx", "utf8");
const failures = [];
const requireText = (text, message) => { if (!page.includes(text)) failures.push(message); };
const rejectText = (text, message) => { if (page.includes(text)) failures.push(message); };

requireText("PREMIER_LEAGUE_DATA_CENTRE_ONLY_V1", "Data Centre-only layout marker is missing");
requireText("<FootballDataCentre />", "Premier League page is not rendering the Pro Data Centre directly");
requireText("Premier League fantasy tracking + API-Football Pro intelligence", "Premier League Pro intelligence subtitle is missing");
rejectText('<TabsTrigger value="live"', "redundant Live Games outer tab remains");
rejectText('<TabsTrigger value="standings"', "redundant Standings outer tab remains");
rejectText('<TabsTrigger value="fixtures"', "redundant Fixtures outer tab remains");
rejectText('<TabsTrigger value="injuries"', "redundant Injuries outer tab remains");
rejectText('<TabsTrigger value="data-centre"', "redundant Pro Data Centre outer tab remains instead of direct content");
rejectText("Top 5 Leagues", "old multi-league title remains");

if (failures.length) {
  console.error("Premier League Data Centre-only UI verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Premier League UI verified: Pro Data Centre is shown directly with no duplicate Live Games, Standings, Fixtures or Injuries outer tabs.");
