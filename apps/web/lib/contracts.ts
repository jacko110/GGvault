// Safe response shapes from the Nest OpenAPI contracts; no ledger account or token types are public.
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  createdAt: string;
  profile: {
    bio: string | null;
    countryCode: string | null;
    avatarUrl: string | null;
  } | null;
}
export interface Game {
  id: string;
  name: string;
  slug: string;
}
export interface GameAccount {
  id: string;
  gameId: string;
  platform: string;
  gamertag: string;
}
export interface Player {
  userId: string;
  status: string;
  user: { username: string; displayName: string | null };
}
export interface Challenge {
  id: string;
  gameId: string;
  creatorId: string;
  stakeAmount: number;
  currency: 'TEST';
  platform: string;
  mode: string;
  status: string;
  createdAt: string;
  players: Player[];
  matches: { id: string; status: string }[];
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
export interface Funding {
  challenge: Challenge;
  player: Player;
  vaultBalance: number;
}
export interface Transaction {
  id: string;
  timestamp: string;
  type: string;
  amount: number;
  challengeId: string | null;
  matchId: string | null;
  description: string;
}
export const platforms = [
  'PC',
  'PS5',
  'PS4',
  'XBOX_SERIES',
  'XBOX_ONE',
  'SWITCH',
  'MOBILE',
];
export const platformName = (value: string) => value.replaceAll('_', ' ');
export const credits = (amount: number) =>
  new Intl.NumberFormat('en').format(amount);
export const funded = (player: Player) =>
  ['FUNDED', 'LOCKED'].includes(player.status);
