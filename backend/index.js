import dotenv from 'dotenv';
// Load env vars immediately at startup
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import garmentRoutes from './routes/garments.js';
import generateRoutes from './routes/generate.js';
import generatedImageRoutes from './routes/generatedImages.js';
import modelRoutes from './routes/models.js';

import { tryOnManager } from './services/tryon/TryOnManager.js';


// Validate Environment Variables
function validateEnvironment() {
  console.log('--- Environment Validation ---');
  if (!process.env.REPLICATE_API_TOKEN) {
    console.warn('⚠️  REPLICATE_API_TOKEN is missing. Replicate VTON will be offline.');
  } else {
    console.log('✓ REPLICATE_API_TOKEN found.');
  }
  
  if (!process.env.HF_TOKEN) {
    console.warn('⚠️  HF_TOKEN is missing. IDM-VTON and Nymbo will use free tier without ZeroGPU quota guarantees.');
  } else {
    console.log('✓ HF_TOKEN found.');
  }
  console.log('------------------------------');
}
validateEnvironment();

// Connect to database
connectDB();

const app = express();

// Enable CORS
app.use(cors());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Set up directory variables for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure local upload directory exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve public uploads statically
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Serve frontend demo folder statically (supports demo try-on URLs)
app.use('/demo', express.static(path.join(__dirname, '../frontend/public/demo')));

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/garments', garmentRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/generated-images', generatedImageRoutes);
app.use('/api/models', modelRoutes);

// Serve models folder statically for images
app.use('/models', express.static(path.join(__dirname, 'public/models')));

// Test Route
app.get('/', (req, res) => {
  res.json({ message: 'AI Fashion Studio API is active and running' });
});

// Health Route
app.get('/api/health', (req, res) => {
  res.json(tryOnManager.getHealthStatus());
});

// Dev error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running in development mode on port ${PORT}`);
  // Initialize AI Provider Health Checks
  await tryOnManager.initializeHealth();
});
// Trigger reload

