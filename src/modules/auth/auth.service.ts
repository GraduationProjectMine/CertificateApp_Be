import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { verifyMessage } from 'ethers';
import { StaffService } from '../staff/staff.service';
import { StudentService } from '../student/student.service';
import { IssuerService } from '../issuer/issuer.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MetaMaskRegisterDto } from './dto/metamask-register.dto';

import { BlockchainService } from '../../core/blockchain/blockchain.service';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly staffService: StaffService,
    private readonly studentService: StudentService,
    private readonly issuerService: IssuerService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly blockchainService: BlockchainService,
  ) { }

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

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị khóa hoặc không hoạt động.');
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

      if (!user.isActive) {
        throw new UnauthorizedException('Tài khoản đã bị khóa hoặc không hoạt động.');
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

  async generateMetaMaskNonce(walletAddress: string) {
    const nonce = crypto.randomUUID();
    const message = `Welcome to Certificate Verification Platform!\n\nSign this message to prove you own this wallet address.\n\nWallet: ${walletAddress.toLowerCase()}\nNonce: ${nonce}`;
    const tempToken = this.jwtService.sign(
      { walletAddress: walletAddress.toLowerCase(), nonce, message },
      { expiresIn: '5m' },
    );
    return { message, tempToken };
  }

  async verifyMetaMaskSignature(
    walletAddress: string,
    signature: string,
    tempToken: string,
  ): Promise<any> {
    let payload: any;
    try {
      payload = this.jwtService.verify(tempToken);
    } catch (e) {
      throw new UnauthorizedException(
        'Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.',
      );
    }

    if (!payload || !payload.walletAddress || !payload.message) {
      throw new UnauthorizedException('Token tạm thời không hợp lệ.');
    }

    if (payload.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new UnauthorizedException('Địa chỉ ví không khớp với yêu cầu.');
    }

    let recoveredAddress: string;
    try {
      recoveredAddress = verifyMessage(payload.message, signature);
    } catch (e) {
      throw new UnauthorizedException('Chữ ký không hợp lệ.');
    }

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new UnauthorizedException('Xác minh chữ ký ví thất bại.');
    }

    return payload;
  }

  async loginWithMetaMask(
    walletAddress: string,
    signature: string,
    tempToken: string,
  ): Promise<any> {
    await this.verifyMetaMaskSignature(walletAddress, signature, tempToken);

    const org = await this.issuerService.findByWalletAddress(walletAddress);
    if (!org) {
      throw new UnauthorizedException(
        'Địa chỉ ví này chưa được đăng ký cho tổ chức nào. Vui lòng đăng ký tài khoản mới.',
      );
    }

    const owner = await this.staffService.findOwnerByOrganization(
      org.organization_id,
    );
    if (!owner) {
      throw new UnauthorizedException(
        'Không tìm thấy tài khoản quản trị viên của tổ chức.',
      );
    }

    if (!owner.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị khóa hoặc không hoạt động.');
    }

    const { accessToken, refreshToken } = await this.generateTokens({
      sub: owner.staff_id,
      email: owner.email,
      name: owner.name,
      role: 'issuer',
      organization_id: org.organization_id,
    });

    return {
      id: owner.staff_id,
      email: owner.email,
      name: owner.name,
      role: 'issuer',
      accessToken,
      refreshToken,
    };
  }

  async registerWithMetaMask(dto: MetaMaskRegisterDto): Promise<any> {
    const { walletAddress, signature, tempToken, email, name, adminName } = dto;

    await this.verifyMetaMaskSignature(walletAddress, signature, tempToken);

    const existingOrgByWallet =
      await this.issuerService.findByWalletAddress(walletAddress);
    if (existingOrgByWallet) {
      throw new ConflictException(
        'Địa chỉ ví này đã được đăng ký cho tổ chức khác.',
      );
    }

    const existingOrgByEmail = await this.issuerService.findByEmail(email);
    if (existingOrgByEmail) {
      throw new ConflictException('Tổ chức với email này đã tồn tại.');
    }

    const existingStaff = await this.staffService.findByEmail(email);
    if (existingStaff) {
      throw new ConflictException('Email này đã được đăng ký.');
    }

    const organization = await this.issuerService.create(
      name,
      email,
      walletAddress,
    );

    // Automatically authorize this wallet address as an issuer on the blockchain smart contract
    try {
      if (this.blockchainService.isInitialized()) {
        await this.blockchainService.authorizeIssuer(walletAddress);
      }
    } catch (err) {
      // Log warning if blockchain authorization fails (e.g. node offline in dev)
      console.warn(`Could not authorize wallet ${walletAddress} on blockchain:`, err);
    }

    const randomPassword = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(randomPassword, SALT_ROUNDS);
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
}
