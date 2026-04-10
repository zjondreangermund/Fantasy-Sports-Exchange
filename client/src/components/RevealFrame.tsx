import { memo, type ReactNode } from "react";

type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

type RevealFrameProps = {
  rarity?: string | null;
  reveal?: boolean;
  children: ReactNode;
};

function normalizeRarity(value?: string | null): Rarity {
  const v = String(value || "common").toLowerCase();
  if (v === "rare" || v === "unique" || v === "epic" || v === "legendary") return v;
  return "common";
}

function RevealFrameBase({ rarity, reveal = true, children }: RevealFrameProps) {
  const normalized = normalizeRarity(rarity);
  return (
    <div className="relative inline-flex items-center justify-center">
      <div className={`aura-${normalized}`} />
      <div className={`pack-card ${reveal ? "reveal" : ""}`.trim()}>{children}</div>
    </div>
  );
}

const RevealFrame = memo(RevealFrameBase);

export default RevealFrame;
