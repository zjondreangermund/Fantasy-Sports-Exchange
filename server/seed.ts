import { storage } from "./storage.js";
import { RARITY_SUPPLY } from "../shared/schema.js";

const seedPlayers = [
  { name: "Marcus Rashford", team: "Manchester United", league: "Premier League", position: "FWD" as const, nationality: "England", age: 27, overall: 84, imageUrl: "/images/player-1.png" },
  { name: "Bruno Fernandes", team: "Manchester United", league: "Premier League", position: "MID" as const, nationality: "Portugal", age: 30, overall: 88, imageUrl: "/images/player-2.png" },
  { name: "Virgil van Dijk", team: "Liverpool", league: "Premier League", position: "DEF" as const, nationality: "Netherlands", age: 33, overall: 89, imageUrl: "/images/player-3.png" },
  { name: "Alisson Becker", team: "Liverpool", league: "Premier League", position: "GK" as const, nationality: "Brazil", age: 31, overall: 89, imageUrl: "/images/player-4.png" },
  { name: "Bukayo Saka", team: "Arsenal", league: "Premier League", position: "FWD" as const, nationality: "England", age: 23, overall: 87, imageUrl: "/images/player-5.png" },
  { name: "Kevin De Bruyne", team: "Manchester City", league: "Premier League", position: "MID" as const, nationality: "Belgium", age: 33, overall: 91, imageUrl: "/images/player-6.png" },
  { name: "Erling Haaland", team: "Manchester City", league: "Premier League", position: "FWD" as const, nationality: "Norway", age: 24, overall: 91, imageUrl: "/images/player-1.png" },
  { name: "Mohamed Salah", team: "Liverpool", league: "Premier League", position: "FWD" as const, nationality: "Egypt", age: 32, overall: 89, imageUrl: "/images/player-5.png" },
  { name: "Phil Foden", team: "Manchester City", league: "Premier League", position: "MID" as const, nationality: "England", age: 24, overall: 87, imageUrl: "/images/player-2.png" },
  { name: "Declan Rice", team: "Arsenal", league: "Premier League", position: "MID" as const, nationality: "England", age: 26, overall: 86, imageUrl: "/images/player-6.png" },
  { name: "William Saliba", team: "Arsenal", league: "Premier League", position: "DEF" as const, nationality: "France", age: 24, overall: 86, imageUrl: "/images/player-3.png" },
  { name: "Rodri", team: "Manchester City", league: "Premier League", position: "MID" as const, nationality: "Spain", age: 28, overall: 90, imageUrl: "/images/player-6.png" },
  { name: "Jude Bellingham", team: "Real Madrid", league: "La Liga", position: "MID" as const, nationality: "England", age: 21, overall: 89, imageUrl: "/images/player-2.png" },
  { name: "Vinicius Jr", team: "Real Madrid", league: "La Liga", position: "FWD" as const, nationality: "Brazil", age: 24, overall: 90, imageUrl: "/images/player-5.png" },
  { name: "Kylian Mbappe", team: "Real Madrid", league: "La Liga", position: "FWD" as const, nationality: "France", age: 26, overall: 92, imageUrl: "/images/player-1.png" },
  { name: "Lamine Yamal", team: "Barcelona", league: "La Liga", position: "FWD" as const, nationality: "Spain", age: 17, overall: 83, imageUrl: "/images/player-5.png" },
  { name: "Pedri", team: "Barcelona", league: "La Liga", position: "MID" as const, nationality: "Spain", age: 22, overall: 87, imageUrl: "/images/player-6.png" },
  { name: "Robert Lewandowski", team: "Barcelona", league: "La Liga", position: "FWD" as const, nationality: "Poland", age: 36, overall: 88, imageUrl: "/images/player-1.png" },
  { name: "Thibaut Courtois", team: "Real Madrid", league: "La Liga", position: "GK" as const, nationality: "Belgium", age: 32, overall: 89, imageUrl: "/images/player-4.png" },
  { name: "Antonio Rudiger", team: "Real Madrid", league: "La Liga", position: "DEF" as const, nationality: "Germany", age: 31, overall: 85, imageUrl: "/images/player-3.png" },
  { name: "Florian Wirtz", team: "Bayer Leverkusen", league: "Bundesliga", position: "MID" as const, nationality: "Germany", age: 21, overall: 87, imageUrl: "/images/player-2.png" },
  { name: "Harry Kane", team: "Bayern Munich", league: "Bundesliga", position: "FWD" as const, nationality: "England", age: 31, overall: 90, imageUrl: "/images/player-1.png" },
  { name: "Jamal Musiala", team: "Bayern Munich", league: "Bundesliga", position: "MID" as const, nationality: "Germany", age: 21, overall: 86, imageUrl: "/images/player-6.png" },
  { name: "Manuel Neuer", team: "Bayern Munich", league: "Bundesliga", position: "GK" as const, nationality: "Germany", age: 38, overall: 86, imageUrl: "/images/player-4.png" },
  { name: "Lautaro Martinez", team: "Inter Milan", league: "Serie A", position: "FWD" as const, nationality: "Argentina", age: 27, overall: 88, imageUrl: "/images/player-1.png" },
  { name: "Hakan Calhanoglu", team: "Inter Milan", league: "Serie A", position: "MID" as const, nationality: "Turkey", age: 30, overall: 85, imageUrl: "/images/player-2.png" },
  { name: "Alessandro Bastoni", team: "Inter Milan", league: "Serie A", position: "DEF" as const, nationality: "Italy", age: 25, overall: 86, imageUrl: "/images/player-3.png" },
];

