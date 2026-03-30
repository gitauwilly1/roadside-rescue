import express from 'express';
import { authMiddleware, garageOnly } from '../../../middleware/auth.js';
import Garage from '../../../models/Garage.js';
import Job from '../../../models/Job.js';

const router = express.Router();

// Apply auth and garage-only middleware to all routes
router.use(authMiddleware);
router.use(garageOnly());

// @route   GET /api/v1/garage/profile
// @desc    Get garage profile
// @access  Private (Garage only)
router.get('/profile', async (req, res) => {
  try {
    const garage = await Garage.findOne({ userId: req.user._id });
    
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
// @desc    Update garage profile
// @access  Private (Garage only)
router.put('/profile', async (req, res) => {
  try {
    const { businessName, businessPhone, address, location, services } = req.body;
    
    const garage = await Garage.findOne({ userId: req.user._id });
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    if (businessName) garage.businessName = businessName;
    if (businessPhone) garage.businessPhone = businessPhone;
    if (address) garage.address = address;
    if (location) garage.location = location;
    if (services) garage.services = services;

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
        services: garage.services
      }
    });
  } catch (error) {
    console.error('Update garage profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PATCH /api/v1/garage/online-status
// @desc    Toggle garage online/offline status
// @access  Private (Garage only)
router.patch('/online-status', async (req, res) => {
  try {
    const { isOnline } = req.body;
    
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ error: 'isOnline must be a boolean' });
    }

    const garage = await Garage.findOne({ userId: req.user._id });
    
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
// @desc    Get all jobs for this garage
// @access  Private (Garage only)
router.get('/jobs', async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    
    const garage = await Garage.findOne({ userId: req.user._id });
    
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

// @route   PATCH /api/v1/garage/jobs/:jobId/status
// @desc    Update job status (accept, en_route, in_progress, complete)
// @access  Private (Garage only)
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

    const garage = await Garage.findOne({ userId: req.user._id });
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }

    const job = await Job.findOne({ _id: jobId, garageId: garage._id });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found or not assigned to you' });
    }

    job.status = status;
    
    if (status === 'accepted') job.acceptedAt = new Date();
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

export default router;