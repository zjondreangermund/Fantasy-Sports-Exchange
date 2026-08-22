#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;
const REPAIR_KEY = "restore-original-signup-card-sets-v1";
const REQUIRED_POSITIONS = ["GK", "DEF", "MID", "FWD"];
const TARGETS = [
  ["anastassjastrauss@gmail.com", [366278, 366279, 366280, 366281, 366282]],
  ["bertramkloppers@gmail.com", [338256, 338257, 338258, 338259, 338260]],
  ["brinkmanja1@gmail.com", [353261, 353262, 353263, 353264, 353265]],
  ["contractorsang@gmail.com", [4612, 4613, 4614, 4615, 4616]],
  ["davidjuniorchurmenvanwyk@gmail.com", [366291, 366290, 366292, 366293, 366294]],
  ["fantasyarena2580@gmail.com", [366266, 366267, 366268, 366269, 366270]],
  ["gcloete@wis.edu.na", [366307, 366306, 366308, 366309, 366310]],
  ["ishilongo97@gmail.com", [366316, 366317, 366318, 366319, 366320]],
  ["joebarber2580@gmail.com", [259, 260, 261, 262, 263]],
  ["lbcplaya@gmail.com", [247, 246, 244, 248, 245]],
  ["leighton01nc@gmail.com", [366275, 366274, 366273, 366272, 366276]],
  ["lujrhode@gmail.com", [280, 281, 282, 283, 284]],
  ["mervynafrica23@gmail.com", [4622, 4623, 4624, 4625, 4626]],
  ["mollerr827@gmail.com", [4632, 4633, 4634, 4635, 4636]],
  ["mshurano316@gmail.com", [275, 276, 277, 278, 274]],
  ["onmcnab94@gmail.com", [4617, 4618, 4621, 4619, 4620]],
  ["rapedisangdirk@gmail.com", [366305, 366301, 366304, 366302, 366303]],
  ["shomongulajason118@gmail.com", [366300, 366298, 366299, 366297, 366296]],
  ["virgeofantasy@gmail.com", [366321, 366322, 366323, 366325, 366324]],
  ["wezleyw05@gmail.com", [4627, 4628, 4629, 4630, 4631]],
  ["windstaansebastiaan@gmail.com", [366311, 366312, 366313, 366315, 366314]],
  ["zaylon2018@gmail.com", [266, 267, 268, 269, 270]],
  ["zeablondwitbooi@gmail.com", [366284, 366285, 366286, 366287, 366288]],
  ["zjondreangermund@gmail.com", [253, 254, 255, 256, 257]],
];
const RESET_ONLY_EMAILS = ["joeberber2580@gmail.com", "zaylon2580@gmail.com"];
const RESET_SELECTION_RESTORES = new Map([
  ["lbcplaya@gmail.com", [232, 254, 298, 304, 70]],
  ["zjondreangermund@gmail.com", [236, 75, 264, 61, 84]],
]);

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function positiveIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))]
    : [];
}

function eligibleOrder(cards) {
  const remaining = [...cards];
  const ordered = [];
  for (const position of REQUIRED_POSITIONS) {
    const index = remaining.findIndex((card) => String(card.position || "").toUpperCase() === position);
    if (index < 0) return null;
    ordered.push(remaining[index]);
    remaining.splice(index, 1);
  }
  if (remaining.length !== 1) return null;
  ordered.push(remaining[0]);
  return ordered;
}

async function backupAccount(client, user, keepCardIds) {
  const currentCards = rows(await client.query(`
    select to_jsonb(pc) as state
    from app.player_cards pc
    where pc.owner_id=$1 or pc.id=any($2::int[])
    order by pc.id
  `, [user.id, keepCardIds])).map((row) => row.state);
  const onboarding = rows(await client.query(
    "select to_jsonb(ob) as state from app.user_onboarding ob where ob.user_id=$1 limit 1",
    [user.id],
  ))[0]?.state || null;
  const lineup = rows(await client.query(
    "select to_jsonb(l) as state from app.lineups l where l.user_id=$1 limit 1",
    [user.id],
  ))[0]?.state || null;
  await client.query(`
    insert into app.original_signup_card_cleanup_backups
      (repair_key, user_id, email, keep_card_ids, onboarding, lineup, cards)
    values ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb)
    on conflict (repair_key,user_id) do nothing
  `, [
    REPAIR_KEY,
    user.id,
    user.email,
    JSON.stringify(keepCardIds),
    JSON.stringify(onboarding),
    JSON.stringify(lineup),
    JSON.stringify(currentCards),
  ]);
}

