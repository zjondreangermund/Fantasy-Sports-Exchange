# Fantasy Sports Exchange Production Audit & Execution Roadmap

Date: 2026-05-28  
Scope: Repository audit first; no broad rewrite performed in this stage.

## 1. Repository audit report

### Architecture snapshot

- The backend is partially modularized, but most business logic still lives in one very large `server/routes.ts` file (~6.3k lines). This creates route-order risk, duplicate endpoint drift, and makes wallet/tournament/marketplace fixes harder to verify safely.
- The app already has separate route modules for cards, onboarding, marketplace, retention, admin, auth, and auctions, but the monolithic route file still contains overlapping routes and major business flows.
- The shared database schema contains core tables for users, cards, wallets, transactions, competitions, competition entries, auctions, withdrawals, and audit logs.
- The frontend has feature pages for dashboard, marketplace, wallet, competitions, account, admin, collection, analytics, live lineup, onboarding, auctions, and card lab.

### Build and typecheck status

- `npm run build` succeeds for production client and server output.
- `npm run check -- --pretty false` fails repo-wide because the root TypeScript project checks the full frontend and server together. The major observed categories are React/JSX type-version incompatibility errors in app routes/components and server target/downlevel iteration errors in admin route code.
- This means production build is deployable, but the repository is not yet clean enough for strict CI type gates.

### Duplicate route and dead-code risks

- Marketplace list/cancel/sell routes exist both in `server/routes/marketplace.routes.ts` and in the monolithic `server/routes.ts`. The modular marketplace routes are registered early, so the monolithic versions are effectively stale duplicates for the same paths.
- Auth and admin risk routes also appear duplicated between route modules and monolithic routes.
- The duplicate marketplace routes have different validation rules, rarity floor logic, and active-lineup protections, so future edits can easily fix one path while leaving another stale path behind.

### Wallet audit

- Wallet math is spread across `server/storage.ts`, `server/routes.ts`, marketplace routes, auction routes, and admin routes. There is no single ledger service enforcing balance invariants.
- `updateWalletBalance`, `lockFunds`, and `unlockFunds` directly mutate balances without guards that prevent negative balances or negative locked balances.
- Tournament entry fee deduction checks the wallet and then mutates balance and inserts the tournament entry outside one database transaction. A failure after debit but before entry creation can charge a user without creating an entry.
- Withdrawal handling checks `wallet.balance < amount`, but because `lockFunds` subtracts from `balance` and increments `lockedBalance`, the API’s `availableBalance = balance - lockedBalance` semantics are inconsistent with the stored wallet model.
- Trusted-destination instant withdrawal creates the withdrawal request before the transaction that debits the wallet, so failures between those steps can create paid withdrawal records without a matching wallet debit.
- The transaction ledger has newer columns in schema, but the production database previously missed at least one column (`status`), proving migrations/runtime schema drift must be treated as a production risk.

### Tournament/reward audit

- Tournament join has strong lineup validation, but fee charging and entry creation are not atomic.
- Settlement does not run as one transaction. It creates prize cards, updates entries, writes notifications, marks competitions completed, resets card scores, and writes audit logs through multiple independent operations.
- Settlement blocks only when competition status is already `completed`; there is no explicit settlement lock or idempotency key to prevent two admins/processes from settling the same tournament concurrently.
- Prize card minting retries across candidate players, but it still depends on `createPlayerCard` rules that block duplicate same-player/same-rarity cards for a user. This can still fail for users with saturated player/rarity combos.
- Reward integrity validation exists, but repair tooling is still missing. Admins can inspect missing/mismatched prize cards, but cannot yet repair them safely through a dedicated endpoint.

### Marketplace audit

- Purchase flow now locks the card row and performs buyer/seller wallet updates and card transfer in one transaction, which is the correct direction.
- The buyer wallet balance check uses `wallet.balance`, not a dedicated available-balance invariant. This needs to align with the wallet overhaul so locked funds cannot be double-spent.
- Marketplace audit logging exists for some risk cases, but there is no successful purchase audit log, failed-purchase audit log, idempotency key, or listing lifecycle audit log.
- Listing/cancel flows exist in both modular and monolithic locations, creating ownership/listing behavior drift.
- Listing performance currently depends on general `player_cards` filtering/join patterns; production marketplace should add targeted DB indexes for `for_sale`, `rarity`, `price`, and `owner_id`.

