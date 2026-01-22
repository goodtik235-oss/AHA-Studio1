/**
 * Extracts audio from a video file and returns it as a base64 encoded string (WAV format).
 * Note: This is a memory-intensive operation suitable for short clips in browser.
 */
export const extractAudioFromVideo = async (videoFile: File): Promise<string> => {
  const arrayBuffer = await videoFile.arrayBuffer();
  // Fix: Cast window to any to access webkitAudioContext for Safari compatibility
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Decode the audio data from the video file
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Convert AudioBuffer to WAV
  const wavBlob = bufferToWav(audioBuffer);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(wavBlob);
  });
};

/**
 * Converts a base64 string to a Blob (WAV).
 */
export const base64ToWavBlob = (base64: string, sampleRate = 24000): Blob => {
   const byteCharacters = atob(base64);
   const byteNumbers = new Array(byteCharacters.length);
   for (let i = 0; i < byteCharacters.length; i++) {
     byteNumbers[i] = byteCharacters.charCodeAt(i);
   }
   const byteArray = new Uint8Array(byteNumbers);
   
   // The TTS model returns raw PCM, we need to wrap it in a WAV header or play as PCM.
   // However, for standard browser <audio> support, WAV container is best.
   // Note: Gemini TTS returns raw PCM (no header).
   // We need to construct a WAV header for the PCM data.
   
   return createWavFileFromPCM(byteArray, sampleRate);
};

// Helper to convert AudioBuffer to WAV Blob (standard format for upload)
function bufferToWav(abuffer: AudioBuffer) {
  const numOfChan = abuffer.numberOfChannels;
  const length = abuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this specific helper)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while (pos < abuffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([buffer], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

// Helper to wrap raw PCM in WAV header
function createWavFileFromPCM(pcmData: Uint8Array, sampleRate: number): Blob {
    const numChannels = 1; // Gemini TTS is usually mono
    const bitsPerSample = 16; // 16-bit PCM
    
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;
    
    // RIFF identifier
    view.setUint32(0, 0x52494646, false); // 'RIFF'
    // file length
    view.setUint32(4, fileSize, true);
    // RIFF type
    view.setUint32(8, 0x57415645, false); // 'WAVE'
    // format chunk identifier
    view.setUint32(12, 0x666d7420, false); // 'fmt '
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sampleRate * blockAlign)
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    // bits per sample
    view.setUint16(34, bitsPerSample, true);
    // data chunk identifier
    view.setUint32(36, 0x64617461, false); // 'data'
    // data chunk length
    view.setUint32(40, dataSize, true);
    
    return new Blob([header, pcmData], { type: 'audio/wav' });
}