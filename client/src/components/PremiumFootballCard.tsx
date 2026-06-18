import { memo, useMemo, useState } from "react";
import { type PlayerCardData } from "./cards/types";

type PremiumFootballCardProps = {
  player: PlayerCardData;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
};

type RarityTheme = {
  label: string;
  primary: string;
  secondary: string;
  dark: string;
  light: string;
  border: string;
  shadow: string;
  text: string;
};

const themes: Record<string, RarityTheme> = {
  common: {
    label: "COMMON",
    primary: "#cbd5e1",
    secondary: "#94a3b8",
    dark: "#334155",
    light: "#f8fafc",
    border: "#e2e8f0",
    shadow: "rgba(148,163,184,.42)",
    text: "#0f172a",
  },
  rare: {
    label: "RARE",
    primary: "#60a5fa",
    secondary: "#2563eb",
    dark: "#1e3a8a",
    light: "#dbeafe",
    border: "#bfdbfe",
    shadow: "rgba(37,99,235,.42)",
    text: "#06152f",
  },
  unique: {
    label: "UNIQUE",
    primary: "#d946ef",
    secondary: "#9333ea",
    dark: "#581c87",
    light: "#fae8ff",
    border: "#f0abfc",
    shadow: "rgba(147,51,234,.46)",
    text: "#2e073f",
  },
  epic: {
    label: "EPIC",
    primary: "#818cf8",
    secondary: "#2563eb",
    dark: "#312e81",
    light: "#e0e7ff",
    border: "#c7d2fe",
    shadow: "rgba(79,70,229,.44)",
    text: "#111244",
  },
  legendary: {
    label: "LEGENDARY",
    primary: "#f5d442",
    secondary: "#d4af37",
    dark: "#7c4a03",
    light: "#fff2a8",
    border: "#f7e27a",
    shadow: "rgba(245,158,11,.55)",
    text: "#171006",
  },
};

const sizeMap = {
  sm: { width: 156, height: 218, scale: 0.433 },
  md: { width: 178, height: 249, scale: 0.494 },
  lg: { width: 230, height: 322, scale: 0.639 },
};

function firstValidImage(player: PlayerCardData) {
  return [player.image, player.imageUrl, player.photo, ...(player.imageCandidates || [])].filter(Boolean) as string[];
}

