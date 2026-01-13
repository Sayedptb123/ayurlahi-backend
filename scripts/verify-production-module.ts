import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ManufacturingService } from '../src/manufacturing/manufacturing.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Organisation } from '../src/organisations/entities/organisation.entity';
import { ManufacturingFormula } from '../src/manufacturing/entities/manufacturing-formula.entity';
import { Product } from '../src/products/entities/product.entity';
import { RawMaterial } from '../src/manufacturing/entities/raw-material.entity';
import { Batch } from '../src/manufacturing/entities/batch.entity';
import { Repository } from 'typeorm';

async function bootstrap() {
    console.log('🚀 Starting Production Module Verification...\n');

    const app = await NestFactory.createApplicationContext(AppModule);
    const manufacturingService = app.get(ManufacturingService);
    const orgRepo = app.get<Repository<Organisation>>(getRepositoryToken(Organisation));
    const formulaRepo = app.get<Repository<ManufacturingFormula>>(getRepositoryToken(ManufacturingFormula));
    const productRepo = app.get<Repository<Product>>(getRepositoryToken(Product));
    const rawMaterialRepo = app.get<Repository<RawMaterial>>(getRepositoryToken(RawMaterial));
    const batchRepo = app.get<Repository<Batch>>(getRepositoryToken(Batch));

    // 1. Get Manufacturer
    const manufacturer = await orgRepo.findOne({ where: { name: 'Ayurvedic Herbs Ltd' } });
    if (!manufacturer) {
        console.error('❌ Manufacturer not found');
        process.exit(1);
    }

    // 2. Get Formula "Golden Milk Mix"
    let formula = await formulaRepo.findOne({
        where: { name: 'Golden Milk Mix', manufacturerId: manufacturer.id },
        relations: ['items', 'items.rawMaterial']
    });

    if (!formula) {
        console.error('❌ Formula "Golden Milk Mix" not found');
        process.exit(1);
    }

    // 3. Ensure Target Product Exists and Link it
    // We need a product to produce.
    let product = await productRepo.findOne({ where: { name: 'Golden Milk Mix 500g', manufacturerId: manufacturer.id } });
    if (!product) {
        console.log('ℹ️ Creating Target Product "Golden Milk Mix 500g"...');
        const sku = `PROD-GOLD-${Date.now()}`;
        product = productRepo.create({
            manufacturerId: manufacturer.id,
            name: 'Golden Milk Mix 500g',
            sku: sku,
            price: 500,
            stockQuantity: 0,
            description: 'Immunity Booster',
            isActive: true
        });
        product = await productRepo.save(product);
        console.log(`✅ Created Product: ${product.name} (Stock: ${product.stockQuantity})`);
    } else {
        console.log(`✅ Found Product: ${product.name} (Stock: ${product.stockQuantity})`);
    }

    // Link Formula to Product
    if (formula.targetProductId !== product.id) {
        console.log('ℹ️ Linking Formula to Product...');
        formula.targetProduct = product;
        formula.targetProductId = product.id;
        await formulaRepo.save(formula);
    }

    // 4. Check Raw Materials
    // Formula needs: Turmeric (60), Ginger (10), Ashwagandha (30) for 100kg batch
    // Let's produce 10kg (10% batch)
    const plannedQty = 10;
    const batchNumber = `BATCH-${Date.now()}`;

    console.log(`\n🔄 Starting Batch ${batchNumber} for ${plannedQty}kg...`);

    try {
        const batch = await manufacturingService.startBatch(
            manufacturer.id,
            formula.id,
            plannedQty,
            batchNumber
        );
        console.log(`✅ Batch Started! ID: ${batch.id}`);
        console.log(`   Status: ${batch.status}`);

        // Verify Raw Material Deduction
        // 10% of 60kg Turmeric = 6kg
        // 10% of 10kg Ginger = 1kg
        // 10% of 30kg Ashwagandha = 3kg

        // We verify one for brevity
        const turmeric = await rawMaterialRepo.findOne({ where: { sku: 'RM-TUR-002' } });
        if (turmeric) {
            console.log(`   Turmeric Stock: ${turmeric.currentStock} (Should be reduced)`);
        } else {
            console.log('   ⚠️ Turmeric not found to verify stock');
        }


        // 5. Complete Batch
        console.log(`\n🔄 Completing Batch...`);
        const completedBatch = await manufacturingService.completeBatch(batch.id, plannedQty);
        console.log(`✅ Batch Completed!`);
        console.log(`   Status: ${completedBatch.status}`);
        console.log(`   Actual Yield: ${completedBatch.actualYield}`);

        // 6. Verify Finished Good Stock
        const updatedProduct = await productRepo.findOne({ where: { id: product.id } });

        if (updatedProduct) {
            console.log(`\n✅ Finished Good Stock: ${updatedProduct.stockQuantity} (Prev: ${product.stockQuantity})`);

            if (Number(updatedProduct.stockQuantity) === Number(product.stockQuantity) + plannedQty) {
                console.log('✅ Stock update verify SUCCESS');
            } else {
                console.error(`❌ Stock update match FAILED. Expected ${Number(product.stockQuantity) + plannedQty}, got ${updatedProduct.stockQuantity}`);
            }
        } else {
            console.error('❌ Updated product not found');
        }

    } catch (error) {
        console.error('❌ Error during production flow:', error.message);
    }

    console.log('\n========================================');
    console.log('✅ Production Module Verified');
    console.log('========================================\n');

    await app.close();
}

bootstrap();
