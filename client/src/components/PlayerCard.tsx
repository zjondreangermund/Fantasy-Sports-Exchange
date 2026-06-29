import CollectionPlayerCard from "./CollectionPlayerCard";
import Card3D from "./Card3D";
import PremiumFootballCard from "./PremiumFootballCard";
import { type PlayerCardWithPlayer } from "../../../shared/schema";
import type { CardSize } from "./premium-card-theme";

interface PlayerCardProps {
  card: PlayerCardWithPlayer;
  size?: CardSize;
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  sorareImageUrl?: string | null;
  /** Show BUY / SELL / LOAN action row (collection / marketplace) */
  showActions?: boolean;
  showBuy?: boolean;
  onBuy?: (card: PlayerCardWithPlayer) => void;
  onSell?: (card: PlayerCardWithPlayer) => void;
  onLoan?: (card: PlayerCardWithPlayer) => void;
}

export default function PlayerCard(props: PlayerCardProps) {
  const player: Record<string, unknown> = (props.card as { player?: Record<string, unknown> }).player ?? {};
  const img =
    props.sorareImageUrl ||
    (player.photo as string) ||
    (player.photoUrl as string) ||
    (player.imageUrl as string) ||
    (player.image_url as string) ||
    null;

  if (props.showActions) {
    return (
      <CollectionPlayerCard
        card={props.card}
        size={props.size}
        selected={props.selected}
        selectable={props.selectable}
        showActions
        showBuy={props.showBuy}
        imageUrl={img}
        sorareImageUrl={props.sorareImageUrl}
        onClick={props.onClick}
        onBuy={props.onBuy}
        onSell={props.onSell}
        onLoan={props.onLoan}
      />
    );
  }

  return (
    <Card3D
      onClick={props.onClick}
      disabled={!props.selectable && !props.onClick}
      className={props.selectable ? "cursor-pointer" : ""}
    >
      <PremiumFootballCard
        card={props.card}
        size={props.size ?? "md"}
        imageUrl={img}
      />
    </Card3D>
  );
}
