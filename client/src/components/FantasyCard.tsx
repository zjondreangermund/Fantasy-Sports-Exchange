import React from "react";

export type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

export type PlayerCardData = {
  id: string;
  name: string;
  rating: number;
  position: string;
  club?: string;
  image?: string;
  imageCandidates?: string[];
  rarity: Rarity;
  serial?: number;
  maxSupply?: number;
  form?: number;
};

type FantasyCardProps = {
  player: PlayerCardData;
  className?: string;
};

type SlabMeta = {
  label: string;
  frame: string;
  shellTop: string;
  shellBottom: string;
  faceTop: string;
  faceBottom: string;
  bevelLight: string;
  bevelDark: string;
  glow: string;
  shine: string;
  plateBorder: string;
  badgeBg: string;
  badgeText: string;
  statPlate: string;
  chamberGlow: string;
  silhouette: string;
};

const rarityMeta: Record<Rarity, SlabMeta> = {
  common: {
    label: "Common",
    frame: "linear-gradient(145deg, #d3d9e2 0%, #8d97a6 35%, #4e5661 100%)",
    shellTop: "#474f5a",
    shellBottom: "#171b21",
    faceTop: "#6a7380",
    faceBottom: "#2b3138",
    bevelLight: "rgba(255,255,255,0.26)",
    bevelDark: "rgba(0,0,0,0.42)",
    glow: "rgba(220,228,240,0.14)",
    shine: "rgba(255,255,255,0.28)",
    plateBorder: "rgba(233,239,246,0.18)",
    badgeBg: "rgba(210,220,232,0.16)",
    badgeText: "#edf2f7",
    statPlate: "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))",
    chamberGlow: "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.20), rgba(255,255,255,0.04) 45%, transparent 80%)",
    silhouette: "polygon(10% 0%, 90% 0%, 100% 8%, 100% 92%, 90% 100%, 10% 100%, 0% 92%, 0% 8%)",
  },
  rare: {
    label: "Rare",
    frame: "linear-gradient(145deg, #d8e6ff 0%, #6ca8ff 34%, #163f82 100%)",
    shellTop: "#315aa0",
    shellBottom: "#0a1834",
    faceTop: "#3e68ae",
    faceBottom: "#11284c",
    bevelLight: "rgba(194,224,255,0.34)",
    bevelDark: "rgba(0,0,0,0.46)",
    glow: "rgba(91,159,255,0.20)",
    shine: "rgba(195,225,255,0.34)",
    plateBorder: "rgba(187,220,255,0.24)",
    badgeBg: "rgba(86,154,255,0.18)",
    badgeText: "#e4f1ff",
    statPlate: "linear-gradient(180deg, rgba(135,182,255,0.14), rgba(255,255,255,0.03))",
    chamberGlow: "radial-gradient(circle at 50% 35%, rgba(114,177,255,0.24), rgba(56,112,255,0.07) 45%, transparent 82%)",
    silhouette: "polygon(8% 0%, 92% 0%, 100% 12%, 100% 88%, 92% 100%, 8% 100%, 0% 88%, 0% 12%)",
  },
  epic: {
    label: "Epic",
    frame: "linear-gradient(145deg, #e1c6ff 0%, #a05cff 35%, #3d165d 100%)",
    shellTop: "#5f31a1",
    shellBottom: "#170a25",
    faceTop: "#6a3fb0",
    faceBottom: "#261038",
    bevelLight: "rgba(235,207,255,0.28)",
    bevelDark: "rgba(0,0,0,0.46)",
    glow: "rgba(177,98,255,0.18)",
    shine: "rgba(248,225,255,0.30)",
    plateBorder: "rgba(225,196,255,0.20)",
    badgeBg: "rgba(168,96,255,0.18)",
    badgeText: "#f6eaff",
    statPlate: "linear-gradient(180deg, rgba(181,120,255,0.15), rgba(255,255,255,0.03))",
    chamberGlow: "radial-gradient(circle at 50% 35%, rgba(187,112,255,0.24), rgba(135,41,214,0.08) 45%, transparent 82%)",
    silhouette: "polygon(12% 0%, 88% 0%, 100% 7%, 100% 93%, 88% 100%, 12% 100%, 0% 93%, 0% 7%)",
  },
  legendary: {
    label: "Legendary",
    frame: "linear-gradient(145deg, #fff0b2 0%, #f0c35a 34%, #835307 100%)",
    shellTop: "#af7d21",
    shellBottom: "#2d1902",
    faceTop: "#be8b2b",
    faceBottom: "#553307",
    bevelLight: "rgba(255,241,189,0.34)",
    bevelDark: "rgba(0,0,0,0.46)",
    glow: "rgba(255,211,102,0.22)",
    shine: "rgba(255,248,212,0.38)",
    plateBorder: "rgba(255,227,142,0.22)",
    badgeBg: "rgba(255,210,96,0.22)",
    badgeText: "#fff5cf",
    statPlate: "linear-gradient(180deg, rgba(255,218,123,0.16), rgba(255,255,255,0.03))",
    chamberGlow: "radial-gradient(circle at 50% 32%, rgba(255,220,123,0.26), rgba(255,173,32,0.08) 45%, transparent 82%)",
    silhouette: "polygon(12% 0%, 24% 7%, 36% 0%, 50% 9%, 64% 0%, 76% 7%, 88% 0%, 100% 12%, 100% 88%, 90% 100%, 10% 100%, 0% 88%, 0% 12%)",
  },
  unique: {
    label: "Unique",
    frame: "linear-gradient(145deg, #bafcff 0%, #7c9cff 32%, #ff7ad9 64%, #1b1d29 100%)",
    shellTop: "#2a3140",
    shellBottom: "#090c12",
    faceTop: "#202634",
    faceBottom: "#0d1017",
    bevelLight: "rgba(201,246,255,0.28)",
    bevelDark: "rgba(0,0,0,0.52)",
    glow: "rgba(143,247,255,0.18)",
    shine: "rgba(255,255,255,0.34)",
    plateBorder: "rgba(190,233,255,0.22)",
    badgeBg: "linear-gradient(90deg, rgba(123,244,255,0.18), rgba(255,104,211,0.18))",
    badgeText: "#eefeff",
    statPlate: "linear-gradient(180deg, rgba(167,230,255,0.10), rgba(255,255,255,0.03))",
    chamberGlow: "radial-gradient(circle at 50% 34%, rgba(134,241,255,0.24), rgba(255,106,213,0.08) 44%, transparent 82%)",
    silhouette: "polygon(6% 0%, 94% 0%, 100% 13%, 100% 87%, 87% 100%, 13% 100%, 0% 87%, 0% 13%)",
  },
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

function normalizeCardPosition(position: string): "GK" | "DEF" | "MID" | "FWD" {
  const pos = String(position || "").toUpperCase();
  if (pos.includes("GK") || pos.includes("GOAL")) return "GK";
  if (pos.includes("DEF") || pos.includes("BACK")) return "DEF";
  if (pos.includes("MID")) return "MID";
  return "FWD";
}

function portraitFrameForPosition(position: string): { y: number; baseScale: number } {
  const normalized = normalizeCardPosition(position);
  if (normalized === "GK") return { y: 14, baseScale: 1.0 };
  if (normalized === "DEF") return { y: 11, baseScale: 1.03 };
  if (normalized === "MID") return { y: 9, baseScale: 1.065 };
  return { y: 6, baseScale: 1.11 };
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

export default function FantasyCard({ player, className = "" }: FantasyCardProps) {
  const rarity = player.rarity;
  const meta = rarityMeta[rarity];
  const stats = computeStats(player);
  const cardRef = React.useRef<HTMLElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const canTiltRef = React.useRef(true);
  const pointerFxRef = React.useRef({ x: 50, y: 50, tiltX: 0, tiltY: 0 });

  const imageCandidates = React.useMemo(() => {
    const list = Array.isArray(player.imageCandidates) ? player.imageCandidates : [];
    const merged = [player.image, ...list].filter((value): value is string => Boolean(String(value || "").trim()));
    return Array.from(new Set(merged));
  }, [player.image, player.imageCandidates]);

  const [imageIndex, setImageIndex] = React.useState(0);

  React.useEffect(() => {
    setImageIndex(0);
  }, [imageCandidates.join("|"), player.id]);

  const activeImage = imageCandidates[imageIndex] || player.image;
  const portrait = React.useMemo(() => buildResponsivePortrait(activeImage), [activeImage]);
  const portraitFrame = React.useMemo(() => portraitFrameForPosition(player.position), [player.position]);

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
    [commitPointerFx]
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
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType && event.pointerType !== "mouse") return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    const offsetX = x - 50;
    const offsetY = y - 50;

    const tiltX = canTiltRef.current ? clamp(-offsetY * 0.18, -10, 10) : 0;
    const tiltY = canTiltRef.current ? clamp(offsetX * 0.22, -12, 12) : 0;

    schedulePointerFx({ x, y, tiltX, tiltY });
  };

  const resetPointer = () => {
    schedulePointerFx({ x: 50, y: 50, tiltX: 0, tiltY: 0 });
  };

  return (
    <div className="relative [perspective:1400px]">
      <article
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
        onPointerCancel={resetPointer}
        className={[
          "group relative isolate aspect-[2.5/3.5] w-[260px] select-none transition-transform duration-300 hover:scale-[1.025]",
          className,
        ].join(" ")}
        style={
          {
            ["--holo-x" as string]: "50%",
            ["--holo-y" as string]: "50%",
            ["--tilt-x" as string]: "0deg",
            ["--tilt-y" as string]: "0deg",
            transform: "rotateX(var(--tilt-x)) rotateY(var(--tilt-y)) translateZ(0)",
            transformStyle: "preserve-3d",
          } as React.CSSProperties
        }
      >
        {/* OUTER DROP SHADOW */}
        <div
          className="absolute inset-[2%] rounded-[30px] blur-xl transition duration-300 group-hover:scale-[1.08]"
          style={{
            background:
              rarity === "rare"
                ? "rgba(70,140,255,0.22)"
                : rarity === "epic"
                ? "rgba(162,72,255,0.22)"
                : rarity === "legendary"
                ? "rgba(255,203,82,0.24)"
                : rarity === "unique"
                ? "rgba(124,247,255,0.18)"
                : "rgba(220,228,240,0.12)",
            transform: "translateZ(-40px)",
          }}
        />

        {/* METAL SLAB BODY */}
        <div
          className="absolute inset-0 rounded-[30px]"
          style={{
            clipPath: meta.silhouette,
            background: `linear-gradient(180deg, ${meta.shellTop} 0%, ${meta.shellBottom} 100%)`,
            boxShadow: `
              0 28px 45px rgba(0,0,0,0.42),
              0 10px 20px rgba(0,0,0,0.28),
              inset 0 2px 0 ${meta.bevelLight},
              inset 0 -10px 14px ${meta.bevelDark}
            `,
            transform: "translateZ(0px)",
          }}
        />

        {/* FRAME RING */}
        <div
          className="absolute inset-[1.7%] rounded-[28px]"
          style={{
            clipPath: meta.silhouette,
            background: meta.frame,
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.34),
              inset 0 -3px 8px rgba(0,0,0,0.34),
              0 0 0 1px rgba(255,255,255,0.06)
            `,
            transform: "translateZ(10px)",
          }}
        />

        {/* INNER FACE */}
        <div
          className="absolute inset-[5.3%] rounded-[22px] overflow-hidden"
          style={{
            background: `linear-gradient(180deg, ${meta.faceTop} 0%, ${meta.faceBottom} 100%)`,
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.18),
              inset 0 -8px 12px rgba(0,0,0,0.28)
            `,
            transform: "translateZ(18px)",
          }}
        >
          {/* brushed metal grain */}
          <div
            className="absolute inset-0 opacity-[0.08] mix-blend-soft-light"
            style={{
              backgroundImage: `
                repeating-linear-gradient(
                  100deg,
                  rgba(255,255,255,0.10) 0px,
                  rgba(255,255,255,0.10) 1px,
                  rgba(255,255,255,0.02) 2px,
                  rgba(0,0,0,0.04) 4px,
                  rgba(0,0,0,0.04) 6px
                )
              `,
            }}
          />

          {/* top machined header strip */}
          <div
            className="absolute inset-x-[3%] top-[2.5%] h-[17%] rounded-[14px]"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.13), rgba(0,0,0,0.08))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 6px rgba(0,0,0,0.22)",
            }}
          />

          {rarity === "legendary" ? (
            <div
              className="pointer-events-none absolute left-[8%] right-[8%] top-[1.8%] z-[12] h-[16%]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,232,164,0.34), rgba(255,194,70,0.10))",
                clipPath:
                  "polygon(0% 100%, 8% 58%, 18% 82%, 29% 22%, 40% 72%, 50% 0%, 60% 72%, 71% 22%, 82% 82%, 92% 58%, 100% 100%)",
                filter: "drop-shadow(0 4px 10px rgba(255,190,60,0.18))",
                opacity: 0.9,
              }}
            />
          ) : null}

          {rarity === "legendary" ? (
            <div
              className="pointer-events-none absolute left-[12%] right-[12%] top-[3.8%] z-[11] h-[8%] rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(255,219,110,0.32), transparent 72%)",
                filter: "blur(8px)",
              }}
            />
          ) : null}

          {/* player chamber */}
          <div
            className="absolute inset-x-[4%] top-[16%] h-[47%] overflow-hidden rounded-[18px]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.16)), radial-gradient(circle at 50% 20%, rgba(255,255,255,0.08), transparent 58%)",
              boxShadow: `
                inset 0 3px 10px rgba(0,0,0,0.42),
                inset 0 1px 0 rgba(255,255,255,0.08),
                0 10px 18px rgba(0,0,0,0.24)
              `,
              transform: "translateZ(24px)",
            }}
          >
            <div className="absolute inset-0" style={{ background: meta.chamberGlow }} />

            <div
              className="pointer-events-none absolute inset-x-[10%] top-[10%] bottom-[12%] z-[1] rounded-[999px]"
              style={{
                background:
                  rarity === "rare"
                    ? "radial-gradient(circle, rgba(88,160,255,0.22), transparent 68%)"
                    : rarity === "epic"
                    ? "radial-gradient(circle, rgba(176,102,255,0.24), transparent 68%)"
                    : rarity === "legendary"
                    ? "radial-gradient(circle, rgba(255,211,105,0.26), transparent 68%)"
                    : rarity === "unique"
                    ? "radial-gradient(circle, rgba(124,247,255,0.18), rgba(255,102,214,0.12) 42%, transparent 72%)"
                    : "radial-gradient(circle, rgba(255,255,255,0.14), transparent 68%)",
                filter: "blur(10px)",
              }}
            />

            {portrait ? (
              <picture className="absolute inset-0 z-[3]">
                {portrait.webpSrcSet ? (
                  <source type="image/webp" srcSet={portrait.webpSrcSet} sizes="(max-width: 640px) 42vw, 260px" />
                ) : null}
                {portrait.jpegSrcSet ? (
                  <source type="image/jpeg" srcSet={portrait.jpegSrcSet} sizes="(max-width: 640px) 42vw, 260px" />
                ) : null}
                <img
                  src={portrait.fallbackSrc}
                  alt={player.name}
                  width={800}
                  height={1000}
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 640px) 42vw, 260px"
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                  style={{
                    objectPosition: `50% ${portraitFrame.y}%`,
                    transform: `scale(${portraitFrame.baseScale * 1.03}) translateY(1px)`,
                    filter: "contrast(1.16) saturate(1.12) brightness(1.01) drop-shadow(0 8px 12px rgba(0,0,0,0.34))",
                  }}
                  onError={() => {
                    setImageIndex((prev) => (prev >= imageCandidates.length - 1 ? prev : prev + 1));
                  }}
                />
              </picture>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/10" />
            )}

            <div
              className="absolute inset-0 opacity-35"
              style={{
                background:
                  "linear-gradient(140deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 16%, transparent 34%, transparent 100%)",
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(0,0,0,0.28),transparent_56%)]" />

            <div
              className="pointer-events-none absolute inset-0 z-[4]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 18%, transparent 72%, rgba(0,0,0,0.18) 100%)",
                mixBlendMode: "soft-light",
              }}
            />
          </div>

          {/* engraved side rails */}
          <div className="absolute left-[4%] top-[17%] bottom-[31%] w-[5px] rounded-full bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.35)]" />
          <div className="absolute right-[4%] top-[17%] bottom-[31%] w-[5px] rounded-full bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.35)]" />

          {/* header content */}
          <header className="absolute inset-x-[6%] top-[5.2%] z-20 flex items-start justify-between">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/68">
                {player.club || "FantasyFC"}
              </div>
              <div
                className="mt-1 text-[38px] font-black leading-none tracking-[-0.05em] text-white"
                style={{
                  textShadow: "0 1px 0 rgba(255,255,255,0.14), 0 2px 4px rgba(0,0,0,0.18)",
                }}
              >
                {player.rating}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[17px] font-black uppercase tracking-[0.10em] text-white">
                {player.position}
              </div>
              <span
                className="mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]"
                style={{
                  borderColor: meta.plateBorder,
                  background: meta.badgeBg,
                  color: meta.badgeText,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)",
                }}
              >
                {meta.label}
              </span>
            </div>
          </header>

          {/* mounted bottom stat slab */}
          <footer
            className="absolute inset-x-[4.3%] bottom-[4%] z-20 rounded-[18px] px-3 pb-2.5 pt-2.5"
            style={{
              background: "linear-gradient(180deg, rgba(18,20,27,0.74), rgba(8,10,14,0.86))",
              border: `1px solid ${meta.plateBorder}`,
              boxShadow: `
                0 14px 22px rgba(0,0,0,0.26),
                inset 0 1px 0 rgba(255,255,255,0.10),
                inset 0 -6px 10px rgba(0,0,0,0.26)
              `,
              transform: "translateZ(34px)",
              backdropFilter: "blur(8px)",
            }}
          >
            <h3 className="truncate text-center text-[22px] font-black uppercase leading-[0.92] tracking-[-0.02em] text-white">
              {player.name}
            </h3>

            <p className="mt-1 truncate text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {player.position} • {player.club || "FantasyFC"}
            </p>

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {stats.slice(0, 6).map((stat) => (
                <div
                  key={stat.key}
                  className="rounded-[10px] px-1.5 py-1 text-center"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.12))",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -3px 6px rgba(0,0,0,0.24)",
                  }}
                >
                  <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/58">{stat.key}</div>
                  <div className="text-[13px] font-extrabold leading-tight text-white">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.14em] text-white/62">
              <span>{player.position}</span>
              <span>
                #{String(player.serial || 1).padStart(3, "0")} / {player.maxSupply || 500}
              </span>
            </div>
          </footer>

          {/* metallic shine */}
          <div
            className="pointer-events-none absolute inset-[-30%] transition duration-500 group-hover:translate-x-[9%]"
            style={{
              opacity: rarity === "common" ? 0.18 : rarity === "rare" ? 0.34 : rarity === "epic" ? 0.38 : rarity === "legendary" ? 0.46 : 0.52,
              background:
                rarity === "unique"
                  ? `linear-gradient(
                      115deg,
                      transparent 22%,
                      rgba(124,247,255,0.18) 31%,
                      rgba(255,114,214,0.20) 38%,
                      rgba(255,255,255,0.09) 45%,
                      transparent 55%
                    )`
                  : rarity === "legendary"
                  ? `linear-gradient(
                      115deg,
                      transparent 22%,
                      rgba(255,223,128,0.22) 33%,
                      rgba(255,255,255,0.10) 42%,
                      transparent 54%
                    )`
                  : `linear-gradient(
                      115deg,
                      transparent 24%,
                      rgba(255,255,255,0.16) 34%,
                      rgba(255,255,255,0.03) 41%,
                      transparent 50%
                    )`,
              mixBlendMode: "screen",
              transform: "translateX(-18%)",
            }}
          />

          {/* holo hotspot */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background: `radial-gradient(circle at var(--holo-x) var(--holo-y), rgba(255,255,255,0.18), transparent 24%)`,
            }}
          />

          {rarity === "legendary" ? (
            <div
              className="pointer-events-none absolute inset-0 z-[23] opacity-35"
              style={{
                background:
                  "radial-gradient(circle at 50% 18%, rgba(255,228,126,0.20), transparent 30%)",
                mixBlendMode: "screen",
              }}
            />
          ) : null}

          {rarity === "unique" ? (
            <div
              className="pointer-events-none absolute inset-0 z-[23] opacity-30"
              style={{
                background:
                  "radial-gradient(circle at 50% 16%, rgba(255,255,255,0.12), transparent 24%)",
                mixBlendMode: "screen",
              }}
            />
          ) : null}

          {rarity === "unique" ? (
            <div
              className="pointer-events-none absolute inset-0 z-[24] opacity-50"
              style={{
                background:
                  "radial-gradient(circle at var(--holo-x) var(--holo-y), rgba(124,247,255,0.16), rgba(255,102,214,0.10) 18%, transparent 34%)",
                mixBlendMode: "screen",
              }}
            />
          ) : null}

          {rarity === "unique" ? (
            <div
              className="pointer-events-none absolute inset-[1.4%] z-[25] rounded-[26px]"
              style={{
                background: `
                  linear-gradient(
                    130deg,
                    rgba(124,247,255,0.00) 0%,
                    rgba(124,247,255,0.16) 18%,
                    rgba(255,111,214,0.18) 38%,
                    rgba(156,132,255,0.16) 58%,
                    rgba(124,247,255,0.00) 76%
                  )
                `,
                mixBlendMode: "screen",
                opacity: 0.9,
                maskImage:
                  "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskImage:
                  "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                padding: "2px",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                animation: "uniqueEdgeShift 4.5s linear infinite",
              } as React.CSSProperties}
            />
          ) : null}

          {/* edge vignette */}
          <div className="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_-18px_24px_rgba(0,0,0,0.18)]" />
        </div>
      </article>
    </div>
  );
}