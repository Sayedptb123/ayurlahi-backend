import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RoomCategory } from '../retreat/entities/room-category.entity';
import { TreatmentPackage } from '../retreat/entities/treatment-package.entity';
import { RoomCategoryPricing } from '../retreat/entities/room-category-pricing.entity';
import { RoomPricingOverride } from '../retreat/entities/room-pricing-override.entity';
import { DutyType } from '../duty-types/entities/duty-type.entity';
import { DutyTemplate } from '../duty-templates/entities/duty-template.entity';

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
  ) {}

  async getNeedsAssignmentSummary(organisationId: string): Promise<{
    total: number;
    breakdown: { entity: string; label: string; count: number; screen: string }[];
  }> {
    const where = { organisationId, branchId: IsNull(), deletedAt: IsNull() as any };

    const [roomCategories, packages, pricing, overrides, dutyTypes, dutyTemplates] = await Promise.all([
      this.roomCategoryRepo.count({ where }),
      this.packageRepo.count({ where }),
      this.pricingRepo.count({ where }),
      this.overrideRepo.count({ where }),
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
