import React from "react";

export type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

export type PlayerCardData = {
  id: string;
  name: string;
  rating: number;
  position: string;
  club?: string;
  image?: string;
  rarity: Rarity;
  serial?: number;
  maxSupply?: number;
  form?: number;
};

type FantasyCardProps = {
  player: PlayerCardData;
  className?: string;
};

const frameMap: Record<Rarity, string> = {
  common: "/frames/common.svg",
  rare: "/frames/rare.svg",
  unique: "/frames/unique.svg",
  epic: "/frames/epic.svg",
  legendary: "/frames/legendary.svg",
};

const rarityMeta: Record<
  Rarity,
  {
    label: string;
    textureClass: string;
    spotlightClass: string;
    geoTextureClass: string;
    accent: string;
    accentSoft: string;
    baseTop: string;
    baseMid: string;
    baseBottom: string;
    rarityBadgeClass: string;
  }
> = {
  common: {
    label: "Common",
    textureClass: "luxury-texture-common",
    spotlightClass: "luxury-spotlight-common",
    geoTextureClass: "card-geo-common",
    accent: "#7A7C80",
    accentSoft: "rgba(122,124,128,0.30)",
    baseTop: "#3A3F44",
    baseMid: "#2B2D31",
    baseBottom: "#1C1E21",
    rarityBadgeClass: "border-[#7A7C80]/45 bg-[#7A7C80]/12 text-[#d8dadd]",
  },
  rare: {
    label: "Rare",
    textureClass: "luxury-texture-rare",
    spotlightClass: "luxury-spotlight-rare",
    geoTextureClass: "card-geo-rare",
    accent: "#ff2b2b",
    accentSoft: "rgba(255,43,43,0.32)",
    baseTop: "#ff3838",
    baseMid: "#d31818",
    baseBottom: "#a30000",
    rarityBadgeClass: "border-[#ff2b2b]/52 bg-[#ff2b2b]/18 text-[#ffd8d8]",
  },
  epic: {
    label: "Epic",
    textureClass: "luxury-texture-epic",
    spotlightClass: "luxury-spotlight-epic",
    geoTextureClass: "card-geo-epic",
    accent: "#a12fff",
    accentSoft: "rgba(161,47,255,0.34)",
    baseTop: "#a12fff",
    baseMid: "#6f16b8",
    baseBottom: "#40024c",
    rarityBadgeClass: "border-[#a12fff]/50 bg-[#a12fff]/24 text-[#f3d8ff]",
  },
  legendary: {
    label: "Legendary",
    textureClass: "luxury-texture-legendary",
    spotlightClass: "luxury-spotlight-legendary",
    geoTextureClass: "card-geo-legendary",
    accent: "#FFD700",
    accentSoft: "rgba(255,215,0,0.36)",
    baseTop: "#ffd36a",
    baseMid: "#d39a24",
    baseBottom: "#a36b00",
    rarityBadgeClass: "border-[#FFD700]/62 bg-[#FFD700]/30 text-[#fff4bc]",
  },
  unique: {
    label: "Unique",
    textureClass: "luxury-texture-unique",
    spotlightClass: "luxury-spotlight-unique",
    geoTextureClass: "card-geo-unique",
    accent: "#0f6eff",
    accentSoft: "rgba(15,110,255,0.30)",
    baseTop: "#0f6eff",
    baseMid: "#0b3daf",
    baseBottom: "#041a67",
    rarityBadgeClass: "border-[#0f6eff]/50 bg-[#0f6eff]/20 text-[#dcedff]",
  },
};

const rarityEdgeClass: Record<Rarity, string> = {
  common: "luxury-edge-common",
  rare: "luxury-edge-rare",
  epic: "luxury-edge-epic",
  legendary: "luxury-edge-legendary",
  unique: "luxury-edge-unique",
};

const rarityShapeClass: Record<Rarity, string> = {
  common: "slab-shape-common",
  rare: "slab-shape-rare",
  epic: "slab-shape-epic",
  legendary: "slab-shape-legendary",
  unique: "slab-shape-unique",
};

