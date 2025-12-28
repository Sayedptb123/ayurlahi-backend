# Frontend Field Reference - Quick Lookup

Quick reference for all API response field names (camelCase format).

## 🔑 Key Rule
**All API responses use camelCase** - NOT snake_case!

---

## User Fields
```typescript
id, email, firstName, lastName, role, phone, landphone, 
mobileNumbers, whatsappNumber, isActive, isEmailVerified, 
clinicId, manufacturerId, createdAt, updatedAt, lastLoginAt
```

## Patient Fields
```typescript
id, clinicId, patientId, firstName, lastName, dateOfBirth, 
gender, phone, email, address, emergencyContact, bloodGroup, 
allergies, medicalHistory, createdAt, updatedAt
```

## Doctor Fields
```typescript
id, clinicId, firstName, lastName, specialization, 
qualification, licenseNumber, phone, email, consultationFee, 
isActive, schedule, createdAt, updatedAt
```

## Appointment Fields
```typescript
id, clinicId, patientId, doctorId, appointmentDate, 
appointmentTime, duration, appointmentType, reason, status, 
notes, createdAt, updatedAt
```

## Medical Record Fields
```typescript
id, clinicId, patientId, appointmentId, doctorId, visitDate, 
chiefComplaint, diagnosis, treatment, vitals, notes, 
attachments, createdAt, updatedAt
```

## Prescription Fields
```typescript
id, clinicId, patientId, doctorId, appointmentId, 
prescriptionDate, diagnosis, notes, status, items, 
createdAt, updatedAt
```

## Lab Report Fields
```typescript
id, clinicId, patientId, doctorId, appointmentId, reportDate, 
reportNumber, status, notes, tests, createdAt, updatedAt
```

## Patient Bill Fields
```typescript
id, clinicId, patientId, appointmentId, billNumber, billDate, 
dueDate, subtotal, discount, tax, total, paid, balance, 
status, paymentMethod, notes, items, payments, createdAt, updatedAt
```

## Order Fields
```typescript
id, clinicId, orderNumber, status, source, whatsappMessageId, 
razorpayOrderId, subtotal, gstAmount, shippingCharges, 
platformFee, totalAmount, shippingAddress, shippingCity, 
shippingDistrict, shippingState, shippingPincode, shippingPhone, 
items, createdAt, updatedAt, deletedAt
```

## Clinic Fields
```typescript
id, userId, clinicName, gstin, licenseNumber, address, city, 
district, state, pincode, country, phone, whatsappNumber, 
approvalStatus, rejectionReason, documents, isVerified, 
approvedAt, approvedBy, createdAt, updatedAt, deletedAt
```

## Staff Fields
```typescript
id, organizationId, organizationType, firstName, lastName, 
position, positionCustom, email, phone, whatsappNumber, 
addressStreet, addressCity, addressDistrict, addressState, 
addressZipCode, addressCountry, dateOfBirth, dateOfJoining, 
createdAt, updatedAt
```

---

## Common Patterns

### ✅ CORRECT (camelCase)
- `firstName`
- `lastName`
- `clinicId`
- `dateOfBirth`
- `isActive`
- `createdAt`
- `whatsappNumber`
- `emergencyContact`

### ❌ WRONG (snake_case)
- `first_name` ❌
- `last_name` ❌
- `clinic_id` ❌
- `date_of_birth` ❌
- `is_active` ❌
- `created_at` ❌
- `whatsapp_number` ❌
- `emergency_contact` ❌

---

## Quick Find & Replace Guide

If you find snake_case in your frontend, replace with camelCase:

| Wrong (snake_case) | Correct (camelCase) |
|-------------------|---------------------|
| `first_name` | `firstName` |
| `last_name` | `lastName` |
| `clinic_id` | `clinicId` |
| `patient_id` | `patientId` |
| `doctor_id` | `doctorId` |
| `appointment_id` | `appointmentId` |
| `date_of_birth` | `dateOfBirth` |
| `appointment_date` | `appointmentDate` |
| `visit_date` | `visitDate` |
| `is_active` | `isActive` |
| `is_verified` | `isVerified` |
| `is_email_verified` | `isEmailVerified` |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |
| `deleted_at` | `deletedAt` |
| `whatsapp_number` | `whatsappNumber` |
| `blood_group` | `bloodGroup` |
| `emergency_contact` | `emergencyContact` |
| `medical_history` | `medicalHistory` |
| `organization_id` | `organizationId` |
| `organization_type` | `organizationType` |
| `position_custom` | `positionCustom` |
| `address_street` | `addressStreet` |
| `address_city` | `addressCity` |
| `address_district` | `addressDistrict` |
| `address_state` | `addressState` |
| `address_zip_code` | `addressZipCode` |
| `address_country` | `addressCountry` |
| `date_of_joining` | `dateOfJoining` |
| `approval_status` | `approvalStatus` |
| `rejection_reason` | `rejectionReason` |
| `approved_at` | `approvedAt` |
| `approved_by` | `approvedBy` |
| `last_login_at` | `lastLoginAt` |
| `mobile_numbers` | `mobileNumbers` |
| `shipping_address` | `shippingAddress` |
| `shipping_city` | `shippingCity` |
| `shipping_district` | `shippingDistrict` |
| `shipping_state` | `shippingState` |
| `shipping_pincode` | `shippingPincode` |
| `shipping_phone` | `shippingPhone` |
| `order_number` | `orderNumber` |
| `gst_amount` | `gstAmount` |
| `shipping_charges` | `shippingCharges` |
| `platform_fee` | `platformFee` |
| `total_amount` | `totalAmount` |
| `whatsapp_message_id` | `whatsappMessageId` |
| `razorpay_order_id` | `razorpayOrderId` |
| `bill_number` | `billNumber` |
| `bill_date` | `billDate` |
| `due_date` | `dueDate` |
| `payment_method` | `paymentMethod` |
| `report_number` | `reportNumber` |
| `report_date` | `reportDate` |
| `prescription_date` | `prescriptionDate` |
| `chief_complaint` | `chiefComplaint` |
| `license_number` | `licenseNumber` |
| `consultation_fee` | `consultationFee` |

---

## Testing Checklist

Use this to verify your frontend matches the backend:

```typescript
// Test that API returns camelCase
const testFields = [
  'firstName', 'lastName', 'clinicId', 'patientId', 
  'dateOfBirth', 'isActive', 'createdAt', 'whatsappNumber'
];

// Should NOT find these:
const wrongFields = [
  'first_name', 'last_name', 'clinic_id', 'patient_id',
  'date_of_birth', 'is_active', 'created_at', 'whatsapp_number'
];
```

---

**Remember**: Database uses snake_case, but API returns camelCase!

