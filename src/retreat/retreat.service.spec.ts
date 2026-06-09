import { ForbiddenException } from '@nestjs/common';
import { RetreatService, rangesOverlap } from './retreat.service';
import { RoomStatus } from './entities/room.entity';
import { AdmissionStatus } from './entities/admission.entity';
import { BookingStatus } from './entities/room-booking.entity';

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
            {} as any, // orgUserRepo
            {} as any, // patientRepo
            {} as any, // dataSource
            {} as any, // notificationsService
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
