import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, type AuthUser } from './auth';
import { AdminService } from './admin.service';

@Controller('api/v1/platform')
@UseGuards(AuthGuard)
export class PlatformController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats(@CurrentUser() user: AuthUser) { return this.admin.platformStats(user); }

  @Get('tenants')
  tenants(@CurrentUser() user: AuthUser) { return this.admin.platformTenants(user); }

  @Post('tenants')
  create(@CurrentUser() user: AuthUser, @Body() body: { name?: string; code?: string; adminEmail?: string; adminName?: string; initialPassword?: string; planName?: string; expiresAt?: string }) { return this.admin.createTenant(user, body); }

  @Post('tenants/:tenantId/activate')
  activate(@CurrentUser() user: AuthUser, @Param('tenantId') tenantId: string, @Body() body: { reason?: string }) { return this.admin.updateTenantStatus(user, tenantId, 'activate', body.reason); }

  @Post('tenants/:tenantId/suspend')
  suspend(@CurrentUser() user: AuthUser, @Param('tenantId') tenantId: string, @Body() body: { reason?: string }) { return this.admin.updateTenantStatus(user, tenantId, 'suspend', body.reason); }

  @Get('audit-events')
  audits(@CurrentUser() user: AuthUser) { return this.admin.platformAudits(user); }
}
