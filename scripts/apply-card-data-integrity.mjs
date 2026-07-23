#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(file, before, after) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`${file}: expected source block was not found`);
  write(file, source.replace(before, after));
}

const syncSource = `import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { fplApi } from "./fplApi.js";
import {
  buildFplPlayerIndex,
  fplPlayerFullName,
  fplPlayerPosition,
  normalizePlayerText,
  overallFromFplElement,
} from "./fplPlayerIdentity.js";

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function ageFallback(element: any) {
  return Math.max(16, Math.min(45, toNumber(element?.age, 25)));
}

function addToMap<K, V>(map: Map<K, V[]>, key: K | null | undefined, value: V) {
  if (key === null || key === undefined || key === ("" as any) || key === (0 as any)) return;
  const list = map.get(key) || [];
  list.push(value);
  map.set(key, list);
}

export async function ensureFplPlayerColumns() {
  await db.execute(sql\`alter table app.players add column if not exists fpl_id integer\`);
  await db.execute(sql\`alter table app.players add column if not exists code integer\`);
  await db.execute(sql\`alter table app.players add column if not exists photo text\`);
  await db.execute(sql\`alter table app.players add column if not exists web_name text\`);
  await db.execute(sql\`alter table app.players add column if not exists status text\`);
  await db.execute(sql\`alter table app.players add column if not exists news text\`);
  await db.execute(sql\`alter table app.players add column if not exists now_cost real\`);
  await db.execute(sql\`alter table app.players add column if not exists selected_by_percent real\`);
  await db.execute(sql\`alter table app.players add column if not exists total_points integer\`);
  await db.execute(sql\`alter table app.players add column if not exists form real\`);
  await db.execute(sql\`alter table app.players add column if not exists synced_at timestamp\`);
  await db.execute(sql\`create unique index if not exists players_fpl_id_unique_idx on app.players (fpl_id) where fpl_id is not null\`);
}

export async function syncFplPremierLeaguePlayers() {
  await ensureFplPlayerColumns();
  const bootstrap = await fplApi.bootstrap();
  const index = buildFplPlayerIndex(bootstrap);
  const elements = index.elements;

  const existingResult: any = await db.execute(sql\`
    select p.*,
           coalesce(count(pc.id), 0)::int as card_count
    from app.players p
    left join app.player_cards pc on pc.player_id = p.id
    group by p.id
  \`);
  const existingRows = Array.isArray(existingResult?.rows) ? existingResult.rows : [];
  const byFplId = new Map<number, any[]>();
  const byCode = new Map<number, any[]>();
  const byName = new Map<string, any[]>();

  for (const row of existingRows) {
    addToMap(byFplId, toNumber(row.fpl_id, 0), row);
    addToMap(byCode, toNumber(row.code, 0), row);
    addToMap(byName, normalizePlayerText(row.name), row);
    addToMap(byName, normalizePlayerText(row.web_name), row);
  }

  let inserted = 0;
  let updated = 0;
  let linkedLegacyRows = 0;
  let skipped = 0;

  for (const element of elements) {
    const fplId = toNumber(element?.id, 0);
    const code = toNumber(element?.code, 0);
    const name = fplPlayerFullName(element);
    const webName = String(element?.web_name || name).trim();
    const teamName = index.teamNameOf(element);
    const position = fplPlayerPosition(element);
    const photo = String(element?.photo || code || "").trim();
    const imageUrl = fplApi.playerPhotoUrl(element, 250);
    const overall = overallFromFplElement(element);
    const nowCost = toNumber(element?.now_cost, 0) / 10;
    const selectedBy = toNumber(element?.selected_by_percent, 0);
    const totalPoints = toNumber(element?.total_points, 0);
    const form = toNumber(element?.form, 0);
    const status = String(element?.status || "a");
    const news = String(element?.news || "");

    if (!fplId || !name || !teamName) {
      skipped += 1;
      continue;
    }

    const matches = new Map<number, any>();
    const addCandidate = (row: any) => {
      if (!row) return;
      const linkedFplId = toNumber(row.fpl_id, 0);
      if (linkedFplId && linkedFplId !== fplId) return;
      matches.set(Number(row.id), row);
    };

    for (const row of byFplId.get(fplId) || []) addCandidate(row);
    for (const row of byCode.get(code) || []) addCandidate(row);
    for (const key of [normalizePlayerText(name), normalizePlayerText(webName)]) {
      for (const row of byName.get(key) || []) addCandidate(row);
    }

    const matchedRows = [...matches.values()];
    if (!matchedRows.length) {
      const insertResult: any = await db.execute(sql\`
        insert into app.players (
          name, team, league, position, nationality, age, overall, image_url,
          fpl_id, code, photo, web_name, status, news, now_cost,
          selected_by_percent, total_points, form, synced_at
        )
        values (
          \${name}, \${teamName}, 'Premier League', \${position}::public.position,
          'Unknown', \${ageFallback(element)}, \${overall}, \${imageUrl},
          \${fplId}, \${code || null}, \${photo || null}, \${webName}, \${status},
          \${news}, \${nowCost}, \${selectedBy}, \${totalPoints}, \${form}, now()
        )
        on conflict do nothing
        returning id
      \`);
      const insertedRow = Array.isArray(insertResult?.rows) ? insertResult.rows[0] : null;
      if (insertedRow) inserted += 1;
      else skipped += 1;
      continue;
    }

    const existingOwner = matchedRows.find((row) => toNumber(row.fpl_id, 0) === fplId);
    const primary = existingOwner || [...matchedRows].sort((a, b) => {
      const cardDifference = toNumber(b.card_count, 0) - toNumber(a.card_count, 0);
      return cardDifference || toNumber(a.id, 0) - toNumber(b.id, 0);
    })[0];

    for (const row of matchedRows) {
      const shouldLink = Number(row.id) === Number(primary.id) && !toNumber(row.fpl_id, 0);
      const assignedFplId = Number(row.id) === Number(primary.id) ? fplId : (toNumber(row.fpl_id, 0) || null);
      await db.execute(sql\`
        update app.players
        set name = \${name},
            team = \${teamName},
            league = 'Premier League',
            position = \${position}::public.position,
            nationality = coalesce(nullif(nationality, ''), 'Unknown'),
            age = case when age is null or age <= 0 then \${ageFallback(element)} else age end,
            overall = \${overall},
            image_url = \${imageUrl},
            fpl_id = \${assignedFplId},
            code = \${code || null},
            photo = \${photo || null},
            web_name = \${webName},
            status = \${status},
            news = \${news},
            now_cost = \${nowCost},
            selected_by_percent = \${selectedBy},
            total_points = \${totalPoints},
            form = \${form},
            synced_at = now()
        where id = \${Number(row.id)}
      \`);
      if (shouldLink) linkedLegacyRows += 1;
      updated += 1;
    }
  }

  return { inserted, updated, linkedLegacyRows, skipped, total: elements.length };
}
`;
write("server/services/fplPlayerSync.ts", syncSource);

