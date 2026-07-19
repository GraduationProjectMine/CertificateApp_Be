import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { StaffService } from '../staff/staff.service';
import { StudentService } from '../student/student.service';
import { IssuerService } from '../issuer/issuer.service';
import { SuperAdminService } from '../super-admin/super-admin.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly staffService: StaffService,
    private readonly studentService: StudentService,
    private readonly issuerService: IssuerService,
    private readonly superAdminService: SuperAdminService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async generateTokens(payload: any) {
    const accessToken = this.jwtService.sign(payload, { expiresIn: '10m' });
    const refreshToken = this.jwtService.sign(
      { sub: payload.sub, role: payload.role },
      { expiresIn: '7d' },
    );
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto): Promise<any> {
    const { email, name, password, adminName } = dto;

    const existingOrg = await this.issuerService.findByEmail(email);
    if (existingOrg) {
      throw new ConflictException('Tổ chức với email này đã tồn tại');
    }

    const existingStaff = await this.staffService.findByEmail(email);
    if (existingStaff) {
      throw new ConflictException('Email này đã được đăng ký');
    }

    const organization = await this.issuerService.create(name, email);

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const staffName = adminName || name;
    const created = await this.staffService.create(
      staffName,
      email,
      hashedPassword,
      organization.organization_id,
      organization.organization_name,
      'ISSUER',
    );

    const { accessToken, refreshToken } = await this.generateTokens({
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
      refreshToken,
    };
  }

  async login(dto: LoginDto): Promise<any> {
    // Check super admin first
    const superAdmin = await this.prisma.superAdmin.findUnique({
      where: { email: dto.email },
    });

    if (superAdmin) {
      const isPasswordValid = await bcrypt.compare(dto.password, superAdmin.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const { accessToken, refreshToken } = await this.generateTokens({
        sub: superAdmin.admin_id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: 'sysadmin',
        organization_id: '',
      });

      return {
        id: superAdmin.admin_id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: 'sysadmin',
        accessToken,
        refreshToken,
      };
    }

    const existingStaff = await this.staffService.findByEmail(dto.email);
    const existingStudent = await this.studentService.findByEmail(dto.email);

    const user = existingStaff ?? existingStudent;
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    let role: 'issuer' | 'staff' | 'student';
    let name: string;
    let id: string;
    let organization_id: string;

    if (existingStaff) {
      role = existingStaff.role.toUpperCase() === 'ISSUER' ? 'issuer' : 'staff';
      name = existingStaff.name;
      id = existingStaff.staff_id;
      organization_id = existingStaff.organization_id;
    } else {
      role = 'student';
      name = existingStudent!.student_fullName;
      id = existingStudent!.student_id;
      organization_id = existingStudent!.organization_id;
    }

    const { accessToken, refreshToken } = await this.generateTokens({
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
      role,
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);

      const isStaffOrIssuer = payload.role === 'issuer' || payload.role === 'staff';
      const user = isStaffOrIssuer
        ? await this.staffService.findById(payload.sub)
        : await this.studentService.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      let role: 'issuer' | 'staff' | 'student';
      let name: string;
      let id: string;
      let organization_id: string;

      if (isStaffOrIssuer) {
        const staffUser = user as any;
        role = staffUser.role.toUpperCase() === 'ISSUER' ? 'issuer' : 'staff';
        name = staffUser.name;
        id = staffUser.staff_id;
        organization_id = staffUser.organization_id;
      } else {
        const studentUser = user as any;
        role = 'student';
        name = studentUser.student_fullName;
        id = studentUser.student_id;
        organization_id = studentUser.organization_id;
      }

      const tokens = await this.generateTokens({
        sub: id,
        email: user.email,
        name,
        role,
        organization_id,
      });

      return tokens;
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
