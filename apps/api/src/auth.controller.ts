import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthService, CurrentUser, permissionsForRole, type AuthUser } from './auth';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @HttpCode(200)
  @Post('login')
  login(@Body() body: { email?: string; password?: string }) {
    return this.auth.login(body.email ?? '', body.password ?? '');
  }

  @HttpCode(200)
  @Post('wechat/session')
  wechat(@Body() body: { code?: string }) {
    return this.auth.wechatSession(body.code ?? '');
  }

  @HttpCode(200)
  @Post('wechat/link')
  @UseGuards(AuthGuard)
  linkWechat(@CurrentUser() user: AuthUser, @Body() body: { code?: string }) {
    return this.auth.wechatSession(body.code ?? '', user.id);
  }

  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() body: { refreshToken?: string }) {
    return this.auth.refresh(body.refreshToken ?? '');
  }

  @HttpCode(200)
  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user.id);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('me/workspaces')
  @UseGuards(AuthGuard)
  workspaces(@CurrentUser() user: AuthUser) {
    return user.tenantId ? [{ tenantId: user.tenantId, tenantName: user.tenantName, role: user.role }] : [];
  }

  @Get('me/permissions')
  @UseGuards(AuthGuard)
  permissions(@CurrentUser() user: AuthUser) {
    return { role: user.role, permissions: permissionsForRole(user.role) };
  }
}
