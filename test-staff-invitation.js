#!/usr/bin/env node

/**
 * Automated Test Script for Staff Invitation Backend
 * Tests the complete staff invitation flow end-to-end
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
let authToken = '';
let testStaffId = '';
let invitationToken = '';
let testUserId = '';

// ANSI color codes for output
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

function logStep(step, message) {
    log(`\n[${'='.repeat(60)}]`, 'cyan');
    log(`STEP ${step}: ${message}`, 'cyan');
    log(`[${'='.repeat(60)}]`, 'cyan');
}

function logSuccess(message) {
    log(`✓ ${message}`, 'green');
}

function logError(message) {
    log(`✗ ${message}`, 'red');
}

function logInfo(message) {
    log(`ℹ ${message}`, 'blue');
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Login as clinic owner
async function testLogin() {
    logStep(1, 'Login as Clinic Owner');

    // Try multiple test accounts
    const testAccounts = [
        { email: 'clinic1.owner@test.com', password: 'password123' },
        { email: 'clinic2.owner@test.com', password: 'password123' },
        { email: 'test1766812906311@example.com', password: 'password123' },
    ];

    for (const account of testAccounts) {
        try {
            logInfo(`Trying login with: ${account.email}`);
            const response = await axios.post(`${BASE_URL}/auth/login`, account);

            authToken = response.data.accessToken;
            testUserId = response.data.user.id;

            logSuccess('Login successful');
            logInfo(`User ID: ${testUserId}`);
            logInfo(`Token: ${authToken.substring(0, 20)}...`);
            logInfo(`Role: ${response.data.currentOrganisation?.role || 'N/A'}`);
            logInfo(`Organisation: ${response.data.currentOrganisation?.name || 'N/A'}`);

            return true;
        } catch (error) {
            logInfo(`Failed with ${account.email}: ${error.response?.data?.message || error.message}`);
            continue;
        }
    }

    logError('All login attempts failed');
    logInfo('Please ensure you have a test user with credentials: clinic1.owner@test.com / password123');
    return false;
}

// Test 2: Create a test staff member
async function testCreateStaff() {
    logStep(2, 'Create Test Staff Member');

    try {
        const response = await axios.post(
            `${BASE_URL}/staff`,
            {
                firstName: 'Dr. John',
                lastName: 'Smith',
                position: 'doctor',
                email: `test.doctor.${Date.now()}@clinic.com`,
                phone: `+1${Math.floor(Math.random() * 10000000000)}`,
                dateOfJoining: new Date().toISOString().split('T')[0]
            },
            {
                headers: { Authorization: `Bearer ${authToken}` }
            }
        );

        testStaffId = response.data.id;

        logSuccess('Staff member created');
        logInfo(`Staff ID: ${testStaffId}`);
        logInfo(`Name: ${response.data.firstName} ${response.data.lastName}`);
        logInfo(`Position: ${response.data.position}`);
        logInfo(`Email: ${response.data.email}`);

        return true;
    } catch (error) {
        logError(`Failed to create staff: ${error.response?.data?.message || error.message}`);
        if (error.response?.data) {
            logInfo(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        return false;
    }
}

// Test 3: Invite staff member
async function testInviteStaff() {
    logStep(3, 'Invite Staff Member');

    try {
        const response = await axios.post(
            `${BASE_URL}/staff/${testStaffId}/invite`,
            {
                sendEmail: true,
                sendSMS: false
            },
            {
                headers: { Authorization: `Bearer ${authToken}` }
            }
        );

        invitationToken = response.data.invitationToken;

        logSuccess('Invitation sent successfully');
        logInfo(`Invitation Token: ${invitationToken.substring(0, 20)}...`);
        logInfo(`Expires At: ${response.data.expiresAt}`);

        return true;
    } catch (error) {
        logError(`Failed to invite staff: ${error.response?.data?.message || error.message}`);
        if (error.response?.data) {
            logInfo(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        return false;
    }
}

// Test 4: Verify staff record updated
async function testVerifyStaffRecord() {
    logStep(4, 'Verify Staff Record Updated');

    try {
        const response = await axios.get(
            `${BASE_URL}/staff/${testStaffId}`,
            {
                headers: { Authorization: `Bearer ${authToken}` }
            }
        );

        const staff = response.data;

        logSuccess('Staff record retrieved');
        logInfo(`Has User Account: ${staff.hasUserAccount}`);
        logInfo(`User Account Status: ${staff.userAccountStatus}`);
        logInfo(`User ID: ${staff.userId}`);
        logInfo(`Invitation Sent At: ${staff.invitationSentAt}`);

        // Verify fields
        if (!staff.hasUserAccount) {
            logError('hasUserAccount should be true');
            return false;
        }

        if (staff.userAccountStatus !== 'pending') {
            logError(`userAccountStatus should be 'pending', got '${staff.userAccountStatus}'`);
            return false;
        }

        if (!staff.userId) {
            logError('userId should be set');
            return false;
        }

        logSuccess('All fields verified correctly');
        return true;
    } catch (error) {
        logError(`Failed to verify staff record: ${error.response?.data?.message || error.message}`);
        return false;
    }
}

// Test 5: Accept invitation
async function testAcceptInvitation() {
    logStep(5, 'Accept Invitation');

    try {
        const response = await axios.post(
            `${BASE_URL}/staff/accept-invitation`,
            {
                token: invitationToken,
                password: 'SecurePass123',
                confirmPassword: 'SecurePass123'
            }
        );

        logSuccess('Invitation accepted successfully');
        logInfo(`Message: ${response.data.message}`);

        return true;
    } catch (error) {
        logError(`Failed to accept invitation: ${error.response?.data?.message || error.message}`);
        if (error.response?.data) {
            logInfo(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        return false;
    }
}

// Test 6: Verify staff can login
async function testStaffLogin() {
    logStep(6, 'Test Staff Login');

    // Get staff email first
    try {
        const staffResponse = await axios.get(
            `${BASE_URL}/staff/${testStaffId}`,
            {
                headers: { Authorization: `Bearer ${authToken}` }
            }
        );

        const staffEmail = staffResponse.data.email;

        logInfo(`Attempting login with email: ${staffEmail}`);

        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email: staffEmail,
            password: 'SecurePass123'
        });

        logSuccess('Staff login successful!');
        logInfo(`User ID: ${response.data.user.id}`);
        logInfo(`Name: ${response.data.user.firstName} ${response.data.user.lastName}`);
        logInfo(`Organisation: ${response.data.currentOrganisation?.name || 'N/A'}`);
        logInfo(`Role: ${response.data.currentOrganisation?.role || 'N/A'}`);

        // Verify role is DOCTOR
        if (response.data.currentOrganisation?.role !== 'DOCTOR') {
            logError(`Expected role 'DOCTOR', got '${response.data.currentOrganisation?.role}'`);
            return false;
        }

        logSuccess('Role verified as DOCTOR');
        return true;
    } catch (error) {
        logError(`Staff login failed: ${error.response?.data?.message || error.message}`);
        if (error.response?.data) {
            logInfo(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        return false;
    }
}

// Test 7: Test resend invitation (should fail - already accepted)
async function testResendInvitation() {
    logStep(7, 'Test Resend Invitation (Should Fail)');

    try {
        await axios.post(
            `${BASE_URL}/staff/${testStaffId}/resend-invitation`,
            {},
            {
                headers: { Authorization: `Bearer ${authToken}` }
            }
        );

        logError('Resend should have failed (invitation already accepted)');
        return false;
    } catch (error) {
        if (error.response?.status === 400) {
            logSuccess('Resend correctly rejected (invitation already accepted)');
            logInfo(`Error message: ${error.response.data.message}`);
            return true;
        } else {
            logError(`Unexpected error: ${error.response?.data?.message || error.message}`);
            return false;
        }
    }
}

// Test 8: Test duplicate invitation (should fail)
async function testDuplicateInvitation() {
    logStep(8, 'Test Duplicate Invitation (Should Fail)');

    try {
        await axios.post(
            `${BASE_URL}/staff/${testStaffId}/invite`,
            {
                sendEmail: true,
                sendSMS: false
            },
            {
                headers: { Authorization: `Bearer ${authToken}` }
            }
        );

        logError('Duplicate invitation should have failed');
        return false;
    } catch (error) {
        if (error.response?.status === 400) {
            logSuccess('Duplicate invitation correctly rejected');
            logInfo(`Error message: ${error.response.data.message}`);
            return true;
        } else {
            logError(`Unexpected error: ${error.response?.data?.message || error.message}`);
            return false;
        }
    }
}

// Main test runner
async function runTests() {
    log('\n' + '='.repeat(70), 'cyan');
    log('  STAFF INVITATION BACKEND - AUTOMATED TEST SUITE', 'cyan');
    log('='.repeat(70) + '\n', 'cyan');

    const results = {
        total: 0,
        passed: 0,
        failed: 0
    };

    const tests = [
        { name: 'Login', fn: testLogin },
        { name: 'Create Staff', fn: testCreateStaff },
        { name: 'Invite Staff', fn: testInviteStaff },
        { name: 'Verify Staff Record', fn: testVerifyStaffRecord },
        { name: 'Accept Invitation', fn: testAcceptInvitation },
        { name: 'Staff Login', fn: testStaffLogin },
        { name: 'Resend Invitation (Negative)', fn: testResendInvitation },
        { name: 'Duplicate Invitation (Negative)', fn: testDuplicateInvitation },
    ];

    for (const test of tests) {
        results.total++;
        const success = await test.fn();

        if (success) {
            results.passed++;
        } else {
            results.failed++;
            log(`\n⚠️  Test failed, stopping test suite`, 'yellow');
            break;
        }

        await sleep(500); // Small delay between tests
    }

    // Print summary
    log('\n' + '='.repeat(70), 'cyan');
    log('  TEST SUMMARY', 'cyan');
    log('='.repeat(70), 'cyan');
    log(`Total Tests: ${results.total}`, 'blue');
    log(`Passed: ${results.passed}`, 'green');
    log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
    log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`,
        results.failed > 0 ? 'yellow' : 'green');
    log('='.repeat(70) + '\n', 'cyan');

    if (results.failed === 0) {
        log('🎉 ALL TESTS PASSED! Backend is working correctly.', 'green');
    } else {
        log('❌ SOME TESTS FAILED. Please review the errors above.', 'red');
    }

    process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
});
