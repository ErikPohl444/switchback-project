export interface TenantContext {
  tenantId: string;
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
