import { describe, expect, it, vi } from 'vitest';
import type { OfferPayload, TenantContext } from './offer.types.js';
import {
  OfferRepository,
  type OfferQueryBuilder,
  type OfferRow,
} from './offer.repository.js';

const buildContext = (overrides: Partial<TenantContext> = {}): TenantContext => ({
  tenantId: 'tenant1',
  environment: 'production',
  ...overrides,
});

class FakeQueryBuilder implements OfferQueryBuilder {
  readonly clauses: Array<{ column: string; value: unknown }> = [];

  constructor(private readonly rows: OfferRow[]) {}

  where(column: string, value: unknown): OfferQueryBuilder {
    this.clauses.push({ column, value });
    return this;
  }

  andWhere(column: string, value: unknown): OfferQueryBuilder {
    this.clauses.push({ column, value });
    return this;
  }

  select(): Promise<OfferRow[]> {
    return Promise.resolve(this.rows);
  }
}

const createDatabase = (rows: OfferRow[] = []) => {
  const builders: FakeQueryBuilder[] = [];
  const db = vi.fn((table: string): OfferQueryBuilder => {
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

    await repository.findOffersByTenant(buildContext({ tenantId: 'tenant42' }));

    expect(builders[0]?.clauses).toEqual([{ column: 'tenant_id', value: 'tenant42' }]);
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

  it('never appends is_exclusive for other tenants', async () => {
    const { repository, builders } = buildRepository();

    await repository.findOffersByTenant(buildContext({ tenantId: 'tenant1' }));

    expect(builders[0]?.clauses).toEqual([{ column: 'tenant_id', value: 'tenant1' }]);
  });

  it('refuses to query without a tenantId', async () => {
    const { repository, db } = buildRepository();

    await expect(
      repository.findOffersByTenant({ environment: 'production' } as TenantContext),
    ).rejects.toThrow('Invalid tenant context');
    expect(db).not.toHaveBeenCalled();
  });

  it('refuses to query with an empty tenantId', async () => {
    const { repository, db } = buildRepository();

    await expect(repository.findOffersByTenant(buildContext({ tenantId: '' }))).rejects.toThrow(
      'Invalid tenant context',
    );
    expect(db).not.toHaveBeenCalled();
  });

  it('refuses to query with a whitespace-only tenantId', async () => {
    const { repository, db } = buildRepository();

    await expect(repository.findOffersByTenant(buildContext({ tenantId: '  ' }))).rejects.toThrow(
      'Invalid tenant context',
    );
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
      tenant_id: 'tenant1',
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
      tenant_id: 'tenant1',
      is_exclusive: false,
    };
    const { repository } = buildRepository([row]);

    const offers = await repository.findOffersByTenant(buildContext());

    expect(offers[0]?.expiresAt).toEqual(new Date('2026-06-01T00:00:00.000Z'));
  });
});
