import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDisputeDto {
  @ApiProperty({
    description: 'ID of the DRAFT certificate requiring correction',
  })
  @IsString()
  @IsNotEmpty()
  certificate_id: string;

  @ApiProperty({
    description: 'Reason for correction request (minimum 10 characters)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Lý do phải có ít nhất 10 ký tự' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Additional details or correct information',
  })
  @IsString()
  @IsOptional()
  details?: string;
}
