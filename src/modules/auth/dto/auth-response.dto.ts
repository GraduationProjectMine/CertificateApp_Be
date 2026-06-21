import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ example: 1, description: 'User ID' })
  id!: number;

  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  email!: string;

  @ApiProperty({ example: 'john_doe', description: 'Username' })
  username!: string;

  @ApiProperty({ example: 'issuer', enum: ['issuer', 'student'], description: 'User role' })
  role!: 'issuer' | 'student';

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...', description: 'JWT access token' })
  accessToken!: string;
}
