import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { MailService } from '../../core/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY_DAYS = 7;

@Injectable()
export class ActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Generate a single-use activation token and upsert into DB
   */
  async generateActivationToken(studentId: string): Promise<string> {
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(
      Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.activationToken.upsert({
      where: { student_id: studentId },
      update: { token, used: false, expiresAt },
      create: { student_id: studentId, token, expiresAt },
    });

    return token;
  }

  /**
   * Send activation invite email to a student
   */
  async sendActivationEmail(
    email: string,
    name: string,
    token: string,
    organizationName: string,
  ): Promise<void> {
    const feBaseUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    const activationUrl = `${feBaseUrl}/auth/activate?token=${token}`;
    await this.mailService.sendActivationInvite(
      email,
      name,
      activationUrl,
      organizationName,
    );
  }

  /**
   * Verify token validity for preview (FE checks before showing form)
   */
  async verifyToken(token: string) {
    const record = await this.prisma.activationToken.findUnique({
      where: { token },
      include: { student: true },
    });

    if (!record) throw new NotFoundException('Token kích hoạt không hợp lệ');
    if (record.used) throw new BadRequestException('Token này đã được sử dụng');
    if (record.expiresAt < new Date())
      throw new BadRequestException('Token đã hết hạn. Liên hệ tổ chức để nhận link mới.');

    return {
      email: record.student.email,
      name: record.student.student_fullName,
      organizationName: record.student.organization_name,
    };
  }

  /**
   * Activate account: set password + mark account as activated
   */
  async activateAccount(
    token: string,
    password: string,
    confirmPassword: string,
  ): Promise<void> {
    if (password !== confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }
    if (password.length < 8) {
      throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự');
    }

    const record = await this.prisma.activationToken.findUnique({
      where: { token },
    });

    if (!record) throw new NotFoundException('Token kích hoạt không hợp lệ');
    if (record.used) throw new BadRequestException('Token này đã được sử dụng');
    if (record.expiresAt < new Date())
      throw new BadRequestException('Token đã hết hạn');

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.studentAccount.update({
        where: { student_id: record.student_id },
        data: { password: hashedPassword, isActivated: true },
      }),
      this.prisma.activationToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ]);
  }

  /**
   * Resend activation email for a specific student (issuer action)
   */
  async resendActivation(
    studentId: string,
    organizationId: string,
  ): Promise<void> {
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: studentId },
    });

    if (!student) throw new NotFoundException('Student not found');
    if (student.organization_id !== organizationId) {
      throw new ForbiddenException('Student does not belong to your organization');
    }
    if (student.isActivated) {
      throw new BadRequestException('Tài khoản này đã được kích hoạt rồi');
    }

    const token = await this.generateActivationToken(studentId);
    await this.sendActivationEmail(
      student.email,
      student.student_fullName,
      token,
      student.organization_name,
    );
  }
}
