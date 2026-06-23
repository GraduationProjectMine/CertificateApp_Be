import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IssuerService } from '../issuer/issuer.service';
import { StudentService } from '../student/student.service';

export interface JwtPayload {
  sub: number;
  email: string;
  name: string;
  role: 'issuer' | 'student';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly issuerService: IssuerService,
    private readonly studentService: StudentService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'certificate-app-jwt-secret-key',
    });
  }

  async validate(payload: JwtPayload) {
    const user =
      payload.role === 'issuer'
        ? await this.issuerService.findById(payload.sub)
        : await this.studentService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  }
}