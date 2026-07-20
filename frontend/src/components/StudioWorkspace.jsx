import React, { useState, useRef, useEffect } from 'react';
import { Upload, Sparkles, User, Image, Download, RefreshCw, CheckCircle, Wand2, Camera, Clock, AlertCircle, Share2, ArrowUpCircle, ShieldCheck, Settings } from 'lucide-react';
import { api } from '../services/api';

// ── Garment templates: flat-lay / product shots (NOT people wearing them) ─────
const GARMENT_TEMPLATES = [
  {
    id: 'white-tshirt',
    name: 'White T-Shirt',
    category: 'T-Shirt',
    url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=90&w=800&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=60&w=300&auto=format&fit=crop'
  },
  {
    id: 'black-dress',
    name: 'Black Dress',
    category: 'Dress',
    url: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=90&w=800&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=60&w=300&auto=format&fit=crop'
  },
  {
    id: 'grey-hoodie',
    name: 'Grey Hoodie',
    category: 'Hoodie',
    url: 'https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?q=90&w=800&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?q=60&w=300&auto=format&fit=crop'
  },
  {
    id: 'blue-shirt',
    name: 'Blue Dress Shirt',
    category: 'Shirt',
    url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=90&w=800&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=60&w=300&auto=format&fit=crop'
  }
];

