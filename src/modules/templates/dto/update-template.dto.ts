import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTemplateDto {
  @ApiProperty({ required: false, description: 'Template name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false, description: 'Template description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, description: 'Design data JSON' })
  @IsObject()
  @IsOptional()
  design_data?: Record<string, unknown>;

  @ApiProperty({ required: false, description: 'Thumbnail URL' })
  @IsString()
  @IsOptional()
  thumbnail_url?: string;

  @ApiProperty({ required: false, description: 'Set as default template' })
  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}
