
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RetreatService } from '../src/retreat/retreat.service';
import { Room } from '../src/retreat/entities/room.entity';
import { Patient } from '../src/patients/entities/patient.entity';
import { Clinic } from '../src/clinics/entities/clinic.entity';
import { DataSource } from 'typeorm';

async function bootstrap() {
    console.log('Starting bootstrap...');
    const app = await NestFactory.createApplicationContext(AppModule);
    console.log('App context created.');

    const retreatService = app.get(RetreatService);
    const dataSource = app.get(DataSource);

    const patientRepo = dataSource.getRepository(Patient);
    const roomRepo = dataSource.getRepository(Room);
    const clinicRepo = dataSource.getRepository(Clinic);

    try {
        console.log('Repositories initialized via DataSource.');

        // 1. Get a clinic
        const clinic = await clinicRepo.findOne({ where: {} });
        if (!clinic) {
            console.error('No clinic found. Cannot test.');
            return;
        }
        const clinicId = clinic.id;
        console.log('Using clinic:', clinicId);

        // 2. Get a patient
        const patient = await patientRepo.findOne({ where: { clinicId } });
        if (!patient) {
            console.error('No patient found for clinic. Cannot create booking.');
            return;
        }
        const patientId = patient.id;
        console.log('Using patient:', patientId);

        // 3. Get a room
        const room = await roomRepo.findOne({ where: { clinicId } });
        if (!room) {
            console.error('No room found for clinic. Cannot create booking.');
            return;
        }
        const roomId = room.id;
        console.log('Using room:', roomId, 'Price:', room.pricePerDay);

        // 4. Try Create Booking
        console.log('Attempting to create booking...');
        const checkIn = new Date();
        const checkOut = new Date();
        checkOut.setDate(checkOut.getDate() + 5);

        const dto = {
            patientId,
            roomId,
            checkInDate: checkIn.toISOString(),
            checkOutDate: checkOut.toISOString(),
            advancePaid: 1000,
            notes: 'Test booking via script'
        };

        const booking = await retreatService.createBooking(clinicId, dto);
        console.log('Booking created successfully:', booking);

    } catch (error) {
        console.error('Error in script:', error);
    } finally {
        await app.close();
    }
}

bootstrap();
