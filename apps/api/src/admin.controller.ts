import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import type { TenantRole, TemplateRevision } from '@jianjian/contracts';
import { AuthGuard, CurrentUser, type AuthUser } from './auth';
import { AdminService } from './admin.service';

@Controller('api/v1/admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('tenant')
  tenant(@CurrentUser() user: AuthUser) { return this.admin.tenant(user); }

  @Patch('tenant')
  updateTenant(@CurrentUser() user: AuthUser, @Body() body: { name?: string; displayName?: string; logoText?: string; disclaimer?: string }) { return this.admin.updateTenant(user, body); }

  @Get('members')
  members(@CurrentUser() user: AuthUser) { return this.admin.members(user); }

  @Post('members/invitations')
  invite(@CurrentUser() user: AuthUser, @Body() body: { email?: string; displayName?: string; password?: string; role?: TenantRole }) { return this.admin.inviteMember(user, body); }

  @Patch('members/:memberId')
  updateMember(@CurrentUser() user: AuthUser, @Param('memberId') memberId: string, @Body() body: { role?: TenantRole; status?: 'ACTIVE' | 'DISABLED' }) { return this.admin.updateMember(user, memberId, body); }

  @Get('audit-events')
  audits(@CurrentUser() user: AuthUser) { return this.admin.audits(user); }

  @Get('templates')
  templates(@CurrentUser() user: AuthUser) { return this.admin.templates(user); }

  @Post('templates/:templateId/revisions')
  clone(@CurrentUser() user: AuthUser, @Param('templateId') templateId: string) { return this.admin.cloneTemplate(user, templateId); }

  @Put('templates/:templateId/revisions/:revisionId/schema')
  schema(@CurrentUser() user: AuthUser, @Param('templateId') templateId: string, @Param('revisionId') revisionId: string, @Body() body: { schema: TemplateRevision }) { return this.admin.updateTemplateSchema(user, templateId, revisionId, body.schema); }

  @Post('templates/:templateId/revisions/:revisionId/submit')
  submit(@CurrentUser() user: AuthUser, @Param('templateId') templateId: string, @Param('revisionId') revisionId: string) { return this.admin.transitionTemplate(user, templateId, revisionId, 'submit'); }

  @Post('templates/:templateId/revisions/:revisionId/publish')
  publish(@CurrentUser() user: AuthUser, @Param('templateId') templateId: string, @Param('revisionId') revisionId: string, @Body() body: { professionalApprovalConfirmed?: boolean }) { return this.admin.transitionTemplate(user, templateId, revisionId, 'publish', body.professionalApprovalConfirmed); }
}
