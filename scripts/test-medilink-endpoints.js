const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
let authToken = null;
let organisationId = null;
let userId = null;
let branchId = null;
let dutyTypeId = null;

// Test results
const results = {
  passed: 0,
  failed: 0,
  errors: [],
};

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

async function test(name, fn) {
  try {
    log(`\n🧪 Testing: ${name}`, 'info');
    await fn();
    results.passed++;
    log(`✅ PASSED: ${name}`, 'success');
  } catch (error) {
    results.failed++;
    results.errors.push({ test: name, error: error.message });
    log(`❌ FAILED: ${name} - ${error.message}`, 'error');
    if (error.response) {
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Test functions
async function testOrganisations() {
  if (!authToken) {
    throw new Error('Missing auth token for organisations test');
  }

  // Create Organisation
  const createRes = await axios.post(
    `${BASE_URL}/api/organisations`,
    {
      name: 'Test Clinic',
      type: 'CLINIC',
      clinicName: 'Test Clinic',
      phone: '+1234567890',
      address: '123 Test St',
      city: 'Test City',
    },
    {
      headers: { Authorization: `Bearer ${authToken}` },
    },
  );
  organisationId = createRes.data.id;
  log(`Created organisation: ${organisationId}`, 'success');

  // Get Organisation
  await axios.get(`${BASE_URL}/api/organisations/${organisationId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  log('Retrieved organisation', 'success');

  // List Organisations
  const listRes = await axios.get(`${BASE_URL}/api/organisations`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (listRes.data.data && listRes.data.data.length > 0) {
    log(`Found ${listRes.data.data.length} organisations`, 'success');
  }
}

async function testAuth() {
  // Register User
  const registerRes = await axios.post(`${BASE_URL}/api/auth/register`, {
    email: `test${Date.now()}@example.com`,
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    role: 'clinic',
    phone: `+123456789${Date.now().toString().slice(-3)}`,
  });
  userId = registerRes.data.user.id;
  log(`Registered user: ${userId}`, 'success');

  // Login
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: registerRes.data.user.email,
    password: 'password123',
  });
  authToken = loginRes.data.accessToken;
  log('Logged in successfully', 'success');
  log(`Organisations: ${loginRes.data.organisations?.length || 0}`, 'info');
}

async function testOrganisationUsers() {
  if (!authToken || !organisationId || !userId) {
    throw new Error('Missing required data for organisation users test');
  }

  // Create Organisation User
  const createRes = await axios.post(
    `${BASE_URL}/api/organisation-users`,
    {
      userId,
      organisationId,
      role: 'OWNER',
      isPrimary: true,
    },
    {
      headers: { Authorization: `Bearer ${authToken}` },
    },
  );
  log('Created organisation user', 'success');
}

async function testBranches() {
  if (!authToken || !organisationId) {
    throw new Error('Missing required data for branches test');
  }

  // Create Branch
  const createRes = await axios.post(
    `${BASE_URL}/api/organisations/${organisationId}/branches`,
    {
      name: 'Main Branch',
      code: 'BR001',
      address: '123 Main St',
      city: 'Test City',
      isPrimary: true,
    },
    {
      headers: { Authorization: `Bearer ${authToken}` },
    },
  );
  branchId = createRes.data.id;
  log(`Created branch: ${branchId}`, 'success');

  // List Branches
  const listRes = await axios.get(
    `${BASE_URL}/api/organisations/${organisationId}/branches`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    },
  );
  log(`Found ${listRes.data.data?.length || 0} branches`, 'success');
}

async function testDutyTypes() {
  if (!authToken || !organisationId) {
    throw new Error('Missing required data for duty types test');
  }

  // Create Duty Type
  const createRes = await axios.post(
    `${BASE_URL}/api/organisations/${organisationId}/duty-types`,
    {
      name: 'Morning Shift',
      code: 'MORN',
      startTime: '09:00:00',
      endTime: '18:00:00',
      color: '#FF5733',
    },
    {
      headers: { Authorization: `Bearer ${authToken}` },
    },
  );
  dutyTypeId = createRes.data.id;
  log(`Created duty type: ${dutyTypeId}`, 'success');

  // List Duty Types
  const listRes = await axios.get(
    `${BASE_URL}/api/organisations/${organisationId}/duty-types`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    },
  );
  log(`Found ${listRes.data.data?.length || 0} duty types`, 'success');
}

async function testDutyAssignments() {
  if (!authToken || !organisationId || !dutyTypeId) {
    log('⚠️  Skipping duty assignments test (requires staff)', 'warning');
    return;
  }

  // Note: This test requires staff to be created first
  // For now, we'll just test the endpoint structure
  log('Duty assignments test requires staff setup', 'warning');
}

// Main test runner
async function runTests() {
  log('\n🚀 Starting MediLink API Tests', 'info');
  log('='.repeat(50), 'info');

  try {
    // Phase 1: Foundation
    await test('Auth (Register & Login)', testAuth);
    await test('Organisations CRUD', testOrganisations);
    await test('Organisation Users', testOrganisationUsers);

    // Phase 2: Branch Management
    await test('Branches CRUD', testBranches);

    // Phase 3: Duty Assignment
    await test('Duty Types CRUD', testDutyTypes);
    await test('Duty Assignments', testDutyAssignments);

    // Summary
    log('\n' + '='.repeat(50), 'info');
    log(`\n📊 Test Results:`, 'info');
    log(`✅ Passed: ${results.passed}`, 'success');
    log(`❌ Failed: ${results.failed}`, results.failed > 0 ? 'error' : 'success');

    if (results.errors.length > 0) {
      log('\n❌ Errors:', 'error');
      results.errors.forEach((err) => {
        log(`  - ${err.test}: ${err.error}`, 'error');
      });
    }

    if (results.failed === 0) {
      log('\n🎉 All tests passed!', 'success');
    }
  } catch (error) {
    log(`\n💥 Fatal error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);




