import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InspectionAnswer, OrderStatus, StandardCode, TemplateRevision } from '@jianjian/contracts';
import { countTemplateItems, getInspectionAlerts, templateSummaries, validateInspection } from '@jianjian/templates';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import type { AuthUser } from './auth';
import { contentHash, createShareToken, hashShareToken, maskPlate, maskVin } from './security';

interface VehicleInput {
  vehicleId?: string;
  kind?: 'PASSENGER_CAR' | 'MOTORCYCLE';
  plate?: string;
  vin?: string;
  brand?: string;
  model?: string;
  year?: number;
  firstRegisteredAt?: string;
  mileage?: number;
}

const orderInclude = {
  vehicle: true,
  templateRevision: { include: { template: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private tenantId(user: AuthUser) {
    if (!user.tenantId) throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED', message: '当前账号未加入检测机构。' });
    return user.tenantId;
  }

  private requireAdmin(user: AuthUser) {
    if (user.role !== 'ORG_ADMIN') throw new ForbiddenException({ code: 'ADMIN_REQUIRED', message: '仅机构管理员可执行此操作。' });
  }

  private encryptionKey() {
    return createHash('sha256').update(this.config.getOrThrow<string>('VEHICLE_DATA_ENCRYPTION_KEY')).digest();
  }

  private encrypt(value?: string) {
    if (!value) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  private decrypt(value?: string | null) {
    if (!value) return '';
    try {
      const [iv, tag, ciphertext] = value.split('.');
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      return '';
    }
  }

  private displayNumber(prefix: string) {
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `${prefix}${date}${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private serializeOrder(order: Prisma.OrderGetPayload<{ include: typeof orderInclude }>) {
    return {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status as OrderStatus,
      templateRevisionId: order.templateRevisionId,
      currentRevisionId: order.currentRevisionId,
      assignedInspectorId: order.assignedInspectorId,
      packageName: order.templateRevision.template.packageName,
      standard: order.templateRevision.template.standardCode,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      vehicle: {
        id: order.vehicle.id,
        kind: order.vehicle.kind,
        plate: this.decrypt(order.vehicle.plateCiphertext),
        vin: this.decrypt(order.vehicle.vinCiphertext),
        brand: order.vehicle.brand,
        model: order.vehicle.model,
        year: order.vehicle.year,
        firstRegisteredAt: order.vehicle.firstRegisteredAt,
        mileage: order.vehicle.mileage,
      },
    };
  }

  async listTemplates(user: AuthUser, standard: StandardCode) {
    if (!['NATIONAL', 'GROUP'].includes(standard)) throw new BadRequestException('不支持的检测标准。');
    const tenantId = this.tenantId(user);
    const published = await this.prisma.templateRevision.findMany({ where: { tenantId, status: 'PUBLISHED' }, include: { template: true } });
    return templateSummaries(standard).map((summary) => {
      const match = published.find((revision) => revision.template.standardCode === standard && revision.template.packageCode === summary.packageCode && revision.template.kind === 'PASSENGER_CAR');
      if (summary.packageCode === 'NEW_ENERGY') return summary;
      if (!match) return { ...summary, available: false, unavailableReason: '暂未配置', templateRevisionId: undefined };
      const schema = match.schema as unknown as TemplateRevision;
      return { ...summary, templateRevisionId: match.id, revisionNumber: match.revisionNumber, itemCount: countTemplateItems(schema), sectionCount: schema.sections.length };
    });
  }

  async getTemplate(user: AuthUser, revisionId: string) {
    const revision = await this.prisma.templateRevision.findFirst({ where: { id: revisionId, tenantId: this.tenantId(user), status: 'PUBLISHED' }, include: { standardRevision: true } });
    if (!revision) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND', message: '检测模板不存在或尚未发布。' });
    return revision.schema;
  }

  async createOrder(user: AuthUser, body: VehicleInput & { templateRevisionId?: string; clientName?: string }, idempotencyKey?: string) {
    const tenantId = this.tenantId(user);
    if (!body.templateRevisionId) throw new BadRequestException({ code: 'TEMPLATE_REQUIRED', message: '请选择检测模板。' });
    const template = await this.prisma.templateRevision.findFirst({ where: { id: body.templateRevisionId, tenantId, status: 'PUBLISHED' }, include: { template: true, standardRevision: true } });
    if (!template || template.template.kind !== (body.kind ?? 'PASSENGER_CAR')) {
      throw new BadRequestException({ code: 'TEMPLATE_NOT_AVAILABLE', message: '所选检测类型暂未配置，不能切换至其他模板。' });
    }
    const requestHash = contentHash(body);
    if (idempotencyKey) {
      const existing = await this.prisma.idempotencyKey.findUnique({ where: { tenantId_actorId_key: { tenantId, actorId: user.id, key: idempotencyKey } } });
      if (existing) {
        if (existing.requestHash !== requestHash) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: '幂等键已用于其他请求。' });
        return existing.response;
      }
    }
    const orderId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      let vehicleId = body.vehicleId;
      if (vehicleId) {
        const vehicle = await tx.vehicle.findFirst({ where: { id: vehicleId, tenantId } });
        if (!vehicle) throw new NotFoundException({ code: 'VEHICLE_NOT_FOUND', message: '车辆不存在。' });
      } else {
        const vehicle = await tx.vehicle.create({ data: {
          tenantId,
          kind: body.kind ?? 'PASSENGER_CAR',
          plateCiphertext: this.encrypt(body.plate),
          vinCiphertext: this.encrypt(body.vin),
          vinHash: body.vin ? createHash('sha256').update(body.vin).digest('hex') : null,
          brand: body.brand ?? '',
          model: body.model ?? '',
          year: body.year,
          mileage: body.mileage,
          firstRegisteredAt: body.firstRegisteredAt ? new Date(body.firstRegisteredAt) : null,
        } });
        vehicleId = vehicle.id;
      }
      const order = await tx.order.create({ data: {
        id: orderId,
        tenantId,
        orderNo: this.displayNumber('JJ'),
        vehicleId: vehicleId!,
        templateRevisionId: template.id,
        assignedInspectorId: user.id,
        createdBy: user.id,
        clientName: body.clientName,
        status: 'PENDING_INSPECTION',
      } });
      const revision = await tx.inspectionRevision.create({ data: {
        tenantId,
        orderId: order.id,
        revisionNumber: 1,
        status: 'DRAFT',
        schemaSnapshot: template.schema as Prisma.InputJsonValue,
      } });
      await tx.order.update({ where: { id: order.id }, data: { status: 'INSPECTING', currentRevisionId: revision.id } });
      await tx.auditEvent.create({ data: { tenantId, actorId: user.id, action: 'order.created', resourceType: 'order', resourceId: order.id, requestId: randomUUID(), metadata: { templateRevisionId: template.id } } });
    });
    const result = await this.getOrder(user, orderId);
    if (idempotencyKey) {
      await this.prisma.idempotencyKey.create({ data: { tenantId, actorId: user.id, key: idempotencyKey, requestHash, response: result as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 86400000) } });
    }
    return result;
  }

  async listOrders(user: AuthUser, status?: string) {
    const tenantId = this.tenantId(user);
    const orders = await this.prisma.order.findMany({
      where: { tenantId, ...(user.role === 'INSPECTOR' ? { assignedInspectorId: user.id } : {}), ...(status ? { status } : {}) },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items: orders.map((order) => this.serializeOrder(order)), nextCursor: null };
  }

  async getOrder(user: AuthUser, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId: this.tenantId(user) }, include: orderInclude });
    if (!order || (user.role === 'INSPECTOR' && order.assignedInspectorId !== user.id)) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: '订单不存在或无权访问。' });
    }
    return this.serializeOrder(order);
  }

  async updateVehicle(user: AuthUser, orderId: string, body: VehicleInput) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId: this.tenantId(user) } });
    if (!order || (user.role === 'INSPECTOR' && order.assignedInspectorId !== user.id)) throw new NotFoundException('订单不存在或无权访问。');
    if (['REVIEW_PENDING', 'PUBLISHED'].includes(order.status)) throw new ConflictException('审核中或已发布订单的车辆资料不可直接修改。');
    await this.prisma.vehicle.update({ where: { id: order.vehicleId }, data: {
      ...(body.plate !== undefined ? { plateCiphertext: this.encrypt(body.plate) } : {}),
      ...(body.vin !== undefined ? { vinCiphertext: this.encrypt(body.vin), vinHash: body.vin ? createHash('sha256').update(body.vin).digest('hex') : null } : {}),
      ...(body.brand !== undefined ? { brand: body.brand } : {}),
      ...(body.model !== undefined ? { model: body.model } : {}),
      ...(body.year !== undefined ? { year: body.year } : {}),
      ...(body.mileage !== undefined ? { mileage: body.mileage } : {}),
      ...(body.firstRegisteredAt !== undefined ? { firstRegisteredAt: body.firstRegisteredAt ? new Date(body.firstRegisteredAt) : null } : {}),
    } });
    return this.getOrder(user, orderId);
  }

  async getInspection(user: AuthUser, orderId: string) {
    const tenantId = this.tenantId(user);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId } });
    if (!order || (user.role === 'INSPECTOR' && order.assignedInspectorId !== user.id)) throw new NotFoundException('订单不存在或无权访问。');
    const revision = await this.prisma.inspectionRevision.findFirst({ where: { id: order.currentRevisionId ?? '', tenantId, orderId }, include: { answers: true, evidence: { include: { asset: true } } } });
    if (!revision) throw new NotFoundException('检测版本不存在。');
    return {
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      lockVersion: revision.lockVersion,
      status: revision.status,
      orderStatus: order.status,
      template: revision.schemaSnapshot,
      answers: revision.answers.map((entry) => entry.answer),
      evidence: revision.evidence.map((entry) => ({ id: entry.assetId, itemKey: entry.itemKey, status: entry.asset.scanStatus, previewUrl: `/api/v1/media/${entry.assetId}/preview-url`, width: entry.asset.width, height: entry.asset.height })),
      submittedAt: revision.submittedAt,
    };
  }

  async saveDraft(user: AuthUser, orderId: string, body: { lockVersion?: number; answers?: InspectionAnswer[] }) {
    const tenantId = this.tenantId(user);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId } });
    if (!order || (user.role === 'INSPECTOR' && order.assignedInspectorId !== user.id)) throw new NotFoundException('订单不存在或无权访问。');
    if (!['INSPECTING', 'NEEDS_MODIFICATION', 'PENDING_INSPECTION'].includes(order.status)) throw new ConflictException({ code: 'REVISION_LOCKED', message: '审核中的检测版本不可修改。' });
    const revision = await this.prisma.inspectionRevision.findFirst({ where: { id: order.currentRevisionId ?? '', orderId, tenantId, status: 'DRAFT' } });
    if (!revision) throw new ConflictException({ code: 'REVISION_LOCKED', message: '当前检测版本不可编辑。' });
    if (body.lockVersion !== revision.lockVersion) throw new ConflictException({ code: 'REVISION_CONFLICT', message: '检测草稿已在其他页面更新，请重新加载或合并草稿。' });
    const schema = revision.schemaSnapshot as unknown as TemplateRevision;
    const validItems = new Map(schema.sections.flatMap((section) => section.items.map((item) => [item.key, { item, section }] as const)));
    const answers = (body.answers ?? []).filter((answer) => validItems.has(answer.itemKey) && answer.value).map((answer) => {
      const context = validItems.get(answer.itemKey)!;
      return {
        itemKey: answer.itemKey,
        sectionKey: context.section.key,
        value: answer.value,
        ...(context.item.options.some((option) => option.value === answer.value) ? {} : (() => { throw new BadRequestException('检测结果不在模板选项中。'); })()),
        ...(answer.size && ['GREATER_THAN_30', 'LESS_THAN_30'].includes(answer.size) ? { size: answer.size } : {}),
        ...(answer.note ? { note: answer.note.slice(0, 2000) } : {}),
        photoIds: answer.photoIds ?? [],
        updatedAt: new Date().toISOString(),
      };
    });
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.inspectionRevision.updateMany({ where: { id: revision.id, lockVersion: revision.lockVersion, status: 'DRAFT' }, data: { lockVersion: { increment: 1 } } });
      if (locked.count !== 1) throw new ConflictException({ code: 'REVISION_CONFLICT', message: '草稿版本冲突，请重新加载。' });
      await tx.inspectionAnswer.deleteMany({ where: { revisionId: revision.id } });
      if (answers.length) await tx.inspectionAnswer.createMany({ data: answers.map((answer) => ({ tenantId, revisionId: revision.id, itemKey: answer.itemKey, sectionKey: answer.sectionKey, answer, note: answer.note, updatedBy: user.id })) });
      await tx.auditEvent.create({ data: { tenantId, actorId: user.id, action: 'inspection.draft.saved', resourceType: 'order', resourceId: orderId, requestId: randomUUID(), metadata: { revisionNumber: revision.revisionNumber } } });
    });
    return this.getInspection(user, orderId);
  }

  async submitInspection(user: AuthUser, orderId: string, body: { lockVersion?: number }) {
    const tenantId = this.tenantId(user);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId } });
    if (!order || (user.role === 'INSPECTOR' && order.assignedInspectorId !== user.id)) throw new NotFoundException('订单不存在或无权访问。');
    if (!['INSPECTING', 'NEEDS_MODIFICATION'].includes(order.status)) throw new ConflictException({ code: 'INVALID_ORDER_STATE', message: '当前订单状态不能提交审核。' });
    const revision = await this.prisma.inspectionRevision.findFirst({ where: { id: order.currentRevisionId ?? '', orderId, tenantId, status: 'DRAFT' }, include: { answers: true, evidence: { include: { asset: true } } } });
    if (!revision || body.lockVersion !== revision.lockVersion) throw new ConflictException({ code: 'REVISION_CONFLICT', message: '请先保存最新草稿再提交。' });
    const template = revision.schemaSnapshot as unknown as TemplateRevision;
    const answers = revision.answers.map((entry) => entry.answer as unknown as InspectionAnswer);
    const mediaStates = Object.fromEntries(revision.evidence.map((entry) => [entry.assetId, entry.asset.scanStatus === 'READY' ? 'READY' : entry.asset.scanStatus === 'FAILED' ? 'FAILED' : 'UPLOADING'] as const));
    const issues = validateInspection(template, answers, mediaStates);
    if (issues.length) throw new BadRequestException({ code: 'INSPECTION_VALIDATION_FAILED', message: '请完成所有必检项目、说明和异常照片后再提交。', details: { issues } });
    const snapshot = { template, answers };
    const hash = contentHash(snapshot);
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.inspectionRevision.updateMany({ where: { id: revision.id, status: 'DRAFT', lockVersion: revision.lockVersion }, data: { status: 'SUBMITTED', submittedBy: user.id, submittedAt: new Date(), contentHash: hash } });
      if (locked.count !== 1) throw new ConflictException({ code: 'REVISION_CONFLICT', message: '该版本已被提交或更新。' });
      await tx.order.update({ where: { id: orderId }, data: { status: 'REVIEW_PENDING' } });
      await tx.auditEvent.create({ data: { tenantId, actorId: user.id, action: revision.revisionNumber > 1 ? 'inspection.resubmitted' : 'inspection.submitted', resourceType: 'order', resourceId: orderId, requestId: randomUUID(), metadata: { revisionId: revision.id, contentHash: hash } } });
    });
    return this.getInspection(user, orderId);
  }

  async listReviews(user: AuthUser) {
    const tenantId = this.tenantId(user);
    if (user.role === 'ORG_ADMIN') {
      const orders = await this.prisma.order.findMany({ where: { tenantId, status: { in: ['REVIEW_PENDING', 'NEEDS_MODIFICATION', 'PUBLISHED'] } }, include: orderInclude, orderBy: { updatedAt: 'desc' } });
      return orders.map((order) => this.serializeOrder(order));
    }
    const orders = await this.prisma.order.findMany({ where: { tenantId, assignedInspectorId: user.id, status: { in: ['REVIEW_PENDING', 'NEEDS_MODIFICATION', 'PUBLISHED'] } }, include: orderInclude, orderBy: { updatedAt: 'desc' } });
    return orders.map((order) => this.serializeOrder(order));
  }

  async reviewHistory(user: AuthUser, orderId: string) {
    await this.getOrder(user, orderId);
    return this.prisma.reviewRecord.findMany({ where: { orderId, tenantId: this.tenantId(user) }, orderBy: { createdAt: 'desc' } });
  }

  async returnReview(user: AuthUser, orderId: string, revisionId: string, body: { comment?: string; targetItemKeys?: string[] }) {
    this.requireAdmin(user);
    const tenantId = this.tenantId(user);
    const comment = body.comment?.trim();
    if (!comment || comment.length < 2 || comment.length > 2000) throw new BadRequestException({ code: 'REVIEW_COMMENT_REQUIRED', message: '请填写2至2000字的明确退回意见。' });
    const revision = await this.prisma.inspectionRevision.findFirst({ where: { id: revisionId, orderId, tenantId, status: 'SUBMITTED' }, include: { answers: true, evidence: true } });
    if (!revision) throw new ConflictException({ code: 'REVIEW_STATE_CHANGED', message: '该检测版本已处理，请刷新审核队列。' });
    if (revision.submittedBy === user.id) throw new ForbiddenException({ code: 'SELF_REVIEW_FORBIDDEN', message: '机构管理员不能审核自己提交的检测版本。' });
    await this.prisma.$transaction(async (tx) => {
      await tx.reviewRecord.create({ data: { tenantId, orderId, revisionId, reviewerId: user.id, decision: 'RETURNED', comment, targetItemKeys: body.targetItemKeys ?? [] } });
      await tx.inspectionRevision.update({ where: { id: revisionId }, data: { status: 'RETURNED' } });
      const next = await tx.inspectionRevision.create({ data: { tenantId, orderId, revisionNumber: revision.revisionNumber + 1, basedOnRevisionId: revision.id, status: 'DRAFT', schemaSnapshot: revision.schemaSnapshot as Prisma.InputJsonValue } });
      if (revision.answers.length) await tx.inspectionAnswer.createMany({ data: revision.answers.map((answer) => ({ tenantId, revisionId: next.id, itemKey: answer.itemKey, sectionKey: answer.sectionKey, answer: answer.answer as Prisma.InputJsonValue, note: answer.note, updatedBy: answer.updatedBy })) });
      if (revision.evidence.length) await tx.inspectionEvidence.createMany({ data: revision.evidence.map((entry) => ({ tenantId, revisionId: next.id, itemKey: entry.itemKey, assetId: entry.assetId, category: entry.category, caption: entry.caption, sortOrder: entry.sortOrder })) });
      await tx.order.update({ where: { id: orderId }, data: { status: 'NEEDS_MODIFICATION', currentRevisionId: next.id } });
      await tx.auditEvent.create({ data: { tenantId, actorId: user.id, action: 'review.returned', resourceType: 'order', resourceId: orderId, requestId: randomUUID(), metadata: { returnedRevisionId: revisionId, nextRevisionId: next.id } } });
    });
    return { success: true };
  }

  async approveReview(user: AuthUser, orderId: string, revisionId: string) {
    this.requireAdmin(user);
    const tenantId = this.tenantId(user);
    const revision = await this.prisma.inspectionRevision.findFirst({ where: { id: revisionId, orderId, tenantId, status: 'SUBMITTED' }, include: { answers: true, order: { include: orderInclude }, tenant: true } });
    if (!revision) throw new ConflictException({ code: 'REVIEW_STATE_CHANGED', message: '该检测版本已处理或已发布。' });
    if (revision.submittedBy === user.id) throw new ForbiddenException({ code: 'SELF_REVIEW_FORBIDDEN', message: '机构管理员不能审核自己提交的检测版本。' });
    const inspector = revision.submittedBy ? await this.prisma.user.findUnique({ where: { id: revision.submittedBy } }) : null;
    const template = revision.schemaSnapshot as unknown as TemplateRevision;
    const answers = revision.answers.map((entry) => entry.answer as unknown as InspectionAnswer);
    const reportId = randomUUID();
    const snapshot = {
      title: '车辆检测报告',
      reportNo: this.displayNumber('BG'),
      versionNumber: 1,
      organization: { displayName: revision.tenant.displayName, name: revision.tenant.name, logoText: revision.tenant.logoText, reportTheme: revision.tenant.reportTheme },
      vehicle: { kind: revision.order.vehicle.kind, brand: revision.order.vehicle.brand, model: revision.order.vehicle.model, year: revision.order.vehicle.year, plate: maskPlate(this.decrypt(revision.order.vehicle.plateCiphertext)), vin: maskVin(this.decrypt(revision.order.vehicle.vinCiphertext)), mileage: revision.order.vehicle.mileage, firstRegisteredAt: revision.order.vehicle.firstRegisteredAt },
      template,
      answers,
      alerts: getInspectionAlerts(template, answers),
      inspectorName: inspector?.displayName ?? '检测师',
      reviewerName: user.displayName,
      publishedAt: new Date().toISOString(),
      disclaimer: '本报告仅反映本次检测范围及检测时车辆状态。示范模板未经专业审核，不构成法定评估结论、交易建议或车辆价值承诺。',
    };
    const hash = contentHash(snapshot);
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.inspectionRevision.updateMany({ where: { id: revisionId, status: 'SUBMITTED' }, data: { status: 'PUBLISHED' } });
      if (locked.count !== 1) throw new ConflictException({ code: 'REVIEW_STATE_CHANGED', message: '该版本已由其他审核人处理。' });
      await tx.reviewRecord.create({ data: { tenantId, orderId, revisionId, reviewerId: user.id, decision: 'APPROVED' } });
      await tx.report.create({ data: { id: reportId, tenantId, orderId, revisionId, reportNo: snapshot.reportNo, snapshot: snapshot as unknown as Prisma.InputJsonValue, contentHash: hash, publishedBy: user.id } });
      await tx.order.update({ where: { id: orderId }, data: { status: 'PUBLISHED' } });
      await tx.auditEvent.create({ data: { tenantId, actorId: user.id, action: 'review.approved', resourceType: 'order', resourceId: orderId, requestId: randomUUID(), metadata: { reportId, contentHash: hash } } });
      await tx.auditEvent.create({ data: { tenantId, actorId: user.id, action: 'report.published', resourceType: 'report', resourceId: reportId, requestId: randomUUID(), metadata: { revisionId } } });
    });
    return this.prisma.report.findUnique({ where: { id: reportId }, include: { shares: true } });
  }

  async listReports(user: AuthUser, orderId?: string) {
    const tenantId = this.tenantId(user);
    if (orderId) await this.getOrder(user, orderId);
    const reports = await this.prisma.report.findMany({
      where: { tenantId, ...(orderId ? { orderId } : {}), ...(user.role === 'INSPECTOR' ? { order: { assignedInspectorId: user.id } } : {}) },
      include: { shares: true, order: { select: { orderNo: true } } },
      orderBy: { publishedAt: 'desc' },
    });
    return reports;
  }

  async createShare(user: AuthUser, reportId: string, expiresInDays = 30) {
    const tenantId = this.tenantId(user);
    const report = await this.prisma.report.findFirst({ where: { id: reportId, tenantId, status: 'PUBLISHED' }, include: { order: true } });
    if (!report || (user.role === 'INSPECTOR' && report.order.assignedInspectorId !== user.id)) throw new NotFoundException('正式报告不存在或无权分享。');
    const token = createShareToken();
    const tokenHash = hashShareToken(token, this.config.getOrThrow<string>('REPORT_SHARE_HASH_KEY'));
    const days = Math.min(Math.max(Number(expiresInDays) || 30, 1), 365);
    const share = await this.prisma.reportShare.create({ data: { tenantId, reportId, tokenHash, expiresAt: new Date(Date.now() + days * 86400000), scope: { vehicle: 'MASKED', internalComments: false }, createdBy: user.id } });
    await this.prisma.auditEvent.create({ data: { tenantId, actorId: user.id, action: 'report_share.created', resourceType: 'report', resourceId: reportId, requestId: randomUUID(), metadata: { shareId: share.id, expiresAt: share.expiresAt } } });
    return { id: share.id, url: `${this.config.getOrThrow<string>('PUBLIC_REPORT_BASE_URL')}/${token}`, expiresAt: share.expiresAt, status: share.status };
  }

  async revokeShare(user: AuthUser, reportId: string, shareId: string) {
    this.requireAdmin(user);
    const share = await this.prisma.reportShare.findFirst({ where: { id: shareId, reportId, tenantId: this.tenantId(user), status: 'ACTIVE' } });
    if (!share) throw new NotFoundException('分享链接不存在或已撤销。');
    await this.prisma.reportShare.update({ where: { id: shareId }, data: { status: 'REVOKED', revokedAt: new Date() } });
    await this.prisma.auditEvent.create({ data: { tenantId: share.tenantId, actorId: user.id, action: 'report_share.revoked', resourceType: 'report', resourceId: reportId, requestId: randomUUID(), metadata: { shareId } } });
    return { success: true };
  }
}
