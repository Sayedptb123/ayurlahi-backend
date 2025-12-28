# Frontend Update Guide - Matching Backend Changes

## Overview

This guide helps you systematically update the frontend to match the backend API changes, particularly around field and column name updates.

## Important: Naming Convention

**Backend API returns camelCase** (TypeScript/JavaScript standard):
- Database columns: `snake_case` (e.g., `first_name`, `clinic_id`)
- Backend entities: `camelCase` (e.g., `firstName`, `clinicId`)
- **API responses: `camelCase`** (e.g., `firstName`, `clinicId`) ✅
- **Frontend should use: `camelCase`** ✅

**DO NOT use snake_case in the frontend** - the API returns camelCase!

---

## Step-by-Step Update Process

### Step 1: Identify What Changed

1. **Check Backend Entity Files** (in `src/*/entities/*.entity.ts`)
   - These define what the API returns
   - Properties are in camelCase
   - Column names (in `@Column({ name: '...' })`) are in snake_case (for database only)

2. **Test API Endpoints** to see actual response structure:
   ```bash
   # Example: Check user response
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/me
   
   # Example: Check patient response
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/patients
   ```

3. **Compare with Frontend Types** in your frontend codebase:
   - Check `src/types/*.ts` or similar
   - Check API client files
   - Check component props and state

### Step 2: Update Frontend Type Definitions

Update TypeScript interfaces/types to match backend entities:

#### User Entity
```typescript
interface User {
  id: string;
  email: string;
  firstName: string;        // ✅ camelCase
  lastName: string;         // ✅ camelCase
  role: 'clinic' | 'manufacturer' | 'admin' | 'support';
  phone: string | null;
  landphone: string | null;
  mobileNumbers: string[] | null;
  whatsappNumber: string | null;  // ✅ camelCase
  isActive: boolean;              // ✅ camelCase
  isEmailVerified: boolean;       // ✅ camelCase
  clinicId: string | null;        // ✅ camelCase
  manufacturerId: string | null;  // ✅ camelCase
  createdAt: Date;                // ✅ camelCase
  updatedAt: Date;                // ✅ camelCase
  lastLoginAt: Date | null;        // ✅ camelCase
}
```

#### Patient Entity
```typescript
interface Patient {
  id: string;
  clinicId: string;              // ✅ camelCase
  patientId: string;             // ✅ camelCase
  firstName: string;             // ✅ camelCase
  lastName: string;             // ✅ camelCase
  dateOfBirth: Date | null;     // ✅ camelCase
  gender: 'male' | 'female' | 'other' | null;
  phone: string | null;
  email: string | null;
  address: {
    street?: string;
    city?: string;
    district?: string;
    state?: string;
    zipCode?: string;           // ✅ camelCase
    country?: string;
  } | null;
  emergencyContact: {            // ✅ camelCase
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
  } | null;
  bloodGroup: string | null;     // ✅ camelCase
  allergies: string[] | null;
  medicalHistory: string | null; // ✅ camelCase
  createdAt: Date;               // ✅ camelCase
  updatedAt: Date;               // ✅ camelCase
}
```

#### Staff Entity
```typescript
interface Staff {
  id: string;
  organizationId: string;         // ✅ camelCase
  organizationType: 'clinic' | 'manufacturer'; // ✅ camelCase
  firstName: string;             // ✅ camelCase
  lastName: string;              // ✅ camelCase
  position: string;
  positionCustom: string | null;  // ✅ camelCase
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null; // ✅ camelCase
  addressStreet: string | null;   // ✅ camelCase
  addressCity: string | null;     // ✅ camelCase
  addressDistrict: string | null; // ✅ camelCase
  addressState: string | null;    // ✅ camelCase
  addressZipCode: string | null;  // ✅ camelCase
  addressCountry: string | null;  // ✅ camelCase
  dateOfBirth: Date | null;       // ✅ camelCase
  dateOfJoining: Date | null;     // ✅ camelCase
  createdAt: Date;                // ✅ camelCase
  updatedAt: Date;                // ✅ camelCase
}
```

### Step 3: Update API Client Files

Ensure your API client files use camelCase when sending/receiving data:

