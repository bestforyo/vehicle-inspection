import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash } from 'bcryptjs';
import { templateCatalog } from '@jianjian/templates';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async onApplicationBootstrap() {
    if (this.config.get('SEED_DEMO') !== 'true') return;
    await this.seed();
  }

  async seed() {
    const tenant = await this.prisma.tenant.upsert({
      where: { code: 'DEMO' },
      update: {},
      create: { name: '鉴见示范检测机构', code: 'DEMO', displayName: '鉴见检测', expiresAt: new Date('2030-12-31T23:59:59Z') },
    });
    const users = [
      { email: 'inspector@demo.jianjian.cn', name: '林检测', role: 'INSPECTOR', password: this.config.getOrThrow('DEMO_INSPECTOR_PASSWORD') },
      { email: 'admin@demo.jianjian.cn', name: '周管理员', role: 'ORG_ADMIN', password: this.config.getOrThrow('DEMO_ADMIN_PASSWORD') },
    ];
    for (const entry of users) {
      const user = await this.prisma.user.upsert({
        where: { email: entry.email },
        update: { tenantId: tenant.id, role: entry.role },
        create: { email: entry.email, displayName: entry.name, role: entry.role, tenantId: tenant.id, passwordHash: await hash(entry.password, 12) },
      });
      await this.prisma.membership.upsert({
        where: { userId: user.id },
        update: { role: entry.role, tenantId: tenant.id, status: 'ACTIVE' },
        create: { userId: user.id, tenantId: tenant.id, role: entry.role },
      });
    }
    await this.prisma.user.upsert({
      where: { email: 'platform@demo.jianjian.cn' },
      update: { role: 'PLATFORM_SUPER_ADMIN', tenantId: null },
      create: { email: 'platform@demo.jianjian.cn', displayName: '平台运营', role: 'PLATFORM_SUPER_ADMIN', passwordHash: await hash(this.config.getOrThrow('DEMO_PLATFORM_PASSWORD'), 12) },
    });
    for (const definition of templateCatalog) {
      await this.prisma.standardRevision.upsert({
        where: { id: definition.standardRevisionId },
        update: {},
        create: { id: definition.standardRevisionId, standardCode: definition.standard, title: definition.standardTitle, versionLabel: definition.standardVersion, scope: '产品交互示范，不构成正式标准核验或评估结论。' },
      });
      await this.prisma.template.upsert({
        where: { id: definition.templateId },
        update: { packageName: definition.packageName },
        create: { id: definition.templateId, tenantId: tenant.id, standardCode: definition.standard, kind: definition.kind, packageCode: definition.packageCode, packageName: definition.packageName },
      });
      await this.prisma.templateRevision.upsert({
        where: { id: definition.id },
        update: { schema: definition as unknown as Prisma.InputJsonValue },
        create: { id: definition.id, tenantId: tenant.id, templateId: definition.templateId, revisionNumber: definition.revisionNumber, standardRevisionId: definition.standardRevisionId, schema: definition as unknown as Prisma.InputJsonValue, status: 'PUBLISHED', publishedAt: new Date() },
      });
    }
    this.logger.log('示范机构、账号和八套模板已就绪');
  }
}
