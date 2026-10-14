import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { postWalletAmountExactlyOnce, toPostingMoney } from "./walletPosting.js";
import { ensureWalletPostingSchema } from "./walletPostingSchema.js";

const rows = (result: any): any[] => result.rows || [];

// User-requested cleanup. Keep cards and ledger history; remove only demonstrably
// seeded inventory and explicitly recorded test-console credits.
export async function removeFantasyTestInventory() {
  await ensureWalletPostingSchema();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(746202610)`);
    const sales = rows(await tx.execute(sql`
      update app.player_cards set for_sale = false, price = 0
      where for_sale = true and (owner_id is null or owner_id in ('demo-seller-1','demo-buyer-1','demo-admin-1'))
      returning id
    `));
    if (rows(await tx.execute(sql`select to_regclass('app.card_loans') as name`))[0]?.name) {
      await tx.execute(sql`update app.card_loans set status = 'cancelled'
        where status = 'open' and original_owner_id in ('demo-seller-1','demo-buyer-1','demo-admin-1')`);
    }
    const credits = rows(await tx.execute(sql`
      select user_id as "userId", round(sum(amount)::numeric,2)::float as amount
      from app.transactions where status::text = 'completed'
        and ((source_type = 'admin_test' and created_at <= '2026-10-14T04:30:31Z'::timestamptz)
          or source_type = 'fantasy_test_cleanup'
          or (description = 'Initial demo wallet balance' and user_id in ('demo-seller-1','demo-buyer-1','demo-admin-1')))
      group by user_id having round(sum(amount)::numeric,2) > 0
    `));
    let reversed = 0;
    for (const credit of credits) {
      const wallet = rows(await tx.execute(sql`select balance from app.wallets where user_id = ${credit.userId} for update`))[0];
      const amount = toPostingMoney(credit.amount);
      if (!wallet || toPostingMoney(wallet.balance) < amount) {
        console.warn('[fantasy-test-cleanup] Test credit already spent or locked; manual reconciliation required', { userId: credit.userId, amount });
        continue;
      }
      await postWalletAmountExactlyOnce(tx, {
        postingKey: `fantasy-test-cleanup-20261014:${credit.userId}`,
        userId: credit.userId, amount: -amount,
        transactionType: 'admin_adjustment', sourceType: 'fantasy_test_cleanup',
        description: 'Removal of Fantasy Arena test funds',
        reason: 'Owner requested removal of added test funds; real deposits and earnings preserved',
        auditAction: 'admin.fantasy_test_cleanup',
      });
      reversed += amount;
    }
    console.log('[fantasy-test-cleanup]', { delistedSales: sales.length, reversedTestFunds: reversed });
  });
}
