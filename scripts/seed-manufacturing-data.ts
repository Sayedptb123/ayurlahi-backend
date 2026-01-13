
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organisation } from '../src/organisations/entities/organisation.entity';
import { RawMaterial } from '../src/manufacturing/entities/raw-material.entity';
import { ManufacturingFormula } from '../src/manufacturing/entities/manufacturing-formula.entity';
import { FormulaItem } from '../src/manufacturing/entities/formula-item.entity';

async function bootstrap() {
    console.log('🚀 Starting Manufacturing Data Seeding...\n');

    const app = await NestFactory.createApplicationContext(AppModule);

    const organisationRepository = app.get<Repository<Organisation>>(getRepositoryToken(Organisation));
    const rawMaterialRepository = app.get<Repository<RawMaterial>>(getRepositoryToken(RawMaterial));
    const formulaRepository = app.get<Repository<ManufacturingFormula>>(getRepositoryToken(ManufacturingFormula));
    const formulaItemRepository = app.get<Repository<FormulaItem>>(getRepositoryToken(FormulaItem));

    // 1. Find the Manufacturer 'Ayurvedic Herbs Ltd'
    const manufacturerName = 'Ayurvedic Herbs Ltd';
    const manufacturer = await organisationRepository.findOne({ where: { name: manufacturerName } });

    if (!manufacturer) {
        console.error(`❌ Manufacturer '${manufacturerName}' not found. Please run seed-enhanced-test-data.ts first.`);
        await app.close();
        process.exit(1);
    }

    console.log(`✅ Found Manufacturer: ${manufacturer.name} (ID: ${manufacturer.id})`);

    // 2. Define Sample Raw Materials
    const rawMaterialsData = [
        { name: 'Ashwagandha Root', sku: 'RM-ASH-001', unit: 'kg', currentStock: 50.00, reorderPoint: 10.00 },
        { name: 'Turmeric Powder', sku: 'RM-TUR-002', unit: 'kg', currentStock: 100.00, reorderPoint: 20.00 },
        { name: 'Organic Honey', sku: 'RM-HON-003', unit: 'l', currentStock: 200.00, reorderPoint: 50.00 },
        { name: 'Ghee', sku: 'RM-GHE-004', unit: 'kg', currentStock: 75.00, reorderPoint: 15.00 },
        { name: 'Sesame Oil', sku: 'RM-SES-005', unit: 'l', currentStock: 150.00, reorderPoint: 30.00 },
        { name: 'Ginger Extract', sku: 'RM-GIN-006', unit: 'kg', currentStock: 25.00, reorderPoint: 5.00 },
    ];

    let createdCount = 0;

    for (const data of rawMaterialsData) {
        const existing = await rawMaterialRepository.findOne({
            where: { manufacturerId: manufacturer.id, sku: data.sku }
        });

        if (existing) {
            console.log(`⚠️ Raw Material '${data.name}' already exists. Skipping...`);
            continue;
        }

        const rawMaterial = rawMaterialRepository.create({
            manufacturerId: manufacturer.id,
            ...data,
            isActive: true,
        });

        await rawMaterialRepository.save(rawMaterial);
        console.log(`✅ Created Raw Material: ${data.name}`);
        createdCount++;
    }

    // 3. Seed Formulas
    // We need the raw materials we just created/found to link them
    // Let's re-fetch them to be sure we have IDs
    const allMaterials = await rawMaterialRepository.find({ where: { manufacturerId: manufacturer.id } });
    const getMatId = (name: string) => allMaterials.find(m => m.name === name)?.id;

    const formulasData = [
        {
            name: 'Golden Milk Mix',
            description: 'Immunity boosting turmeric milk mix',
            standardBatchSize: 100,
            unit: 'kg',
            items: [
                { materialName: 'Turmeric Powder', quantity: 60 },
                { materialName: 'Ginger Extract', quantity: 10 },
                { materialName: 'Ashwagandha Root', quantity: 30 },
            ]
        },
        {
            name: 'Ashwagandha Oil',
            description: 'Stress relief oil',
            standardBatchSize: 50,
            unit: 'l',
            items: [
                { materialName: 'Sesame Oil', quantity: 40 },
                { materialName: 'Ashwagandha Root', quantity: 10 },
            ]
        }
    ];

    let createdFormulas = 0;

    for (const data of formulasData) {
        let formula = await formulaRepository.findOne({ where: { manufacturerId: manufacturer.id, name: data.name } });

        if (!formula) {
            formula = formulaRepository.create({
                manufacturerId: manufacturer.id,
                name: data.name,
                description: data.description,
                standardBatchSize: data.standardBatchSize,
                unit: data.unit,
                isActive: true,
            });
            formula = await formulaRepository.save(formula);
            console.log(`✅ Created Formula: ${data.name}`);
            createdFormulas++;

            // Create Items
            for (const item of data.items) {
                const matId = getMatId(item.materialName);
                if (matId) {
                    const formulaItem = formulaItemRepository.create({
                        formulaId: formula.id,
                        rawMaterialId: matId,
                        quantity: item.quantity
                    });
                    await formulaItemRepository.save(formulaItem);
                    console.log(`   - Added Item: ${item.materialName} (${item.quantity} ${data.unit})`);
                } else {
                    console.warn(`   ⚠️ Material not found for formula: ${item.materialName}`);
                }
            }
        } else {
            console.log(`⚠️ Formula '${data.name}' already exists. Skipping...`);
        }
    }

    console.log(`\n✅ Manufacturing Seeding Complete! Added ${createdCount} raw materials and ${createdFormulas} formulas.`);
    await app.close();
}

bootstrap().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
