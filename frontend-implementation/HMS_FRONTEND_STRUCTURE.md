# HMS Frontend Implementation Structure

## 📁 Complete File Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts
│   │   ├── patients.ts
│   │   ├── doctors.ts
│   │   ├── appointments.ts
│   │   ├── medical-records.ts
│   │   ├── prescriptions.ts
│   │   ├── lab-reports.ts
│   │   └── patient-billing.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── patient.ts
│   │   ├── doctor.ts
│   │   ├── appointment.ts
│   │   ├── medical-record.ts
│   │   ├── prescription.ts
│   │   ├── lab-report.ts
│   │   └── billing.ts
│   ├── pages/
│   │   └── dashboard/
│   │       ├── PatientsPage.tsx
│   │       ├── DoctorsPage.tsx
│   │       ├── AppointmentsPage.tsx
│   │       ├── MedicalRecordsPage.tsx
│   │       ├── PrescriptionsPage.tsx
│   │       ├── LabReportsPage.tsx
│   │       └── BillingPage.tsx
│   ├── components/
│   │   ├── patients/
│   │   │   ├── PatientList.tsx
│   │   │   ├── PatientForm.tsx
│   │   │   ├── PatientCard.tsx
│   │   │   └── PatientDetail.tsx
│   │   ├── appointments/
│   │   │   ├── AppointmentCalendar.tsx
│   │   │   ├── AppointmentForm.tsx
│   │   │   └── AppointmentCard.tsx
│   │   └── shared/
│   │       ├── DataTable.tsx
│   │       ├── StatusBadge.tsx
│   │       ├── Modal.tsx
│   │       └── LoadingSpinner.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePatients.ts
│   │   ├── useDoctors.ts
│   │   └── useAppointments.ts
│   ├── utils/
│   │   ├── date.ts
│   │   ├── format.ts
│   │   └── validation.ts
│   └── App.tsx
└── package.json
```

## 🚀 Quick Start

1. **Create React + Vite project**:
   ```bash
   npm create vite@latest frontend -- --template react-ts
   cd frontend
   npm install
   ```

2. **Install dependencies**:
   ```bash
   npm install axios react-router-dom react-hook-form @hookform/resolvers zod
   npm install -D @types/react-router-dom
   ```

3. **Copy the implementation files** from this directory

4. **Update API base URL** in `src/api/client.ts`

5. **Start development server**:
   ```bash
   npm run dev
   ```

