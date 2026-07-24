import mongoose from 'mongoose';

const GeneratedImageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  garmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Garment',
    required: false
  },
  generatedImageUrl: {
    type: String,
    required: [true, 'Please add a generated image URL']
  },
  garmentUrl: {
    type: String,
    default: null
  },
  modelImageUrl: {
    type: String,
    default: null
  },
  featureMode: {
    type: String,
    default: 'virtual-tryon'
  },
  modelType: {
    type: String,
    default: 'male'
  },
  category: {
    type: String,
    default: 'T-Shirt'
  },
  // Relaxed — no enum to avoid validation failures on any style value
  style: {
    type: String,
    default: 'Casual'
  },
  pose: {
    type: String,
    default: 'Standing'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('GeneratedImage', GeneratedImageSchema);
