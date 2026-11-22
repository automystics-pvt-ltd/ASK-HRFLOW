import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reverseGeocode } from '../../server/src/lib/geocode.ts';

describe('reverseGeocode', () => {
  it('returns null for invalid coordinates without calling the network', async () => {
    assert.equal(await reverseGeocode(Number.NaN, 0), null);
    assert.equal(await reverseGeocode(0, Number.NaN), null);
    assert.equal(await reverseGeocode(999, 0), null);
    assert.equal(await reverseGeocode(0, 999), null);
  });
});
