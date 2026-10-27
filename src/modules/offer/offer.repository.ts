import type { OfferPayload, TenantContext } from './offer.types.js';

export interface OfferQueryBuilder {
  where(column: string, value: unknown): OfferQueryBuilder;
  andWhere(column: string, value: unknown): OfferQueryBuilder;
  select(): Promise<OfferRow[]>;
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

const EXCLUSIVE_TENANT_ID = 'tenant0';

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
    const tenantId = context?.tenantId;
    if (typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('Invalid tenant context');
    }

    let query = this.db('offers').where('tenant_id', tenantId);
    if (tenantId === EXCLUSIVE_TENANT_ID) {
      query = query.andWhere('is_exclusive', false);
    }

    const rows = await query.select();
    return rows.map(toOfferPayload);
  }
}
