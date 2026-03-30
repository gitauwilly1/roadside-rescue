const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../../../models/User');
const Garage = require('../../../models/Garage');
const router = express.Router();

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @route   POST /api/v1/auth/register
// @desc    Register user (client or garage)
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { phone, password, fullName, role, email, businessDetails } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this phone already exists' });
    }

    // Create user
    const user = await User.create({
      phone,
      password,
      fullName,
      role,
      email: email || undefined
    });

    // If role is garage, create garage profile
    let garage = null;
    if (role === 'garage') {
      if (!businessDetails) {
        return res.status(400).json({ error: 'Business details required for garage registration' });
      }
      
      garage = await Garage.create({
        userId: user._id,
        businessName: businessDetails.businessName,
        licenseNumber: businessDetails.licenseNumber,
        businessPhone: businessDetails.businessPhone,
        address: businessDetails.address,
        location: businessDetails.location,
        services: businessDetails.services || []
      });
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role
      },
      garage: garage ? {
        id: garage._id,
        businessName: garage.businessName,
        isVerified: garage.isVerified,
        isOnline: garage.isOnline
      } : null
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password required' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    let garage = null;
    if (user.role === 'garage') {
      garage = await Garage.findOne({ userId: user._id });
    }

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role
      },
      garage: garage ? {
        id: garage._id,
        businessName: garage.businessName,
        isVerified: garage.isVerified,
        isOnline: garage.isOnline
      } : null
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/v1/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', require('../../../middleware/auth').authMiddleware, async (req, res) => {
  try {
    let garage = null;
    if (req.user.role === 'garage') {
      garage = await Garage.findOne({ userId: req.user._id });
    }

    res.json({
      user: {
        id: req.user._id,
        phone: req.user.phone,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role
      },
      garage: garage ? {
        id: garage._id,
        businessName: garage.businessName,
        businessPhone: garage.businessPhone,
        address: garage.address,
        location: garage.location,
        isVerified: garage.isVerified,
        isOnline: garage.isOnline,
        services: garage.services,
        rating: garage.rating,
        totalReviews: garage.totalReviews
      } : null
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;