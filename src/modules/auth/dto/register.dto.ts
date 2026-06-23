import { IsEmail, IsString, IsIn, IsInt, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Full name of the user' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name!: string;

  @ApiProperty({ example: 'issuer', enum: ['issuer', 'student'], description: 'User role' })
  @IsString()
  @IsIn(['issuer', 'student'], { message: 'Role must be either "issuer" or "student"' })
  role!: 'issuer' | 'student';

  @ApiProperty({ example: 1, description: 'Organization ID (the school/institution the user belongs to)' })
  @IsInt()
  organization_id!: number;

  @ApiProperty({ example: 'StrongP@ss1', description: 'Password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(64, { message: 'Password must not exceed 64 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;
}