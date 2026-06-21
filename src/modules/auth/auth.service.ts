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
    const { email, username, password, role } = dto;

    // Check if email already exists across both services
    const existingIssuer = await this.issuerService.findByEmail(email);
    const existingStudent = await this.studentService.findByEmail(email);
    if (existingIssuer || existingStudent) {
      throw new ConflictException('A user with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    let user: { id: number; email: string; username: string };

    if (role === 'issuer') {
      user = await this.issuerService.create(email, username, hashedPassword);
    } else {
      user = await this.studentService.create(email, username, hashedPassword);
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      username: user.username,
      role,
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
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

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      username: user.username,
      role,
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role,
      accessToken,
    };
  }
}