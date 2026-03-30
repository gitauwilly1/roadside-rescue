import express from 'express';
import { authMiddleware, clientOnly } from '../../../middleware/auth.js';
import Garage from '../../../models/Garage.js';
import Job from '../../../models/Job.js';
import Review from '../../../models/Review.js';
import Vehicle from '../../../models/Vehicle.js';
import SavedLocation from '../../../models/SavedLocation.js';
import FavoriteGarage from '../../../models/FavoriteGarage.js';
import NotificationPreference from '../../../models/NotificationPreference.js';

const router = express.Router();

// Apply auth and client-only middleware to all routes
router.use(authMiddleware);
router.use(clientOnly());


// @route   GET /api/v1/client/profile
// @desc    Get client profile
// @access  Private (Client only)
router.get('/profile', async (req, res) => {
  try {
    const client = req.user;
    
    res.json({
      success: true,
      profile: {
        id: client._id,
        fullName: client.fullName,
        phone: client.phone,
        email: client.email,
        isActive: client.isActive,
        createdAt: client.createdAt
      }
    });
  } catch (error) {
    console.error('Get client profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/v1/client/profile
// @desc    Update client profile
// @access  Private (Client only)
router.put('/profile', async (req, res) => {
  try {
    const { fullName, phone, email } = req.body;
    
    const client = req.user;
    
    if (fullName) client.fullName = fullName;
    if (phone) {
      const existingUser = await User.findOne({ phone, _id: { $ne: client._id } });
      if (existingUser) {
        return res.status(400).json({ error: 'Phone number already in use' });
      }
      client.phone = phone;
    }
    if (email) {
      const existingUser = await User.findOne({ email: email.toLowerCase(), _id: { $ne: client._id } });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      client.email = email.toLowerCase();
    }
    
    await client.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: client._id,
        fullName: client.fullName,
        phone: client.phone,
        email: client.email
      }
    });
  } catch (error) {
    console.error('Update client profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== VEHICLE MANAGEMENT ====================

// @route   GET /api/v1/client/vehicles
// @desc    Get all client vehicles
// @access  Private (Client only)
router.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ clientId: req.user._id, isActive: true })
      .sort({ isDefault: -1, createdAt: -1 });
    
    res.json({
      success: true,
      vehicles
    });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/v1/client/vehicles
// @desc    Add a new vehicle
// @access  Private (Client only)
router.post('/vehicles', async (req, res) => {
  try {
    const { licensePlate, make, model, year, color, isDefault } = req.body;
    
    if (!licensePlate || !make || !model) {
      return res.status(400).json({ error: 'License plate, make, and model are required' });
    }
    
    const existingVehicle = await Vehicle.findOne({ 
      clientId: req.user._id, 
      licensePlate: licensePlate.toUpperCase() 
    });
    
    if (existingVehicle) {
      return res.status(400).json({ error: 'Vehicle with this license plate already exists' });
    }
    
    const vehicle = await Vehicle.create({
      clientId: req.user._id,
      licensePlate: licensePlate.toUpperCase(),
      make,
      model,
      year,
      color,
      isDefault: isDefault || false
    });
    
    res.status(201).json({
      success: true,
      message: 'Vehicle added successfully',
      vehicle
    });
  } catch (error) {
    console.error('Add vehicle error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/v1/client/vehicles/:vehicleId
// @desc    Update a vehicle
// @access  Private (Client only)
router.put('/vehicles/:vehicleId', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { licensePlate, make, model, year, color, isDefault, isActive } = req.body;
    
    const vehicle = await Vehicle.findOne({ _id: vehicleId, clientId: req.user._id });
    
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    if (licensePlate) vehicle.licensePlate = licensePlate.toUpperCase();
    if (make) vehicle.make = make;
    if (model) vehicle.model = model;
    if (year) vehicle.year = year;
    if (color) vehicle.color = color;
    if (isDefault !== undefined) vehicle.isDefault = isDefault;
    if (isActive !== undefined) vehicle.isActive = isActive;
    
    await vehicle.save();
    
    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      vehicle
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/v1/client/vehicles/:vehicleId
// @desc    Delete a vehicle (soft delete)
// @access  Private (Client only)
router.delete('/vehicles/:vehicleId', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    
    const vehicle = await Vehicle.findOne({ _id: vehicleId, clientId: req.user._id });
    
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    vehicle.isActive = false;
    await vehicle.save();
    
    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// @route   GET /api/v1/client/locations
// @desc    Get all saved locations
// @access  Private (Client only)
router.get('/locations', async (req, res) => {
  try {
    const locations = await SavedLocation.find({ clientId: req.user._id })
      .sort({ isDefault: -1, createdAt: -1 });
    
    res.json({
      success: true,
      locations
    });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/v1/client/locations
// @desc    Add a saved location
// @access  Private (Client only)
router.post('/locations', async (req, res) => {
  try {
    const { name, customName, address, location, isDefault } = req.body;
    
    if (!name || !address || !location || !location.coordinates) {
      return res.status(400).json({ error: 'Name, address, and coordinates are required' });
    }
    
    const savedLocation = await SavedLocation.create({
      clientId: req.user._id,
      name,
      customName,
      address,
      location: {
        type: 'Point',
        coordinates: location.coordinates
      },
      isDefault: isDefault || false
    });
    
    res.status(201).json({
      success: true,
      message: 'Location saved successfully',
      location: savedLocation
    });
  } catch (error) {
    console.error('Add location error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/v1/client/locations/:locationId
// @desc    Update a saved location
// @access  Private (Client only)
router.put('/locations/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { name, customName, address, location, isDefault } = req.body;
    
    const savedLocation = await SavedLocation.findOne({ _id: locationId, clientId: req.user._id });
    
    if (!savedLocation) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    if (name) savedLocation.name = name;
    if (customName !== undefined) savedLocation.customName = customName;
    if (address) savedLocation.address = address;
    if (location) {
      savedLocation.location = {
        type: 'Point',
        coordinates: location.coordinates
      };
    }
    if (isDefault !== undefined) savedLocation.isDefault = isDefault;
    
    await savedLocation.save();
    
    res.json({
      success: true,
      message: 'Location updated successfully',
      location: savedLocation
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/v1/client/locations/:locationId
// @desc    Delete a saved location
// @access  Private (Client only)
router.delete('/locations/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    
    const savedLocation = await SavedLocation.findOneAndDelete({ 
      _id: locationId, 
      clientId: req.user._id 
    });
    
    if (!savedLocation) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    res.json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// @route   GET /api/v1/client/favorites
// @desc    Get all favorite garages
// @access  Private (Client only)
router.get('/favorites', async (req, res) => {
  try {
    const favorites = await FavoriteGarage.find({ clientId: req.user._id })
      .populate('garageId', 'businessName businessPhone address location rating services photos')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      favorites
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/v1/client/favorites
// @desc    Add a garage to favorites
// @access  Private (Client only)
router.post('/favorites', async (req, res) => {
  try {
    const { garageId, notes } = req.body;
    
    if (!garageId) {
      return res.status(400).json({ error: 'Garage ID is required' });
    }
    
    const garage = await Garage.findById(garageId);
    if (!garage) {
      return res.status(404).json({ error: 'Garage not found' });
    }
    
    const existing = await FavoriteGarage.findOne({ 
      clientId: req.user._id, 
      garageId 
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Garage already in favorites' });
    }
    
    const favorite = await FavoriteGarage.create({
      clientId: req.user._id,
      garageId,
      notes
    });
    
    res.status(201).json({
      success: true,
      message: 'Garage added to favorites',
      favorite
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/v1/client/favorites/:garageId
// @desc    Remove a garage from favorites
// @access  Private (Client only)
router.delete('/favorites/:garageId', async (req, res) => {
  try {
    const { garageId } = req.params;
    
    const favorite = await FavoriteGarage.findOneAndDelete({
      clientId: req.user._id,
      garageId
    });
    
    if (!favorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    
    res.json({
      success: true,
      message: 'Garage removed from favorites'
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// @route   GET /api/v1/client/notifications/preferences
// @desc    Get notification preferences
// @access  Private (Client only)
router.get('/notifications/preferences', async (req, res) => {
  try {
    let preferences = await NotificationPreference.findOne({ userId: req.user._id });
    
    if (!preferences) {
      preferences = await NotificationPreference.create({ userId: req.user._id });
    }
    
    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/v1/client/notifications/preferences
// @desc    Update notification preferences
// @access  Private (Client only)
router.put('/notifications/preferences', async (req, res) => {
  try {
    const { emailNotifications, smsNotifications, pushNotifications, jobAssigned, jobStatusUpdate, promotionalOffers } = req.body;
    
    let preferences = await NotificationPreference.findOne({ userId: req.user._id });
    
    if (!preferences) {
      preferences = new NotificationPreference({ userId: req.user._id });
    }
    
    if (emailNotifications !== undefined) preferences.emailNotifications = emailNotifications;
    if (smsNotifications !== undefined) preferences.smsNotifications = smsNotifications;
    if (pushNotifications !== undefined) preferences.pushNotifications = pushNotifications;
    if (jobAssigned !== undefined) preferences.jobAssigned = jobAssigned;
    if (jobStatusUpdate !== undefined) preferences.jobStatusUpdate = jobStatusUpdate;
    if (promotionalOffers !== undefined) preferences.promotionalOffers = promotionalOffers;
    
    await preferences.save();
    
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// @route   GET /api/v1/client/jobs/drafts
// @desc    Get draft jobs (not yet submitted)
// @access  Private (Client only)
router.get('/jobs/drafts', async (req, res) => {
  try {
    const drafts = await Job.find({ 
      clientId: req.user._id, 
      status: 'draft' 
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      drafts
    });
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/v1/client/jobs/draft
// @desc    Save a job as draft
// @access  Private (Client only)
router.post('/jobs/draft', async (req, res) => {
  try {
    const { serviceType, clientLocation, clientAddress, destinationLocation, destinationAddress, notes, vehicleId } = req.body;
    
    const draft = await Job.create({
      clientId: req.user._id,
      serviceType,
      clientLocation: clientLocation ? { type: 'Point', coordinates: clientLocation.coordinates } : undefined,
      clientAddress,
      destinationLocation: destinationLocation ? { type: 'Point', coordinates: destinationLocation.coordinates } : undefined,
      destinationAddress,
      notes,
      vehicleId,
      status: 'draft'
    });
    
    res.status(201).json({
      success: true,
      message: 'Draft saved successfully',
      draft
    });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/v1/client/jobs/drafts/:draftId
// @desc    Delete a draft job
// @access  Private (Client only)
router.delete('/jobs/drafts/:draftId', async (req, res) => {
  try {
    const { draftId } = req.params;
    
    const draft = await Job.findOneAndDelete({ 
      _id: draftId, 
      clientId: req.user._id,
      status: 'draft'
    });
    
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    
    res.json({
      success: true,
      message: 'Draft deleted successfully'
    });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// @route   GET /api/v1/client/garages/nearby
// @desc    Get nearby garages based on location
router.get('/garages/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10, serviceType } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const coordinates = [parseFloat(lng), parseFloat(lat)];
    const radiusInMeters = parseFloat(radius) * 1000;

    let query = {
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: radiusInMeters
        }
      },
      isVerified: true,
      isOnline: true,
      subscriptionActive: true
    };

    let garages = await Garage.find(query)
      .select('businessName businessPhone address location services rating totalReviews isOnline')
      .limit(50);

    if (serviceType) {
      garages = garages.filter(garage => 
        garage.services.some(s => s.serviceType === serviceType && s.isActive)
      );
    }

    const garagesWithDistance = garages.map(garage => {
      const distance = calculateDistance(
        parseFloat(lat), parseFloat(lng),
        garage.location.coordinates[1], garage.location.coordinates[0]
      );
      return {
        ...garage.toObject(),
        distance: Math.round(distance * 10) / 10
      };
    });

    res.json({
      success: true,
      count: garagesWithDistance.length,
      garages: garagesWithDistance
    });
  } catch (error) {
    console.error('Get nearby garages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function for distance calculation
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// @route   POST /api/v1/client/jobs
// @desc    Create a new job request
router.post('/jobs', async (req, res) => {
  try {
    const { 
      serviceType, 
      clientLocation, 
      clientAddress, 
      destinationLocation, 
      destinationAddress, 
      notes,
      vehicleId,
      garageId
    } = req.body;

    if (!serviceType || !clientLocation || !clientAddress) {
      return res.status(400).json({ 
        error: 'Service type, location, and address are required' 
      });
    }

    const job = await Job.create({
      clientId: req.user._id,
      serviceType,
      clientLocation: {
        type: 'Point',
        coordinates: clientLocation.coordinates
      },
      clientAddress,
      destinationLocation: destinationLocation ? {
        type: 'Point',
        coordinates: destinationLocation.coordinates
      } : undefined,
      destinationAddress,
      notes,
      vehicleId,
      garageId,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Job request created successfully',
      job
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/v1/client/jobs
// @desc    Get client's job history
router.get('/jobs', async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    
    const query = { clientId: req.user._id, status: { $ne: 'draft' } };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('garageId', 'businessName businessPhone rating');

    const total = await Job.countDocuments(query);

    res.json({
      success: true,
      jobs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get client jobs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/v1/client/jobs/:jobId
// @desc    Get specific job details
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await Job.findOne({ _id: jobId, clientId: req.user._id })
      .populate('garageId', 'businessName businessPhone address location rating services');

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      success: true,
      job
    });
  } catch (error) {
    console.error('Get job details error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/v1/client/jobs/:jobId/review
// @desc    Add review for completed job
router.post('/jobs/:jobId/review', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const job = await Job.findOne({ _id: jobId, clientId: req.user._id });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Can only review completed jobs' });
    }

    if (!job.garageId) {
      return res.status(400).json({ error: 'No garage associated with this job' });
    }

    const existingReview = await Review.findOne({ jobId });
    if (existingReview) {
      return res.status(400).json({ error: 'Review already submitted for this job' });
    }

    const review = await Review.create({
      jobId,
      clientId: req.user._id,
      garageId: job.garageId,
      rating,
      comment
    });

    const garage = await Garage.findById(job.garageId);
    const allReviews = await Review.find({ garageId: job.garageId });
    const averageRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    
    garage.rating = Math.round(averageRating * 10) / 10;
    garage.totalReviews = allReviews.length;
    await garage.save();

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;