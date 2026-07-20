import React from 'react';
import { Shirt, LogOut, User, Sparkles, Wand2, Layers, Coins } from 'lucide-react';

export default function Header({ user, history = [], onLogout, onOpenAuth, activeTab, setActiveTab }) {
  return (
    <header className="sticky top-0 z-50 w-full glassmorphism border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center">
      {/* Logo */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('studio')}>
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 text-primary glow-btn">
          <Shirt className="w-6 h-6 animate-pulse" />
          <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-secondary" />
        </div>
        <span className="font-heading font-bold text-xl md:text-2xl bg-gradient-to-r from-white via-indigo-300 to-cyan-400 bg-clip-text text-transparent tracking-tight">
          AI Fashion Studio
        </span>
      </div>

      {/* Navigation */}
      <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5">
        <button
          onClick={() => setActiveTab('studio')}
          className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
            activeTab === 'studio'
              ? 'bg-primary text-white shadow-md shadow-primary/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Studio Workspace
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
            activeTab === 'history'
              ? 'bg-primary text-white shadow-md shadow-primary/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Generation History
        </button>
      </nav>

      {/* Auth / Profile & Stats */}
      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-4">
            
            {/* Stats (Hidden on mobile) */}
            <div className="hidden lg:flex items-center gap-3 mr-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10">
                <Wand2 className="w-3.5 h-3.5 text-primary" />
                <span>{history.length} Gens</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10">
                <Layers className="w-3.5 h-3.5 text-secondary" />
                <span className="capitalize">{user.role || 'Seller'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10">
                <Coins className="w-3.5 h-3.5 text-yellow-400" />
                <span>25 Credits</span>
              </div>
            </div>

            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-white">{user.name}</span>
            </div>
            
            {/* User Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-secondary p-[1px]">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="p-2 rounded-lg bg-white/5 border border-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-200"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenAuth('login')}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-200"
            >
              Log In
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="glow-btn px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover border border-primary/30 transition-all duration-200"
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
