import React, { useRef, useEffect } from 'react';
import { Caption } from '../types';
import { Clock, Edit2 } from 'lucide-react';

interface CaptionEditorProps {
  captions: Caption[];
  currentTime: number;
  onUpdateCaption: (id: string, text: string) => void;
  onSeek: (time: number) => void;
}

const CaptionEditor: React.FC<CaptionEditorProps> = ({ captions, currentTime, onUpdateCaption, onSeek }) => {
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active caption
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime]);

  const formatTime = (time: number) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  if (captions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500">
        <Edit2 size={48} className="mb-4 opacity-20" />
        <p className="text-center text-sm font-medium">No captions generated yet.<br/>Use "Transcribe" to analyze audio.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="p-6 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
        <h2 className="text-slate-100 font-bold text-lg flex items-center">
            <Edit2 size={18} className="mr-3 text-indigo-500" />
            Caption Studio
        </h2>
        <p className="text-xs text-slate-500 mt-1">{captions.length} segments found</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {captions.map((cap) => {
          const isActive = currentTime >= cap.start && currentTime <= cap.end;
          
          return (
            <div
              key={cap.id}
              ref={isActive ? activeRef : null}
              className={`p-4 rounded-xl border transition-all duration-300 ${
                isActive 
                  ? 'bg-indigo-900/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div 
                className="flex items-center space-x-2 mb-2 cursor-pointer group"
                onClick={() => onSeek(cap.start)}
              >
                <Clock size={12} className={`transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-600 group-hover:text-indigo-400'}`} />
                <span className={`text-[10px] font-mono font-bold ${isActive ? 'text-indigo-400' : 'text-slate-600 group-hover:text-indigo-400'}`}>
                  {formatTime(cap.start)} - {formatTime(cap.end)}
                </span>
              </div>
              
              <textarea
                value={cap.text}
                onChange={(e) => onUpdateCaption(cap.id, e.target.value)}
                className={`w-full bg-transparent border-0 p-0 text-sm font-medium focus:ring-0 resize-none outline-none leading-relaxed ${
                    isActive ? 'text-white' : 'text-slate-400 focus:text-slate-200'
                }`}
                rows={Math.max(2, Math.ceil(cap.text.length / 40))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CaptionEditor;