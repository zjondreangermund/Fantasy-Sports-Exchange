import type { CardProfileData } from '../components/cards/CardProfileModal';

// The profile endpoint resolves provider identity for this exact card. Raw
// collection image URLs alone cannot authorize a verified player portrait.
export function commonCollectionPortraitCard(
  card: {id:number;name:string},
  profile?: Pick<CardProfileData,'source'|'player'>,
) {
  const verified=profile?.source==='api-football'||profile?.source==='fpl-live';
  const player=verified?profile?.player:undefined;
  return {
    id:card.id,
    player:{
      ...player,
      name:player?.name||card.name,
      identityVerified:verified,
      identitySource:verified?(profile?.source==='api-football'?'api-football':'fpl'):null,
    },
  };
}
