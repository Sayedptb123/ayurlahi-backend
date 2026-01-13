import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RawMaterial } from './entities/raw-material.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { ManufacturingFormula } from './entities/manufacturing-formula.entity';
import { FormulaItem } from './entities/formula-item.entity';
import { ProcessStage } from './entities/process-stage.entity';
import { Equipment } from './entities/equipment.entity';
import { Batch } from './entities/batch.entity';
import { BatchStage } from './entities/batch-stage.entity';
import { WastageLog } from './entities/wastage-log.entity';


import { ManufacturingService } from './manufacturing.service';
import { ManufacturingController } from './manufacturing.controller';

@Module({
    imports: [TypeOrmModule.forFeature([
        RawMaterial,
        InventoryTransaction,
        ManufacturingFormula,
        FormulaItem,
        ProcessStage,
        Equipment,
        Batch,
        BatchStage,
        WastageLog,
    ])],
    controllers: [ManufacturingController],
    providers: [ManufacturingService],
    exports: [ManufacturingService],
})
export class ManufacturingModule { }
