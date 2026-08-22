#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;
const REPAIR_KEY = "restore-confirmed-starter-selections-v1";
const RESET_ACTION = "admin.test_account_starter_reset";
const REPAIR_ACTIONS = [
  "admin.confirmed_starter_selection_restored",
  "admin.documented_reset_starter_team_repaired",
  "admin.proven_historical_starter_card_restored",
];
const SIGNUP_WINDOW_BEFORE_MS = 60 * 60 * 1000;
const SIGNUP_WINDOW_AFTER_MS = 24 * 60 * 60 * 1000;
const CLUSTER_MS = 2 * 60 * 1000;

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function positiveIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))]
    : [];
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "none";
}

function identityScore(expected, candidate) {
  if (!expected || !candidate) return 0;
  if (Number(expected.id) === Number(candidate.id)) return 140;
  const expectedCode = Number(expected.code || 0);
  const candidateCode = Number(candidate.code || 0);
  if (expectedCode && candidateCode && expectedCode === candidateCode) return 130;
  const expectedFpl = Number(expected.fpl_id || 0);
  const candidateFpl = Number(candidate.fpl_id || 0);
  if (expectedFpl && candidateFpl && expectedFpl === candidateFpl) return 125;

  const expectedNames = new Set([norm(expected.name), norm(expected.web_name)].filter(Boolean));
  const candidateNames = new Set([norm(candidate.name), norm(candidate.web_name)].filter(Boolean));
  let score = 0;
  if (norm(expected.name) && norm(expected.name) === norm(candidate.name)) score = 110;
  else if ([...expectedNames].some((name) => candidateNames.has(name))) score = 95;
  if (!score) return 0;
  if (norm(expected.team) && norm(expected.team) === norm(candidate.team)) score += 8;
  if (String(expected.position || "") === String(candidate.position || "")) score += 4;
  return score;
}

function bestIdentityScore(expectedPlayers, candidatePlayer) {
  return Math.max(0, ...expectedPlayers.map((player) => identityScore(player, candidatePlayer)));
}

async function tableExists(client, qualifiedName) {
  const result = await client.query("select to_regclass($1) as name", [qualifiedName]);
  return Boolean(result.rows?.[0]?.name);
}

function addEvidence(evidence, cardId, source) {
  const id = Number(cardId);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  const sources = evidence.get(id) || new Set();
  sources.add(source);
  evidence.set(id, sources);
}

async function historicalEvidence(client, account) {
  const evidence = new Map();
  const cutoff = account.reset_at || account.backup_at;

  if (await tableExists(client, "app.competition_entries")) {
    const entries = rows(await client.query(`
      select lineup_card_ids, prize_card_id
      from app.competition_entries
      where user_id=$1
    `, [account.user_id]));
    for (const entry of entries) {
      for (const cardId of positiveIds(entry.lineup_card_ids)) addEvidence(evidence, cardId, "competition-entry");
      addEvidence(evidence, entry.prize_card_id, "competition-prize");
    }
  }

  if (await tableExists(client, "app.audit_logs")) {
    const audit = rows(await client.query(`
      select action, meta
      from app.audit_logs
      where user_id=$1 and created_at < $2::timestamptz
      order by created_at, id
    `, [account.user_id, cutoff]));
    for (const event of audit) {
      const meta = asObject(event.meta);
      addEvidence(evidence, meta.cardId ?? meta.card_id, `audit:${event.action}`);
      for (const field of ["cardIds", "starterCardIds", "lineupCardIds", "previousLineupCardIds"]) {
        for (const cardId of positiveIds(meta[field])) addEvidence(evidence, cardId, `audit:${event.action}`);
      }
    }
  }

  if (await tableExists(client, "app.transactions")) {
    const transactions = rows(await client.query(`
      select description
      from app.transactions
      where user_id=$1 and created_at < $2::timestamptz
        and coalesce(description,'') ~ 'card:[0-9]+'
    `, [account.user_id, cutoff]));
    for (const transaction of transactions) {
      for (const match of String(transaction.description || "").matchAll(/card:([0-9]+)/g)) {
        addEvidence(evidence, Number(match[1]), "wallet-transaction");
      }
    }
  }

  if (await tableExists(client, "app.card_ownership_snapshot_items")) {
    const snapshots = rows(await client.query(`
      select distinct i.card_id
      from app.card_ownership_snapshot_items i
      join app.card_ownership_snapshot_batches b on b.batch_id=i.batch_id
      where i.user_id=$1 and b.captured_at < $2::timestamptz
    `, [account.user_id, cutoff]));
    for (const snapshot of snapshots) addEvidence(evidence, snapshot.card_id, "ownership-snapshot");
  }
  return evidence;
}

