# Fantasy Sports Exchange - Implementation Audit & Plan

**Date:** February 20, 2026  
**Status:** In Progress

## 1. Logic Audit Summary

### ✅ COMPLETED (Currently Working)

#### A) Auth & User
- ✅ Google OAuth implemented (Passport strategy)
- ✅ Replit Auth integration
- ✅ Mock Auth for dev/testing
- ✅ Session management (express-session + connect-pg-simple)
- ✅ User table exists with basic fields
- ✅ Auth middleware (`requireAuth`, `isAdmin`)
- ⚠️ **Missing**: User profile page/endpoints, role management UI

#### B) Cards & Collection
- ✅ Player cards schema (playerId, rarity, serialId, etc.)
- ✅ Collection page working (`GET /api/cards/my`)
- ✅ Onboarding pack system (5 packs × 3 cards = 15 → choose 5)
- ✅ Card creation with rarity validation
- ✅ Serial ID generation for unique cards
- ⚠️ **Missing**: Prevent duplicate pack openings (idempotency), proper status tracking

#### C) Database Schema
- ✅ All core tables exist:
  - `users`, `players`, `playerCards`
  - `wallets`, `transactions`
  - `auctions`, `auctionBids`
  - `competitions`, `competitionEntries`
  - `swapOffers`, `withdrawalRequests`
  - `cardLocks`, `playerValues`, `auditLogs`, `idempotencyKeys`
- ✅ Proper enums for rarity, position, transaction types, auction status
- ✅ Foreign key relationships defined

### ❌ MISSING / INCOMPLETE

#### C) Wallet System
**Status:** Routes exist but are stubs (return placeholder data)

**Missing:**
- ❌ No wallet creation on user signup
- ❌ `GET /api/wallet` - returns `{ balance: 0 }` instead of real data
- ❌ `GET /api/transactions` - returns `[]` instead of transaction history
- ❌ `POST /api/wallet/topup` - admin-only credit route (missing)
- ❌ Wallet balance calculation from transaction ledger
- ❌ Hold/release mechanisms for auctions
- ❌ Negative balance prevention
- ❌ Transaction types not fully utilized
- ❌ Wallet UI incomplete

**Required Implementation:**
- Auto-create wallet on user first login/signup
- Implement ledger-based balance calculation
- Add deposit/credit endpoints with validation  
- Add hold/release for auction bids
- Transaction history with pagination
- Balance validation on all debit operations

#### D) Marketplace (Fixed Price Buy/Sell)
**Status:** Routes exist but are completely unimplemented

**Missing:**
- ❌ `POST /api/marketplace/list` - stub only
- ❌ `POST /api/marketplace/buy` - stub only
- ❌ `POST /api/marketplace/cancel` - missing entirely
- ❌ `GET /api/marketplace` - returns `[]`
- ❌ No listing table (using playerCards.forSale flag)
- ❌ No atomicity in buy transactions
- ❌ No ownership validation
- ❌ No concurrent purchase protection
- ❌ Marketplace UI incomplete

**Required Implementation:**
- List card: validate ownership, check not in auction, set forSale=true + price
- Cancel listing: validate ownership, reset forSale=false
- Buy card: atomic transaction (debit buyer → credit seller → transfer card → mark sold)
- Browse listings with filters (rarity, position, price range)
- DB transaction wrapping for purchases
- Concurrency protection (optimistic locking or SELECT...FOR UPDATE)

#### E) Auctions
**Status:** Tables exist, ZERO routes or logic implemented

**Missing:**
- ❌ All auction routes missing:
  - `POST /api/auction/create`
  - `POST /api/auction/bid/:id`
  - `POST /api/auction/cancel/:id`
  - `POST /api/auction/settle/:id`
  - `GET /api/auction/active`
  - `GET /api/auction/:id`
- ❌ No bid validation logic
- ❌ No hold placement on bids
- ❌ No outbid refund logic
- ❌ No auction settlement (winner charge + card transfer)
- ❌ No auction expiry detection
- ❌ No background job/cron for auto-settlement
- ❌ Auction UI missing entirely

**Required Implementation:**
- Create auction: validate ownership, set start/end times, reserve/startPrice
- Place bid: validate amount > currentBid + minIncrement, place hold on bidder wallet
- Outbid handling: release previous bidder's hold automatically
- Buy now: instant settlement if buyNowPrice provided
- Cancel auction: only if no bids, release card
- Settle auction: convert winner's hold to debit, credit seller, transfer card
- Background job to settle expired auctions (cron or manual trigger)
- Auction detail page with live bidding
- Countdown timer UI

