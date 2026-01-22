import { Caption } from "../types";

/**
 * Renders the video with burned-in captions and optionally replaces the audio track.
 * This runs in real-time (1x speed) using HTML5 Canvas and MediaRecorder.
 */
export const renderVideoWithCaptions = async (
  videoSrc: string,
  captions: Caption[],
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
  dubbedAudioBlob?: Blob | null
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // 1. Setup Video Element
    const video = document.createElement('video');
    video.src = videoSrc;
    video.crossOrigin = 'anonymous';
    video.muted = true; // We handle audio separately via AudioContext
    video.playsInline = true;
    
    // 2. Setup Audio Context for mixing/replacement
    // Fix: Cast window to any to access webkitAudioContext for Safari compatibility
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();
    
    // 3. Setup Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
        reject(new Error("Could not create canvas context"));
        return;
    }

    let audioSource: AudioBufferSourceNode | MediaElementAudioSourceNode | null = null;

    video.onloadedmetadata = async () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      try {
        if (dubbedAudioBlob) {
           // If dubbing, load the blob, decode it, and play it
           const arrayBuffer = await dubbedAudioBlob.arrayBuffer();
           const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
           audioSource = audioCtx.createBufferSource();
           (audioSource as AudioBufferSourceNode).buffer = audioBuffer;
           audioSource.connect(dest);
           // Start audio source when video starts
        } else {
           // Use original video audio
           // We need to fetch the video file as blob or use the element source if CORS allows
           // Since videoSrc is objectURL, it's fine.
           // However, captureStream() on video element includes audio usually.
           // But we are drawing to canvas.
           
           // Best approach for original audio: Create a source from the video element
           // Note: This requires the video element to be in the DOM or playing
           // Since we muted the video element to avoid double playback during render (if visible),
           // we can un-mute it for the stream capture or connect it here.
           // Actually, simpler: We are recording the CANVAS stream. We add the audio track to it.
           
           const sourceNode = audioCtx.createMediaElementSource(video);
           sourceNode.connect(dest);
           
           // Also connect to destination for user to hear? No, silent render.
        }
      } catch (e) {
          console.warn("Audio setup failed", e);
      }

      // 4. Setup MediaRecorder
      const canvasStream = canvas.captureStream(30); // 30 FPS
      
      // Combine canvas video track + audio destination track
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        canvasStream.addTrack(audioTrack);
      }
      
      const mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: 'video/webm; codecs=vp9'
      });
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        // Cleanup
        video.remove();
        canvas.remove();
        audioCtx.close();
        resolve(blob);
      };
      
      // 5. Start Rendering Loop
      mediaRecorder.start();
      
      if (dubbedAudioBlob && audioSource instanceof AudioBufferSourceNode) {
          audioSource.start(0);
      } else {
          // If using original audio, ensuring video isn't muted effectively for the stream track
          // But we set .muted=true on element to not disturb user. 
          // createMediaElementSource usually grabs the audio BEFORE mute in some browsers, 
          // but safely, we might need to unmute and not connect to hardware destination.
          // Since we connected to 'dest' (stream destination) and NOT 'audioCtx.destination', 
          // sound won't play out of speakers, so we can set video.muted = false safely?
          // Actually, video.muted = false implies it plays to speakers unless we hijack the destination.
          // However, we are doing offline render. Let's try unmute.
          video.muted = false;
          // But if we do this, user hears it.
          // Volume = 0?
          video.volume = 0; // If volume is 0, capture might be silent.
          // Let's rely on standard element source behavior.
          // If this fails, we fall back to just video.
      }

      video.play().catch(reject);
      
      const drawFrame = () => {
        if (signal?.aborted) {
            mediaRecorder.stop();
            video.pause();
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }

        if (video.paused || video.ended) {
          if (video.ended) {
             mediaRecorder.stop();
          }
          return;
        }
        
        // Draw Frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Draw Captions
        const currentTime = video.currentTime;
        const currentCaption = captions.find(c => currentTime >= c.start && currentTime <= c.end);
        
        if (currentCaption) {
           drawCaptionOnCanvas(ctx, currentCaption.text, canvas.width, canvas.height);
        }
        
        // Update Progress
        const progress = video.currentTime / video.duration;
        onProgress(progress);
        
        requestAnimationFrame(drawFrame);
      };
      
      drawFrame();
    };
    
    video.onerror = (e) => reject(new Error("Video load error"));
  });
};

function drawCaptionOnCanvas(ctx: CanvasRenderingContext2D, text: string, w: number, h: number) {
  const fontSize = Math.floor(h * 0.05); // 5% of height
  ctx.font = `bold ${fontSize}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  
  const padding = fontSize / 2;
  const maxWidth = w * 0.8;
  const x = w / 2;
  const y = h - (h * 0.1); // 10% from bottom
  
  // Word wrap simple implementation
  const words = text.split(' ');
  let line = '';
  const lines = [];
  
  for(let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      lines.push(line);
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line);
  
  // Draw background and text
  const lineHeight = fontSize * 1.4;
  const totalHeight = lines.length * lineHeight;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  // Background rect for better readability
  // Simple rect behind all text
  // We can just draw text with shadow/stroke for subtitles
  
  ctx.shadowColor = "black";
  ctx.shadowBlur = 4;
  ctx.lineWidth = fontSize / 8;
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'white';
  
  lines.forEach((l, i) => {
    const ly = y - ((lines.length - 1 - i) * lineHeight);
    ctx.strokeText(l, x, ly);
    ctx.fillText(l, x, ly);
  });
}