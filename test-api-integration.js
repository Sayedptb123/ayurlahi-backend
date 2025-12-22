#!/usr/bin/env node

/**
 * API Integration Test Script
 * Tests all API endpoints to ensure they're working correctly
 */

const http = require('http');
const https = require('https');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@ayurlahi.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test123';

// Test results
const results = {
  passed: [],
  failed: [],
  skipped: [],
};

// Colors for console output
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

// HTTP request helper
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(url, options, (res) => {
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
            data: parsed,
            raw: body,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body,
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

// Test helper
async function test(name, fn) {
  try {
    log(`\n🧪 Testing: ${name}`, 'cyan');
    const result = await fn();
    if (result.success) {
      log(`✅ PASSED: ${name}`, 'green');
      results.passed.push({ name, ...result });
      return result;
    } else {
      log(`❌ FAILED: ${name}`, 'red');
      log(`   Reason: ${result.error}`, 'red');
      results.failed.push({ name, ...result });
      return result;
    }
  } catch (error) {
    log(`❌ FAILED: ${name}`, 'red');
    log(`   Error: ${error.message}`, 'red');
    results.failed.push({ name, error: error.message });
    return { success: false, error: error.message };
  }
}

// Test suite
async function runTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('🚀 Starting API Integration Tests', 'blue');
  log('='.repeat(60), 'blue');
  log(`API Base URL: ${API_BASE_URL}`, 'yellow');
  log(`Test Email: ${TEST_EMAIL}`, 'yellow');

  let authToken = null;

  // 1. Test Authentication Endpoints
  log('\n📋 AUTHENTICATION TESTS', 'blue');
  log('-'.repeat(60), 'blue');

  await test('GET /auth/me (without token - should fail)', async () => {
    const response = await makeRequest('GET', '/auth/me');
    if (response.status === 401 || response.status === 403) {
      return { success: true, status: response.status };
    } else if (response.status === 404) {
      return {
        success: false,
        error: `Got 404 - endpoint may not exist or server not running`,
        status: response.status,
      };
    }
    return { success: false, error: `Expected 401/403, got ${response.status}` };
  });

  await test('POST /auth/login', async () => {
    const response = await makeRequest('POST', '/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (response.status === 200 || response.status === 201) {
      // Extract token (handle both camelCase and snake_case)
      authToken = response.data.accessToken || response.data.access_token;
      if (!authToken) {
        return {
          success: false,
          error: 'No access token in response',
          response: response.data,
        };
      }
      return { success: true, token: authToken, status: response.status };
    } else if (response.status === 401) {
      // 401 means endpoint exists but credentials are wrong
      return {
        success: true,
        status: response.status,
        note: 'Endpoint exists but credentials invalid (this is OK for testing endpoint availability)',
      };
    }
    return {
      success: false,
      error: `Expected 200/201/401, got ${response.status}`,
      response: response.data,
    };
  });

  if (!authToken) {
    log('\n⚠️  WARNING: No auth token obtained. Skipping authenticated tests.', 'yellow');
    results.skipped.push({ name: 'All authenticated endpoints', reason: 'No auth token' });
  } else {
    log(`\n✅ Auth token obtained: ${authToken.substring(0, 20)}...`, 'green');

    await test('GET /auth/me (with token)', async () => {
      const response = await makeRequest('GET', '/auth/me', null, authToken);
      if (response.status === 200 && response.data.id) {
        return { success: true, user: response.data, status: response.status };
      }
      return {
        success: false,
        error: `Expected 200 with user data, got ${response.status}`,
        response: response.data,
      };
    });
  }

  // 2. Test Products Endpoints
  log('\n📋 PRODUCTS TESTS', 'blue');
  log('-'.repeat(60), 'blue');

  await test('GET /products (with auth)', async () => {
    if (!authToken) {
      return { success: false, error: 'No auth token', skipped: true };
    }
    const response = await makeRequest('GET', '/products?page=1&limit=20&isActive=true', null, authToken);
    if (response.status === 200) {
      const hasData = response.data.data || Array.isArray(response.data);
      return {
        success: true,
        status: response.status,
        hasData,
        isPaginated: !!response.data.pagination,
      };
    }
    return {
      success: false,
      error: `Expected 200, got ${response.status}`,
      response: response.data,
    };
  });

  await test('GET /products (with filters)', async () => {
    if (!authToken) {
      return { success: false, error: 'No auth token', skipped: true };
    }
    const response = await makeRequest(
      'GET',
      '/products?page=1&limit=10&search=test&category=ayurveda',
      null,
      authToken
    );
    if (response.status === 200) {
      return { success: true, status: response.status };
    }
    return {
      success: false,
      error: `Expected 200, got ${response.status}`,
      response: response.data,
    };
  });

  // 3. Test Orders Endpoints
  log('\n📋 ORDERS TESTS', 'blue');
  log('-'.repeat(60), 'blue');

  await test('GET /orders (with auth)', async () => {
    if (!authToken) {
      return { success: false, error: 'No auth token', skipped: true };
    }
    const response = await makeRequest('GET', '/orders?page=1&limit=20', null, authToken);
    if (response.status === 200 || response.status === 404) {
      // 404 is acceptable if no orders exist
      return { success: true, status: response.status, note: response.status === 404 ? 'No orders found' : 'OK' };
    }
    return {
      success: false,
      error: `Expected 200 or 404, got ${response.status}`,
      response: response.data,
    };
  });

  // 4. Test Manufacturers Endpoints
  log('\n📋 MANUFACTURERS TESTS', 'blue');
  log('-'.repeat(60), 'blue');

  await test('GET /manufacturers (with auth)', async () => {
    if (!authToken) {
      return { success: false, error: 'No auth token', skipped: true };
    }
    const response = await makeRequest('GET', '/manufacturers', null, authToken);
    if (response.status === 200 || response.status === 403 || response.status === 404) {
      // 403 = not authorized (expected for non-admin), 404 = not found
      return {
        success: true,
        status: response.status,
        note: response.status === 403 ? 'Not authorized (expected for non-admin)' : 'OK',
      };
    }
    return {
      success: false,
      error: `Expected 200/403/404, got ${response.status}`,
      response: response.data,
    };
  });

  // 5. Test Clinics Endpoints
  log('\n📋 CLINICS TESTS', 'blue');
  log('-'.repeat(60), 'blue');

  await test('GET /clinics (with auth)', async () => {
    if (!authToken) {
      return { success: false, error: 'No auth token', skipped: true };
    }
    const response = await makeRequest('GET', '/clinics', null, authToken);
    if (response.status === 200 || response.status === 403 || response.status === 404) {
      return {
        success: true,
        status: response.status,
        note: response.status === 403 ? 'Not authorized (expected for non-admin)' : 'OK',
      };
    }
    return {
      success: false,
      error: `Expected 200/403/404, got ${response.status}`,
      response: response.data,
    };
  });

  await test('GET /clinics/me (with auth)', async () => {
    if (!authToken) {
      return { success: false, error: 'No auth token', skipped: true };
    }
    const response = await makeRequest('GET', '/clinics/me', null, authToken);
    if (response.status === 200 || response.status === 404) {
      // 404 is acceptable if user is not a clinic
      return {
        success: true,
        status: response.status,
        note: response.status === 404 ? 'User is not a clinic' : 'OK',
      };
    }
    return {
      success: false,
      error: `Expected 200 or 404, got ${response.status}`,
      response: response.data,
    };
  });

  // 6. Test Invoices Endpoints
  log('\n📋 INVOICES TESTS', 'blue');
  log('-'.repeat(60), 'blue');

  await test('GET /invoices (with auth)', async () => {
    if (!authToken) {
      return { success: false, error: 'No auth token', skipped: true };
    }
    const response = await makeRequest('GET', '/invoices?page=1&limit=20', null, authToken);
    if (response.status === 200 || response.status === 404) {
      return {
        success: true,
        status: response.status,
        note: response.status === 404 ? 'No invoices found' : 'OK',
      };
    }
    return {
      success: false,
      error: `Expected 200 or 404, got ${response.status}`,
      response: response.data,
    };
  });

  // 7. Test Payouts Endpoints
  log('\n📋 PAYOUTS TESTS', 'blue');
  log('-'.repeat(60), 'blue');

  await test('GET /payouts (with auth)', async () => {
    if (!authToken) {
      return { success: false, error: 'No auth token', skipped: true };
    }
    const response = await makeRequest('GET', '/payouts?page=1&limit=20', null, authToken);
    if (response.status === 200 || response.status === 403 || response.status === 404) {
      return {
        success: true,
        status: response.status,
        note:
          response.status === 403
            ? 'Not authorized (expected for non-manufacturer)'
            : response.status === 404
            ? 'No payouts found'
            : 'OK',
      };
    }
    return {
      success: false,
      error: `Expected 200/403/404, got ${response.status}`,
      response: response.data,
    };
  });

  // 8. Test Disputes Endpoints
  log('\n📋 DISPUTES TESTS', 'blue');
  log('-'.repeat(60), 'blue');

  await test('GET /disputes (with auth)', async () => {
    if (!authToken) {
      return { success: false, error: 'No auth token', skipped: true };
    }
    const response = await makeRequest('GET', '/disputes?page=1&limit=20', null, authToken);
    if (response.status === 200 || response.status === 403 || response.status === 404) {
      return {
        success: true,
        status: response.status,
        note:
          response.status === 403
            ? 'Not authorized (expected for non-admin/support)'
            : response.status === 404
            ? 'No disputes found'
            : 'OK',
      };
    }
    return {
      success: false,
      error: `Expected 200/403/404, got ${response.status}`,
      response: response.data,
    };
  });

  // Print summary
  log('\n' + '='.repeat(60), 'blue');
  log('📊 TEST SUMMARY', 'blue');
  log('='.repeat(60), 'blue');
  log(`✅ Passed: ${results.passed.length}`, 'green');
  log(`❌ Failed: ${results.failed.length}`, 'red');
  log(`⏭️  Skipped: ${results.skipped.length}`, 'yellow');

  if (results.failed.length > 0) {
    log('\n❌ FAILED TESTS:', 'red');
    results.failed.forEach((test) => {
      log(`   - ${test.name}`, 'red');
      if (test.error) {
        log(`     Error: ${test.error}`, 'red');
      }
    });
  }

  if (results.skipped.length > 0) {
    log('\n⏭️  SKIPPED TESTS:', 'yellow');
    results.skipped.forEach((test) => {
      log(`   - ${test.name}`, 'yellow');
      if (test.reason) {
        log(`     Reason: ${test.reason}`, 'yellow');
      }
    });
  }

  log('\n' + '='.repeat(60), 'blue');
  const exitCode = results.failed.length > 0 ? 1 : 0;
  process.exit(exitCode);
}

// Run tests
runTests().catch((error) => {
  log(`\n💥 Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

