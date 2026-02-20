# Fantasy Sports Exchange

A Sorare-inspired fantasy football platform **without blockchain**. Users collect player cards, compete in weekly competitions, and trade cards via marketplace and auctions using a digital wallet system.

## 🚀 Features

### ✅ Fully Implemented

- **Authentication**
  - Google OAuth (production)
  - Replit Auth (when on Replit)
  - Mock Auth (development/testing)
  - Session-based (PostgreSQL session store)

- **User Onboarding**
  - 5 packs of 3 cards each (15 total)
  - Choose best 5 cards for your starting lineup
  - Position-based pack distribution (GK, DEF, MID, FWD, Random)

- **Digital Wallet System**
  - Ledger-based transaction history
  - Balance + locked balance (for auction bids)
  - Deposit/withdrawal (admin approval)
  - Automatic wallet creation on signup

- **Card Collection**
  - 4 rarity tiers: Common, Rare, Unique, Legendary
  - Serial numbers for rare+ cards
  - XP and leveling system
  - Decisive score tracking

- **Marketplace (Fixed Price)**
  - List cards for sale with custom price
  - Buy cards instantly
  - Cancel listings anytime
  - Atomic transactions (concurrency-safe)

- **Auctions**
  - Create auctions with start/reserve/buy-now prices
  - Live bidding with auto-refresh
  - Bid holds on wallet (released when outbid)
  - Buy now for instant purchase
  - Auto-settlement when expired
  - Admin force-settlement

- **Competitions**
  - Weekly competitions (Common/Rare tiers)
  - Entry fees (0 for Common, 20 for Rare)
  - Lineup validation (1 GK, 1 DEF, 1 MID, 1 FWD, 1 Utility)
  - Prize distribution (60/30/10 for top 3)
  - Rewards credited to wallet

- **Admin Panel**
  - View all users with balances
  - Credit user wallets
  - Force settle auctions
  - Settle competitions
  - Approve/reject withdrawals
  - Trigger seed data
  - View audit logs

## 🛠️ Tech Stack

- **Frontend:** React 18 + Vite + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Auth:** Passport.js (Google OAuth)
- **Session:** express-session + connect-pg-simple

## 📦 Installation & Setup

### Prerequisites

- Node.js 20+ 
- PostgreSQL 14+
- npm or yarn

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd Fantasy-Sports-Exchange
npm install
```

### 2. Database Setup

**Option A: Local PostgreSQL (Recommended for Dev)**

```bash
# Install PostgreSQL
# macOS: brew install postgresql
# Ubuntu: sudo apt install postgresql
# Windows: Download from postgresql.org

# Create database
createdb fantasy_sports

# Or use psql
psql postgres
CREATE DATABASE fantasy_sports;
\q
```

**Option B: Cloud PostgreSQL**

Use Neon, Supabase, Railway, or any PostgreSQL provider and get the connection string.

### 3. Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
DATABASE_URL=postgresql://localhost:5432/fantasy_sports
SESSION_SECRET=your_random_32_char_secret

# For development (skip real auth)
USE_MOCK_AUTH=true
MOCK_USER_ID=demo-buyer-1

# For production (Google OAuth)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
APP_URL=https://your-domain.com
ADMIN_USER_IDS=your_google_user_id

NODE_ENV=development
PORT=5000
```

### 4. Initialize Database

```bash
# Push schema to database
npm run db:push

# Seed demo data
# (This will be auto-triggered on first run if no data exists)
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5000`

## 🧪 Testing & Demo

### Using Mock Auth (Development)

The app has 3 demo accounts pre-seeded:

1. **Demo Buyer** (`demo-buyer-1`)
   - Has 5 common cards
   - $1000 balance
   - Can buy from marketplace

2. **Demo Seller** (`demo-seller-1`)
   - Has 5 rare/unique cards
   - $1000 balance
   - Has active auctions

3. **Demo Admin** (`demo-admin-1`)
   - Admin privileges
   - $1000 balance
   - Can access `/admin`

To switch accounts, change `MOCK_USER_ID` in `.env` and restart server.

### Manual Testing Checklist

#### Auth & User
- [ ] Visit `/` (should redirect to onboarding if new user)
- [ ] Complete onboarding (select 5 cards)
- [ ] View collection page
- [ ] Check wallet balance shows correctly

#### Wallet
- [ ] View wallet page (`/wallet`)
- [ ] See transaction history
- [ ] Admin: Credit user wallet (`/admin`)
- [ ] Request withdrawal

#### Marketplace
- [ ] Browse marketplace listings
- [ ] Filter by rarity/position/price
- [ ] List a card for sale (Collection → List)
- [ ] Cancel a listing
- [ ] Buy a card (switch to demo-buyer-1)
- [ ] Verify card ownership transferred
- [ ] Verify payment deducted/credited

#### Auctions
- [ ] Browse active auctions
- [ ] View auction details with countdown
- [ ] Place a bid
- [ ] See bid hold in wallet (locked balance)
- [ ] Place higher bid
- [ ] Verify previous bidder's hold released
- [ ] Use "Buy Now" if available
- [ ] Admin: Force settle auction
- [ ] Verify winner charged, seller credited, card transferred

#### Competitions
- [ ] Browse competitions (Common/Rare tabs)
- [ ] Join competition with valid lineup
- [ ] Verify entry fee deducted
- [ ] Admin: Settle competition
- [ ] Verify top 3 receive prizes

#### Admin Panel
- [ ] Access `/admin` (must be admin user)
- [ ] View all users
- [ ] Credit user wallet
- [ ] Force settle auction
- [ ] Settle competition
- [ ] View withdrawal requests
- [ ] Approve/reject withdrawal
- [ ] View audit logs

