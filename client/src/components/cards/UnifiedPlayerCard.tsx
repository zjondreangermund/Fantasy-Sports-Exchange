import SlabCard from "./SlabCard";
import { type PlayerCardData } from "./types";

type Props = {
  player: PlayerCardData;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: string;
  selected?: boolean;
  interactive?: boolean;
};

function sizeClass(size?: "sm" | "md" | "lg", variant?: string) {
  if (size === "sm" || variant === "compact") return "!w-[145px]";
  if (size === "lg" || variant === "showcase") return "!w-[245px]";
  return "!w-[185px]";
}

function rarity(value: string | undefined) {
  if (value === "rare" || value === "unique" || value === "legendary") return value;
  return "common";
}

function cardAura(value: string | undefined) {
  const r = rarity(value);
  if (r === "legendary") return { glow: "rgba(250,204,21,.46)", sweep: "rgba(255,255,255,.58)", border: "rgba(250,204,21,.38)" };
  if (r === "unique") return { glow: "rgba(217,70,239,.42)", sweep: "rgba(255,255,255,.50)", border: "rgba(217,70,239,.32)" };
  if (r === "rare") return { glow: "rgba(56,189,248,.42)", sweep: "rgba(255,255,255,.46)", border: "rgba(56,189,248,.32)" };
  return { glow: "rgba(226,232,240,.28)", sweep: "rgba(255,255,255,.34)", border: "rgba(226,232,240,.22)" };
}

function CardEngineV3Shell({ children, player, selected, className }: { children: React.ReactNode; player: PlayerCardData; selected: boolean; className: string }) {
  const aura = cardAura(player.rarity);
  const isPremium = rarity(player.rarity) !== "common";

  return (
    <div
      className={[
        "group/cardv3 relative inline-flex rounded-[2rem] [perspective:1100px] [transform-style:preserve-3d] transition-transform duration-300 md:hover:-translate-y-1 md:hover:scale-[1.018]",
        selected ? "ring-2 ring-cyan-300 ring-offset-2 ring-offset-black" : "",
        className,
      ].join(" ")}
      style={{ filter: `drop-shadow(0 28px 58px ${aura.glow})` }}
    >
      <style>{`
        @keyframes cardEngineSweepV3 {
          0% { transform: translateX(-150%) rotate(13deg); opacity: 0; }
          22% { opacity: .42; }
          100% { transform: translateX(150%) rotate(13deg); opacity: 0; }
        }
        @keyframes cardEngineAuraV3 {
          0%, 100% { opacity: .42; transform: scale(.96); }
          50% { opacity: .78; transform: scale(1.04); }
        }
      `}</style>
      <div className="pointer-events-none absolute -inset-[8%] -z-10 rounded-[2.4rem] blur-2xl" style={{ background: `radial-gradient(circle at 50% 28%, ${aura.glow}, transparent 58%)`, animation: "cardEngineAuraV3 5.5s ease-in-out infinite" }} />
      <div className="pointer-events-none absolute -inset-[3%] z-40 overflow-hidden rounded-[2.2rem] opacity-70 mix-blend-screen">
        <div className="absolute inset-y-[-20%] left-0 w-1/2 bg-white/20 blur-xl" style={{ background: `linear-gradient(105deg, transparent 0 28%, ${aura.sweep} 48%, transparent 68%)`, animation: `cardEngineSweepV3 ${isPremium ? "6.5s" : "9s"} ease-in-out infinite` }} />
      </div>
      <div className="pointer-events-none absolute inset-[-1px] rounded-[2rem] border" style={{ borderColor: aura.border, boxShadow: `inset 0 0 28px ${aura.glow}` }} />
      <div className="relative [transform-style:preserve-3d] md:group-hover/cardv3:[transform:rotateX(2deg)_rotateY(-2deg)] transition-transform duration-300">
        {children}
      </div>
    </div>
  );
}

export default function UnifiedPlayerCard({ player, className = "", size = "md", variant = "default", selected = false }: Props) {
  const scores = Array.isArray(player.last5Scores)
    ? player.last5Scores.map((v) => Number(v || 0)).slice(0, 5)
    : [0, 0, 0, 0, 0];

  while (scores.length < 5) scores.push(0);

  const activeScores = scores.filter((v) => v > 0);
  const avgScore = activeScores.length
    ? Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length)
    : Math.round(Number(player.rating || 0));

  const imageSrc =
    player.image ||
    player.imageUrl ||
    player.photo ||
    player.imageCandidates?.[0] ||
    "/images/player-1.png";

  const team = String(player.team || player.club || "FSE")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 3)
    .toUpperCase() || "FSE";

  const country = String(player.nationality || "FC")
    .slice(0, 3)
    .toUpperCase();

  const serial = `#${String(Number(player.serial || 1)).padStart(3, "0")}/${Number(player.maxSupply || 100)}`;

  return (
    <CardEngineV3Shell player={player} selected={selected} className={className}>
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
        age={player.level || 24}
        position={player.position || "ST"}
        stats={{
          pace: player.stats?.pace,
          shooting: player.stats?.shooting,
          passing: player.stats?.passing,
          dribbling: player.stats?.dribbling,
          defense: player.stats?.defense,
          physical: player.stats?.physical,
        }}
        last5={scores}
        status={player.status}
        competitionEligible={player.competitionEligible}
        provenanceMarker={player.provenanceMarker}
        className={sizeClass(size, variant)}
      />
    </CardEngineV3Shell>
  );
}
