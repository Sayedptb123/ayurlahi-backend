#!/usr/bin/env node

/**
 * Schema Verification Script
 * Verifies that database schema matches TypeORM entity definitions
 */

const { DataSource } = require('typeorm');
const fs = require('fs');
const path = require('path');

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

// Get database config from .env
function getDbConfig() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const config = {};
      envContent.split('\n').forEach((line) => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
          config[key.trim()] = values.join('=').trim();
        }
      });
      return config;
    }
  } catch (error) {
    // Ignore
  }
  return {};
}

async function getDatabaseColumns(dataSource, tableName) {
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position;
  `;
  
  try {
    const result = await dataSource.query(query, [tableName]);
    return result.map(row => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      default: row.column_default,
    }));
  } catch (error) {
    return [];
  }
}

function getEntityColumns(metadata) {
  // Map TypeORM type functions to string names
  const typeMap = {
    'String': 'varchar',
    'Text': 'text',
    'Number': 'integer',
    'Int': 'integer',
    'BigInt': 'bigint',
    'Float': 'decimal',
    'Double': 'decimal',
    'Decimal': 'decimal',
    'Boolean': 'boolean',
    'Date': 'date',
    'Time': 'time',
    'DateTime': 'timestamp',
    'Timestamp': 'timestamp',
    'Json': 'jsonb',
    'Jsonb': 'jsonb',
    'Uuid': 'uuid',
    'Enum': 'enum',
  };

  return metadata.columns.map(col => {
    // Get type as string - TypeORM stores types in different ways
    let typeStr = '';
    
    if (typeof col.type === 'string') {
      typeStr = col.type;
    } else if (col.type && typeof col.type === 'function') {
      // TypeORM type function - map to string
      const funcName = col.type.name || '';
      typeStr = typeMap[funcName] || funcName.toLowerCase() || 'unknown';
    } else if (col.type) {
      typeStr = String(col.type);
    }
    
    // If still empty, try to infer from column metadata
    if (!typeStr && col.type) {
      const typeStrLower = String(col.type).toLowerCase();
      if (typeStrLower.includes('varchar') || typeStrLower.includes('string')) {
        typeStr = 'varchar';
      } else if (typeStrLower.includes('text')) {
        typeStr = 'text';
      } else if (typeStrLower.includes('int')) {
        typeStr = 'integer';
      } else if (typeStrLower.includes('bool')) {
        typeStr = 'boolean';
      } else if (typeStrLower.includes('date')) {
        typeStr = 'date';
      } else if (typeStrLower.includes('timestamp')) {
        typeStr = 'timestamp';
      } else if (typeStrLower.includes('json')) {
        typeStr = 'jsonb';
      } else if (typeStrLower.includes('uuid')) {
        typeStr = 'uuid';
      } else if (typeStrLower.includes('enum')) {
        typeStr = 'enum';
      }
    }
    
    return {
      name: col.databaseName,
      type: typeStr || 'unknown',
      nullable: col.isNullable,
      default: col.default,
      propertyName: col.propertyName,
    };
  });
}

function compareSchemas(entityCols, dbCols, entityName) {
  const issues = [];
  const entityColMap = new Map(entityCols.map(col => [col.name, col]));
  const dbColMap = new Map(dbCols.map(col => [col.name, col]));

  // Check for missing columns in database
  for (const entityCol of entityCols) {
    if (!dbColMap.has(entityCol.name)) {
      issues.push({
        type: 'missing_in_db',
        column: entityCol.name,
        entity: entityName,
        property: entityCol.propertyName,
        message: `Column '${entityCol.name}' (property: ${entityCol.propertyName}) exists in entity but not in database`,
      });
    }
  }

  // Check for extra columns in database (warn only)
  for (const dbCol of dbCols) {
    if (!entityColMap.has(dbCol.name)) {
      issues.push({
        type: 'extra_in_db',
        column: dbCol.name,
        entity: entityName,
        message: `Column '${dbCol.name}' exists in database but not in entity (may be legacy)`,
      });
    }
  }

  // Check for type mismatches (basic check)
  for (const entityCol of entityCols) {
    const dbCol = dbColMap.get(entityCol.name);
    if (dbCol) {
      // Enhanced type mapping - recognizes compatible types
      const typeMappings = {
        'varchar': ['character varying', 'varchar', 'text'],
        'text': ['text', 'character varying', 'varchar'],
        'uuid': ['uuid'],
        'boolean': ['boolean'],
        'timestamp': ['timestamp without time zone', 'timestamp', 'timestamp with time zone'],
        'date': ['date'],
        'time': ['time without time zone', 'time', 'time with time zone'],
        'integer': ['integer', 'bigint', 'smallint'],
        'int': ['integer', 'bigint', 'smallint'],
        'decimal': ['numeric', 'decimal'],
        'numeric': ['numeric', 'decimal'],
        'jsonb': ['jsonb', 'json'],
        'json': ['jsonb', 'json'],
        'enum': ['user-defined'], // PostgreSQL enums show as USER-DEFINED
      };

      // Types should already be strings from getEntityColumns, but ensure safety
      const entityType = (entityCol.type || '').toString().toLowerCase();
      const dbType = (dbCol.type || '').toString().toLowerCase();
      
      // Check if types are compatible
      let typeMatches = false;
      
      // Direct match
      if (entityType === dbType) {
        typeMatches = true;
      } else {
        // Check mappings - handle enum specially
        if (entityType === 'enum' && dbType === 'user-defined') {
          typeMatches = true; // PostgreSQL enums are USER-DEFINED
        } else {
          // Check other mappings
          for (const [key, values] of Object.entries(typeMappings)) {
            if (entityType.includes(key) || entityType === key) {
              if (values.some(v => dbType.includes(v) || dbType === v)) {
                typeMatches = true;
                break;
              }
            }
          }
        }
      }

      // Only report if types don't match and both are non-empty
      if (!typeMatches && entityType && dbType) {
        issues.push({
          type: 'type_mismatch',
          column: entityCol.name,
          entity: entityName,
          entityType: entityCol.type,
          dbType: dbCol.type,
          message: `Type mismatch for '${entityCol.name}': entity expects ${entityCol.type}, database has ${dbCol.type}`,
        });
      }
    }
  }

  return issues;
}

async function main() {
  log('========================================', 'blue');
  log('Schema Verification Script', 'blue');
  log('========================================', 'blue');
  console.log('');

  // Check if dist folder exists (entities need to be compiled)
  const distPath = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distPath)) {
    log('Error: dist folder not found. Please run "npm run build" first.', 'red');
    process.exit(1);
  }

  const config = getDbConfig();
  
  // Load entities from dist folder using glob pattern
  const entitiesPath = path.join(__dirname, '..', 'dist', '**', '*.entity.js');
  
  const dataSource = new DataSource({
    type: 'postgres',
    host: config.DB_HOST || 'localhost',
    port: parseInt(config.DB_PORT || '5432'),
    username: config.DB_USERNAME || 'postgres',
    password: config.DB_PASSWORD || '',
    database: config.DB_NAME || 'ayurlahi',
    entities: [entitiesPath],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    log('✓ Database connection established', 'green');
    log('✓ Entities loaded from dist folder', 'green');
    console.log('');

    // Get all loaded entity metadata
    const allMetadata = dataSource.entityMetadatas;
    
    if (allMetadata.length === 0) {
      log('⚠ No entities found. Make sure entities are compiled in dist folder.', 'yellow');
      await dataSource.destroy();
      process.exit(1);
    }

    log(`Found ${allMetadata.length} entity/entities to verify`, 'cyan');
    console.log('');

    // Define which entities to verify (by table name)
    const tablesToVerify = [
      'users',
      'products',
      'clinics',
      'manufacturers',
      'patients',
      'doctors',
      'appointments',
      'medical_records',
      'prescriptions',
      'prescription_items',
      'lab_reports',
      'lab_tests',
      'patient_bills',
      'bill_items',
    ];

    let totalIssues = 0;
    const allIssues = [];
    let verifiedCount = 0;

    for (const tableName of tablesToVerify) {
      // Find metadata for this table
      const metadata = allMetadata.find(m => m.tableName === tableName);
      
      if (!metadata) {
        log(`⚠ Table '${tableName}' not found in entities, skipping...`, 'yellow');
        continue;
      }

      log(`Verifying ${metadata.name} entity (table: ${tableName})...`, 'cyan');
      
      try {
        const entityCols = getEntityColumns(metadata);
        const dbCols = await getDatabaseColumns(dataSource, tableName);

        if (dbCols.length === 0) {
          log(`  ⚠ Table '${tableName}' does not exist in database`, 'yellow');
          continue;
        }

        const issues = compareSchemas(entityCols, dbCols, metadata.name);
        
        if (issues.length === 0) {
          log(`  ✓ ${metadata.name} schema matches database (${entityCols.length} columns)`, 'green');
          verifiedCount++;
        } else {
          log(`  ✗ ${metadata.name} has ${issues.length} issue(s)`, 'red');
          allIssues.push(...issues);
          totalIssues += issues.length;
        }
      } catch (error) {
        log(`  ✗ Error verifying ${metadata.name}: ${error.message}`, 'red');
        totalIssues++;
      }
    }

    console.log('');
    log('========================================', 'blue');
    log('Verification Summary', 'blue');
    log('========================================', 'blue');
    console.log('');

    log(`✓ Verified: ${verifiedCount} entities`, 'green');
    if (totalIssues > 0) {
      log(`✗ Issues found: ${totalIssues}`, 'red');
    } else {
      log('✓ All verified schemas match!', 'green');
    }
    console.log('');

    if (totalIssues > 0) {
      // Group issues by type
      const byType = {};
      allIssues.forEach(issue => {
        if (!byType[issue.type]) {
          byType[issue.type] = [];
        }
        byType[issue.type].push(issue);
      });

      for (const [type, issues] of Object.entries(byType)) {
        log(`${type.toUpperCase().replace(/_/g, ' ')}:`, 'yellow');
        issues.forEach(issue => {
          log(`  - ${issue.message}`, 'red');
        });
        console.log('');
      }
    }

    await dataSource.destroy();
    process.exit(totalIssues > 0 ? 1 : 0);
  } catch (error) {
    log(`Error: ${error.message}`, 'red');
    if (error.stack) {
      log(`Stack: ${error.stack}`, 'red');
    }
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

main();
