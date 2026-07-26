import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCertificateDto {
  @ApiProperty({
    example: 'b6c86a01-9c60-4966-bd94-b77873523f2f',
    description: 'ID of the student receiving the certificate',
  })
  @IsString()
  @IsNotEmpty()
  student_id: string;

  @ApiProperty({
    example: 'Nguyễn Văn A',
    description: 'Full name of the student (optional, fetched from DB if omitted)',
    required: false,
  })
  @IsString()
  @IsOptional()
  student_fullName?: string;

  @ApiProperty({
    example: 'uuid-of-template',
    description: 'ID of the certificate template',
    required: false,
  })
  @IsString()
  @IsOptional()
  template_id?: string;

  @ApiProperty({
    example: 'BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG',
    description: 'Title of the certificate',
  })
  @IsString()
  @IsNotEmpty()
  certificate_title: string;

  @ApiProperty({
    example: '01/01/2005',
    description: 'Date of birth of the student',
    required: false,
  })
  @IsString()
  @IsOptional()
  dob?: string;

  @ApiProperty({
    example: 'Hà Nội',
    description: 'Place of birth of the student',
    required: false,
  })
  @IsString()
  @IsOptional()
  placeOfBirth?: string;

  @ApiProperty({
    example: 'Nam',
    description: 'Gender of the student',
    required: false,
  })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiProperty({
    example: 'Kinh',
    description: 'Ethnicity of the student',
    required: false,
  })
  @IsString()
  @IsOptional()
  ethnicity?: string;

  @ApiProperty({
    example: 'THPT Chu Văn An',
    description: 'Name of the school/institution',
    required: false,
  })
  @IsString()
  @IsOptional()
  schoolName?: string;

  @ApiProperty({
    example: '2023',
    description: 'Exam cohort / Year of graduation',
    required: false,
  })
  @IsString()
  @IsOptional()
  examCohort?: string;

  @ApiProperty({
    example: 'Sở Giáo dục và Đào tạo Hà Nội',
    description: 'Exam board / Authority',
    required: false,
  })
  @IsString()
  @IsOptional()
  examBoard?: string;

  @ApiProperty({
    example: 'Hà Nội',
    description: 'Location where certificate was issued',
    required: false,
  })
  @IsString()
  @IsOptional()
  issueLocation?: string;

  @ApiProperty({
    example: '15/06/2023',
    description: 'Date when the certificate was issued',
    required: false,
  })
  @IsString()
  @IsOptional()
  issueDate?: string;

  @ApiProperty({
    example: 'A 12345678',
    description: 'Serial number of the certificate',
    required: false,
  })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiProperty({
    example: '2023/12345',
    description: 'Registry book / Entry number of the certificate',
    required: false,
  })
  @IsString()
  @IsOptional()
  registryNumber?: string;

  @ApiProperty({
    example: 'bafkreihdwdcefgh...',
    description: 'IPFS CID of the attached file',
    required: false,
  })
  @IsString()
  @IsOptional()
  ipfs_cid?: string;

  @ApiProperty({
    example: 'https://gateway.pinata.cloud/ipfs/bafkreih...',
    description: 'URL of the uploaded certificate file',
    required: false,
  })
  @IsString()
  @IsOptional()
  file_url?: string;

  @ApiProperty({
    example: 'SV001.pdf',
    description: 'Original document filename from a bulk ZIP package',
    required: false,
  })
  @IsString()
  @IsOptional()
  document_file?: string;

  @ApiProperty({
    example: 'sha3-256-hex',
    description: 'SHA-3 hash of the binary document, never the binary itself',
    required: false,
  })
  @IsString()
  @IsOptional()
  document_sha3?: string;
}

export class UpdateCertificateDto {
  @ApiProperty({
    example: 'PENDING',
    description: 'Status of the certificate (e.g., DRAFT, PENDING)',
  })
  @IsString()
  @IsNotEmpty()
  status!: string;
}

export class RevokeCertificateDto {
  @ApiProperty({
    example: 'Sai thông tin sinh viên',
    description: 'Reason shown in the revocation history',
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class BatchApproveDto {
  @ApiProperty({
    example: ['uuid-1', 'uuid-2'],
    description: 'Array of certificate IDs to approve',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[];
}
