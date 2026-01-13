import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';
import { TreatmentPackage } from './entities/treatment-package.entity';
import { Admission, AdmissionStatus } from './entities/admission.entity';
import { RoomBooking, BookingStatus } from './entities/room-booking.entity';
import { CreateBookingDto, UpdateBookingDto, CheckAvailabilityDto } from './dto/booking.dto';

@Injectable()
export class RetreatService {
    constructor(
        @InjectRepository(Room)
        private roomRepo: Repository<Room>,
        @InjectRepository(TreatmentPackage)
        private packageRepo: Repository<TreatmentPackage>,
        @InjectRepository(Admission)
        private admissionRepo: Repository<Admission>,
        @InjectRepository(RoomBooking)
        private bookingRepo: Repository<RoomBooking>,
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

    async deleteRoom(clinicId: string, id: string) {
        const room = await this.roomRepo.findOne({ where: { id, clinicId } });
        if (!room) throw new NotFoundException('Room not found');
        return this.roomRepo.remove(room);
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

    // --- BOOKINGS ---
    async createBooking(clinicId: string, dto: CreateBookingDto) {
        const { patientId, roomId, packageId, checkInDate, checkOutDate, advancePaid, notes } = dto;

        // Validate dates
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);

        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            throw new BadRequestException('Invalid date format provided');
        }

        if (checkOut <= checkIn) {
            throw new BadRequestException('Check-out date must be after check-in date');
        }

        // Check room exists
        const room = await this.roomRepo.findOne({ where: { id: roomId, clinicId } });
        if (!room) throw new NotFoundException('Room not found');

        // Check availability (no overlapping bookings)
        const hasConflict = await this.checkBookingConflict(roomId, checkIn, checkOut);
        if (hasConflict) {
            throw new ConflictException('Room is already booked for the selected dates');
        }

        // Calculate total price
        const days = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        let totalPrice = Number(room.pricePerDay) * days;

        // If package selected, use package price
        if (packageId) {
            const pkg = await this.packageRepo.findOne({ where: { id: packageId } });
            if (pkg) {
                totalPrice = Number(pkg.price);
            }
        }

        // Create booking
        const booking = this.bookingRepo.create({
            clinicId,
            patientId,
            roomId,
            packageId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            totalPrice,
            advancePaid: advancePaid || 0,
            status: BookingStatus.PENDING,
            notes,
            bookingDate: new Date(),
        });

        return this.bookingRepo.save(booking);
    }

    async getBookings(clinicId: string, filters?: {
        status?: BookingStatus;
        roomId?: string;
        startDate?: string;
        endDate?: string;
    }) {
        try {
            const query = this.bookingRepo.createQueryBuilder('booking')
                .leftJoinAndSelect('booking.patient', 'patient')
                .leftJoinAndSelect('booking.room', 'room')
                .leftJoinAndSelect('booking.treatmentPackage', 'package')
                .where('booking.clinicId = :clinicId', { clinicId });

            if (filters?.status) {
                query.andWhere('booking.status = :status', { status: filters.status });
            }

            if (filters?.roomId) {
                query.andWhere('booking.roomId = :roomId', { roomId: filters.roomId });
            }

            if (filters?.startDate && filters?.endDate) {
                query.andWhere(
                    '(booking.checkInDate BETWEEN :start AND :end OR booking.checkOutDate BETWEEN :start AND :end)',
                    { start: filters.startDate, end: filters.endDate }
                );
            }

            query.orderBy('booking.checkInDate', 'ASC');

            return await query.getMany();
        } catch (error) {
            console.error('Error fetching bookings:', error);
            throw error; // Re-throw to let global filter handle it, but now it's logged
        }
    }

