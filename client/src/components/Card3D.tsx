import { useState, useRef, type ReactNode, type MouseEvent } from "react";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

interface Card3DProps {
  card: PlayerCardWithPlayer;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  sorareImageUrl?: string | null;
  children?: ReactNode;
}

const RARITY_COLORS = {
  legendary: {
    edge: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)",
    glow: "rgba(251, 191, 36, 0.4)",
    accent: "#fbbf24",
  },
  unique: {
    edge: "linear-gradient(135deg, #a855f7 0%, #9333ea 50%, #7e22ce 100%)",
    glow: "rgba(168, 85, 247, 0.4)",
    accent: "#a855f7",
  },
  epic: {
    edge: "linear-gradient(135deg, #4f46e5 0%, #4338ca 50%, #3730a3 100%)",
    glow: "rgba(79, 70, 229, 0.4)",
    accent: "#4f46e5",
  },
  rare: {
    edge: "linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)",
    glow: "rgba(239, 68, 68, 0.4)",
    accent: "#ef4444",
  },
  common: {
    edge: "linear-gradient(135deg, #71717a 0%, #52525b 50%, #3f3f46 100%)",
    glow: "rgba(113, 113, 122, 0.3)",
    accent: "#71717a",
  },
};

export default function Card3D(props: Card3DProps) {
  const {
    card,
    size = "md",
    selected = false,
    selectable = false,
    onClick,
    showPrice = false,
    sorareImageUrl,
  } = props;

  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const player = card?.player || ({} as any);
  const rarity = (card?.rarity ?? "common").toLowerCase() as keyof typeof RARITY_COLORS;
  const rarityConfig = RARITY_COLORS[rarity] || RARITY_COLORS.common;

  const img =
    sorareImageUrl ||
    (player as any).photo ||
    (player as any).photoUrl ||
    player.imageUrl ||
    (player as any).image_url ||
    null;

  const clubLogo =
    (player as any).clubLogo ||
    (player as any).club_logo ||
    (player as any).teamLogo ||
    (player as any).team_logo ||
    null;

  const clubName = (player as any).club || player.team || "";
  const serialNumber = card?.serialNumber ?? (card as any)?.serial_number ?? 1;
  const maxSupply = card?.maxSupply ?? (card as any)?.max_supply ?? 100;

  const dimensions =
    size === "sm"
      ? { width: 180, height: 270 }
      : size === "lg"
      ? { width: 280, height: 420 }
      : { width: 220, height: 330 };

  const CARD_THICKNESS = size === "sm" ? 8 : size === "lg" ? 14 : 10;

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const maxTilt = 12;
    const rotY = ((x - centerX) / centerX) * maxTilt;
    const rotX = -((y - centerY) / centerY) * maxTilt;

    setRotateX(rotX);
    setRotateY(rotY);
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setRotateX(0);
    setRotateY(0);
  };

  const rarityLabel = rarity.toUpperCase();

  return (
    <div
      style={{
        perspective: "1200px",
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
      className={`${selectable ? "cursor-pointer" : ""} ${selected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          transform: isHovering
            ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(20px)`
            : "rotateX(0deg) rotateY(0deg) translateZ(0px)",
          transition: "transform 0.2s ease-out",
        }}
      >
        {/* FRONT FACE */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: "16px",
            overflow: "hidden",
            transformStyle: "preserve-3d",
            transform: `translateZ(${CARD_THICKNESS / 2}px)`,
            boxShadow: isHovering
              ? `0 20px 60px ${rarityConfig.glow}, 0 0 80px ${rarityConfig.glow}`
              : `0 8px 24px rgba(0, 0, 0, 0.6), 0 0 20px ${rarityConfig.glow}`,
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          }}
        >
          {/* Player Image */}
          {img && (
            <img
              src={img}
              alt={player?.name ?? "Player"}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.85,
              }}
            />
          )}

          {/* Gradient Overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.95) 100%)",
            }}
          />

          {/* Specular Highlight (follows mouse) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at ${50 + rotateY * 2}% ${50 + rotateX * 2}%, rgba(255,255,255,0.2) 0%, transparent 50%)`,
              pointerEvents: "none",
              opacity: isHovering ? 0.6 : 0.3,
              transition: "opacity 0.3s",
            }}
          />

          {/* Top Bar: Rarity + Club Logo */}
          <div
            style={{
              position: "absolute",
              top: "12px",
              left: "12px",
              right: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                padding: "4px 10px",
                fontSize: size === "sm" ? "9px" : "11px",
                fontWeight: 900,
                letterSpacing: "0.05em",
                borderRadius: "6px",
                background: rarityConfig.edge,
                color: "#ffffff",
                textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                border: `1px solid ${rarityConfig.accent}`,
              }}
            >
              {rarityLabel}
            </div>
            {clubLogo && (
              <img
                src={clubLogo}
                alt="Club"
                style={{
                  width: size === "sm" ? "32px" : "40px",
                  height: size === "sm" ? "32px" : "40px",
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.7))",
                }}
              />
            )}
          </div>

          {/* Bottom Info */}
          <div
            style={{
              position: "absolute",
              bottom: "12px",
              left: "12px",
              right: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {/* Player Name & Position Row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "8px" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    color: "#ffffff",
                    fontWeight: 900,
                    fontSize: size === "sm" ? "12px" : size === "lg" ? "16px" : "14px",
                    lineHeight: 1.2,
                    textTransform: "uppercase",
                    textShadow: "0 2px 8px rgba(0,0,0,0.9)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {player?.name ?? "PLAYER"}
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    fontSize: size === "sm" ? "9px" : "11px",
                    fontWeight: 700,
                    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {player?.position ? player.position.toUpperCase() : ""}
                  {clubName && (
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>
                      {" • "}
                      {clubName.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: size === "sm" ? "10px" : "12px",
                  fontWeight: 900,
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                }}
              >
                {serialNumber}/{maxSupply}
              </div>
            </div>

            {/* Player Stats Row */}
            {player && (
              <div style={{ 
                display: "flex", 
                gap: "8px", 
                flexWrap: "wrap",
                fontSize: size === "sm" ? "8px" : "10px",
                fontWeight: 700,
              }}>
                {player.overall && (
                  <div style={{
                    background: "rgba(0,0,0,0.7)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    color: "#fbbf24",
                    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                    border: "1px solid rgba(251,191,36,0.3)",
                  }}>
                    OVR {player.overall}
                  </div>
                )}
                {player.age && (
                  <div style={{
                    background: "rgba(0,0,0,0.7)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    color: "rgba(255,255,255,0.9)",
                    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}>
                    AGE {player.age}
                  </div>
                )}
                {player.nationality && (
                  <div style={{
                    background: "rgba(0,0,0,0.7)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    color: "rgba(255,255,255,0.9)",
                    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "80px",
                  }}>
                    {player.nationality.toUpperCase()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Price Badge (if applicable) */}
          {showPrice && card?.price && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                right: "12px",
                transform: "translateY(-50%)",
                background: "rgba(0,0,0,0.8)",
                backdropFilter: "blur(4px)",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <div style={{ fontSize: "18px", fontWeight: 900, color: "#10b981" }}>
                N${card.price}
              </div>
            </div>
          )}
        </div>

        {/* EDGES - TOP */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: `${CARD_THICKNESS}px`,
            top: 0,
            left: 0,
            transformOrigin: "top",
            transform: `rotateX(90deg) translateZ(0px)`,
            background: rarityConfig.edge,
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
          }}
        />

        {/* EDGES - BOTTOM */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: `${CARD_THICKNESS}px`,
            bottom: 0,
            left: 0,
            transformOrigin: "bottom",
            transform: `rotateX(-90deg) translateZ(0px)`,
            background: rarityConfig.edge,
            borderBottomLeftRadius: "16px",
            borderBottomRightRadius: "16px",
          }}
        />

        {/* EDGES - LEFT */}
        <div
          style={{
            position: "absolute",
            width: `${CARD_THICKNESS}px`,
            height: "100%",
            left: 0,
            top: 0,
            transformOrigin: "left",
            transform: `rotateY(-90deg) translateZ(0px)`,
            background: rarityConfig.edge,
            borderTopLeftRadius: "16px",
            borderBottomLeftRadius: "16px",
          }}
        />

        {/* EDGES - RIGHT */}
        <div
          style={{
            position: "absolute",
            width: `${CARD_THICKNESS}px`,
            height: "100%",
            right: 0,
            top: 0,
            transformOrigin: "right",
            transform: `rotateY(90deg) translateZ(0px)`,
            background: rarityConfig.edge,
            borderTopRightRadius: "16px",
            borderBottomRightRadius: "16px",
          }}
        />

        {/* BACK FACE */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: "16px",
            transform: `translateZ(-${CARD_THICKNESS / 2}px)`,
            background: "linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)",
            boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)",
          }}
        />
      </div>
    </div>
  );
}
