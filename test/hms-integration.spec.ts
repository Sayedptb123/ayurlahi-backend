import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PatientsModule } from '../src/patients/patients.module';
import { DoctorsModule } from '../src/doctors/doctors.module';
import { AppointmentsModule } from '../src/appointments/appointments.module';
import { MedicalRecordsModule } from '../src/medical-records/medical-records.module';
import { PrescriptionsModule } from '../src/prescriptions/prescriptions.module';
import { LabReportsModule } from '../src/lab-reports/lab-reports.module';
import { PatientBillingModule } from '../src/patient-billing/patient-billing.module';
import { UsersModule } from '../src/users/users.module';
import { ClinicsModule } from '../src/clinics/clinics.module';
import { AuthModule } from '../src/auth/auth.module';
import { PatientsService } from '../src/patients/patients.service';
import { DoctorsService } from '../src/doctors/doctors.service';
import { AppointmentsService } from '../src/appointments/appointments.service';
import { MedicalRecordsService } from '../src/medical-records/medical-records.service';
import { PrescriptionsService } from '../src/prescriptions/prescriptions.service';
import { LabReportsService } from '../src/lab-reports/lab-reports.service';
import { PatientBillingService } from '../src/patient-billing/patient-billing.service';
import { User } from '../src/users/entities/user.entity';
import { Clinic } from '../src/clinics/entities/clinic.entity';
import { Patient } from '../src/patients/entities/patient.entity';
import { Doctor } from '../src/doctors/entities/doctor.entity';
import { Appointment } from '../src/appointments/entities/appointment.entity';
import { MedicalRecord } from '../src/medical-records/entities/medical-record.entity';
import { Prescription } from '../src/prescriptions/entities/prescription.entity';
import { LabReport } from '../src/lab-reports/entities/lab-report.entity';
import { PatientBill } from '../src/patient-billing/entities/patient-bill.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('HMS Integration Tests', () => {
  let module: TestingModule;
  let patientsService: PatientsService;
  let doctorsService: DoctorsService;
  let appointmentsService: AppointmentsService;
  let medicalRecordsService: MedicalRecordsService;
  let prescriptionsService: PrescriptionsService;
  let labReportsService: LabReportsService;
  let patientBillingService: PatientBillingService;
  let userRepository: Repository<User>;
  let clinicRepository: Repository<Clinic>;
  let patientRepository: Repository<Patient>;
  let doctorRepository: Repository<Doctor>;

  let testClinic: Clinic;
  let testUser: User;
  let testPatient: Patient;
  let testDoctor: Doctor;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get('DB_HOST', 'localhost'),
            port: configService.get('DB_PORT', 5432),
            username: configService.get('DB_USERNAME', 'postgres'),
            password: configService.get('DB_PASSWORD', ''),
            database: configService.get('DB_NAME', 'ayurlahi_test'),
            entities: [
              User,
              Clinic,
              Patient,
              Doctor,
              Appointment,
              MedicalRecord,
              Prescription,
              LabReport,
              PatientBill,
            ],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        PassportModule,
        JwtModule.register({
          secret: 'test-secret-key',
          signOptions: { expiresIn: '1h' },
        }),
        UsersModule,
        ClinicsModule,
        PatientsModule,
        DoctorsModule,
        AppointmentsModule,
        MedicalRecordsModule,
        PrescriptionsModule,
        LabReportsModule,
        PatientBillingModule,
        AuthModule,
      ],
    }).compile();

    patientsService = module.get<PatientsService>(PatientsService);
    doctorsService = module.get<DoctorsService>(DoctorsService);
    appointmentsService = module.get<AppointmentsService>(AppointmentsService);
    medicalRecordsService = module.get<MedicalRecordsService>(
      MedicalRecordsService,
    );
    prescriptionsService =
      module.get<PrescriptionsService>(PrescriptionsService);
    labReportsService = module.get<LabReportsService>(LabReportsService);
    patientBillingService = module.get<PatientBillingService>(
      PatientBillingService,
    );

    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    clinicRepository = module.get<Repository<Clinic>>(
      getRepositoryToken(Clinic),
    );
    patientRepository = module.get<Repository<Patient>>(
      getRepositoryToken(Patient),
    );
    doctorRepository = module.get<Repository<Doctor>>(
      getRepositoryToken(Doctor),
    );

    // Create test clinic and user
    testClinic = clinicRepository.create({
      userId: 'test-user-id',
      clinicName: 'Test Clinic',
      licenseNumber: 'TEST-LIC-001',
      address: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      pincode: '12345',
      country: 'Test Country',
      approvalStatus: 'approved',
    });
    testClinic = await clinicRepository.save(testClinic);

    testUser = userRepository.create({
      email: 'test@clinic.com',
      password: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      role: 'clinic',
      clinicId: testClinic.id,
      isActive: true,
    });
    testUser = await userRepository.save(testUser);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Phase 1: Core HMS', () => {
    describe('Patient Management', () => {
      it('should create a patient', async () => {
        const createDto = {
          patientId: 'P001',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          gender: 'male',
          phone: '1234567890',
          email: 'john@example.com',
        };

        const patient = await patientsService.create(
          testUser.id,
          'clinic',
          createDto,
        );

        expect(patient).toBeDefined();
        expect(patient.patientId).toBe('P001');
        expect(patient.firstName).toBe('John');
        expect(patient.clinicId).toBe(testClinic.id);
        testPatient = patient;
      });

      it('should find all patients', async () => {
        const result = await patientsService.findAll(testUser.id, 'clinic', {
          page: 1,
          limit: 10,
        });

        expect(result.data).toBeDefined();
        expect(result.total).toBeGreaterThan(0);
        expect(result.data.length).toBeGreaterThan(0);
      });

      it('should find one patient', async () => {
        const patient = await patientsService.findOne(
          testPatient.id,
          testUser.id,
          'clinic',
        );

        expect(patient).toBeDefined();
        expect(patient.id).toBe(testPatient.id);
      });

      it('should update a patient', async () => {
        const updateDto = {
          phone: '9876543210',
        };

        const updated = await patientsService.update(
          testPatient.id,
          testUser.id,
          'clinic',
          updateDto,
        );

        expect(updated.phone).toBe('9876543210');
      });
    });

    describe('Doctor Management', () => {
      it('should create a doctor', async () => {
        const createDto = {
          doctorId: 'DOC001',
          firstName: 'Dr. Jane',
          lastName: 'Smith',
          specialization: 'Cardiology',
          licenseNumber: 'DOC-LIC-001',
          consultationFee: 500,
        };

        const doctor = await doctorsService.create(
          testUser.id,
          'clinic',
          createDto,
        );

        expect(doctor).toBeDefined();
        expect(doctor.doctorId).toBe('DOC001');
        expect(doctor.specialization).toBe('Cardiology');
        expect(doctor.clinicId).toBe(testClinic.id);
        testDoctor = doctor;
      });

      it('should find all doctors', async () => {
        const result = await doctorsService.findAll(testUser.id, 'clinic', {
          page: 1,
          limit: 10,
        });

        expect(result.data).toBeDefined();
        expect(result.total).toBeGreaterThan(0);
      });

      it('should update a doctor', async () => {
        const updateDto = {
          consultationFee: 600,
        };

        const updated = await doctorsService.update(
          testDoctor.id,
          testUser.id,
          'clinic',
          updateDto,
        );

        expect(updated.consultationFee).toBe(600);
      });
    });

    describe('Appointment Scheduling', () => {
      it('should create an appointment', async () => {
        const createDto = {
          patientId: testPatient.id,
          doctorId: testDoctor.id,
          appointmentDate: '2025-12-25',
          appointmentTime: '10:00',
          duration: 30,
          appointmentType: 'consultation',
        };

        const appointment = await appointmentsService.create(
          testUser.id,
          'clinic',
          createDto,
        );

        expect(appointment).toBeDefined();
        expect(appointment.patientId).toBe(testPatient.id);
        expect(appointment.doctorId).toBe(testDoctor.id);
      });

      it('should find all appointments', async () => {
        const result = await appointmentsService.findAll(
          testUser.id,
          'clinic',
          { page: 1, limit: 10 },
        );

        expect(result.data).toBeDefined();
        expect(result.total).toBeGreaterThan(0);
      });
    });
  });

  describe('Phase 2: Clinical Operations', () => {
    let testAppointment: Appointment;

    beforeAll(async () => {
      // Create an appointment for testing
      testAppointment = await appointmentsService.create(
        testUser.id,
        'clinic',
        {
          patientId: testPatient.id,
          doctorId: testDoctor.id,
          appointmentDate: '2025-12-26',
          appointmentTime: '14:00',
          duration: 30,
        },
      );
    });

    describe('Medical Records', () => {
      it('should create a medical record', async () => {
        const createDto = {
          patientId: testPatient.id,
          doctorId: testDoctor.id,
          appointmentId: testAppointment.id,
          visitDate: '2025-12-26',
          chiefComplaint: 'Headache',
          diagnosis: 'Migraine',
          treatment: 'Prescribed pain medication',
          vitals: {
            bloodPressure: '120/80',
            temperature: 98.6,
            pulse: 72,
          },
        };

        const record = await medicalRecordsService.create(
          testUser.id,
          'clinic',
          createDto,
        );

        expect(record).toBeDefined();
        expect(record.chiefComplaint).toBe('Headache');
        expect(record.vitals).toBeDefined();
      });

      it('should find all medical records', async () => {
        const result = await medicalRecordsService.findAll(
          testUser.id,
          'clinic',
          { page: 1, limit: 10 },
        );

        expect(result.data).toBeDefined();
        expect(result.total).toBeGreaterThan(0);
      });
    });

    describe('Prescription Management', () => {
      it('should create a prescription', async () => {
        const createDto = {
          patientId: testPatient.id,
          doctorId: testDoctor.id,
          appointmentId: testAppointment.id,
          prescriptionDate: '2025-12-26',
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
        };

        const prescription = await prescriptionsService.create(
          testUser.id,
          'clinic',
          createDto,
        );

        expect(prescription).toBeDefined();
        expect(prescription.items).toBeDefined();
        expect(prescription.items.length).toBe(1);
        expect(prescription.items[0].medicineName).toBe('Paracetamol');
      });

      it('should find all prescriptions', async () => {
        const result = await prescriptionsService.findAll(
          testUser.id,
          'clinic',
          { page: 1, limit: 10 },
        );

        expect(result.data).toBeDefined();
        expect(result.total).toBeGreaterThan(0);
      });
    });
  });

  describe('Phase 3: Diagnostics & Billing', () => {
    let testAppointment: Appointment;

    beforeAll(async () => {
      testAppointment = await appointmentsService.create(
        testUser.id,
        'clinic',
        {
          patientId: testPatient.id,
          doctorId: testDoctor.id,
          appointmentDate: '2025-12-27',
          appointmentTime: '15:00',
          duration: 30,
        },
      );
    });

    describe('Lab Reports', () => {
      it('should create a lab report', async () => {
        const createDto = {
          reportNumber: 'LAB-001',
          patientId: testPatient.id,
          doctorId: testDoctor.id,
          appointmentId: testAppointment.id,
          orderDate: '2025-12-27',
          tests: [
            {
              testName: 'Blood Test',
              testCode: 'BT-001',
              status: 'pending',
            },
          ],
        };

        const labReport = await labReportsService.create(
          testUser.id,
          'clinic',
          createDto,
        );

        expect(labReport).toBeDefined();
        expect(labReport.reportNumber).toBe('LAB-001');
        expect(labReport.tests).toBeDefined();
        expect(labReport.tests.length).toBe(1);
      });

      it('should find all lab reports', async () => {
        const result = await labReportsService.findAll(testUser.id, 'clinic', {
          page: 1,
          limit: 10,
        });

        expect(result.data).toBeDefined();
        expect(result.total).toBeGreaterThan(0);
      });
    });

    describe('Patient Billing', () => {
      it('should create a bill', async () => {
        const createDto = {
          billNumber: 'BILL-001',
          patientId: testPatient.id,
          appointmentId: testAppointment.id,
          billDate: '2025-12-27',
          items: [
            {
              itemType: 'consultation',
              itemName: 'Consultation Fee',
              quantity: 1,
              unitPrice: 500,
            },
            {
              itemType: 'medicine',
              itemName: 'Paracetamol',
              quantity: 1,
              unitPrice: 50,
            },
          ],
        };

        const bill = await patientBillingService.create(
          testUser.id,
          'clinic',
          createDto,
        );

        expect(bill).toBeDefined();
        expect(bill.billNumber).toBe('BILL-001');
        expect(bill.total).toBe(550);
        expect(bill.items.length).toBe(2);
      });

      it('should record a payment', async () => {
        const bills = await patientBillingService.findAll(
          testUser.id,
          'clinic',
          { page: 1, limit: 1 },
        );

        if (bills.data.length > 0) {
          const bill = bills.data[0];
          const paymentDto = {
            amount: 300,
            paymentMethod: 'cash',
          };

          const updated = await patientBillingService.recordPayment(
            bill.id,
            testUser.id,
            'clinic',
            paymentDto,
          );

          expect(updated.paidAmount).toBeGreaterThan(0);
          expect(updated.status).toBe('partial');
        }
      });

      it('should find all bills', async () => {
        const result = await patientBillingService.findAll(
          testUser.id,
          'clinic',
          { page: 1, limit: 10 },
        );

        expect(result.data).toBeDefined();
        expect(result.total).toBeGreaterThan(0);
      });
    });
  });
});
