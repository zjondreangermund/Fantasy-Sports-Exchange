import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { postWalletAmountExactlyOnce, toPostingMoney } from "./walletPosting.js";
import { getMarketplaceFloorPrice } from "../../shared/card-economy.js";
import { cancelAuctionWithEscrowRecovery } from "./auctionEscrow.js";
import { reviewWithdrawal } from "./withdrawalPayout.js";

const rows = (result: any): any[] => result.rows || [];
const RESET_KEY = 'owner-confirmed-testing-reset-20261014';

export async function resetConfirmedTestingBalances() {
  await db.execute(sql`create table if not exists app.platform_finance_baseline (
    id text primary key, reset_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
  )`);
  if (rows(await db.execute(sql`select id from app.platform_finance_baseline where id = ${RESET_KEY}`)).length) return;
  const auctions = rows(await db.execute(sql`select id from app.auctions where status::text in ('draft','live','ended')`));
  const withdrawals = rows(await db.execute(sql`select id from app.withdrawal_requests where status::text in ('pending','approved','failed')`));
  if (auctions.length || withdrawals.length) {
    const ids = String(process.env.ADMIN_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean);
    const emails = String(process.env.ADMIN_EMAILS || 'lbcplaya@gmail.com').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    const admin = rows(await db.execute(sql`select id from app.users where id = any(${ids}::varchar[]) or lower(email) = any(${emails}::text[]) limit 1`))[0];
    if (!admin) throw new Error('Testing hold reset requires the configured administrator identity');
    for (const auction of auctions) await cancelAuctionWithEscrowRecovery({ auctionId: auction.id, actorId: admin.id, allowBids: true, reason: 'Owner-confirmed testing reset' });
    for (const withdrawal of withdrawals) await reviewWithdrawal({ withdrawalId: withdrawal.id, adminId: admin.id, status: 'rejected', adminNotes: 'Owner-confirmed testing reset' });
  }
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(746202611)`);
    if (rows(await tx.execute(sql`select id from app.platform_finance_baseline where id = ${RESET_KEY}`)).length) return;
    const wallets = rows(await tx.execute(sql`select user_id, balance, locked_balance from app.wallets for update`));
    let cleared = 0;
    for (const wallet of wallets) {
      const total = toPostingMoney(Number(wallet.balance) + Number(wallet.locked_balance));
      // Transfer the testing hold into available balance so the normal posting
      // service can reverse the complete balance with a durable ledger entry.
      await tx.execute(sql`update app.wallets set balance = balance + locked_balance, locked_balance = 0 where user_id = ${wallet.user_id}`);
      if (total !== 0) await postWalletAmountExactlyOnce(tx, {
        postingKey: `${RESET_KEY}:${wallet.user_id}`, userId: wallet.user_id,
        amount: -total, transactionType: 'admin_adjustment', sourceType: 'confirmed_testing_reset',
        description: 'Testing balance cleared before live operation',
        reason: 'Owner confirmed all existing balances were for testing',
        metadata: { previousAvailable: wallet.balance, previousLocked: wallet.locked_balance },
        auditAction: 'admin.confirmed_testing_reset',
      });
      cleared += total;
    }
    // Old testing holds must not later release funds back into the cleared wallets.
    if (rows(await tx.execute(sql`select to_regclass('app.deposit_verifications') as name`))[0]?.name) {
      await tx.execute(sql`update app.deposit_verifications set status = 'rejected' where status = 'pending'`);
      await tx.execute(sql`update app.transactions set status = 'rejected', source_type = 'deposit_rejected' where status::text = 'pending' and source_type = 'deposit_verification'`);
    }
    await tx.execute(sql`insert into app.platform_finance_baseline (id, metadata) values (${RESET_KEY}, ${JSON.stringify({ wallets: wallets.length, cleared })}::jsonb)`);
    console.log('[confirmed-testing-reset]', { wallets: wallets.length, cleared, available: 0, locked: 0 });
  });
}

export async function getPlatformFinance() {
  const baseline = rows(await db.execute(sql`select reset_at from app.platform_finance_baseline where id = ${RESET_KEY}`))[0];
  if (!baseline) throw new Error('Live finance baseline not ready');
  const ledger = rows(await db.execute(sql`select
    coalesce(sum(case when source_type in ('marketplace_sale','auction_sale','card_loan_income','deposit_verified','competition_entry','user_tournament_entry') or type::text = 'entry_fee' then greatest(coalesce(fee_amount,0),0) else 0 end),0)::float as revenue,
    coalesce(sum(case when source_type = 'free_cup_surprise_prize' and amount > 0 then amount else 0 end),0)::float as "cashPrizeCosts"
    from app.transactions where status::text = 'completed' and created_at >= ${baseline.reset_at}
  `))[0] || {};
  const awards = rows(await db.execute(sql`select pc.rarity::text as rarity, count(*)::int as count
    from app.player_cards pc where pc.id in (
      select distinct ce.prize_card_id from app.competition_entries ce join app.competitions c on c.id = ce.competition_id
      where ce.prize_card_id is not null and c.name not like '[TEST]%'
    ) group by pc.rarity`));
  const cardPrizeCosts = toPostingMoney(awards.reduce((total, award) => total + Number(award.count) * getMarketplaceFloorPrice(award.rarity), 0));
  const walletTotals = rows(await db.execute(sql`select coalesce(sum(balance),0)::float as available, coalesce(sum(locked_balance),0)::float as locked from app.wallets`))[0];
  const revenue = toPostingMoney(ledger.revenue);
  const cashPrizeCosts = toPostingMoney(ledger.cashPrizeCosts);
  return { baselineAt: baseline.reset_at, revenue, cardPrizeCosts, cashPrizeCosts,
    netResult: toPostingMoney(revenue-cardPrizeCosts-cashPrizeCosts),
    walletAvailable: toPostingMoney(walletTotals.available), walletLocked: toPostingMoney(walletTotals.locked),
    awards: awards.map(award => ({ ...award, basePrice: getMarketplaceFloorPrice(award.rarity) })),
  };
}
