# Frontend HMS API Integration Prompt

Copy and paste this prompt into your frontend Cursor chat:

---

## Prompt for Frontend Cursor Chat

```
I need to integrate the HMS (Hospital Management System) APIs into the frontend React application. 

### Current Status:
The frontend already has:
- ✅ TypeScript types defined in `src/types/index.ts` for all HMS entities (Patient, Doctor, Appointment, MedicalRecord, Prescription, LabReport, PatientBill)
- ✅ API client files created in `src/lib/api/` for all 7 HMS modules (patients.ts, doctors.ts, appointments.ts, medical-records.ts, prescriptions.ts, lab-reports.ts, patient-billing.ts)
- ✅ Page components created in `src/pages/dashboard/` (PatientsPage, DoctorsPage, AppointmentsPage, MedicalRecordsPage, PrescriptionsPage, LabReportsPage, PatientBillingPage)
- ✅ Routes added to `src/App.tsx` with role-based protection (clinic and admin only)
- ✅ Navigation updated in `src/components/layout/DashboardLayout.tsx` with HMS menu items

### What Needs to Be Done:

1. **Create Form/Modal Components** for creating and editing HMS entities:
   - `src/components/patients/CreatePatientModal.tsx` - Form to create new patients
   - `src/components/patients/EditPatientModal.tsx` - Form to edit existing patients
   - `src/components/doctors/CreateDoctorModal.tsx` - Form to create new doctors
   - `src/components/doctors/EditDoctorModal.tsx` - Form to edit existing doctors
   - `src/components/appointments/CreateAppointmentModal.tsx` - Form to book appointments
   - `src/components/medical-records/CreateMedicalRecordModal.tsx` - Form to create medical records
   - `src/components/prescriptions/CreatePrescriptionModal.tsx` - Form to create prescriptions (with dynamic items array)
   - `src/components/lab-reports/CreateLabReportModal.tsx` - Form to order lab tests (with dynamic tests array)
   - `src/components/patient-billing/CreateBillModal.tsx` - Form to create bills (with dynamic items array)
   - `src/components/patient-billing/PaymentModal.tsx` - Form to record payments

2. **Update Existing Pages** to use the modals:
   - Connect "Add Patient" button in `PatientsPage.tsx` to `CreatePatientModal`
   - Connect "Edit" button in `PatientsPage.tsx` to `EditPatientModal`
   - Do the same for all other pages (Doctors, Appointments, Medical Records, Prescriptions, Lab Reports, Patient Billing)

3. **Add Detail View Pages** (optional but recommended):
   - `src/pages/dashboard/PatientDetailPage.tsx` - Show patient details with medical history, appointments, prescriptions
   - `src/pages/dashboard/DoctorDetailPage.tsx` - Show doctor profile with schedule and appointments
   - `src/pages/dashboard/AppointmentDetailPage.tsx` - Show appointment details
   - `src/pages/dashboard/PrescriptionDetailPage.tsx` - Show prescription with print functionality
   - `src/pages/dashboard/LabReportDetailPage.tsx` - Show lab report with test results
   - `src/pages/dashboard/BillDetailPage.tsx` - Show bill details with payment history

### API Documentation:
The complete API documentation is available in the backend at `HMS_API_DOCUMENTATION.md`. Key endpoints:

**Base URL**: `http://localhost:3000/api`

**Authentication**: All endpoints require JWT Bearer token in Authorization header

**Endpoints**:
- `GET /api/patients` - List patients (query params: page, limit, search, gender)
- `POST /api/patients` - Create patient
- `GET /api/patients/:id` - Get single patient
- `PATCH /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient

- `GET /api/doctors` - List doctors (query params: page, limit, search, specialization, isActive)
- `POST /api/doctors` - Create doctor
- `GET /api/doctors/:id` - Get single doctor
- `PATCH /api/doctors/:id` - Update doctor
- `DELETE /api/doctors/:id` - Delete doctor

- `GET /api/appointments` - List appointments (query params: page, limit, patientId, doctorId, status, date, startDate, endDate)
- `POST /api/appointments` - Create appointment
- `GET /api/appointments/:id` - Get single appointment
- `PATCH /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Delete appointment

- `GET /api/medical-records` - List medical records (query params: page, limit, patientId, doctorId, appointmentId)
- `POST /api/medical-records` - Create medical record
- `GET /api/medical-records/:id` - Get single medical record
- `PATCH /api/medical-records/:id` - Update medical record
- `DELETE /api/medical-records/:id` - Delete medical record

- `GET /api/prescriptions` - List prescriptions (query params: page, limit, patientId, doctorId, appointmentId, status)
- `POST /api/prescriptions` - Create prescription
- `GET /api/prescriptions/:id` - Get single prescription
- `PATCH /api/prescriptions/:id` - Update prescription
- `DELETE /api/prescriptions/:id` - Delete prescription

- `GET /api/lab-reports` - List lab reports (query params: page, limit, patientId, doctorId, appointmentId, status)
- `POST /api/lab-reports` - Create lab report
- `GET /api/lab-reports/:id` - Get single lab report
- `PATCH /api/lab-reports/:id` - Update lab report
- `DELETE /api/lab-reports/:id` - Delete lab report

- `GET /api/patient-billing` - List bills (query params: page, limit, patientId, appointmentId, status)
- `POST /api/patient-billing` - Create bill
- `GET /api/patient-billing/:id` - Get single bill
- `PATCH /api/patient-billing/:id` - Update bill
- `POST /api/patient-billing/:id/payment` - Record payment
- `DELETE /api/patient-billing/:id` - Delete bill

### Implementation Requirements:

