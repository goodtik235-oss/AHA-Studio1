export interface Caption {
  id: string;
  start: number; // seconds
  end: number;   // seconds
  text: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  EXTRACTING_AUDIO = 'EXTRACTING_AUDIO',
  TRANSCRIBING = 'TRANSCRIBING',
  TRANSLATING = 'TRANSLATING',
  GENERATING_SPEECH = 'GENERATING_SPEECH',
  RENDERING = 'RENDERING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface Language {
  code: string;
  name: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'ur-PK', name: 'Urdu' }
];