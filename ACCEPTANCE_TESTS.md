# Fantasy Sports Exchange - Acceptance Tests

**Version:** 1.0  
**Date:** February 20, 2026  
**Status:** Ready for Testing

## Test Environment Setup

### Prerequisites
```bash
# 1. Set up database
DATABASE_URL=postgresql://localhost:5432/fantasy_sports

# 2. Use mock auth
USE_MOCK_AUTH=true
MOCK_USER_ID=demo-buyer-1

# 3. Ensure seed data exists
npm run dev  # Will auto-seed on first run
```

### Test Accounts
- **Buyer:** `demo-buyer-1` (5 common cards, $1000)
- **Seller:** `demo-seller-1` (5 rare/unique cards, $1000, has auctions)
- **Admin:** `demo-admin-1` (admin access, $1000)

To switch accounts: Change `MOCK_USER_ID` in `.env` and restart.

---

## A) Auth & User Tests

### A1: New User Registration & Onboarding
**Steps:**
1. Set `MOCK_USER_ID=new-test-user-1` in `.env`
2. Restart server
3. Visit `http://localhost:5000`
4. Should redirect to `/onboarding`
5. Click "Open Packs"
6. Verify 5 packs displayed
7. Click to open each pack
8. Select exactly 5 cards total
9. Click "Confirm Selection"
10. Should see success message and confetti

**Expected:**
- [x] Redirected to onboarding
- [x] 5 packs of 3 cards shown
- [x] Can select 5 cards
- [x] Cannot submit with <5 or >5 cards
- [x] Success redirects to `/collection`
- [x] Selected cards appear in collection

### A2: User Session Persistence
**Steps:**
1. Complete onboarding as above
2. Refresh page
3. Navigate between pages
4. Close browser, reopen

**Expected:**
- [x] User stays logged in after refresh
- [x] No re-authentication required
- [x] Session persists for 7 days

### A3: Admin Access Control
**Steps:**
1. Set `MOCK_USER_ID=demo-buyer-1` (non-admin)
2. Visit `/admin`
3. Should see 403 error
4. Set `MOCK_USER_ID=demo-admin-1`
5. Add to `ADMIN_USER_IDS=demo-admin-1`
6. Restart, visit `/admin`

**Expected:**
- [x] Non-admin gets 403 Forbidden
- [x] Admin can access `/admin`
- [x] Admin sees dashboard with stats

---

## B) Cards & Collection Tests

### B1: View Collection
**Steps:**
1. Set `MOCK_USER_ID=demo-buyer-1`
2. Visit `/collection`

**Expected:**
- [x] Shows all owned cards
- [x] Cards display player name, team, position
- [x] Rarity colors displayed correctly
- [x] Can filter by rarity
- [x] Can search by player name

### B2: Card Details
**Steps:**
1. Click any card in collection
2. View modal/details

**Expected:**
- [x] Shows full player stats
- [x] Shows serial number (for rare+)
- [x] Shows level and XP
- [x] Shows last 5 scores
- [x] Shows "List for Sale" button

### B3: Prevent Duplicate Onboarding
**Steps:**
1. Complete onboarding once
2. Try to access `/onboarding` again
3. Or try calling `POST /api/onboarding/create-offer`

**Expected:**
- [x] Redirects to collection
- [x] API returns "already completed" error
- [x] Cannot re-roll packs

---

## C) Wallet Tests

### C1: View Wallet Balance
**Steps:**
1. Set `MOCK_USER_ID=demo-buyer-1`
2. Visit `/wallet`

**Expected:**
- [x] Shows available balance ($1000 initially)
- [x] Shows locked balance (if any bids placed)
- [x] Shows total balance
- [x] Currency displayed (USD)

### C2: Transaction History
**Steps:**
1. View `/wallet` page
2. Scroll to transaction history

**Expected:**
- [x] Shows all transactions
- [x] Each transaction has: type, amount, description, date
- [x] Sorted by date (newest first)
- [x] Pagination works if >50 transactions

### C3: Admin Credit Wallet
**Steps:**
1. Set `MOCK_USER_ID=demo-admin-1`
2. Visit `/admin`
3. Find "Credit Wallet" section
4. Enter `demo-buyer-1` and amount `500`
5. Click "Credit"
6. Switch to `demo-buyer-1` and check wallet

**Expected:**
- [x] Admin can credit any user
- [x] Buyer's balance increases by $500
- [x] Transaction appears in history
- [x] Description shows "Admin credit"

