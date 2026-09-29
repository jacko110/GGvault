import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export const platforms = [
  'PC',
  'PS5',
  'PS4',
  'XBOX_SERIES',
  'XBOX_ONE',
  'SWITCH',
  'MOBILE',
] as const;
export class IdDto {
  @ApiProperty()
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/)
  id!: string;
}
export class ProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  displayName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;
}
export class GameAccountDto {
  @ApiProperty()
  @Matches(/^c[a-z0-9]{24}$/)
  gameId!: string;
  @ApiProperty({ enum: platforms })
  @IsIn(platforms)
  platform!: string;
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  @Matches(/^\S(?:.*\S)?$/)
  gamertag!: string;
}
