import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'amir@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 10, maxLength: 128, writeOnly: true })
  @IsString()
  @Length(10, 128)
  password!: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({ pattern: '^[a-zA-Z0-9_]{3,32}$' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9_]{3,32}$/)
  username!: string;
}

export class RefreshDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @Matches(/^[a-f0-9]{96}$/)
  refreshToken!: string;
}

export class EmptyDto {}
