import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'truongthpt@edu.vn', description: 'Email của nhà trường (dùng để đăng nhập)' })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @ApiProperty({ example: 'Trường THPT Mặc Định', description: 'Tên trường / tổ chức' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name!: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A', description: 'Tên người quản trị (mặc định bằng name nếu không có)' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Admin name must be at least 2 characters' })
  @MaxLength(255, { message: 'Admin name must not exceed 255 characters' })
  adminName?: string;

  @ApiProperty({ example: 'StrongP@ss1', description: 'Mật khẩu (tối thiểu 8 ký tự, 1 chữ hoa, 1 chữ thường, 1 số)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(64, { message: 'Password must not exceed 64 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;
}