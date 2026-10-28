import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OfferPayload, TenantContext } from './offer.types.js';
import { OfferService } from './offer.service.js';

const FIXED_NOW = new Date('2026-01-15T12:00:00.000Z');

const buildTenant = (overrides: Partial<TenantContext> = {}): TenantContext => ({
  tenantId: 'switchback',
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

const createRepository = (offers: OfferPayload[] = []) => ({
  findOffersByTenant: vi.fn(async (_context: TenantContext) => offers),
});

describe('OfferService.validateOffer', () => {
  let repository: ReturnType<typeof createRepository>;
  let service: OfferService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    repository = createRepository();
    service = new OfferService(repository);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('tenant context', () => {
    it('fails when tenantId is empty', () => {
      const result = service.validateOffer(
        buildTenant({ tenantId: '' as unknown as TenantContext['tenantId'] }),
        buildOffer(),
      );

      expect(result).toEqual({ isValid: false, reason: 'Invalid tenant context' });
    });

    it('fails when tenantId is missing', () => {
      const context = { environment: 'production' } as TenantContext;

      const result = service.validateOffer(context, buildOffer());

      expect(result).toEqual({ isValid: false, reason: 'Invalid tenant context' });
    });

    it('fails when tenantId is whitespace-only', () => {
      const result = service.validateOffer(
        buildTenant({ tenantId: '   ' as unknown as TenantContext['tenantId'] }),
        buildOffer(),
      );

      expect(result).toEqual({ isValid: false, reason: 'Invalid tenant context' });
    });

    it('fails when tenantId is not a string', () => {
      const context = { tenantId: 42, environment: 'production' } as unknown as TenantContext;

      const result = service.validateOffer(context, buildOffer());

      expect(result).toEqual({ isValid: false, reason: 'Invalid tenant context' });
    });

    it('fails when tenantId is outside the closed tenant universe', () => {
      const context = {
        tenantId: 'tenant-abc',
        environment: 'production',
      } as unknown as TenantContext;

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

      const result = service.validateOffer(
        buildTenant({ tenantId: '' as unknown as TenantContext['tenantId'] }),
        offer,
      );

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

describe('OfferService.getValidOffers', () => {
  let repository: ReturnType<typeof createRepository>;
  let service: OfferService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    repository = createRepository();
    service = new OfferService(repository);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delegates data fetching to the repository with the caller context', async () => {
    const context = buildTenant();

    await service.getValidOffers(context);

    expect(repository.findOffersByTenant).toHaveBeenCalledTimes(1);
    expect(repository.findOffersByTenant).toHaveBeenCalledWith(context);
  });

  it('passes the tenant0 context through so the repository applies the exclusive guardrail', async () => {
    const context = buildTenant({ tenantId: 'tenant0' });

    await service.getValidOffers(context);

    expect(repository.findOffersByTenant).toHaveBeenCalledWith(context);
  });

  it('returns only offers that pass business rules', async () => {
    const valid = buildOffer({ id: 'valid' });
    const expired = buildOffer({ id: 'expired', expiresAt: new Date(FIXED_NOW.getTime() - 1) });
    const exhausted = buildOffer({
      id: 'exhausted',
      currentRedemptions: 100,
      maxRedemptions: 100,
    });
    repository.findOffersByTenant.mockResolvedValue([valid, expired, exhausted]);

    const result = await service.getValidOffers(buildTenant());

    expect(result).toEqual([valid]);
  });

  it('returns the full repository result when every offer is valid', async () => {
    const offers = [buildOffer({ id: 'a' }), buildOffer({ id: 'b' })];
    repository.findOffersByTenant.mockResolvedValue(offers);

    const result = await service.getValidOffers(buildTenant());

    expect(result).toEqual(offers);
  });

  it('propagates repository tenant-isolation guardrail failures', async () => {
    repository.findOffersByTenant.mockRejectedValue(new Error('Invalid tenant context'));

    await expect(
      service.getValidOffers(buildTenant({ tenantId: '' as unknown as TenantContext['tenantId'] })),
    ).rejects.toThrow('Invalid tenant context');
  });
});
