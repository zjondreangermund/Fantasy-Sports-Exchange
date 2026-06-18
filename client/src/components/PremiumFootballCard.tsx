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
  shine: string;
  shadow: string;
  text: string;
};

const themes: Record<string, RarityTheme> = {
  common: { label: "COMMON", primary: "#dce6f3", secondary: "#9aa9bc", dark: "#334155", light: "#ffffff", border: "#f8fafc", shine: "rgba(255,255,255,.72)", shadow: "rgba(148,163,184,.50)", text: "#0f172a" },
  rare: { label: "RARE", primary: "#72b7ff", secondary: "#1d5ee6", dark: "#1e3a8a", light: "#eaf4ff", border: "#dbeafe", shine: "rgba(219,234,254,.76)", shadow: "rgba(37,99,235,.50)", text: "#06152f" },
  unique: { label: "UNIQUE", primary: "#ee7aff", secondary: "#8b2de6", dark: "#581c87", light: "#fff1ff", border: "#f5d0fe", shine: "rgba(250,232,255,.78)", shadow: "rgba(147,51,234,.54)", text: "#2e073f" },
  epic: { label: "EPIC", primary: "#95a0ff", secondary: "#2563eb", dark: "#312e81", light: "#eef2ff", border: "#dbe4ff", shine: "rgba(224,231,255,.78)", shadow: "rgba(79,70,229,.52)", text: "#111244" },
  legendary: { label: "LEGENDARY", primary: "#ffd84a", secondary: "#c58b08", dark: "#7c4a03", light: "#fff6b8", border: "#fff2a8", shine: "rgba(255,247,205,.88)", shadow: "rgba(245,158,11,.68)", text: "#171006" },
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
  return String(name || "Player").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
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

function Sparkle({ left, top, size = 8 }: { left: number; top: number; size?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        zIndex: 20,
        pointerEvents: "none",
        filter: "drop-shadow(0 0 8px rgba(255,255,255,.92)) drop-shadow(0 0 14px rgba(250,204,21,.75))",
      }}
    >
      <div style={{ position: "absolute", left: "50%", top: 0, width: 2, height: size, transform: "translateX(-50%)", borderRadius: 2, background: "rgba(255,255,255,.96)" }} />
      <div style={{ position: "absolute", left: 0, top: "50%", width: size, height: 2, transform: "translateY(-50%)", borderRadius: 2, background: "rgba(255,255,255,.96)" }} />
      <div style={{ position: "absolute", inset: size * 0.32, borderRadius: "50%", background: "#fff" }} />
    </div>
  );
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
          borderRadius: 24,
          color: theme.text,
          background: `linear-gradient(145deg, ${theme.light} 0%, ${theme.primary} 25%, ${theme.secondary} 66%, ${theme.primary} 100%)`,
          border: `2px solid ${theme.border}`,
          transformOrigin: "top left",
          transform: `scale(${dimensions.scale})`,
          boxShadow: `0 0 0 1px rgba(255,255,255,.45) inset, 0 0 0 5px rgba(255,255,255,.08) inset, 0 0 22px ${theme.shine}, 0 12px 28px rgba(0,0,0,.32), 0 24px 58px ${theme.shadow}`,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ position: "absolute", inset: 6, borderRadius: 20, zIndex: 2, pointerEvents: "none", border: `1px solid ${theme.shine}`, boxShadow: `inset 0 0 14px rgba(255,255,255,.62), inset 0 0 34px rgba(255,255,255,.18), 0 0 18px ${theme.shine}` }} />
        <div style={{ position: "absolute", inset: 11, borderRadius: 16, zIndex: 2, pointerEvents: "none", border: "1px solid rgba(0,0,0,.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.55), inset 0 -10px 22px rgba(0,0,0,.22)" }} />

        <div style={{ position: "absolute", inset: 8, borderRadius: 18, background: `linear-gradient(145deg, ${theme.light} 0%, ${theme.primary} 28%, ${theme.secondary} 74%, ${theme.primary})`, boxShadow: "inset 0 0 18px rgba(255,255,255,.46), inset 0 11px 24px rgba(255,255,255,.22), inset 0 -18px 38px rgba(0,0,0,.28)" }} />

        <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 1 }}>
          <div style={{ position: "absolute", top: -30, left: -32, width: 250, height: 250, clipPath: "polygon(0 0, 75% 0, 48% 100%, 0 68%)", background: "linear-gradient(145deg, rgba(0,0,0,.14), rgba(255,255,255,.18))", boxShadow: "inset 0 8px 18px rgba(0,0,0,.25), inset 0 -7px 12px rgba(255,255,255,.30)" }} />
          <div style={{ position: "absolute", top: 42, right: -28, width: 185, height: 180, clipPath: "polygon(24% 0, 100% 0, 100% 82%, 16% 100%)", background: "linear-gradient(145deg, rgba(255,255,255,.24), rgba(0,0,0,.18))", boxShadow: "inset 0 8px 18px rgba(0,0,0,.26), inset 0 -6px 14px rgba(255,255,255,.28)" }} />
          <div style={{ position: "absolute", bottom: 118, left: -40, width: 220, height: 170, clipPath: "polygon(0 0, 100% 26%, 72% 100%, 0 86%)", background: "linear-gradient(145deg, rgba(0,0,0,.14), rgba(255,255,255,.22))", boxShadow: "inset 0 8px 18px rgba(0,0,0,.25), inset 0 -6px 14px rgba(255,255,255,.28)" }} />
          <div style={{ position: "absolute", bottom: 86, right: -18, width: 190, height: 125, clipPath: "polygon(14% 0, 100% 20%, 100% 100%, 0 78%)", background: "linear-gradient(145deg, rgba(255,255,255,.22), rgba(0,0,0,.16))", boxShadow: "inset 0 7px 16px rgba(0,0,0,.24), inset 0 -6px 14px rgba(255,255,255,.28)" }} />
          <div style={{ position: "absolute", top: 138, left: 74, width: 150, height: 95, clipPath: "polygon(0 16%, 86% 0, 100% 72%, 24% 100%)", background: "linear-gradient(145deg, rgba(0,0,0,.13), rgba(255,255,255,.26))", boxShadow: "inset 0 7px 15px rgba(0,0,0,.24), inset 0 -6px 14px rgba(255,255,255,.28)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 35% 16%, rgba(255,255,255,.55), transparent 24%), radial-gradient(circle at 82% 32%, rgba(255,255,255,.42), transparent 18%), linear-gradient(115deg, transparent 0%, rgba(255,255,255,.34) 32%, transparent 48%, rgba(0,0,0,.14) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, opacity: .22, backgroundImage: "radial-gradient(circle, rgba(255,255,255,.9) 0 1px, transparent 1.3px)", backgroundSize: "9px 9px" }} />
        </div>

        <div style={{ position: "absolute", inset: 0, zIndex: 18, pointerEvents: "none", background: "linear-gradient(118deg, transparent 0%, transparent 28%, rgba(255,255,255,.68) 39%, rgba(255,255,255,.14) 46%, transparent 57%, transparent 100%)", mixBlendMode: "screen", opacity: .72 }} />
        <div style={{ position: "absolute", left: -80, top: 10, width: 510, height: 80, zIndex: 19, transform: "rotate(-32deg)", pointerEvents: "none", background: "linear-gradient(90deg, transparent, rgba(255,255,255,.0), rgba(255,255,255,.84), rgba(255,255,255,.0), transparent)", filter: "blur(1px)", opacity: .65 }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 21, pointerEvents: "none", background: "radial-gradient(circle at 12% 18%, rgba(255,255,255,.72), transparent 7%), radial-gradient(circle at 86% 22%, rgba(255,255,255,.68), transparent 6%), radial-gradient(circle at 74% 58%, rgba(255,255,255,.58), transparent 5%), radial-gradient(circle at 22% 78%, rgba(255,255,255,.48), transparent 6%)", mixBlendMode: "screen" }} />
        <Sparkle left={50} top={74} size={15} />
        <Sparkle left={278} top={96} size={18} />
        <Sparkle left={302} top={246} size={13} />
        <Sparkle left={72} top={338} size={12} />

        <div style={{ position: "absolute", top: 20, left: 22, right: 22, zIndex: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontWeight: 950, textShadow: "0 1px 0 rgba(255,255,255,.35)" }}>
          <div style={{ fontSize: 18, letterSpacing: ".04em", lineHeight: 1.1 }}><div>{season}</div><div>{serial}</div></div>
          <div style={{ textAlign: "right", fontSize: 18, lineHeight: 1.1 }}><div>{shortClub(club)}</div><div>#{rating || 1}</div></div>
        </div>

        <div style={{ position: "absolute", top: 48, right: 34, width: 36, height: 36, borderRadius: "50%", zIndex: 25, background: "linear-gradient(145deg, rgba(255,255,255,.72), rgba(255,255,255,.22))", border: "2px solid rgba(0,0,0,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 950, boxShadow: "0 3px 8px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.65)" }}>{shortClub(club).slice(0, 2)}</div>

        <div style={{ position: "absolute", left: 22, right: 22, top: 70, bottom: 157, zIndex: 4, overflow: "hidden", borderRadius: "16px 16px 34px 34px" }}>
          {showImage ? <img src={currentImage} alt={player.name || "Player"} loading="lazy" decoding="async" onError={handleImageError} style={{ width: "126%", height: "118%", marginLeft: "-13%", objectFit: "contain", objectPosition: "bottom center", filter: "drop-shadow(0 18px 18px rgba(0,0,0,.46)) saturate(1.12) contrast(1.04)", transform: "translateY(10px)", transition: "transform .25s ease" }} className="group-hover:scale-[1.035]" /> : <div style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%, -50%)", width: 126, height: 126, borderRadius: 24, border: "2px solid rgba(0,0,0,.18)", background: "rgba(255,255,255,.20)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 950, color: "rgba(0,0,0,.42)" }}>{initials(player.name)}</div>}
        </div>

        <div style={{ position: "absolute", left: 24, right: 24, bottom: 132, height: 42, zIndex: 6, background: `linear-gradient(180deg, transparent, ${theme.primary} 48%, ${theme.secondary} 100%)` }} />

        <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, zIndex: 26, textAlign: "center" }}>
          <div style={{ fontSize: 35, lineHeight: .92, fontWeight: 950, letterSpacing: ".05em", textTransform: "uppercase", color: theme.text, textShadow: "0 1px 0 rgba(255,255,255,.42), 0 7px 14px rgba(0,0,0,.18)" }}><div>{firstName}</div>{lastName ? <div>{lastName}</div> : null}</div>
          <div style={{ marginTop: 10, fontSize: 15, fontWeight: 950, letterSpacing: ".12em", textTransform: "uppercase" }}>{position}</div>
          <div style={{ marginTop: 11, display: "flex", justifyContent: "center", alignItems: "center", gap: 14, fontSize: 13, fontWeight: 900, letterSpacing: ".05em" }}><span>PTS {statTotal(player)}</span><span style={{ width: 18, height: 12, borderRadius: 2, background: "linear-gradient(to bottom, #111 0 33%, #d00 33% 66%, #fc0 66% 100%)", display: "inline-block", boxShadow: "0 0 0 1px rgba(0,0,0,.2)" }} /><span>{national}</span></div>
          <div style={{ margin: "12px auto 0", width: 138, borderRadius: 9, border: "1px solid rgba(0,0,0,.24)", background: `linear-gradient(145deg, ${theme.shine}, rgba(255,255,255,.18))`, padding: "6px 8px", fontSize: 10, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase", boxShadow: "inset 0 1px 0 rgba(255,255,255,.55), 0 0 12px rgba(255,255,255,.32)" }}>{showPrice && Number(player.price || player.listedPrice || 0) > 0 ? `N$${Number(player.price || player.listedPrice || 0).toFixed(2)}` : `${theme.label} EDITION`}</div>
        </div>

        <div style={{ position: "absolute", left: 22, bottom: 23, width: 30, height: 30, borderRadius: "50%", border: "3px solid rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 28 }}><div style={{ width: 12, height: 12, clipPath: "polygon(50% 0, 61% 34%, 97% 34%, 68% 55%, 79% 91%, 50% 69%, 21% 91%, 32% 55%, 3% 34%, 39% 34%)", background: "rgba(0,0,0,.78)" }} /></div>
        <div style={{ position: "absolute", right: 21, bottom: 23, width: 34, height: 34, borderRadius: "50%", border: "2px solid rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 28, fontSize: 10, fontWeight: 950 }}>FA</div>
      </div>
    </button>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
export default PremiumFootballCard;
