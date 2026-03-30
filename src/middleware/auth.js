import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'No token provided', 
        message: 'Authorization token is required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token', 
        message: 'User associated with this token no longer exists' 
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        error: 'Account disabled', 
        message: 'Your account has been deactivated' 
      });
    }

    user.lastActive = new Date();
    await user.save();

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token', 
        message: 'The provided token is invalid' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired', 
        message: 'Please login again' 
      });
    }
    console.error('Auth middleware error:', error.message);
    res.status(500).json({ 
      error: 'Server error', 
      message: 'Authentication service unavailable' 
    });
  }
};

export const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: `This endpoint requires one of these roles: ${allowedRoles.join(', ')}`,
        yourRole: req.user.role
      });
    }
    next();
  };
};

export const clientOnly = () => roleMiddleware('client');

export const garageOnly = () => roleMiddleware('garage');