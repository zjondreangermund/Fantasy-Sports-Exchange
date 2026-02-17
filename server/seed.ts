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

export async function seedDatabase() {
  const count = await storage.getPlayerCount();

  if (count > 0) {
    console.log(`Database already has ${count} players, skipping seed`);
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

  console.log("Seeding marketplace listings...");

  for (const listing of marketplaceCards) {
    const player = createdPlayers[listing.playerIndex];
    if (!player) continue;

    const supply = (RARITY_SUPPLY as any)[listing.rarity] || 0;

    let serialId: string | null = null;
    let serialNumber: number | null = null;
    let maxSupply: number = supply;

    // Only generate serials if this rarity has a capped supply
    if (supply > 0) {
      const generated = await storage.generateSerialId(player.id, player.name, listing.rarity);
      serialId = generated.serialId;
      serialNumber = generated.serialNumber;
      maxSupply = generated.maxSupply;
    }

    const decisiveScore = Math.min(100, 35 + listing.level * 13);

    await storage.createPlayerCard({
      playerId: player.id,
      ownerId: null,
      rarity: listing.rarity,
      serialId,
      serialNumber,
      maxSupply,
      level: listing.level,
      xp: listing.level * 100,
      decisiveScore,
      last5Scores: listing.scores,
      forSale: true,
      price: listing.price,
    } as any);
  }

  console.log(`Seeded ${marketplaceCards.length} marketplace listings`);
}

export async function seedCompetitions() {
  const existing = await storage.getCompetitions();
  if (existing.length > 0) {
    console.log(`Already have ${existing.length} competitions, skipping seed`);
    return;
  }

  console.log("Seeding competitions...");
  const now = new Date();

  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  const nextWeekEnd = new Date(endOfWeek);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

  await storage.createCompetition({
    name: "Common Cup - GW1",
    tier: "common",
    entryFee: 0,
    status: "open",
    gameWeek: 1,
    startDate: now,
    endDate: endOfWeek,
    prizeCardRarity: "rare",
  } as any);

  await storage.createCompetition({
    name: "Rare Championship - GW1",
    tier: "rare",
    entryFee: 20,
    status: "open",
    gameWeek: 1,
    startDate: now,
    endDate: endOfWeek,
    prizeCardRarity: "unique",
  } as any);

  await storage.createCompetition({
    name: "Common Cup - GW2",
    tier: "common",
    entryFee: 0,
    status: "open",
    gameWeek: 2,
    startDate: endOfWeek,
    endDate: nextWeekEnd,
    prizeCardRarity: "rare",
  } as any);

  await storage.createCompetition({
    name: "Rare Championship - GW2",
    tier: "rare",
    entryFee: 20,
    status: "open",
    gameWeek: 2,
    startDate: endOfWeek,
    endDate: nextWeekEnd,
    prizeCardRarity: "unique",
  } as any);

  console.log("Seeded 4 competitions");
}
