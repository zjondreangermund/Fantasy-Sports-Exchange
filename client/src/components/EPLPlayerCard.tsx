import { useRef, useEffect, useCallback } from "react";
import { type EplPlayer } from "@shared/schema";

type CardRarity = "common" | "rare" | "unique" | "epic" | "legendary";

const POINTS_PER_LEVEL = 1000;
const LEVEL_BONUS = 0.05;

function calculateLevel(totalXP: number): { level: number; currentXP: number; xpNeeded: number } {
  let level = 1;
  let remaining = totalXP;
  while (remaining >= POINTS_PER_LEVEL) {
    remaining -= POINTS_PER_LEVEL;
    level++;
  }
  return { level, currentXP: remaining, xpNeeded: POINTS_PER_LEVEL };
}

function getLevelMultiplier(level: number): number {
  return 1 + (level - 1) * LEVEL_BONUS;
}

function calculateTotalXP(player: EplPlayer): number {
  const goals = player.goals ?? 0;
  const assists = player.assists ?? 0;
  const apps = player.appearances ?? 0;
  const minutes = player.minutes ?? 0;
  return goals * 100 + assists * 60 + apps * 30 + Math.floor(minutes / 10);
}

function assignRarity(player: EplPlayer): CardRarity {
  const rating = player.rating ? parseFloat(player.rating) : 0;
  const goals = player.goals ?? 0;
  const assists = player.assists ?? 0;
  const apps = player.appearances ?? 0;
  if (rating >= 7.5 || goals >= 15) return "legendary";
  if (rating >= 7.2 || goals >= 10 || (goals + assists) >= 15) return "epic";
  if (rating >= 7.0 || goals >= 5 || assists >= 8) return "unique";
  if (rating >= 6.8 || apps >= 15 || (goals + assists) >= 5) return "rare";
  return "common";
}

function getPositionShort(pos: string | null): string {
  if (!pos) return "N/A";
  const map: Record<string, string> = {
    Goalkeeper: "GK", Defender: "DEF", Midfielder: "MID", Attacker: "FWD",
  };
  return map[pos] || pos.substring(0, 3).toUpperCase();
}

const LION_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120' opacity='0.15'%3E%3Cpath d='M50 5 C30 5 15 20 15 40 C15 55 25 65 30 70 L25 85 L30 90 L35 82 L40 95 L45 88 L50 100 L55 88 L60 95 L65 82 L70 90 L75 85 L70 70 C75 65 85 55 85 40 C85 20 70 5 50 5Z M35 35 C38 35 40 37 40 40 C40 43 38 45 35 45 C32 45 30 43 30 40 C30 37 32 35 35 35Z M65 35 C68 35 70 37 70 40 C70 43 68 45 65 45 C62 45 60 43 60 40 C60 37 62 35 65 35Z M40 55 C40 55 45 62 50 62 C55 62 60 55 60 55' fill='white' stroke='none'/%3E%3C/svg%3E")`;

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`;

const CRYSTAL_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='none' stroke-width='0.8'%3E%3Cpath d='M40 0L80 40L40 80L0 40Z' stroke='rgba(255,255,255,0.12)'/%3E%3Cpath d='M40 8L72 40L40 72L8 40Z' stroke='rgba(255,255,255,0.08)'/%3E%3Cpath d='M40 16L64 40L40 64L16 40Z' stroke='rgba(255,255,255,0.06)'/%3E%3Cpath d='M0 0L40 0L20 20Z' stroke='rgba(255,255,255,0.1)' fill='rgba(255,255,255,0.02)'/%3E%3Cpath d='M80 0L80 40L60 20Z' stroke='rgba(255,255,255,0.1)' fill='rgba(255,255,255,0.02)'/%3E%3Cpath d='M80 80L40 80L60 60Z' stroke='rgba(255,255,255,0.1)' fill='rgba(255,255,255,0.02)'/%3E%3Cpath d='M0 80L0 40L20 60Z' stroke='rgba(255,255,255,0.1)' fill='rgba(255,255,255,0.02)'/%3E%3Cpath d='M20 0L40 20L0 20Z' stroke='rgba(255,255,255,0.05)'/%3E%3Cpath d='M60 0L80 20L40 20Z' stroke='rgba(255,255,255,0.05)'/%3E%3Cpath d='M0 0L40 40' stroke='rgba(255,255,255,0.04)'/%3E%3Cpath d='M80 0L40 40' stroke='rgba(255,255,255,0.04)'/%3E%3C/g%3E%3C/svg%3E")`;