const marketplaceCards = [
  { playerIndex: 14, rarity: "legendary" as const, level: 5, price: 250, scores: [88, 92, 75, 95, 90] },
  { playerIndex: 6, rarity: "legendary" as const, level: 4, price: 200, scores: [85, 90, 78, 88, 92] },
  { playerIndex: 5, rarity: "unique" as const, level: 3, price: 120, scores: [72, 80, 85, 68, 77] },
  { playerIndex: 12, rarity: "unique" as const, level: 3, price: 100, scores: [65, 78, 82, 70, 85] },
  { playerIndex: 13, rarity: "unique" as const, level: 2, price: 90, scores: [70, 75, 60, 88, 72] },
  { playerIndex: 7, rarity: "rare" as const, level: 2, price: 45, scores: [60, 72, 55, 80, 65] },
  { playerIndex: 1, rarity: "rare" as const, level: 2, price: 35, scores: [55, 68, 72, 60, 58] },
  { playerIndex: 11, rarity: "rare" as const, level: 1, price: 30, scores: [50, 62, 58, 70, 55] },
  { playerIndex: 21, rarity: "rare" as const, level: 1, price: 28, scores: [58, 65, 48, 72, 60] },
  { playerIndex: 4, rarity: "rare" as const, level: 1, price: 25, scores: [52, 60, 65, 55, 62] },
];

async function ensureMarketplaceListings(players: any[]) {
  const existingListings = await storage.getMarketplaceListings();
  if (existingListings.length > 0) {
    console.log(`Marketplace already has ${existingListings.length} listings`);
    return;
  }

  console.log("Repairing marketplace listings...");
  let created = 0;
  for (const listing of marketplaceCards) {
    const player = players[listing.playerIndex] || players[created % Math.max(players.length, 1)];
    if (!player) continue;

    const supply = (RARITY_SUPPLY as any)[listing.rarity] || 0;
    let serialId: string | null = null;
    let serialNumber: number | null = null;
    let maxSupply: number = supply;

    if (supply > 0) {
      const generated = await storage.generateSerialId(player.id, player.name, listing.rarity);
      serialId = generated.serialId;
      serialNumber = generated.serialNumber;
      maxSupply = generated.maxSupply;
    }

    try {
      await storage.createPlayerCard({
        playerId: player.id,
        ownerId: null,
        rarity: listing.rarity,
        serialId,
        serialNumber,
        maxSupply,
        level: listing.level,
        xp: listing.level * 100,
        decisiveScore: Math.min(100, 35 + listing.level * 13),
        last5Scores: listing.scores,
        forSale: true,
        price: listing.price,
      } as any);
      created++;
    } catch (error) {
      console.warn("Could not create marketplace listing:", error);
    }
  }
  console.log(`Repaired ${created} marketplace listings`);
}

