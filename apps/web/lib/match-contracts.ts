export interface MatchPlayer {
  userId: string;
  readyAt: string | null;
  user: { username: string; displayName: string | null };
}
export interface Result {
  id: string;
  status: string;
  myScore: number;
  opponentScore: number;
  submittedByUserId: string;
  winnerUserId: string | null;
  disputes: {
    id: string;
    reason: string;
    status: string;
    resolution: string | null;
    resolutionReason: string | null;
  }[];
}
export interface Settlement {
  status: string;
  winner: { id: string; username: string } | null;
  vaultAmount: number | null;
  platformFee: number | null;
  winnerAmount: number | null;
}
export interface Match {
  id: string;
  challengeId: string;
  status: string;
  startedAt: string | null;
  createdAt: string;
  participants: MatchPlayer[];
  challenge: {
    id: string;
    game: { id: string; name: string };
    platform: string;
    stakeAmount: number;
    createdByUserId: string;
  };
  results: Result[];
  vault: { balance: number; status: string };
  settlement: Settlement | null;
}
export interface MatchSummary {
  id: string;
  status: string;
  game: string;
  platform: string;
  stakeAmount: number;
  players: string[];
  createdAt: string;
}
export interface Evidence {
  id: string;
  matchId: string;
  uploadedByUserId: string;
  type: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}
export interface TimelineEvent {
  id: string;
  sequence: number;
  type: string;
  actorUserId: string | null;
  createdAt: string;
}
export interface Refund {
  userId: string;
  amount: number;
}
export interface Dispute {
  id: string;
  matchId: string;
  challengeId: string;
  game: { id: string; name: string };
  status: string;
  reason: string;
  createdAt: string;
  resolution: string | null;
  resolutionReason: string | null;
  players: { id: string; username: string; slot: string }[];
  proposedResult: {
    myScore: number;
    opponentScore: number;
    submittedByUserId: string;
    proposedWinnerUserId: string;
  } | null;
  evidence: Evidence[];
  match: Match;
  timeline: TimelineEvent[];
}
export const matchLabels: Record<string, string> = {
  READY: 'Ready',
  IN_PROGRESS: 'In progress',
  RESULT_SUBMITTED: 'Waiting confirmation',
  DISPUTED: 'Under review',
  SETTLED: 'Settled',
  REFUNDED: 'Refunded',
  REVIEW: 'Under review',
  OPEN: 'Open',
  RESOLVED: 'Resolved',
};
