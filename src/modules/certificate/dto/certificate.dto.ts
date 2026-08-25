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
    description:
      'Full name of the student (optional, fetched from DB if omitted)',
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
  })
  @IsString()
  @IsNotEmpty()
  dob: string;

  @ApiProperty({
    example: 'Hà Nội',
    description: 'Place of birth of the student',
  })
  @IsString()
  @IsNotEmpty()
  placeOfBirth: string;

  @ApiProperty({
    example: 'Nam',
    description: 'Gender of the student',
  })
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiProperty({
    example: 'Kinh',
    description: 'Ethnicity of the student',
  })
  @IsString()
  @IsNotEmpty()
  ethnicity: string;

  @ApiProperty({
    example: 'THPT Chu Văn An',
    description: 'Name of the school/institution',
  })
  @IsString()
  @IsNotEmpty()
  schoolName: string;

  @ApiProperty({
    example: '2023',
    description: 'Exam cohort / Year of graduation',
  })
  @IsString()
  @IsNotEmpty()
  examCohort: string;

  @ApiProperty({
    example: 'Sở Giáo dục và Đào tạo Hà Nội',
    description: 'Exam board / Authority',
  })
  @IsString()
  @IsNotEmpty()
  examBoard: string;

  @ApiProperty({
    example: 'Hà Nội',
    description: 'Location where certificate was issued',
  })
  @IsString()
  @IsNotEmpty()
  issueLocation: string;

  @ApiProperty({
    example: '15/06/2023',
    description: 'Date when the certificate was issued',
  })
  @IsString()
  @IsNotEmpty()
  issueDate: string;

  @ApiProperty({
    example: 'A 12345678',
    description: 'Serial number of the certificate',
  })
  @IsString()
  @IsNotEmpty()
  serialNumber: string;

  @ApiProperty({
    example: '2023/12345',
    description: 'Registry book / Entry number of the certificate',
  })
  @IsString()
  @IsNotEmpty()
  registryNumber: string;

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

export class TemplateBatchIssueDto {
  @ApiProperty({
    type: [CreateCertificateDto],
    description: 'Array of certificate records to issue from template',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  rows!: CreateCertificateDto[];

  @ApiProperty({
    example: 'uuid-of-template',
    description: 'Optional ID of the template applied',
    required: false,
  })
  @IsString()
  @IsOptional()
  template_id?: string;
}
