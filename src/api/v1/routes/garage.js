import express from 'express';
import { authMiddleware, roleMiddleware } from '../../../middleware/auth.js';
import Garage from '../../../models/Garage.js';
import Job from '../../../models/Job.js';

const router = express.Router();

// Apply auth middleware to all garage routes
router.use(authMiddleware);
router.use(roleMiddleware('garage'));

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
      garage
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
      garage
    });
  } catch (error) {
    console.error('Update garage profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/v1/garage/online-status
// @desc    Toggle garage online/offline status
// @access  Private (Garage only)
router.put('/online-status', async (req, res) => {
  try {
    const { isOnline } = req.body;
    
    const garage = await Garage.findOne({ userId: req.user._id });
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }
    
    garage.isOnline = isOnline;
    await garage.save();
    
    res.json({
      success: true,
      isOnline: garage.isOnline
    });
  } catch (error) {
    console.error('Toggle online status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/v1/garage/jobs
// @desc    Get jobs assigned to this garage
// @access  Private (Garage only)
router.get('/jobs', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const garage = await Garage.findOne({ userId: req.user._id });
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage profile not found' });
    }
    
    const query = { garageId: garage._id };
    if (status) query.status = status;
    
    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('clientId', 'fullName phone');
    
    const total = await Job.countDocuments(query);
    
    res.json({
      success: true,
      jobs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get garage jobs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/v1/garage/jobs/:jobId/status
// @desc    Update job status (en_route, in_progress, completed)
// @access  Private (Garage only)
router.put('/jobs/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['en_route', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
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
    
    if (status === 'en_route') {
      job.acceptedAt = job.acceptedAt || new Date();
    }
    
    if (status === 'completed') {
      job.completedAt = new Date();
    }
    
    await job.save();
    
    res.json({
      success: true,
      job
    });
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;