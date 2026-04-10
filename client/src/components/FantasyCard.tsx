import React from "react";
import { Badge } from "./ui/badge";
import { Zap } from "lucide-react";

export type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

export type PlayerCardData = {
  id: string;
  name: string;
  rating: number;
  position: string;
  club?: string;
  image?: string;
  imageCandidates?: string[];
  rarity: Rarity;
  serial?: number;
  maxSupply?: number;
  form?: number;
};

type FantasyCardProps = {
  player: PlayerCardData;
  className?: string;
};

type RarityConfig = {
  label: string;
  labelBg: string;
  labelClass: string;
  border: string;
  glow: string;
  shellTop: string;
  shellBottom: string;
  frame: string;
  faceTop: string;
  faceBottom: string;
  chamber: string;
  plate: string;
  silhouette: string;
  shine: string;
  shineOpacity: number;
  uniqueHolo?: boolean;
};

const rarityConfig: Record<Rarity, RarityConfig> = {
  common: {
    label: "Common",
    labelBg: "#646e7b",
    labelClass: "text-white",
    border: "rgba(179,190,204,0.44)",
    glow: "rgba(220,228,240,0.16)",
    shellTop: "#474f5a",
    shellBottom: "#171b21",
    frame: "linear-gradient(145deg, #d3d9e2 0%, #8d97a6 35%, #4e5661 100%)",
    faceTop: "#6a7380",
    faceBottom: "#2b3138",
    chamber: "radial-gradient(circle at 50% 24%, rgba(255,255,255,0.08), rgba(0,0,0,0.12) 62%, rgba(0,0,0,0.24) 100%)",
    plate: "linear-gradient(180deg, rgba(20,24,31,0.82), rgba(8,10,14,0.92))",
    silhouette: "polygon(9% 0%, 91% 0%, 100% 7%, 100% 93%, 91% 100%, 9% 100%, 0% 93%, 0% 7%)",
    shine: "linear-gradient(115deg, transparent 24%, rgba(255,255,255,0.14) 34%, rgba(255,255,255,0.03) 41%, transparent 50%)",
    shineOpacity: 0.22,
  },
  rare: {
    label: "Rare",
    labelBg: "#2f6fd5",
    labelClass: "text-white",
    border: "rgba(95,160,255,0.56)",
    glow: "rgba(70,140,255,0.24)",
    shellTop: "#315aa0",
    shellBottom: "#0a1834",
    frame: "linear-gradient(145deg, #d8e6ff 0%, #6ca8ff 34%, #163f82 100%)",
    faceTop: "#3e68ae",
    faceBottom: "#11284c",
    chamber: "radial-gradient(circle at 50% 24%, rgba(130,192,255,0.18), rgba(17,40,76,0.24) 62%, rgba(9,18,37,0.34) 100%)",
    plate: "linear-gradient(180deg, rgba(16,29,55,0.82), rgba(8,16,30,0.92))",
    silhouette: "polygon(7% 0%, 93% 0%, 100% 10%, 100% 90%, 93% 100%, 7% 100%, 0% 90%, 0% 10%)",
    shine: "linear-gradient(115deg, transparent 24%, rgba(174,215,255,0.22) 33%, rgba(255,255,255,0.07) 42%, transparent 53%)",
    shineOpacity: 0.34,
  },
  epic: {
    label: "Epic",
    labelBg: "#7a35c7",
    labelClass: "text-white",
    border: "rgba(183,106,255,0.56)",
    glow: "rgba(162,72,255,0.24)",
    shellTop: "#5f31a1",
    shellBottom: "#170a25",
    frame: "linear-gradient(145deg, #e1c6ff 0%, #a05cff 35%, #3d165d 100%)",
    faceTop: "#6a3fb0",
    faceBottom: "#261038",
    chamber: "radial-gradient(circle at 50% 24%, rgba(205,141,255,0.18), rgba(38,16,56,0.24) 62%, rgba(18,8,28,0.34) 100%)",
    plate: "linear-gradient(180deg, rgba(32,14,48,0.84), rgba(14,8,22,0.92))",
    silhouette: "polygon(11% 0%, 89% 0%, 100% 6%, 100% 94%, 89% 100%, 11% 100%, 0% 94%, 0% 6%)",
    shine: "linear-gradient(115deg, transparent 23%, rgba(220,168,255,0.23) 34%, rgba(255,255,255,0.08) 42%, transparent 55%)",
    shineOpacity: 0.38,
  },
  legendary: {
    label: "Legendary",
    labelBg: "linear-gradient(90deg,#b96e11,#e0ab3d)",
    labelClass: "text-black",
    border: "rgba(255,212,107,0.62)",
    glow: "rgba(255,203,82,0.28)",
    shellTop: "#af7d21",
    shellBottom: "#2d1902",
    frame: "linear-gradient(145deg, #fff0b2 0%, #f0c35a 34%, #835307 100%)",
    faceTop: "#be8b2b",
    faceBottom: "#553307",
    chamber: "radial-gradient(circle at 50% 22%, rgba(255,224,150,0.22), rgba(85,51,7,0.26) 58%, rgba(45,25,2,0.36) 100%)",
    plate: "linear-gradient(180deg, rgba(48,31,8,0.84), rgba(24,14,3,0.94))",
    silhouette: "polygon(12% 0%, 24% 8%, 36% 0%, 50% 10%, 64% 0%, 76% 8%, 88% 0%, 100% 12%, 100% 88%, 90% 100%, 10% 100%, 0% 88%, 0% 12%)",
    shine: "linear-gradient(115deg, transparent 22%, rgba(255,223,128,0.25) 33%, rgba(255,255,255,0.12) 42%, transparent 54%)",
    shineOpacity: 0.46,
  },
  unique: {
    label: "Unique",
    labelBg: "linear-gradient(90deg,#3ad3ff,#ff63cd)",
    labelClass: "text-black",
    border: "rgba(160,234,255,0.58)",
    glow: "rgba(124,247,255,0.22)",
    shellTop: "#2a3140",
    shellBottom: "#090c12",
    frame: "linear-gradient(145deg, #bafcff 0%, #7c9cff 32%, #ff7ad9 64%, #1b1d29 100%)",
    faceTop: "#202634",
    faceBottom: "#0d1017",
    chamber: "radial-gradient(circle at 50% 21%, rgba(152,243,255,0.20), rgba(255,118,217,0.16) 42%, rgba(12,15,23,0.36) 100%)",
    plate: "linear-gradient(180deg, rgba(19,24,34,0.86), rgba(8,11,16,0.94))",
    silhouette: "polygon(5% 0%, 95% 0%, 100% 14%, 100% 86%, 86% 100%, 14% 100%, 0% 86%, 0% 14%)",
    shine: "linear-gradient(115deg, transparent 22%, rgba(124,247,255,0.18) 31%, rgba(255,114,214,0.20) 38%, rgba(255,255,255,0.09) 45%, transparent 55%)",
    shineOpacity: 0.52,
    uniqueHolo: true,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeStats(player: PlayerCardData) {
  const rating = clamp(Number(player.rating) || 70, 45, 99);
  const form = clamp(Number(player.form) || 72, 40, 99);
  const pos = String(player.position || "").toUpperCase();
  const atkBias = pos.includes("FWD") || pos.includes("ST") ? 8 : pos.includes("MID") ? 4 : -2;
  const defBias = pos.includes("GK") || pos.includes("DEF") ? 9 : pos.includes("MID") ? 3 : -4;

  return [
    { key: "ATK", value: clamp(rating + atkBias, 40, 99) },
    { key: "CTL", value: clamp(Math.round(rating * 0.94 + 2), 38, 99) },
    { key: "DEF", value: clamp(rating + defBias, 35, 99) },
    { key: "FRM", value: form },
  ];
}

function useResolvedImage(player: PlayerCardData) {
  const imageCandidates = React.useMemo(() => {
    const list = Array.isArray(player.imageCandidates) ? player.imageCandidates : [];
    const merged = [player.image, ...list].filter((value): value is string => Boolean(String(value || "").trim()));
    return Array.from(new Set(merged));
  }, [player.image, player.imageCandidates]);

  const [imageIndex, setImageIndex] = React.useState(0);

  React.useEffect(() => {
    setImageIndex(0);
  }, [player.id, imageCandidates.join("|")]);

  React.useEffect(() => {
    const src = imageCandidates[imageIndex];
    if (!src) return;
    const probe = new Image();
    probe.onload = () => {};
    probe.onerror = () => setImageIndex((prev) => (prev >= imageCandidates.length - 1 ? prev : prev + 1));
    probe.src = src;
  }, [imageCandidates, imageIndex]);

  return imageCandidates[imageIndex] || "/images/player-1.png";
}

export default function FantasyCard({ player, className = "" }: FantasyCardProps) {
  const rarity = player.rarity;
  const cfg = rarityConfig[rarity];
  const stats = computeStats(player);
  const imageUrl = useResolvedImage(player);

  const [hoverTilt, setHoverTilt] = React.useState({ x: 0, y: 0 });

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setHoverTilt({ x: clamp(nx, -1, 1), y: clamp(ny, -1, 1) });
  };

  return (
    <article
      className={[
        "group relative isolate aspect-[2.5/3.5] w-[260px] select-none transition-transform duration-300 hover:scale-[1.025]",
        className,
      ].join(" ")}
      onPointerLeave={() => {
        setHoverTilt({ x: 0, y: 0 });
      }}
      onPointerMove={onPointerMove}
      style={
        {
          ["--tilt-x" as string]: `${hoverTilt.y * 6}deg`,
          ["--tilt-y" as string]: `${hoverTilt.x * 8}deg`,
          transform: "rotateX(var(--tilt-x)) rotateY(var(--tilt-y)) translateZ(0)",
          transformStyle: "preserve-3d",
          filter: `drop-shadow(0 18px 30px ${cfg.glow})`,
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-[2%] rounded-[30px] blur-xl transition duration-300 group-hover:scale-[1.08]"
        style={{
          background: cfg.glow,
          transform: "translateZ(-26px)",
        }}
      />

      <div
        className="absolute inset-0 rounded-[30px]"
        style={{
          clipPath: cfg.silhouette,
          background: `linear-gradient(180deg, ${cfg.shellTop} 0%, ${cfg.shellBottom} 100%)`,
          boxShadow: `
            0 30px 44px rgba(0,0,0,0.44),
            0 10px 18px rgba(0,0,0,0.30),
            inset 0 2px 0 rgba(255,255,255,0.24),
            inset 0 -12px 16px rgba(0,0,0,0.40)
          `,
          transform: "translateZ(0px)",
        }}
      />

      <div
        className="absolute inset-[1.65%] rounded-[28px]"
        style={{
          clipPath: cfg.silhouette,
          background: cfg.frame,
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.34),
            inset 0 -3px 8px rgba(0,0,0,0.34),
            0 0 0 1px rgba(255,255,255,0.08)
          `,
          transform: "translateZ(8px)",
        }}
      />

      <div
        className="absolute inset-[5.2%] overflow-hidden rounded-[22px]"
        style={{
          background: `linear-gradient(180deg, ${cfg.faceTop} 0%, ${cfg.faceBottom} 100%)`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -10px 14px rgba(0,0,0,0.30)",
          transform: "translateZ(16px)",
        }}
      >
        <div
          className="absolute inset-x-[3%] top-[2.5%] h-[17%] rounded-[14px]"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(0,0,0,0.10))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -2px 6px rgba(0,0,0,0.22)",
          }}
        />

        <div
          className="absolute inset-x-[4%] top-[15%] h-[50%] overflow-hidden rounded-[18px]"
          style={{
            background: cfg.chamber,
            boxShadow: "inset 0 3px 10px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.10), 0 12px 20px rgba(0,0,0,0.24)",
            transform: "translateZ(22px)",
          }}
        >
          <img
            src={imageUrl}
            alt={player.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
            style={{
              filter: "contrast(1.14) saturate(1.10) brightness(1.01)",
              transform: "scale(1.04) translateY(1px)",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,transparent_20%,transparent_72%,rgba(0,0,0,0.20)_100%)] mix-blend-soft-light" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(0,0,0,0.28),transparent_56%)]" />
        </div>

        <header className="absolute inset-x-[6%] top-[5.2%] z-20 flex items-start justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">{player.club || "FantasyFC"}</p>
            <p className="mt-1 text-[38px] font-black leading-none tracking-[-0.05em] text-white" style={{ textShadow: "0 2px 5px rgba(0,0,0,0.35)" }}>
              {player.rating}
            </p>
        </div>
          <div className="text-right">
            <p className="text-[17px] font-black uppercase tracking-[0.10em] text-white">{player.position}</p>
            <Badge className={`mt-1 border-0 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${cfg.labelClass}`} style={{ background: cfg.labelBg }}>
              {cfg.label}
            </Badge>
          </div>
        </header>

        <footer
          className="absolute inset-x-[4.3%] bottom-[3.2%] z-20 rounded-[18px] px-3 pb-3 pt-2.5"
          style={{
            background: cfg.plate,
            border: `1px solid ${cfg.border}`,
            boxShadow: "0 18px 28px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -8px 12px rgba(0,0,0,0.30)",
            backdropFilter: "blur(8px)",
            transform: "translateZ(38px)",
          }}
        >
          <h3 className="truncate text-center text-[22px] font-black uppercase leading-[0.92] tracking-[-0.02em] text-white">{player.name}</h3>
          <p className="mt-1 truncate text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
            {player.position} • {player.club || "FantasyFC"}
          </p>

          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {stats.map((stat) => (
              <div
                key={stat.key}
                className="rounded-[10px] px-1.5 py-1 text-center"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.12))",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -3px 6px rgba(0,0,0,0.24)",
                }}
              >
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/58">{stat.key}</p>
                <p className="text-[13px] font-extrabold leading-tight text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.14em] text-white/62">
            <span className="inline-flex items-center gap-1">
              <Zap className="h-3 w-3 text-yellow-300" />
              {player.position}
            </span>
            <span>#{String(player.serial || 1).padStart(3, "0")} / {player.maxSupply || 500}</span>
          </div>
        </footer>

        <div
          className="pointer-events-none absolute inset-[-30%] transition duration-500 group-hover:translate-x-[9%]"
          style={{
            opacity: cfg.shineOpacity,
            background: cfg.shine,
            mixBlendMode: "screen",
            transform: "translateX(-18%)",
          }}
        />

        {rarity === "legendary" ? (
          <div
            className="pointer-events-none absolute inset-0 z-[23] opacity-35"
            style={{
              background: "radial-gradient(circle at 50% 18%, rgba(255,228,126,0.20), transparent 30%)",
              mixBlendMode: "screen",
            }}
          />
        ) : null}

        {cfg.uniqueHolo ? (
          <div
            className="pointer-events-none absolute inset-[1.4%] z-[25] rounded-[26px]"
            style={{
              background:
                "linear-gradient(130deg, rgba(124,247,255,0.00) 0%, rgba(124,247,255,0.16) 18%, rgba(255,111,214,0.18) 38%, rgba(156,132,255,0.16) 58%, rgba(124,247,255,0.00) 76%)",
              mixBlendMode: "screen",
              opacity: 0.9,
              maskImage: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskImage: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              padding: "2px",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              animation: "uniqueEdgeShift 4.5s linear infinite",
            } as React.CSSProperties}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_-18px_24px_rgba(0,0,0,0.20)]" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 rounded-[22px]"
        style={{
          clipPath: cfg.silhouette,
          border: `2px solid ${cfg.border}`,
          opacity: 0.65,
          transform: "translateZ(36px)",
        }}
      />
    </article>
  );
}
