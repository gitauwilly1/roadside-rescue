import express from 'express';
import { authMiddleware, adminOnly } from '../../../middleware/auth.js';
import User from '../../../models/User.js';
import Garage from '../../../models/Garage.js';
import Job from '../../../models/Job.js';
import Review from '../../../models/Review.js';
import Vehicle from '../../../models/Vehicle.js';
import SavedLocation from '../../../models/SavedLocation.js';
import FavoriteGarage from '../../../models/FavoriteGarage.js';
import NotificationPreference from '../../../models/NotificationPreference.js';

const router = express.Router();

// Apply auth and admin-only middleware to all routes
router.use(authMiddleware);
router.use(adminOnly());


// @route   GET /api/v1/admin/users
// @desc    Get all users with pagination and filters
// @access  Private (Admin only)
router.get('/users', async (req, res) => {
  try {
    const { role, isActive, limit = 50, page = 1 } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/v1/admin/users/:userId
// @desc    Get single user by ID
// @access  Private (Admin only)
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let garage = null;
    if (user.role === 'garage') {
      garage = await Garage.findOne({ userId: user._id });
    }

    res.json({
      success: true,
      user,
      garage
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/v1/admin/users/:userId
// @desc    Update user (activate/deactivate, change role)
// @access  Private (Admin only)
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive, role, fullName, phone, email } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (isActive !== undefined) user.isActive = isActive;
    if (role) user.role = role;
    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    if (email) user.email = email.toLowerCase();

    await user.save();

    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user._id,
        phone: user.phone,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/v1/admin/users/:userId
// @desc    Soft delete user (deactivate)
// @access  Private (Admin only)
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// @route   GET /api/v1/admin/garages
// @desc    Get all garages with details
// @access  Private (Admin only)
router.get('/garages', async (req, res) => {
  try {
    const { isVerified, isOnline, limit = 50, page = 1 } = req.query;
    
    const query = {};
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';
    if (isOnline !== undefined) query.isOnline = isOnline === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const garages = await Garage.find(query)
      .populate('userId', 'fullName phone email isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Garage.countDocuments(query);

    res.json({
      success: true,
      garages,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get garages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/v1/admin/garages/:garageId
// @desc    Get single garage by ID
// @access  Private (Admin only)
router.get('/garages/:garageId', async (req, res) => {
  try {
    const { garageId } = req.params;
    
    const garage = await Garage.findById(garageId)
      .populate('userId', 'fullName phone email isActive createdAt');
    
    if (!garage) {
      return res.status(404).json({ error: 'Garage not found' });
    }

    res.json({
      success: true,
      garage
    });
  } catch (error) {
    console.error('Get garage error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/v1/admin/garages/:garageId/verify
// @desc    Verify/unverify a garage
// @access  Private (Admin only)
router.patch('/garages/:garageId/verify', async (req, res) => {
  try {
    const { garageId } = req.params;
    const { isVerified } = req.body;

    if (typeof isVerified !== 'boolean') {
      return res.status(400).json({ error: 'isVerified must be a boolean' });
    }

    const garage = await Garage.findById(garageId);
    if (!garage) {
      return res.status(404).json({ error: 'Garage not found' });
    }

    garage.isVerified = isVerified;
    await garage.save();

    res.json({
      success: true,
      message: isVerified ? 'Garage verified successfully' : 'Garage unverified',
      garage: {
        id: garage._id,
        businessName: garage.businessName,
        isVerified: garage.isVerified
      }
    });
  } catch (error) {
    console.error('Verify garage error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// @route   GET /api/v1/admin/jobs
// @desc    Get all jobs with filters
// @access  Private (Admin only)
router.get('/jobs', async (req, res) => {
  try {
    const { status, fromDate, toDate, limit = 50, page = 1 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const jobs = await Job.find(query)
      .populate('clientId', 'fullName phone email')
      .populate('garageId', 'businessName businessPhone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

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
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/v1/admin/stats
// @desc    Get platform statistics
// @access  Private (Admin only)
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalClients = await User.countDocuments({ role: 'client' });
    const totalGarages = await User.countDocuments({ role: 'garage' });
    const activeGarages = await Garage.countDocuments({ isOnline: true });
    const verifiedGarages = await Garage.countDocuments({ isVerified: true });
    
    const totalJobs = await Job.countDocuments();
    const completedJobs = await Job.countDocuments({ status: 'completed' });
    const pendingJobs = await Job.countDocuments({ status: 'pending' });
    
    const averageRating = await Review.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          clients: totalClients,
          garages: totalGarages
        },
        garages: {
          total: totalGarages,
          active: activeGarages,
          verified: verifiedGarages
        },
        jobs: {
          total: totalJobs,
          completed: completedJobs,
          pending: pendingJobs,
          completionRate: totalJobs > 0 ? (completedJobs / totalJobs * 100).toFixed(1) : 0
        },
        averageRating: averageRating[0]?.avgRating?.toFixed(1) || 0
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// @route   GET /api/v1/admin/vehicles
// @desc    Get all vehicles across all clients
// @access  Private (Admin only)
router.get('/vehicles', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const vehicles = await Vehicle.find()
      .populate('clientId', 'fullName phone email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Vehicle.countDocuments();
    
    res.json({
      success: true,
      vehicles,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/v1/admin/vehicles/:vehicleId
// @desc    Delete a vehicle (admin override)
// @access  Private (Admin only)
router.delete('/vehicles/:vehicleId', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    
    const vehicle = await Vehicle.findByIdAndDelete(vehicleId);
    
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// @route   GET /api/v1/admin/favorites
// @desc    Get all favorites across all clients
// @access  Private (Admin only)
router.get('/favorites', async (req, res) => {
  try {
    const favorites = await FavoriteGarage.find()
      .populate('clientId', 'fullName phone email')
      .populate('garageId', 'businessName businessPhone')
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


// @route   GET /api/v1/admin/notifications/preferences
// @desc    Get all notification preferences
// @access  Private (Admin only)
router.get('/notifications/preferences', async (req, res) => {
  try {
    const preferences = await NotificationPreference.find()
      .populate('userId', 'fullName phone email role')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/v1/admin/jobs/:jobId
// @desc    Soft delete a job (admin only)
// @access  Private (Admin only)
router.delete('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Soft delete - mark as deleted and add reason
    job.status = 'cancelled';
    job.cancelledAt = new Date();
    job.cancellationReason = 'Deleted by admin: ' + (req.body.reason || 'Violation of terms');
    await job.save();

    res.json({
      success: true,
      message: 'Job deleted successfully',
      job: {
        id: job._id,
        status: job.status,
        cancellationReason: job.cancellationReason
      }
    });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/v1/admin/reviews
// @desc    Get all reviews with pagination and filters
// @access  Private (Admin only)
router.get('/reviews', async (req, res) => {
  try {
    const { rating, garageId, limit = 50, page = 1 } = req.query;
    
    const query = {};
    if (rating) query.rating = parseInt(rating);
    if (garageId) query.garageId = garageId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const reviews = await Review.find(query)
      .populate('clientId', 'fullName phone email')
      .populate('garageId', 'businessName businessPhone address')
      .populate('jobId', 'serviceType status createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    res.json({
      success: true,
      reviews,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/v1/admin/reviews/:reviewId
// @desc    Delete a review (admin only)
// @access  Private (Admin only)
router.delete('/reviews/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findByIdAndDelete(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Update garage rating after review deletion
    const garage = await Garage.findById(review.garageId);
    if (garage) {
      const allReviews = await Review.find({ garageId: review.garageId });
      const averageRating = allReviews.length > 0 
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;
      
      garage.rating = Math.round(averageRating * 10) / 10;
      garage.totalReviews = allReviews.length;
      await garage.save();
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/v1/admin/vehicles/:vehicleId
// @desc    Permanently delete a vehicle (admin only)
// @access  Private (Admin only)
router.delete('/vehicles/:vehicleId', async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const vehicle = await Vehicle.findByIdAndDelete(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json({
      success: true,
      message: 'Vehicle permanently deleted successfully'
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;