import { memo, type ReactNode } from "react";

type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

type CabinetSlotProps = {
  rarity?: string | null;
  children: ReactNode;
  className?: string;
};

const slotClassMap: Record<Rarity, string> = {
  common: "slot-common",
  rare: "slot-rare",
  unique: "slot-unique",
  epic: "slot-epic",
  legendary: "slot-legendary",
};

function normalizeRarity(value?: string | null): Rarity {
  const v = String(value || "common").toLowerCase();
  if (v === "rare" || v === "unique" || v === "epic" || v === "legendary") return v;
  return "common";
}

function CabinetSlotBase({ rarity, children, className }: CabinetSlotProps) {
  const slot = slotClassMap[normalizeRarity(rarity)];
  return <div className={`slot ${slot} ${className || ""}`.trim()}>{children}</div>;
}

const CabinetSlot = memo(CabinetSlotBase);

export default CabinetSlot;
