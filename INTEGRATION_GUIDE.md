# Fuel on Go - Complete Integration Guide

## ✅ PROJECT STATUS: FULLY WORKING END-TO-END

All components are connected and functioning correctly. The application is ready for local testing and development.

---

## System Architecture

```
┌─────────────────────────────────────┐
│     Next.js Frontend (Port 3000)    │
│     - Pump listing page             │
│     - Booking flow                  │
│     - Admin login                   │
└──────────────┬──────────────────────┘
               │ HTTP Requests
               ↓ (port 5000)
┌─────────────────────────────────────┐
│   Express Backend (Port 5000)       │
│   - CORS enabled                    │
│   - Mock data (no database)         │
│   - 4 APIs for full functionality   │
└─────────────────────────────────────┘
```

---

## Running the Application

### Step 1: Start Backend Server

**Terminal 1:**
```bash
cd c:\Users\prashant\Fuel_on_go\backend
node src/index.js
```

**Expected output:**
```
[dotenv@17.3.1] injecting env (5) from .env -- tip: ...
[Server] Running on http://localhost:5000
```

### Step 2: Start Frontend Server

**Terminal 2:**
```bash
cd c:\Users\prashant\Fuel_on_go\frontend
npm run dev
```

**Expected output:**
```
▲ Next.js 16.2.1 (webpack)
- Local:         http://localhost:3000
- Network:       http://192.168.56.1:3000
✓ Ready in XXXms
```

### Step 3: Access the Application

Open your browser and navigate to:
- **Home Page**: http://localhost:3000
- **Admin Login**: http://localhost:3000/admin/login
- **Booking (Demo)**: http://localhost:3000/pump/demo

---

## Complete API Reference

### 1. Health Check
```
GET /health
Response: { success: true, status: "ok", serverTime: "..." }
```

### 2. Get All Pumps
```
GET /api/pumps
Response: {
  success: true,
  data: [
    {
      id: "1",
      name: "Kolhapur CNG Pump",
      location: "Kolhapur",
      availability: "HIGH",
      queue: 3,
      distance: "1.2 km"
    },
    // ... 3 more pumps
  ]
}
```

### 3. Get Slots for a Pump
```
GET /api/slots/:pumpId
Example: /api/slots/1

Response: {
  success: true,
  data: [
    { time: "10:00-10:30", capacity: 5, booked: 2 },
    { time: "10:30-11:00", capacity: 5, booked: 4 },
    { time: "11:00-11:30", capacity: 5, booked: 5 },
    { time: "11:30-12:00", capacity: 5, booked: 1 }
  ]
}
```

### 4. Create Booking
```
POST /api/book
Content-Type: application/json

Request Body:
{
  "pumpId": "1",
  "slotTime": "10:00-10:30"
}

Response: {
  success: true,
  message: "Booking created",
  booking: {
    id: "B0001",
    tokenNumber: 1,
    pumpId: "1",
    slotTime: "10:00-10:30",
    createdAt: "2026-04-12T13:02:13.480Z"
  },
  slot: {
    time: "10:00-10:30",
    capacity: 5,
    booked: 3
  }
}
```

### 5. Admin Login
```
POST /api/admin/login
Content-Type: application/json

Request Body:
{
  "username": "admin",
  "password": "admin123"
}

Response: {
  success: true,
  message: "Login successful",
  admin: {
    id: "A1",
    name: "Fuel on Go Admin",
    role: "admin"
  },
  token: "mock-admin-token"
}
```

---

## Mock Data

### Available Pumps
| ID | Name | Location | Availability | Queue | Distance |
|:---|:-----|:---------|:-------------|:------|:---------|
| 1 | Kolhapur CNG Pump | Kolhapur | HIGH | 3 | 1.2 km |
| 2 | Shivaji Nagar CNG | Pune | MEDIUM | 7 | 3.4 km |
| 3 | Kharadi Smart CNG | Pune | LOW | 12 | 5.6 km |
| 4 | Thane FastFill CNG | Thane | HIGH | 2 | 2.1 km |

### Available Time Slots (All Pumps)
- 10:00 - 10:30
- 10:30 - 11:00
- 11:00 - 11:30
- 11:30 - 12:00

**Capacity Range**: 4-6 spots per slot
**Current Booking Levels**: Mixed (from available to full)

---

## Frontend Pages

### 1. Home Page
**Path**: `/`
- Navigation to Admin or Booking
- Lightweight minimal UI

### 2. Admin Login
**Path**: `/admin/login`
- **Default credentials**: admin / admin123
- Stores token in localStorage
- Redirects to admin dashboard on success

### 3. Pump Detail / Booking Page
**Path**: `/pump/[id]`
- Shows pump details
- Lists available slots
- Allows booking
- Displays confirmation with token number

---

## Key Configuration Files

### Backend

**`.env`** (Port Configuration)
```
PORT=5000
```

**`package.json`** (Entry Point)
```json
{
  "scripts": {
    "dev": "node src/index.js",
    "start": "node src/index.js"
  }
}
```

**`src/index.js`** (Mock Data Server)
- Runs on port 5000
- CORS enabled
- No database required
- All data in-memory

### Frontend

**`.env.local`** (API Configuration)
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

**`services/api.js`** (API Client)
- Automatic response parsing
- Error handling
- Timeout management

---

## Testing Checklist

- ✅ Backend starts without errors
- ✅ Backend responds to health check
- ✅ Frontend starts and compiles
- ✅ GET /api/pumps returns pump list
- ✅ GET /api/slots/:id returns slots
- ✅ POST /api/admin/login works with admin/admin123
- ✅ POST /api/book creates booking with token
- ✅ Frontend displays pumps
- ✅ Frontend booking flow shows token
- ✅ Admin login redirects to dashboard
- ✅ No CORS errors
- ✅ No console errors

---

## Troubleshooting

### Backend won't start
- Check PORT=5000 in .env
- Kill existing node processes: `Get-Process node | Stop-Process -Force`
- Ensure no other service on port 5000

### Frontend won't connect to backend
- Verify NEXT_PUBLIC_API_URL in .env.local
- Backend must be running on port 5000
- Check CORS is enabled
- Look for error messages in browser console

### Booking fails
- Ensure pumpId and slotTime are valid
- Check slot hasn't reached capacity
- Backend mock data is in memory (resets on restart)

### Admin login fails
- Credentials must be exactly: admin / admin123
- Frontend must store token in localStorage
- Check browser console for errors

---

## What Was Fixed

1. **Backend Setup**
   - Corrected PORT from 3000 to 5000
   - Updated package.json to use index.js

2. **API Response Format**
   - Wrapped pump responses with `{ success: true, data: [...] }`
   - Wrapped slot responses with `{ success: true, data: [...] }`

3. **Frontend Integration**
   - Updated api.js to extract `data` field from responses
   - Handles different response formats

4. **Error Messages**
   - "Failed to fetch" → "Backend not connected. Please ensure the server is running."
   - "Pump not found" → Resolved by fetching pumps dynamically

---

## Next Steps for Production

To move from development to production:

1. Add real database (MongoDB/PostgreSQL)
2. Replace mock data with migrations
3. Add user authentication (JWT)
4. Add payment integration
5. Deploy backend and frontend separately
6. Setup CI/CD pipeline
7. Add comprehensive error logging
8. Implement rate limiting
9. Add input validation
10. Setup monitoring and alerts

---

## Support

For issues or questions, check:
1. Backend console for errors: Terminal 1
2. Frontend console (F12 in browser)
3. Network tab in DevTools
4. This documentation

All systems are operational and ready for development! 🚀
