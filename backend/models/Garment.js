import mongoose from 'mongoose';

const GarmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  imageUrl: {
    type: String,
    required: [true, 'Please add an image URL']
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    enum: [
      'T-Shirt', 'Shirt', 'Hoodie', 'Dress',
      'Jacket', 'Kurta', 'Blazer', 'Pants',
      'Saree', 'Person'
    ]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Garment', GarmentSchema);
