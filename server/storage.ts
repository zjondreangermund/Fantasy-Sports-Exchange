import {
  type Player,
  type InsertPlayer,
  type PlayerCard,
  type InsertPlayerCard,
  type Wallet,
  type InsertWallet,
  type Transaction,
  type InsertTransaction,
  type Lineup,
  type InsertLineup,
  type UserOnboarding,
  type InsertOnboarding,
  type PlayerCardWithPlayer,
  type Competition,
  type InsertCompetition,
  type CompetitionEntry,
  type InsertCompetitionEntry,
  type SwapOffer,
  type InsertSwapOffer,
  type WithdrawalRequest,
  type InsertWithdrawalRequest,
  type User,
  players,
  playerCards,
  wallets,
  transactions,
  lineups,
  userOnboarding,
  competitions,
  competitionEntries,
  swapOffers,
  withdrawalRequests,
  users,
  RARITY_SUPPLY,
} from "../shared/schema.js";

import { db } from "./db.js";
import { eq, and, or, sql, desc } from "drizzle-orm";

/**
 * Fixes TS2339 (`card` inferred as `{}`) by widening the insert type locally.
 * Your runtime shape is correct; this just makes TS happy.
 */
type InsertPlayerCardSafe = InsertPlayerCard & {
  rarity?: string | null;
  playerId?: number | null;
};

export interface IStorage {
  getUser(userId: string): Promise<User | undefined>;
  createUser(user: { id: string; email?: string; name?: string; avatarUrl?: string }): Promise<User>;
  getPlayers(): Promise<Player[]>;
  getPlayer(id: number): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;

  getPlayerCard(id: number): Promise<PlayerCard | undefined>;
  getPlayerCardWithPlayer(
    id: number,
    viewerUserId?: string,
  ): Promise<PlayerCardWithPlayer | undefined>;
  getUserCards(userId: string): Promise<PlayerCardWithPlayer[]>;
  createPlayerCard(card: InsertPlayerCardSafe): Promise<PlayerCard>;
  updatePlayerCard(id: number, updates: Partial<PlayerCard>): Promise<PlayerCard | undefined>;
  getMarketplaceListings(): Promise<PlayerCardWithPlayer[]>;

  getWallet(userId: string): Promise<Wallet | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWalletBalance(userId: string, amount: number): Promise<Wallet | undefined>;
  updateWalletLockedBalance(userId: string, amount: number): Promise<Wallet | undefined>;
  lockFunds(userId: string, amount: number): Promise<Wallet | undefined>;
  unlockFunds(userId: string, amount: number): Promise<Wallet | undefined>;

  getTransactions(userId: string): Promise<Transaction[]>;
  createTransaction(tx: InsertTransaction): Promise<Transaction>;

  getLineup(userId: string): Promise<Lineup | undefined>;
  createOrUpdateLineup(userId: string, cardIds: number[], captainId: number): Promise<Lineup>;

  getOnboarding(userId: string): Promise<UserOnboarding | undefined>;
  createOnboarding(data: InsertOnboarding | { userId: string }): Promise<UserOnboarding>;
  updateOnboarding(userId: string, updates: Partial<UserOnboarding>): Promise<UserOnboarding | undefined>;

  getPlayerCount(): Promise<number>;
  getRandomPlayers(count: number): Promise<Player[]>;
  getRandomPlayersByPosition(position: string, count: number): Promise<Player[]>;

  getCompetitions(): Promise<Competition[]>;
  getCompetition(id: number): Promise<Competition | undefined>;
  createCompetition(comp: InsertCompetition): Promise<Competition>;
  updateCompetition(id: number, updates: Partial<Competition>): Promise<Competition | undefined>;
  getCompetitionEntries(competitionId: number): Promise<CompetitionEntry[]>;
  getCompetitionEntry(competitionId: number, userId: string): Promise<CompetitionEntry | undefined>;
  createCompetitionEntry(entry: InsertCompetitionEntry): Promise<CompetitionEntry>;
  updateCompetitionEntry(id: number, updates: Partial<CompetitionEntry>): Promise<CompetitionEntry | undefined>;
  getUserCompetitions(userId: string): Promise<CompetitionEntry[]>;
  getUserRewards(userId: string): Promise<CompetitionEntry[]>;

  getSwapOffer(id: number): Promise<SwapOffer | undefined>;
  getSwapOffersForCard(cardId: number): Promise<SwapOffer[]>;
  getUserSwapOffers(userId: string): Promise<SwapOffer[]>;
  createSwapOffer(offer: InsertSwapOffer): Promise<SwapOffer>;
  updateSwapOffer(id: number, updates: Partial<SwapOffer>): Promise<SwapOffer | undefined>;

