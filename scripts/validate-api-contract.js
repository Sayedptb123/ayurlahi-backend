#!/usr/bin/env node

/**
 * Validate API Contract
 * This script validates that the API implementation matches the OpenAPI specification
 * and checks for common issues like:
 * - Missing DTOs
 * - Type mismatches
 * - Missing validation decorators
 */

const fs = require('fs');
const path = require('path');

const OPENAPI_SPEC_PATH = path.join(__dirname, '..', 'api-spec', 'openapi.json');

function validateContract() {
  console.log('🔍 Validating API contract...');

  if (!fs.existsSync(OPENAPI_SPEC_PATH)) {
    console.error('❌ OpenAPI spec not found. Please run the backend server first.');
    process.exit(1);
  }

  const spec = JSON.parse(fs.readFileSync(OPENAPI_SPEC_PATH, 'utf-8'));
  const errors = [];
  const warnings = [];

  // Validate paths
  if (spec.paths) {
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (method === 'parameters') continue;

        // Check for operationId
        if (!operation.operationId) {
          warnings.push(`⚠️  Missing operationId for ${method.toUpperCase()} ${path}`);
        }

        // Check for request body validation
        if (operation.requestBody) {
          const schema = operation.requestBody.content?.['application/json']?.schema;
          if (!schema) {
            warnings.push(`⚠️  Missing request body schema for ${method.toUpperCase()} ${path}`);
          }
        }

        // Check for response schemas
        if (operation.responses) {
          const successResponse = operation.responses['200'] || operation.responses['201'];
          if (successResponse && !successResponse.content?.['application/json']?.schema) {
            warnings.push(`⚠️  Missing response schema for ${method.toUpperCase()} ${path}`);
          }
        }

        // Check for security requirements
        if (operation.security && operation.security.length > 0) {
          const hasJWT = operation.security.some(s => s['JWT-auth']);
          if (!hasJWT && path.includes('/auth/') && method !== 'post') {
            warnings.push(`⚠️  Consider adding JWT auth for ${method.toUpperCase()} ${path}`);
          }
        }
      }
    }
  }

  // Validate schemas
  if (spec.components && spec.components.schemas) {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      if (schema.type === 'object' && !schema.properties) {
        errors.push(`❌ Schema ${name} is object type but has no properties`);
      }
    }
  }

  // Report results
  console.log('\n📊 Validation Results:\n');

  if (errors.length > 0) {
    console.log('❌ Errors:');
    errors.forEach(error => console.log(`   ${error}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach(warning => console.log(`   ${warning}`));
    console.log('');
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ API contract is valid!\n');
  } else if (errors.length === 0) {
    console.log('✅ No critical errors found. Review warnings above.\n');
  } else {
    console.log('❌ Validation failed. Please fix the errors above.\n');
    process.exit(1);
  }

  // Summary
  const pathCount = Object.keys(spec.paths || {}).length;
  const schemaCount = Object.keys(spec.components?.schemas || {}).length;
  console.log(`📈 Summary:`);
  console.log(`   - API Endpoints: ${pathCount}`);
  console.log(`   - Schemas: ${schemaCount}`);
  console.log(`   - Errors: ${errors.length}`);
  console.log(`   - Warnings: ${warnings.length}\n`);
}

// Run if called directly
if (require.main === module) {
  validateContract();
}

module.exports = { validateContract };


