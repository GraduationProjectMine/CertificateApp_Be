import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MetaMaskNonceDto {
  @ApiProperty({
    example: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    description: 'Ethereum wallet address of the user',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Invalid Ethereum address format',
  })
  walletAddress!: string;
}
