import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtAuthGuard } from './jwt.guard';

@ApiTags('auth')
@Controller('/api/v1')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('/auth/google')
  google(@Body() dto: GoogleLoginDto) {
    return this.auth.loginWithGoogleIdToken(dto.idToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/me')
  me(@Req() req: any) {
    return this.auth.me(req.user.userId);
  }
}
