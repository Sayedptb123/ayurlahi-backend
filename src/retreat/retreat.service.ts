import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';
import { TreatmentPackage } from './entities/treatment-package.entity';
import { Admission, AdmissionStatus } from './entities/admission.entity';

@Injectable()
export class RetreatService {
    constructor(
        @InjectRepository(Room)
        private roomRepo: Repository<Room>,
        @InjectRepository(TreatmentPackage)
        private packageRepo: Repository<TreatmentPackage>,
        @InjectRepository(Admission)
        private admissionRepo: Repository<Admission>,
    ) { }

    // --- ROOMS ---
    async getRooms(clinicId: string) {
        return this.roomRepo.find({
            where: { clinicId },
            order: { roomNumber: 'ASC' },
        });
    }

    async createRoom(clinicId: string, data: Partial<Room>) {
        const room = this.roomRepo.create({ ...data, clinicId });
        return this.roomRepo.save(room);
    }

    // --- PACKAGES ---
    async getPackages(clinicId: string) {
        return this.packageRepo.find({
            where: { clinicId },
            order: { price: 'ASC' },
        });
    }

    async createPackage(clinicId: string, data: Partial<TreatmentPackage>) {
        const pkg = this.packageRepo.create({ ...data, clinicId });
        return this.packageRepo.save(pkg);
    }

    // --- ADMISSIONS ---
    async getAdmissions(clinicId: string) {
        return this.admissionRepo.find({
            where: { clinicId, status: AdmissionStatus.ACTIVE },
            relations: ['patient', 'room', 'treatmentPackage'],
            order: { checkInDate: 'DESC' },
        });
    }

    async checkIn(
        clinicId: string,
        data: { patientId: string; roomId: string; packageId?: string; checkInDate?: Date }
    ) {
        const { patientId, roomId, packageId, checkInDate } = data;

        // 1. Verify Room Availability
        const room = await this.roomRepo.findOne({ where: { id: roomId, clinicId } });
        if (!room) throw new NotFoundException('Room not found');
        if (room.status !== RoomStatus.AVAILABLE) {
            throw new ConflictException(`Room ${room.roomNumber} is not available (Status: ${room.status})`);
        }

        // 2. Create Admission
        const admission = this.admissionRepo.create({
            clinicId,
            patientId,
            roomId,
            packageId,
            checkInDate: checkInDate || new Date(),
            status: AdmissionStatus.ACTIVE,
        });

        // Calculate expected checkout if package selected
        if (packageId) {
            const pkg = await this.packageRepo.findOne({ where: { id: packageId } });
            if (pkg) {
                const checkout = new Date(admission.checkInDate);
                checkout.setDate(checkout.getDate() + pkg.durationDays);
                admission.expectedCheckOutDate = checkout;
            }
        }

        // 3. Update Room Status
        room.status = RoomStatus.OCCUPIED;

        // Transactional save (simplified per method)
        await this.roomRepo.save(room);
        return this.admissionRepo.save(admission);
    }

    async discharge(clinicId: string, admissionId: string) {
        const admission = await this.admissionRepo.findOne({
            where: { id: admissionId, clinicId },
            relations: ['room']
        });

        if (!admission) throw new NotFoundException('Admission not found');
        if (admission.status !== AdmissionStatus.ACTIVE) throw new BadRequestException('Admission is not active');

        // Update Admission
        admission.status = AdmissionStatus.DISCHARGED;
        admission.actualCheckOutDate = new Date();

        // Free Room
        if (admission.room) {
            admission.room.status = RoomStatus.CLEANING; // Mark for cleaning first
            await this.roomRepo.save(admission.room);
        }

        return this.admissionRepo.save(admission);
    }
}
