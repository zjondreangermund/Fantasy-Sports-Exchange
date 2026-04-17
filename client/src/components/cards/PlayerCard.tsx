import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { type PlayerCardWithPlayer } from "../../../../shared/schema";

export type MarketplaceRarity = "common" | "rare" | "unique" | "legendary";

export type MarketplaceCardData = {
  id: number;
  season: string;
  firstName: string;
  lastName: string;
  teamId: number;
  teamShortName: string;
  shirtNumber: number;
  age: number;
  country: string;
  average: number;
  last5: number[];
  positionLabel: string;
  serial: string;
  code: number;
  rarity: MarketplaceRarity;
  imageUrl: string;
  seller: string;
  price: string;
};

const rarityThemes: Record<
  MarketplaceRarity,
  {
    border: string;
    inner: string;
    glow: string;
    badge: string;
    label: string;
  }
> = {
  common: {
    border: "border-zinc-300",
    inner: "from-zinc-200 via-white to-zinc-300",
    glow: "shadow-[0_0_32px_rgba(255,255,255,0.18)]",
    badge: "bg-zinc-100 text-zinc-700 border-zinc-300",
    label: "COMMON",
  },
  rare: {
    border: "border-red-400/60",
    inner: "from-red-800 via-red-600 to-rose-700",
    glow: "shadow-[0_0_42px_rgba(239,68,68,0.30)]",
    badge: "bg-white/10 text-white border-white/25",
    label: "RARE",
  },
  unique: {
    border: "border-fuchsia-300/30",
    inner: "from-fuchsia-700 via-violet-700 to-indigo-900",
    glow: "shadow-[0_0_44px_rgba(147,51,234,0.40)]",
    badge: "bg-white/10 text-white border-white/20",
    label: "UNIQUE",
  },
  legendary: {
    border: "border-yellow-200/60",
    inner: "from-yellow-700 via-amber-500 to-yellow-800",
    glow: "shadow-[0_0_52px_rgba(245,158,11,0.45)]",
    badge: "bg-black/10 text-black border-black/15",
    label: "LEGENDARY",
  },
};

const teamShortNames: Record<number, string> = {
  1: "ARS",
  2: "AVL",
  3: "BOU",
  4: "BRE",
  5: "BHA",
  6: "CHE",
  7: "CRY",
  8: "EVE",
  9: "FUL",
  10: "IPS",
  11: "LEI",
  12: "LIV",
  13: "MCI",
  14: "MUN",
  15: "NEW",
  16: "NFO",
  17: "SOU",
  18: "TOT",
  19: "WHU",
  20: "WOL",
};

const nationShortNames: Record<string, string> = {
  Argentina: "ARG",
  Brazil: "BRA",
  England: "ENG",
  Egypt: "EGY",
  France: "FRA",
  Netherlands: "NED",
  Norway: "NOR",
  Portugal: "POR",
  Spain: "ESP",
  Uruguay: "URU",
  USA: "USA",
};

export const rarityLogos: Record<MarketplaceRarity, string> = {
  common: "/rarity/common-bg.png",
  rare: "/rarity/rare-bg.png",
  unique: "/rarity/unique-bg.png",
  legendary: "/rarity/legendary-bg.png",
};

export function getFplImageUrl(code: number | string, size = "250x250") {
  return `https://resources.premierleague.com/premierleague/photos/players/${size}/p${code}.png`;
}

export function splitDisplayName(firstName = "", secondName = "") {
  const first = String(firstName || "").trim().toUpperCase();
  const last = String(secondName || "").trim().toUpperCase();
  return { firstName: first || "PLAYER", lastName: last || "NAME" };
}

export function mapFormToBars(formValue: number | string) {
  const numeric = Number(formValue || 0);
  const scaled = Math.max(35, Math.min(95, numeric * 12));
  return [scaled - 18, scaled - 10, scaled - 5, scaled, scaled - 8].map((v) => Math.max(20, Math.min(100, v)));
}

export function mapChanceToAverage(pointsPerGame: number | string, form: number | string) {
  const ppg = Number(pointsPerGame || 0);
  const liveForm = Number(form || 0);
  const blended = ppg * 12 + liveForm * 2.5;
  return Math.max(45, Math.min(99, blended));
}

