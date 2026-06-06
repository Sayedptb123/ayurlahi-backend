import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetCategory } from './entities/asset-category.entity';
import { Asset } from './entities/asset.entity';
import { AssetMaintenance } from './entities/asset-maintenance.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssetCategory, Asset, AssetMaintenance, Expense]),
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetModule {}
