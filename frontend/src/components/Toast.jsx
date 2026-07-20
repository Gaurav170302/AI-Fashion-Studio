import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const typeConfig = {
    success: {
      bg: 'bg-green-950/80 border-green-500/30 text-green-200',
      icon: <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
    },
    error: {
      bg: 'bg-red-950/80 border-red-500/30 text-red-200',
      icon: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
    },
    info: {
      bg: 'bg-purple-950/80 border-purple-500/30 text-purple-200',
      icon: <Info className="w-5 h-5 text-purple-400 shrink-0" />
    }
  };

  const { bg, icon } = typeConfig[type] || typeConfig.info;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg animate-in slide-in-from-top-4 duration-300 ${bg}`}>
      {icon}
      <span className="text-sm font-medium">{message}</span>
      <button 
        onClick={onClose} 
        className="ml-auto p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
