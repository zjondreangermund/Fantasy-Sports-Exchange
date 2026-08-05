import { useState } from "react";
import {
  Bike,
  CarFront,
  Coffee,
  Gamepad2,
  Gift,
  Headphones,
  Home,
  Laptop,
  Monitor,
  Plane,
  Radio,
  Smartphone,
  Sparkles,
  Ticket,
  Watch,
} from "lucide-react";
import { artworkForPrize, type PrizeArtwork } from "./prizeArtworkCatalog";

type ArtworkMode = "card" | "hero" | "spotlight";

type Props = {
  title: string;
  rarity: string;
  category?: string;
  mode?: ArtworkMode;
};

type Palette = {
  accent: string;
  secondary: string;
  glow: string;
  glowSoft: string;
  surface: string;
  surfaceDeep: string;
  glassEdge: string;
};

type LegendaryMeta = {
  index: number;
  value: string;
};

const palettes: Record<string, Palette> = {
  common: { accent: "#60a5fa", secondary: "#dbeafe", glow: "rgba(96,165,250,.58)", glowSoft: "rgba(96,165,250,.18)", surface: "#071525", surfaceDeep: "#020711", glassEdge: "rgba(219,234,254,.78)" },
  rare: { accent: "#168cff", secondary: "#dbeafe", glow: "rgba(22,140,255,.72)", glowSoft: "rgba(22,140,255,.22)", surface: "#031327", surfaceDeep: "#010611", glassEdge: "rgba(191,219,254,.92)" },
  unique: { accent: "#a855f7", secondary: "#f3e8ff", glow: "rgba(168,85,247,.72)", glowSoft: "rgba(168,85,247,.22)", surface: "#180622", surfaceDeep: "#08020d", glassEdge: "rgba(233,213,255,.90)" },
  epic: { accent: "#ef233c", secondary: "#fff1f2", glow: "rgba(239,35,60,.74)", glowSoft: "rgba(239,35,60,.22)", surface: "#250609", surfaceDeep: "#0d0103", glassEdge: "rgba(254,205,211,.92)" },
  legendary: { accent: "#f59e0b", secondary: "#fff7ed", glow: "rgba(245,158,11,.76)", glowSoft: "rgba(245,158,11,.22)", surface: "#241703", surfaceDeep: "#0c0701", glassEdge: "rgba(254,243,199,.92)" },
};

const legendaryRules: Array<{ pattern: RegExp; meta: LegendaryMeta }> = [
  { pattern: /^N\$10,?000\s+Luxury\s+Tech\s+Voucher$/i, meta: { index: 1, value: "N$10,000" } },
  { pattern: /^N\$25,?000\s+Luxury\s+Travel\s+Voucher$/i, meta: { index: 2, value: "N$25,000" } },
  { pattern: /^Luxury\s+Watch\s*\/\s*Equivalent$/i, meta: { index: 3, value: "N$50,000" } },
  { pattern: /^Luxury\s+African\s+Safari\s+for\s+Two$/i, meta: { index: 4, value: "N$180,000" } },
  { pattern: /^FIFA\s+World\s+Cup\s+VIP\s+Trip$/i, meta: { index: 5, value: "N$250,000" } },
  { pattern: /^Fishing\s+Boat$/i, meta: { index: 6, value: "N$250,000" } },
  { pattern: /^Around-the-World\s+Holiday$/i, meta: { index: 7, value: "N$300,000" } },
  { pattern: /^Tiny\s+Home\s*\/\s*Equivalent\s+Value$/i, meta: { index: 8, value: "N$350,000" } },
  { pattern: /^Luxury\s+Caravan$/i, meta: { index: 9, value: "N$350,000" } },
  { pattern: /^House\s+Deposit\s*\/\s*Equivalent\s+Value$/i, meta: { index: 10, value: "N$500,000" } },
  { pattern: /^VW\s+Amarok\s*\/\s*Equivalent\s+Value$/i, meta: { index: 11, value: "N$600,000" } },
  { pattern: /^Toyota\s+Fortuner\s*\/\s*Equivalent\s+Value$/i, meta: { index: 12, value: "N$650,000" } },
  { pattern: /^Apartment\s+Deposit\s*\/\s*Equivalent\s+Value$/i, meta: { index: 13, value: "N$750,000" } },
  { pattern: /^Nissan\s+Patrol\s*\/\s*Equivalent\s+Value$/i, meta: { index: 14, value: "N$900,000" } },
  { pattern: /^Toyota\s+Land\s+Cruiser\s*\/\s*Equivalent$/i, meta: { index: 15, value: "N$1,100,000" } },
  { pattern: /^Dream\s+Home\s*\/\s*Equivalent\s+Value$/i, meta: { index: 16, value: "N$1,500,000" } },
  { pattern: /^N\$2,?000,?000\s+Cash\s*\/\s*Equivalent$/i, meta: { index: 17, value: "N$2,000,000" } },
  { pattern: /^Luxury\s+Performance\s+SUV\s*\/\s*Equivalent\s+Value$/i, meta: { index: 18, value: "N$2,500,000" } },
  { pattern: /^Luxury\s+Yacht\s*\/\s*Equivalent\s+Value$/i, meta: { index: 19, value: "N$3,500,000" } },
  { pattern: /^N\$5,?000,?000\s+Grand\s+Prize\s*\/\s*Equivalent$/i, meta: { index: 20, value: "N$5,000,000" } },
];