    async getBookingById(clinicId: string, bookingId: string) {
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId, clinicId },
            relations: ['patient', 'room', 'treatmentPackage'],
        });

        if (!booking) throw new NotFoundException('Booking not found');
        return booking;
    }

    async updateBooking(clinicId: string, bookingId: string, dto: UpdateBookingDto) {
        const booking = await this.getBookingById(clinicId, bookingId);

        // If dates are being changed, check for conflicts
        if (dto.checkInDate || dto.checkOutDate) {
            const newCheckIn = dto.checkInDate ? new Date(dto.checkInDate) : booking.checkInDate;
            const newCheckOut = dto.checkOutDate ? new Date(dto.checkOutDate) : booking.checkOutDate;

            const hasConflict = await this.checkBookingConflict(
                dto.roomId || booking.roomId,
                newCheckIn,
                newCheckOut,
                bookingId // Exclude current booking
            );

            if (hasConflict) {
                throw new ConflictException('Room is already booked for the selected dates');
            }

            booking.checkInDate = newCheckIn;
            booking.checkOutDate = newCheckOut;
        }

        // Update other fields
        if (dto.roomId) booking.roomId = dto.roomId;
        if (dto.packageId !== undefined) booking.packageId = dto.packageId;
        if (dto.status) booking.status = dto.status;
        if (dto.advancePaid !== undefined) booking.advancePaid = Number(dto.advancePaid);
        if (dto.notes !== undefined) booking.notes = dto.notes;

        return this.bookingRepo.save(booking);
    }

    async cancelBooking(clinicId: string, bookingId: string) {
        const booking = await this.getBookingById(clinicId, bookingId);

        if (booking.status === BookingStatus.CHECKED_IN) {
            throw new BadRequestException('Cannot cancel a booking that is already checked in');
        }

        booking.status = BookingStatus.CANCELLED;
        return this.bookingRepo.save(booking);
    }

    async checkAvailability(clinicId: string, dto: CheckAvailabilityDto) {
        const { roomId, checkInDate, checkOutDate, excludeBookingId } = dto;

        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);

        const hasConflict = await this.checkBookingConflict(roomId, checkIn, checkOut, excludeBookingId);

        return {
            available: !hasConflict,
            roomId,
            checkInDate,
            checkOutDate,
        };
    }

    async getCalendarData(clinicId: string, startDate: string, endDate: string) {
        const bookings = await this.getBookings(clinicId, { startDate, endDate });
        const rooms = await this.getRooms(clinicId);

        // Get current admissions (occupied rooms)
        const admissions = await this.getAdmissions(clinicId);

        // Build availability matrix: { [roomId]: { [date]: status } }
        const availability: Record<string, Record<string, 'available' | 'booked' | 'occupied'>> = {};

        // Initialize all rooms as available for all dates
        const start = new Date(startDate);
        const end = new Date(endDate);

        rooms.forEach(room => {
            availability[room.id] = {};

            // Iterate through each date in range
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD

                // Default to available
                availability[room.id][dateKey] = 'available';

                // Check if occupied by current admission
                const isOccupied = admissions.some(admission =>
                    admission.roomId === room.id &&
                    admission.status === 'ACTIVE' &&
                    new Date(admission.checkInDate) <= d &&
                    (!admission.actualCheckOutDate || new Date(admission.actualCheckOutDate) >= d)
                );

                if (isOccupied) {
                    availability[room.id][dateKey] = 'occupied';
                    continue;
                }

                // Check if booked (future reservation)
                const isBooked = bookings.some(booking =>
                    booking.roomId === room.id &&
                    booking.status !== 'CANCELLED' &&
                    booking.status !== 'COMPLETED' &&
                    new Date(booking.checkInDate) <= d &&
                    new Date(booking.checkOutDate) > d
                );

                if (isBooked) {
                    availability[room.id][dateKey] = 'booked';
                }
            }
        });

        return {
            bookings,
            rooms,
            admissions: admissions.filter(a => a.status === 'ACTIVE'),
            startDate,
            endDate,
            availability,
        };
    }

    // Helper method to check booking conflicts
    private async checkBookingConflict(
        roomId: string,
        checkIn: Date,
        checkOut: Date,
        excludeBookingId?: string
    ): Promise<boolean> {
        const query = this.bookingRepo.createQueryBuilder('booking')
            .where('booking.roomId = :roomId', { roomId })
            .andWhere('booking.status NOT IN (:...excludeStatuses)', {
                excludeStatuses: [BookingStatus.CANCELLED, BookingStatus.COMPLETED]
            })
            .andWhere(
                '(booking.checkInDate < :checkOut AND booking.checkOutDate > :checkIn)',
                { checkIn, checkOut }
            );

        if (excludeBookingId) {
            query.andWhere('booking.id != :excludeBookingId', { excludeBookingId });
        }

        const conflictingBooking = await query.getOne();
        return !!conflictingBooking;
    }
}