async function restoreAccount(client, email, keepCardIds, positionRepairPlayerIds = null) {
  const user = rows(await client.query(`
    select id::text, lower(coalesce(email,'')) as email
    from app.users where lower(coalesce(email,''))=$1 limit 1
  `, [email]))[0];
  if (!user) throw new Error(`Target account not found: ${email}`);

  const keep = rows(await client.query(`
    select pc.id, pc.player_id, pc.owner_id, pc.rarity::text as rarity,
           p.name, p.position::text as position
    from app.player_cards pc
    join app.players p on p.id=pc.player_id
    where pc.id=any($1::int[])
    order by array_position($1::int[],pc.id)
    for update of pc
  `, [keepCardIds]));
  if (keep.length !== 5) throw new Error(`${email}: one or more proven original card rows are missing`);
  if (keep.some((card) => card.owner_id != null && String(card.owner_id) !== String(user.id))) {
    throw new Error(`${email}: an original card is now owned by another account`);
  }
  if (keep.some((card) => String(card.rarity) !== "common")) {
    throw new Error(`${email}: an original signup card is no longer Common`);
  }
  const keepSet = new Set(keepCardIds);

  const ownedBefore = rows(await client.query(`
    select id from app.player_cards where owner_id=$1 order by id for update
  `, [user.id])).map((card) => Number(card.id));
  const extraCardIds = ownedBefore.filter((cardId) => !keepSet.has(cardId));
  await backupAccount(client, user, keepCardIds);

  if (positionRepairPlayerIds) {
    if (positiveIds(positionRepairPlayerIds).length !== 5) throw new Error(`${email}: invalid position repair plan`);
    for (let index = 0; index < keepCardIds.length; index += 1) {
      if (Number(keep[index]?.player_id) === Number(positionRepairPlayerIds[index])) continue;
      await client.query(`
        update app.player_cards
        set player_id=$1,serial_id=null,serial_number=null,max_supply=0
        where id=$2
      `, [positionRepairPlayerIds[index], keepCardIds[index]]);
    }
  }

  const repairedKeep = rows(await client.query(`
    select pc.id,pc.player_id,pc.owner_id,pc.rarity::text as rarity,
           p.name,p.position::text as position
    from app.player_cards pc join app.players p on p.id=pc.player_id
    where pc.id=any($1::int[])
    order by array_position($1::int[],pc.id)
  `, [keepCardIds]));
  const lineup = eligibleOrder(repairedKeep);
  if (!lineup) throw new Error(`${email}: original cards remain position-ineligible after identity repair`);
  const lineupCardIds = lineup.map((card) => Number(card.id));

  const restoredSelection = RESET_SELECTION_RESTORES.get(email);
  if (restoredSelection) {
    await client.query(
      "update app.user_onboarding set selected_cards=$1::jsonb where user_id=$2",
      [JSON.stringify(restoredSelection), user.id],
    );
  }

  await client.query(`
    insert into app.lineups (user_id,card_ids,captain_id)
    values ($1,$2::jsonb,$3)
    on conflict (user_id) do update
      set card_ids=excluded.card_ids,captain_id=excluded.captain_id
  `, [user.id, JSON.stringify(lineupCardIds), lineupCardIds[3]]);

  let released = 0;
  if (extraCardIds.length) {
    const result = await client.query(`
      update app.player_cards
      set owner_id=null,for_sale=false,price=0
      where owner_id=$1 and id=any($2::int[])
    `, [user.id, extraCardIds]);
    released = Number(result.rowCount || 0);
  }
  const restored = await client.query(`
    update app.player_cards
    set owner_id=$1,for_sale=false,price=0
    where id=any($2::int[]) and (owner_id is null or owner_id=$1)
  `, [user.id, keepCardIds]);
  if (Number(restored.rowCount || 0) !== 5) throw new Error(`${email}: not all original cards could be assigned`);

  const verify = rows(await client.query(`
    select array_agg(id order by id) as ids,
           count(*)::int as total,
           count(*) filter (where rarity::text='common')::int as common,
           count(*) filter (where for_sale=true)::int as listed
    from app.player_cards where owner_id=$1
  `, [user.id]))[0];
  const finalIds = positiveIds(verify?.ids).sort((left, right) => left - right);
  const expectedIds = [...keepCardIds].sort((left, right) => left - right);
  if (Number(verify?.total) !== 5 || Number(verify?.common) !== 5 || Number(verify?.listed) !== 0
      || finalIds.join(",") !== expectedIds.join(",")) {
    throw new Error(`${email}: final five-card ownership verification failed`);
  }

  await client.query(`
    insert into app.audit_logs (user_id,action,meta)
    values ($1,'admin.original_signup_card_set_restored',$2::jsonb)
  `, [user.id, JSON.stringify({
    repairKey: REPAIR_KEY,
    proof: "pre-repair rollback snapshot plus signup acquisition cluster and historical lineup evidence",
    originalCardIds: keepCardIds,
    lineupCardIds,
    previousOwnedCardIds: ownedBefore,
    releasedExtraCardIds: extraCardIds,
    positionRepairPlayerIds: positionRepairPlayerIds || [],
    restoredSelectedPlayerIds: restoredSelection || [],
  })]);
  console.log(
    `ORIGINAL_SIGNUP_RESTORED email=${email} keepCardIds=${keepCardIds.join(",")}`
    + ` lineupCardIds=${lineupCardIds.join(",")} releasedExtraCardIds=${extraCardIds.join(",") || "none"}`,
  );
  return { released };
}

