# HMS API Documentation

Complete API documentation for the Hospital Management System (HMS) endpoints.

## Base URL

All HMS endpoints are prefixed with `/api/`:
```
http://localhost:3000/api
```

## Authentication

All HMS endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

To get a token, use the authentication endpoint:
```bash
POST /api/auth/login
```

---

## 1. Patients API (`/api/patients`)

### List Patients
**GET** `/api/patients`

Get a paginated list of patients for the current clinic.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `search` (string, optional): Search by name, patientId, phone, or email
- `gender` (string, optional): Filter by gender (`male`, `female`, `other`)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
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
      "medicalHistory": "Previous surgery in 2020",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/patients?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Get Single Patient
**GET** `/api/patients/:id`

Get a single patient by ID.

**Path Parameters:**
- `id` (UUID): Patient ID

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "clinicId": "uuid",
    "patientId": "P001",
    "firstName": "John",
    "lastName": "Doe",
    // ... other fields
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/patients/uuid-here" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Create Patient
**POST** `/api/patients`

Create a new patient.

**Request Body:**
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

**Required Fields:**
- `patientId` (string): Unique patient ID per clinic
- `firstName` (string)
- `lastName` (string)
- `dateOfBirth` (string, ISO date)
- `gender` (enum: `male`, `female`, `other`)
- `phone` (string)

**Response:**
```json
{
  "data": {
    "id": "uuid",
    // ... created patient object
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/patients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "P001",
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-01",
    "gender": "male",
    "phone": "1234567890"
  }'
```

---

### Update Patient
**PATCH** `/api/patients/:id`

Update an existing patient.

**Path Parameters:**
- `id` (UUID): Patient ID

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "9876543210"
  // ... any fields to update
}
```

**Response:**
```json
{
  "data": {
    // ... updated patient object
  }
}
```

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/patients/uuid-here \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "phone": "9876543210"
  }'
```

---

### Delete Patient
**DELETE** `/api/patients/:id`

Delete a patient.

**Path Parameters:**
- `id` (UUID): Patient ID

