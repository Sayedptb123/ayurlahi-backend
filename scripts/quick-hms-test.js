#!/usr/bin/env node

/**
 * Quick HMS Health Check
 * Tests if HMS endpoints are accessible (without authentication)
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

function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function main() {
  log('========================================', 'blue');
  log('HMS Quick Health Check', 'blue');
  log('========================================', 'blue');
  console.log('');

  // Test 1: Server Health
  log('1. Testing server health...', 'cyan');
  try {
    const healthCheck = await makeRequest('GET', '/api/health');
    if (healthCheck.status === 200) {
      log('   ✓ Server is running and responding', 'green');
    } else {
      log(`   ⚠ Server responded with status: ${healthCheck.status}`, 'yellow');
    }
  } catch (error) {
    log(`   ✗ Server health check failed: ${error.message}`, 'red');
    log('   Please ensure the server is running: npm run start:dev', 'yellow');
    process.exit(1);
  }

  console.log('');

  // Test 2: Auth endpoint (should be accessible)
  log('2. Testing authentication endpoint...', 'cyan');
  try {
    const authCheck = await makeRequest('POST', '/api/auth/login');
    // 400 is expected (missing credentials), 401 is also acceptable
    if (authCheck.status === 400 || authCheck.status === 401) {
      log('   ✓ Authentication endpoint is accessible', 'green');
      log('   (400/401 is expected without credentials)', 'yellow');
    } else {
      log(`   ⚠ Unexpected status: ${authCheck.status}`, 'yellow');
    }
  } catch (error) {
    log(`   ✗ Auth endpoint check failed: ${error.message}`, 'red');
  }

  console.log('');

  // Test 3: HMS endpoints (should return 401 without auth)
  log('3. Testing HMS endpoints (should return 401 without auth)...', 'cyan');
  
  const endpoints = [
    '/api/patients',
    '/api/doctors',
    '/api/appointments',
    '/api/medical-records',
    '/api/prescriptions',
    '/api/lab-reports',
    '/api/patient-billing',
  ];

  let accessibleCount = 0;
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest('GET', endpoint);
      if (response.status === 401 || response.status === 403) {
        accessibleCount++;
        log(`   ✓ ${endpoint} - Accessible (${response.status})`, 'green');
      } else if (response.status === 200) {
        log(`   ⚠ ${endpoint} - Accessible without auth (${response.status})`, 'yellow');
        accessibleCount++;
      } else {
        log(`   ⚠ ${endpoint} - Status: ${response.status}`, 'yellow');
      }
    } catch (error) {
      log(`   ✗ ${endpoint} - Error: ${error.message}`, 'red');
    }
  }

  console.log('');
  log('========================================', 'blue');
  log('Health Check Summary', 'blue');
  log('========================================', 'blue');
  console.log('');
  log(`✓ Server is running`, 'green');
  log(`✓ ${accessibleCount}/${endpoints.length} HMS endpoints are accessible`, 'green');
  console.log('');
  log('Next Steps:', 'cyan');
  log('1. To test with authentication, run: npm run test:hms', 'yellow');
  log('2. Or use curl/Postman with your credentials', 'yellow');
  log('3. See HMS_POST_MIGRATION_CHECKLIST.md for detailed testing', 'yellow');
  console.log('');
}

main().catch((error) => {
  log(`Error: ${error.message}`, 'red');
  process.exit(1);
});



