import React from 'react';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | string;

type RarityCardProps = {
  rarity: Rarity;
  rating: number | string;
  playerImage?: string;
  stats?: unknown;
  clubInfo?: string;
  serialNumber?: number | string;
};

const RarityCard = ({
  rarity,
  rating,
  playerImage,
  stats,
  clubInfo,
  serialNumber,
}: RarityCardProps) => {
  const getCardStyle = (): React.CSSProperties => {
    switch (rarity) {
      case 'common':
        return { border: '1px solid gray' };
      case 'rare':
        return { border: '1px solid blue' };
      case 'epic':
        return { border: '1px solid purple' };
      case 'legendary':
        return { border: '1px solid gold' };
      default:
        return {};
    }
  };

  return (
    <div style={getCardStyle()} className="rarity-card">
      {playerImage ? <img src={playerImage} alt="Player" /> : null}
      <h3>{rarity.charAt(0).toUpperCase() + rarity.slice(1)} Card</h3>
      <p>Rating: {rating}</p>
      <p>Stats: {JSON.stringify(stats ?? {})}</p>
      <p>Club: {clubInfo || 'N/A'}</p>
      <p>Serial Number: {serialNumber ?? 'N/A'}</p>
    </div>
  );
};

export default RarityCard;
