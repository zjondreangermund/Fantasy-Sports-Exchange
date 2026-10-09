import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { fplApi } from "./fplApi.js";
import {
  apiFootballSeasonNow,
  loadApiFootballPlayerDirectory,
  resolveApiFootballPlayer,
} from "./apiFootballPlayerDirectory.js";
import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";
import { ensurePlayerTransferMonitoringSchema } from "./playerTransferMonitoring.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isLoanType(value: unknown) {
  return /\bloan\b/i.test(String(value || ""));
}

function seasonStartYear() {
  const now = new Date();
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

let schemaPromise: Promise<void> | null = null;

export async function ensureRealLifeLoanPolicySchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await Promise.all([ensureNotificationsSchema(), ensurePlayerTransferMonitoringSchema()]);
      await db.execute(sql`
        alter table app.player_replacement_claims
          add column if not exists decision text not null default 'pending',
          add column if not exists departure_kind text not null default 'permanent',
          add column if not exists real_life_loan_transfer_key text,
          add column if not exists real_life_loan_from_team text,
          add column if not exists real_life_loan_to_team text,
          add column if not exists real_life_loan_evidence text
      `);
      await db.execute(sql`
        create table if not exists app.real_life_player_loans (
          id bigserial primary key,
          app_player_id integer not null references app.players(id),
          api_player_id integer,
          transfer_key text not null unique,
          transfer_date date,
          from_team_id integer,
          to_team_id integer,
          from_team text,
          to_team text,
          transfer_type text,
          evidence_source text not null,
          active boolean not null default true,
          detected_at timestamptz not null default now(),
          returned_at timestamptz
        )
      `);
      await db.execute(sql`
        create index if not exists real_life_player_loans_active_idx
        on app.real_life_player_loans (app_player_id, active, detected_at desc)
      `);
      await db.execute(sql`
        create index if not exists player_replacement_claims_departure_kind_idx
        on app.player_replacement_claims (user_id, departure_kind, decision, created_at desc)
      `);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function providerTransferTableExists() {
  const row = rowsOf(await db.execute(sql`
    select to_regclass('app.api_football_transfers') as name,
           to_regclass('app.api_football_fixtures') as fixtures
  `))[0];
  return Boolean(row?.name && row?.fixtures);
}

async function currentPremierLeagueTeamIds(season: number) {
  const result = rowsOf(await db.execute(sql`
    select distinct team_id as "teamId"
    from (
      select home_team_id as team_id from app.api_football_fixtures where season=${season}
      union
      select away_team_id as team_id from app.api_football_fixtures where season=${season}
    ) teams
    where team_id is not null and team_id > 0
  `));
  return new Set(result.map((row) => Number(row.teamId)).filter((id) => id > 0));
}

async function ownedPlayerCandidates() {
  return rowsOf(await db.execute(sql`
    select distinct p.id, p.name, p.web_name as "webName", p.team,
           p.position::text as position, p.league, p.status, p.fpl_id as "fplId", p.code
    from app.players p
    join app.player_cards pc on pc.player_id=p.id
    where pc.owner_id is not null
      and lower(coalesce(p.league,'')) in ('premier league','outside premier league')
    order by p.id
  `));
}

function resolveAppPlayerByTransfer(candidates: any[], transfer: any) {
  const transferName = normalizeText(transfer.playerName);
  if (!transferName) return null;
  const exact = candidates.filter((candidate) => {
    const names = [candidate.name, candidate.webName].map(normalizeText).filter(Boolean);
    return names.includes(transferName);
  });
  if (exact.length === 1) return exact[0];

  const fromTeam = normalizeText(transfer.fromTeam);
  if (exact.length > 1 && fromTeam) {
    const teamMatch = exact.find((candidate) => normalizeText(candidate.team) === fromTeam);
    if (teamMatch) return teamMatch;
  }

  const loose = candidates.filter((candidate) => {
    const candidateName = normalizeText(candidate.name);
    return candidateName && (
      candidateName === transferName
      || candidateName.endsWith(` ${transferName}`)
      || transferName.endsWith(` ${candidateName}`)
    );
  });
  if (loose.length === 1) return loose[0];
  return null;
}

async function activePlatformLoanCardIds(playerId: number) {
  const rows = rowsOf(await db.execute(sql`
    select l.card_id as "cardId"
    from app.card_loans l
    join app.player_cards pc on pc.id=l.card_id
    where pc.player_id=${playerId}
      and l.status='active'
  `));
  return new Set(rows.map((row) => Number(row.cardId)).filter(Boolean));
}

async function upsertRealLifeLoanClaims(input: {
  player: any;
  apiPlayerId: number | null;
  transferKey: string;
  transferDate: string | null;
  fromTeamId: number | null;
  toTeamId: number | null;
  fromTeam: string;
  toTeam: string;
  transferType: string;
  evidenceSource: string;
  userId?: string;
}) {
  const playerId = Number(input.player.id || 0);
  if (!playerId) return { claims: 0, deferredPlatformLoans: 0 };

  const loanRow = rowsOf(await db.execute(sql`
    insert into app.real_life_player_loans (
      app_player_id, api_player_id, transfer_key, transfer_date,
      from_team_id, to_team_id, from_team, to_team, transfer_type,
      evidence_source, active, detected_at, returned_at
    ) values (
      ${playerId}, ${input.apiPlayerId || null}, ${input.transferKey},
      ${input.transferDate || null}::date, ${input.fromTeamId || null}, ${input.toTeamId || null},
      ${input.fromTeam || null}, ${input.toTeam || null}, ${input.transferType || "Loan"},
      ${input.evidenceSource}, true, now(), null
    )
    on conflict (transfer_key) do update set
      from_team=excluded.from_team,
      to_team=excluded.to_team,
      transfer_type=excluded.transfer_type,
      evidence_source=excluded.evidence_source,
      active=true,
      returned_at=null
    returning id
  `))[0];

  if (!loanRow?.id) return { claims: 0, deferredPlatformLoans: 0 };

  await db.execute(sql`
    update app.players
    set league='Outside Premier League',
        status='loaned_out',
        news=${`${String(input.player.name || "Player")} is on loan outside the Premier League${input.toTeam ? ` at ${input.toTeam}` : ""}. Fantasy Arena card owners may keep the card until the player returns or mint a same-position, same-rarity replacement.`},
        synced_at=now()
    where id=${playerId}
  `);

  await db.execute(sql`
    update app.player_cards
    set for_sale=false, price=0
    where player_id=${playerId}
  `);

  const activePlatformCards = await activePlatformLoanCardIds(playerId);
  const cards = rowsOf(await db.execute(sql`
    select pc.id, pc.owner_id as "ownerId", pc.rarity::text as rarity,
           p.position::text as position, p.name as "playerName"
    from app.player_cards pc
    join app.players p on p.id=pc.player_id
    where pc.player_id=${playerId}
      and pc.owner_id is not null
      and (${input.userId || null}::text is null or pc.owner_id=${input.userId || null})
    order by pc.id
  `));

  let claims = 0;
  let deferredPlatformLoans = 0;
  for (const card of cards) {
    const sourceCardId = Number(card.id || 0);
    const ownerId = String(card.ownerId || "");
    if (!sourceCardId || !ownerId) continue;
    if (activePlatformCards.has(sourceCardId)) {
      deferredPlatformLoans += 1;
      continue;
    }

    const existing = rowsOf(await db.execute(sql`
      select id, replacement_card_id as "replacementCardId", departure_kind as "departureKind", decision
      from app.player_replacement_claims
      where source_card_id=${sourceCardId}
      limit 1
    `))[0];

    let claim: any = existing;
    if (!existing) {
      claim = rowsOf(await db.execute(sql`
        insert into app.player_replacement_claims (
          user_id, source_card_id, source_player_id, source_player_name, rarity,
          transfer_event_id, decision, departure_kind, real_life_loan_transfer_key,
          real_life_loan_from_team, real_life_loan_to_team, real_life_loan_evidence, created_at
        ) values (
          ${ownerId}, ${sourceCardId}, ${playerId}, ${String(card.playerName || input.player.name || "Player")},
          ${String(card.rarity || "common")}, null, 'pending', 'real_life_loan', ${input.transferKey},
          ${input.fromTeam || null}, ${input.toTeam || null}, ${input.evidenceSource}, now()
        )
        returning id, replacement_card_id as "replacementCardId", departure_kind as "departureKind", decision
      `))[0];
    } else if (!existing.replacementCardId) {
      claim = rowsOf(await db.execute(sql`
        update app.player_replacement_claims
        set user_id=${ownerId},
            source_player_id=${playerId},
            source_player_name=${String(card.playerName || input.player.name || "Player")},
            rarity=${String(card.rarity || "common")},
            departure_kind='real_life_loan',
            decision='pending',
            claimed_at=null,
            real_life_loan_transfer_key=${input.transferKey},
            real_life_loan_from_team=${input.fromTeam || null},
            real_life_loan_to_team=${input.toTeam || null},
            real_life_loan_evidence=${input.evidenceSource}
        where id=${Number(existing.id)}
        returning id, replacement_card_id as "replacementCardId", departure_kind as "departureKind", decision
      `))[0];
    }

    if (!claim?.id || claim.replacementCardId) continue;
    const claimId = Number(claim.id);
    await db.execute(sql`
      delete from app.notifications
      where user_id=${ownerId}
        and dedupe_key in (
          ${`replacement-claim:${claimId}`},
          ${`replacement-reminder:${claimId}`}
        )
    `);

    const prettyRarity = String(card.rarity || "common").replace(/^./, (ch) => ch.toUpperCase());
    const position = String(card.position || "same-position").toUpperCase();
    await createNotificationOnce(db, {
      userId: ownerId,
      title: `${String(card.playerName || input.player.name || "Your player")} has gone out on loan`,
      message: `${String(card.playerName || input.player.name || "Your player")} has moved on loan outside the Premier League${input.toTeam ? ` to ${input.toTeam}` : ""}. Your ${prettyRarity} ${position} card cannot be used for new Premier League entries while the player is away. Choose Keep until return to preserve this exact card, or mint one current Premier League ${position} card of the same ${prettyRarity} rarity. If you mint a replacement, the original card is permanently retired and will not reactivate when the player returns.`,
      dedupeKey: `replacement-claim:${claimId}`,
    });
    claims += 1;
  }

  return { claims, deferredPlatformLoans };
}

async function currentRosterEvidence(candidates: any[]) {
  const [bootstrap, apiDirectory] = await Promise.all([
    fplApi.bootstrap().catch(() => null),
    loadApiFootballPlayerDirectory(apiFootballSeasonNow()).catch(() => []),
  ]);
  const elements = Array.isArray((bootstrap as any)?.elements) ? (bootstrap as any).elements : [];
  const fplIds = new Set(elements.map((row: any) => Number(row?.id || 0)).filter(Boolean));
  const fplCodes = new Set(elements.map((row: any) => Number(row?.code || 0)).filter(Boolean));

  const currentByPlayerId = new Map<number, { current: boolean; team: string | null }>();
  for (const candidate of candidates) {
    const directFpl = fplIds.has(Number(candidate.fplId || 0)) || fplCodes.has(Number(candidate.code || 0));
    const apiPlayer = resolveApiFootballPlayer(candidate, apiDirectory as any[]);
    currentByPlayerId.set(Number(candidate.id), {
      current: Boolean(directFpl || apiPlayer),
      team: apiPlayer?.team ? String(apiPlayer.team) : null,
    });
  }
  return { currentByPlayerId, apiDirectory, fplHealthy: elements.length >= 300 };
}

async function fetchTrustedLoanNews() {
  try {
    const response = await fetch("https://www.theguardian.com/football/premierleague/rss", {
      headers: { Accept: "application/rss+xml,text/xml", "User-Agent": "FantasyArena/1.0" },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return [];
    const xml = await response.text();
    return [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)]
      .slice(0, 40)
      .map((match) => {
        const item = match[0];
        const title = String(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "")
          .replace(/<!\[CDATA\[|\]\]>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&#39;|&apos;/g, "'")
          .replace(/&quot;/g, '"')
          .trim();
        const publishedAt = String(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
        return { title, publishedAt };
      })
      .filter((item) => item.title);
  } catch {
    return [];
  }
}

function strongConfirmedLoanHeadline(title: string, player: any) {
  const normalized = normalizeText(title);
  const names = [player.name, player.webName].map(normalizeText).filter((name) => name.length >= 5);
  if (!names.some((name) => normalized.includes(name))) return false;
  const strongLoan = /\b(join(?:s|ed)? .* on loan|loaned to|completes? .* loan|signs? .* on loan|loan move to)\b/i.test(title);
  const speculative = /\b(could|may|might|consider|considering|target|targets|set to|close to|talks|interest|interested|expected|hope|wants?)\b/i.test(title);
  return strongLoan && !speculative;
}

async function processTrustedNewsFallback(candidates: any[], currentByPlayerId: Map<number, { current: boolean; team: string | null }>, userId?: string) {
  const headlines = await fetchTrustedLoanNews();
  if (!headlines.length) return { claims: 0, signals: 0 };
  let claims = 0;
  let signals = 0;
  for (const player of candidates) {
    const evidence = currentByPlayerId.get(Number(player.id));
    if (evidence?.current) continue;
    const headline = headlines.find((item) => strongConfirmedLoanHeadline(item.title, player));
    if (!headline) continue;

    const date = new Date(headline.publishedAt || Date.now());
    const dateText = Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const transferKey = `trusted-news-loan:${seasonStartYear()}:${Number(player.id)}:${normalizeText(headline.title).slice(0, 80)}`;
    const result = await upsertRealLifeLoanClaims({
      player,
      apiPlayerId: null,
      transferKey,
      transferDate: dateText,
      fromTeamId: null,
      toTeamId: null,
      fromTeam: String(player.team || "Premier League club"),
      toTeam: "Club outside Premier League",
      transferType: "Loan",
      evidenceSource: "guardian_transfer_news+dual_roster_absence",
      userId,
    });
    claims += result.claims;
    signals += 1;
  }
  return { claims, signals };
}

async function reconcileReturnedLoans(candidates: any[], currentByPlayerId: Map<number, { current: boolean; team: string | null }>) {
  const activeLoans = rowsOf(await db.execute(sql`
    select id, app_player_id as "appPlayerId", api_player_id as "apiPlayerId",
           transfer_key as "transferKey", transfer_date as "transferDate",
           from_team_id as "fromTeamId", to_team_id as "toTeamId", to_team as "loanTeam"
    from app.real_life_player_loans
    where active=true
    order by detected_at
  `));
  let returned = 0;

  for (const loan of activeLoans) {
    const playerId = Number(loan.appPlayerId || 0);
    const player = candidates.find((candidate) => Number(candidate.id) === playerId);
    if (!player) continue;
    const roster = currentByPlayerId.get(playerId);
    if (!roster?.current) continue;

    // API-Football transfer evidence outranks a lagging FPL/current-squad row.
    // An API-backed loan remains active until a newer transfer explicitly brings
    // the player back to a current Premier League club.
    if (String(loan.transferKey || "").startsWith("api-football-loan:") && Number(loan.apiPlayerId || 0) > 0) {
      const season = seasonStartYear();
      const plTeams = await currentPremierLeagueTeamIds(season);
      const newer = rowsOf(await db.execute(sql`
        select transfer_date::text as "transferDate", from_team_id as "fromTeamId",
               to_team_id as "toTeamId", transfer_type as "transferType", updated_at as "updatedAt"
        from app.api_football_transfers
        where api_player_id=${Number(loan.apiPlayerId)}
          and (
            transfer_date > ${String(loan.transferDate || "") || null}::date
            or (
              transfer_date = ${String(loan.transferDate || "") || null}::date
              and (from_team_id <> ${Number(loan.fromTeamId || 0)} or to_team_id <> ${Number(loan.toTeamId || 0)})
            )
          )
        order by transfer_date desc, updated_at desc
        limit 1
      `))[0];
      if (!newer) continue;
      if (!plTeams.has(Number(newer.toTeamId || 0))) continue;
    }

    const returnTeam = String(roster.team || player.team || "Premier League club");
    await db.transaction(async (tx: any) => {
      await tx.execute(sql`
        update app.real_life_player_loans
        set active=false, returned_at=now()
        where id=${Number(loan.id)} and active=true
      `);
      await tx.execute(sql`
        update app.players
        set league='Premier League', status='a', team=${returnTeam},
            news=${`${String(player.name || "Player")} has returned to the Premier League after a real-life loan.`},
            synced_at=now()
        where id=${playerId}
      `);

      const claims = rowsOf(await tx.execute(sql`
        select id, user_id as "userId", source_card_id as "sourceCardId",
               source_player_name as "sourcePlayerName", decision,
               replacement_card_id as "replacementCardId"
        from app.player_replacement_claims
        where departure_kind='real_life_loan'
          and real_life_loan_transfer_key=${String(loan.transferKey)}
      `));

      for (const claim of claims) {
        const claimId = Number(claim.id || 0);
        const ownerId = String(claim.userId || "");
        if (!claimId || !ownerId) continue;

        if (!claim.replacementCardId) {
          await tx.execute(sql`
            delete from app.notifications
            where user_id=${ownerId}
              and dedupe_key in (
                ${`replacement-claim:${claimId}`},
                ${`replacement-reminder:${claimId}`}
              )
          `);
          await tx.execute(sql`
            delete from app.player_replacement_claims
            where id=${claimId} and replacement_card_id is null
          `);
          await createNotificationOnce(tx, {
            userId: ownerId,
            title: `${String(claim.sourcePlayerName || player.name || "Your player")} is back in the Premier League`,
            message: `${String(claim.sourcePlayerName || player.name || "Your player")} has returned to ${returnTeam}. Because you kept the original card, it is eligible for new Premier League entries again.`,
            dedupeKey: `real-life-loan-return:${String(loan.transferKey)}:${Number(claim.sourceCardId || 0)}`,
          });
        } else {
          await createNotificationOnce(tx, {
            userId: ownerId,
            title: `${String(claim.sourcePlayerName || player.name || "Your former player")} has returned`,
            message: `${String(claim.sourcePlayerName || player.name || "The player")} has returned to the Premier League. You previously chose a replacement, so your replacement card remains yours and the retired original card is not restored.`,
            dedupeKey: `real-life-loan-return-replaced:${String(loan.transferKey)}:${claimId}`,
          });
        }
      }
    });
    returned += 1;
  }
  return returned;
}

export async function syncRealLifePlayerLoanChoices(userId?: string) {
  await ensureRealLifeLoanPolicySchema();
  const candidates = await ownedPlayerCandidates();
  if (!candidates.length) return { apiLoanSignals: 0, newsLoanSignals: 0, claims: 0, returned: 0, deferredPlatformLoans: 0 };

  const rosterEvidence = await currentRosterEvidence(candidates);
  const returned = await reconcileReturnedLoans(candidates, rosterEvidence.currentByPlayerId);

  let apiLoanSignals = 0;
  let claims = 0;
  let deferredPlatformLoans = 0;

  if (await providerTransferTableExists()) {
    const season = seasonStartYear();
    const plTeams = await currentPremierLeagueTeamIds(season);
    if (plTeams.size >= 18) {
      const latestTransfers = rowsOf(await db.execute(sql`
        select distinct on (tr.api_player_id)
          tr.api_player_id as "apiPlayerId",
          tr.transfer_date::text as "transferDate",
          tr.from_team_id as "fromTeamId",
          tr.to_team_id as "toTeamId",
          tr.player_name as "playerName",
          tr.transfer_type as "transferType",
          coalesce(tr.raw #>> '{transfer,teams,out,name}','') as "fromTeam",
          coalesce(tr.raw #>> '{transfer,teams,in,name}','') as "toTeam",
          tr.updated_at as "updatedAt"
        from app.api_football_transfers tr
        where tr.transfer_date >= make_date(${season}, 6, 1)
        order by tr.api_player_id, tr.transfer_date desc, tr.updated_at desc, tr.from_team_id desc, tr.to_team_id desc
      `));

      for (const transfer of latestTransfers) {
        const fromTeamId = Number(transfer.fromTeamId || 0);
        const toTeamId = Number(transfer.toTeamId || 0);
        const realLoanOut = isLoanType(transfer.transferType) && plTeams.has(fromTeamId) && !plTeams.has(toTeamId);
        if (!realLoanOut) continue;

        const player = resolveAppPlayerByTransfer(candidates, transfer);
        if (!player) continue;

        const transferKey = `api-football-loan:${Number(transfer.apiPlayerId)}:${String(transfer.transferDate)}:${fromTeamId}:${toTeamId}`;
        const result = await upsertRealLifeLoanClaims({
          player,
          apiPlayerId: Number(transfer.apiPlayerId || 0) || null,
          transferKey,
          transferDate: String(transfer.transferDate || ""),
          fromTeamId: fromTeamId || null,
          toTeamId: toTeamId || null,
          fromTeam: String(transfer.fromTeam || player.team || "Premier League club"),
          toTeam: String(transfer.toTeam || "Club outside Premier League"),
          transferType: String(transfer.transferType || "Loan"),
          evidenceSource: "api-football-transfer",
          userId,
        });
        apiLoanSignals += 1;
        claims += result.claims;
        deferredPlatformLoans += result.deferredPlatformLoans;
      }
    }
  }

  const news = await processTrustedNewsFallback(candidates, rosterEvidence.currentByPlayerId, userId);
  claims += news.claims;

  return {
    apiLoanSignals,
    newsLoanSignals: news.signals,
    claims,
    returned,
    deferredPlatformLoans,
  };
}

export async function keepRealLifeLoanCard(userId: string, claimId: number) {
  await ensureRealLifeLoanPolicySchema();
  const claim = rowsOf(await db.execute(sql`
    select id, source_card_id as "sourceCardId", source_player_name as "sourcePlayerName",
           replacement_card_id as "replacementCardId", departure_kind as "departureKind", decision,
           real_life_loan_to_team as "loanToTeam"
    from app.player_replacement_claims
    where id=${claimId} and user_id=${userId}
    limit 1
  `))[0];
  if (!claim?.id) throw new Error("Replacement choice not found");
  if (String(claim.departureKind || "") !== "real_life_loan") {
    throw new Error("Keep until return is only available when the football player left the Premier League on a real-life loan");
  }
  if (claim.replacementCardId) throw new Error("A replacement has already been minted for this card");
  if (String(claim.decision || "") === "replace") throw new Error("A replacement has already been selected for this card");

  await db.execute(sql`
    update app.player_replacement_claims
    set decision='keep', claimed_at=now()
    where id=${claimId} and user_id=${userId}
  `);
  await db.execute(sql`
    update app.player_cards
    set for_sale=false, price=0
    where id=${Number(claim.sourceCardId)}
  `);
  await db.execute(sql`
    update app.notifications
    set read=true
    where user_id=${userId} and dedupe_key=${`replacement-claim:${claimId}`}
  `);
  await createNotificationOnce(db, {
    userId,
    title: "Original card kept",
    message: `You chose to keep ${String(claim.sourcePlayerName || "this player")}${claim.loanToTeam ? ` while the player is on loan at ${String(claim.loanToTeam)}` : " while the player is away on loan"}. The card stays in your Collection but cannot enter new Premier League tournaments until the player returns.`,
    dedupeKey: `real-life-loan-kept:${claimId}`,
  });
  return { kept: true, sourceCardId: Number(claim.sourceCardId), decision: "keep" };
}

export async function assertRealLifeLoanReplacementAllowed(userId: string, claimId: number) {
  await ensureRealLifeLoanPolicySchema();
  const claim = rowsOf(await db.execute(sql`
    select departure_kind as "departureKind", decision, replacement_card_id as "replacementCardId"
    from app.player_replacement_claims
    where id=${claimId} and user_id=${userId}
    limit 1
  `))[0];
  if (!claim) return;
  if (String(claim.departureKind || "") !== "real_life_loan") return;
  if (claim.replacementCardId || String(claim.decision || "") === "replace") return;
  if (String(claim.decision || "") === "keep") {
    throw new Error("You already chose to keep this card until the football player returns to the Premier League");
  }
}

export async function disablePlatformLoanDepartureChoiceSync() {
  return { notified: 0, reason: "Real-life player loans are handled independently from Fantasy Arena card loans." };
}
