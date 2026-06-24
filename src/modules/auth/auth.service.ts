import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ethers } from 'ethers';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';

const WALLET_NONCE_TTL_MS = 5 * 60 * 1000;
const FORBIDDEN_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'aol.com',
];

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeWalletAddress(
    walletAddress: string | null | undefined,
  ): string {
    return (walletAddress || '').toLowerCase();
  }

  private createNonce(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  private createWalletMessage(
    action: 'login' | 'link',
    walletAddress: string,
    nonce: string,
  ): string {
    const normalizedAddress = this.normalizeWalletAddress(walletAddress);
    const actionText = action === 'link' ? 'liên kết ví' : 'đăng nhập';
    return [
      `BlockCert ${actionText}`,
      `Wallet: ${normalizedAddress}`,
      `Nonce: ${nonce}`,
      'Nonce này chỉ dùng một lần và hết hạn sau 5 phút.',
    ].join('\n');
  }

  private generateToken(user: {
    id: string;
    role: string;
    studentId?: string | null;
    institutionId?: string | null;
  }): string {
    return jwt.sign(
      {
        userId: user.id,
        role: user.role,
        studentId: user.studentId || null,
        institutionId: user.institutionId || null,
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '1d' },
    );
  }

  private buildUserResponse(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId || null,
      institutionId: user.institutionId || null,
      walletAddress: user.walletAddress || null,
    };
  }

  async registerInstitution(data: {
    institutionName: string;
    institutionCode: string;
    email: string;
    adminName: string;
    password: string;
  }) {
    const emailDomain = data.email.split('@')[1]?.toLowerCase();
    if (FORBIDDEN_EMAIL_DOMAINS.includes(emailDomain)) {
      throw new BadRequestException(
        'Vui lòng dùng email trường học, không dùng email cá nhân',
      );
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (existingEmail) throw new ConflictException('Email này đã được đăng ký');

    const existingCode = await this.prisma.institution.findUnique({
      where: { code: data.institutionCode },
      select: { id: true },
    });
    if (existingCode) throw new ConflictException('Mã trường này đã tồn tại');

    const institution = await this.prisma.institution.create({
      data: {
        name: data.institutionName,
        code: data.institutionCode,
        email: data.email,
      },
      select: { id: true },
    });

    return {
      message: 'Đăng ký thành công. Vui lòng chờ Super Admin phê duyệt.',
      institutionId: institution.id,
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { institution: { select: { name: true } } },
    });
    if (!user)
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const token = this.generateToken(user);
    return {
      message: 'Đăng nhập thành công',
      token,
      user: {
        ...this.buildUserResponse(user),
        institutionName: user.institution?.name || null,
      },
    };
  }

  async register(data: {
    email: string;
    password: string;
    name: string;
    role?: string;
    studentId?: string;
    institutionId?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Email đã tồn tại');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role || 'student',
        studentId: data.studentId || null,
        institutionId: data.institutionId || null,
      },
    });

    const token = this.generateToken(user);
    return {
      message: 'Đăng ký thành công',
      token,
      user: this.buildUserResponse(user),
    };
  }

  async loginWithGoogle(credential: string) {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`,
    );
    if (!response.ok)
      throw new UnauthorizedException('Google token không hợp lệ');

    const payload: any = await response.json();
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new UnauthorizedException('Google client ID không khớp');
    }
    if (!payload.email_verified) {
      throw new UnauthorizedException('Email Google chưa được xác thực');
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || email.split('@')[0];

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { institution: { select: { name: true } } },
    });

    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'employer',
          googleId,
        },
        include: { institution: { select: { name: true } } },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId },
        include: { institution: { select: { name: true } } },
      });
    }

    const token = this.generateToken(user);
    return {
      message: 'Đăng nhập bằng Google thành công',
      token,
      user: {
        ...this.buildUserResponse(user),
        institutionName: user.institution?.name || null,
      },
    };
  }

  async getMetamaskLoginNonce(walletAddress: string) {
    if (!walletAddress) throw new BadRequestException('Thiếu địa chỉ ví');
    const normalizedAddress = this.normalizeWalletAddress(walletAddress);
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });
    if (!user) {
      throw new NotFoundException(
        'Địa chỉ ví này chưa được liên kết với tài khoản nào',
      );
    }
    return this.issueWalletNonce(user.id, normalizedAddress, 'login');
  }

  async loginMetamask(walletAddress: string, signature: string) {
    if (!walletAddress || !signature) {
      throw new BadRequestException('Thiếu địa chỉ ví hoặc chữ ký');
    }

    const normalizedAddress = this.normalizeWalletAddress(walletAddress);
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
      include: { institution: { select: { name: true } } },
    });
    if (!user) {
      throw new NotFoundException(
        'Địa chỉ ví này chưa được liên kế. Vui lòng đăng nhập bằng email trước.',
      );
    }

    await this.verifyAndConsumeWalletNonce(
      user,
      normalizedAddress,
      signature,
      'login',
    );
    const token = this.generateToken(user);
    return {
      message: 'Đăng nhập bằng MetaMask thành công',
      token,
      user: {
        ...this.buildUserResponse(user),
        institutionName: user.institution?.name || null,
      },
    };
  }

  async getLinkWalletNonce(userId: string, walletAddress: string) {
    if (!walletAddress) throw new BadRequestException('Thiếu địa chỉ ví');
    const normalizedAddress = this.normalizeWalletAddress(walletAddress);

    const existingWallet = await this.prisma.user.findFirst({
      where: {
        walletAddress: normalizedAddress,
        id: { not: userId },
      },
      select: { id: true },
    });
    if (existingWallet) {
      throw new BadRequestException(
        'Ví này đã được liên kết với tài khoản khác',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (user.walletAddress) {
      throw new BadRequestException(
        'Tài khoản đã liên kết ví. Hủy liên kết trước để đổi.',
      );
    }

    return this.issueWalletNonce(user.id, normalizedAddress, 'link');
  }

  async linkWallet(userId: string, walletAddress: string, signature: string) {
    if (!walletAddress || !signature) {
      throw new BadRequestException('Thiếu địa chỉ ví hoặc chữ ký');
    }
    const normalizedAddress = this.normalizeWalletAddress(walletAddress);

    const existingWallet = await this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
      select: { id: true },
    });
    if (existingWallet) {
      throw new BadRequestException(
        'Ví này đã được liên kết với tài khoản khác',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (user.walletAddress) {
      throw new BadRequestException('Tài khoản đã liên kết ví');
    }

    await this.verifyAndConsumeWalletNonce(
      user,
      normalizedAddress,
      signature,
      'link',
    );

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { walletAddress: normalizedAddress },
    });

    return {
      message: 'Liên kết ví thành công',
      user: this.buildUserResponse(updatedUser),
    };
  }

  async unlinkWallet(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (!user.walletAddress) {
      throw new BadRequestException('Chưa liên kết ví MetaMask');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { walletAddress: null },
    });
    return {
      message: 'Hủy liên kết ví thành công',
      user: this.buildUserResponse(updatedUser),
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { institution: { select: { name: true } } },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    return {
      ...this.buildUserResponse(user),
      institutionName: user.institution?.name || null,
    };
  }

  private async issueWalletNonce(
    userId: string,
    walletAddress: string,
    action: 'login' | 'link',
  ) {
    const nonce = this.createNonce();
    const expiresAt = new Date(Date.now() + WALLET_NONCE_TTL_MS);
    const message = this.createWalletMessage(action, walletAddress, nonce);

    await this.prisma.user.update({
      where: { id: userId },
      data: { walletNonce: nonce, walletNonceExpiresAt: expiresAt },
    });
    return { nonce, expiresAt, message };
  }

  private async verifyAndConsumeWalletNonce(
    user: any,
    walletAddress: string,
    signature: string,
    action: 'login' | 'link',
  ) {
    const normalizedAddress = this.normalizeWalletAddress(walletAddress);
    if (!user.walletNonce || !user.walletNonceExpiresAt) {
      throw new BadRequestException('Nonce không tồn tại hoặc đã được sử dụng');
    }

    const expiresAt = new Date(user.walletNonceExpiresAt).getTime();
    if (expiresAt < Date.now()) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { walletNonce: null, walletNonceExpiresAt: null },
      });
      throw new BadRequestException('Nonce đã hết hạn');
    }

    const message = this.createWalletMessage(
      action,
      normalizedAddress,
      user.walletNonce,
    );
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch {
      throw new BadRequestException('Chữ ký số không hợp lệ');
    }
    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      throw new BadRequestException('Chữ ký không khớp với địa chỉ ví');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { walletNonce: null, walletNonceExpiresAt: null },
    });
  }
}
