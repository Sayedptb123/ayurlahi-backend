#!/bin/bash

# HMS Migration Runner Script
# This script runs all HMS database migrations in the correct order

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get database credentials from environment or prompt
DB_USER=${DB_USERNAME:-${1:-postgres}}
DB_NAME=${DB_NAME:-${2:-ayurlahi}}
DB_HOST=${DB_HOST:-${3:-localhost}}
DB_PORT=${DB_PORT:-${4:-5432}}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}HMS Database Migration Runner${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql command not found${NC}"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Confirm before proceeding
read -p "Do you want to proceed with migrations? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

# Get password
export PGPASSWORD
if [ -z "$PGPASSWORD" ]; then
    read -sp "Enter PostgreSQL password: " PGPASSWORD
    echo
    export PGPASSWORD
fi

# Migration files in order
MIGRATIONS=(
    "001-create-hms-patients-table.sql"
    "002-create-hms-doctors-table.sql"
    "003-create-hms-appointments-table.sql"
    "004-create-hms-medical-records-table.sql"
    "005-create-hms-prescriptions-tables.sql"
    "006-create-hms-lab-reports-tables.sql"
    "007-create-hms-patient-billing-tables.sql"
)

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"

echo ""
echo -e "${YELLOW}Starting migrations...${NC}"
echo ""

# Run each migration
for migration in "${MIGRATIONS[@]}"; do
    MIGRATION_FILE="$MIGRATIONS_DIR/$migration"
    
    if [ ! -f "$MIGRATION_FILE" ]; then
        echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Running: $migration${NC}"
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Success: $migration${NC}"
    else
        echo -e "${RED}✗ Failed: $migration${NC}"
        echo "Run manually to see error details:"
        echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $MIGRATION_FILE"
        exit 1
    fi
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All migrations completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Verify tables were created
echo -e "${YELLOW}Verifying tables...${NC}"
TABLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'patients', 'doctors', 'appointments', 'medical_records',
        'prescriptions', 'prescription_items', 'lab_reports', 'lab_tests',
        'patient_bills', 'bill_items'
    );
")

if [ "$TABLES" -eq 10 ]; then
    echo -e "${GREEN}✓ All 10 HMS tables created successfully!${NC}"
else
    echo -e "${YELLOW}⚠ Found $TABLES tables (expected 10)${NC}"
fi

echo ""
echo "Next steps:"
echo "1. Start the server: npm run start:dev"
echo "2. Test API endpoints with Postman or curl"
echo "3. Verify data flow through the system"