#### F) Competitions & Rewards
**Status:** Minimal implementation, most routes stub

**Missing:**
- ❌ `POST /api/competitions/enter` - renamed to `/join` but stub
- ❌ `POST /api/competitions/settle` - missing (admin only)
- ❌ `GET /api/competitions` - returns `[]`
- ❌ No lineup validation on entry
- ❌ No entry fee deduction
- ❌ No scoring integration
- ❌ No reward distribution logic
- ❌ Competition UI very minimal

**Required Implementation:**
- List active competitions with tier filtering
- Enter competition: validate lineup (1 GK, 1 DEF, 1 MID, 1 FWD, 1 Utility), deduct entry fee
- Lock lineup after competition starts
- Admin settle endpoint: calculate ranks, distribute prizes (wallet credits + cards)
- Reward notification/popup
- Competition results page

#### G) Admin Panel
**Status:** NOTHING implemented

**Missing:**
- ❌ No admin routes at all
- ❌ No admin UI page
- ❌ No user management
- ❌ No wallet top-up controls
- ❌ No auction settlement controls
- ❌ No competition management
- ❌ No logging/error dashboard

**Required Implementation:**
- Admin dashboard page (`/admin`)
- Server-side RBAC check (isAdmin middleware already exists)
- Admin routes:
  - `POST /api/admin/wallet/credit` - top up user wallet
  - `POST /api/admin/auction/settle/:id` - force settle auction
  - `POST /api/admin/competition/settle/:id` - settle competition
  - `GET /api/admin/users` - list users with pagination
  - `POST /api/admin/seed` - trigger seed scripts
  - `GET /api/admin/logs` - view audit logs
- Admin UI components

### 🔧 Engineering Issues

#### Missing Validations
- ❌ No server-side validation schemas (Zod schemas defined but not used in routes)
- ❌ No request body validation middleware
- ❌ No balance validation before debit operations
- ❌ No ownership checks before card operations

#### Missing Atomicity
- ❌ Marketplace buy not in DB transaction
- ❌ Auction settlement not in DB transaction
- ❌ Competition entry (fee deduction + entry creation) not atomic
- ❌ Wallet operations not wrapped in transactions

#### Missing Error Handling
- ❌ Generic error messages in many routes
- ❌ No structured error responses
- ❌ No logging framework (console.error only)
- ❌ No error recovery mechanisms

