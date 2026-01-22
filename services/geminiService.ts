import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Caption } from "../types";

// NOTE: API KEY is injected via process.env.API_KEY
// DO NOT hardcode or ask user for it.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Transcribes audio using Gemini 2.5/3 Flash Multimodal.
 * Expects a WAV base64 string.
 */
export const transcribeAudio = async (
  audioBase64: string, 
  signal?: AbortSignal
): Promise<Caption[]> => {
  const ai = getAI();

  // Prompt engineering to get precise JSON
  const prompt = `
    Listen to this audio carefully. 
    Transcribe the spoken content into segments.
    Return a valid JSON array where each object has:
    - "start": start time in seconds (number)
    - "end": end time in seconds (number)
    - "text": the transcribed text (string)
    
    Ensure the segments cover the entire spoken speech.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
             inlineData: {
                mimeType: 'audio/wav',
                data: audioBase64
             }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
              text: { type: Type.STRING }
            },
            required: ['start', 'end', 'text']
          }
        }
      }
    });
    
    // Check if aborted
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const rawCaptions = JSON.parse(text);
    
    // Add unique IDs
    return rawCaptions.map((c: any, index: number) => ({
      id: `cap-${index}-${Date.now()}`,
      start: c.start,
      end: c.end,
      text: c.text
    }));

  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};

/**
 * Translates captions to the target language.
 */
export const translateCaptions = async (
  captions: Caption[], 
  targetLanguage: string,
  signal?: AbortSignal
): Promise<Caption[]> => {
  const ai = getAI();
  
  const prompt = `
    Translate the text in the following JSON array to ${targetLanguage}.
    Preserve the "start" and "end" times exactly.
    Return only the valid JSON array.
    
    Input JSON:
    ${JSON.stringify(captions.map(c => ({ start: c.start, end: c.end, text: c.text })))}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
              text: { type: Type.STRING }
            },
            required: ['start', 'end', 'text']
          }
        }
      }
    });

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const text = response.text;
    if (!text) throw new Error("No translation response");

    const translatedRaw = JSON.parse(text);

    // Map back to maintain original IDs if possible or create new ones
    return translatedRaw.map((c: any, i: number) => ({
      id: captions[i]?.id || `trans-${i}`,
      start: c.start,
      end: c.end,
      text: c.text
    }));

  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};

/**
 * Generates speech (dubbing) for the full text.
 * Returns base64 encoded audio (raw PCM usually, handled by service/audioUtils to wrap).
 */
export const generateSpeech = async (
  text: string, 
  signal?: AbortSignal
): Promise<string> => {
  const ai = getAI();
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore, Puck, Charon, Fenrir, Zephyr
            },
        },
      },
    });

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");
    
    return base64Audio;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};