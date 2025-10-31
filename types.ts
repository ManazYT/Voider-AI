export interface Source {
  uri: string;
  title: string;
}

export type GenerationMode = 'text' | 'imageGen' | 'imageEdit' | 'videoGen' | 'code' | 'vc';
export type PerformanceMode = 'speed' | 'quality';
export type VCStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface AttachedFile {
  name: string;
  type: string;
  data: string; // base64
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  type: 'text' | 'image' | 'code' | 'error' | 'video';
  content: string; // Holds text, code, base64 image data, or loading messages
  sources?: Source[];
  videoUri?: string; // URI for generated video
  isLoading?: boolean; // For long-running tasks like video generation
  attachedFile?: AttachedFile; // To show the user's uploaded image with their prompt
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
