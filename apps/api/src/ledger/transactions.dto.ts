import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
export class TransactionQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,128}$/)
  cursor?: string;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
export class UserTransactionResponse {
  @ApiProperty() id!: string;
  @ApiProperty() timestamp!: string;
  @ApiProperty({ example: 'MATCH_WIN' }) type!: string;
  @ApiProperty({ example: 19 }) amount!: number;
  @ApiProperty({ type: String, nullable: true }) challengeId!: string | null;
  @ApiProperty({ type: String, nullable: true }) matchId!: string | null;
  @ApiProperty() description!: string;
}
export class TransactionPageResponse {
  @ApiProperty({ type: [UserTransactionResponse] })
  items!: UserTransactionResponse[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
