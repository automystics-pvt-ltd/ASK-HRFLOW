import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePasswordPolicy, hashToken, generateTempPassword } from '../../server/src/lib/password.ts';

describe('validatePasswordPolicy', () => {
  it('rejects short and weak passwords', () => {
    assert.equal(validatePasswordPolicy('abc').ok, false);
    assert.equal(validatePasswordPolicy('abcdefgh').ok, false);
    assert.equal(validatePasswordPolicy('demo123').ok, false);
  });

  it('accepts strong enough passwords', () => {
    assert.equal(validatePasswordPolicy('Secure9pass').ok, true);
  });
});

describe('password helpers', () => {
  it('hashes tokens deterministically and generates temp passwords', () => {
    assert.equal(hashToken('abc'), hashToken('abc'));
    assert.notEqual(hashToken('abc'), hashToken('abcd'));
    const t = generateTempPassword(12);
    assert.equal(t.length, 12);
  });
});
