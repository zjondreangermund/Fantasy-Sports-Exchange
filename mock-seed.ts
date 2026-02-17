import { db } from "./server/db";
import { players } from "./shared/schema";
import { count } from "drizzle-orm";

async function seedMockPlayers() {
  const currentCount = await db.select({ value: count() }).from(players);
  const needed = 100 - currentCount[0].value;

  if (needed <= 0) {
    console.log("Database already has 100+ players!");
    return;
  }

  console.log(`Injecting ${needed} mock players...`);

  const positions = ["GK", "DEF", "MID", "FWD"];
  const teams = ["Arsenal", "Chelsea", "Man Utd", "Spurs", "Newcastle", "Aston Villa"];

  for (let i = 0; i < needed; i++) {
    await db.insert(players).values({
      name: `Star Player ${currentCount[0].value + i + 1}`,
      team: teams[i % teams.length],
      league: "Premier League",
      position: positions[i % positions.length],
      nationality: "England",
      age: 20 + (i % 15),
      overall: 80 + (i % 12),
      imageUrl: `/images/player-${(i % 4) + 1}.png`,
    });
  }

  console.log("Mock seed complete! Marketplace is now full.");
}

seedMockPlayers().catch(console.error);