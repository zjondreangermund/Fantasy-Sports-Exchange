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
  // Use the name you imported from threeplayercards
  return (
    <div 
      onClick={props.onClick} 
      className={`${props.selectable ? 'cursor-pointer' : ''} ${props.selected ? 'ring-2 ring-primary rounded-xl' : ''}`}
    >
      <ThreeDPlayerCard card={props.card} />
    </div>
  );
}
