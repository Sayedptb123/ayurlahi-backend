#!/usr/bin/env node

/**
 * HMS CREATE Operations Testing Script
 * Tests all POST endpoints to create data
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

async function testCreate(name, method, path, token, data) {
  try {
    log(`Testing ${name}...`, 'yellow');
    const response = await makeRequest(method, path, token, data);
    
    if (response.status >= 200 && response.status < 300) {
      log(`  ✓ ${name} - Status: ${response.status}`, 'green');
      if (response.body && response.body.id) {
        log(`    Created ID: ${response.body.id}`, 'cyan');
        return { success: true, response, id: response.body.id };
      }
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

async function main() {
  log('========================================', 'blue');
  log('HMS CREATE Operations Testing', 'blue');
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
    if (loginResponse.body && loginResponse.body.message) {
      log(`  Error: ${loginResponse.body.message}`, 'red');
    }
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

  // Test data
  const testData = {
    patient: {
      patientId: `P${Date.now()}`,
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      gender: 'male',
      phone: '1234567890',
      email: 'john.doe@example.com',
    },
    doctor: {
      doctorId: `DOC${Date.now()}`,
      firstName: 'Dr. Jane',
      lastName: 'Smith',
      specialization: 'Cardiology',
      licenseNumber: `LIC-${Date.now()}`,
      consultationFee: 500,
    },
  };

  const results = {
    passed: 0,
    failed: 0,
    createdIds: {},
  };

  // 1. Create Patient
  const patientResult = await testCreate(
    'POST /api/patients - Create Patient',
    'POST',
    '/api/patients',
    token,
    testData.patient
  );
  if (patientResult.success) {
    results.passed++;
    if (patientResult.id) {
      results.createdIds.patientId = patientResult.id;
      testData.appointment = { ...testData.appointment, patientId: patientResult.id };
    }
  } else {
    results.failed++;
  }

  console.log('');

  // 2. Create Doctor
  const doctorResult = await testCreate(
    'POST /api/doctors - Create Doctor',
    'POST',
    '/api/doctors',
    token,
    testData.doctor
  );
  if (doctorResult.success) {
    results.passed++;
    if (doctorResult.id) {
      results.createdIds.doctorId = doctorResult.id;
      testData.appointment = { ...testData.appointment, doctorId: doctorResult.id };
    }
  } else {
    results.failed++;
  }

  console.log('');

  // 3. Create Appointment (if patient and doctor created)
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

    const appointmentResult = await testCreate(
      'POST /api/appointments - Create Appointment',
      'POST',
      '/api/appointments',
      token,
      appointmentData
    );
    if (appointmentResult.success) {
      results.passed++;
      if (appointmentResult.id) {
        results.createdIds.appointmentId = appointmentResult.id;
      }
    } else {
      results.failed++;
    }
    console.log('');
  }

  // Summary
  log('========================================', 'blue');
  log('Test Results Summary', 'blue');
  log('========================================', 'blue');
  console.log('');
  log(`✓ Passed: ${results.passed}`, 'green');
  log(`✗ Failed: ${results.failed}`, 'red');
  console.log('');

  if (results.createdIds.patientId) {
    log('Created IDs:', 'cyan');
    log(`  Patient ID: ${results.createdIds.patientId}`, 'yellow');
  }
  if (results.createdIds.doctorId) {
    log(`  Doctor ID: ${results.createdIds.doctorId}`, 'yellow');
  }
  if (results.createdIds.appointmentId) {
    log(`  Appointment ID: ${results.createdIds.appointmentId}`, 'yellow');
  }

  console.log('');
  log('Next Steps:', 'cyan');
  log('1. Test creating medical records, prescriptions, etc.', 'yellow');
  log('2. Test updating records (PATCH)', 'yellow');
  log('3. Test deleting records (DELETE)', 'yellow');
  log('4. See HMS_TESTING_GUIDE.md for complete examples', 'yellow');
  console.log('');

  rl.close();
}

main().catch((error) => {
  log(`Error: ${error.message}`, 'red');
  process.exit(1);
});

