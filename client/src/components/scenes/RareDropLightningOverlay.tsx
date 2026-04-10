import React from "react";

type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

export default function RareDropLightningOverlay({
  open,
  rarity,
}: {
  open: boolean;
  rarity: Rarity;
}) {
  if (!open) return null;

  const label =
    rarity === "rare"
      ? "RARE DROP!"
      : rarity === "unique"
        ? "UNIQUE!"
        : rarity === "epic"
          ? "EPIC!"
          : rarity === "legendary"
            ? "LEGENDARY!"
            : "";

  const intensity =
    rarity === "rare" ? 0.35 :
    rarity === "unique" ? 0.45 :
    rarity === "epic" ? 0.55 :
    rarity === "legendary" ? 0.75 : 0.25;

  return (
    <div className="fixed inset-0 z-[95] pointer-events-none">
      <div
        className="absolute inset-0 lightningFlash"
        style={{
          opacity: intensity,
          background:
            "radial-gradient(900px 500px at 50% 35%, rgba(255,255,255,0.28), transparent 66%)," +
            "linear-gradient(180deg, rgba(120,160,255,0.16), rgba(0,0,0,0.0))",
        }}
      />

      <div className="absolute inset-0">
        <div className="bolt b1" />
        <div className="bolt b2" />
        <div className="bolt b3" />
      </div>

      <div className="absolute left-1/2 top-[14%] -translate-x-1/2 text-center">
        <div className="text-xs tracking-widest text-white/60">SPECIAL</div>
        <div className="mt-1 text-3xl font-black text-white/90 dropShadow">{label}</div>
      </div>

      <style>{`
        .lightningFlash{
          animation: flash 0.85s ease-in-out both;
        }
        @keyframes flash{
          0%{ opacity: 0; }
          15%{ opacity: 1; }
          35%{ opacity: 0.25; }
          55%{ opacity: 0.85; }
          100%{ opacity: 0; }
        }
        .bolt{
          position: absolute;
          width: 6px;
          height: 70vh;
          top: 8%;
          background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(120,160,255,0.25), transparent);
          filter: blur(0.2px);
          opacity: 0;
          transform: skewX(-12deg);
          animation: bolt 0.85s ease-in-out both;
        }
        .b1{ left: 38%; animation-delay: 0.06s; }
        .b2{ left: 52%; width: 4px; animation-delay: 0.12s; }
        .b3{ left: 66%; width: 5px; animation-delay: 0.18s; }
        @keyframes bolt{
          0%{ opacity: 0; transform: translate3d(0,-20px,0) skewX(-12deg); }
          18%{ opacity: 1; }
          40%{ opacity: 0.25; }
          65%{ opacity: 0.85; }
          100%{ opacity: 0; transform: translate3d(0,10px,0) skewX(-12deg); }
        }
        .dropShadow{
          text-shadow: 0 12px 50px rgba(120,160,255,0.35), 0 18px 90px rgba(0,0,0,0.85);
        }
      `}</style>
    </div>
  );
}