const rarityTheme: Record<CardRarity, {
  face: string;
  edgeDark: string;
  edgeMid: string;
  border: string;
  glow: string;
  label: string;
  labelBg: string;
  accent: string;
  windowBg: string;
  windowPattern: string;
  windowBorder: string;
  studioGlow: string;
  rimColor: string;
  crystalTint: string;
}> = {
  common: {
    face: "linear-gradient(160deg, #8e9aaf 0%, #b8c4d4 25%, #a0aec0 50%, #8e9aaf 75%, #7a8899 100%)",
    edgeDark: "#5a6575",
    edgeMid: "#6b7a8d",
    border: "rgba(200,210,225,0.5)",
    glow: "0 10px 40px rgba(120,140,165,0.3)",
    label: "COMMON",
    labelBg: "rgba(100,120,140,0.9)",
    accent: "#cbd5e1",
    windowBg: "linear-gradient(135deg, rgba(80,95,115,0.6), rgba(60,75,95,0.8))",
    windowPattern: "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.03) 6px, rgba(255,255,255,0.03) 12px)",
    windowBorder: "rgba(180,195,215,0.4)",
    studioGlow: "",
    rimColor: "rgba(200,215,235,0.4)",
    crystalTint: "rgba(180,195,215,0.08)",
  },
  rare: {
    face: "linear-gradient(160deg, #b91c1c 0%, #dc2626 20%, #ef4444 45%, #dc2626 65%, #b91c1c 90%, #991b1b 100%)",
    edgeDark: "#6f1010",
    edgeMid: "#991b1b",
    border: "rgba(248,113,113,0.5)",
    glow: "0 10px 50px rgba(220,38,38,0.35), 0 0 80px rgba(239,68,68,0.12)",
    label: "RARE",
    labelBg: "rgba(185,28,28,0.95)",
    accent: "#fca5a5",
    windowBg: "linear-gradient(135deg, rgba(153,27,27,0.5), rgba(127,29,29,0.7))",
    windowPattern: "repeating-linear-gradient(60deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 16px)",
    windowBorder: "rgba(248,113,113,0.4)",
    studioGlow: "",
    rimColor: "rgba(248,113,113,0.45)",
    crystalTint: "rgba(248,113,113,0.06)",
  },
  unique: {
    face: "linear-gradient(160deg, #6d28d9 0%, #7c3aed 15%, #a855f7 30%, #ec4899 50%, #f97316 70%, #eab308 85%, #22c55e 100%)",
    edgeDark: "#4c1d95",
    edgeMid: "#6d28d9",
    border: "rgba(168,85,247,0.5)",
    glow: "0 10px 50px rgba(124,58,237,0.35), 0 0 80px rgba(236,72,153,0.12)",
    label: "UNIQUE",
    labelBg: "linear-gradient(135deg, #6d28d9 0%, #db2777 100%)",
    accent: "#e9d5ff",
    windowBg: "linear-gradient(135deg, rgba(109,40,217,0.4), rgba(219,39,119,0.4))",
    windowPattern: "repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px",
    windowBorder: "rgba(196,130,255,0.4)",
    studioGlow: "radial-gradient(ellipse at 50% 40%, rgba(168,85,247,0.35) 0%, rgba(168,85,247,0.1) 35%, transparent 65%)",
    rimColor: "rgba(196,130,255,0.5)",
    crystalTint: "rgba(168,85,247,0.06)",
  },
  epic: {
    face: "linear-gradient(160deg, #0f0f23 0%, #1a1a3e 20%, #22225a 40%, #1a1a3e 60%, #0f0f23 80%, #0a0a18 100%)",
    edgeDark: "#050510",
    edgeMid: "#0f0f23",
    border: "rgba(99,102,241,0.35)",
    glow: "0 10px 50px rgba(79,70,229,0.25), 0 0 80px rgba(99,102,241,0.1)",
    label: "EPIC",
    labelBg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
    accent: "#a5b4fc",
    windowBg: "linear-gradient(135deg, rgba(30,27,75,0.5), rgba(49,46,129,0.5))",
    windowPattern: "repeating-linear-gradient(30deg, transparent, transparent 10px, rgba(99,102,241,0.03) 10px, rgba(99,102,241,0.03) 20px)",
    windowBorder: "rgba(129,140,248,0.3)",
    studioGlow: "",
    rimColor: "rgba(129,140,248,0.4)",
    crystalTint: "rgba(99,102,241,0.05)",
  },
  legendary: {
    face: "linear-gradient(160deg, #92400e 0%, #b45309 15%, #d97706 30%, #fbbf24 50%, #f59e0b 65%, #d97706 80%, #92400e 100%)",
    edgeDark: "#5c2d06",
    edgeMid: "#78350f",
    border: "rgba(252,211,77,0.6)",
    glow: "0 10px 60px rgba(245,158,11,0.4), 0 0 100px rgba(251,191,36,0.15)",
    label: "LEGENDARY",
    labelBg: "linear-gradient(135deg, #92400e 0%, #d97706 100%)",
    accent: "#fef3c7",
    windowBg: "linear-gradient(135deg, rgba(146,64,14,0.4), rgba(120,53,15,0.5))",
    windowPattern: "repeating-conic-gradient(rgba(251,191,36,0.06) 0% 25%, transparent 0% 50%) 0 0 / 14px 14px",
    windowBorder: "rgba(252,211,77,0.5)",
    studioGlow: "radial-gradient(ellipse at 50% 40%, rgba(251,191,36,0.4) 0%, rgba(251,191,36,0.12) 35%, transparent 65%)",
    rimColor: "rgba(252,211,77,0.55)",
    crystalTint: "rgba(251,191,36,0.06)",
  },
};

