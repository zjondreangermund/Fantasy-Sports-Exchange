// Game Rules Constants

export const XP_SCORING_MAPPING = {
    Goal: 100,
    Assist: 60,
    Clean_Sheet: 50,
};

export const STAT_MULTIPLIERS = {
    Common: 1.0,
    Rare: 1.1,
    Unique: 1.2,
    Epic: 1.35,
    Legendary: 1.5,
};

export const MARKETPLACE_PRICE_LIMITS = {
    Rare: { min: 5, max: 500 },
    Unique: { min: 100, max: 2000 },
    Epic: { min: 500, max: 5000 },
    Legendary: { min: 2000, max: 10000 },
};

export const TRADE_RATE_LIMITING = {
    sells_per_24h: 5,
    buys_swaps_per_24h: 10,
};