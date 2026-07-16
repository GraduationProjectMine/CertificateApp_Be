import { IsString, IsNotEmpty, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Mẫu bằng tốt nghiệp ĐH', description: 'Template name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Mẫu bằng mặc định cho kỹ sư CNTT', required: false, description: 'Template description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: {
      page: { width: 800, height: 600, bgColor: '#ffffff' },
      fields: [
        { id: 'student_name', type: 'text', x: 200, y: 300, w: 400, h: 50, font: 'serif', size: 36, color: '#1a1a1a', align: 'center', dynamic: true, binding: 'student_fullName' },
      ],
    },
    description: 'Design data JSON',
  })
  @IsObject()
  design_data: Record<string, unknown>;

  @ApiProperty({ required: false, description: 'Thumbnail URL' })
  @IsString()
  @IsOptional()
  thumbnail_url?: string;

  @ApiProperty({ required: false, default: false, description: 'Set as default template' })
  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}
