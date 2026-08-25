import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetaMaskRegisterDto {
  @ApiProperty({
    example: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    description: 'Ethereum wallet address of the user',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Invalid Ethereum address format',
  })
  walletAddress!: string;

  @ApiProperty({
    example: '0x30755a5c...',
    description:
      'Cryptographic signature from MetaMask signing the challenge message',
  })
  @IsString()
  signature!: string;

  @ApiProperty({
    example: 'eyJhbGciOi...',
    description:
      'Temporary JWT token containing challenge details issued by /auth/metamask/nonce',
  })
  @IsString()
  tempToken!: string;

  @ApiProperty({
    example: 'truongthpt@edu.vn',
    description:
      'Email of the school/organization (used for notifications and identifier)',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @ApiProperty({
    example: 'Trường THPT Mặc Định',
    description: 'Name of the school / organization',
  })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'Name of the administrator (defaults to name if not provided)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Admin name must be at least 2 characters' })
  @MaxLength(255, { message: 'Admin name must not exceed 255 characters' })
  adminName?: string;
}
