import express from 'express';
import { authMiddleware, clientOnly } from '../../../middleware/auth.js';
import Garage from '../../../models/Garage.js';
import Job from '../../../models/Job.js';
import Review from '../../../models/Review.js';

const router = express.Router();

// Apply auth and client-only middleware to all routes
router.use(authMiddleware);
router.use(clientOnly());

// @route   GET /api/v1/client/garages/nearby
// @desc    Get nearby garages based on location
// @access  Private (Client only)
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

    // Filter by service type if specified
    if (serviceType) {
      garages = garages.filter(garage => 
        garage.services.some(s => s.serviceType === serviceType && s.isActive)
      );
    }

    // Calculate distance for each garage
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

// Helper function to calculate distance between two points (km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
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
// @access  Private (Client only)
router.get('/jobs', async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    
    const query = { clientId: req.user._id };
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
// @access  Private (Client only)
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
// @access  Private (Client only)
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

    // Check if review already exists
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

    // Update garage rating
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