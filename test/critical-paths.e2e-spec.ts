/**
 * Critical-path integration tests for Ayurlahi backend.
 *
 * Run locally: npm run test:e2e -- --testPathPattern=critical-paths
 *
 * Requires: a running PostgreSQL instance with the medilink DB and seed data.
 * Set DB_NAME=medilink_test in .env.test to use a separate test DB.
 *
 * Test accounts (password: abc123123):
 *   clinic.owner@ayurlahi.com  — OWNER of Ayurlahi Clinic
 *   superadmin@ayurlahi.com    — SUPER_ADMIN of Ayurlahi Team
 *   mfg.owner@ayurlahi.com     — OWNER of Ayurlahi Pharma (MANUFACTURER)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

const CLINIC_EMAIL = 'clinic.owner@ayurlahi.com';
const ADMIN_EMAIL = 'superadmin@ayurlahi.com';
const MFG_EMAIL = 'mfg.owner@ayurlahi.com';
const PASSWORD = 'abc123123';

describe('Critical Paths (e2e)', () => {
    let app: INestApplication;
    let clinicToken: string;
    let adminToken: string;
    let mfgToken: string;
    let clinicOrgId: string;
    let mfgOrgId: string;
    let createdPatientId: string;
    let createdAppointmentId: string;
    let createdBillId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
        app.setGlobalPrefix('api');
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    // ─── 1. AUTH ──────────────────────────────────────────────────────────────

    describe('Auth', () => {
        it('clinic owner can log in', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({ email: CLINIC_EMAIL, password: PASSWORD })
                .expect(201);

            expect(res.body.access_token).toBeDefined();
            expect(res.body.user?.organisationType).toBe('CLINIC');
            clinicToken = res.body.access_token;
            clinicOrgId = res.body.user?.organisationId;
        });

        it('superadmin can log in', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({ email: ADMIN_EMAIL, password: PASSWORD })
                .expect(201);

            expect(res.body.access_token).toBeDefined();
            adminToken = res.body.access_token;
        });

        it('manufacturer owner can log in', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({ email: MFG_EMAIL, password: PASSWORD })
                .expect(201);

            expect(res.body.access_token).toBeDefined();
            expect(res.body.user?.organisationType).toBe('MANUFACTURER');
            mfgToken = res.body.access_token;
            mfgOrgId = res.body.user?.organisationId;
        });

        it('rejects wrong password', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({ email: CLINIC_EMAIL, password: 'wrongpassword' })
                .expect(401);
        });

        it('GET /auth/me returns current user', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${clinicToken}`)
                .expect(200);

            expect(res.body.email).toBe(CLINIC_EMAIL);
        });

        it('rejects unauthenticated request', async () => {
            await request(app.getHttpServer())
                .get('/api/patients')
                .expect(401);
        });
    });

    // ─── 2. PATIENTS ─────────────────────────────────────────────────────────

    describe('Patients', () => {
        it('clinic owner can create a patient', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/patients')
                .set('Authorization', `Bearer ${clinicToken}`)
                .send({
                    firstName: 'Test',
                    lastName: 'Patient_E2E',
                    dateOfBirth: '1990-01-01',
                    gender: 'male',
                    phone: '9999900001',
                })
                .expect(201);

            expect(res.body.id).toBeDefined();
            expect(res.body.organisationId).toBe(clinicOrgId);
            createdPatientId = res.body.id;
        });

        it('can retrieve the created patient', async () => {
            const res = await request(app.getHttpServer())
                .get(`/api/patients/${createdPatientId}`)
                .set('Authorization', `Bearer ${clinicToken}`)
                .expect(200);

            expect(res.body.id).toBe(createdPatientId);
            expect(res.body.firstName).toBe('Test');
        });

        it('manufacturer cannot read clinic patients', async () => {
            await request(app.getHttpServer())
                .get('/api/patients')
                .set('Authorization', `Bearer ${mfgToken}`)
                .expect(403);
        });

        it('can soft-delete the patient', async () => {
            await request(app.getHttpServer())
                .delete(`/api/patients/${createdPatientId}`)
                .set('Authorization', `Bearer ${clinicToken}`)
                .expect(200);

            // Verify it no longer appears in list
            const list = await request(app.getHttpServer())
                .get('/api/patients')
                .set('Authorization', `Bearer ${clinicToken}`)
                .expect(200);

            const found = (list.body.data ?? list.body).find((p: any) => p.id === createdPatientId);
            expect(found).toBeUndefined();
        });
    });

    // ─── 3. APPOINTMENTS ─────────────────────────────────────────────────────

    describe('Appointments', () => {
        let staffId: string;

        beforeAll(async () => {
            // Get a staff member to use as doctor
            const staffRes = await request(app.getHttpServer())
                .get('/api/staff')
                .set('Authorization', `Bearer ${clinicToken}`)
                .expect(200);

            const staff = (staffRes.body.data ?? staffRes.body)[0];
            staffId = staff?.id;
        });

        it('can create an appointment', async () => {
            if (!staffId) return; // skip if no staff in test org

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split('T')[0];

            const res = await request(app.getHttpServer())
                .post('/api/appointments')
                .set('Authorization', `Bearer ${clinicToken}`)
                .send({
                    patientName: 'Walk-in Patient',
                    doctorId: staffId,
                    appointmentDate: dateStr,
                    appointmentTime: '10:00',
                    type: 'consultation',
                    notes: 'E2E test appointment',
                })
                .expect(201);

            expect(res.body.id).toBeDefined();
            expect(res.body.organisationId).toBe(clinicOrgId);
            createdAppointmentId = res.body.id;
        });

        it('can list appointments with pagination', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/appointments?page=1&limit=5')
                .set('Authorization', `Bearer ${clinicToken}`)
                .expect(200);

            expect(res.body.data).toBeDefined();
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('can update appointment status to confirmed', async () => {
            if (!createdAppointmentId) return;

            const res = await request(app.getHttpServer())
                .patch(`/api/appointments/${createdAppointmentId}`)
                .set('Authorization', `Bearer ${clinicToken}`)
                .send({ status: 'confirmed' })
                .expect(200);

            expect(res.body.status).toBe('confirmed');
        });

        it('cannot set appointment status backward (confirmed → scheduled)', async () => {
            if (!createdAppointmentId) return;

            await request(app.getHttpServer())
                .patch(`/api/appointments/${createdAppointmentId}`)
                .set('Authorization', `Bearer ${clinicToken}`)
                .send({ status: 'scheduled' })
                .expect(400);
        });

        it('manufacturer cannot read clinic appointments', async () => {
            await request(app.getHttpServer())
                .get('/api/appointments')
                .set('Authorization', `Bearer ${mfgToken}`)
                .expect(403);
        });
    });

    // ─── 4. BILLING ──────────────────────────────────────────────────────────

    describe('Billing', () => {
        it('can create a bill', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/patient-billing')
                .set('Authorization', `Bearer ${clinicToken}`)
                .send({
                    patientName: 'E2E Billing Test',
                    subtotal: 1000,
                    discount: 100,
                    tax: 90,
                    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                })
                .expect(201);

            expect(res.body.id).toBeDefined();
            expect(res.body.organisationId).toBe(clinicOrgId);
            createdBillId = res.body.id;
        });

        it('can record a partial payment', async () => {
            if (!createdBillId) return;

            const res = await request(app.getHttpServer())
                .post(`/api/patient-billing/${createdBillId}/payments`)
                .set('Authorization', `Bearer ${clinicToken}`)
                .send({ amount: 500, paymentMethod: 'cash', notes: 'Partial E2E payment' })
                .expect(201);

            expect(Number(res.body.paidAmount)).toBeGreaterThanOrEqual(500);
        });

        it('can list bills with pagination', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/patient-billing?page=1&limit=5')
                .set('Authorization', `Bearer ${clinicToken}`)
                .expect(200);

            expect(res.body.data ?? res.body).toBeDefined();
        });
    });

    // ─── 5. MULTI-TENANCY ISOLATION ──────────────────────────────────────────

    describe('Multi-tenancy isolation', () => {
        it('admin can list all organisations', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/organisations')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(Array.isArray(res.body.data ?? res.body)).toBe(true);
        });

        it('clinic owner cannot list all organisations', async () => {
            await request(app.getHttpServer())
                .get('/api/organisations')
                .set('Authorization', `Bearer ${clinicToken}`)
                .expect(403);
        });

        it('manufacturer cannot access clinic staff', async () => {
            await request(app.getHttpServer())
                .get('/api/staff')
                .set('Authorization', `Bearer ${mfgToken}`)
                .expect(403);
        });

        it('scraper endpoints require admin role', async () => {
            await request(app.getHttpServer())
                .get('/api/scraper/ayurvedic-clinics')
                .expect(401);

            await request(app.getHttpServer())
                .get('/api/scraper/ayurvedic-clinics')
                .set('Authorization', `Bearer ${clinicToken}`)
                .expect(403);
        });
    });

    // ─── 6. PAYROLL ──────────────────────────────────────────────────────────

    describe('Payroll', () => {
        it('can list payroll records for own org', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/payroll/records')
                .set('Authorization', `Bearer ${clinicToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            // All records must belong to caller's org
            res.body.forEach((record: any) => {
                expect(record.organisationId).toBe(clinicOrgId);
            });
        });

        it('manufacturer cannot access clinic payroll', async () => {
            await request(app.getHttpServer())
                .get('/api/payroll/records')
                .set('Authorization', `Bearer ${mfgToken}`)
                .expect(403);
        });
    });

    // ─── 7. DISPUTES ─────────────────────────────────────────────────────────

    describe('Disputes', () => {
        it('can list disputes (returns data array, not 500)', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/disputes')
                .set('Authorization', `Bearer ${clinicToken}`)
                .expect(200);

            expect(res.body.data).toBeDefined();
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
});
