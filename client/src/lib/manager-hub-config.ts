import {
  DEPOSIT_FEE_FREE_THRESHOLD,
  MARKETPLACE_FEE_RATE,
  MIN_WITHDRAWAL_AMOUNT,
  SMALL_DEPOSIT_FEE_RATE,
  TOURNAMENT_ENTRY_BY_RARITY,
  TOURNAMENT_PLATFORM_FEE_RATE,
  WITHDRAWAL_FEE_RATE,
} from "../../../shared/card-economy";

export const CURRENCY = "N$";
export const LINEUP_CARD_LIMIT = 5;

export const managerHubRoutes = {
  dashboard: "/dashboard",
  liveLineup: "/live-lineup",
  tournaments: "/competitions",
  myTeam: "/collection",
  leagues: "/leagues",
  analytics: "/analytics",
  marketplace: "/marketplace",
  wallet: "/wallet",
  account: "/account",
  cardLab: "/card-lab",
} as const;

export const managerHubLabels = {
  dashboard: "Command Center",
  liveLineup: "5-Card Lineup",
  tournaments: "Tournaments",
  myTeam: "My Team",
  leagues: "Leagues",
  analytics: "Analytics",
  marketplace: "Marketplace",
  wallet: "Wallet",
  account: "Account",
  cardLab: "Card Lab",
} as const;

export const managerHubMoney = {
  currency: CURRENCY,
  marketplaceFeeRate: MARKETPLACE_FEE_RATE,
  tournamentPlatformFeeRate: TOURNAMENT_PLATFORM_FEE_RATE,
  depositFeeFreeThreshold: DEPOSIT_FEE_FREE_THRESHOLD,
  smallDepositFeeRate: SMALL_DEPOSIT_FEE_RATE,
  withdrawalFeeRate: WITHDRAWAL_FEE_RATE,
  minWithdrawalAmount: MIN_WITHDRAWAL_AMOUNT,
  tournamentEntryByRarity: TOURNAMENT_ENTRY_BY_RARITY,
} as const;

export function formatNad(amount: number | string | null | undefined) {
  const value = Number(amount || 0);
  return `${CURRENCY}${value.toLocaleString("en-NA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(rate: number) {
  return `${(Number(rate || 0) * 100).toFixed(Number(rate || 0) % 0.01 === 0 ? 0 : 1)}%`;
}

export const managerHubFeeCopy = {
  marketplace: `Marketplace seller fee is ${formatPercent(MARKETPLACE_FEE_RATE)} and all prices display in ${CURRENCY}.`,
  tournaments: `Tournament platform fee is ${formatPercent(TOURNAMENT_PLATFORM_FEE_RATE)}. Entry fees are ${CURRENCY}${TOURNAMENT_ENTRY_BY_RARITY.common} common, ${CURRENCY}${TOURNAMENT_ENTRY_BY_RARITY.rare} rare, ${CURRENCY}${TOURNAMENT_ENTRY_BY_RARITY.unique} unique and ${CURRENCY}${TOURNAMENT_ENTRY_BY_RARITY.legendary} legendary.`,
  deposits: `Deposits below ${CURRENCY}${DEPOSIT_FEE_FREE_THRESHOLD.toFixed(0)} are charged ${formatPercent(SMALL_DEPOSIT_FEE_RATE)}. Deposits at or above ${CURRENCY}${DEPOSIT_FEE_FREE_THRESHOLD.toFixed(0)} are free.`,
  withdrawals: `Withdrawals are charged ${formatPercent(WITHDRAWAL_FEE_RATE)} with a minimum withdrawal amount of ${CURRENCY}${MIN_WITHDRAWAL_AMOUNT.toFixed(0)}.`,
  noCrypto: "Fantasy Arena is configured for Namibian dollar balances only. Do not display crypto, ETH, coins or token wording in manager-facing pages.",
  lineup: `Lineup uses exactly ${LINEUP_CARD_LIMIT} selected cards. Do not show formations, pitch formations or 11-player football tactics controls.`,
} as const;

export const managerHubPageBlueprint = [
  {
    id: "dashboard",
    title: managerHubLabels.dashboard,
    route: managerHubRoutes.dashboard,
    purpose: "High-level command center with points, rank, N$ balance, recent activity and quick links.",
  },
  {
    id: "liveLineup",
    title: managerHubLabels.liveLineup,
    route: managerHubRoutes.liveLineup,
    purpose: `Live tactical board for exactly ${LINEUP_CARD_LIMIT} selected cards, captain, live deltas and selected-team alerts.`,
  },
  {
    id: "tournaments",
    title: managerHubLabels.tournaments,
    route: managerHubRoutes.tournaments,
    purpose: "Joined, available and completed tournaments with N$ prize pools, entry fees and leaderboard links.",
  },
  {
    id: "myTeam",
    title: managerHubLabels.myTeam,
    route: managerHubRoutes.myTeam,
    purpose: "Roster collection, filters and card actions linking to lineup, marketplace and card lab.",
  },
  {
    id: "marketplace",
    title: managerHubLabels.marketplace,
    route: managerHubRoutes.marketplace,
    purpose: "Trading floor with N$ buy/list prices, seller fees and wallet links.",
  },
  {
    id: "wallet",
    title: managerHubLabels.wallet,
    route: managerHubRoutes.wallet,
    purpose: "N$ deposits, withdrawals, fee structure and transaction history.",
  },
] as const;
