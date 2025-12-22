import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ProductsService } from '../src/products/products.service';
import { ManufacturersService } from '../src/manufacturers/manufacturers.service';
import { UsersService } from '../src/users/users.service';

/**
 * Seed script to add sample Ayurveda products
 * 
 * Usage:
 *   npm run seed:products
 * 
 * Or with ts-node:
 *   npx ts-node scripts/seed-products.ts
 */

const AYURVEDA_PRODUCTS = [
  {
    sku: 'AYU-ASH-001',
    name: 'Ashwagandha Powder (100g)',
    description: 'Pure Ashwagandha root powder, known for its adaptogenic properties. Helps reduce stress, improve sleep, and boost energy levels. Made from premium quality roots.',
    category: 'Herbal Supplements',
    price: 450.00,
    gstRate: 12,
    stockQuantity: 500,
    unit: 'pack',
    minOrderQuantity: 1,
    requiresPrescription: false,
    specifications: {
      netWeight: '100g',
      shelfLife: '24 months',
      storage: 'Store in a cool, dry place',
      ingredients: '100% Pure Ashwagandha Root Powder',
    },
  },
  {
    sku: 'AYU-TUR-002',
    name: 'Turmeric Curcumin Capsules (60 capsules)',
    description: 'High-potency Turmeric with Curcumin capsules. Supports joint health, reduces inflammation, and boosts immunity. Each capsule contains 500mg of pure turmeric extract.',
    category: 'Herbal Supplements',
    price: 650.00,
    gstRate: 12,
    stockQuantity: 300,
    unit: 'bottle',
    minOrderQuantity: 1,
    requiresPrescription: false,
    specifications: {
      netWeight: '30g (60 capsules)',
      shelfLife: '36 months',
      storage: 'Store in a cool, dry place away from direct sunlight',
      ingredients: 'Turmeric Extract (Curcuma longa), Gelatin Capsule',
      dosage: '1-2 capsules twice daily with meals',
    },
  },
  {
    sku: 'AYU-TRI-003',
    name: 'Triphala Churna (200g)',
    description: 'Traditional Ayurvedic formula combining Amla, Haritaki, and Bibhitaki. Supports digestive health, natural detoxification, and overall wellness.',
    category: 'Digestive Health',
    price: 350.00,
    gstRate: 12,
    stockQuantity: 400,
    unit: 'pack',
    minOrderQuantity: 1,
    requiresPrescription: false,
    specifications: {
      netWeight: '200g',
      shelfLife: '24 months',
      storage: 'Store in a cool, dry place',
      ingredients: 'Amla (Emblica officinalis), Haritaki (Terminalia chebula), Bibhitaki (Terminalia bellirica)',
      dosage: '1-2 teaspoons with warm water before bedtime',
    },
  },
  {
    sku: 'AYU-BRA-004',
    name: 'Brahmi Syrup (200ml)',
    description: 'Brahmi (Bacopa monnieri) syrup for cognitive enhancement and memory support. Helps improve concentration, reduce anxiety, and support brain health.',
    category: 'Brain Health',
    price: 550.00,
    gstRate: 12,
    stockQuantity: 250,
    unit: 'bottle',
    minOrderQuantity: 1,
    requiresPrescription: false,
    specifications: {
      netWeight: '200ml',
      shelfLife: '18 months',
      storage: 'Store in a cool, dry place. Refrigerate after opening.',
      ingredients: 'Brahmi Extract, Honey, Water, Preservatives',
      dosage: '1-2 teaspoons twice daily',
    },
  },
  {
    sku: 'AYU-GIL-005',
    name: 'Giloy Juice (500ml)',
    description: 'Pure Giloy (Tinospora cordifolia) juice. Known as "Amrita" in Ayurveda. Boosts immunity, helps fight infections, and supports overall health.',
    category: 'Immunity Boosters',
    price: 480.00,
    gstRate: 12,
    stockQuantity: 350,
    unit: 'bottle',
    minOrderQuantity: 1,
    requiresPrescription: false,
    specifications: {
      netWeight: '500ml',
      shelfLife: '12 months',
      storage: 'Store in a cool, dry place. Refrigerate after opening.',
      ingredients: '100% Pure Giloy Juice',
      dosage: '2-3 teaspoons twice daily with water',
    },
  },
  {
    sku: 'AYU-ALA-006',
    name: 'Aloe Vera Gel (250g)',
    description: 'Pure Aloe Vera gel for skin care and digestive health. Soothes skin, promotes healing, and supports gut health. Free from artificial colors and fragrances.',
    category: 'Skin Care',
    price: 320.00,
    gstRate: 12,
    stockQuantity: 600,
    unit: 'tube',
    minOrderQuantity: 1,
    requiresPrescription: false,
    specifications: {
      netWeight: '250g',
      shelfLife: '24 months',
      storage: 'Store in a cool, dry place',
      ingredients: '100% Pure Aloe Vera Gel',
      usage: 'Apply topically or consume 1-2 teaspoons daily',
    },
  },
  {
    sku: 'AYU-NEE-007',
    name: 'Neem Capsules (60 capsules)',
    description: 'Neem leaf extract capsules for blood purification and skin health. Helps maintain healthy blood sugar levels and supports clear skin.',
    category: 'Blood Purification',
    price: 420.00,
    gstRate: 12,
    stockQuantity: 280,
    unit: 'bottle',
    minOrderQuantity: 1,
    requiresPrescription: false,
    specifications: {
      netWeight: '30g (60 capsules)',
      shelfLife: '36 months',
      storage: 'Store in a cool, dry place',
      ingredients: 'Neem Leaf Extract (Azadirachta indica), Gelatin Capsule',
      dosage: '1-2 capsules twice daily with meals',
    },
  },
  {
    sku: 'AYU-AML-008',
    name: 'Amla Juice (500ml)',
    description: 'Pure Amla (Indian Gooseberry) juice rich in Vitamin C. Boosts immunity, improves skin health, and supports hair growth. Natural source of antioxidants.',
    category: 'Immunity Boosters',
    price: 380.00,
    gstRate: 12,
    stockQuantity: 450,
    unit: 'bottle',
    minOrderQuantity: 1,
    requiresPrescription: false,
    specifications: {
      netWeight: '500ml',
      shelfLife: '12 months',
      storage: 'Store in a cool, dry place. Refrigerate after opening.',
      ingredients: '100% Pure Amla Juice',
      dosage: '2-3 teaspoons twice daily with water',
    },
  },
  {
    sku: 'AYU-SHA-009',
    name: 'Shankhpushpi Syrup (200ml)',
    description: 'Shankhpushpi (Convolvulus pluricaulis) syrup for mental clarity and stress relief. Traditional Ayurvedic remedy for improving memory and reducing anxiety.',
    category: 'Brain Health',
    price: 520.00,
    gstRate: 12,
    stockQuantity: 200,
    unit: 'bottle',
    minOrderQuantity: 1,
    requiresPrescription: false,
    specifications: {
      netWeight: '200ml',
      shelfLife: '18 months',
      storage: 'Store in a cool, dry place. Refrigerate after opening.',
      ingredients: 'Shankhpushpi Extract, Honey, Water, Preservatives',
      dosage: '1-2 teaspoons twice daily',
    },
  },
  {
    sku: 'AYU-MAN-010',
    name: 'Mankand Thailam (100ml)',
    description: 'Traditional Ayurvedic oil for joint pain and arthritis. Contains Mankand and other herbal extracts. Helps reduce inflammation and improve joint mobility.',
    category: 'Pain Relief',
    price: 680.00,
    gstRate: 12,
    stockQuantity: 150,
    unit: 'bottle',
    minOrderQuantity: 1,
    requiresPrescription: false,
    specifications: {
      netWeight: '100ml',
      shelfLife: '36 months',
      storage: 'Store in a cool, dry place away from direct sunlight',
      ingredients: 'Mankand Extract, Sesame Oil, Herbal Extracts',
      usage: 'Apply externally and massage gently on affected areas',
    },
  },
  {
    sku: 'AYU-DAS-011',
    name: 'Dashmoolarishta (450ml)',
    description: 'Traditional Ayurvedic fermented preparation with ten roots. Supports bone health, joint function, and overall vitality. Contains natural alcohol from fermentation.',
    category: 'Bone & Joint Health',
    price: 750.00,
    gstRate: 12,
    stockQuantity: 180,
    unit: 'bottle',
    minOrderQuantity: 1,
    requiresPrescription: false,
    specifications: {
      netWeight: '450ml',
      shelfLife: '36 months',
      storage: 'Store in a cool, dry place',
      ingredients: 'Ten Root Extracts, Jaggery, Water (Fermented)',
      dosage: '2-3 teaspoons twice daily with equal amount of water',
    },
  },
  {
    sku: 'AYU-CHA-012',
    name: 'Chyawanprash (1kg)',
    description: 'Classic Ayurvedic health supplement with Amla and 40+ herbs. Boosts immunity, improves digestion, and enhances overall vitality. Traditional recipe.',
    category: 'General Wellness',
    price: 850.00,
    gstRate: 12,
    stockQuantity: 320,
    unit: 'jar',
    minOrderQuantity: 1,
    requiresPrescription: false,
    specifications: {
      netWeight: '1kg',
      shelfLife: '24 months',
      storage: 'Store in a cool, dry place. Use dry spoon.',
      ingredients: 'Amla, Honey, Ghee, 40+ Herbal Extracts',
      dosage: '1-2 teaspoons twice daily, preferably in the morning and evening',
    },
  },
];

