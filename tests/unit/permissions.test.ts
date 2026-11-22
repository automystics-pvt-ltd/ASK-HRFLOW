import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defaultRolePermissions, hasAction } from '../../server/src/lib/permissions.ts';

describe('RBAC defaultRolePermissions', () => {
  it('admin has employees create/delete and access update', () => {
    const p = defaultRolePermissions.admin;
    assert.equal(hasAction(p, 'employees', 'create'), true);
    assert.equal(hasAction(p, 'employees', 'delete'), true);
    assert.equal(hasAction(p, 'access', 'update'), true);
    assert.equal(hasAction(p, 'payroll', 'update'), true);
  });

  it('hr can manage employees but not payroll update or access delete', () => {
    const p = defaultRolePermissions.hr;
    assert.equal(hasAction(p, 'employees', 'create'), true);
    assert.equal(hasAction(p, 'attendance', 'approve'), true);
    assert.equal(hasAction(p, 'payroll', 'update'), false);
    assert.equal(hasAction(p, 'access', 'delete'), false);
  });

  it('employee is self-service only', () => {
    const p = defaultRolePermissions.employee;
    assert.equal(hasAction(p, 'employees', 'read'), false);
    assert.equal(hasAction(p, 'attendance', 'create'), true);
    assert.equal(hasAction(p, 'payroll', 'read'), true);
    assert.equal(hasAction(p, 'settings', 'update'), false);
  });
});
