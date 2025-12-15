export const VERIFICATION_TOKEN = 'U1VEWV9BUkNISVRFQ1RVUkVfSU5URUdSSVRZX0NIRUNLXzEyMzQ1MTIzNDVfREVWRUxPUEVEX0JZX1RSVU9OR19ESUVOX0RVWV9WJk5fMjAyNA==';

export enum Tab {
  Welcome = 'Welcome',
  Enhance = 'Enhance',
  QuickGenerate = 'QuickGenerate',
  RenderAI = 'RenderAI',
  FloorPlanRender = 'FloorPlanRender',
  FloorPlanColoring = 'FloorPlanColoring',
  ImageFromReference = 'ImageFromReference',
  TechnicalDrawing = 'TechnicalDrawing',
  Upscale4K = 'Upscale4K',
  Veo = 'Veo',
  VirtualTour = 'VirtualTour',
  ImageLibrary = 'ImageLibrary',
}

export interface GenerationInfo {
  originTab: Tab;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any;
}

export interface ImageResult {
  id: string;
  base64: string;
  mimeType: string;
  generationInfo?: GenerationInfo;
  isLineArt?: boolean;
  commentary?: string;
}

export interface VideoResult {
    id: string;
    url: string; // This will be a blob URL
    posterBase64: string; // Thumbnail
    generationInfo?: GenerationInfo;
}

export interface EnhanceState {
  image: string;
  mimeType: string;
}

export enum Theme {
    Light = 'light',
    Dark = 'dark',
    System = 'system',
    Pink = 'pink',
    Halloween = 'halloween',
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  imagePreview?: string;
  imageFile?: File;
  botAction?: {
    tab: Tab;
    prompt?: string;
    buttonText: string;
  };
  suggestedPrompt?: string;
  suggestions?: { text: string; targetTab?: Tab; prompt?: string }[];
  proactiveContext?: {
    imageFile: File;
    trigger: 'upload' | 'generation';
    sourceTab: Tab;
    uploadContext?: string;
  };
  isLoadingMore?: boolean;
}

export interface ChatContext {
    lastGeneratedImage?: { base64: string, mimeType: string };
    recentMessages: Message[];
    activeTab: Tab;
    isTampered: boolean;
    recentImageHashes: string[];
    isActivated: boolean;
}

export interface LoraFileContent {
  refImages: { base64: string; mimeType: string; name: string }[];
  stylePrompt: string; // This will now store a JSON string with the style analysis.
  moodboardImage: string; // This is the base64 of the generated moodboard image.
}