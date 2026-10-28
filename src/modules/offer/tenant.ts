export const TENANT_IDS = ['tenant0', 'switchback'] as const;

export type TenantId = (typeof TENANT_IDS)[number];

export class InvalidTenantContextError extends Error {
  constructor(detail: string) {
    super(`Invalid tenant context (${detail})`);
    this.name = 'InvalidTenantContextError';
  }
}

export function isTenantId(value: unknown): value is TenantId {
  return typeof value === 'string' && (TENANT_IDS as readonly string[]).includes(value);
}

export function assertTenantId(value: unknown): TenantId {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new InvalidTenantContextError('tenantId is missing, empty, or whitespace-only');
  }
  if (!isTenantId(value)) {
    throw new InvalidTenantContextError(`unknown tenant "${value}"`);
  }
  return value;
}