```typescript
// ✅ Good - matches API response
interface CreatePatientRequest {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date string
  gender: 'male' | 'female' | 'other';
  // ... other fields in camelCase
}

// ❌ Bad - using snake_case
interface CreatePatientRequest {
  patient_id: string;  // ❌ Wrong!
  first_name: string;  // ❌ Wrong!
  // ...
}
```

### Step 4: Update Component Code

Update all component code to use camelCase:

```typescript
// ✅ Good
const patient = {
  firstName: data.firstName,
  lastName: data.lastName,
  dateOfBirth: data.dateOfBirth,
  clinicId: data.clinicId,
};

// ❌ Bad
const patient = {
  first_name: data.first_name,  // ❌ Wrong!
  last_name: data.last_name,     // ❌ Wrong!
  // ...
};
```

### Step 5: Update Form Fields

Update form field names to match API:

```typescript
// ✅ Good - form field names match API
<Input
  name="firstName"
  value={formData.firstName}
  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
/>

// ❌ Bad
<Input
  name="first_name"  // ❌ Wrong!
  value={formData.first_name}  // ❌ Wrong!
/>
```

---

## Complete Entity Reference

### All Backend Entities (API Response Format)

#### 1. User (`/api/auth/me`, `/api/users`)
```typescript
{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone: string | null;
  landphone: string | null;
  mobileNumbers: string[] | null;
  whatsappNumber: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  clinicId: string | null;
  manufacturerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}
```

