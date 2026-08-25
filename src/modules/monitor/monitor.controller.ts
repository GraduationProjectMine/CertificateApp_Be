import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MonitorService } from './monitor.service';
import { IssuerService } from '../issuer/issuer.service';
import { BlockchainService } from '../../core/blockchain/blockchain.service';

export class AdminCreateIssuerDto {
  @ApiProperty({ example: 'Đại học Bách Khoa Hà Nội' })
  @IsString()
  @IsNotEmpty()
  organization_name: string;

  @ApiProperty({ example: 'contact@hust.edu.vn' })
  @IsEmail()
  @IsNotEmpty()
  contact_email: string;

  @ApiProperty({ example: '0x1234...', required: false })
  @IsString()
  @IsOptional()
  wallet_address?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  is_verified?: boolean;
}

export class AdminVerifyIssuerDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  is_verified: boolean;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  sync_onchain?: boolean;
}

@ApiTags('system')
@ApiBearerAuth()
@Controller('system')
@UseGuards(JwtAuthGuard)
export class MonitorController {
  private readonly logger = new Logger(MonitorController.name);

  constructor(
    private readonly monitorService: MonitorService,
    private readonly issuerService: IssuerService,
    private readonly blockchainService: BlockchainService,
  ) {}

  private checkSuperAdmin(req: AuthenticatedRequest) {
    const user = req.user;
    if (user?.role !== 'super_admin') {
      throw new ForbiddenException(
        'Only System Administrators (super_admin) can perform this action',
      );
    }
  }

  @Get('monitor')
  @ApiOperation({
    summary: 'Get blockchain, wallet and IPFS health with recent transactions',
  })
  getOverview(@Req() req: AuthenticatedRequest) {
    this.checkSuperAdmin(req);
    return this.monitorService.getOverview();
  }

  @Get('issuers')
  @ApiOperation({
    summary:
      'Get all issuing organizations with on-chain authorization status (System Admin)',
  })
  async getAllIssuers(@Req() req: AuthenticatedRequest) {
    this.checkSuperAdmin(req);
    const issuers = await this.issuerService.findAll();

    return Promise.all(
      issuers.map(async (org) => {
        let is_onchain_authorized = false;
        if (org.wallet_address && this.blockchainService.isInitialized()) {
          is_onchain_authorized =
            await this.blockchainService.isIssuerAuthorized(org.wallet_address);
        }
        return {
          ...org,
          is_onchain_authorized,
        };
      }),
    );
  }

  @Post('issuers')
  @ApiOperation({
    summary: 'Create a new issuing organization (System Admin)',
  })
  async createIssuer(@Req() req: AuthenticatedRequest, @Body() dto: AdminCreateIssuerDto) {
    this.checkSuperAdmin(req);
    if (!dto.organization_name || !dto.contact_email) {
      throw new BadRequestException(
        'Organization name and contact email are required',
      );
    }
    const existing = await this.issuerService.findByEmail(dto.contact_email);
    if (existing) {
      throw new BadRequestException(
        'Organization with this contact email already exists',
      );
    }

    const org = await this.issuerService.create(
      dto.organization_name,
      dto.contact_email,
      dto.wallet_address,
    );

    if (dto.is_verified) {
      const updated = await this.issuerService.update(org.organization_id, {
        is_verified: true,
      });
      if (org.wallet_address && this.blockchainService.isInitialized()) {
        try {
          await this.blockchainService.authorizeIssuer(org.wallet_address);
        } catch (err) {
          this.logger.warn(
            `Failed to authorize new issuer on blockchain: ${err.message}`,
          );
        }
      }
      return updated;
    }

    return org;
  }

  @Put('issuers/:id/verify')
  @ApiOperation({
    summary:
      'Update issuer verification and sync Smart Contract authorization on-chain (System Admin)',
  })
  async updateIssuerVerification(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AdminVerifyIssuerDto,
  ) {
    this.checkSuperAdmin(req);
    const updated = await this.issuerService.update(id, {
      is_verified: dto.is_verified,
    });

    // Sync on-chain authorization if wallet_address is configured
    if (updated.wallet_address && this.blockchainService.isInitialized()) {
      try {
        if (dto.is_verified) {
          const isAuth = await this.blockchainService.isIssuerAuthorized(
            updated.wallet_address,
          );
          if (!isAuth) {
            await this.blockchainService.authorizeIssuer(
              updated.wallet_address,
            );
          }
        } else {
          const isAuth = await this.blockchainService.isIssuerAuthorized(
            updated.wallet_address,
          );
          if (isAuth) {
            await this.blockchainService.deauthorizeIssuer(
              updated.wallet_address,
            );
          }
        }
      } catch (err) {
        this.logger.warn(`On-chain authorization sync error: ${err.message}`);
      }
    }

    let is_onchain_authorized = false;
    if (updated.wallet_address && this.blockchainService.isInitialized()) {
      is_onchain_authorized = await this.blockchainService.isIssuerAuthorized(
        updated.wallet_address,
      );
    }

    return {
      ...updated,
      is_onchain_authorized,
    };
  }

  @Delete('issuers/:id')
  @ApiOperation({
    summary:
      'Soft-delete issuing organization (changes status to unverified and revokes on-chain) (System Admin)',
  })
  async deleteIssuer(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    this.checkSuperAdmin(req);
    const result = await this.issuerService.delete(id);

    if (
      result.organization.wallet_address &&
      this.blockchainService.isInitialized()
    ) {
      try {
        const isAuth = await this.blockchainService.isIssuerAuthorized(
          result.organization.wallet_address,
        );
        if (isAuth) {
          await this.blockchainService.deauthorizeIssuer(
            result.organization.wallet_address,
          );
        }
      } catch (err) {
        this.logger.warn(
          `On-chain deauthorization error during soft delete: ${err.message}`,
        );
      }
    }

    return result;
  }
}
