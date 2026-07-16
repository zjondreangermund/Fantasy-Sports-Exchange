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
import { artworkForPrize } from "./prizeArtworkCatalog";

type Props = {
  title: string;
  rarity: string;
  category?: string;
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

const palettes: Record<string, Palette> = {
  common: { accent: "#60a5fa", secondary: "#dbeafe", glow: "rgba(96,165,250,.58)", glowSoft: "rgba(96,165,250,.18)", surface: "#071525", surfaceDeep: "#020711", glassEdge: "rgba(219,234,254,.78)" },
  rare: { accent: "#168cff", secondary: "#dbeafe", glow: "rgba(22,140,255,.72)", glowSoft: "rgba(22,140,255,.22)", surface: "#031327", surfaceDeep: "#010611", glassEdge: "rgba(191,219,254,.92)" },
  unique: { accent: "#a855f7", secondary: "#f3e8ff", glow: "rgba(168,85,247,.72)", glowSoft: "rgba(168,85,247,.22)", surface: "#180622", surfaceDeep: "#08020d", glassEdge: "rgba(233,213,255,.90)" },
  epic: { accent: "#ef233c", secondary: "#fff1f2", glow: "rgba(239,35,60,.74)", glowSoft: "rgba(239,35,60,.22)", surface: "#250609", surfaceDeep: "#0d0103", glassEdge: "rgba(254,205,211,.92)" },
  legendary: { accent: "#f59e0b", secondary: "#fff7ed", glow: "rgba(245,158,11,.76)", glowSoft: "rgba(245,158,11,.22)", surface: "#241703", surfaceDeep: "#0c0701", glassEdge: "rgba(254,243,199,.92)" },
};

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
  if (/travel|holiday|weekend|safari|europe|maldives|hunting|world cup|champions league/.test(text)) return Plane;
  if (/voucher|cash|investment|ticket/.test(text)) return Ticket;
  if (/house|home|apartment|furniture/.test(text)) return Home;
  if (/bike|motorcycle|quad|trailer|camping/.test(text)) return Bike;
  if (/car|vehicle|hilux|ranger|everest|golf|amarok|fortuner|patrol|cruiser|jimny/.test(text)) return CarFront;
  return Gift;
}

export function PremiumPrizeArtwork({ title, rarity, category }: Props) {
  const normalizedRarity = String(rarity || "common").toLowerCase();
  const palette = palettes[normalizedRarity] || palettes.common;
  const approvedImage = artworkForPrize(title, normalizedRarity);

  if (approvedImage) {
    return <ApprovedPrizeImage src={approvedImage} title={title} palette={palette} category={category} rarity={normalizedRarity} />;
  }

  return <GeneratedPrizeArtwork title={title} rarity={normalizedRarity} category={category} palette={palette} />;
}

function ApprovedPrizeImage({ src, title, rarity, category, palette }: { src: string; title: string; rarity: string; category?: string; palette: Palette }) {
  return (
    <div className="absolute inset-0 isolate overflow-hidden bg-[#010611]">
      <img
        src={src}
        alt={title}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-center"
        onError={(event) => {
          const image = event.currentTarget;
          image.style.display = "none";
          const fallback = image.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "block";
        }}
      />
      <div className="absolute inset-0 hidden">
        <GeneratedPrizeArtwork title={title} rarity={rarity} category={category} palette={palette} />
      </div>
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[38%] bg-[linear-gradient(115deg,rgba(255,255,255,.10),transparent_32%,transparent_72%,rgba(255,255,255,.05))]" />
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

      <div className="absolute inset-x-[7%] top-[7%] bottom-[8%] rounded-[1.7rem] border bg-white/[.025] backdrop-blur-[2px]" style={{ borderColor: palette.glassEdge, boxShadow: `inset 0 1px 0 rgba(255,255,255,.32), inset 0 -1px 0 ${palette.glowSoft}, 0 0 26px ${palette.glowSoft}` }} />
      <div className="absolute inset-x-[9%] top-[9%] bottom-[10%] rounded-[1.45rem] border border-white/10" />
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
