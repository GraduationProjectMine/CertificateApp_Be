import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import {
  LoginDto,
  LoginMetamaskNonceDto,
  LoginMetamaskDto,
  RegisterDto,
  LinkWalletNonceDto,
  LinkWalletDto,
  AuthResponseDto,
  NonceResponseDto,
  RegisterInstitutionDto,
  GoogleLoginDto,
} from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('register')
  @ApiResponse({
    status: 201,
    description: 'Registration successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register-institution')
  @ApiResponse({
    status: 201,
    description: 'Institution registration submitted',
  })
  @ApiResponse({ status: 409, description: 'Already exists' })
  async registerInstitution(@Body() dto: RegisterInstitutionDto) {
    return this.authService.registerInstitution(dto);
  }

  @Post('google')
  @ApiResponse({
    status: 200,
    description: 'Google login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  async loginGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto.credential);
  }

  @Post('login-metamask/nonce')
  @ApiResponse({
    status: 200,
    description: 'Nonce generated',
    type: NonceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Wallet not linked' })
  async getMetamaskLoginNonce(@Body() dto: LoginMetamaskNonceDto) {
    return this.authService.getMetamaskLoginNonce(dto.walletAddress);
  }

  @Post('login-metamask')
  @ApiResponse({
    status: 200,
    description: 'MetaMask login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Wallet not linked' })
  async loginMetamask(@Body() dto: LoginMetamaskDto) {
    return this.authService.loginMetamask(dto.walletAddress, dto.signature);
  }

  @Post('link-wallet/nonce')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Nonce generated',
    type: NonceResponseDto,
  })
  async getLinkWalletNonce(@Req() req: any, @Body() dto: LinkWalletNonceDto) {
    return this.authService.getLinkWalletNonce(
      req.user.userId,
      dto.walletAddress,
    );
  }

  @Post('link-wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Wallet linked successfully',
    type: AuthResponseDto,
  })
  async linkWallet(@Req() req: any, @Body() dto: LinkWalletDto) {
    return this.authService.linkWallet(
      req.user.userId,
      dto.walletAddress,
      dto.signature,
    );
  }

  @Post('unlink-wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Wallet unlinked' })
  async unlinkWallet(@Req() req: any) {
    return this.authService.unlinkWallet(req.user.userId);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Current user profile' })
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }
}