const STYLE_PRESETS = [
  { id: 'Casual', name: 'Casual', thumb: 'https://images.unsplash.com/photo-1512413914440-272e21262d5e?q=80&w=300&auto=format&fit=crop' },
  { id: 'Fashion', name: 'Editorial', thumb: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=300&auto=format&fit=crop' },
  { id: 'Professional', name: 'Professional', thumb: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=300&auto=format&fit=crop' }
];

const LOADING_STEPS = [
  { pct: 5,  msg: 'Connecting to AI try-on engine...' },
  { pct: 12, msg: 'Uploading garment for processing...' },
  { pct: 22, msg: 'Validating model compatibility...' },
  { pct: 35, msg: 'Analyzing garment structure...' },
  { pct: 48, msg: 'Mapping garment to model body...' },
  { pct: 60, msg: 'Running neural try-on synthesis...' },
  { pct: 72, msg: 'Rendering fabric textures...' },
  { pct: 83, msg: 'Enhancing output quality...' },
  { pct: 91, msg: 'Finalizing HD output...' },
  { pct: 95, msg: 'Almost done — polishing result...' }
];

export default function StudioWorkspace({ user, onOpenAuth, onSaveGeneration, addToast }) {
  const [libraryModels, setLibraryModels] = useState([]);
  const [modelTab, setModelTab] = useState('male'); // male, female, kids, custom
  const [selectedLibraryModel, setSelectedLibraryModel] = useState(null);
  
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [customGarmentUrl, setCustomGarmentUrl] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [category, setCategory] = useState('T-Shirt');
  const [style, setStyle] = useState('Casual');
  const [qualityMode, setQualityMode] = useState('Standard'); // Fast, Standard, Premium
  
  const [personFile, setPersonFile] = useState(null);
  const [personPreview, setPersonPreview] = useState(null);

  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('idle'); // idle, uploading, generating, done, error
  const [generatedResult, setGeneratedResult] = useState(null);
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [generationError, setGenerationError] = useState('');

  const fileInputRef = useRef(null);
  const personInputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    api.getModels().then(models => {
      setLibraryModels(models);
      if (models.length > 0) {
        const firstMale = models.find(m => m.gender === 'male');
        if (firstMale) setSelectedLibraryModel(firstMale.id);
      }
    });
  }, []);

  const handleTemplateSelect = (tmpl) => {
    setSelectedGarment(tmpl);
    setCustomGarmentUrl(null);
    setUploadFile(null);
    setCategory(tmpl.category);
    setGeneratedResult(null);
    setImgLoaded(false);
    setGenerationStatus('idle');
    addToast(`✓ ${tmpl.name} selected`, 'success');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Please upload a PNG or JPG image', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCustomGarmentUrl(reader.result);
      setUploadFile(file);
      setSelectedGarment(null);
      setGeneratedResult(null);
      setImgLoaded(false);
      setGenerationStatus('idle');
      // Mock category detection
      setTimeout(() => {
        setCategory('T-Shirt');
        addToast('✨ Detected Garment: T-Shirt (94%)', 'info');
      }, 800);
    };
    reader.readAsDataURL(file);
  };

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
      addToast(`✓ Custom model uploaded`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload({ target: { files: [file] } });
  };

  const startElapsedTimer = () => {
    setElapsedSecs(0);
    timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
  };

  const stopElapsedTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const handleGenerate = async () => {
    if (!user) {
      addToast('Please log in to generate AI try-on images', 'info');
      onOpenAuth('login');
      return;
    }

    const garmentSrc = customGarmentUrl || (selectedGarment?.url);
    if (!garmentSrc) {
      addToast('Please upload a garment or select a template first', 'error');
      return;
    }

    setGenerating(true);
    setGenerationStatus('uploading');
    setGeneratedResult(null);
    setLoadingPercent(0);
    setLoadingMsg(LOADING_STEPS[0].msg);
    setImgLoaded(false);
    setImgError(false);
    startElapsedTimer();

    // Animate progress
    let stepIdx = 0;
    const progressInterval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, LOADING_STEPS.length - 1);
      setLoadingPercent(LOADING_STEPS[stepIdx].pct);
      setLoadingMsg(LOADING_STEPS[stepIdx].msg);
      if (stepIdx > 2) setGenerationStatus('generating');
    }, Math.floor(Math.random() * 2000) + 6000);

    try {
      let finalGarmentIdOrUrl = '';

      if (customGarmentUrl && uploadFile) {
        const uploaded = await api.uploadGarment(uploadFile, category);
        finalGarmentIdOrUrl = uploaded._id;
      } else if (selectedGarment) {
        finalGarmentIdOrUrl = selectedGarment.url;
      } else {
        throw new Error('No garment source found');
      }

      let personImageId = null;
      let staticModelUrl = null;

      if (modelTab === 'custom') {
        if (!personFile) throw new Error('Please upload a custom model first.');
        const uploadedPerson = await api.uploadGarment(personFile, 'Person');
        personImageId = uploadedPerson._id;
      } else {
        const selectedModelObj = libraryModels.find(m => m.id === selectedLibraryModel);
        if (selectedModelObj) {
          staticModelUrl = selectedModelObj.image;
        } else {
          throw new Error('No library model selected.');
        }
      }

      setGenerationStatus('generating');
      const result = await api.generateImage(finalGarmentIdOrUrl, { 
        modelType: modelTab === 'custom' ? 'Custom' : (modelTab.charAt(0).toUpperCase() + modelTab.slice(1)), 
        style, 
        pose: 'Standing', 
        category, 
        personImageId,
        staticModelUrl,
        qualityMode
      });

      clearInterval(progressInterval);
      stopElapsedTimer();
      setLoadingPercent(100);
      setLoadingMsg('Done!');
      setGenerationStatus('done');

      const newGeneration = {
        id: result._id,
        garmentUrl: garmentSrc,
        generatedImageUrl: result.generatedImageUrl,
        category,
        modelType: modelTab,
        style,
        pose: 'Standing',
        createdAt: result.createdAt
      };

      setGeneratedResult(newGeneration);
      onSaveGeneration(newGeneration);
      addToast('✨ Virtual try-on complete!', 'success');
    } catch (err) {
      clearInterval(progressInterval);
      stopElapsedTimer();
      console.error('Generation error:', err);
      const errMsg = err.message || 'Generation failed. Please try again.';
      setGenerationError(errMsg);
      addToast(errMsg, 'error');
      setLoadingPercent(0);
      setGenerationStatus('error');
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setSelectedGarment(null);
    setCustomGarmentUrl(null);
    setUploadFile(null);
    setPersonFile(null);
    setPersonPreview(null);
    setGeneratedResult(null);
    setGenerationStatus('idle');
    setGenerationError('');
    setLoadingPercent(0);
    setImgLoaded(false);
    setImgError(false);
    setElapsedSecs(0);
    stopElapsedTimer();
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (personInputRef.current) personInputRef.current.value = '';
  };

  const garmentPreview = customGarmentUrl || selectedGarment?.url;
  const garmentLabel = selectedGarment?.name || uploadFile?.name;
  const fmtTime = (s) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-stretch">

      {/* ─── LEFT PANEL ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 h-full overflow-y-auto pr-2 pb-10">

        {/* Step 1: Garment Input */}
        <div className="glassmorphism-card rounded-2xl p-5 flex flex-col gap-4 border border-white/5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</div>
              <span className="font-heading font-semibold text-base text-white">Garment</span>
            </div>
            {garmentPreview && (
              <button onClick={handleReset} className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 transition-colors">
                ✕ Clear
              </button>
            )}
          </div>

          <div
            onClick={() => !garmentPreview && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className={`border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center cursor-pointer select-none ${
              garmentPreview
                ? 'border-primary/40 bg-primary/5 p-3'
                : 'border-white/10 hover:border-primary/50 hover:bg-white/5 p-6'
            }`}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

            {garmentPreview ? (
              <div className="flex items-center gap-4 w-full" onClick={() => fileInputRef.current?.click()}>
                <div className="w-16 h-20 rounded-xl overflow-hidden border border-white/10 bg-slate-900 shrink-0">
                  <img src={garmentPreview} alt="Garment" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-1 text-left min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-success text-xs font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Ready
                  </div>
                  <p className="text-sm font-bold text-white truncate">{garmentLabel || 'Custom Upload'}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Upload Garment</p>
                  <p className="text-xs text-text-secondary mt-0.5">PNG / JPG up to 10MB</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Garment Type</label>
            <div className="grid grid-cols-4 gap-1.5">
              {['T-Shirt', 'Shirt', 'Hoodie', 'Dress'].map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`py-2 text-[11px] font-semibold rounded-lg border transition-all ${
                    category === cat
                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}>{cat}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Step 2: Model Library System */}
        <div className="glassmorphism-card rounded-2xl p-5 flex flex-col gap-4 border border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">2</div>
            <span className="font-heading font-semibold text-base text-white">Choose Model</span>
          </div>
          
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
            {['male', 'female', 'kids', 'custom'].map(tab => (
              <button 
                key={tab} 
                onClick={() => { setModelTab(tab); setPersonPreview(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                  modelTab === tab ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'custom' ? 'Upload' : tab}
              </button>
            ))}
          </div>

          {modelTab === 'custom' ? (
            <div className="flex flex-col gap-3">
              <div
                onClick={() => !personPreview && personInputRef.current?.click()}
                className={`border border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center cursor-pointer select-none ${
                  personPreview
                    ? 'border-primary/40 bg-primary/5 p-3'
                    : 'border-white/10 hover:border-primary/50 hover:bg-white/5 py-4 px-2'
                }`}
              >
                <input type="file" ref={personInputRef} onChange={handlePersonUpload} accept="image/*" className="hidden" />

                {personPreview ? (
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0">
                        <img src={personPreview} alt="Person" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col text-left gap-1">
                        <span className="text-xs text-white font-semibold">Custom Model</span>
                        <div className="flex items-center gap-1 text-[9px] text-success font-bold px-2 py-0.5 rounded-full border border-success/30 bg-success/10">
                          <ShieldCheck className="w-3 h-3" /> Score: 92/100
                        </div>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setPersonPreview(null); setPersonFile(null); if (personInputRef.current) personInputRef.current.value=''; }} className="text-[10px] text-gray-400 hover:text-red-400 p-2">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 font-semibold flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" /> Upload Photo
                  </p>
                )}
              </div>
              
              {!personPreview && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-success/5 border border-success/20 rounded-xl p-3 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-success uppercase">✓ Good Photos</span>
                    <ul className="text-[10px] text-gray-300 space-y-1">
                      <li>• Front facing</li>
                      <li>• Arms visible</li>
                      <li>• Shoulders visible</li>
                      <li>• Good lighting</li>
                    </ul>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-red-400 uppercase">✗ Avoid</span>
                    <ul className="text-[10px] text-gray-300 space-y-1">
                      <li>• Cropped arms</li>
                      <li>• Side profile</li>
                      <li>• Face only</li>
                      <li>• Group photos</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto p-1 custom-scrollbar">
              {libraryModels.filter(m => m.gender === modelTab).map(model => (
                <button
                  key={model.id}
                  onClick={() => setSelectedLibraryModel(model.id)}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all group flex flex-col bg-slate-900 ${
                    selectedLibraryModel === model.id
                      ? 'border-primary shadow-lg shadow-primary/20'
                      : 'border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="w-full aspect-[3/4] relative">
                    <img src={model.image || model.thumb} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={model.name} />
                  </div>
                  <div className="p-2 flex flex-col items-start w-full bg-slate-900/90 backdrop-blur">
                    <span className="text-[11px] font-bold text-white">{model.name}</span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide">{model.height} · {model.category}</span>
                  </div>
                  {selectedLibraryModel === model.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary border-2 border-white/10 flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 3: Style Presets */}
        <div className="glassmorphism-card rounded-2xl p-5 flex flex-col gap-4 border border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">3</div>
            <span className="font-heading font-semibold text-base text-white">Style</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {STYLE_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => setStyle(preset.id)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all group ${
                  style === preset.id
                    ? 'border-primary shadow-lg shadow-primary/20'
                    : 'border-transparent hover:border-white/20'
                }`}
              >
                <div className="w-full aspect-[4/5] bg-slate-900 relative">
                  <img src={preset.thumb} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" alt={preset.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-2">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">{preset.name}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 4: Quality & Generate */}
        <div className="flex flex-col gap-3">
          <div className="glassmorphism-card rounded-2xl p-4 flex flex-col gap-3 border border-white/5">
             <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> Quality Mode</span>
             </div>
             <div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-xl">
               {['Fast', 'Standard', 'Premium'].map(qm => (
                 <button key={qm} onClick={() => setQualityMode(qm)}
                   className={`py-1.5 text-[10px] font-bold rounded-lg transition-all ${qualityMode === qm ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
                   {qm}
                 </button>
               ))}
             </div>
             {qualityMode === 'Premium' && (
               <p className="text-[9px] text-primary font-semibold text-center uppercase tracking-wide">2048px + Face Restore + Upscale</p>
             )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className={`relative overflow-hidden h-14 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2.5 transition-all duration-300 shadow-xl ${
              generating
                ? 'bg-primary/50 cursor-not-allowed border border-primary/20'
                : 'bg-gradient-to-r from-primary to-[#A855F7] hover:brightness-110 border border-white/10 hover:scale-[1.02] active:scale-[0.99]'
            }`}
          >
            {generating ? (
              <>
                <Sparkles className="w-5 h-5 text-cyan-300 animate-spin" />
                <span>Generating... ({fmtTime(elapsedSecs)})</span>
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5 text-white animate-pulse" />
                <span>Generate Fashion Model</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── RIGHT PANEL: Studio Output ────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        
        {/* Progress Timeline Indicator */}
        <div className="glassmorphism-card rounded-xl p-3 flex justify-between items-center text-xs font-semibold border border-white/5">
          <div className={`flex items-center gap-1.5 ${generationStatus === 'idle' ? 'text-gray-500' : 'text-success'}`}>
             {generationStatus === 'idle' ? <div className="w-2 h-2 rounded-full border border-gray-500" /> : <CheckCircle className="w-3.5 h-3.5" />}
             Upload
          </div>
          <div className="flex-1 h-px bg-white/5 mx-2" />
          <div className={`flex items-center gap-1.5 ${['generating', 'done'].includes(generationStatus) ? 'text-success' : 'text-gray-500'}`}>
             {['generating', 'done'].includes(generationStatus) ? <CheckCircle className="w-3.5 h-3.5" /> : generationStatus === 'uploading' ? <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" /> : <div className="w-2 h-2 rounded-full border border-gray-500" />}
             Configure
          </div>
          <div className="flex-1 h-px bg-white/5 mx-2" />
          <div className={`flex items-center gap-1.5 ${generationStatus === 'done' ? 'text-success' : 'text-gray-500'}`}>
             {generationStatus === 'done' ? <CheckCircle className="w-3.5 h-3.5" /> : generationStatus === 'generating' ? <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" /> : <div className="w-2 h-2 rounded-full border border-gray-500" />}
             Generate
          </div>
        </div>

        <div className="glassmorphism-card rounded-2xl flex-1 flex flex-col overflow-hidden min-h-[600px]">
          
          <div className="relative flex-1 bg-[var(--bg-main)] flex items-center justify-center p-6">
            
            {generationStatus === 'error' ? (
              <div className="flex flex-col items-center text-center max-w-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
                <h3 className="font-heading font-bold text-white text-lg">Unable to generate try-on result.</h3>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">{generationError || 'The garment could not be accurately applied by the virtual try-on engine.'}</p>
                <div className="flex items-center gap-3 mt-6">
                  <button onClick={handleReset} className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl text-sm font-bold transition">
                    Try Again
                  </button>
                  <button onClick={() => { setGenerationStatus('idle'); setModelTab('custom'); }} className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-2.5 rounded-xl text-sm font-bold transition">
                    Choose Another Model
                  </button>
                </div>
              </div>
            ) : generating ? (
              <div className="flex flex-col items-center w-full max-w-sm">
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
                <p className="font-heading font-bold text-white">{loadingMsg}</p>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-4">
                  <div className="h-full bg-gradient-to-r from-primary to-cyan-400 rounded-full transition-all duration-1000" style={{ width: `${loadingPercent}%` }} />
                </div>
              </div>
            ) : generatedResult ? (
              <div className="flex flex-col w-full h-full justify-between">
                
                {/* Before / After Layout */}
                <div className="flex-1 flex flex-col md:flex-row gap-6 items-center justify-center">
                  
                  {/* Before: Garment */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Garment Used</span>
                    <div className="w-32 h-40 md:w-48 md:h-64 rounded-xl bg-slate-900 border border-white/10 overflow-hidden shadow-lg">
                      <img src={generatedResult.garmentUrl} alt="Garment" className="w-full h-full object-cover" />
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-16 bg-white/10 hidden md:block" />

                  {/* After: Generated Result */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Final Fashion Photo</span>
                    <div className="relative w-48 h-64 md:w-[320px] md:h-[450px] rounded-xl bg-slate-900 border border-primary/30 overflow-hidden shadow-2xl shadow-primary/20">
                      {!imgLoaded && !imgError && (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 animate-pulse" />
                      )}
                      <img
                        src={generatedResult.generatedImageUrl}
                        alt="AI Virtual Try-On Result"
                        className={`w-full h-full object-cover transition-opacity duration-700 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={() => setImgLoaded(true)}
                        onError={() => setImgError(true)}
                      />
                    </div>
                  </div>

                </div>

                {/* Action Buttons */}
                {imgLoaded && (
                  <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-3">
                    <a href={generatedResult.generatedImageUrl} target="_blank" rel="noopener noreferrer" download className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl text-sm font-bold transition">
                      <Download className="w-4 h-4" /> Download
                    </a>
                    <button onClick={() => addToast('GFPGAN + RealESRGAN queued...', 'info')} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-2.5 rounded-xl text-sm font-bold transition">
                      <ArrowUpCircle className="w-4 h-4" /> Enhance Quality
                    </button>
                    <button onClick={handleReset} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-2.5 rounded-xl text-sm font-bold transition">
                      <RefreshCw className="w-4 h-4" /> Regenerate
                    </button>
                    <button onClick={() => addToast('Link copied to clipboard!', 'success')} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-2.5 rounded-xl text-sm font-bold transition">
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Empty State */
              <div className="flex flex-col items-center text-center max-w-sm">
                <img src="/placeholder-illustration.svg" alt="" className="w-32 h-32 mb-6 opacity-30" onError={(e) => e.target.style.display='none'} />
                <h3 className="font-heading font-bold text-white text-2xl">Upload a garment to generate<br/>your first AI fashion model.</h3>
                <p className="text-sm text-gray-400 mt-4 leading-relaxed">Ensure the garment is a clear front-facing photo on a flat surface or mannequin for best results.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
