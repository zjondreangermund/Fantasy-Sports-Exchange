import { memo, useEffect, useMemo, useState } from "react";
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
  common: { label: "COMMON", primary: "#eef2f7", secondary: "#aeb9c8", dark: "#334155", light: "#ffffff", border: "#ffffff", shine: "rgba(255,255,255,.74)", shadow: "rgba(148,163,184,.42)", text: "#0f172a" },
  rare: { label: "RARE", primary: "#70b8ff", secondary: "#2367e8", dark: "#1e3a8a", light: "#eef7ff", border: "#dbeafe", shine: "rgba(219,234,254,.76)", shadow: "rgba(37,99,235,.46)", text: "#06152f" },
  unique: { label: "UNIQUE", primary: "#ee82ff", secondary: "#9333ea", dark: "#581c87", light: "#fff1ff", border: "#f5d0fe", shine: "rgba(250,232,255,.78)", shadow: "rgba(147,51,234,.50)", text: "#2e073f" },
  epic: { label: "EPIC", primary: "#9aa5ff", secondary: "#2563eb", dark: "#312e81", light: "#eef2ff", border: "#dbe4ff", shine: "rgba(224,231,255,.78)", shadow: "rgba(79,70,229,.50)", text: "#111244" },
  legendary: { label: "LEGENDARY", primary: "#ffd84a", secondary: "#c99508", dark: "#7c4a03", light: "#fff8bd", border: "#fff4a8", shine: "rgba(255,247,205,.88)", shadow: "rgba(245,158,11,.70)", text: "#171006" },
};

