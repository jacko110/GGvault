export interface MatchCandidate {
  playerId: string;
  rating: number;
}

export function scoreMatch(candidates: MatchCandidate[]): MatchCandidate[] {
  return [...candidates].sort((a, b) => b.rating - a.rating);
}