#### Missing Environment Variables
Current `.env.example`:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
SESSION_SECRET=
```

**Missing:**
- `DATABASE_URL` (required)
- `APP_URL` (for OAuth callbacks)
- `PORT` (optional, defaults to 5000)
- `ADMIN_USER_IDS` (comma-separated list)
- `USE_MOCK_AUTH` (dev mode)
- `MOCK_USER_ID` (dev mode)
- `NODE_ENV` (production/development)

---

## 2. Implementation Plan

### Phase 1: Core Wallet System ✓
**Priority:** CRITICAL  
**Dependencies:** None

**Tasks:**
1. Add auto-create wallet on user signup/login
2. Implement GET /api/wallet (balance + locked balance)
3. Implement GET /api/wallet/transactions (paginated)
4. Implement POST /api/admin/wallet/credit (admin only)
5. Add balance validation helper
6. Update wallet UI to show real data
7. Add transaction history component

**Acceptance Criteria:**
- User sees accurate wallet balance
- Transaction history displays correctly
- Admin can credit user wallets
- Negative balance operations rejected

---

### Phase 2: Marketplace (Buy/Sell) ✓
**Priority:** HIGH  
**Dependencies:** Wallet system

**Tasks:**
1. Implement POST /api/marketplace/list
   - Validate ownership
   - Check card not in auction
   - Set forSale=true, price=X
2. Implement POST /api/marketplace/cancel/:listingId
   - Validate ownership
   - Set forSale=false, price=0
3. Implement POST /api/marketplace/buy/:listingId
   - Wrap in DB transaction:
     - Validate buyer has sufficient balance
     - Debit buyer wallet
     - Credit seller wallet
     - Transfer card ownership
     - Set forSale=false
   - Add concurrent purchase protection
4. Implement GET /api/marketplace/listings (with filters)
5. Update marketplace UI with buy/cancel flows
6. Add price input validation

**Acceptance Criteria:**
- Users can list cards with price
- Users can cancel their own listings
- Buying is atomic and concurrency-safe
- Seller receives payment immediately
- Card ownership transfers correctly

---

### Phase 3: Auctions System ✓
**Priority:** HIGH  
**Dependencies:** Wallet system (holds)

**Tasks:**
1. Implement POST /api/auction/create
   - Validate ownership, not already listed
   - Set start/end times, prices
2. Implement POST /api/auction/bid/:id
   - Validate bid amount rules
   - Place hold on bidder wallet
   - Release previous bidder's hold
3. Implement POST /api/auction/buy-now/:id (optional)
   - Instant settlement at buyNowPrice
4. Implement POST /api/auction/cancel/:id
   - Only if no bids
5. Implement POST /api/auction/settle/:id
   - Charge winner (convert hold to debit)
   - Credit seller
   - Transfer card
   - Mark auction settled
6. Implement GET /api/auction/active
7. Implement GET /api/auction/:id
8. Add background job/cron for auto-settlement
9. Build auction detail UI with countdown
10. Add bid history display

**Acceptance Criteria:**
- Users can create auctions with reserve/buy-now prices
- Bidding places holds correctly
- Outbid users get refunds automatically
- Auctions settle correctly (winner charged, seller paid, card transferred)
- Expired auctions settle automatically
- Auctions without bids can be cancelled

---

### Phase 4: Competitions & Rewards ✓
**Priority:** MEDIUM  
**Dependencies:** Wallet system

**Tasks:**
1. Implement GET /api/competitions (filter by status/tier)
2. Implement POST /api/competitions/enter
   - Validate lineup (1 GK, 1 DEF, 1 MID, 1 FWD, 1 Utility)
   - Deduct entry fee (in transaction)
3. Implement POST /api/admin/competitions/settle
   - Calculate ranks based on totalScore
   - Distribute prizes (top 60%, 30%, 10%)
   - Credit wallets
   - Assign prize cards if applicable
4. Add competition entry UI
5. Add lineup builder validation
6. Add reward notification

**Acceptance Criteria:**
- Users can view active competitions
- Lineup validation prevents invalid entries
- Entry fee deducted correctly
- Admin can settle competitions
- Prizes distributed to top finishers
- Users see rewards in wallet

---

### Phase 5: Admin Panel ✓
**Priority:** MEDIUM  
**Dependencies:** All core systems

**Tasks:**
1. Create /admin page with RBAC check
2. Implement admin routes:
   - POST /api/admin/wallet/credit
   - POST /api/admin/auction/settle/:id
   - POST /api/admin/competition/settle/:id
   - GET /api/admin/users (paginated)
   - POST /api/admin/seed
   - GET /api/admin/logs
3. Build admin UI components:
   - User management table
   - Wallet credit form
   - Auction settlement controls
   - Competition management
   - Seed data trigger
   - Audit log viewer

**Acceptance Criteria:**
- Only admin users can access /admin
- Admin can credit any user's wallet
- Admin can force settle auctions/competitions
- Admin can view all users and their balances
- Admin can trigger seed scripts
- Admin can view audit logs

---

### Phase 6: Seed Data & Testing ✓
**Priority:** HIGH  
**Dependencies:** All systems

**Tasks:**
1. Extend seed.ts with:
   - Demo users (buyer, seller, admin)
   - Demo player cards with various rarities
   - Demo marketplace listings
   - Demo auctions (active, expired)
   - Demo competitions (open, active, completed)
   - Demo transactions
2. Add idempotent seed script execution
3. Create manual test plan document
4. Add acceptance test checklist

**Acceptance Criteria:**
- Running seed creates realistic demo data
- Seed script is idempotent (can run multiple times)
- All user flows can be tested with seed data

---

### Phase 7: Documentation & Polish ✓
**Priority:** MEDIUM  
**Dependencies:** All features complete

**Tasks:**
1. Update README.md:
   - Complete env var list
   - Local setup instructions
   - Railway deployment guide
   - Manual testing guide
2. Update .env.example with all required vars
3. Add API documentation (routes + payloads)
4. Add Drizzle migration script if schema changed
5. Add logging framework (winston or pino)
6. Improve error messages
7. Add request validation middleware (Zod)

**Acceptance Criteria:**
- README contains complete setup instructions
- All env vars documented
- API endpoints documented
- Error messages are clear and actionable

---

## 3. Environment Variables (Complete List)

Required for production:
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Auth (Google OAuth)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
APP_URL=https://your-app.railway.app  # or http://localhost:5000 for dev
SESSION_SECRET=random_secure_string_min_32_chars

# Admin
ADMIN_USER_IDS=google_user_id_1,google_user_id_2

# Optional (for dev/testing)
USE_MOCK_AUTH=true  # Skip real auth (dev only)
MOCK_USER_ID=test-user-1
MOCK_FIRST_NAME=Test
MOCK_LAST_NAME=User

# Server
NODE_ENV=production
PORT=5000  # Usually auto-set by Railway
```