## 🚀 Deployment

### Railway (Recommended)

1. **Create Railway Project**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   
   # Initialize project
   railway init
   ```

2. **Add PostgreSQL**
   - In Railway dashboard: "New" → "Database" → "PostgreSQL"
   - Connection string auto-added to `DATABASE_URL`

3. **Set Environment Variables**
   ```bash
   railway variables set SESSION_SECRET="your-32-char-secret"
   railway variables set NODE_ENV=production
   railway variables set GOOGLE_CLIENT_ID="your-client-id"
   railway variables set GOOGLE_CLIENT_SECRET="your-secret"
   railway variables set APP_URL="https://your-app.railway.app"
   railway variables set ADMIN_USER_IDS="your-google-user-id"
   ```

4. **Deploy**
   ```bash
   railway up
   ```

5. **Setup Google OAuth**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `https://your-app.railway.app/api/auth/google/callback`

### Render / Fly.io / Vercel

Similar process:
1. Connect GitHub repo
2. Add PostgreSQL database
3. Set environment variables
4. Deploy

**Note:** For Replit, set `REPL_ID` env var and Replit Auth will be used automatically.

## 📁 Project Structure

```
Fantasy-Sports-Exchange/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utils & API client
│   └── index.html
├── server/                  # Express backend
│   ├── index.ts            # Entry point
│   ├── routes.ts           # All API routes
│   ├── storage.ts          # Database layer
│   ├── seed.ts             # Seed data
│   ├── db.ts               # Drizzle client
│   └── services/           # External APIs
├── shared/
│   └── schema.ts           # Database schema (shared)
└── package.json
```

## 🔌 API Endpoints

### Auth
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/user` - Get current user
- `POST /api/auth/logout` - Logout

### Onboarding
- `POST /api/onboarding/create-offer` - Generate 5 packs
- `GET /api/onboarding/offers` - Get pack offers
- `POST /api/onboarding/choose` - Select 5 cards

### Cards
- `GET /api/cards/my` - Get user's cards
- `GET /api/players/:id` - Get player details

### Wallet
- `GET /api/wallet` - Get balance & locked balance
- `GET /api/wallet/transactions` - Transaction history (paginated)
- `POST /api/wallet/deposit` - Deposit funds (dev only)
- `POST /api/wallet/withdraw` - Request withdrawal

### Marketplace
- `GET /api/marketplace` - Browse listings (with filters)
- `POST /api/marketplace/list` - List card for sale
- `POST /api/marketplace/cancel/:cardId` - Cancel listing
- `POST /api/marketplace/buy/:cardId` - Buy card

### Auctions
- `GET /api/auctions/active` - Get active auctions
- `GET /api/auctions/:id` - Get auction details
- `POST /api/auctions/create` - Create auction
- `POST /api/auctions/:id/bid` - Place bid
- `POST /api/auctions/:id/buy-now` - Buy now
- `POST /api/auctions/:id/cancel` - Cancel auction (no bids)
- `POST /api/auctions/:id/settle` - Settle auction (admin)

### Competitions
- `GET /api/competitions` - List competitions (with filters)
- `POST /api/competitions/join` - Enter competition
- `GET /api/competitions/my-entries` - User's entries
- `POST /api/admin/competitions/settle/:id` - Settle (admin)

### Admin
- `GET /api/admin/users` - List all users
- `GET /api/admin/stats` - System statistics
- `POST /api/admin/wallet/credit` - Credit user wallet
- `POST /api/admin/seed` - Trigger seed data
- `GET /api/admin/logs` - Audit logs
- `GET /api/admin/withdrawals` - Withdrawal requests
- `POST /api/admin/withdrawals/:id/review` - Approve/reject

## 🎨 Customization

### Adding New Players

Edit `server/seed.ts` and add to `seedPlayers` array, then:

```bash
npm run db:push  # Ensure schema is up to date
# Restart server to auto-seed
```

### Changing Rarity Supply

Edit `shared/schema.ts`:

```typescript
export const RARITY_SUPPLY: Record<string, number> = {
  common: 0,       // Unlimited
  rare: 100,       // Max 100 per player
  unique: 1,       // 1-of-1
  epic: 10,
  legendary: 5,
};
```

### Modifying Prize Distribution

Edit competition settlement logic in `server/routes.ts`:

```typescript
const prizes = [
  totalPrizePool * 0.6,  // 1st: 60%
  totalPrizePool * 0.3,  // 2nd: 30%
  totalPrizePool * 0.1,  // 3rd: 10%
];
```

## 🐛 Troubleshooting

### Database Connection Issues

**Error:** `ETIMEDOUT` or `ENETUNREACH`

**Solution:**
- For cloud DB: Check IP whitelist, firewall rules
- For local DB: Verify PostgreSQL is running (`pg_ctl status`)
- Check `DATABASE_URL` format

### Session Not Persisting

**Error:** Logged out on refresh

**Solution:**
- Ensure `SESSION_SECRET` is set
- Check `trust proxy` setting in `server/index.ts`
- Verify cookie settings match your domain (secure/sameSite)

### OAuth Redirect Mismatch

**Error:** `redirect_uri_mismatch`

**Solution:**
- Match `APP_URL` in `.env` with Google Console redirect URI
- Use exact URL (with/without trailing slash matters)

### Drizzle Push Fails

**Error:** Schema validation errors

**Solution:**
```bash
# Clear Drizzle cache
rm -rf drizzle/

# Regenerate
npm run db:push
```

## 📝 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests (TODO: add test suite)
5. Submit a pull request

## 📧 Support

For issues, questions, or feature requests, please open a GitHub issue.

---

**Built with ❤️ using TypeScript + React + PostgreSQL**
