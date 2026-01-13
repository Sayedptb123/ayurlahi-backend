import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { Room, RoomType, RoomStatus } from '../src/retreat/entities/room.entity';
import { TreatmentPackage } from '../src/retreat/entities/treatment-package.entity';

async function bootstrap() {
    console.log('Seeding Retreat Data...');
    const app = await NestFactory.createApplicationContext(AppModule);

    // Repositories
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const roomRepo = app.get<Repository<Room>>(getRepositoryToken(Room));
    const pkgRepo = app.get<Repository<TreatmentPackage>>(getRepositoryToken(TreatmentPackage));

    // Get Test User
    const email = 'clinic1.owner@test.com';
    const user = await userRepo.findOne({ where: { email } });

    if (!user || !user.clinicId) {
        console.error('Test user or clinicId not found');
        process.exit(1);
    }
    const clinicId = user.clinicId;
    console.log(`Seeding for Clinic: ${clinicId}`);

    // Seed Rooms
    const rooms = [
        { roomNumber: '101', type: RoomType.PRIVATE, pricePerDay: 2000, floor: '1st', description: 'Standard private room' },
        { roomNumber: '102', type: RoomType.PRIVATE, pricePerDay: 2000, floor: '1st', description: 'Standard private room' },
        { roomNumber: '103', type: RoomType.PRIVATE, pricePerDay: 2000, floor: '1st', description: 'Standard private room' },
        { roomNumber: '201', type: RoomType.DELUXE, pricePerDay: 4000, floor: '2nd', description: 'Deluxe room with garden view' },
        { roomNumber: '202', type: RoomType.DELUXE, pricePerDay: 4000, floor: '2nd', description: 'Deluxe room with garden view' },
        { roomNumber: '301', type: RoomType.SUITE, pricePerDay: 8000, floor: '3rd', description: 'Royal Suite with Jacuzzi' },
        { roomNumber: 'W01', type: RoomType.WARD, pricePerDay: 800, floor: 'G', description: 'General Ward Bed 1' },
        { roomNumber: 'W02', type: RoomType.WARD, pricePerDay: 800, floor: 'G', description: 'General Ward Bed 2' },
    ];

    for (const r of rooms) {
        const exists = await roomRepo.findOne({ where: { clinicId, roomNumber: r.roomNumber } });
        if (!exists) {
            await roomRepo.save(roomRepo.create({ ...r, clinicId }));
            console.log(`Created Room ${r.roomNumber}`);
        } else {
            console.log(`Room ${r.roomNumber} already exists`);
        }
    }

    // Seed Packages
    const packages = [
        {
            name: 'Prasav Raksha - Complete Postnatal Care',
            durationDays: 28,
            price: 85000,
            description: 'Comprehensive 28-day Ayurvedic postnatal care including daily massage, herbal bath, and diet.',
            inclusions: ['Accommodation', '3 Meals/Day', 'Daily Nurse Check', 'Abhyangam', 'Vethu']
        },
        {
            name: 'Postnatal Wellness',
            durationDays: 14,
            price: 45000,
            description: 'Essential 14-day recovery program.',
            inclusions: ['Accommodation', '3 Meals/Day', 'Abhyangam']
        },
        {
            name: 'Detox & Rejuvenation',
            durationDays: 7,
            price: 25000,
            description: 'Quick 7-day detox for new mothers.',
            inclusions: ['Accommodation', 'Diet Food', 'Detox Therapy']
        },
    ];

    for (const p of packages) {
        const exists = await pkgRepo.findOne({ where: { clinicId, name: p.name } });
        if (!exists) {
            await pkgRepo.save(pkgRepo.create({ ...p, clinicId }));
            console.log(`Created Package: ${p.name}`);
        } else {
            console.log(`Package ${p.name} already exists`);
        }
    }

    console.log('✅ Retreat Data Seeded Successfully');
    await app.close();
}

bootstrap();
