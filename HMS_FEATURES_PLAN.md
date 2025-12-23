# HMS Features Implementation Plan

## Overview
This document outlines the plan to add Hospital Management System (HMS) features to the existing Ayurlahi B2B marketplace platform.

## Current System
- **B2B Marketplace**: Product ordering, manufacturer management, clinic management
- **Roles**: `clinic`, `manufacturer`, `admin`, `support`

## New HMS Features to Add

### 1. Patient Management
**Purpose**: Manage patient records, demographics, medical history

**Backend Modules Needed**:
- `patients/` module
  - `patients.controller.ts` - CRUD endpoints
  - `patients.service.ts` - Business logic
  - `entities/patient.entity.ts` - Patient data model
  - `dto/create-patient.dto.ts` - Patient creation DTO
  - `dto/update-patient.dto.ts` - Patient update DTO

**Database Schema**:
```sql
patients:
  - id (UUID, PK)
  - clinicId (UUID, FK to clinics)
  - patientId (String, unique per clinic) - e.g., "P001"
  - firstName (String)
  - lastName (String)
  - dateOfBirth (Date)
  - gender (Enum: male, female, other)
  - phone (String)
  - email (String, nullable)
  - address (JSONB)
  - emergencyContact (JSONB)
  - bloodGroup (String, nullable)
  - allergies (String[], nullable)
  - medicalHistory (Text, nullable)
  - createdAt (Timestamp)
  - updatedAt (Timestamp)
```

**Frontend Pages**:
- `/dashboard/patients` - Patient list
- `/dashboard/patients/new` - Add new patient
- `/dashboard/patients/:id` - Patient detail view
- `/dashboard/patients/:id/edit` - Edit patient

---

### 2. Appointment/Booking Scheduling
**Purpose**: Schedule and manage patient appointments with doctors

**Backend Modules Needed**:
- `appointments/` module
  - `appointments.controller.ts`
  - `appointments.service.ts`
  - `entities/appointment.entity.ts`
  - `dto/create-appointment.dto.ts`
  - `dto/update-appointment.dto.ts`

**Database Schema**:
```sql
appointments:
  - id (UUID, PK)
  - clinicId (UUID, FK)
  - patientId (UUID, FK to patients)
  - doctorId (UUID, FK to doctors)
  - appointmentDate (Date)
  - appointmentTime (Time)
  - duration (Integer, minutes) - default 30
  - status (Enum: scheduled, confirmed, in-progress, completed, cancelled, no-show)
  - appointmentType (Enum: consultation, follow-up, emergency, checkup)
  - reason (String, nullable)
  - notes (Text, nullable)
  - createdAt (Timestamp)
  - updatedAt (Timestamp)
  - cancelledAt (Timestamp, nullable)
  - cancellationReason (String, nullable)
```

**Frontend Pages**:
- `/dashboard/appointments` - Appointment calendar/list
- `/dashboard/appointments/new` - Book new appointment
- `/dashboard/appointments/:id` - Appointment details
- `/dashboard/appointments/:id/edit` - Reschedule appointment

---

### 3. Medical Records
**Purpose**: Store and manage patient medical records, visit history

**Backend Modules Needed**:
- `medical-records/` module
  - `medical-records.controller.ts`
  - `medical-records.service.ts`
  - `entities/medical-record.entity.ts`
  - `dto/create-medical-record.dto.ts`

**Database Schema**:
```sql
medical_records:
  - id (UUID, PK)
  - clinicId (UUID, FK)
  - patientId (UUID, FK to patients)
  - appointmentId (UUID, FK to appointments, nullable)
  - doctorId (UUID, FK to doctors)
  - visitDate (Date)
  - chiefComplaint (Text)
  - diagnosis (Text)
  - treatment (Text)
  - vitals (JSONB) - {bp, temperature, pulse, weight, height, etc}
  - notes (Text, nullable)
  - attachments (String[], nullable) - file URLs
  - createdAt (Timestamp)
  - updatedAt (Timestamp)
```

**Frontend Pages**:
- `/dashboard/patients/:id/records` - Patient medical records
- `/dashboard/medical-records/:id` - Medical record detail
- `/dashboard/medical-records/new` - Create new record

---

### 4. Doctor Management
**Purpose**: Manage doctors, their schedules, specializations

**Backend Modules Needed**:
- `doctors/` module
  - `doctors.controller.ts`
  - `doctors.service.ts`
  - `entities/doctor.entity.ts`
  - `dto/create-doctor.dto.ts`
  - `dto/update-doctor.dto.ts`

