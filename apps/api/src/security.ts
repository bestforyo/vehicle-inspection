import { createHash, createHmac, randomBytes } from 'node:crypto';

export function createShareToken() {
  return randomBytes(32).toString('base64url');
}

export function hashShareToken(token: string, key: string) {
  return createHmac('sha256', key).update(token).digest('hex');
}

export function contentHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function maskPlate(value: string | null | undefined) {
  if (!value) return '未登记';
  if (value.length <= 4) return `${value.slice(0, 1)}***`;
  return `${value.slice(0, 2)}***${value.slice(-1)}`;
}

export function maskVin(value: string | null | undefined) {
  if (!value) return '不公开';
  return `${value.slice(0, 3)}***********${value.slice(-3)}`;
}
