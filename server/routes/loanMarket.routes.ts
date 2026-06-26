import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  getLoanFeeBreakdown,
  getLoanFloorPerGameweek,
  LOAN_DURATIONS_GAMEWEEKS,
  normalizeLoanRarity,
} from "../../shared/loan-market.js";

interface RegisterLoanMarketRoutesDeps {
  requireAuth: any;
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

async function ensureLoanMarketTables() {
  await db.execute(sql`
    create table if not exists app.card_loans (
      id integer generated always as identity primary key,
      card_id integer not null references app.player_cards(id),
      original_owner_id varchar(255) not null references app.users(id),
      borrower_user_id varchar(255) references app.users(id),
      status text not null default 'open',
      price_per_gameweek real not null,
      gameweeks integer not null,
      gross_amount real not null default 0,
      fee_amount real not null default 0,
      owner_receives real not null default 0,
      starts_at timestamp,
      expires_at timestamp,
      returned_at timestamp,
      created_at timestamp default now()
    )
  `);
  await db.execute(sql`create index if not exists card_loans_card_status_idx on app.card_loans(card_id, status)`);
  await db.execute(sql`create index if not exists card_loans_borrower_status_idx on app.card_loans(borrower_user_id, status)`);
  await db.execute(sql`create index if not exists card_loans_expiry_idx on app.card_loans(expires_at) where status = 'active'`);
}

async function removeReturnedCardFromBorrowerLineup(tx: any, borrowerUserId: string, cardId: number) {
  await tx.execute(sql`
    update app.lineups
    set card_ids = coalesce((
      select jsonb_agg(value::int)
      from jsonb_array_elements_text(card_ids) as value
      where value::int <> ${cardId}
    ), '[]'::jsonb)
    where user_id = ${borrowerUserId}
  `);
}

async function returnExpiredLoans() {
  await ensureLoanMarketTables();
  const returned: any[] = [];
  await db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      select *
      from app.card_loans
      where status = 'active'
        and expires_at is not null
        and expires_at <= now()
      for update
    `);

    for (const loan of rowsOf(result)) {
      const cardId = Number(loan.card_id);
      const ownerId = String(loan.original_owner_id || "");
      const borrowerId = String(loan.borrower_user_id || "");
      if (!cardId || !ownerId || !borrowerId) continue;

      await tx.execute(sql`
        update app.player_cards
        set owner_id = ${ownerId}, for_sale = false, price = 0
        where id = ${cardId}
          and owner_id = ${borrowerId}
      `);
      await removeReturnedCardFromBorrowerLineup(tx, borrowerId, cardId);
      await tx.execute(sql`
        update app.card_loans
        set status = 'returned', returned_at = now()
        where id = ${Number(loan.id)}
      `);
      await tx.execute(sql`
        insert into app.audit_logs (user_id, action, meta)
        values (${ownerId}, 'loan.returned.expired', ${JSON.stringify({ loanId: Number(loan.id), cardId, borrowerId })}::jsonb)
      `);
      returned.push({ loanId: Number(loan.id), cardId });
    }
  });
  return returned;
}

export function registerLoanMarketRoutes(app: Express, deps: RegisterLoanMarketRoutesDeps) {
  const { requireAuth } = deps;

  ensureLoanMarketTables()
    .then(() => returnExpiredLoans())
    .catch((error) => console.error("Loan market bootstrap failed:", error));

  const timer = setInterval(() => {
    returnExpiredLoans().catch((error) => console.error("Expired loan return failed:", error));
  }, 10 * 60 * 1000);
  timer.unref?.();

  app.get("/api/marketplace/loans", requireAuth, async (_req: any, res) => {
    try {
      await returnExpiredLoans();
      const result = await db.execute(sql`
        select
          l.*,
          p.name as player_name,
          p.team,
          p.position,
          p.overall,
          pc.rarity,
          pc.serial_id,
          pc.serial_number,
          pc.max_supply,
          coalesce(u.manager_team_name, u.name, u.email, 'Manager') as owner_name
        from app.card_loans l
        join app.player_cards pc on pc.id = l.card_id
        join app.players p on p.id = pc.player_id
        left join app.users u on u.id = l.original_owner_id
        where l.status = 'open'
        order by l.created_at desc, l.id desc
      `);
      return res.json({ loans: rowsOf(result) });
    } catch (error: any) {
      console.error("Failed to fetch loan listings:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch loan listings" });
    }
  });

  app.post("/api/marketplace/loans/list", requireAuth, async (req: any, res) => {
    try {
      await returnExpiredLoans();
      const userId = String(req.authUserId || "");
      const cardId = Number(req.body?.cardId);
      const requestedGameweeks = Number(req.body?.gameweeks || 1);
      const gameweeks = LOAN_DURATIONS_GAMEWEEKS.includes(requestedGameweeks as any) ? requestedGameweeks : 1;
      const requestedPrice = Number(req.body?.pricePerGameweek || 0);

      if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Valid cardId required" });

      let created: any = null;
      await db.transaction(async (tx) => {
        const cardResult = await tx.execute(sql`
          select pc.*, p.name as player_name
          from app.player_cards pc
          join app.players p on p.id = pc.player_id
          where pc.id = ${cardId}
          for update
        `);
        const card = rowsOf(cardResult)[0];
        if (!card) throw new Error("Card not found");
        if (String(card.owner_id || "") !== userId) throw new Error("You can only loan out cards you own");
        if (card.for_sale) throw new Error("Cards listed for sale cannot also be loaned");

        const normalizedRarity = normalizeLoanRarity(String(card.rarity || ""));
        if (!normalizedRarity) throw new Error("Common cards cannot be loaned");

        const activeLoanResult = await tx.execute(sql`
          select id from app.card_loans
          where card_id = ${cardId}
            and status in ('open', 'active')
          limit 1
          for update
        `);
        if (rowsOf(activeLoanResult).length > 0) throw new Error("Card is already listed or active on loan");

        const breakdown = getLoanFeeBreakdown({ rarity: normalizedRarity, pricePerGameweek: requestedPrice, gameweeks });
        const listingResult = await tx.execute(sql`
          insert into app.card_loans (
            card_id, original_owner_id, status, price_per_gameweek, gameweeks,
            gross_amount, fee_amount, owner_receives
          ) values (
            ${cardId}, ${userId}, 'open', ${breakdown.pricePerGameweek}, ${breakdown.gameweeks},
            ${breakdown.gross}, ${breakdown.fee}, ${breakdown.ownerReceives}
          ) returning *
        `);
        created = rowsOf(listingResult)[0] || null;
        await tx.execute(sql`
          insert into app.audit_logs (user_id, action, meta)
          values (${userId}, 'loan.listing.created', ${JSON.stringify({ cardId, loanId: created?.id, breakdown })}::jsonb)
        `);
      });

      return res.json({ success: true, loan: created });
    } catch (error: any) {
      console.error("Failed to create loan listing:", error);
      const message = String(error?.message || "Failed to create loan listing");
      return res.status(message.includes("not found") ? 404 : 400).json({ message });
    }
  });

  app.post("/api/marketplace/loans/:loanId/accept", requireAuth, async (req: any, res) => {
    try {
      await returnExpiredLoans();
      const borrowerId = String(req.authUserId || "");
      const loanId = Number(req.params.loanId);
      if (!Number.isInteger(loanId) || loanId <= 0) return res.status(400).json({ message: "Valid loanId required" });

      let accepted: any = null;
      await db.transaction(async (tx) => {
        const loanResult = await tx.execute(sql`
          select l.*, pc.owner_id, pc.for_sale, pc.rarity
          from app.card_loans l
          join app.player_cards pc on pc.id = l.card_id
          where l.id = ${loanId}
          for update
        `);
        const loan = rowsOf(loanResult)[0];
        if (!loan) throw new Error("Loan listing not found");
        if (String(loan.status || "") !== "open") throw new Error("Loan listing is no longer available");

        const ownerId = String(loan.original_owner_id || "");
        const cardId = Number(loan.card_id);
        const gross = toMoney(loan.gross_amount || Number(loan.price_per_gameweek || 0) * Number(loan.gameweeks || 1));
        const fee = toMoney(gross * 0.08);
        const ownerReceives = toMoney(gross - fee);

        if (ownerId === borrowerId) throw new Error("You cannot loan your own card");
        if (String(loan.owner_id || "") !== ownerId) throw new Error("Card is no longer owned by the lender");
        if (loan.for_sale) throw new Error("Card is currently listed for sale");
        if (!normalizeLoanRarity(String(loan.rarity || ""))) throw new Error("This rarity cannot be loaned");

        const walletResult = await tx.execute(sql`
          update app.wallets
          set balance = balance - ${gross}
          where user_id = ${borrowerId}
            and balance >= ${gross}
          returning *
        `);
        if (rowsOf(walletResult).length === 0) throw new Error("Insufficient balance");

        await tx.execute(sql`
          update app.wallets
          set balance = balance + ${ownerReceives}
          where user_id = ${ownerId}
        `);
        await tx.execute(sql`
          update app.player_cards
          set owner_id = ${borrowerId}, for_sale = false, price = 0
          where id = ${cardId}
            and owner_id = ${ownerId}
        `);
        const updateResult = await tx.execute(sql`
          update app.card_loans
          set
            borrower_user_id = ${borrowerId},
            status = 'active',
            gross_amount = ${gross},
            fee_amount = ${fee},
            owner_receives = ${ownerReceives},
            starts_at = now(),
            expires_at = now() + (${Number(loan.gameweeks || 1)} * interval '7 days')
          where id = ${loanId}
          returning *
        `);
        accepted = rowsOf(updateResult)[0] || null;

        await tx.execute(sql`
          insert into app.transactions (user_id, type, amount, gross_amount, fee_amount, net_amount, source_type, description)
          values (${borrowerId}, 'purchase', ${-gross}, ${gross}, 0, ${-gross}, 'card_loan_accept', ${`loan:${loanId} card:${cardId} borrower:${borrowerId} owner:${ownerId} gross:${gross.toFixed(2)}`})
        `);
        await tx.execute(sql`
          insert into app.transactions (user_id, type, amount, gross_amount, fee_amount, net_amount, source_type, description)
          values (${ownerId}, 'sale', ${ownerReceives}, ${gross}, ${fee}, ${ownerReceives}, 'card_loan_income', ${`loan:${loanId} card:${cardId} borrower:${borrowerId} owner:${ownerId} gross:${gross.toFixed(2)} fee:${fee.toFixed(2)}`})
        `);
        await tx.execute(sql`
          insert into app.audit_logs (user_id, action, meta)
          values (${borrowerId}, 'loan.accepted.paid', ${JSON.stringify({ loanId, cardId, ownerId, borrowerId, gross, fee, ownerReceives })}::jsonb)
        `);
      });

      return res.json({ success: true, loan: accepted });
    } catch (error: any) {
      console.error("Failed to accept loan:", error);
      const message = String(error?.message || "Failed to accept loan");
      return res.status(message.includes("not found") ? 404 : 400).json({ message });
    }
  });

  app.post("/api/marketplace/loans/return-expired", requireAuth, async (_req: any, res) => {
    try {
      const returned = await returnExpiredLoans();
      return res.json({ success: true, returned });
    } catch (error: any) {
      console.error("Failed to return expired loans:", error);
      return res.status(500).json({ message: error?.message || "Failed to return expired loans" });
    }
  });
}
