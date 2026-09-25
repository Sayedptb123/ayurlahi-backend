import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RoomCategory } from '../retreat/entities/room-category.entity';
import { TreatmentPackage } from '../retreat/entities/treatment-package.entity';
import { RoomCategoryPricing } from '../retreat/entities/room-category-pricing.entity';
import { RoomPricingOverride } from '../retreat/entities/room-pricing-override.entity';
import { DutyType } from '../duty-types/entities/duty-type.entity';
import { DutyTemplate } from '../duty-templates/entities/duty-template.entity';
import { Branch } from '../branches/entities/branch.entity';

// ADR-004 D15 — the aggregate "needs branch assignment" discovery surface.
// A per-row badge alone isn't enough (an owner has no way to find every
// NULL-branch row across 6 different screens without paging through each
// one) — this is what powers the Dashboard stat card that lists them out.
@Injectable()
export class BranchCatalogService {
  constructor(
    @InjectRepository(RoomCategory)
    private readonly roomCategoryRepo: Repository<RoomCategory>,
    @InjectRepository(TreatmentPackage)
    private readonly packageRepo: Repository<TreatmentPackage>,
    @InjectRepository(RoomCategoryPricing)
    private readonly pricingRepo: Repository<RoomCategoryPricing>,
    @InjectRepository(RoomPricingOverride)
    private readonly overrideRepo: Repository<RoomPricingOverride>,
    @InjectRepository(DutyType)
    private readonly dutyTypeRepo: Repository<DutyType>,
    @InjectRepository(DutyTemplate)
    private readonly dutyTemplateRepo: Repository<DutyTemplate>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
  ) {}

  async getNeedsAssignmentSummary(organisationId: string): Promise<{
    total: number;
    breakdown: { entity: string; label: string; count: number; screen: string }[];
  }> {
    // A clinic with no live branches has nothing to assign to: NULL-branch
    // rows are normal there (branch visibility treats them the same way), so
    // flagging them would be an alert nobody can act on. Same "live" test as
    // BranchVisibilityService: approved and not deleted.
    const liveBranches = await this.branchRepo.count({ where: { organisationId, approvalStatus: 'approved' } });
    if (liveBranches === 0) return { total: 0, breakdown: [] };

    const where = { organisationId, branchId: IsNull(), deletedAt: IsNull() as any };

    // Prices and overrides whose category, package or room is deleted can't be
    // opened from any screen (and no booking can use them), so they aren't
    // counted: the count must only contain what a user can actually fix.
    const [roomCategories, packages, pricing, overrides, dutyTypes, dutyTemplates] = await Promise.all([
      this.roomCategoryRepo.count({ where }),
      this.packageRepo.count({ where }),
      this.pricingRepo
        .createQueryBuilder('p')
        .innerJoin('p.roomCategory', 'c')
        .innerJoin('p.package', 'k')
        .where('p.organisationId = :organisationId', { organisationId })
        .andWhere('p.branchId IS NULL')
        .andWhere('c.deletedAt IS NULL')
        .andWhere('k.deletedAt IS NULL')
        .getCount(),
      this.overrideRepo
        .createQueryBuilder('o')
        .innerJoin('o.room', 'r')
        .innerJoin('o.package', 'k')
        .where('o.organisationId = :organisationId', { organisationId })
        .andWhere('o.branchId IS NULL')
        .andWhere('r.deletedAt IS NULL')
        .andWhere('k.deletedAt IS NULL')
        .getCount(),
      this.dutyTypeRepo.count({ where }),
      this.dutyTemplateRepo.count({ where }),
    ]);

    const breakdown = [
      { entity: 'roomCategories', label: 'Room Categories', count: roomCategories, screen: 'RoomCategories' },
      { entity: 'packages', label: 'Packages', count: packages, screen: 'Packages' },
      { entity: 'pricingMatrix', label: 'Pricing Matrix entries', count: pricing, screen: 'PricingMatrix' },
      { entity: 'roomPricingOverrides', label: 'Room Pricing Overrides', count: overrides, screen: 'PricingMatrix' },
      { entity: 'dutyTypes', label: 'Shift Categories', count: dutyTypes, screen: 'DutyTypes' },
      { entity: 'dutyTemplates', label: 'Schedule Templates', count: dutyTemplates, screen: 'DutyTemplates' },
    ].filter((b) => b.count > 0);

    const total = breakdown.reduce((sum, b) => sum + b.count, 0);
    return { total, breakdown };
  }
}