  createWithdrawalRequest(req: InsertWithdrawalRequest): Promise<WithdrawalRequest>;
  getUserWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]>;
  getAllPendingWithdrawals(): Promise<WithdrawalRequest[]>;
  getAllWithdrawals(): Promise<WithdrawalRequest[]>;
  updateWithdrawalRequest(id: number, updates: Partial<WithdrawalRequest>): Promise<WithdrawalRequest | undefined>;

  generateSerialId(
    playerId: number,
    playerName: string,
    rarity?: string,
  ): Promise<{ serialId: string; serialNumber: number; maxSupply: number }>;
  getSupplyCount(playerId: number, rarity: string): Promise<number>;
  backfillSerialIds(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user || undefined;
  }

  async createUser(user: { id: string; email?: string; name?: string; avatarUrl?: string }): Promise<User> {
    const [created] = await db.insert(users).values({
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
    } as any).returning();
    return created;
  }

  async getPlayers(): Promise<Player[]> {
    return db.select().from(players);
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player || undefined;
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const [created] = await db.insert(players).values(player as any).returning();
    return created;
  }

  async getPlayerCard(id: number): Promise<PlayerCard | undefined> {
    const [card] = await db.select().from(playerCards).where(eq(playerCards.id, id));
    return card || undefined;
  }

  // Marketplace-safe: owner can see, anyone can see if forSale=true
  async getPlayerCardWithPlayer(
    id: number,
    viewerUserId?: string,
  ): Promise<PlayerCardWithPlayer | undefined> {
    const visibility = viewerUserId
      ? or(eq(playerCards.ownerId, viewerUserId), eq(playerCards.forSale, true))
      : eq(playerCards.forSale, true);

    const [result] = await db
      .select()
      .from(playerCards)
      .innerJoin(players, eq(playerCards.playerId, players.id))
      .where(and(eq(playerCards.id, id), visibility));

    if (!result) return undefined;

    return {
      ...result.player_cards,
      player: result.players,
    };
  }

  async getUserCards(userId: string): Promise<PlayerCardWithPlayer[]> {
    const results = await db
      .select()
      .from(playerCards)
      .innerJoin(players, eq(playerCards.playerId, players.id))
      .where(eq(playerCards.ownerId, userId));

    return results.map((r: any) => ({ ...r.player_cards, player: r.players }));
  }

  async createPlayerCard(card: InsertPlayerCardSafe): Promise<PlayerCard> {
    const rarity = (card.rarity ?? "common") as string;
    const maxSupply = (RARITY_SUPPLY as any)[rarity] || 0;

    if (maxSupply > 0 && card.playerId) {
      const currentCount = await this.getSupplyCount(card.playerId, rarity);
      if (currentCount >= maxSupply) {
        throw new Error(`Supply cap reached for this player's ${rarity} cards (${maxSupply} max)`);
      }
    }

    const [created] = await db.insert(playerCards).values(card as any).returning();
    return created;
  }

  async updatePlayerCard(id: number, updates: Partial<PlayerCard>): Promise<PlayerCard | undefined> {
    const [updated] = await db
      .update(playerCards)
      .set(updates as any)
      .where(eq(playerCards.id, id))
      .returning();
    return updated || undefined;
  }

  async getMarketplaceListings(): Promise<PlayerCardWithPlayer[]> {
    const results = await db
      .select()
      .from(playerCards)
      .innerJoin(players, eq(playerCards.playerId, players.id))
      .where(eq(playerCards.forSale, true));

    return results.map((r: any) => ({ ...r.player_cards, player: r.players }));
  }

  async getWallet(userId: string): Promise<Wallet | undefined> {
    const [w] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    return w || undefined;
  }

  async createWallet(wallet: InsertWallet): Promise<Wallet> {
    const [created] = await db.insert(wallets).values(wallet as any).returning();
    return created;
  }

  async updateWalletBalance(userId: string, amount: number): Promise<Wallet | undefined> {
    const [updated] = await db
      .update(wallets)
      .set({ balance: sql`${wallets.balance} + ${amount}` } as any)
      .where(eq(wallets.userId, userId))
      .returning();
    return updated || undefined;
  }

  async updateWalletLockedBalance(userId: string, amount: number): Promise<Wallet | undefined> {
    const [updated] = await db
      .update(wallets)
      .set({ lockedBalance: sql`${wallets.lockedBalance} + ${amount}` } as any)
      .where(eq(wallets.userId, userId))
      .returning();
    return updated || undefined;
  }

  async lockFunds(userId: string, amount: number): Promise<Wallet | undefined> {
    const [updated] = await db
      .update(wallets)
      .set(
        {
          balance: sql`${wallets.balance} - ${amount}`,
          lockedBalance: sql`${wallets.lockedBalance} + ${amount}`,
        } as any,
      )
      .where(eq(wallets.userId, userId))
      .returning();
    return updated || undefined;
  }

  async unlockFunds(userId: string, amount: number): Promise<Wallet | undefined> {
    const [updated] = await db
      .update(wallets)
      .set(
        {
          balance: sql`${wallets.balance} + ${amount}`,
          lockedBalance: sql`${wallets.lockedBalance} - ${amount}`,
        } as any,
      )
      .where(eq(wallets.userId, userId))
      .returning();
    return updated || undefined;
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async createTransaction(tx: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(tx as any).returning();
    return created;
  }

  async getLineup(userId: string): Promise<Lineup | undefined> {
    const [l] = await db.select().from(lineups).where(eq(lineups.userId, userId));
    return l || undefined;
  }

  async createOrUpdateLineup(userId: string, cardIds: number[], captainId: number): Promise<Lineup> {
    const [existing] = await db.select().from(lineups).where(eq(lineups.userId, userId));

    if (existing) {
      const [updated] = await db
        .update(lineups)
        .set({ cardIds, captainId } as any)
        .where(eq(lineups.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(lineups)
      .values({ userId, cardIds, captainId } as any)
      .returning();
    return created;
  }

  // ✅ Onboarding

async getOnboarding(userId: string): Promise<UserOnboarding | undefined> {
  const [o] = await db
    .select()
    .from(userOnboarding)
    .where(eq(userOnboarding.userId, userId));
  return o || undefined;
}

async createOnboarding(data: InsertOnboarding | { userId: string }): Promise<UserOnboarding> {
  const userId = data.userId;

  // 1) Ensure user exists (FK requirement)
// NOTE: Production DB may have an older `users` table schema (missing columns like first_name/name).
// Using raw SQL ensures we only touch the `id` column and avoid referencing non-existent columns.
await db.execute(sql`
  insert into app.users (id)
  values (${userId})
  on conflict (id) do nothing
`);

// 2) If onboarding already exists, return it
  const [existingOnboarding] = await db
    .select()
    .from(userOnboarding)
    .where(eq(userOnboarding.userId, userId));

  if (existingOnboarding) return existingOnboarding;

  // 3) Create onboarding
  // IMPORTANT: TypeScript is currently only allowing { userId } inserts for this table,
  // so insert ONLY userId and use updateOnboarding later for packCards/selectedCards.
  const [created] = await db
    .insert(userOnboarding)
    .values({ userId })
    .returning();

  return created;
}

async updateOnboarding(
  userId: string,
  updates: Partial<UserOnboarding>,
): Promise<UserOnboarding | undefined> {
  const [updated] = await db
    .update(userOnboarding)
    .set(updates as any)
    .where(eq(userOnboarding.userId, userId))
    .returning();
  return updated || undefined;
}

// ✅ Players

async getPlayerCount(): Promise<number> {
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(players);
  return result.count;
}


  async getRandomPlayers(count: number): Promise<Player[]> {
    return db.select().from(players).orderBy(sql`RANDOM()`).limit(count);
  }

  async getRandomPlayersByPosition(position: string, count: number): Promise<Player[]> {
    return db
      .select()
      .from(players)
      .where(eq(players.position, position as any))
      .orderBy(sql`RANDOM()`)
      .limit(count);
  }

  async getCompetitions(): Promise<Competition[]> {
    return db.select().from(competitions).orderBy(desc(competitions.startDate));
  }

  async getCompetition(id: number): Promise<Competition | undefined> {
    const [comp] = await db.select().from(competitions).where(eq(competitions.id, id));
    return comp || undefined;
  }

  async createCompetition(comp: InsertCompetition): Promise<Competition> {
    const [created] = await db.insert(competitions).values(comp as any).returning();
    return created;
  }

  async updateCompetition(id: number, updates: Partial<Competition>): Promise<Competition | undefined> {
    const [updated] = await db
      .update(competitions)
      .set(updates as any)
      .where(eq(competitions.id, id))
      .returning();
    return updated || undefined;
  }

  async getCompetitionEntries(competitionId: number): Promise<CompetitionEntry[]> {
    return db.select().from(competitionEntries).where(eq(competitionEntries.competitionId, competitionId));
  }

  async getCompetitionEntry(
    competitionId: number,
    userId: string,
  ): Promise<CompetitionEntry | undefined> {
    const [entry] = await db
      .select()
      .from(competitionEntries)
      .where(and(eq(competitionEntries.competitionId, competitionId), eq(competitionEntries.userId, userId)));
    return entry || undefined;
  }

  async createCompetitionEntry(entry: InsertCompetitionEntry): Promise<CompetitionEntry> {
    const [created] = await db.insert(competitionEntries).values(entry as any).returning();
    return created;
  }

  async updateCompetitionEntry(
    id: number,
    updates: Partial<CompetitionEntry>,
  ): Promise<CompetitionEntry | undefined> {
    const [updated] = await db
      .update(competitionEntries)
      .set(updates as any)
      .where(eq(competitionEntries.id, id))
      .returning();
    return updated || undefined;
  }

  async getUserCompetitions(userId: string): Promise<CompetitionEntry[]> {
    return db.select().from(competitionEntries).where(eq(competitionEntries.userId, userId));
  }

  async getUserRewards(userId: string): Promise<CompetitionEntry[]> {
    return db
      .select()
      .from(competitionEntries)
      .where(
        and(
          eq(competitionEntries.userId, userId),
          or(
            sql`${competitionEntries.prizeAmount} > 0`,
            sql`${competitionEntries.prizeCardId} is not null`,
          ),
        ),
      )
      .orderBy(desc(competitionEntries.joinedAt));
  }

  async getSwapOffer(id: number): Promise<SwapOffer | undefined> {
    const [offer] = await db.select().from(swapOffers).where(eq(swapOffers.id, id));
    return offer || undefined;
  }

  async getSwapOffersForCard(cardId: number): Promise<SwapOffer[]> {
    return db.select().from(swapOffers).where(eq(swapOffers.offeredCardId, cardId));
  }

  async getUserSwapOffers(userId: string): Promise<SwapOffer[]> {
    return db.select().from(swapOffers).where(eq(swapOffers.offererUserId, userId));
  }

  async createSwapOffer(offer: InsertSwapOffer): Promise<SwapOffer> {
    const [created] = await db.insert(swapOffers).values(offer as any).returning();
    return created;
  }

  async updateSwapOffer(id: number, updates: Partial<SwapOffer>): Promise<SwapOffer | undefined> {
    const [updated] = await db
      .update(swapOffers)
      .set(updates as any)
      .where(eq(swapOffers.id, id))
      .returning();
    return updated || undefined;
  }

  async createWithdrawalRequest(req: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    const [created] = await db.insert(withdrawalRequests).values(req as any).returning();
    return created;
  }

  async getUserWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]> {
    return db.select().from(withdrawalRequests).where(eq(withdrawalRequests.userId, userId));
  }

  async getAllPendingWithdrawals(): Promise<WithdrawalRequest[]> {
    return db.select().from(withdrawalRequests).where(eq(withdrawalRequests.status, "pending"));
  }

  async getAllWithdrawals(): Promise<WithdrawalRequest[]> {
    return db.select().from(withdrawalRequests).orderBy(desc(withdrawalRequests.createdAt));
  }

  async updateWithdrawalRequest(
    id: number,
    updates: Partial<WithdrawalRequest>,
  ): Promise<WithdrawalRequest | undefined> {
    const [updated] = await db
      .update(withdrawalRequests)
      .set(updates as any)
      .where(eq(withdrawalRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async generateSerialId(
    playerId: number,
    playerName: string,
    rarity: string = "common",
  ): Promise<{ serialId: string; serialNumber: number; maxSupply: number }> {
    const maxSupply = (RARITY_SUPPLY as any)[rarity] || 0;
    const currentCount = await this.getSupplyCount(playerId, rarity);
    const nextNumber = currentCount + 1;

    const initials = playerName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 3);

    const serialId = `${initials}-${rarity[0].toUpperCase()}-${nextNumber.toString().padStart(4, "0")}`;

    return { serialId, serialNumber: nextNumber, maxSupply };
  }

  async getSupplyCount(playerId: number, rarity: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(playerCards)
      .where(and(eq(playerCards.playerId, playerId), eq(playerCards.rarity, rarity as any)));

    return result.count;
  }

  async backfillSerialIds(): Promise<void> {
    const allCards = await db.select().from(playerCards);

    for (const card of allCards) {
      if (!card.serialId && card.playerId) {
        const [player] = await db.select().from(players).where(eq(players.id, card.playerId));

        if (player) {
          const { serialId, serialNumber } = await this.generateSerialId(
            player.id,
            player.name,
            card.rarity || "common",
          );

          await db
            .update(playerCards)
            .set({ serialId, serialNumber } as any)
            .where(eq(playerCards.id, card.id));
        }
      }
    }
  }
}

export const storage = new DatabaseStorage();
