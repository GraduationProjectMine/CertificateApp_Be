import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { StaffService } from '../staff/staff.service';
import { StudentService } from '../student/student.service';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: 'issuer' | 'staff' | 'student' | 'super_admin';
  organization_id: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly staffService: StaffService,
    private readonly studentService: StudentService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'certificate-app-jwt-secret-key',
    });
  }

  async validate(payload: JwtPayload) {
    payload.role = payload.role?.toLowerCase() as JwtPayload['role'];
    if (payload.role === 'super_admin') {
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        organization_id: '',
        staffRole: null,
      };
    }

    const isStaffOrIssuer = payload.role === 'issuer' || payload.role === 'staff';
    const user = isStaffOrIssuer
      ? await this.staffService.findById(payload.sub)
      : await this.studentService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      organization_id: payload.organization_id,
      staffRole: isStaffOrIssuer ? (user as any).role : null,
    };
  }
}