async function historicalLineups(client, account) {
  const cutoff = account.reset_at || account.backup_at;
  const lineups = [];
  const add = (value, source) => {
    const cardIds = positiveIds(value);
    if (cardIds.length === 5) lineups.push({ cardIds, source });
  };

  if (await tableExists(client, "app.competition_entries")) {
    const entries = rows(await client.query(`
      select lineup_card_ids, joined_at
      from app.competition_entries
      where user_id=$1 and joined_at < $2::timestamptz
      order by joined_at, id
    `, [account.user_id, cutoff]));
    for (const entry of entries) add(entry.lineup_card_ids, "competition-entry-lineup");
  }

  if (await tableExists(client, "app.audit_logs")) {
    const audit = rows(await client.query(`
      select action, meta
      from app.audit_logs
      where user_id=$1 and created_at < $2::timestamptz
      order by created_at, id
    `, [account.user_id, cutoff]));
    for (const event of audit) {
      const meta = asObject(event.meta);
      for (const field of ["lineupCardIds", "previousLineupCardIds", "starterCardIds", "cardIds"]) {
        add(meta[field], `audit-lineup:${event.action}:${field}`);
      }
    }
  }

  const unique = new Map();
  for (const lineup of lineups) {
    const key = lineup.cardIds.join(",");
    const existing = unique.get(key);
    if (existing) existing.sources.push(lineup.source);
    else unique.set(key, { cardIds: lineup.cardIds, sources: [lineup.source] });
  }
  return [...unique.values()];
}

function orderedSignupSlots(onboarding, wasReset) {
  const packs = Array.isArray(onboarding.pack_cards)
    ? onboarding.pack_cards.map(positiveIds)
    : [];
  const selected = positiveIds(onboarding.selected_cards);
  if (packs.length !== 5 || packs.some((pack) => !pack.length)) return null;
  if (wasReset) return packs;
  const slots = packs.map((pack) => selected.filter((playerId) => pack.includes(playerId)));
  return slots.every((slot) => slot.length === 1) ? slots : null;
}

function enumerateAssignments(slotCandidates, index = 0, used = new Set(), current = [], output = []) {
  if (output.length > 2000) return output;
  if (index === slotCandidates.length) {
    output.push([...current]);
    return output;
  }
  for (const candidate of slotCandidates[index]) {
    if (used.has(candidate.cardId)) continue;
    used.add(candidate.cardId);
    current.push(candidate);
    enumerateAssignments(slotCandidates, index + 1, used, current, output);
    current.pop();
    used.delete(candidate.cardId);
  }
  return output;
}

function findExactAssignment(slotCandidates) {
  if (slotCandidates.length !== 5 || slotCandidates.some((slot) => !slot.length)) return null;
  const assignments = enumerateAssignments(slotCandidates);
  if (!assignments.length) return null;
  const ranked = assignments.map((cards) => ({
    cards,
    score: cards.reduce((sum, card) => sum + card.proofScore, 0),
    key: cards.map((card) => card.cardId).join(","),
  })).sort((left, right) => right.score - left.score || left.key.localeCompare(right.key));
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) return null;
  return ranked[0];
}

function combinationsOfFive(ids) {
  const values = positiveIds(ids);
  const output = [];
  const walk = (start, current) => {
    if (current.length === 5) {
      output.push([...current]);
      return;
    }
    for (let index = start; index <= values.length - (5 - current.length); index += 1) {
      current.push(values[index]);
      walk(index + 1, current);
      current.pop();
    }
  };
  walk(0, []);
  return output;
}

