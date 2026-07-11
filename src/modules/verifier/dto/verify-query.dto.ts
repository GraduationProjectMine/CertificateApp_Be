import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyQueryDto {
  @ApiProperty({
    description: 'Serial number (Số hiệu) of the certificate',
    example: 'B2026/001',
  })
  @IsString()
  @IsNotEmpty()
  serialNumber: string;

  @ApiProperty({
    description: 'Registry number (Số vào sổ cấp bằng) of the certificate',
    example: '2026/001',
  })
  @IsString()
  @IsNotEmpty()
  registryNumber: string;
}
