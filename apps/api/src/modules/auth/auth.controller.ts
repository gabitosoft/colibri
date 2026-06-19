import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SsoExchangeDto } from './dto/sso-exchange.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }

  @Post('sso/exchange')
  ssoExchange(@Body() dto: SsoExchangeDto) {
    return this.service.ssoExchange(dto.ticket);
  }

  // SSO handoff landing: the portal redirects here with a one-time ticket.
  // We exchange it server-to-server, plant a JS-readable cookie on the shared
  // domain, and send the browser to the app — no token ever touches the URL.
  @Get('callback')
  async ssoCallback(
    @Query('ticket') ticket: string,
    @Res() res: Response,
  ) {
    const { accessToken } = await this.service.ssoExchange(ticket);

    const isProd = this.config.get('NODE_ENV') === 'production';
    const domain = this.config.get<string>('COOKIE_DOMAIN', '');
    const appOrigin = this.config.get<string>('APP_ORIGIN', 'http://localhost:5173');

    res.cookie('token', accessToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      ...(domain ? { domain } : {}),
    });

    res.redirect(`${appOrigin}/devices`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
