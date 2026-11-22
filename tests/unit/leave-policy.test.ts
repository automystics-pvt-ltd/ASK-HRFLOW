import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLeaveDays,
  countLeaveCalendarDays,
  parseTypePolicy,
} from '../../server/src/lib/leave-policy.ts';

describe('parseTypePolicy', () => {
  it('parses object and JSON string', () => {
    assert.equal(parseTypePolicy({ maxConsecutiveDays: 5 }).maxConsecutiveDays, 5);
    assert.equal(parseTypePolicy('{"advanceNoticeDays":2}').advanceNoticeDays, 2);
    assert.deepEqual(parseTypePolicy(null), {});
    assert.deepEqual(parseTypePolicy('not-json'), {});
  });
});

describe('countLeaveCalendarDays', () => {
  it('excludes weekends by default', () => {
    // Mon 2026-11-23 → Fri 2026-11-27 = 5 weekdays
    assert.equal(
      countLeaveCalendarDays('2026-11-23', '2026-11-27', {
        countWeekends: false,
        countHolidays: false,
        holidays: [],
      }),
      5,
    );
  });

  it('excludes weekends spanning a weekend', () => {
    // Fri 2026-11-20 → Mon 2026-11-23 = Fri + Mon = 2
    assert.equal(
      countLeaveCalendarDays('2026-11-20', '2026-11-23', {
        countWeekends: false,
        countHolidays: false,
        holidays: [],
      }),
      2,
    );
  });

  it('includes weekends when configured', () => {
    assert.equal(
      countLeaveCalendarDays('2026-11-20', '2026-11-23', {
        countWeekends: true,
        countHolidays: false,
        holidays: [],
      }),
      4,
    );
  });

  it('excludes holidays when countHolidays is false', () => {
    assert.equal(
      countLeaveCalendarDays('2026-11-23', '2026-11-25', {
        countWeekends: false,
        countHolidays: false,
        holidays: ['2026-11-24'],
      }),
      2,
    );
  });

  it('includes holidays when countHolidays is true', () => {
    assert.equal(
      countLeaveCalendarDays('2026-11-23', '2026-11-25', {
        countWeekends: false,
        countHolidays: true,
        holidays: ['2026-11-24'],
      }),
      3,
    );
  });
});

describe('calculateLeaveDays', () => {
  it('returns 0.5 for half-day', async () => {
    const days = await calculateLeaveDays('2026-11-23', '2026-11-23', {
      halfDay: true,
      countWeekends: false,
      countHolidays: false,
      holidayDates: [],
    });
    assert.equal(days, 0.5);
  });

  it('counts weekdays excluding holidays when provided', async () => {
    const days = await calculateLeaveDays('2026-11-23', '2026-11-27', {
      countWeekends: false,
      countHolidays: false,
      holidayDates: ['2026-11-26'],
    });
    assert.equal(days, 4);
  });
});
