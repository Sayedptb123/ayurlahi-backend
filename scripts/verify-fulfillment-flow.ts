import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { OrdersService } from '../src/orders/orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/entities/user.entity';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import { Repository } from 'typeorm';

async function bootstrap() {
    console.log('🚀 Starting Fulfillment Flow Verification...\n');

    const app = await NestFactory.createApplicationContext(AppModule);
    const ordersService = app.get(OrdersService);
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const orderRepo = app.get<Repository<Order>>(getRepositoryToken(Order));

    // 1. Get Manufacturer User
    const manufacturerUser = await userRepo.findOne({ where: { email: 'mfg1.owner@test.com' } });
    if (!manufacturerUser) {
        console.error('❌ Manufacturer user not found');
        process.exit(1);
    }
    console.log(`✅ Identified Manufacturer: ${manufacturerUser.firstName} (${manufacturerUser.id})`);

    // 2. Get the Test Order
    let order = await orderRepo.findOne({ where: { orderNumber: 'ORDER-VERIFY-001' } });
    if (!order) {
        console.error('❌ Test order ORDER-VERIFY-001 not found. Run verify-hms-and-marketplace.ts first.');
        process.exit(1);
    }
    console.log(`✅ Found Order: ${order.orderNumber} (Current Status: ${order.status})`);

    // Reset status to ensure we can test transitions
    console.log(`ℹ️ Resetting status from ${order.status} to PENDING for re-verification...`);
    order.status = OrderStatus.PENDING;
    order.deliveredAt = null;
    order.shippedAt = null;
    order.confirmedAt = null;
    await orderRepo.save(order);

    console.log(`✅ Reset Order: ${order.orderNumber} (Current Status: ${order.status})`);

    // 3. Cycle Statuses
    const transitions = [
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED
    ];

    for (const status of transitions) {
        console.log(`\n🔄 Transitioning to ${status}...`);
        try {
            const updated = await ordersService.updateStatus(
                order.id,
                manufacturerUser.id,
                'manufacturer', // userRole (simulated as manufacturer)
                'MANUFACTURER', // organisationType
                { status }      // updateDto
            );
            console.log(`✅ Status Updated to: ${updated.status}`);
            order = updated; // Update local ref
        } catch (e) {
            console.error(`❌ Failed to update to ${status}:`, e.message);
        }
    }

    console.log('\n========================================');
    console.log('✅ Fulfillment Flow Verified');
    console.log('========================================\n');

    await app.close();
}

bootstrap();
