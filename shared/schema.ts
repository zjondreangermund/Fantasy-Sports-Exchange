import { relations } from "drizzle-orm";
import { pgSchema, pgEnum, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const appSchema = pgSchema("app");

export const rarityEnum = pgEnum("rarity", ["common", "rare", "unique", "epic", "legendary"]);
export const positionEnum = pgEnum("position", ["GK", "DEF", "MID", "FWD"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["deposit", "withdrawal", "marketplace_buy", "marketplace_sale", "auction_bid_lock", "auction_bid_release", "auction_sale", "tournament_entry", "tournament_payout", "tournament_refund", "admin_adjustment", "bonus_credit", "purchase", "sale", "entry_fee", "prize", "swap_fee", "auction_bid", "auction_settlement"]);
export const competitionTierEnum = pgEnum("competition_tier", ["common", "rare", "unique", "epic", "legendary"]);
export const competitionStatusEnum = pgEnum("competition_status", ["open", "upcoming", "closed", "active", "completed", "cancelled"]);
export const swapStatusEnum = pgEnum("swap_status", ["pending", "accepted", "rejected", "cancelled"]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending", "approved", "paid", "rejected"]);
export const paymentMethodEnum = pgEnum("payment_method", ["eft", "ewallet", "bank_transfer", "mobile_money", "other"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed", "cancelled", "rejected"]);
export const notificationTypeEnum = pgEnum("notification_type", ["win", "runner_up", "system"]);
export const auctionStatusEnum = pgEnum("auction_status", ["draft", "live", "ended", "cancelled", "settled"]);
export const lockReasonEnum = pgEnum("card_lock_reason", ["competition", "transfer_pending", "security_review"]);

export const users = appSchema.table("users", { id: varchar("id", { length: 255 }).primaryKey(), email: text("email"), name: text("name"), firstName: text("first_name"), lastName: text("last_name"), avatarUrl: text("avatar_url"), managerTeamName: text("manager_team_name"), isBanned: boolean("is_banned").notNull().default(false), banReason: text("ban_reason"), bannedAt: timestamp("banned_at"), bannedBy: varchar("banned_by", { length: 255 }), createdAt: timestamp("created_at").defaultNow(), updatedAt: timestamp("updated_at").defaultNow() });
export const players = appSchema.table("players", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), name: text("name").notNull(), team: text("team").notNull(), league: text("league").notNull(), position: positionEnum("position").notNull(), nationality: text("nationality").notNull(), age: integer("age").notNull(), overall: integer("overall").notNull(), imageUrl: text("image_url"), fplId: integer("fpl_id"), code: integer("code"), photo: text("photo"), webName: text("web_name"), status: text("status"), news: text("news"), nowCost: real("now_cost"), selectedByPercent: real("selected_by_percent"), totalPoints: integer("total_points"), form: real("form"), syncedAt: timestamp("synced_at") });
export const playerCards = appSchema.table("player_cards", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), playerId: integer("player_id").notNull().references(() => players.id), ownerId: varchar("owner_id", { length: 255 }).references(() => users.id), rarity: rarityEnum("rarity").notNull().default("common"), serialId: text("serial_id").unique(), serialNumber: integer("serial_number"), maxSupply: integer("max_supply").default(0), level: integer("level").notNull().default(1), xp: integer("xp").notNull().default(0), decisiveScore: integer("decisive_score").default(35), last5Scores: jsonb("last_5_scores").$type<number[]>().default([0, 0, 0, 0, 0]), forSale: boolean("for_sale").notNull().default(false), price: real("price").default(0), acquiredAt: timestamp("acquired_at").defaultNow() });
export const wallets = appSchema.table("wallets", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id).unique(), balance: real("balance").notNull().default(0), lockedBalance: real("locked_balance").notNull().default(0) });
export const transactions = appSchema.table("transactions", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id), type: transactionTypeEnum("type").notNull(), amount: real("amount").notNull(), grossAmount: real("gross_amount").default(0), feeAmount: real("fee_amount").default(0), netAmount: real("net_amount").default(0), sourceType: text("source_type").default(""), status: transactionStatusEnum("status").notNull().default("completed"), description: text("description"), paymentMethod: text("payment_method"), externalTransactionId: text("external_transaction_id"), createdAt: timestamp("created_at").defaultNow() });
export const lineups = appSchema.table("lineups", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id).unique(), cardIds: jsonb("card_ids").$type<number[]>().notNull().default([]), captainId: integer("captain_id").references(() => playerCards.id) });
export const userOnboarding = appSchema.table("user_onboarding", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id).unique(), completed: boolean("completed").notNull().default(false), packCards: jsonb("pack_cards").$type<number[][]>().default([]), selectedCards: jsonb("selected_cards").$type<number[]>().default([]) });

