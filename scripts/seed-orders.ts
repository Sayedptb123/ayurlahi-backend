import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { Product } from '../src/products/entities/product.entity';
import { OrdersService } from '../src/orders/orders.service';
import { CreateOrderDto } from '../src/orders/dto/create-order.dto';
import { OrderSource } from '../src/orders/entities/order.entity';

async function bootstrap() {
    console.log('🚀 Starting Test Orders Seeding...\n');

    const app = await NestFactory.createApplicationContext(AppModule);
    const ordersService = app.get(OrdersService);
    const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
    const productRepository = app.get<Repository<Product>>(getRepositoryToken(Product));

    // 1. Fetch Clinic Owners
    const clinic1Owner = await userRepository.findOne({ where: { email: 'clinic1.owner@test.com' } });
    const clinic2Owner = await userRepository.findOne({ where: { email: 'clinic2.owner@test.com' } });

    if (!clinic1Owner || !clinic2Owner) {
        console.error('❌ Clinic owners not found! Run seed-enhanced-test-data.ts first.');
        await app.close();
        process.exit(1);
    }

    console.log(`✅ Found Clinic 1 Owner: ${clinic1Owner.firstName} (ID: ${clinic1Owner.id})`);
    console.log(`✅ Found Clinic 2 Owner: ${clinic2Owner.firstName} (ID: ${clinic2Owner.id})`);

    // 2. Fetch Active Products
    const products = await productRepository.find({ where: { isActive: true }, take: 10 });
    if (products.length === 0) {
        console.error('❌ No active products found! Run seed-products.ts first.');
        await app.close();
        process.exit(1);
    }
    console.log(`✅ Found ${products.length} active products available for ordering.\n`);

    // Helper to create an order
    const createOrder = async (user: User, items: { productId: string; quantity: number }[], notes: string) => {
        const dto: CreateOrderDto = {
            items,
            source: OrderSource.WEB,
            notes,
            // Use default shipping address from clinic profile (logic inside service)
        };

        try {
            const order = await ordersService.create(user.id, dto);
            if (order) {
                console.log(`✅ Created Order ${order.orderNumber} for ${user.firstName} (Total: ₹${order.totalAmount})`);
            }
            return order;
        } catch (error) {
            console.error(`❌ Failed to create order for ${user.firstName}:`, error.message);
        }
    };

    // 3. Create Orders for Clinic 1 (Ayurveda Wellness Clinic)
    console.log('🛒 Creating orders for Clinic 1...');
    // Order 1: Mix of products
    await createOrder(clinic1Owner, [
        { productId: products[0].id, quantity: 5 },
        { productId: products[1].id, quantity: 2 },
    ], 'Monthly stock replenishment');

    // Order 2: Single product, different manufacturer if possible
    if (products.length > 2) {
        await createOrder(clinic1Owner, [
            { productId: products[2].id, quantity: 10 },
        ], 'Urgent requirement');
    }

    console.log('');

    // 4. Create Orders for Clinic 2 (Holistic Ayurveda Center)
    console.log('🛒 Creating orders for Clinic 2...');
    // Order 1: Some overlap in products with Clinic 1
    await createOrder(clinic2Owner, [
        { productId: products[1].id, quantity: 3 },
        { productId: products[0].id, quantity: 1 },
    ], 'Trial order');

    // Order 2: Different products
    if (products.length > 3) {
        await createOrder(clinic2Owner, [
            { productId: products[3].id, quantity: 5 },
        ], 'Seasonal herbs');
    }

    console.log('\n========================================');
    console.log('✅ Test Orders Seeding Complete!');
    console.log('========================================\n');

    await app.close();
}

bootstrap().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