**Response:**
```json
{
  "message": "Patient deleted successfully"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/patients/uuid-here \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 2. Doctors API (`/api/doctors`)

### List Doctors
**GET** `/api/doctors`

Get a paginated list of doctors for the current clinic.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `search` (string, optional): Search by name, doctorId, or specialization
- `specialization` (string, optional): Filter by specialization
- `isActive` (boolean, optional): Filter by active status

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
      "doctorId": "DOC001",
      "firstName": "Jane",
      "lastName": "Smith",
      "specialization": "Cardiology",
      "qualification": ["MBBS", "MD"],
      "licenseNumber": "DOC-LIC-001",
      "phone": "1234567890",
      "email": "jane.smith@example.com",
      "consultationFee": 500,
      "schedule": {
        "monday": [
          {"start": "09:00", "end": "12:00", "available": true}
        ]
      },
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### Get Single Doctor
**GET** `/api/doctors/:id`

Get a single doctor by ID.

**Path Parameters:**
- `id` (UUID): Doctor ID

---

### Create Doctor
**POST** `/api/doctors`

Create a new doctor.

**Request Body:**
```json
{
  "doctorId": "DOC001",
  "firstName": "Jane",
  "lastName": "Smith",
  "specialization": "Cardiology",
  "qualification": ["MBBS", "MD"],
  "licenseNumber": "DOC-LIC-001",
  "phone": "1234567890",
  "email": "jane.smith@example.com",
  "consultationFee": 500,
  "schedule": {
    "monday": [
      {"start": "09:00", "end": "12:00", "available": true}
    ]
  }
}
```

**Required Fields:**
- `doctorId` (string): Unique doctor ID per clinic
- `firstName` (string)
- `lastName` (string)
- `specialization` (string)
- `qualification` (string[]): Array of qualifications
- `licenseNumber` (string)
- `phone` (string)
- `email` (string)
- `consultationFee` (number)

---

### Update Doctor
**PATCH** `/api/doctors/:id`

Update an existing doctor.

**Path Parameters:**
- `id` (UUID): Doctor ID

**Request Body:**
```json
{
  "consultationFee": 600,
  "isActive": true
  // ... any fields to update
}
```

---

### Delete Doctor
**DELETE** `/api/doctors/:id`

Delete a doctor.

**Path Parameters:**
- `id` (UUID): Doctor ID

---

## 3. Appointments API (`/api/appointments`)

### List Appointments
**GET** `/api/appointments`

Get a paginated list of appointments for the current clinic.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `patientId` (UUID, optional): Filter by patient
- `doctorId` (UUID, optional): Filter by doctor
- `status` (string, optional): Filter by status (`scheduled`, `confirmed`, `in-progress`, `completed`, `cancelled`, `no-show`)
- `date` (string, optional): Filter by specific date (ISO date)
- `startDate` (string, optional): Filter from date (ISO date)
- `endDate` (string, optional): Filter to date (ISO date)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
      "patientId": "uuid",
      "patient": {
        "firstName": "John",
        "lastName": "Doe"
      },
      "doctorId": "uuid",
      "doctor": {
        "firstName": "Jane",
        "lastName": "Smith"
      },
      "appointmentDate": "2025-12-25",
      "appointmentTime": "10:00",
      "duration": 30,
      "status": "scheduled",
      "appointmentType": "consultation",
      "reason": "Regular checkup",
      "notes": "Follow-up appointment",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### Get Single Appointment
**GET** `/api/appointments/:id`

Get a single appointment by ID.

**Path Parameters:**
- `id` (UUID): Appointment ID

---

### Create Appointment
**POST** `/api/appointments`

Create a new appointment.

**Request Body:**
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

**Required Fields:**
- `patientId` (UUID)
- `doctorId` (UUID)
- `appointmentDate` (string, ISO date)
- `appointmentTime` (string, time format: "HH:mm")
- `appointmentType` (enum: `consultation`, `follow-up`, `emergency`, `checkup`)

**Optional Fields:**
- `duration` (number, default: 30): Duration in minutes
- `reason` (string)
- `notes` (string)

---

### Update Appointment
**PATCH** `/api/appointments/:id`

Update an existing appointment (e.g., reschedule, cancel).

**Path Parameters:**
- `id` (UUID): Appointment ID

**Request Body:**
```json
{
  "status": "cancelled",
  "cancellationReason": "Patient requested cancellation"
  // ... or reschedule
  "appointmentDate": "2025-12-26",
  "appointmentTime": "11:00"
}
```

**Status Values:**
- `scheduled`
- `confirmed`
- `in-progress`
- `completed`
- `cancelled`
- `no-show`

---

### Delete Appointment
**DELETE** `/api/appointments/:id`

Delete an appointment.

**Path Parameters:**
- `id` (UUID): Appointment ID

---

## 4. Medical Records API (`/api/medical-records`)

### List Medical Records
**GET** `/api/medical-records`

Get a paginated list of medical records for the current clinic.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `patientId` (UUID, optional): Filter by patient
- `doctorId` (UUID, optional): Filter by doctor
- `appointmentId` (UUID, optional): Filter by appointment

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
      "patientId": "uuid",
      "patient": {
        "firstName": "John",
        "lastName": "Doe"
      },
      "appointmentId": "uuid",
      "doctorId": "uuid",
      "doctor": {
        "firstName": "Jane",
        "lastName": "Smith"
      },
      "visitDate": "2025-12-25",
      "chiefComplaint": "Headache and fever",
      "diagnosis": "Viral infection",
      "treatment": "Rest and medication",
      "vitals": {
        "bp": "120/80",
        "temperature": 98.6,
        "pulse": 72,
        "weight": 70,
        "height": 175
      },
      "notes": "Patient responding well to treatment",
      "attachments": ["url1", "url2"],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### Get Single Medical Record
**GET** `/api/medical-records/:id`

Get a single medical record by ID.

**Path Parameters:**
- `id` (UUID): Medical record ID

---

### Create Medical Record
**POST** `/api/medical-records`

Create a new medical record.

**Request Body:**
```json
{
  "patientId": "uuid",
  "appointmentId": "uuid",
  "doctorId": "uuid",
  "visitDate": "2025-12-25",
  "chiefComplaint": "Headache and fever",
  "diagnosis": "Viral infection",
  "treatment": "Rest and medication",
  "vitals": {
    "bp": "120/80",
    "temperature": 98.6,
    "pulse": 72,
    "weight": 70,
    "height": 175
  },
  "notes": "Patient responding well to treatment",
  "attachments": ["url1", "url2"]
}
```

**Required Fields:**
- `patientId` (UUID)
- `doctorId` (UUID)
- `visitDate` (string, ISO date)
- `chiefComplaint` (string)
- `diagnosis` (string)
- `treatment` (string)

**Optional Fields:**
- `appointmentId` (UUID)
- `vitals` (object): Any vital signs
- `notes` (string)
- `attachments` (string[]): Array of file URLs

---

### Update Medical Record
**PATCH** `/api/medical-records/:id`

Update an existing medical record.

**Path Parameters:**
- `id` (UUID): Medical record ID

---

### Delete Medical Record
**DELETE** `/api/medical-records/:id`

Delete a medical record.

**Path Parameters:**
- `id` (UUID): Medical record ID

---

## 5. Prescriptions API (`/api/prescriptions`)

### List Prescriptions
**GET** `/api/prescriptions`

Get a paginated list of prescriptions for the current clinic.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `patientId` (UUID, optional): Filter by patient
- `doctorId` (UUID, optional): Filter by doctor
- `appointmentId` (UUID, optional): Filter by appointment
- `status` (string, optional): Filter by status (`active`, `completed`, `cancelled`)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
      "patientId": "uuid",
      "patient": {
        "firstName": "John",
        "lastName": "Doe"
      },
      "appointmentId": "uuid",
      "doctorId": "uuid",
      "doctor": {
        "firstName": "Jane",
        "lastName": "Smith"
      },
      "prescriptionDate": "2025-12-25",
      "diagnosis": "Viral infection",
      "notes": "Take with food",
      "status": "active",
      "items": [
        {
          "id": "uuid",
          "prescriptionId": "uuid",
          "medicineName": "Paracetamol",
          "dosage": "500mg",
          "frequency": "Twice daily",
          "duration": "5 days",
          "quantity": 10,
          "instructions": "Take after meals",
          "order": 1
        }
      ],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### Get Single Prescription
**GET** `/api/prescriptions/:id`

Get a single prescription by ID.

**Path Parameters:**
- `id` (UUID): Prescription ID

---

### Create Prescription
**POST** `/api/prescriptions`

Create a new prescription.

**Request Body:**
```json
{
  "patientId": "uuid",
  "appointmentId": "uuid",
  "doctorId": "uuid",
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

**Required Fields:**
- `patientId` (UUID)
- `doctorId` (UUID)
- `prescriptionDate` (string, ISO date)
- `diagnosis` (string)
- `items` (array): Array of prescription items

**Prescription Item Required Fields:**
- `medicineName` (string)
- `dosage` (string)
- `frequency` (string)
- `duration` (string)
- `quantity` (number)
- `order` (number): Display order

**Optional Fields:**
- `appointmentId` (UUID)
- `notes` (string)
- `instructions` (string): For each item

---

### Update Prescription
**PATCH** `/api/prescriptions/:id`

Update an existing prescription.

**Path Parameters:**
- `id` (UUID): Prescription ID

**Request Body:**
```json
{
  "status": "completed",
  "items": [
    // ... updated items array
  ]
}
```

---

### Delete Prescription
**DELETE** `/api/prescriptions/:id`

Delete a prescription.

**Path Parameters:**
- `id` (UUID): Prescription ID

---

## 6. Lab Reports API (`/api/lab-reports`)

### List Lab Reports
**GET** `/api/lab-reports`

Get a paginated list of lab reports for the current clinic.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `patientId` (UUID, optional): Filter by patient
- `doctorId` (UUID, optional): Filter by doctor
- `appointmentId` (UUID, optional): Filter by appointment
- `status` (string, optional): Filter by status (`ordered`, `sample-collected`, `in-progress`, `completed`, `cancelled`)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
      "patientId": "uuid",
      "patient": {
        "firstName": "John",
        "lastName": "Doe"
      },
      "appointmentId": "uuid",
      "doctorId": "uuid",
      "doctor": {
        "firstName": "Jane",
        "lastName": "Smith"
      },
      "reportNumber": "LAB-001",
      "orderDate": "2025-12-25",
      "collectionDate": "2025-12-25",
      "reportDate": "2025-12-26",
      "status": "completed",
      "notes": "All tests completed",
      "reportFile": "https://example.com/report.pdf",
      "tests": [
        {
          "id": "uuid",
          "labReportId": "uuid",
          "testName": "Complete Blood Count",
          "testCode": "CBC",
          "result": "Normal",
          "normalRange": "4.5-11.0",
          "unit": "x10^9/L",
          "status": "completed",
          "notes": "Within normal range"
        }
      ],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### Get Single Lab Report
**GET** `/api/lab-reports/:id`

Get a single lab report by ID.

**Path Parameters:**
- `id` (UUID): Lab report ID

---

### Create Lab Report
**POST** `/api/lab-reports`

Create a new lab report (order lab tests).

**Request Body:**
```json
{
  "patientId": "uuid",
  "appointmentId": "uuid",
  "doctorId": "uuid",
  "orderDate": "2025-12-25",
  "collectionDate": "2025-12-25",
  "notes": "Fasting required",
  "tests": [
    {
      "testName": "Complete Blood Count",
      "testCode": "CBC",
      "normalRange": "4.5-11.0",
      "unit": "x10^9/L"
    }
  ]
}
```

**Required Fields:**
- `patientId` (UUID)
- `doctorId` (UUID)
- `orderDate` (string, ISO date)
- `tests` (array): Array of test items

**Test Item Required Fields:**
- `testName` (string)

**Optional Fields:**
- `appointmentId` (UUID)
- `collectionDate` (string, ISO date)
- `notes` (string)
- `testCode` (string)
- `normalRange` (string)
- `unit` (string)

---

### Update Lab Report
**PATCH** `/api/lab-reports/:id`

Update an existing lab report (e.g., update test results, upload report file).

**Path Parameters:**
- `id` (UUID): Lab report ID

**Request Body:**
```json
{
  "status": "completed",
  "reportDate": "2025-12-26",
  "reportFile": "https://example.com/report.pdf",
  "tests": [
    {
      "testName": "Complete Blood Count",
      "result": "Normal",
      "status": "completed"
    }
  ]
}
```

**Status Values:**
- `ordered`
- `sample-collected`
- `in-progress`
- `completed`
- `cancelled`

---

### Delete Lab Report
**DELETE** `/api/lab-reports/:id`

Delete a lab report.

**Path Parameters:**
- `id` (UUID): Lab report ID

---

## 7. Patient Billing API (`/api/patient-billing`)

### List Bills
**GET** `/api/patient-billing`

Get a paginated list of patient bills for the current clinic.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `patientId` (UUID, optional): Filter by patient
- `appointmentId` (UUID, optional): Filter by appointment
- `status` (string, optional): Filter by status (`draft`, `pending`, `partial`, `paid`, `cancelled`)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
      "patientId": "uuid",
      "patient": {
        "firstName": "John",
        "lastName": "Doe"
      },
      "appointmentId": "uuid",
      "billNumber": "BILL-001",
      "billDate": "2025-12-25",
      "dueDate": "2025-12-30",
      "subtotal": 500,
      "discount": 0,
      "tax": 50,
      "total": 550,
      "paidAmount": 550,
      "balance": 0,
      "status": "paid",
      "paymentMethod": "cash",
      "notes": "Payment received",
      "items": [
        {
          "id": "uuid",
          "billId": "uuid",
          "itemType": "consultation",
          "itemName": "Consultation Fee",
          "description": "Regular consultation",
          "quantity": 1,
          "unitPrice": 500,
          "total": 500,
          "order": 1
        }
      ],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### Get Single Bill
**GET** `/api/patient-billing/:id`

Get a single bill by ID.

**Path Parameters:**
- `id` (UUID): Bill ID

---

### Create Bill
**POST** `/api/patient-billing`

Create a new patient bill.

**Request Body:**
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

**Required Fields:**
- `patientId` (UUID)
- `billDate` (string, ISO date)
- `items` (array): Array of bill items

**Bill Item Required Fields:**
- `itemType` (enum: `consultation`, `medicine`, `lab-test`, `procedure`, `other`)
- `itemName` (string)
- `quantity` (number)
- `unitPrice` (number)
- `order` (number): Display order

**Optional Fields:**
- `appointmentId` (UUID)
- `dueDate` (string, ISO date)
- `discount` (number, default: 0)
- `tax` (number, default: 0)
- `paymentMethod` (enum: `cash`, `card`, `online`, `cheque`)
- `notes` (string)
- `description` (string): For each item

**Note:** `subtotal`, `total`, `paidAmount`, and `balance` are calculated automatically.

---

### Update Bill
**PATCH** `/api/patient-billing/:id`

Update an existing bill.

**Path Parameters:**
- `id` (UUID): Bill ID

**Request Body:**
```json
{
  "status": "paid",
  "paidAmount": 550,
  "items": [
    // ... updated items array
  ]
}
```

**Status Values:**
- `draft`
- `pending`
- `partial`
- `paid`
- `cancelled`

---

### Delete Bill
**DELETE** `/api/patient-billing/:id`

Delete a bill.

**Path Parameters:**
- `id` (UUID): Bill ID

---

### Record Payment
**POST** `/api/patient-billing/:id/payment`

Record a payment for a bill.

**Path Parameters:**
- `id` (UUID): Bill ID

**Request Body:**
```json
{
  "amount": 500,
  "paymentMethod": "cash",
  "paymentDate": "2025-12-25",
  "notes": "Partial payment"
}
```

**Required Fields:**
- `amount` (number): Payment amount
- `paymentMethod` (enum: `cash`, `card`, `online`, `cheque`)
- `paymentDate` (string, ISO date)

**Optional Fields:**
- `notes` (string)

**Response:**
```json
{
  "data": {
    // ... updated bill with new paidAmount and balance
  }
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/patient-billing/uuid-here/payment" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "amount": 500,
    "paymentMethod": "cash",
    "paymentDate": "2025-12-25"
  }'
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["Validation error message"],
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Forbidden - Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## Access Control

### Role-Based Access

All HMS endpoints are accessible to:
- **Clinic users**: Can access all HMS endpoints for their clinic
- **Admin users**: Can access all HMS endpoints for all clinics

Other roles (manufacturer, support) do not have access to HMS endpoints.

### Multi-Tenancy

All HMS data is automatically filtered by `clinicId`:
- Clinic users can only see/modify data for their own clinic
- Admin users can see/modify data for all clinics

---

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 10): Items per page

**Response Format:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

---

## Date Formats

All date fields use ISO 8601 format:
- Date: `"2025-12-25"`
- DateTime: `"2025-12-25T10:00:00.000Z"`
- Time: `"10:00"` (HH:mm format)

---

## Notes

1. **UUID Format**: All ID parameters must be valid UUIDs
2. **Authentication**: All endpoints require JWT Bearer token
3. **Multi-tenancy**: Data is automatically scoped to the user's clinic
4. **Validation**: All input is validated using DTOs
5. **Relationships**: Related entities (patient, doctor, etc.) are included in responses when available

---

**Last Updated**: December 24, 2025



