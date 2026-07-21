import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

import User from '../models/User.js';
import Garment from '../models/Garment.js';
import GeneratedImage from '../models/GeneratedImage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../db_data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const getFilePath = (modelName) => path.join(DATA_DIR, `${modelName.toLowerCase()}s.json`);

const readData = (modelName) => {
  const filePath = getFilePath(modelName);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return [];
  }
};

const writeData = (modelName, data) => {
  const filePath = getFilePath(modelName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

class MockQuery {
  constructor(promise) {
    this.promise = promise;
  }
  select() {
    return this;
  }
  populate() {
    this.promise = this.promise.then(async (result) => {
      if (!result) return result;
      const garments = readData('Garment');
      const populateItem = (item) => {
        if (item && item.garmentId) {
          const g = garments.find(g => g._id === item.garmentId.toString() || g._id === item.garmentId);
          if (g) {
            item.garmentId = g;
          }
        }
        return item;
      };
      if (Array.isArray(result)) {
        return result.map(populateItem);
      }
      return populateItem(result);
    });
    return this;
  }
  sort() {
    this.promise = this.promise.then((result) => {
      if (Array.isArray(result)) {
        return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return result;
    });
    return this;
  }
  then(onFulfilled, onRejected) {
    return this.promise.then(onFulfilled, onRejected);
  }
  catch(onRejected) {
    return this.promise.catch(onRejected);
  }
}

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ai_fashion_studio');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.warn("MongoDB is offline or not installed. Activating file-based local database fallback (db_data/).");
    
    // Override Mongoose models with filesystem mock models
    setupMockModels();
  }
};

const setupMockModels = () => {
  // Mock User
  User.findOne = function (query) {
    return new MockQuery(Promise.resolve().then(() => {
      const users = readData('User');
      const found = users.find(u => u.email === query.email);
      if (found) {
        const doc = { ...found };
        doc.matchPassword = async function (enteredPassword) {
          return await bcrypt.compare(enteredPassword, this.password);
        };
        return doc;
      }
      return null;
    }));
  };

  User.create = function (data) {
    return Promise.resolve().then(async () => {
      const users = readData('User');
      if (users.find(u => u.email === data.email)) {
        throw new Error('User already exists');
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.password, salt);
      const newUser = {
        _id: 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role || 'seller',
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      writeData('User', users);
      
      const doc = { ...newUser };
      doc.matchPassword = async function (enteredPassword) {
        return await bcrypt.compare(enteredPassword, this.password);
      };
      return doc;
    });
  };

  User.findById = function (id) {
    return new MockQuery(Promise.resolve().then(() => {
      const users = readData('User');
      const found = users.find(u => u._id === id.toString() || u._id === id);
      return found || null;
    }));
  };

  User.updatePassword = async function (email, hashedPassword) {
    const users = readData('User');
    const idx = users.findIndex(u => u.email === email.toLowerCase().trim());
    if (idx === -1) return false;
    users[idx].password = hashedPassword;
    writeData('User', users);
    return true;
  };

  User.findOneAndUpdate = function (query, update) {
    return Promise.resolve().then(async () => {
      const users = readData('User');
      const idx = users.findIndex(u => u.email === (query.email || '').toLowerCase().trim());
      if (idx === -1) return null;
      if (update.password) users[idx].password = update.password;
      writeData('User', users);
      return users[idx];
    });
  };


  // Mock Garment
  Garment.create = function (data) {
    return Promise.resolve().then(() => {
      const garments = readData('Garment');
      const newGarment = {
        _id: 'g_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        userId: data.userId,
        imageUrl: data.imageUrl,
        category: data.category,
        createdAt: new Date().toISOString()
      };
      garments.push(newGarment);
      writeData('Garment', garments);
      return newGarment;
    });
  };

  Garment.findById = function (id) {
    return new MockQuery(Promise.resolve().then(() => {
      const garments = readData('Garment');
      const found = garments.find(g => g._id === id.toString() || g._id === id);
      return found || null;
    }));
  };

  Garment.find = function (query) {
    return new MockQuery(Promise.resolve().then(() => {
      const garments = readData('Garment');
      const userIdStr = query.userId ? query.userId.toString() : '';
      return garments.filter(g => g.userId.toString() === userIdStr);
    }));
  };

  // Mock GeneratedImage
  GeneratedImage.create = function (data) {
    return Promise.resolve().then(() => {
      const images = readData('GeneratedImage');
      const newImage = {
        _id: 'i_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        userId: data.userId,
        garmentId: data.garmentId,
        generatedImageUrl: data.generatedImageUrl,
        modelType: data.modelType,
        style: data.style,
        pose: data.pose,
        createdAt: new Date().toISOString()
      };
      images.push(newImage);
      writeData('GeneratedImage', images);
      return newImage;
    });
  };

  GeneratedImage.find = function (query) {
    return new MockQuery(Promise.resolve().then(() => {
      const images = readData('GeneratedImage');
      const userIdStr = query.userId ? query.userId.toString() : '';
      return images.filter(img => img.userId.toString() === userIdStr);
    }));
  };

  GeneratedImage.findById = function (id) {
    return new MockQuery(Promise.resolve().then(() => {
      const images = readData('GeneratedImage');
      const found = images.find(img => img._id === id.toString() || img._id === id);
      if (found) {
        const doc = { ...found };
        doc.deleteOne = async function () {
          const updated = images.filter(img => img._id !== found._id);
          writeData('GeneratedImage', updated);
        };
        return doc;
      }
      return null;
    }));
  };
};
