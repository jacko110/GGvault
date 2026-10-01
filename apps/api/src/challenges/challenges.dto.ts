import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { platforms } from '../users/users.dto';

export const discoverableStatuses = [
  'OPEN',
  'JOINED',
  'FUNDED',
  'IN_PROGRESS',
  'RESULT_SUBMITTED',
  'CONFIRMED',
  'DISPUTED',
  'CANCELLED',
  'EXPIRED',
] as const;

export class CreateChallengeDto {
  @ApiProperty() @Matches(/^c[a-z0-9]{24}$/) gameId!: string;
  @ApiProperty({ minimum: 1, maximum: 1000000000 })
  @IsInt()
  @Min(1)
  @Max(1000000000)
  stakeAmount!: number;
  @ApiProperty({ enum: ['TEST'] }) @IsIn(['TEST']) currency!: string;
  @ApiProperty({ enum: platforms }) @IsIn(platforms) platform!: string;
  @ApiProperty({ enum: ['1v1'] }) @IsIn(['1v1']) mode!: string;
}
export class DiscoverDto {
  @ApiPropertyOptional({
    enum: discoverableStatuses,
  })
  @IsOptional()
  @IsIn(discoverableStatuses)
  status?: (typeof discoverableStatuses)[number];
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^c[a-z0-9]{24}$/)
  gameId?: string;
  @ApiPropertyOptional({ enum: platforms })
  @IsOptional()
  @IsIn(platforms)
  platform?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000000)
  minimumStake?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000000)
  maximumStake?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^c[a-z0-9]{24}$/)
  cursor?: string;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
