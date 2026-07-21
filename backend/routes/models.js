import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const EXCLUDED_FILES = ['models.json', 'thumbs.db', '.ds_store'];


const formatName = (filename) => {
  const nameWithoutExt = path.parse(filename).name;
  return nameWithoutExt
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getPose = (filename) => {
  const lower = filename.toLowerCase();
  if (lower.includes('standing')) return 'standing';
  if (lower.includes('walking')) return 'walking';
  if (lower.includes('sitting')) return 'sitting';
  return 'standing'; // default
};

router.get('/', (req, res) => {
  try {
    const modelsDir = path.join(__dirname, '../public/models');
    const categories = ['male', 'female', 'kids'];
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    const result = {
      male: [],
      female: [],
      kids: []
    };

    categories.forEach(category => {
      const categoryDir = path.join(modelsDir, category);
      if (fs.existsSync(categoryDir)) {
        try {
          const files = fs.readdirSync(categoryDir);
          files.forEach(file => {
            const ext = path.extname(file).toLowerCase();
            const lower = file.toLowerCase();
            if (validExtensions.includes(ext) && !EXCLUDED_FILES.includes(lower)) {

              const id = path.parse(file).name;
              result[category].push({
                id: id,
                name: formatName(file),
                pose: getPose(file),
                gender: category,
                imageUrl: `${baseUrl}/models/${category}/${file}`
              });
            }
          });
        } catch (err) {
          console.error(`Error reading directory ${categoryDir}:`, err);
        }
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ success: false, message: 'Server error fetching models' });
  }
});

export default router;