### C4: Insufficient Balance Validation
**Steps:**
1. Set `MOCK_USER_ID=demo-buyer-1`
2. Try to buy a card priced at $2000 (balance = $1000)

**Expected:**
- [x] Purchase fails with "Insufficient balance" error
- [x] No money deducted
- [x] Card ownership unchanged

### C5: Negative Balance Prevention
**Steps:**
1. Attempt any transaction that would result in negative balance

**Expected:**
- [x] Transaction rejected
- [x] Error message displayed
- [x] Balance remains non-negative

---

## D) Marketplace Tests

### D1: Browse Listings
**Steps:**
1. Visit `/marketplace`

**Expected:**
- [x] Shows all listed cards (forSale=true)
- [x] Displays price, player, rarity
- [x] Can filter by rarity
- [x] Can filter by position
- [x] Can filter by price range
- [x] Own listings show "Cancel" button

### D2: List Card for Sale
**Steps:**
1. Set `MOCK_USER_ID=demo-buyer-1`
2. Visit `/collection`
3. Select a card
4. Click "List for Sale"
5. Enter price: `50`
6. Submit

**Expected:**
- [x] Card appears in marketplace
- [x] Card shows "Listed" badge in collection
- [x] Card has price displayed
- [x] Can view listing in marketplace

### D3: Cancel Listing
**Steps:**
1. From marketplace, find your listing
2. Click "Cancel Listing"
3. Confirm

**Expected:**
- [x] Card removed from marketplace
- [x] Card no longer shows "Listed" badge
- [x] Price reset to 0
- [x] Card still in your collection

### D4: Buy Card (Atomic Transaction)
**Steps:**
1. Set `MOCK_USER_ID=demo-seller-1`
2. List a card for $75
3. Note initial balances (buyer: $1000, seller: $1000)
4. Switch to `MOCK_USER_ID=demo-buyer-1`
5. Buy the card

**Expected:**
- [x] Buyer balance: $1000 - $75 = $925
- [x] Seller balance: $1000 + $75 = $1075
- [x] Card ownership transferred to buyer
- [x] Card removed from marketplace (forSale=false)
- [x] Both users have transaction records
- [x] All changes are atomic (no partial state)

### D5: Concurrent Purchase Protection
**Steps:**
1. Open marketplace in 2 browser windows
2. Both logged in as different users
3. Try to buy same card simultaneously

**Expected:**
- [x] Only one purchase succeeds
- [x] Second attempt gets "Card no longer available" error
- [x] No double-payment
- [x] Card only transferred once

### D6: Cannot Buy Own Listing
**Steps:**
1. List a card
2. Try to buy your own card

**Expected:**
- [x] Purchase fails with "Cannot buy your own card"
- [x] No transaction created

---

## E) Auction Tests

### E1: Browse Active Auctions
**Steps:**
1. Visit `/auctions` or marketplace auction tab
2. View active auctions

**Expected:**
- [x] Shows all live auctions
- [x] Displays current bid (or start price)
- [x] Shows countdown timer
- [x] Shows bid count
- [x] Shows buy-now price (if set)

### E2: View Auction Details
**Steps:**
1. Click an auction
2. View details page

**Expected:**
- [x] Shows card details
- [x] Shows auction end time with countdown
- [x] Shows bid history
- [x] Shows current highest bid
- [x] Shows "Place Bid" form
- [x] Shows "Buy Now" button (if applicable)

### E3: Create Auction
**Steps:**
1. Set `MOCK_USER_ID=demo-seller-1`
2. Go to collection
3. Select a card
4. Click "Create Auction"
5. Set start price: $50
6. Set buy-now: $150
7. Set duration: 24 hours
8. Submit

**Expected:**
- [x] Auction created with status "live"
- [x] Appears in active auctions
- [x] Card no longer available for sale listing
- [x] Countdown timer starts

### E4: Place Bid
**Steps:**
1. Set `MOCK_USER_ID=demo-buyer-1`
2. View an auction
3. Current bid: $50
4. Place bid: $60
5. Check wallet

**Expected:**
- [x] Bid placed successfully
- [x] Balance unchanged
- [x] Locked balance increased by $60
- [x] Buyer is highest bidder
- [x] Bid appears in auction history

### E5: Outbid & Hold Release
**Steps:**
1. Buyer 1 bids $60 (hold placed)
2. Switch to `demo-seller-1` (different user)
3. Bid $70

