const API_BASE_URL = 'http://localhost:5000/api';

// Helper to get headers
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const api = {
  // Auth API
  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');
      
      localStorage.setItem('token', data.token);
      return data.user;
    } catch (error) {
      console.warn("API Login failed, falling back to LocalStorage simulation:", error.message);
      throw error;
    }
  },

  async register(name, email, password, role) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Registration failed');
      
      localStorage.setItem('token', data.token);
      return data.user;
    } catch (error) {
      console.warn("API Registration failed, falling back to LocalStorage simulation:", error.message);
      throw error;
    }
  },

  async getMe() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: getHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch user');
      return data.user;
    } catch (error) {
      console.warn("API Fetch profile failed:", error.message);
      throw error;
    }
  },

  // Models API
  async getModels() {
    try {
      const response = await fetch(`${API_BASE_URL}/models`, {
        method: 'GET'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch models');
      return data;
    } catch (error) {
      console.warn("API Fetch models failed:", error.message);
      return { male: [], female: [], kids: [] };
    }
  },

  // Garment upload
  async uploadGarment(file, category) {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('image', file);
      formData.append('category', category);

      const response = await fetch(`${API_BASE_URL}/garments/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Upload failed');
      return data.garment;
    } catch (error) {
      console.warn("API Garment upload failed:", error.message);
      throw error;
    }
  },

  // AI try-on generation
  async generateImage(garmentId, preferences) {
    try {
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ garmentId, ...preferences })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'AI Generation failed');
      return data;
    } catch (error) {
      console.warn("API Generation failed:", error.message);
      throw error;
    }
  },

  // Reset password (no email required)
  async resetPassword(email, newPassword) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Password reset failed');
      return data;
    } catch (error) {
      console.warn("API Reset password failed:", error.message);
      throw error;
    }
  },


  async getJobStatus(jobId) {
    try {
      const response = await fetch(`${API_BASE_URL}/generate/status/${jobId}`, {
        method: 'GET',
        headers: getHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch job status');
      return data.job;
    } catch (error) {
      console.warn("API Get job status failed:", error.message);
      throw error;
    }
  },

  // History API
  async getHistory() {
    try {
      const response = await fetch(`${API_BASE_URL}/generated-images`, {
        method: 'GET',
        headers: getHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch history');
      return data.history;
    } catch (error) {
      console.warn("API Get history failed:", error.message);
      throw error;
    }
  },

  async deleteImage(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/generated-images/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete image');
      return data;
    } catch (error) {
      console.warn("API Delete image failed:", error.message);
      throw error;
    }
  }
};