replaceOnce(
  "server/routes/cards.routes.ts",
  'import { fplApi } from "../services/fplApi.js";\n',
  'import { fplApi } from "../services/fplApi.js";\nimport { buildFplPlayerIndex, overallFromFplElement } from "../services/fplPlayerIdentity.js";\n',
);

replaceOnce(
  "server/routes/cards.routes.ts",
`      const [bootstrap, liveData] = await Promise.all([fplApi.bootstrap().catch(() => null), fplApi.getLiveGameweek().catch(() => null)]);
      const teams = Array.isArray((bootstrap as any)?.teams) ? (bootstrap as any).teams : [];
      const elements = Array.isArray((bootstrap as any)?.elements) ? (bootstrap as any).elements : [];
      const liveElements = Array.isArray((liveData as any)?.elements) ? (liveData as any).elements : [];
      const teamNameById = new Map<number, string>();
      for (const team of teams) teamNameById.set(Number(team.id), normalizeLookupText(String(team.name || team.short_name || "")));
      const elementByNameTeam = new Map<string, any>();
      const addElementCandidate = (name: string, teamNorm: string, element: any) => {
        const nameNorm = normalizeLookupText(name);
        if (!nameNorm || !teamNorm) return;
        const key = \`\${nameNorm}::\${teamNorm}\`;
        if (!elementByNameTeam.has(key)) elementByNameTeam.set(key, element);
      };
      for (const element of elements) {
        const teamNorm = teamNameById.get(Number(element.team)) || "";
        addElementCandidate(\`\${String(element.first_name || "")} \${String(element.second_name || "")}\`.trim(), teamNorm, element);
        addElementCandidate(String(element.web_name || ""), teamNorm, element);
      }
      const liveByElementId = new Map<number, any>();
      for (const liveElement of liveElements) liveByElementId.set(Number(liveElement.id), liveElement);
      const enrichedCards = cards.map((card: any) => {
        const player = card.player as any;
        if (!player) return card;
        const playerName = normalizeLookupText(String(player.name || ""));
        const teamName = normalizeLookupText(String(player.team || ""));
        const matchedElement = elementByNameTeam.get(\`\${playerName}::\${teamName}\`) || null;
        const liveElement = matchedElement ? liveByElementId.get(Number(matchedElement.id)) : null;
        let last5Scores = Array.isArray(card.last5Scores) ? card.last5Scores.map((value: any) => Number(value || 0)).slice(0, 5) : [];
        if (liveElement) {
          const mappedStats = mapFplStatsToPlayerStats(liveElement);
          const calculatedScore = calculatePlayerScore(mappedStats, String(player.position || "MID"));
          const latestLiveScore = Number(calculatedScore?.total_score || 0);
          last5Scores = [latestLiveScore, ...last5Scores];
        }
        last5Scores = last5Scores.map((value: any) => Number(value || 0)).slice(0, 5);
        while (last5Scores.length < 5) last5Scores.push(0);
        const totalPoints = last5Scores.reduce((sum: number, value: number) => sum + Number(value || 0), 0);
        const averageScore = last5Scores.length ? Math.round(totalPoints / last5Scores.length) : Number(player?.overall || card.decisiveScore || 0);
        return { ...card, decisiveScore: averageScore, totalPoints, last5Scores, player: { ...player, overall: averageScore } };
      });
      return res.json({ cards: enrichedCards });`,
`      const [bootstrap, liveData] = await Promise.all([fplApi.bootstrap().catch(() => null), fplApi.getLiveGameweek().catch(() => null)]);
      const fplIndex = buildFplPlayerIndex(bootstrap || {});
      const liveElements = Array.isArray((liveData as any)?.elements) ? (liveData as any).elements : [];
      const liveByElementId = new Map<number, any>();
      for (const liveElement of liveElements) liveByElementId.set(Number(liveElement.id), liveElement);

      const enrichedCards = cards.map((card: any) => {
        const player = card.player as any;
        if (!player) return card;
        const matchedElement = fplIndex.resolve(player);
        const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;
        const liveElement = matchedElement ? liveByElementId.get(Number(matchedElement.id)) : null;
        const currentPosition = canonical?.position || String(player.position || "MID");
        let last5Scores = Array.isArray(card.last5Scores) ? card.last5Scores.map((value: any) => Number(value || 0)).slice(0, 5) : [];
        if (liveElement) {
          const mappedStats = mapFplStatsToPlayerStats(liveElement);
          const calculatedScore = calculatePlayerScore(mappedStats, currentPosition);
          const latestLiveScore = Number(calculatedScore?.total_score || 0);
          last5Scores = [latestLiveScore, ...last5Scores];
        }
        last5Scores = last5Scores.map((value: any) => Number(value || 0)).slice(0, 5);
        while (last5Scores.length < 5) last5Scores.push(0);

        const totalPoints = matchedElement
          ? Number(matchedElement.total_points || 0)
          : Number(player.totalPoints ?? player.total_points ?? card.totalPoints ?? 0);
        const form = matchedElement
          ? Number(matchedElement.form || 0)
          : Number(player.form ?? card.decisiveScore ?? 0);
        const overall = matchedElement
          ? overallFromFplElement(matchedElement)
          : Number(player.overall || card.decisiveScore || 0);

        return {
          ...card,
          totalPoints,
          last5Scores,
          player: {
            ...player,
            ...(canonical || {}),
            imageUrl: matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : player.imageUrl,
            totalPoints,
            form,
            overall,
          },
        };
      });
      return res.json({ cards: enrichedCards });`,
);

