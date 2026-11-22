import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTypePolicy } from '../../server/src/lib/leave-policy.js';

describe('parseTypePolicy', () => {
  it('parses object and JSON string', () => {
    assert.equal(parseTypePolicy({ maxConsecutiveDays: 5 }).maxConsecutiveDays, 5);
    assert.equal(parseTypePolicy('{"advanceNoticeDays":2}').advanceNoticeDays, 2);
    assert.deepEqual(parseTypePolicy(null), {});
    assert.deepEqual(parseTypePolicy('not-json'), {});
  });
});
