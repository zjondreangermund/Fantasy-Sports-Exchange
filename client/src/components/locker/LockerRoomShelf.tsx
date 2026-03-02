import React from "react";

type LockerRoomShelfProps<T> = {
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  className?: string;
};

/**
 * LockerRoomShelf
 * - Horizontal shelf layout
 * - Big featured center slot
 * - Reflections under cards
 */
export default function LockerRoomShelf<T>({
  items,
  renderCard,
  getKey,
  className = "",
}: LockerRoomShelfProps<T>) {
  // Pick center “featured”
  const mid = Math.floor(items.length / 2);

  return (
    <div className={["relative w-full", className].join(" ")}>
      <div className="relative mx-auto w-full max-w-6xl">
        {/* Shelf row */}
        <div className="flex items-end justify-center gap-6 px-4 py-6">
          {items.slice(0, 5).map((item, i) => {
            const isFeatured = i === mid || (items.length <= 3 && i === 1);
            const scale = isFeatured ? "scale-[1.05]" : "scale-[0.98]";
            const lift = isFeatured ? "-translate-y-2" : "translate-y-0";

            return (
              <div
                key={getKey(item)}
                className={[
                  "relative",
                  "transition-transform duration-300",
                  scale,
                  lift,
                ].join(" ")}
                style={{
                  width: isFeatured ? 240 : 200,
                }}
              >
                {/* Card container with shadow */}
                <div
                  className="relative rounded-2xl"
                  style={{
                    boxShadow: isFeatured
                      ? "0 28px 90px rgba(0,0,0,0.65)"
                      : "0 22px 70px rgba(0,0,0,0.58)",
                  }}
                >
                  {renderCard(item)}
                </div>

                {/* Reflection (simple + fast) */}
                <div
                  className="pointer-events-none absolute left-0 right-0 top-[100%] mt-3"
                  style={{
                    transform: "scaleY(-1)",
                    opacity: isFeatured ? 0.11 : 0.08,
                    filter: "blur(6px)",
                    maskImage:
                      "linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.0) 75%)",
                    WebkitMaskImage:
                      "linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.0) 75%)",
                  }}
                >
                  <div className="rounded-2xl">{renderCard(item)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* A soft “floor glow” under the shelf */}
        <div
          className="pointer-events-none mx-auto h-24 w-[90%] rounded-[999px] opacity-70"
          style={{
            background:
              "radial-gradient(closest-side, rgba(120,160,255,0.12), transparent 70%)",
            filter: "blur(14px)",
          }}
        />
      </div>
    </div>
  );
}
