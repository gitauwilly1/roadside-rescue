import mongoose from 'mongoose';

const SavedLocationSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Location name is required'],
    trim: true,
    enum: ['home', 'work', 'favorite_garage', 'custom']
  },
  customName: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Address is required']
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
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

SavedLocationSchema.index({ clientId: 1, name: 1 });
SavedLocationSchema.index({ location: '2dsphere' });

const SavedLocation = mongoose.model('SavedLocation', SavedLocationSchema);
export default SavedLocation;