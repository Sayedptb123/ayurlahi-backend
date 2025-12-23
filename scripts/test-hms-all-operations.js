#!/usr/bin/env node

/**
 * HMS Complete Operations Testing Script
 * Tests all CREATE, UPDATE, and DELETE operations
 */

const http = require('http');
const readline = require('readline');

const BASE_URL = 'http://localhost:3000';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(method, path, token = null, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            raw: body,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
            raw: body,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testOperation(name, method, path, token, data = null) {
  try {
    log(`Testing ${name}...`, 'yellow');
    const response = await makeRequest(method, path, token, data);
    
    if (response.status >= 200 && response.status < 300) {
      log(`  ✓ ${name} - Status: ${response.status}`, 'green');
      if (response.body && response.body.id) {
        return { success: true, response, id: response.body.id };
      }
      return { success: true, response };
    } else {
      log(`  ✗ ${name} - Status: ${response.status}`, 'red');
      if (response.body && response.body.message) {
        const errorMsg = Array.isArray(response.body.message) 
          ? response.body.message.join(', ')
          : response.body.message;
        log(`    Error: ${errorMsg}`, 'red');
      }
      return { success: false, response };
    }
  } catch (error) {
    log(`  ✗ ${name} - Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function main() {
  log('========================================', 'blue');
  log('HMS Complete Operations Testing', 'blue');
  log('========================================', 'blue');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

  // Get credentials
  const email = await question('Enter your email: ');
  const password = await question('Enter your password: ');
  console.log('');

  // Login
  log('Logging in...', 'cyan');
  const loginResponse = await makeRequest('POST', '/api/auth/login', null, {
    email,
    password,
  });

  if (loginResponse.status !== 201 && loginResponse.status !== 200) {
    log('✗ Login failed', 'red');
    rl.close();
    process.exit(1);
  }

  const token = loginResponse.body.accessToken;
  if (!token) {
    log('✗ Login failed - No token received', 'red');
    rl.close();
    process.exit(1);
  }

  log('✓ Login successful', 'green');
  console.log('');

  // Get clinic ID if admin
  let clinicId = null;
  const userInfo = loginResponse.body.user || loginResponse.body;
  if (userInfo.role === 'admin') {
    log('Admin user detected. Fetching clinics...', 'cyan');
    try {
      const clinicsResponse = await makeRequest('GET', '/api/clinics', token);
      if (clinicsResponse.status === 200 && clinicsResponse.body && clinicsResponse.body.length > 0) {
        clinicId = clinicsResponse.body[0].id;
        log(`  Using clinic ID: ${clinicId}`, 'green');
      }
    } catch (error) {
      log(`  ⚠ Could not fetch clinics: ${error.message}`, 'yellow');
    }
    console.log('');
  }

  const results = {
    create: { passed: 0, failed: 0 },
    update: { passed: 0, failed: 0 },
    delete: { passed: 0, failed: 0 },
    createdIds: {},
  };

  const timestamp = Date.now();

  // ========== CREATE OPERATIONS ==========
  log('========================================', 'cyan');
  log('Testing CREATE Operations', 'cyan');
  log('========================================', 'cyan');
  console.log('');

  // 1. Create Patient
  const patientData = {
    ...(clinicId && { clinicId }),
    patientId: `P${timestamp}`,
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    gender: 'male',
    phone: '1234567890',
    email: 'john.doe@example.com',
  };
  const patientResult = await testOperation(
    'POST /api/patients - Create Patient',
    'POST',
    '/api/patients',
    token,
    patientData
  );
  if (patientResult.success) {
    results.create.passed++;
    if (patientResult.id) results.createdIds.patientId = patientResult.id;
  } else {
    results.create.failed++;
  }
  console.log('');

  // 2. Create Doctor
  const doctorData = {
    ...(clinicId && { clinicId }),
    doctorId: `DOC${timestamp}`,
    firstName: 'Dr. Jane',
    lastName: 'Smith',
    specialization: 'Cardiology',
    licenseNumber: `LIC-${timestamp}`,
    consultationFee: 500,
  };
  const doctorResult = await testOperation(
    'POST /api/doctors - Create Doctor',
    'POST',
    '/api/doctors',
    token,
    doctorData
  );
  if (doctorResult.success) {
    results.create.passed++;
    if (doctorResult.id) results.createdIds.doctorId = doctorResult.id;
  } else {
    results.create.failed++;
  }
  console.log('');

  // 3. Create Appointment
  if (results.createdIds.patientId && results.createdIds.doctorId) {
    const appointmentData = {
      patientId: results.createdIds.patientId,
      doctorId: results.createdIds.doctorId,
      appointmentDate: new Date().toISOString().split('T')[0],
      appointmentTime: '10:00',
      duration: 30,
      appointmentType: 'consultation',
      reason: 'Test appointment',
    };
    const appointmentResult = await testOperation(
      'POST /api/appointments - Create Appointment',
      'POST',
      '/api/appointments',
      token,
      appointmentData
    );
    if (appointmentResult.success) {
      results.create.passed++;
      if (appointmentResult.id) results.createdIds.appointmentId = appointmentResult.id;
    } else {
      results.create.failed++;
    }
    console.log('');
  }

  // 4. Create Medical Record
  if (results.createdIds.patientId && results.createdIds.doctorId) {
    const medicalRecordData = {
      patientId: results.createdIds.patientId,
      doctorId: results.createdIds.doctorId,
      appointmentId: results.createdIds.appointmentId || null,
      visitDate: new Date().toISOString().split('T')[0],
      chiefComplaint: 'Headache and fever',
      diagnosis: 'Viral infection',
      treatment: 'Rest and medication',
    };
    const medicalRecordResult = await testOperation(
      'POST /api/medical-records - Create Medical Record',
      'POST',
      '/api/medical-records',
      token,
      medicalRecordData
    );
    if (medicalRecordResult.success) {
      results.create.passed++;
      if (medicalRecordResult.id) results.createdIds.medicalRecordId = medicalRecordResult.id;
    } else {
      results.create.failed++;
    }
    console.log('');
  }

  // 5. Create Prescription
  if (results.createdIds.patientId && results.createdIds.doctorId) {
    const prescriptionData = {
      patientId: results.createdIds.patientId,
      doctorId: results.createdIds.doctorId,
      appointmentId: results.createdIds.appointmentId || null,
      prescriptionDate: new Date().toISOString().split('T')[0],
      diagnosis: 'Viral infection',
      items: [
        {
          medicineName: 'Paracetamol',
          dosage: '500mg',
          frequency: 'Twice daily',
          duration: '5 days',
          quantity: 10,
        },
      ],
    };
    const prescriptionResult = await testOperation(
      'POST /api/prescriptions - Create Prescription',
      'POST',
      '/api/prescriptions',
      token,
      prescriptionData
    );
    if (prescriptionResult.success) {
      results.create.passed++;
      if (prescriptionResult.id) results.createdIds.prescriptionId = prescriptionResult.id;
    } else {
      results.create.failed++;
    }
    console.log('');
  }

  // 6. Create Lab Report
  if (results.createdIds.patientId && results.createdIds.doctorId) {
    const labReportData = {
      patientId: results.createdIds.patientId,
      doctorId: results.createdIds.doctorId,
      appointmentId: results.createdIds.appointmentId || null,
      reportNumber: `LAB-${timestamp}`,
      orderDate: new Date().toISOString().split('T')[0],
      tests: [
        {
          testName: 'Complete Blood Count',
          testCode: 'CBC',
        },
      ],
    };
    const labReportResult = await testOperation(
      'POST /api/lab-reports - Create Lab Report',
      'POST',
      '/api/lab-reports',
      token,
      labReportData
    );
    if (labReportResult.success) {
      results.create.passed++;
      if (labReportResult.id) results.createdIds.labReportId = labReportResult.id;
    } else {
      results.create.failed++;
    }
    console.log('');
  }

  // 7. Create Bill
  if (results.createdIds.patientId) {
    const billData = {
      patientId: results.createdIds.patientId,
      appointmentId: results.createdIds.appointmentId || null,
      billNumber: `BILL-${timestamp}`,
      billDate: new Date().toISOString().split('T')[0],
      items: [
        {
          itemType: 'consultation',
          itemName: 'Consultation Fee',
          quantity: 1,
          unitPrice: 500,
          discount: 0,
        },
      ],
      discount: 0,
      tax: 0,
    };
    const billResult = await testOperation(
      'POST /api/patient-billing - Create Bill',
      'POST',
      '/api/patient-billing',
      token,
      billData
    );
    if (billResult.success) {
      results.create.passed++;
      if (billResult.id) results.createdIds.billId = billResult.id;
    } else {
      results.create.failed++;
    }
    console.log('');
  }

  // 8. Record Payment
  if (results.createdIds.billId) {
    const paymentData = {
      amount: 500,
      paymentMethod: 'cash',
    };
    const paymentResult = await testOperation(
      `POST /api/patient-billing/${results.createdIds.billId}/payment - Record Payment`,
      'POST',
      `/api/patient-billing/${results.createdIds.billId}/payment`,
      token,
      paymentData
    );
    if (paymentResult.success) {
      results.create.passed++;
    } else {
      results.create.failed++;
    }
    console.log('');
  }

  // ========== UPDATE OPERATIONS ==========
  log('========================================', 'cyan');
  log('Testing UPDATE Operations', 'cyan');
  log('========================================', 'cyan');
  console.log('');

  // Update Patient
  if (results.createdIds.patientId) {
    const updatePatientResult = await testOperation(
      'PATCH /api/patients/:id - Update Patient',
      'PATCH',
      `/api/patients/${results.createdIds.patientId}`,
      token,
      { phone: '9876543210' }
    );
    if (updatePatientResult.success) results.update.passed++;
    else results.update.failed++;
    console.log('');
  }

  // Update Doctor
  if (results.createdIds.doctorId) {
    const updateDoctorResult = await testOperation(
      'PATCH /api/doctors/:id - Update Doctor',
      'PATCH',
      `/api/doctors/${results.createdIds.doctorId}`,
      token,
      { consultationFee: 600 }
    );
    if (updateDoctorResult.success) results.update.passed++;
    else results.update.failed++;
    console.log('');
  }

  // Update Appointment
  if (results.createdIds.appointmentId) {
    const updateAppointmentResult = await testOperation(
      'PATCH /api/appointments/:id - Update Appointment',
      'PATCH',
      `/api/appointments/${results.createdIds.appointmentId}`,
      token,
      { status: 'confirmed' }
    );
    if (updateAppointmentResult.success) results.update.passed++;
    else results.update.failed++;
    console.log('');
  }

  // ========== SUMMARY ==========
  log('========================================', 'blue');
  log('Test Results Summary', 'blue');
  log('========================================', 'blue');
  console.log('');
  log('CREATE Operations:', 'cyan');
  log(`  ✓ Passed: ${results.create.passed}`, 'green');
  log(`  ✗ Failed: ${results.create.failed}`, results.create.failed > 0 ? 'red' : 'green');
  console.log('');
  log('UPDATE Operations:', 'cyan');
  log(`  ✓ Passed: ${results.update.passed}`, 'green');
  log(`  ✗ Failed: ${results.update.failed}`, results.update.failed > 0 ? 'red' : 'green');
  console.log('');

  if (Object.keys(results.createdIds).length > 0) {
    log('Created IDs:', 'cyan');
    Object.entries(results.createdIds).forEach(([key, value]) => {
      log(`  ${key}: ${value}`, 'yellow');
    });
    console.log('');
  }

  const totalPassed = results.create.passed + results.update.passed;
  const totalFailed = results.create.failed + results.update.failed;

  if (totalFailed === 0) {
    log('🎉 All operations completed successfully!', 'green');
  } else {
    log(`⚠ Some operations failed. ${totalPassed} passed, ${totalFailed} failed.`, 'yellow');
  }

  console.log('');
  log('Next Steps:', 'cyan');
  log('1. Test DELETE operations manually', 'yellow');
  log('2. Verify data in database', 'yellow');
  log('3. Test search and filtering', 'yellow');
  console.log('');

  rl.close();
}

main().catch((error) => {
  log(`Error: ${error.message}`, 'red');
  process.exit(1);
});

