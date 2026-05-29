# Admin Operations Runbook

This runbook covers the production admin workflows that protect money, cards, tournaments and marketplace integrity.

## Daily checks

1. Open Admin > Integrity Console.
2. Run wallet integrity.
3. Run marketplace integrity.
4. Run card integrity.
5. Check risk users and risk flags.
6. Open the Transaction Ledger and review withdrawals, marketplace sales and admin adjustments.

## Wallet checks

Look for:

- Negative balance
- Negative locked balance
- Wallet-to-ledger delta
- Missing wallet rows
- Repeated failed or rejected transactions

Recommended action:

- Use wallet repair only for missing wallets.
- For ledger deltas, inspect the transaction history before adjusting balances.
- Never manually credit a wallet without recording the reason in the description.

## Tournament reward checks

For each completed tournament:

1. Open reward integrity.
2. Check for missing prize cards.
3. Check for owner mismatch.
4. Run repair only if the report shows repairable issues.
5. Confirm the winner has either a prize amount, prize card, or both.

Common failure types:

- `missing_card`: entry expected a card but has no prize card id.
- `owner_mismatch`: prize card exists but belongs to the wrong account.
- `claim_duplicate`: same entry has more than one claim record.

## Marketplace checks

Look for:

- Listed cards not owned by seller
- Common cards listed for sale
- Price below rarity floor
- Repeated buyer/seller pair trades
- Same card moving between the same accounts

Recommended action:

- Repair invalid listings.
- Review repeated pair trades before banning or reversing anything.
- Use transaction descriptions to trace `buyer:`, `seller:` and `card:` references.

## Auction checks

Look for:

- Auction status stuck live after end time
- Winning bid not settled
- Losing bids still locked
- Auction card not transferred

Recommended action:

- Use settlement tools only once.
- Check audit logs before manual transfer.
- Confirm locked balance is released for losing bidders.

## Database hardening order

Apply SQL in this order:

1. `drizzle/0001_production_integrity_indexes.sql`
2. `drizzle/0002_idempotency_keys.sql`
3. Run `drizzle/0003_uniqueness_safety_checks.sql` manually and review results.
4. Only enable optional unique indexes if the safety checks return zero duplicate rows.

## Before every deploy

Run:

```bash
npm run build
npm run test:critical-flows
node scripts/verify-production-readiness.mjs
```

## Emergency rollback notes

If deployment fails:

1. Read the final 30 lines of the build log first.
2. Fix TypeScript errors before changing logic.
3. Avoid merging new UI and backend logic in the same emergency patch.
4. Keep wallet and reward fixes small and auditable.
