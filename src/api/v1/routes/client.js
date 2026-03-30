import express from 'express';
import { authMiddleware, roleMiddleware } from '../../../middleware/auth.js';
import Job from '../../../models/Job.js';
import Garage from '../../../models/Garage.js';

const router = express.Router();

// Apply auth middleware to all client routes
router.use(authMiddleware);
router.use(roleMiddleware('client'));

// @route   POST /api/v1/client/jobs
// @desc    Create a new service request
// @access  Private (Client only)
router.post('/jobs', async (req, res) => {
  try {
    const {
      serviceType,
      clientLocation,
      clientAddress,
      destinationLocation,
      destinationAddress,
      notes
    } = req.body;
    
    const job = await Job.create({
      clientId: req.user._id,
      serviceType,
      clientLocation,
      clientAddress,
      destinationLocation,
      destinationAddress,
      notes,
      status: 'pending'
    });
    
    res.status(201).json({
      success: true,
      job
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/v1/client/jobs
// @desc    Get client's job history
// @access  Private (Client only)
router.get('/jobs', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { clientId: req.user._id };
    if (status) query.status = status;
    
    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('garageId', 'businessName businessPhone');
    
    const total = await Job.countDocuments(query);
    
    res.json({
      success: true,
      jobs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get client jobs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/v1/client/jobs/:jobId
// @desc    Get specific job details
// @access  Private (Client only)
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await Job.findOne({ _id: jobId, clientId: req.user._id })
      .populate('garageId', 'businessName businessPhone location rating');
    
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

// @route   PUT /api/v1/client/jobs/:jobId/cancel
// @desc    Cancel a pending job
// @access  Private (Client only)
router.put('/jobs/:jobId/cancel', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { cancellationReason } = req.body;
    
    const job = await Job.findOne({ _id: jobId, clientId: req.user._id });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending jobs can be cancelled' });
    }
    
    job.status = 'cancelled';
    job.cancelledAt = new Date();
    job.cancellationReason = cancellationReason;
    
    await job.save();
    
    res.json({
      success: true,
      job
    });
  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/v1/client/nearby-garages
// @desc    Get garages near a location
// @access  Private (Client only)
router.get('/nearby-garages', async (req, res) => {
  try {
    const { lng, lat, maxDistance = 5000 } = req.query;
    
    if (!lng || !lat) {
      return res.status(400).json({ error: 'Coordinates required' });
    }
    
    const garages = await Garage.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      },
      isVerified: true,
      isOnline: true
    }).limit(20);
    
    res.json({
      success: true,
      garages
    });
  } catch (error) {
    console.error('Get nearby garages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;