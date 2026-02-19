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

export default function PlayerCard(props: PlayerCardProps) {
  const img =
    props.sorareImageUrl ||
    (props.card as any)?.player?.photo ||
    (props.card as any)?.player?.photoUrl ||
    (props.card as any)?.player?.imageUrl ||
    (props.card as any)?.player?.image_url ||
    null;

  return (
    <div
      onClick={props.onClick}
      className={`${props.selectable ? "cursor-pointer" : ""} ${
        props.selected ? "ring-2 ring-primary rounded-xl" : ""
      }`}
    >
      {/* ONLY render 3D when selected */}
      {props.selected ? (
        <ThreeDPlayerCard card={props.card} imageUrl={img} />
      ) : (
        <div className="w-[180px] h-[260px] rounded-xl overflow-hidden bg-[#1a1f2e] shadow-lg">
          {img ? (
            <img
              src={img}
              alt={props.card.player?.name}
              className="w-full h-full object-cover"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
