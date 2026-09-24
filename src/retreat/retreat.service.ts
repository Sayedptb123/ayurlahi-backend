import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Not, Or, Equal, IsNull, DataSource, EntityManager } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';
import { RoomCategory } from './entities/room-category.entity';
import { RoomCategoryPricing } from './entities/room-category-pricing.entity';
import { RoomPricingOverride } from './entities/room-pricing-override.entity';
import { TreatmentPackage } from './entities/treatment-package.entity';
import { Admission, AdmissionStatus } from './entities/admission.entity';
import { RoomBooking, BookingStatus } from './entities/room-booking.entity';
import { BookingEnquiry, EnquiryStatus } from './entities/booking-enquiry.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Branch } from '../branches/entities/branch.entity';
import { ClinicCapabilities } from '../clinic-capabilities/entities/clinic-capabilities.entity';
import { PatientBillingService } from '../patient-billing/patient-billing.service';
import { PatientsService } from '../patients/patients.service';
import { CreateBookingDto, UpdateBookingDto, CheckAvailabilityDto, RecordRefundDto, RecordAdvanceDto } from './dto/booking.dto';
import { CreateEnquiryDto, UpdateEnquiryDto, ConvertEnquiryDto } from './dto/enquiry.dto';
import { BookingFieldDefinition } from './entities/booking-field-definition.entity';
import { CreateFieldDefinitionDto, UpdateFieldDefinitionDto } from './dto/field-definition.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { BranchVisibilityService } from '../branch-visibility/branch-visibility.service';
import { AuditService } from '../audit/audit.service';
import { BookingAdvancePostingService } from '../cash/booking-advance-posting.service';
import { organisationBusinessDate } from '../common/business-date';

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
        @InjectRepository(RoomCategory)
        private categoryRepo: Repository<RoomCategory>,
        @InjectRepository(RoomCategoryPricing)
        private categoryPricingRepo: Repository<RoomCategoryPricing>,
        @InjectRepository(RoomPricingOverride)
        private roomPricingOverrideRepo: Repository<RoomPricingOverride>,
        @InjectRepository(BookingFieldDefinition)
        private fieldDefinitionRepo: Repository<BookingFieldDefinition>,
        private dataSource: DataSource,
        private notificationsService: NotificationsService,
        private patientBillingService: PatientBillingService,
        private patientsService: PatientsService,
        private branchVisibilityService: BranchVisibilityService,
        private auditService: AuditService,
        private advancePosting: BookingAdvancePostingService,
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

    // ADR-004 D15 — validates a branchId belongs to the caller's org. Same
    // pattern createRoom already used for D14 (org-membership only, no
    // approval-status check — matches every other branch-assignment site in
    // this codebase, e.g. patients.service.ts).
    private async assertBranchOwnership(clinicId: string, branchId: string): Promise<Branch> {
        const branch = await this.dataSource.manager.findOne(Branch, {
            where: { id: branchId, organisationId: clinicId },
        });
        if (!branch) throw new NotFoundException('Branch not found in this organisation');
        return branch;
    }

    // ADR-004 D15 — no precedent elsewhere in this codebase for "two sibling
    // FKs must agree on branch". Deliberately explicit reject-then-compare,
    // NEVER the OR-NULL form (`a === b || a == null || b == null`) used
    // throughout D9's access-control checks — that form means the opposite
    // of what's needed here. A NULL branchId on either side means "this item
    // still needs branch assignment", which must block, not pass through.
    private assertSameBranch(
        a: { branchId: string | null },
        b: { branchId: string | null },
        labelA: string,
        labelB: string,
    ): void {
        if (!a.branchId || !b.branchId) {
            throw new BadRequestException(
                `${!a.branchId ? labelA : labelB} has no branch assigned — assign it a branch before use`,
            );
        }
        if (a.branchId !== b.branchId) {
            throw new BadRequestException(`${labelA} and ${labelB} belong to different branches`);
        }
    }

    // --- ROOMS ---
    async getRoomCategories(clinicId: string, branchId?: string) {
        // ADR-004 D15 — filtered view, distinct from the ownership enforcement
        // done at write time. Legacy branchId=NULL rows ("needs assignment")
        // are included alongside the selected branch's own rows — otherwise
        // they're permanently unreachable (never shown, badge never seen,
        // can never be resolved) for any multi-branch org whose data wasn't
        // auto-backfilled. NULL here still never means "shared" — it's a
        // to-be-fixed state surfaced for cleanup, not a standing catalog.
        const where = branchId
            ? [{ organisationId: clinicId, branchId }, { organisationId: clinicId, branchId: IsNull() }]
            : { organisationId: clinicId };
        return this.categoryRepo.find({
            where,
            order: { name: 'ASC' },
        });
    }

    async createRoomCategory(clinicId: string, data: { name: string; branchId: string }) {
        await this.assertBranchOwnership(clinicId, data.branchId);
        const existing = await this.categoryRepo.findOne({
            where: { organisationId: clinicId, name: data.name },
            withDeleted: true,
        });
        if (existing && !existing.deletedAt) {
            throw new ConflictException(`Room category "${data.name}" already exists`);
        }
        const category = this.categoryRepo.create({ name: data.name, organisationId: clinicId, branchId: data.branchId });
        return this.categoryRepo.save(category);
    }

    async updateRoomCategory(clinicId: string, id: string, data: { name?: string; isActive?: boolean; branchId?: string }) {
        const category = await this.categoryRepo.findOne({ where: { id, organisationId: clinicId } });
        if (!category) throw new NotFoundException('Room category not found');
        if (data.name !== undefined) category.name = data.name;
        if (data.isActive !== undefined) category.isActive = data.isActive;
        // ADR-004 D15 — this is also how a legacy NULL-branch row gets resolved.
        if (data.branchId !== undefined && data.branchId !== category.branchId) {
            await this.assertBranchOwnership(clinicId, data.branchId);
            category.branchId = data.branchId;
        }
        return this.categoryRepo.save(category);
    }

    async deleteRoomCategory(clinicId: string, id: string) {
        const category = await this.categoryRepo.findOne({ where: { id, organisationId: clinicId } });
        if (!category) throw new NotFoundException('Room category not found');
        await this.categoryRepo.softDelete(id);
    }

    // --- Pricing Matrix (category × package → price) ---

    async getPricingMatrix(clinicId: string, branchId?: string) {
        // ADR-004 D15 — see getRoomCategories() comment: legacy NULL-branch
        // rows must stay reachable in every branch's filtered view.
        const where = branchId
            ? [{ organisationId: clinicId, branchId }, { organisationId: clinicId, branchId: IsNull() }]
            : { organisationId: clinicId };
        return this.categoryPricingRepo.find({
            where,
            relations: ['roomCategory', 'package'],
            order: { roomCategory: { name: 'ASC' } },
        });
    }

    async setPricingMatrix(clinicId: string, data: { roomCategoryId: string; packageId: string; basePrice: number; acSupplementPerDay?: number | null }) {
        const category = await this.categoryRepo.findOne({ where: { id: data.roomCategoryId, organisationId: clinicId } });
        if (!category) throw new NotFoundException('Room category not found');
        if (!category.isActive) throw new BadRequestException('Cannot set pricing for an inactive room category');

        // Closes a pre-existing gap — packageId was never validated at all
        // before (not even org membership). Now required for the D15 same-
        // branch check below anyway.
        const pkg = await this.packageRepo.findOne({ where: { id: data.packageId, organisationId: clinicId } });
        if (!pkg) throw new NotFoundException('Package not found');

        this.assertSameBranch(category, pkg, 'Room category', 'Package');

        const existing = await this.categoryPricingRepo.findOne({
            where: { roomCategoryId: data.roomCategoryId, packageId: data.packageId },
            withDeleted: true,
        });

        if (existing) {
            existing.basePrice = data.basePrice;
            existing.acSupplementPerDay = data.acSupplementPerDay ?? null;
            existing.branchId = category.branchId;
            existing.deletedAt = null;
            return this.categoryPricingRepo.save(existing);
        }

        const entry = this.categoryPricingRepo.create({
            roomCategoryId: data.roomCategoryId,
            packageId: data.packageId,
            basePrice: data.basePrice,
            acSupplementPerDay: data.acSupplementPerDay ?? null,
            organisationId: clinicId,
            // Denormalized from the category/package, which the assertSameBranch
            // check above guarantees already agree — mirrors how RoomBooking/
            // Admission denormalize branchId from Room (D9).
            branchId: category.branchId,
        });
        return this.categoryPricingRepo.save(entry);
    }

    async deletePricingMatrixEntry(clinicId: string, id: string) {
        const entry = await this.categoryPricingRepo.findOne({ where: { id, organisationId: clinicId } });
        if (!entry) throw new NotFoundException('Pricing entry not found');
        await this.categoryPricingRepo.softDelete(id);
    }

    // --- Room-Level Price Overrides ---

    async getRoomPricingOverrides(clinicId: string, branchId?: string) {
        // ADR-004 D15 — see getRoomCategories() comment.
        const where = branchId
            ? [{ organisationId: clinicId, branchId }, { organisationId: clinicId, branchId: IsNull() }]
            : { organisationId: clinicId };
        return this.roomPricingOverrideRepo.find({
            where,
            relations: ['room', 'package'],
            order: { room: { roomNumber: 'ASC' } },
        });
    }

    async setRoomPricingOverride(clinicId: string, data: { roomId: string; packageId: string; price: number }) {
        const room = await this.roomRepo.findOne({ where: { id: data.roomId, organisationId: clinicId } });
        if (!room) throw new NotFoundException('Room not found');

        // Closes a pre-existing gap — packageId was never loaded or validated
        // at all before. Now required for the D15 same-branch check below.
        const pkg = await this.packageRepo.findOne({ where: { id: data.packageId, organisationId: clinicId } });
        if (!pkg) throw new NotFoundException('Package not found');

        this.assertSameBranch(room, pkg, 'Room', 'Package');

        const existing = await this.roomPricingOverrideRepo.findOne({
            where: { roomId: data.roomId, packageId: data.packageId },
            withDeleted: true,
        });

        if (existing) {
            existing.price = data.price;
            existing.branchId = room.branchId;
            existing.deletedAt = null;
            return this.roomPricingOverrideRepo.save(existing);
        }

        const override = this.roomPricingOverrideRepo.create({
            ...data,
            organisationId: clinicId,
            // Denormalized from the room/package, which assertSameBranch above
            // guarantees already agree — mirrors RoomBooking/Admission (D9).
            branchId: room.branchId,
        });
        return this.roomPricingOverrideRepo.save(override);
    }

    async deleteRoomPricingOverride(clinicId: string, id: string) {
        const override = await this.roomPricingOverrideRepo.findOne({ where: { id, organisationId: clinicId } });
        if (!override) throw new NotFoundException('Room pricing override not found');
        await this.roomPricingOverrideRepo.softDelete(id);
    }

    // --- Pricing Resolution (ADR-002 D2) ---

    async resolvePrice(
        clinicId: string,
        roomId: string,
        packageId: string | null | undefined,
        acRequired: boolean = false,
    ): Promise<{
        price: number | null;
        basePrice: number | null;
        acSupplement: number | null;
        acSupplementPerDay: number | null;
        source: 'room_override' | 'category_matrix' | 'manual';
    }> {
        const none = { price: null, basePrice: null, acSupplement: null, acSupplementPerDay: null, source: 'manual' as const };
        if (!packageId) return none;

        const override = await this.roomPricingOverrideRepo.findOne({
            where: { roomId, packageId, organisationId: clinicId },
        });
        if (override) {
            const price = parseFloat(override.price as any);
            // Room overrides set a specific price; AC supplement is not applied on top — receptionist adjusts manually.
            return { price, basePrice: price, acSupplement: null, acSupplementPerDay: null, source: 'room_override' };
        }

        const room = await this.roomRepo.findOne({ where: { id: roomId, organisationId: clinicId } });
        if (room?.roomCategoryId) {
            const matrix = await this.categoryPricingRepo.findOne({
                // organisationId added — this lookup had no org filter at all
                // before (relied entirely on room.roomCategoryId already being
                // org-scoped upstream).
                where: { roomCategoryId: room.roomCategoryId, packageId, organisationId: clinicId },
                relations: ['package'],
            });
            // ADR-004 D15 — defensive check, not expected to trigger for any
            // row created after this decision (assertSameBranch guarantees it
            // at write time). Guards only against pre-D15 legacy inconsistency
            // between room.branchId and matrix.branchId; skip rather than
            // return a cross-branch price.
            if (matrix && room.branchId && matrix.branchId && room.branchId !== matrix.branchId) {
                return none;
            }
            if (matrix) {
                const basePrice = parseFloat(matrix.basePrice as any);
                const supplementPerDay = matrix.acSupplementPerDay
                    ? parseFloat(matrix.acSupplementPerDay as any)
                    : null;
                const durationDays = matrix.package?.durationDays ?? 0;
                const acSupplement = (acRequired && supplementPerDay && durationDays)
                    ? supplementPerDay * durationDays
                    : null;
                const price = basePrice + (acSupplement ?? 0);
                return { price, basePrice, acSupplement, acSupplementPerDay: supplementPerDay, source: 'category_matrix' };
            }
        }

        return none;
    }

    async getRooms(clinicId: string, branchId?: string) {
        const where: any = { organisationId: clinicId };
        // Branch switcher (personal view filter) — rooms are a physical asset
        // (D14), not part of the patientVisibility policy, so a strict match
        // is correct here (no BranchVisibilityService involved).
        if (branchId) where.branchId = branchId;
        const rooms = await this.roomRepo.find({
            where,
            relations: ['roomCategory'],
            order: { roomNumber: 'ASC' },
        });
        return rooms.map((r) => ({
            ...r,
            roomCategoryId: r.roomCategoryId ?? null,
            roomCategory: r.roomCategory?.name ?? null,
        }));
    }

    // Rooms that are free for the given date range — reuses the unified conflict
    // check (admissions + bookings + maintenance). Powers the date-aware room
    // selector in the booking form, so reception only sees what they can book.
    async getAvailableRooms(clinicId: string, checkInDate: string, checkOutDate: string, branchId?: string) {
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            throw new BadRequestException('Valid check-in and check-out dates are required');
        }
        if (checkOut <= checkIn) {
            throw new BadRequestException('Check-out date must be after check-in date');
        }

        const where: any = { organisationId: clinicId };
        // Branch switcher (personal view filter) — same strict-match pattern as
        // getRooms() above; rooms are D14, not D15, so this narrows the search
        // rather than enforcing ownership.
        if (branchId) where.branchId = branchId;
        const rooms = await this.roomRepo.find({
            where,
            relations: ['roomCategory'],
            order: { roomNumber: 'ASC' },
        });
        const manager = this.dataSource.manager;
        const checked = await Promise.all(
            rooms.map(async (room) => {
                const block = await this.isRoomBlocked(manager, room, checkIn, checkOut);
                return block.blocked ? null : room;
            }),
        );
        return checked
            .filter((r): r is Room => r !== null)
            .map((r) => ({ ...r, roomCategory: r.roomCategory?.name ?? null }));
    }

    // Operational "Today" worklist for reception: arrivals, departures, outstanding
    // holds, and leads awaiting follow-up. Returns the actual items so that tile
    // counts (.length) and detail sheets are derived from exactly the same dataset —
    // one IST timezone calculation, one filtering implementation, zero drift.
    async getTodaySummary(clinicId: string, userId?: string, userRole?: string, branchId?: string) {
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(Date.now() + IST_OFFSET_MS);
        const y = istNow.getUTCFullYear();
        const m = istNow.getUTCMonth();
        const d = istNow.getUTCDate();
        const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MS);
        const endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS);

        // ADR-004 D9/Phase 4 branch scoping — every other booking/admission read in
        // this file (getBookings, getAdmissions) applies this; this endpoint never
        // did, so Arrivals/Departures/Holds always mixed every branch together
        // regardless of who was asking or which branch the switcher had selected.
        // Enquiries (followUps) have no branch column — they predate a branch pick —
        // so they deliberately stay org-wide.
        // Branch scoping v2: shared scope, then the switcher (Q1 — no NULL rows for restricted staff).
        const branchWhere = this.branchVisibilityService.branchFindCondition(
            await this.scopeFor(userId, userRole, clinicId),
            branchId,
        );

        const arrivalsWhere: any = {
            organisationId: clinicId,
            status: In([BookingStatus.HELD, BookingStatus.CONFIRMED]),
            checkInDate: Between(startUtc, endUtc),
        };
        const departuresWhere: any = {
            organisationId: clinicId,
            status: AdmissionStatus.ACTIVE,
            expectedCheckOutDate: Between(startUtc, endUtc),
        };
        const holdsWhere: any = { organisationId: clinicId, status: BookingStatus.HELD };
        if (branchWhere !== undefined) {
            arrivalsWhere.branchId = branchWhere;
            departuresWhere.branchId = branchWhere;
            holdsWhere.branchId = branchWhere;
        }

        const [arrivals, departures, holds, followUps] = await Promise.all([
            this.bookingRepo.find({
                where: arrivalsWhere,
                relations: ['patient', 'room', 'treatmentPackage'],
                order: { checkInDate: 'ASC' },
            }),
            this.admissionRepo.find({
                where: departuresWhere,
                relations: ['patient', 'room', 'treatmentPackage'],
                order: { expectedCheckOutDate: 'ASC' },
            }),
            this.bookingRepo.find({
                where: holdsWhere,
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

    async createRoom(clinicId: string, data: { roomNumber: string; floor?: string; roomCategoryId?: string; capacity?: number; amenities?: string[]; description?: string; branchId?: string }) {
        let cat: RoomCategory | null = null;
        if (data.roomCategoryId) {
            cat = await this.categoryRepo.findOne({ where: { id: data.roomCategoryId, organisationId: clinicId } });
            if (!cat) throw new NotFoundException('Room category not found');
        }
        // ADR-004 D14 — a room is a physical asset that exists in exactly one
        // location; the column existed since D14 but was never actually
        // validated/set anywhere until now.
        if (data.branchId) {
            const branch = await this.dataSource.manager.findOne(Branch, {
                where: { id: data.branchId, organisationId: clinicId },
            });
            if (!branch) throw new NotFoundException('Branch not found in this organisation');
        }
        // ADR-004 D15 — a categorized room must agree with its own category's
        // branch. Only checked when both sides actually carry a branch; a
        // room's own branchId stays optional (D14), so a branch-less room
        // isn't forced into this check.
        if (cat && data.branchId) {
            this.assertSameBranch({ branchId: data.branchId }, cat, 'Room', 'Room category');
        }
        const room = this.roomRepo.create({
            roomNumber: data.roomNumber,
            floor: data.floor ?? null,
            description: data.description ?? null,
            roomCategoryId: data.roomCategoryId ?? null,
            capacity: data.capacity ?? null,
            amenities: data.amenities ?? null,
            organisationId: clinicId,
            branchId: data.branchId ?? null,
        });
        const saved = await this.roomRepo.save(room);
        return { ...saved, roomCategory: cat?.name ?? null };
    }

    async updateRoom(clinicId: string, id: string, data: { roomNumber?: string; floor?: string; roomCategoryId?: string; capacity?: number; amenities?: string[]; description?: string; status?: string; branchId?: string | null }) {
        const room = await this.roomRepo.findOne({ where: { id, organisationId: clinicId } });
        if (!room) throw new NotFoundException('Room not found');
        // D14 — apply a branchId change first, so the category cross-check
        // below (if both are changing in the same request) validates against
        // the room's new branch, not its stale one.
        if (data.branchId !== undefined && data.branchId !== room.branchId) {
            if (data.branchId) await this.assertBranchOwnership(clinicId, data.branchId);
            room.branchId = data.branchId || null;
        }
        if (data.roomCategoryId !== undefined) {
            if (data.roomCategoryId) {
                const cat = await this.categoryRepo.findOne({ where: { id: data.roomCategoryId, organisationId: clinicId } });
                if (!cat) throw new NotFoundException('Room category not found');
                // ADR-004 D15 — see createRoom's identical comment.
                if (room.branchId) {
                    this.assertSameBranch(room, cat, 'Room', 'Room category');
                }
            }
            room.roomCategoryId = data.roomCategoryId || null;
        }
        if (data.roomNumber !== undefined) room.roomNumber = data.roomNumber;
        if (data.floor !== undefined) room.floor = data.floor || null;
        if (data.description !== undefined) room.description = data.description || null;
        if (data.capacity !== undefined) room.capacity = data.capacity ?? null;
        if (data.amenities !== undefined) room.amenities = data.amenities ?? null;
        if (data.status !== undefined) room.status = data.status as RoomStatus;
        const saved = await this.roomRepo.save(room);
        const cat = saved.roomCategoryId ? await this.categoryRepo.findOne({ where: { id: saved.roomCategoryId } }) : null;
        return { ...saved, roomCategory: cat?.name ?? null };
    }

    async deleteRoom(clinicId: string, id: string) {
        const room = await this.roomRepo.findOne({ where: { id, organisationId: clinicId } });
        if (!room) throw new NotFoundException('Room not found');
        await this.roomRepo.softDelete(room.id);
    }

    // --- PACKAGES ---
    async getPackages(clinicId: string, branchId?: string) {
        // ADR-004 D15 — see getRoomCategories() comment.
        const where = branchId
            ? [{ organisationId: clinicId, branchId }, { organisationId: clinicId, branchId: IsNull() }]
            : { organisationId: clinicId };
        return this.packageRepo.find({
            where,
            order: { durationDays: 'ASC' },
        });
    }

    async createPackage(clinicId: string, data: Partial<TreatmentPackage> & { branchId: string }) {
        await this.assertBranchOwnership(clinicId, data.branchId);
        const pkg = this.packageRepo.create({ ...data, organisationId: clinicId });
        return this.packageRepo.save(pkg);
    }

    async getAdmission(clinicId: string, id: string, userId?: string, userRole?: string) {
        const admission = await this.admissionRepo.findOne({
            where: { id, organisationId: clinicId },
            relations: ['patient', 'room', 'treatmentPackage'],
        });
        if (!admission) throw new NotFoundException('Admission not found');
        // Branch scoping v2: 404 outside the caller's scope (Q1, Q2).
        this.branchVisibilityService.assertBranchAccess(
            await this.scopeFor(userId, userRole, clinicId),
            admission.branchId,
            'Admission not found',
        );

        return admission;
    }

    async updatePackage(clinicId: string, id: string, data: Partial<TreatmentPackage>) {
        const pkg = await this.packageRepo.findOne({ where: { id, organisationId: clinicId } });
        if (!pkg) throw new NotFoundException('Package not found');
        // ADR-004 D15 — this is also how a legacy NULL-branch row gets resolved.
        if (data.branchId !== undefined && data.branchId !== pkg.branchId) {
            if (data.branchId) await this.assertBranchOwnership(clinicId, data.branchId);
        }
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
    async getAdmissions(clinicId: string, userId?: string, params?: { patientId?: string; status?: string; branchId?: string }, userRole?: string) {
        const where: any = { organisationId: clinicId };
        if (params?.patientId) where.patientId = params.patientId;
        if (params?.status) where.status = params.status;
        else where.status = AdmissionStatus.ACTIVE;

        // Branch scoping v2: shared scope, then the switcher's selection.
        const branchCond = this.branchVisibilityService.branchFindCondition(
            await this.scopeFor(userId, userRole, clinicId),
            params?.branchId,
        );
        if (branchCond) where.branchId = branchCond;

        return this.admissionRepo.find({
            where,
            relations: ['patient', 'room', 'treatmentPackage'],
            order: { checkInDate: 'DESC' },
        });
    }

    // Dashboard stats: current ward occupancy + today's admits/discharges.
    // "Today" is the IST calendar day (clinics operate in India) expressed as a UTC range.
    async getAdmissionStats(clinicId: string, userId?: string, userRole?: string, branchId?: string) {
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(Date.now() + IST_OFFSET_MS);
        const y = istNow.getUTCFullYear();
        const m = istNow.getUTCMonth();
        const d = istNow.getUTCDate();
        const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MS);
        const endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS);

        // ADR-004 D9/Phase 4 visibility, composed with the branch switcher's
        // strict narrowing — same pattern as getAdmissions().
        const branchCond = this.branchVisibilityService.branchFindCondition(
            await this.scopeFor(userId, userRole, clinicId),
            branchId,
        );
        const branchWhere: any = branchCond ? { branchId: branchCond } : {};

        const [currentInpatients, admitsToday, dischargesToday] = await Promise.all([
            this.admissionRepo.count({
                where: { organisationId: clinicId, status: AdmissionStatus.ACTIVE, ...branchWhere },
            }),
            this.admissionRepo.count({
                where: { organisationId: clinicId, checkInDate: Between(startUtc, endUtc), ...branchWhere },
            }),
            this.admissionRepo.count({
                where: {
                    organisationId: clinicId,
                    status: AdmissionStatus.DISCHARGED,
                    actualCheckOutDate: Between(startUtc, endUtc),
                    ...branchWhere,
                },
            }),
        ]);

        return { currentInpatients, admitsToday, dischargesToday };
    }

    async checkIn(
        clinicId: string,
        data: { patientId: string; roomId: string; packageId?: string; checkInDate?: Date; bookingId?: string; careProgram?: string; actualDeliveryDate?: string },
        performedBy?: string,
        performedByRole?: string,
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
            await this.assertPatientInOrg(clinicId, patientId, manager, performedBy, performedByRole);

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
            const effectivePkgId = packageId || linkedBooking?.packageId || null;
            let pkg: TreatmentPackage | null = null;
            if (effectivePkgId) {
                pkg = await manager.findOne(TreatmentPackage, { where: { id: effectivePkgId } });
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
            // ADR-004 D9/D14 — inherit from the booking if there is one, else from
            // the room's own branch (walk-in, no booking). Both may be NULL, which
            // is a valid, organisation-wide state.
            const branchId = linkedBooking?.branchId ?? room.branchId ?? null;
            const admission = manager.create(Admission, {
                organisationId: clinicId,
                patientId,
                roomId: targetRoomId,
                packageId: effectivePkgId,
                bookingId: linkedBooking?.id || null,
                checkInDate: start,
                expectedCheckOutDate: expectedCheckOut,
                status: AdmissionStatus.ACTIVE,
                careProgram,
                actualDeliveryDate: data.actualDeliveryDate || null,
                branchId,
            });
            room.status = RoomStatus.OCCUPIED;
            await manager.save(room);

            // Transition booking → FULFILLED if linked
            if (linkedBooking) {
                linkedBooking.status = BookingStatus.FULFILLED;
                await manager.save(linkedBooking);
            }

            const savedAdmission = await manager.save(admission);

            // 6. Auto-create a stay bill linked to this admission (ADR-003 Phase 2).
            //    Resolve pricing for line-item breakdown. resolvePrice() is read-only so
            //    calling it here (without the transaction manager) is safe.
            const acReq = linkedBooking?.acRequired ?? false;
            const priceInfo = effectivePkgId
                ? await this.resolvePrice(clinicId, targetRoomId, effectivePkgId, acReq)
                : { price: null, basePrice: null, acSupplement: null, acSupplementPerDay: null, source: 'manual' as const };

            const bookingTotal = linkedBooking ? parseFloat(String(linkedBooking.totalPrice ?? 0)) : 0;
            const advancePaid  = linkedBooking ? parseFloat(String(linkedBooking.advancePaid  ?? 0)) : 0;

            // Build accommodation line items
            type LineItem = { name: string; unitPrice: number };
            const lineItems: LineItem[] = [];
            if (priceInfo.price != null) {
                lineItems.push({
                    name: pkg ? `Accommodation — ${pkg.name}` : 'Accommodation',
                    unitPrice: priceInfo.basePrice ?? priceInfo.price,
                });
                if ((priceInfo.acSupplement ?? 0) > 0) {
                    const days = pkg?.durationDays ?? 0;
                    lineItems.push({
                        name: `AC Supplement${days && priceInfo.acSupplementPerDay ? ` (${days} days × ₹${priceInfo.acSupplementPerDay}/day)` : ''}`,
                        unitPrice: priceInfo.acSupplement!,
                    });
                }
            } else if (bookingTotal > 0) {
                // Pricing not resolvable but booking has a confirmed total — single line item
                lineItems.push({
                    name: pkg ? `Accommodation — ${pkg.name}` : 'Accommodation',
                    unitPrice: bookingTotal,
                });
            }

            // Bill + BillItem[] + first ledger payment (ADR-003 Phase 2) — built by
            // PatientBillingService so bill construction has one owner, inside this
            // same locked transaction (see Payment_Wiring_Implementation_Plan.md Phase A).
            const bill = await this.patientBillingService.buildBillFromBooking(manager, {
                organisationId: clinicId,
                patientId,
                bookingId: linkedBooking?.id ?? null,
                admissionId: savedAdmission.id,
                lineItems,
                advancePaid,
                createdBy: performedBy ?? null,
                branchId,
            });

            // Cash tracking: the advance already in Patient advances becomes
            // income on this bill. A journal only: no cash moves at check-in.
            if (advancePaid > 0) {
                await this.advancePosting.postTransfer(
                    manager,
                    { organisationId: clinicId, admissionId: savedAdmission.id, billId: bill.id, branchId: branchId ?? null, amount: advancePaid },
                    { userId: performedBy as string, role: performedByRole ?? null },
                );
            }

            return { savedAdmission, room };
        });

        // Post-commit, best-effort: notify clinic doctors and managers about the new admission.
        // A notification failure is swallowed and never affects the committed admission.
        this.orgUserRepo
            .find({ where: { organisationId: clinicId, role: In(['DOCTOR', 'MANAGER', 'OWNER', 'ADMIN']), isActive: true } })
            .then(async (orgUsers) => {
                const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
                if (userIds.length > 0) {
                    const branchLabel = await this.getBranchLabel(savedAdmission.branchId);
                    this.notificationsService.sendToUsers({
                        userIds,
                        title: 'Patient Admitted',
                        body: `Room ${room.roomNumber}${branchLabel} — check-in on ${new Date(savedAdmission.checkInDate).toLocaleDateString()}`,
                        data: { admissionId: savedAdmission.id, type: 'patient_admitted' },
                    }).catch(() => {});
                }
            })
            .catch(() => {});

        return savedAdmission;
    }

    // "Mark Delivery Occurred" — record (or clear) the actual delivery date on an
    // admission. Postnatal third date (ADR-002 D10). Idempotent; date is a plain
    // calendar day 'YYYY-MM-DD'. Cannot be in the future.
    async recordDelivery(clinicId: string, admissionId: string, actualDeliveryDate: string | null) {
        const admission = await this.admissionRepo.findOne({
            where: { id: admissionId, organisationId: clinicId },
        });
        if (!admission) throw new NotFoundException('Admission not found');

        if (actualDeliveryDate) {
            const d = new Date(actualDeliveryDate);
            if (isNaN(d.getTime())) throw new BadRequestException('Invalid delivery date');
            // Compare calendar days in UTC; a future delivery date is not meaningful.
            const today = new Date(); today.setUTCHours(0, 0, 0, 0);
            if (d > today) throw new BadRequestException('Delivery date cannot be in the future');
            admission.actualDeliveryDate = actualDeliveryDate.slice(0, 10);
        } else {
            admission.actualDeliveryDate = null;
        }
        return this.admissionRepo.save(admission);
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
            .then(async (orgUsers) => {
                const userIds = orgUsers.map((ou) => ou.userId).filter(Boolean);
                if (userIds.length > 0) {
                    const roomInfo = admission.room ? ` from room ${admission.room.roomNumber}` : '';
                    const branchLabel = await this.getBranchLabel(saved.branchId);
                    this.notificationsService.sendToUsers({
                        userIds,
                        title: 'Patient Discharged',
                        body: `Patient discharged${roomInfo}${branchLabel}`,
                        data: { admissionId: saved.id, type: 'patient_discharged' },
                    }).catch(() => {});
                }
            })
            .catch(() => {});

        return saved;
    }

    // --- BOOKINGS ---
    async createBooking(clinicId: string, dto: CreateBookingDto, userId?: string, userRole?: string) {
        const { patientId, enquiryId, roomId, packageId, checkInDate, checkOutDate, advancePaid, notes, discountReason, acRequired = false } = dto;
        const initialAdvance = Number(advancePaid) || 0;

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
            const cashLive = !!(await this.advancePosting.liveFrom(manager, clinicId));
            if (cashLive && initialAdvance > 0 && !dto.advancePaymentMethod) {
                throw new BadRequestException('Say how the advance was paid (cash, UPI, card...) and where it was received');
            }
            // Patient ownership guard (when patientId provided)
            if (patientId) {
                await this.assertPatientInOrg(clinicId, patientId, manager, userId, userRole);
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

            // ADR-004 D9 — validated now even though nothing reads it until Phase 4.
            if (dto.branchId) {
                const branch = await manager.findOne(Branch, {
                    where: { id: dto.branchId, organisationId: clinicId },
                });
                if (!branch) throw new NotFoundException('Branch not found in this organisation');
            }

            // Unified conflict check across admissions + room status + bookings
            const block = await this.isRoomBlocked(manager, room, checkIn, checkOut);
            if (block.blocked) throw new ConflictException(this.blockMessage(block.reason));

            // Resolve suggested price from pricing matrix (ADR-002 D2 + D12)
            const resolved = await this.resolvePrice(clinicId, roomId, packageId, acRequired);
            const suggestedPrice = resolved.price;
            // Explicit totalPrice from DTO wins; fall back to matrix suggestion; fall back to 0
            const totalPrice = dto.totalPrice != null
                ? dto.totalPrice
                : (suggestedPrice ?? 0);

            const booking = manager.create(RoomBooking, {
                organisationId: clinicId,
                patientId: patientId || null,
                enquiryId: enquiryId || null,
                roomId,
                packageId: packageId || null,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                suggestedPrice,
                totalPrice,
                discountReason: discountReason || null,
                // Once cash tracking is live the initial advance is recorded as a
                // receipt below, which also sets advance_paid.
                advancePaid: cashLive ? 0 : initialAdvance,
                acRequired,
                status: BookingStatus.HELD,
                notes: notes || null,
                bookingDate: new Date(),
                // Default to the room's own branch when the caller doesn't specify one —
                // the room is the source of truth for which branch a stay belongs to.
                // Without this every booking saved branch_id = NULL, which the branch
                // switcher's strict `booking.branchId = :selectedBranchId` filter on the
                // list view can never match, so bookings silently vanished from the
                // Bookings List the moment a specific branch (not "All Locations") was
                // selected — even though the calendar's OR-NULL visibility check let
                // them still show there.
                branchId: dto.branchId || room.branchId || null,
            });
            const saved = await manager.save(booking);
            if (cashLive && initialAdvance > 0) {
                await this.insertAdvanceReceipt(manager, saved, {
                    amount: initialAdvance,
                    paymentMethod: dto.advancePaymentMethod!,
                    receivedIntoAccountId: dto.advanceReceivedIntoAccountId ?? null,
                    receivedAt: await organisationBusinessDate(manager, clinicId),
                    idempotencyKey: dto.advanceIdempotencyKey ?? null,
                }, { userId: userId as string, role: userRole ?? null });
                saved.advancePaid = initialAdvance;
            }
            return saved;
        });
    }

    async getBookings(clinicId: string, userId?: string, filters?: {
        status?: BookingStatus;
        roomId?: string;
        startDate?: string;
        endDate?: string;
        branchId?: string;
    }, userRole?: string) {
        try {
            const query = this.bookingRepo.createQueryBuilder('booking')
                .leftJoinAndSelect('booking.patient', 'patient')
                .leftJoinAndSelect('booking.enquiry', 'enquiry')
                .leftJoinAndSelect('booking.room', 'room')
                .leftJoinAndSelect('booking.treatmentPackage', 'package')
                .where('booking.organisationId = :organisationId', { organisationId: clinicId });

            // ADR-004 D9/Phase 4 — branch-level visibility, additive on top of the
            // organisation filter above, never a replacement for it.
            const scope = await this.scopeFor(userId, userRole, clinicId);
            this.branchVisibilityService.applyBranchScope(query, 'booking.branchId', scope);
            // Branch switcher — narrows after scope, never widens.
            this.branchVisibilityService.narrowToSelectedBranch(query, 'booking.branchId', filters?.branchId, scope);

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

    async getBookingById(clinicId: string, bookingId: string, userId?: string, userRole?: string) {
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId, organisationId: clinicId },
            relations: ['patient', 'enquiry', 'room', 'treatmentPackage'],
        });

        if (!booking) throw new NotFoundException('Booking not found');
        // Branch scoping v2: 404 outside the caller's scope (Q1, Q2).
        this.branchVisibilityService.assertBranchAccess(
            await this.scopeFor(userId, userRole, clinicId),
            booking.branchId,
            'Booking not found',
        );

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
            if (dto.totalPrice !== undefined) booking.totalPrice = dto.totalPrice;
            if (dto.advancePaid !== undefined && Number(dto.advancePaid) !== Number(booking.advancePaid)) {
                // Once cash tracking is live, advance_paid is kept from the advance
                // receipts; it changes only through Record advance / void / refund.
                if (await this.advancePosting.liveFrom(manager, clinicId)) {
                    throw new BadRequestException('Advances are recorded with "Record advance" once cash tracking is live');
                }
                booking.advancePaid = Number(dto.advancePaid);
            }
            if (dto.discountReason !== undefined) booking.discountReason = dto.discountReason;
            if (dto.acRequired !== undefined) booking.acRequired = dto.acRequired;
            if (dto.notes !== undefined) booking.notes = dto.notes;
            if (dto.branchId !== undefined && dto.branchId !== booking.branchId) {
                const branch = await manager.findOne(Branch, {
                    where: { id: dto.branchId, organisationId: clinicId },
                });
                if (!branch) throw new NotFoundException('Branch not found in this organisation');
                booking.branchId = dto.branchId;
            }

            return manager.save(booking);
        });
    }

    async cancelBooking(clinicId: string, bookingId: string) {
        // Load without relations — status check only needs the scalar columns.
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId, organisationId: clinicId },
        });
        if (!booking) throw new NotFoundException('Booking not found');

        if (booking.status === BookingStatus.FULFILLED) {
            throw new BadRequestException('Cannot cancel a booking that has already been fulfilled');
        }

        // Use update() so TypeORM only writes the status column — avoids save() serialising
        // loaded relation objects as null FKs on non-nullable columns (room_id).
        await this.bookingRepo.update({ id: bookingId }, { status: BookingStatus.CANCELLED });
        return { ...booking, status: BookingStatus.CANCELLED };
    }

    /**
     * Records the refund resolution for a CANCELLED booking's advance_paid.
     * See scope/Handoff_Blocker_Fixes_2026-09-16.md #1 -- previously there was
     * no refund feature at all, so a cancelled booking with any advance paid
     * was a permanent dead end (removeBooking() unconditionally blocked it).
     *
     * advance_paid is deliberately never mutated here -- it's a historical
     * snapshot of what the customer actually paid; refund_amount separately
     * records what was subsequently returned, which can be partial or full.
     * Exactly one refund record per booking (product decision) -- amount is
     * whatever the staff enters in a single action, not a ledger.
     *
     * Concurrency: pessimistic-write locks the booking row before re-checking
     * refundedAt, so two simultaneous requests for the same booking serialize
     * instead of racing -- the second sees the first's already-committed
     * refundedAt and correctly fails, rather than both recording a refund.
     */
    async recordRefund(clinicId: string, bookingId: string, userId: string, dto: RecordRefundDto) {
        return this.dataSource.manager.transaction(async (manager) => {
            const bookingRepo = manager.getRepository(RoomBooking);
            const booking = await bookingRepo.findOne({
                where: { id: bookingId, organisationId: clinicId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!booking) throw new NotFoundException('Booking not found');
            if (booking.status !== BookingStatus.CANCELLED) {
                throw new BadRequestException('Only a cancelled booking can have a refund recorded');
            }
            if (booking.refundedAt) {
                throw new BadRequestException('A refund has already been recorded for this booking');
            }

            // The DTO's @Min(0) already rejects a negative amount at the HTTP
            // boundary -- re-checked here too so the invariant holds for any
            // caller of this service method, not only ones that went through
            // the ValidationPipe.
            if (dto.amount < 0) {
                throw new BadRequestException('Refund amount cannot be negative');
            }

            const advancePaid = parseFloat(String(booking.advancePaid)) || 0;
            if (dto.amount > advancePaid) {
                throw new BadRequestException(
                    `Refund amount (₹${dto.amount}) cannot exceed the advance paid (₹${advancePaid})`,
                );
            }

            // Cash tracking: the refund leaves the chosen ledger (Payment Voucher).
            await this.advancePosting.postRefund(
                manager,
                { organisationId: clinicId, bookingId: booking.id, branchId: booking.branchId ?? null, amount: dto.amount, method: dto.method, paidFromAccountId: dto.paidFromAccountId ?? null },
                { userId },
            );

            booking.refundAmount = dto.amount;
            booking.refundMethod = dto.method;
            booking.refundNote = dto.note?.trim() || null;
            booking.refundedBy = userId;
            booking.refundedAt = new Date();

            return bookingRepo.save(booking);
        });
    }

    // ── Booking advances (Cash MVP batch 1) ─────────────────────────────────
    // Each advance is its own receipt row (the voucher's source). The row is
    // idempotent per submit key; advance_paid is kept in step with the live rows
    // in the same transaction. Vouchers post only once cash tracking is live.

    private async insertAdvanceReceipt(
        manager: EntityManager,
        booking: RoomBooking,
        input: { amount: number; paymentMethod: string; receivedIntoAccountId: string | null; receivedAt: string; referenceNo?: string | null; notes?: string | null; idempotencyKey: string | null },
        actor: { userId: string; role?: string | null },
    ) {
        if (input.idempotencyKey) {
            const [prior] = await manager.query(
                `SELECT id FROM booking_advance_receipts WHERE booking_id = $1 AND idempotency_key = $2`,
                [booking.id, input.idempotencyKey],
            );
            if (prior) return { id: prior.id, replayed: true };
        }
        let row: { id: string; received_at: string };
        try {
            [row] = await manager.query(
                `INSERT INTO booking_advance_receipts
                   (organisation_id, booking_id, amount, received_at, payment_method, reference_no,
                    received_into_account_id, notes, created_by, idempotency_key)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                 RETURNING id, to_char(received_at, 'YYYY-MM-DD') AS received_at`,
                [booking.organisationId, booking.id, input.amount.toFixed(2), input.receivedAt, input.paymentMethod,
                 input.referenceNo ?? null, input.receivedIntoAccountId, input.notes ?? null, actor.userId, input.idempotencyKey],
            );
        } catch (err: any) {
            if (err?.code === '23505' && err?.constraint === 'uq_booking_advance_receipts_idem') {
                throw new ConflictException('This advance has already been recorded');
            }
            if (err?.code === '23503') throw new NotFoundException('Ledger not found in this organisation');
            throw err;
        }
        await manager.query(
            `UPDATE room_bookings SET advance_paid = advance_paid + $2 WHERE id = $1`,
            [booking.id, input.amount.toFixed(2)],
        );
        const voucher = await this.advancePosting.postReceipt(
            manager,
            { id: row.id, organisationId: booking.organisationId, bookingId: booking.id, amount: input.amount, receivedAt: row.received_at,
              paymentMethod: input.paymentMethod, receivedIntoAccountId: input.receivedIntoAccountId, referenceNo: input.referenceNo },
            { branchId: booking.branchId ?? null },
            actor,
        );
        return { id: row.id, replayed: false, voucher };
    }

    private async lockOpenBooking(manager: EntityManager, clinicId: string, bookingId: string) {
        const booking = await manager.findOne(RoomBooking, {
            where: { id: bookingId, organisationId: clinicId },
            lock: { mode: 'pessimistic_write' },
        });
        if (!booking) throw new NotFoundException('Booking not found');
        if (booking.status !== BookingStatus.HELD && booking.status !== BookingStatus.CONFIRMED) {
            throw new BadRequestException('Advances can only change on a held or confirmed booking');
        }
        return booking;
    }

    async recordAdvance(clinicId: string, bookingId: string, dto: RecordAdvanceDto, userId: string, userRole?: string) {
        return this.dataSource.transaction(async (manager) => {
            const booking = await this.lockOpenBooking(manager, clinicId, bookingId);
            const receivedAt = dto.receivedAt ? dto.receivedAt.slice(0, 10) : await organisationBusinessDate(manager, clinicId);
            const result = await this.insertAdvanceReceipt(manager, booking, {
                amount: dto.amount,
                paymentMethod: dto.paymentMethod,
                receivedIntoAccountId: dto.receivedIntoAccountId ?? null,
                receivedAt,
                referenceNo: dto.referenceNo ?? null,
                notes: dto.notes ?? null,
                idempotencyKey: dto.idempotencyKey ?? null,
            }, { userId, role: userRole ?? null });
            const [b] = await manager.query(`SELECT advance_paid FROM room_bookings WHERE id = $1`, [bookingId]);
            return { receiptId: result.id, replayed: result.replayed, advancePaid: Number(b.advance_paid) };
        });
    }

    async listAdvances(clinicId: string, bookingId: string) {
        const booking = await this.bookingRepo.findOne({ where: { id: bookingId, organisationId: clinicId } });
        if (!booking) throw new NotFoundException('Booking not found');
        return this.dataSource.query(
            `SELECT r.id, r.amount, to_char(r.received_at, 'YYYY-MM-DD') AS "receivedAt", r.payment_method AS "paymentMethod",
                    r.reference_no AS "referenceNo", r.notes, a.name AS "receivedInto", r.deleted_at IS NOT NULL AS voided, r.created_at AS "createdAt"
               FROM booking_advance_receipts r LEFT JOIN accounts a ON a.id = r.received_into_account_id
              WHERE r.booking_id = $1 AND r.organisation_id = $2
              ORDER BY r.created_at DESC`,
            [bookingId, clinicId],
        );
    }

    async voidAdvance(clinicId: string, bookingId: string, receiptId: string, userId: string, userRole?: string) {
        return this.dataSource.transaction(async (manager) => {
            await this.lockOpenBooking(manager, clinicId, bookingId);
            const [receipt] = await manager.query(
                `SELECT id, amount FROM booking_advance_receipts
                  WHERE id = $1 AND booking_id = $2 AND organisation_id = $3 AND deleted_at IS NULL FOR UPDATE`,
                [receiptId, bookingId, clinicId],
            );
            if (!receipt) throw new NotFoundException('Advance not found');
            await manager.query(`UPDATE booking_advance_receipts SET deleted_at = now() WHERE id = $1`, [receiptId]);
            // (A plain UPDATE then SELECT: TypeORM's query() returns [rows, count]
            // for UPDATE ... RETURNING, not the rows.)
            await manager.query(
                `UPDATE room_bookings SET advance_paid = advance_paid - $2 WHERE id = $1`,
                [bookingId, receipt.amount],
            );
            const [b] = await manager.query(`SELECT advance_paid FROM room_bookings WHERE id = $1`, [bookingId]);
            if (Number(b.advance_paid) < 0) throw new BadRequestException('Advance total would go below zero');
            // Reverse its Receipt Voucher, if it had one; the original is never changed.
            await this.advancePosting.reverseReceipt(manager, clinicId, receiptId, { userId, role: userRole ?? null });
            return { advancePaid: Number(b.advance_paid) };
        });
    }

    async removeBooking(clinicId: string, bookingId: string) {
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId, organisationId: clinicId },
        });
        if (!booking) throw new NotFoundException('Booking not found');
        if (booking.status !== BookingStatus.CANCELLED) {
            throw new BadRequestException('Only cancelled bookings can be removed');
        }
        // A refund record (even for ₹0 or a partial amount) is what resolves
        // the advance -- advance_paid itself is never cleared, so checking it
        // alone would stay permanently blocked. See recordRefund() above.
        if (booking.advancePaid && parseFloat(String(booking.advancePaid)) > 0 && !booking.refundedAt) {
            throw new BadRequestException('Refund the advance payment before removing this booking');
        }
        await this.bookingRepo.softDelete({ id: bookingId });
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

    async getCalendarData(clinicId: string, startDate: string, endDate: string, userId?: string, userRole?: string) {
        const bookings = await this.getBookings(clinicId, userId, { startDate, endDate }, userRole);
        const rooms = await this.getRooms(clinicId);

        // Get current admissions (occupied rooms)
        const admissions = await this.getAdmissions(clinicId, userId, undefined, userRole);

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

    // ── Branch scoping v2 (scope/Branch_Scoping_Remediation_Plan_2026-09-24.md) ──

    private scopeFor(userId: string | undefined, userRole: string | undefined, clinicId: string) {
        return this.branchVisibilityService.scopeFor({ userId, role: userRole, organisationId: clinicId });
    }

    // Guards for every action on one booking / admission (G2, G3): the record
    // must be in the organisation and inside the caller's branch scope, else
    // 404 — never "the list was filtered, so the id must be fine".
    async assertBookingAccess(clinicId: string, bookingId: string, user: { userId?: string; role?: string }) {
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId, organisationId: clinicId },
            select: ['id', 'branchId'],
        });
        if (!booking) throw new NotFoundException('Booking not found');
        this.branchVisibilityService.assertBranchAccess(
            await this.scopeFor(user.userId, user.role, clinicId),
            booking.branchId,
            'Booking not found',
        );
    }

    async assertAdmissionAccess(clinicId: string, admissionId: string, user: { userId?: string; role?: string }) {
        const admission = await this.admissionRepo.findOne({
            where: { id: admissionId, organisationId: clinicId },
            select: ['id', 'branchId'],
        });
        if (!admission) throw new NotFoundException('Admission not found');
        this.branchVisibilityService.assertBranchAccess(
            await this.scopeFor(user.userId, user.role, clinicId),
            admission.branchId,
            'Admission not found',
        );
    }

    // ── Phase 0 safety helpers ──────────────────────────────────────────────

    // Cross-tenant guard: the patient must belong to this organisation. Soft-deleted
    // patients are auto-excluded by the @DeleteDateColumn on `patients`.
    private async assertPatientInOrg(
        clinicId: string,
        patientId: string,
        manager?: EntityManager,
        userId?: string,
        userRole?: string,
    ): Promise<void> {
        // Branch scoping v2 (G11): the patient must be in the organisation and
        // inside the caller's branch scope — 404 otherwise, NULL-branch
        // patients excluded for restricted staff (Q1, Q2).
        const scope = await this.branchVisibilityService.scopeFor({ userId, role: userRole, organisationId: clinicId });
        await this.branchVisibilityService.assertPatientAccess(scope, clinicId, patientId, manager);
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
            expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
            additionalInfo: dto.additionalInfo ?? null,
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
        if (dto.expectedDeliveryDate !== undefined) enquiry.expectedDeliveryDate = dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null;
        if (dto.additionalInfo !== undefined) enquiry.additionalInfo = dto.additionalInfo ?? null;

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

            const acRequired = dto.acRequired ?? false;
            const resolved = await this.resolvePrice(clinicId, dto.roomId, dto.packageId, acRequired);
            const suggestedPrice = resolved.price;
            const totalPrice = dto.totalPrice != null ? dto.totalPrice : (suggestedPrice ?? 0);

            const booking = manager.create(RoomBooking, {
                organisationId: clinicId,
                enquiryId,
                patientId: null,
                roomId: dto.roomId,
                packageId: dto.packageId || null,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                suggestedPrice,
                totalPrice,
                discountReason: dto.discountReason || null,
                advancePaid: 0,
                acRequired,
                status: BookingStatus.HELD,
                notes: dto.notes || null,
                bookingDate: new Date(),
            });
            return manager.save(booking);
        });
    }

    // Links the booking to a patient (booking.patient_id only). Phone is a
    // contact attribute, not identity -- several patients can share one -- so
    // this never picks an existing patient by phone. The receptionist either
    // chose one (opts.patientId, must be visible to them) or asked for a new
    // one (opts.createNew). With neither, a new patient is created only when
    // no visible patient shares the enquiry phone; otherwise 409 so the app
    // shows the choice instead of guessing.
    async promoteEnquiry(
        clinicId: string,
        bookingId: string,
        performedBy?: string,
        opts: { role?: string; patientId?: string; createNew?: boolean } = {},
    ) {
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

            if (opts.patientId) {
                const chosen = await this.patientsService.findVisibleById(
                    performedBy, opts.role, clinicId, opts.patientId, manager,
                );
                if (!chosen) throw new NotFoundException('Patient not found');
                // A patient belongs to one branch: a branch's booking links
                // only that branch's patients.
                if (booking.branchId && chosen.branchId !== booking.branchId) {
                    throw new BadRequestException('Patient is registered at another branch');
                }
                booking.patientId = chosen.id;
            } else {
                if (!opts.createNew) {
                    const matches = await this.patientsService.findVisibleByPhone(
                        performedBy, opts.role, clinicId, 'CLINIC', booking.enquiry.phone, manager,
                        booking.branchId,
                    );
                    if (matches.length > 0) {
                        throw new ConflictException(
                            `${matches.length} existing patient${matches.length === 1 ? '' : 's'} use${matches.length === 1 ? 's' : ''} this phone number. Choose the patient or create a new one.`,
                        );
                    }
                }

                const patientCode = await this.patientsService.generateNextPatientCode(clinicId, manager);
                const newPatient = manager.create(Patient, {
                    organisationId: clinicId,
                    patientCode,
                    firstName: booking.enquiry.contactName.split(' ')[0] || booking.enquiry.contactName,
                    lastName: booking.enquiry.contactName.split(' ').slice(1).join(' ') || '',
                    phone: booking.enquiry.phone,
                    gender: 'other' as any,
                    dateOfBirth: null,
                    createdBy: performedBy ?? null,
                    // Inherit the booking's own branch — without this the new patient
                    // saved branch_id = NULL, which the Patients list's strict
                    // `patient.branchId = :selectedBranchId` filter can never match,
                    // so promoted patients silently vanished from Patients the moment
                    // a specific branch (not "All Locations") was selected.
                    branchId: booking.branchId,
                });
                const saved = await manager.save(newPatient);
                booking.patientId = saved.id;

                // Second patient-creation path found in Phase 3 recon --
                // bypasses PatientsService.create() entirely, so needs its
                // own audit call. orgType is a literal here: this route is
                // gated by @RequireModule('booking') (ModuleGuard checks
                // ClinicCapabilities, a CLINIC-only table), so it's
                // unreachable by any non-CLINIC org -- verified, not
                // assumed. Uses the transaction already in scope even
                // though severity ('sensitive') doesn't strictly require
                // it -- free durability improvement, decision C.
                await this.auditService.record(
                    {
                        organisationId: clinicId,
                        branchId: saved.branchId,
                        orgType: 'CLINIC',
                        entityType: 'patient',
                        entityId: saved.id,
                        action: 'create',
                        severity: 'sensitive',
                        actorUserId: performedBy ?? null,
                        source: 'api',
                        metadata: { via: 'booking_promotion', bookingId },
                    },
                    manager,
                );
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

    // ── Export ────────────────────────────────────────────────────────────────

    async exportXlsx(orgId: string): Promise<Buffer> {
        const [categories, rooms, packages, pricing] = await Promise.all([
            this.categoryRepo.find({ where: { organisationId: orgId }, order: { name: 'ASC' } }),
            this.roomRepo.find({ where: { organisationId: orgId }, relations: ['roomCategory'], order: { roomNumber: 'ASC' } }),
            this.packageRepo.find({ where: { organisationId: orgId }, order: { name: 'ASC' } }),
            this.categoryPricingRepo.find({ where: { organisationId: orgId }, relations: ['roomCategory', 'package'] }),
        ]);

        const wb = XLSX.utils.book_new();

        // The leading "ID" column is the stable identity used on re-import so that
        // renaming a category/package/room updates the existing record instead of
        // creating a duplicate. Do not edit or delete the ID column.

        // Sheet 1 — Room Categories
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            categories.map(c => ({ ID: c.id, Name: c.name, Active: c.isActive ? 'Yes' : 'No' }))
        ), 'Room Categories');

        // Sheet 2 — Rooms
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            rooms.map(r => ({
                ID: r.id,
                'Room Number': r.roomNumber,
                Category: r.roomCategory?.name ?? '',
                Floor: r.floor ?? '',
                Capacity: r.capacity ?? '',
                'AC Available': r.amenities?.includes('AC_AVAILABLE') ? 'Yes' : 'No',
                'Other Amenities': (r.amenities ?? []).filter(a => a !== 'AC_AVAILABLE').join(', '),
                Description: r.description ?? '',
            }))
        ), 'Rooms');

        // Sheet 3 — Packages
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            packages.map(p => ({
                ID: p.id,
                Name: p.name,
                'Duration (Days)': p.durationDays,
                Description: p.description ?? '',
                Inclusions: (p.inclusions ?? []).join(', '),
            }))
        ), 'Packages');

        // Sheet 4 — Pricing Matrix (flat rows)
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            pricing.map(m => ({
                ID: m.id,
                Category: m.roomCategory?.name ?? '',
                Package: m.package?.name ?? '',
                'Base Price (₹)': parseFloat(m.basePrice as any),
                'AC Supplement ₹/day': m.acSupplementPerDay ? parseFloat(m.acSupplementPerDay as any) : '',
            }))
        ), 'Pricing Matrix');

        return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }

    // ── Import ────────────────────────────────────────────────────────────────

    // ADR-004 D15 — one branch per import. The person running an import already
    // knows which branch it's for; there's no safe way to guess per-row, and
    // this matches the "no automatic cross-branch guessing" rule the rest of
    // D15 follows. Existing rows that already belong to a DIFFERENT branch are
    // never silently reassigned — skipped and reported, same pattern this
    // importer already uses for other unresolvable rows.
    async importXlsx(orgId: string, buffer: Buffer, branchId: string, dryRun = false): Promise<{
        dryRun: boolean;
        categories: { created: number; updated: number; unchanged: number; skipped: string[] };
        rooms: { created: number; updated: number; unchanged: number; skipped: string[] };
        packages: { created: number; updated: number; unchanged: number; skipped: string[] };
        pricing: { created: number; updated: number; unchanged: number; skipped: string[] };
    }> {
        await this.assertBranchOwnership(orgId, branchId);
        const wb = XLSX.read(buffer, { type: 'buffer' });

        // Sentinel error used to roll back the transaction in dry-run (preview) mode.
        const DRY_RUN_ROLLBACK = Symbol('dry-run-rollback');

        const run = async (manager: EntityManager) => {
            const categoryRepo = manager.getRepository(RoomCategory);
            const roomRepo = manager.getRepository(Room);
            const packageRepo = manager.getRepository(TreatmentPackage);
            const pricingRepo = manager.getRepository(RoomCategoryPricing);

            const result = {
                dryRun,
                categories: { created: 0, updated: 0, unchanged: 0, skipped: [] as string[] },
                rooms: { created: 0, updated: 0, unchanged: 0, skipped: [] as string[] },
                packages: { created: 0, updated: 0, unchanged: 0, skipped: [] as string[] },
                pricing: { created: 0, updated: 0, unchanged: 0, skipped: [] as string[] },
            };

            // name→id maps, populated as we upsert. We register BOTH the previous and
            // the new name for each record so that a rename in one sheet still resolves
            // references in the linked sheets (rooms→category, pricing→category/package).
            const catNameToId = new Map<string, string>();
            const pkgNameToId = new Map<string, string>();
            const reg = (map: Map<string, string>, name: string | null | undefined, id: string) => {
                if (name) map.set(name.trim().toLowerCase(), id);
            };

            // Order-insensitive array equality (for amenities / inclusions) and a
            // numeric-aware equality so "90000.00" (decimal string from PG) === 90000.
            const arrEq = (a: any[] | null | undefined, b: any[] | null | undefined) => {
                const x = [...(a ?? [])].map(String).sort();
                const y = [...(b ?? [])].map(String).sort();
                return x.length === y.length && x.every((v, i) => v === y[i]);
            };
            const numEq = (a: any, b: any) => {
                if (a == null && b == null) return true;
                if (a == null || b == null) return false;
                return parseFloat(a as any) === parseFloat(b as any);
            };
            // Empty string and null are equivalent for nullable text columns — the DB
            // may hold '' where the import normalises blanks to null (and vice versa).
            const strEq = (a: any, b: any) => (a ?? '') === (b ?? '');

            // ── 1. Room Categories ──────────────────────────────────────────
            const catSheet = wb.Sheets['Room Categories'];
            if (catSheet) {
                const rows: any[] = XLSX.utils.sheet_to_json(catSheet);
                for (const row of rows) {
                    const id = String(row['ID'] ?? '').trim();
                    const name = String(row['Name'] ?? '').trim();
                    if (!name) continue;
                    const isActive = String(row['Active'] ?? 'Yes').trim().toLowerCase() !== 'no';

                    // Match by ID first (rename-safe), then by name.
                    let existing = id
                        ? await categoryRepo.findOne({ where: { id, organisationId: orgId } })
                        : null;
                    if (!existing) existing = await categoryRepo.findOne({ where: { organisationId: orgId, name } });

                    // ADR-004 D15 — never silently move a category to a
                    // different branch via import.
                    if (existing && existing.branchId && existing.branchId !== branchId) {
                        result.categories.skipped.push(`"${name}" belongs to a different branch`);
                        continue;
                    }

                    if (existing) {
                        reg(catNameToId, existing.name, existing.id); // old name still resolves
                        const changed = existing.name !== name || existing.isActive !== isActive || existing.branchId !== branchId;
                        if (changed) {
                            existing.name = name;
                            existing.isActive = isActive;
                            existing.branchId = branchId; // backfills legacy NULL rows too
                            await categoryRepo.save(existing);
                            result.categories.updated++;
                        } else {
                            result.categories.unchanged++;
                        }
                        reg(catNameToId, name, existing.id);          // new name resolves too
                    } else {
                        const created = await categoryRepo.save(categoryRepo.create({ organisationId: orgId, name, isActive, branchId }));
                        reg(catNameToId, name, created.id);
                        result.categories.created++;
                    }
                }
            }
            // Seed maps with any categories not present in the sheet, so linked sheets still
            // resolve — scoped to this import's branch only, per D15 (a category from a
            // different branch must never satisfy a name lookup for this import).
            for (const c of await categoryRepo.find({ where: { organisationId: orgId, branchId } })) reg(catNameToId, c.name, c.id);

            // ── 2. Packages (moved before rooms is unnecessary; rooms don't ref packages) ──
            const pkgSheet = wb.Sheets['Packages'];
            if (pkgSheet) {
                const rows: any[] = XLSX.utils.sheet_to_json(pkgSheet);
                for (const row of rows) {
                    const id = String(row['ID'] ?? '').trim();
                    const name = String(row['Name'] ?? '').trim();
                    if (!name) continue;
                    const durationDays = parseInt(String(row['Duration (Days)'] ?? '1'), 10) || 1;
                    const inclusions = String(row['Inclusions'] ?? '').split(',').map(s => s.trim()).filter(Boolean);
                    const description = String(row['Description'] ?? '').trim() || null;

                    let existing = id
                        ? await packageRepo.findOne({ where: { id, organisationId: orgId } })
                        : null;
                    if (!existing) existing = await packageRepo.findOne({ where: { organisationId: orgId, name } });

                    // ADR-004 D15 — never silently move a package to a
                    // different branch via import.
                    if (existing && existing.branchId && existing.branchId !== branchId) {
                        result.packages.skipped.push(`"${name}" belongs to a different branch`);
                        continue;
                    }

                    if (existing) {
                        reg(pkgNameToId, existing.name, existing.id);
                        const newInclusions = inclusions.length ? inclusions : null;
                        const changed = existing.name !== name
                            || existing.durationDays !== durationDays
                            || !strEq(existing.description, description)
                            || !arrEq(existing.inclusions, newInclusions)
                            || existing.branchId !== branchId;
                        if (changed) {
                            existing.name = name;
                            existing.durationDays = durationDays;
                            existing.description = description;
                            existing.inclusions = newInclusions;
                            existing.branchId = branchId; // backfills legacy NULL rows too
                            await packageRepo.save(existing);
                            result.packages.updated++;
                        } else {
                            result.packages.unchanged++;
                        }
                        reg(pkgNameToId, name, existing.id);
                    } else {
                        const created = await packageRepo.save(packageRepo.create({
                            organisationId: orgId, name, durationDays, description,
                            inclusions: inclusions.length ? inclusions : null,
                            branchId,
                        }));
                        reg(pkgNameToId, name, created.id);
                        result.packages.created++;
                    }
                }
            }
            for (const p of await packageRepo.find({ where: { organisationId: orgId, branchId } })) reg(pkgNameToId, p.name, p.id);

            // ── 3. Rooms ────────────────────────────────────────────────────
            const roomSheet = wb.Sheets['Rooms'];
            if (roomSheet) {
                const rows: any[] = XLSX.utils.sheet_to_json(roomSheet);
                for (const row of rows) {
                    const id = String(row['ID'] ?? '').trim();
                    const roomNumber = String(row['Room Number'] ?? '').trim();
                    if (!roomNumber) continue;

                    const catName = String(row['Category'] ?? '').trim();
                    const roomCategoryId = catName ? (catNameToId.get(catName.toLowerCase()) ?? null) : null;
                    if (catName && !roomCategoryId) {
                        result.rooms.skipped.push(`${roomNumber}: category "${catName}" not found`);
                        continue;
                    }

                    const hasAc = String(row['AC Available'] ?? 'No').trim().toLowerCase() === 'yes';
                    const otherAmenities = String(row['Other Amenities'] ?? '').split(',').map(s => s.trim()).filter(Boolean);
                    const amenities = hasAc ? ['AC_AVAILABLE', ...otherAmenities] : otherAmenities;

                    let existing = id
                        ? await roomRepo.findOne({ where: { id, organisationId: orgId } })
                        : null;
                    if (!existing) existing = await roomRepo.findOne({ where: { organisationId: orgId, roomNumber } });

                    // D14 — a room's own branchId stays optional, but never
                    // silently move an already-branch-assigned room via import.
                    if (existing && existing.branchId && existing.branchId !== branchId) {
                        result.rooms.skipped.push(`${roomNumber}: room belongs to a different branch`);
                        continue;
                    }

                    const data = {
                        organisationId: orgId,
                        roomNumber,
                        roomCategoryId,
                        floor: String(row['Floor'] ?? '').trim() || null,
                        capacity: row['Capacity'] ? parseInt(String(row['Capacity']), 10) : null,
                        amenities,
                        description: String(row['Description'] ?? '').trim() || null,
                        branchId,
                    };
                    if (existing) {
                        const changed = existing.roomNumber !== data.roomNumber
                            || (existing.roomCategoryId ?? null) !== data.roomCategoryId
                            || !strEq(existing.floor, data.floor)
                            || (existing.capacity ?? null) !== data.capacity
                            || !strEq(existing.description, data.description)
                            || !arrEq(existing.amenities, data.amenities)
                            || existing.branchId !== branchId;
                        if (changed) {
                            await roomRepo.save({ ...existing, ...data });
                            result.rooms.updated++;
                        } else {
                            result.rooms.unchanged++;
                        }
                    } else {
                        await roomRepo.save(roomRepo.create(data));
                        result.rooms.created++;
                    }
                }
            }

            // ── 4. Pricing Matrix ────────────────────────────────────────────
            const priceSheet = wb.Sheets['Pricing Matrix'];
            if (priceSheet) {
                const rows: any[] = XLSX.utils.sheet_to_json(priceSheet);
                for (const row of rows) {
                    const id = String(row['ID'] ?? '').trim();
                    const catName = String(row['Category'] ?? '').trim();
                    const pkgName = String(row['Package'] ?? '').trim();

                    const basePrice = parseFloat(String(row['Base Price (₹)'] ?? '0'));
                    const acRaw = String(row['AC Supplement ₹/day'] ?? '').trim();
                    const acSupplementPerDay = acRaw && !isNaN(parseFloat(acRaw)) ? parseFloat(acRaw) : null;

                    // Match by ID first — lets a row's category/package/price change without
                    // creating a duplicate. Fall back to (category, package) name pair.
                    let existing = id
                        ? await pricingRepo.findOne({ where: { id, organisationId: orgId } })
                        : null;

                    // ADR-004 D15 — never silently move a pricing entry to a
                    // different branch via import.
                    if (existing && existing.branchId && existing.branchId !== branchId) {
                        result.pricing.skipped.push(`${catName || 'row'} × ${pkgName || ''}: belongs to a different branch`);
                        continue;
                    }

                    // catNameToId/pkgNameToId are already scoped to this import's
                    // branch (seeded above with `branchId` in the where clause),
                    // so anything resolved here is guaranteed same-branch — no
                    // separate assertSameBranch call needed.
                    const roomCategoryId = catName ? catNameToId.get(catName.toLowerCase()) : undefined;
                    const packageId = pkgName ? pkgNameToId.get(pkgName.toLowerCase()) : undefined;

                    if (!existing) {
                        if (!catName || !pkgName) continue;
                        if (!roomCategoryId) { result.pricing.skipped.push(`Category "${catName}" not found on this branch`); continue; }
                        if (!packageId) { result.pricing.skipped.push(`Package "${pkgName}" not found on this branch`); continue; }
                        existing = await pricingRepo.findOne({ where: { roomCategoryId, packageId } });
                    }

                    if (!basePrice || isNaN(basePrice)) {
                        result.pricing.skipped.push(`${catName || 'row'} × ${pkgName || ''}: invalid base price`);
                        continue;
                    }

                    if (existing) {
                        const changed = !numEq(existing.basePrice, basePrice)
                            || !numEq(existing.acSupplementPerDay, acSupplementPerDay)
                            || (roomCategoryId && existing.roomCategoryId !== roomCategoryId)
                            || (packageId && existing.packageId !== packageId)
                            || existing.branchId !== branchId;
                        if (changed) {
                            existing.basePrice = basePrice;
                            existing.acSupplementPerDay = acSupplementPerDay;
                            if (roomCategoryId) existing.roomCategoryId = roomCategoryId;
                            if (packageId) existing.packageId = packageId;
                            existing.branchId = branchId; // backfills legacy NULL rows too
                            await pricingRepo.save(existing);
                            result.pricing.updated++;
                        } else {
                            result.pricing.unchanged++;
                        }
                    } else {
                        if (!roomCategoryId || !packageId) {
                            result.pricing.skipped.push(`${catName || 'row'} × ${pkgName || ''}: cannot resolve category/package`);
                            continue;
                        }
                        await pricingRepo.save(pricingRepo.create({
                            organisationId: orgId, roomCategoryId, packageId, basePrice, acSupplementPerDay, branchId,
                        }));
                        result.pricing.created++;
                    }
                }
            }

            if (dryRun) {
                // Roll the transaction back: preview computed the exact counts a real
                // import would produce, but persists nothing.
                throw { [DRY_RUN_ROLLBACK]: true, result };
            }
            return result;
        };

        try {
            return await this.dataSource.transaction(run);
        } catch (e: any) {
            if (e && e[DRY_RUN_ROLLBACK]) return e.result;
            throw e;
        }
    }

    // ─── Custom Field Definitions ────────────────────────────────────────────

    async getFieldDefinitions(orgId: string): Promise<BookingFieldDefinition[]> {
        return this.fieldDefinitionRepo.find({
            where: { organisationId: orgId, isActive: true },
            order: { displayOrder: 'ASC', createdAt: 'ASC' },
        });
    }

    async createFieldDefinition(orgId: string, dto: CreateFieldDefinitionDto): Promise<BookingFieldDefinition> {
        const existing = await this.fieldDefinitionRepo.findOne({
            where: { organisationId: orgId, fieldKey: dto.fieldKey },
        });
        if (existing) throw new ConflictException(`field_key '${dto.fieldKey}' already exists for this organisation`);

        const def = this.fieldDefinitionRepo.create({
            organisationId: orgId,
            label: dto.label,
            fieldKey: dto.fieldKey,
            fieldType: dto.fieldType as any,
            required: dto.required ?? false,
            optionsJson: dto.options ?? null,
            displayOrder: dto.displayOrder ?? 0,
            isActive: true,
        });
        return this.fieldDefinitionRepo.save(def);
    }

    async updateFieldDefinition(orgId: string, id: string, dto: UpdateFieldDefinitionDto): Promise<BookingFieldDefinition> {
        const def = await this.fieldDefinitionRepo.findOne({ where: { id, organisationId: orgId } });
        if (!def) throw new NotFoundException('Field definition not found');

        if (dto.label !== undefined) def.label = dto.label;
        if (dto.fieldType !== undefined) def.fieldType = dto.fieldType as any;
        if (dto.required !== undefined) def.required = dto.required;
        if (dto.options !== undefined) def.optionsJson = dto.options ?? null;
        if (dto.displayOrder !== undefined) def.displayOrder = dto.displayOrder;
        if (dto.isActive !== undefined) def.isActive = dto.isActive;

        return this.fieldDefinitionRepo.save(def);
    }

    async deleteFieldDefinition(orgId: string, id: string): Promise<void> {
        const def = await this.fieldDefinitionRepo.findOne({ where: { id, organisationId: orgId } });
        if (!def) throw new NotFoundException('Field definition not found');
        def.isActive = false;
        await this.fieldDefinitionRepo.save(def);
    }

    // Branch identity travels with the event that owns it — an admission's
    // own branchId (set once at check-in from the booking/room, ADR-004
    // D9/D14), never re-derived from the room's *current* branch or
    // whoever is viewing the notification. NULL is a valid, organisation-
    // wide state, not an error — omit the label rather than guess.
    private async getBranchLabel(branchId: string | null | undefined): Promise<string> {
        if (!branchId) return '';
        const branch = await this.dataSource.getRepository('branches').findOne({ where: { id: branchId } });
        return (branch as any)?.name ? ` (${(branch as any).name})` : '';
    }
}
