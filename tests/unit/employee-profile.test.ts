import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mirror server normalizers for quick regression coverage without spinning Express.
function parseJsonArray(val: unknown): unknown[] {
  if (val == null || val === '') return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeExperience(val: unknown) {
  return parseJsonArray(val)
    .map((item) => {
      if (typeof item === 'string') {
        const s = item.trim();
        return s ? { title: s, company: '', years: '', description: '' } : null;
      }
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const title = String(o.title ?? o.role ?? '').trim();
        if (!title) return null;
        return {
          title,
          company: String(o.company ?? '').trim(),
          years: String(o.years ?? o.period ?? '').trim(),
          description: String(o.description ?? '').trim(),
        };
      }
      return null;
    })
    .filter(Boolean);
}

describe('employee profile normalizers', () => {
  it('keeps structured experience entries', () => {
    const out = normalizeExperience([
      { title: 'BDA', company: 'Automystics', years: '2024–present', description: 'Sales' },
      { title: '' },
      'Freelance designer',
    ]);
    assert.equal(out.length, 2);
    assert.equal((out[0] as { title: string }).title, 'BDA');
    assert.equal((out[1] as { title: string }).title, 'Freelance designer');
  });

  it('parses JSON string lists', () => {
    assert.deepEqual(parseJsonArray('["React","Node"]'), ['React', 'Node']);
  });
});
