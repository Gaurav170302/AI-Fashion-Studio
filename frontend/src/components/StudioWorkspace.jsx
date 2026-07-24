import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Sparkles, Download, RefreshCw, CheckCircle, Wand2,
  Camera, AlertCircle, Share2, ArrowUpCircle, Settings, X,
  ShoppingBag, User, Zap, ImageIcon
} from 'lucide-react';
import { api } from '../services/api';

// ── Garment categories for commercial fashion ──────────────────────────────────
const GARMENT_CATEGORIES = [
  'T-Shirt', 'Shirt', 'Hoodie', 'Dress',
  'Jacket', 'Kurta', 'Blazer', 'Pants'
];

export default function StudioWorkspace({ user, onOpenAuth, onSaveGeneration, addToast }) {
  // Workflow mode
  const [featureMode, setFeatureMode] = useState('virtual-tryon'); // 'product-to-model' | 'virtual-tryon'

  // Library models
  const [libraryModels, setLibraryModels] = useState({ male: [], female: [], kids: [] });
  const [modelTab, setModelTab] = useState('male'); // male | female | kids | custom
  const [selectedLibraryModel, setSelectedLibraryModel] = useState(null);

  // Garment
  const [uploadFile, setUploadFile] = useState(null);
  const [garmentPreviewUrl, setGarmentPreviewUrl] = useState(null);
  const [garmentUploadedId, setGarmentUploadedId] = useState(null); // DB ID after upload
  const [category, setCategory] = useState('T-Shirt');

  // Custom person model
  const [personFile, setPersonFile] = useState(null);
  const [personPreview, setPersonPreview] = useState(null);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('idle');
  const [generatedResult, setGeneratedResult] = useState(null);
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [generationError, setGenerationError] = useState('');
  const [qualityMode, setQualityMode] = useState('Standard');
  const [currentJobId, setCurrentJobId] = useState(null);

  const fileInputRef = useRef(null);
  const personInputRef = useRef(null);
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  // Load model library on mount
  useEffect(() => {
    api.getModels().then(data => {
      setLibraryModels(data);
      // Auto-select first male model
      if (data?.male?.length > 0) {
        setSelectedLibraryModel(data.male[0].id);
      }
    }).catch(() => {
      addToast('Could not load model library', 'error');
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopElapsedTimer();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startElapsedTimer = () => {
    setElapsedSecs(0);
    timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
  };

  const stopElapsedTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const fmtTime = (s) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

  // ── Garment upload ───────────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Please upload a PNG or JPG image', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setGarmentPreviewUrl(reader.result);
      setUploadFile(file);
      setGarmentUploadedId(null);
      setGeneratedResult(null);
      setImgLoaded(false);
      setGenerationStatus('idle');
      setGenerationError('');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload({ target: { files: [file] } });
  };

  const clearGarment = () => {
    setGarmentPreviewUrl(null);
    setUploadFile(null);
    setGarmentUploadedId(null);
    setGeneratedResult(null);
    setGenerationStatus('idle');
    setGenerationError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Custom person upload ─────────────────────────────────────────────────────
  const handlePersonUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Please upload a PNG or JPG image', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPersonPreview(reader.result);
      setPersonFile(file);
      addToast('✓ Custom model photo uploaded', 'success');
    };
    reader.readAsDataURL(file);
  };

  const clearPerson = () => {
    setPersonPreview(null);
    setPersonFile(null);
    if (personInputRef.current) personInputRef.current.value = '';
  };

  // ── Get the currently selected model URL (for sending to backend) ────────────
  const getSelectedModelUrl = () => {
    if (modelTab === 'custom') return null;
    const allModels = [
      ...(libraryModels.male || []),
      ...(libraryModels.female || []),
      ...(libraryModels.kids || [])
    ];
    const model = allModels.find(m => m.id === selectedLibraryModel);
    return model?.imageUrl || null;
  };

  // ── Validate before generation ───────────────────────────────────────────────
  const validateInputs = () => {
    if (!garmentPreviewUrl && !uploadFile) {
      addToast('Please upload a garment image first', 'error');
      return false;
    }
    if (modelTab === 'custom' && !personFile) {
      addToast('Please upload a custom model photo first', 'error');
      return false;
    }
    if (modelTab !== 'custom' && !selectedLibraryModel) {
      addToast('Please select a model from the library', 'error');
      return false;
    }
    return true;
  };

  // ── Main generation handler ──────────────────────────────────────────────────
  const handleGenerate = async (overrideQuality) => {
    if (!user) {
      addToast('Please log in to generate try-on images', 'info');
      onOpenAuth('login');
      return;
    }
    if (!validateInputs()) return;

    const activeQuality = overrideQuality || qualityMode;

    setGenerating(true);
    setGenerationStatus('uploading');
    setGeneratedResult(null);
    setLoadingPercent(5);
    setLoadingMsg('Uploading garment...');
    setImgLoaded(false);
    setImgError(false);
    setGenerationError('');
    startElapsedTimer();

    try {
      // Upload garment if not already done
      let garmentIdOrUrl = garmentUploadedId;
      if (!garmentIdOrUrl && uploadFile) {
        setLoadingMsg('Uploading garment to server...');
        const uploaded = await api.uploadGarment(uploadFile, category);
        setGarmentUploadedId(uploaded._id);
        garmentIdOrUrl = uploaded._id;
      }
      if (!garmentIdOrUrl) {
        throw new Error('No garment found. Please re-upload.');
      }

      setLoadingPercent(15);

      // Resolve person
      let personImageId = null;
      let staticModelUrl = null;

      if (modelTab === 'custom' && personFile) {
        setLoadingMsg('Uploading custom model photo...');
        const uploadedPerson = await api.uploadGarment(personFile, 'Person');
        personImageId = uploadedPerson._id;
        setLoadingPercent(25);
      } else {
        staticModelUrl = getSelectedModelUrl();
        if (!staticModelUrl) {
          throw new Error('No model selected. Please select a model from the library.');
        }
        setLoadingPercent(20);
      }

      setGenerationStatus('generating');
      setLoadingMsg('Submitting to AI try-on engine...');

      const response = await api.generateImage(garmentIdOrUrl, {
        modelType: modelTab,
        style: 'Casual',
        pose: 'Standing',
        category,
        personImageId,
        staticModelUrl,
        qualityMode: activeQuality,
        featureMode,
        garmentName: uploadFile?.name || ''
      });

      if (!response.jobId) throw new Error('Server did not return a job ID');

      const jobId = response.jobId;
      setCurrentJobId(jobId);
      setLoadingPercent(30);
      setLoadingMsg('AI is processing your try-on...');

      // Poll for result
      pollRef.current = setInterval(async () => {
        try {
          const job = await api.getJobStatus(jobId);
          if (job.message) setLoadingMsg(job.message);

          if (job.status === 'completed') {
            clearInterval(pollRef.current);
            stopElapsedTimer();
            setLoadingPercent(100);
            setLoadingMsg('Done!');
            setGenerationStatus('done');

            const isFallback = !!job.isPollinationsFallback;

            const newGeneration = {
              id: job.dbRecordId || jobId,
              garmentUrl: garmentPreviewUrl,
              generatedImageUrl: job.resultUrl,
              category,
              modelType: modelTab,
              featureMode,
              isPollinationsFallback: isFallback,
              providerUsed: job.providerUsed || 'Unknown',
              createdAt: job.createdAt || new Date().toISOString()
            };

            setGeneratedResult(newGeneration);
            onSaveGeneration(newGeneration);

            if (isFallback) {
              addToast('⚠ Fallback used — your selected model was not preserved. Try again for better results.', 'error');
            } else {
              addToast(`✨ Fashion photo generated via ${job.providerUsed || 'AI engine'}!`, 'success');
            }
            setGenerating(false);

          } else if (job.status === 'failed') {
            clearInterval(pollRef.current);
            throw new Error(job.error || job.message || 'Generation failed');
          } else {
            // Still processing — animate progress bar
            setLoadingPercent(p => Math.min(p + (Math.random() * 4 + 1), 93));
          }
        } catch (pollErr) {
          clearInterval(pollRef.current);
          stopElapsedTimer();
          setGenerationError(pollErr.message);
          addToast(pollErr.message, 'error');
          setGenerationStatus('error');
          setGenerating(false);
        }
      }, 2500);

    } catch (err) {
      stopElapsedTimer();
      const errMsg = err.message || 'Generation failed. Please try again.';
      setGenerationError(errMsg);
      addToast(errMsg, 'error');
      setGenerationStatus('error');
      setGenerating(false);
    }
  };

  // ── Enhance Quality (re-generate with Premium) ───────────────────────────────
  const handleEnhanceQuality = () => {
    if (!generatedResult) return;
    setQualityMode('Premium');
    addToast('Re-generating with Premium quality (steps: 50, guidance: 4.0)...', 'info');
    handleGenerate('Premium');
  };

  // ── Reset ───────────────────────────────────────────────────────────────────
  const handleReset = () => {
    clearGarment();
    clearPerson();
    setGeneratedResult(null);
    setGenerationStatus('idle');
    setGenerationError('');
    setLoadingPercent(0);
    setImgLoaded(false);
    setImgError(false);
    setElapsedSecs(0);
    setCurrentJobId(null);
    stopElapsedTimer();
    if (pollRef.current) clearInterval(pollRef.current);
  };

  // ── Derived values ───────────────────────────────────────────────────────────
  const currentModels = libraryModels[modelTab] || [];
  const hasGarment = !!garmentPreviewUrl;
  const selectedModelObj = (() => {
    const all = [...(libraryModels.male || []), ...(libraryModels.female || []), ...(libraryModels.kids || [])];
    return all.find(m => m.id === selectedLibraryModel);
  })();

  return (
    <div className="flex flex-col gap-6">

      {/* ─── Feature Mode Tabs ──────────────────────────────────────────────── */}
      <div className="glassmorphism-card rounded-2xl p-2 flex gap-2 border border-white/5">
        <button
          onClick={() => setFeatureMode('virtual-tryon')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
            featureMode === 'virtual-tryon'
              ? 'bg-primary text-white shadow-lg shadow-primary/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          id="tab-virtual-tryon"
        >
          <User className="w-4 h-4" />
          Virtual Try-On
        </button>
        <button
          onClick={() => setFeatureMode('product-to-model')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
            featureMode === 'product-to-model'
              ? 'bg-primary text-white shadow-lg shadow-primary/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          id="tab-product-to-model"
        >
          <ShoppingBag className="w-4 h-4" />
          Product to Model
        </button>
      </div>

      {/* ─── Feature Description ─────────────────────────────────────────────── */}
      <div className={`text-xs px-4 py-2.5 rounded-xl border ${
        featureMode === 'virtual-tryon'
          ? 'bg-purple-500/5 border-purple-500/20 text-purple-300'
          : 'bg-cyan-500/5 border-cyan-500/20 text-cyan-300'
      }`}>
        {featureMode === 'virtual-tryon'
          ? '✦ Virtual Try-On — Place any garment on your chosen model. Preserves model identity, face, pose, and body.'
          : '✦ Product to Model — Generate a professional ecommerce photo with your garment on the selected model.'}
      </div>

      {/* ─── Main 2-Column Layout ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">

        {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Step 1: Garment Upload */}
          <div className="glassmorphism-card rounded-2xl p-5 flex flex-col gap-4 border border-white/5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
                <span className="font-heading font-semibold text-base text-white">Upload Garment</span>
              </div>
              {hasGarment && (
                <button
                  onClick={clearGarment}
                  className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 transition-colors"
                  id="btn-clear-garment"
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Drop Zone */}
            <div
              id="garment-dropzone"
              onClick={() => !hasGarment && fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              className={`border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center cursor-pointer select-none ${
                hasGarment
                  ? 'border-primary/40 bg-primary/5 p-3'
                  : 'border-white/10 hover:border-primary/50 hover:bg-white/5 p-8'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                id="input-garment-file"
              />

              {hasGarment ? (
                <div className="flex items-center gap-4 w-full" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-20 h-24 rounded-xl overflow-hidden border border-white/10 bg-slate-900 shrink-0">
                    <img src={garmentPreviewUrl} alt="Garment" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col gap-1.5 text-left min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Ready
                    </div>
                    <p className="text-sm font-bold text-white truncate">{uploadFile?.name || 'Garment uploaded'}</p>
                    <p className="text-[10px] text-gray-400">Click to change</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Drop garment image here</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP · Up to 10MB</p>
                  </div>
                  <p className="text-[10px] text-gray-500 max-w-xs">
                    Use a clear front-facing photo of the garment on a flat surface, hanger, or mannequin for best results.
                  </p>
                </div>
              )}
            </div>

            {/* Category Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Garment Type</label>
              <div className="grid grid-cols-4 gap-1.5">
                {GARMENT_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    id={`btn-category-${cat.toLowerCase()}`}
                    className={`py-2 text-[11px] font-semibold rounded-lg border transition-all ${
                      category === cat
                        ? 'bg-primary border-primary text-white shadow-md shadow-primary/20'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 2: Model Selection */}
          <div className="glassmorphism-card rounded-2xl p-5 flex flex-col gap-4 border border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
              <span className="font-heading font-semibold text-base text-white">Choose Model</span>
            </div>

            {/* Model Category Tabs */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
              {['male', 'female', 'kids', 'custom'].map(tab => (
                <button
                  key={tab}
                  id={`btn-model-tab-${tab}`}
                  onClick={() => {
                    setModelTab(tab);
                    // Auto-select first model when switching tabs
                    if (tab !== 'custom') {
                      const models = libraryModels[tab] || [];
                      if (models.length > 0) setSelectedLibraryModel(models[0].id);
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${
                    modelTab === tab
                      ? 'bg-primary text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab === 'custom' ? '+ Upload' : tab}
                </button>
              ))}
            </div>

            {/* Custom Upload */}
            {modelTab === 'custom' ? (
              <div className="flex flex-col gap-3">
                {/* Warning banner */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                  <span className="font-bold">⚠ Photo Requirements:</span> Upload a full-body or upper-body photo with visible shoulders and arms. Avoid side profiles, group photos, or heavily cropped images.
                </div>

                <div
                  id="custom-model-dropzone"
                  onClick={() => !personPreview && personInputRef.current?.click()}
                  className={`border border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center cursor-pointer select-none ${
                    personPreview
                      ? 'border-primary/40 bg-primary/5 p-3'
                      : 'border-white/10 hover:border-primary/50 hover:bg-white/5 py-6 px-3'
                  }`}
                >
                  <input
                    type="file"
                    ref={personInputRef}
                    onChange={handlePersonUpload}
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    id="input-person-file"
                  />

                  {personPreview ? (
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-18 rounded-lg overflow-hidden border border-white/10 shrink-0" style={{ height: '4.5rem' }}>
                          <img src={personPreview} alt="Custom model" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-white">Custom Model</span>
                          <span className="text-[10px] text-emerald-400 font-semibold">✓ Ready</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); clearPerson(); }}
                        id="btn-clear-person"
                        className="text-gray-400 hover:text-red-400 p-1.5 transition-colors"
                        aria-label="Remove custom model"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Camera className="w-6 h-6 text-primary" />
                      <p className="text-xs font-bold text-white">Upload Model Photo</p>
                      <p className="text-[10px] text-gray-400">PNG / JPG / WEBP</p>
                    </div>
                  )}
                </div>
              </div>

            ) : (
              /* Library Model Grid */
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                {currentModels.length === 0 ? (
                  <div className="col-span-3 flex flex-col items-center justify-center py-8 text-center">
                    <ImageIcon className="w-8 h-8 text-gray-600 mb-2" />
                    <p className="text-xs text-gray-500">No {modelTab} models found</p>
                    <p className="text-[10px] text-gray-600 mt-1">Add images to public/models/{modelTab}/</p>
                  </div>
                ) : (
                  currentModels.map(model => {
                    const isSelected = selectedLibraryModel === model.id;
                    return (
                      <button
                        key={model.id}
                        id={`btn-model-${model.id}`}
                        onClick={() => setSelectedLibraryModel(model.id)}
                        className={`relative rounded-xl overflow-hidden transition-all duration-200 flex flex-col bg-slate-900 group ${
                          isSelected
                            ? 'ring-2 ring-purple-500 shadow-lg shadow-purple-500/30'
                            : 'ring-1 ring-white/5 hover:ring-white/20'
                        }`}
                        aria-pressed={isSelected}
                        aria-label={`Select ${model.name}`}
                      >
                        <div className="w-full aspect-[3/4] relative overflow-hidden">
                          <img
                            src={model.imageUrl}
                            className={`w-full h-full object-cover transition-all duration-300 ${
                              isSelected ? 'opacity-100' : 'opacity-75 group-hover:opacity-95'
                            }`}
                            alt={model.name}
                            loading="lazy"
                          />
                          {/* Selected overlay glow */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-purple-500/10 pointer-events-none" />
                          )}
                        </div>

                        {/* Info bar */}
                        <div className="p-2 flex flex-col items-start w-full bg-slate-900/95">
                          <span className="text-[11px] font-bold text-white leading-tight">{model.name}</span>
                          <span className="text-[9px] text-gray-400 uppercase tracking-wide mt-0.5">
                            {model.pose}
                          </span>
                        </div>

                        {/* Checkmark badge */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 border-2 border-white/20 flex items-center justify-center shadow-lg">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Step 3: Quality + Generate */}
          <div className="flex flex-col gap-3">
            {/* Quality Mode */}
            <div className="glassmorphism-card rounded-2xl p-4 flex flex-col gap-3 border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-primary" />
                  Quality Mode
                </span>
                {qualityMode === 'Premium' && (
                  <span className="text-[9px] text-primary font-bold uppercase tracking-wide bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                    steps: 50 · guidance: 4.0
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-xl">
                {[
                  { id: 'Fast', label: 'Fast', sub: '~30s' },
                  { id: 'Standard', label: 'Standard', sub: '~60s' },
                  { id: 'Premium', label: 'Premium', sub: '~90s' }
                ].map(qm => (
                  <button
                    key={qm.id}
                    id={`btn-quality-${qm.id.toLowerCase()}`}
                    onClick={() => setQualityMode(qm.id)}
                    className={`py-2 flex flex-col items-center rounded-lg transition-all ${
                      qualityMode === qm.id
                        ? 'bg-primary text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-[11px] font-bold">{qm.label}</span>
                    <span className="text-[9px] opacity-70">{qm.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              id="btn-generate"
              onClick={() => handleGenerate()}
              disabled={generating}
              className={`relative overflow-hidden h-14 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2.5 transition-all duration-300 shadow-xl ${
                generating
                  ? 'bg-primary/50 cursor-not-allowed border border-primary/20'
                  : 'bg-gradient-to-r from-violet-600 to-purple-500 hover:brightness-110 border border-white/10 hover:scale-[1.02] active:scale-[0.99] shadow-primary/30'
              }`}
            >
              {generating ? (
                <>
                  <Sparkles className="w-5 h-5 text-cyan-300 animate-spin" />
                  <span>Generating... ({fmtTime(elapsedSecs)})</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 text-white" />
                  <span>
                    {featureMode === 'product-to-model'
                      ? 'Generate Product Photo'
                      : 'Generate Try-On'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── RIGHT PANEL: Output ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 min-h-[600px]">

          {/* Progress Steps Indicator */}
          <div className="glassmorphism-card rounded-xl p-3 flex justify-between items-center text-xs font-semibold border border-white/5">
            {[
              { label: 'Upload', active: ['uploading', 'generating', 'done'].includes(generationStatus) },
              { label: 'Configure', active: ['generating', 'done'].includes(generationStatus) },
              { label: 'Generate', active: generationStatus === 'done' }
            ].map((step, i) => (
              <React.Fragment key={step.label}>
                <div className={`flex items-center gap-1.5 ${step.active ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {step.active
                    ? <CheckCircle className="w-3.5 h-3.5" />
                    : generationStatus === (i === 0 ? 'uploading' : i === 1 ? 'generating' : '')
                      ? <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                      : <div className="w-2 h-2 rounded-full border border-gray-600" />
                  }
                  {step.label}
                </div>
                {i < 2 && <div className="flex-1 h-px bg-white/5 mx-2" />}
              </React.Fragment>
            ))}
          </div>

          {/* Main Output Card */}
          <div className="glassmorphism-card rounded-2xl flex-1 flex flex-col overflow-hidden border border-white/5 min-h-[540px]">
            <div className="relative flex-1 flex items-center justify-center p-6">

              {/* Error State */}
              {generationStatus === 'error' ? (
                <div className="flex flex-col items-center text-center max-w-sm">
                  <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                    <AlertCircle className="w-7 h-7 text-red-400" />
                  </div>
                  <h3 className="font-heading font-bold text-white text-lg">Unable to generate try-on result.</h3>
                  <p className="text-sm text-gray-400 mt-2 leading-relaxed">{generationError || 'The virtual try-on engine could not process this combination.'}</p>
                  <div className="flex items-center gap-3 mt-6">
                    <button
                      id="btn-try-again"
                      onClick={handleReset}
                      className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl text-sm font-bold transition"
                    >
                      Try Again
                    </button>
                    <button
                      id="btn-choose-model"
                      onClick={() => { setGenerationStatus('idle'); setModelTab('custom'); }}
                      className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-2.5 rounded-xl text-sm font-bold transition"
                    >
                      Change Model
                    </button>
                  </div>
                </div>

              ) : generating ? (
                /* Loading State */
                <div className="flex flex-col items-center w-full max-w-sm gap-5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-primary/60" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-heading font-bold text-white text-base">{loadingMsg}</p>
                    <p className="text-xs text-gray-400 mt-1">Time elapsed: {fmtTime(elapsedSecs)}</p>
                  </div>
                  <div className="w-full">
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 via-purple-400 to-cyan-400 rounded-full transition-all duration-1000"
                        style={{ width: `${loadingPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px] text-gray-500">
                      <span>Processing</span>
                      <span>{Math.round(loadingPercent)}%</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 text-center">
                    IDM-VTON models typically take 30–90 seconds.<br/>
                    Please keep this tab open.
                  </p>
                </div>

              ) : generatedResult ? (
                /* Result State */
                <div className="flex flex-col w-full h-full justify-between gap-4">

                  {/* Pollinations Fallback Warning Banner */}
                  {generatedResult.isPollinationsFallback && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-amber-300">Fallback result — your selected model was not preserved</p>
                        <p className="text-[11px] text-amber-200/70 mt-0.5">
                          Replicate and IDM-VTON were unavailable. This image was generated by Pollinations (a generic AI) and does not match your selected model. Try again in a few minutes when the real engines come back online.
                        </p>
                      </div>
                      <button
                        onClick={handleReset}
                        className="text-[10px] font-bold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-2.5 py-1.5 rounded-lg shrink-0 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-6 items-start justify-center">

                    {/* Garment reference */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Garment Used</span>
                      <div className="w-28 h-36 md:w-36 md:h-48 rounded-xl bg-slate-900 border border-white/10 overflow-hidden shadow-lg">
                        <img
                          src={generatedResult.garmentUrl}
                          alt="Garment"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    <div className="w-px h-16 bg-white/10 hidden md:block self-center" />

                    {/* Generated result */}
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Final Fashion Photo</span>
                        {generatedResult.providerUsed && !generatedResult.isPollinationsFallback && (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                            via {generatedResult.providerUsed}
                          </span>
                        )}
                        {generatedResult.isPollinationsFallback && (
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                            ⚠ Fallback
                          </span>
                        )}
                      </div>
                      <div
                        className={`relative w-full max-w-sm rounded-xl bg-slate-900 overflow-hidden shadow-2xl ${
                          generatedResult.isPollinationsFallback
                            ? 'border border-amber-500/30 shadow-amber-500/10'
                            : 'border border-primary/30 shadow-primary/20'
                        }`}
                        style={{ aspectRatio: '2/3', maxHeight: '480px' }}
                      >
                        {!imgLoaded && !imgError && (
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 animate-pulse" />
                        )}
                        {imgError ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                            <AlertCircle className="w-8 h-8 text-red-400" />
                            <p className="text-xs text-gray-400">Image failed to load</p>
                          </div>
                        ) : (
                          <img
                            src={generatedResult.generatedImageUrl}
                            alt="AI Generated Fashion Result"
                            className={`w-full h-full object-cover transition-opacity duration-700 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                            onLoad={() => setImgLoaded(true)}
                            onError={() => setImgError(true)}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {imgLoaded && (
                    <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-3">
                      <a
                        href={generatedResult.generatedImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        id="btn-download"
                        className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl text-sm font-bold transition"
                      >
                        <Download className="w-4 h-4" /> Download
                      </a>
                      <button
                        id="btn-enhance"
                        onClick={handleEnhanceQuality}
                        className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 px-5 py-2.5 rounded-xl text-sm font-bold transition"
                      >
                        <Zap className="w-4 h-4" /> Enhance Quality
                      </button>
                      <button
                        id="btn-regenerate"
                        onClick={handleReset}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-2.5 rounded-xl text-sm font-bold transition"
                      >
                        <RefreshCw className="w-4 h-4" /> New Generation
                      </button>
                    </div>
                  )}
                </div>

              ) : (
                /* Empty State */
                <div className="flex flex-col items-center text-center max-w-sm gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center">
                    <Wand2 className="w-10 h-10 text-white/20" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-white text-xl">
                      {featureMode === 'product-to-model'
                        ? 'Upload garment → select model → generate'
                        : 'Upload garment → select model → generate'}
                    </h3>
                    <p className="text-sm text-gray-400 mt-3 leading-relaxed">
                      {featureMode === 'product-to-model'
                        ? 'Generate professional ecommerce photos for your garment. Output is suitable for catalogs, stores, and marketplaces.'
                        : 'Place your garment on the chosen model. The model\'s face, body, and pose are preserved — only the clothing changes.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full text-xs">
                    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 text-left">
                      <p className="text-emerald-400 font-bold mb-1.5">✓ What is preserved</p>
                      <ul className="text-gray-400 space-y-0.5">
                        <li>• Garment color & texture</li>
                        <li>• Logos & branding</li>
                        <li>• Model face & pose</li>
                        <li>• Body proportions</li>
                      </ul>
                    </div>
                    <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3 text-left">
                      <p className="text-red-400 font-bold mb-1.5">✗ Not supported</p>
                      <ul className="text-gray-400 space-y-0.5">
                        <li>• Changing garment color</li>
                        <li>• Replacing logos</li>
                        <li>• Changing face</li>
                        <li>• Back view</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