async function preflightAccount(client, email, keepCardIds) {
  const cards = rows(await client.query(`
    select pc.id,pc.player_id,pc.owner_id,pc.rarity::text as rarity,
           p.name,p.position::text as position
    from app.player_cards pc
    left join app.players p on p.id=pc.player_id
    where pc.id=any($1::int[])
    order by array_position($1::int[],pc.id)
  `, [keepCardIds]));
  const rendered = cards.map((card) => (
    `${Number(card.id)}:${Number(card.player_id)}:${String(card.name || "missing").replace(/\s+/g,"_")}:${String(card.position || "none")}`
  )).join("|");
  const eligible = cards.length === 5 && Boolean(eligibleOrder(cards));
  console.log(`ORIGINAL_SIGNUP_PREFLIGHT email=${email} eligible=${eligible} cards=${rendered || "none"}`);
  return { eligible, cards };
}

async function loadPositionRepairPlan(client, email, keepCardIds, cards) {
  if (email === "zjondreangermund@gmail.com") {
    return [236, 75, 264, 61, 84];
  }

  const userId = rows(await client.query(
    "select id::text from app.users where lower(coalesce(email,''))=$1 limit 1",
    [email],
  ))[0]?.id;
  if (!userId) return null;
  const audit = rows(await client.query(`
    select meta
    from app.audit_logs
    where user_id=$1 and action='admin.confirmed_starter_selection_restored'
    order by created_at desc,id desc limit 1
  `, [userId]))[0];
  const lineupCardIds = positiveIds(audit?.meta?.lineupCardIds);
  if (lineupCardIds.length !== 5) return null;
  const repairedCards = rows(await client.query(`
    select pc.id,pc.player_id,p.position::text as position
    from app.player_cards pc join app.players p on p.id=pc.player_id
    where pc.id=any($1::int[])
  `, [lineupCardIds]));
  const ordered = eligibleOrder(repairedCards);
  if (!ordered) return null;
  const playerIds = ordered.map((card) => Number(card.player_id));
  console.log(
    `ORIGINAL_SIGNUP_POSITION_REPAIR email=${email}`
    + ` originalCards=${cards.map((card) => card.id).join(",")}`
    + ` playerIds=${playerIds.join(",")} evidence=confirmed-repair-lineup-from-original-packs`,
  );
  return playerIds;
}