export const competitions = appSchema.table("competitions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(), name: text("name").notNull(), tier: competitionTierEnum("tier").notNull(), entryFee: real("entry_fee").notNull().default(0), status: competitionStatusEnum("status").notNull().default("open"), gameWeek: integer("game_week").notNull(), startDate: timestamp("start_date").notNull(), endDate: timestamp("end_date").notNull(), prizeCardRarity: rarityEnum("prize_card_rarity"), prizeType: text("prize_type").default("cash_pool"), prizeDescription: text("prize_description"), prizeKey: text("prize_key"), visibility: text("visibility").default("public"), maxEntries: integer("max_entries"), joinPin: text("join_pin"), cancelledAt: timestamp("cancelled_at"), cancelledBy: varchar("cancelled_by", { length: 255 }), cancellationReason: text("cancellation_reason"), refundTotal: real("refund_total").notNull().default(0), refundedEntryCount: integer("refunded_entry_count").notNull().default(0), createdAt: timestamp("created_at").defaultNow()
});
export const competitionEntries = appSchema.table("competition_entries", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), competitionId: integer("competition_id").notNull().references(() => competitions.id), userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id), entryFeePaid: real("entry_fee_paid").notNull().default(0), lineupCardIds: jsonb("lineup_card_ids").$type<number[]>().notNull().default([]), captainId: integer("captain_id"), totalScore: real("total_score").notNull().default(0), rank: integer("rank"), prizeAmount: real("prize_amount").default(0), prizeCardId: integer("prize_card_id").references(() => playerCards.id), tiebreakMeta: jsonb("tiebreak_meta").$type<Record<string, any>>().default({}), joinedAt: timestamp("joined_at").defaultNow() });
export const swapOffers = appSchema.table("swap_offers", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), offererUserId: varchar("offerer_user_id", { length: 255 }).notNull().references(() => users.id), receiverUserId: varchar("receiver_user_id", { length: 255 }).notNull().references(() => users.id), offeredCardId: integer("offered_card_id").notNull().references(() => playerCards.id), requestedCardId: integer("requested_card_id").notNull().references(() => playerCards.id), topUpAmount: real("top_up_amount").default(0), topUpDirection: text("top_up_direction").default("none"), status: swapStatusEnum("status").notNull().default("pending"), createdAt: timestamp("created_at").defaultNow() });
export const withdrawalRequests = appSchema.table("withdrawal_requests", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id), amount: real("amount").notNull(), fee: real("fee").notNull().default(0), netAmount: real("net_amount").notNull(), paymentMethod: text("payment_method").notNull(), bankName: text("bank_name"), accountHolder: text("account_holder"), accountNumber: text("account_number"), iban: text("iban"), swiftCode: text("swift_code"), ewalletProvider: text("ewallet_provider"), ewalletId: text("ewallet_id"), destinationKey: text("destination_key"), destinationVerified: boolean("destination_verified").notNull().default(false), verificationToken: text("verification_token"), releaseAfter: timestamp("release_after"), status: withdrawalStatusEnum("status").notNull().default("pending"), adminNotes: text("admin_notes"), reviewedAt: timestamp("reviewed_at"), createdAt: timestamp("created_at").defaultNow() });
export const auctions = appSchema.table("auctions", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), cardId: integer("card_id").notNull().references(() => playerCards.id), sellerUserId: varchar("seller_user_id", { length: 255 }).notNull().references(() => users.id), status: auctionStatusEnum("status").notNull().default("draft"), reservePrice: real("reserve_price").notNull().default(0), startPrice: real("start_price").notNull().default(0), buyNowPrice: real("buy_now_price"), minIncrement: real("min_increment").notNull().default(1), startsAt: timestamp("starts_at"), endsAt: timestamp("ends_at"), createdAt: timestamp("created_at").defaultNow() });
export const auctionBids = appSchema.table("auction_bids", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), auctionId: integer("auction_id").notNull().references(() => auctions.id), bidderUserId: varchar("bidder_user_id", { length: 255 }).notNull().references(() => users.id), amount: real("amount").notNull(), createdAt: timestamp("created_at").defaultNow() });
export const cardLocks = appSchema.table("card_locks", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), cardId: integer("card_id").notNull().references(() => playerCards.id), userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id), reason: lockReasonEnum("reason").notNull(), refId: text("ref_id"), createdAt: timestamp("created_at").defaultNow(), expiresAt: timestamp("expires_at") });
export const playerValues = appSchema.table("player_values", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), playerId: integer("player_id").notNull().references(() => players.id).unique(), baseValue: real("base_value").notNull().default(0), formMultiplier: real("form_multiplier").notNull().default(1), lastUpdated: timestamp("last_updated").defaultNow() });
export const auditLogs = appSchema.table("audit_logs", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), userId: varchar("user_id", { length: 255 }).references(() => users.id), action: text("action").notNull(), meta: jsonb("meta").$type<Record<string, any>>().default({}), createdAt: timestamp("created_at").defaultNow() });
export const idempotencyKeys = appSchema.table("idempotency_keys", { key: text("key").primaryKey(), userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id), createdAt: timestamp("created_at").defaultNow(), expiresAt: timestamp("expires_at") });
export const notifications = appSchema.table("notifications", { id: integer("id").primaryKey().generatedAlwaysAsIdentity(), userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id), type: notificationTypeEnum("type").notNull().default("system"), title: text("title").notNull(), message: text("message").notNull(), read: boolean("read").notNull().default(false), createdAt: timestamp("created_at").defaultNow() });

