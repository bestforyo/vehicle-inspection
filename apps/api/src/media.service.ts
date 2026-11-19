import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { StorageService } from './storage.service';
import type { InspectionAnswer, TemplateRevision } from '@jianjian/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import type { AuthUser } from './auth';

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly storage: StorageService) {}

  async upload(user: AuthUser, file: Express.Multer.File, orderId: string, itemKey: string) {
    if (!user.tenantId) throw new ForbiddenException();
    if (!file || file.size > 12 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException({ code: 'MEDIA_INVALID', message: '仅支持12MB以内的JPEG、PNG或WebP照片。' });
    }
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId: user.tenantId } });
    if (!order || (user.role === 'INSPECTOR' && order.assignedInspectorId !== user.id)) throw new NotFoundException('订单不存在或无权访问。');
    if (!['INSPECTING', 'NEEDS_MODIFICATION'].includes(order.status)) throw new BadRequestException('当前检测版本已锁定。');
    const revision = await this.prisma.inspectionRevision.findFirst({ where: { id: order.currentRevisionId ?? '', status: 'DRAFT', tenantId: user.tenantId }, include: { answers: true } });
    if (!revision) throw new NotFoundException('可编辑检测版本不存在。');
    const template = revision.schemaSnapshot as unknown as TemplateRevision;
    const item = template.sections.flatMap((section) => section.items).find((entry) => entry.key === itemKey);
    if (!item) throw new BadRequestException('照片关联的检测项目不存在。');
    const answerRow = revision.answers.find((entry) => entry.itemKey === itemKey);
    if (!answerRow) throw new BadRequestException({ code: 'ANSWER_REQUIRED_BEFORE_MEDIA', message: '请先保存该项目检查结果，再上传照片。' });

    let metadata: Metadata;
    try {
      metadata = await sharp(file.buffer, { limitInputPixels: 40_000_000 }).metadata();
      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height) throw new Error('invalid');
    } catch {
      throw new BadRequestException({ code: 'MEDIA_DECODE_FAILED', message: '照片内容损坏或格式与声明不一致。' });
    }
    const id = randomUUID();
    const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
    const objectKey = `${user.tenantId}/${id}/original.${extension}`;
    const previewKey = `${user.tenantId}/${id}/preview.webp`;
    const preview = await sharp(file.buffer).rotate().resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
    await this.storage.putObject(objectKey, file.buffer, file.mimetype);
    await this.storage.putObject(previewKey, preview, 'image/webp');
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    await this.prisma.$transaction(async (tx) => {
      await tx.mediaAsset.create({ data: { id, tenantId: user.tenantId!, ownerType: 'INSPECTION_REVISION', ownerId: revision.id, objectKey, previewKey, mime: file.mimetype, size: file.size, width: metadata.width, height: metadata.height, sha256, scanStatus: 'READY', createdBy: user.id } });
      await tx.inspectionEvidence.create({ data: { tenantId: user.tenantId!, revisionId: revision.id, itemKey, assetId: id } });
      const answer = answerRow.answer as unknown as InspectionAnswer;
      answer.photoIds = [...new Set([...(answer.photoIds ?? []), id])];
      await tx.inspectionAnswer.update({ where: { id: answerRow.id }, data: { answer: answer as unknown as Prisma.InputJsonValue, updatedBy: user.id } });
      await tx.auditEvent.create({ data: { tenantId: user.tenantId, actorId: user.id, action: 'media.uploaded', resourceType: 'media', resourceId: id, requestId: randomUUID(), metadata: { orderId, itemKey, sha256 } } });
    });
    return { id, status: 'READY', width: metadata.width, height: metadata.height, previewUrl: `/api/v1/media/${id}/preview-url` };
  }

  async signedPreviewUrl(user: AuthUser, assetId: string) {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id: assetId, tenantId: user.tenantId ?? '' } });
    if (!asset) throw new NotFoundException('照片不存在或无权访问。');
    const expires = Math.floor(Date.now() / 1000) + 300;
    const signature = createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(`${assetId}.${expires}`).digest('base64url');
    return { url: `/api/v1/media/${assetId}/content?variant=preview&expires=${expires}&signature=${signature}`, expiresAt: new Date(expires * 1000) };
  }

  async readSigned(assetId: string, expires: number, signature: string) {
    const expected = createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(`${assetId}.${expires}`).digest('base64url');
    const validSignature = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!expires || expires < Date.now() / 1000 || !validSignature) {
      throw new ForbiddenException({ code: 'MEDIA_URL_INVALID', message: '照片访问地址已失效。' });
    }
    return this.read(assetId, 'preview');
  }

  async readPublic(assetId: string) {
    return this.read(assetId, 'preview');
  }

  private async read(assetId: string, variant: 'preview' | 'original') {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.scanStatus !== 'READY') throw new NotFoundException('照片不存在。');
    const key = variant === 'preview' ? asset.previewKey : asset.objectKey;
    if (!key) throw new NotFoundException('照片预览不存在。');
    const object = await this.storage.getObject(key);
    return { buffer: object.buffer, mime: variant === 'preview' ? 'image/webp' : asset.mime };
  }
}
