import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import garmentRoutes from './routes/garments.js';
import generateRoutes from './routes/generate.js';
import generatedImageRoutes from './routes/generatedImages.js';
import modelRoutes from './routes/models.js';

// Load env vars
dotenv.config();

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

// Dev error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in development mode on port ${PORT}`);
});
// Trigger reload