async function verifyResetOnlyAccount(client, email) {
  const cards = rows(await client.query(`
    select pc.id,p.position::text as position
    from app.users u join app.player_cards pc on pc.owner_id=u.id
    join app.players p on p.id=pc.player_id
    where lower(coalesce(u.email,''))=$1
    order by pc.id
  `, [email]));
  if (cards.length !== 5 || !eligibleOrder(cards)) {
    throw new Error(`${email}: reset-only account is not an eligible five-card team`);
  }
  console.log(`ORIGINAL_SIGNUP_NO_RECORD email=${email} preservedCardIds=${cards.map((card) => card.id).join(",")} reason=no-signup-packs-or-selection-history`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [REPAIR_KEY]);
    await client.query(`
      create table if not exists app.runtime_data_repairs (
        repair_key text primary key,
        applied_at timestamptz not null default now(),
        details jsonb not null default '{}'::jsonb
      )
    `);
    await client.query(`
      create table if not exists app.original_signup_card_cleanup_backups (
        repair_key text not null,
        user_id varchar(255) not null,
        email text,
        keep_card_ids jsonb not null,
        onboarding jsonb,
        lineup jsonb,
        cards jsonb not null,
        created_at timestamptz not null default now(),
        primary key (repair_key,user_id)
      )
    `);
    const already = rows(await client.query(
      "select details from app.runtime_data_repairs where repair_key=$1 limit 1",
      [REPAIR_KEY],
    ))[0];
    if (already) {
      await client.query("commit");
      console.log(`ORIGINAL_SIGNUP_CLEANUP_ALREADY_APPLIED repairKey=${REPAIR_KEY} details=${JSON.stringify(already.details || {})}`);
      return;
    }

    const invalidPositionSets = [];
    const positionRepairPlans = new Map();
    for (const [email, keepCardIds] of TARGETS) {
      const preflight = await preflightAccount(client, email, keepCardIds);
      if (preflight.eligible) continue;
      const plan = await loadPositionRepairPlan(client, email, keepCardIds, preflight.cards);
      if (!plan) invalidPositionSets.push(email);
      else positionRepairPlans.set(email, plan);
    }
    if (invalidPositionSets.length) {
      throw new Error(`Original card position repair required for: ${invalidPositionSets.join(",")}`);
    }

    if (positionRepairPlans.size) {
      await client.query("drop trigger if exists player_cards_mint_identity_guard on app.player_cards");
    }

    let releasedCards = 0;
    for (const [email, keepCardIds] of TARGETS) {
      const result = await restoreAccount(client, email, keepCardIds, positionRepairPlans.get(email) || null);
      releasedCards += result.released;
    }
    for (const email of RESET_ONLY_EMAILS) await verifyResetOnlyAccount(client, email);

    const details = {
      restoredSignupAccounts: TARGETS.length,
      resetOnlyAccountsPreserved: RESET_ONLY_EMAILS.length,
      releasedExtraCards: releasedCards,
      finalOwnedCardsPerAccount: 5,
    };
    await client.query(
      "insert into app.runtime_data_repairs (repair_key,details) values ($1,$2::jsonb)",
      [REPAIR_KEY, JSON.stringify(details)],
    );
    await client.query("commit");
    console.log(
      `ORIGINAL_SIGNUP_CLEANUP_SUMMARY repairKey=${REPAIR_KEY}`
      + ` restoredAccounts=${TARGETS.length} resetOnlyPreserved=${RESET_ONLY_EMAILS.length}`
      + ` releasedExtraCards=${releasedCards} finalCardsEach=5`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`ORIGINAL_SIGNUP_CLEANUP_FAILED ${error?.stack || error}`);
  process.exit(1);
});
