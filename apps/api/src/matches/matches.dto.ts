import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class ResultDto {
  @ApiProperty({ minimum: 0, maximum: 100000 })
  @IsInt()
  @Min(0)
  @Max(100000)
  myScore!: number;
  @ApiProperty({ minimum: 0, maximum: 100000 })
  @IsInt()
  @Min(0)
  @Max(100000)
  opponentScore!: number;
}
export class DisputeDto {
  @ApiProperty({ minLength: 5, maxLength: 2000 })
  @IsString()
  @Length(5, 2000)
  @Matches(/\S/)
  reason!: string;
}
export class EvidenceDto {
  @ApiProperty({ enum: ['SCREENSHOT', 'VIDEO'] })
  @IsIn(['SCREENSHOT', 'VIDEO'])
  type!: 'SCREENSHOT' | 'VIDEO';
}
export class EvidenceParams {
  @ApiProperty() @Matches(/^c[a-z0-9]{24}$/) id!: string;
  @ApiProperty() @Matches(/^c[a-z0-9]{24}$/) evidenceId!: string;
}