export function pickRarityFromCost(nowCost: number | string): MarketplaceRarity {
  const cost = Number(nowCost || 0) / 10;
  if (cost >= 11) return "legendary";
  if (cost >= 9) return "unique";
  if (cost >= 7) return "rare";
  return "common";
}

export function mapFplPlayerToCard(player: any, overrides: Partial<MarketplaceCardData> = {}): MarketplaceCardData {
  const playerName = String(player?.name || "Player").trim();
  const parts = playerName.split(/\s+/);
  const { firstName, lastName } = splitDisplayName(parts.slice(0, -1).join(" ") || parts[0] || "PLAYER", parts.slice(-1).join(" ") || "NAME");
  const last5 = Array.isArray(player?.last5Scores) && player.last5Scores.length ? player.last5Scores.slice(0, 5) : mapFormToBars(player?.form || 6.5);
  const teamCode = String(player?.team || "EPL").slice(0, 3).toUpperCase();
  const codeFromImage = (() => {
    const img = String(player?.photo || player?.imageUrl || "");
    const match = img.match(/p(\d+)\.png/i);
    return match ? Number(match[1]) : 0;
  })();

  return {
    id: Number(overrides.id ?? player?.id ?? 0),
    season: String(overrides.season ?? "2026-27"),
    firstName,
    lastName,
    teamId: Number(overrides.teamId ?? player?.teamId ?? 0),
    teamShortName: String(overrides.teamShortName ?? teamCode ?? teamShortNames[player?.teamId] ?? "EPL"),
    shirtNumber: Number(overrides.shirtNumber ?? player?.shirtNumber ?? 0),
    age: Number(overrides.age ?? player?.age ?? 24),
    country: String(overrides.country ?? player?.nationality ?? ""),
    average: Number(overrides.average ?? mapChanceToAverage(player?.pointsPerGame ?? player?.rating ?? 0, player?.form ?? 0)),
    last5: (overrides.last5 ?? last5).slice(0, 5),
    positionLabel: String(overrides.positionLabel ?? player?.position ?? "PLAYER").toUpperCase(),
    serial: String(overrides.serial ?? `${player?.id || 0}/999`),
    code: Number(overrides.code ?? codeFromImage ?? player?.code ?? 0),
    rarity: (overrides.rarity as MarketplaceRarity) ?? pickRarityFromCost(player?.nowCost ?? 70),
    imageUrl: String(overrides.imageUrl ?? player?.photo ?? player?.imageUrl ?? getFplImageUrl(codeFromImage || player?.code || 0)),
    seller: String(overrides.seller ?? "FantasyFC"),
    price: String(overrides.price ?? "0.00"),
  };
}

export function mapMarketplaceListingToCard(card: PlayerCardWithPlayer): MarketplaceCardData {
  const rarity = (card.rarity === "epic" ? "unique" : card.rarity) as MarketplaceRarity;
  const base = mapFplPlayerToCard(card.player || {}, {
    id: card.id,
    rarity,
    average: card.decisiveScore || Number(card.player?.rating || 0) || 70,
    last5: (card.last5Scores || []).length ? (card.last5Scores || []) : undefined,
    serial: `${card.serial || 1}/${card.maxSupply || 100}`,
    price: (card.price || 0).toFixed(2),
    seller: card.ownerUsername || card.ownerName || "FantasyFC",
  });

  return {
    ...base,
    teamShortName: String(base.teamShortName || teamShortNames[base.teamId] || "EPL"),
    imageUrl: card.player?.photo || card.player?.imageUrl || card.player?.image || base.imageUrl,
  };
}

type MarketplaceCardProps = {
  player: MarketplaceCardData;
  rarityLogo?: string;
  onCardClick?: () => void;
  onDetails?: () => void;
  onToggleWatchlist?: () => void;
  isWatched?: boolean;
};

