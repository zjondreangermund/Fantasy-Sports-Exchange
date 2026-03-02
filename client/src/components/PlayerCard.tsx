import ThreeDPlayerCard from "./threeplayercards";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

interface PlayerCardProps {
  card?: PlayerCardWithPlayer;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  sorareImageUrl?: string | null;
}

function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function resolvePlayerImageUrl(card: any, player: any, sorareImageUrl?: string | null): string | null {
  const playerId = Number(card?.playerId ?? player?.id);
  const idPhotoUrl = Number.isFinite(playerId) && playerId > 0 ? `/api/players/${playerId}/photo` : null;

  const directCandidates = [
    sorareImageUrl,
    player?.imageUrl,
    player?.image_url,
    player?.photo,
    player?.photoUrl,
    player?.avatarImageUrl,
    player?.pictureUrl,
  ].map((value) => normalizeImageUrl(value));

  return [idPhotoUrl, ...directCandidates].find((value): value is string => Boolean(value)) ?? null;
}

function fallbackImageCandidates(card: any, player: any) {
  const seed = Number(card?.playerId ?? player?.id ?? card?.id ?? 1) || 1;
  const index = ((seed % 6) + 6) % 6;
  const ordered = [
    `/images/player-${index + 1}.png`,
    "/images/player-1.png",
    "/images/player-2.png",
    "/images/player-3.png",
    "/images/player-4.png",
    "/images/player-5.png",
    "/images/player-6.png",
  ];
  return Array.from(new Set(ordered));
}

function rarityLabel(rarity?: string) {
  const r = (rarity ?? "common").toLowerCase();
  if (r === "legendary") return "LEGENDARY";
  if (r === "unique") return "UNIQUE";
  if (r === "rare") return "RARE";
  return "COMMON";
}

function rarityChipClasses(rarity?: string) {
  const r = (rarity ?? "common").toLowerCase();
  if (r === "legendary") return "bg-yellow-500/20 text-yellow-200 border-yellow-400/40";
  if (r === "unique") return "bg-purple-500/20 text-purple-200 border-purple-400/40";
  if (r === "rare") return "bg-red-500/20 text-red-200 border-red-400/40";
  return "bg-slate-300/10 text-slate-200 border-slate-300/20";
}

function rarityPatternUrl(rarity?: string) {
  const r = (rarity ?? "common").toLowerCase();
  if (r === "legendary") return "/assets/patterns/legendary.svg";
  if (r === "unique") return "/assets/patterns/unique.svg";
  if (r === "rare") return "/assets/patterns/rare.svg";
  return "/assets/patterns/common.svg";
}

export default function PlayerCard(props: PlayerCardProps) {
  if (!props.card) return null;
  const player: any = (props.card as any)?.player ?? {};

  const playerImageUrl = resolvePlayerImageUrl(props.card, player, props.sorareImageUrl);
  const fallbackImages = fallbackImageCandidates(props.card, player);

  const clubLogo =
    player.clubLogo ||
    player.club_logo ||
    player.teamLogo ||
    player.team_logo ||
    null;

  const clubName = player.club || player.team || "";

  const rarity = (props.card as any)?.rarity ?? "common";
  const serialNumber = (props.card as any)?.serialNumber ?? (props.card as any)?.serial_number ?? 1;
  const maxSupply = (props.card as any)?.maxSupply ?? (props.card as any)?.max_supply ?? 100;

  const frame =
    props.size === "sm"
      ? "w-[140px] h-[210px]"
      : props.size === "lg"
      ? "w-[220px] h-[320px]"
      : "w-[180px] h-[260px]";

  const pattern = rarityPatternUrl(rarity);

  return (
    <div
      onClick={props.onClick}
      className={`select-none ${props.selectable ? "cursor-pointer" : ""}`}
    >
      <div className={`${frame} relative rounded-xl overflow-hidden shadow-lg ${props.selected ? "border-0" : "border border-white/10"}`} style={{background: "transparent"}}>
        {props.selected ? (
          // ✅ 3D fills the same frame (no layout zoom)
          <div className="absolute inset-0">
            <ThreeDPlayerCard card={props.card} imageUrl={playerImageUrl} />
          </div>
        ) : (
          <>
            {/* rarity pattern */}
            <div
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage: `url(${pattern})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />

            {/* image */}
            {playerImageUrl ? (
              <img
                src={playerImageUrl}
                alt={player?.name ?? "Player"}
                className="absolute inset-0 w-full h-full object-cover bg-transparent"
                data-fallback-step="0"
                onError={(e) => {
                  const current = Number(e.currentTarget.dataset.fallbackStep || "0");
                  const next = fallbackImages[current];
                  if (next) {
                    e.currentTarget.dataset.fallbackStep = String(current + 1);
                    e.currentTarget.src = next;
                  }
                }}
              />
            ) : (
              <img
                src={fallbackImages[0]}
                alt={player?.name ?? "Player"}
                className="absolute inset-0 w-full h-full object-cover bg-transparent"
                data-fallback-step="1"
                onError={(e) => {
                  const current = Number(e.currentTarget.dataset.fallbackStep || "1");
                  const next = fallbackImages[current];
                  if (next) {
                    e.currentTarget.dataset.fallbackStep = String(current + 1);
                    e.currentTarget.src = next;
                  }
                }}
              />
            )}

            {/* dark fade */}
            <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

            {/* top: rarity + club logo */}
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
              <div className={`px-2 py-1 text-[11px] font-extrabold tracking-wide rounded-md border ${rarityChipClasses(rarity)}`}>
                {rarityLabel(rarity)}
              </div>

              {clubLogo ? (
                <img
                  src={normalizeImageUrl(clubLogo) || ""}
                  alt="Club"
                  className="w-9 h-9 object-contain drop-shadow"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
            </div>

            {/* bottom text */}
            <div className="absolute bottom-2 left-2 right-2">
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-white font-extrabold text-sm leading-tight truncate">
                    {(player?.name ?? "PLAYER").toUpperCase()}
                  </div>
                  <div className="text-white/80 text-xs font-semibold truncate">
                    {(player?.position ?? "").toUpperCase()}
                    {clubName ? <span className="text-white/60">{" • "}{String(clubName).toUpperCase()}</span> : null}
                  </div>
                </div>

                <div className="text-white/90 text-xs font-extrabold">
                  {serialNumber}/{maxSupply}
                </div>
                {/* Price display removed from card */}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
