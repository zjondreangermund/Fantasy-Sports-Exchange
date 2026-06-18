import { memo, useMemo, useState } from "react";
import { type PlayerCardData } from "./cards/types";

type PlayerTileProps = {
  player: PlayerCardData;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  className?: string;
};

type ChromeConfig = {
  frameGrad: string;
  faceGrad: string;
  facetColor: string;
  glow: string;
  dropGlow: string;
  accentColor: string;
  labelBg: string;
  label: string;
  rimBorder: string;
};

const CHROME: Record<string, ChromeConfig> = {
  common: {
    label: "Common",
    frameGrad: "linear-gradient(145deg,#dde6f0 0%,#8fa0b4 40%,#4a5666 100%)",
    faceGrad: "linear-gradient(175deg,#7a8fa8 0%,#2e3a4a 60%,#111820 100%)",
    facetColor: "rgba(200,220,240,0.18)",
    glow: "rgba(154,174,194,0.38)",
    dropGlow: "rgba(154,174,194,0.30)",
    accentColor: "#c8daf0",
    labelBg: "linear-gradient(135deg,#7090b0,#b0c4da)",
    rimBorder: "rgba(200,220,240,0.40)",
  },
  rare: {
    label: "Rare",
    frameGrad: "linear-gradient(145deg,#d0e8ff 0%,#4a90e8 38%,#0e2e6e 100%)",
    faceGrad: "linear-gradient(175deg,#2856b0 0%,#0e1e4a 60%,#060e22 100%)",
    facetColor: "rgba(100,170,255,0.22)",
    glow: "rgba(30,80,200,0.50)",
    dropGlow: "rgba(30,80,200,0.38)",
    accentColor: "#90c8ff",
    labelBg: "linear-gradient(135deg,#1040b8,#4090f0)",
    rimBorder: "rgba(100,170,255,0.45)",
  },
  unique: {
    label: "Unique",
    frameGrad: "linear-gradient(145deg,#e8d0ff 0%,#9040e8 38%,#2e0868 100%)",
    faceGrad: "linear-gradient(175deg,#6020b0 0%,#1a063a 60%,#08021a 100%)",
    facetColor: "rgba(180,100,255,0.22)",
    glow: "rgba(120,30,210,0.52)",
    dropGlow: "rgba(120,30,210,0.38)",
    accentColor: "#cc88ff",
    labelBg: "linear-gradient(135deg,#6010a8,#c060ff)",
    rimBorder: "rgba(180,100,255,0.45)",
  },
  epic: {
    label: "Epic",
    frameGrad: "linear-gradient(145deg,#c8c0ff 0%,#5040c8 38%,#100828 100%)",
    faceGrad: "linear-gradient(175deg,#3020a0 0%,#0c0820 60%,#040410 100%)",
    facetColor: "rgba(120,100,255,0.22)",
    glow: "rgba(80,50,200,0.50)",
    dropGlow: "rgba(80,50,200,0.36)",
    accentColor: "#b0a0ff",
    labelBg: "linear-gradient(135deg,#201060,#6050c0)",
    rimBorder: "rgba(120,100,255,0.42)",
  },
  legendary: {
    label: "Legendary",
    frameGrad: "linear-gradient(145deg,#fff8c0 0%,#f0c040 30%,#a06008 70%,#3a1800 100%)",
    faceGrad: "linear-gradient(175deg,#c08010 0%,#5a3204 60%,#1a0c02 100%)",
    facetColor: "rgba(255,210,80,0.28)",
    glow: "rgba(220,158,16,0.60)",
    dropGlow: "rgba(220,158,16,0.45)",
    accentColor: "#ffe060",
    labelBg: "linear-gradient(135deg,#906008,#f0c030)",
    rimBorder: "rgba(255,210,80,0.55)",
  },
};

function playerInitials(name: string) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function getPoints(player: PlayerCardData) {
  const scores = Array.isArray(player.last5Scores)
    ? player.last5Scores.map((v) => Number(v || 0)).filter((v) => v > 0)
    : [];
  const last = scores.length ? scores[scores.length - 1] : Number(player.form || player.rating || 0);
  const total = Number(player.totalPoints || scores.reduce((s, v) => s + v, 0));
  return { last: Math.round(last * 10) / 10, total: Math.round(total * 10) / 10 };
}

