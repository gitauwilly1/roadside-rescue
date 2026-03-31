import express from 'express';
import { authMiddleware, garageOnly } from '../../../middleware/auth.js';
import Garage from '../../../models/Garage.js';
import Job from '../../../models/Job.js';

const router = express.Router();

// Apply auth and garage-only middleware to all routes
router.use(authMiddleware);
router.use(garageOnly());

// Helper to get current garage profile
const getCurrentGarage = async (userId) => {
  return await Garage.findOne({ userId });
};


// @route   GET /api/v1/garage/profile
// @desc    Get own garage profile
router.get('/profile', async (req, res) => {
  try {
    const garage = await getCurrentGarage(req.user._id);
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    res.json({
      success: true,
      garage: {
        id: garage._id,
        businessName: garage.businessName,
        licenseNumber: garage.licenseNumber,
        businessPhone: garage.businessPhone,
        address: garage.address,
        location: garage.location,
        isVerified: garage.isVerified,
        isOnline: garage.isOnline,
        services: garage.services,
        photos: garage.photos,
        rating: garage.rating,
        totalReviews: garage.totalReviews,
        fleetCount: garage.fleetCount,
        subscriptionActive: garage.subscriptionActive,
        subscriptionExpiry: garage.subscriptionExpiry
      }
    });
  } catch (error) {
    console.error('Get garage profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/v1/garage/profile
// @desc    Update own garage profile
router.put('/profile', async (req, res) => {
  try {
    const { businessName, businessPhone, address, location, services, fleetCount } = req.body;
    
    const garage = await getCurrentGarage(req.user._id);
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    if (businessName) garage.businessName = businessName;
    if (businessPhone) garage.businessPhone = businessPhone;
    if (address) garage.address = address;
    if (location) garage.location = location;
    if (services) garage.services = services;
    if (fleetCount !== undefined) garage.fleetCount = fleetCount;

    await garage.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      garage: {
        id: garage._id,
        businessName: garage.businessName,
        businessPhone: garage.businessPhone,
        address: garage.address,
        location: garage.location,
        services: garage.services,
        fleetCount: garage.fleetCount
      }
    });
  } catch (error) {
    console.error('Update garage profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PATCH /api/v1/garage/online-status
// @desc    Toggle own garage online/offline status
router.patch('/online-status', async (req, res) => {
  try {
    const { isOnline } = req.body;
    
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ error: 'isOnline must be a boolean' });
    }

    const garage = await getCurrentGarage(req.user._id);
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    garage.isOnline = isOnline;
    await garage.save();

    res.json({
      success: true,
      isOnline: garage.isOnline,
      message: isOnline ? 'You are now online and will receive job requests' : 'You are now offline'
    });
  } catch (error) {
    console.error('Toggle online status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// @route   GET /api/v1/garage/jobs
// @desc    Get jobs assigned to own garage only
router.get('/jobs', async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    
    const garage = await getCurrentGarage(req.user._id);
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    const query = { garageId: garage._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('clientId', 'fullName phone');

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
    console.error('Get garage jobs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/v1/garage/jobs/:jobId
// @desc    Get specific job assigned to own garage
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const garage = await getCurrentGarage(req.user._id);
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    const job = await Job.findOne({ _id: jobId, garageId: garage._id })
      .populate('clientId', 'fullName phone email');

    if (!job) {
      return res.status(404).json({ error: 'Job not found or not assigned to your garage' });
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

// @route   PATCH /api/v1/garage/jobs/:jobId/status
// @desc    Update job status for own garage only
router.patch('/jobs/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;
    
    const allowedStatuses = ['accepted', 'en_route', 'in_progress', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status', 
        allowed: allowedStatuses 
      });
    }

    const garage = await getCurrentGarage(req.user._id);
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    const job = await Job.findOne({ _id: jobId, garageId: garage._id });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found or not assigned to your garage' });
    }

    job.status = status;
    
    if (status === 'accepted' && !job.acceptedAt) job.acceptedAt = new Date();
    if (status === 'completed') job.completedAt = new Date();
    if (status === 'cancelled') job.cancelledAt = new Date();

    await job.save();

    res.json({
      success: true,
      message: `Job status updated to ${status}`,
      job
    });
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// @route   PUT /api/v1/garage/services
// @desc    Update all services for own garage
router.put('/services', async (req, res) => {
  try {
    const { services } = req.body;
    
    if (!services || !Array.isArray(services)) {
      return res.status(400).json({ error: 'Services array is required' });
    }

    const garage = await getCurrentGarage(req.user._id);
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    const validServiceTypes = ['tire_change', 'jump_start', 'fuel_delivery', 'towing_5km'];
    for (const service of services) {
      if (!validServiceTypes.includes(service.serviceType)) {
        return res.status(400).json({ 
          error: `Invalid service type: ${service.serviceType}`,
          validTypes: validServiceTypes
        });
      }
      if (typeof service.fixedPrice !== 'number' || service.fixedPrice < 0) {
        return res.status(400).json({ 
          error: `Invalid price for service: ${service.serviceType}` 
        });
      }
    }

    garage.services = services;
    await garage.save();

    res.json({
      success: true,
      message: 'Services updated successfully',
      services: garage.services
    });
  } catch (error) {
    console.error('Update services error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/v1/garage/services
// @desc    Add a new service to own garage
router.post('/services', async (req, res) => {
  try {
    const { serviceType, fixedPrice, isActive } = req.body;
    
    const validServiceTypes = ['tire_change', 'jump_start', 'fuel_delivery', 'towing_5km'];
    if (!validServiceTypes.includes(serviceType)) {
      return res.status(400).json({ 
        error: `Invalid service type. Must be one of: ${validServiceTypes.join(', ')}` 
      });
    }

    if (typeof fixedPrice !== 'number' || fixedPrice < 0) {
      return res.status(400).json({ error: 'Valid fixed price is required' });
    }

    const garage = await getCurrentGarage(req.user._id);
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    const existingService = garage.services.find(s => s.serviceType === serviceType);
    if (existingService) {
      return res.status(400).json({ 
        error: 'Service already exists. Use PUT to update instead.' 
      });
    }

    garage.services.push({
      serviceType,
      fixedPrice,
      isActive: isActive !== undefined ? isActive : true
    });
    
    await garage.save();

    res.status(201).json({
      success: true,
      message: 'Service added successfully',
      services: garage.services
    });
  } catch (error) {
    console.error('Add service error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/v1/garage/services/:serviceType
// @desc    Remove a service from own garage
router.delete('/services/:serviceType', async (req, res) => {
  try {
    const { serviceType } = req.params;
    
    const validServiceTypes = ['tire_change', 'jump_start', 'fuel_delivery', 'towing_5km'];
    if (!validServiceTypes.includes(serviceType)) {
      return res.status(400).json({ 
        error: `Invalid service type. Must be one of: ${validServiceTypes.join(', ')}` 
      });
    }

    const garage = await getCurrentGarage(req.user._id);
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    const serviceExists = garage.services.find(s => s.serviceType === serviceType);
    if (!serviceExists) {
      return res.status(404).json({ error: 'Service not found' });
    }

    garage.services = garage.services.filter(s => s.serviceType !== serviceType);
    await garage.save();

    res.json({
      success: true,
      message: 'Service removed successfully',
      services: garage.services
    });
  } catch (error) {
    console.error('Remove service error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// @route   POST /api/v1/garage/photos
// @desc    Add photos to own garage
router.post('/photos', async (req, res) => {
  try {
    const { photos } = req.body;
    
    if (!photos || !Array.isArray(photos)) {
      return res.status(400).json({ error: 'Photos array is required' });
    }

    const garage = await getCurrentGarage(req.user._id);
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    garage.photos = [...garage.photos, ...photos];
    await garage.save();

    res.json({
      success: true,
      message: 'Photos added successfully',
      photos: garage.photos
    });
  } catch (error) {
    console.error('Add photos error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/v1/garage/photos
// @desc    Remove photos from own garage
router.delete('/photos', async (req, res) => {
  try {
    const { photoUrls } = req.body;
    
    if (!photoUrls || !Array.isArray(photoUrls)) {
      return res.status(400).json({ error: 'Photo URLs array is required' });
    }

    const garage = await getCurrentGarage(req.user._id);
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    garage.photos = garage.photos.filter(photo => !photoUrls.includes(photo));
    await garage.save();

    res.json({
      success: true,
      message: 'Photos removed successfully',
      photos: garage.photos
    });
  } catch (error) {
    console.error('Remove photos error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;