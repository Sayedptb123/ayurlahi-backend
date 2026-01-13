import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { RawMaterial } from './entities/raw-material.entity';
import { InventoryTransaction, TransactionType } from './entities/inventory-transaction.entity';
import { ManufacturingFormula } from './entities/manufacturing-formula.entity';
import { FormulaItem } from './entities/formula-item.entity';
import { Batch, BatchStatus } from './entities/batch.entity';
import { BatchStage, StageStatus } from './entities/batch-stage.entity';
import { ProcessStage } from './entities/process-stage.entity';
import { WastageLog } from './entities/wastage-log.entity';

@Injectable()
export class ManufacturingService {
    constructor(
        @InjectRepository(RawMaterial)
        private rawMaterialRepository: Repository<RawMaterial>,
        @InjectRepository(InventoryTransaction)
        private inventoryTransactionRepository: Repository<InventoryTransaction>,
        @InjectRepository(ManufacturingFormula)
        private formulaRepository: Repository<ManufacturingFormula>,
        @InjectRepository(Batch)
        private batchRepository: Repository<Batch>,
        @InjectRepository(ProcessStage)
        private processStageRepository: Repository<ProcessStage>,
        private dataSource: DataSource,
    ) { }

    // --- Raw Materials ---
    async createRawMaterial(data: Partial<RawMaterial>) {
        const material = this.rawMaterialRepository.create(data);
        return this.rawMaterialRepository.save(material);
    }

    async findAllRawMaterials(manufacturerId: string) {
        return this.rawMaterialRepository.find({
            where: { manufacturerId, isActive: true },
            order: { name: 'ASC' },
        });
    }

    // --- Inventory Management ---
    async addStock(
        manufacturerId: string,
        rawMaterialId: string,
        quantity: number,
        unitCost: number,
        notes?: string,
    ) {
        return this.dataSource.transaction(async (manager) => {
            const material = await manager.findOne(RawMaterial, { where: { id: rawMaterialId } });
            if (!material) throw new NotFoundException('Raw material not found');

            // Update current stock
            material.currentStock = Number(material.currentStock) + Number(quantity);
            await manager.save(material);

            // Create transaction log
            const transaction = manager.create(InventoryTransaction, {
                manufacturerId,
                rawMaterialId,
                transactionType: TransactionType.PURCHASE,
                quantity,
                unitCost,
                notes,
                transactionDate: new Date(),
            });
            return manager.save(transaction);
        });
    }

    // --- Production ---

    // Create Master Stages (e.g., Cleaning, Boiling)
    async createProcessStage(data: Partial<ProcessStage>) {
        // Check if stage exists for this manufacturer
        const existing = await this.processStageRepository.findOne({
            where: { manufacturerId: data.manufacturerId, name: data.name }
        });
        if (existing) return existing;

        const stage = this.processStageRepository.create(data);
        return this.processStageRepository.save(stage);
    }

    async findAllStages(manufacturerId: string) {
        return this.processStageRepository.find({
            where: { manufacturerId },
            order: { order: 'ASC' }
        });
    }

    // Create Formula
    async createFormula(data: Partial<ManufacturingFormula> & { items: any[] }) {
        const formula = this.formulaRepository.create({
            ...data,
            items: data.items.map(item => ({
                ...item,
                // Ensure relationships are set if needed, usually cascade handles it
            }))
        });
        return this.formulaRepository.save(formula);
    }

    async getFormulas(manufacturerId: string) {
        return this.formulaRepository.find({
            where: { manufacturerId, isActive: true },
            relations: ['items', 'items.rawMaterial', 'targetProduct'],
        });
    }