const sizeMap = {
  sm: { width: 176, height: 246, scale: 0.489 },
  md: { width: 204, height: 286, scale: 0.567 },
  lg: { width: 254, height: 356, scale: 0.706 },
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

function PremiumFootballCardBase({ player, selected = false, onClick, showPrice = false, className = "", size = "md" }: PremiumFootballCardProps) {
  const rarity = String(player.rarity || "common").toLowerCase();
  const theme = themes[rarity] || themes.common;
  const dimensions = sizeMap[size];
  const images = useMemo(() => firstValidImage(player), [player]);
  const imageKey = useMemo(() => images.join("|"), [images]);
  const [imageIndex, setImageIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const currentImage = images[imageIndex];
  const showImage = Boolean(currentImage) && !failed;
  const rating = Math.max(0, Math.round(Number(player.rating || player.form || statTotal(player) || 0)));
  const season = player.season || "2026-27";
  const serial = player.serial && player.maxSupply ? `${player.serial}/${player.maxSupply}` : player.maxSupply ? `1/${player.maxSupply}` : "1000/1000";
  const club = player.team || player.club || "Fantasy Arena";
  const [firstName, lastName] = splitName(player.name);
  const national = player.nationality || "FC";
  const position = player.position || "PLAYER";

  useEffect(() => {
    setImageIndex(0);
    setFailed(false);
  }, [player.id, imageKey]);

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
      style={{ width: dimensions.width, height: dimensions.height, borderRadius: 18 * dimensions.scale }}
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
          background: `linear-gradient(145deg, ${theme.light} 0%, ${theme.primary} 26%, ${theme.secondary} 68%, ${theme.primary} 100%)`,
          border: `3px solid ${theme.border}`,
          transformOrigin: "top left",
          transform: `scale(${dimensions.scale})`,
          boxShadow: `0 0 0 1px rgba(255,255,255,.55) inset, 0 0 0 6px rgba(255,255,255,.12) inset, 0 0 26px ${theme.shine}, 0 16px 34px rgba(0,0,0,.34), 0 28px 68px ${theme.shadow}`,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ position: "absolute", inset: 6, borderRadius: 20, zIndex: 2, pointerEvents: "none", border: `1px solid ${theme.shine}`, boxShadow: `inset 0 0 16px rgba(255,255,255,.70), inset 0 0 36px rgba(255,255,255,.22), 0 0 20px ${theme.shine}` }} />
        <div style={{ position: "absolute", inset: 11, borderRadius: 16, zIndex: 2, pointerEvents: "none", border: "1px solid rgba(0,0,0,.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.62), inset 0 -10px 24px rgba(0,0,0,.24)" }} />
        <div style={{ position: "absolute", inset: 8, borderRadius: 18, background: `linear-gradient(145deg, ${theme.light} 0%, ${theme.primary} 30%, ${theme.secondary} 76%, ${theme.primary})`, boxShadow: "inset 0 0 18px rgba(255,255,255,.50), inset 0 12px 28px rgba(255,255,255,.26), inset 0 -18px 40px rgba(0,0,0,.30)" }} />

        <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 1 }}>
          <div style={{ position: "absolute", top: -24, left: -24, width: 260, height: 250, clipPath: "polygon(0 0, 78% 0, 48% 100%, 0 68%)", background: "linear-gradient(145deg, rgba(0,0,0,.12), rgba(255,255,255,.24))", boxShadow: "inset 0 8px 18px rgba(0,0,0,.25), inset 0 -7px 14px rgba(255,255,255,.34)" }} />
          <div style={{ position: "absolute", top: 50, right: -12, width: 190, height: 172, clipPath: "polygon(24% 0, 100% 0, 100% 82%, 16% 100%)", background: "linear-gradient(145deg, rgba(255,255,255,.30), rgba(0,0,0,.17))", boxShadow: "inset 0 8px 18px rgba(0,0,0,.24), inset 0 -6px 14px rgba(255,255,255,.32)" }} />
          <div style={{ position: "absolute", bottom: 128, left: -34, width: 234, height: 164, clipPath: "polygon(0 0, 100% 26%, 72% 100%, 0 86%)", background: "linear-gradient(145deg, rgba(0,0,0,.12), rgba(255,255,255,.28))", boxShadow: "inset 0 8px 18px rgba(0,0,0,.24), inset 0 -6px 14px rgba(255,255,255,.32)" }} />
          <div style={{ position: "absolute", bottom: 96, right: -12, width: 196, height: 128, clipPath: "polygon(14% 0, 100% 20%, 100% 100%, 0 78%)", background: "linear-gradient(145deg, rgba(255,255,255,.28), rgba(0,0,0,.15))", boxShadow: "inset 0 7px 16px rgba(0,0,0,.22), inset 0 -6px 14px rgba(255,255,255,.32)" }} />
          <div style={{ position: "absolute", top: 142, left: 78, width: 154, height: 98, clipPath: "polygon(0 16%, 86% 0, 100% 72%, 24% 100%)", background: "linear-gradient(145deg, rgba(0,0,0,.11), rgba(255,255,255,.30))", boxShadow: "inset 0 7px 15px rgba(0,0,0,.22), inset 0 -6px 14px rgba(255,255,255,.34)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 35% 16%, rgba(255,255,255,.50), transparent 25%), radial-gradient(circle at 82% 32%, rgba(255,255,255,.38), transparent 18%), linear-gradient(115deg, transparent 0%, rgba(255,255,255,.30) 32%, transparent 48%, rgba(0,0,0,.12) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, opacity: .18, backgroundImage: "radial-gradient(circle, rgba(255,255,255,.9) 0 1px, transparent 1.3px)", backgroundSize: "9px 9px" }} />
        </div>

        <div style={{ position: "absolute", left: 22, right: 22, top: 62, bottom: 146, zIndex: 6, overflow: "visible", borderRadius: "16px 16px 34px 34px" }}>
          {showImage ? <img src={currentImage} alt={player.name || "Player"} loading="lazy" decoding="async" onError={handleImageError} style={{ position: "absolute", left: "50%", bottom: -8, width: "140%", height: "126%", transform: "translateX(-50%)", objectFit: "contain", objectPosition: "bottom center", filter: "drop-shadow(0 18px 18px rgba(0,0,0,.50)) saturate(1.16) contrast(1.08)", transition: "transform .25s ease", zIndex: 8 }} className="group-hover:scale-[1.04]" /> : <div style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%, -50%)", width: 126, height: 126, borderRadius: 24, border: "2px solid rgba(0,0,0,.18)", background: "rgba(255,255,255,.20)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 950, color: "rgba(0,0,0,.42)" }}>{initials(player.name)}</div>}
        </div>

        <div style={{ position: "absolute", left: 18, right: 18, bottom: 132, height: 54, zIndex: 9, clipPath: "polygon(0 36%, 48% 0, 100% 32%, 100% 100%, 0 100%)", background: `linear-gradient(145deg, ${theme.light} 0%, ${theme.primary} 36%, ${theme.secondary} 100%)`, borderTop: `2px solid ${theme.shine}`, boxShadow: "0 -10px 20px rgba(255,255,255,.22), inset 0 1px 0 rgba(255,255,255,.52)" }} />

        <div style={{ position: "absolute", inset: 0, zIndex: 16, pointerEvents: "none", background: "linear-gradient(118deg, transparent 0%, transparent 28%, rgba(255,255,255,.72) 39%, rgba(255,255,255,.16) 46%, transparent 57%, transparent 100%)", mixBlendMode: "screen", opacity: .78 }} />
        <div style={{ position: "absolute", left: -80, top: 4, width: 510, height: 86, zIndex: 17, transform: "rotate(-32deg)", pointerEvents: "none", background: "linear-gradient(90deg, transparent, rgba(255,255,255,.0), rgba(255,255,255,.90), rgba(255,255,255,.0), transparent)", filter: "blur(1px)", opacity: .72 }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 18, pointerEvents: "none", background: "radial-gradient(circle at 14% 18%, rgba(255,255,255,.78), transparent 7%), radial-gradient(circle at 86% 22%, rgba(255,255,255,.72), transparent 6%), radial-gradient(circle at 74% 58%, rgba(255,255,255,.60), transparent 5%), radial-gradient(circle at 22% 78%, rgba(255,255,255,.54), transparent 6%)", mixBlendMode: "screen" }} />

        <div style={{ position: "absolute", top: 18, left: 22, right: 22, zIndex: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontWeight: 950, textShadow: "0 1px 0 rgba(255,255,255,.38)" }}>
          <div style={{ fontSize: 18, letterSpacing: ".04em", lineHeight: 1.1 }}><div>{season}</div><div>{serial}</div></div>
          <div style={{ textAlign: "right", fontSize: 18, lineHeight: 1.1 }}><div>{shortClub(club)}</div><div>#{rating || 1}</div></div>
        </div>
        <div style={{ position: "absolute", top: 48, right: 34, width: 36, height: 36, borderRadius: "50%", zIndex: 25, background: "linear-gradient(145deg, rgba(255,255,255,.78), rgba(255,255,255,.25))", border: "2px solid rgba(0,0,0,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 950, boxShadow: "0 3px 8px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.65)" }}>{shortClub(club).slice(0, 2)}</div>

        <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, zIndex: 26, textAlign: "center" }}>
          <div style={{ fontSize: 34, lineHeight: .92, fontWeight: 950, letterSpacing: ".045em", textTransform: "uppercase", color: theme.text, textShadow: "0 1px 0 rgba(255,255,255,.42), 0 7px 14px rgba(0,0,0,.18)" }}><div>{firstName}</div>{lastName ? <div>{lastName}</div> : null}</div>
          <div style={{ marginTop: 9, fontSize: 15, fontWeight: 950, letterSpacing: ".12em", textTransform: "uppercase" }}>{position}</div>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "center", alignItems: "center", gap: 13, fontSize: 13, fontWeight: 900, letterSpacing: ".05em" }}><span>PTS {statTotal(player)}</span><span style={{ width: 18, height: 12, borderRadius: 2, background: "linear-gradient(to bottom, #111 0 33%, #d00 33% 66%, #fc0 66% 100%)", display: "inline-block", boxShadow: "0 0 0 1px rgba(0,0,0,.2)" }} /><span>{national}</span></div>
          <div style={{ margin: "11px auto 0", width: 138, borderRadius: 9, border: "1px solid rgba(0,0,0,.24)", background: `linear-gradient(145deg, ${theme.shine}, rgba(255,255,255,.18))`, padding: "6px 8px", fontSize: 10, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase", boxShadow: "inset 0 1px 0 rgba(255,255,255,.55), 0 0 12px rgba(255,255,255,.32)" }}>{showPrice && Number(player.price || player.listedPrice || 0) > 0 ? `N$${Number(player.price || player.listedPrice || 0).toFixed(2)}` : `${theme.label} EDITION`}</div>
        </div>

        <div style={{ position: "absolute", left: 22, bottom: 23, width: 30, height: 30, borderRadius: "50%", border: "3px solid rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 28 }}><div style={{ width: 12, height: 12, clipPath: "polygon(50% 0, 61% 34%, 97% 34%, 68% 55%, 79% 91%, 50% 69%, 21% 91%, 32% 55%, 3% 34%, 39% 34%)", background: "rgba(0,0,0,.78)" }} /></div>
        <div style={{ position: "absolute", right: 21, bottom: 23, width: 34, height: 34, borderRadius: "50%", border: "2px solid rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 28, fontSize: 10, fontWeight: 950 }}>FA</div>
      </div>
    </button>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
export default PremiumFootballCard;
