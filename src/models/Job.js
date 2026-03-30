import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  garageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Garage',
    default: null
  },
  serviceType: {
    type: String,
    enum: ['tire_change', 'jump_start', 'fuel_delivery', 'towing_5km', 'custom'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'en_route', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  clientLocation: {
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
  clientAddress: {
    type: String,
    required: true
  },
  destinationLocation: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: [Number]
  },
  destinationAddress: String,
  fixedPrice: Number,
  customBidAmount: Number,
  notes: {
    type: String,
    maxlength: 500
  },
  acceptedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

JobSchema.index({ clientLocation: '2dsphere' });
JobSchema.index({ status: 1, createdAt: -1 });
JobSchema.index({ clientId: 1, createdAt: -1 });
JobSchema.index({ garageId: 1, createdAt: -1 });

const Job = mongoose.model('Job', JobSchema);
export default Job;