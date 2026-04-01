import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../../models/User.js';
import Garage from '../../../models/Garage.js';
import { authMiddleware } from '../../../middleware/auth.js';

const router = express.Router();


const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Helper to find user by email or phone
const findUserByIdentifier = async (identifier) => {
  const isEmail = identifier.includes('@');
  
  if (isEmail) {
    return await User.findOne({ email: identifier.toLowerCase() });
  } else {
    return await User.findOne({ phone: identifier });
  }
};

// Helper validation functions
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhone = (phone) => {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone);
};

const isValidPassword = (password) => {
  return password && password.length >= 6;
};

// @route   POST /api/v1/auth/register
// @desc    Register user (client, garage, or admin)
router.post('/register', async (req, res) => {
  try {
    const { phone, email, password, fullName, role, businessDetails } = req.body;

    // Validation
    if (!phone || !email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format. Use 10 digits.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (!['client', 'garage', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be client, garage, or admin' });
    }

    // Check if phone already exists
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ error: 'User with this phone already exists' });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      phone,
      email: email.toLowerCase(),
      password: hashedPassword,
      fullName,
      role
    });

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
        email: user.email,
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
// @desc    Login with email OR phone
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ 
        error: 'Identifier (email or phone) and password are required' 
      });
    }

    const user = await findUserByIdentifier(identifier);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
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
        email: user.email,
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
// @desc    Get current authenticated user
router.get('/me', authMiddleware, async (req, res) => {
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
        role: req.user.role,
        isActive: req.user.isActive,
        createdAt: req.user.createdAt
      },
      garage: garage ? {
        id: garage._id,
        businessName: garage.businessName,
        businessPhone: garage.businessPhone,
        licenseNumber: garage.licenseNumber,
        address: garage.address,
        location: garage.location,
        isVerified: garage.isVerified,
        isOnline: garage.isOnline,
        services: garage.services,
        rating: garage.rating,
        totalReviews: garage.totalReviews,
        fleetCount: garage.fleetCount
      } : null
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/v1/auth/google
// @desc    Authenticate with Google Firebase token
// @access  Public
router.post('/google', async (req, res) => {
  try {
    const { idToken, fullName, phone, role, businessDetails } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Google ID token is required' });
    }

    const decodedToken = await verifyFirebaseToken(idToken);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const googleEmail = decodedToken.email;
    const googleName = fullName || decodedToken.name || googleEmail.split('@')[0];

    let user = await User.findOne({ email: googleEmail.toLowerCase() });

    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);

      user = await User.create({
        phone: phone || '',
        email: googleEmail.toLowerCase(),
        password: hashedPassword,
        fullName: googleName,
        role: role || 'client',
        isActive: true
      });

      let garage = null;
      if (role === 'garage' && businessDetails) {
        garage = await Garage.create({
          userId: user._id,
          businessName: businessDetails.businessName,
          licenseNumber: businessDetails.licenseNumber,
          businessPhone: businessDetails.businessPhone,
          address: businessDetails.address,
          location: businessDetails.location || { coordinates: [36.8219, -1.2921] },
          services: businessDetails.services || []
        });
      }

      const token = generateToken(user._id);

      return res.status(201).json({
        success: true,
        isNewUser: true,
        token,
        user: {
          id: user._id,
          phone: user.phone,
          email: user.email,
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
    }

    const token = generateToken(user._id);

    let garage = null;
    if (user.role === 'garage') {
      garage = await Garage.findOne({ userId: user._id });
    }

    res.json({
      success: true,
      isNewUser: false,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        email: user.email,
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
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

export default router;