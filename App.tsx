import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Languages, Download, Wand2, AlertTriangle, 
  Film, Mic, Square, Volume2, Sparkles, ChevronRight
} from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import CaptionEditor from './components/CaptionEditor';
import StatsChart from './components/StatsChart';
import { Caption, ProcessingStatus, SUPPORTED_LANGUAGES } from './types';
import { extractAudioFromVideo, base64ToWavBlob } from './services/audioUtils';
import { transcribeAudio, translateCaptions, generateSpeech } from './services/geminiService';
import { renderVideoWithCaptions } from './services/videoRenderer';

function App() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [selectedLang, setSelectedLang] = useState<string>('ur-PK');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [renderingProgress, setRenderingProgress] = useState(0);
  const [dubbedAudioBlob, setDubbedAudioBlob] = useState<Blob | null>(null);
  const [dubbedAudioUrl, setDubbedAudioUrl] = useState<string | null>(null);
  const [useDubbing, setUseDubbing] = useState(false);
  const [isDubPreviewPlaying, setIsDubPreviewPlaying] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dubPreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (dubbedAudioUrl) URL.revokeObjectURL(dubbedAudioUrl);
      if (videoSrc) URL.revokeObjectURL(videoSrc);
    };
  }, [dubbedAudioUrl, videoSrc]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setVideoFile(file);
      setCaptions([]);
      setStatus(ProcessingStatus.IDLE);
      setErrorMsg(null);
      setDubbedAudioBlob(null);
      setDubbedAudioUrl(null);
      setUseDubbing(false);
    }
  };

  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatus(ProcessingStatus.IDLE);
  };

  const handleGenerateCaptions = async () => {
    if (!videoFile) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setErrorMsg(null);
      setStatus(ProcessingStatus.EXTRACTING_AUDIO);
      const audioBase64 = await extractAudioFromVideo(videoFile);
      if (controller.signal.aborted) return;
      
      setStatus(ProcessingStatus.TRANSCRIBING);
      const generatedCaptions = await transcribeAudio(audioBase64, controller.signal);
      if (controller.signal.aborted) return;
      
      setCaptions(generatedCaptions);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg(err.message || "An unknown error occurred.");
    }
  };

  const handleTranslate = async () => {
    if (captions.length === 0) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setStatus(ProcessingStatus.TRANSLATING);
      const targetLangName = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.name || "English";
      const translated = await translateCaptions(captions, targetLangName, controller.signal);
      if (controller.signal.aborted) return;
      
      setCaptions(translated);
      setDubbedAudioBlob(null);
      setDubbedAudioUrl(null);
      setUseDubbing(false);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg("Translation failed: " + err.message);
    }
  };

  const handleDubbing = async () => {
    if (captions.length === 0) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setStatus(ProcessingStatus.GENERATING_SPEECH);
      setErrorMsg(null);
      
      const fullText = captions.map(c => c.text).join('. ');
      const audioBase64 = await generateSpeech(fullText, controller.signal);
      if (controller.signal.aborted) return;
      
      const blob = base64ToWavBlob(audioBase64, 24000);
      const url = URL.createObjectURL(blob);

      setDubbedAudioBlob(blob);
      setDubbedAudioUrl(url);
      setUseDubbing(true);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg("Dubbing failed: " + err.message);
    }
  };

  const toggleDubPreview = () => {
    if (!dubPreviewAudioRef.current) return;
    if (isDubPreviewPlaying) {
      dubPreviewAudioRef.current.pause();
    } else {
      dubPreviewAudioRef.current.currentTime = 0;
      dubPreviewAudioRef.current.play();
    }
    setIsDubPreviewPlaying(!isDubPreviewPlaying);
  };

  const handleDownloadSRT = () => {
    let srtContent = "";
    const formatSRTTime = (seconds: number) => {
      const date = new Date(0);
      date.setMilliseconds(seconds * 1000);
      return date.toISOString().substring(11, 23).replace('.', ',');
    };

    captions.forEach((cap, index) => {
      const start = formatSRTTime(cap.start);
      const end = formatSRTTime(cap.end);
      srtContent += `${index + 1}\n${start} --> ${end}\n${cap.text}\n\n`;
    });
    const blob = new Blob([srtContent], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "captions.srt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportVideo = async () => {
    if (!videoSrc || captions.length === 0) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setStatus(ProcessingStatus.RENDERING);
      setRenderingProgress(0);
      const audioToUse = useDubbing ? dubbedAudioBlob : null;
      const blob = await renderVideoWithCaptions(
        videoSrc, 
        captions, 
        (progress) => setRenderingProgress(progress),
        controller.signal,
        audioToUse
      );
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aha_studio_export_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus(ProcessingStatus.IDLE);
      } else {
        setStatus(ProcessingStatus.ERROR);
        setErrorMsg("Render error: " + err.message);
      }
    } finally {
      setRenderingProgress(0);
      abortControllerRef.current = null;
    }
  };

  const updateCaption = (id: string, newText: string) => {
    setCaptions(prev => prev.map(c => c.id === id ? { ...c, text: newText } : c));
  };

  const isProcessing = [
    ProcessingStatus.EXTRACTING_AUDIO, 
    ProcessingStatus.TRANSCRIBING, 
    ProcessingStatus.TRANSLATING, 
    ProcessingStatus.GENERATING_SPEECH
  ].includes(status);
  
  const isRendering = status === ProcessingStatus.RENDERING;

  return (
    <div className="min-h-screen flex flex-col overflow-hidden relative selection:bg-indigo-500/30">
      
      {dubbedAudioUrl && (
        <audio 
          ref={dubPreviewAudioRef} 
          src={dubbedAudioUrl} 
          onEnded={() => setIsDubPreviewPlaying(false)}
          className="hidden"
        />
      )}

      {/* Processing Overlay */}
      {(isRendering || isProcessing) && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse"></div>
              <div className="w-40 h-40 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin flex items-center justify-center">
                 <Sparkles className="w-10 h-10 text-indigo-400 animate-bounce" />
              </div>
            </div>
            
            <h2 className="text-4xl font-black text-white mb-3 tracking-tighter">
                {isRendering ? 'Polishing Masterpiece' : 'AHA AI Synthesis'}
            </h2>
            <div className="flex flex-col items-center max-w-sm w-full text-center">
              <p className="text-slate-400 mb-8 text-lg font-medium">
                  {status === ProcessingStatus.EXTRACTING_AUDIO && 'Deconstructing audio tracks...'}
                  {status === ProcessingStatus.TRANSCRIBING && 'Linguistic engine mapping speech...'}
                  {status === ProcessingStatus.TRANSLATING && 'Global localization active...'}
                  {status === ProcessingStatus.GENERATING_SPEECH && 'Neural voice architecture in progress...'}
                  {status === ProcessingStatus.RENDERING && `Compositing final render: ${Math.round(renderingProgress * 100)}%`}
              </p>
              
              {isRendering && (
                  <div className="w-full bg-slate-800 rounded-full h-2 mb-10 overflow-hidden shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300 ease-out shadow-[0_0_20px_rgba(99,102,241,0.6)]"
                      style={{ width: `${renderingProgress * 100}%` }}
                    />
                  </div>
              )}

              <button
                onClick={handleStopProcessing}
                className="px-10 py-4 bg-slate-900 border border-slate-800 hover:bg-red-500/10 hover:border-red-500/50 text-white rounded-2xl font-black transition-all flex items-center shadow-2xl hover:scale-105 active:scale-95 group"
              >
                <Square size={16} className="mr-3 fill-red-500 group-hover:scale-110 transition-transform" />
                CANCEL PROCESS
              </button>
            </div>
        </div>
      )}

      {/* Header */}
      <header className="h-20 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-3xl flex items-center px-10 justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.4)] rotate-3">
            <span className="font-black text-2xl text-white -rotate-3">A</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tighter text-white leading-none">AHA STUDIO</h1>
            <span className="text-[10px] text-slate-500 font-bold tracking-[0.3em] uppercase mt-1">Next-Gen Localization</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <input type="file" ref={videoInputRef} accept="video/*" onChange={handleFileUpload} className="hidden" />
          <button 
            onClick={() => videoInputRef.current?.click()} 
            className="flex items-center space-x-3 px-8 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-indigo-500/20 hover:-translate-y-1 active:translate-y-0"
          >
            <Upload size={18} />
            <span>{videoFile ? 'SWAP PROJECT' : 'START PROJECT'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        
        <div className="flex-1 flex flex-col p-10 overflow-y-auto bg-slate-950/50">
          <div className="w-full max-w-6xl mx-auto flex flex-col">
             <VideoPlayer src={videoSrc} captions={captions} onTimeUpdate={setCurrentTime} />

             <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* 1. Transcribe */}
                <div className="group bg-slate-900/40 border border-slate-800 p-8 rounded-[3rem] flex flex-col justify-between hover:border-indigo-500/30 transition-all hover:bg-slate-900/60 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Wand2 size={60} />
                  </div>
                  <div className="mb-6 z-10">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-inner">
                      <Wand2 size={24}/>
                    </div>
                    <h3 className="font-black text-xl text-slate-100 tracking-tight">Transcribe</h3>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed font-medium">Extract high-fidelity text captions using Gemini Flash Multimodal.</p>
                  </div>
                  <button
                    onClick={handleGenerateCaptions}
                    disabled={!videoFile || isProcessing || isRendering}
                    className="w-full py-4 bg-slate-800 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl group-hover:scale-105 active:scale-95"
                  >
                     ANALYZE AUDIO
                  </button>
                </div>

                {/* 2. Translate */}
                <div className="group bg-slate-900/40 border border-slate-800 p-8 rounded-[3rem] flex flex-col justify-between hover:border-purple-500/30 transition-all hover:bg-slate-900/60 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Languages size={60} />
                  </div>
                  <div className="mb-6 z-10">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all shadow-inner">
                      <Languages size={24}/>
                    </div>
                    <h3 className="font-black text-xl text-slate-100 tracking-tight">Translate</h3>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed font-medium">Localize content into global languages natively with context awareness.</p>
                  </div>
                  <div className="flex space-x-3 z-10">
                    <select
                      value={selectedLang}
                      onChange={(e) => setSelectedLang(e.target.value)}
                      disabled={isRendering || isProcessing}
                      className="bg-slate-800/80 border border-slate-700 text-xs font-bold rounded-2xl px-4 py-4 outline-none focus:border-purple-500 flex-1 min-w-0 transition-colors"
                    >
                      {SUPPORTED_LANGUAGES.map(l => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleTranslate}
                      disabled={captions.length === 0 || isProcessing || isRendering}
                      className="bg-purple-500 hover:bg-purple-400 text-white p-4 rounded-2xl transition-all disabled:opacity-50 shadow-xl"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>

                {/* 3. Dubbing */}
                <div className="group bg-slate-900/40 border border-slate-800 p-8 rounded-[3rem] flex flex-col justify-between hover:border-pink-500/30 transition-all hover:bg-slate-900/60 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Mic size={60} />
                  </div>
                   <div className="mb-6 z-10">
                    <div className="w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6 text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-all shadow-inner">
                      <Mic size={24}/>
                    </div>
                    <h3 className="font-black text-xl text-slate-100 tracking-tight">AI Dub</h3>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed font-medium">Synthesize ultra-natural neural voiceovers with zero-shot cloning.</p>
                  </div>
                  <button
                    onClick={handleDubbing}
                    disabled={captions.length === 0 || isProcessing || isRendering}
                    className="w-full py-4 bg-slate-800 hover:bg-pink-500 text-white rounded-2xl font-black text-xs tracking-widest transition-all disabled:opacity-50 shadow-xl group-hover:scale-105 active:scale-95"
                  >
                    CLONE VOICE
                  </button>
                </div>

                {/* 4. Export */}
                <div className="group bg-slate-900/40 border border-slate-800 p-8 rounded-[3rem] flex flex-col justify-between hover:border-emerald-500/30 transition-all hover:bg-slate-900/60 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Download size={60} />
                  </div>
                   <div className="mb-6 z-10">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-inner">
                      <Download size={24}/>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                       <h3 className="font-black text-xl text-slate-100 tracking-tight">Export</h3>
                       {dubbedAudioUrl && (
                        <button
                          onClick={toggleDubPreview}
                          className={`p-3 rounded-2xl transition-all shadow-lg ${isDubPreviewPlaying ? 'bg-pink-500 text-white scale-110' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                          title="Listen to Dub"
                        >
                          {isDubPreviewPlaying ? <Square size={14} fill="currentColor" /> : <Volume2 size={14} />}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 mt-4">
                      <input 
                        type="checkbox" 
                        id="dubCheck" 
                        checked={useDubbing} 
                        onChange={(e) => setUseDubbing(e.target.checked)}
                        disabled={!dubbedAudioBlob || isProcessing || isRendering}
                        className="w-5 h-5 rounded-lg bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500/20 transition-all cursor-pointer"
                      />
                      <label htmlFor="dubCheck" className={`text-xs select-none cursor-pointer font-black tracking-widest uppercase ${dubbedAudioBlob ? 'text-slate-300' : 'text-slate-600'}`}>Include AI Dub</label>
                    </div>
                  </div>
                  <div className="flex space-x-3 z-10">
                    <button
                        onClick={handleDownloadSRT}
                        disabled={captions.length === 0 || isRendering || isProcessing}
                        className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-[10px] tracking-widest disabled:opacity-50 transition-all"
                    >
                        .SRT
                    </button>
                    <button
                        onClick={handleExportVideo}
                        disabled={captions.length === 0 || isRendering || isProcessing}
                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-[10px] tracking-widest shadow-xl shadow-emerald-500/10 flex items-center justify-center disabled:opacity-50 group-hover:scale-105 active:scale-95 transition-all"
                    >
                        <Film size={16} className="mr-2"/>
                        RENDER
                    </button>
                  </div>
                </div>

             </div>

             {errorMsg && (
               <div className="mt-10 bg-red-500/10 border border-red-500/20 text-red-400 p-8 rounded-[3rem] flex items-start shadow-2xl animate-in zoom-in-95">
                 <div className="p-4 bg-red-500/10 rounded-2xl mr-6">
                    <AlertTriangle size={24} className="flex-shrink-0" />
                 </div>
                 <div>
                   <p className="font-black text-xl mb-2 tracking-tight">Studio Disruption</p>
                   <p className="opacity-70 font-bold text-sm leading-relaxed">{errorMsg}</p>
                 </div>
               </div>
             )}

             <StatsChart captions={captions} />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-[420px] flex-shrink-0 bg-slate-950 border-l border-slate-800/40 shadow-2xl z-40">
           <CaptionEditor 
             captions={captions} 
             currentTime={currentTime} 
             onUpdateCaption={updateCaption}
             onSeek={(t) => {
                const video = document.querySelector('video');
                if (video) {
                  video.currentTime = t;
                  video.play();
                }
             }}
           />
        </aside>

      </main>
    </div>
  );
}

export default App;