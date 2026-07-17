import fs from "node:fs";

const path = "server/services/prizeEngine.ts";
const before = fs.readFileSync(path, "utf8");
const after = before.replace(
  'makePrize("epic-quad-bike", "Quad Bike", 220000, "Adventure", "epic")',
  'makePrize("epic-quad-bike", "Dirt Bike", 220000, "Adventure", "epic")',
);
if (after === before) throw new Error("Epic dirt-bike prize correction was not applied");
fs.writeFileSync(path, after);
console.log("Corrected the epic prize catalogue title without changing its stable key or value.");
