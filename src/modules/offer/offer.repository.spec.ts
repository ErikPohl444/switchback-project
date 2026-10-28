import { describe, expect, it, vi } from 'vitest';
import type { OfferPayload, TenantContext } from './offer.types.js';
import {
  OfferRepository,
  type OfferQueryBuilder,
  type OfferRow,
  type TenantScopedOfferQuery,
} from './offer.repository.js';
import { OfferService } from './offer.service.js';
import type { TenantId } from './tenant.js';
import { InvalidTenantContextError } from './tenant.js';

const buildContext = (overrides: Partial<TenantContext> = {}): TenantContext => ({
  tenantId: 'switchback',
  environment: 'production',
  ...overrides,
});

const buildRow = (overrides: Partial<OfferRow> = {}): OfferRow => ({
  id: 'offer-0',
  code: 'CODE10',
  discount_percentage: 10,
  max_redemptions: 100,
  current_redemptions: 0,
  expires_at: '2099-06-01T00:00:00.000Z',
  tenant_id: 'tenant0',
  is_exclusive: false,
  ...overrides,
});

const breachRows = (): OfferRow[] => [
  buildRow({ id: 'tenant0-baseline', tenant_id: 'tenant0', is_exclusive: false }),
  buildRow({ id: 'tenant0-exclusive', tenant_id: 'tenant0', is_exclusive: true }),
  buildRow({ id: 'switchback-exclusive', tenant_id: 'switchback', is_exclusive: true }),
  buildRow({ id: 'switchback-baseline', tenant_id: 'switchback', is_exclusive: false }),
];

class FakeQueryBuilder implements OfferQueryBuilder, TenantScopedOfferQuery {
  readonly clauses: Array<{ column: string; value: unknown }> = [];

  constructor(private readonly rows: OfferRow[]) {}

  where(column: 'tenant_id', value: string): TenantScopedOfferQuery {
    this.clauses.push({ column, value });
    return this;
  }

  andWhere(column: string, value: unknown): TenantScopedOfferQuery {
    this.clauses.push({ column, value });
    return this;
  }

  select(): Promise<OfferRow[]> {
    return Promise.resolve(
      this.rows.filter((row) =>
        this.clauses.every(({ column, value }) => row[column as keyof OfferRow] === value),
      ),
    );
  }
}

const createDatabase = (rows: OfferRow[] = []) => {
  const builders: FakeQueryBuilder[] = [];
  const db = vi.fn((_table: string): OfferQueryBuilder => {
    const builder = new FakeQueryBuilder(rows);
    builders.push(builder);
    return builder;
  });
  return { db, builders };
};