const rarityToneClass: Record<Rarity, string> = {
  common: "card-rarity-common",
  rare: "card-rarity-rare",
  epic: "card-rarity-epic",
  legendary: "card-rarity-legendary",
  unique: "card-rarity-unique",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeStats(player: PlayerCardData) {
  const rating = clamp(Number(player.rating) || 70, 45, 99);
  const form = clamp(Number(player.form) || 72, 40, 99);
  const pos = String(player.position || "").toUpperCase();

  const atkBias = pos.includes("ST") || pos.includes("FW") ? 8 : pos.includes("MID") ? 4 : -2;
  const defBias = pos.includes("GK") || pos.includes("DEF") ? 9 : pos.includes("MID") ? 3 : -4;

  return [
    { key: "ATK", value: clamp(rating + atkBias, 40, 99) },
    { key: "VIS", value: clamp(Math.round(rating * 0.9 + form * 0.12), 38, 99) },
    { key: "CTL", value: clamp(Math.round(rating * 0.94 + 2), 38, 99) },
    { key: "DEF", value: clamp(rating + defBias, 35, 99) },
    { key: "ENG", value: clamp(Math.round(form * 0.92 + 8), 40, 99) },
    { key: "FRM", value: form },
  ];
}

type ResponsivePortrait = {
  fallbackSrc: string;
  webpSrcSet?: string;
  jpegSrcSet?: string;
};

function buildResponsivePortrait(src?: string): ResponsivePortrait | null {
  if (!src) return null;
  if (!src.includes("/api/players/")) {
    return { fallbackSrc: src };
  }

  const sizes = [320, 512, 800];

  try {
    const isAbsolute = /^https?:\/\//.test(src);
    const base = new URL(src, "http://localhost");

    const toSrc = (url: URL) => (isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`);

    const buildSet = (format: "webp" | "jpeg") =>
      sizes
        .map((width) => {
          const next = new URL(base.toString());
          next.searchParams.set("w", String(width));
          next.searchParams.set("format", format);
          return `${toSrc(next)} ${width}w`;
        })
        .join(", ");

    const fallback = new URL(base.toString());
    fallback.searchParams.set("w", "800");
    fallback.searchParams.set("format", "webp");

    return {
      fallbackSrc: toSrc(fallback),
      webpSrcSet: buildSet("webp"),
      jpegSrcSet: buildSet("jpeg"),
    };
  } catch {
    return { fallbackSrc: src };
  }
}

export default function FantasyCard({ player, className }: FantasyCardProps) {
  const rarity = player.rarity;
  const meta = rarityMeta[rarity];
  const stats = computeStats(player);
  const cardRef = React.useRef<HTMLElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const canTiltRef = React.useRef(true);
  const pointerFxRef = React.useRef({ x: 50, y: 50, tiltX: 0, tiltY: 0 });
  const isLegendary = rarity === "legendary";
  const portrait = React.useMemo(() => buildResponsivePortrait(player.image), [player.image]);
  const seasonLabel = "2025-26";

  const commitPointerFx = React.useCallback(() => {
    rafRef.current = null;
    const cardEl = cardRef.current;
    if (!cardEl) return;

    const { x, y, tiltX, tiltY } = pointerFxRef.current;
    cardEl.style.setProperty("--holo-x", `${x}%`);
    cardEl.style.setProperty("--holo-y", `${y}%`);
    cardEl.style.setProperty("--tilt-x", `${tiltX}deg`);
    cardEl.style.setProperty("--tilt-y", `${tiltY}deg`);
  }, []);

  const schedulePointerFx = React.useCallback(
    (nextFx: { x: number; y: number; tiltX: number; tiltY: number }) => {
      pointerFxRef.current = nextFx;
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(commitPointerFx);
    },
    [commitPointerFx],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointerQuery = window.matchMedia("(hover: none), (pointer: coarse)");

    const syncTiltCapability = () => {
      canTiltRef.current = !reducedMotionQuery.matches && !coarsePointerQuery.matches;
    };

    syncTiltCapability();

    reducedMotionQuery.addEventListener("change", syncTiltCapability);
    coarsePointerQuery.addEventListener("change", syncTiltCapability);

    return () => {
      reducedMotionQuery.removeEventListener("change", syncTiltCapability);
      coarsePointerQuery.removeEventListener("change", syncTiltCapability);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType && event.pointerType !== "mouse") return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    const offsetX = x - 50;
    const offsetY = y - 50;

    const tiltX = canTiltRef.current ? clamp(-offsetY * 0.2, -10, 10) : 0;
    const tiltY = canTiltRef.current ? clamp(offsetX * 0.24, -12, 12) : 0;

    schedulePointerFx({ x, y, tiltX, tiltY });
  };

  const resetPointer = () => {
    schedulePointerFx({ x: 50, y: 50, tiltX: 0, tiltY: 0 });
  };

  return (
    <div className="card-slab-scene">
      <article
        ref={cardRef}
        className={[
          "group card-slab-wrap card-slab--hero relative isolate aspect-[2.5/3.5] w-[260px] overflow-visible transition duration-300",
          className || "",
        ].join(" ")}
        data-tilt-card
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
        onPointerCancel={resetPointer}
        style={{
          ["--card-accent" as string]: meta.accent,
          ["--card-accent-soft" as string]: meta.accentSoft,
          ["--holo-x" as string]: "50%",
          ["--holo-y" as string]: "50%",
          ["--tilt-x" as string]: "0deg",
          ["--tilt-y" as string]: "0deg",
        }}
      >
        <div className={["card-slab-back absolute inset-[1.6%] z-0 rounded-[26px]", rarityShapeClass[rarity], rarityToneClass[rarity]].join(" ")} />

        <div
          className={[
            "luxury-card-shell absolute inset-0 overflow-hidden rounded-[28px]",
            rarityEdgeClass[rarity],
            rarityShapeClass[rarity],
            rarityToneClass[rarity],
          ].join(" ")}
        >
          <div className={["slab-face-plate absolute inset-[9px] z-[0.5] rounded-[20px]", `material-${rarity}`].join(" ")} />

          <div
            className={[
              "pointer-events-none absolute inset-x-[4%] top-[11.8%] bottom-[31.3%] z-[2] rounded-[17px]",
              "card-geo-layer",
              meta.geoTextureClass,
            ].join(" ")}
          />

          <div className={["pointer-events-none absolute inset-0 z-[1] opacity-[0.92]", meta.textureClass].join(" ")} />

          <div className={["pointer-events-none absolute inset-x-[6%] top-[14.5%] z-[2] h-[46%] rounded-[999px] blur-3xl", meta.spotlightClass].join(" ")} />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-20 bg-gradient-to-b from-white/10 via-white/[0.02] to-transparent" />

          <div className="player-chamber absolute inset-x-[3.3%] top-[12.4%] bottom-[28.2%] z-[3] overflow-hidden rounded-[20px]">
            {portrait ? (
              <picture>
                {portrait.webpSrcSet ? <source type="image/webp" srcSet={portrait.webpSrcSet} sizes="(max-width: 640px) 42vw, 260px" /> : null}
                {portrait.jpegSrcSet ? <source type="image/jpeg" srcSet={portrait.jpegSrcSet} sizes="(max-width: 640px) 42vw, 260px" /> : null}
                <img
                  src={portrait.fallbackSrc}
                  alt={player.name}
                  className={[
                    "h-full w-full object-cover object-[50%_8%] transition-transform duration-500 group-hover:scale-[1.055]",
                    `portrait-${rarity}`,
                  ].join(" ")}
                  loading="lazy"
                  decoding="async"
                  width={800}
                  height={1000}
                  sizes="(max-width: 640px) 42vw, 260px"
                />
              </picture>
            ) : (
              <div className="h-full w-full bg-gradient-to-b from-white/10 to-transparent" />
            )}

            <div className="tc-glare pointer-events-none absolute inset-[-28%] z-[4]" aria-hidden />
            <div className="pointer-events-none absolute inset-0 card-photo-vignette" />
          </div>

          <img
            src={frameMap[rarity]}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-[1.2%] z-[6] h-[97.6%] w-[97.6%] object-cover opacity-55"
          />

          <header className="absolute left-4 right-4 top-3.5 z-10">
            <div className="flex items-center justify-between font-[Inter] text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70">
              <span className="card-season-chip">{seasonLabel}</span>
              <span className="card-season-chip">{player.club || "FANTASYFC"}</span>
            </div>

            <div className="mt-2.5 flex items-start justify-between">
              <div>
                <p className="card-corner-pill engraved-text font-[Outfit] text-[34px] font-extrabold leading-none tracking-tight text-white">{player.rating}</p>
              </div>

              <div className="text-right">
                <p className="engraved-text font-[Outfit] text-[16px] font-black uppercase tracking-[0.11em] text-white">{player.position}</p>
                <span className={["metal-pill mt-1 inline-flex rounded-full border px-2 py-0.5 font-[Inter] text-[9px] font-semibold uppercase tracking-[0.16em]", meta.rarityBadgeClass].join(" ")}>
                  {meta.label}
                </span>
              </div>
            </div>
          </header>

          <footer className="card-nameplate absolute inset-x-3.5 bottom-3.5 z-20 rounded-[16px] border border-white/14 px-3.5 pb-2.5 pt-2.5">
            <h3 className="card-name-tight engraved-text truncate text-center font-[Outfit] text-[22px] font-extrabold uppercase leading-[0.92] tracking-[0.005em] text-white">{player.name}</h3>
            <p className="mt-1 truncate text-center font-[Inter] text-[10px] font-semibold uppercase tracking-[0.19em] text-white/70">{player.position} • {player.club || "FantasyFC"}</p>

            <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1.5">
              {stats.slice(0, 3).map((stat) => (
                <div key={stat.key} className="metal-capsule rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-1 text-center">
                  <div className="font-[Inter] text-[8px] font-semibold uppercase tracking-[0.15em] text-white/58">{stat.key}</div>
                  <div className="engraved-text font-[Outfit] text-[13px] font-bold leading-tight text-white">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-2.5 flex items-center justify-between font-[Inter] text-[9px] font-semibold uppercase tracking-[0.14em] text-white/62">
              <span>{player.position}</span>
              <span>
                #{String(player.serial || 1).padStart(3, "0")} / {player.maxSupply || 500}
              </span>
            </div>
          </footer>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] h-[13px] bg-gradient-to-b from-white/[0.10] via-white/[0.03] to-transparent" />

          {isLegendary ? <div className="legendary-holo-overlay pointer-events-none absolute inset-[10px] z-[8] rounded-[18px]" /> : null}

          <div className="pointer-events-none absolute inset-0 z-[11] opacity-0 transition duration-500 group-hover:opacity-100">
            <div className="luxury-shine absolute inset-[-22%]" />
          </div>

          <div className="pointer-events-none absolute inset-0 z-[9] rounded-[24px] border border-white/12" />
        </div>
      </article>
    </div>
  );
}