    // Start Batch
    async startBatch(
        manufacturerId: string,
        formulaId: string,
        plannedQuantity: number,
        batchNumber: string,
    ) {
        return this.dataSource.transaction(async (manager) => {
            const formula = await manager.findOne(ManufacturingFormula, {
                where: { id: formulaId },
                relations: ['items', 'items.rawMaterial'],
            });
            if (!formula) throw new NotFoundException('Formula not found');

            // 1. Calculate required materials scaling factor
            // Formula is for 'standardBatchSize', we want 'plannedQuantity'
            const scaleFactor = plannedQuantity / formula.standardBatchSize;

            // 2. Check stock availability
            for (const item of formula.items) {
                const requiredQty = item.quantity * scaleFactor;
                if (item.rawMaterial.currentStock < requiredQty) {
                    throw new BadRequestException(
                        `Insufficient stock for ${item.rawMaterial.name}. Required: ${requiredQty}, Available: ${item.rawMaterial.currentStock}`
                    );
                }
            }

            // 3. Create Batch
            const batch = manager.create(Batch, {
                manufacturerId,
                formulaId,
                targetProductId: formula.targetProductId,
                batchNumber,
                plannedQuantity,
                status: BatchStatus.IN_PROGRESS,
                startDate: new Date(),
            });
            const savedBatch = await manager.save(batch);

            // 4. Reserve/Deduct Materials
            let totalMaterialCost = 0;
            for (const item of formula.items) {
                const requiredQty = item.quantity * scaleFactor;

                // Update stock
                item.rawMaterial.currentStock -= requiredQty;
                await manager.save(item.rawMaterial);

                // Log Transaction (Usage)
                // Note: We need a way to get unit cost (FIFO/Avg). For now assume 0 or handle later.
                // Simplified: Unit cost tracking is complex, using 0 placeholder or last purchase price if available.
                const unitCost = 0; // TODO: Implement cost retrieval

                const transaction = manager.create(InventoryTransaction, {
                    manufacturerId,
                    rawMaterialId: item.rawMaterialId,
                    transactionType: TransactionType.PRODUCTION_USAGE,
                    quantity: -requiredQty, // Negative for usage
                    batchId: savedBatch.id,
                    unitCost,
                    transactionDate: new Date(),
                    notes: `Used in Batch ${batchNumber}`,
                });
                await manager.save(transaction);

                totalMaterialCost += (requiredQty * unitCost);
            }

            // Update batch cost (initial)
            savedBatch.totalMaterialCost = totalMaterialCost;
            await manager.save(savedBatch);

            // 5. Create Batch Stages (Copy from Master Process Stages? Or Defined in Formula?)
            // For now, let's pull all master stages for simplicity, or we should have stored stages in Formula.
            // Assuming naive flow: All master stages apply.
            const stages = await this.processStageRepository.find({
                where: { manufacturerId },
                order: { order: 'ASC' }
            });

            for (const stage of stages) {
                const batchStage = manager.create(BatchStage, {
                    batchId: savedBatch.id,
                    processStageId: stage.id,
                    name: stage.name, // Snapshot name
                    status: StageStatus.PENDING,
                    order: stage.order,
                });
                await manager.save(batchStage);
            }

            return savedBatch;
        });
    }

    async getBatches(manufacturerId: string) {
        return this.batchRepository.find({
            where: { manufacturerId },
            relations: ['formula', 'stages'],
            order: { startDate: 'DESC' }
        });
    }

    async completeBatch(batchId: string, actualYield?: number) {
        return this.dataSource.transaction(async (manager) => {
            const batch = await manager.findOne(Batch, {
                where: { id: batchId },
                relations: ['targetProduct']
            });

            if (!batch) throw new NotFoundException('Batch not found');
            if (batch.status === BatchStatus.COMPLETED) throw new BadRequestException('Batch already completed');

            // 1. Update Batch Status
            batch.status = BatchStatus.COMPLETED;
            batch.completionDate = new Date();
            batch.actualYield = actualYield || batch.plannedQuantity; // Default to planned if not specified

            await manager.save(batch);

            // 2. Add Stock to Finished Good (Product)
            if (batch.targetProduct) {
                // We need to fetch product again to ensure we are updating latest state or lock it, but for now simple update
                // manager.increment is better for concurrency but standard save implies we loaded it.
                // Relation loaded it? Yes 'relations: ['targetProduct']'
                // However, we need to save the PRODUCT, not just the relation nested in batch.
                const product = batch.targetProduct;
                product.stockQuantity += Number(batch.actualYield);
                await manager.save(product);
            }

            return batch;
        });
    }
}
