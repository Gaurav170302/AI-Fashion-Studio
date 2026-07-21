import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Shield, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

// Modes: 'login' | 'register' | 'forgot'
export default function AuthModal({ isOpen, onClose, initialMode = 'login', onAuthSuccess, addToast }) {
  const [mode, setMode] = useState(initialMode);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    newPassword: '',
    confirmNewPassword: '',
    role: 'seller'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Sync mode + reset form whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setFormData({ name: '', email: '', password: '', confirmPassword: '', newPassword: '', confirmNewPassword: '', role: 'seller' });
      setShowPassword(false);
      setShowNewPassword(false);
      setResetDone(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const switchMode = (next) => {
    setMode(next);
    setFormData({ name: '', email: '', password: '', confirmPassword: '', newPassword: '', confirmNewPassword: '', role: 'seller' });
    setShowPassword(false);
    setShowNewPassword(false);
    setResetDone(false);
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      addToast('Please enter your email and password', 'error');
      return;
    }
    setLoading(true);
    try {
      const apiUser = await api.login(formData.email, formData.password);
      localStorage.setItem('currentUser', JSON.stringify(apiUser));
      onAuthSuccess(apiUser);
      addToast('Logged in successfully!', 'success');
      onClose();
    } catch (err) {
      addToast(err.message || 'Invalid email or password', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      addToast('Please fill all fields', 'error');
      return;
    }
    if (formData.password.length < 6) {
      addToast('Password must be at least 6 characters', 'error');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      addToast('Passwords do not match', 'error');
      return;
    }
    setLoading(true);
    try {
      const apiUser = await api.register(formData.name, formData.email, formData.password, formData.role);
      localStorage.setItem('currentUser', JSON.stringify(apiUser));
      onAuthSuccess(apiUser);
      addToast('Account created! Welcome 🎉', 'success');
      onClose();
    } catch (err) {
      addToast(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot / Reset Password ────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!formData.email) {
      addToast('Please enter your email address', 'error');
      return;
    }
    if (!formData.newPassword) {
      addToast('Please enter a new password', 'error');
      return;
    }
    if (formData.newPassword.length < 6) {
      addToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (formData.newPassword !== formData.confirmNewPassword) {
      addToast('Passwords do not match', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(formData.email, formData.newPassword);
      setResetDone(true);
      addToast('Password reset successfully!', 'success');
    } catch (err) {
      addToast(err.message || 'Password reset failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'login') handleLogin();
    else if (mode === 'register') handleRegister();
    else if (mode === 'forgot') handleResetPassword();
  };

  // ── Header copy ────────────────────────────────────────────────────────────
  const headers = {
    login:    { title: 'Welcome Back',    sub: 'Log in to your AI Fashion Studio account' },
    register: { title: 'Create Account', sub: 'Start generating professional model shoots' },
    forgot:   { title: 'Reset Password', sub: 'Enter your email and choose a new password' }
  };
  const { title, sub } = headers[mode];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="relative w-full max-w-md glassmorphism-card rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Glow blobs */}
        <div className="absolute -top-20 -left-20 w-44 h-44 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-6 md:p-8">

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Back arrow (forgot → login) */}
          {mode === 'forgot' && (
            <button
              onClick={() => switchMode('login')}
              className="absolute top-4 left-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}

          {/* Header */}
          <div className="text-center mb-6 mt-2">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-3">
              {mode === 'forgot'
                ? <KeyRound className="w-6 h-6 text-purple-400" />
                : mode === 'register'
                ? <User className="w-6 h-6 text-purple-400" />
                : <Shield className="w-6 h-6 text-purple-400" />
              }
            </div>
            <h2 className="font-heading font-bold text-2xl text-white">{title}</h2>
            <p className="text-sm text-gray-400 mt-1">{sub}</p>
          </div>

          {/* ── SUCCESS STATE (reset done) ── */}
          {mode === 'forgot' && resetDone ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <CheckCircle2 className="w-14 h-14 text-green-400" />
              <div>
                <p className="font-bold text-white text-lg">Password Reset!</p>
                <p className="text-sm text-gray-400 mt-1">
                  Your password has been updated. You can now log in with your new password.
                </p>
              </div>
              <button
                onClick={() => switchMode('login')}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all mt-2"
              >
                Go to Log In
              </button>
            </div>

          ) : (
            /* ── FORM ── */
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Full Name (register only) */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><User className="w-4 h-4" /></span>
                    <input
                      type="text" name="name" value={formData.name} onChange={handleChange}
                      placeholder="John Doe"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input"
                      required autoComplete="name"
                    />
                  </div>
                </div>
              )}

              {/* Email (all modes) */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><Mail className="w-4 h-4" /></span>
                  <input
                    type="email" name="email" value={formData.email} onChange={handleChange}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input"
                    required autoComplete="email"
                  />
                </div>
              </div>

              {/* Current Password (login + register) */}
              {(mode === 'login' || mode === 'register') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><Lock className="w-4 h-4" /></span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password" value={formData.password} onChange={handleChange}
                      placeholder="••••••••" minLength={6}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm glass-input"
                      required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password (register only) */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><Lock className="w-4 h-4" /></span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input"
                      required autoComplete="new-password"
                    />
                  </div>
                </div>
              )}

              {/* New Password (forgot mode) */}
              {mode === 'forgot' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">New Password</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><Lock className="w-4 h-4" /></span>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        name="newPassword" value={formData.newPassword} onChange={handleChange}
                        placeholder="Min. 6 characters" minLength={6}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm glass-input"
                        required autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white">
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Confirm New Password</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><Lock className="w-4 h-4" /></span>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        name="confirmNewPassword" value={formData.confirmNewPassword} onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input"
                        required autoComplete="new-password"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Role (register only) */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['seller', 'customer'].map(r => (
                      <button key={r} type="button" onClick={() => setFormData({ ...formData, role: r })}
                        className={`py-2 rounded-xl text-sm font-semibold border capitalize transition-all ${
                          formData.role === r
                            ? 'bg-purple-600/20 border-purple-500 text-white'
                            : 'border-white/5 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                        }`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Forgot password link (login mode only) */}
              {mode === 'login' && (
                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm transition-all duration-200 mt-2 flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : mode === 'login' ? 'Log In'
                  : mode === 'register' ? 'Create Account'
                  : 'Reset Password'}
              </button>
            </form>
          )}

          {/* Mode switcher footer */}
          {!resetDone && (
            <div className="text-center mt-5">
              {mode === 'login' && (
                <p className="text-sm text-gray-400">
                  Don't have an account?{' '}
                  <button onClick={() => switchMode('register')} className="text-purple-400 hover:text-purple-300 font-semibold">
                    Sign Up
                  </button>
                </p>
              )}
              {mode === 'register' && (
                <p className="text-sm text-gray-400">
                  Already have an account?{' '}
                  <button onClick={() => switchMode('login')} className="text-purple-400 hover:text-purple-300 font-semibold">
                    Log In
                  </button>
                </p>
              )}
              {mode === 'forgot' && (
                <p className="text-sm text-gray-400">
                  Remembered it?{' '}
                  <button onClick={() => switchMode('login')} className="text-purple-400 hover:text-purple-300 font-semibold">
                    Log In
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Quick credentials hint (login only) */}
          {mode === 'login' && !resetDone && (
            <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/5 flex items-start gap-2.5 text-xs text-gray-400">
              <Shield className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-purple-300">Don't have credentials?</span>
                <br />Use the <button onClick={() => switchMode('register')} className="text-purple-200 underline">Sign Up</button> tab to create a new account, or{' '}
                <button onClick={() => switchMode('forgot')} className="text-purple-200 underline">reset your password</button> if you forgot it.
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
