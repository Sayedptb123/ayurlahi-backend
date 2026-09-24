import { ForbiddenException, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { RetreatService, rangesOverlap } from './retreat.service';
import { RoomStatus } from './entities/room.entity';
import { AdmissionStatus } from './entities/admission.entity';
import { BookingStatus, RefundMethod } from './entities/room-booking.entity';

// Day helper — epoch ms for 2026-06-DD (UTC), so overlap math reads like the docs.
const day = (d: number) => Date.UTC(2026, 5, d);
const date = (d: number) => new Date(day(d));

const makeRoom = (overrides: Partial<any> = {}) => ({
    id: 'room-1',
    organisationId: 'org-1',
    status: RoomStatus.AVAILABLE,
    roomNumber: '104',
    ...overrides,
});

const makeAdmission = (ci: number, co: number | null, status = AdmissionStatus.ACTIVE) => ({
    id: 'adm-1',
    organisationId: 'org-1',
    roomId: 'room-1',
    checkInDate: date(ci),
    actualCheckOutDate: co === null ? null : date(co),
    status,
});

const makeBooking = (ci: number, co: number, id = 'bk-1', status = BookingStatus.CONFIRMED) => ({
    id,
    organisationId: 'org-1',
    roomId: 'room-1',
    checkInDate: date(ci),
    checkOutDate: date(co),
    status,
});

// Fake EntityManager: returns canned rows by entity name (the SQL status filter is
// assumed correct — these tests cover the JS overlap/precedence, not DB filtering).
const fakeManager = (rows: { admissions?: any[]; bookings?: any[]; patient?: any }) => ({
    find: jest.fn((entity: any) => {
        if (entity?.name === 'Admission') return Promise.resolve(rows.admissions ?? []);
        if (entity?.name === 'RoomBooking') return Promise.resolve(rows.bookings ?? []);
        return Promise.resolve([]);
    }),
    getRepository: jest.fn(() => ({
        findOne: jest.fn(() => Promise.resolve(rows.patient ?? null)),
    })),
});

describe('rangesOverlap (half-open)', () => {
    // Existing range [10, 20)
    it.each([
        [[1, 5], false, 'entirely before'],
        [[20, 25], false, 'back-to-back after'],
        [[0, 10], false, 'back-to-back before'],
        [[5, 15], true, 'partial front'],
        [[15, 25], true, 'partial back'],
        [[12, 18], true, 'inside'],
        [[5, 25], true, 'envelops'],
        [[10, 20], true, 'exact'],
    ])('[10,20) vs [%s) → %s (%s)', (b: number[], expected: boolean) => {
        expect(rangesOverlap(10, 20, b[0], b[1])).toBe(expected);
    });
});

describe('RetreatService Phase 0 — isRoomBlocked', () => {
    let service: RetreatService;

    beforeEach(() => {
        service = new RetreatService(
            {} as any, // roomRepo
            {} as any, // packageRepo
            {} as any, // admissionRepo
            {} as any, // bookingRepo
            {} as any, // enquiryRepo
            {} as any, // orgUserRepo
            {} as any, // patientRepo
            {} as any, // capabilitiesRepo
            {} as any, // categoryRepo
            {} as any, // categoryPricingRepo
            {} as any, // roomPricingOverrideRepo
            {} as any, // fieldDefinitionRepo
            {} as any, // dataSource
            {} as any, // notificationsService
            {} as any, // patientBillingService
            {} as any, // patientsService
            {} as any, // branchVisibilityService,
            {} as any,
            { liveFrom: jest.fn(() => Promise.resolve(null)), postReceipt: jest.fn(() => Promise.resolve(null)), reverseReceipt: jest.fn(() => Promise.resolve(null)), postTransfer: jest.fn(() => Promise.resolve(null)), postRefund: jest.fn(() => Promise.resolve(null)) } as any, // advancePosting (cash off)
        );
    });

    const call = (manager: any, room: any, ci: number, co: number, exclude?: string) =>
        (service as any).isRoomBlocked(manager, room, date(ci), date(co), exclude);

    it('blocks on an overlapping live admission (reason: admission)', async () => {
        const mgr = fakeManager({ admissions: [makeAdmission(10, 20)] });
        await expect(call(mgr, makeRoom(), 15, 25)).resolves.toEqual({ blocked: true, reason: 'admission' });
    });

    it('open-ended ACTIVE admission (no actual checkout) blocks any later window', async () => {
        const mgr = fakeManager({ admissions: [makeAdmission(10, null)] });
        await expect(call(mgr, makeRoom(), 90, 95)).resolves.toEqual({ blocked: true, reason: 'admission' });
    });

    it('Q3 overstay: ACTIVE with actual checkout still null blocks even past any expected date', async () => {
        // actualCheckOutDate null → occupied to +∞ regardless of expected
        const mgr = fakeManager({ admissions: [makeAdmission(1, null)] });
        await expect(call(mgr, makeRoom(), 100, 101)).resolves.toEqual({ blocked: true, reason: 'admission' });
    });

    it('does not block when the only admission is back-to-back (checkout == new check-in)', async () => {
        const mgr = fakeManager({ admissions: [makeAdmission(10, 20)] });
        await expect(call(mgr, makeRoom(), 20, 25)).resolves.toEqual({ blocked: false });
    });

    it('blocks a maintenance room even with no admissions/bookings (reason: maintenance)', async () => {
        const mgr = fakeManager({});
        await expect(call(mgr, makeRoom({ status: RoomStatus.MAINTENANCE }), 1, 5))
            .resolves.toEqual({ blocked: true, reason: 'maintenance' });
    });

    it('precedence: admission outranks maintenance', async () => {
        const mgr = fakeManager({ admissions: [makeAdmission(10, 20)] });
        await expect(call(mgr, makeRoom({ status: RoomStatus.MAINTENANCE }), 12, 18))
            .resolves.toEqual({ blocked: true, reason: 'admission' });
    });

    it('blocks on an overlapping active booking (reason: booking)', async () => {
        const mgr = fakeManager({ bookings: [makeBooking(10, 20)] });
        await expect(call(mgr, makeRoom(), 15, 25)).resolves.toEqual({ blocked: true, reason: 'booking' });
    });

    it('excludeBookingId skips the booking being edited', async () => {
        const mgr = fakeManager({ bookings: [makeBooking(10, 20, 'self')] });
        await expect(call(mgr, makeRoom(), 12, 18, 'self')).resolves.toEqual({ blocked: false });
    });

    it('returns not-blocked when nothing overlaps', async () => {
        const mgr = fakeManager({ admissions: [makeAdmission(1, 5)], bookings: [makeBooking(30, 35)] });
        await expect(call(mgr, makeRoom(), 10, 20)).resolves.toEqual({ blocked: false });
    });
});

describe('RetreatService Phase 0 — assertPatientInOrg', () => {
    let service: RetreatService;
    beforeEach(() => {
        service = new RetreatService(
            {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
            {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
            {} as any, // branchVisibilityService,
            {} as any,
            { liveFrom: jest.fn(() => Promise.resolve(null)), postReceipt: jest.fn(() => Promise.resolve(null)), reverseReceipt: jest.fn(() => Promise.resolve(null)), postTransfer: jest.fn(() => Promise.resolve(null)), postRefund: jest.fn(() => Promise.resolve(null)) } as any, // advancePosting (cash off)
        );
    });

    it('throws Forbidden when the patient is not in this organisation', async () => {
        const mgr = fakeManager({ patient: null });
        await expect((service as any).assertPatientInOrg('org-1', 'patient-x', mgr))
            .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('resolves when the patient belongs to the organisation', async () => {
        const mgr = fakeManager({ patient: { id: 'patient-1', organisationId: 'org-1' } });
        await expect((service as any).assertPatientInOrg('org-1', 'patient-1', mgr)).resolves.toBeUndefined();
    });
});

// W1-A.1: care_program resolution/validation against clinic_capabilities.
// Covers the backward-compat defaulting rules (no DB — capability repo mocked).
describe('RetreatService W1-A.1 — resolveCareProgram', () => {
    const caps = (flags: Partial<Record<'hasPostnatalCare' | 'hasAyurveda' | 'hasIpd' | 'hasOpd', boolean>>) => ({
        hasPostnatalCare: false, hasAyurveda: false, hasIpd: false, hasOpd: false, ...flags,
    });

    // Build a service whose capabilitiesRepo.findOne returns the given caps row.
    const makeService = (capsRow: any) => new RetreatService(
        {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
        { findOne: jest.fn(() => Promise.resolve(capsRow)) } as any, // capabilitiesRepo
        {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
        {} as any, // branchVisibilityService,
            {} as any,
            { liveFrom: jest.fn(() => Promise.resolve(null)), postReceipt: jest.fn(() => Promise.resolve(null)), reverseReceipt: jest.fn(() => Promise.resolve(null)), postTransfer: jest.fn(() => Promise.resolve(null)), postRefund: jest.fn(() => Promise.resolve(null)) } as any, // advancePosting (cash off)
        );

    const resolve = (svc: RetreatService, requested?: string) =>
        (svc as any).resolveCareProgram('org-1', requested);

    it('#4 single-program clinic → auto-defaults to that program', async () => {
        const svc = makeService(caps({ hasPostnatalCare: true }));
        await expect(resolve(svc)).resolves.toBe('postnatal');
    });

    it('#3 mixed clinic, no value supplied → null (no hard-fail; backward compatible)', async () => {
        const svc = makeService(caps({ hasPostnatalCare: true, hasAyurveda: true }));
        await expect(resolve(svc)).resolves.toBeNull();
    });

    it('#3 mixed clinic, valid enabled value → accepted (normalised to lowercase)', async () => {
        const svc = makeService(caps({ hasPostnatalCare: true, hasAyurveda: true }));
        await expect(resolve(svc, 'POSTNATAL')).resolves.toBe('postnatal');
    });

    it('#3 value not enabled for the org → rejected', async () => {
        const svc = makeService(caps({ hasPostnatalCare: true })); // ipd disabled
        await expect(resolve(svc, 'ipd')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('no capabilities row → any explicit value rejected, omitted → null', async () => {
        const svc = makeService(null);
        await expect(resolve(svc, 'postnatal')).rejects.toBeInstanceOf(BadRequestException);
        await expect(resolve(makeService(null))).resolves.toBeNull();
    });
});

// Booking cancellation/refund dead-end fix (scope/Handoff_Blocker_Fixes_2026-09-16.md #1).
// advancePaid is never mutated by recordRefund -- refundedAt is the single
// source of truth for "has a refund been recorded," which is what unblocks
// removeBooking(). Exactly one refund record per booking (product decision):
// a repeat call on an already-refunded booking is rejected, not accumulated.
describe('RetreatService — recordRefund', () => {
    const makeBookingRow = (overrides: Partial<any> = {}) => ({
        id: 'bk-1',
        organisationId: 'org-1',
        status: BookingStatus.CANCELLED,
        advancePaid: 10000,
        refundedAt: null,
        ...overrides,
    });

    // Stands in for the pessimistic-write transaction in recordRefund():
    // dataSource.manager.transaction's callback receives a fake EntityManager
    // whose getRepository(RoomBooking) returns a repo backed by the same
    // `booking` object every time findOne() is called -- so mutating and
    // saving it inside the service is visible to a second call on the same
    // mocked service, the same way a second real transaction would see the
    // first one's already-committed row.
    const makeService = (booking: any) => {
        const saved: any[] = [];
        const txBookingRepo = {
            findOne: jest.fn(() => Promise.resolve(booking)),
            save: jest.fn((b: any) => {
                saved.push(b);
                return Promise.resolve(b);
            }),
        };
        const dataSource = {
            manager: {
                transaction: jest.fn((cb: any) => cb({ getRepository: jest.fn(() => txBookingRepo) })),
            },
        };
        const service = new RetreatService(
            {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
            {} as any, {} as any, {} as any, {} as any,
            dataSource as any, // dataSource
            {} as any, {} as any, {} as any, {} as any,
            {} as any,
            { liveFrom: jest.fn(() => Promise.resolve(null)), postReceipt: jest.fn(() => Promise.resolve(null)), reverseReceipt: jest.fn(() => Promise.resolve(null)), postTransfer: jest.fn(() => Promise.resolve(null)), postRefund: jest.fn(() => Promise.resolve(null)) } as any, // advancePosting (cash off)
        );
        return { service, txBookingRepo, saved };
    };

    it('records a full refund', async () => {
        const booking = makeBookingRow({ advancePaid: 10000 });
        const { service, saved } = makeService(booking);
        const result = await service.recordRefund('org-1', 'bk-1', 'user-1', {
            amount: 10000,
            method: RefundMethod.UPI,
        });
        expect(saved[0]).toMatchObject({ refundAmount: 10000, refundMethod: RefundMethod.UPI, refundedBy: 'user-1' });
        expect(saved[0].refundedAt).toBeInstanceOf(Date);
        expect(result.advancePaid).toBe(10000); // untouched historical snapshot
    });

    it('records a partial refund without touching advancePaid', async () => {
        const booking = makeBookingRow({ advancePaid: 10000 });
        const { service, saved } = makeService(booking);
        await service.recordRefund('org-1', 'bk-1', 'user-1', { amount: 4000, method: RefundMethod.CASH });
        expect(saved[0].refundAmount).toBe(4000);
        expect(saved[0].advancePaid).toBe(10000);
    });

    it('records a ₹0 refund (deposit forfeited, resolution still recorded)', async () => {
        const booking = makeBookingRow({ advancePaid: 10000 });
        const { service, saved } = makeService(booking);
        await service.recordRefund('org-1', 'bk-1', 'user-1', { amount: 0, method: RefundMethod.OTHER });
        expect(saved[0].refundAmount).toBe(0);
        expect(saved[0].refundedAt).toBeInstanceOf(Date);
    });

    it('rejects an amount greater than advancePaid', async () => {
        const booking = makeBookingRow({ advancePaid: 5000 });
        const { service, txBookingRepo } = makeService(booking);
        await expect(
            service.recordRefund('org-1', 'bk-1', 'user-1', { amount: 5001, method: RefundMethod.CASH }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(txBookingRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a negative amount', async () => {
        const booking = makeBookingRow({ advancePaid: 5000 });
        const { service, txBookingRepo } = makeService(booking);
        await expect(
            service.recordRefund('org-1', 'bk-1', 'user-1', { amount: -100, method: RefundMethod.CASH }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(txBookingRepo.save).not.toHaveBeenCalled();
    });

    it('rejects recording a refund on a non-cancelled booking', async () => {
        const booking = makeBookingRow({ status: BookingStatus.CONFIRMED });
        const { service, txBookingRepo } = makeService(booking);
        await expect(
            service.recordRefund('org-1', 'bk-1', 'user-1', { amount: 100, method: RefundMethod.CASH }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(txBookingRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a duplicate refund attempt on a booking that already has one recorded', async () => {
        const booking = makeBookingRow({ refundedAt: new Date('2026-09-16') });
        const { service, txBookingRepo } = makeService(booking);
        await expect(
            service.recordRefund('org-1', 'bk-1', 'user-1', { amount: 100, method: RefundMethod.CASH }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(txBookingRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the booking does not exist in this organisation', async () => {
        const { service, txBookingRepo } = makeService(null);
        await expect(
            service.recordRefund('org-1', 'missing', 'user-1', { amount: 0, method: RefundMethod.CASH }),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(txBookingRepo.save).not.toHaveBeenCalled();
    });

    it('locks the booking row pessimistic-write before checking refundedAt (concurrency guard)', async () => {
        const booking = makeBookingRow();
        const { service, txBookingRepo } = makeService(booking);
        await service.recordRefund('org-1', 'bk-1', 'user-1', { amount: 100, method: RefundMethod.CASH });
        expect(txBookingRepo.findOne).toHaveBeenCalledWith(
            expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
        );
    });

    it('a second attempt on the same row after the first committed is rejected (simulated concurrent/double refund)', async () => {
        const booking = makeBookingRow();
        const { service } = makeService(booking);
        // First call wins and mutates `booking` in place -- the mocked findOne
        // keeps returning that same object, standing in for a second
        // transaction reading the row after the first one committed under the
        // pessimistic lock.
        await service.recordRefund('org-1', 'bk-1', 'user-1', { amount: 100, method: RefundMethod.CASH });
        await expect(
            service.recordRefund('org-1', 'bk-1', 'user-2', { amount: 200, method: RefundMethod.CASH }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });
});

describe('RetreatService — removeBooking (refund gate)', () => {
    const makeService = (booking: any) => {
        const bookingRepo = {
            findOne: jest.fn(() => Promise.resolve(booking)),
            softDelete: jest.fn(() => Promise.resolve({ affected: 1 })),
        };
        const service = new RetreatService(
            {} as any, {} as any, {} as any,
            bookingRepo as any, // bookingRepo
            {} as any, {} as any, {} as any, {} as any,
            {} as any, {} as any, {} as any, {} as any,
            {} as any, // dataSource
            {} as any, {} as any, {} as any, {} as any,
            {} as any,
            { liveFrom: jest.fn(() => Promise.resolve(null)), postReceipt: jest.fn(() => Promise.resolve(null)), reverseReceipt: jest.fn(() => Promise.resolve(null)), postTransfer: jest.fn(() => Promise.resolve(null)), postRefund: jest.fn(() => Promise.resolve(null)) } as any, // advancePosting (cash off)
        );
        return { service, bookingRepo };
    };

    it('cancellation with no advance paid can be removed immediately, no refund needed', async () => {
        const { service, bookingRepo } = makeService({
            id: 'bk-1',
            status: BookingStatus.CANCELLED,
            advancePaid: 0,
            refundedAt: null,
        });
        await expect(service.removeBooking('org-1', 'bk-1')).resolves.toBeUndefined();
        expect(bookingRepo.softDelete).toHaveBeenCalledWith({ id: 'bk-1' });
    });

    it('blocks removal before a refund is recorded', async () => {
        const { service, bookingRepo } = makeService({
            id: 'bk-1',
            status: BookingStatus.CANCELLED,
            advancePaid: 5000,
            refundedAt: null,
        });
        await expect(service.removeBooking('org-1', 'bk-1')).rejects.toBeInstanceOf(BadRequestException);
        expect(bookingRepo.softDelete).not.toHaveBeenCalled();
    });

    it('allows removal after a refund is recorded, even though advancePaid itself is untouched', async () => {
        const { service, bookingRepo } = makeService({
            id: 'bk-1',
            status: BookingStatus.CANCELLED,
            advancePaid: 5000,
            refundedAt: new Date('2026-09-16'),
        });
        await expect(service.removeBooking('org-1', 'bk-1')).resolves.toBeUndefined();
        expect(bookingRepo.softDelete).toHaveBeenCalledWith({ id: 'bk-1' });
    });
});

// Phase 3 audit instrumentation -- second patient-creation path found in
// recon (scope/Audit_Trail_Phase3_Patients_Reconnaissance.md): this
// bypasses PatientsService.create() entirely, so it needs its own test
// distinct from patients.service.spec.ts's create() coverage.
describe('RetreatService.promoteEnquiry — audit event (second patient-creation path)', () => {
    const makeService = (opts: { phoneMatches?: any[]; visiblePatient?: any } = {}) => {
        const booking = {
            id: 'bk-1', organisationId: 'org-1', branchId: 'branch-1', patientId: null,
            enquiry: { phone: '9999999999', contactName: 'Jane Doe' },
        };
        const managerRecord: any[] = [];
        const manager: any = {
            findOne: jest.fn((entity: any) => {
                if (entity?.name === 'RoomBooking') return Promise.resolve({ ...booking });
                if (entity?.name === 'Patient') return Promise.resolve(opts.existingPatient ?? null);
                return Promise.resolve(null);
            }),
            create: jest.fn((_entity: any, data: any) => data),
            save: jest.fn((arg1: any, arg2?: any) => Promise.resolve(arg2 ?? { id: 'p-new', ...arg1 })),
        };
        const dataSource: any = { transaction: jest.fn((cb: any) => cb(manager)) };
        const patientsService: any = {
            generateNextPatientCode: jest.fn(() => Promise.resolve('P00001')),
            findVisibleByPhone: jest.fn(() => Promise.resolve(opts.phoneMatches ?? [])),
            findVisibleById: jest.fn(() => Promise.resolve(opts.visiblePatient ?? null)),
        };
        const auditService: any = {
            record: jest.fn((params: any, mgr: any) => { managerRecord.push({ params, mgr }); return Promise.resolve(); }),
        };
        const service = new RetreatService(
            {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
            {} as any, {} as any, {} as any, {} as any,
            dataSource, {} as any, {} as any, patientsService, {} as any, auditService,
            { liveFrom: jest.fn(() => Promise.resolve(null)), postReceipt: jest.fn(() => Promise.resolve(null)), reverseReceipt: jest.fn(() => Promise.resolve(null)), postTransfer: jest.fn(() => Promise.resolve(null)), postRefund: jest.fn(() => Promise.resolve(null)) } as any, // advancePosting (cash off)
        );
        return { service, auditService, managerRecord, manager, patientsService };
    };

    it('records action=create with source=api and via=booking_promotion, using the transaction manager', async () => {
        const { service, managerRecord } = makeService();
        await service.promoteEnquiry('org-1', 'bk-1', 'u-1');

        expect(managerRecord).toHaveLength(1);
        expect(managerRecord[0].params).toMatchObject({
            organisationId: 'org-1',
            orgType: 'CLINIC',
            entityType: 'patient',
            action: 'create',
            severity: 'sensitive',
            actorUserId: 'u-1',
            source: 'api',
            metadata: { via: 'booking_promotion', bookingId: 'bk-1' },
        });
        expect(managerRecord[0].mgr).toBeDefined(); // participates in the transaction, per decision C
    });

    it('does not audit a creation when linking a patient the receptionist chose', async () => {
        const { service, managerRecord } = makeService({ visiblePatient: { id: 'existing-p', branchId: 'branch-1' } });
        await service.promoteEnquiry('org-1', 'bk-1', 'u-1', { patientId: 'existing-p' });
        expect(managerRecord).toHaveLength(0);
    });
});

// Phone is a contact attribute, not identity (scope/patient-phone-non-unique-and-matching.md):
// promotion must never pick an existing patient by phone on its own.
describe('RetreatService.promoteEnquiry — never auto-links by phone', () => {
    const makeService = (opts: { phoneMatches?: any[]; visiblePatient?: any } = {}) => {
        const booking = {
            id: 'bk-1', organisationId: 'org-1', branchId: 'branch-1', patientId: null,
            enquiry: { phone: '9999999999', contactName: 'Jane Doe' },
        };
        const manager: any = {
            findOne: jest.fn((entity: any) =>
                Promise.resolve(entity?.name === 'RoomBooking' ? { ...booking } : null)),
            create: jest.fn((_entity: any, data: any) => data),
            save: jest.fn((arg1: any, arg2?: any) => Promise.resolve(arg2 ?? { id: 'p-new', ...arg1 })),
        };
        const dataSource: any = { transaction: jest.fn((cb: any) => cb(manager)) };
        const patientsService: any = {
            generateNextPatientCode: jest.fn(() => Promise.resolve('P00001')),
            findVisibleByPhone: jest.fn(() => Promise.resolve(opts.phoneMatches ?? [])),
            findVisibleById: jest.fn(() => Promise.resolve(opts.visiblePatient ?? null)),
        };
        const auditService: any = { record: jest.fn(() => Promise.resolve()) };
        const service = new RetreatService(
            {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
            {} as any, {} as any, {} as any, {} as any,
            dataSource, {} as any, {} as any, patientsService, {} as any, auditService,
            {} as any,
        );
        return { service, manager, patientsService, auditService };
    };

    it('refuses with 409 and links nothing when a visible patient shares the phone', async () => {
        const { service, manager, patientsService } = makeService({ phoneMatches: [{ id: 'p-a' }, { id: 'p-b' }] });
        await expect(service.promoteEnquiry('org-1', 'bk-1', 'u-1', { role: 'RECEPTIONIST' }))
            .rejects.toBeInstanceOf(ConflictException);
        expect(patientsService.findVisibleByPhone).toHaveBeenCalledWith('u-1', 'RECEPTIONIST', 'org-1', 'CLINIC', '9999999999', manager, 'branch-1');
        expect(manager.save).not.toHaveBeenCalled();
    });

    it('creates a new patient when no visible patient shares the phone', async () => {
        const { service, manager } = makeService();
        const saved: any = await service.promoteEnquiry('org-1', 'bk-1', 'u-1');
        expect(manager.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ phone: '9999999999', branchId: 'branch-1' }));
        expect(saved.patientId).toBe('p-new');
    });

    it('creates a new patient on createNew even when matches exist, without looking them up', async () => {
        const { service, manager, patientsService } = makeService({ phoneMatches: [{ id: 'p-a' }] });
        const saved: any = await service.promoteEnquiry('org-1', 'bk-1', 'u-1', { createNew: true });
        expect(patientsService.findVisibleByPhone).not.toHaveBeenCalled();
        expect(manager.create).toHaveBeenCalled();
        expect(saved.patientId).toBe('p-new');
    });

    it('links the chosen patient when it is visible to the caller', async () => {
        const { service, manager, patientsService } = makeService({ visiblePatient: { id: 'p-a', branchId: 'branch-1' } });
        const saved: any = await service.promoteEnquiry('org-1', 'bk-1', 'u-1', { role: 'RECEPTIONIST', patientId: 'p-a' });
        expect(patientsService.findVisibleById).toHaveBeenCalledWith('u-1', 'RECEPTIONIST', 'org-1', 'p-a', manager);
        expect(manager.create).not.toHaveBeenCalled();
        expect(saved.patientId).toBe('p-a');
    });

    it("refuses a visible patient registered at a different branch from the booking's", async () => {
        const { service, manager } = makeService({ visiblePatient: { id: 'p-main', branchId: 'branch-main' } });
        await expect(service.promoteEnquiry('org-1', 'bk-1', 'u-1', { patientId: 'p-main' }))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(manager.save).not.toHaveBeenCalled();
    });

    it('404s when the chosen patient is in another org or a branch the caller cannot see', async () => {
        const { service, manager } = makeService({ visiblePatient: null });
        await expect(service.promoteEnquiry('org-1', 'bk-1', 'u-1', { patientId: 'p-hidden' }))
            .rejects.toBeInstanceOf(NotFoundException);
        expect(manager.save).not.toHaveBeenCalled();
    });
});

// Cash MVP batch 1: voidAdvance must read the new total back with a SELECT.
// TypeORM's query() returns [rows, count] for UPDATE ... RETURNING, which made
// the returned total NaN and the below-zero guard unreachable (caught on staging).
describe('RetreatService.voidAdvance — advance total read-back', () => {
    const build = (advanceAfter: string) => {
        const reverseReceipt = jest.fn(() => Promise.resolve(null));
        const query = jest.fn((sql: string) => {
            if (sql.startsWith('SELECT id, amount FROM booking_advance_receipts')) return Promise.resolve([{ id: 'r1', amount: '500.00' }]);
            if (sql.startsWith('UPDATE room_bookings')) return Promise.resolve([[{ advance_paid: 'ignored' }], 1]); // what TypeORM really returns
            if (sql.startsWith('SELECT advance_paid FROM room_bookings')) return Promise.resolve([{ advance_paid: advanceAfter }]);
            return Promise.resolve([]);
        });
        const manager: any = {
            query,
            findOne: jest.fn(() => Promise.resolve({ id: 'b1', organisationId: 'org-1', status: 'CONFIRMED' })),
        };
        const args: any[] = Array.from({ length: 18 }, () => ({}));
        args[12] = { transaction: (cb: any) => cb(manager) }; // dataSource
        args[18] = { reverseReceipt };
        const service = new (RetreatService as any)(...args);
        return { service, reverseReceipt };
    };

    it('returns the new total as a number and reverses the receipt voucher', async () => {
        const { service, reverseReceipt } = build('2000.00');
        await expect(service.voidAdvance('org-1', 'b1', 'r1', 'u-1', 'OWNER')).resolves.toEqual({ advancePaid: 2000 });
        expect(reverseReceipt).toHaveBeenCalledWith(expect.anything(), 'org-1', 'r1', { userId: 'u-1', role: 'OWNER' });
    });

    it('refuses (and so rolls back) a void that would take the total below zero', async () => {
        const { service, reverseReceipt } = build('-100.00');
        await expect(service.voidAdvance('org-1', 'b1', 'r1', 'u-1', 'OWNER')).rejects.toThrow('below zero');
        expect(reverseReceipt).not.toHaveBeenCalled();
    });
});
