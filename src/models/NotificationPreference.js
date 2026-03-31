import mongoose from 'mongoose';

const NotificationPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true 
  },
  emailNotifications: {
    type: Boolean,
    default: true
  },
  smsNotifications: {
    type: Boolean,
    default: true
  },
  pushNotifications: {
    type: Boolean,
    default: true
  },
  jobAssigned: {
    type: Boolean,
    default: true
  },
  jobStatusUpdate: {
    type: Boolean,
    default: true
  },
  promotionalOffers: {
    type: Boolean,
    default: false
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


const NotificationPreference = mongoose.model('NotificationPreference', NotificationPreferenceSchema);
export default NotificationPreference;