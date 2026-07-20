import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { ensureAuctionEscrowSchema } from "./auctionEscrow.js";
import { ensureWithdrawalPayoutSchema } from "./withdrawalPayoutSchema.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

function toMoney(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

async function ensureReconciliationDependencies() {
  await ensureAuctionEscrowSchema();
  await ensureWithdrawalPayoutSchema();
}

function mapRow(row: any) {
  const balance = toMoney(row.balance);
  const lockedBalance = toMoney(row.locked_balance);
  const walletTotal = toMoney(balance + lockedBalance);
  const postedLedgerBalance = toMoney(row.posted_ledger_balance);
  const auctionLedgerAdjustment = toMoney(row.auction_ledger_adjustment);
  const expectedTotalBalance = toMoney(postedLedgerBalance + auctionLedgerAdjustment);
  const withdrawalLocked = toMoney(row.withdrawal_locked);
  const auctionLocked = toMoney(row.auction_locked);
  const attributedLockedBalance = toMoney(withdrawalLocked + auctionLocked);
  const expectedAvailableBalance = toMoney(expectedTotalBalance - attributedLockedBalance);
  const totalDelta = toMoney(walletTotal - expectedTotalBalance);
  const lockedDelta = toMoney(lockedBalance - attributedLockedBalance);
  const availableDelta = toMoney(balance - expectedAvailableBalance);
  const withdrawalLedgerMismatches = Number(row.withdrawal_ledger_mismatches || 0);
  const auctionLedgerMismatches = Number(row.auction_ledger_mismatches || 0);
  const nonpostedNonzeroTransactions = Number(row.nonposted_nonzero_transactions || 0);
  const hasWallet = Boolean(row.wallet_user_id);

  const flags = [
    !hasWallet ? "missing_wallet" : null,
    hasWallet && balance < -0.005 ? "negative_balance" : null,
    hasWallet && lockedBalance < -0.005 ? "negative_locked_balance" : null,
    hasWallet && Math.abs(totalDelta) >= 0.01 ? "wallet_total_ledger_delta" : null,
    hasWallet && Math.abs(lockedDelta) >= 0.01 ? "locked_balance_attribution_delta" : null,
    hasWallet && lockedDelta >= 0.01 ? "orphaned_locked_balance" : null,
    hasWallet && lockedDelta <= -0.01 ? "locked_balance_shortfall" : null,
    expectedAvailableBalance < -0.005 ? "negative_expected_available_balance" : null,
    withdrawalLedgerMismatches > 0 ? "withdrawal_hold_ledger_mismatch" : null,
    auctionLedgerMismatches > 0 ? "auction_hold_ledger_mismatch" : null,
    nonpostedNonzeroTransactions > 0 ? "nonposted_nonzero_transactions" : null,
  ].filter(Boolean) as string[];

  return {
    userId: String(row.user_id || ""),
    user: row.user_id
      ? { id: String(row.user_id), email: row.email || null, name: row.name || null }
      : null,
    hasWallet,
    balance,
    lockedBalance,
    walletTotal,
    ledgerBalance: postedLedgerBalance,
    postedLedgerBalance,
    auctionLedgerAdjustment,
    expectedTotalBalance,
    withdrawalLocked,
    auctionLocked,
    attributedLockedBalance,
    expectedAvailableBalance,
    delta: totalDelta,
    totalDelta,
    lockedDelta,
    availableDelta,
    withdrawalHoldCount: Number(row.withdrawal_hold_count || 0),
    auctionHoldCount: Number(row.auction_hold_count || 0),
    withdrawalLedgerMismatches,
    auctionLedgerMismatches,
    nonpostedNonzeroTransactions,
    flags,
    status: flags.length ? "review" : "ok",
  };
}

export async function getWalletReconciliationReport() {
  await ensureReconciliationDependencies();
  const rawRows = rowsOf(await db.execute(sql`
    WITH ledger AS (
      SELECT t.user_id,
        coalesce(sum(CASE WHEN t.status::text = 'completed' THEN t.amount ELSE 0 END), 0)::float AS posted_ledger_balance,
        count(*) FILTER (
          WHERE t.status::text <> 'completed' AND abs(coalesce(t.amount, 0)) >= 0.01
        )::int AS nonposted_nonzero_transactions
      FROM app.transactions t
      GROUP BY t.user_id
    ),
    withdrawal_holds AS (
      SELECT wr.user_id,
        coalesce(sum(wr.amount), 0)::float AS withdrawal_locked,
        count(*)::int AS withdrawal_hold_count,
        count(*) FILTER (
          WHERE t.id IS NULL
             OR t.status::text <> 'pending'
             OR t.source_type <> 'withdrawal_hold'
             OR abs(coalesce(t.amount, 0)) >= 0.01
        )::int AS withdrawal_ledger_mismatches
      FROM app.withdrawal_requests wr
      LEFT JOIN app.transactions t ON t.id = wr.hold_transaction_id
      WHERE wr.status::text IN ('pending', 'approved', 'failed')
      GROUP BY wr.user_id
    ),
    auction_holds AS (
      SELECT h.bidder_user_id AS user_id,
        coalesce(sum(h.amount), 0)::float AS auction_locked,
        count(*)::int AS auction_hold_count,
        coalesce(sum(CASE
          WHEN t.id IS NOT NULL
           AND t.status::text = 'completed'
           AND t.source_type = 'auction_bid_lock'
           AND abs(coalesce(t.amount, 0) + h.amount) < 0.01
          THEN h.amount ELSE 0 END), 0)::float AS auction_ledger_adjustment,
        count(*) FILTER (
          WHERE t.id IS NULL
             OR t.status::text <> 'completed'
             OR t.source_type <> 'auction_bid_lock'
             OR abs(coalesce(t.amount, 0) + h.amount) >= 0.01
        )::int AS auction_ledger_mismatches
      FROM app.auction_escrow_holds h
      LEFT JOIN app.transactions t ON t.id = h.hold_transaction_id
      WHERE h.status = 'held'
      GROUP BY h.bidder_user_id
    ),
    relevant_users AS (
      SELECT user_id FROM app.wallets
      UNION SELECT user_id FROM ledger
      UNION SELECT user_id FROM withdrawal_holds
      UNION SELECT user_id FROM auction_holds
    )
    SELECT ru.user_id, u.email, coalesce(u.name, u.manager_team_name, u.email, u.id) AS name,
      w.user_id AS wallet_user_id, coalesce(w.balance, 0)::float AS balance,
      coalesce(w.locked_balance, 0)::float AS locked_balance,
      coalesce(l.posted_ledger_balance, 0)::float AS posted_ledger_balance,
      coalesce(l.nonposted_nonzero_transactions, 0)::int AS nonposted_nonzero_transactions,
      coalesce(wh.withdrawal_locked, 0)::float AS withdrawal_locked,
      coalesce(wh.withdrawal_hold_count, 0)::int AS withdrawal_hold_count,
      coalesce(wh.withdrawal_ledger_mismatches, 0)::int AS withdrawal_ledger_mismatches,
      coalesce(ah.auction_locked, 0)::float AS auction_locked,
      coalesce(ah.auction_hold_count, 0)::int AS auction_hold_count,
      coalesce(ah.auction_ledger_adjustment, 0)::float AS auction_ledger_adjustment,
      coalesce(ah.auction_ledger_mismatches, 0)::int AS auction_ledger_mismatches
    FROM relevant_users ru
    LEFT JOIN app.users u ON u.id = ru.user_id
    LEFT JOIN app.wallets w ON w.user_id = ru.user_id
    LEFT JOIN ledger l ON l.user_id = ru.user_id
    LEFT JOIN withdrawal_holds wh ON wh.user_id = ru.user_id
    LEFT JOIN auction_holds ah ON ah.user_id = ru.user_id
    ORDER BY ru.user_id
  `));

  const allRows = rawRows.map(mapRow);
  const missingWallets = allRows.filter((row) => !row.hasWallet);
  const walletRows = allRows.filter((row) => row.hasWallet);
  const reviewRows = allRows.filter((row) => row.flags.length > 0);
  const totalWalletLocked = toMoney(walletRows.reduce((sum, row) => sum + row.lockedBalance, 0));
  const totalAttributedLocked = toMoney(allRows.reduce((sum, row) => sum + row.attributedLockedBalance, 0));

  return {
    summary: {
      reviewWallets: walletRows.filter((row) => row.status === "review").length,
      missingWallets: missingWallets.length,
      ledgerDeltas: walletRows.filter((row) => row.flags.includes("wallet_total_ledger_delta")).length,
      lockedAttributionDeltas: walletRows.filter((row) => row.flags.includes("locked_balance_attribution_delta")).length,
      orphanedLockedWallets: walletRows.filter((row) => row.flags.includes("orphaned_locked_balance")).length,
      lockedShortfallWallets: walletRows.filter((row) => row.flags.includes("locked_balance_shortfall")).length,
      usersChecked: allRows.length,
      walletsChecked: walletRows.length,
      okWallets: walletRows.filter((row) => row.status === "ok").length,
      negativeBalances: walletRows.filter((row) => row.flags.includes("negative_balance")).length,
      negativeLockedBalances: walletRows.filter((row) => row.flags.includes("negative_locked_balance")).length,
      withdrawalHoldLedgerMismatches: allRows.reduce((sum, row) => sum + row.withdrawalLedgerMismatches, 0),
      auctionHoldLedgerMismatches: allRows.reduce((sum, row) => sum + row.auctionLedgerMismatches, 0),
      nonpostedNonzeroTransactions: allRows.reduce((sum, row) => sum + row.nonpostedNonzeroTransactions, 0),
      totalWalletLocked,
      totalAttributedLocked,
      unattributedLocked: toMoney(totalWalletLocked - totalAttributedLocked),
    },
    rows: reviewRows,
    missingWallets,
  };
}

export async function repairSafeMissingWallets(adminId: string) {
  await ensureReconciliationDependencies();
  if (!adminId) throw new Error("Admin identity required");

  const repaired = await db.transaction(async (tx) => {
    const rows = rowsOf(await tx.execute(sql`
      WITH ledger AS (
        SELECT t.user_id,
          coalesce(sum(CASE WHEN t.status::text = 'completed' THEN t.amount ELSE 0 END), 0)::float AS posted_ledger_balance,
          count(*) FILTER (
            WHERE t.status::text <> 'completed' AND abs(coalesce(t.amount, 0)) >= 0.01
          )::int AS nonposted_nonzero_transactions,
          count(*) FILTER (
            WHERE t.source_type IN (
              'auction_bid_lock', 'auction_bid_release', 'auction_settlement',
              'withdrawal_hold', 'withdrawal_settlement', 'withdrawal_refund'
            )
          )::int AS hold_ledger_history
        FROM app.transactions t
        GROUP BY t.user_id
      ),
      hold_history AS (
        SELECT user_id, count(*)::int AS hold_records FROM (
          SELECT wr.user_id FROM app.withdrawal_requests wr
          UNION ALL
          SELECT h.bidder_user_id AS user_id FROM app.auction_escrow_holds h
        ) holds
        GROUP BY user_id
      )
      INSERT INTO app.wallets (user_id, balance, locked_balance)
      SELECT l.user_id, l.posted_ledger_balance, 0
      FROM ledger l
      JOIN app.users u ON u.id = l.user_id
      LEFT JOIN app.wallets w ON w.user_id = l.user_id
      LEFT JOIN hold_history h ON h.user_id = l.user_id
      WHERE w.user_id IS NULL
        AND coalesce(h.hold_records, 0) = 0
        AND l.hold_ledger_history = 0
        AND l.nonposted_nonzero_transactions = 0
        AND l.posted_ledger_balance >= 0
      ON CONFLICT (user_id) DO NOTHING
      RETURNING user_id, balance, locked_balance
    `));

    for (const row of rows) {
      await tx.execute(sql`
        INSERT INTO app.audit_logs (user_id, action, meta)
        VALUES (${String(row.user_id)}, 'wallet.reconciliation.missing_wallet_repaired', ${JSON.stringify({
          adminId,
          balance: toMoney(row.balance),
          lockedBalance: toMoney(row.locked_balance),
          method: "completed_ledger_without_hold_history",
        })}::jsonb)
      `);
    }
    return rows.map((row) => ({
      userId: String(row.user_id),
      balance: toMoney(row.balance),
      lockedBalance: toMoney(row.locked_balance),
    }));
  });

  const report = await getWalletReconciliationReport();
  return {
    repaired,
    repairedCount: repaired.length,
    remainingMissingWallets: report.missingWallets,
  };
}