export const insertUserSchema = createInsertSchema(users);
export const insertPlayerSchema = createInsertSchema(players);
export const insertPlayerCardSchema = createInsertSchema(playerCards);
export const insertWalletSchema = createInsertSchema(wallets);
export const insertTransactionSchema = createInsertSchema(transactions);
export const insertLineupSchema = createInsertSchema(lineups);
export const insertOnboardingSchema = createInsertSchema(userOnboarding);
export const insertCompetitionSchema = createInsertSchema(competitions);
export const insertCompetitionEntrySchema = createInsertSchema(competitionEntries);
export const insertSwapOfferSchema = createInsertSchema(swapOffers);
export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests);
export const insertAuctionSchema = createInsertSchema(auctions);
export const insertAuctionBidSchema = createInsertSchema(auctionBids);
export const insertCardLockSchema = createInsertSchema(cardLocks);

export type User = typeof users.$inferSelect; export type InsertUser = typeof users.$inferInsert;
export type Player = typeof players.$inferSelect; export type InsertPlayer = typeof players.$inferInsert;
export type PlayerCard = typeof playerCards.$inferSelect; export type InsertPlayerCard = typeof playerCards.$inferInsert;
export type Wallet = typeof wallets.$inferSelect; export type InsertWallet = typeof wallets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect; export type InsertTransaction = typeof transactions.$inferInsert;
export type Lineup = typeof lineups.$inferSelect; export type InsertLineup = typeof lineups.$inferInsert;
export type UserOnboarding = typeof userOnboarding.$inferSelect; export type InsertOnboarding = typeof userOnboarding.$inferInsert;
export type Competition = typeof competitions.$inferSelect; export type InsertCompetition = typeof competitions.$inferInsert;
export type CompetitionEntry = typeof competitionEntries.$inferSelect; export type InsertCompetitionEntry = typeof competitionEntries.$inferInsert;
export type SwapOffer = typeof swapOffers.$inferSelect; export type InsertSwapOffer = typeof swapOffers.$inferInsert;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect; export type InsertWithdrawalRequest = typeof withdrawalRequests.$inferInsert;
export type Auction = typeof auctions.$inferSelect; export type InsertAuction = typeof auctions.$inferInsert;
export type AuctionBid = typeof auctionBids.$inferSelect; export type InsertAuctionBid = typeof auctionBids.$inferInsert;
export type CardLock = typeof cardLocks.$inferSelect; export type InsertCardLock = typeof cardLocks.$inferInsert;
export type PlayerCardWithPlayer = PlayerCard & { player: Player; ownerName?: string | null; ownerUsername?: string | null };
export type MarketplaceListing = PlayerCardWithPlayer & { owner?: User | null };
export type CompetitionWithEntries = Competition & { entries: (CompetitionEntry & { user: User })[] };

export const playerRelations = relations(players, ({ many }) => ({ cards: many(playerCards) }));
export const playerCardRelations = relations(playerCards, ({ one }) => ({ player: one(players, { fields: [playerCards.playerId], references: [players.id] }), owner: one(users, { fields: [playerCards.ownerId], references: [users.id] }) }));
export const userRelations = relations(users, ({ many, one }) => ({ cards: many(playerCards), wallet: one(wallets), lineup: one(lineups), onboarding: one(userOnboarding) }));

export const RARITY_SUPPLY = { common: 1000, rare: 100, unique: 10, epic: 3, legendary: 1 } as const;
export const PLATFORM_FEE_RATE = 0.04;
