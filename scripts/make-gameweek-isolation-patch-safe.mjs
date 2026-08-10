import fs from "node:fs";

const file = "scripts/apply-gameweek-prize-isolation.mjs";
let source = fs.readFileSync(file, "utf8");
const marker = "GAMEWEEK_PATCH_INTERPOLATION_SAFE_V1";

if (!source.includes(marker)) {
  const startToken = "  const tournamentCard = `";
  const endToken = "`;\n  source = replaceSection(source, \"function TournamentCard(\"";
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);
  if (start < 0 || end < 0) throw new Error("Could not locate generated TournamentCard block");

  const bodyStart = start + startToken.length;
  const block = source.slice(bodyStart, end);
  // Escape only template expressions that are not already escaped. The target TSX
  // must receive ${...} literally; only this patch generator must not evaluate them.
  const safeBlock = block.replace(/(?<!\\)\$\{/g, "\\${");
  source = source.slice(0, bodyStart) + safeBlock + source.slice(end);
  source = source.replace(
    "// 2) Tournament Arena: free card cups are a separate product, never a Prize Vault card.",
    "// 2) Tournament Arena: free card cups are a separate product, never a Prize Vault card.\n// GAMEWEEK_PATCH_INTERPOLATION_SAFE_V1",
  );
  fs.writeFileSync(file, source);
}

console.log("Gameweek isolation generated JSX is interpolation-safe.");
