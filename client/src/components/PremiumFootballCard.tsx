import { memo, useState } from "react";
import { type PlayerCardData } from "./cards/types";

type PremiumFootballCardProps = {
  player: PlayerCardData;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  size?: "sm" | "md" | "lg";
};

type RarityTokens = {
  base1: string;
  base2: string;
  base3: string;
  facetHi: string;
  facetMid: string;
  facetLo: string;
  rimColor: string;
  glowColor: string;
  textAccent: string;
  edgeBorder: string;
  plateBg: string;
  editionLabel: string;
};

const RARITY_TOKENS: Record<string, RarityTokens> = {
  common: {
    base1: "#e8eef4",
    base2: "#8fa4bc",
    base3: "#2a3848",
    facetHi: "rgba(255,255,255,0.38)",
    facetMid: "rgba(180,200,220,0.22)",
    facetLo: "rgba(40,60,80,0.30)",
    rimColor: "#b0c8e0",
    glowColor: "rgba(154,174,194,0.50)",
    textAccent: "#c8daf0",
    edgeBorder: "rgba(200,220,240,0.55)",
    plateBg: "rgba(10,18,28,0.88)",
    editionLabel: "STANDARD EDITION",
  },
  rare: {
    base1: "#c0d8ff",
    base2: "#1c50c8",
    base3: "#060e26",
    facetHi: "rgba(140,190,255,0.40)",
    facetMid: "rgba(40,100,220,0.22)",
    facetLo: "rgba(4,10,40,0.35)",
    rimColor: "#4a90f0",
    glowColor: "rgba(30,80,200,0.60)",
    textAccent: "#80c0ff",
    edgeBorder: "rgba(100,170,255,0.55)",
    plateBg: "rgba(4,8,28,0.90)",
    editionLabel: "◆ RARE EDITION",
  },
  unique: {
    base1: "#e0c0ff",
    base2: "#7820d0",
    base3: "#0e0228",
    facetHi: "rgba(210,140,255,0.40)",
    facetMid: "rgba(140,60,220,0.22)",
    facetLo: "rgba(10,2,40,0.35)",
    rimColor: "#b060f0",
    glowColor: "rgba(120,30,210,0.62)",
    textAccent: "#d090ff",
    edgeBorder: "rgba(190,110,255,0.55)",
    plateBg: "rgba(8,2,24,0.90)",
    editionLabel: "✦ UNIQUE EDITION",
  },
  epic: {
    base1: "#c8c0f8",
    base2: "#3828b0",
    base3: "#080418",
    facetHi: "rgba(180,160,255,0.38)",
    facetMid: "rgba(80,60,180,0.22)",
    facetLo: "rgba(6,2,30,0.35)",
    rimColor: "#7860e0",
    glowColor: "rgba(80,50,200,0.58)",
    textAccent: "#c0b0ff",
    edgeBorder: "rgba(150,130,240,0.52)",
    plateBg: "rgba(6,2,20,0.90)",
    editionLabel: "◈ EPIC EDITION",
  },
  legendary: {
    base1: "#fff8c0",
    base2: "#f0c030",
    base3: "#3a1800",
    facetHi: "rgba(255,240,120,0.50)",
    facetMid: "rgba(240,180,40,0.28)",
    facetLo: "rgba(60,24,0,0.40)",
    rimColor: "#f0c040",
    glowColor: "rgba(220,158,16,0.70)",
    textAccent: "#ffe060",
    edgeBorder: "rgba(255,220,80,0.65)",
    plateBg: "rgba(16,8,0,0.90)",
    editionLabel: "⭐ LAUNCH EDITION",
  },
};

const SIZE_DIMS = {
  sm: { w: 140, h: 200, nameSize: 14, subSize: 8, ratingSize: 18, photoScale: 1.12 },
  md: { w: 168, h: 240, nameSize: 16, subSize: 9, ratingSize: 20, photoScale: 1.15 },
  lg: { w: 240, h: 340, nameSize: 22, subSize: 11, ratingSize: 26, photoScale: 1.18 },
};