describe('OfferRepository.findOffersByTenant', () => {
  const buildRepository = (rows: OfferRow[] = []) => {
    const { db, builders } = createDatabase(rows);
    return { repository: new OfferRepository(db), db, builders };
  };

  it('always binds tenant_id to the calling tenant', async () => {
    const { repository, builders } = buildRepository();

    for (const tenantId of ['tenant0', 'switchback'] as const) {
      await repository.findOffersByTenant(buildContext({ tenantId }));

      expect(builders.at(-1)?.clauses[0]).toEqual({ column: 'tenant_id', value: tenantId });
    }
  });

  it('targets the offers table', async () => {
    const { repository, db } = buildRepository();

    await repository.findOffersByTenant(buildContext());

    expect(db).toHaveBeenCalledWith('offers');
  });

  it('structurally appends is_exclusive = false for tenant0', async () => {
    const { repository, builders } = buildRepository();

    await repository.findOffersByTenant(buildContext({ tenantId: 'tenant0' }));

    expect(builders[0]?.clauses).toEqual([
      { column: 'tenant_id', value: 'tenant0' },
      { column: 'is_exclusive', value: false },
    ]);
  });

  it('never appends is_exclusive for the exclusivity tenant', async () => {
    const { repository, builders } = buildRepository();

    await repository.findOffersByTenant(buildContext({ tenantId: 'switchback' }));

    expect(builders[0]?.clauses).toEqual([{ column: 'tenant_id', value: 'switchback' }]);
  });

  describe('tenant isolation breaches', () => {
    it('never surfaces a Switchback-exclusive offer to tenant0', async () => {
      const { repository } = buildRepository(breachRows());

      const offers = await repository.findOffersByTenant(buildContext({ tenantId: 'tenant0' }));

      expect(offers.map((offer) => offer.id)).toEqual(['tenant0-baseline']);
    });

    it("never leaks another tenant's offers into a query result", async () => {
      const { repository } = buildRepository(breachRows());

      const offers = await repository.findOffersByTenant(buildContext({ tenantId: 'switchback' }));

      expect(offers.map((offer) => offer.id)).toEqual([
        'switchback-exclusive',
        'switchback-baseline',
      ]);
    });
  });

  it('refuses to query without a tenantId', async () => {
    const { repository, db } = buildRepository();

    await expect(
      repository.findOffersByTenant({ environment: 'production' } as TenantContext),
    ).rejects.toThrowError(InvalidTenantContextError);
    expect(db).not.toHaveBeenCalled();
  });

  it('refuses to query with an empty tenantId', async () => {
    const { repository, db } = buildRepository();

    await expect(
      repository.findOffersByTenant(buildContext({ tenantId: '' as unknown as TenantId })),
    ).rejects.toThrow('Invalid tenant context (tenantId is missing, empty, or whitespace-only)');
    expect(db).not.toHaveBeenCalled();
  });

  it('refuses to query with a whitespace-only tenantId', async () => {
    const { repository, db } = buildRepository();

    await expect(
      repository.findOffersByTenant(buildContext({ tenantId: '  ' as unknown as TenantId })),
    ).rejects.toThrow('Invalid tenant context (tenantId is missing, empty, or whitespace-only)');
    expect(db).not.toHaveBeenCalled();
  });

  it('refuses to query an unknown tenant before any database access', async () => {
    const { repository, db } = buildRepository();

    await expect(
      repository.findOffersByTenant(buildContext({ tenantId: 'tenant42' as unknown as TenantId })),
    ).rejects.toThrow('Invalid tenant context (unknown tenant "tenant42")');
    expect(db).not.toHaveBeenCalled();
  });

  it('maps database rows to tenant-scoped offer payloads', async () => {
    const row: OfferRow = {
      id: 'offer-9',
      code: 'EXCLUSIVE10',
      discount_percentage: 10,
      max_redemptions: 50,
      current_redemptions: 12,
      expires_at: '2026-03-01T00:00:00.000Z',
      tenant_id: 'switchback',
      is_exclusive: true,
    };
    const { repository } = buildRepository([row]);

    const offers = await repository.findOffersByTenant(buildContext());

    const expected: OfferPayload = {
      id: 'offer-9',
      code: 'EXCLUSIVE10',
      discountPercentage: 10,
      maxRedemptions: 50,
      currentRedemptions: 12,
      expiresAt: new Date('2026-03-01T00:00:00.000Z'),
    };
    expect(offers).toEqual([expected]);
    expect(offers[0]?.expiresAt).toBeInstanceOf(Date);
  });

  it('accepts rows where expires_at is already a Date', async () => {
    const row: OfferRow = {
      id: 'offer-10',
      code: 'DATE5',
      discount_percentage: 5,
      max_redemptions: 10,
      current_redemptions: 0,
      expires_at: new Date('2026-06-01T00:00:00.000Z'),
      tenant_id: 'switchback',
      is_exclusive: false,
    };
    const { repository } = buildRepository([row]);

    const offers = await repository.findOffersByTenant(buildContext());

    expect(offers[0]?.expiresAt).toEqual(new Date('2026-06-01T00:00:00.000Z'));
  });
});

describe('OfferService over OfferRepository', () => {
  it('never surfaces a Switchback-exclusive offer to a tenant0 user', async () => {
    const { db } = createDatabase(breachRows());
    const service = new OfferService(new OfferRepository(db));

    const offers = await service.getValidOffers(buildContext({ tenantId: 'tenant0' }));

    expect(offers.map((offer) => offer.id)).toEqual(['tenant0-baseline']);
  });

  it("never leaks another tenant's offers through the service", async () => {
    const { db } = createDatabase(breachRows());
    const service = new OfferService(new OfferRepository(db));

    const offers = await service.getValidOffers(buildContext({ tenantId: 'switchback' }));

    expect(offers.map((offer) => offer.id)).toEqual([
      'switchback-exclusive',
      'switchback-baseline',
    ]);
  });
});
