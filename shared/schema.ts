import { relations, sql } from "drizzle-orm";
import {
  pgSchema,
  pgEnum,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// -----------------------------------------------------------------------------
// IMPORTANT
// -----------------------------------------------------------------------------
// All application tables live under the `app` schema in Postgres.
// This avoids conflicts with Postgres extensions/system views in `public`.
export const appSchema = pgSchema("app");

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------
export const rarityEnum = pgEnum("rarity", ["common", "rare", "unique", "epic", "legendary"]);
export const positionEnum = pgEnum("position", ["GK", "DEF", "MID", "FWD"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit",
  "withdrawal",
  "purchase",
  "sale",
  "entry_fee",
  "prize",
  "swap_fee",
  "auction_bid",
  "auction_settlement",
]);
export const competitionTierEnum = pgEnum("competition_tier", ["common", "rare", "unique", "legendary"]);
export const competitionStatusEnum = pgEnum("competition_status", ["open", "upcoming", "active", "completed"]);
export const swapStatusEnum = pgEnum("swap_status", ["pending", "accepted", "rejected", "cancelled"]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending", "processing", "completed", "rejected"]);
export const paymentMethodEnum = pgEnum("payment_method", ["eft", "ewallet", "bank_transfer", "mobile_money", "other"]);
export const notificationTypeEnum = pgEnum("notification_type", ["win", "runner_up", "system"]);

export const auctionStatusEnum = pgEnum("auction_status", ["draft", "live", "ended", "cancelled", "settled"]);
export const lockReasonEnum = pgEnum("card_lock_reason", ["competition", "transfer_pending", "security_review"]);

// -----------------------------------------------------------------------------
// Users (simple table for FK references)
// -----------------------------------------------------------------------------
// Your auth layer can populate this table on first login (recommended).
// Keeping this in shared/schema.ts prevents drizzle-kit from failing due to
// missing imports (like ./models/auth).
export const users = appSchema.table("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: text("email"),
  name: text("name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatarUrl: text("avatar_url"),
  managerTeamName: text("manager_team_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// -----------------------------------------------------------------------------
// Core football data
// -----------------------------------------------------------------------------
export const players = appSchema.table("players", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  team: text("team").notNull(),
  league: text("league").notNull(),
  position: positionEnum("position").notNull(),
  nationality: text("nationality").notNull(),
  age: integer("age").notNull(),
  overall: integer("overall").notNull(),
  imageUrl: text("image_url"),
});

export const playerCards = appSchema.table("player_cards", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  playerId: integer("player_id").notNull().references(() => players.id),
  ownerId: varchar("owner_id", { length: 255 }).references(() => users.id),
  rarity: rarityEnum("rarity").notNull().default("common"),
  serialId: text("serial_id").unique(),
  serialNumber: integer("serial_number"),
  maxSupply: integer("max_supply").default(0),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  decisiveScore: integer("decisive_score").default(35),
  last5Scores: jsonb("last_5_scores").$type<number[]>().default([0, 0, 0, 0, 0]),
  // fixed-price sale flags
  forSale: boolean("for_sale").notNull().default(false),
  price: real("price").default(0),
  acquiredAt: timestamp("acquired_at").defaultNow(),
});

// -----------------------------------------------------------------------------
// Wallet
// -----------------------------------------------------------------------------
export const wallets = appSchema.table("wallets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id).unique(),
  balance: real("balance").notNull().default(0),
  lockedBalance: real("locked_balance").notNull().default(0),
});

export const transactions = appSchema.table("transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  type: transactionTypeEnum("type").notNull(),
  amount: real("amount").notNull(),
  description: text("description"),
  paymentMethod: text("payment_method"),
  externalTransactionId: text("external_transaction_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// -----------------------------------------------------------------------------
// Lineups / competitions
// -----------------------------------------------------------------------------
export const lineups = appSchema.table("lineups", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id).unique(),
  cardIds: jsonb("card_ids").$type<number[]>().notNull().default([]),
  captainId: integer("captain_id").references(() => playerCards.id),
});

export const userOnboarding = appSchema.table("user_onboarding", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id).unique(),
  completed: boolean("completed").notNull().default(false),
  packCards: jsonb("pack_cards").$type<number[][]>().default([]),
  selectedCards: jsonb("selected_cards").$type<number[]>().default([]),
});

