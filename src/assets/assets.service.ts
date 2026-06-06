import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Like, LessThanOrEqual } from 'typeorm';
import { AssetCategory, DepreciationMethod } from './entities/asset-category.entity';
import { Asset, AssetStatus } from './entities/asset.entity';
import { AssetMaintenance } from './entities/asset-maintenance.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { LogMaintenanceDto } from './dto/log-maintenance.dto';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(AssetCategory)
    private readonly categoryRepository: Repository<AssetCategory>,
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    @InjectRepository(AssetMaintenance)
    private readonly maintenanceRepository: Repository<AssetMaintenance>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  // ==========================================================================
  // ASSET CATEGORIES
  // ==========================================================================

  async createCategory(organisationId: string, dto: CreateAssetCategoryDto) {
    const category = this.categoryRepository.create({
      ...dto,
      organisationId,
    });
    return this.categoryRepository.save(category);
  }

  async findAllCategories(organisationId: string) {
    return this.categoryRepository.find({
      where: { organisationId, deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async deleteCategory(id: string, organisationId: string) {
    const category = await this.categoryRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
    });
    if (!category) {
      throw new NotFoundException('Asset category not found');
    }
    category.deletedAt = new Date();
    await this.categoryRepository.save(category);
    return { success: true };
  }

  // ==========================================================================
  // ASSETS CRUD
  // ==========================================================================

  async createAsset(organisationId: string, dto: CreateAssetDto) {
    // 1. Verify category exists
    const category = await this.categoryRepository.findOne({
      where: { id: dto.categoryId, organisationId, deletedAt: IsNull() },
    });
    if (!category) {
      throw new NotFoundException('Asset category not found');
    }

    // 2. Base asset mapping
    const purchaseDate = dto.purchaseDate ? new Date(dto.purchaseDate) : null;
    let nextMaintenanceDate: Date | null = null;

    // 3. Compute initial next maintenance if interval is set
    if (dto.maintenanceIntervalDays && purchaseDate) {
      nextMaintenanceDate = new Date(purchaseDate.getTime() + dto.maintenanceIntervalDays * 24 * 60 * 60 * 1000);
    }

    const asset = this.assetRepository.create({
      ...dto,
      organisationId,
      purchaseDate,
      nextMaintenanceDate,
      status: dto.status ?? AssetStatus.ACTIVE,
    });

    const saved = await this.assetRepository.save(asset);
    return this.formatAsset(saved, category);
  }

  async findAllAssets(
    organisationId: string,
    query: { categoryId?: string; status?: AssetStatus; search?: string; needsMaintenance?: string } = {}
  ) {
    const where: any = { organisationId, deletedAt: IsNull() };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.needsMaintenance === 'true') {
      where.nextMaintenanceDate = LessThanOrEqual(new Date());
    }

    // Load assets with category relation (required for depreciation calculations)
    const assets = await this.assetRepository.find({
      where,
      relations: ['category', 'assignedToStaff'],
      order: { createdAt: 'DESC' },
    });

    // Handle string search in app memory to avoid complicated SQL parsing of multiple text columns
    let filtered = assets;
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filtered = assets.filter(
        (a) =>
          a.name.toLowerCase().includes(searchLower) ||
          a.assetCode.toLowerCase().includes(searchLower) ||
          (a.brand && a.brand.toLowerCase().includes(searchLower)) ||
          (a.model && a.model.toLowerCase().includes(searchLower))
      );
    }

    return filtered.map((a) => this.formatAsset(a, a.category));
  }

  async findOneAsset(id: string, organisationId: string) {
    const asset = await this.assetRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
      relations: ['category', 'assignedToStaff', 'purchaseOrder'],
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return this.formatAsset(asset, asset.category);
  }

  async updateAsset(id: string, organisationId: string, dto: UpdateAssetDto) {
    const asset = await this.assetRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
      relations: ['category'],
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Capture old states to check if next maintenance date should recalculate
    const oldInterval = asset.maintenanceIntervalDays;
    const oldPurchaseDate = asset.purchaseDate ? asset.purchaseDate.toISOString().split('T')[0] : null;

    // Merge properties
    Object.assign(asset, dto);

    // Resolve dates
    if (dto.purchaseDate) {
      asset.purchaseDate = new Date(dto.purchaseDate);
    }

    // Recalculate next maintenance date if purchase date or interval has changed
    const intervalChanged = dto.maintenanceIntervalDays !== undefined && dto.maintenanceIntervalDays !== oldInterval;
    const purchaseDateChanged = dto.purchaseDate !== undefined && dto.purchaseDate !== oldPurchaseDate;

    if ((intervalChanged || purchaseDateChanged) && asset.maintenanceIntervalDays && asset.purchaseDate) {
      const baseDate = asset.lastMaintenanceDate ? new Date(asset.lastMaintenanceDate) : new Date(asset.purchaseDate);
      asset.nextMaintenanceDate = new Date(baseDate.getTime() + asset.maintenanceIntervalDays * 24 * 60 * 60 * 1000);
    }

    // Resolve category if updated
    let category = asset.category;
    if (dto.categoryId && dto.categoryId !== asset.categoryId) {
      const cat = await this.categoryRepository.findOne({
        where: { id: dto.categoryId, organisationId, deletedAt: IsNull() },
      });
      if (!cat) throw new NotFoundException('New asset category not found');
      asset.category = cat;
      category = cat;
    }

    const saved = await this.assetRepository.save(asset);
    return this.formatAsset(saved, category);
  }

  async deleteAsset(id: string, organisationId: string) {
    const asset = await this.assetRepository.findOne({
      where: { id, organisationId, deletedAt: IsNull() },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    asset.deletedAt = new Date();
    await this.assetRepository.save(asset);
    return { success: true };
  }

  // ==========================================================================
  // ASSET MAINTENANCE LOGS
  // ==========================================================================

  async logMaintenance(assetId: string, organisationId: string, dto: LogMaintenanceDto, userId: string) {
    const asset = await this.assetRepository.findOne({
      where: { id: assetId, organisationId, deletedAt: IsNull() },
      relations: ['category'],
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const maintDate = new Date(dto.maintenanceDate);
    let nextMaintDate: Date | null = null;

    // 1. Calculate next maintenance date
    if (dto.nextMaintenanceDate) {
      nextMaintDate = new Date(dto.nextMaintenanceDate);
    } else if (asset.maintenanceIntervalDays) {
      nextMaintDate = new Date(maintDate.getTime() + asset.maintenanceIntervalDays * 24 * 60 * 60 * 1000);
    }

    // 2. Create the ledger Expense if integrated
    let paymentId: string | null = null;
    if (dto.integrateExpense && dto.cost && dto.cost > 0) {
      const expense = this.expenseRepository.create({
        organisationId,
        amount: dto.cost,
        category: 'Maintenance',
        description: `Asset Maintenance Cost: [${asset.assetCode}] ${asset.name} - Service provider: ${dto.serviceProvider || 'N/A'}`,
        expenseDate: maintDate,
        status: 'verified',
        incurredBy: userId,
        createdBy: userId,
        approvedBy: userId,
        approvedAt: new Date(),
      });
      const savedExpense = await this.expenseRepository.save(expense);
      paymentId = savedExpense.id;
    }

    // 3. Create maintenance record
    const maintenance = this.maintenanceRepository.create({
      assetId,
      maintenanceType: dto.maintenanceType,
      maintenanceDate: maintDate,
      cost: dto.cost ?? null,
      serviceProvider: dto.serviceProvider ?? null,
      description: dto.description ?? null,
      nextMaintenanceDate: nextMaintDate,
      paymentId,
      performedBy: userId,
    });

    const savedMaint = await this.maintenanceRepository.save(maintenance);

    // 4. Update core asset flags
    asset.lastMaintenanceDate = maintDate;
    asset.nextMaintenanceDate = nextMaintDate;
    asset.status = AssetStatus.ACTIVE; // Return asset status to active upon service completion
    await this.assetRepository.save(asset);

    return savedMaint;
  }

  async getMaintenanceHistory(assetId: string, organisationId: string) {
    const asset = await this.assetRepository.findOne({
      where: { id: assetId, organisationId, deletedAt: IsNull() },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return this.maintenanceRepository.find({
      where: { assetId },
      relations: ['performedByUser'],
      order: { maintenanceDate: 'DESC' },
    });
  }

  // ==========================================================================
  // DEPRECIATION FORMULA LOGIC
  // ==========================================================================

  calculateDepreciatedValue(
    purchasePrice: number,
    purchaseDate: Date,
    rate: number,
    method: DepreciationMethod
  ): number {
    const ageInMs = Date.now() - purchaseDate.getTime();
    if (ageInMs <= 0) return purchasePrice;

    // Calculate fractional years since purchase
    const ageInYears = ageInMs / (365.25 * 24 * 60 * 60 * 1000);
    const r = rate / 100;

    let currentValue = purchasePrice;

    if (method === DepreciationMethod.STRAIGHT_LINE) {
      // SL: Value reduces by a fixed percentage of cost every year
      const totalDepreciation = purchasePrice * r * ageInYears;
      currentValue = purchasePrice - totalDepreciation;
    } else if (method === DepreciationMethod.DECLINING_BALANCE) {
      // DB: Value reduces by a fixed percentage of CURRENT value every year
      currentValue = purchasePrice * Math.pow(1 - r, ageInYears);
    }

    // Ensure asset value never goes below zero
    return Math.max(0, Math.round(currentValue * 100) / 100);
  }

  // Formatting helper to inject computed fields
  private formatAsset(asset: Asset, category?: AssetCategory) {
    const purchasePrice = asset.purchasePrice ? Number(asset.purchasePrice) : null;
    let currentValue = purchasePrice;

    if (purchasePrice && asset.purchaseDate && category && category.depreciationRate) {
      currentValue = this.calculateDepreciatedValue(
        purchasePrice,
        new Date(asset.purchaseDate),
        Number(category.depreciationRate),
        category.depreciationMethod
      );
    }

    return {
      ...asset,
      currentValue,
    };
  }
}
