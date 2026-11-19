import { describe, expect, it } from 'vitest';
import { permissionsForRole } from './auth.js';

describe('业务角色权限边界', () => {
  it('检测师不能审核、退回或管理机构', () => {
    const permissions = permissionsForRole('INSPECTOR');
    expect(permissions).toContain('inspection.submit');
    expect(permissions).not.toContain('review.approve');
    expect(permissions).not.toContain('review.return');
    expect(permissions).not.toContain('role.manage');
  });

  it('机构管理员拥有审核权但没有平台管理权', () => {
    const permissions = permissionsForRole('ORG_ADMIN');
    expect(permissions).toContain('review.approve');
    expect(permissions).toContain('review.return');
    expect(permissions).not.toContain('platform.tenant.manage');
  });
});
