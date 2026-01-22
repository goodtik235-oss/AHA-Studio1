import React, { useRef, useEffect, useState } from 'react';
import { Caption } from '../types';

interface VideoPlayerProps {
  src: string | null;
  captions: Caption[];
  onTimeUpdate: (time: number) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, captions, onTimeUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeCaption, setActiveCaption] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      onTimeUpdate(currentTime);

      const current = captions.find(c => currentTime >= c.start && currentTime <= c.end);
      setActiveCaption(current ? current.text : null);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [captions, onTimeUpdate]);

  if (!src) {
    return (
      <div className="w-full aspect-video bg-slate-900 rounded-[2rem] border-2 border-slate-800 border-dashed flex flex-col items-center justify-center text-slate-500">
        <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><polyline points="11 3 11 11 14 8 17 11 17 3"/></svg>
        </div>
        <p className="font-medium text-lg">Select a video to begin localization</p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-slate-800">
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        controls
        playsInline
      />
      
      {activeCaption && (
        <div className="absolute bottom-[10%] left-0 right-0 text-center px-8 pointer-events-none">
          <span className="inline-block px-4 py-2 bg-black/60 backdrop-blur-sm text-white text-lg md:text-xl font-semibold rounded-lg shadow-lg">
            {activeCaption}
          </span>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;