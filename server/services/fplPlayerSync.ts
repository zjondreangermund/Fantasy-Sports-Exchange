import { sql } from "drizzle-orm";
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
  await db.execute(sql`alter table app.players add column if not exists fpl_id integer`);
  await db.execute(sql`alter table app.players add column if not exists code integer`);
  await db.execute(sql`alter table app.players add column if not exists photo text`);
  await db.execute(sql`alter table app.players add column if not exists web_name text`);
  await db.execute(sql`alter table app.players add column if not exists status text`);
  await db.execute(sql`alter table app.players add column if not exists news text`);
  await db.execute(sql`alter table app.players add column if not exists now_cost real`);
  await db.execute(sql`alter table app.players add column if not exists selected_by_percent real`);
  await db.execute(sql`alter table app.players add column if not exists total_points integer`);
  await db.execute(sql`alter table app.players add column if not exists form real`);
  await db.execute(sql`alter table app.players add column if not exists synced_at timestamp`);
  await db.execute(sql`create unique index if not exists players_fpl_id_unique_idx on app.players (fpl_id) where fpl_id is not null`);
}

export async function syncFplPremierLeaguePlayers() {
  await ensureFplPlayerColumns();
  const bootstrap = await fplApi.bootstrap();
  const index = buildFplPlayerIndex(bootstrap);
  const elements = index.elements;

  const existingResult: any = await db.execute(sql`
    select p.*,
           coalesce(count(pc.id), 0)::int as card_count
    from app.players p
    left join app.player_cards pc on pc.player_id = p.id
    group by p.id
  `);
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
      const insertResult: any = await db.execute(sql`
        insert into app.players (
          name, team, league, position, nationality, age, overall, image_url,
          fpl_id, code, photo, web_name, status, news, now_cost,
          selected_by_percent, total_points, form, synced_at
        )
        values (
          ${name}, ${teamName}, 'Premier League', ${position}::public.position,
          'Unknown', ${ageFallback(element)}, ${overall}, ${imageUrl},
          ${fplId}, ${code || null}, ${photo || null}, ${webName}, ${status},
          ${news}, ${nowCost}, ${selectedBy}, ${totalPoints}, ${form}, now()
        )
        on conflict do nothing
        returning id
      `);
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
      await db.execute(sql`
        update app.players
        set name = ${name},
            team = ${teamName},
            league = 'Premier League',
            position = ${position}::public.position,
            nationality = coalesce(nullif(nationality, ''), 'Unknown'),
            age = case when age is null or age <= 0 then ${ageFallback(element)} else age end,
            overall = ${overall},
            image_url = ${imageUrl},
            fpl_id = ${assignedFplId},
            code = ${code || null},
            photo = ${photo || null},
            web_name = ${webName},
            status = ${status},
            news = ${news},
            now_cost = ${nowCost},
            selected_by_percent = ${selectedBy},
            total_points = ${totalPoints},
            form = ${form},
            synced_at = now()
        where id = ${Number(row.id)}
      `);
      if (shouldLink) linkedLegacyRows += 1;
      updated += 1;
    }
  }

  return { inserted, updated, linkedLegacyRows, skipped, total: elements.length };
}
