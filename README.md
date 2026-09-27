# ⚡ CNG Smart Slot System — Fuel on Go

> **Uber for CNG.** Book your pump slot instantly. No queues, no waiting.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://www.mongodb.com/cloud/atlas)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-orange?logo=socket.io)](https://socket.io)

---

## 🎯 Project Overview

Fuel on Go is a real-time CNG slot booking system that eliminates queues at CNG pumps. Users can:
- 🗺️ Find nearby CNG pumps on an interactive map
- ⏱️ Book 30-minute slots in advance
- 🎫 Get instant QR code tickets
- 📱 Track live countdown timers
- ✨ Enjoy real-time updates across devices

Pump operators can:
- 📊 View booking dashboard
- 🔴 Manage live CNG levels
- 📈 Track occupancy and revenue
- ⚡ Update station status instantly

---

## 🚀 Quick Start

### 1️⃣ Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Git

### 2️⃣ Clone & Setup

```bash
# Clone repository
cd Fuel_on_go

# Backend setup
cd backend
npm install
npm run seed        # Seed demo data
npm run dev        # Start server

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

**Access:**
- User app: http://localhost:3000
- Admin: http://localhost:3000/admin
- Backend: http://localhost:5000

### 3️⃣ Admin Login

Use any of these credentials (after running seed):

| Pump | Phone | Password |
|---|---|---|
| IndianOil CNG — Banjara Hills | 9876543210 | admin123 |
| HP CNG Station — Jubilee Hills | 9876543211 | admin123 |
| HPCL CNG Pump — Madhapur | 9876543212 | admin123 |
| Bharat CNG — Gachibowli | 9876543213 | admin123 |
| CNG Fast Fill — Kukatpally | 9876543214 | admin123 |

👉 **[Full setup guide →](./GETTING_STARTED.md)**

---

## ✨ Features

| Feature | Description | Status |
|---|---|---|
| 🗺️ **Map-first UI** | Full-screen dark map with color-coded pump markers | ✅ |
| ⏱️ **Smart Slots** | Generate 30-min slots, 5-vehicle capacity automatically | ✅ |
| 🟢🟡🔴 **Live Status** | Real-time CNG level indicators (Green/Yellow/Red) | ✅ |
| 🎫 **QR Tickets** | Unique token + QR code generated per booking | ✅ |
| ⏳ **Countdown** | Live countdown timer to slot start time | ✅ |
| 🔌 **Real-time Sync** | Socket.io updates across all client tabs instantly | ✅ |
| 👤 **Admin Panel** | Dashboard for pump operators to manage operations | ✅ |
| 📱 **Mobile-first** | Responsive design with Uber-style bottom sheet | ✅ |
| 🔒 **Error Handling** | Comprehensive error boundaries and validation | ✅ |
| 🌐 **Offline Support** | Offline indicator and graceful degradation | ✅ |
| 🎨 **Dark Theme** | Modern dark UI with smooth animations | ✅ |
| ⚡ **Performance** | Optimized for speed and real-time updates | ✅ |

---

## 🧱 Tech Stack

### Frontend
```
Next.js 14 (App Router)
├── React 19
├── TypeScript
├── Tailwind CSS (dark theme)
├── Leaflet Maps
├── Socket.io Client
├── Framer Motion (animations)
└── Date-fns (date utilities)
```

### Backend
```
Node.js + Express.js
├── MongoDB + Mongoose
├── Socket.io (real-time)
├── JWT Authentication
├── Zod Validation
├── UUID (unique IDs)
└── QR Code Generation
```

### Infrastructure
```
Frontend: Vercel
Backend: Render
Database: MongoDB Atlas
```

---

## 📁 Project Structure

```
Fuel_on_go/
├── 📄 README.md                    # Project overview
├── 📄 GETTING_STARTED.md           # Setup & development guide
├── 📄 DEPLOYMENT.md                # Production deployment guide
│
├── backend/
│   ├── src/
│   │   ├── models/                 # Pump, Booking, Slot, User schemas
│   │   ├── routes/                 # API endpoints (pumps, bookings, admin)
│   │   ├── controllers/            # Business logic
│   │   ├── services/               # Booking, pump, slot services
│   │   ├── middleware/             # Auth, validation, error handling
│   │   ├── validators/             # Zod schemas
│   │   ├── utils/                  # JWT, QR, slotGenerator
│   │   └── socket/                 # Socket.io event handlers
│   ├── seed.js                     # Database seeder
│   ├── package.json
│   ├── .env                        # Local development config
│   └── .env.example                # Config template
│
└── frontend/
    ├── app/
    │   ├── page.tsx                # Home (map + booking)
    │   ├── layout.tsx              # Root layout
    │   ├── pump/[id]/              # Pump details + slot selector
    │   ├── booking/[id]/           # Booking confirmation + QR
    │   ├── admin/                  # Admin dashboard
    │   └── globals.css             # Global styles
    ├── components/
    │   ├── MapView.tsx             # Leaflet map
    │   ├── PumpBottomSheet.tsx     # Animated bottom sheet
    │   ├── ErrorBoundary.tsx       # Error handling
    │   ├── LoadingStates.tsx       # Loading components
    │   └── OfflineIndicator.tsx    # Offline status
    ├── lib/
    │   ├── api.ts                  # Typed API client
    │   └── socket.ts               # Socket.io singleton
    ├── package.json
    ├── .env.local                  # Local development config
    └── .env.example                # Config template