1. **Follow Existing Patterns**: 
   - Use the same pattern as `CreateStaffModal.tsx` and `EditStaffModal.tsx` in `src/components/staff/`
   - Use React Hook Form with Zod validation
   - Use the existing UI components from `src/components/ui/` (Dialog, Button, Input, etc.)
   - Use React Query mutations for create/update/delete operations

2. **Form Validation**:
   - Use Zod schemas for validation (similar to staff modals)
   - Validate required fields according to API documentation
   - Show appropriate error messages

3. **Dynamic Arrays**:
   - For Prescriptions: Allow adding/removing prescription items dynamically
   - For Lab Reports: Allow adding/removing test items dynamically
   - For Bills: Allow adding/removing bill items dynamically
   - Use `useFieldArray` from react-hook-form (like in CreateStaffModal)

4. **Data Fetching**:
   - Use React Query `useQuery` for fetching lists and single items
   - Use React Query `useMutation` for create/update/delete operations
   - Invalidate queries after mutations to refresh data

5. **User Experience**:
   - Show loading states during API calls
   - Show success/error messages using alerts or toast notifications
   - Close modals after successful creation/update
   - Refresh data after mutations

6. **Date Handling**:
   - Use `date-fns` for date formatting (already installed)
   - Use HTML5 date inputs for date fields
   - Format dates as ISO strings (YYYY-MM-DD) when sending to API

7. **Select Dropdowns**:
   - For patient selection: Fetch patients list and show in dropdown
   - For doctor selection: Fetch doctors list and show in dropdown
   - For appointment selection: Fetch appointments list and show in dropdown
   - Use existing UI components or create select components

8. **Special Features**:
   - **Prescriptions**: Allow adding multiple medicine items with dosage, frequency, duration, quantity
   - **Lab Reports**: Allow adding multiple test items with test name, code, normal range, unit
   - **Bills**: Allow adding multiple bill items with item type, name, quantity, unit price
   - **Appointments**: Show doctor availability (if schedule is implemented)
   - **Payments**: Show current balance and allow partial payments

### Example Request Bodies:

**Create Patient**:
```json
{
  "patientId": "P001",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-01",
  "gender": "male",
  "phone": "1234567890",
  "email": "john.doe@example.com",
  "address": {
    "street": "123 Main St",
    "city": "City",
    "district": "District",
    "state": "State",
    "zipCode": "12345",
    "country": "Country"
  },
  "emergencyContact": {
    "name": "Jane Doe",
    "relationship": "Spouse",
    "phone": "0987654321"
  },
  "bloodGroup": "O+",
  "allergies": ["Penicillin"],
  "medicalHistory": "Previous surgery in 2020"
}
```

**Create Appointment**:
```json
{
  "patientId": "uuid",
  "doctorId": "uuid",
  "appointmentDate": "2025-12-25",
  "appointmentTime": "10:00",
  "duration": 30,
  "appointmentType": "consultation",
  "reason": "Regular checkup",
  "notes": "Follow-up appointment"
}
```

**Create Prescription**:
```json
{
  "patientId": "uuid",
  "doctorId": "uuid",
  "appointmentId": "uuid",
  "prescriptionDate": "2025-12-25",
  "diagnosis": "Viral infection",
  "notes": "Take with food",
  "items": [
    {
      "medicineName": "Paracetamol",
      "dosage": "500mg",
      "frequency": "Twice daily",
      "duration": "5 days",
      "quantity": 10,
      "instructions": "Take after meals",
      "order": 1
    }
  ]
}
```

**Create Bill**:
```json
{
  "patientId": "uuid",
  "appointmentId": "uuid",
  "billDate": "2025-12-25",
  "dueDate": "2025-12-30",
  "discount": 0,
  "tax": 50,
  "paymentMethod": "cash",
  "notes": "Payment received",
  "items": [
    {
      "itemType": "consultation",
      "itemName": "Consultation Fee",
      "description": "Regular consultation",
      "quantity": 1,
      "unitPrice": 500,
      "order": 1
    }
  ]
}
```

**Record Payment**:
```json
{
  "amount": 500,
  "paymentMethod": "cash",
  "paymentDate": "2025-12-25",
  "notes": "Partial payment"
}
```

### Priority:
1. Start with Patients and Doctors modals (simpler forms)
2. Then Appointments (requires patient/doctor selection)
3. Then Medical Records (requires patient/doctor/appointment selection)
4. Then Prescriptions (requires dynamic items array)
5. Then Lab Reports (requires dynamic tests array)
6. Finally Patient Billing (requires dynamic items array and payment functionality)

### Testing:
- Test with clinic user account: `clinic1@test.com` / `abc123123`
- Ensure all forms validate correctly
- Ensure API calls work with the backend
- Ensure data refreshes after create/update/delete operations

Please implement the form/modal components following the existing patterns and integrate them with the existing page components.
```

---

## Quick Copy Version (Shorter)

If you prefer a shorter version:

```
I need to integrate HMS APIs into the frontend. The API clients and page components are already created. I need form/modal components for creating and editing HMS entities (patients, doctors, appointments, medical records, prescriptions, lab reports, bills).

Follow the pattern of CreateStaffModal.tsx. Use React Hook Form with Zod validation. API documentation is in backend HMS_API_DOCUMENTATION.md.

Priority: Start with Patients and Doctors modals, then Appointments, then the rest.

All API endpoints are at /api/patients, /api/doctors, /api/appointments, /api/medical-records, /api/prescriptions, /api/lab-reports, /api/patient-billing. They require JWT Bearer token authentication.

Implement create and edit modals for all entities, connect them to the existing page components, and ensure proper form validation and error handling.
```



