#!/usr/bin/env node

/**
 * HMS Setup Verification Script
 * Verifies that all HMS modules are properly set up and ready
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (fs.existsSync(fullPath)) {
    log(`✓ ${description}`, 'green');
    return true;
  } else {
    log(`✗ ${description} - NOT FOUND`, 'red');
    return false;
  }
}

function checkDirectoryExists(dirPath, description) {
  const fullPath = path.join(__dirname, '..', dirPath);
  if (fs.existsSync(fullPath)) {
    const files = fs.readdirSync(fullPath);
    log(`✓ ${description} (${files.length} files)`, 'green');
    return true;
  } else {
    log(`✗ ${description} - NOT FOUND`, 'red');
    return false;
  }
}

console.log('');
log('========================================', 'blue');
log('HMS Setup Verification', 'blue');
log('========================================', 'blue');
console.log('');

let allGood = true;

// Check HMS Modules
log('Checking HMS Modules...', 'yellow');
console.log('');

const modules = [
  'src/patients',
  'src/doctors',
  'src/appointments',
  'src/medical-records',
  'src/prescriptions',
  'src/lab-reports',
  'src/patient-billing',
];

modules.forEach((module) => {
  const moduleName = module.split('/').pop();
  if (!checkDirectoryExists(module, `Module: ${moduleName}`)) {
    allGood = false;
  }
});

console.log('');

// Check Migration Files
log('Checking Migration Files...', 'yellow');
console.log('');

const migrations = [
  'migrations/001-create-hms-patients-table.sql',
  'migrations/002-create-hms-doctors-table.sql',
  'migrations/003-create-hms-appointments-table.sql',
  'migrations/004-create-hms-medical-records-table.sql',
  'migrations/005-create-hms-prescriptions-tables.sql',
  'migrations/006-create-hms-lab-reports-tables.sql',
  'migrations/007-create-hms-patient-billing-tables.sql',
  'migrations/009-create-all-hms-tables-complete.sql',
];

migrations.forEach((migration) => {
  const fileName = migration.split('/').pop();
  if (!checkFileExists(migration, `Migration: ${fileName}`)) {
    allGood = false;
  }
});

console.log('');

// Check Scripts
log('Checking Scripts...', 'yellow');
console.log('');

checkFileExists('scripts/run-hms-migrations.sh', 'Migration Runner (Shell)');
checkFileExists('scripts/run-hms-migrations.js', 'Migration Runner (Node.js)');
checkFileExists('scripts/verify-hms-setup.js', 'Verification Script');

console.log('');

// Check Documentation
log('Checking Documentation...', 'yellow');
console.log('');

const docs = [
  'HMS_FEATURES_PLAN.md',
  'HMS_IMPLEMENTATION_SUMMARY.md',
  'HMS_TEST_SUMMARY.md',
  'migrations/HMS_MIGRATION_GUIDE.md',
  'HMS_QUICK_START.md',
  'HMS_STEP_BY_STEP_GUIDE.md',
  'HMS_COMPLETE_SUMMARY.md',
  'HMS_FINAL_STATUS.md',
];

docs.forEach((doc) => {
  checkFileExists(doc, `Doc: ${doc}`);
});

console.log('');

// Check app.module.ts
log('Checking App Module Registration...', 'yellow');
console.log('');

const appModulePath = path.join(__dirname, '..', 'src/app.module.ts');
if (fs.existsSync(appModulePath)) {
  const content = fs.readFileSync(appModulePath, 'utf8');
  const requiredModules = [
    'PatientsModule',
    'DoctorsModule',
    'AppointmentsModule',
    'MedicalRecordsModule',
    'PrescriptionsModule',
    'LabReportsModule',
    'PatientBillingModule',
  ];

  let allRegistered = true;
  requiredModules.forEach((module) => {
    if (content.includes(module)) {
      log(`✓ ${module} registered`, 'green');
    } else {
      log(`✗ ${module} NOT registered`, 'red');
      allRegistered = false;
      allGood = false;
    }
  });

  if (allRegistered) {
    log('✓ All HMS modules registered in app.module.ts', 'green');
  }
} else {
  log('✗ app.module.ts not found', 'red');
  allGood = false;
}

console.log('');

// Check entities in app.module.ts
log('Checking Entity Registration...', 'yellow');
console.log('');

if (fs.existsSync(appModulePath)) {
  const content = fs.readFileSync(appModulePath, 'utf8');
  const requiredEntities = [
    'Patient',
    'Doctor',
    'Appointment',
    'MedicalRecord',
    'Prescription',
    'PrescriptionItem',
    'LabReport',
    'LabTest',
    'PatientBill',
    'BillItem',
  ];

  let allEntitiesRegistered = true;
  requiredEntities.forEach((entity) => {
    if (content.includes(entity)) {
      log(`✓ ${entity} entity registered`, 'green');
    } else {
      log(`✗ ${entity} entity NOT registered`, 'red');
      allEntitiesRegistered = false;
      allGood = false;
    }
  });

  if (allEntitiesRegistered) {
    log('✓ All HMS entities registered in app.module.ts', 'green');
  }
}

console.log('');

// Final Summary
log('========================================', 'blue');
if (allGood) {
  log('✓ All checks passed! HMS is ready to use.', 'green');
  console.log('');
  log('Next Steps:', 'yellow');
  log('1. Run migrations: npm run migrate:hms', 'yellow');
  log('2. Start server: npm run start:dev', 'yellow');
  log('3. Test APIs: Follow HMS_STEP_BY_STEP_GUIDE.md', 'yellow');
} else {
  log('✗ Some checks failed. Please review the errors above.', 'red');
}
log('========================================', 'blue');
console.log('');

process.exit(allGood ? 0 : 1);

