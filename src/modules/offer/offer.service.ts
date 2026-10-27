import type {
  OfferDataSource,
  OfferPayload,
  OfferValidationResult,
  TenantContext,
} from './offer.types.js';

export class OfferService {
  constructor(private readonly repository: OfferDataSource) {}

  validateOffer(context: TenantContext, offer: OfferPayload): OfferValidationResult {
    if (typeof context?.tenantId !== 'string' || context.tenantId.trim() === '') {
      return { isValid: false, reason: 'Invalid tenant context' };
    }

    if (offer.expiresAt.getTime() < Date.now()) {
      return { isValid: false, reason: 'Offer has expired' };
    }

    if (offer.currentRedemptions >= offer.maxRedemptions) {
      return { isValid: false, reason: 'Redemption limit reached' };
    }

    return { isValid: true };
  }

  async getValidOffers(context: TenantContext): Promise<OfferPayload[]> {
    const offers = await this.repository.findOffersByTenant(context);
    return offers.filter((offer) => this.validateOffer(context, offer).isValid);
  }
}
