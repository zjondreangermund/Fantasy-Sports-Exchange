import { useEffect, useMemo, useState, type PointerEvent, type ReactNode } from "react";
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
  if (r === "legendary") return { glow: "rgba(250,204,21,.52)", sweep: "rgba(255,255,255,.62)", border: "rgba(250,204,21,.46)", badge: "border-yellow-200/45 bg-yellow-300/15 text-yellow-100" };
  if (r === "unique") return { glow: "rgba(217,70,239,.48)", sweep: "rgba(255,255,255,.55)", border: "rgba(217,70,239,.42)", badge: "border-fuchsia-200/40 bg-fuchsia-400/15 text-fuchsia-100" };
  if (r === "rare") return { glow: "rgba(56,189,248,.48)", sweep: "rgba(255,255,255,.50)", border: "rgba(56,189,248,.40)", badge: "border-cyan-200/40 bg-cyan-400/15 text-cyan-100" };
  return { glow: "rgba(226,232,240,.30)", sweep: "rgba(255,255,255,.36)", border: "rgba(226,232,240,.26)", badge: "border-slate-200/25 bg-slate-200/10 text-slate-100" };
}

function formatMarketValue(player: PlayerCardData) {
  const value = Number(player.price || player.listedPrice || 0);
  if (!Number.isFinite(value) || value <= 0) return "Vault";
  return `N$${value.toFixed(0)}`;
}

function CardEngineV3Shell({ children, player, selected, className }: { children: ReactNode; player: PlayerCardData; selected: boolean; className: string }) {
  const aura = cardAura(player.rarity);
  const isPremium = rarity(player.rarity) !== "common";
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });

  const marketValue = useMemo(() => formatMarketValue(player), [player]);
  const isListed = Boolean(player.forSale || player.listed || Number(player.price || player.listedPrice || 0) > 0);
  const liveLabel = player.status === "active" ? "LIVE" : player.competitionEligible ? "READY" : "VAULT";

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!window.matchMedia("(pointer: coarse)").matches) return;
      const beta = Math.max(-20, Math.min(20, Number(event.beta || 0)));
      const gamma = Math.max(-18, Math.min(18, Number(event.gamma || 0)));
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        setTilt({ rx: beta / -5, ry: gamma / 4, mx: 50 + gamma * 1.4, my: 50 + beta * 1.1 });
      });
    };

    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, []);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || event.pointerType === "pen" || event.pointerType === "touch") {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      const ry = (x - 50) / 7.5;
      const rx = (50 - y) / 8.5;
      setTilt({ rx, ry, mx: x, my: y });
    }
  };

  const resetTilt = () => setTilt({ rx: 0, ry: 0, mx: 50, my: 50 });

  return (
    <div
      className={[
        "group/cardv3 relative inline-flex rounded-[2rem] [perspective:1100px] [transform-style:preserve-3d] transition-transform duration-300 md:hover:-translate-y-1 md:hover:scale-[1.018]",
        selected ? "ring-2 ring-cyan-300 ring-offset-2 ring-offset-black" : "",
        className,
      ].join(" ")}
      style={{ filter: `drop-shadow(0 28px 58px ${aura.glow})` }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      onPointerCancel={resetTilt}
    >
      <style>{`
        @keyframes cardEngineSweepV3 {
          0% { transform: translateX(-150%) rotate(13deg); opacity: 0; }
          22% { opacity: .42; }
          100% { transform: translateX(150%) rotate(13deg); opacity: 0; }
        }
        @keyframes cardEngineAuraV3 {
          0%, 100% { opacity: .44; transform: scale(.96); }
          50% { opacity: .84; transform: scale(1.05); }
        }
        @keyframes cardEngineBadgePulseV3 {
          0%, 100% { opacity: .72; }
          50% { opacity: 1; }
        }
      `}</style>
      <div className="pointer-events-none absolute -inset-[8%] -z-10 rounded-[2.4rem] blur-2xl" style={{ background: `radial-gradient(circle at 50% 28%, ${aura.glow}, transparent 58%)`, animation: "cardEngineAuraV3 5.5s ease-in-out infinite" }} />
      <div className="pointer-events-none absolute -inset-[3%] z-40 overflow-hidden rounded-[2.2rem] opacity-70 mix-blend-screen">
        <div className="absolute inset-y-[-20%] left-0 w-1/2 bg-white/20 blur-xl" style={{ background: `linear-gradient(105deg, transparent 0 28%, ${aura.sweep} 48%, transparent 68%)`, animation: `cardEngineSweepV3 ${isPremium ? "6.5s" : "9s"} ease-in-out infinite` }} />
      </div>
      <div className="pointer-events-none absolute inset-[-1px] rounded-[2rem] border" style={{ borderColor: aura.border, boxShadow: `inset 0 0 34px ${aura.glow}` }} />
      <div className="pointer-events-none absolute inset-0 z-50 rounded-[2rem] opacity-0 mix-blend-screen transition-opacity duration-200 group-hover/cardv3:opacity-100" style={{ background: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,.34), transparent 34%)` }} />

      <div className="pointer-events-none absolute left-2 top-2 z-[60] flex gap-1 [transform:translateZ(58px)]">
        <span className={`rounded-full border px-2 py-0.5 text-[7px] font-black tracking-[.14em] backdrop-blur ${aura.badge}`} style={{ animation: liveLabel === "LIVE" ? "cardEngineBadgePulseV3 1.4s ease-in-out infinite" : undefined }}>{liveLabel}</span>
        <span className="rounded-full border border-emerald-200/30 bg-emerald-400/14 px-2 py-0.5 text-[7px] font-black tracking-[.14em] text-emerald-100 backdrop-blur">OWNED</span>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-1/2 z-[60] flex -translate-x-1/2 gap-1 [transform:translateZ(58px)]">
        <span className="rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.14em] text-white/85 backdrop-blur">{isListed ? "MARKET" : "VALUE"}: {marketValue}</span>
      </div>

      <div
        className="relative [transform-style:preserve-3d] transition-transform duration-150 ease-out"
        style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }}
      >
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
        value={formatMarketValue(player)}
        status={player.status}
        competitionEligible={player.competitionEligible}
        provenanceMarker={player.provenanceMarker}
        className={sizeClass(size, variant)}
      />
    </CardEngineV3Shell>
  );
}