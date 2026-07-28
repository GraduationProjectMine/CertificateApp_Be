import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShareService } from './share.service';
import { IsNumber, IsOptional, IsArray, IsString, Min, Max } from 'class-validator';

class CreateShareDto {
  @IsString()
  certificate_id: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expires_in_days?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scope?: string[];
}

@ApiTags('share')
@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Student] Create a shareable link for a certificate' })
  @ApiBody({ type: CreateShareDto })
  async createShare(@Req() req: Request, @Body() body: CreateShareDto) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can create share links');
    return this.shareService.createShareLink(user.sub, body.certificate_id, {
      expiresInDays: body.expires_in_days,
      scope: body.scope,
    });
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '[Student] List all active share links' })
  async getShares(@Req() req: Request) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can view share links');
    return this.shareService.getActiveShares(user.sub);
  }

  @Get('cert/:certId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '[Student] Get all shares for a specific certificate' })
  async getSharesByCert(
    @Req() req: Request,
    @Param('certId') certId: string,
  ) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can view share links');
    return this.shareService.getSharesByCert(user.sub, certId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Student] Revoke a share link' })
  async revokeShare(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can revoke share links');
    await this.shareService.revokeShare(id, user.sub);
    return { message: 'Share link revoked successfully' };
  }

  @Get('verify/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Public] Verify a credential share link' })
  async verifyShare(@Param('token') token: string) {
    return this.shareService.verifyShareToken(token);
  }
}
