import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCertificateDto {
  @ApiPropertyOptional({ example: 'BẰNG TỐT NGHIỆP THPT', description: 'Tiêu đề văn bằng' })
  @IsString()
  @IsOptional()
  certificate_title?: string;

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

  @ApiPropertyOptional({ example: 'APPROVED', description: 'Chuyển trạng thái', enum: ['DRAFT', 'APPROVED', 'IPFS_UPLOADED', 'BLOCKCHAIN_NOTARIZED'] })
  @IsString()
  @IsIn(['DRAFT', 'APPROVED', 'IPFS_UPLOADED', 'BLOCKCHAIN_NOTARIZED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'Thiếu thông tin xác thực', description: 'Lý do từ chối' })
  @IsString()
  @IsOptional()
  rejected_reason?: string;
}