function initials(name: string) {
  return String(name || "Player")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function splitName(name: string) {
  const parts = String(name || "Unknown Player").trim().split(/\s+/);
  if (parts.length <= 1) return [parts[0] || "UNKNOWN", ""];
  return [parts[0], parts.slice(1).join(" ")];
}

function shortClub(value?: string) {
  const text = String(value || "FA").trim();
  if (!text) return "FA";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
}

function statTotal(player: PlayerCardData) {
  const scores = Array.isArray(player.last5Scores) ? player.last5Scores.map((v) => Number(v || 0)).slice(0, 5) : [];
  return Math.max(0, Math.round(Number(player.totalPoints || scores.reduce((sum, value) => sum + value, 0) || player.form || player.rating || 0)));
}

function PremiumFootballCardBase({ player, selected = false, onClick, showPrice = false, className = "", size = "md" }: PremiumFootballCardProps) {
  const rarity = String(player.rarity || "common").toLowerCase();
  const theme = themes[rarity] || themes.common;
  const dimensions = sizeMap[size];
  const images = useMemo(() => firstValidImage(player), [player]);
  const [imageIndex, setImageIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const currentImage = images[imageIndex];
  const showImage = Boolean(currentImage) && !failed;
  const rating = Math.max(0, Math.round(Number(player.rating || player.form || statTotal(player) || 0)));
  const season = player.season || "2025 - 26";
  const serial = player.serial && player.maxSupply ? `${player.serial}/${player.maxSupply}` : player.maxSupply ? `1/${player.maxSupply}` : "1000/1000";
  const club = player.team || player.club || "Fantasy Arena";
  const [firstName, lastName] = splitName(player.name);
  const national = player.nationality || "FC";
  const position = player.position || "PLAYER";

  const handleImageError = () => {
    if (imageIndex < images.length - 1) setImageIndex((index) => index + 1);
    else setFailed(true);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative isolate bg-transparent p-0 text-left outline-none transition-transform duration-200",
        onClick ? "cursor-pointer hover:-translate-y-1" : "cursor-default",
        selected ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-950" : "",
        className,
      ].join(" ")}
      style={{ width: dimensions.width, height: dimensions.height, borderRadius: 20 * dimensions.scale }}
      data-testid={`premium-football-card-${player.id}`}
      aria-label={`${player.name || "Player"} card`}
    >
      <div
        style={{
          position: "relative",
          width: 360,
          height: 504,
          overflow: "hidden",
          borderRadius: 22,
          color: theme.text,
          background: `linear-gradient(145deg, ${theme.primary}, ${theme.secondary})`,
          border: `2px solid ${theme.border}`,
          transformOrigin: "top left",
          transform: `scale(${dimensions.scale})`,
          boxShadow: `0 0 0 1px rgba(255,255,255,.22) inset, 0 8px 24px rgba(0,0,0,.25), 0 20px 48px ${theme.shadow}`,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 8,
            borderRadius: 18,
            background: `linear-gradient(145deg, ${theme.primary}, ${theme.secondary})`,
            boxShadow: "inset 0 0 10px rgba(255,255,255,.32), inset 0 8px 20px rgba(255,255,255,.14), inset 0 -14px 30px rgba(0,0,0,.24)",
          }}
        />

        <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 1 }}>
          <div style={{ position: "absolute", top: -30, left: -32, width: 250, height: 250, clipPath: "polygon(0 0, 75% 0, 48% 100%, 0 68%)", background: "linear-gradient(145deg, rgba(0,0,0,.10), rgba(255,255,255,.06))", boxShadow: "inset 0 6px 12px rgba(0,0,0,.20), inset 0 -5px 10px rgba(255,255,255,.16)" }} />
          <div style={{ position: "absolute", top: 42, right: -28, width: 185, height: 180, clipPath: "polygon(24% 0, 100% 0, 100% 82%, 16% 100%)", background: "linear-gradient(145deg, rgba(255,255,255,.08), rgba(0,0,0,.13))", boxShadow: "inset 0 7px 14px rgba(0,0,0,.22), inset 0 -5px 10px rgba(255,255,255,.13)" }} />
          <div style={{ position: "absolute", bottom: 118, left: -40, width: 220, height: 170, clipPath: "polygon(0 0, 100% 26%, 72% 100%, 0 86%)", background: "linear-gradient(145deg, rgba(0,0,0,.10), rgba(255,255,255,.09))", boxShadow: "inset 0 6px 14px rgba(0,0,0,.22), inset 0 -5px 10px rgba(255,255,255,.12)" }} />
          <div style={{ position: "absolute", bottom: 86, right: -18, width: 190, height: 125, clipPath: "polygon(14% 0, 100% 20%, 100% 100%, 0 78%)", background: "linear-gradient(145deg, rgba(255,255,255,.09), rgba(0,0,0,.12))", boxShadow: "inset 0 6px 14px rgba(0,0,0,.22), inset 0 -4px 10px rgba(255,255,255,.14)" }} />
          <div style={{ position: "absolute", top: 138, left: 74, width: 150, height: 95, clipPath: "polygon(0 16%, 86% 0, 100% 72%, 24% 100%)", background: "linear-gradient(145deg, rgba(0,0,0,.11), rgba(255,255,255,.10))", boxShadow: "inset 0 6px 13px rgba(0,0,0,.20), inset 0 -4px 10px rgba(255,255,255,.15)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 40% 18%, rgba(255,255,255,.32), transparent 28%), linear-gradient(115deg, transparent 0%, rgba(255,255,255,.16) 34%, transparent 48%, rgba(0,0,0,.12) 100%)" }} />
        </div>

        <div style={{ position: "absolute", top: 20, left: 22, right: 22, zIndex: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontWeight: 900 }}>
          <div style={{ fontSize: 18, letterSpacing: ".04em", lineHeight: 1.1 }}>
            <div>{season}</div>
            <div>{serial}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 18, lineHeight: 1.1 }}>
            <div>{shortClub(club)}</div>
            <div>#{rating || 1}</div>
          </div>
        </div>

        <div style={{ position: "absolute", top: 48, right: 34, width: 34, height: 34, borderRadius: "50%", zIndex: 9, background: "rgba(255,255,255,.28)", border: "2px solid rgba(0,0,0,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 950, boxShadow: "0 3px 8px rgba(0,0,0,.22)" }}>
          {shortClub(club).slice(0, 2)}
        </div>

        <div style={{ position: "absolute", left: 22, right: 22, top: 70, bottom: 157, zIndex: 4, overflow: "hidden", borderRadius: "16px 16px 34px 34px" }}>
          {showImage ? (
            <img
              src={currentImage}
              alt={player.name || "Player"}
              loading="lazy"
              decoding="async"
              onError={handleImageError}
              style={{ width: "122%", height: "116%", marginLeft: "-11%", objectFit: "contain", objectPosition: "bottom center", filter: "drop-shadow(0 16px 16px rgba(0,0,0,.42))", transform: "translateY(9px)", transition: "transform .25s ease" }}
              className="group-hover:scale-[1.03]"
            />
          ) : (
            <div style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%, -50%)", width: 126, height: 126, borderRadius: 24, border: "2px solid rgba(0,0,0,.18)", background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 950, color: "rgba(0,0,0,.42)" }}>
              {initials(player.name)}
            </div>
          )}
        </div>

        <div style={{ position: "absolute", left: 24, right: 24, bottom: 132, height: 34, zIndex: 6, background: `linear-gradient(180deg, transparent, ${theme.primary} 68%)` }} />

        <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, zIndex: 12, textAlign: "center" }}>
          <div style={{ fontSize: 35, lineHeight: .92, fontWeight: 950, letterSpacing: ".05em", textTransform: "uppercase", color: theme.text, textShadow: "0 1px 0 rgba(255,255,255,.22)" }}>
            <div>{firstName}</div>
            {lastName ? <div>{lastName}</div> : null}
          </div>

          <div style={{ marginTop: 10, fontSize: 15, fontWeight: 950, letterSpacing: ".12em", textTransform: "uppercase" }}>{position}</div>

          <div style={{ marginTop: 11, display: "flex", justifyContent: "center", alignItems: "center", gap: 14, fontSize: 13, fontWeight: 900, letterSpacing: ".05em" }}>
            <span>PTS {statTotal(player)}</span>
            <span style={{ width: 18, height: 12, borderRadius: 2, background: "linear-gradient(to bottom, #111 0 33%, #d00 33% 66%, #fc0 66% 100%)", display: "inline-block", boxShadow: "0 0 0 1px rgba(0,0,0,.2)" }} />
            <span>{national}</span>
          </div>

          <div style={{ margin: "12px auto 0", width: 126, borderRadius: 8, border: "1px solid rgba(0,0,0,.22)", background: "rgba(255,255,255,.18)", padding: "6px 8px", fontSize: 10, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase", boxShadow: "inset 0 1px 0 rgba(255,255,255,.24)" }}>
            {showPrice && Number(player.price || player.listedPrice || 0) > 0 ? `N$${Number(player.price || player.listedPrice || 0).toFixed(2)}` : theme.label}
          </div>
        </div>

        <div style={{ position: "absolute", left: 22, bottom: 23, width: 30, height: 30, borderRadius: "50%", border: "3px solid rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 14 }}>
          <div style={{ width: 12, height: 12, clipPath: "polygon(50% 0, 61% 34%, 97% 34%, 68% 55%, 79% 91%, 50% 69%, 21% 91%, 32% 55%, 3% 34%, 39% 34%)", background: "rgba(0,0,0,.78)" }} />
        </div>
        <div style={{ position: "absolute", right: 21, bottom: 23, width: 34, height: 34, borderRadius: "50%", border: "2px solid rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 14, fontSize: 10, fontWeight: 950 }}>FA</div>
      </div>
    </button>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
export default PremiumFootballCard;
