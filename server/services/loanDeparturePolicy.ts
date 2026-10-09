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

export async function syncActiveLoanDepartureChoices(_userId?: string) {
  await ensureLoanDeparturePolicySchema();
  // PLATFORM_LOAN_DEPARTURE_POLICY_DISABLED_V1
  // A Fantasy Arena card being borrowed is not the trigger for the football
  // player's real-world transfer status. Real-life loans are handled by
  // realLifeLoanMonitoring.ts using API-Football transfer evidence.
  return { notified: 0, sourceReturns: 0, returnedPlayerNotices: 0, disabled: true };
}

export async function chooseLoanDepartureAction(_userId: string, _loanId: number, _decision: "keep" | "replace") {
  await ensureLoanDeparturePolicySchema();
  throw new Error("Fantasy Arena marketplace loans do not use the real-life football loan replacement rule.");
}
