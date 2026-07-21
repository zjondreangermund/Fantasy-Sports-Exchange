import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  getLoanFeeBreakdown,
  getLoanFloorPerGameweek,
  LOAN_DURATIONS_GAMEWEEKS,
  normalizeLoanRarity,
} from "../../shared/loan-market.js";
import { ensureLoanPaymentSchema } from "../services/loanPaymentSchema.js";
import {
  getLoanPaymentIntegrityReport,
  postLoanPaymentExactlyOnce,
  verifyLoanPaymentExactlyOnce,
} from "../services/loanPayment.js";

interface RegisterLoanMarketRoutesDeps {
  requireAuth: any;
}

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

async function ensureLoanMarketTables() {
  await ensureLoanPaymentSchema();
}

async function isAdminUser(userId: string): Promise<boolean> {
  if (!userId) return false;
  const configuredIds = String(process.env.ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (configuredIds.includes(userId)) return true;
  const configuredEmails = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const user = rowsOf(await db.execute(sql`select lower(coalesce(email, '')) as email from app.users where id = ${userId} limit 1`))[0];
  return Boolean(user?.email && configuredEmails.includes(String(user.email).toLowerCase()));
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

  app.get("/api/admin/loan-payments/integrity", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      if (!(await isAdminUser(userId))) return res.status(403).json({ message: "Admin access required" });
      await ensureLoanPaymentSchema();
      return res.json(await getLoanPaymentIntegrityReport());
    } catch (error: any) {
      console.error("Failed to load loan payment integrity report:", error);
      return res.status(500).json({ message: error?.message || "Failed to load loan payment integrity report" });
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
      let replayed = false;
      await db.transaction(async (tx) => {
        const loanResult = await tx.execute(sql`
          select l.*, pc.owner_id, pc.for_sale, pc.rarity
          from app.card_loans l
          join app.player_cards pc on pc.id = l.card_id
          where l.id = ${loanId}
          for update of l, pc
        `);
        const loan = rowsOf(loanResult)[0];
        if (!loan) throw new Error("Loan listing not found");

        const ownerId = String(loan.original_owner_id || "");
        const cardId = Number(loan.card_id);
        const gross = toMoney(loan.gross_amount || Number(loan.price_per_gameweek || 0) * Number(loan.gameweeks || 1));
        const fee = toMoney(Number(loan.fee_amount || 0) > 0 ? loan.fee_amount : gross * 0.08);
        const ownerReceives = toMoney(Number(loan.owner_receives || 0) > 0 ? loan.owner_receives : gross - fee);
        const paymentDetails = { loanId, cardId, ownerId, borrowerId, gross, fee, ownerReceives };
        const status = String(loan.status || "");

        if (status !== "open") {
          if (!["active", "returned"].includes(status) || String(loan.borrower_user_id || "") !== borrowerId) {
            throw new Error("Loan listing is no longer available");
          }
          await verifyLoanPaymentExactlyOnce(tx, paymentDetails, {
            borrowerPostingKey: loan.borrower_posting_key,
            borrowerTransactionId: loan.borrower_transaction_id,
            ownerPostingKey: loan.owner_posting_key,
            ownerTransactionId: loan.owner_transaction_id,
            paymentCompletedAt: loan.payment_completed_at,
          });
          accepted = loan;
          replayed = true;
          return;
        }

        if (ownerId === borrowerId) throw new Error("You cannot loan your own card");
        if (String(loan.owner_id || "") !== ownerId) throw new Error("Card is no longer owned by the lender");
        if (loan.for_sale) throw new Error("Card is currently listed for sale");
        if (!normalizeLoanRarity(String(loan.rarity || ""))) throw new Error("This rarity cannot be loaned");

        const payment = await postLoanPaymentExactlyOnce(tx, paymentDetails);
        const cardUpdate = rowsOf(await tx.execute(sql`
          update app.player_cards
          set owner_id = ${borrowerId}, for_sale = false, price = 0
          where id = ${cardId}
            and owner_id = ${ownerId}
          returning id
        `))[0];
        if (!cardUpdate) throw new Error("Card ownership changed before loan acceptance completed");

        const updateResult = await tx.execute(sql`
          update app.card_loans
          set
            borrower_user_id = ${borrowerId},
            status = 'active',
            gross_amount = ${gross},
            fee_amount = ${fee},
            owner_receives = ${ownerReceives},
            borrower_posting_key = ${payment.borrower.postingKey},
            borrower_transaction_id = ${payment.borrower.transactionId},
            owner_posting_key = ${payment.owner.postingKey},
            owner_transaction_id = ${payment.owner.transactionId},
            payment_completed_at = now(),
            starts_at = now(),
            expires_at = now() + (${Number(loan.gameweeks || 1)} * interval '7 days')
          where id = ${loanId} and status = 'open'
          returning *
        `);
        accepted = rowsOf(updateResult)[0] || null;
        if (!accepted) throw new Error("Loan listing changed before acceptance completed");
        replayed = payment.replayed;

        await tx.execute(sql`
          insert into app.audit_logs (user_id, action, meta)
          values (${borrowerId}, 'loan.accepted.paid', ${JSON.stringify({
            loanId,
            cardId,
            ownerId,
            borrowerId,
            gross,
            fee,
            ownerReceives,
            borrowerTransactionId: payment.borrower.transactionId,
            ownerTransactionId: payment.owner.transactionId,
          })}::jsonb)
        `);
      });

      return res.json({ success: true, loan: accepted, replayed });
    } catch (error: any) {
      console.error("Failed to accept loan:", error);
      const rawMessage = String(error?.message || "Failed to accept loan");
      const message = rawMessage.includes("Insufficient available balance") ? "Insufficient balance" : rawMessage;
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
