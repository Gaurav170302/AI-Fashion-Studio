import React, { useState } from 'react';
import { Download, Trash2, Eye, Calendar, User, Sliders, AlertTriangle } from 'lucide-react';

export default function HistoryGrid({ history, onDeleteItem, addToast }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterGender, setFilterGender] = useState('All');

  // Filter logic
  const filteredHistory = history.filter((item) => {
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    const matchesGender = filterGender === 'All' || item.modelType === filterGender;
    return matchesCategory && matchesGender;
  });

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Recent';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Filters header */}
      <div className="glassmorphism-card rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-heading font-bold text-xl text-white text-left">Generated Model History</h2>
          <p className="text-xs text-gray-400 mt-1">Review, download, or manage your previous fashion model try-ons.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl text-xs">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent border-none outline-none text-white font-semibold cursor-pointer"
            >
              <option value="All" className="bg-slate-900">All Categories</option>
              <option value="T-Shirt" className="bg-slate-900">T-Shirts</option>
              <option value="Shirt" className="bg-slate-900">Shirts</option>
              <option value="Hoodie" className="bg-slate-900">Hoodies</option>
              <option value="Dress" className="bg-slate-900">Dresses</option>
            </select>
          </div>

          {/* Gender Filter */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl text-xs">
            <User className="w-3.5 h-3.5 text-purple-400" />
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="bg-transparent border-none outline-none text-white font-semibold cursor-pointer"
            >
              <option value="All" className="bg-slate-900">All Genders</option>
              <option value="Male" className="bg-slate-900">Male</option>
              <option value="Female" className="bg-slate-900">Female</option>
            </select>
          </div>
        </div>
      </div>

      {/* History List/Grid */}
      {filteredHistory.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredHistory.map((item) => (
            <div 
              key={item.id} 
              className="glassmorphism-card rounded-2xl overflow-hidden group flex flex-col h-full border border-white/5 hover:border-purple-500/30 transition-all duration-300"
            >
              {/* Output Image Section */}
              <div className="relative aspect-[3/4] bg-slate-950 flex items-center justify-center overflow-hidden">
                <img 
                  src={item.generatedImageUrl} 
                  alt="AI Model Output" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Overlaid Garment Source Thumbnail */}
                <div className="absolute top-3 left-3 w-11 h-11 rounded-lg border border-white/10 bg-slate-900/90 backdrop-blur-sm p-0.5 shadow-md flex items-center justify-center" title="Original Garment">
                  <img src={item.garmentUrl} alt="Input Garment" className="w-full h-full object-contain rounded-md" />
                </div>

                {/* Quick Action Badges */}
                <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {item.category}
                  </span>
                  <span className="text-[10px] font-bold text-white bg-cyan-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {item.modelType}
                  </span>
                </div>

                {/* Hover Quick Actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setSelectedImage(item.generatedImageUrl)}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all transform translate-y-2 group-hover:translate-y-0 duration-300"
                    title="View Fullscreen"
                  >
                    <Eye className="w-4.5 h-4.5" />
                  </button>
                  <a
                    href={item.generatedImageUrl}
                    download={`ai-tryon-${item.id}.png`}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all transform translate-y-2 group-hover:translate-y-0 duration-300"
                    title="Download Image"
                    onClick={() => addToast('Downloading image...', 'success')}
                  >
                    <Download className="w-4.5 h-4.5" />
                  </a>
                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-2.5 rounded-full bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-400 hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0 duration-300"
                    title="Delete Generation"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              {/* Card Footer Detail */}
              <div className="p-4 flex flex-col gap-1 bg-white/2 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>{formatDate(item.createdAt)}</span>
                </div>
                <div className="text-[11px] text-gray-400 truncate text-left mt-1">
                  Style: <strong className="text-gray-300 font-semibold">{item.style}</strong> • Pose: <strong className="text-gray-300 font-semibold">{item.pose}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="glassmorphism-card rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-yellow-500/80 animate-pulse" />
          </div>
          <h3 className="font-heading font-semibold text-white text-lg">No Generations Found</h3>
          <p className="text-sm text-gray-400 mt-2 max-w-sm">
            {history.length === 0 
              ? "You haven't generated any AI fashion images yet. Head over to the Studio Workspace to create your first one!"
              : "No images match the selected filter criteria. Try adjusting your category or gender filter."}
          </p>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-2"
            onClick={() => setSelectedImage(null)}
          >
            Close
          </button>
          <img 
            src={selectedImage} 
            alt="AI Try-On Zoomed" 
            className="max-w-full max-h-[90vh] rounded-xl object-contain border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200"
          />
        </div>
      )}
    </div>
  );
}
