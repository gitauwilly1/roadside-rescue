import mongoose from 'mongoose';

const FavoriteGarageSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  garageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Garage',
    required: true
  },
  notes: {
    type: String,
    maxlength: 200
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

FavoriteGarageSchema.index({ clientId: 1, garageId: 1 }, { unique: true });

const FavoriteGarage = mongoose.model('FavoriteGarage', FavoriteGarageSchema);
export default FavoriteGarage;