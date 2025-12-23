#!/usr/bin/env node

/**
 * Get Entity Column Names Utility
 * Extracts actual database column names from TypeORM entities
 * Use this in seed scripts to avoid hardcoding column names
 */

const { DataSource } = require('typeorm');
const path = require('path');
const fs = require('fs');

// Get database config
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

/**
 * Get column names for an entity
 * @param {DataSource} dataSource - TypeORM DataSource
 * @param {Function} EntityClass - Entity class
 * @returns {Object} Column mapping { propertyName: databaseColumnName }
 */
function getEntityColumnNames(dataSource, EntityClass) {
  try {
    const metadata = dataSource.getMetadata(EntityClass);
    const columnMap = {};
    
    metadata.columns.forEach(column => {
      columnMap[column.propertyName] = column.databaseName;
    });
    
    return columnMap;
  } catch (error) {
    throw new Error(`Failed to get column names: ${error.message}`);
  }
}

/**
 * Generate INSERT SQL with correct column names from entity
 * @param {Object} columnMap - Column mapping from getEntityColumnNames
 * @param {string} tableName - Database table name
 * @param {Object} data - Data object with property names (camelCase)
 * @returns {Object} { sql, values } - SQL statement and values array
 */
function generateInsertSQL(columnMap, tableName, data) {
  const columns = [];
  const values = [];
  const placeholders = [];
  let paramIndex = 1;

  for (const [propertyName, dbColumnName] of Object.entries(columnMap)) {
    if (data.hasOwnProperty(propertyName) && data[propertyName] !== undefined) {
      columns.push(`"${dbColumnName}"`);
      values.push(data[propertyName]);
      placeholders.push(`$${paramIndex++}`);
    }
  }

  const sql = `
    INSERT INTO "${tableName}" (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING id;
  `.trim();

  return { sql, values };
}

// Example usage function
async function example() {
  const config = getDbConfig();
  const dataSource = new DataSource({
    type: 'postgres',
    host: config.DB_HOST || 'localhost',
    port: parseInt(config.DB_PORT || '5432'),
    username: config.DB_USERNAME || 'postgres',
    password: config.DB_PASSWORD || '',
    database: config.DB_NAME || 'ayurlahi',
  });

  try {
    await dataSource.initialize();
    
    // Import entity (after build)
    const { User } = require('../dist/users/entities/user.entity');
    
    // Get column mapping
    const columnMap = getEntityColumnNames(dataSource, User);
    console.log('User entity column mapping:');
    console.log(columnMap);
    
    // Example: Generate INSERT SQL
    const userData = {
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      firstName: 'John',
      lastName: 'Doe',
      role: 'clinic',
      phone: '1234567890',
    };
    
    const { sql, values } = generateInsertSQL(columnMap, 'users', userData);
    console.log('\nGenerated SQL:');
    console.log(sql);
    console.log('\nValues:');
    console.log(values);
    
    await dataSource.destroy();
  } catch (error) {
    console.error('Error:', error.message);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

// Export functions for use in other scripts
if (require.main === module) {
  example();
} else {
  module.exports = {
    getEntityColumnNames,
    generateInsertSQL,
    getDbConfig,
  };
}

