import { IsString, IsNotEmpty, IsIn, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewDisputeDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'], description: 'Review decision' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Reviewer notes or reason for rejection' })
  @IsString()
  @IsOptional()
  reviewer_note?: string;

  @ApiPropertyOptional({ description: 'New certificate data if approving correction' })
  @IsObject()
  @IsOptional()
  new_cert_data?: Record<string, any>;
}