### Card/inventory audit

- The schema includes `serial_id`, `serial_number`, and `max_supply`, and storage has supply counting and serial generation helpers.
- `createPlayerCard` enforces supply count before insert, but this is not protected by a DB uniqueness constraint or serial allocation lock. Concurrent mints can race and allocate duplicate serial numbers or exceed caps.
- `serial_id` is unique, but `serial_number` is not uniquely constrained per `(player_id, rarity)`, so serial integrity is not guaranteed at the database level.
- Existing cards can have missing serial fields and rely on a backfill helper. A production checker/repair endpoint should report missing serials, duplicate serials, ownerless cards, invalid rarity/maxSupply, and cards listed while in active lineups.

### UI/UX audit

- The app now has global tab-panel background styling, so all shared tab panels have a visible shell.
- The marketplace has richer card-row visuals and distinct Buy/Sell panel styling, but this is not a full Sorare/FC Ultimate Team redesign yet.
- Several pages still use large page-level components and inconsistent card/panel styling. Dashboard, wallet, tournaments, profile/account, and admin should be redesigned through shared premium page shells, KPI cards, responsive grids, skeletons, empty states, and mobile-first layouts.

### Security and anti-abuse audit

- Some marketplace anti-abuse checks exist for linked email and repeat trade pairs.
- Idempotency protection is missing for sensitive mutation endpoints: join competition, settle competition, marketplace buy, wallet deposit/withdraw, auction bid/buy-now, admin adjustments, and reward repair.
- Audit logging is uneven. Settlement and some risk cases log events, but wallet mutations, listing lifecycle, successful marketplace purchases, admin wallet credits, withdrawal approvals/rejections, and card repairs need consistent structured audit logs.

## 2. Critical bug list

### P0 — Money/reward correctness

1. **Non-atomic tournament entry fee + entry creation**  
   User balance can be debited before the competition entry is created if a later operation fails.

2. **No settlement idempotency/lock**  
   Concurrent settlement requests can race because `completed` is checked before independent reward operations.

3. **Settlement not wrapped in a transaction**  
   Prize-card creation, entry reward updates, competition completion, notifications, and score reset can partially succeed.

4. **Wallet invariant ambiguity**  
   Current wallet fields are used as both stored balance and available balance in different flows, while locked balance is also subtracted from balance in `lockFunds`.

5. **Wallet mutation helpers permit negative balances**  
   Storage helpers mutate balance/lockedBalance without `WHERE balance >= amount` or equivalent safeguards.

6. **Trusted withdrawal request created before wallet debit**  
   A paid withdrawal record can be created before the debit transaction succeeds.

### P1 — Marketplace/inventory correctness

7. **Duplicate marketplace route implementations**  
   Modular and monolithic marketplace endpoints diverge and invite stale bug fixes.

8. **Marketplace spend ignores locked-funds model**  
   Purchases check only balance; after wallet overhaul this must become available-balance checked inside the same transaction.

9. **No purchase idempotency key**  
   Network retries can resubmit the same buy intent. Card row locking helps, but UX and audit trails need idempotent responses.

10. **Serial/supply caps not DB-safe**  
    Supply caps and serial allocation can race under concurrent card creation.

### P2 — Operations/admin/debuggability

11. **Reward integrity checker has no repair action**  
    Admins can diagnose missing/mismatched rewards but cannot safely repair them.

12. **No wallet ledger reconciliation endpoint**  
    Admins need ledger-vs-wallet validation and repair recommendations.

13. **Strict typecheck fails repo-wide**  
    CI cannot rely on `npm run check` until React type and server target issues are resolved.

14. **Route modules and monolith overlap**  
    Large `server/routes.ts` still contains business domains that should move into modules.

## 3. Refactor plan

### Backend target modules

- `server/services/wallet-ledger.service.ts`
  - Single source of truth for all money mutations.
  - Atomic operations: deposit, admin adjustment, tournament entry fee, withdrawal lock/release/settle, marketplace buy, auction bid lock/refund/settle.
  - Enforce non-negative available and locked balances.
  - Write transactions and audit logs together.

