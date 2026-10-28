import type { OfferPayload, TenantContext } from './offer.types.js';
import { assertTenantId } from './tenant.js';

export interface TenantScopedOfferQuery {
  andWhere(column: string, value: unknown): TenantScopedOfferQuery;
  select(): Promise<OfferRow[]>;
}

export interface OfferQueryBuilder {
  where(column: 'tenant_id', value: string): TenantScopedOfferQuery;
}

export interface OfferRow {
  id: string;
  code: string;
  discount_percentage: number;
  max_redemptions: number;
  current_redemptions: number;
  expires_at: Date | string;
  tenant_id: string;
  is_exclusive: boolean;
}

export type OfferDatabaseClient = (table: 'offers') => OfferQueryBuilder;

const EXCLUSIVITY_TENANT_ID = 'switchback';

function toOfferPayload(row: OfferRow): OfferPayload {
  const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
  return {
    id: row.id,
    code: row.code,
    discountPercentage: row.discount_percentage,
    maxRedemptions: row.max_redemptions,
    currentRedemptions: row.current_redemptions,
    expiresAt,
  };
}

export class OfferRepository {
  constructor(private readonly db: OfferDatabaseClient) {}

  async findOffersByTenant(context: TenantContext): Promise<OfferPayload[]> {
    const tenantId = assertTenantId(context?.tenantId);

    let query = this.db('offers').where('tenant_id', tenantId);
    if (tenantId !== EXCLUSIVITY_TENANT_ID) {
      query = query.andWhere('is_exclusive', false);
    }

    const rows = await query.select();
    return rows.map(toOfferPayload);
  }
}
