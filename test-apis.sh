#!/bin/bash
# End-to-end test for Fuel on Go API

echo "🚀 Testing Fuel on Go Backend APIs"
echo "=================================="
echo ""

# Test Health Check
echo "1️⃣ Testing Health Check..."
curl -s http://localhost:5000/health | jq . 2>/dev/null || echo "FAILED"
echo ""

# Test Get Pumps
echo "2️⃣ Testing Get Pumps..."
PUMPS=$(curl -s http://localhost:5000/api/pumps)
echo "$PUMPS" | jq '.data | length' 2>/dev/null && echo "✅ Pumps loaded" || echo "❌ FAILED"
echo ""

# Test Get Slots
echo "3️⃣ Testing Get Slots for Pump 1..."
SLOTS=$(curl -s http://localhost:5000/api/slots/1)
echo "$SLOTS" | jq '.data | length' 2>/dev/null && echo "✅ Slots loaded" || echo "❌ FAILED"
echo ""

# Test Admin Login
echo "4️⃣ Testing Admin Login..."
LOGIN=$(curl -s -X POST http://localhost:5000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
echo "$LOGIN" | jq '.token' 2>/dev/null && echo "✅ Admin login successful" || echo "❌ FAILED"
echo ""

# Test Booking
echo "5️⃣ Testing Create Booking..."
BOOKING=$(curl -s -X POST http://localhost:5000/api/book \
  -H "Content-Type: application/json" \
  -d '{"pumpId":"1","slotTime":"10:00-10:30"}')
echo "$BOOKING" | jq '.booking.tokenNumber' 2>/dev/null && echo "✅ Booking created" || echo "❌ FAILED"
echo ""

echo "✅ All tests completed!"