- `server/services/tournament-settlement.service.ts`
  - Settlement lock/idempotency.
  - Final leaderboard snapshot.
  - Atomic reward assignment.
  - Duplicate reward prevention.
  - Settlement audit trail.

- `server/services/card-integrity.service.ts`
  - Rarity cap checker.
  - Serial generator with DB-level uniqueness strategy.
  - Ownership checker.
  - Active-lineup/listing conflict checker.
  - Repair tools.

- `server/services/marketplace.service.ts`
  - Listing lifecycle.
  - Purchase lifecycle.
  - Ownership checks before and after purchase.
  - Idempotency keys.
  - Audit logs.

- `server/routes/*`
  - Move remaining wallet, tournament, marketplace, admin, reward, and transaction endpoints out of `server/routes.ts` in small steps.

### Database hardening targets

- Add DB indexes for marketplace listings and transaction lookups.
- Add unique/idempotency constraints for reward claims, competition entries, idempotency keys, and serial allocation.
- Add DB constraints or guarded updates for non-negative balances.
- Add migration coverage instead of relying on runtime schema drift patches.

### Frontend refactor targets

- Create shared `PageShell`, `PremiumPanel`, `StatCard`, `ActionBar`, `MobileDock`, `LoadingRows`, and `EmptyState` components.
- Redesign one route at a time: Dashboard → Marketplace → Competitions → Wallet → Account/Profile → Admin.
- Keep API contracts stable while improving visual layers.

## 4. Execution roadmap and PR stages

### PR 1 — Critical bug fixes

- Remove duplicate marketplace monolith endpoints or hard-delegate them to the modular service.
- Make tournament join fee + entry creation atomic.
- Add guarded wallet debit/credit helpers.
- Add successful/failed marketplace purchase audit logs.
- Fix strict server target/downlevel iteration errors that affect admin routes.
- Add minimal tests/smoke scripts for wallet debit, competition join, marketplace purchase, and settlement idempotency.

### PR 2 — Wallet overhaul

- Introduce `wallet-ledger.service.ts`.
- Define wallet semantics: `balance = total funds`, `lockedBalance = held funds`, `available = balance - lockedBalance`.
- Migrate all wallet mutations to ledger service.
- Add idempotency keys for deposit/withdraw/admin adjustment.
- Add wallet reconciliation/admin endpoint.
- Add withdrawal validation and atomic trusted withdrawal flow.

### PR 3 — Tournament overhaul

- Introduce settlement service.
- Add settlement lock/idempotency.
- Snapshot final leaderboard.
- Prevent duplicate prize cards/reward claims.
- Add reward repair endpoint for missing/mismatched cards.
- Add settlement integrity tests.

### PR 4 — Marketplace overhaul

- Introduce marketplace service.
- Remove duplicate old marketplace endpoints.
- Add listing indexes and lifecycle audit logs.
- Add buy idempotency.
- Enforce available balance and post-transfer verification.
- Add admin listing explorer and repair actions.

### PR 5 — UI redesign

- Build shared premium UI primitives and route shells.
- Redesign dashboard, marketplace, competitions, wallet, account/profile, and admin in sequence.
- Add mobile responsive layouts, skeletons, empty states, and lightweight animations.
- Capture screenshots for visible web changes.

### PR 6 — Admin tools

- Add transaction explorer.
- Add wallet reconciliation and adjustment flows.
- Add tournament reward repair UI.
- Add card ownership/serial repair UI.
- Add risk monitoring dashboard.
- Add audit log explorer.

## 5. Immediate next action

Start PR 1 with small, production-safe changes:

1. Move/disable stale duplicate marketplace list/cancel/sell routes from `server/routes.ts` so only one marketplace implementation is live.
2. Add atomic competition join transaction for entry fee + entry creation.
3. Add guarded wallet debit/lock helpers that cannot create negative available or locked balances.
4. Add a settlement idempotency guard before any reward mutation.
5. Add audit logs for successful marketplace purchases and listing lifecycle changes.
