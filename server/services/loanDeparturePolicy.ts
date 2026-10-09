import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { fplApi } from "./fplApi.js";
import { ensureLoanPaymentSchema } from "./loanPaymentSchema.js";
import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";

const SUPPLY_BY_RARITY: Record<string, number> = {
  common: 1000,
  rare: 100,
  unique: 10,
  epic: 3,
  legendary: 1,
};

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function isCurrentPremierLeaguePlayer(league: unknown, status: unknown) {
  return String(league || "").trim().toLowerCase() === "premier league"
    && String(status || "").trim().toLowerCase() !== "departed";
}

let ready: Promise<void> | null = null;

export async function ensureLoanDeparturePolicySchema() {
  if (!ready) {
    ready = (async () => {
      await Promise.all([ensureLoanPaymentSchema(), ensureNotificationsSchema()]);
      await db.execute(sql`
        alter table app.card_loans
          add column if not exists departure_decision text,
          add column if not exists departure_decided_at timestamp,
          add column if not exists departure_notified_at timestamp,
          add column if not exists departure_replacement_card_id integer references app.player_cards(id),
          add column if not exists departure_source_returned_at timestamp,
          add column if not exists departure_return_notified_at timestamp
      `);
      await db.execute(sql`
        create index if not exists card_loans_departure_choice_idx
        on app.card_loans (borrower_user_id, status, departure_decision, departure_replacement_card_id)
      `);
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

async function activeLockCardIds(executor: any, cardIds: number[]) {
  const ids = cardIds.filter((value) => Number.isInteger(value) && value > 0);
  if (!ids.length) return new Set<number>();
  const literal = `{${ids.join(",")}}`;
  const result = rowsOf(await executor.execute(sql`
    select distinct cl.card_id as "cardId"
    from app.card_locks cl
    where cl.card_id = any(${literal}::int[])
      and (cl.expires_at is null or cl.expires_at > now())
      and not (
        cl.reason::text = 'competition'
        and coalesce(cl.ref_id,'') ~ '^[0-9]+$'
        and (
          not exists (select 1 from app.competitions c where c.id=cl.ref_id::int)
          or exists (
            select 1 from app.competitions c
            where c.id=cl.ref_id::int
              and lower(c.status::text) in ('completed','cancelled')
          )
        )
      )
  `));
  return new Set(result.map((row) => Number(row.cardId)).filter(Boolean));
}

async function removeCardFromBorrowerLineups(executor: any, borrowerUserId: string, cardId: number) {
  await executor.execute(sql`
    update app.lineups
    set card_ids = coalesce((
      select jsonb_agg(value::int)
      from jsonb_array_elements_text(card_ids) as value
      where value::int <> ${cardId}
    ), '[]'::jsonb)
    where user_id = ${borrowerUserId}
  `);
}

async function clearUnmintedOwnedReplacementClaim(executor: any, sourceCardId: number, borrowerUserId: string) {
  const table = rowsOf(await executor.execute(sql`select to_regclass('app.player_replacement_claims') as name`))[0];
  if (!table?.name) return;

  const staleClaims = rowsOf(await executor.execute(sql`
    select id
    from app.player_replacement_claims
    where source_card_id=${sourceCardId}
      and user_id=${borrowerUserId}
      and replacement_card_id is null
  `));
  for (const claim of staleClaims) {
    const claimId = Number(claim.id || 0);
    if (!claimId) continue;
    await executor.execute(sql`
      delete from app.notifications
      where user_id=${borrowerUserId}
        and dedupe_key in (
          ${`replacement-claim:${claimId}`},
          ${`replacement-reminder:${claimId}`}
        )
    `);
  }
  await executor.execute(sql`
    delete from app.player_replacement_claims
    where source_card_id=${sourceCardId}
      and user_id=${borrowerUserId}
      and replacement_card_id is null
  `);
}

async function returnSourceToLenderIfUnlocked(executor: any, loan: any) {
  const sourceCardId = Number(loan.cardId ?? loan.card_id ?? 0);
  const borrowerUserId = String(loan.borrowerUserId ?? loan.borrower_user_id ?? "");
  const originalOwnerId = String(loan.originalOwnerId ?? loan.original_owner_id ?? "");
  if (!sourceCardId || !borrowerUserId || !originalOwnerId) return false;

  const locked = await activeLockCardIds(executor, [sourceCardId]);
  if (locked.has(sourceCardId)) return false;

  await removeCardFromBorrowerLineups(executor, borrowerUserId, sourceCardId);
  await executor.execute(sql`
    update app.player_cards
    set owner_id=${originalOwnerId}, for_sale=false, price=0
    where id=${sourceCardId} and owner_id=${borrowerUserId}
  `);
  await executor.execute(sql`
    update app.card_loans
    set departure_source_returned_at=coalesce(departure_source_returned_at, now())
    where id=${Number(loan.id)}
  `);
  return true;
}

async function currentPremierLeagueIds() {
  const bootstrap = await fplApi.bootstrap();
  const ids = (Array.isArray((bootstrap as any)?.elements) ? (bootstrap as any).elements : [])
    .map((player: any) => Number(player?.id || 0))
    .filter((id: number) => Number.isInteger(id) && id > 0);
  if (ids.length < 300) {
    throw new Error("Current Premier League player pool is unavailable. Your loan choice remains open.");
  }
  return ids;
}

async function mintTemporaryLoanReplacement(tx: any, input: {
  borrowerUserId: string;
  sourcePlayerId: number;
  sourcePosition: string;
  rarity: string;
  currentFplIds: number[];
}) {
  const rarity = String(input.rarity || "").toLowerCase();
  const position = String(input.sourcePosition || "").toUpperCase();
  const supplyLimit = SUPPLY_BY_RARITY[rarity];
  if (!supplyLimit) throw new Error("Unsupported loan-card rarity");
  if (!["GK", "DEF", "MID", "FWD"].includes(position)) throw new Error("Loan replacement position could not be verified");

  const fplArray = `{${input.currentFplIds.join(",")}}`;
  const candidates = rowsOf(await tx.execute(sql`
    select p.id, p.name, p.team, p.position::text as position
    from app.players p
    where lower(p.league)='premier league'
      and p.fpl_id is not null
      and p.fpl_id = any(${fplArray}::int[])
      and p.position::text=${position}
      and p.id <> ${input.sourcePlayerId}
      and coalesce(p.status,'a') <> 'departed'
      and not exists (
        select 1 from app.player_cards owned
        where owned.owner_id=${input.borrowerUserId}
          and owned.player_id=p.id
          and owned.rarity::text=${rarity}
      )
      and (
        exists (
          select 1
          from app.player_cards reusable
          where reusable.player_id=p.id
            and reusable.rarity::text=${rarity}
            and reusable.owner_id is null
            and not exists (
              select 1 from app.card_locks cl
              where cl.card_id=reusable.id
                and (cl.expires_at is null or cl.expires_at > now())
            )
        )
        or (
          select count(*)::int from app.player_cards minted
          where minted.player_id=p.id and minted.rarity::text=${rarity}
        ) < ${supplyLimit}
      )
    order by random()
    limit 50
  `));

  const chosen = candidates[0];
  if (!chosen?.id) throw new Error(`No ${rarity} ${position} Premier League replacement is currently available. Your loan choice remains open.`);

  const reusable = rowsOf(await tx.execute(sql`
    select pc.id
    from app.player_cards pc
    where pc.player_id=${Number(chosen.id)}
      and pc.rarity::text=${rarity}
      and pc.owner_id is null
      and not exists (
        select 1 from app.card_locks cl
        where cl.card_id=pc.id
          and (cl.expires_at is null or cl.expires_at > now())
      )
    order by pc.id
    limit 1
    for update skip locked
  `))[0];

  let card: any = null;
  if (reusable?.id) {
    card = rowsOf(await tx.execute(sql`
      update app.player_cards
      set owner_id=${input.borrowerUserId}, for_sale=false, price=0, acquired_at=now()
      where id=${Number(reusable.id)} and owner_id is null
      returning id, rarity::text as rarity, serial_id as "serialId", serial_number as "serialNumber"
    `))[0];
  }

  if (!card?.id) {
    card = rowsOf(await tx.execute(sql`
      insert into app.player_cards (
        player_id, owner_id, rarity, level, xp, decisive_score, last_5_scores, for_sale, price, acquired_at
      ) values (
        ${Number(chosen.id)}, ${input.borrowerUserId}, ${rarity}::public.rarity,
        1, 0, 35, '[0,0,0,0,0]'::jsonb, false, 0, now()
      )
      returning id, rarity::text as rarity, serial_id as "serialId", serial_number as "serialNumber"
    `))[0];
  }

  if (!card?.id) throw new Error("Temporary loan replacement could not be minted");

  return {
    ...card,
    playerId: Number(chosen.id),
    playerName: String(chosen.name || "Premier League player"),
    team: String(chosen.team || "Premier League"),
    position: String(chosen.position || position),
  };
}

export async function syncActiveLoanDepartureChoices(userId?: string) {
  await ensureLoanDeparturePolicySchema();

  const openOutsideLoans = rowsOf(await db.execute(sql`
    select l.id, l.original_owner_id as "originalOwnerId", p.name as "playerName"
    from app.card_loans l
    join app.player_cards pc on pc.id=l.card_id
    join app.players p on p.id=pc.player_id
    where l.status='open'
      and (${userId || null}::text is null or l.original_owner_id=${userId || null})
      and (lower(coalesce(p.league,'')) <> 'premier league' or lower(coalesce(p.status,''))='departed')
    order by l.id
    limit 250
  `));
  for (const loan of openOutsideLoans) {
    await db.execute(sql`
      update app.card_loans set status='cancelled'
      where id=${Number(loan.id)} and status='open'
    `);
    await createNotificationOnce(db, {
      userId: String(loan.originalOwnerId || ""),
      title: "Loan listing cancelled",
      message: `${String(loan.playerName || "Your player")} is no longer in the Premier League, so the open loan listing was cancelled automatically.`,
      dedupeKey: `loan-departure-listing-cancelled:${Number(loan.id)}`,
    });
  }

  const loans = rowsOf(await db.execute(sql`
    select l.id, l.card_id as "cardId", l.original_owner_id as "originalOwnerId",
           l.borrower_user_id as "borrowerUserId", l.expires_at as "expiresAt",
           l.departure_decision as "departureDecision",
           l.departure_replacement_card_id as "departureReplacementCardId",
           l.departure_source_returned_at as "departureSourceReturnedAt",
           l.departure_return_notified_at as "departureReturnNotifiedAt",
           pc.rarity::text as rarity, pc.owner_id as "sourceCurrentOwnerId",
           p.id as "sourcePlayerId", p.name as "sourcePlayerName", p.team as "sourceTeam",
           p.position::text as "sourcePosition", p.league as "sourceLeague", p.status as "sourceStatus"
    from app.card_loans l
    join app.player_cards pc on pc.id=l.card_id
    join app.players p on p.id=pc.player_id
    where l.status='active'
      and l.borrower_user_id is not null
      and (${userId || null}::text is null or l.borrower_user_id=${userId || null} or l.original_owner_id=${userId || null})
    order by l.id
    limit 500
  `));

  let notified = 0;
  let sourceReturns = 0;
  let returnedPlayerNotices = 0;

  for (const loan of loans) {
    const current = isCurrentPremierLeaguePlayer(loan.sourceLeague, loan.sourceStatus);
    const loanId = Number(loan.id || 0);
    const borrowerUserId = String(loan.borrowerUserId || "");
    const sourceCardId = Number(loan.cardId || 0);
    if (!loanId || !borrowerUserId || !sourceCardId) continue;

    if (!current) {
      if (!loan.departureReplacementCardId && !loan.departureDecision) {
        await db.transaction(async (tx: any) => {
          await clearUnmintedOwnedReplacementClaim(tx, sourceCardId, borrowerUserId);
          await tx.execute(sql`
            update app.card_loans
            set departure_notified_at=coalesce(departure_notified_at, now())
            where id=${loanId}
          `);
        });

        await createNotificationOnce(db, {
          userId: borrowerUserId,
          title: `${String(loan.sourcePlayerName || "Your loan player")} left the Premier League`,
          message: `${String(loan.sourcePlayerName || "Your loan player")} is outside the Premier League, so this borrowed ${String(loan.rarity || "card")} ${String(loan.sourcePosition || "").toUpperCase()} card cannot be used in new Premier League entries. Choose: keep the loan card and wait for the player to return, or mint a temporary current Premier League card with the same position and rarity for the remaining loan period. The temporary replacement does not become a permanent card.`,
          dedupeKey: `loan-departure-choice:${loanId}`,
        });
        notified += 1;
      }

      if (String(loan.departureDecision || "") === "replace" && loan.departureReplacementCardId && !loan.departureSourceReturnedAt) {
        const returned = await db.transaction(async (tx: any) => returnSourceToLenderIfUnlocked(tx, loan));
        if (returned) sourceReturns += 1;
      }
      continue;
    }

    if (String(loan.departureDecision || "") === "keep" && !loan.departureReturnNotifiedAt) {
      await createNotificationOnce(db, {
        userId: borrowerUserId,
        title: `${String(loan.sourcePlayerName || "Your loan player")} is back in the Premier League`,
        message: `${String(loan.sourcePlayerName || "Your loan player")} is back in the Premier League. Your loan card is eligible again for new Premier League entries until the loan expires.`,
        dedupeKey: `loan-player-returned:${loanId}`,
      });
      await db.execute(sql`
        update app.card_loans
        set departure_return_notified_at=now()
        where id=${loanId}
      `);
      returnedPlayerNotices += 1;
    }
  }

  return { notified, sourceReturns, returnedPlayerNotices };
}

export async function chooseLoanDepartureAction(userId: string, loanId: number, decision: "keep" | "replace") {
  await ensureLoanDeparturePolicySchema();
  if (!userId || !Number.isInteger(loanId) || loanId <= 0) throw new Error("Valid active loan required");
  if (!["keep", "replace"].includes(decision)) throw new Error("Choose keep or replace");

  const currentFplIds = decision === "replace" ? await currentPremierLeagueIds() : [];

  const result = await db.transaction(async (tx: any) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`loan-departure:${loanId}`}))`);
    const loan = rowsOf(await tx.execute(sql`
      select l.id, l.card_id as "cardId", l.original_owner_id as "originalOwnerId",
             l.borrower_user_id as "borrowerUserId", l.status, l.expires_at as "expiresAt", l.gameweeks,
             l.departure_decision as "departureDecision",
             l.departure_replacement_card_id as "departureReplacementCardId",
             l.departure_source_returned_at as "departureSourceReturnedAt",
             pc.rarity::text as rarity,
             p.id as "sourcePlayerId", p.name as "sourcePlayerName", p.team as "sourceTeam",
             p.position::text as "sourcePosition", p.league as "sourceLeague", p.status as "sourceStatus"
      from app.card_loans l
      join app.player_cards pc on pc.id=l.card_id
      join app.players p on p.id=pc.player_id
      where l.id=${loanId}
      for update of l, pc
    `))[0];

    if (!loan) throw new Error("Loan not found");
    if (String(loan.status || "") !== "active") throw new Error("This loan is no longer active");
    if (String(loan.borrowerUserId || "") !== userId) throw new Error("Only the borrower can choose what happens to this loan card");
    if (isCurrentPremierLeaguePlayer(loan.sourceLeague, loan.sourceStatus)) throw new Error("This player is already back in the Premier League");

    if (loan.departureReplacementCardId) {
      const existing = rowsOf(await tx.execute(sql`
        select pc.id, pc.rarity::text as rarity, pc.serial_id as "serialId", pc.serial_number as "serialNumber",
               p.id as "playerId", p.name as "playerName", p.team, p.position::text as position
        from app.player_cards pc
        join app.players p on p.id=pc.player_id
        where pc.id=${Number(loan.departureReplacementCardId)}
        limit 1
      `))[0];
      return { replayed: true, decision: "replace" as const, loan, card: existing || null, sourceReturned: Boolean(loan.departureSourceReturnedAt) };
    }

    if (String(loan.departureDecision || "") === "keep") {
      if (decision === "replace") throw new Error("You already chose to keep this loan card until the player returns");
      return { replayed: true, decision: "keep" as const, loan, card: null, sourceReturned: false };
    }

    await clearUnmintedOwnedReplacementClaim(tx, Number(loan.cardId), userId);

    if (decision === "keep") {
      await tx.execute(sql`
        update app.card_loans
        set departure_decision='keep', departure_decided_at=now()
        where id=${loanId}
      `);
      await tx.execute(sql`
        update app.notifications
        set read=true
        where user_id=${userId} and dedupe_key=${`loan-departure-choice:${loanId}`}
      `);
      return { replayed: false, decision: "keep" as const, loan, card: null, sourceReturned: false };
    }

    const card = await mintTemporaryLoanReplacement(tx, {
      borrowerUserId: userId,
      sourcePlayerId: Number(loan.sourcePlayerId),
      sourcePosition: String(loan.sourcePosition || ""),
      rarity: String(loan.rarity || ""),
      currentFplIds,
    });

    await tx.execute(sql`
      update app.card_loans
      set departure_decision='replace',
          departure_decided_at=now(),
          departure_replacement_card_id=${Number(card.id)}
      where id=${loanId}
    `);
    const fallbackExpiry = new Date(Date.now() + Math.max(1, Number(loan.gameweeks || 1)) * 7 * 24 * 60 * 60 * 1000);
    const replacementLockExpiry = loan.expiresAt ? new Date(String(loan.expiresAt)) : fallbackExpiry;
    await tx.execute(sql`
      insert into app.card_locks (card_id, user_id, reason, ref_id, created_at, expires_at)
      select ${Number(card.id)}, ${userId}, 'transfer_pending', ${`loan-replacement:${loanId}`}, now(), ${replacementLockExpiry}
      where not exists (
        select 1
        from app.card_locks
        where card_id=${Number(card.id)}
          and reason='transfer_pending'
          and ref_id=${`loan-replacement:${loanId}`}
          and (expires_at is null or expires_at > now())
      )
    `);
    const sourceReturned = await returnSourceToLenderIfUnlocked(tx, loan);
    await tx.execute(sql`
      update app.notifications
      set read=true
      where user_id=${userId} and dedupe_key=${`loan-departure-choice:${loanId}`}
    `);
    await tx.execute(sql`
      insert into app.audit_logs (user_id, action, meta)
      values (
        ${userId},
        'loan.departure.replacement.minted',
        ${JSON.stringify({ loanId })}::jsonb || jsonb_build_object(
          'sourceCardId', ${Number(loan.cardId)},
          'replacementCardId', ${Number(card.id)},
          'sourcePlayerId', ${Number(loan.sourcePlayerId)},
          'replacementPlayerId', ${Number(card.playerId)},
          'rarity', ${String(loan.rarity || "")},
          'position', ${String(loan.sourcePosition || "")}
        )
      )
    `);

    return { replayed: false, decision: "replace" as const, loan, card, sourceReturned };
  });

  if (result.decision === "keep") {
    await createNotificationOnce(db, {
      userId,
      title: "Loan card kept",
      message: `You chose to keep ${String(result.loan.sourcePlayerName || "the loan player")} for the rest of the loan. If the player returns to the Premier League before the loan expires, the card becomes eligible again automatically.`,
      dedupeKey: `loan-departure-result:${loanId}:keep`,
    });
  } else {
    const playerName = String(result.card?.playerName || "Premier League player");
    const position = String(result.card?.position || result.loan.sourcePosition || "").toUpperCase();
    const rarity = String(result.card?.rarity || result.loan.rarity || "card");
    await createNotificationOnce(db, {
      userId,
      title: "Temporary loan replacement added",
      message: `${playerName} (${position}) is now your temporary ${rarity} loan replacement for the remaining loan period. It will be retired when the loan expires; it does not become a permanent card.`,
      dedupeKey: `loan-departure-result:${loanId}:replace`,
    });
    const lenderId = String(result.loan.originalOwnerId || "");
    if (lenderId) {
      await createNotificationOnce(db, {
        userId: lenderId,
        title: "Borrower replaced an ineligible loan card",
        message: `The borrower chose a temporary same-position, same-rarity Premier League replacement because ${String(result.loan.sourcePlayerName || "your loaned player")} left the league. Your original card remains yours and is returned as soon as any active tournament lock allows it. The temporary replacement belongs only to the loan period.`,
        dedupeKey: `loan-departure-lender:${loanId}:replace`,
      });
    }
  }

  return result;
}