export const competitions = appSchema.table("competitions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  tier: competitionTierEnum("tier").notNull(),
  entryFee: real("entry_fee").notNull().default(0),
  status: competitionStatusEnum("status").notNull().default("open"),
  gameWeek: integer("game_week").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  prizeCardRarity: rarityEnum("prize_card_rarity"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const competitionEntries = appSchema.table("competition_entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  competitionId: integer("competition_id").notNull().references(() => competitions.id),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  lineupCardIds: jsonb("lineup_card_ids").$type<number[]>().notNull().default([]),
  captainId: integer("captain_id"),
  totalScore: real("total_score").notNull().default(0),
  rank: integer("rank"),
  prizeAmount: real("prize_amount").default(0),
  prizeCardId: integer("prize_card_id").references(() => playerCards.id),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// -----------------------------------------------------------------------------
// Swaps / withdrawals
// -----------------------------------------------------------------------------
export const swapOffers = appSchema.table("swap_offers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  offererUserId: varchar("offerer_user_id", { length: 255 }).notNull().references(() => users.id),
  receiverUserId: varchar("receiver_user_id", { length: 255 }).notNull().references(() => users.id),
  offeredCardId: integer("offered_card_id").notNull().references(() => playerCards.id),
  requestedCardId: integer("requested_card_id").notNull().references(() => playerCards.id),
  topUpAmount: real("top_up_amount").default(0),
  topUpDirection: text("top_up_direction").default("none"),
  status: swapStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const withdrawalRequests = appSchema.table("withdrawal_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  amount: real("amount").notNull(),
  fee: real("fee").notNull().default(0),
  netAmount: real("net_amount").notNull(),
  paymentMethod: text("payment_method").notNull(),
  bankName: text("bank_name"),
  accountHolder: text("account_holder"),
  accountNumber: text("account_number"),
  iban: text("iban"),
  swiftCode: text("swift_code"),
  ewalletProvider: text("ewallet_provider"),
  ewalletId: text("ewallet_id"),
  destinationKey: text("destination_key"),
  destinationVerified: boolean("destination_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  releaseAfter: timestamp("release_after"),
  status: withdrawalStatusEnum("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// -----------------------------------------------------------------------------
// Auctions + card locks (for competitions / abuse prevention)
// -----------------------------------------------------------------------------
export const auctions = appSchema.table("auctions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  cardId: integer("card_id").notNull().references(() => playerCards.id),
  sellerUserId: varchar("seller_user_id", { length: 255 }).notNull().references(() => users.id),
  status: auctionStatusEnum("status").notNull().default("draft"),
  reservePrice: real("reserve_price").notNull().default(0),
  startPrice: real("start_price").notNull().default(0),
  buyNowPrice: real("buy_now_price"),
  minIncrement: real("min_increment").notNull().default(1),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auctionBids = appSchema.table("auction_bids", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  auctionId: integer("auction_id").notNull().references(() => auctions.id),
  bidderUserId: varchar("bidder_user_id", { length: 255 }).notNull().references(() => users.id),
  amount: real("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cardLocks = appSchema.table("card_locks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  cardId: integer("card_id").notNull().references(() => playerCards.id),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  reason: lockReasonEnum("reason").notNull(),
  refId: text("ref_id"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const playerValues = appSchema.table("player_values", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  playerId: integer("player_id").notNull().references(() => players.id).unique(),
  baseValue: real("base_value").notNull().default(0),
  formMultiplier: real("form_multiplier").notNull().default(1),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const auditLogs = appSchema.table("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id", { length: 255 }).references(() => users.id),
  action: text("action").notNull(),
  meta: jsonb("meta").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const idempotencyKeys = appSchema.table("idempotency_keys", {
  key: text("key").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const notifications = appSchema.table("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  type: notificationTypeEnum("type").notNull().default("system"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// -----------------------------------------------------------------------------
// Constants / helpers
// -----------------------------------------------------------------------------
export const RARITY_SUPPLY: Record<string, number> = {
  common: 0,
  rare: 100,
  unique: 1,
  epic: 10,
  legendary: 5,
};

export const DECISIVE_LEVELS: { level: number; points: number }[] = [
  { level: 0, points: 35 },
  { level: 1, points: 60 },
  { level: 2, points: 70 },
  { level: 3, points: 80 },
  { level: 4, points: 90 },
  { level: 5, points: 100 },
];

export function calculateDecisiveLevel(stats: {
  goals?: number;
  assists?: number;
  cleanSheets?: number;
  penaltySaves?: number;
  redCards?: number;
  ownGoals?: number;
  errorsLeadingToGoal?: number;
}): { level: number; points: number } {
  const positives =
    (stats.goals ?? 0) + (stats.assists ?? 0) + (stats.cleanSheets ?? 0) + (stats.penaltySaves ?? 0);
  const negatives = (stats.redCards ?? 0) + (stats.ownGoals ?? 0) + (stats.errorsLeadingToGoal ?? 0);
  const rawLevel = Math.max(0, Math.min(5, positives - negatives));
  return DECISIVE_LEVELS[rawLevel];
}

export const SITE_FEE_RATE = 0.08;

// -----------------------------------------------------------------------------
// Relations
// -----------------------------------------------------------------------------
export const playersRelations = relations(players, ({ many }) => ({
  cards: many(playerCards),
}));

export const playerCardsRelations = relations(playerCards, ({ one }) => ({
  player: one(players, { fields: [playerCards.playerId], references: [players.id] }),
  owner: one(users, { fields: [playerCards.ownerId], references: [users.id] }),
}));

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, { fields: [wallets.userId], references: [users.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
}));

export const lineupsRelations = relations(lineups, ({ one }) => ({
  user: one(users, { fields: [lineups.userId], references: [users.id] }),
}));

export const userOnboardingRelations = relations(userOnboarding, ({ one }) => ({
  user: one(users, { fields: [userOnboarding.userId], references: [users.id] }),
}));

export const competitionsRelations = relations(competitions, ({ many }) => ({
  entries: many(competitionEntries),
}));

export const competitionEntriesRelations = relations(competitionEntries, ({ one }) => ({
  competition: one(competitions, { fields: [competitionEntries.competitionId], references: [competitions.id] }),
  user: one(users, { fields: [competitionEntries.userId], references: [users.id] }),
}));

export const auctionsRelations = relations(auctions, ({ one, many }) => ({
  card: one(playerCards, { fields: [auctions.cardId], references: [playerCards.id] }),
  seller: one(users, { fields: [auctions.sellerUserId], references: [users.id] }),
  bids: many(auctionBids),
}));

export const auctionBidsRelations = relations(auctionBids, ({ one }) => ({
  auction: one(auctions, { fields: [auctionBids.auctionId], references: [auctions.id] }),
  bidder: one(users, { fields: [auctionBids.bidderUserId], references: [users.id] }),
}));

export const cardLocksRelations = relations(cardLocks, ({ one }) => ({
  card: one(playerCards, { fields: [cardLocks.cardId], references: [playerCards.id] }),
  user: one(users, { fields: [cardLocks.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

// -----------------------------------------------------------------------------
// Zod insert schemas + Types
// -----------------------------------------------------------------------------
export const insertUserSchema = createInsertSchema(users);
export const insertPlayerSchema = createInsertSchema(players);
export const insertPlayerCardSchema = createInsertSchema(playerCards);
export const insertWalletSchema = createInsertSchema(wallets);
export const insertTransactionSchema = createInsertSchema(transactions);
export const insertLineupSchema = createInsertSchema(lineups);
export const insertOnboardingSchema = createInsertSchema(userOnboarding);
export const insertCompetitionSchema = createInsertSchema(competitions);
export const insertCompetitionEntrySchema = createInsertSchema(competitionEntries);
export const insertAuctionSchema = createInsertSchema(auctions);
export const insertAuctionBidSchema = createInsertSchema(auctionBids);
export const insertCardLockSchema = createInsertSchema(cardLocks);
export const insertPlayerValueSchema = createInsertSchema(playerValues);
export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const insertIdempotencySchema = createInsertSchema(idempotencyKeys);
export const insertNotificationSchema = createInsertSchema(notifications);

export type InsertUserInput = z.infer<typeof insertUserSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayerInput = z.infer<typeof insertPlayerSchema>;
export type PlayerCard = typeof playerCards.$inferSelect;
export type InsertPlayerCardInput = z.infer<typeof insertPlayerCardSchema>;
export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Lineup = typeof lineups.$inferSelect;
export type UserOnboarding = typeof userOnboarding.$inferSelect;
export type Competition = typeof competitions.$inferSelect;
export type CompetitionEntry = typeof competitionEntries.$inferSelect;
export type Auction = typeof auctions.$inferSelect;
export type AuctionBid = typeof auctionBids.$inferSelect;
export type CardLock = typeof cardLocks.$inferSelect;
export type PlayerValue = typeof playerValues.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type User = typeof users.$inferSelect;

export type PlayerCardWithPlayer = PlayerCard & {
  player: Player;
  ownerUsername?: string;
  ownerName?: string;
};
export type CompetitionWithEntries = Competition & { entries: CompetitionEntry[]; entryCount: number };

// -----------------------------------------------------------------------------
// Inferred types for inserts/selects (used by server/storage)
// -----------------------------------------------------------------------------
export type InsertUser = typeof users.$inferInsert;
export type InsertPlayer = typeof players.$inferInsert;
export type InsertPlayerCard = typeof playerCards.$inferInsert;
export type InsertWallet = typeof wallets.$inferInsert & { balance?: number; lockedBalance?: number };
export type InsertTransaction = typeof transactions.$inferInsert & { 
  description?: string; 
  paymentMethod?: string; 
  externalTransactionId?: string;
};
export type InsertLineup = typeof lineups.$inferInsert;
export type InsertOnboarding = typeof userOnboarding.$inferInsert;
export type InsertCompetition = typeof competitions.$inferInsert;
export type InsertCompetitionEntry = typeof competitionEntries.$inferInsert & { 
  lineupCardIds?: number[];
  captainId?: number;
  totalScore?: number;
};
export type InsertSwapOffer = typeof swapOffers.$inferInsert;
export type InsertNotification = typeof notifications.$inferInsert;
export type InsertWithdrawalRequest = typeof withdrawalRequests.$inferInsert & { 
  fee?: number;
  status?: "pending" | "processing" | "completed" | "rejected";
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  iban?: string;
  swiftCode?: string;
  ewalletProvider?: string;
  ewalletId?: string;
};

export type SwapOffer = typeof swapOffers.$inferSelect;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;

// FPL API Types
export type EplPlayer = {
  id: number;
  name: string;
  rating?: number | string;
  goals?: number;
  assists?: number;
  appearances?: number;
  minutes?: number;
  position?: string;
  club?: string;
  team?: string;
  photo?: string;
  photoUrl?: string;
  imageUrl?: string;
  image_url?: string;
  clubLogo?: string;
  teamLogo?: string;
  club_logo?: string;
  team_logo?: string;
  firstname?: string;
  lastname?: string;
  firstName?: string;
  lastName?: string;
  age?: number;
  nationality?: string;
  stats?: any;
};

export type EplFixture = {
  id: number;
  gameweek?: number;
  round?: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  status: string;
  kickoffTime?: string;
  matchDate?: string;
  homeTeamLogoUrl?: string;
  homeTeamLogo?: string;
  awayTeamLogoUrl?: string;
  awayTeamLogo?: string;
  homeGoals?: number;
  awayGoals?: number;
  elapsed?: number;
  venue?: string;
};

export type EplInjury = {
  id?: number;
  playerId: number;
  playerName: string;
  playerPhoto?: string;
  status: string;
  expectedReturn?: string;
};

export type EplStanding = {
  position: number;
  rank?: number;
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference?: number;
  goalDiff?: number;
  points: number;
  logo?: string;
  teamLogo?: string;
  form?: string;
};
