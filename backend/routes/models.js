import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/', (req, res) => {
  try {
    const modelsDir = path.join(__dirname, '../public/models');
    const categories = ['male', 'female', 'kids'];
    let allModels = [];

    categories.forEach(category => {
      const jsonPath = path.join(modelsDir, category, 'models.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          allModels = allModels.concat(data);
        } catch (err) {
          console.error(`Error reading ${jsonPath}:`, err);
        }
      }
    });

    res.json({ success: true, models: allModels });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ success: false, message: 'Server error fetching models' });
  }
});

export default router;