export async function seedDatabase() {
  const count = await storage.getPlayerCount();
  let players: any[] = [];

  if (count > 0) {
    console.log(`Database already has ${count} players, checking marketplace repair`);
    players = await storage.getPlayers();
    await ensureMarketplaceListings(players);
    await storage.backfillSerialIds();
    return;
  }

  console.log("Seeding database with players...");
  const createdPlayers: any[] = [];
  for (const player of seedPlayers) {
    const created = await storage.createPlayer(player as any);
    createdPlayers.push(created);
  }
  console.log(`Seeded ${seedPlayers.length} players`);

  await ensureMarketplaceListings(createdPlayers);
}

export async function seedCompetitions() {
  const existing = await storage.getCompetitions();

  console.log("Ensuring common tournaments exist for GW27+ ...");
  const now = new Date();

  const endOfCurrentWeek = new Date(now);
  endOfCurrentWeek.setDate(endOfCurrentWeek.getDate() + (7 - endOfCurrentWeek.getDay()));
  endOfCurrentWeek.setHours(23, 59, 59, 999);

  const startOfNextWeek = new Date(endOfCurrentWeek);
  startOfNextWeek.setDate(startOfNextWeek.getDate() + 1);
  startOfNextWeek.setHours(0, 0, 0, 0);

  const baseGameWeek = 27;
  const weeksToSeed = 4;
  const existingByWeek = new Set(existing.filter((c: any) => String(c.tier || "").toLowerCase() === "common").map((c: any) => Number(c.gameWeek)));

  let createdCount = 0;

  for (let index = 0; index < weeksToSeed; index++) {
    const gw = baseGameWeek + index;
    if (existingByWeek.has(gw)) continue;

    const startDate = new Date(startOfNextWeek);
    startDate.setDate(startDate.getDate() + index * 7);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    await storage.createCompetition({
      name: `Common Tournament - GW${gw}`,
      tier: "common",
      entryFee: 0,
      status: "open",
      gameWeek: gw,
      startDate,
      endDate,
      prizeCardRarity: "rare",
    } as any);
    createdCount++;
  }

  if (createdCount === 0) console.log("Common tournaments GW27-GW30 already present");
  else console.log(`Seeded ${createdCount} missing common tournaments (GW27-GW30)`);
}

export async function seedDemoUsers() {
  console.log("Seeding demo users...");
  const demoUsers = [
    { id: "demo-buyer-1", email: "buyer@demo.com", name: "Demo Buyer" },
    { id: "demo-seller-1", email: "seller@demo.com", name: "Demo Seller" },
    { id: "demo-admin-1", email: "admin@demo.com", name: "Demo Admin" },
  ];

  for (const userData of demoUsers) {
    const existing = await storage.getUser(userData.id);
    if (!existing) {
      await storage.createUser(userData);
      console.log(`Created user: ${userData.name}`);
    }

    let wallet = await storage.getWallet(userData.id);
    if (!wallet) {
      wallet = await storage.createWallet({ userId: userData.id, balance: 1000, lockedBalance: 0 } as any);
      await storage.createTransaction({ userId: userData.id, type: "deposit", amount: 1000, description: "Initial demo wallet balance" } as any);
      console.log(`Created wallet for ${userData.name} with $1000`);
    }
  }
}

export async function seedDemoCards() {
  console.log("Seeding demo user cards...");
  const buyerUserId = "demo-buyer-1";
  const sellerUserId = "demo-seller-1";
  const players = await storage.getPlayers();
  if (players.length < 10) {
    console.log("Not enough players in database. Run seedDatabase first.");
    return;
  }

  for (let i = 0; i < 5; i++) {
    const player = players[i];
    try {
      await storage.createPlayerCard({ playerId: player.id, ownerId: buyerUserId, rarity: "common", level: 1, xp: 0, decisiveScore: 35, forSale: false, price: 0 } as any);
    } catch {}
  }

  for (let i = 5; i < 10; i++) {
    const player = players[i];
    try {
      await storage.createPlayerCard({ playerId: player.id, ownerId: sellerUserId, rarity: "rare", level: 1, xp: 0, decisiveScore: 50, forSale: true, price: 25 } as any);
    } catch {}
  }
}
