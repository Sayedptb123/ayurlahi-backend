# HMS Frontend Implementation Plan

## 🎯 Overview

This document outlines the frontend implementation for the Hospital Management System (HMS) features.

## 📋 Technology Stack

Based on backend configuration:
- **Framework**: React with TypeScript
- **Build Tool**: Vite (port 5173)
- **State Management**: React Query / SWR (recommended) or Context API
- **Routing**: React Router
- **UI Library**: Tailwind CSS (recommended) or Material-UI
- **HTTP Client**: Axios or Fetch API
- **Form Handling**: React Hook Form + Zod (recommended)

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts              # Axios instance with auth
│   │   ├── patients.ts            # Patient API calls
│   │   ├── doctors.ts             # Doctor API calls
│   │   ├── appointments.ts        # Appointment API calls
│   │   ├── medical-records.ts     # Medical Records API calls
│   │   ├── prescriptions.ts      # Prescription API calls
│   │   ├── lab-reports.ts         # Lab Reports API calls
│   │   └── patient-billing.ts    # Billing API calls
│   ├── types/
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
│   │   │   └── PatientCard.tsx
│   │   ├── appointments/
│   │   │   ├── AppointmentCalendar.tsx
│   │   │   ├── AppointmentForm.tsx
│   │   │   └── AppointmentCard.tsx
│   │   └── ... (similar for other modules)
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePatients.ts
│   │   └── ... (custom hooks for each module)
│   ├── utils/
│   │   ├── date.ts
│   │   ├── format.ts
│   │   └── validation.ts
│   └── App.tsx
├── package.json
└── vite.config.ts
```

## 📄 Pages to Implement

### 1. Patients Management
- **List Page**: `/dashboard/patients`
  - Table with search, filter, pagination
  - Actions: View, Edit, Delete, Add New
- **Create/Edit Page**: `/dashboard/patients/new` or `/dashboard/patients/:id/edit`
  - Form with validation
  - Fields: name, dateOfBirth, gender, phone, email, address, etc.
- **Detail Page**: `/dashboard/patients/:id`
  - Patient info, medical history, appointments, bills

### 2. Doctors Management
- **List Page**: `/dashboard/doctors`
  - Table with specialties, availability
- **Create/Edit Page**: `/dashboard/doctors/new` or `/dashboard/doctors/:id/edit`
- **Detail Page**: `/dashboard/doctors/:id`
  - Doctor info, schedule, appointments

### 3. Appointments
- **Calendar View**: `/dashboard/appointments`
  - Calendar with time slots
  - Filter by doctor, date, status
- **List View**: `/dashboard/appointments/list`
  - Table view with filters
- **Create/Edit**: `/dashboard/appointments/new` or `/dashboard/appointments/:id/edit`
- **Detail**: `/dashboard/appointments/:id`

### 4. Medical Records
- **List Page**: `/dashboard/medical-records`
  - Filter by patient, doctor, date
- **Create/Edit**: `/dashboard/medical-records/new` or `/dashboard/medical-records/:id/edit`
- **Detail**: `/dashboard/medical-records/:id`
  - View full record, attachments

### 5. Prescriptions
- **List Page**: `/dashboard/prescriptions`
  - Filter by patient, doctor, status
- **Create**: `/dashboard/prescriptions/new`
- **Detail**: `/dashboard/prescriptions/:id`
  - View prescription, print option

### 6. Lab Reports
- **List Page**: `/dashboard/lab-reports`
  - Filter by patient, status, date
- **Create Order**: `/dashboard/lab-reports/new`
- **Detail**: `/dashboard/lab-reports/:id`
  - View results, upload PDF

### 7. Patient Billing
- **List Page**: `/dashboard/billing`
  - Filter by patient, status, date range
- **Create Bill**: `/dashboard/billing/new`
- **Detail**: `/dashboard/billing/:id`
  - View bill, record payment, print invoice

## 🔌 API Integration

### Base API Client Setup

```typescript
// src/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
```

## 🎨 UI Components Needed

1. **Data Tables**: With sorting, filtering, pagination
2. **Forms**: With validation and error handling
3. **Modals**: For confirmations, quick actions
4. **Calendar**: For appointment scheduling
5. **Status Badges**: For appointment status, bill status, etc.
6. **Date Pickers**: For date inputs
7. **File Upload**: For lab reports, medical record attachments

## 🔐 Authentication

- Store JWT token in localStorage or httpOnly cookie
- Add token to all API requests
- Handle token expiration and refresh
- Redirect to login if unauthorized

## 📱 Responsive Design

- Mobile-friendly tables (cards on mobile)
- Responsive forms
- Touch-friendly buttons and inputs

## ✅ Implementation Checklist

- [ ] Setup project structure
- [ ] Create API client with auth
- [ ] Implement Patients module (CRUD)
- [ ] Implement Doctors module (CRUD)
- [ ] Implement Appointments module (Calendar + CRUD)
- [ ] Implement Medical Records module (CRUD)
- [ ] Implement Prescriptions module (CRUD)
- [ ] Implement Lab Reports module (CRUD)
- [ ] Implement Patient Billing module (CRUD)
- [ ] Add routing
- [ ] Add navigation menu
- [ ] Add error handling
- [ ] Add loading states
- [ ] Add form validation
- [ ] Add responsive design
- [ ] Testing

## 🚀 Next Steps

1. Create frontend project structure
2. Setup API client
3. Implement each module one by one
4. Add routing and navigation
5. Test integration with backend

