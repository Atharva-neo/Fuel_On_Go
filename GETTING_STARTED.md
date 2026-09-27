# 🚀 Getting Started with Fuel on Go

## Prerequisites

Before starting, ensure you have:
- **Node.js 18+** ([Download](https://nodejs.org))
- **MongoDB** (Local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- **Git** ([Download](https://git-scm.com))

## Project Structure

```
Fuel_on_go/
├── backend/          # Node.js + Express server
│   ├── src/
│   │   ├── models/   # Mongoose schemas
│   │   ├── routes/   # API endpoints
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── socket/   # Socket.io handlers
│   ├── seed.js       # Database seeder
│   ├── package.json
│   └── .env
└── frontend/         # Next.js 16 App Router
    ├── app/          # Page components
    ├── components/   # Reusable components
    ├── lib/          # API client, socket client
    ├── package.json
    └── .env.local
```

## Quick Start (Local Development)

### Step 1: Clone the Repository

```bash
cd Fuel_on_go
```

### Step 2: Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Create .env file (already created, but verify)
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/cng_smart_slot
# JWT_SECRET=dev_secret_key_change_in_production_12345
# FRONTEND_URL=http://localhost:3000

# Start MongoDB (if local)
# Windows: Open Command Prompt in MongoDB folder and run: mongod
# Mac/Linux: mongod

# Seed database with demo data
npm run seed

# Start backend server
npm run dev
```

Backend runs at **http://localhost:5000**

Verify health: `curl http://localhost:5000/health`

### Step 3: Setup Frontend

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Verify .env.local exists:
# NEXT_PUBLIC_API_URL=http://localhost:5000/api
# NEXT_PUBLIC_SOCKET_URL=http://localhost:5000

# Start development server
npm run dev
```

Frontend runs at **http://localhost:3000**

### Step 4: Access the Application

1. **User App**: http://localhost:3000
   - View nearby CNG pumps
   - Book slots
   - See booking tickets with QR codes

2. **Admin Dashboard**: http://localhost:3000/admin
   - Login with any phone/password from seed data:
     - Phone: `9876543210` → IndianOil CNG - Banjara Hills
     - Phone: `9876543211` → HP CNG Station - Jubilee Hills
     - Phone: `9876543212` → HPCL CNG Pump - Madhapur
     - Phone: `9876543213` → Bharat CNG - Gachibowli
     - Phone: `9876543214` → CNG Fast Fill - Kukatpally
   - Password: `admin123`
   - Manage CNG level and view bookings

---

## Admin Credentials

| Pump | Phone | Password |
|---|---|---|
| IndianOil CNG — Banjara Hills | 9876543210 | admin123 |
| HP CNG Station — Jubilee Hills | 9876543211 | admin123 |
| HPCL CNG Pump — Madhapur | 9876543212 | admin123 |
| Bharat CNG — Gachibowli | 9876543213 | admin123 |
| CNG Fast Fill — Kukatpally | 9876543214 | admin123 |

---

## Features

### User Features
✅ **Map View** - Dark-themed, interactive map with color-coded pump markers  
✅ **Live Status** - Green/Yellow/Red CNG level indicators  
✅ **Slot Booking** - 30-minute slots, max 5 vehicles per slot  
✅ **QR Code Tickets** - Unique token + QR code per booking  
✅ **Real-time Updates** - Socket.io pushupdates across all tabs  
✅ **Countdown Timer** - Live countdown to slot start  
✅ **Mobile-First UI** - Uber-style bottom sheet interface  

### Admin Features
✅ **Dashboard** - Overview of bookings and slot availability  
✅ **CNG Level Management** - Update live CNG levels  
✅ **Booking Overview** - View recent and confirmed bookings  
✅ **Real-time Sync** - All devices sync instantly  

---

## Environment Configuration

### Backend (.env)

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/cng_smart_slot

# Security
JWT_SECRET=your_secret_key_here

# CORS
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

## Common Issues & Troubleshooting

### ❌ "Cannot connect to MongoDB"
**Solution:**
```bash
# Make sure MongoDB is running
# Windows:
mongod

# Mac:
brew services start mongodb-community

# Linux:
sudo systemctl start mongod

# Or use MongoDB Atlas connection string in .env
```

### ❌ "Port 5000 already in use"
**Solution:**
```bash
# Kill process using port 5000
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:5000 | xargs kill -9
```

### ❌ "CORS errors in browser console"
**Solution:**
- Ensure `FRONTEND_URL` in backend `.env` matches your frontend URL
- Frontend should be at `http://localhost:3000` for local development
- Backend should be at `http://localhost:5000`

### ❌ "Socket.io connection issues"
**Solution:**
- Verify backend is running: `curl http://localhost:5000/health`
- Check that `NEXT_PUBLIC_SOCKET_URL` in frontend `.env.local` is correct
- Clear browser cache and hard refresh (Ctrl+Shift+R)

### ❌ "Bookings not working"
**Solution:**
- Ensure seeds are created: `npm run seed` in backend
- Check MongoDB connection is active
- Verify current time is within slot times
- Check browser console for errors

---

## Build for Production

### Backend

```bash
cd backend

# Install dependencies
npm install

# Set production environment variables in .env
NODE_ENV=production
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/cng_smart_slot
JWT_SECRET=<strong_random_key>
FRONTEND_URL=https://yourdomain.com

# Start server
npm start
```

### Frontend

```bash
cd frontend

# Set production environment variables in .env.production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com

# Build
npm run build

# Start
npm start
```

---

## Deployment

### Backend (Render)

1. Push code to GitHub
2. Connect GitHub repo on Render
3. Set environment variables (PORT, MONGODB_URI, JWT_SECRET, FRONTEND_URL)
4. Deploy

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL)
4. Deploy automatically

### Database (MongoDB Atlas)

1. Create cluster on mongodb.com/cloud/atlas
2. Add IP whitelist
3. Create database user
4. Copy connection string
5. Add to backend `.env` as MONGODB_URI

---

## API Endpoints

### Public

- `GET /api/pumps` - List all pumps
- `GET /api/pumps/:id` - Pump details
- `GET /api/pumps/:id/slots` - Available slots for pump
- `POST /api/bookings` - Create booking
- `GET /api/bookings/:id` - Booking details
- `DELETE /api/bookings/:id` - Cancel booking
- `PUT /api/bookings/:id/checkin` - Check-in to booking

### Admin (Requires JWT Token)

- `POST /api/admin/login` - Admin login
- `GET /api/admin/dashboard` - Admin dashboard
- `PUT /api/admin/pumps/:id` - Update pump
- `GET /api/admin/bookings` - Get bookings

---

## Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React 19
- TypeScript
- Tailwind CSS + custom dark theme
- Leaflet Maps
- Socket.io Client
- Framer Motion (animations)

**Backend:**
- Node.js
- Express.js
- MongoDB + Mongoose
- Socket.io
- JWT Authentication
- Zod validation

**DevTools:**
- ESLint
- TypeScript
- Nodemon

---

## Commands Reference

### Backend

```bash
npm run dev          # Start development server
npm start            # Start production server
npm run seed         # Seed database
npm run dev:watch   # Start with auto-reload
```

### Frontend

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
```

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for errors
3. Check backend logs in terminal
4. Ensure all environment variables are set correctly
5. Verify MongoDB is running and accessible

---

## License

ISC
