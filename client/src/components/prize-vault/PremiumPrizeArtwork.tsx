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

type Props = {
  title: string;
  rarity: string;
  category?: string;
};

const palettes: Record<string, { accent: string; secondary: string; glow: string; surface: string }> = {
  common: { accent: "#60a5fa", secondary: "#dbeafe", glow: "rgba(96,165,250,.48)", surface: "#071525" },
  rare: { accent: "#168cff", secondary: "#bfdbfe", glow: "rgba(22,140,255,.62)", surface: "#031327" },
  unique: { accent: "#a855f7", secondary: "#ead5ff", glow: "rgba(168,85,247,.62)", surface: "#180622" },
  epic: { accent: "#ef233c", secondary: "#fecaca", glow: "rgba(239,35,60,.64)", surface: "#250609" },
  legendary: { accent: "#f59e0b", secondary: "#fef3c7", glow: "rgba(245,158,11,.66)", surface: "#241703" },
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
  if (/phone|smartphone|airtime|data|powerbank/.test(text)) return Smartphone;
  if (/travel|holiday|weekend|safari|europe|world cup|champions league/.test(text)) return Plane;
  if (/voucher|cash|investment|ticket/.test(text)) return Ticket;
  if (/house|home|apartment|furniture/.test(text)) return Home;
  if (/bike|motorcycle|quad/.test(text)) return Bike;
  if (/car|vehicle|hilux|ranger|amarok|fortuner|patrol|cruiser|jimny/.test(text)) return CarFront;
  return Gift;
}

export function PremiumPrizeArtwork({ title, rarity, category }: Props) {
  const palette = palettes[rarity] || palettes.common;
  const Icon = iconFor(title, category);
  const words = title.split(/\s+/).slice(0, 3).join(" ");

  return (
    <div
      className="absolute inset-0 isolate overflow-hidden"
      style={{
        background: `radial-gradient(circle at 50% 30%, ${palette.glow}, transparent 36%), linear-gradient(145deg, ${palette.surface}, #02040a 72%)`,
      }}
    >
      <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute -left-10 top-8 h-36 w-36 rounded-full blur-3xl" style={{ background: palette.glow }} />
      <div className="absolute -right-12 bottom-4 h-40 w-40 rounded-full blur-3xl" style={{ background: palette.glow }} />
      <div className="absolute left-1/2 top-[42%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-[2.2rem] border border-white/15 bg-white/[.07] shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_30px_60px_rgba(0,0,0,.55)] backdrop-blur-sm" />
      <div className="absolute left-1/2 top-[42%] z-10 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[1.8rem] border border-white/20 bg-black/30 shadow-[0_0_45px_rgba(255,255,255,.08)]">
        <Icon className="h-20 w-20" strokeWidth={1.25} style={{ color: palette.secondary, filter: `drop-shadow(0 0 18px ${palette.accent})` }} />
      </div>
      <Sparkles className="absolute right-6 top-6 h-8 w-8 opacity-75" style={{ color: palette.accent }} />
      <div className="absolute inset-x-4 bottom-4 z-10 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-center backdrop-blur-md">
        <div className="text-[10px] font-black uppercase tracking-[.2em]" style={{ color: palette.accent }}>{rarity} reward</div>
        <div className="mt-1 line-clamp-2 text-sm font-black text-white">{words}</div>
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_15%,rgba(255,255,255,.16)_35%,transparent_52%)] opacity-60" />
    </div>
  );
}