function bestSlotOrder(cardIds, slots, cardById, playerById) {
  const ids = positiveIds(cardIds);
  if (ids.length !== 5 || slots.length !== 5) return null;
  const cards = ids.map((id) => cardById.get(id));
  if (cards.some((card) => !card)) return null;
  const permutations = enumerateAssignments(
    Array.from({ length: 5 }, () => cards.map((card) => ({ cardId: Number(card.id), card }))),
  );
  const ranked = permutations.map((items) => {
    let strongMatches = 0;
    const scores = items.map((item, slotIndex) => {
      const expected = slots[slotIndex].map((id) => playerById.get(id)).filter(Boolean);
      const cardPlayer = { ...item.card, id: Number(item.card.player_id) };
      const score = bestIdentityScore(expected, cardPlayer);
      if (score >= 95) strongMatches += 1;
      return score;
    });
    return {
      cardIds: items.map((item) => item.cardId),
      score: scores.reduce((sum, score) => sum + score, 0),
      strongMatches,
      key: items.map((item) => item.cardId).join(","),
    };
  }).sort((left, right) => (
    right.strongMatches - left.strongMatches
    || right.score - left.score
    || left.key.localeCompare(right.key)
  ));
  if (!ranked.length || ranked[0].strongMatches < 4) return null;
  if (ranked.length > 1
      && ranked[0].strongMatches === ranked[1].strongMatches
      && ranked[0].score === ranked[1].score) return null;
  return ranked[0];
}

