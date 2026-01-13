import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organisation } from '../src/organisations/entities/organisation.entity';
import { Doctor } from '../src/doctors/entities/doctor.entity';

async function bootstrap() {
    console.log('🚀 Starting Doctor Seeding...\n');

    const app = await NestFactory.createApplicationContext(AppModule);
    const doctorRepository = app.get<Repository<Doctor>>(getRepositoryToken(Doctor));
    const organisationRepository = app.get<Repository<Organisation>>(getRepositoryToken(Organisation));

    // 1. Fetch Clinic 1
    const clinic = await organisationRepository.findOne({ where: { name: 'Ayurveda Wellness Clinic' } });

    if (!clinic) {
        console.error('❌ Clinic "Ayurveda Wellness Clinic" not found! Run seed-enhanced-test-data.ts first.');
        await app.close();
        process.exit(1);
    }

    console.log(`✅ Found Clinic: ${clinic.name} (ID: ${clinic.id})`);

    // 2. Check if doctor exists
    const existingDoctor = await doctorRepository.findOne({ where: { clinicId: clinic.id } });

    if (existingDoctor) {
        console.log(`✅ Doctor already exists: Dr. ${existingDoctor.firstName} ${existingDoctor.lastName} (ID: ${existingDoctor.id})`);
        await app.close();
        return;
    }

    // 3. Create Doctor
    const doctor = doctorRepository.create({
        clinicId: clinic.id,
        doctorId: 'DOC-001',
        firstName: 'Ayesha',
        lastName: 'Khan',
        specialization: 'General Ayurveda',
        qualification: ['BAMS', 'MD (Ayurveda)'],
        licenseNumber: 'KA-AYU-1001',
        phone: '+919876543220',
        email: 'dr.ayesha@test.com',
        consultationFee: 500,
        isActive: true,
        schedule: {
            monday: { start: '09:00', end: '17:00', available: true },
            tuesday: { start: '09:00', end: '17:00', available: true },
            wednesday: { start: '09:00', end: '17:00', available: true },
            thursday: { start: '09:00', end: '17:00', available: true },
            friday: { start: '09:00', end: '17:00', available: true },
            saturday: { start: '09:00', end: '13:00', available: true },
        }
    });

    const savedDoctor = await doctorRepository.save(doctor);
    console.log(`✅ Created Doctor: Dr. ${savedDoctor.firstName} ${savedDoctor.lastName} (ID: ${savedDoctor.id})`);

    await app.close();
}

bootstrap().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
