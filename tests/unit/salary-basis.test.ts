import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toMonthlySalary } from '../../server/src/lib/org-settings.ts';
import {
  formatApprovalHeadline,
  formatApprovalWhatWhy,
} from '../../src/app/lib/approval-detail.ts';

describe('toMonthlySalary', () => {
  it('keeps monthly salary as-is', () => {
    assert.equal(toMonthlySalary(25000, 'monthly'), 25000);
  });

  it('divides annual salary by 12', () => {
    assert.equal(toMonthlySalary(120000, 'annual'), 10000);
  });
});

describe('approval detail formatting', () => {
  it('includes who, what, and why for leave', () => {
    const headline = formatApprovalHeadline({
      requesterName: 'Rahul Verma',
      typeLabel: 'Leave Request',
      entityType: 'leave_request',
      entityId: 8,
    });
    assert.match(headline, /Rahul Verma/);
    assert.match(headline, /#8/);

    const detail = formatApprovalWhatWhy({
      moduleKey: 'leave',
      payload: {
        type: 'Casual',
        days: 2,
        startDate: '2026-11-24',
        endDate: '2026-11-25',
        reason: 'Family event',
      },
    });
    assert.match(detail, /Casual/);
    assert.match(detail, /Why: Family event/);
  });
});