**Expected:**
- [x] Seller's bid placed
- [x] Seller's hold: $70
- [x] Buyer 1's hold released (back to available balance)
- [x] Seller is now highest bidder

### E6: Buy Now
**Steps:**
1. Set `MOCK_USER_ID=demo-buyer-1`
2. Find auction with buy-now price
3. Click "Buy Now"
4. Confirm

**Expected:**
- [x] Buyer charged buy-now price
- [x] Seller credited immediately
- [x] Card transferred to buyer
- [x] Auction status changed to "settled"
- [x] All bidders' holds released
- [x] Transactions created

### E7: Cannot Bid on Own Auction
**Steps:**
1. Create auction as demo-seller-1
2. Try to bid on it

**Expected:**
- [x] Bid fails with "Cannot bid on your own auction"
- [x] No hold placed

### E8: Minimum Increment Validation
**Steps:**
1. Current bid: $50, min increment: $5
2. Try to bid $52 (only +$2)

**Expected:**
- [x] Bid rejected
- [x] Error: "Bid must be at least $55"

### E9: Cancel Auction (No Bids)
**Steps:**
1. Create auction
2. Immediately cancel before any bids

**Expected:**
- [x] Auction cancelled
- [x] Card returned to collection
- [x] Status changed to "cancelled"

### E10: Cannot Cancel Auction (Has Bids)
**Steps:**
1. Create auction
2. Someone places a bid
3. Try to cancel

**Expected:**
- [x] Cancel fails with "Cannot cancel auction with bids"
- [x] Auction remains active

### E11: Admin Force Settle Auction
**Steps:**
1. Set `MOCK_USER_ID=demo-admin-1`
2. Visit `/admin`
3. Find "Settle Auction" section
4. Enter auction ID
5. Click "Settle"

**Expected:**
- [x] Auction settled immediately
- [x] Winner charged
- [x] Seller credited
- [x] Card transferred
- [x] All other bidders' holds released
- [x] Status changed to "settled"

### E12: Auto-Settlement on Expiry
**Steps:**
1. Create auction with 1-hour duration
2. Wait for expiry (or manually trigger)
3. Check auction status

**Expected:**
- [x] Auction auto-settled after expiry
- [x] Same outcome as manual settlement
- [x] If no bids: status = "ended"
- [x] If reserve not met: status = "ended", hold released

---

## F) Competition Tests

### F1: Browse Competitions
**Steps:**
1. Visit `/competitions`

**Expected:**
- [x] Shows Common and Rare tier tabs
- [x] Displays competition details (name, entry fee, dates)
- [x] Shows participant count
- [x] Shows status (open/active/completed)

### F2: Join Competition (Valid Lineup)
**Steps:**
1. Set `MOCK_USER_ID=demo-buyer-1` (has 5 common cards)
2. Select: 1 GK, 1 DEF, 1 MID, 1 FWD, 1 any
3. Click "Join Competition"

**Expected:**
- [x] Entry successful
- [x] Entry fee deducted (if applicable)
- [x] Lineup locked
- [x] Cannot edit lineup after lock
- [x] Entry appears in "My Entries"

### F3: Invalid Lineup Validation
**Steps:**
1. Try to join with: 2 GK, 0 DEF, 2 MID, 1 FWD

**Expected:**
- [x] Entry rejected
- [x] Error: "Invalid lineup: must have 1 GK, 1 DEF, 1 MID, 1 FWD, and 1 Utility"
- [x] No fee deducted

### F4: Insufficient Balance for Entry Fee
**Steps:**
1. Rare competition entry fee: $20
2. User balance: $10
3. Try to join

**Expected:**
- [x] Entry rejected
- [x] Error: "Insufficient balance for entry fee"
- [x] No entry created

### F5: Cannot Join Twice
**Steps:**
1. Join competition
2. Try to join same competition again

**Expected:**
- [x] Second entry rejected
- [x] Error: "Already entered this competition"
- [x] No duplicate fee charged

### F6: Admin Settle Competition
**Steps:**
1. Set `MOCK_USER_ID=demo-admin-1`
2. Visit `/admin`
3. Find "Settle Competition" section
4. Enter competition ID
5. Click "Settle"

**Expected:**
- [x] Competition settled
- [x] Ranks assigned based on scores
- [x] Top 3 receive prizes:
  - 1st: 60% of prize pool
  - 2nd: 30%
  - 3rd: 10%
