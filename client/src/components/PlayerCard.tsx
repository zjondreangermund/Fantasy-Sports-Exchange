import ThreeDPlayerCard from "./threeplayercards";
import { type PlayerCardWithPlayer } from "../../../shared/schema";

interface PlayerCardProps {
  card: PlayerCardWithPlayer;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  sorareImageUrl?: string | null;
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
  if (r === "legendary") return "/assets/patterns/legendary.png";
  if (r === "unique") return "/assets/patterns/unique.png";
  if (r === "rare") return "/assets/patterns/rare.png";
  return "/assets/patterns/common.png";
}

export default function PlayerCard(props: PlayerCardProps) {
  const player: any = (props.card as any)?.player ?? {};

  const img =
    props.sorareImageUrl ||
    player.photo ||
    player.photoUrl ||
    player.imageUrl ||
    player.image_url ||
    null;

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
      className={`select-none ${props.selectable ? "cursor-pointer" : ""} ${
        props.selected ? "ring-2 ring-primary rounded-xl" : ""
      }`}
    >
      {/* ✅ 3D only when selected */}
      {props.selected ? (
        <ThreeDPlayerCard card={props.card} imageUrl={img} />
      ) : (
        <div className={`${frame} relative rounded-xl overflow-hidden bg-[#0b0f1a] shadow-lg border border-white/10`}>
          {/* rarity pattern background */}
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage: `url(${pattern})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />

          {/* image */}
          {img ? (
            <img
              src={img}
              alt={player?.name ?? "Player"}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/60" />
          )}

          {/* dark fade for text */}
          <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

          {/* top row: rarity + club logo */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
            <div
              className={`px-2 py-1 text-[11px] font-extrabold tracking-wide rounded-md border ${rarityChipClasses(
                rarity,
              )}`}
            >
              {rarityLabel(rarity)}
            </div>

            {clubLogo ? (
              <img src={clubLogo} alt="Club" className="w-9 h-9 object-contain drop-shadow" />
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
