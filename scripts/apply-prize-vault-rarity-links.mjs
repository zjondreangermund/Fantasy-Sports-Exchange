import fs from "node:fs";

function replace(path, from, to) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(from)) throw new Error(`Target not found in ${path}`);
  fs.writeFileSync(path, source.replace(from, to));
}

replace(
  "client/src/pages/competitions-vault.tsx",
  '<Link href="/prize-vault" className="sm:ml-auto">',
  '<Link href={`/prize-vault?rarity=${activeRarity}`} className="sm:ml-auto">',
);

replace(
  "client/src/pages/competitions-vault.tsx",
  '<Link href="/prize-vault" className="flex-1"><Button variant="outline"',
  '<Link href={`/prize-vault?rarity=${r}`} className="flex-1"><Button variant="outline"',
);

replace(
  "client/src/pages/prize-vault.tsx",
  '  const [rarity, setRarity] = useState("rare");',
  '  const [rarity, setRarity] = useState(() => {\n    if (typeof window === "undefined") return "rare";\n    const requested = new URLSearchParams(window.location.search).get("rarity")?.toLowerCase() || "rare";\n    return rarities.includes(requested) ? requested : "rare";\n  });',
);

fs.rmSync("scripts/apply-prize-vault-rarity-links.mjs");
fs.rmSync(".github/workflows/apply-prize-vault-rarity-links.yml");
