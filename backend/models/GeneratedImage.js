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
    required: false // Optional, can allow text/mock references
  },
  generatedImageUrl: {
    type: String,
    required: [true, 'Please add a generated image URL']
  },
  modelType: {
    type: String,
    required: true,
    enum: ['Male', 'Female', 'male', 'female', 'kids', 'custom', 'Custom']
  },
  style: {
    type: String,
    required: true,
    enum: ['Casual', 'Fashion', 'Professional']
  },
  pose: {
    type: String,
    required: true,
    enum: ['Standing', 'Walking', 'Lifestyle']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('GeneratedImage', GeneratedImageSchema);
