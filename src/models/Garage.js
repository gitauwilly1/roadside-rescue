import mongoose from 'mongoose';

const ServiceSchema = new mongoose.Schema({
  serviceType: {
    type: String,
    enum: ['tire_change', 'jump_start', 'fuel_delivery', 'towing_5km'],
    required: true
  },
  fixedPrice: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const GarageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  businessName: {
    type: String,
    required: [true, 'Business name is required']
  },
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    unique: true
  },
  businessPhone: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  services: [ServiceSchema],
  photos: [String],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  fleetCount: {
    type: Number,
    default: 1
  },
  subscriptionActive: {
    type: Boolean,
    default: true
  },
  subscriptionExpiry: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

GarageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

GarageSchema.index({ location: '2dsphere' });

const Garage = mongoose.model('Garage', GarageSchema);
export default Garage;