- [x] Prize amounts credited to wallets
- [x] Transactions created
- [x] Competition status = "completed"

### F7: View Rewards
**Steps:**
1. Win competition as demo-buyer-1
2. Visit `/wallet` or `/rewards`

**Expected:**
- [x] Reward transaction appears
- [x] Balance increased by prize amount
- [x] Description shows competition name + rank
- [x] Reward notification displayed

---

## G) Admin Panel Tests

### G1: Access Control
**Steps:**
1. Try to access `/admin` as non-admin
2. Try to access as admin

**Expected:**
- [x] Non-admin: 403 Forbidden or redirect
- [x] Admin: Dashboard displayed

### G2: View All Users
**Steps:**
1. Visit `/admin`
2. View users table

**Expected:**
- [x] Shows all users
- [x] Displays: ID, email, name, balance, created date
- [x] Pagination works
- [x] Can search/filter users

### G3: System Stats
**Steps:**
1. View admin dashboard

**Expected:**
- [x] Shows total users
- [x] Shows total cards
- [x] Shows total auctions
- [x] Shows total competitions
- [x] Shows transaction count

### G4: Trigger Seed Data
**Steps:**
1. Admin panel → "Seed Data" button
2. Click "Seed Database"

**Expected:**
- [x] Success message
- [x] New players added (if none exist)
- [x] New competitions added
- [x] Demo users created
- [x] Can be run multiple times (idempotent)

### G5: View Audit Logs
**Steps:**
1. Admin panel → "Audit Logs" tab
2. View logs

**Expected:**
- [x] Shows recent actions
- [x] Displays: user, action, timestamp, metadata
- [x] Logs are searchable
- [x] Pagination works

### G6: Manage Withdrawals
**Steps:**
1. User submits withdrawal request
2. Admin views pending withdrawals
3. Admin approves/rejects

**Expected:**
- [x] Pending withdrawals listed
- [x] Shows amount, user, payment method
- [x] Approve: deducts balance, marks completed
- [x] Reject: no balance change, marks rejected
- [x] User notified of decision

---

## H) Integration Tests

### H1: Full User Journey
**Steps:**
1. New user signs up
2. Completes onboarding (gets 5 cards)
3. Lists 1 card for sale ($50)
4. Another user buys it
5. User receives payment
6. User joins competition (fee: $20)
7. User bids on auction ($100)
8. User is outbid (hold released)
9. User creates auction for another card
10. User's auction receives bids
11. Auction expires and settles
12. User requests withdrawal

**Expected:**
- [x] All steps succeed
- [x] Balance updates correctly at each step
- [x] Cards transfer correctly
- [x] Transactions recorded accurately
- [x] No data inconsistencies

### H2: Concurrency Test
**Steps:**
1. 3 users simultaneously:
   - Bid on same auction
   - Buy same marketplace card
   - Join same competition
2. Check final state

**Expected:**
- [x] Only one wins auction
- [x] Only one buys card
- [x] All can join competition
- [x] No deadlocks
- [x] No balance inconsistencies

### H3: Error Recovery
**Steps:**
1. Simulate network failure during purchase
2. Simulate database disconnect during auction
3. Simulate server restart mid-transaction

**Expected:**
- [x] Transactions rolled back on failure
- [x] No partial states
- [x] Users can retry
- [x] Data remains consistent

---

## Testing Summary

| Module | Tests Passed | Tests Failed | Notes |
|--------|--------------|--------------|-------|
| Auth & User | 0/3 | - | Manual testing required |
| Cards & Collection | 0/3 | - | Manual testing required |
| Wallet | 0/5 | - | Manual testing required |
| Marketplace | 0/6 | - | Manual testing required |
| Auctions | 0/12 | - | Manual testing required |
| Competitions | 0/7 | - | Manual testing required |
| Admin Panel | 0/6 | - | Manual testing required |
| Integration | 0/3 | - | Manual testing required |
| **TOTAL** | **0/45** | **0** | **All tests ready** |

---

## Automated Testing (Future)

To add automated testing:

```bash
# Install test framework
npm install --save-dev vitest @testing-library/react @testing-library/user-event

# Run tests
npm test
```

Recommended test structure:
- Unit tests: `__tests__/unit/`
- Integration tests: `__tests__/integration/`
- E2E tests: `__tests__/e2e/` (Playwright or Cypress)

---

**Document Status:** Complete and ready for manual testing  
**Last Updated:** February 20, 2026
