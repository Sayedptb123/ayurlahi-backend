import { ForbiddenException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductStatus } from './enums/product-status.enum';

// SEC-7 regression: update() checked
//   else if (organisationType && organisationType !== 'SUPER_ADMIN') throw
// but 'SUPER_ADMIN' is a userRole value, never an organisationType (the
// real values are CLINIC/MANUFACTURER/AYURLAHI_TEAM) — so that condition
// never matched, and an undefined organisationType short-circuited the
// `organisationType &&` guard, skipping the check entirely. Any
// authenticated user could edit any manufacturer's product.

const product = { id: 'prod-1', manufacturerId: 'org-mfg', sku: 'SKU1', status: ProductStatus.ACTIVE };

const makeService = () => {
  const productsRepository = {
    findOne: jest.fn(() => Promise.resolve({ ...product })),
    save: jest.fn((p) => Promise.resolve(p)),
  };
  const service = new ProductsService(productsRepository as any);
  return { service, productsRepository };
};

describe('ProductsService.update — SEC-7 org-scoping (write path)', () => {
  it('MANUFACTURER caller owning the product can update it', async () => {
    const { service } = makeService();
    await expect(
      service.update('prod-1', 'u1', 'org-mfg', 'MANUFACTURER', {} as any),
    ).resolves.toMatchObject({ id: 'prod-1' });
  });

  it('MANUFACTURER caller for a different manufacturer is denied', async () => {
    const { service } = makeService();
    await expect(
      service.update('prod-1', 'u1', 'org-other-mfg', 'MANUFACTURER', {} as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('AYURLAHI_TEAM caller can update any manufacturer\'s product', async () => {
    const { service } = makeService();
    await expect(
      service.update('prod-1', 'u1', 'org-team', 'AYURLAHI_TEAM', {} as any),
    ).resolves.toMatchObject({ id: 'prod-1' });
  });

  it('undefined organisationType is denied, not silently allowed', async () => {
    const { service } = makeService();
    await expect(
      service.update('prod-1', 'u1', undefined as any, undefined as any, {} as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('CLINIC organisationType is denied — clinics never own products', async () => {
    const { service } = makeService();
    await expect(
      service.update('prod-1', 'u1', 'org-clinic', 'CLINIC', {} as any),
    ).rejects.toThrow(ForbiddenException);
  });
});
