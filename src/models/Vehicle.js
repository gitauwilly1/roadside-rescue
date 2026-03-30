import mongoose from 'mongoose';

const VehicleSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  licensePlate: {
    type: String,
    required: [true, 'License plate is required'],
    trim: true,
    uppercase: true
  },
  make: {
    type: String,
    required: [true, 'Vehicle make is required'],
    trim: true
  },
  model: {
    type: String,
    required: [true, 'Vehicle model is required'],
    trim: true
  },
  year: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  color: {
    type: String,
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure one default vehicle per client
VehicleSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { clientId: this.clientId, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

VehicleSchema.index({ clientId: 1, licensePlate: 1 }, { unique: true });

const Vehicle = mongoose.model('Vehicle', VehicleSchema);
export default Vehicle;