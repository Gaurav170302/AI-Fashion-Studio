import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Helper to sign JWT
const generateToken = (id) => {
  return jwt.sign(
    { id }, 
    process.env.JWT_SECRET || 'super_secret_key_fashion_123', 
    { expiresIn: '30d' }
  );
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: `An account with ${email} already exists. Please log in instead.`
      });
    }


    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'seller'
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[Register Error]', error.message);

    // Mongoose duplicate key — email already taken
    if (error.code === 11000) {
      const value = error.keyValue?.email || '';
      return res.status(400).json({
        success: false,
        message: `An account with ${value || 'that email'} already exists. Please log in instead.`
      });
    }

    // Mongoose validation error (bad email format, minlength, missing fields)
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. ')
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed. Please try again.'
    });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email and password'
      });
    }

    // Check for user (explicitly select password)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Reset password (no email token needed — direct reset)
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    let updated = false;

    // ── File-based DB path (mock) ────────────────────────────────────────────
    if (typeof User.updatePassword === 'function') {
      updated = await User.updatePassword(normalizedEmail, hashed);
    }

    // ── MongoDB / Mongoose path ──────────────────────────────────────────────
    if (!updated) {
      const result = await User.findOneAndUpdate(
        { email: normalizedEmail },
        { password: hashed },
        { new: true }
      );
      updated = !!result;
    }

    if (!updated) {
      // Email not found — return success anyway (don't reveal existence)
      return res.status(200).json({
        success: true,
        message: 'If that email is registered, your password has been updated.'
      });
    }

    console.log(`[Auth] ✓ Password reset for: ${normalizedEmail}`);
    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in.'
    });

  } catch (error) {
    console.error('[Reset Password Error]', error.message);
    res.status(500).json({ success: false, message: 'Password reset failed. Please try again.' });
  }
});

export default router;
