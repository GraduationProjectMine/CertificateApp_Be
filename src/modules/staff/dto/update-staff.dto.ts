import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStaffDto {
  @ApiPropertyOptional({
    example: 'Nguyễn Văn B',
    description: 'Full name of staff member',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'nhanvien@truong.edu.vn',
    description: 'Email of staff member',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Active status of staff account',
  })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'STAFF',
    description: 'Role of staff account',
  })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ example: 'StrongP@ss1', description: 'New password' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  @IsOptional()
  password?: string;
}