**Database Schema**:
```sql
doctors:
  - id (UUID, PK)
  - clinicId (UUID, FK to clinics)
  - userId (UUID, FK to users, nullable) - if doctor has user account
  - doctorId (String, unique per clinic) - e.g., "DOC001"
  - firstName (String)
  - lastName (String)
  - specialization (String)
  - qualification (String[])
  - licenseNumber (String)
  - phone (String)
  - email (String)
  - consultationFee (Decimal)
  - schedule (JSONB) - weekly schedule
  - isActive (Boolean, default true)
  - createdAt (Timestamp)
  - updatedAt (Timestamp)
```

**Frontend Pages**:
- `/dashboard/doctors` - Doctor list
- `/dashboard/doctors/new` - Add doctor
- `/dashboard/doctors/:id` - Doctor profile
- `/dashboard/doctors/:id/schedule` - Manage schedule

---

### 5. Prescription Management
**Purpose**: Create and manage prescriptions for patients

**Backend Modules Needed**:
- `prescriptions/` module
  - `prescriptions.controller.ts`
  - `prescriptions.service.ts`
  - `entities/prescription.entity.ts`
  - `entities/prescription-item.entity.ts` - individual medicines
  - `dto/create-prescription.dto.ts`

**Database Schema**:
```sql
prescriptions:
  - id (UUID, PK)
  - clinicId (UUID, FK)
  - patientId (UUID, FK to patients)
  - appointmentId (UUID, FK to appointments, nullable)
  - doctorId (UUID, FK to doctors)
  - prescriptionDate (Date)
  - diagnosis (Text)
  - notes (Text, nullable)
  - status (Enum: active, completed, cancelled)
  - createdAt (Timestamp)
  - updatedAt (Timestamp)

prescription_items:
  - id (UUID, PK)
  - prescriptionId (UUID, FK to prescriptions)
  - medicineName (String)
  - dosage (String) - e.g., "500mg"
  - frequency (String) - e.g., "2 times a day"
  - duration (String) - e.g., "7 days"
  - quantity (Integer)
  - instructions (Text, nullable)
  - order (Integer) - display order
```

**Frontend Pages**:
- `/dashboard/prescriptions` - Prescription list
- `/dashboard/prescriptions/new` - Create prescription
- `/dashboard/prescriptions/:id` - Prescription detail
- `/dashboard/prescriptions/:id/print` - Print prescription

---

### 6. Lab Reports
**Purpose**: Manage lab test orders and results

**Backend Modules Needed**:
- `lab-reports/` module
  - `lab-reports.controller.ts`
  - `lab-reports.service.ts`
  - `entities/lab-report.entity.ts`
  - `entities/lab-test.entity.ts` - individual test items
  - `dto/create-lab-report.dto.ts`

**Database Schema**:
```sql
lab_reports:
  - id (UUID, PK)
  - clinicId (UUID, FK)
  - patientId (UUID, FK to patients)
  - appointmentId (UUID, FK to appointments, nullable)
  - doctorId (UUID, FK to doctors)
  - reportNumber (String, unique)
  - orderDate (Date)
  - collectionDate (Date, nullable)
  - reportDate (Date, nullable)
  - status (Enum: ordered, sample-collected, in-progress, completed, cancelled)
  - notes (Text, nullable)
  - reportFile (String, nullable) - PDF URL
  - createdAt (Timestamp)
  - updatedAt (Timestamp)

lab_tests:
  - id (UUID, PK)
  - labReportId (UUID, FK to lab_reports)
  - testName (String)
  - testCode (String, nullable)
  - result (Text, nullable)
  - normalRange (String, nullable)
  - unit (String, nullable)
  - status (Enum: pending, completed, abnormal)
  - notes (Text, nullable)
```

**Frontend Pages**:
- `/dashboard/lab-reports` - Lab report list
- `/dashboard/lab-reports/new` - Order lab test
- `/dashboard/lab-reports/:id` - Lab report detail
- `/dashboard/lab-reports/:id/upload` - Upload results

---

### 7. Patient Billing
**Purpose**: Generate bills, manage payments, invoices for patient services

**Backend Modules Needed**:
- `patient-billing/` module
  - `patient-billing.controller.ts`
  - `patient-billing.service.ts`
  - `entities/patient-bill.entity.ts`
  - `entities/bill-item.entity.ts`
  - `dto/create-bill.dto.ts`
  - `dto/payment.dto.ts`

