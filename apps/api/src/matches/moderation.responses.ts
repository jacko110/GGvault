import { ApiProperty, OmitType } from '@nestjs/swagger';
import {
  EvidenceResponse,
  MatchRoomResponse,
  SettlementResponse,
  TimelineResponse,
} from './matches.responses';
class ModerationPlayer {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiProperty({ enum: ['PLAYER_A', 'PLAYER_B'] }) slot!: string;
}
class ProposedResult {
  @ApiProperty({ type: Number, nullable: true }) myScore!: number | null;
  @ApiProperty({ type: Number, nullable: true }) opponentScore!: number | null;
  @ApiProperty({ type: String, nullable: true }) submittedByUserId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) proposedWinnerUserId!:
    string | null;
}
export class ModerationDisputeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() matchId!: string;
  @ApiProperty() challengeId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() reason!: string;
  @ApiProperty() raisedByUserId!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: String, nullable: true }) resolution!: string | null;
  @ApiProperty({ type: String, nullable: true }) resolutionReason!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) resolvedByUserId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) resolvedAt!: string | null;
  @ApiProperty({ type: [ModerationPlayer] }) players!: ModerationPlayer[];
  @ApiProperty({ type: ProposedResult, nullable: true })
  proposedResult!: ProposedResult | null;
  @ApiProperty({ type: [EvidenceResponse] }) evidence!: EvidenceResponse[];
}
export class DisputePageResponse {
  @ApiProperty({ type: [ModerationDisputeResponse] })
  items!: ModerationDisputeResponse[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
class AuditEventResponse {
  @ApiProperty() id!: string;
  @ApiProperty() action!: string;
  @ApiProperty({ type: String, nullable: true }) userId!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty({
    type: Object,
    nullable: true,
    description: 'Safe matchId/challengeId/disputeId/resolution context only',
  })
  metadata!: object | null;
}
class ModerationMatchResponse extends OmitType(MatchRoomResponse, [
  'vault',
] as const) {
  @ApiProperty({ type: [EvidenceResponse] }) evidence!: EvidenceResponse[];
}
export class DisputeDetailResponse extends ModerationDisputeResponse {
  @ApiProperty({ type: ModerationMatchResponse })
  match!: ModerationMatchResponse;
  @ApiProperty({ type: [TimelineResponse] }) timeline!: TimelineResponse[];
  @ApiProperty({ type: [AuditEventResponse] })
  auditEvents!: AuditEventResponse[];
}
export class ResolutionResponse {
  @ApiProperty() disputeId!: string;
  @ApiProperty({ enum: ['PLAYER_A_WINS', 'PLAYER_B_WINS', 'VOID_MATCH'] })
  resolution!: string;
  @ApiProperty({ enum: ['RESOLVED'] }) status!: string;
  @ApiProperty({ type: SettlementResponse }) settlement!: SettlementResponse;
}
