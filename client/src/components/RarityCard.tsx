import React from 'react';

const RarityCard = ({ rarity, rating, playerImage, stats, clubInfo, serialNumber }) => {
    const getCardStyle = () => {
        switch (rarity) {
            case 'common': return { border: '1px solid gray' };
            case 'rare': return { border: '1px solid blue' };
            case 'epic': return { border: '1px solid purple' };
            case 'legendary': return { border: '1px solid gold' };
            default: return {};
        }
    };

    return (
        <div style={getCardStyle()} className="rarity-card">
            <img src={playerImage} alt="Player" />
            <h3>{rarity.charAt(0).toUpperCase() + rarity.slice(1)} Card</h3>
            <p>Rating: {rating}</p>
            <p>Stats: {JSON.stringify(stats)}</p>
            <p>Club: {clubInfo}</p>
            <p>Serial Number: {serialNumber}</p>
        </div>
    );
};

export default RarityCard;