import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { IssuerService } from '../issuer/issuer.service';
import { StudentService } from '../student/student.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly issuerService: IssuerService,
    private readonly studentService: StudentService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const { email, name, password, role, organization_id } = dto;

    // Check if email already exists across both services
    const existingIssuer = await this.issuerService.findByEmail(email);
    const existingStudent = await this.studentService.findByEmail(email);
    if (existingIssuer || existingStudent) {
      throw new ConflictException('A user with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    let user: { id: number; email: string; name: string };

    if (role === 'issuer') {
      const created = await this.issuerService.create(name, email, hashedPassword, organization_id);
      user = { id: created.staff_id, email: created.email, name: created.name };
    } else {
      const created = await this.studentService.create(name, email, hashedPassword, organization_id);
      user = { id: created.student_id, email: created.email, name: created.student_fullName };
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
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

    const accessToken = this.jwtService.sign({
      sub: id,
      email: user.email,
      name,
      role,
    });

    return {
      id,
      email: user.email,
      name,
      role,
      accessToken,
    };
  }
}