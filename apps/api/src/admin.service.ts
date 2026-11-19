import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { TenantRole, TemplateRevision } from '@jianjian/contracts';
import { templateCatalog } from '@jianjian/templates';
import { PrismaService } from './prisma.service';
import type { AuthUser } from './auth';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private orgAdmin(user: AuthUser) {
    if (user.role !== 'ORG_ADMIN' || !user.tenantId) throw new ForbiddenException({ code: 'ADMIN_REQUIRED', message: '仅机构管理员可执行此操作。' });
    return user.tenantId;
  }

  private platform(user: AuthUser) {
    if (!['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATOR'].includes(user.role)) throw new ForbiddenException({ code: 'PLATFORM_PERMISSION_REQUIRED', message: '当前账号无平台运营权限。' });
  }

  async tenant(user: AuthUser) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: this.orgAdmin(user) } });
    return tenant;
  }

  async updateTenant(user: AuthUser, body: { name?: string; displayName?: string; logoText?: string; disclaimer?: string }) {
    const tenantId = this.orgAdmin(user);
    const current = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!current) throw new NotFoundException('机构不存在。');
    const settings = { ...(current.settings as Record<string, unknown>), ...(body.disclaimer !== undefined ? { disclaimer: body.disclaimer.trim().slice(0, 5000) } : {}) };
    const tenant = await this.prisma.tenant.update({ where: { id: tenantId }, data: {
      ...(body.name?.trim() ? { name: body.name.trim().slice(0, 100) } : {}),
      ...(body.displayName?.trim() ? { displayName: body.displayName.trim().slice(0, 100) } : {}),
      ...(body.logoText?.trim() ? { logoText: body.logoText.trim().slice(0, 2) } : {}),
      settings,
    } });
    await this.audit(tenantId, user.id, 'tenant.brand.updated', 'tenant', tenantId);
    return tenant;
  }

  async members(user: AuthUser) {
    const tenantId = this.orgAdmin(user);
    return this.prisma.membership.findMany({ where: { tenantId }, include: { user: { select: { id: true, email: true, displayName: true, status: true, createdAt: true } } }, orderBy: { joinedAt: 'asc' } });
  }

  async inviteMember(user: AuthUser, body: { email?: string; displayName?: string; password?: string; role?: TenantRole }) {
    const tenantId = this.orgAdmin(user);
    if (!body.email?.includes('@') || !body.displayName?.trim() || !body.password || body.password.length < 10 || !['INSPECTOR', 'ORG_ADMIN'].includes(body.role ?? '')) {
      throw new BadRequestException({ code: 'MEMBER_INPUT_INVALID', message: '请提供有效邮箱、姓名、至少10位初始密码和检测师/机构管理员角色。' });
    }
    const email = body.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException({ code: 'MEMBER_EMAIL_EXISTS', message: '该邮箱已有平台账号，请通过工作空间邀请流程关联。' });
    const member = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, displayName: body.displayName!.trim(), passwordHash: await hash(body.password!, 12), role: body.role!, tenantId } });
      await tx.membership.create({ data: { tenantId, userId: created.id, role: body.role! } });
      await this.audit(tenantId, user.id, 'membership.invited', 'membership', created.id, { role: body.role }, tx);
      return created;
    });
    return { id: member.id, email: member.email, displayName: member.displayName, role: body.role };
  }

  async updateMember(user: AuthUser, memberId: string, body: { role?: TenantRole; status?: 'ACTIVE' | 'DISABLED' }) {
    const tenantId = this.orgAdmin(user);
    const membership = await this.prisma.membership.findFirst({ where: { id: memberId, tenantId }, include: { user: true } });
    if (!membership) throw new NotFoundException('成员不存在。');
    if (membership.userId === user.id && body.status === 'DISABLED') throw new BadRequestException('不能停用当前登录的管理员本人。');
    if (body.role && !['INSPECTOR', 'ORG_ADMIN'].includes(body.role)) throw new BadRequestException('机构仅支持检测师和机构管理员两种业务角色。');
    if ((body.status === 'DISABLED' || body.role === 'INSPECTOR') && membership.role === 'ORG_ADMIN') {
      const admins = await this.prisma.membership.count({ where: { tenantId, role: 'ORG_ADMIN', status: 'ACTIVE', id: { not: memberId } } });
      if (!admins) throw new ConflictException({ code: 'LAST_ADMIN_REQUIRED', message: '机构至少需要保留一位有效管理员。' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({ where: { id: memberId }, data: { ...(body.role ? { role: body.role } : {}), ...(body.status ? { status: body.status } : {}) } });
      await tx.user.update({ where: { id: membership.userId }, data: { ...(body.role ? { role: body.role } : {}), ...(body.status ? { status: body.status } : {}) } });
      if (body.status === 'DISABLED') await tx.authSession.updateMany({ where: { userId: membership.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit(tenantId, user.id, body.status === 'DISABLED' ? 'membership.disabled' : 'role.changed', 'membership', memberId, { role: body.role, status: body.status }, tx);
    });
    return { success: true };
  }

  async audits(user: AuthUser) {
    const tenantId = this.orgAdmin(user);
    return this.prisma.auditEvent.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, action: true, resourceType: true, resourceId: true, actorId: true, result: true, metadata: true, createdAt: true } });
  }

  async templates(user: AuthUser) {
    const tenantId = this.orgAdmin(user);
    return this.prisma.template.findMany({ where: { tenantId }, include: { revisions: { orderBy: { revisionNumber: 'desc' } }, _count: { select: { revisions: true } } }, orderBy: [{ standardCode: 'asc' }, { packageCode: 'asc' }] });
  }

  async cloneTemplate(user: AuthUser, templateId: string) {
    const tenantId = this.orgAdmin(user);
    const latest = await this.prisma.templateRevision.findFirst({ where: { templateId, tenantId }, orderBy: { revisionNumber: 'desc' } });
    if (!latest) throw new NotFoundException('模板不存在。');
    const schema = structuredClone(latest.schema as unknown as TemplateRevision);
    const id = randomUUID();
    schema.id = id;
    schema.revisionNumber = latest.revisionNumber + 1;
    schema.status = 'DRAFT';
    const revision = await this.prisma.templateRevision.create({ data: { id, tenantId, templateId, revisionNumber: schema.revisionNumber, standardRevisionId: latest.standardRevisionId, schema: schema as unknown as Prisma.InputJsonValue, status: 'DRAFT' } });
    await this.audit(tenantId, user.id, 'template.revision.created', 'template', templateId, { revisionId: id });
    return revision;
  }

  async updateTemplateSchema(user: AuthUser, templateId: string, revisionId: string, schema: TemplateRevision) {
    const tenantId = this.orgAdmin(user);
    this.validateSchema(schema);
    const revision = await this.prisma.templateRevision.findFirst({ where: { id: revisionId, templateId, tenantId, status: 'DRAFT' } });
    if (!revision) throw new ConflictException('只有未发布的草稿修订可以编辑。');
    schema.id = revisionId;
    schema.templateId = templateId;
    schema.revisionNumber = revision.revisionNumber;
    schema.status = 'DRAFT';
    await this.prisma.templateRevision.update({ where: { id: revisionId }, data: { schema: schema as unknown as Prisma.InputJsonValue } });
    return { success: true };
  }

  async transitionTemplate(user: AuthUser, templateId: string, revisionId: string, action: 'submit' | 'publish', professionalApprovalConfirmed?: boolean) {
    const tenantId = this.orgAdmin(user);
    const revision = await this.prisma.templateRevision.findFirst({ where: { id: revisionId, templateId, tenantId } });
    if (!revision) throw new NotFoundException('模板修订不存在。');
    if (action === 'submit') {
      if (revision.status !== 'DRAFT') throw new ConflictException('当前修订不是草稿状态。');
      await this.prisma.templateRevision.update({ where: { id: revisionId }, data: { status: 'PROFESSIONAL_REVIEW' } });
    } else {
      if (revision.status !== 'PROFESSIONAL_REVIEW' || professionalApprovalConfirmed !== true) throw new BadRequestException({ code: 'PROFESSIONAL_APPROVAL_REQUIRED', message: '发布前必须完成专业复核并明确确认。' });
      await this.prisma.$transaction(async (tx) => {
        await tx.templateRevision.update({ where: { id: revisionId }, data: { status: 'PUBLISHED', publishedAt: new Date(), publishedBy: user.id } });
        await tx.template.update({ where: { id: templateId }, data: { status: 'PUBLISHED' } });
      });
    }
    await this.audit(tenantId, user.id, action === 'publish' ? 'template.revision.published' : 'template.revision.submitted', 'template', templateId, { revisionId, professionalApprovalConfirmed });
    return { success: true };
  }

  private validateSchema(schema: TemplateRevision) {
    if (!schema.sections?.length) throw new BadRequestException('模板至少需要一个章节。');
    const keys = new Set<string>();
    for (const section of schema.sections) {
      if (!section.key || !section.title || !section.items.length) throw new BadRequestException('每个章节必须包含键、标题和至少一个检测项目。');
      for (const item of section.items) {
        if (!item.key || !item.title || keys.has(item.key) || item.answerType !== 'SINGLE_CHOICE' || item.options.length < 2) throw new BadRequestException('检测项目键不可重复，且必须包含标题和至少两个选项。');
        keys.add(item.key);
        if (new Set(item.options.map((option) => option.value)).size !== item.options.length) throw new BadRequestException(`“${item.title}”存在重复选项。`);
      }
    }
  }

  async platformTenants(user: AuthUser) {
    this.platform(user);
    const tenants = await this.prisma.tenant.findMany({ include: { _count: { select: { memberships: true, orders: true, reports: true } } }, orderBy: { createdAt: 'desc' } });
    return tenants;
  }

  async platformStats(user: AuthUser) {
    this.platform(user);
    const [tenants, activeTenants, orders, reports] = await Promise.all([this.prisma.tenant.count(), this.prisma.tenant.count({ where: { status: 'ACTIVE' } }), this.prisma.order.count(), this.prisma.report.count()]);
    return { tenants, activeTenants, orders, reports, service: { api: 'UP', queue: 'NOT_CONFIGURED', objectStorage: 'LOCAL_PRIVATE' } };
  }

  async createTenant(user: AuthUser, body: { name?: string; code?: string; adminEmail?: string; adminName?: string; initialPassword?: string; planName?: string; expiresAt?: string }) {
    this.platform(user);
    if (!body.name?.trim() || !/^[A-Z0-9_-]{2,30}$/.test(body.code ?? '') || !body.adminEmail?.includes('@') || !body.adminName?.trim() || !body.initialPassword || body.initialPassword.length < 10) {
      throw new BadRequestException({ code: 'TENANT_INPUT_INVALID', message: '请填写机构名称、唯一编码、首管理员邮箱/姓名和至少10位初始密码。' });
    }
    const code = body.code!;
    const email = body.adminEmail!.toLowerCase().trim();
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: body.name!.trim(), code, displayName: body.name!.trim(), planName: body.planName ?? '专业版', expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } });
      const admin = await tx.user.create({ data: { email, displayName: body.adminName!.trim(), passwordHash: await hash(body.initialPassword!, 12), role: 'ORG_ADMIN', tenantId: tenant.id } });
      await tx.membership.create({ data: { tenantId: tenant.id, userId: admin.id, role: 'ORG_ADMIN' } });
      for (const definition of templateCatalog) {
        await tx.standardRevision.upsert({ where: { id: definition.standardRevisionId }, update: {}, create: { id: definition.standardRevisionId, standardCode: definition.standard, title: definition.standardTitle, versionLabel: definition.standardVersion, scope: '产品交互示范，不构成正式标准核验或评估结论。' } });
        const templateId = `template-${code.toLowerCase()}-${definition.packageCode.toLowerCase()}-${definition.standard.toLowerCase()}`;
        await tx.template.create({ data: { id: templateId, tenantId: tenant.id, standardCode: definition.standard, kind: definition.kind, packageCode: definition.packageCode, packageName: definition.packageName } });
        const schema = structuredClone(definition);
        schema.id = randomUUID();
        schema.templateId = templateId;
        await tx.templateRevision.create({ data: { id: schema.id, tenantId: tenant.id, templateId, revisionNumber: 1, standardRevisionId: definition.standardRevisionId, schema: schema as unknown as Prisma.InputJsonValue, status: 'PUBLISHED', publishedAt: new Date(), publishedBy: admin.id } });
      }
      await this.audit(tenant.id, user.id, 'tenant.created', 'tenant', tenant.id, { code }, tx);
      return { id: tenant.id, name: tenant.name, code: tenant.code, admin: { email: admin.email, displayName: admin.displayName } };
    });
    return result;
  }

  async updateTenantStatus(user: AuthUser, tenantId: string, action: 'activate' | 'suspend', reason?: string) {
    this.platform(user);
    if (!reason?.trim()) throw new BadRequestException({ code: 'SUPPORT_REASON_REQUIRED', message: '机构状态变更必须填写原因或工单号。' });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('机构不存在。');
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { status: action === 'activate' ? 'ACTIVE' : 'SUSPENDED' } });
    await this.audit(tenantId, user.id, action === 'activate' ? 'tenant.activated' : 'tenant.suspended', 'tenant', tenantId, { reason: reason.trim() });
    return { success: true };
  }

  async platformAudits(user: AuthUser) {
    this.platform(user);
    return this.prisma.auditEvent.findMany({ where: { action: { in: ['tenant.created', 'tenant.activated', 'tenant.suspended'] } }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, tenantId: true, actorId: true, action: true, resourceType: true, resourceId: true, metadata: true, createdAt: true } });
  }

  private async audit(tenantId: string, actorId: string, action: string, resourceType: string, resourceId: string, metadata: Record<string, unknown> = {}, tx?: Prisma.TransactionClient) {
    await (tx ?? this.prisma).auditEvent.create({ data: { tenantId, actorId, action, resourceType, resourceId, requestId: randomUUID(), metadata: metadata as Prisma.InputJsonValue } });
  }
}