---

## 4. Acceptance Tests Plan

### A) Auth & User
- [ ] Google login redirects to /
- [ ] Session persists across page reloads
- [ ] User record created in DB on first login
- [ ] Logout clears session and redirects to /
- [ ] Admin users can access /admin
- [ ] Non-admin users get 403 on /admin

### B) Cards & Collection
- [ ] New user triggers onboarding flow
- [ ] Onboarding shows 5 packs of 3 cards each
- [ ] User can select exactly 5 cards
- [ ] Selected cards appear in collection
- [ ] Cannot open packs twice
- [ ] Collection page shows all owned cards
- [ ] Cards display correct rarity colors

### C) Wallet
- [ ] Wallet auto-created on user signup
- [ ] GET /api/wallet shows correct balance
- [ ] Transaction history displays correctly
- [ ] Admin can credit user wallet
- [ ] Credited amount appears in transactions
- [ ] Negative balance operations rejected
- [ ] Holds display correctly in locked balance

### D) Marketplace
- [ ] List card sets forSale=true and price
- [ ] Only owner can list their cards
- [ ] Card in auction cannot be listed
- [ ] Cancel listing resets forSale=false
- [ ] Buy card deducts buyer balance, credits seller
- [ ] Card ownership transfers on purchase
- [ ] Cannot buy own listing
- [ ] Cannot buy with insufficient balance
- [ ] Concurrent purchases handled safely

### E) Auctions
- [ ] Create auction validates ownership
- [ ] Auction shows countdown timer
- [ ] Placing bid places hold on wallet
- [ ] Outbid user gets hold released
- [ ] Buy now instantly settles auction
- [ ] Cannot bid on own auction
- [ ] Cannot bid below min increment
- [ ] Auction settles automatically after endTime
- [ ] Winner charged, seller credited, card transferred
- [ ] Cancelled auction (no bids) releases card

### F) Competitions
- [ ] Active competitions listed correctly
- [ ] Entry requires valid lineup (1 GK, 1 DEF, 1 MID, 1 FWD, 1 Utility)
- [ ] Entry fee deducted from wallet
- [ ] Cannot enter with insufficient balance
- [ ] Admin can settle competition
- [ ] Prizes distributed to top 3
- [ ] Reward notification shown to winners

### G) Admin Panel
- [ ] Only admins can access /admin
- [ ] Admin can view all users
- [ ] Admin can credit user wallet
- [ ] Admin can force settle auction
- [ ] Admin can settle competition
- [ ] Admin can trigger seed scripts
- [ ] Audit logs display correctly

---

## 5. Database Migrations

If schema changes are needed:
```bash
# Generate migration
npm run db:push  # or drizzle-kit push

# For production with migrations:
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
```

Current schema is mostly complete. Only potential additions:
- Add `marketplace_listings` table (optional, currently using playerCards.forSale)
- Add `wallet_holds` table (optional, currently using wallets.lockedBalance)
- Add indexes for performance:
  - `playerCards(ownerId, forSale)`
  - `auctions(status, endsAt)`
  - `transactions(userId, createdAt DESC)`
  - `competitionEntries(competitionId, rank)`

---

## 6. Next Steps

1. **Immediate:** Implement Wallet system (Phase 1)
2. **Next:** Implement Marketplace (Phase 2)
3. **Next:** Implement Auctions (Phase 3)
4. **Next:** Complete Competitions (Phase 4)
5. **Next:** Build Admin Panel (Phase 5)
6. **Next:** Add seed data (Phase 6)
7. **Finally:** Documentation & polish (Phase 7)

**Estimated Completion:** 1-2 days for core features, 3-4 days total with polish

---

**Document Status:** Living document, will be updated as implementation progresses
