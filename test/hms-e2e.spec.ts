/**
 * HMS End-to-End Integration Tests
 * 
 * This test suite validates all HMS modules work together correctly.
 * Run with: npm run test:e2e
 * 
 * Note: Requires a test database to be configured.
 * Set DB_NAME=ayurlahi_test in your .env file
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('HMS E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let clinicId: string;
  let patientId: string;
  let doctorId: string;
  let appointmentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get auth token (assuming test user exists)
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'test@clinic.com',
        password: 'testpassword',
      });

    if (loginResponse.status === 201) {
      authToken = loginResponse.body.accessToken;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Phase 1: Core HMS', () => {
    describe('Patient Management', () => {
      it('POST /api/patients - should create a patient', () => {
        return request(app.getHttpServer())
          .post('/api/patients')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            patientId: 'P001',
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            gender: 'male',
            phone: '1234567890',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.patientId).toBe('P001');
            patientId = res.body.id;
          });
      });

      it('GET /api/patients - should return list of patients', () => {
        return request(app.getHttpServer())
          .get('/api/patients?page=1&limit=10')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('total');
          });
      });

      it('GET /api/patients/:id - should return a patient', () => {
        return request(app.getHttpServer())
          .get(`/api/patients/${patientId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.id).toBe(patientId);
          });
      });
    });

    describe('Doctor Management', () => {
      it('POST /api/doctors - should create a doctor', () => {
        return request(app.getHttpServer())
          .post('/api/doctors')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            doctorId: 'DOC001',
            firstName: 'Dr. Jane',
            lastName: 'Smith',
            specialization: 'Cardiology',
            licenseNumber: 'DOC-LIC-001',
            consultationFee: 500,
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.doctorId).toBe('DOC001');
            doctorId = res.body.id;
          });
      });

      it('GET /api/doctors - should return list of doctors', () => {
        return request(app.getHttpServer())
          .get('/api/doctors?page=1&limit=10')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('data');
          });
      });
    });

    describe('Appointment Scheduling', () => {
      it('POST /api/appointments - should create an appointment', () => {
        return request(app.getHttpServer())
          .post('/api/appointments')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            patientId: patientId,
            doctorId: doctorId,
            appointmentDate: '2025-12-25',
            appointmentTime: '10:00',
            duration: 30,
            appointmentType: 'consultation',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            appointmentId = res.body.id;
          });
      });

      it('GET /api/appointments - should return list of appointments', () => {
        return request(app.getHttpServer())
          .get('/api/appointments?page=1&limit=10')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('data');
          });
      });
    });
  });

  describe('Phase 2: Clinical Operations', () => {
    describe('Medical Records', () => {
      it('POST /api/medical-records - should create a medical record', () => {
        return request(app.getHttpServer())
          .post('/api/medical-records')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            patientId: patientId,
            doctorId: doctorId,
            appointmentId: appointmentId,
            visitDate: '2025-12-25',
            chiefComplaint: 'Headache',
            diagnosis: 'Migraine',
            treatment: 'Prescribed medication',
            vitals: {
              bloodPressure: '120/80',
              temperature: 98.6,
            },
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.chiefComplaint).toBe('Headache');
          });
      });

      it('GET /api/medical-records - should return list of medical records', () => {
        return request(app.getHttpServer())
          .get('/api/medical-records?page=1&limit=10')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('data');
          });
      });
    });

    describe('Prescription Management', () => {
      it('POST /api/prescriptions - should create a prescription', () => {
        return request(app.getHttpServer())
          .post('/api/prescriptions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            patientId: patientId,
            doctorId: doctorId,
            appointmentId: appointmentId,
            prescriptionDate: '2025-12-25',
            diagnosis: 'Migraine',
            items: [
              {
                medicineName: 'Paracetamol',
                dosage: '500mg',
                frequency: '2 times a day',
                duration: '7 days',
                quantity: 14,
              },
            ],
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.items).toBeDefined();
            expect(res.body.items.length).toBe(1);
          });
      });

      it('GET /api/prescriptions - should return list of prescriptions', () => {
        return request(app.getHttpServer())
          .get('/api/prescriptions?page=1&limit=10')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('data');
          });
      });
    });
  });

  describe('Phase 3: Diagnostics & Billing', () => {
    describe('Lab Reports', () => {
      it('POST /api/lab-reports - should create a lab report', () => {
        return request(app.getHttpServer())
          .post('/api/lab-reports')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            reportNumber: 'LAB-001',
            patientId: patientId,
            doctorId: doctorId,
            appointmentId: appointmentId,
            orderDate: '2025-12-25',
            tests: [
              {
                testName: 'Blood Test',
                testCode: 'BT-001',
              },
            ],
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.reportNumber).toBe('LAB-001');
          });
      });

      it('GET /api/lab-reports - should return list of lab reports', () => {
        return request(app.getHttpServer())
          .get('/api/lab-reports?page=1&limit=10')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('data');
          });
      });
    });

    describe('Patient Billing', () => {
      it('POST /api/patient-billing - should create a bill', () => {
        return request(app.getHttpServer())
          .post('/api/patient-billing')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            billNumber: 'BILL-001',
            patientId: patientId,
            appointmentId: appointmentId,
            billDate: '2025-12-25',
            items: [
              {
                itemType: 'consultation',
                itemName: 'Consultation Fee',
                quantity: 1,
                unitPrice: 500,
              },
            ],
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.billNumber).toBe('BILL-001');
            expect(res.body.total).toBe(500);
          });
      });

      it('GET /api/patient-billing - should return list of bills', () => {
        return request(app.getHttpServer())
          .get('/api/patient-billing?page=1&limit=10')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('data');
          });
      });
    });
  });
});