replaceOnce(
  "server/routes/cards.routes.ts",
`      const bootstrap = await fplApi.bootstrap();
      const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
      const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];
      const teamNameById = new Map<number, string>();
      const teamShortById = new Map<number, string>();
      for (const team of teams) {
        teamNameById.set(Number(team.id), normalizeLookupText(String(team.name || team.short_name || "")));
        teamShortById.set(Number(team.id), String(team.short_name || team.name || \`T\${team.id}\`));
      }
      const playerName = normalizeLookupText(String(player.name || ""));
      const teamName = normalizeLookupText(String(player.team || ""));
      const matchedElement = elements.find((element: any) => {
        const elementTeam = teamNameById.get(Number(element.team)) || "";
        const fullName = normalizeLookupText(\`\${String(element.first_name || "")} \${String(element.second_name || "")}\`.trim());
        const webName = normalizeLookupText(String(element.web_name || ""));
        return elementTeam === teamName && (fullName === playerName || webName === playerName || fullName.includes(playerName) || playerName.includes(webName));
      });`,
`      const bootstrap = await fplApi.bootstrap();
      const fplIndex = buildFplPlayerIndex(bootstrap);
      const teamShortById = new Map<number, string>();
      for (const team of fplIndex.teams) teamShortById.set(Number(team.id), String(team.short_name || team.name || \`T\${team.id}\`));
      const matchedElement = fplIndex.resolve(player);`,
);

