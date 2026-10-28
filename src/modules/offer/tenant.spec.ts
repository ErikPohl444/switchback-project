import { describe, expect, it } from 'vitest';
import { assertTenantId, InvalidTenantContextError, isTenantId } from './tenant.js';

describe('isTenantId', () => {
  it('accepts every tenant in the closed universe', () => {
    expect(isTenantId('tenant0')).toBe(true);
    expect(isTenantId('switchback')).toBe(true);
  });

  it('rejects unknown, empty, and non-string values', () => {
    expect(isTenantId('tenant42')).toBe(false);
    expect(isTenantId('')).toBe(false);
    expect(isTenantId(null)).toBe(false);
    expect(isTenantId(42)).toBe(false);
  });

  it('narrows the type through the guard', () => {
    const value: unknown = 'switchback';

    if (isTenantId(value)) {
      expect(value satisfies 'tenant0' | 'switchback').toBe('switchback');
    } else {
      expect.fail('expected the guard to narrow an in-universe tenant');
    }
  });
});

describe('assertTenantId', () => {
  it('returns an in-universe tenant unchanged', () => {
    expect(assertTenantId('tenant0')).toBe('tenant0');
  });

  it('throws the typed error for a missing tenant', () => {
    expect(() => assertTenantId(undefined)).toThrowError(InvalidTenantContextError);
    expect(() => assertTenantId(undefined)).toThrow(
      'Invalid tenant context (tenantId is missing, empty, or whitespace-only)',
    );
  });

  it('throws the typed error for an empty tenant', () => {
    expect(() => assertTenantId('')).toThrow(
      'Invalid tenant context (tenantId is missing, empty, or whitespace-only)',
    );
  });

  it('throws the typed error for an unknown tenant', () => {
    expect(() => assertTenantId('tenant42')).toThrow(
      'Invalid tenant context (unknown tenant "tenant42")',
    );
  });

  it('carries the operational error name for grouping', () => {
    try {
      assertTenantId('tenant42');
      expect.fail();
    } catch (error) {
      expect((error as InvalidTenantContextError).name).toBe('InvalidTenantContextError');
    }
  });
});
