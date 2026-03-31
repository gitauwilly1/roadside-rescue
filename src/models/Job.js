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
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
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
      required: true
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
  destinationAddress: {
    type: String
  },
  fixedPrice: {
    type: Number,
    min: 0
  },
  customBidAmount: {
    type: Number,
    min: 0
  },
  notes: {
    type: String,
    maxlength: 500
  },
  acceptedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String,
    maxlength: 200
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

JobSchema.index({ clientLocation: '2dsphere' });
JobSchema.index({ status: 1, createdAt: -1 });
JobSchema.index({ clientId: 1, createdAt: -1 });
JobSchema.index({ garageId: 1, createdAt: -1 });
JobSchema.index({ status: 1, garageId: 1 });
JobSchema.index({ clientId: 1, status: 1 });

JobSchema.virtual('duration').get(function() {
  if (this.acceptedAt && this.completedAt) {
    return (this.completedAt - this.acceptedAt) / 1000 / 60;
  }
  return null;
});

JobSchema.methods.canBeCancelled = function() {
  return ['pending', 'accepted', 'en_route'].includes(this.status);
};

JobSchema.methods.canBeReviewed = function() {
  return this.status === 'completed';
};

JobSchema.methods.getSummary = function() {
  return {
    id: this._id,
    serviceType: this.serviceType,
    status: this.status,
    clientAddress: this.clientAddress,
    destinationAddress: this.destinationAddress,
    createdAt: this.createdAt,
    acceptedAt: this.acceptedAt,
    completedAt: this.completedAt
  };
};

const Job = mongoose.model('Job', JobSchema);
export default Job;