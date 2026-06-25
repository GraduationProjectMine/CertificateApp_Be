import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { IssuerService } from '../issuer/issuer.service';
import { StudentService } from '../student/student.service';
import { OrganizationService } from '../organization/organization.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly issuerService: IssuerService,
    private readonly studentService: StudentService,
    private readonly organizationService: OrganizationService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const { email, name, password } = dto;

    const existingOrg = await this.organizationService.findByEmail(email);
    if (existingOrg) {
      throw new ConflictException('Tổ chức với email này đã tồn tại');
    }

    const existingStaff = await this.issuerService.findByEmail(email);
    if (existingStaff) {
      throw new ConflictException('Email này đã được đăng ký');
    }

    const organization = await this.organizationService.create(name, email);

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const created = await this.issuerService.create(
      name,
      email,
      hashedPassword,
      organization.organization_id,
      organization.organization_name,
      'ADMIN',
    );

    const accessToken = this.jwtService.sign({
      sub: created.staff_id,
      email: created.email,
      name: created.name,
      role: 'issuer',
      organization_id: organization.organization_id,
    });

    return {
      id: created.staff_id,
      email: created.email,
      name: created.name,
      role: 'issuer',
      accessToken,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const existingIssuer = await this.issuerService.findByEmail(dto.email);
    const existingStudent = await this.studentService.findByEmail(dto.email);

    const user = existingIssuer ?? existingStudent;
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const role = existingIssuer ? 'issuer' : 'student';
    const name = existingIssuer ? existingIssuer.name : existingStudent!.student_fullName;
    const id = existingIssuer ? existingIssuer.staff_id : existingStudent!.student_id;
    const organization_id = existingIssuer
      ? existingIssuer.organization_id
      : existingStudent!.organization_id;

    const accessToken = this.jwtService.sign({
      sub: id,
      email: user.email,
      name,
      role,
      organization_id,
    });

    return {
      id,
      email: user.email,
      name,
      role: role as 'issuer' | 'student',
      accessToken,
    };
  }
}
