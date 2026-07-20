import React from 'react';
import { Shirt, LogOut, User, Sparkles, Wand2, Layers, Coins } from 'lucide-react';

export default function Header({ user, history = [], onLogout, onOpenAuth, activeTab, setActiveTab }) {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#0F172A]/90 backdrop-blur-md border-b border-white/5 py-3 px-6 md:px-12 flex justify-between items-center transition-all">
      {/* Logo */}
      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('studio')}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-gray-200 group-hover:bg-white/10 group-hover:text-white transition-all">
          <Shirt className="w-4 h-4" />
        </div>
        <span className="font-sans font-semibold text-base text-gray-100 tracking-tight">
          AI Fashion Studio
        </span>
      </div>

      {/* Navigation */}
      <nav className="hidden md:flex items-center gap-6">
        <button
          onClick={() => setActiveTab('studio')}
          className={`text-sm font-medium transition-colors ${
            activeTab === 'studio'
              ? 'text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Workspace
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          History
        </button>
      </nav>

      {/* Auth / Profile */}
      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-4">
            
            {/* Minimal Stats */}
            <div className="hidden lg:flex items-center gap-4 mr-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <Wand2 className="w-3.5 h-3.5" />
                <span>{history.length}</span>
              </div>
              <div className="w-[1px] h-3 bg-white/10"></div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <Coins className="w-3.5 h-3.5" />
                <span>25</span>
              </div>
            </div>

            {/* Minimal User Profile */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 text-xs font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-200">
                {user.name}
              </span>
            </div>

            {/* Subtle Logout */}
            <button
              onClick={onLogout}
              className="ml-1 p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={() => onOpenAuth('login')}
              className="text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-100 transition-colors"
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
