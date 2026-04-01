import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import connectDB from './config/database.js';
import authRoutes from './api/v1/routes/auth.js';
import garageRoutes from './api/v1/routes/garage.js';
import clientRoutes from './api/v1/routes/client.js';
import adminRoutes from './api/v1/routes/admin.js';
import Job from './models/Job.js';
import Garage from './models/Garage.js';

dotenv.config();

console.log(' Starting server...');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('PORT:', process.env.PORT || 5000);

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

console.log(' Environment variables validated');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  }
});

// Store connected garages with their locations
const connectedGarages = new Map();

// Helper function to get geohash (simplified - grid based)
const getGeohash = (lat, lng, precision = 3) => {
  const latStep = 0.1;
  const lngStep = 0.1;
  const latHash = Math.floor(lat / latStep);
  const lngHash = Math.floor(lng / lngStep);
  return `${latHash},${lngHash}`;
};

// Helper to calculate distance between two points
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10;
};

// Helper to find nearby garages
const findNearbyGarages = async (clientLat, clientLng, radius = 15) => {
  const radiusInMeters = radius * 1000;
  
  const garages = await Garage.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [clientLng, clientLat] },
        $maxDistance: radiusInMeters
      }
    },
    isVerified: true,
    isOnline: true,
    subscriptionActive: true
  }).select('_id userId businessName location');
  
  return garages;
};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  let userId = null;
  try {
    if (socket.handshake.auth?.token) {
      const decoded = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
      userId = decoded.userId;
    }
  } catch (err) {
    console.log('Invalid token for socket connection');
  }

  // Garage joins with location
  socket.on('garage_online', async ({ garageId, location }) => {
    if (!garageId || !location) return;
    
    const geohash = getGeohash(location.latitude, location.longitude);
    socket.join(`garage:${geohash}`);
    connectedGarages.set(socket.id, {
      garageId,
      location,
      geohash,
      userId
    });
    console.log(`Garage ${garageId} online at geohash ${geohash}`);
  });

  // Garage location update
  socket.on('garage_location_update', ({ garageId, location }) => {
    if (!garageId || !location) return;
    
    const oldData = connectedGarages.get(socket.id);
    const newGeohash = getGeohash(location.latitude, location.longitude);
    
    if (oldData && oldData.geohash !== newGeohash) {
      socket.leave(`garage:${oldData.geohash}`);
      socket.join(`garage:${newGeohash}`);
    }
    
    connectedGarages.set(socket.id, {
      garageId,
      location,
      geohash: newGeohash,
      userId
    });
  });

  // Garage goes offline
  socket.on('garage_offline', () => {
    const garageData = connectedGarages.get(socket.id);
    if (garageData) {
      socket.leave(`garage:${garageData.geohash}`);
      connectedGarages.delete(socket.id);
      console.log(`Garage ${garageData.garageId} offline`);
    }
  });

  // New job created - broadcast to nearby garages
  socket.on('new_job', async (jobData) => {
    console.log('New job received:', jobData._id);
    
    const job = await Job.findById(jobData._id);
    if (!job) {
      console.log('Job not found in database');
      return;
    }
    
    const clientLat = job.clientLocation.coordinates[1];
    const clientLng = job.clientLocation.coordinates[0];
    
    const nearbyGarages = await findNearbyGarages(clientLat, clientLng, 15);
    
    console.log(`Found ${nearbyGarages.length} nearby garages for job ${job._id}`);
    
    for (const garage of nearbyGarages) {
      let targetSocketId = null;
      for (const [socketId, data] of connectedGarages) {
        if (data.garageId === garage._id.toString()) {
          targetSocketId = socketId;
          break;
        }
      }
      
      if (targetSocketId) {
        const distance = calculateDistance(
          clientLat, clientLng,
          garage.location.coordinates[1], garage.location.coordinates[0]
        );
        
        io.to(targetSocketId).emit('new_job_alert', {
          ...job.toObject(),
          distance
        });
        console.log(`Job alert sent to garage ${garage.businessName} (${distance}km away)`);
      }
    }
  });

  // Job accepted - notify all other garages
  socket.on('job_accepted', ({ jobId, garageId, garageName }) => {
    console.log(`Job ${jobId} accepted by garage ${garageName}`);
    socket.broadcast.emit('job_taken', { jobId, garageId });
  });

  // Job status update
  socket.on('job_status_update', ({ jobId, status, garageId }) => {
    console.log(`Job ${jobId} status: ${status}`);
    io.emit('job_status_update', { _id: jobId, status });
  });

  // Garage location sharing for client tracking
  socket.on('garage_location_share', ({ jobId, location }) => {
    io.to(`job:${jobId}`).emit('garage_location_update', { jobId, location });
  });

  // Client joins job room
  socket.on('join_job_room', (jobId) => {
    socket.join(`job:${jobId}`);
    console.log(`Client joined room for job ${jobId}`);
  });

  // Garage status change
  socket.on('garage_status_change', ({ garageId, isOnline }) => {
    console.log(`Garage ${garageId} status: ${isOnline ? 'online' : 'offline'}`);
    if (!isOnline) {
      for (const [socketId, data] of connectedGarages) {
        if (data.garageId === garageId) {
          const geoData = connectedGarages.get(socketId);
          if (geoData) {
            io.to(socketId).leave(`garage:${geoData.geohash}`);
          }
          connectedGarages.delete(socketId);
          break;
        }
      }
    }
  });

  socket.on('disconnect', () => {
    const garageData = connectedGarages.get(socket.id);
    if (garageData) {
      console.log(`Garage ${garageData.garageId} disconnected`);
      connectedGarages.delete(socket.id);
    } else {
      console.log('Client disconnected:', socket.id);
    }
  });
});


app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('io', io);


app.get('/', (req, res) => {
  res.json({
    name: 'Roadside Rescue API',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      client: '/api/v1/client',
      garage: '/api/v1/garage',
      admin: '/api/v1/admin'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/garage', garageRoutes);
app.use('/api/v1/client', clientRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});


const startServer = async () => {
  try {
    await connectDB();
    console.log(' MongoDB connected successfully');
    
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(` Server running on port ${PORT}`);
      console.log(` Socket.io ready for real-time connections`);
      console.log(` Health check: http://localhost:${PORT}/health`);
      console.log(` API base: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});