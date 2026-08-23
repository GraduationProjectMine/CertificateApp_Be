import { ApiProperty } from '@nestjs/swagger';

export class StoreCertificateDto {
  @ApiProperty({
    description: 'Document Title',
    example: 'BẰNG TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG',
  })
  documentTitle: string;

  @ApiProperty({
    description: 'Full Name',
    example: 'NGUYỄN VĂN A',
  })
  fullName: string;

  @ApiProperty({
    description: 'Date of Birth (dob)',
    example: '01/01/2005',
  })
  dob: string;

  @ApiProperty({
    description: 'Place of Birth',
    example: 'Hà Nội',
  })
  placeOfBirth: string;

  @ApiProperty({
    description: 'Gender',
    example: 'Nam',
  })
  gender: string;

  @ApiProperty({
    description: 'Ethnicity',
    example: 'Kinh',
  })
  ethnicity: string;

  @ApiProperty({
    description: 'School Name',
    example: 'THPT Chu Văn An',
  })
  schoolName: string;

  @ApiProperty({
    description: 'Exam Cohort',
    example: '2023',
  })
  examCohort: string;

  @ApiProperty({
    description: 'Exam Board',
    example: 'Sở Giáo dục và Đào tạo Hà Nội',
  })
  examBoard: string;

  @ApiProperty({
    description: 'Issue Location',
    example: 'Hà Nội',
  })
  issueLocation: string;

  @ApiProperty({
    description: 'Issue Date',
    example: '15/06/2023',
  })
  issueDate: string;

  @ApiProperty({
    description: 'Serial Number',
    example: 'A 12345678',
  })
  serialNumber: string;

  @ApiProperty({
    description: 'Registry Number',
    example: '2023/12345',
  })
  registryNumber: string;
}

export class StoreCertificateResponseDto {
  @ApiProperty({
    description: 'IPFS Content Identifier (CID)',
    example: 'QmXoypizjW3WknFixtdKLBU6gJHdW35pdj6dF4iW54VpY8',
  })
  cid: string;

  @ApiProperty({
    description: 'IPFS Gateway URL',
    example:
      'https://gateway.pinata.cloud/ipfs/QmXoypizjW3WknFixtdKLBU6gJHdW35pdj6dF4iW54VpY8',
  })
  ipfsUrl: string;

  @ApiProperty({
    description: 'SHA-3 Hash of the certificate data',
    example:
      'a69f73cca23a9ac5c8b567dc185a756e97c982164fe25859e0d1dcc1475c80a61',
  })
  sha3Hash: string;

  @ApiProperty({
    description: 'Stored data',
    type: StoreCertificateDto,
  })
  data: StoreCertificateDto;
}

export class StoreOnlineCertificateDto {
  @ApiProperty({ description: 'Document Title', example: 'CHỨNG NHẬN / VĂN BẰNG' })
  documentTitle: string;

  @ApiProperty({ description: 'Full Name', example: 'NGUYỄN VĂN A' })
  fullName: string;

  @ApiProperty({ description: 'Serial Number', example: 'A 12345678', required: false })
  serialNumber?: string;

  @ApiProperty({ description: 'Registry Number', example: '2023/12345', required: false })
  registryNumber?: string;

  @ApiProperty({ description: 'Date of Birth', example: '01/01/2005', required: false })
  dob?: string;

  @ApiProperty({ description: 'Place of Birth', example: 'Hà Nội', required: false })
  placeOfBirth?: string;

  @ApiProperty({ description: 'Gender', example: 'Nam', required: false })
  gender?: string;

  @ApiProperty({ description: 'Ethnicity', example: 'Kinh', required: false })
  ethnicity?: string;

  @ApiProperty({ description: 'School Name', example: 'THPT Chu Văn An', required: false })
  schoolName?: string;

  @ApiProperty({ description: 'Exam Cohort / Year', example: '2023', required: false })
  examCohort?: string;

  @ApiProperty({ description: 'Exam Board', example: 'Sở Giáo dục và Đào tạo Hà Nội', required: false })
  examBoard?: string;

  @ApiProperty({ description: 'Issue Location', example: 'Hà Nội', required: false })
  issueLocation?: string;

  @ApiProperty({ description: 'Issue Date', example: '15/06/2023', required: false })
  issueDate?: string;

  @ApiProperty({ description: 'Graduation Ranking', example: 'Giỏi', required: false })
  ranking?: string;

  @ApiProperty({ description: 'Mode of Study', example: 'Chính quy', required: false })
  modeOfStudy?: string;

  @ApiProperty({ description: 'Graduation Year', example: '2023', required: false })
  graduationYear?: string;

  @ApiProperty({ description: 'Head of Organization', example: 'Hiệu trưởng', required: false })
  headOfOrganization?: string;

  @ApiProperty({ description: 'Organization Name', example: 'Trường Đại học Bách Khoa', required: false })
  organization_name?: string;

  @ApiProperty({ description: 'Organization Logo URL', required: false })
  organization_logo?: string;

  @ApiProperty({ description: 'Template ID', example: 'uuid-string', required: false })
  template_id?: string;

  @ApiProperty({ description: 'Custom Metadata / Dynamic Fields', required: false })
  metadata?: Record<string, unknown>;
}

