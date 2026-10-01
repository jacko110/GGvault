import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { discoverableStatuses } from '../challenges/challenges.dto';

export class ErrorResponse {
  @ApiProperty() statusCode!: number;
  @ApiProperty({ example: 'CHALLENGE_NOT_PARTICIPANT' }) code!: string;
  @ApiProperty() message!: string;
}
export class ProfileResponse {
  @ApiProperty({ nullable: true }) bio!: string | null;
  @ApiProperty({ nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ nullable: true }) countryCode!: string | null;
}
export class UserResponse {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) displayName!: string | null;
  @ApiProperty({ enum: ['USER', 'MODERATOR', 'ADMIN'] }) role!: string;
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'] })
  status!: string;
  @ApiProperty() emailVerified!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: ProfileResponse, nullable: true })
  profile!: ProfileResponse | null;
}
export class TokenResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ example: 900 }) expiresIn!: number;
  @ApiProperty({ example: 'Bearer' }) tokenType!: string;
}
export class RegistrationResponse extends TokenResponse {
  @ApiProperty({ type: UserResponse }) user!: UserResponse;
}
export class SuccessResponse {
  @ApiProperty() success!: boolean;
}
export class AccessResponse {
  @ApiProperty() allowed!: boolean;
}
export class GameAccountResponse {
  @ApiProperty() id!: string;
  @ApiProperty() gameId!: string;
  @ApiProperty() platform!: string;
  @ApiProperty() gamertag!: string;
}
export class ParticipantUserResponse {
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) displayName!: string | null;
}
export class ParticipantResponse {
  @ApiProperty() userId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() joinedAt!: string;
  @ApiProperty({ type: ParticipantUserResponse })
  user!: ParticipantUserResponse;
}
export class ChallengeMatchResponse {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
}
export class ChallengeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() gameId!: string;
  @ApiProperty() creatorId!: string;
  @ApiProperty({ enum: discoverableStatuses })
  status!: string;
  @ApiProperty() stakeAmount!: number;
  @ApiProperty({ enum: ['TEST'] }) currency!: string;
  @ApiProperty() platform!: string;
  @ApiProperty({ enum: ['1v1'] }) mode!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: [ParticipantResponse] }) players!: ParticipantResponse[];
  @ApiProperty({ type: [ChallengeMatchResponse] })
  matches!: ChallengeMatchResponse[];
}
export class ChallengePageResponse {
  @ApiProperty({ type: [ChallengeResponse] }) items!: ChallengeResponse[];
  @ApiPropertyOptional({ type: String, nullable: true }) nextCursor!:
    string | null;
}
export class FundingResponse {
  @ApiProperty({ type: ChallengeResponse }) challenge!: ChallengeResponse;
  @ApiProperty({ type: ParticipantResponse }) player!: ParticipantResponse;
  @ApiProperty() vaultBalance!: number;
}