replaceOnce(
  "server/routes/cards.routes.ts",
`      const last10 = history.slice(-10).map((row: any) => ({ gameweek: Number(row.round || row.event || 0), opponent: teamShortById.get(Number(row.opponent_team)) || \`T\${row.opponent_team}\`, points: Number(row.total_points || 0), minutes: Number(row.minutes || 0), goals: Number(row.goals_scored || 0), assists: Number(row.assists || 0), kickoffTime: row.kickoff_time || null, wasHome: Boolean(row.was_home) }));
      return res.json({ source: "fpl-live", fplElementId: Number(matchedElement.id), player: { name: \`\${matchedElement.first_name || ""} \${matchedElement.second_name || ""}\`.trim() || player.name, webName: matchedElement.web_name, team: player.team, position: player.position, imageUrl: fplApi.playerPhotoUrl(matchedElement, 250), status: matchedElement.status, news: matchedElement.news || "" }, last10: last10.length ? last10 : lastScoresFallback(card), stats: { matchesPlayed: Number(matchedElement.starts || 0), minutes: Number(matchedElement.minutes || 0), goals: Number(matchedElement.goals_scored || 0), assists: Number(matchedElement.assists || 0), cleanSheets: Number(matchedElement.clean_sheets || 0), yellowCards: Number(matchedElement.yellow_cards || 0), redCards: Number(matchedElement.red_cards || 0), bonus: Number(matchedElement.bonus || 0), totalPoints: Number(matchedElement.total_points || 0), selectedBy: matchedElement.selected_by_percent, value: lastSaleValue } });`,
`      const canonical = fplIndex.canonical(matchedElement);
      const last10 = history.slice(-10).map((row: any) => ({
        gameweek: Number(row.round || row.event || 0),
        opponent: teamShortById.get(Number(row.opponent_team)) || \`T\${row.opponent_team}\`,
        points: Number(row.total_points || 0),
        minutes: Number(row.minutes || 0),
        goals: Number(row.goals_scored || 0),
        assists: Number(row.assists || 0),
        cleanSheets: Number(row.clean_sheets || 0),
        yellowCards: Number(row.yellow_cards || 0),
        redCards: Number(row.red_cards || 0),
        bonus: Number(row.bonus || 0),
        kickoffTime: row.kickoff_time || null,
        wasHome: Boolean(row.was_home),
      }));
      return res.json({ source: "fpl-live", fplElementId: Number(matchedElement.id), player: { ...canonical, imageUrl: fplApi.playerPhotoUrl(matchedElement, 250), status: matchedElement.status, news: matchedElement.news || "" }, last10: last10.length ? last10 : lastScoresFallback(card), stats: { matchesPlayed: Number(matchedElement.starts || 0), minutes: Number(matchedElement.minutes || 0), goals: Number(matchedElement.goals_scored || 0), assists: Number(matchedElement.assists || 0), cleanSheets: Number(matchedElement.clean_sheets || 0), yellowCards: Number(matchedElement.yellow_cards || 0), redCards: Number(matchedElement.red_cards || 0), bonus: Number(matchedElement.bonus || 0), totalPoints: Number(matchedElement.total_points || 0), selectedBy: matchedElement.selected_by_percent, value: lastSaleValue } });`,
);

