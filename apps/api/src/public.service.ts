import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { TemplateRevision } from '@jianjian/contracts';
import { PrismaService } from './prisma.service';
import { hashShareToken } from './security';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private async resolve(token: string) {
    const share = await this.prisma.reportShare.findUnique({
      where: { tokenHash: hashShareToken(token, this.config.getOrThrow<string>('REPORT_SHARE_HASH_KEY')) },
      include: { report: { include: { tenant: true } } },
    });
    if (!share || share.status !== 'ACTIVE' || share.expiresAt <= new Date() || share.report.status !== 'PUBLISHED' || share.report.tenant.status !== 'ACTIVE') {
      throw new NotFoundException({ code: 'REPORT_UNAVAILABLE', message: '报告链接不存在、已过期或已撤销。' });
    }
    return share;
  }

  async getReport(token: string) {
    const share = await this.resolve(token);
    const snapshot = share.report.snapshot as unknown as { template: TemplateRevision } & Record<string, unknown>;
    const { id: _id, templateId: _templateId, sections, ...template } = snapshot.template;
    await this.prisma.auditEvent.create({ data: { tenantId: share.tenantId, action: 'report_share.accessed', resourceType: 'report', resourceId: share.reportId, requestId: randomUUID(), metadata: { shareId: share.id } } });
    return {
      ...snapshot,
      template: {
        ...template,
        sections: sections.map(({ guidance: _guidance, items, ...section }) => ({
          ...section,
          items: items.map(({ key, title }) => ({ key, title })),
        })),
      },
      reportNo: share.report.reportNo,
      publishedAt: share.report.publishedAt,
      expiresAt: share.expiresAt,
      access: 'READ_ONLY',
    };
  }

  async assertAssetAccess(token: string, assetId: string) {
    const share = await this.resolve(token);
    const evidence = await this.prisma.inspectionEvidence.findFirst({ where: { assetId, revisionId: share.report.revisionId, tenantId: share.tenantId } });
    if (!evidence) throw new NotFoundException({ code: 'ASSET_UNAVAILABLE', message: '图片不可用。' });
    return evidence;
  }
}