async function auditAccount(client, account, allPlayers, playerById) {
  const onboarding = asObject(account.onboarding);
  const backupCards = Array.isArray(account.owned_cards) ? account.owned_cards : [];
  const backupIds = new Set(positiveIds(backupCards.map((card) => card?.id)));
  const slots = orderedSignupSlots(onboarding, account.was_reset);
  const createdAtMs = new Date(account.user_created_at).getTime();
  const windowStart = new Date(createdAtMs - SIGNUP_WINDOW_BEFORE_MS);
  const windowEnd = new Date(createdAtMs + SIGNUP_WINDOW_AFTER_MS);
  const evidence = await historicalEvidence(client, account);
  const priorLineups = await historicalLineups(client, account);
  const backupLineup = positiveIds(asObject(account.lineup).card_ids);

  const currentCards = rows(await client.query(`
    select pc.id, pc.player_id, pc.owner_id, pc.rarity::text as rarity, pc.acquired_at,
           p.name, p.web_name, p.team, p.position::text as position, p.fpl_id, p.code
    from app.player_cards pc
    join app.players p on p.id=pc.player_id
    where pc.owner_id=$1
    order by pc.id
  `, [account.user_id]));
  const currentIds = new Set(currentCards.map((card) => Number(card.id)));
  const addedAfterBackupIds = [...currentIds].filter((cardId) => !backupIds.has(cardId));

  const logInventory = async (reason) => {
    const ids = positiveIds([
      ...backupIds,
      ...currentIds,
      ...priorLineups.flatMap((lineup) => lineup.cardIds),
    ]);
    if (!ids.length) return;
    const inventory = rows(await client.query(`
      select pc.id, pc.player_id, pc.owner_id, pc.rarity::text as rarity,
             pc.serial_id, pc.acquired_at, p.name, p.web_name, p.team,
             p.position::text as position, p.fpl_id, p.code
      from app.player_cards pc
      left join app.players p on p.id=pc.player_id
      where pc.id=any($1::int[])
      order by pc.acquired_at, pc.id
    `, [ids]));
    for (const card of inventory) {
      console.log(
        `ORIGINAL_SIGNUP_INVENTORY email=${account.email} reason=${reason}`
        + ` cardId=${Number(card.id)} playerId=${Number(card.player_id)}`
        + ` player=${JSON.stringify(String(card.name || card.web_name || ""))}`
        + ` team=${JSON.stringify(String(card.team || ""))}`
        + ` position=${String(card.position || "none")} rarity=${String(card.rarity || "none")}`
        + ` serial=${String(card.serial_id || "none")} acquiredAt=${iso(card.acquired_at)}`
        + ` owner=${card.owner_id == null ? "unowned" : String(card.owner_id) === String(account.user_id) ? "owned" : "other"}`,
      );
    }
  };

  if (!slots) {
    console.log(
      `ORIGINAL_SIGNUP_ACCOUNT email=${account.email} status=unresolved reason=invalid-five-pack-selection`
      + ` backupCards=${backupIds.size} currentCards=${currentIds.size}`
      + ` historicalLineups=${priorLineups.map((lineup) => lineup.cardIds.join(",")).join("|") || "none"}`,
    );
    await logInventory("invalid-five-pack-selection");
    return { exact: false, email: account.email };
  }

  const expectedIds = positiveIds(slots.flat());
  const expectedPlayers = expectedIds.map((id) => playerById.get(id)).filter(Boolean);
  const equivalentPlayerIds = allPlayers
    .filter((candidate) => expectedPlayers.some((expected) => identityScore(expected, candidate) >= 95))
    .map((player) => Number(player.id));
  const knownCardIds = positiveIds([
    ...backupIds,
    ...currentIds,
    ...evidence.keys(),
    ...priorLineups.flatMap((lineup) => lineup.cardIds),
  ]);
  const candidateCards = (equivalentPlayerIds.length || knownCardIds.length) ? rows(await client.query(`
    select pc.id, pc.player_id, pc.owner_id, pc.rarity::text as rarity, pc.acquired_at,
           p.name, p.web_name, p.team, p.position::text as position, p.fpl_id, p.code
    from app.player_cards pc
    join app.players p on p.id=pc.player_id
    where (
      pc.player_id=any($1::int[])
      and (
        pc.id=any($2::int[])
        or (pc.acquired_at >= $3::timestamp and pc.acquired_at <= $4::timestamp)
      )
    ) or pc.id=any($2::int[])
    order by pc.acquired_at, pc.id
  `, [equivalentPlayerIds.length ? equivalentPlayerIds : [0], knownCardIds.length ? knownCardIds : [0], windowStart, windowEnd])) : [];

  const cardById = new Map(candidateCards.map((card) => [Number(card.id), card]));
  const validOriginalLineup = (cardIds, requiresHistory) => {
    const ids = positiveIds(cardIds);
    if (ids.length !== 5) return false;
    const cards = ids.map((id) => cardById.get(id));
    if (cards.some((card) => !card || String(card.rarity) !== "common")) return false;
    if (cards.some((card) => card.owner_id != null && String(card.owner_id) !== String(account.user_id))) return false;
    const times = cards.map((card) => new Date(card.acquired_at).getTime());
    if (times.some((time) => !Number.isFinite(time) || time < windowStart.getTime() || time > windowEnd.getTime())) return false;
    if (Math.max(...times) - Math.min(...times) > CLUSTER_MS) return false;
    if (requiresHistory && cards.some((card) => !evidence.has(Number(card.id)))) return false;
    return true;
  };

  const authoritativeLineups = account.was_reset
    ? priorLineups.filter((lineup) => validOriginalLineup(lineup.cardIds, true))
    : [
      ...(validOriginalLineup(backupLineup, false)
        ? [{ cardIds: backupLineup, sources: ["pre-repair-lineup-snapshot"] }]
        : []),
      ...combinationsOfFive([...backupIds])
        .filter((cardIds) => validOriginalLineup(cardIds, false))
        .map((cardIds) => ({ cardIds, sources: ["pre-repair-five-card-signup-cluster"] })),
    ];
  const distinctAuthoritative = new Map();
  for (const lineup of authoritativeLineups) {
    const setKey = [...lineup.cardIds].sort((left, right) => left - right).join(",");
    const ordered = bestSlotOrder(lineup.cardIds, slots, cardById, playerById);
    if (!ordered) continue;
    const existing = distinctAuthoritative.get(setKey);
    if (existing) existing.sources.push(...lineup.sources);
    else distinctAuthoritative.set(setKey, { ...lineup, cardIds: ordered.cardIds, orderScore: ordered.score, strongMatches: ordered.strongMatches });
  }

  const evidenceTimes = candidateCards
    .filter((card) => evidence.has(Number(card.id)))
    .map((card) => new Date(card.acquired_at).getTime())
    .filter(Number.isFinite);
  const inEvidenceCluster = (card) => {
    const time = new Date(card.acquired_at).getTime();
    return evidenceTimes.some((anchor) => Math.abs(time - anchor) <= CLUSTER_MS);
  };

  const slotCandidates = slots.map((slotPlayerIds, slotIndex) => {
    const slotPlayers = slotPlayerIds.map((id) => playerById.get(id)).filter(Boolean);
    return candidateCards.map((card) => {
      const cardId = Number(card.id);
      const playerId = Number(card.player_id);
      const identity = bestIdentityScore(slotPlayers, { ...card, id: playerId });
      const acquiredMs = new Date(card.acquired_at).getTime();
      const inWindow = acquiredMs >= windowStart.getTime() && acquiredMs <= windowEnd.getTime();
      const available = card.owner_id == null || String(card.owner_id) === String(account.user_id);
      const backedUp = backupIds.has(cardId);
      const historicallyProven = evidence.has(cardId);
      const clustered = inEvidenceCluster(card);
      const eligibleProof = account.was_reset
        ? (historicallyProven || clustered)
        : backedUp;
      const positionExpected = slotIndex < 4 ? ["GK", "DEF", "MID", "FWD"][slotIndex] : null;
      const positionMatches = !positionExpected || String(card.position || "") === positionExpected;
      if (identity < 95 || !inWindow || !available || !eligibleProof || !positionMatches || String(card.rarity) !== "common") return null;
      return {
        cardId,
        playerId,
        player: String(card.name || card.web_name || ""),
        position: String(card.position || ""),
        acquiredAt: iso(card.acquired_at),
        owner: card.owner_id == null ? "unowned" : "owned",
        identity,
        backedUp,
        historicallyProven,
        clustered,
        sources: [...(evidence.get(cardId) || [])],
        proofScore: identity + (historicallyProven ? 80 : 0) + (backedUp ? 40 : 0) + (clustered ? 25 : 0) + (card.owner_id ? 10 : 0),
      };
    }).filter(Boolean).sort((left, right) => right.proofScore - left.proofScore || left.cardId - right.cardId);
  });

  let assignment = findExactAssignment(slotCandidates);
  let authority = "identity-plus-signup-cluster";
  if (distinctAuthoritative.size) {
    const rankedAuthority = [...distinctAuthoritative.values()].sort((left, right) => (
      right.strongMatches - left.strongMatches
      || right.orderScore - left.orderScore
      || left.cardIds.join(",").localeCompare(right.cardIds.join(","))
    ));
    const exactLineup = rankedAuthority[0];
    const runnerUp = rankedAuthority[1];
    const uniqueAuthority = !runnerUp
      || exactLineup.strongMatches > runnerUp.strongMatches
      || exactLineup.orderScore > runnerUp.orderScore;
    if (uniqueAuthority) {
    assignment = {
      cards: exactLineup.cardIds.map((cardId) => {
        const card = cardById.get(cardId);
        return {
          cardId,
          playerId: Number(card?.player_id || 0),
          player: String(card?.name || card?.web_name || ""),
          acquiredAt: iso(card?.acquired_at),
        };
      }),
      score: Number.MAX_SAFE_INTEGER,
    };
    authority = exactLineup.sources.join("+");
    }
  }
  const status = assignment ? "exact" : "unresolved";
  console.log(
    `ORIGINAL_SIGNUP_ACCOUNT email=${account.email} status=${status}`
    + ` reset=${account.was_reset} createdAt=${iso(account.user_created_at)}`
    + ` backupAt=${iso(account.backup_at)} backupCards=${backupIds.size}`
    + ` currentCards=${currentIds.size} addedAfterBackup=${addedAfterBackupIds.join(",") || "none"}`
    + ` evidenceCards=${[...evidence.keys()].join(",") || "none"}`
    + ` backupLineup=${backupLineup.join(",") || "none"}`
    + ` historicalLineups=${priorLineups.map((lineup) => lineup.cardIds.join(",")).join("|") || "none"}`,
  );

  slotCandidates.forEach((candidates, index) => {
    const expected = slots[index].map((id) => {
      const player = playerById.get(id);
      return `${id}:${String(player?.name || player?.web_name || "missing").replace(/\s+/g, "_")}`;
    }).join("|");
    const rendered = candidates.map((card) => (
      `${card.cardId}:${card.playerId}:${card.player.replace(/\s+/g, "_")}:${card.acquiredAt}`
      + `:${card.owner}:backup=${card.backedUp}:history=${card.historicallyProven}:cluster=${card.clustered}`
    )).join("|") || "none";
    console.log(`ORIGINAL_SIGNUP_SLOT email=${account.email} pack=${index + 1} expected=${expected} candidates=${rendered}`);
  });

  if (!assignment) {
    await logInventory("no-unique-five-card-proof");
    console.log(`ORIGINAL_SIGNUP_UNRESOLVED email=${account.email} reason=no-unique-five-card-proof currentIds=${[...currentIds].join(",") || "none"}`);
    return { exact: false, email: account.email };
  }

  const keepIds = assignment.cards.map((card) => card.cardId);
  const extraIds = [...currentIds].filter((cardId) => !keepIds.includes(cardId));
  console.log(
    `ORIGINAL_SIGNUP_EXACT email=${account.email}`
    + ` keepCardIds=${keepIds.join(",")}`
    + ` keepPlayerIds=${assignment.cards.map((card) => card.playerId).join(",")}`
    + ` extraCurrentCardIds=${extraIds.join(",") || "none"}`
    + ` repairAddedCardIds=${addedAfterBackupIds.join(",") || "none"}`
    + ` signupPlayerIds=${slots.map((slot) => slot.length === 1 ? slot[0] : "unknown").join(",")}`
    + ` authority=${authority}`,
  );
  return { exact: true, email: account.email, keepIds, extraIds };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query("begin transaction read only");
    if (!(await tableExists(client, "app.starter_selection_restoration_backups"))) {
      console.log(`ORIGINAL_SIGNUP_SUMMARY repairKey=${REPAIR_KEY} accounts=0 exact=0 unresolved=0 reason=backup-table-missing`);
      await client.query("rollback");
      return;
    }

    const allPlayers = rows(await client.query(`
      select id, name, web_name, team, position::text as position, fpl_id, code
      from app.players
      order by id
    `));
    const playerById = new Map(allPlayers.map((player) => [Number(player.id), player]));
    const accounts = rows(await client.query(`
      select b.user_id::text, lower(coalesce(b.email,u.email,'')) as email,
             b.onboarding, b.lineup, b.owned_cards, b.created_at as backup_at,
             u.created_at as user_created_at,
             exists (
               select 1 from app.audit_logs al
               where al.user_id=b.user_id and al.action=$2
                 and al.created_at < b.created_at
             ) as was_reset,
             (
               select max(al.created_at) from app.audit_logs al
               where al.user_id=b.user_id and al.action=$2
                 and al.created_at < b.created_at
             ) as reset_at
      from app.starter_selection_restoration_backups b
      join app.users u on u.id=b.user_id
      where b.repair_key=$1
      order by lower(coalesce(b.email,u.email,''))
    `, [REPAIR_KEY, RESET_ACTION]));

    let exact = 0;
    const unresolvedEmails = [];
    for (const account of accounts) {
      const result = await auditAccount(client, account, allPlayers, playerById);
      if (result.exact) exact += 1;
      else unresolvedEmails.push(result.email);
    }
    console.log(
      `ORIGINAL_SIGNUP_SUMMARY repairKey=${REPAIR_KEY} accounts=${accounts.length}`
      + ` exact=${exact} unresolved=${unresolvedEmails.length}`
      + ` unresolvedEmails=${unresolvedEmails.join(",") || "none"}`
      + ` mode=read-only actions=${REPAIR_ACTIONS.join(",")}`,
    );
    await client.query("rollback");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`ORIGINAL_SIGNUP_FAILED ${error?.stack || error}`);
  process.exit(1);
});
