import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Not, DataSource, EntityManager } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';
import { TreatmentPackage } from './entities/treatment-package.entity';
import { Admission, AdmissionStatus } from './entities/admission.entity';
import { RoomBooking, BookingStatus } from './entities/room-booking.entity';
import { BookingEnquiry, EnquiryStatus } from './entities/booking-enquiry.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { ClinicCapabilities } from '../clinic-capabilities/entities/clinic-capabilities.entity';
import { CreateBookingDto, UpdateBookingDto, CheckAvailabilityDto } from './dto/booking.dto';
import { CreateEnquiryDto, UpdateEnquiryDto, ConvertEnquiryDto } from './dto/enquiry.dto';
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
        @InjectRepository(BookingEnquiry)
        private enquiryRepo: Repository<BookingEnquiry>,
        @InjectRepository(OrganisationUser)
        private orgUserRepo: Repository<OrganisationUser>,
        @InjectRepository(Patient)
        private patientRepo: Repository<Patient>,
        @InjectRepository(ClinicCapabilities)
        private capabilitiesRepo: Repository<ClinicCapabilities>,
        private dataSource: DataSource,
        private notificationsService: NotificationsService,
    ) { }

    // Map a clinic_capabilities row to the set of care programs the org is allowed
    // to admit under. This is the single source of the care_program vocabulary —
    // it reuses the capability taxonomy rather than forking a parallel enum.
    private enabledCarePrograms(caps: ClinicCapabilities | null): string[] {
        if (!caps) return [];
        const programs: string[] = [];
        if (caps.hasPostnatalCare) programs.push('postnatal');
        if (caps.hasAyurveda) programs.push('ayurveda');
        if (caps.hasIpd) programs.push('ipd');
        if (caps.hasOpd) programs.push('opd');
        return programs;
    }

    // Resolve the care_program to persist on an admission.
    //  - explicit value  → must be one of the org's enabled programs
    //  - omitted + single enabled program → auto-default to it
    //  - omitted + multiple/zero programs → null (backward-compatible; the existing
    //    booking check-in flow does not yet pass care_program, so we never hard-fail
    //    a stay over a missing classifier — the intake UIs we control set it).
    private async resolveCareProgram(clinicId: string, requested?: string | null): Promise<string | null> {
        const caps = await this.capabilitiesRepo.findOne({ where: { organisationId: clinicId } });
        const enabled = this.enabledCarePrograms(caps);

        if (requested) {
            const value = requested.toLowerCase();
            if (!enabled.includes(value)) {
                throw new BadRequestException(
                    `care_program '${requested}' is not enabled for this organisation (enabled: ${enabled.join(', ') || 'none'})`,
                );
            }
            return value;
        }

        return enabled.length === 1 ? enabled[0] : null;
    }

    // --- ROOMS ---
    async getRooms(clinicId: string) {
        return this.roomRepo.find({
            where: { organisationId: clinicId },
            order: { roomNumber: 'ASC' },
        });
    }

    // Rooms that are free for the given date range — reuses the unified conflict
    // check (admissions + bookings + maintenance). Powers the date-aware room
    // selector in the booking form, so reception only sees what they can book.
    async getAvailableRooms(clinicId: string, checkInDate: string, checkOutDate: string) {
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            throw new BadRequestException('Valid check-in and check-out dates are required');
        }
        if (checkOut <= checkIn) {
            throw new BadRequestException('Check-out date must be after check-in date');
        }

        const rooms = await this.roomRepo.find({
            where: { organisationId: clinicId },
            order: { roomNumber: 'ASC' },
        });
        const manager = this.dataSource.manager;
        const checked = await Promise.all(
            rooms.map(async (room) => {
                const block = await this.isRoomBlocked(manager, room, checkIn, checkOut);
                return block.blocked ? null : room;
            }),
        );
        return checked.filter((r): r is Room => r !== null);
    }

    // Operational "Today" worklist for reception: arrivals, departures, outstanding
    // holds, and leads awaiting follow-up. Returns the actual items so that tile
    // counts (.length) and detail sheets are derived from exactly the same dataset —
    // one IST timezone calculation, one filtering implementation, zero drift.
    async getTodaySummary(clinicId: string) {
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(Date.now() + IST_OFFSET_MS);
        const y = istNow.getUTCFullYear();
        const m = istNow.getUTCMonth();
        const d = istNow.getUTCDate();
        const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MS);
        const endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS);

        const [arrivals, departures, holds, followUps] = await Promise.all([
            this.bookingRepo.find({
                where: {
                    organisationId: clinicId,
                    status: In([BookingStatus.HELD, BookingStatus.CONFIRMED]),
                    checkInDate: Between(startUtc, endUtc),
                },
                relations: ['patient', 'room', 'treatmentPackage'],
                order: { checkInDate: 'ASC' },
            }),
            this.admissionRepo.find({
                where: {
                    organisationId: clinicId,
                    status: AdmissionStatus.ACTIVE,
                    expectedCheckOutDate: Between(startUtc, endUtc),
                },
                relations: ['patient', 'room', 'treatmentPackage'],
                order: { expectedCheckOutDate: 'ASC' },
            }),
            this.bookingRepo.find({
                where: { organisationId: clinicId, status: BookingStatus.HELD },
                relations: ['patient', 'room'],
                order: { checkInDate: 'ASC' },
            }),
            this.enquiryRepo.find({
                where: {
                    organisationId: clinicId,
                    status: In([EnquiryStatus.NEW, EnquiryStatus.FOLLOW_UP]),
                },
                order: { createdAt: 'ASC' },
            }),
        ]);

        return { arrivals, departures, holds, followUps };
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

    async updatePackage(clinicId: string, id: string, data: Partial<TreatmentPackage>) {
        const pkg = await this.packageRepo.findOne({ where: { id, organisationId: clinicId } });
        if (!pkg) throw new NotFoundException('Package not found');
        Object.assign(pkg, data);
        return this.packageRepo.save(pkg);
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
        data: { patientId: string; roomId: string; packageId?: string; checkInDate?: Date; bookingId?: string; careProgram?: string }
    ) {
        const { patientId: bodyPatientId, roomId, packageId, checkInDate, bookingId } = data;

        // Resolve the care-program classifier up front (capability read, no occupancy
        // impact). Postnatal intake passes 'postnatal'; single-program clinics default.
        const careProgram = await this.resolveCareProgram(clinicId, data.careProgram);

        // Phase 1: checkIn from booking or walk-in. If bookingId provided, validate the
        // booking, transition booking → FULFILLED, and link admission.booking_id. All
        // inside one locked transaction.
        const { savedAdmission, room } = await this.dataSource.transaction(async (manager) => {
            // 1. Resolve the patient. From a booking, the patient comes from the booking
            // (not the request body); for a walk-in it comes from the body.
            let linkedBooking: RoomBooking | null = null;
            let patientId = bodyPatientId;
            if (bookingId) {
                linkedBooking = await manager.findOne(RoomBooking, {
                    where: { id: bookingId, organisationId: clinicId },
                    relations: ['enquiry'],
                });
                if (!linkedBooking) throw new NotFoundException('Booking not found');
                if (linkedBooking.status !== BookingStatus.CONFIRMED) {
                    throw new ConflictException(`Booking must be CONFIRMED to check in (current: ${linkedBooking.status})`);
                }
                // Enquiry-only bookings must be promoted to a patient first
                if (!linkedBooking.patientId) {
                    throw new ConflictException('Booking has no patient. Promote enquiry first.');
                }
                patientId = linkedBooking.patientId;
            }

            if (!patientId) {
                throw new BadRequestException('Either bookingId or patientId is required to check in');
            }

            // 2. Patient must belong to this organisation (cross-tenant guard)
            await this.assertPatientInOrg(clinicId, patientId, manager);

            // 2. Lock the room row (SELECT ... FOR UPDATE) before reading occupancy
            const targetRoomId = linkedBooking?.roomId || roomId;
            const room = await manager.findOne(Room, {
                where: { id: targetRoomId, organisationId: clinicId },
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
            const block = await this.isRoomBlocked(manager, room, start, end, bookingId ?? undefined);
            if (block.blocked) throw new ConflictException(this.blockMessage(block.reason));

            // 5. Create admission and occupy the room
            const admission = manager.create(Admission, {
                organisationId: clinicId,
                patientId,
                roomId: targetRoomId,
                packageId: packageId || linkedBooking?.packageId || null,
                bookingId: linkedBooking?.id || null,
                checkInDate: start,
                expectedCheckOutDate: expectedCheckOut,
                status: AdmissionStatus.ACTIVE,
                careProgram,
            });
            room.status = RoomStatus.OCCUPIED;
            await manager.save(room);

            // Transition booking → FULFILLED if linked
            if (linkedBooking) {
                linkedBooking.status = BookingStatus.FULFILLED;
                await manager.save(linkedBooking);
            }

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
        const { patientId, enquiryId, roomId, packageId, checkInDate, checkOutDate, advancePaid, notes } = dto;

        // Validate identity: at least one of patientId or enquiryId must be present
        if (!patientId && !enquiryId) {
            throw new BadRequestException('Either patientId or enquiryId is required');
        }

        // Validate dates
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);

        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            throw new BadRequestException('Invalid date format provided');
        }

        if (checkOut <= checkIn) {
            throw new BadRequestException('Check-out date must be after check-in date');
        }

        // Phase 1: serialise per-room + verify patient ownership + unified conflict in one txn.
        return this.dataSource.transaction(async (manager) => {
            // Patient ownership guard (when patientId provided)
            if (patientId) {
                await this.assertPatientInOrg(clinicId, patientId, manager);
            }

            // Verify enquiry belongs to org (when enquiryId provided)
            if (enquiryId) {
                const enquiry = await manager.findOne(BookingEnquiry, {
                    where: { id: enquiryId, organisationId: clinicId },
                });
                if (!enquiry) throw new ForbiddenException('Enquiry not found in this organisation');
            }

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
                patientId: patientId || null,
                enquiryId: enquiryId || null,
                roomId,
                packageId: packageId || null,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                totalPrice,
                advancePaid: advancePaid || 0,
                status: BookingStatus.HELD,
                notes: notes || null,
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
                .leftJoinAndSelect('booking.enquiry', 'enquiry')
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

            const bookings = await query.getMany();
            // Attach a resolved contact (patient → else enquiry) so the UI has one field
            // to display regardless of whether the booking has a patient yet.
            return bookings.map((b) => Object.assign(b, { contact: this.resolveContact(b) }));
        } catch (error) {
            console.error('Error fetching bookings:', error);
            throw error; // Re-throw to let global filter handle it, but now it's logged
        }
    }

    async getBookingById(clinicId: string, bookingId: string) {
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId, organisationId: clinicId },
            relations: ['patient', 'enquiry', 'room', 'treatmentPackage'],
        });

        if (!booking) throw new NotFoundException('Booking not found');
        return Object.assign(booking, { contact: this.resolveContact(booking) });
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

        if (booking.status === BookingStatus.FULFILLED) {
            throw new BadRequestException('Cannot cancel a booking that has already been fulfilled');
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
        const todayMs = new Date(new Date().toISOString().split('T')[0]).getTime();

        rooms.forEach(room => {
            availability[room.id] = {};

            // Iterate through each date in range
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD

                // Default to available
                availability[room.id][dateKey] = 'available';

                // Occupied by an ACTIVE admission. Occupancy ends at actual checkout;
                // else the planned checkout, but never before today (an undischarged
                // overstay still occupies up to now) and never past today (so future
                // months don't show stale occupancy). Conflict logic keeps actual ?? ∞.
                const isOccupied = admissions.some(admission => {
                    if (admission.roomId !== room.id || admission.status !== 'ACTIVE') return false;
                    if (new Date(admission.checkInDate) > d) return false;
                    let endMs: number;
                    if (admission.actualCheckOutDate) {
                        endMs = new Date(admission.actualCheckOutDate).getTime();
                    } else {
                        const expMs = admission.expectedCheckOutDate
                            ? new Date(admission.expectedCheckOutDate).getTime()
                            : todayMs;
                        endMs = Math.max(expMs, todayMs);
                    }
                    return d.getTime() <= endMs;
                });

                if (isOccupied) {
                    availability[room.id][dateKey] = 'occupied';
                    continue;
                }

                // Check if booked (future reservation)
                const isBooked = bookings.some(booking =>
                    booking.roomId === room.id &&
                    booking.status !== 'CANCELLED' &&
                    booking.status !== 'FULFILLED' &&
                    booking.status !== 'NO_SHOW' &&
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

        // (a) Live admissions — ACTIVE occupies; DISCHARGED/CANCELLED do not.
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

        // (c) Active reservations — HELD/CONFIRMED block; FULFILLED/CANCELLED/NO_SHOW do not.
        const bookings = await manager.find(RoomBooking, {
            where: {
                organisationId: room.organisationId,
                roomId: room.id,
                status: In([BookingStatus.HELD, BookingStatus.CONFIRMED]),
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

    // ── Enquiry methods ─────────────────────────────────────────────────────

    async listEnquiries(clinicId: string, filters?: { status?: EnquiryStatus; assignedTo?: string }) {
        const query = this.enquiryRepo.createQueryBuilder('enquiry')
            .leftJoinAndSelect('enquiry.assignedToUser', 'assignedToUser')
            .where('enquiry.organisationId = :organisationId', { organisationId: clinicId })
            .andWhere('enquiry.deletedAt IS NULL');

        if (filters?.status) {
            query.andWhere('enquiry.status = :status', { status: filters.status });
        }
        if (filters?.assignedTo) {
            query.andWhere('enquiry.assignedTo = :assignedTo', { assignedTo: filters.assignedTo });
        }

        query.orderBy('enquiry.createdAt', 'DESC');
        const enquiries = await query.getMany();

        // Derive conversion state (never stored — see ADR D6). A lead is "converted"
        // if it has a FULFILLED booking; it has a live reservation if HELD/CONFIRMED.
        // A cancelled/no-show booking leaves the lead open for follow-up.
        const ids = enquiries.map((e) => e.id);
        const liveByEnquiry = new Set<string>();
        const convertedByEnquiry = new Set<string>();
        if (ids.length > 0) {
            const bookings = await this.bookingRepo.find({
                where: { organisationId: clinicId, enquiryId: In(ids) },
                select: ['enquiryId', 'status'],
            });
            for (const b of bookings) {
                if (!b.enquiryId) continue;
                if (b.status === BookingStatus.HELD || b.status === BookingStatus.CONFIRMED) {
                    liveByEnquiry.add(b.enquiryId);
                }
                if (b.status === BookingStatus.FULFILLED) {
                    convertedByEnquiry.add(b.enquiryId);
                }
            }
        }

        return enquiries.map((e) =>
            Object.assign(e, {
                hasActiveBooking: liveByEnquiry.has(e.id),
                converted: convertedByEnquiry.has(e.id),
            }),
        );
    }

    async createEnquiry(clinicId: string, dto: CreateEnquiryDto) {
        const enquiry = this.enquiryRepo.create({
            organisationId: clinicId,
            contactName: dto.contactName,
            phone: dto.phone,
            channel: dto.channel,
            preferredRoomType: dto.preferredRoomType || null,
            preferredCheckIn: dto.preferredCheckIn ? new Date(dto.preferredCheckIn) : null,
            preferredCheckOut: dto.preferredCheckOut ? new Date(dto.preferredCheckOut) : null,
            notes: dto.notes || null,
            assignedTo: dto.assignedTo || null,
            followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : null,
            status: EnquiryStatus.NEW,
        });
        return this.enquiryRepo.save(enquiry);
    }

    async updateEnquiry(clinicId: string, enquiryId: string, dto: UpdateEnquiryDto) {
        const enquiry = await this.enquiryRepo.findOne({
            where: { id: enquiryId, organisationId: clinicId },
        });
        if (!enquiry) throw new NotFoundException('Enquiry not found');

        if (dto.contactName !== undefined) enquiry.contactName = dto.contactName;
        if (dto.phone !== undefined) enquiry.phone = dto.phone;
        if (dto.channel !== undefined) enquiry.channel = dto.channel;
        if (dto.preferredRoomType !== undefined) enquiry.preferredRoomType = dto.preferredRoomType || null;
        if (dto.preferredCheckIn !== undefined) enquiry.preferredCheckIn = dto.preferredCheckIn ? new Date(dto.preferredCheckIn) : null;
        if (dto.preferredCheckOut !== undefined) enquiry.preferredCheckOut = dto.preferredCheckOut ? new Date(dto.preferredCheckOut) : null;
        if (dto.status !== undefined) enquiry.status = dto.status;
        if (dto.notes !== undefined) enquiry.notes = dto.notes || null;
        if (dto.assignedTo !== undefined) enquiry.assignedTo = dto.assignedTo || null;
        if (dto.followUpAt !== undefined) enquiry.followUpAt = dto.followUpAt ? new Date(dto.followUpAt) : null;
        if (dto.lostReason !== undefined) enquiry.lostReason = dto.lostReason || null;

        return this.enquiryRepo.save(enquiry);
    }

    async markEnquiryLost(clinicId: string, enquiryId: string, lostReason?: string) {
        const enquiry = await this.enquiryRepo.findOne({
            where: { id: enquiryId, organisationId: clinicId },
        });
        if (!enquiry) throw new NotFoundException('Enquiry not found');

        enquiry.status = EnquiryStatus.LOST;
        enquiry.lostReason = lostReason || null;
        return this.enquiryRepo.save(enquiry);
    }

    async convertEnquiryToBooking(clinicId: string, enquiryId: string, dto: ConvertEnquiryDto) {
        return this.dataSource.transaction(async (manager) => {
            const enquiry = await manager.findOne(BookingEnquiry, {
                where: { id: enquiryId, organisationId: clinicId },
            });
            if (!enquiry) throw new NotFoundException('Enquiry not found');

            const room = await manager.findOne(Room, {
                where: { id: dto.roomId, organisationId: clinicId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!room) throw new NotFoundException('Room not found');

            const checkIn = new Date(dto.checkInDate);
            const checkOut = new Date(dto.checkOutDate);
            if (checkOut <= checkIn) {
                throw new BadRequestException('Check-out date must be after check-in date');
            }

            const block = await this.isRoomBlocked(manager, room, checkIn, checkOut);
            if (block.blocked) throw new ConflictException(this.blockMessage(block.reason));

            const days = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
            let totalPrice = parseFloat(String(room.pricePerDay)) * days;
            if (dto.packageId) {
                const pkg = await manager.findOne(TreatmentPackage, { where: { id: dto.packageId } });
                if (pkg) totalPrice = parseFloat(String(pkg.price));
            }

            const booking = manager.create(RoomBooking, {
                organisationId: clinicId,
                enquiryId,
                patientId: null,
                roomId: dto.roomId,
                packageId: dto.packageId || null,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                totalPrice,
                advancePaid: 0,
                status: BookingStatus.HELD,
                notes: dto.notes || null,
                bookingDate: new Date(),
            });
            return manager.save(booking);
        });
    }

    // Phone-dedup patient search / creation. Sets booking.patient_id only.
    async promoteEnquiry(clinicId: string, bookingId: string) {
        return this.dataSource.transaction(async (manager) => {
            const booking = await manager.findOne(RoomBooking, {
                where: { id: bookingId, organisationId: clinicId },
                relations: ['enquiry'],
            });
            if (!booking) throw new NotFoundException('Booking not found');
            if (booking.patientId) {
                throw new BadRequestException('Booking already has a patient linked');
            }
            if (!booking.enquiry) {
                throw new BadRequestException('Booking has no enquiry to promote');
            }

            // Phone dedup
            const existingPatient = await manager.findOne(Patient, {
                where: { phone: booking.enquiry.phone, organisationId: clinicId },
            });

            if (existingPatient) {
                booking.patientId = existingPatient.id;
            } else {
                const newPatient = manager.create(Patient, {
                    organisationId: clinicId,
                    patientCode: `TMP-${Date.now()}`,
                    firstName: booking.enquiry.contactName.split(' ')[0] || booking.enquiry.contactName,
                    lastName: booking.enquiry.contactName.split(' ').slice(1).join(' ') || '',
                    phone: booking.enquiry.phone,
                    gender: 'other' as any,
                    dateOfBirth: null,
                });
                const saved = await manager.save(newPatient);
                booking.patientId = saved.id;
            }

            return manager.save(booking);
        });
    }

    // Resolve contact identity for a booking: patient (if linked) else enquiry.
    private resolveContact(booking: RoomBooking): { name: string; phone: string } {
        if (booking.patient) {
            return {
                name: `${booking.patient.firstName} ${booking.patient.lastName}`.trim(),
                phone: booking.patient.phone || '',
            };
        }
        if (booking.enquiry) {
            return {
                name: booking.enquiry.contactName,
                phone: booking.enquiry.phone,
            };
        }
        return { name: 'Unknown', phone: '' };
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
