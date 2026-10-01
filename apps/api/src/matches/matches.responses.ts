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
}
export class ResultResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['PENDING', 'CONFIRMED', 'DISPUTED'] }) status!: string;
  @ApiProperty() myScore!: number;
  @ApiProperty() opponentScore!: number;
  @ApiProperty({
    description:
      'Proposed winner before confirmation; never triggers settlement.',
  })
  winnerUserId!: string;
  @ApiProperty() submittedByUserId!: string;
  @ApiProperty() submittedAt!: string;
}
export class RoomResultResponse extends ResultResponse {
  @ApiProperty({ type: String, nullable: true }) confirmedByUserId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) confirmedAt!: string | null;
  @ApiProperty({ type: [DisputeResponse] }) disputes!: DisputeResponse[];
}
export class DecisionResponse {
  @ApiProperty() matchId!: string;
  @ApiProperty() resultId!: string;
  @ApiProperty({ enum: ['CONFIRMED', 'DISPUTED'] }) status!: string;
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
class MatchParticipantResponse {
  @ApiProperty() userId!: string;
  @ApiProperty({ type: String, nullable: true }) readyAt!: string | null;
  @ApiProperty({ type: ParticipantName }) user!: ParticipantName;
}
class GameResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}
class MatchChallengeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiProperty() platform!: string;
  @ApiProperty() stakeAmount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty({ type: GameResponse }) game!: GameResponse;
}
class VaultResponse {
  @ApiProperty() balance!: number;
  @ApiProperty({ enum: ['LOCKED'] }) status!: string;
}
export class MatchRoomResponse {
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
