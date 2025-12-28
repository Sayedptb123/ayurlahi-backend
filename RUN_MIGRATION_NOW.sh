#!/bin/bash

# Run Disputes & Invoices Migration
# This script runs the migration to create disputes and invoices tables

# Option 1: If you have .env file with DB credentials
if [ -f .env ]; then
    source .env
    echo "Using credentials from .env file..."
    echo "Database: $DB_NAME"
    echo "User: $DB_USERNAME"
    echo "Host: $DB_HOST"
    echo ""
    
    if [ -z "$DB_PASSWORD" ]; then
        echo "Running migration (will prompt for password)..."
        psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "$DB_NAME" -f migrations/021-create-market-support-tables.sql
    else
        echo "Running migration with password from .env..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "$DB_NAME" -f migrations/021-create-market-support-tables.sql
    fi
else
    echo "No .env file found. Please provide database credentials:"
    echo ""
    echo "Usage:"
    echo "  psql -U your_username -d ayurlahi -f migrations/021-create-market-support-tables.sql"
    echo ""
    echo "Or with password:"
    echo "  PGPASSWORD=your_password psql -U your_username -d ayurlahi -f migrations/021-create-market-support-tables.sql"
    echo ""
    read -p "Enter PostgreSQL username: " DB_USER
    read -sp "Enter PostgreSQL password (optional, press Enter to skip): " DB_PASS
    echo ""
    
    if [ -z "$DB_PASS" ]; then
        psql -U "$DB_USER" -d ayurlahi -f migrations/021-create-market-support-tables.sql
    else
        PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -d ayurlahi -f migrations/021-create-market-support-tables.sql
    fi
fi

echo ""
echo "Migration complete! Verifying tables..."
psql -U "${DB_USERNAME:-$DB_USER}" -d ayurlahi -c "\d disputes" 2>/dev/null && echo "✅ Disputes table exists" || echo "⚠️  Could not verify disputes table"
psql -U "${DB_USERNAME:-$DB_USER}" -d ayurlahi -c "\d invoices" 2>/dev/null && echo "✅ Invoices table exists" || echo "⚠️  Could not verify invoices table"