async function seedProducts() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const productsService = app.get(ProductsService);
  const manufacturersService = app.get(ManufacturersService);
  const usersService = app.get(UsersService);

  try {
    console.log('🌱 Starting product seeding...\n');

    // Find or create a manufacturer user
    let manufacturerUser;
    try {
      manufacturerUser = await usersService.findByEmail('manufacturer@ayurlahi.com');
      console.log('✅ Found existing manufacturer user');
    } catch (error) {
      console.log('⚠️  Manufacturer user not found. Please create a manufacturer account first.');
      console.log('   You can create one through the admin panel or registration.');
      process.exit(1);
    }

    // Get the manufacturer associated with this user
    const manufacturer = await manufacturersService.findByUserId(manufacturerUser.id);
    
    if (manufacturer.approvalStatus !== 'approved') {
      console.log('⚠️  Manufacturer is not approved. Products can only be added for approved manufacturers.');
      console.log(`   Manufacturer status: ${manufacturer.approvalStatus}`);
      process.exit(1);
    }

    console.log(`📦 Manufacturer: ${manufacturer.name} (${manufacturer.id})\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const productData of AYURVEDA_PRODUCTS) {
      try {
        // Check if product with this SKU already exists
        try {
          await productsService.findBySku(productData.sku);
          console.log(`⏭️  Skipping ${productData.sku} - already exists`);
          skipped++;
          continue;
        } catch (error) {
          // Product doesn't exist, proceed with creation
        }

        // Create product
        const product = await productsService.create(manufacturerUser.id, {
          ...productData,
          isActive: true,
        });

        console.log(`✅ Created: ${product.name} (${product.sku}) - ₹${product.price}`);
        created++;
      } catch (error) {
        console.error(`❌ Error creating ${productData.sku}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📦 Total: ${AYURVEDA_PRODUCTS.length}\n`);

    if (created > 0) {
      console.log('✨ Product seeding completed successfully!');
    }
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Run the seed function
seedProducts()
  .then(() => {
    console.log('🎉 Seeding process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });



