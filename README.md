# ⚡ FieldOps — Field Installation Management System

Full-stack MERN application for managing camera, WiFi & generator installations across multiple zones with hierarchical access control, real-time notifications, and progress tracking.

---

## 🏗 Architecture

```
Company (1)
  └─ SuperAdmin (N)        ← company creates N superadmins
       └─ Locations (N)    ← anyone can add, auto-assigned to superadmin
       └─ Camera Ops (N)   ← company creates, assigns to a superadmin
       └─ WiFi Ops (N)     ← company creates, assigns to a superadmin
       └─ Generator Ops(N) ← company creates, assigns to a superadmin
```

---

## 👥 Role Breakdown

| Role      | Can Do |
|-----------|--------|
| **Company**   | Create superadmins + operators; assign operators to superadmins; review/verify/reject all updates; see everything |
| **SuperAdmin** | View-only: locations under them, updates, progress — cannot edit |
| **Camera**    | Add locations (auto-assigned to their superadmin); submit/resubmit camera updates |
| **WiFi**      | Add locations; submit/resubmit wifi updates |
| **Generator** | Add locations; submit/resubmit generator updates |

---

## 🔄 Update Workflow

```
Operator submits update
       ↓
Company notified → Reviews
       ↓
  Verify ✓              Reject ✗ (reason required)
     ↓                        ↓
SuperAdmin notified     Operator notified with reason
                               ↓
                        Operator fixes & resubmits
                               ↓
                        Company notified → Reviews again
                               ↓ (loop until verified)
```

---

## 🚀 Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Cloudinary account (free tier works)

### 1. Install
```bash
cd fieldops
npm run install:all
```

### 2. Backend env
```bash
cd backend
cp .env.example .env
# Edit .env:
#   PORT=
#   MONGO_URI=
#   JWT_SECRET=
#   JWT_EXPIRE=
#   CLOUDINARY_CLOUD_NAME=
#   CLOUDINARY_API_KEY=
#   CLOUDINARY_API_SECRET=
#   CLIENT_URL=http://localhost:5173
#   NODE_ENV=development
#   WHATSAPP_TOKEN=
#   WHATSAPP_PHONE_ID=
#   WHATSAPP_API_VERSION=
#   PUBLIC_BASE_URL=http://localhost:5000
```

### 3. Seed database
```bash
npm run seed
```

### 4. Run dev servers
```bash
# Terminal 1
npm run dev:backend    # → http://localhost:5000

# Terminal 2
npm run dev:frontend   # → http://localhost:5173
```

---

## 🔑 Default Login Credentials

| Role       | Email                       | Password    |
|------------|-----------------------------|-------------|
| Company    | company@fieldops.com        | Company@123 |
| SuperAdmin | sa.north@fieldops.com       | Admin@123   |
| SuperAdmin | sa.south@fieldops.com       | Admin@123   |
| Camera     | camera@fieldops.com         | Camera@123  |
| WiFi       | wifi@fieldops.com           | Wifi@123    |
| Generator  | generator@fieldops.com      | Gen@123     |

> ⚠️ Change all passwords before going to production!

---

## 📁 Project Structure

```
fieldops/
├── backend/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   └── cloudinary.js      # Cloudinary + multer
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js      # Company creates users
│   │   ├── locationController.js  # Hierarchy-aware locations
│   │   ├── updateController.js    # Submit/review/resubmit
│   │   └── notificationController.js
│   ├── middleware/
│   │   ├── auth.js            # JWT + role guard
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js            # roles: company/superadmin/camera/wifi/generator
│   │   ├── Location.js        # belongs to superadmin
│   │   ├── Update.js          # camera/wifi/generator installation record
│   │   └── Notification.js
│   ├── routes/
│   ├── utils/
│   │   ├── notifications.js   # emit helpers
│   │   └── seed.js
│   └── server.js
│
└── frontend/src/
    ├── contexts/
    │   ├── AuthContext.jsx
    │   └── SocketContext.jsx  # real-time notifications
    ├── pages/
    │   ├── LoginPage.jsx
    │   ├── Dashboard.jsx
    │   ├── LocationsPage.jsx
    │   ├── LocationDetailPage.jsx
    │   ├── SubmitUpdatePage.jsx   # submit + resubmit
    │   ├── UpdatesPage.jsx
    │   ├── ReviewsPage.jsx        # company verify/reject
    │   ├── UsersPage.jsx          # company create users
    │   ├── NotificationsPage.jsx
    │   ├── TimelinePage.jsx
    │   └── ProgressPage.jsx
    └── components/common/
        └── Layout.jsx
```

---

## 🔌 Key API Routes

| Method | Route | Access |
|--------|-------|--------|
| POST | /api/auth/login | Public |
| GET  | /api/users/superadmins | Company |
| POST | /api/users | Company |
| GET  | /api/locations | All |
| POST | /api/locations | All operators |
| GET  | /api/locations/stats | All |
| POST | /api/updates | Camera/WiFi/Generator |
| PUT  | /api/updates/:id/review | Company |
| PUT  | /api/updates/:id/resubmit | Camera/WiFi/Generator |
| GET  | /api/notifications | All |

---

## 🛡 Security
- JWT auth with 7-day expiry
- Role-based route guards (frontend + backend)
- bcrypt password hashing (12 rounds)
- Operators scoped to their superadmin's locations
- Submission limit enforced (verified ≥ planned → blocked)
- CORS restricted to frontend origin
- File size limit 10MB per photo