function PlayerTileBase({ player, selected = false, onClick, showPrice = false, className = "" }: PlayerTileProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const rarity = String(player.rarity || "common").toLowerCase();
  const cfg = CHROME[rarity] || CHROME.common;
  const points = useMemo(() => getPoints(player), [player]);
  const image = player.image || player.imageUrl || player.photo || player.imageCandidates?.[0];
  const showImage = Boolean(image) && !imgFailed;
  const serialText = player.serial && player.maxSupply ? `#${String(player.serial).padStart(3, "0")}/${player.maxSupply}` : null;

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`player-tile-${player.id}`}
      aria-label={`${player.name || "Player"} card`}
      style={{
        filter: `drop-shadow(0 6px 18px ${cfg.dropGlow})`,
        transition: "filter 180ms ease, transform 180ms ease",
      }}
      className={[
        "group relative flex h-[218px] w-[156px] flex-col overflow-hidden rounded-[20px] text-left sm:h-[232px] sm:w-[168px]",
        "hover:-translate-y-1",
        selected ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-950" : "",
        onClick ? "cursor-pointer" : "cursor-default",
        className,
      ].join(" ")}
    >
      {/* Chrome frame border */}
      <div
        className="absolute inset-0 rounded-[20px]"
        style={{ background: cfg.frameGrad, padding: 2 }}
      >
        <div className="h-full w-full rounded-[18px]" style={{ background: cfg.faceGrad }} />
      </div>

      {/* Crystal facet pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[20px]"
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at 25% 20%, ${cfg.facetColor} 0%, transparent 55%),
            radial-gradient(ellipse 50% 45% at 78% 15%, ${cfg.facetColor} 0%, transparent 48%),
            radial-gradient(ellipse 45% 40% at 60% 70%, ${cfg.facetColor} 0%, transparent 44%),
            repeating-linear-gradient(58deg, transparent 0px, transparent 14px, ${cfg.facetColor.replace(/[\d.]+\)$/, "0.07)")} 14px, ${cfg.facetColor.replace(/[\d.]+\)$/, "0.07)")} 15px)
          `,
          mixBlendMode: "screen",
          opacity: 0.9,
        }}
      />

      {/* Top shine */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[20px]"
        style={{
          background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,255,255,0.22) 0%, transparent 60%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Rim glow inset */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[20px]"
        style={{
          boxShadow: `inset 0 0 0 1px ${cfg.rimBorder}, inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -8px 18px rgba(0,0,0,0.4)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Top row: rating + serial/rarity */}
        <div className="flex items-start justify-between p-2.5 pb-0">
          <div className="flex flex-col items-start">
            <span
              className="font-black leading-none"
              style={{
                fontSize: 22,
                color: "#fff",
                textShadow: `0 2px 8px rgba(0,0,0,0.9), 0 0 12px ${cfg.accentColor}55`,
                fontFamily: "'Inter','Arial Black',system-ui,sans-serif",
              }}
            >
              {Number(player.rating || points.last || 0).toFixed(0)}
            </span>
            <span
              className="mt-0.5 font-black uppercase tracking-widest"
              style={{ fontSize: 7, color: cfg.accentColor, textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}
            >
              {player.position || "N/A"}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            {serialText && (
              <span
                className="font-bold tracking-wider"
                style={{ fontSize: 6, color: "rgba(255,255,255,0.55)", textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}
              >
                {serialText}
              </span>
            )}
            <span
              className="rounded px-1.5 py-0.5 font-black uppercase tracking-widest"
              style={{
                fontSize: 6,
                background: cfg.labelBg,
                color: "#fff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Player photo — fills middle */}
        <div className="relative mx-2 mt-1.5 flex flex-1 items-end overflow-hidden rounded-[14px]">
          <div
            className="absolute inset-0 rounded-[14px]"
            style={{ background: "rgba(0,0,0,0.18)", backdropFilter: "blur(1px)" }}
          />
          {showImage ? (
            <img
              src={image}
              alt={player.name}
              onError={() => setImgFailed(true)}
              loading="lazy"
              decoding="async"
              className="absolute bottom-0 left-1/2 h-[118%] w-[118%] -translate-x-1/2 object-contain object-bottom transition-transform duration-300 group-hover:scale-[1.04]"
              style={{ filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.55))" }}
            />
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-white/15 bg-white/8 text-xl font-black text-white/35">
              {playerInitials(player.name)}
            </div>
          )}
          {/* Bottom fade over photo */}
          <div className="absolute inset-x-0 bottom-0 h-16 rounded-b-[14px]" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)" }} />
        </div>

        {/* Bottom info panel */}
        <div
          className="relative mx-0 rounded-b-[20px] px-2.5 pb-2 pt-1.5"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.50) 100%)",
          }}
        >
          {/* Player name */}
          <p
            className="truncate font-black uppercase leading-none tracking-tight text-white"
            style={{ fontSize: 11, textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}
          >
            {player.name}
          </p>
          <p
            className="mt-0.5 truncate uppercase tracking-wider"
            style={{ fontSize: 7, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}
          >
            {player.team || player.club || "FantasyFC"}
          </p>

          {/* Stats row */}
          <div
            className="mt-1.5 grid grid-cols-2 gap-1"
            style={{ borderTop: `1px solid ${cfg.accentColor}30`, paddingTop: 5 }}
          >
            <div className="rounded-lg border border-white/8 bg-black/30 px-1.5 py-1">
              <p className="font-bold uppercase text-white/40" style={{ fontSize: 6 }}>Total</p>
              <p className="font-black text-white" style={{ fontSize: 12 }}>{points.total}</p>
            </div>
            <div className="rounded-lg border border-white/8 bg-black/30 px-1.5 py-1">
              <p className="font-bold uppercase text-white/40" style={{ fontSize: 6 }}>Last</p>
              <p className="font-black text-white" style={{ fontSize: 12 }}>{points.last}</p>
            </div>
          </div>

          {/* Edition label */}
          <p
            className="mt-1 truncate text-center font-black uppercase tracking-[0.16em]"
            style={{ fontSize: 6, color: cfg.accentColor, textShadow: `0 0 6px ${cfg.accentColor}80` }}
          >
            {rarity === "legendary" ? "⭐ LAUNCH EDITION" : rarity === "unique" ? "✦ UNIQUE EDITION" : rarity === "rare" ? "◆ RARE EDITION" : rarity === "epic" ? "◈ EPIC EDITION" : "STANDARD EDITION"}
          </p>

          {showPrice && Number(player.price || player.listedPrice || 0) > 0 && (
            <p
              className="mt-1 rounded-lg px-1.5 py-0.5 text-center font-black"
              style={{ fontSize: 10, color: "#4ade80", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)" }}
            >
              N${Number(player.price || player.listedPrice || 0).toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

const PlayerTile = memo(PlayerTileBase);
export default PlayerTile;