#### 2. Patient (`/api/patients`)
```typescript
{
  id: string;
  clinicId: string;
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  gender: 'male' | 'female' | 'other' | null;
  phone: string | null;
  email: string | null;
  address: Address | null;
  emergencyContact: EmergencyContact | null;
  bloodGroup: string | null;
  allergies: string[] | null;
  medicalHistory: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 3. Doctor (`/api/doctors`)
```typescript
{
  id: string;
  clinicId: string;
  firstName: string;
  lastName: string;
  specialization: string;
  qualification: string;
  licenseNumber: string;
  phone: string | null;
  email: string | null;
  consultationFee: number;
  isActive: boolean;
  schedule: Schedule | null;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 4. Appointment (`/api/appointments`)
```typescript
{
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string;
  appointmentDate: Date;
  appointmentTime: string;
  duration: number;
  appointmentType: string;
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 5. Medical Record (`/api/medical-records`)
```typescript
{
  id: string;
  clinicId: string;
  patientId: string;
  appointmentId: string | null;
  doctorId: string;
  visitDate: Date;
  chiefComplaint: string;
  diagnosis: string;
  treatment: string;
  vitals: Vitals | null;
  notes: string | null;
  attachments: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 6. Prescription (`/api/prescriptions`)
```typescript
{
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null;
  prescriptionDate: Date;
  diagnosis: string;
  notes: string | null;
  status: 'active' | 'completed' | 'cancelled';
  items: PrescriptionItem[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### 7. Lab Report (`/api/lab-reports`)
```typescript
{
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null;
  reportDate: Date;
  reportNumber: string;
  status: 'ordered' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  tests: LabTest[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### 8. Patient Bill (`/api/patient-billing`)
```typescript
{
  id: string;
  clinicId: string;
  patientId: string;
  appointmentId: string | null;
  billNumber: string;
  billDate: Date;
  dueDate: Date;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  paymentMethod: string | null;
  notes: string | null;
  items: BillItem[];
  payments: Payment[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### 9. Order (`/api/orders`)
```typescript
{
  id: string;
  clinicId: string;
  orderNumber: string;
  status: OrderStatus;
  source: 'web' | 'whatsapp';
  whatsappMessageId: string | null;
  razorpayOrderId: string | null;
  subtotal: number;
  gstAmount: number;
  shippingCharges: number;
  platformFee: number;
  totalAmount: number;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingDistrict: string | null;
  shippingState: string | null;
  shippingPincode: string | null;
  shippingPhone: string | null;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
```

#### 10. Clinic (`/api/clinics`)
```typescript
{
  id: string;
  userId: string;
  clinicName: string;
  gstin: string | null;
  licenseNumber: string;
  address: string;
  city: string;
  district: string | null;
  state: string;
  pincode: string;
  country: string;
  phone: string | null;
  whatsappNumber: string | null;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejectionReason: string | null;
  documents: Record<string, any> | null;
  isVerified: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
```

#### 11. Staff (`/api/staff`)
```typescript
{
  id: string;
  organizationId: string;
  organizationType: 'clinic' | 'manufacturer';
  firstName: string;
  lastName: string;
  position: string;
  positionCustom: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressDistrict: string | null;
  addressState: string | null;
  addressZipCode: string | null;
  addressCountry: string | null;
  dateOfBirth: Date | null;
  dateOfJoining: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Common Field Name Patterns

### Date Fields
- `createdAt` (not `created_at`)
- `updatedAt` (not `updated_at`)
- `deletedAt` (not `deleted_at`)
- `dateOfBirth` (not `date_of_birth`)
- `appointmentDate` (not `appointment_date`)
- `visitDate` (not `visit_date`)

### ID Fields
- `clinicId` (not `clinic_id`)
- `patientId` (not `patient_id`)
- `doctorId` (not `doctor_id`)
- `appointmentId` (not `appointment_id`)
- `organizationId` (not `organization_id`)

### Boolean Fields
- `isActive` (not `is_active`)
- `isEmailVerified` (not `is_email_verified`)
- `isVerified` (not `is_verified`)

### Compound Names
- `firstName` (not `first_name`)
- `lastName` (not `last_name`)
- `whatsappNumber` (not `whatsapp_number`)
- `bloodGroup` (not `blood_group`)
- `emergencyContact` (not `emergency_contact`)
- `medicalHistory` (not `medical_history`)

---

## Verification Checklist

Before deploying frontend updates:

- [ ] All TypeScript interfaces use camelCase
- [ ] All API client functions use camelCase for request/response
- [ ] All form field names use camelCase
- [ ] All component state/props use camelCase
- [ ] All variable names in components use camelCase
- [ ] Test all API calls to verify data structure
- [ ] Check browser console for any field name errors
- [ ] Verify forms submit with correct field names
- [ ] Test CRUD operations for all entities

---

## Quick Test Script

Add this to your frontend to test API responses:

```typescript
// Test API response structure
async function testAPIStructure() {
  const token = localStorage.getItem('authToken');
  
  const endpoints = [
    '/api/auth/me',
    '/api/patients',
    '/api/doctors',
    '/api/appointments',
    // ... add more
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      console.log(`✅ ${endpoint}:`, data);
      
      // Check for snake_case (should not exist)
      const jsonString = JSON.stringify(data);
      if (jsonString.includes('_') && !jsonString.includes('__')) {
        console.warn(`⚠️ ${endpoint} might have snake_case fields`);
      }
    } catch (error) {
      console.error(`❌ ${endpoint}:`, error);
    }
  }
}
```

---

## Migration Strategy

### Option 1: Gradual Update (Recommended)
1. Start with one entity (e.g., User)
2. Update types → API client → components
3. Test thoroughly
4. Move to next entity

### Option 2: Bulk Update
1. Update all types first
2. Update all API clients
3. Update all components
4. Test everything at once

### Option 3: Automated Script
Create a script to find/replace common patterns:
```bash
# Find all snake_case patterns in frontend
grep -r "first_name\|last_name\|clinic_id" src/
```

---

## Common Issues & Solutions

### Issue: "Property 'first_name' does not exist"
**Solution**: Change to `firstName` (camelCase)

### Issue: Form submission fails
**Solution**: Check form field names match API expected format (camelCase)

### Issue: TypeScript errors about missing properties
**Solution**: Update TypeScript interfaces to match backend entities

### Issue: Data not displaying
**Solution**: Check if you're accessing properties with correct casing (camelCase)

---

## Next Steps

1. **Review this guide** and understand the naming convention
2. **Test your API endpoints** to see actual response structure
3. **Update frontend types** to match backend entities
4. **Update API clients** to use camelCase
5. **Update components** to use camelCase
6. **Test thoroughly** before deploying

---

## Support

If you encounter issues:
1. Check backend entity files in `src/*/entities/*.entity.ts`
2. Test API endpoints directly (curl or Postman)
3. Check browser console for errors
4. Verify API response structure matches your frontend types

---

**Last Updated**: Based on backend entities as of latest migration
**Maintained By**: Development Team

