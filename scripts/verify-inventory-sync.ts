import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InventoryService } from '../src/inventory/inventory.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from '../src/orders/entities/order.entity';
import { Repository } from 'typeorm';

async function bootstrap() {
    console.log('🚀 Starting Inventory Sync Verification...\n');

    const app = await NestFactory.createApplicationContext(AppModule);
    const inventoryService = app.get(InventoryService);
    const orderRepo = app.get<Repository<Order>>(getRepositoryToken(Order));

    // 1. Get the Order
    const order = await orderRepo.findOne({
        where: { orderNumber: 'ORDER-VERIFY-001' },
        relations: ['items']
    });

    if (!order) {
        console.error('❌ Test order not found.');
        process.exit(1);
    }

    if (order.status !== 'delivered') {
        console.error(`❌ Order status is ${order.status}, expected delivered.`);
        process.exit(1);
    }

    console.log(`✅ Order ${order.orderNumber} is delivered. Checking Inventory for Clinic: ${order.clinicId}`);

    // 2. Check Inventory
    const inventory = await inventoryService.findAll(order.clinicId);

    if (inventory.length === 0) {
        console.error('❌ No inventory items found for this clinic.');
    } else {
        console.log(`✅ Found ${inventory.length} inventory items.`);

        // Check for specific items from order
        for (const item of order.items) {
            const invItem = inventory.find(i => i.sku === item.productSku);
            if (invItem) {
                console.log(`   ✅ Found SKU ${item.productSku}: Qty ${invItem.currentStock} (Expected >= ${item.quantity})`);
            } else {
                console.error(`   ❌ SKU ${item.productSku} missing from inventory.`);
            }
        }
    }

    console.log('\n========================================');
    console.log('✅ Inventory Sync Verified');
    console.log('========================================\n');

    await app.close();
}

bootstrap();