function iconFor(title: string, category = "") {
  const text = `${title} ${category}`.toLowerCase();
  if (/headset|headphone/.test(text)) return Headphones;
  if (/speaker|soundbar/.test(text)) return Radio;
  if (/watch/.test(text)) return Watch;
  if (/coffee/.test(text)) return Coffee;
  if (/laptop|macbook/.test(text)) return Laptop;
  if (/monitor|gaming pc|computer|rtx/.test(text)) return Monitor;
  if (/playstation|xbox|console|controller|game bundle|vr/.test(text)) return Gamepad2;
  if (/phone|smartphone|airtime|data|powerbank|tablet/.test(text)) return Smartphone;
  if (/travel|holiday|weekend|safari|europe|maldives|hunting|world cup|champions league|around-the-world/.test(text)) return Plane;
  if (/voucher|cash|investment|ticket|grand prize/.test(text)) return Ticket;
  if (/house|home|apartment|furniture/.test(text)) return Home;
  if (/bike|motorcycle|quad|trailer|camping|caravan|boat|yacht/.test(text)) return Bike;
  if (/car|vehicle|suv|hilux|ranger|everest|golf|amarok|fortuner|patrol|cruiser|jimny/.test(text)) return CarFront;
  return Gift;
}

function legendaryMetaFor(title: string, spriteIndex?: number): LegendaryMeta {
  const match = legendaryRules.find((rule) => rule.pattern.test(String(title || "").trim()));
  if (match) return match.meta;
  return { index: Math.max(1, Math.min(20, Number(spriteIndex || 0) + 1)), value: "Legendary reward" };
}

export function PremiumPrizeArtwork({ title, rarity, category, mode = "card" }: Props) {
  const normalizedRarity = String(rarity || "common").toLowerCase();
  const palette = palettes[normalizedRarity] || palettes.common;
  const approvedArtwork = artworkForPrize(title, normalizedRarity);

  if (approvedArtwork) {
    return <ApprovedPrizeImage artwork={approvedArtwork} title={title} palette={palette} category={category} rarity={normalizedRarity} mode={mode} />;
  }

  return <GeneratedPrizeArtwork title={title} rarity={normalizedRarity} category={category} palette={palette} mode={mode} />;
}

function SpriteTile({ src, index, className, title, onError, decorative = false }: { src: string; index: number; className: string; title: string; onError: () => void; decorative?: boolean }) {
  const safeIndex = Math.max(0, Math.min(19, Math.round(index)));
  const column = safeIndex % 5;
  const row = Math.floor(safeIndex / 5);

  return (
    <div
      className={className}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
    >
      <div
        className="h-full w-full bg-no-repeat"
        style={{
          backgroundImage: `url("${src}")`,
          backgroundSize: "500% 400%",
          backgroundPosition: `${column * 25}% ${row * (100 / 3)}%`,
          imageRendering: "auto",
        }}
      />
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px opacity-0"
        onError={onError}
      />
    </div>
  );
}

