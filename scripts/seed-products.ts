import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../src/products/entities/product.entity';
import { Organisation } from '../src/organisations/entities/organisation.entity';

interface TestProduct {
  name: string;
  sku: string;
  description: string;
  category: string;
  price: number;
  gstRate: number;
  stockQuantity: number;
  unit: string;
  minOrderQuantity: number;
  requiresPrescription: boolean;
  manufacturerName: string;
}

async function bootstrap() {
  console.log('🌿 Starting Product Seeding...\n');

  const app = await NestFactory.createApplicationContext(AppModule);

  const productRepository = app.get<Repository<Product>>(getRepositoryToken(Product));
  const organisationRepository = app.get<Repository<Organisation>>(getRepositoryToken(Organisation));

  // Get manufacturers
  const manufacturer1 = await organisationRepository.findOne({
    where: { name: 'Ayurvedic Herbs Ltd' },
  });

  const manufacturer2 = await organisationRepository.findOne({
    where: { name: 'Natural Remedies Pharma' },
  });

  if (!manufacturer1 || !manufacturer2) {
    console.error('❌ Manufacturers not found. Please run seed-enhanced-test-data.ts first.');
    await app.close();
    return;
  }

  console.log(`✅ Found Manufacturer 1: ${manufacturer1.name} (ID: ${manufacturer1.id})`);
  console.log(`✅ Found Manufacturer 2: ${manufacturer2.name} (ID: ${manufacturer2.id})\n`);

  // Define test products
  const testProducts: TestProduct[] = [
    // Manufacturer 1 Products (Ayurvedic Herbs Ltd)
    {
      name: 'Ashwagandha Powder - Premium',
      sku: 'AYU-ASH-001',
      description: 'Pure Ashwagandha root powder (Withania somnifera). Helps reduce stress and anxiety, improves strength and vitality. 100% organic.',
      category: 'Herbal Powders',
      price: 450.00,
      gstRate: 12.00,
      stockQuantity: 500,
      unit: '250g',
      minOrderQuantity: 2,
      requiresPrescription: false,
      manufacturerName: 'Ayurvedic Herbs Ltd',
    },
    {
      name: 'Triphala Churna',
      sku: 'AYU-TRI-002',
      description: 'Traditional Ayurvedic blend of Amalaki, Bibhitaki, and Haritaki. Supports digestive health and detoxification. Certified organic.',
      category: 'Herbal Powders',
      price: 320.00,
      gstRate: 12.00,
      stockQuantity: 750,
      unit: '200g',
      minOrderQuantity: 3,
      requiresPrescription: false,
      manufacturerName: 'Ayurvedic Herbs Ltd',
    },
    {
      name: 'Brahmi Tablets',
      sku: 'AYU-BRA-003',
      description: 'Brahmi (Bacopa monnieri) extract tablets. Enhances memory, concentration, and cognitive function. 500mg per tablet.',
      category: 'Tablets',
      price: 580.00,
      gstRate: 12.00,
      stockQuantity: 300,
      unit: '60 tablets',
      minOrderQuantity: 1,
      requiresPrescription: false,
      manufacturerName: 'Ayurvedic Herbs Ltd',
    },
    {
      name: 'Tulsi Drops',
      sku: 'AYU-TUL-004',
      description: 'Holy Basil (Ocimum sanctum) liquid extract. Boosts immunity, relieves stress. Natural adaptogen. 30ml bottle.',
      category: 'Liquids',
      price: 210.00,
      gstRate: 12.00,
      stockQuantity: 400,
      unit: '30ml',
      minOrderQuantity: 2,
      requiresPrescription: false,
      manufacturerName: 'Ayurvedic Herbs Ltd',
    },
    {
      name: 'Neem Capsules',
      sku: 'AYU-NEE-005',
      description: 'Pure Neem (Azadirachta indica) leaf extract. Blood purifier, supports skin health. 500mg capsules.',
      category: 'Capsules',
      price: 380.00,
      gstRate: 12.00,
      stockQuantity: 600,
      unit: '60 capsules',
      minOrderQuantity: 1,
      requiresPrescription: false,
      manufacturerName: 'Ayurvedic Herbs Ltd',
    },
    {
      name: 'Chyawanprash - Special',
      sku: 'AYU-CHY-006',
      description: 'Traditional Ayurvedic immunity booster. Blend of 40+ herbs and spices. Rich in vitamin C. Premium quality.',
      category: 'Herbal Paste',
      price: 650.00,
      gstRate: 12.00,
      stockQuantity: 250,
      unit: '500g',
      minOrderQuantity: 1,
      requiresPrescription: false,
      manufacturerName: 'Ayurvedic Herbs Ltd',
    },

    // Manufacturer 2 Products (Natural Remedies Pharma)
    {
      name: 'Guduchi Tablets',
      sku: 'NAT-GUD-001',
      description: 'Giloy (Tinospora cordifolia) standardized extract. Immune modulator, antipyretic. 500mg tablets.',
      category: 'Tablets',
      price: 420.00,
      gstRate: 12.00,
      stockQuantity: 450,
      unit: '60 tablets',
      minOrderQuantity: 2,
      requiresPrescription: false,
      manufacturerName: 'Natural Remedies Pharma',
    },
    {
      name: 'Arjuna Capsules',
      sku: 'NAT-ARJ-002',
      description: 'Terminalia arjuna bark extract. Supports cardiovascular health. 500mg capsules. Clinically tested.',
      category: 'Capsules',
      price: 550.00,
      gstRate: 12.00,
      stockQuantity: 350,
      unit: '60 capsules',
      minOrderQuantity: 1,
      requiresPrescription: true,
      manufacturerName: 'Natural Remedies Pharma',
    },
    {
      name: 'Turmeric Curcumin Extract',
      sku: 'NAT-TUR-003',
      description: '95% curcuminoids with black pepper extract (piperine) for enhanced absorption. Anti-inflammatory. 500mg capsules.',
      category: 'Capsules',
      price: 680.00,
      gstRate: 12.00,
      stockQuantity: 500,
      unit: '60 capsules',
      minOrderQuantity: 1,
      requiresPrescription: false,
      manufacturerName: 'Natural Remedies Pharma',
    },
    {
      name: 'Shatavari Powder',
      sku: 'NAT-SHA-004',
      description: 'Asparagus racemosus root powder. Women\'s health tonic, galactagogue. Organic certified.',
      category: 'Herbal Powders',
      price: 480.00,
      gstRate: 12.00,
      stockQuantity: 400,
      unit: '200g',
      minOrderQuantity: 2,
      requiresPrescription: false,
      manufacturerName: 'Natural Remedies Pharma',
    },
    {
      name: 'Divya Amla Juice',
      sku: 'NAT-AML-005',
      description: 'Pure Indian Gooseberry (Amla) juice. Rich in vitamin C, antioxidants. Preservative-free. 500ml bottle.',
      category: 'Liquids',
      price: 180.00,
      gstRate: 12.00,
      stockQuantity: 600,
      unit: '500ml',
      minOrderQuantity: 3,
      requiresPrescription: false,
      manufacturerName: 'Natural Remedies Pharma',
    },
    {
      name: 'Pain Relief Oil',
      sku: 'NAT-PRO-006',
      description: 'Ayurvedic pain relief oil with Mahanarayan and Gandhpura oils. For joint and muscle pain. 100ml bottle.',
      category: 'External',
      price: 290.00,
      gstRate: 18.00,
      stockQuantity: 350,
      unit: '100ml',
      minOrderQuantity: 2,
      requiresPrescription: false,
      manufacturerName: 'Natural Remedies Pharma',
    },
  ];

  console.log('📦 Creating Products...\n');

  let createdCount = 0;
  let skippedCount = 0;

  for (const productData of testProducts) {
    try {
      // Check if product already exists
      const existingProduct = await productRepository.findOne({
        where: { sku: productData.sku },
      });

      if (existingProduct) {
        console.log(`⚠️  Product "${productData.name}" (${productData.sku}) already exists. Skipping...`);
        skippedCount++;
        continue;
      }

      const manufacturerId = productData.manufacturerName === 'Ayurvedic Herbs Ltd'
        ? manufacturer1.id
        : manufacturer2.id;

      const product = productRepository.create({
        manufacturerId,
        sku: productData.sku,
        name: productData.name,
        description: productData.description,
        category: productData.category,
        price: productData.price,
        gstRate: productData.gstRate,
        stockQuantity: productData.stockQuantity,
        unit: productData.unit,
        minOrderQuantity: productData.minOrderQuantity,
        isActive: true,
        requiresPrescription: productData.requiresPrescription,
        fulfillmentType: 'INTERNAL',
      });

      await productRepository.save(product);
      createdCount++;

      console.log(`✅ Created: ${productData.name} (${productData.sku}) - ₹${productData.price} - Stock: ${productData.stockQuantity}`);
    } catch (error) {
      console.error(`✗ Failed to create product "${productData.name}":`, error.message);
    }
  }

  console.log('\n========================================');
  console.log('✅ Product Seeding Complete!');
  console.log('========================================\n');
  console.log(`📊 Summary:`);
  console.log(`   - Total Products Defined: ${testProducts.length}`);
  console.log(`   - Products Created: ${createdCount}`);
  console.log(`   - Products Skipped: ${skippedCount}`);
  console.log(`\n💡 Next: Create test orders using these products\n`);

  await app.close();
}

bootstrap().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
