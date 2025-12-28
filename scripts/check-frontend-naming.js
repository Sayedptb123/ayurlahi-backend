#!/usr/bin/env node

/**
 * Script to check frontend code for snake_case field names
 * that should be camelCase to match the backend API.
 * 
 * Usage: node scripts/check-frontend-naming.js [frontend-directory]
 */

const fs = require('fs');
const path = require('path');

// Common snake_case patterns that should be camelCase
const SNAKE_CASE_PATTERNS = [
  'first_name',
  'last_name',
  'clinic_id',
  'patient_id',
  'doctor_id',
  'appointment_id',
  'date_of_birth',
  'appointment_date',
  'visit_date',
  'is_active',
  'is_verified',
  'is_email_verified',
  'created_at',
  'updated_at',
  'deleted_at',
  'whatsapp_number',
  'blood_group',
  'emergency_contact',
  'medical_history',
  'organization_id',
  'organization_type',
  'position_custom',
  'address_street',
  'address_city',
  'address_district',
  'address_state',
  'address_zip_code',
  'address_country',
  'date_of_joining',
  'approval_status',
  'rejection_reason',
  'approved_at',
  'approved_by',
  'last_login_at',
  'mobile_numbers',
  'shipping_address',
  'shipping_city',
  'shipping_district',
  'shipping_state',
  'shipping_pincode',
  'shipping_phone',
  'order_number',
  'gst_amount',
  'shipping_charges',
  'platform_fee',
  'total_amount',
  'whatsapp_message_id',
  'razorpay_order_id',
  'bill_number',
  'bill_date',
  'due_date',
  'payment_method',
  'report_number',
  'report_date',
  'prescription_date',
  'chief_complaint',
  'license_number',
  'consultation_fee',
];

// File extensions to check
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Directories to ignore
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next'];

// Files/directories that contain SQL or database scripts (should use snake_case)
const SQL_SCRIPT_PATTERNS = [
  /scripts[\/\\]generate-.*\.js$/i,
  /scripts[\/\\].*\.sql$/i,
  /.*seed.*\.js$/i,
  /.*migration.*\.js$/i,
  /.*database.*\.js$/i,
];

// Check if file contains SQL statements (INSERT, UPDATE, SELECT, etc.)
function containsSQL(content) {
  const sqlKeywords = [
    'INSERT INTO',
    'UPDATE',
    'SELECT',
    'DELETE FROM',
    'CREATE TABLE',
    'ALTER TABLE',
    'FROM users',
    'FROM clinics',
    'FROM patients',
  ];
  
  const upperContent = content.toUpperCase();
  return sqlKeywords.some(keyword => upperContent.includes(keyword));
}

/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Check if file should be processed
 */
function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  
  // Only process TypeScript/JavaScript files
  if (!FILE_EXTENSIONS.includes(ext)) {
    return false;
  }
  
  // Skip SQL scripts and database-related files
  if (SQL_SCRIPT_PATTERNS.some(pattern => pattern.test(filePath))) {
    return false;
  }
  
  return true;
}

/**
 * Check if directory should be ignored
 */
function shouldIgnoreDir(dirName) {
  return IGNORE_DIRS.includes(dirName);
}

/**
 * Find all snake_case patterns in a file
 */
function findSnakeCaseInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip files that contain SQL statements (they should use snake_case)
    if (containsSQL(content)) {
      return [];
    }
    
    const issues = [];

    SNAKE_CASE_PATTERNS.forEach((pattern) => {
      // Create regex to find the pattern (as property name, variable, etc.)
      // Match: .pattern, ['pattern'], "pattern", pattern:, pattern=, etc.
      const regex = new RegExp(
        `(?:['"\`]|\\b)${pattern.replace(/_/g, '_')}(?:['"\`]|\\b)`,
        'g'
      );
      
      const matches = content.match(regex);
      if (matches) {
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes(pattern)) {
            issues.push({
              pattern,
              camelCase: snakeToCamel(pattern),
              line: index + 1,
              content: line.trim(),
            });
          }
        });
      }
    });

    return issues;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath, results = []) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!shouldIgnoreDir(entry.name)) {
          scanDirectory(fullPath, results);
        }
      } else if (entry.isFile() && shouldProcessFile(fullPath)) {
        const issues = findSnakeCaseInFile(fullPath);
        if (issues.length > 0) {
          results.push({
            file: fullPath,
            issues: issues,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dirPath}:`, error.message);
  }

  return results;
}

/**
 * Main function
 */
function main() {
  const frontendDir = process.argv[2] || process.cwd();
  
  console.log('🔍 Checking for snake_case field names in frontend...\n');
  console.log(`📁 Scanning: ${frontendDir}\n`);

  if (!fs.existsSync(frontendDir)) {
    console.error(`❌ Directory not found: ${frontendDir}`);
    process.exit(1);
  }

  const results = scanDirectory(frontendDir);

  if (results.length === 0) {
    console.log('✅ No snake_case patterns found! Your frontend is using camelCase correctly.\n');
    process.exit(0);
  }

  console.log(`⚠️  Found ${results.length} file(s) with snake_case patterns:\n`);

  results.forEach((result) => {
    console.log(`📄 ${result.file}`);
    
    // Group issues by pattern
    const grouped = {};
    result.issues.forEach((issue) => {
      if (!grouped[issue.pattern]) {
        grouped[issue.pattern] = [];
      }
      grouped[issue.pattern].push(issue);
    });

    Object.entries(grouped).forEach(([pattern, issues]) => {
      console.log(`   ❌ "${pattern}" → Should be "${snakeToCamel(pattern)}"`);
      issues.slice(0, 3).forEach((issue) => {
        console.log(`      Line ${issue.line}: ${issue.content.substring(0, 80)}...`);
      });
      if (issues.length > 3) {
        console.log(`      ... and ${issues.length - 3} more occurrence(s)`);
      }
    });
    console.log('');
  });

  console.log('\n💡 Tip: Use camelCase to match the backend API responses.');
  console.log('   See FRONTEND_UPDATE_GUIDE.md for detailed migration guide.');
  console.log('\n📝 Note: SQL scripts and database files are ignored (they should use snake_case).\n');

  process.exit(1);
}

main();

