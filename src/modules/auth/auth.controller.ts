import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import * as express from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { MetaMaskNonceDto } from './dto/metamask-nonce.dto';
import { MetaMaskLoginDto } from './dto/metamask-login.dto';
import { MetaMaskRegisterDto } from './dto/metamask-register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new issuer (school/organization) account',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Issuer registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<any> {
    const authResult = await this.authService.register(dto);

    res.cookie('refreshToken', authResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const { refreshToken, ...responseBody } = authResult;
    return responseBody;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate user (issuer/staff/student) and return JWT token',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<any> {
    const authResult = await this.authService.login(dto);

    res.cookie('refreshToken', authResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const { refreshToken, ...responseBody } = authResult;
    return responseBody;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh the access token using the HTTP-Only refresh token cookie',
  })
  @ApiResponse({
    status: 200,
    description: 'Access token refreshed successfully',
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing refresh token' })
  async refresh(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const refreshResult = await this.authService.refreshToken(refreshToken);

    res.cookie('refreshToken', refreshResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken: refreshResult.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log out user and clear refresh token cookie',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged out',
  })
  async logout(@Res({ passthrough: true }) res: express.Response) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return { message: 'Logged out successfully' };
  }

  @Post('metamask/nonce')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a challenge nonce for MetaMask authentication',
  })
  @ApiBody({ type: MetaMaskNonceDto })
  @ApiResponse({
    status: 200,
    description: 'Challenge message and temp token successfully generated',
  })
  async getMetaMaskNonce(@Body() dto: MetaMaskNonceDto): Promise<any> {
    return this.authService.generateMetaMaskNonce(dto.walletAddress);
  }

  @Post('admin/nonce')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a challenge nonce for System Administrator MetaMask authentication',
  })
  @ApiBody({ type: MetaMaskNonceDto })
  @ApiResponse({
    status: 200,
    description: 'Admin challenge message and temp token successfully generated',
  })
  async getAdminMetaMaskNonce(@Body() dto: MetaMaskNonceDto): Promise<any> {
    return this.authService.generateAdminMetaMaskNonce(dto.walletAddress);
  }

  @Post('metamask/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate issuer owner using MetaMask signature',
  })
  @ApiBody({ type: MetaMaskLoginDto })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    type: AuthResponseDto,
  })
  async loginWithMetaMask(
    @Body() dto: MetaMaskLoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<any> {
    const authResult = await this.authService.loginWithMetaMask(
      dto.walletAddress,
      dto.signature,
      dto.tempToken,
    );

    res.cookie('refreshToken', authResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const { refreshToken, ...responseBody } = authResult;
    return responseBody;
  }

  @Post('admin/login')
  @Post('admin/metamask/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate System Administrator using MetaMask signature against SystemAdmin DB table',
  })
  @ApiBody({ type: MetaMaskLoginDto })
  @ApiResponse({
    status: 200,
    description: 'System Admin successfully logged in',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Wallet address not authorized in SystemAdmin DB' })
  async loginAdminWithMetaMask(
    @Body() dto: MetaMaskLoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<any> {
    const authResult = await this.authService.loginAdminWithMetaMask(
      dto.walletAddress,
      dto.signature,
      dto.tempToken,
    );

    res.cookie('refreshToken', authResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { refreshToken, ...responseBody } = authResult;
    return responseBody;
  }

  @Post('metamask/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new issuer organization and owner using MetaMask',
  })
  @ApiBody({ type: MetaMaskRegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Issuer organization and owner registered successfully',
    type: AuthResponseDto,
  })
  async registerWithMetaMask(
    @Body() dto: MetaMaskRegisterDto,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<any> {
    const authResult = await this.authService.registerWithMetaMask(dto);

    res.cookie('refreshToken', authResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const { refreshToken, ...responseBody } = authResult;
    return responseBody;
  }
}
