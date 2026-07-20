import express from 'express';
import GeneratedImage from '../models/GeneratedImage.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get user's generated image history
// @route   GET /api/generated-images
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const history = await GeneratedImage.find({ userId: req.user._id })
      .populate('garmentId') // Populate garment if it exists
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Delete generated image
// @route   DELETE /api/generated-images/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const image = await GeneratedImage.findById(req.params.id);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Verify user ownership
    if (image.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to delete this image'
      });
    }

    await image.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Generated image deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
