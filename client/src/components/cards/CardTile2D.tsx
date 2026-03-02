import React from "react";

export default function CardTile2D({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={[
        "relative rounded-2xl border border-white/10 bg-black/25 p-2 text-left",
        "transition-transform hover:scale-[1.01]",
        selected ? "ring-2 ring-[rgba(120,160,255,0.85)]" : "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
