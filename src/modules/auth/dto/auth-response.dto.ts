import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ example: 'uuid-string', description: 'User ID' })
  id!: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  email!: string;

  @ApiProperty({
    example: 'Nguyễn Văn A',
    description: 'Full name of the user',
  })
  name!: string;

  @ApiProperty({
    example: 'issuer',
    enum: ['issuer', 'student'],
    description: 'User role',
  })
  role!: 'issuer' | 'student';

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIs...',
    description: 'JWT access token',
  })
  accessToken!: string;

  @ApiProperty({
    example: 'ADMIN',
    description: 'The specific role of the staff if the user is an issuer',
    required: false,
  })
  staffRole?: string;
}
