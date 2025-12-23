#!/usr/bin/env node

/**
 * HMS Testing Script with Test Users
 * Uses the seeded test accounts to test all HMS functionality
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
      // Provide more helpful error messages
      if (error.code === 'ECONNREFUSED') {
        reject(new Error('Connection refused - Server is not running on port 3000'));
      } else if (error.code === 'ENOTFOUND') {
        reject(new Error(`Host not found: ${url.hostname}`));
      } else {
      reject(error);
      }
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout - Server may be slow or unresponsive'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function login(email, password) {
  try {
  const response = await makeRequest('POST', '/api/auth/login', null, {
    email,
    password,
  });
    return response;
  } catch (error) {
    log(`Login error: ${error.message}`, 'red');
    log(`Stack: ${error.stack}`, 'red');
    throw error;
  }
}

async function testEndpoint(name, method, path, token, data = null) {
  try {
    const response = await makeRequest(method, path, token, data);
    
    if (response.status >= 200 && response.status < 300) {
      log(`  ✓ ${name} - Status: ${response.status}`, 'green');
      return { success: true, response };
    } else {
      log(`  ✗ ${name} - Status: ${response.status}`, 'red');
      if (response.body && response.body.message) {
        log(`    Error: ${response.body.message}`, 'red');
      }
      return { success: false, response };
    }
  } catch (error) {
    log(`  ✗ ${name} - Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function checkServer() {
  try {
    // Try to connect to any endpoint - even 404 means server is running
    const response = await makeRequest('GET', '/api/', null);
    // If we get any response (even 404), server is running
    return true;
  } catch (error) {
    // Only fail if connection is refused
    if (error.message && error.message.includes('Connection refused')) {
      return false;
    }
    // Other errors might mean server is running but endpoint doesn't exist
    // Try one more time with a simple connection test
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.once('error', () => {
        resolve(false);
      });
      socket.connect(3000, 'localhost');
    });
  }
}

async function main() {
  log('========================================', 'blue');
  log('HMS Complete Testing with Test Users', 'blue');
  log('========================================', 'blue');
  console.log('');

  // Check if server is running
  log('Checking server status...', 'cyan');
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    log('✗ Server is not running or not accessible', 'red');
    log('\nPlease start the server first:', 'yellow');
    log('  npm run start:dev', 'yellow');
    log('\nThen run this test again:', 'yellow');
    log('  npm run test:hms:full', 'yellow');
    process.exit(1);
  }
  
  log('✓ Server is running', 'green');
  console.log('');

  // Test users (created by seed script)
  const TEST_USERS = {
    clinic: {
      email: 'clinic1@test.com',
      password: 'abc123123',
    },
    admin: {
      email: 'admin@test.com',
      password: 'abc123123',
    },
  };

  // Step 1: Login as clinic user
  log('Step 1: Logging in as clinic user...', 'cyan');
  log(`  Email: ${TEST_USERS.clinic.email}`, 'yellow');
  
  let clinicLogin;
  try {
    clinicLogin = await login(TEST_USERS.clinic.email, TEST_USERS.clinic.password);
  } catch (error) {
    log('✗ Login request failed', 'red');
    log(`  Error: ${error.message}`, 'red');
    log('\nPossible issues:', 'yellow');
    log('  1. Server is not running - Start with: npm run start:dev', 'yellow');
    log('  2. Server is not accessible on port 3000', 'yellow');
    log('  3. Network connection issue', 'yellow');
    process.exit(1);
  }

  if (!clinicLogin || (clinicLogin.status !== 200 && clinicLogin.status !== 201)) {
    log('✗ Clinic login failed', 'red');
    log(`  Status: ${clinicLogin?.status || 'unknown'}`, 'red');
    if (clinicLogin?.body) {
      if (clinicLogin.body.message) {
        log(`  Error: ${clinicLogin.body.message}`, 'red');
      } else {
        log(`  Response: ${JSON.stringify(clinicLogin.body).substring(0, 200)}`, 'red');
      }
    }
    log('\nTroubleshooting:', 'yellow');
    log('  1. Make sure test users are created: npm run seed:test-users', 'yellow');
    log('  2. Verify user exists and has correct password', 'yellow');
    log('  3. Check server logs for errors', 'yellow');
    process.exit(1);
  }

  const clinicToken = clinicLogin.body.accessToken;
  if (!clinicToken) {
    log('✗ No token received from login', 'red');
    process.exit(1);
  }

  log('✓ Clinic user logged in successfully', 'green');
  console.log('');

  // Step 2: Test GET endpoints
  log('Step 2: Testing GET endpoints...', 'cyan');
  const getResults = {
    passed: 0,
    failed: 0,
  };

  const getEndpoints = [
    { name: 'GET /api/patients', path: '/api/patients?page=1&limit=5' },
    { name: 'GET /api/doctors', path: '/api/doctors?page=1&limit=5' },
    { name: 'GET /api/appointments', path: '/api/appointments?page=1&limit=5' },
    { name: 'GET /api/medical-records', path: '/api/medical-records?page=1&limit=5' },
    { name: 'GET /api/prescriptions', path: '/api/prescriptions?page=1&limit=5' },
    { name: 'GET /api/lab-reports', path: '/api/lab-reports?page=1&limit=5' },
    { name: 'GET /api/patient-billing', path: '/api/patient-billing?page=1&limit=5' },
  ];

  for (const endpoint of getEndpoints) {
    const result = await testEndpoint(endpoint.name, 'GET', endpoint.path, clinicToken);
    if (result.success) {
      getResults.passed++;
    } else {
      getResults.failed++;
    }
  }

  console.log('');
  log(`GET Endpoints: ${getResults.passed} passed, ${getResults.failed} failed`, getResults.failed === 0 ? 'green' : 'yellow');
  console.log('');

  // Step 3: Create test data
  log('Step 3: Creating test data...', 'cyan');
  const createdIds = {};

  // 3.1 Create Patient
  const patientResult = await testEndpoint(
    'POST /api/patients - Create Patient',
    'POST',
    '/api/patients',
    clinicToken,
    {
      patientId: `P${Date.now()}`,
      firstName: 'Test',
      lastName: 'Patient',
      dateOfBirth: '1990-01-01',
      gender: 'male',
      phone: '1234567890',
      email: 'test.patient@example.com',
    }
  );

  if (patientResult.success && patientResult.response.body.id) {
    createdIds.patientId = patientResult.response.body.id;
    log(`    Patient ID: ${createdIds.patientId}`, 'cyan');
  }

  console.log('');

  // 3.2 Create Doctor
  const doctorResult = await testEndpoint(
    'POST /api/doctors - Create Doctor',
    'POST',
    '/api/doctors',
    clinicToken,
    {
      doctorId: `DOC${Date.now()}`,
      firstName: 'Dr. Test',
      lastName: 'Doctor',
      specialization: 'General Medicine',
      licenseNumber: `LIC-${Date.now()}`,
      consultationFee: 500,
    }
  );

  if (doctorResult.success && doctorResult.response.body.id) {
    createdIds.doctorId = doctorResult.response.body.id;
    log(`    Doctor ID: ${createdIds.doctorId}`, 'cyan');
  }

  console.log('');

  // 3.3 Create Appointment (if patient and doctor created)
  if (createdIds.patientId && createdIds.doctorId) {
    const appointmentResult = await testEndpoint(
      'POST /api/appointments - Create Appointment',
      'POST',
      '/api/appointments',
      clinicToken,
      {
        patientId: createdIds.patientId,
        doctorId: createdIds.doctorId,
      appointmentDate: new Date().toISOString().split('T')[0],
      appointmentTime: '10:00',
      duration: 30,
      appointmentType: 'consultation',
        reason: 'Test appointment',
      }
    );

    if (appointmentResult.success && appointmentResult.response.body.id) {
      createdIds.appointmentId = appointmentResult.response.body.id;
      log(`    Appointment ID: ${createdIds.appointmentId}`, 'cyan');
    }
    console.log('');
  }

  // 3.4 Create Medical Record (if appointment created)
  if (createdIds.patientId && createdIds.doctorId && createdIds.appointmentId) {
    const medicalRecordResult = await testEndpoint(
      'POST /api/medical-records - Create Medical Record',
      'POST',
      '/api/medical-records',
      clinicToken,
      {
        patientId: createdIds.patientId,
        doctorId: createdIds.doctorId,
        appointmentId: createdIds.appointmentId,
        visitDate: new Date().toISOString().split('T')[0],
        chiefComplaint: 'Test complaint',
        diagnosis: 'Test diagnosis',
        treatment: 'Test treatment',
      }
    );

    if (medicalRecordResult.success && medicalRecordResult.response.body.id) {
      createdIds.medicalRecordId = medicalRecordResult.response.body.id;
      log(`    Medical Record ID: ${createdIds.medicalRecordId}`, 'cyan');
    }
    console.log('');
  }

  // 3.5 Create Prescription (if appointment created)
  if (createdIds.patientId && createdIds.doctorId && createdIds.appointmentId) {
    const prescriptionResult = await testEndpoint(
      'POST /api/prescriptions - Create Prescription',
      'POST',
      '/api/prescriptions',
      clinicToken,
      {
        patientId: createdIds.patientId,
        doctorId: createdIds.doctorId,
        appointmentId: createdIds.appointmentId,
        prescriptionDate: new Date().toISOString().split('T')[0],
        diagnosis: 'Test diagnosis',
        items: [
          {
            medicineName: 'Test Medicine',
            dosage: '500mg',
            frequency: 'Twice daily',
            duration: '5 days',
            quantity: 10,
          },
        ],
      }
    );

    if (prescriptionResult.success && prescriptionResult.response.body.id) {
      createdIds.prescriptionId = prescriptionResult.response.body.id;
      log(`    Prescription ID: ${createdIds.prescriptionId}`, 'cyan');
    }
  console.log('');
  }

  // 3.6 Create Lab Report (if appointment created)
  if (createdIds.patientId && createdIds.doctorId && createdIds.appointmentId) {
    const labReportResult = await testEndpoint(
      'POST /api/lab-reports - Create Lab Report',
      'POST',
      '/api/lab-reports',
      clinicToken,
      {
        patientId: createdIds.patientId,
        doctorId: createdIds.doctorId,
        appointmentId: createdIds.appointmentId,
        reportNumber: `LAB-${Date.now()}`,
        orderDate: new Date().toISOString().split('T')[0],
        tests: [
          {
            testName: 'Complete Blood Count',
            testCode: 'CBC',
          },
        ],
      }
    );

    if (labReportResult.success && labReportResult.response.body.id) {
      createdIds.labReportId = labReportResult.response.body.id;
      log(`    Lab Report ID: ${createdIds.labReportId}`, 'cyan');
    }
    console.log('');
  }

  // 3.7 Create Bill (if appointment created)
  if (createdIds.patientId && createdIds.appointmentId) {
    const billResult = await testEndpoint(
      'POST /api/patient-billing - Create Bill',
      'POST',
      '/api/patient-billing',
      clinicToken,
      {
        patientId: createdIds.patientId,
        appointmentId: createdIds.appointmentId,
        billNumber: `BILL-${Date.now()}`,
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
      }
    );

    if (billResult.success && billResult.response.body.id) {
      createdIds.billId = billResult.response.body.id;
      log(`    Bill ID: ${createdIds.billId}`, 'cyan');
    }
    console.log('');
  }

  // 3.8 Record Payment (if bill created)
  if (createdIds.billId) {
    const paymentResult = await testEndpoint(
      'POST /api/patient-billing/:id/payment - Record Payment',
      'POST',
      `/api/patient-billing/${createdIds.billId}/payment`,
      clinicToken,
      {
        amount: 500,
        paymentMethod: 'cash',
      }
    );

    if (paymentResult.success) {
      log(`    Payment recorded successfully`, 'green');
    }
  console.log('');
  }

  // Summary
  log('========================================', 'blue');
  log('Test Summary', 'blue');
  log('========================================', 'blue');
  console.log('');

  log('GET Endpoints:', 'cyan');
  log(`  ✓ Passed: ${getResults.passed}`, 'green');
  log(`  ✗ Failed: ${getResults.failed}`, getResults.failed > 0 ? 'red' : 'green');
  console.log('');

  log('Created Test Data:', 'cyan');
  if (createdIds.patientId) log(`  ✓ Patient: ${createdIds.patientId}`, 'green');
  if (createdIds.doctorId) log(`  ✓ Doctor: ${createdIds.doctorId}`, 'green');
  if (createdIds.appointmentId) log(`  ✓ Appointment: ${createdIds.appointmentId}`, 'green');
  if (createdIds.medicalRecordId) log(`  ✓ Medical Record: ${createdIds.medicalRecordId}`, 'green');
  if (createdIds.prescriptionId) log(`  ✓ Prescription: ${createdIds.prescriptionId}`, 'green');
  if (createdIds.labReportId) log(`  ✓ Lab Report: ${createdIds.labReportId}`, 'green');
  if (createdIds.billId) log(`  ✓ Bill: ${createdIds.billId}`, 'green');
  console.log('');

  const totalCreated = Object.keys(createdIds).length;
  log(`Total items created: ${totalCreated}`, totalCreated >= 7 ? 'green' : 'yellow');
  console.log('');

  if (getResults.failed === 0 && totalCreated >= 7) {
    log('🎉 All tests passed! HMS is working correctly!', 'green');
  } else if (getResults.failed === 0) {
    log('⚠ Some CREATE operations failed, but GET endpoints work', 'yellow');
  } else {
    log('⚠ Some tests failed. Check the errors above.', 'yellow');
  }

  console.log('');
  log('Next Steps:', 'cyan');
  log('1. Test updating records (PATCH)', 'yellow');
  log('2. Test deleting records (DELETE)', 'yellow');
  log('3. Test search and filtering', 'yellow');
  log('4. Test with different user roles', 'yellow');
  console.log('');
}

main().catch((error) => {
  log(`Error: ${error.message}`, 'red');
  process.exit(1);
});
