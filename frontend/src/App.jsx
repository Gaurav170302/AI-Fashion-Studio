import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import AuthModal from './components/AuthModal';
import StudioWorkspace from './components/StudioWorkspace';
import HistoryGrid from './components/HistoryGrid';
import Toast from './components/Toast';
import { api } from './services/api';
import { Sparkles, Shirt, Wand2, ShieldCheck, TrendingUp, Layers } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('studio');
  const [authModalState, setAuthModalState] = useState({ isOpen: false, mode: 'login' });
  const [history, setHistory] = useState([]);
  const [toasts, setToasts] = useState([]);

  // Load initial session and backend state
  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        setHistory([]);
        return;
      }
      try {
        const apiUser = await api.getMe();
        setUser(apiUser);
        localStorage.setItem('currentUser', JSON.stringify(apiUser));
        
        // Fetch history from DB
        const apiHistory = await api.getHistory();
        setHistory(apiHistory);
      } catch (err) {
        console.warn("No active backend session or failed to fetch history. Clearing token.");
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        setUser(null);
        setHistory([]);
      }
    };
    verifySession();
  }, []);

  const addToast = (message, type = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleOpenAuth = (mode = 'login') => {
    setAuthModalState({ isOpen: true, mode });
  };

  const handleCloseAuth = () => {
    setAuthModalState({ isOpen: false, mode: 'login' });
  };

  const handleAuthSuccess = async (userData) => {
    setUser(userData);
    try {
      const apiHistory = await api.getHistory();
      setHistory(apiHistory);
    } catch (err) {
      console.warn("Failed to sync backend history on login.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    setUser(null);
    setHistory([]);
    addToast('Logged out successfully', 'success');
  };

  const handleSaveGeneration = (newGeneration) => {
    const updatedHistory = [newGeneration, ...history];
    setHistory(updatedHistory);
  };

  const handleDeleteItem = async (id) => {
    try {
      await api.deleteImage(id);
      addToast('Generation deleted', 'success');
      const apiHistory = await api.getHistory();
      setHistory(apiHistory);
    } catch (err) {
      addToast(err.message || 'Failed to delete generation', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#070814] text-gray-100 flex flex-col selection:bg-purple-600/35 selection:text-white relative overflow-x-hidden">
      
      {/* Dynamic Glowing background mesh blobs */}
      <div className="absolute top-[-25%] left-[-15%] w-[80%] h-[80%] bg-gradient-to-tr from-purple-600/22 to-indigo-600/10 rounded-full blur-[170px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-30%] right-[-15%] w-[75%] h-[75%] bg-gradient-to-br from-cyan-500/22 to-blue-500/10 rounded-full blur-[150px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '-4s' }}></div>
      <div className="absolute top-[25%] right-[-25%] w-[65%] h-[65%] bg-gradient-to-l from-fuchsia-500/15 to-transparent rounded-full blur-[160px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '-2s' }}></div>
      <div className="absolute top-[15%] left-[20%] w-[50%] h-[50%] bg-indigo-600/15 rounded-full blur-[180px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '-6s' }}></div>

      {/* Subtle Premium Grid Overlay */}
      <div className="bg-grid-pattern"></div>

      {/* Header */}
      <Header 
        user={user} 
        history={history}
        onLogout={handleLogout} 
        onOpenAuth={handleOpenAuth} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8 md:py-12 z-10 flex flex-col gap-10">
        
        {/* Concise Value Proposition (Reduced Hero) */}
        {activeTab === 'studio' && (
          <div className="relative glassmorphism-card rounded-2xl p-6 overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 border border-white/5 bg-gradient-to-br from-slate-950 via-[var(--bg-main)] to-[#040509]">
            {/* Background sparkle */}
            <div className="absolute top-4 right-4 text-primary/20 w-32 h-32 animate-pulse pointer-events-none">
              <Sparkles className="w-full h-full" />
            </div>

            <div className="flex-1 flex flex-col gap-3 text-left">
              <h1 className="font-heading font-extrabold text-2xl md:text-3xl text-white tracking-tight leading-tight">
                AI Fashion Studio
              </h1>
              <p className="text-sm text-text-secondary max-w-xl">
                Create AI Fashion Models from Garments. Upload your design, choose a style, and generate high-fidelity photographs in seconds.
              </p>
            </div>
            
            <div className="shrink-0">
               <button onClick={() => { document.querySelector('.studio-scroll-target')?.scrollIntoView({ behavior: 'smooth' }); }} className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/40 px-5 py-2.5 rounded-xl text-sm font-bold transition-all">
                 Start Creating
               </button>
            </div>
          </div>
        )}

        {/* Tab Workspace Views */}
        <div className="studio-scroll-target">
          {activeTab === 'studio' ? (
            <StudioWorkspace 
              user={user} 
              onOpenAuth={handleOpenAuth} 
              onSaveGeneration={handleSaveGeneration} 
              addToast={addToast} 
            />
          ) : (
            <HistoryGrid 
              history={history} 
              onDeleteItem={handleDeleteItem} 
              addToast={addToast} 
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-6 border-t border-white/5 text-center mt-auto glassmorphism bg-black/40 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Shirt className="w-4 h-4 text-purple-500" />
            <span className="font-semibold text-gray-400">AI Fashion Studio</span>
            <span>© 2026. All rights reserved.</span>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-purple-400 transition">Terms of Service</a>
            <a href="#" className="hover:text-purple-400 transition">Privacy Policy</a>
            <a href="#" className="hover:text-purple-400 transition">API Documentation</a>
          </div>
        </div>
      </footer>

      {/* Auth Modals */}
      <AuthModal 
        isOpen={authModalState.isOpen} 
        onClose={handleCloseAuth} 
        initialMode={authModalState.mode} 
        onAuthSuccess={handleAuthSuccess}
        addToast={addToast}
      />

      {/* Toast Notifications Queue */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
        {toasts.map((toast) => (
          <Toast 
            key={toast.id} 
            message={toast.message} 
            type={toast.type} 
            onClose={() => removeToast(toast.id)} 
          />
        ))}
      </div>
    </div>
  );
}
