import { ApiProperty } from '@nestjs/swagger';

export class ExtractTextDto {
  @ApiProperty({
    description:
      'Language code for OCR. Supported: eng, vie, fra, deu, spa, jpn, chi_sim, chi_tra',
    example: 'eng',
    required: false,
  })
  language?: string;
}

export class OcrResponseDto {
  @ApiProperty({
    description: 'Extracted text from the image',
    example: 'Xin chào, đây là text tiếng Việt',
  })
  extractedText: string;

  @ApiProperty({
    description: 'Accuracy score of the extraction (0-100)',
    example: 92.5,
  })
  accuracy: number;

  @ApiProperty({
    description:
      'Language used for OCR (eng, vie, fra, deu, spa, jpn, chi_sim, chi_tra)',
    example: 'vie',
  })
  language: string;
}

export class DiplomaDataDto {
  @ApiProperty({
    description:
      'Document title - must be "BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG"',
    example: 'BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG',
  })
  document_title?: string;

  @ApiProperty({
    description: 'Full name in ALL CAPS, letters and spaces only',
    example: 'NGUYỄN VĂN A',
  })
  full_name?: string;

  @ApiProperty({
    description: 'Date of birth in DD/MM/YYYY format',
    example: '01/01/2005',
  })
  dob?: string;

  @ApiProperty({
    description: 'Place of birth',
    example: 'Đà Nẵng',
  })
  place_of_birth?: string;

  @ApiProperty({
    description: 'Gender - must be "Nam" or "Nữ"',
    example: 'Nam',
  })
  gender?: string;

  @ApiProperty({
    description: 'Ethnicity',
    example: 'Kinh',
  })
  ethnicity?: string;

  @ApiProperty({
    description: 'School name, usually starts with "THPT" or "TTGDTX"',
    example: 'THPT Lê Thánh Tông',
  })
  school_name?: string;

  @ApiProperty({
    description: 'Exam cohort in DD/MM/YYYY format',
    example: '03/09/2020',
  })
  exam_cohort?: string;

  @ApiProperty({
    description: 'Exam board, usually starts with "Sở Giáo dục và Đào tạo"',
    example: 'Sở Giáo dục và Đào tạo Quảng Nam',
  })
  exam_board?: string;

  @ApiProperty({
    description: 'Issue location',
    example: 'Quảng Nam',
  })
  issue_location?: string;

  @ApiProperty({
    description: 'Issue date in DD/MM/YYYY format',
    example: '31/12/2020',
  })
  issue_date?: string;

  @ApiProperty({
    description:
      'Serial number - format: Letter + Space + 8 Digits (e.g., "T 00516292")',
    example: 'T 00516292',
  })
  serial_number?: string;

  @ApiProperty({
    description: 'Registry number - alphanumeric, usually 8-10 characters',
    example: '38492020',
  })
  registry_number?: string;
}

export class DiplomaExtractionResponseDto {
  @ApiProperty({
    description: 'Extracted diploma data with parsed fields',
    type: DiplomaDataDto,
  })
  data: DiplomaDataDto;

  @ApiProperty({
    description: 'Accuracy score of the extraction (0-100)',
    example: 92.5,
  })
  accuracy: number;

  @ApiProperty({
    description: 'Raw extracted text from image',
    example: 'BẰNG TỐT NGHIỆP...',
  })
  rawText: string;

  @ApiProperty({
    description: 'Validation errors for extracted fields',
    example: { full_name: 'Invalid format' },
    required: false,
  })
  validationErrors?: Record<string, string>;
}
