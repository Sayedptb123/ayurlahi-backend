#!/bin/bash

# Simple test to trigger the error and show what happens

echo "=== Testing Staff Invitation with Logging ==="

# Login
echo "1. Logging in..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"clinic2.owner@test.com","password":"password123"}' | jq -r '.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "ERROR: Login failed"
  exit 1
fi

echo "   ✓ Login successful"

# Create staff
echo "2. Creating staff member..."
UNIQUE_PHONE="+1$(date +%s)"  # Use timestamp for unique phone
STAFF_RESPONSE=$(curl -s -X POST http://localhost:3000/api/staff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "firstName": "Test",
    "lastName": "Doctor",
    "position": "doctor",
    "email": "testdoc'$(date +%s)'@clinic.com",
    "phone": "'$UNIQUE_PHONE'",
    "dateOfJoining": "'$(date +%Y-%m-%d)'"
  }')


STAFF_ID=$(echo "$STAFF_RESPONSE" | jq -r '.id')

if [ "$STAFF_ID" = "null" ] || [ -z "$STAFF_ID" ]; then
  echo "ERROR: Staff creation failed"
  echo "$STAFF_RESPONSE" | jq .
  exit 1
fi

echo "   ✓ Staff created: $STAFF_ID"

# Invite staff
echo "3. Inviting staff member..."
echo "   (Check backend console for detailed logs)"
INVITE_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/staff/$STAFF_ID/invite" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sendEmail": true, "sendSMS": false}')

echo "   Response:"
echo "$INVITE_RESPONSE" | jq .

# Check if successful
if echo "$INVITE_RESPONSE" | jq -e '.invitationToken' > /dev/null 2>&1; then
  echo "   ✓ SUCCESS!"
else
  echo "   ✗ FAILED"
  exit 1
fi
