import SlabCard from "./SlabCard";
import { type PlayerCardData } from "./types";

type Props = {
  player: PlayerCardData;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: string;
  selected?: boolean;
};

function sizeClass(size?: "sm" | "md" | "lg", variant?: string) {
  if (size === "sm" || variant === "compact") return "!w-[150px]";
  if (size === "lg" || variant === "showcase") return "!w-[220px]";
  return "!w-[176px]";
}

function rarity(value: string | undefined) {
  if (value === "rare" || value === "unique" || value === "legendary") return value;
  return "common";
}

export default function UnifiedPlayerCard({ player, className = "", size = "md", variant = "default", selected = false }: Props) {
  const scores = Array.isArray(player.last5Scores) ? player.last5Scores.map((v) => Number(v || 0)).slice(0, 5) : [0, 0, 0, 0, 0];
  while (scores.length < 5) scores.push(0);
  const activeScores = scores.filter((v) => v > 0);
  const avgScore = activeScores.length ? Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length) : Math.round(Number(player.rating || 0));
  const imageSrc = player.image || player.imageUrl || player.photo || player.imageCandidates?.[0] || "/images/player-1.png";
  const team = String(player.team || player.club || "FFC").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "FFC";
  const country = String(player.nationality || "FC").slice(0, 3).toUpperCase();
  const serial = `#${String(Number(player.serial || 1)).padStart(3, "0")}/${Number(player.maxSupply || 100)}`;

  return (
    <div className={["relative inline-flex", selected ? "rounded-[1.5rem] ring-2 ring-cyan-300 ring-offset-2 ring-offset-black" : "", className].join(" ")}>
      <SlabCard
        name={player.name || "Unknown Player"}
        rarity={rarity(player.rarity) as any}
        avgScore={avgScore}
        serialNumber={serial}
        imageSrc={imageSrc}
        season={player.season || "2026-27"}
        teamCode={team}
        shirtNumber={player.serial || 1}
        countryCode={country}
        last5={scores}
        status={player.status}
        competitionEligible={player.competitionEligible}
        provenanceMarker={player.provenanceMarker}
        className={sizeClass(size, variant)}
      />
    </div>
  );
}