function LegendaryCrispPoster({ artwork, title, category, mode, onError }: { artwork: PrizeArtwork; title: string; category?: string; mode: ArtworkMode; onError: () => void }) {
  const meta = legendaryMetaFor(title, artwork.spriteIndex);
  const Icon = iconFor(title, category);
  const isHero = mode === "hero";
  const isSpotlight = mode === "spotlight";
  const valueClass = isHero ? "text-4xl sm:text-6xl lg:text-7xl" : isSpotlight ? "text-3xl sm:text-5xl" : "text-[clamp(1.55rem,8vw,2.7rem)]";
  const titleClass = isHero ? "max-w-[88%] text-lg sm:text-2xl lg:text-3xl" : isSpotlight ? "max-w-[88%] text-base sm:text-xl" : "max-w-[90%] text-[clamp(.72rem,3.2vw,1.05rem)]";

  return (
    <div className="absolute inset-0 isolate overflow-hidden bg-[#050300] text-white">
      {Number.isInteger(artwork.spriteIndex) ? (
        <SpriteTile
          src={artwork.src}
          index={artwork.spriteIndex as number}
          title={title}
          decorative
          onError={onError}
          className="absolute inset-0 scale-[1.02] opacity-40 contrast-125 saturate-125"
        />
      ) : (
        <img
          src={artwork.src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-40 contrast-125 saturate-125"
          onError={onError}
        />
      )}

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.90)_0%,rgba(4,2,0,.82)_39%,rgba(4,2,0,.42)_66%,rgba(0,0,0,.92)_100%)]" />
      <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(245,158,11,.075)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,.075)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute inset-[2.3%] rounded-[1.25rem] border border-amber-300/75 shadow-[inset_0_0_0_1px_rgba(255,255,255,.15),inset_0_0_35px_rgba(245,158,11,.22),0_0_26px_rgba(245,158,11,.32)]" />
      <div className="absolute inset-[4.2%] rounded-[1rem] border border-amber-100/15" />
      <div className="absolute left-[7%] right-[7%] top-[5.7%] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 rotate-45 place-items-center rounded-[.35rem] border border-amber-200/70 bg-gradient-to-br from-amber-100 via-amber-400 to-amber-800 shadow-[0_0_20px_rgba(245,158,11,.75)]">
            <Sparkles className="h-4 w-4 -rotate-45 text-black" strokeWidth={2.6} />
          </div>
          <div className="text-[9px] font-black uppercase tracking-[.2em] text-amber-300 sm:text-[11px]">Legendary Prize</div>
        </div>
        <div className="rounded-full border border-white/25 bg-black/55 px-2.5 py-1 text-[9px] font-black tracking-[.12em] text-white sm:text-[11px]">#{meta.index} OF 20</div>
      </div>

      <div className="absolute inset-x-[6%] top-[16%] z-10 flex flex-col items-center text-center">
        <div className={`${valueClass} font-black leading-none tracking-[-.045em] text-transparent [background:linear-gradient(180deg,#fff8d5_0%,#f8d77a_35%,#d99316_65%,#fff2b2_100%)] bg-clip-text drop-shadow-[0_4px_8px_rgba(0,0,0,.9)]`}>
          {meta.value}
        </div>
        <div className={`${titleClass} mt-2 font-black uppercase leading-[1.02] tracking-[-.02em] text-white drop-shadow-[0_3px_5px_rgba(0,0,0,.95)]`}>
          {title.replace(/^N\$[\d,]+\s+/i, "")}
        </div>
      </div>

      <div className="absolute left-1/2 top-[63%] h-[36%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-amber-400/20 blur-3xl" />
      <div className="absolute left-1/2 top-[61%] z-10 flex h-[31%] w-[43%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[1.6rem] border border-amber-200/45 bg-[linear-gradient(145deg,rgba(255,255,255,.16),rgba(15,8,0,.74))] shadow-[inset_0_1px_0_rgba(255,255,255,.38),0_24px_45px_rgba(0,0,0,.8),0_0_34px_rgba(245,158,11,.46)] backdrop-blur-[2px]">
        <div className="absolute inset-[8%] rounded-[1.25rem] border border-white/10 bg-black/20" />
        <Icon className="relative z-10 h-[58%] w-[58%] text-amber-50 drop-shadow-[0_0_15px_rgba(245,158,11,.95)]" strokeWidth={1.35} />
      </div>

      <div className="absolute bottom-[7%] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-300/30 bg-black/65 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-amber-100/85 backdrop-blur sm:text-[11px]">
        Valued at {meta.value}
      </div>
      <div className="pointer-events-none absolute inset-x-[6%] top-[5%] h-[42%] rounded-[1.2rem] bg-[linear-gradient(115deg,rgba(255,255,255,.18),transparent_24%,transparent_68%,rgba(255,255,255,.06))]" />
    </div>
  );
}

