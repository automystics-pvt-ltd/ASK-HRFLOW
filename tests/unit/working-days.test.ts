import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hoursBetween, workingDaysBetween } from '../../server/src/lib/working-days.ts';
import { isoDate } from '../../server/src/lib/dates.ts';

describe('workingDaysBetween', () => {
  it('counts weekdays only', () => {
    assert.equal(workingDaysBetween('2026-11-23', '2026-11-27'), 5); // Mon–Fri
    assert.equal(workingDaysBetween('2026-11-21', '2026-11-22'), 0); // Sat–Sun
  });
});

describe('hoursBetween', () => {
  it('computes duration from timestamps', () => {
    assert.equal(hoursBetween('2026-01-15T09:00:00Z', '2026-01-15T17:30:00Z'), 8.5);
    assert.equal(hoursBetween('2026-01-15T17:00:00Z', '2026-01-15T09:00:00Z'), 0);
  });
});

describe('isoDate', () => {
  it('normalizes Date and ISO strings', () => {
    assert.equal(isoDate(new Date('2026-03-15T12:00:00Z')), '2026-03-15');
    assert.equal(isoDate('2026-03-15'), '2026-03-15');
  });
});
