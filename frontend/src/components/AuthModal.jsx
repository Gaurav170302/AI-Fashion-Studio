import React, { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Shield } from 'lucide-react';
import { api } from '../services/api';

export default function AuthModal({ isOpen, onClose, initialMode = 'login', onAuthSuccess, addToast }) {
  const [mode, setMode] = useState(initialMode); // 'login' or 'register'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'seller' // Default role
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!formData.name || !formData.email || !formData.password) {
          addToast('Please fill all fields', 'error');
          setLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          addToast('Passwords do not match', 'error');
          setLoading(false);
          return;
        }
      } else {
        if (!formData.email || !formData.password) {
          addToast('Please fill all fields', 'error');
          setLoading(false);
          return;
        }
      }

      if (mode === 'register') {
        try {
          const apiUser = await api.register(formData.name, formData.email, formData.password, formData.role);
          localStorage.setItem('currentUser', JSON.stringify(apiUser));
          onAuthSuccess(apiUser);
          addToast('Registered successfully!', 'success');
          onClose();
        } catch (apiErr) {
          addToast(apiErr.message || 'Registration failed', 'error');
        }
      } else {
        try {
          const apiUser = await api.login(formData.email, formData.password);
          localStorage.setItem('currentUser', JSON.stringify(apiUser));
          onAuthSuccess(apiUser);
          addToast('Logged in successfully!', 'success');
          onClose();
        } catch (apiErr) {
          addToast(apiErr.message || 'Invalid credentials', 'error');
        }
      }
    } catch (err) {
      addToast('An error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      {/* Modal Container */}
      <div className="relative w-full max-w-md glassmorphism-card rounded-2xl p-6 overflow-hidden md:p-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="font-heading font-bold text-2xl text-white">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {mode === 'login' ? 'Log in to access the AI Try-On Studio' : 'Start generating professional model shoots'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="seller@store.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm glass-input"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'seller' })}
                    className={`py-2 rounded-xl text-sm font-semibold border ${
                      formData.role === 'seller'
                        ? 'bg-purple-600/20 border-purple-500 text-white'
                        : 'border-white/5 bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    Seller
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'customer' })}
                    className={`py-2 rounded-xl text-sm font-semibold border ${
                      formData.role === 'customer'
                        ? 'bg-purple-600/20 border-purple-500 text-white'
                        : 'border-white/5 bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    Customer
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="glow-btn w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all duration-200 mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              mode === 'login' ? 'Log In' : 'Register'
            )}
          </button>
        </form>

        {/* Mode Toggle */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-400">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-purple-400 hover:text-purple-300 font-semibold ml-1 focus:outline-none"
            >
              {mode === 'login' ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>

        {/* Demo Credentials Alert for Easy Testing */}
        {mode === 'login' && (
          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/5 flex items-start gap-2.5 text-xs text-gray-400">
            <Shield className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-purple-300">Quick Test Credentials:</span>
              <br />
              Email: <code className="text-purple-200 select-all">demo@studio.com</code>
              <br />
              Password: <code className="text-purple-200 select-all">demo123</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
