import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCertificateDto {
  @ApiProperty({ example: 'uuid-student-id', description: 'ID sinh viên nhận bằng' })
  @IsString()
  student_id!: string;

  @ApiProperty({ example: 'BẰNG TỐT NGHIỆP THPT', description: 'Tiêu đề văn bằng' })
  @IsString()
  certificate_title!: string;

  @ApiPropertyOptional({ example: '2026-06-15', description: 'Ngày cấp bằng' })
  @IsDateString()
  @IsOptional()
  issue_date?: string;

  @ApiPropertyOptional({ example: '2031-06-15', description: 'Ngày hết hạn' })
  @IsDateString()
  @IsOptional()
  expiry_date?: string;

  @ApiPropertyOptional({ example: '{"gpa":"3.8","major":"CNTT"}', description: 'Metadata JSON' })
  @IsString()
  @IsOptional()
  metadata?: string;

  @ApiPropertyOptional({ example: 'uuid-template-id', description: 'ID mẫu văn bằng' })
  @IsString()
  @IsOptional()
  template_id?: string;
}