replaceOnce(
  "client/src/lib/fantasy-card-adapter.ts",
`function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}
`,
`function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function finiteNumber(...values: unknown[]): number {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}
`,
);

replaceOnce(
  "client/src/lib/fantasy-card-adapter.ts",
`  const totalPoints = Number(
    (card as any).totalPoints ||
      last5Scores.reduce((sum, value) => sum + Number(value || 0), 0),
  );
`,
`  const totalPoints = finiteNumber(
    player?.totalPoints,
    player?.total_points,
    (card as any).totalPoints,
    last5Scores.reduce((sum, value) => sum + Number(value || 0), 0),
  );
  const form = finiteNumber(player?.form, player?.currentForm, (card as any).form, card.decisiveScore);
  const rating = finiteNumber(player?.overall, card.decisiveScore);
`,
);

replaceOnce(
  "client/src/lib/fantasy-card-adapter.ts",
`    rating: Number(player?.overall || card.decisiveScore || 0),
`,
`    rating,
`,
);

replaceOnce(
  "client/src/lib/fantasy-card-adapter.ts",
`    form: Number(card.decisiveScore || 0),
`,
`    form,
`,
);

replaceOnce(
  "client/src/components/cards/CollectionStableCard.tsx",
`function stat(player: PlayerCardData, fallback = 0) {
  return Math.max(0, Math.round(Number(player.rating || player.form || player.totalPoints || fallback || 0)));
}

`,
"",
);

replaceOnce(
  "client/src/components/cards/CollectionStableCard.tsx",
`function numberStat(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}
`,
`function numberStat(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function decimalStat(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.max(0, n).toFixed(1) : fallback.toFixed(1);
}
`,
);

replaceOnce(
  "client/src/components/cards/CollectionStableCard.tsx",
`  const ovr = stat(player);
  const points = numberStat(player.totalPoints || player.form || player.rating || 0);
  const form = numberStat(player.form || player.rating || 0);
`,
`  const ovr = numberStat(player.rating);
  const points = numberStat(player.totalPoints);
  const form = decimalStat(player.form);
`,
);

replaceOnce(
  "client/src/components/cards/CollectionStableCard.tsx",
`function StatChip({ label, value, scale, glow }: { label: string; value: number; scale: number; glow: string }) {
`,
`function StatChip({ label, value, scale, glow }: { label: string; value: number | string; scale: number; glow: string }) {
`,
);

for (const file of ["client/src/main.tsx", "client/public/sw.js"]) {
  write(file, read(file).replaceAll("fantasy-site-v9", "fantasy-site-v10"));
}

console.log("Card identity, team, position and stat repairs applied.");
