#!/bin/bash

# HMS API Testing Script
# This script helps you test all HMS API endpoints

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}HMS API Testing Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if server is running
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${RED}Error: Server is not running on port 3000${NC}"
    echo "Please start the server: npm run start:dev"
    exit 1
fi

echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Get credentials
read -p "Enter your email: " EMAIL
read -sp "Enter your password: " PASSWORD
echo ""

# Login
echo -e "${YELLOW}Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Login failed. Please check your credentials.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo ""

# Test endpoints
echo -e "${YELLOW}Testing HMS Endpoints...${NC}"
echo ""

# 1. List Patients
echo "1. Testing GET /api/patients"
curl -s -X GET "http://localhost:3000/api/patients?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | head -c 200
echo ""
echo ""

# 2. List Doctors
echo "2. Testing GET /api/doctors"
curl -s -X GET "http://localhost:3000/api/doctors?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | head -c 200
echo ""
echo ""

# 3. List Appointments
echo "3. Testing GET /api/appointments"
curl -s -X GET "http://localhost:3000/api/appointments?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | head -c 200
echo ""
echo ""

# 4. List Medical Records
echo "4. Testing GET /api/medical-records"
curl -s -X GET "http://localhost:3000/api/medical-records?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | head -c 200
echo ""
echo ""

# 5. List Prescriptions
echo "5. Testing GET /api/prescriptions"
curl -s -X GET "http://localhost:3000/api/prescriptions?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | head -c 200
echo ""
echo ""

# 6. List Lab Reports
echo "6. Testing GET /api/lab-reports"
curl -s -X GET "http://localhost:3000/api/lab-reports?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | head -c 200
echo ""
echo ""

# 7. List Bills
echo "7. Testing GET /api/patient-billing"
curl -s -X GET "http://localhost:3000/api/patient-billing?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | head -c 200
echo ""
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}API Testing Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "For detailed testing, see: HMS_POST_MIGRATION_CHECKLIST.md"

