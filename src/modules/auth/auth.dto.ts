import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@hust.edu.vn' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@123' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class LoginMetamaskNonceDto {
  @ApiProperty({ example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' })
  @IsString()
  walletAddress: string;
}

export class LoginMetamaskDto {
  @ApiProperty({ example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' })
  @IsString()
  walletAddress: string;

  @ApiProperty({ example: '0x...' })
  @IsString()
  signature: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'admin@hust.edu.vn' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'issuer', required: false })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ example: '20202345', required: false })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiProperty({ example: 'uuid', required: false })
  @IsOptional()
  @IsString()
  institutionId?: string;
}

export class LinkWalletNonceDto {
  @ApiProperty({ example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' })
  @IsString()
  walletAddress: string;
}

export class LinkWalletDto {
  @ApiProperty({ example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' })
  @IsString()
  walletAddress: string;

  @ApiProperty({ example: '0x...' })
  @IsString()
  signature: string;
}

export class RegisterInstitutionDto {
  @ApiProperty({ example: 'Trường Đại học Bách Khoa Hà Nội' })
  @IsString()
  institutionName: string;

  @ApiProperty({ example: 'HUST' })
  @IsString()
  @Matches(/^[A-Z0-9_]{2,20}$/, { message: 'Mã trường chỉ gồm chữ in hoa, số, _, 2-20 ký tự' })
  institutionCode: string;

  @ApiProperty({ example: 'admin@hust.edu.vn' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  adminName: string;

  @ApiProperty({ example: 'Admin@123' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'Mật khẩu phải có chữ hoa, chữ thường và số' })
  password: string;
}

export class GoogleLoginDto {
  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIs...' })
  @IsString()
  credential: string;
}

export class AuthResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  token: string;

  @ApiProperty({
    example: {
      id: 'uuid',
      name: 'Nguyễn Văn A',
      email: 'admin@hust.edu.vn',
      role: 'issuer',
      studentId: null,
      institutionId: 'uuid',
      walletAddress: '0x...',
      institutionName: 'Đại học Bách Khoa',
    },
  })
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    studentId: string | null;
    institutionId: string | null;
    walletAddress: string | null;
    institutionName?: string | null;
  };
}

export class NonceResponseDto {
  @ApiProperty()
  nonce: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  message: string;
}
