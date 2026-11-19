import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { compare } from 'bcryptjs';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import type { Role, SessionUser } from '@jianjian/contracts';
import { PrismaService } from './prisma.service';

export interface AuthUser extends SessionUser {
  email: string;
}

interface AccessPayload {
  sub: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: '请先登录。' });
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token);
      if (payload.type !== 'access') throw new Error('wrong token type');
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { tenant: true } });
      if (!user || user.status !== 'ACTIVE') throw new Error('disabled');
      if (user.tenantId && user.tenant?.status !== 'ACTIVE') throw new Error('tenant disabled');
      request.user = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role as Role,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name ?? null,
      };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: '登录已失效，请重新登录。' });
    }
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  return context.switchToHttp().getRequest<{ user: AuthUser }>().user;
});

export function permissionsForRole(role: Role): string[] {
  if (role === 'PLATFORM_SUPER_ADMIN' || role === 'PLATFORM_OPERATOR') return ['platform.tenant.manage', 'platform.subscription.manage', 'platform.audit.read'];
  if (role === 'ORG_ADMIN') return ['tenant.read', 'tenant.update', 'member.read', 'member.invite', 'member.disable', 'role.manage', 'template.read', 'template.update', 'template.publish', 'order.create', 'order.read.tenant', 'inspection.edit.own', 'inspection.submit', 'review.queue.read', 'review.approve', 'review.return', 'report.read.tenant', 'report.share.create', 'report.share.revoke', 'audit.read'];
  return ['template.read', 'order.create', 'order.read.own', 'inspection.edit.own', 'inspection.submit', 'inspection.resubmit', 'report.read.own', 'report.share.create', 'vehicle.lookup'];
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() }, include: { tenant: true } });
    if (!user || user.status !== 'ACTIVE' || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: '账号或密码不正确。' });
    }
    if (user.tenantId && user.tenant?.status !== 'ACTIVE') {
      throw new UnauthorizedException({ code: 'TENANT_DISABLED', message: '机构已停用，请联系平台运营。' });
    }
    return this.issueTokens(user.id);
  }

  async wechatSession(code: string, linkUserId?: string) {
    const appId = this.config.get<string>('WECHAT_APP_ID');
    const appSecret = this.config.get<string>('WECHAT_APP_SECRET');
    if (!appId || !appSecret) throw new BadRequestException({ code: 'WECHAT_NOT_CONFIGURED', message: '微信登录须在服务端配置正式小程序凭据后启用。' });
    if (!code) throw new BadRequestException({ code: 'WECHAT_CODE_REQUIRED', message: '微信登录凭据无效，请重试。' });
    let identity: { openid?: string; errcode?: number };
    try {
      const query = new URLSearchParams({ appid: appId, secret: appSecret, js_code: code, grant_type: 'authorization_code' });
      const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query}`, { signal: AbortSignal.timeout(8000) });
      identity = await response.json() as { openid?: string; errcode?: number };
    } catch {
      throw new UnauthorizedException({ code: 'WECHAT_PROVIDER_UNAVAILABLE', message: '微信身份服务暂时不可用，请稍后重试。' });
    }
    if (!identity.openid || identity.errcode) throw new UnauthorizedException({ code: 'WECHAT_CODE_INVALID', message: '微信登录凭据已失效，请重新登录。' });
    const wechatOpenidHash = createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(`${appId}:${identity.openid}`).digest('hex');
    let user = await this.prisma.user.findUnique({ where: { wechatOpenidHash }, include: { tenant: true } });
    if (!user && linkUserId) {
      user = await this.prisma.user.update({ where: { id: linkUserId }, data: { wechatOpenidHash }, include: { tenant: true } });
    }
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException({ code: 'WECHAT_NOT_LINKED', message: '该微信尚未关联机构成员，请联系机构管理员。' });
    if (user.tenantId && user.tenant?.status !== 'ACTIVE') throw new UnauthorizedException({ code: 'TENANT_DISABLED', message: '机构已停用，请联系平台运营。' });
    return this.issueTokens(user.id);
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException({ code: 'SESSION_INVALID', message: '登录已失效。' });
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(refreshToken);
      if (payload.type !== 'refresh') throw new Error('wrong token type');
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      const session = await this.prisma.authSession.findFirst({ where: { userId: payload.sub, refreshTokenHash: tokenHash, revokedAt: null, expiresAt: { gt: new Date() } } });
      if (!session) throw new Error('expired');
      await this.prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return this.issueTokens(payload.sub);
    } catch {
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: '登录已失效，请重新登录。' });
    }
  }

  async logout(userId: string) {
    await this.prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  private async issueTokens(userId: string) {
    const nonce = `${randomBytes(32).toString('base64url')}.${randomBytes(16).toString('base64url')}`;
    const refreshToken = await this.jwt.signAsync({ sub: userId, type: 'refresh', nonce }, { expiresIn: '30d' });
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.authSession.create({ data: { userId, refreshTokenHash, expiresAt: new Date(Date.now() + 30 * 86400000) } });
    return {
      accessToken: await this.jwt.signAsync({ sub: userId, type: 'access' }, { expiresIn: '2h' }),
      refreshToken,
      expiresIn: 7200,
    };
  }
}
