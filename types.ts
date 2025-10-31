export interface Source {
  uri: string;
  title: string;
}

export type GenerationMode = 'text' | 'image' | 'code' | 'vc';
export type PerformanceMode = 'speed' | 'quality';
export type VCStatus = 'disconnected' | 'connecting' | 'connected' | 'error';


export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  type: 'text' | 'image' | 'code' | 'error';
  content: string; // Holds text, code, or base64 image data
  sources?: Source[];
}

export type ThemeName = 'nebula' | 'cyberspace' | 'solar' | 'matrix' | 'crimsonVoid' | 'stealthBlack' | 'lightMode' | 'EmbraceTheVoid';

export interface Theme {
  name: ThemeName;
  colors: {
    '--primary': string;
    '--secondary': string;
    '--background': string;
    '--surface': string;
    '--text-primary': string;
    '--text-secondary': string;
    '--error': string;
  };
}
