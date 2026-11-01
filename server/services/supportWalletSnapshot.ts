export type AssistantQuery=(sql:string,params?:any[])=>Promise<any[]>;
/** Read-only, single-statement reconciliation using the production ledger/escrow conventions. */
export async function supportWalletSnapshot(q:AssistantQuery,userId:string){
  const schema=(await q("SELECT to_regclass('app.auction_escrow_holds') AS escrow, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='withdrawal_requests' AND column_name='hold_transaction_id') AS holds"))[0];
  if(!schema?.escrow||!schema?.holds)return {available:false,reason:'Complete escrow reconciliation is unavailable on this database. No balance discrepancy conclusion was made.'};
  const row=(await q(`WITH ledger AS (
    SELECT coalesce(sum(amount) FILTER(WHERE status::text='completed'),0)::float AS posted,
      count(*) FILTER(WHERE status::text<>'completed' AND abs(amount)>=0.01)::int AS nonposted
    FROM app.transactions WHERE user_id=$1
  ), withdrawals AS (
    SELECT coalesce(sum(w.amount),0)::float AS held,
      count(*) FILTER(WHERE t.id IS NULL OR t.status::text<>'pending' OR t.source_type<>'withdrawal_hold' OR abs(coalesce(t.amount,0))>=0.01)::int AS mismatches
    FROM app.withdrawal_requests w LEFT JOIN app.transactions t ON t.id=w.hold_transaction_id
    WHERE w.user_id=$1 AND w.status::text IN ('pending','approved','failed')
  ), auctions AS (
    SELECT coalesce(sum(h.amount),0)::float AS held,
      coalesce(sum(CASE WHEN t.id IS NOT NULL AND t.status::text='completed' AND t.source_type='auction_bid_lock' AND abs(t.amount+h.amount)<0.01 THEN h.amount ELSE 0 END),0)::float AS adjustment,
      count(*) FILTER(WHERE t.id IS NULL OR t.status::text<>'completed' OR t.source_type<>'auction_bid_lock' OR abs(coalesce(t.amount,0)+h.amount)>=0.01)::int AS mismatches
    FROM app.auction_escrow_holds h LEFT JOIN app.transactions t ON t.id=h.hold_transaction_id
    WHERE h.bidder_user_id=$1 AND h.status='held'
  ) SELECT w.balance,w.locked_balance AS "lockedBalance",l.posted AS "postedLedger",l.nonposted AS "nonpostedNonzeroTransactions",
    d.held AS "withdrawalHeld",d.mismatches AS "withdrawalLedgerMismatches",a.held AS "auctionHeld",a.adjustment AS "auctionLedgerAdjustment",a.mismatches AS "auctionLedgerMismatches",
    (coalesce(w.balance,0)+coalesce(w.locked_balance,0)-l.posted-a.adjustment)::float AS "totalDelta",
    (coalesce(w.locked_balance,0)-d.held-a.held)::float AS "lockedDelta"
    FROM ledger l CROSS JOIN withdrawals d CROSS JOIN auctions a LEFT JOIN app.wallets w ON w.user_id=$1`,[userId]))[0];
  if(!row)return {available:false,reason:'No reconciliation snapshot was returned.'};
  const flags=[row.balance==null?'missing_wallet':null,Number(row.balance)<-0.005?'negative_available':null,Number(row.lockedBalance)<-0.005?'negative_locked':null,Math.abs(Number(row.totalDelta))>=0.01?'wallet_ledger_difference':null,Math.abs(Number(row.lockedDelta))>=0.01?'locked_attribution_difference':null,Number(row.nonpostedNonzeroTransactions)>0?'unposted_nonzero_transactions':null,Number(row.withdrawalLedgerMismatches)>0?'withdrawal_ledger_mismatch':null,Number(row.auctionLedgerMismatches)>0?'auction_ledger_mismatch':null].filter(Boolean);
  return {available:true,...row,flags:flags.join(', ')||'none',status:flags.length?'review':'ok'};
}