**Database Schema**:
```sql
patient_bills:
  - id (UUID, PK)
  - clinicId (UUID, FK)
  - patientId (UUID, FK to patients)
  - appointmentId (UUID, FK to appointments, nullable)
  - billNumber (String, unique)
  - billDate (Date)
  - dueDate (Date, nullable)
  - subtotal (Decimal)
  - discount (Decimal, default 0)
  - tax (Decimal, default 0)
  - total (Decimal)
  - paidAmount (Decimal, default 0)
  - balance (Decimal)
  - status (Enum: draft, pending, partial, paid, cancelled)
  - paymentMethod (Enum: cash, card, online, cheque, nullable)
  - notes (Text, nullable)
  - createdAt (Timestamp)
  - updatedAt (Timestamp)

bill_items:
  - id (UUID, PK)
  - billId (UUID, FK to patient_bills)
  - itemType (Enum: consultation, medicine, lab-test, procedure, other)
  - itemName (String)
  - quantity (Integer, default 1)
  - unitPrice (Decimal)
  - discount (Decimal, default 0)
  - total (Decimal)
  - description (Text, nullable)
```

**Frontend Pages**:
- `/dashboard/billing` - Bill list
- `/dashboard/billing/new` - Create bill
- `/dashboard/billing/:id` - Bill detail
- `/dashboard/billing/:id/payment` - Record payment
- `/dashboard/billing/:id/print` - Print invoice

---

## New User Roles

Consider adding:
- `doctor` - Doctors with user accounts
- `receptionist` - Front desk staff
- `lab_technician` - Lab staff
- `pharmacist` - Pharmacy staff (if you add pharmacy module)

## Implementation Priority

### Phase 1: Core HMS (MVP)
1. ✅ Patient Management
2. ✅ Doctor Management
3. ✅ Appointment Scheduling

### Phase 2: Clinical Operations
4. ✅ Medical Records
5. ✅ Prescription Management

### Phase 3: Diagnostics & Billing
6. ✅ Lab Reports
7. ✅ Patient Billing

## Integration Points

### With Existing B2B Marketplace:
- **Clinic Users** can access both:
  - B2B features: `/dashboard/orders`, `/dashboard/products`
  - HMS features: `/dashboard/patients`, `/dashboard/appointments`
- **Shared Clinic Entity**: Both systems use the same `clinicId`
- **Unified Dashboard**: Show both B2B and HMS stats

### Database Considerations:
- All HMS tables should include `clinicId` for multi-tenancy
- Use soft deletes where appropriate (add `deletedAt` column)
- Add proper indexes on foreign keys and frequently queried fields
- Consider audit logging for sensitive medical data

## Security & Compliance

### HIPAA/Medical Data Compliance:
- Encrypt sensitive patient data at rest
- Audit logs for all medical record access
- Role-based access control (RBAC)
- Secure file storage for medical documents
- Patient data anonymization for analytics

### Access Control:
- Doctors can only see their own patients/appointments
- Receptionists can schedule but not view full medical records
- Admins have full access
- Patients (if portal added) can only see their own data

## Next Steps

1. **Database Migration**: Create migration files for all new tables
2. **Backend Modules**: Implement each module following NestJS patterns
3. **Frontend Pages**: Create React components and pages
4. **API Integration**: Connect frontend to backend APIs
5. **Testing**: Unit tests, integration tests
6. **Documentation**: API docs, user guides

## File Structure

```
backend/src/
├── patients/
│   ├── patients.module.ts
│   ├── patients.controller.ts
│   ├── patients.service.ts
│   ├── entities/
│   │   └── patient.entity.ts
│   └── dto/
│       ├── create-patient.dto.ts
│       └── update-patient.dto.ts
├── appointments/
├── doctors/
├── medical-records/
├── prescriptions/
├── lab-reports/
└── patient-billing/

frontend/src/
├── pages/dashboard/
│   ├── PatientsPage.tsx
│   ├── AppointmentsPage.tsx
│   ├── DoctorsPage.tsx
│   ├── MedicalRecordsPage.tsx
│   ├── PrescriptionsPage.tsx
│   ├── LabReportsPage.tsx
│   └── BillingPage.tsx
├── components/
│   ├── patients/
│   ├── appointments/
│   ├── doctors/
│   └── ...
└── lib/api/
    ├── patients.ts
    ├── appointments.ts
    ├── doctors.ts
    └── ...
```




