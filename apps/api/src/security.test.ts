import { describe, expect, it } from 'vitest';
import { createShareToken, hashShareToken, maskPlate, maskVin } from './security.js';

describe('报告分享安全', () => {
  it('生成至少256位熵的随机令牌且只持久化哈希', () => {
    const token = createShareToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(createShareToken()).not.toBe(token);
    expect(hashShareToken(token, 'secret')).not.toContain(token);
    expect(hashShareToken(token, 'secret')).toHaveLength(64);
  });

  it('默认脱敏车牌和VIN', () => {
    expect(maskPlate('沪A12345')).toBe('沪A***5');
    expect(maskVin('LFV12345678901234')).toBe('LFV***********234');
  });
});