export function MarketplaceCard({ player, rarityLogo, onCardClick, onDetails, onToggleWatchlist, isWatched = false }: MarketplaceCardProps) {
  const theme = rarityThemes[player.rarity] ?? rarityThemes.common;

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className={`relative h-[260px] w-[165px] overflow-hidden rounded-[24px] border ${theme.border} bg-[#090d17] ${theme.glow} ${onCardClick ? "cursor-pointer" : ""}`}
        onClick={onCardClick}
      >
        <div className="absolute inset-[3px] rounded-[21px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.09),_transparent_40%),linear-gradient(180deg,#101527_0%,#070b14_100%)]" />

        <div className="absolute inset-x-[10px] top-[9px] z-20 flex items-center justify-between text-[10px] font-black tracking-wide text-white/90">
          <span>{player.season}</span>
          <span>{player.teamShortName} #{player.shirtNumber || 0}</span>
        </div>

        <div className="absolute inset-x-[12px] top-[26px] h-[104px] overflow-hidden rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]">
          {rarityLogo ? (
            <img src={rarityLogo} alt="rarity background" className="absolute inset-0 h-full w-full object-cover opacity-28" />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.inner} opacity-30`} />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.1),_transparent_65%)]" />
          <img
            src={player.imageUrl || getFplImageUrl(player.code, "250x250")}
            alt={`${player.firstName} ${player.lastName}`}
            className="absolute bottom-0 left-1/2 z-10 h-[126px] w-[118px] -translate-x-1/2 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]"
            loading="lazy"
          />
        </div>

        <div className="absolute inset-x-[10px] top-[132px] z-20">
          <div className={`mx-auto flex h-[20px] w-full items-center justify-center rounded-full border text-[9px] font-black tracking-[0.22em] ${theme.badge}`}>
            {theme.label}
          </div>
        </div>

        <div className="absolute inset-x-[12px] top-[158px] rounded-[12px] border border-white/10 bg-black/55 px-[9px] py-[8px] backdrop-blur-[2px]">
          <div className="mb-[6px] flex items-center justify-between text-[7px] font-black uppercase tracking-[0.18em] text-white/65">
            <span>Last 5 Games</span>
            <span>Average Score</span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-end gap-[4px] pt-[6px]">
              {player.last5.slice(0, 5).map((value, idx) => (
                <div key={idx} className="w-[7px] rounded-full bg-pink-500" style={{ height: `${Math.max(6, Number(value || 0) * 0.13)}px` }} />
              ))}
            </div>
            <div className="flex h-[34px] w-[34px] flex-col items-center justify-center rounded-full border border-white/15 bg-white/6 text-white">
              <span className="text-[7px] font-bold text-white/60">AVG</span>
              <span className="text-[15px] font-black leading-none">{Math.round(player.average)}</span>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-[12px] bottom-[12px] z-20 text-white">
          <div className="truncate text-[10px] font-black tracking-wide">{player.firstName} {player.lastName}</div>
          <div className="mt-[2px] flex items-center justify-between text-[9px] font-semibold text-white/72">
            <span>Age {player.age}</span>
            <span>{nationShortNames[player.country] ?? String(player.country || "UNK").slice(0, 3).toUpperCase()}</span>
          </div>
          <div className="mt-[2px] flex items-center justify-between text-[8px] text-white/50">
            <span>Verified Holder</span>
            <span>{player.serial}</span>
          </div>
        </div>
      </motion.article>

      <div className="flex items-center gap-2">
        <button type="button" onClick={onDetails} className="text-sm font-semibold text-white/80 hover:text-white">Details</button>
        <button type="button" onClick={onToggleWatchlist} className="text-sm font-semibold text-white/70 hover:text-white" aria-label="Toggle watchlist">
          <Heart className={`h-4 w-4 ${isWatched ? "fill-current text-red-500" : "text-muted-foreground"}`} />
        </button>
      </div>
      <div className="text-center text-sm text-white/45">Seller: {player.seller}</div>
      <div className="text-center text-[18px] font-black text-emerald-400">N${player.price}</div>
    </div>
  );
}

type MarketplaceCardGridProps = {
  players: MarketplaceCardData[];
  onCardClick?: (player: MarketplaceCardData) => void;
  onDetails?: (player: MarketplaceCardData) => void;
  onToggleWatchlist?: (player: MarketplaceCardData) => void;
  watchedIds?: number[];
};

export function MarketplaceCardGrid({ players, onCardClick, onDetails, onToggleWatchlist, watchedIds = [] }: MarketplaceCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {players.map((player) => (
        <MarketplaceCard
          key={player.id}
          player={player}
          rarityLogo={rarityLogos[player.rarity]}
          onCardClick={onCardClick ? () => onCardClick(player) : undefined}
          onDetails={onDetails ? () => onDetails(player) : undefined}
          onToggleWatchlist={onToggleWatchlist ? () => onToggleWatchlist(player) : undefined}
          isWatched={watchedIds.includes(player.id)}
        />
      ))}
    </div>
  );
}
