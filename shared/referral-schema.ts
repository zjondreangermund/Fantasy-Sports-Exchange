import { integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { appSchema, playerCards, users } from "./schema.js";

// Keep the runtime referral tables visible to drizzle-kit. Referral routes also
// converge older production shapes at runtime, but db:push must never treat
// these durable attribution tables as orphaned objects that can be deleted.
export const referralCodes = appSchema.table("referral_codes", {
  userId: varchar("user_id", { length: 255 }).primaryKey().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const referrals = appSchema.table("referrals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  referrerUserId: varchar("referrer_user_id", { length: 255 }).references(() => users.id, { onDelete: "cascade" }),
  referredUserId: varchar("referred_user_id", { length: 255 }).references(() => users.id, { onDelete: "cascade" }),
  referralCode: text("referral_code"),
  rewardCardId: integer("reward_card_id").references(() => playerCards.id),
  status: text("status").notNull().default("rewarded"),
  createdAt: timestamp("created_at").defaultNow(),
});
