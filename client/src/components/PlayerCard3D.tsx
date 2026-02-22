import React, { useMemo, useRef, useState } from "react";

type Rarity = "common" | "rare" | "epic" | "legendary" | "unique";

export type PlayerCard3DProps = {
  name: string;
  position?: string;
  rating?: number;
  club?: string;
  nation?: string;
  imageUrl?: string; // player render/portrait (png/webp). Transparent background looks best.
  rarity?: Rarity;
  serial?: string; // e.g. "07/50"
  className?: string;
  onClick?: () => void;
};

function rarityStyles(rarity: Rarity) {
  switch (rarity) {
    case "rare":
      return {
        ring: "ring-2 ring-sky-400/70",
        glow: "shadow-[0_0_60px_rgba(56,189,248,0.25)]",
        accent: "from-sky-400/70 via-white/10 to-transparent",
        badge: "bg-sky-400/15 text-sky-200 border-sky-400/30",
      };
    case "epic":
      return {
        ring: "ring-2 ring-fuchsia-400/70",
        glow: "shadow-[0_0_70px_rgba(232,121,249,0.22)]",
        accent: "from-fuchsia-400/70 via-white/10 to-transparent",
        badge: "bg-fuchsia-400/15 text-fuchsia-200 border-fuchsia-400/30",
      };
    case "legendary":
      return {
        ring: "ring-2 ring-amber-300/70",
        glow: "shadow-[0_0_80px_rgba(252,211,77,0.22)]",
        accent: "from-amber-300/70 via-white/10 to-transparent",
        badge: "bg-amber-300/15 text-amber-100 border-amber-300/30",
      };
    case "unique":
      return {
        ring: "ring-2 ring-purple-400/70",
        glow: "shadow-[0_0_70px_rgba(168,85,247,0.22)]",
        accent: "from-purple-400/70 via-white/10 to-transparent",
        badge: "bg-purple-400/15 text-purple-200 border-purple-400/30",
      };
    default:
      return {
        ring: "ring-1 ring-white/15",
        glow: "shadow-[0_0_50px_rgba(255,255,255,0.08)]",
        accent: "from-white/35 via-white/10 to-transparent",
        badge: "bg-white/10 text-white/80 border-white/15",
      };
  }
}

