import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OfferPayload, TenantContext } from './offer.types.js';
import { OfferService } from './offer.service.js';

const FIXED_NOW = new Date('2026-01-15T12:00:00.000Z');

const buildTenant = (overrides: Partial<TenantContext> = {}): TenantContext => ({
  tenantId: 'tenant-abc',
  environment: 'production',
  ...overrides,
});

const buildOffer = (overrides: Partial<OfferPayload> = {}): OfferPayload => ({
  id: 'offer-1',
  code: 'SAVE20',
  discountPercentage: 20,
  maxRedemptions: 100,
  currentRedemptions: 0,
  expiresAt: new Date(FIXED_NOW.getTime() + 86_400_000),
  ...overrides,
});

describe('OfferService.validateOffer', () => {
  let service: OfferService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    service = new OfferService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('tenant context', () => {
    it('fails when tenantId is empty', () => {
      const result = service.validateOffer(buildTenant({ tenantId: '' }), buildOffer());

      expect(result).toEqual({ isValid: false, reason: 'Invalid tenant context' });
    });

    it('fails when tenantId is missing', () => {
      const context = { environment: 'production' } as TenantContext;

      const result = service.validateOffer(context, buildOffer());

      expect(result).toEqual({ isValid: false, reason: 'Invalid tenant context' });
    });

    it('fails when tenantId is whitespace-only', () => {
      const result = service.validateOffer(buildTenant({ tenantId: '   ' }), buildOffer());

      expect(result).toEqual({ isValid: false, reason: 'Invalid tenant context' });
    });

    it('fails when tenantId is not a string', () => {
      const context = { tenantId: 42, environment: 'production' } as unknown as TenantContext;

      const result = service.validateOffer(context, buildOffer());

      expect(result).toEqual({ isValid: false, reason: 'Invalid tenant context' });
    });

    it('passes for every supported environment', () => {
      const environments: TenantContext['environment'][] = ['development', 'staging', 'production'];

      for (const environment of environments) {
        const result = service.validateOffer(buildTenant({ environment }), buildOffer());

        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('expiry', () => {
    it('fails when the offer expired in the past', () => {
      const offer = buildOffer({ expiresAt: new Date(FIXED_NOW.getTime() - 1) });

      const result = service.validateOffer(buildTenant(), offer);

      expect(result).toEqual({ isValid: false, reason: 'Offer has expired' });
    });

    it('fails when the offer expired long ago', () => {
      const offer = buildOffer({ expiresAt: new Date('2025-01-01T00:00:00.000Z') });

      const result = service.validateOffer(buildTenant(), offer);

      expect(result).toEqual({ isValid: false, reason: 'Offer has expired' });
    });

    it('passes when the offer expires exactly at the current instant', () => {
      const offer = buildOffer({ expiresAt: new Date(FIXED_NOW.getTime()) });

      const result = service.validateOffer(buildTenant(), offer);

      expect(result.isValid).toBe(true);
    });
  });

  describe('redemption limit', () => {
    it('fails at the exact boundary (currentRedemptions === maxRedemptions)', () => {
      const offer = buildOffer({ currentRedemptions: 100, maxRedemptions: 100 });

      const result = service.validateOffer(buildTenant(), offer);

      expect(result).toEqual({ isValid: false, reason: 'Redemption limit reached' });
    });

    it('fails when redemptions exceed the limit', () => {
      const offer = buildOffer({ currentRedemptions: 101, maxRedemptions: 100 });

      const result = service.validateOffer(buildTenant(), offer);

      expect(result).toEqual({ isValid: false, reason: 'Redemption limit reached' });
    });

    it('passes just below the boundary', () => {
      const offer = buildOffer({ currentRedemptions: 99, maxRedemptions: 100 });

      const result = service.validateOffer(buildTenant(), offer);

      expect(result.isValid).toBe(true);
    });

    it('passes for an untouched offer', () => {
      const result = service.validateOffer(buildTenant(), buildOffer());

      expect(result).toEqual({ isValid: true });
    });
  });

  describe('rule precedence', () => {
    it('reports invalid tenant context before expiry', () => {
      const offer = buildOffer({ expiresAt: new Date('2020-01-01T00:00:00.000Z') });

      const result = service.validateOffer(buildTenant({ tenantId: '' }), offer);

      expect(result.reason).toBe('Invalid tenant context');
    });

    it('reports expiry before redemption limit', () => {
      const offer = buildOffer({
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
        currentRedemptions: 100,
        maxRedemptions: 100,
      });

      const result = service.validateOffer(buildTenant(), offer);

      expect(result.reason).toBe('Offer has expired');
    });
  });

  describe('happy path', () => {
    it('returns only isValid for a fully valid offer', () => {
      const result = service.validateOffer(buildTenant(), buildOffer());

      expect(result).toEqual({ isValid: true });
      expect(result.reason).toBeUndefined();
    });

    it('validates offers in the future regardless of discount value', () => {
      const result = service.validateOffer(
        buildTenant(),
        buildOffer({ discountPercentage: 100, currentRedemptions: 5_000, maxRedemptions: 10_000 }),
      );

      expect(result).toEqual({ isValid: true });
    });
  });
});