interface EPLPlayerCardProps {
  player: EplPlayer;
  size?: "sm" | "md" | "lg";
  forceRarity?: CardRarity;
  onClick?: () => void;
}

export default function EPLPlayerCard({
  player,
  size = "md",
  forceRarity,
  onClick,
}: EPLPlayerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);

  const rarity = forceRarity || assignRarity(player);
  const theme = rarityTheme[rarity];
  const posShort = getPositionShort(player.position);
  const totalXP = calculateTotalXP(player);
  const { level } = calculateLevel(totalXP);
  const rating = player.rating ? parseFloat(player.rating).toFixed(1) : "—";

  const sizeMap = {
    sm: { w: 190, h: 280, edge: 10, radius: 14, imgInset: 10, fontSize: 0.8 },
    md: { w: 240, h: 350, edge: 12, radius: 16, imgInset: 12, fontSize: 1 },
    lg: { w: 290, h: 420, edge: 14, radius: 18, imgInset: 14, fontSize: 1.2 },
  };
  const s = sizeMap[size];

  const stats = [
    { label: "PAC", value: Math.min(99, 55 + (player.goals ?? 0) * 2 + (player.assists ?? 0)) },
    { label: "SHO", value: Math.min(99, 40 + (player.goals ?? 0) * 4) },
    { label: "PAS", value: Math.min(99, 50 + (player.assists ?? 0) * 4 + (player.appearances ?? 0)) },
    { label: "DEF", value: Math.min(99, player.position === "Defender" || player.position === "Goalkeeper" ? 70 + (player.appearances ?? 0) : 35 + (player.appearances ?? 0)) },
    { label: "PHY", value: Math.min(99, 55 + Math.floor((player.minutes ?? 0) / 200)) },
  ];

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!cardRef.current || !innerRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 12;
    innerRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY - 5}deg) scale3d(1.04,1.04,1.04)`;
    if (shineRef.current) {
      shineRef.current.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.18) 0%, transparent 55%)`;
      shineRef.current.style.opacity = "1";
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!innerRef.current) return;
    innerRef.current.style.transform = "rotateX(0deg) rotateY(-5deg) scale3d(1,1,1)";
    if (shineRef.current) shineRef.current.style.opacity = "0";
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  const totalW = s.w + s.edge;
  const totalH = s.h + s.edge;

  return (
    <div
      ref={cardRef}
      className="cursor-pointer"
      style={{
        width: totalW,
        height: totalH,
        perspective: "800px",
      }}
      onClick={onClick}
    >
      <div
        ref={innerRef}
        style={{
          width: totalW,
          height: totalH,
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform 0.2s ease-out",
          transform: "rotateY(-5deg)",
        }}
      >
        {/* RIGHT EDGE — flush with card face */}
        <div style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: s.edge,
          height: s.h,
          background: `linear-gradient(180deg, ${theme.edgeMid} 0%, ${theme.edgeDark} 40%, ${theme.edgeDark} 100%)`,
          borderRadius: `0 ${s.radius}px ${s.radius}px 0`,
          transform: `translateZ(-${s.edge}px)`,
          boxShadow: `inset -2px 0 6px rgba(0,0,0,0.4), inset 1px 0 2px rgba(255,255,255,0.05)`,
          zIndex: 0,
        }} />

        {/* BOTTOM EDGE — flush with card face */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: s.edge,
          background: `linear-gradient(90deg, ${theme.edgeDark} 0%, ${theme.edgeMid} 30%, ${theme.edgeDark} 100%)`,
          borderRadius: `0 0 ${s.radius}px ${s.radius}px`,
          transform: `translateZ(-${s.edge}px)`,
          boxShadow: `inset 0 -2px 6px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.05)`,
          zIndex: 0,
        }} />

        {/* MAIN CARD FACE */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: s.w,
          height: s.h,
          borderRadius: s.radius,
          background: theme.face,
          boxShadow: `
            ${theme.glow},
            inset 0px 1px 1px rgba(255,255,255,0.4),
            inset 0px -1px 1px rgba(0,0,0,0.4)
          `,
          overflow: "hidden",
          zIndex: 2,
        }}>
          {/* BRUSHED METAL REFLECTIVE FINISH */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)",
            pointerEvents: "none",
            zIndex: 1,
          }} />

          {/* BRUSHED METAL NOISE TEXTURE */}
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: NOISE_SVG,
            backgroundSize: "128px 128px",
            pointerEvents: "none",
            zIndex: 1,
            mixBlendMode: "overlay",
          }} />

          {/* HIGH-CONTRAST CRYSTAL PATTERN — top half only */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "55%",
            backgroundImage: CRYSTAL_PATTERN,
            backgroundSize: "80px 80px",
            pointerEvents: "none",
            zIndex: 1,
          }} />

          {/* Crystal faceted highlight flare — top half */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "55%",
            background: `linear-gradient(160deg, ${theme.crystalTint} 0%, transparent 30%, ${theme.crystalTint} 50%, transparent 70%, ${theme.crystalTint} 100%)`,
            pointerEvents: "none",
            zIndex: 1,
          }} />

          {/* GLASS SHINE overlay */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 25%, transparent 50%, rgba(255,255,255,0.02) 75%, transparent 100%)",
            pointerEvents: "none",
            zIndex: 2,
          }} />

          {/* Hover shine layer */}
          <div
            ref={shineRef}
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 20,
              opacity: 0,
              transition: "opacity 0.3s ease",
              mixBlendMode: "overlay",
            }}
          />

          {/* PREMIER LEAGUE LION — top left corner */}
          <div style={{
            position: "absolute",
            top: 6 * s.fontSize,
            left: 6 * s.fontSize,
            width: 22 * s.fontSize,
            height: 26 * s.fontSize,
            backgroundImage: LION_SVG,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            pointerEvents: "none",
            zIndex: 6,
          }} />

          {/* CLUB CREST — top right corner */}
          {player.teamLogo && (
            <div style={{
              position: "absolute",
              top: 6 * s.fontSize,
              right: 6 * s.fontSize,
              width: 22 * s.fontSize,
              height: 22 * s.fontSize,
              zIndex: 6,
              opacity: 0.85,
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
            }}>
              <img src={player.teamLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          )}

          {/* STUDIO GLOW */}
          {theme.studioGlow && (
            <div style={{
              position: "absolute",
              inset: 0,
              background: theme.studioGlow,
              pointerEvents: "none",
              zIndex: 2,
            }} />
          )}

          {/* RATING + POSITION — left side */}
          <div style={{
            position: "absolute",
            top: 32 * s.fontSize,
            left: 8 * s.fontSize,
            zIndex: 5,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
          }}>
            <span style={{
              color: "#fff",
              fontWeight: 900,
              fontSize: 26 * s.fontSize,
              lineHeight: 1,
              textShadow: "2px 2px 2px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.15)",
              fontFamily: "'Inter', 'Arial Black', system-ui, sans-serif",
              fontStretch: "condensed",
            }}>
              {rating}
            </span>
            <span style={{
              background: "rgba(0,0,0,0.4)",
              color: theme.accent,
              fontWeight: 800,
              fontSize: 8 * s.fontSize,
              letterSpacing: "0.12em",
              padding: `1px ${5 * s.fontSize}px`,
              borderRadius: 3,
            }}>
              {posShort}
            </span>
            <span style={{
              color: "#fff",
              fontWeight: 800,
              fontSize: 7 * s.fontSize,
              letterSpacing: "0.1em",
              marginTop: 2,
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}>
              Lv.{level}
            </span>
          </div>

          {/* RARITY LABEL — right side */}
          <div style={{
            position: "absolute",
            top: 32 * s.fontSize,
            right: 8 * s.fontSize,
            zIndex: 5,
          }}>
            <span style={{
              background: theme.labelBg,
              color: theme.accent,
              fontWeight: 900,
              fontSize: 7 * s.fontSize,
              letterSpacing: "0.12em",
              padding: `2px ${5 * s.fontSize}px`,
              borderRadius: 3,
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}>
              {theme.label}
            </span>
          </div>

          {/* RECESSED IMAGE WINDOW — deeper cutout */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -52%) translateZ(40px)",
            transformStyle: "preserve-3d",
            width: `${62}%`,
            aspectRatio: "4/5",
            zIndex: 3,
            borderRadius: 10 * s.fontSize,
            overflow: "hidden",
            background: theme.windowBg,
            boxShadow: `
              inset 0 0 20px rgba(0,0,0,0.7),
              inset 0 6px 20px rgba(0,0,0,0.6),
              inset 0 -4px 15px rgba(0,0,0,0.4),
              inset 5px 0 15px rgba(0,0,0,0.35),
              inset -5px 0 15px rgba(0,0,0,0.35),
              0 8px 25px rgba(0,0,0,0.4)
            `,
          }}>
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: 10 * s.fontSize,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.4)",
              pointerEvents: "none",
              zIndex: 3,
            }} />

            {player.photo ? (
              <img
                src={player.photo}
                alt={player.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                  filter: "contrast(1.08) saturate(1.12) drop-shadow(0 10px 20px rgba(0,0,0,0.6))",
                }}
              />
            ) : (
              <div style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.3)",
              }}>
                <span style={{
                  color: "rgba(255,255,255,0.2)",
                  fontSize: 48 * s.fontSize,
                  fontWeight: 900,
                }}>
                  {player.name?.charAt(0)}
                </span>
              </div>
            )}

            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "30%",
              background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
              pointerEvents: "none",
              zIndex: 2,
            }} />
          </div>

          {/* DARK BOTTOM — hard separation for name plate */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "50%",
            background: "linear-gradient(0deg, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.92) 40%, rgba(0,0,0,0.6) 70%, transparent 100%)",
            pointerEvents: "none",
            zIndex: 4,
          }} />

          {/* SOLID NAME PLATE BLOCK */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 5,
            background: "rgba(0,0,0,0.85)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: `${8 * s.fontSize}px ${10 * s.fontSize}px ${8 * s.fontSize}px`,
          }}>
            <h3 style={{
              color: "#fff",
              fontWeight: 900,
              fontSize: 18 * s.fontSize,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              lineHeight: 1.05,
              fontFamily: "'Inter', 'Arial Black', system-ui, sans-serif",
              fontStretch: "condensed",
              textShadow: "2px 2px 2px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.4), 0 -1px 0 rgba(255,255,255,0.06)",
              marginBottom: 1,
            }}>
              {player.lastname || player.name?.split(" ").slice(-1)[0] || "Unknown"}
            </h3>
            {player.firstname && (
              <p style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 8 * s.fontSize,
                textAlign: "center",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                fontFamily: "'Inter', 'Arial Black', system-ui, sans-serif",
                fontStretch: "condensed",
                textShadow: "1px 1px 1px rgba(0,0,0,0.5)",
                marginBottom: 2,
              }}>
                {player.firstname}
              </p>
            )}

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              margin: `${4 * s.fontSize}px 0`,
            }}>
              <span style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 8 * s.fontSize,
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}>
                AGE <strong style={{ color: "#fff" }}>{player.age || "—"}</strong>
              </span>
              <span style={{
                color: theme.accent,
                fontWeight: 800,
                fontSize: 8 * s.fontSize,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                textShadow: "0 1px 4px rgba(0,0,0,0.5)",
              }}>
                {player.position || "Unknown"}
              </span>
              <span style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 8 * s.fontSize,
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}>
                {player.nationality?.substring(0, 3).toUpperCase() || ""}
              </span>
            </div>

            {/* STAT BARS */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 3 * s.fontSize,
              paddingTop: 5 * s.fontSize,
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}>
              {stats.map(({ label, value }) => (
                <div key={label} style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: 4,
                  padding: `${3 * s.fontSize}px ${2 * s.fontSize}px`,
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.05)",
                }}>
                  <span style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 7 * s.fontSize,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    fontFamily: "'Inter', 'Arial Black', system-ui, sans-serif",
                    fontStretch: "condensed",
                    textShadow: "0 1px 0 rgba(0,0,0,0.6), 0 -1px 0 rgba(255,255,255,0.04)",
                  }}>
                    {label}
                  </span>
                  <div style={{
                    width: "100%",
                    height: 4 * s.fontSize,
                    borderRadius: 2,
                    background: "rgba(0,0,0,0.25)",
                    overflow: "hidden",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.03)",
                  }}>
                    <div style={{
                      width: `${value}%`,
                      height: "100%",
                      borderRadius: 2,
                      background: value >= 80
                        ? `linear-gradient(90deg, ${theme.accent}, #fff)`
                        : value >= 60
                        ? `linear-gradient(90deg, ${theme.accent}99, ${theme.accent}66)`
                        : `linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.15))`,
                      boxShadow: value >= 75 ? `0 0 6px ${theme.accent}66` : "none",
                      transition: "width 0.6s ease-out",
                    }} />
                  </div>
                  <span style={{
                    color: value >= 80 ? theme.accent : "#fff",
                    fontWeight: 900,
                    fontSize: 10 * s.fontSize,
                    fontFamily: "'Inter', 'Arial Black', system-ui, sans-serif",
                    fontStretch: "condensed",
                    textShadow: value >= 80
                      ? `0 0 6px ${theme.accent}55, 2px 2px 2px rgba(0,0,0,0.5)`
                      : "2px 2px 2px rgba(0,0,0,0.5), 0 -1px 0 rgba(255,255,255,0.05)",
                  }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { assignRarity, calculateLevel, getLevelMultiplier, POINTS_PER_LEVEL, LEVEL_BONUS, type CardRarity };