function initials(name: string) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function PremiumFootballCardBase({
  player,
  className = "",
  selected = false,
  onClick,
  showPrice = false,
  size = "md",
}: PremiumFootballCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const rarity = String(player.rarity || "common").toLowerCase();
  const t = RARITY_TOKENS[rarity] || RARITY_TOKENS.common;
  const dims = SIZE_DIMS[size] || SIZE_DIMS.md;

  const image = player.image || player.imageUrl || player.photo || player.imageCandidates?.[0];
  const showImage = Boolean(image) && !imgFailed;
  const serial = player.serial && player.maxSupply
    ? `${String(player.serial).padStart(String(player.maxSupply).length, "0")}/${player.maxSupply}`
    : null;
  const pts = Number(player.totalPoints || player.form || player.rating || 0).toFixed(0);

  /* ─── Layered faceted background ─── */
  const facetedBg = [
    /* outer card base */
    `linear-gradient(158deg, ${t.base1} 0%, ${t.base2} 45%, ${t.base3} 100%)`,
    /* top-left large facet */
    `radial-gradient(ellipse 70% 55% at 15% 10%, ${t.facetHi} 0%, transparent 60%)`,
    /* top-right facet */
    `radial-gradient(ellipse 55% 48% at 88% 8%, ${t.facetHi} 0%, transparent 55%)`,
    /* center diamond peak */
    `radial-gradient(ellipse 45% 40% at 50% 38%, ${t.facetMid} 0%, transparent 52%)`,
    /* bottom-left */
    `radial-gradient(ellipse 55% 44% at 12% 90%, ${t.facetMid} 0%, transparent 55%)`,
    /* bottom-right */
    `radial-gradient(ellipse 48% 42% at 90% 85%, ${t.facetHi} 0%, transparent 52%)`,
    /* mid-left shadow */
    `radial-gradient(ellipse 40% 35% at 5% 50%, ${t.facetLo} 0%, transparent 50%)`,
    /* polygon lines — diagonal strokes */
    `repeating-linear-gradient(62deg, transparent 0px, transparent 22px, ${t.facetHi.replace(/[\d.]+\)$/, "0.06)")} 22px, ${t.facetHi.replace(/[\d.]+\)$/, "0.06)")} 23px)`,
    `repeating-linear-gradient(-55deg, transparent 0px, transparent 28px, ${t.facetMid.replace(/[\d.]+\)$/, "0.05)")} 28px, ${t.facetMid.replace(/[\d.]+\)$/, "0.05)")} 29px)`,
  ].join(", ");

  /* ─── Foil diagonal sweep ─── */
  const foilSweep = `linear-gradient(118deg, transparent 0%, transparent 28%, ${t.facetHi.replace(/[\d.]+\)$/, "0.28)")} 38%, ${t.facetHi.replace(/[\d.]+\)$/, "0.12)")} 48%, transparent 58%)`;

  /* ─── Chrome slab frame gradients ─── */
  const outerSlabBorder = `linear-gradient(145deg, ${t.base1} 0%, ${t.rimColor} 25%, ${t.base2} 50%, ${t.rimColor} 75%, ${t.base1} 100%)`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${player.name || "Player"} card`}
      data-testid={`premium-card-${player.id}`}
      style={{
        width: dims.w,
        height: dims.h,
        /* Outer drop-shadow + rarity glow */
        filter: `drop-shadow(0 8px 24px ${t.glowColor}) drop-shadow(0 2px 6px rgba(0,0,0,0.6))`,
        transition: "filter 200ms ease, transform 200ms ease",
        flexShrink: 0,
      }}
      className={[
        "group relative inline-block",
        onClick ? "cursor-pointer hover:-translate-y-1.5" : "cursor-default",
        className,
      ].join(" ")}
    >
      {/* ── LAYER 0: Chrome outer slab (2px metallic frame) ── */}
      <div
        className="absolute inset-0 rounded-[18px]"
        style={{
          background: outerSlabBorder,
          padding: 2,
          /* inner bevel */
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.4)`,
        }}
      >
        {/* Inner slab edge (acrylic thickness effect) */}
        <div
          className="h-full w-full rounded-[16px]"
          style={{
            background: `linear-gradient(to bottom, rgba(255,255,255,0.12) 0%, transparent 6%, transparent 94%, rgba(0,0,0,0.18) 100%)`,
            boxShadow: `inset 0 2px 4px rgba(255,255,255,0.20), inset 0 -2px 4px rgba(0,0,0,0.20)`,
          }}
        />
      </div>

      {/* ── LAYER 1: Engraved faceted metal background ── */}
      <div
        className="absolute inset-[2px] rounded-[16px] overflow-hidden"
        style={{ background: facetedBg }}
      />

      {/* ── LAYER 2: Foil shimmer sweep ── */}
      <div
        className="pointer-events-none absolute inset-[2px] rounded-[16px]"
        style={{
          background: foilSweep,
          mixBlendMode: "screen",
          opacity: 0.85,
        }}
      />

      {/* ── LAYER 3: Top shine (glass surface glint) ── */}
      <div
        className="pointer-events-none absolute inset-[2px] rounded-[16px]"
        style={{
          background: `radial-gradient(ellipse 90% 35% at 50% 0%, rgba(255,255,255,0.30) 0%, transparent 65%)`,
          mixBlendMode: "screen",
        }}
      />

      {/* ── LAYER 4: Rim inset highlight ── */}
      <div
        className="pointer-events-none absolute inset-[2px] rounded-[16px]"
        style={{
          boxShadow: `inset 0 0 0 1px ${t.edgeBorder}, inset 0 1px 0 rgba(255,255,255,0.35)`,
        }}
      />

      {/* ── LAYER 5 (CONTENT) ── */}
      <div className="absolute inset-[2px] rounded-[16px] overflow-hidden flex flex-col">

        {/* Top info row */}
        <div
          className="relative z-20 flex items-start justify-between px-2 pt-1.5"
          style={{ gap: 4 }}
        >
          <div>
            {player.season && (
              <p
                className="font-black leading-none"
                style={{
                  fontSize: dims.subSize - 1,
                  color: "rgba(0,0,0,0.65)",
                  textShadow: `0 1px 0 rgba(255,255,255,0.3)`,
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {player.season}
              </p>
            )}
            {serial && (
              <p
                className="font-bold leading-none mt-0.5"
                style={{
                  fontSize: dims.subSize - 1,
                  color: "rgba(0,0,0,0.55)",
                  textShadow: `0 1px 0 rgba(255,255,255,0.3)`,
                }}
              >
                {serial}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end">
            <p
              className="font-black leading-none"
              style={{
                fontSize: dims.subSize,
                color: "rgba(0,0,0,0.65)",
                textShadow: `0 1px 0 rgba(255,255,255,0.3)`,
              }}
            >
              {player.team || player.club || "FFC"}
            </p>
            {player.serial && (
              <p
                className="font-bold leading-none mt-0.5"
                style={{
                  fontSize: dims.subSize - 1,
                  color: "rgba(0,0,0,0.55)",
                  textShadow: `0 1px 0 rgba(255,255,255,0.3)`,
                }}
              >
                #{player.serial}
              </p>
            )}
          </div>
        </div>

        {/* Player photo zone — midground, fills the card */}
        <div className="relative flex-1 flex items-end justify-center">
          {showImage ? (
            <img
              src={image}
              alt={player.name}
              onError={() => setImgFailed(true)}
              loading="lazy"
              decoding="async"
              style={{
                position: "absolute",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: `${Math.round(dims.w * dims.photoScale)}px`,
                height: `${Math.round(dims.h * 0.78)}px`,
                objectFit: "contain",
                objectPosition: "bottom center",
                /* Cut-out feel — no rectangle, just the player */
                filter: `drop-shadow(0 8px 20px rgba(0,0,0,0.70)) drop-shadow(0 2px 6px rgba(0,0,0,0.50))`,
                zIndex: 10,
              }}
            />
          ) : (
            <div
              className="mb-10 flex items-center justify-center rounded-2xl border border-white/20 bg-black/20"
              style={{ width: dims.w * 0.55, height: dims.h * 0.44 }}
            >
              <span
                className="font-black text-white/40 select-none"
                style={{ fontSize: dims.nameSize + 8 }}
              >
                {initials(player.name)}
              </span>
            </div>
          )}

          {/* Rarity sparkle points (foreground, above photo) */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle 3px at 15% 25%, ${t.facetHi} 0%, transparent 100%), radial-gradient(circle 2px at 82% 18%, ${t.facetHi} 0%, transparent 100%), radial-gradient(circle 2px at 70% 55%, ${t.facetMid} 0%, transparent 100%), radial-gradient(circle 3px at 25% 70%, ${t.facetMid} 0%, transparent 100%)`,
              zIndex: 5,
              mixBlendMode: "screen",
            }}
          />

          {/* Bottom gradient — fades photo into name plate */}
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: "45%",
              background: `linear-gradient(to top, ${t.plateBg} 0%, ${t.plateBg.replace(/[\d.]+\)$/, "0.80)")} 35%, transparent 100%)`,
              zIndex: 11,
            }}
          />
        </div>

        {/* ── LAYER 6: Name plate — foreground ── */}
        <div
          className="relative z-20 px-2 pb-2"
          style={{
            /* Metallic engraved plate */
            background: `linear-gradient(to top, ${t.plateBg} 0%, rgba(0,0,0,0) 100%)`,
          }}
        >
          {/* Plate top rule */}
          <div
            className="w-full mb-1"
            style={{
              height: 1,
              background: `linear-gradient(to right, transparent, ${t.rimColor}, transparent)`,
              opacity: 0.55,
            }}
          />

          {/* Player name — large, bold, embossed */}
          <p
            className="font-black uppercase leading-none tracking-tight text-white"
            style={{
              fontSize: dims.nameSize,
              textShadow: `0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.9), 0 0 16px ${t.glowColor}`,
              fontFamily: "'Inter', 'Arial Black', system-ui, sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {player.name}
          </p>

          {/* Position */}
          <p
            className="mt-0.5 font-bold uppercase tracking-widest"
            style={{
              fontSize: dims.subSize,
              color: t.textAccent,
              textShadow: `0 1px 4px rgba(0,0,0,0.8), 0 0 8px ${t.glowColor}`,
            }}
          >
            {player.position || "PLAYER"}
          </p>

          {/* PTS row */}
          <div className="mt-1 flex items-center justify-between">
            <span
              className="font-black"
              style={{
                fontSize: dims.subSize,
                color: "rgba(255,255,255,0.70)",
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              }}
            >
              {pts !== "0" ? `PTS ${pts}` : ""}
            </span>
            {showPrice && Number(player.price || player.listedPrice || 0) > 0 && (
              <span
                className="rounded px-1.5 font-black"
                style={{
                  fontSize: dims.subSize,
                  color: "#4ade80",
                  background: "rgba(74,222,128,0.15)",
                  border: "1px solid rgba(74,222,128,0.30)",
                }}
              >
                N${Number(player.price || player.listedPrice || 0).toFixed(2)}
              </span>
            )}
          </div>

          {/* Edition label */}
          <div
            className="mt-1 w-full text-center font-black uppercase tracking-widest"
            style={{
              fontSize: dims.subSize - 1,
              color: t.textAccent,
              textShadow: `0 0 6px ${t.glowColor}`,
              borderTop: `1px solid ${t.edgeBorder}`,
              paddingTop: 3,
            }}
          >
            {t.editionLabel}
          </div>
        </div>
      </div>

      {/* ── Selected ring ── */}
      {selected && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[18px]"
          style={{ boxShadow: "0 0 0 3px #34d399, 0 0 12px rgba(52,211,153,0.5)" }}
        />
      )}
    </button>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
export default PremiumFootballCard;
