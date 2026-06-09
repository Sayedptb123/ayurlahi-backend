import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Not, DataSource, EntityManager } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';
import { TreatmentPackage } from './entities/treatment-package.entity';
import { Admission, AdmissionStatus } from './entities/admission.entity';
import { RoomBooking, BookingStatus } from './entities/room-booking.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { CreateBookingDto, UpdateBookingDto, CheckAvailabilityDto } from './dto/booking.dto';
import { NotificationsService } from '../notifications/notifications.service';

// Phase 0: half-open interval overlap. Two ranges [aStart,aEnd) and [bStart,bEnd)
// overlap iff aStart < bEnd AND aEnd > bStart. Back-to-back (a ends when b starts)
// does NOT overlap. Inputs are epoch-ms; an open-ended stay passes aEnd = +Infinity.
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return aStart < bEnd && aEnd > bStart;
}

type BlockReason = 'admission' | 'maintenance' | 'booking';

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
        @InjectRepository(OrganisationUser)
        private orgUserRepo: Repository<OrganisationUser>,
        @InjectRepository(Patient)
        private patientRepo: Repository<Patient>,
        private dataSource: DataSource,
        private notificationsService: NotificationsService,
    ) { }

    // --- ROOMS ---
    async getRooms(clinicId: string) {
        return this.roomRepo.find({
            where: { organisationId: clinicId },
            order: { roomNumber: 'ASC' },
        });
    }

    async createRoom(clinicId: string, data: Partial<Room>) {
        const room = this.roomRepo.create({ ...data, organisationId: clinicId });
        return this.roomRepo.save(room);
    }

    async updateRoomStatus(clinicId: string, id: string, status: string) {
        const room = await this.roomRepo.findOne({ where: { id, organisationId: clinicId } });
        if (!room) throw new NotFoundException('Room not found');
        room.status = status as RoomStatus;
        return this.roomRepo.save(room);
    }

    async deleteRoom(clinicId: string, id: string) {
        const room = await this.roomRepo.findOne({ where: { id, organisationId: clinicId } });
        if (!room) throw new NotFoundException('Room not found');
        await this.roomRepo.softDelete(room.id);
    }

    // --- PACKAGES ---
    async getPackages(clinicId: string) {
        return this.packageRepo.find({
            where: { organisationId: clinicId },
            order: { price: 'ASC' },
        });
    }

    async createPackage(clinicId: string, data: Partial<TreatmentPackage>) {
        const pkg = this.packageRepo.create({ ...data, organisationId: clinicId });
        return this.packageRepo.save(pkg);
    }

    async getAdmission(clinicId: string, id: string) {
        const admission = await this.admissionRepo.findOne({
            where: { id, organisationId: clinicId },
            relations: ['patient', 'room', 'treatmentPackage'],
        });
        if (!admission) throw new NotFoundException('Admission not found');
        return admission;
    }

    async deletePackage(clinicId: string, id: string) {
        const pkg = await this.packageRepo.findOne({ where: { id, organisationId: clinicId } });
        if (!pkg) throw new NotFoundException('Package not found');
        await this.packageRepo.softDelete(id);
        return { message: 'Package deleted' };
    }

    // --- ADMISSIONS ---
    async getAdmissions(clinicId: string, params?: { patientId?: string; status?: string }) {
        const where: any = { organisationId: clinicId };
        if (params?.patientId) where.patientId = params.patientId;
        if (params?.status) where.status = params.status;
        else where.status = AdmissionStatus.ACTIVE;
        return this.admissionRepo.find({
            where,
            relations: ['patient', 'room', 'treatmentPackage'],
            order: { checkInDate: 'DESC' },
        });
    }

    // Dashboard stats: current ward occupancy + today's admits/discharges.
    // "Today" is the IST calendar day (clinics operate in India) expressed as a UTC range.
    async getAdmissionStats(clinicId: string) {
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(Date.now() + IST_OFFSET_MS);
        const y = istNow.getUTCFullYear();
        const m = istNow.getUTCMonth();
        const d = istNow.getUTCDate();
        const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MS);
        const endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS);

        const [currentInpatients, admitsToday, dischargesToday] = await Promise.all([
            this.admissionRepo.count({
                where: { organisationId: clinicId, status: AdmissionStatus.ACTIVE },
            }),
            this.admissionRepo.count({
                where: { organisationId: clinicId, checkInDate: Between(startUtc, endUtc) },
            }),
            this.admissionRepo.count({
                where: {
                    organisationId: clinicId,
                    status: AdmissionStatus.DISCHARGED,
                    actualCheckOutDate: Between(startUtc, endUtc),
                },
            }),
        ]);

        return { currentInpatients, admitsToday, dischargesToday };
    }

    async checkIn(
        clinicId: string,
        data: { patientId: string; roomId: string; packageId?: string; checkInDate?: Date }
    ) {
        const { patientId, roomId, packageId, checkInDate } = data;

        // Phase 0: serialise per-room + verify patient ownership + unified conflict, all
        // inside one transaction. Notifications are dispatched AFTER commit (see below).
        const { savedAdmission, room } = await this.dataSource.transaction(async (manager) => {
            // 1. Patient must belong to this organisation (cross-tenant guard)
            await this.assertPatientInOrg(clinicId, patientId, manager);

            // 2. Lock the room row (SELECT ... FOR UPDATE) before reading occupancy
            const room = await manager.findOne(Room, {
                where: { id: roomId, organisationId: clinicId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!room) throw new NotFoundException('Room not found');
            if (room.status !== RoomStatus.AVAILABLE) {
                throw new ConflictException(`Room ${room.roomNumber} is not available (Status: ${room.status})`);
            }

            // 3. Compute the stay window (expected checkout from package, else minimal 24h)
            const start = checkInDate ? new Date(checkInDate) : new Date();
            let expectedCheckOut: Date | null = null;
            if (packageId) {
                const pkg = await manager.findOne(TreatmentPackage, { where: { id: packageId } });
                if (pkg) {
                    expectedCheckOut = new Date(start);
                    expectedCheckOut.setDate(expectedCheckOut.getDate() + pkg.durationDays);
                }
            }
            const end = expectedCheckOut ?? new Date(start.getTime() + 24 * 60 * 60 * 1000);

            // 4. Unified conflict check across admissions + room status + bookings
            const block = await this.isRoomBlocked(manager, room, start, end);
            if (block.blocked) throw new ConflictException(this.blockMessage(block.reason));

            // 5. Create admission and occupy the room
            const admission = manager.create(Admission, {
                organisationId: clinicId,
                patientId,
                roomId,
                packageId,
                checkInDate: start,
                expectedCheckOutDate: expectedCheckOut,
                status: AdmissionStatus.ACTIVE,
            });
            room.status = RoomStatus.OCCUPIED;
            await manager.save(room);
            const savedAdmission = await manager.save(admission);
            return { savedAdmission, room };
        });

        // Post-commit, best-effort: notify clinic doctors and managers about the new admission.
        // A notification failure is swallowed and never affects the committed admission.
        this.orgUserRepo
            .find({ where: { organisationId: clinicId, role: In(['DOCTOR', 'MANAGER', 'OWNER', 'ADMIN']), isActive: true } })
            .then((orgUsers) => {
                const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
                if (userIds.length > 0) {
                    this.notificationsService.sendToUsers({
                        userIds,
                        title: 'Patient Admitted',
                        body: `Room ${room.roomNumber} — check-in on ${new Date(savedAdmission.checkInDate).toLocaleDateString()}`,
                        data: { admissionId: savedAdmission.id, type: 'patient_admitted' },
                    }).catch(() => {});
                }
            })
            .catch(() => {});

        return savedAdmission;
    }

    async discharge(clinicId: string, admissionId: string) {
        const admission = await this.admissionRepo.findOne({
            where: { id: admissionId, organisationId: clinicId },
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

        const saved = await this.admissionRepo.save(admission);

        // Notify OWNER+RECEPTIONIST on discharge
        this.orgUserRepo
            .find({ where: { organisationId: clinicId, role: In(['OWNER', 'RECEPTIONIST']), isActive: true } })
            .then((orgUsers) => {
                const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
                if (userIds.length > 0) {
                    const roomInfo = admission.room ? ` from room ${admission.room.roomNumber}` : '';
                    this.notificationsService.sendToUsers({
                        userIds,
                        title: 'Patient Discharged',
                        body: `Patient discharged${roomInfo}`,
                        data: { admissionId: saved.id, type: 'patient_discharged' },
                    }).catch(() => {});
                }
            })
            .catch(() => {});

        return saved;
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

        // Phase 0: serialise per-room + verify patient ownership + unified conflict in one txn.
        return this.dataSource.transaction(async (manager) => {
            // Patient must belong to this organisation (cross-tenant guard)
            await this.assertPatientInOrg(clinicId, patientId, manager);

            // Lock the room row before reading occupancy
            const room = await manager.findOne(Room, {
                where: { id: roomId, organisationId: clinicId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!room) throw new NotFoundException('Room not found');

            // Unified conflict check across admissions + room status + bookings
            const block = await this.isRoomBlocked(manager, room, checkIn, checkOut);
            if (block.blocked) throw new ConflictException(this.blockMessage(block.reason));

            // Calculate total price (decimal columns come back as strings → parseFloat)
            const days = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
            let totalPrice = parseFloat(String(room.pricePerDay)) * days;
            if (packageId) {
                const pkg = await manager.findOne(TreatmentPackage, { where: { id: packageId } });
                if (pkg) {
                    totalPrice = parseFloat(String(pkg.price));
                }
            }

            const booking = manager.create(RoomBooking, {
                organisationId: clinicId,
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
            return manager.save(booking);
        });
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
                .where('booking.organisationId = :organisationId', { organisationId: clinicId });

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
            where: { id: bookingId, organisationId: clinicId },
            relations: ['patient', 'room', 'treatmentPackage'],
        });

        if (!booking) throw new NotFoundException('Booking not found');
        return booking;
    }

    async updateBooking(clinicId: string, bookingId: string, dto: UpdateBookingDto) {
        return this.dataSource.transaction(async (manager) => {
            const booking = await manager.findOne(RoomBooking, {
                where: { id: bookingId, organisationId: clinicId },
            });
            if (!booking) throw new NotFoundException('Booking not found');

            // Re-check conflicts when dates or the target room change
            if (dto.checkInDate || dto.checkOutDate || dto.roomId) {
                const newCheckIn = dto.checkInDate ? new Date(dto.checkInDate) : new Date(booking.checkInDate);
                const newCheckOut = dto.checkOutDate ? new Date(dto.checkOutDate) : new Date(booking.checkOutDate);
                const targetRoomId = dto.roomId || booking.roomId;

                const room = await manager.findOne(Room, {
                    where: { id: targetRoomId, organisationId: clinicId },
                    lock: { mode: 'pessimistic_write' },
                });
                if (!room) throw new NotFoundException('Room not found');

                const block = await this.isRoomBlocked(manager, room, newCheckIn, newCheckOut, bookingId);
                if (block.blocked) throw new ConflictException(this.blockMessage(block.reason));

                booking.checkInDate = newCheckIn;
                booking.checkOutDate = newCheckOut;
            }

            // Update other fields
            if (dto.roomId) booking.roomId = dto.roomId;
            if (dto.packageId !== undefined) booking.packageId = dto.packageId;
            if (dto.status) booking.status = dto.status;
            if (dto.advancePaid !== undefined) booking.advancePaid = Number(dto.advancePaid);
            if (dto.notes !== undefined) booking.notes = dto.notes;

            return manager.save(booking);
        });
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

        // Read-only path: no lock needed. Resolve the room then run the unified check.
        const room = await this.roomRepo.findOne({ where: { id: roomId, organisationId: clinicId } });
        if (!room) throw new NotFoundException('Room not found');

        const block = await this.isRoomBlocked(this.dataSource.manager, room, checkIn, checkOut, excludeBookingId);

        return {
            available: !block.blocked,
            reason: block.reason ?? null,
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

    // ── Phase 0 safety helpers ──────────────────────────────────────────────

    // Cross-tenant guard: the patient must belong to this organisation. Soft-deleted
    // patients are auto-excluded by the @DeleteDateColumn on `patients`.
    private async assertPatientInOrg(
        clinicId: string,
        patientId: string,
        manager?: EntityManager,
    ): Promise<void> {
        const repo = manager ? manager.getRepository(Patient) : this.patientRepo;
        const patient = await repo.findOne({ where: { id: patientId, organisationId: clinicId } });
        if (!patient) {
            throw new ForbiddenException('Patient not found in this organisation');
        }
    }

    // Single source of truth for "can this room be occupied over [start, end)".
    // Scans live admissions (physical occupancy) → room maintenance → active
    // reservations, in that precedence. `blocked` is the OR of all three; the
    // reason reports the most authoritative blocker first. Overlap is half-open.
    private async isRoomBlocked(
        manager: EntityManager,
        room: Room,
        start: Date,
        end: Date,
        excludeBookingId?: string,
    ): Promise<{ blocked: boolean; reason?: BlockReason }> {
        const s = start.getTime();
        const e = end.getTime();

        // (a) Live admissions — ACTIVE/PLANNED occupy; DISCHARGED/CANCELLED do not.
        // An ACTIVE stay with no ACTUAL checkout occupies indefinitely (expected is
        // ignored on purpose — overstays still occupy until actually discharged).
        const admissions = await manager.find(Admission, {
            where: {
                organisationId: room.organisationId,
                roomId: room.id,
                status: Not(In([AdmissionStatus.DISCHARGED, AdmissionStatus.CANCELLED])),
            },
        });
        for (const a of admissions) {
            const aStart = new Date(a.checkInDate).getTime();
            const aEnd = a.actualCheckOutDate
                ? new Date(a.actualCheckOutDate).getTime()
                : Number.POSITIVE_INFINITY;
            if (rangesOverlap(aStart, aEnd, s, e)) {
                return { blocked: true, reason: 'admission' };
            }
        }

        // (b) Room administratively out of service
        if (room.status === RoomStatus.MAINTENANCE) {
            return { blocked: true, reason: 'maintenance' };
        }

        // (c) Active reservations (current-schema active set; becomes HELD/CONFIRMED in Phase 1)
        const bookings = await manager.find(RoomBooking, {
            where: {
                organisationId: room.organisationId,
                roomId: room.id,
                status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
            },
        });
        for (const b of bookings) {
            if (excludeBookingId && b.id === excludeBookingId) continue;
            const bStart = new Date(b.checkInDate).getTime();
            const bEnd = new Date(b.checkOutDate).getTime();
            if (rangesOverlap(bStart, bEnd, s, e)) {
                return { blocked: true, reason: 'booking' };
            }
        }

        return { blocked: false };
    }

    private blockMessage(reason?: BlockReason): string {
        switch (reason) {
            case 'admission':
                return 'Room is currently occupied by an active admission for the selected dates';
            case 'maintenance':
                return 'Room is under maintenance and cannot be booked';
            case 'booking':
                return 'Room is already booked for the selected dates';
            default:
                return 'Room is not available for the selected dates';
        }
    }
}
