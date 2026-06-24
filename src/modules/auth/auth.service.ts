import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { IssuerService } from '../issuer/issuer.service';
import { StudentService } from '../student/student.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly issuerService: IssuerService,
    private readonly studentService: StudentService,
    private readonly jwtService: JwtService,
  ) {}

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
      role,
      accessToken,
    };
  }
}