```

---

## 🔌 API Endpoints

### Public Routes

```
GET    /api/pumps                   # List all CNG pumps
GET    /api/pumps/:id              # Get pump details
GET    /api/pumps/:id/slots        # Get available slots
POST   /api/bookings               # Create booking
GET    /api/bookings/:id           # Get booking details
DELETE /api/bookings/:id           # Cancel booking
PUT    /api/bookings/:id/checkin   # Check-in to booking
```

### Admin Routes (JWT Required)

```
POST   /api/admin/login             # Admin authentication
GET    /api/admin/dashboard         # Dashboard overview
PUT    /api/admin/pumps/:id        # Update pump (CNG level, etc)
GET    /api/admin/bookings         # Get filtered bookings
```

---

## 🔒 Security Features

- **JWT Authentication** - Secure admin-only endpoints
- **Input Validation** - Zod schema validation
- **Error Handling** - Comprehensive error boundaries
- **SQL Injection Protection** - Mongoose parameterized queries
- **CORS** - Strict origin validation
- **Rate Limiting** - Per-minute request limits
- **Password Hashing** - bcryptjs for admin passwords
- **Data Normalization** - Sanitize all user inputs

---

## 📊 Database Schema

### Pump
```javascript
{
  _id: ObjectId,
  name: String,
  address: String,
  location: { lat: Number, lng: Number },
  cngLevel: Number (0-100),
  isActive: Boolean,
  operatorName: String,
  phone: String,
  operatingHours: { open: "HH:MM", close: "HH:MM" },
  slotDuration: Number (minutes),
  slotCapacity: Number (vehicles),
  createdAt: Date,
  updatedAt: Date
}
```

### Slot
```javascript
{
  _id: ObjectId,
  pumpId: ObjectId (ref: Pump),
  startTime: Date,
  endTime: Date,
  capacity: Number,
  booked: Number,
  available: Number (virtual),
  status: "open" | "filling" | "full",
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Booking
```javascript
{
  _id: ObjectId,
  slotId: ObjectId (ref: Slot),
  pumpId: ObjectId (ref: Pump),
  userName: String,
  phone: String,
  vehicleNumber: String,
  vehicleType: "Car" | "Auto" | "Bus" | "Other",
  tokenNumber: Number,
  token: String,
  status: "confirmed" | "checked_in" | "completed" | "cancelled" | "expired",
  qrCode: String (base64),
  checkedInAt: Date,
  cancelledAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🚀 Deployment

### One-Click Deploy Options

- **Frontend**: Deploy to [Vercel](https://vercel.com) (Free tier available)
- **Backend**: Deploy to [Render](https://render.com) (Free tier available)
- **Database**: Use [MongoDB Atlas](https://mongodb.com/cloud/atlas) (Free M0 cluster)

👉 **[Complete deployment guide →](./DEPLOYMENT.md)**

---

## 🛠️ Development Commands

### Backend

```bash
npm run dev          # Start dev server with auto-reload
npm start            # Start production server
npm run seed         # Seed database with demo data
npm run dev:watch   # Watch mode with nodemon
```

### Frontend

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
```

---

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Local: Make sure mongod is running
mongod

# Atlas: Verify connection string in .env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
```

### CORS Errors
```bash
# Ensure FRONTEND_URL in backend .env matches frontend domain
FRONTEND_URL=http://localhost:3000
```

### Socket.io Connection Issues
```bash
# Clear browser cache and hard refresh
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Verify socket URL in frontend .env.local
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

👉 **[Full troubleshooting guide →](./GETTING_STARTED.md#common-issues--troubleshooting)**

---

## 📈 Performance

- **Frontend**: Pre-rendered pages, code splitting, image optimization
- **Backend**: Connection pooling, indexed queries, caching
- **Real-time**: Socket.io with auto-reconnection and fallback
- **Database**: Optimized schema with proper indexing

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📝 License

ISC

---

## 🎓 Learning Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Express.js Guide](https://expressjs.com)
- [MongoDB Documentation](https://docs.mongodb.com)
- [Socket.io Tutorial](https://socket.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

---

## 🙋 Support

- **Documentation**: Check [GETTING_STARTED.md](./GETTING_STARTED.md)
- **Deployment**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Issues**: Open a GitHub issue with details

---

## 🔗 Links

- **Live Demo**: Coming soon 🚀
- **Documentation**: [GETTING_STARTED.md](./GETTING_STARTED.md)
- **Deploy**: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

**Built with ❤️ for a smoother CNG experience**
