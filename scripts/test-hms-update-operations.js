#!/usr/bin/env node

/**
 * HMS UPDATE Operations Testing Script
 * Tests all PATCH endpoints for updating records
 */

const http = require('http');

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

async function login(email, password) {
  try {
    const response = await makeRequest('POST', '/api/auth/login', null, {
      email,
      password,
    });

    if (response.status === 201 && response.body.access_token) {
      return response.body.access_token;
    }
    throw new Error('Login failed');
  } catch (error) {
    throw new Error(`Login error: ${error.message}`);
  }
}

async function getFirstRecord(token, endpoint) {
  try {
    const response = await makeRequest('GET', endpoint, token);
    if (response.status === 200 && response.body && response.body.length > 0) {
      return response.body[0];
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function testUpdate(name, method, path, token, data) {
  try {
    log(`Testing ${name}...`, 'yellow');
    const response = await makeRequest(method, path, token, data);
    
    if (response.status >= 200 && response.status < 300) {
      log(`  ✓ ${name} - Status: ${response.status}`, 'green');
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
  log('\n=== HMS UPDATE Operations Testing ===\n', 'cyan');

  // Test credentials
  const testUsers = [
    {
      name: 'Admin User',
      email: 'admin@test.ayurlahi.com',
      password: 'Admin@123',
    },
    {
      name: 'Clinic User',
      email: 'clinic@test.ayurlahi.com',
      password: 'Clinic@123',
    },
  ];

  let results = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  for (const user of testUsers) {
    log(`\n--- Testing with ${user.name} ---\n`, 'blue');

    try {
      // Login
      log(`Logging in as ${user.email}...`, 'yellow');
      const token = await login(user.email, user.password);
      log(`✓ Login successful\n`, 'green');

      // Test 1: Update Patient
      log('📋 Testing Patient Update...', 'cyan');
      const patient = await getFirstRecord(token, '/api/patients');
      if (patient) {
        results.total++;
        const updateData = {
          firstName: 'Updated',
          lastName: 'Patient',
          phone: '9999999999',
        };
        const result = await testUpdate(
          'PATCH /api/patients/:id',
          'PATCH',
          `/api/patients/${patient.id}`,
          token,
          updateData
        );
        if (result.success) results.passed++;
        else results.failed++;
      } else {
        log('  ⚠ No patient found. Skipping patient update test.', 'yellow');
      }

      // Test 2: Update Doctor
      log('\n👨‍⚕️ Testing Doctor Update...', 'cyan');
      const doctor = await getFirstRecord(token, '/api/doctors');
      if (doctor) {
        results.total++;
        const updateData = {
          firstName: 'Updated',
          lastName: 'Doctor',
          specialization: 'Updated Specialization',
        };
        const result = await testUpdate(
          'PATCH /api/doctors/:id',
          'PATCH',
          `/api/doctors/${doctor.id}`,
          token,
          updateData
        );
        if (result.success) results.passed++;
        else results.failed++;
      } else {
        log('  ⚠ No doctor found. Skipping doctor update test.', 'yellow');
      }

      // Test 3: Update Appointment
      log('\n📅 Testing Appointment Update...', 'cyan');
      const appointment = await getFirstRecord(token, '/api/appointments');
      if (appointment) {
        results.total++;
        const updateData = {
          status: 'confirmed',
          notes: 'Updated appointment notes',
        };
        const result = await testUpdate(
          'PATCH /api/appointments/:id',
          'PATCH',
          `/api/appointments/${appointment.id}`,
          token,
          updateData
        );
        if (result.success) results.passed++;
        else results.failed++;
      } else {
        log('  ⚠ No appointment found. Skipping appointment update test.', 'yellow');
      }

      // Test 4: Update Medical Record
      log('\n📝 Testing Medical Record Update...', 'cyan');
      const medicalRecord = await getFirstRecord(token, '/api/medical-records');
      if (medicalRecord) {
        results.total++;
        const updateData = {
          diagnosis: 'Updated Diagnosis',
          treatment: 'Updated treatment plan',
          notes: 'Updated medical record notes',
        };
        const result = await testUpdate(
          'PATCH /api/medical-records/:id',
          'PATCH',
          `/api/medical-records/${medicalRecord.id}`,
          token,
          updateData
        );
        if (result.success) results.passed++;
        else results.failed++;
      } else {
        log('  ⚠ No medical record found. Skipping medical record update test.', 'yellow');
      }

      // Test 5: Update Prescription
      log('\n💊 Testing Prescription Update...', 'cyan');
      const prescription = await getFirstRecord(token, '/api/prescriptions');
      if (prescription) {
        results.total++;
        const updateData = {
          status: 'completed',
          notes: 'Updated prescription notes',
        };
        const result = await testUpdate(
          'PATCH /api/prescriptions/:id',
          'PATCH',
          `/api/prescriptions/${prescription.id}`,
          token,
          updateData
        );
        if (result.success) results.passed++;
        else results.failed++;
      } else {
        log('  ⚠ No prescription found. Skipping prescription update test.', 'yellow');
      }

      // Test 6: Update Lab Report
      log('\n🔬 Testing Lab Report Update...', 'cyan');
      const labReport = await getFirstRecord(token, '/api/lab-reports');
      if (labReport) {
        results.total++;
        const updateData = {
          notes: 'Updated lab report notes',
        };
        const result = await testUpdate(
          'PATCH /api/lab-reports/:id',
          'PATCH',
          `/api/lab-reports/${labReport.id}`,
          token,
          updateData
        );
        if (result.success) results.passed++;
        else results.failed++;
      } else {
        log('  ⚠ No lab report found. Skipping lab report update test.', 'yellow');
      }

      // Test 7: Update Patient Bill
      log('\n💰 Testing Patient Bill Update...', 'cyan');
      const bill = await getFirstRecord(token, '/api/patient-billing');
      if (bill) {
        results.total++;
        const updateData = {
          status: 'paid',
          notes: 'Updated bill notes',
        };
        const result = await testUpdate(
          'PATCH /api/patient-billing/:id',
          'PATCH',
          `/api/patient-billing/${bill.id}`,
          token,
          updateData
        );
        if (result.success) results.passed++;
        else results.failed++;
      } else {
        log('  ⚠ No bill found. Skipping bill update test.', 'yellow');
      }

    } catch (error) {
      log(`\n✗ Error testing with ${user.name}: ${error.message}`, 'red');
      results.failed++;
    }
  }

  // Summary
  log('\n=== Test Summary ===\n', 'cyan');
  log(`Total Tests: ${results.total}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`Success Rate: ${results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0}%\n`, 'blue');

  if (results.failed === 0 && results.total > 0) {
    log('✅ All UPDATE operations passed!', 'green');
    process.exit(0);
  } else if (results.total === 0) {
    log('⚠️  No tests were run. Make sure you have created records first.', 'yellow');
    process.exit(0);
  } else {
    log('❌ Some UPDATE operations failed. Check the errors above.', 'red');
    process.exit(1);
  }
}

// Run the tests
main().catch((error) => {
  log(`\n✗ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});