export default function PlayerCard3D({
  name,
  position = "MID",
  rating = 87,
  club = "FANTASY FC",
  nation = "NA",
  imageUrl,
  rarity = "rare",
  serial = "01/99",
  className,
  onClick,
}: PlayerCard3DProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState(false);

  // Tilt state
  const [{ rx, ry }, setRot] = useState({ rx: 0, ry: 0 });
  const [{ gx, gy }, setGlare] = useState({ gx: 50, gy: 30 }); // percent

  const s = useMemo(() => rarityStyles(rarity), [rarity]);

  function onMove(e: React.MouseEvent) {
    const el = wrapRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height; // 0..1

    // Rotate up to ~12deg. Invert Y for natural tilt.
    const max = 12;
    const rotY = (px - 0.5) * (max * 2);
    const rotX = (0.5 - py) * (max * 2);

    setRot({ rx: rotX, ry: rotY });
    setGlare({ gx: px * 100, gy: py * 100 });
  }

  function onLeave() {
    setHover(false);
    setRot({ rx: 0, ry: 0 });
    setGlare({ gx: 50, gy: 30 });
  }

  return (
    <div
      ref={wrapRef}
      className={[
        "relative",
        "w-[280px] sm:w-[320px]",
        "aspect-[2.5/3.5]",
        "perspective-[1200px]",
        className ?? "",
      ].join(" ")}
      onMouseEnter={() => setHover(true)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Outer glow */}
      <div
        className={[
          "absolute -inset-2 rounded-[28px] blur-2xl opacity-60 transition-opacity duration-300",
          hover ? "opacity-90" : "opacity-50",
        ].join(" ")}
        style={{
          background:
            rarity === "legendary"
              ? "radial-gradient(circle at 50% 40%, rgba(252,211,77,.35), transparent 55%)"
              : rarity === "epic"
                ? "radial-gradient(circle at 50% 40%, rgba(232,121,249,.28), transparent 55%)"
                : rarity === "rare"
                  ? "radial-gradient(circle at 50% 40%, rgba(56,189,248,.28), transparent 55%)"
                  : rarity === "unique"
                    ? "radial-gradient(circle at 50% 40%, rgba(168,85,247,.28), transparent 55%)"
                    : "radial-gradient(circle at 50% 40%, rgba(255,255,255,.14), transparent 55%)",
        }}
        aria-hidden
      />

      {/* Card */}
      <div
        className={[
          "relative h-full w-full rounded-[26px] overflow-hidden",
          "bg-zinc-950/90",
          "transform-gpu transition-transform duration-200 will-change-transform",
          "border border-white/10",
          s.ring,
          s.glow,
        ].join(" ")}
        style={{
          transform: `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`,
        }}
      >
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,.12), transparent 55%)," +
              "radial-gradient(80% 60% at 50% 100%, rgba(255,255,255,.06), transparent 60%)," +
              "linear-gradient(180deg, rgba(255,255,255,.03), transparent 25%, rgba(255,255,255,.02))",
          }}
          aria-hidden
        />

        {/* Stadium light beams */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "linear-gradient(135deg, transparent 0%, rgba(255,255,255,.08) 18%, transparent 35%)," +
              "linear-gradient(35deg, transparent 0%, rgba(255,255,255,.06) 22%, transparent 40%)",
            mixBlendMode: "screen",
          }}
          aria-hidden
        />

        {/* Rarity accent strip */}
        <div
          className="absolute -top-24 left-[-30%] h-56 w-[160%] rotate-6 opacity-50"
          style={{
            background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,.06) 18%, transparent 42%), linear-gradient(90deg, ${rarity === "common" ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.1)"} 0%, transparent 60%), linear-gradient(90deg, rgba(255,255,255,.02), transparent)`,
          }}
          aria-hidden
        />

        {/* Depth layer: inner border */}
        <div
          className="absolute inset-[10px] rounded-[18px] border border-white/10"
          style={{ transform: "translateZ(18px)" }}
          aria-hidden
        />

        {/* Top row */}
        <div
          className="absolute left-4 right-4 top-4 flex items-center justify-between"
          style={{ transform: "translateZ(26px)" }}
        >
          <div
            className={[
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs tracking-wide",
              s.badge,
            ].join(" ")}
          >
            <span className="uppercase">{rarity}</span>
            <span className="opacity-70">•</span>
            <span className="tabular-nums">{serial}</span>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-white/60">RATING</div>
            <div className="text-lg font-extrabold text-white tabular-nums leading-none">
              {rating}
            </div>
          </div>
        </div>

        {/* Player layer */}
        <div
          className="absolute inset-0 flex items-end justify-center"
          style={{ transform: "translateZ(42px)" }}
        >
          <div className="relative w-[92%] h-[70%] bg-slate-900 rounded-[18px] overflow-hidden">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-full w-auto object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,.75)]"
                onError={(e) => {
                  const target = e.currentTarget;
                  const current = target.getAttribute("src") || "";
                  const triedLower = target.dataset.triedLowercase === "1";
                  if (!triedLower && current) {
                    const [pathOnly, search = ""] = current.split("?");
                    const parts = pathOnly.split("/");
                    const fileName = (parts.pop() || "").toLowerCase();
                    const lowerPath = `${parts.join("/")}/${fileName}`.replace(/\/+/g, "/");
                    if (lowerPath !== pathOnly) {
                      target.dataset.triedLowercase = "1";
                      target.src = search ? `${lowerPath}?${search}` : lowerPath;
                      return;
                    }
                  }
                  target.onerror = null;
                  target.src = "/images/player-1.png";
                }}
                draggable={false}
              />
            ) : (
              // fallback silhouette
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[92%] w-[62%] rounded-[32px] bg-white/10 blur-[0px]">
                <div className="absolute inset-0 rounded-[32px] bg-gradient-to-b from-white/18 to-white/5" />
                <div className="absolute -top-8 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full bg-white/14" />
              </div>
            )}

            {/* Rim light behind player */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  rarity === "legendary"
                    ? "radial-gradient(circle at 50% 55%, rgba(252,211,77,.28), transparent 60%)"
                    : rarity === "epic"
                      ? "radial-gradient(circle at 50% 55%, rgba(232,121,249,.22), transparent 60%)"
                      : rarity === "unique"
                        ? "radial-gradient(circle at 50% 55%, rgba(168,85,247,.22), transparent 60%)"
                        : "radial-gradient(circle at 50% 55%, rgba(56,189,248,.20), transparent 60%)",
                filter: "blur(2px)",
              }}
              aria-hidden
            />
          </div>
        </div>

        {/* Bottom info */}
        <div
          className="absolute left-4 right-4 bottom-4"
          style={{ transform: "translateZ(30px)" }}
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] text-white/60">PLAYER</div>
              <div className="text-base font-bold text-white leading-tight">
                {name}
              </div>
              <div className="mt-1 flex gap-2 text-[11px] text-white/70">
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5">
                  {position}
                </span>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5">
                  {club}
                </span>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5">
                  {nation}
                </span>
              </div>
            </div>

            {/* Mini stats */}
            <div className="text-right">
              <div className="text-[10px] text-white/60">POWER</div>
              <div className="text-sm font-semibold text-white tabular-nums">
                {(rating * 1.13).toFixed(0)}
              </div>
              <div className="text-[10px] text-white/50">Fantasy Arena</div>
            </div>
          </div>

          {/* Stat bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full w-[72%] rounded-full"
              style={{
                background:
                  rarity === "legendary"
                    ? "linear-gradient(90deg, rgba(252,211,77,.9), rgba(252,211,77,.2))"
                    : rarity === "epic"
                      ? "linear-gradient(90deg, rgba(232,121,249,.9), rgba(232,121,249,.2))"
                      : rarity === "unique"
                        ? "linear-gradient(90deg, rgba(168,85,247,.9), rgba(168,85,247,.2))"
                        : "linear-gradient(90deg, rgba(56,189,248,.9), rgba(56,189,248,.2))",
              }}
            />
          </div>
        </div>

        {/* Glare (tracks cursor) */}
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-200"
          style={{
            opacity: hover ? 1 : 0,
            background: `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,.18), transparent 45%)`,
            mixBlendMode: "screen",
            transform: "translateZ(60px)",
            pointerEvents: "none",
          }}
          aria-hidden
        />

        {/* Holographic sweep */}
        <div
          className={[
            "absolute inset-0 opacity-0 transition-opacity duration-200",
            hover ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={{
            background:
              "linear-gradient(120deg, transparent 30%, rgba(255,255,255,.22) 50%, transparent 70%)",
            transform: `translateX(${(ry / 24) * 40}px) translateZ(70px)`,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
          aria-hidden
        />

        {/* Ground shadow under card */}
        <div
          className="absolute -bottom-6 left-1/2 h-10 w-[75%] -translate-x-1/2 rounded-full bg-black/60 blur-xl"
          style={{ transform: "translateZ(-1px)" }}
          aria-hidden
        />
      </div>
    </div>
  );
}
