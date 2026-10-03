import { Match, Dispute } from '../lib/match-contracts';
export const matchFixture = (status = 'READY'): Match => ({
  id: 'cmatch',
  challengeId: 'cchallenge',
  status,
  startedAt: status === 'READY' ? null : '2026-10-02T10:00:00Z',
  createdAt: '2026-10-02T09:00:00Z',
  participants: [
    {
      userId: 'ca',
      readyAt: null,
      user: { username: 'Amir', displayName: null },
    },
    {
      userId: 'cb',
      readyAt: null,
      user: { username: 'Samuel', displayName: null },
    },
  ],
  challenge: {
    id: 'cchallenge',
    game: { id: 'cg', name: 'FC 26' },
    platform: 'PS5',
    stakeAmount: 10,
    createdByUserId: 'ca',
  },
  results: [],
  vault: { balance: 20, status: 'LOCKED' },
  settlement: null,
});
export const resultFixture = {
  id: 'cr',
  status: 'PENDING',
  myScore: 4,
  opponentScore: 2,
  submittedByUserId: 'ca',
  winnerUserId: 'ca',
  disputes: [],
};
export const disputeFixture = (): Dispute => ({
  id: 'cd',
  matchId: 'cmatch',
  challengeId: 'cchallenge',
  game: { id: 'cg', name: 'FC 26' },
  status: 'REVIEW',
  reason: 'The score is incorrect.',
  createdAt: '2026-10-02T10:00:00Z',
  resolution: null,
  resolutionReason: null,
  players: [
    { id: 'ca', username: 'Amir', slot: 'PLAYER_A' },
    { id: 'cb', username: 'Samuel', slot: 'PLAYER_B' },
  ],
  proposedResult: {
    myScore: 4,
    opponentScore: 2,
    submittedByUserId: 'ca',
    proposedWinnerUserId: 'ca',
  },
  evidence: [],
  match: { ...matchFixture('DISPUTED'), results: [resultFixture] },
  timeline: [],
});