function ApprovedPrizeImage({ artwork, title, rarity, category, palette, mode }: { artwork: PrizeArtwork; title: string; rarity: string; category?: string; palette: Palette; mode: ArtworkMode }) {
  const [failed, setFailed] = useState(false);
  const padding = mode === "hero" ? "p-3 sm:p-5" : mode === "spotlight" ? "p-3 sm:p-4" : "p-1.5";

  if (failed) {
    return <GeneratedPrizeArtwork title={title} rarity={rarity} category={category} palette={palette} mode={mode} />;
  }

  if (rarity === "legendary") {
    return <LegendaryCrispPoster artwork={artwork} title={title} category={category} mode={mode} onError={() => setFailed(true)} />;
  }

  if (Number.isInteger(artwork.spriteIndex)) {
    return (
      <div
        className="absolute inset-0 isolate overflow-hidden bg-[#010611]"
        style={{ background: `radial-gradient(circle at 50% 48%,${palette.glowSoft},transparent 58%),linear-gradient(145deg,${palette.surface},${palette.surfaceDeep})` }}
      >
        <SpriteTile
          src={artwork.src}
          index={artwork.spriteIndex as number}
          title={title}
          decorative
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full scale-110 opacity-30 blur-xl"
        />
        <SpriteTile
          src={artwork.src}
          index={artwork.spriteIndex as number}
          title={title}
          onError={() => setFailed(true)}
          className={`absolute inset-0 z-10 h-full w-full ${padding}`}
        />
        <div className="pointer-events-none absolute inset-0 z-20 ring-1 ring-inset ring-white/10" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[32%] bg-[linear-gradient(115deg,rgba(255,255,255,.09),transparent_32%,transparent_72%,rgba(255,255,255,.04))]" />
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 isolate overflow-hidden bg-[#010611]"
      style={{ background: `radial-gradient(circle at 50% 48%,${palette.glowSoft},transparent 58%),linear-gradient(145deg,${palette.surface},${palette.surfaceDeep})` }}
    >
      <img
        src={artwork.src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-xl"
        onError={() => setFailed(true)}
      />
      <img
        src={artwork.src}
        alt={title}
        loading="lazy"
        decoding="async"
        className={`absolute inset-0 z-10 h-full w-full object-contain object-center ${padding}`}
        onError={() => setFailed(true)}
      />
      <div className="pointer-events-none absolute inset-0 z-20 ring-1 ring-inset ring-white/10" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[32%] bg-[linear-gradient(115deg,rgba(255,255,255,.09),transparent_32%,transparent_72%,rgba(255,255,255,.04))]" />
    </div>
  );
}

function GeneratedPrizeArtwork({ title, rarity, category, palette }: Props & { palette: Palette }) {
  const Icon = iconFor(title, category);

  return (
    <div
      className="absolute inset-0 isolate overflow-hidden"
      style={{
        background: `radial-gradient(circle at 50% 26%, ${palette.glowSoft}, transparent 34%), radial-gradient(circle at 15% 18%, rgba(255,255,255,.08), transparent 18%), linear-gradient(145deg, ${palette.surface}, ${palette.surfaceDeep} 74%)`,
      }}
    >
      <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="absolute -left-14 top-6 h-44 w-44 rounded-full blur-3xl" style={{ background: palette.glowSoft }} />
      <div className="absolute -right-16 bottom-0 h-52 w-52 rounded-full blur-3xl" style={{ background: palette.glowSoft }} />

      <div className="absolute inset-x-[7%] bottom-[8%] top-[7%] rounded-[1.7rem] border bg-white/[.025] backdrop-blur-[2px]" style={{ borderColor: palette.glassEdge, boxShadow: `inset 0 1px 0 rgba(255,255,255,.32), inset 0 -1px 0 ${palette.glowSoft}, 0 0 26px ${palette.glowSoft}` }} />
      <div className="absolute inset-x-[9%] bottom-[10%] top-[9%] rounded-[1.45rem] border border-white/10" />
      <div className="absolute left-[10%] top-[12%] h-[2px] w-[38%] rounded-full bg-gradient-to-r from-white/80 to-transparent" />
      <div className="absolute right-[10%] top-[12%] h-[2px] w-[18%] rounded-full" style={{ background: `linear-gradient(90deg,transparent,${palette.accent})` }} />
      <Sparkles className="absolute right-[12%] top-[13%] h-6 w-6 opacity-65" style={{ color: palette.accent }} />

      <div className="absolute left-1/2 top-[52%] h-[31%] w-[72%] -translate-x-1/2 rounded-[50%] bg-black/80 blur-md" />
      <div className="absolute left-1/2 top-[57%] h-[22%] w-[70%] -translate-x-1/2 rounded-[50%] border border-white/10" style={{ background: "radial-gradient(ellipse at 50% 35%,#334155 0%,#111827 30%,#030712 68%,#000 100%)", boxShadow: `inset 0 8px 18px rgba(255,255,255,.06), inset 0 -16px 24px rgba(0,0,0,.8), 0 7px 0 rgba(0,0,0,.72), 0 12px 28px rgba(0,0,0,.82), 0 0 22px ${palette.glowSoft}` }} />
      <div className="absolute left-1/2 top-[61%] h-[8%] w-[64%] -translate-x-1/2 rounded-[50%]" style={{ background: `radial-gradient(ellipse,${palette.glowSoft},transparent 68%)` }} />

      <div className="absolute left-1/2 top-[38%] z-10 flex h-[42%] w-[47%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2rem] border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.025))] shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_26px_55px_rgba(0,0,0,.58)] backdrop-blur-md">
        <div className="absolute inset-[8%] rounded-[1.55rem] border border-white/10 bg-black/20" />
        <div className="absolute inset-x-[18%] bottom-[12%] h-[18%] rounded-full blur-xl" style={{ background: palette.glowSoft }} />
        <Icon className="relative z-10 h-[54%] w-[54%]" strokeWidth={1.18} style={{ color: palette.secondary, filter: `drop-shadow(0 0 12px ${palette.accent}) drop-shadow(0 16px 18px rgba(0,0,0,.72))` }} />
      </div>

      <div className="absolute inset-x-[10%] bottom-[7%] z-20 rounded-[1rem] border border-white/10 bg-black/45 px-3 py-2 text-center backdrop-blur-lg">
        <div className="text-[9px] font-black uppercase tracking-[.19em]" style={{ color: palette.accent }}>{rarity} prize</div>
        <div className="mt-0.5 line-clamp-2 text-[12px] font-black leading-tight text-white">{title}</div>
      </div>

      <div className="pointer-events-none absolute inset-x-[8%] top-[8%] h-[42%] rounded-[1.7rem] bg-[linear-gradient(115deg,rgba(255,255,255,.23),transparent_24%,transparent_66%,rgba(255,255,255,.08))] opacity-80" />
      <div className="pointer-events-none absolute -left-[20%] top-[5%] h-[125%] w-[38%] rotate-[13deg] bg-gradient-to-r from-transparent via-white/10 to-transparent blur-md" />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/5" />
    </div>
  );
}
