import fs from "node:fs";

const file = "client/src/pages/competitions-vault.tsx";
const source = fs.readFileSync(file, "utf8");

const checks = [
  ['common: { accent: "#72f7ff"', "Common ice-neon palette"],
  ['rare: { accent: "#00a8ff"', "Rare electric-blue palette"],
  ['unique: { accent: "#e03cff"', "Unique neon-purple palette"],
  ['epic: { accent: "#ff315f"', "Epic hot-red palette"],
  ['legendary: { accent: "#ffd60a"', "Legendary neon-gold palette"],
  ['data-rarity-neon="selector-v2"', "neon rarity selector"],
  ['data-rarity-neon="card-v2"', "neon tournament card shell"],
  ['linear-gradient(90deg,${t.secondary},${t.accent})', "rarity gradient progress bar"],
  ['0 0 44px ${t.glow}', "strong tournament glow"],
  ['linear-gradient(135deg,${t.secondary},${t.accent})', "rarity gradient entry button"],
];

for (const [needle, label] of checks) {
  if (!source.includes(needle)) throw new Error(`[tournament-neon] Missing ${label}`);
}

console.log("Tournament rarity neon UI verified.");
