# Roadside Rescue - Backend API

## Contributors
 Gitau William
 ---

## Emergency Roadside Assistance Platform

Roadside Rescue is a comprehensive backend API for connecting stranded drivers with verified garages and tow truck services. The platform enables real-time job matching, location tracking, and seamless communication between clients and service providers.

---

## Problem Statement

Drivers stranded on the road due to mechanical breakdowns face:
- Hours of waiting without assistance
- Difficulty finding reliable, verified garages
- No real-time tracking of rescue vehicles
- Lack of transparency in pricing
- No way to rate service quality

---

## Solution Overview

Roadside Rescue provides a two-sided marketplace platform:

| Feature | Description |
|---------|-------------|
| **Real-time Matching** | Nearby garages receive job alerts instantly |
| **Live Tracking** | Clients can track garage location in real-time |
| **Two-Factor Auth** | Email/phone login with JWT authentication |
| **Role-based Access** | Separate interfaces for clients, garages, and admins |
| **Reviews & Ratings** | Clients can rate service quality |
| **Google Login** | OAuth authentication via Firebase |

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **Express.js** | Web framework |
| **MongoDB** | Database |
| **Mongoose** | ODM |
| **Socket.io** | Real-time communication |
| **JWT** | Authentication |
| **bcryptjs** | Password hashing |
| **Firebase Admin** | Google OAuth verification |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login with email/phone |
| POST | `/api/v1/auth/google` | Google OAuth login |
| GET | `/api/v1/auth/me` | Get current user |

### Client Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/client/garages/nearby` | Find nearby garages |
| POST | `/api/v1/client/jobs` | Create rescue request |
| GET | `/api/v1/client/jobs` | Get job history |
| POST | `/api/v1/client/jobs/:id/review` | Submit review |

### Garage Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/v1/garage/online-status` | Toggle online/offline |
| GET | `/api/v1/garage/jobs/available` | View available jobs |
| PATCH | `/api/v1/garage/jobs/:id/status` | Update job status |
| PUT | `/api/v1/garage/services` | Manage services |

### Admin Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/stats` | Platform statistics |
| GET | `/api/v1/admin/users` | Manage users |
| PATCH | `/api/v1/admin/garages/:id/verify` | Verify garages |
| DELETE | `/api/v1/admin/jobs/:id` | Delete inappropriate content |

---

## Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/gitauwilly1/roadside-rescue-backend.git
    cd roadside-rescue-backend

2. **Install Dependencies**
   ```bash
   npm install

3. **Run for Development**
   ```bash
   npm run dev

4. **Run for Production**
   ```bash
   npm start


## Known Bugs
There are no known bugs 

---

## License
* **License:** MIT License.

---

## Support and Information
**Email:** gitauwilly254@gmail.com  