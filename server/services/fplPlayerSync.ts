import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { fplApi } from "./fplApi.js";

const POSITION_BY_ELEMENT_TYPE: Record<number, "GK" | "DEF" | "MID" | "FWD"> = {
  1: "GK",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function playerName(element: any) {
  const full = `${String(element?.first_name || "").trim()} ${String(element?.second_name || "").trim()}`.trim();
  return full || String(element?.web_name || "Unknown Player").trim();
}

function ageFallback(element: any) {
  return Math.max(16, Math.min(45, toNumber(element?.age, 25)));
}

function overallFromFpl(element: any) {
  const total = toNumber(element?.total_points, 0);
  const form = toNumber(element?.form, 0);
  const minutes = toNumber(element?.minutes, 0);
  const influence = toNumber(element?.influence, 0);
  return Math.max(1, Math.min(99, Math.round(35 + Math.min(35, total / 6) + Math.min(15, form * 1.8) + Math.min(10, minutes / 260) + Math.min(4, influence / 250))));
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
  const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];
  const teamById = new Map<number, any>();
  for (const team of teams) teamById.set(Number(team.id), team);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const element of elements) {
    const fplId = toNumber(element?.id, 0);
    const team = teamById.get(Number(element?.team));
    const teamName = String(team?.name || team?.short_name || "Premier League").trim();
    const position = POSITION_BY_ELEMENT_TYPE[Number(element?.element_type)] || "MID";
    const name = playerName(element);
    const webName = String(element?.web_name || name).trim();
    const code = toNumber(element?.code, 0);
    const photo = String(element?.photo || code || "").trim();
    const imageUrl = fplApi.playerPhotoUrl(element, 250);
    const overall = overallFromFpl(element);
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

    const updateResult: any = await db.execute(sql`
      update app.players
      set name = ${name},
          team = ${teamName},
          league = 'Premier League',
          position = ${position}::public.position,
          nationality = coalesce(nullif(nationality, ''), 'Unknown'),
          age = case when age is null or age <= 0 then ${ageFallback(element)} else age end,
          overall = ${overall},
          image_url = ${imageUrl},
          fpl_id = ${fplId},
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
      where fpl_id = ${fplId}
      returning id
    `);

    const updatedRows = Array.isArray(updateResult?.rows) ? updateResult.rows.length : 0;
    if (updatedRows > 0) {
      updated += 1;
      continue;
    }

    const insertResult: any = await db.execute(sql`
      insert into app.players (name, team, league, position, nationality, age, overall, image_url, fpl_id, code, photo, web_name, status, news, now_cost, selected_by_percent, total_points, form, synced_at)
      values (${name}, ${teamName}, 'Premier League', ${position}::public.position, 'Unknown', ${ageFallback(element)}, ${overall}, ${imageUrl}, ${fplId}, ${code || null}, ${photo || null}, ${webName}, ${status}, ${news}, ${nowCost}, ${selectedBy}, ${totalPoints}, ${form}, now())
      on conflict do nothing
      returning id
    `);
    const insertedRows = Array.isArray(insertResult?.rows) ? insertResult.rows.length : 0;
    if (insertedRows > 0) inserted += 1;
    else skipped += 1;
  }

  return { inserted, updated, skipped, total: elements.length };
}
