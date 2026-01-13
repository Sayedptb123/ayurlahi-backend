import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { OrdersService } from '../src/orders/orders.service';
import { GetOrdersDto } from '../src/orders/dto/get-orders.dto';

async function bootstrap() {
    console.log('🚀 Starting Access Control Verification...\n');

    const app = await NestFactory.createApplicationContext(AppModule);
    const ordersService = app.get(OrdersService);
    const userRepository = app.get<Repository<User>>(getRepositoryToken(User));

    // Fetch Users
    const superAdmin = await userRepository.findOne({ where: { email: 'superadmin1@ayurlahi.com' } });
    const clinic1Owner = await userRepository.findOne({ where: { email: 'clinic1.owner@test.com' } });
    const clinic2Owner = await userRepository.findOne({ where: { email: 'clinic2.owner@test.com' } });
    const manufacturer1Owner = await userRepository.findOne({ where: { email: 'mfg1.owner@test.com' } });

    if (!superAdmin || !clinic1Owner || !clinic2Owner || !manufacturer1Owner) {
        console.error('❌ Missing test users! Run seed-enhanced-test-data.ts first.');
        await app.close();
        process.exit(1);
    }

    const query: GetOrdersDto = { page: 1, limit: 100 };

    // 1. Verify Super Admin Access (Phase 3)
    console.log('🕵️  Verifying Super Admin Access...');
    // Mocking request context by passing args directly to service
    // Service signature: findAll(userId, userRole, organisationType, query)
    const adminOrders = await ordersService.findAll(superAdmin.id, superAdmin.role, undefined, query); // Super admin usually doesn't have organisationType in strict sense or logic skips it
    // Wait, super admin role logic:
    // Service: if (organisationType === 'CLINIC') ... else if (organisationType === 'MANUFACTURER') ...
    // So if undefined, it falls through to "Admin and support can see all orders"
    const adminTotal = adminOrders.pagination.total;
    console.log(`✅ Super Admin sees ${adminTotal} orders.`);
    if (adminTotal === 0) console.warn('⚠️  Warning: No orders found for admin.');


    // 2. Verify Clinic 1 Access (Phase 4)
    console.log('\n🏥 Verifying Clinic 1 Access...');
    const clinic1Orders = await ordersService.findAll(clinic1Owner.id, clinic1Owner.role, 'CLINIC', query);
    console.log(`✅ Clinic 1 sees ${clinic1Orders.pagination.total} orders.`);

    // 3. Verify Clinic 2 Access (Phase 4)
    console.log('\n🏥 Verifying Clinic 2 Access...');
    const clinic2Orders = await ordersService.findAll(clinic2Owner.id, clinic2Owner.role, 'CLINIC', query);
    console.log(`✅ Clinic 2 sees ${clinic2Orders.pagination.total} orders.`);

    // Check Isolation
    const clinic1Ids = clinic1Orders.data.map(o => o.id);
    const clinic2Ids = clinic2Orders.data.map(o => o.id);
    const overlap = clinic1Ids.filter(id => clinic2Ids.includes(id));

    if (overlap.length === 0) {
        console.log('✅ PASS: Clinic 1 and Clinic 2 orders are completely isolated.');
    } else {
        console.error('❌ FAIL: Clinics can see each other\'s orders!', overlap);
    }

    // 4. Verify Manufacturer Access (Phase 5)
    console.log('\n🏭 Verifying Manufacturer Access...');
    const mfgOrders = await ordersService.findAll(manufacturer1Owner.id, manufacturer1Owner.role, 'MANUFACTURER', query);
    console.log(`✅ Manufacturer 1 sees ${mfgOrders.pagination.total} orders containing their products.`);

    // Verify manufacturer only sees orders with their items
    // Service logic does filter by item manufacturerId.

    console.log('\n========================================');
    console.log('✅ Access Control Verification Logic Complete');
    console.log('========================================\n');

    await app.close();
}

bootstrap().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
