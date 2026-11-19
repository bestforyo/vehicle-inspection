import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { InspectionAnswer, TemplateRevision } from '@jianjian/contracts';

const port = 55432;
const apiPort = 3100;
const base = `http://127.0.0.1:${apiPort}`;
const tempRoot = resolve('.tmp');
await mkdir(tempRoot, { recursive: true });
const databaseDir = resolve(tempRoot, `e2e-db-${Date.now()}`);
const uploadDir = resolve(tempRoot, `e2e-uploads-${Date.now()}`);
let pg: { initialise: () => Promise<void>; start: () => Promise<void>; createDatabase: (name: string) => Promise<void>; stop: () => Promise<void> } | undefined;
let app: { close: () => Promise<void> } | undefined;

async function call(path: string, method = 'GET', token = '', body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function login(email: string, password: string) {
  const result = await call('/api/v1/auth/login', 'POST', '', { email, password });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data.accessToken as string;
}

try {
  if (!process.env.TEST_DATABASE_URL) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    pg = new EmbeddedPostgres({ databaseDir, user: 'postgres', password: 'postgres', port, persistent: false, autoRehydrateSymlinks: true, onLog: (message) => console.log(String(message).trim()), onError: (error) => console.error(error) });
    console.log('E2E_STEP initialise');
    await pg.initialise();
    console.log('E2E_STEP start');
    await pg.start();
    console.log('E2E_STEP createDatabase');
    await pg.createDatabase('jianjian_test');
  }
  const databaseUrl = process.env.TEST_DATABASE_URL ?? `postgresql://postgres:postgres@127.0.0.1:${port}/jianjian_test`;
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    PORT: String(apiPort),
    JWT_SECRET: 'e2e-jwt-secret-with-at-least-32-characters',
    REPORT_SHARE_HASH_KEY: 'e2e-independent-report-share-hash-key',
    VEHICLE_DATA_ENCRYPTION_KEY: 'e2e-independent-vehicle-encryption-key',
    PUBLIC_REPORT_BASE_URL: 'http://localhost:5173/r',
    CORS_ORIGINS: 'http://localhost:5173',
    SEED_DEMO: 'true',
    DEMO_INSPECTOR_PASSWORD: 'Inspector123!',
    DEMO_ADMIN_PASSWORD: 'Admin123!',
    DEMO_PLATFORM_PASSWORD: 'Platform123!',
    UPLOAD_DIR: uploadDir,
  });
  console.log('E2E_STEP migrate');
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma'], { env: process.env, stdio: 'inherit' });
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../dist/app.module.js');
  console.log('E2E_STEP createApp');
  const nest = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app = nest;
  await nest.listen(apiPort, '127.0.0.1');
  console.log('E2E_STEP listening');

  const inspector = await login('inspector@demo.jianjian.cn', 'Inspector123!');
  const admin = await login('admin@demo.jianjian.cn', 'Admin123!');
  const platform = await login('platform@demo.jianjian.cn', 'Platform123!');
  const templates = await call('/api/v1/templates?standard=GROUP', 'GET', inspector);
  assert.equal(templates.status, 200);
  const full = templates.data.find((entry: { packageCode: string }) => entry.packageCode === 'FULL');
  assert.equal(full.itemCount, 180);

  const created = await call('/api/v1/orders', 'POST', inspector, { kind: 'PASSENGER_CAR', templateRevisionId: full.templateRevisionId, plate: '沪A12345', vin: 'LFV12345678901234', brand: '测试品牌', model: '测试车型', mileage: 32000 }, { 'Idempotency-Key': 'e2e-order-once-0001' });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const orderId = created.data.id as string;
  const repeated = await call('/api/v1/orders', 'POST', inspector, { kind: 'PASSENGER_CAR', templateRevisionId: full.templateRevisionId, plate: '沪A12345', vin: 'LFV12345678901234', brand: '测试品牌', model: '测试车型', mileage: 32000 }, { 'Idempotency-Key': 'e2e-order-once-0001' });
  assert.equal(repeated.data.id, orderId);

  let current = (await call(`/api/v1/orders/${orderId}/inspection/current`, 'GET', inspector)).data;
  const template = current.template as TemplateRevision;
  const answers: InspectionAnswer[] = template.sections.flatMap((section) => section.items.map((item) => ({ itemKey: item.key, sectionKey: section.key, value: item.options.some((option) => option.value === '正常') ? '正常' : item.options.some((option) => option.value === '无故障码') ? '无故障码' : '数据正常', updatedAt: new Date().toISOString() })));
  const firstItem = template.sections[0].items[0];
  answers.find((answer) => answer.itemKey === firstItem.key)!.value = '破损';
  const incomplete = await call(`/api/v1/orders/${orderId}/inspection/submit`, 'POST', inspector, { lockVersion: current.lockVersion });
  assert.equal(incomplete.status, 400);
  const saved = await call(`/api/v1/orders/${orderId}/inspection/draft`, 'PUT', inspector, { lockVersion: current.lockVersion, answers });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const conflict = await call(`/api/v1/orders/${orderId}/inspection/draft`, 'PUT', inspector, { lockVersion: current.lockVersion, answers });
  assert.equal(conflict.status, 409);

  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#376d57' } }).png().toBuffer();
  const form = new FormData();
  form.append('file', new File([png], 'evidence.png', { type: 'image/png' }));
  form.append('orderId', orderId);
  form.append('itemKey', firstItem.key);
  const uploadResponse = await fetch(`${base}/api/v1/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${inspector}` }, body: form });
  const uploadText = await uploadResponse.text();
  assert.equal(uploadResponse.status, 201, uploadText);
  const uploaded = JSON.parse(uploadText);
  const assetId = uploaded.id as string;

  current = (await call(`/api/v1/orders/${orderId}/inspection/current`, 'GET', inspector)).data;
  const submitted = await call(`/api/v1/orders/${orderId}/inspection/submit`, 'POST', inspector, { lockVersion: current.lockVersion });
  assert.equal(submitted.status, 200, JSON.stringify(submitted.data));
  const editLocked = await call(`/api/v1/orders/${orderId}/inspection/draft`, 'PUT', inspector, { lockVersion: current.lockVersion, answers });
  assert.equal(editLocked.status, 409);
  const inspectorApprove = await call(`/api/v1/orders/${orderId}/reviews/${current.id}/approve`, 'POST', inspector, {});
  assert.equal(inspectorApprove.status, 403);
  const blankReturn = await call(`/api/v1/orders/${orderId}/reviews/${current.id}/return`, 'POST', admin, { comment: ' ' });
  assert.equal(blankReturn.status, 400);
  const returned = await call(`/api/v1/orders/${orderId}/reviews/${current.id}/return`, 'POST', admin, { comment: '请复核前保险杠照片并重新提交。' });
  assert.equal(returned.status, 200, JSON.stringify(returned.data));

  const revisionTwo = (await call(`/api/v1/orders/${orderId}/inspection/current`, 'GET', inspector)).data;
  assert.equal(revisionTwo.revisionNumber, 2);
  assert.equal(revisionTwo.status, 'DRAFT');
  const resubmitted = await call(`/api/v1/orders/${orderId}/inspection/submit`, 'POST', inspector, { lockVersion: revisionTwo.lockVersion });
  assert.equal(resubmitted.status, 200, JSON.stringify(resubmitted.data));
  const approved = await call(`/api/v1/orders/${orderId}/reviews/${revisionTwo.id}/approve`, 'POST', admin, {});
  assert.equal(approved.status, 200, JSON.stringify(approved.data));
  const reportId = approved.data.id as string;
  const duplicateApprove = await call(`/api/v1/orders/${orderId}/reviews/${revisionTwo.id}/approve`, 'POST', admin, {});
  assert.equal(duplicateApprove.status, 409);

  const shared = await call(`/api/v1/reports/${reportId}/shares`, 'POST', inspector, { expiresInDays: 30 });
  assert.equal(shared.status, 200, JSON.stringify(shared.data));
  const shareId = shared.data.id as string;
  const token = shared.data.url.split('/').pop()!;
  const publicReport = await call(`/public/v1/reports/${token}`);
  assert.equal(publicReport.status, 200, JSON.stringify(publicReport.data));
  assert.equal(publicReport.data.vehicle.plate, '沪A***5');
  assert.equal(publicReport.data.template.sections[0].items[0].critical, undefined);
  const publicAsset = await fetch(`${base}/public/v1/reports/${token}/assets/${assetId}/preview`);
  assert.equal(publicAsset.status, 200);
  assert.equal(publicAsset.headers.get('content-type'), 'image/webp');

  const tenantCreated = await call('/api/v1/platform/tenants', 'POST', platform, { name: '跨租户测试机构', code: 'E2ETENANT', adminEmail: 'other@example.com', adminName: '其他管理员', initialPassword: 'OtherAdmin123!' });
  assert.equal(tenantCreated.status, 201, JSON.stringify(tenantCreated.data));
  const otherAdmin = await login('other@example.com', 'OtherAdmin123!');
  const crossOrder = await call(`/api/v1/orders/${orderId}`, 'GET', otherAdmin);
  assert.equal(crossOrder.status, 404);
  const crossAsset = await call(`/api/v1/media/${assetId}/preview-url`, 'GET', otherAdmin);
  assert.equal(crossAsset.status, 404);
  const revoked = await call(`/api/v1/reports/${reportId}/shares/${shareId}/revoke`, 'POST', admin, {});
  assert.equal(revoked.status, 200);
  assert.equal((await call(`/public/v1/reports/${token}`)).status, 404);
  assert.equal((await fetch(`${base}/public/v1/reports/${token}/assets/${assetId}/preview`)).status, 404);

  console.log('E2E passed: create, idempotency, conflict, media, submit lock, RBAC, return revision, publish once, public report, revoke, tenant isolation.');
} catch (error) {
  console.error('E2E_FAILED', error);
  process.exitCode = 1;
} finally {
  await app?.close();
  await Promise.race([pg?.stop(), new Promise<void>((resolve) => setTimeout(resolve, 3000))]);
  await rm(databaseDir, { recursive: true, force: true });
  await rm(uploadDir, { recursive: true, force: true });
}
