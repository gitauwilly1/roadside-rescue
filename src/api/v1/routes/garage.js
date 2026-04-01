import express from 'express';
import { authMiddleware, garageOnly } from '../../../middleware/auth.js';
import Garage from '../../../models/Garage.js';
import Job from '../../../models/Job.js';

const router = express.Router();

const getCurrentGarage = async (userId) => {
  return await Garage.findOne({ userId });
};

router.use(authMiddleware);
router.use(garageOnly());

// @route   GET /api/v1/garage/profile
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

// @route   GET /api/v1/garage/jobs/available
router.get('/jobs/available', async (req, res) => {
  try {
    const { serviceType, limit = 20, page = 1 } = req.query;
    
    const garage = await getCurrentGarage(req.user._id);
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    const query = { 
      status: 'pending',
      garageId: null
    };
    
    if (serviceType) query.serviceType = serviceType;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const jobs = await Job.find(query)
      .sort({ createdAt: 1 })
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
    console.error('Get available jobs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PATCH /api/v1/garage/jobs/:jobId/status
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

    let job;

    if (status === 'accepted') {
      job = await Job.findOne({ 
        _id: jobId, 
        status: 'pending',
        garageId: null 
      });
      
      if (!job) {
        return res.status(404).json({ 
          error: 'Job not found, already assigned, or not pending' 
        });
      }
      
      job.garageId = garage._id;
      job.status = status;
      job.acceptedAt = new Date();
    } else {
      job = await Job.findOne({ 
        _id: jobId, 
        garageId: garage._id 
      });
      
      if (!job) {
        return res.status(404).json({ 
          error: 'Job not found or not assigned to your garage' 
        });
      }
      
      job.status = status;
      
      if (status === 'completed') job.completedAt = new Date();
      if (status === 'cancelled') job.cancelledAt = new Date();
    }

    await job.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('job_status_update', job);
    }

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

// @route   POST /api/v1/garage/services
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

// @route   PUT /api/v1/garage/services
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

// @route   DELETE /api/v1/garage/services/:serviceType
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

export default router;