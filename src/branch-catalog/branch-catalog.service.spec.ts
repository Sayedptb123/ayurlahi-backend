import { BranchCatalogService } from './branch-catalog.service';

// scope/Needs_Branch_Remediation_Plan_2026-09-26.md B2/B3.
describe('BranchCatalogService.getNeedsAssignmentSummary', () => {
  const makeQb = (count: number) => {
    const qb: any = {
      conditions: [] as string[],
      innerJoin: jest.fn(() => qb),
      where: jest.fn((c: string) => { qb.conditions.push(c); return qb; }),
      andWhere: jest.fn((c: string) => { qb.conditions.push(c); return qb; }),
      getCount: jest.fn(() => Promise.resolve(count)),
    };
    return qb;
  };

  const makeService = (opts: { liveBranches: number; counts?: Partial<Record<string, number>> }) => {
    const c = { categories: 0, packages: 0, pricing: 0, overrides: 0, dutyTypes: 0, dutyTemplates: 0, ...opts.counts };
    const pricingQb = makeQb(c.pricing);
    const overrideQb = makeQb(c.overrides);
    const repos = {
      category: { count: jest.fn(() => Promise.resolve(c.categories)) },
      pkg: { count: jest.fn(() => Promise.resolve(c.packages)) },
      pricing: { createQueryBuilder: jest.fn(() => pricingQb), count: jest.fn() },
      override: { createQueryBuilder: jest.fn(() => overrideQb), count: jest.fn() },
      dutyType: { count: jest.fn(() => Promise.resolve(c.dutyTypes)) },
      dutyTemplate: { count: jest.fn(() => Promise.resolve(c.dutyTemplates)) },
      branch: { count: jest.fn(() => Promise.resolve(opts.liveBranches)) },
    };
    const service = new BranchCatalogService(
      repos.category as any, repos.pkg as any, repos.pricing as any, repos.override as any,
      repos.dutyType as any, repos.dutyTemplate as any, repos.branch as any,
    );
    return { service, repos, pricingQb, overrideQb };
  };

  it('returns 0 for a clinic with no live branches, without counting anything', async () => {
    const { service, repos } = makeService({ liveBranches: 0, counts: { categories: 3, packages: 1, pricing: 1 } });
    await expect(service.getNeedsAssignmentSummary('org-1')).resolves.toEqual({ total: 0, breakdown: [] });
    expect(repos.branch.count).toHaveBeenCalledWith({ where: { organisationId: 'org-1', approvalStatus: 'approved' } });
    expect(repos.category.count).not.toHaveBeenCalled();
    expect(repos.pricing.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('counts prices and overrides only when their parents are not deleted', async () => {
    const { service, pricingQb, overrideQb, repos } = makeService({ liveBranches: 2, counts: { pricing: 2, overrides: 1 } });
    const result = await service.getNeedsAssignmentSummary('org-1');

    expect(pricingQb.innerJoin).toHaveBeenCalledWith('p.roomCategory', 'c');
    expect(pricingQb.innerJoin).toHaveBeenCalledWith('p.package', 'k');
    expect(pricingQb.conditions).toEqual(expect.arrayContaining(['p.branchId IS NULL', 'c.deletedAt IS NULL', 'k.deletedAt IS NULL']));
    expect(overrideQb.innerJoin).toHaveBeenCalledWith('o.room', 'r');
    expect(overrideQb.conditions).toEqual(expect.arrayContaining(['o.branchId IS NULL', 'r.deletedAt IS NULL', 'k.deletedAt IS NULL']));
    // The plain repo count (which can't see parents) is no longer used for these two.
    expect(repos.pricing.count).not.toHaveBeenCalled();
    expect(repos.override.count).not.toHaveBeenCalled();

    expect(result.total).toBe(3);
    expect(result.breakdown.map((b) => b.entity)).toEqual(['pricingMatrix', 'roomPricingOverrides']);
  });
});
