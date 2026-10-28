import type { TenantId } from './tenant.js';

export interface TenantContext {
  tenantId: TenantId;
  environment: 'development' | 'staging' | 'production';
}

export interface OfferPayload {
  id: string;
  code: string;
  discountPercentage: number;
  maxRedemptions: number;
  currentRedemptions: number;
  expiresAt: Date;
}

export interface OfferValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface OfferDataSource {
  findOffersByTenant(context: TenantContext): Promise<OfferPayload[]>;
}
