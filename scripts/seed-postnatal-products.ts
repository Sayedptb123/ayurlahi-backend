
import { DataSource } from 'typeorm';
import { Product } from '../src/products/entities/product.entity';
import { ProductStatus } from '../src/products/enums/product-status.enum';
import { config } from 'dotenv';
config();

const postnatalProducts = [
    // A) Arishtams
    { name: 'Dasamoolarishtam', category: 'Arishtams', form: 'Liquid', packSize: '450ml', unit: 'Bottle', mrp: 450, sku: 'AYU-ARI-001' },
    { name: 'Ashokarishtam', category: 'Arishtams', form: 'Liquid', packSize: '450ml', unit: 'Bottle', mrp: 420, sku: 'AYU-ARI-002' },
    { name: 'Jeerakarishtam', category: 'Arishtams', form: 'Liquid', packSize: '450ml', unit: 'Bottle', mrp: 480, sku: 'AYU-ARI-003' },
    { name: 'Balarishtam', category: 'Arishtams', form: 'Liquid', packSize: '450ml', unit: 'Bottle', mrp: 460, sku: 'AYU-ARI-004' },

    // B) Kashayams
    { name: 'Nadi Kashayam', category: 'Kashayams', form: 'Liquid', packSize: '200ml', unit: 'Bottle', mrp: 220, sku: 'AYU-KAS-001' },
    { name: 'Danwanthara Kashayam', category: 'Kashayams', form: 'Liquid', packSize: '200ml', unit: 'Bottle', mrp: 240, sku: 'AYU-KAS-002' },

    // C) Choornams
    { name: 'Mukkudi Choornam', category: 'Choornams', form: 'Powder', packSize: '100g', unit: 'Pack', mrp: 180, sku: 'AYU-CHO-001' },
    { name: 'Shathakuppa Choornam', category: 'Choornams', form: 'Powder', packSize: '100g', unit: 'Pack', mrp: 160, sku: 'AYU-CHO-002' },
    { name: 'Nimbadi Choornam', category: 'Choornams', form: 'Powder', packSize: '100g', unit: 'Pack', mrp: 150, sku: 'AYU-CHO-003' },
    { name: 'Rakthachandanam', category: 'Choornams', form: 'Powder', packSize: '100g', unit: 'Pack', mrp: 250, sku: 'AYU-CHO-004' },
    { name: 'Njavara Powder', category: 'Choornams', form: 'Powder', packSize: '200g', unit: 'Pack', mrp: 300, sku: 'AYU-CHO-005' },
    { name: 'Kuvva Powder (Arrowroot)', category: 'Choornams', form: 'Powder', packSize: '250g', unit: 'Pack', mrp: 350, sku: 'AYU-CHO-006' },
    { name: 'Nellikkapodi', category: 'Choornams', form: 'Powder', packSize: '100g', unit: 'Pack', mrp: 120, sku: 'AYU-CHO-007' },
    { name: 'Mylanchi Podi (Henna)', category: 'Choornams', form: 'Powder', packSize: '100g', unit: 'Pack', mrp: 100, sku: 'AYU-CHO-008' },

    // D) Lehyams
    { name: 'Pettu Lehyam', category: 'Lehyams', form: 'Lehya', packSize: '500g', unit: 'Jar', mrp: 600, sku: 'AYU-LEH-001' },
    { name: 'Thenginpookula Lehyam', category: 'Lehyams', form: 'Lehya', packSize: '500g', unit: 'Jar', mrp: 550, sku: 'AYU-LEH-002' },

    // E) Oils
    { name: 'Danwantharam Oil', category: 'Oils', form: 'Oil', packSize: '200ml', unit: 'Bottle', mrp: 320, sku: 'AYU-OIL-001' },
    { name: 'Nalpamaradi Oil', category: 'Oils', form: 'Oil', packSize: '200ml', unit: 'Bottle', mrp: 350, sku: 'AYU-OIL-002' },
    { name: 'Chemparathyadi Oil', category: 'Oils', form: 'Oil', packSize: '200ml', unit: 'Bottle', mrp: 280, sku: 'AYU-OIL-003' },
    { name: 'Sahacharadi Oil', category: 'Oils', form: 'Oil', packSize: '200ml', unit: 'Bottle', mrp: 260, sku: 'AYU-OIL-004' },

    // F) External Care
    { name: 'Nalapamara Patta', category: 'External Care', form: 'Dried', packSize: '100g', unit: 'Pack', mrp: 150, sku: 'AYU-EXT-001' },
    { name: 'Multani Mitti', category: 'External Care', form: 'Powder', packSize: '100g', unit: 'Pack', mrp: 80, sku: 'AYU-EXT-002' },
    { name: 'Orange Powder', category: 'External Care', form: 'Powder', packSize: '100g', unit: 'Pack', mrp: 120, sku: 'AYU-EXT-003' },
];

async function seed() {
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'medilink',
        entities: [Product],
        synchronize: false,
    });

    await dataSource.initialize();
    const productRepo = dataSource.getRepository(Product);

    // Target Manufacturer: PMS Ayurveda
    const TARGET_MANUFACTURER_ID = 'e74ecbc2-060e-4ba4-aa7f-906f9f74b5d3';
    console.log(`Seeding products for PMS Ayurveda (ID: ${TARGET_MANUFACTURER_ID})...`);

    // Delete existing products for this manufacturer to ensure fresh seed
    await productRepo.query(`DELETE FROM products WHERE "manufacturerId" = '${TARGET_MANUFACTURER_ID}'`);

    console.log(`Cleared existing products for manufacturer.`);

    for (const item of postnatalProducts) {
        console.log(`Creating ${item.name}...`);
        const product = productRepo.create({
            ...item,
            manufacturerId: TARGET_MANUFACTURER_ID,
            price: parseFloat((item.mrp * 0.8).toFixed(2)),
            isActive: true,
            status: ProductStatus.ACTIVE,
            stockQuantity: 100,
            gstRate: 12,
            minOrderQuantity: 1,
        });

        await productRepo.save(product);
    }

    console.log('Seeding complete! Added 23 products.');
    await dataSource.destroy();
}

seed().catch((error) => {
    console.error('Error seeding data:', error);
    process.exit(1);
});
