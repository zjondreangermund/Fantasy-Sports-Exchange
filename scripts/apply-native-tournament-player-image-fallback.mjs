import fs from "node:fs";

const file = "client/src/components/native/NativeTournamentLeaderboard.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`Native tournament image fallback anchor not found: ${label}`);
  source = source.replace(from, to);
}

if (!source.includes('CARD_IMAGE_FALLBACK, normalizeImageUrl, toSafeImageUrl')) {
  replaceOnce(
    'import { normalizeTournamentRarity, type TournamentRarity } from "../../../../shared/game-rules";\n',
    'import { normalizeTournamentRarity, type TournamentRarity } from "../../../../shared/game-rules";\nimport { CARD_IMAGE_FALLBACK, normalizeImageUrl, toSafeImageUrl } from "../../lib/card-image";\n',
    "image helper import",
  );
}

if (!source.includes('imageCandidates?: string[] | null;')) {
  replaceOnce(
    '  imageUrl?: string | null;\n  captain: boolean;',
    '  imageUrl?: string | null;\n  imageCandidates?: string[] | null;\n  captain: boolean;',
    "player image candidates contract",
  );
}

source = source.replace(
  `function playerInitials(name: string) {\n  return String(name || "Player")\n    .split(/\\s+/)\n    .filter(Boolean)\n    .map((part) => part[0])\n    .join("")\n    .slice(0, 2)\n    .toUpperCase();\n}\n\n`,
  "",
);

replaceOnce(
  '{player.imageUrl ? <img src={player.imageUrl} alt={player.name} className="h-full w-full object-contain object-top" /> : playerInitials(player.name)}',
  '<NativeTournamentPlayerImage player={player} />',
  "single raw player portrait",
);

if (!source.includes("NATIVE_TOURNAMENT_PLAYER_IMAGE_FALLBACK_V1")) {
  const anchor = 'export default function NativeTournamentLeaderboard({ tournament, onClose }: Props) {';
  if (!source.includes(anchor)) throw new Error("Native tournament image fallback component anchor not found");
  const helper = `// NATIVE_TOURNAMENT_PLAYER_IMAGE_FALLBACK_V1\nfunction NativeTournamentPlayerImage({ player }: { player: TournamentTeamPlayer }) {\n  const candidates = React.useMemo(() => {\n    const raw = [\n      ...(Array.isArray(player.imageCandidates) ? player.imageCandidates : []),\n      player.imageUrl,\n    ];\n    const normalized = raw\n      .map((value) => normalizeImageUrl(value))\n      .filter((value): value is string => Boolean(value))\n      .map((value) => toSafeImageUrl(value));\n    const exactFplResolver = \`/api/player-image/resolve?name=\${encodeURIComponent(player.name)}&team=\${encodeURIComponent(player.team)}\`;\n    return Array.from(new Set([...normalized, exactFplResolver, CARD_IMAGE_FALLBACK]));\n  }, [player.cardId, player.name, player.team, player.imageUrl, player.imageCandidates]);\n  const [imageIndex, setImageIndex] = React.useState(0);\n\n  React.useEffect(() => {\n    setImageIndex(0);\n  }, [player.cardId, player.name, player.team, player.imageUrl, player.imageCandidates]);\n\n  const src = candidates[imageIndex] || CARD_IMAGE_FALLBACK;\n  return (\n    <img\n      src={src}\n      alt={player.name}\n      className=\"h-full w-full object-contain object-top\"\n      loading=\"lazy\"\n      decoding=\"async\"\n      onError={() => {\n        if (imageIndex < candidates.length - 1) setImageIndex((current) => current + 1);\n      }}\n    />\n  );\n}\n\n`;
  source = source.replace(anchor, `${helper}${anchor}`);
}

fs.writeFileSync(file, source);
console.log("Applied resilient native tournament player image fallbacks.");
