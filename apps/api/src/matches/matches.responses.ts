import { ApiProperty } from '@nestjs/swagger';
export class ReadyResponse {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, nullable: true }) readyAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) startedAt!: string | null;
}
export class DisputeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() reason!: string;
  @ApiProperty({ example: 'REVIEW' }) status!: string;
  @ApiProperty() raisedByUserId!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: String, nullable: true }) resolution!: string | null;
  @ApiProperty({ type: String, nullable: true }) resolutionReason!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) resolvedByUserId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) resolvedAt!: string | null;
}
export class ResultResponse {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: [
      'PENDING',
      'CONFIRMED',
      'DISPUTED',
      'RESOLVED',
      'SETTLED',
      'REFUNDED',
    ],
  })
  status!: string;
  @ApiProperty() myScore!: number;
  @ApiProperty() opponentScore!: number;
  @ApiProperty({
    description:
      'Server-derived winner; null after a void. Original proposed scores remain recorded.',
    nullable: true,
    type: String,
  })
  winnerUserId!: string | null;
  @ApiProperty() submittedByUserId!: string;
  @ApiProperty() submittedAt!: string;
}
export class RoomResultResponse extends ResultResponse {
  @ApiProperty({ type: Number, nullable: true }) vaultAmount!: number | null;
  @ApiProperty({ type: Number, nullable: true }) winnerAmount!: number | null;
  @ApiProperty({ type: Number, nullable: true }) platformFee!: number | null;
  @ApiProperty({ type: String, nullable: true }) settledAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) confirmedByUserId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) confirmedAt!: string | null;
  @ApiProperty({ type: [DisputeResponse] }) disputes!: DisputeResponse[];
}
export class SettlementWinnerResponse {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
}
export class SettlementResponse {
  @ApiProperty() matchId!: string;
  @ApiProperty({ enum: ['SETTLED', 'REFUNDED'] }) status!: string;
  @ApiProperty({ type: SettlementWinnerResponse, nullable: true })
  winner!: SettlementWinnerResponse | null;
  @ApiProperty({ example: 20, nullable: true, type: Number }) vaultAmount!:
    number | null;
  @ApiProperty({ example: 19, nullable: true, type: Number }) winnerAmount!:
    number | null;
  @ApiProperty({ example: 1, nullable: true, type: Number }) platformFee!:
    number | null;
}
export class DecisionResponse {
  @ApiProperty() matchId!: string;
  @ApiProperty() resultId!: string;
  @ApiProperty({ enum: ['SETTLED', 'DISPUTED'] }) status!: string;
  @ApiProperty({ type: SettlementResponse, nullable: true })
  settlement!: SettlementResponse | null;
}
export class EvidenceResponse {
  @ApiProperty() id!: string;
  @ApiProperty() matchId!: string;
  @ApiProperty() uploadedByUserId!: string;
  @ApiProperty({ enum: ['SCREENSHOT', 'VIDEO'] }) type!: string;
  @ApiProperty() originalFilename!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() size!: number;
  @ApiProperty() sha256!: string;
  @ApiProperty() createdAt!: string;
}
export class TimelineResponse {
  @ApiProperty() id!: string;
  @ApiProperty() sequence!: number;
  @ApiProperty() type!: string;
  @ApiProperty({ type: String, nullable: true }) actorUserId!: string | null;
  @ApiProperty() createdAt!: string;
}
class ParticipantName {
  @ApiProperty() username!: string;
  @ApiProperty({ type: String, nullable: true }) displayName!: string | null;
}
export class MatchParticipantResponse {
  @ApiProperty() userId!: string;
  @ApiProperty({ type: String, nullable: true }) readyAt!: string | null;
  @ApiProperty({ type: ParticipantName }) user!: ParticipantName;
}
class GameResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}
export class MatchChallengeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiProperty() platform!: string;
  @ApiProperty() stakeAmount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() createdByUserId!: string;
  @ApiProperty({ type: GameResponse }) game!: GameResponse;
}
class VaultResponse {
  @ApiProperty() balance!: number;
  @ApiProperty({ enum: ['LOCKED', 'SETTLED', 'REFUNDED'] }) status!: string;
}
export class MatchRoomResponse {
  @ApiProperty({ type: SettlementResponse, nullable: true })
  settlement!: SettlementResponse | null;
  @ApiProperty() id!: string;
  @ApiProperty() challengeId!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, nullable: true }) startedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: [MatchParticipantResponse] })
  participants!: MatchParticipantResponse[];
  @ApiProperty({ type: MatchChallengeResponse })
  challenge!: MatchChallengeResponse;
  @ApiProperty({ type: [RoomResultResponse] }) results!: RoomResultResponse[];
  @ApiProperty({ type: VaultResponse }) vault!: VaultResponse;
}
