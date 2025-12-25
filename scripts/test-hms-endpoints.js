#!/usr/bin/env node

/**
 * HMS API Endpoint Testing Script
 * Tests all HMS endpoints to verify they're working correctly
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

async function testEndpoint(name, method, path, token, data = null) {
  try {
    log(`Testing ${name}...`, 'yellow');
    const response = await makeRequest(method, path, token, data);
    
    if (response.status >= 200 && response.status < 300) {
      log(`  ✓ ${name} - Status: ${response.status}`, 'green');
      return { success: true, response };
    } else if (response.status === 401) {
      log(`  ⚠ ${name} - Unauthorized (401) - Token may be invalid`, 'yellow');
      return { success: false, response, error: 'Unauthorized' };
    } else if (response.status === 403) {
      log(`  ⚠ ${name} - Forbidden (403) - Permission denied`, 'yellow');
      return { success: false, response, error: 'Forbidden' };
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
  log('HMS API Endpoint Testing', 'blue');
  log('========================================', 'blue');
  console.log('');

  // Check if server is running
  log('Checking server status...', 'cyan');
  try {
    const healthCheck = await makeRequest('GET', '/api/health');
    if (healthCheck.status === 200) {
      log('✓ Server is running', 'green');
    } else {
      log('⚠ Server responded but health check failed', 'yellow');
    }
  } catch (error) {
    log('✗ Server is not running or not accessible', 'red');
    log('  Please start the server: npm run start:dev', 'yellow');
    process.exit(1);
  }

  console.log('');

  // Get credentials
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

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

  // Test endpoints
  log('Testing HMS Endpoints...', 'cyan');
  console.log('');

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  // 1. Patients
  const patientsList = await testEndpoint(
    'GET /api/patients',
    'GET',
    '/api/patients?page=1&limit=5',
    token
  );
  if (patientsList.success) results.passed++;
  else if (patientsList.error === 'Unauthorized' || patientsList.error === 'Forbidden') results.warnings++;
  else results.failed++;

  // 2. Doctors
  const doctorsList = await testEndpoint(
    'GET /api/doctors',
    'GET',
    '/api/doctors?page=1&limit=5',
    token
  );
  if (doctorsList.success) results.passed++;
  else if (doctorsList.error === 'Unauthorized' || doctorsList.error === 'Forbidden') results.warnings++;
  else results.failed++;

  // 3. Appointments
  const appointmentsList = await testEndpoint(
    'GET /api/appointments',
    'GET',
    '/api/appointments?page=1&limit=5',
    token
  );
  if (appointmentsList.success) results.passed++;
  else if (appointmentsList.error === 'Unauthorized' || appointmentsList.error === 'Forbidden') results.warnings++;
  else results.failed++;

  // 4. Medical Records
  const medicalRecordsList = await testEndpoint(
    'GET /api/medical-records',
    'GET',
    '/api/medical-records?page=1&limit=5',
    token
  );
  if (medicalRecordsList.success) results.passed++;
  else if (medicalRecordsList.error === 'Unauthorized' || medicalRecordsList.error === 'Forbidden') results.warnings++;
  else results.failed++;

  // 5. Prescriptions
  const prescriptionsList = await testEndpoint(
    'GET /api/prescriptions',
    'GET',
    '/api/prescriptions?page=1&limit=5',
    token
  );
  if (prescriptionsList.success) results.passed++;
  else if (prescriptionsList.error === 'Unauthorized' || prescriptionsList.error === 'Forbidden') results.warnings++;
  else results.failed++;

  // 6. Lab Reports
  const labReportsList = await testEndpoint(
    'GET /api/lab-reports',
    'GET',
    '/api/lab-reports?page=1&limit=5',
    token
  );
  if (labReportsList.success) results.passed++;
  else if (labReportsList.error === 'Unauthorized' || labReportsList.error === 'Forbidden') results.warnings++;
  else results.failed++;

  // 7. Patient Billing
  const billsList = await testEndpoint(
    'GET /api/patient-billing',
    'GET',
    '/api/patient-billing?page=1&limit=5',
    token
  );
  if (billsList.success) results.passed++;
  else if (billsList.error === 'Unauthorized' || billsList.error === 'Forbidden') results.warnings++;
  else results.failed++;

  console.log('');
  log('========================================', 'blue');
  log('Test Results Summary', 'blue');
  log('========================================', 'blue');
  console.log('');
  log(`✓ Passed: ${results.passed}`, 'green');
  log(`⚠ Warnings: ${results.warnings}`, 'yellow');
  log(`✗ Failed: ${results.failed}`, 'red');
  console.log('');

  if (results.failed === 0 && results.warnings === 0) {
    log('🎉 All endpoints are working correctly!', 'green');
  } else if (results.warnings > 0) {
    log('⚠ Some endpoints returned authorization errors', 'yellow');
    log('  This may be normal if you need to set up user roles', 'yellow');
  } else {
    log('⚠ Some endpoints failed. Check the errors above.', 'yellow');
  }

  console.log('');
  log('Next Steps:', 'cyan');
  log('1. Review any failed endpoints', 'yellow');
  log('2. Test creating new records (POST endpoints)', 'yellow');
  log('3. Test updating and deleting records', 'yellow');
  log('4. See HMS_POST_MIGRATION_CHECKLIST.md for detailed testing', 'yellow');
  console.log('');

  rl.close();
}

main().catch((error) => {
  log(`Error: ${error.message}`, 'red');
  process.exit(1);
});



