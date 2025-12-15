import React, { useState, useRef } from 'react';
import FileUpload from '../components/FileUpload';
import { SparklesIcon, LoadingSpinner, TrashIcon, WandIcon } from '../components/icons/index';
import { ImageResult as ImageResultType, EnhanceState, Tab, GenerationInfo } from '../types';
import ImageResult from '../components/ImageResult';
import { generateImageFromImageAndText, getBase64FromResponse, analyzeImageForFloorPlanStyle } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { fileToDataURL, fileToBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import { MODERN_MINIMALIST_STYLE, JAPANESE_STYLE, NEOCLASSICAL_STYLE } from '../stylePresets';
import CatLoadingAnimation from '../components/CatLoadingAnimation';
import PromptAssistant from '../components/PromptAssistant';
import SpeechToTextButton from '../components/SpeechToTextButton';
import ResizablePanels from '../components/ResizablePanels';

type StylePreset = 'modern' | 'japanese' | 'neoclassical' | 'custom';

const PRESETS: Record<Exclude<StylePreset, 'custom'>, string> = {
  modern: MODERN_MINIMALIST_STYLE,
  japanese: JAPANESE_STYLE,
  neoclassical: NEOCLASSICAL_STYLE,
};

interface FloorPlanColoringTabProps {
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
  onRegenerate: (info: GenerationInfo) => void;
  onSendToTraining: (state: EnhanceState) => void;
  onSendToTechDrawing: (state: EnhanceState) => void;
  onSendToUpscale: (state: EnhanceState) => void;
  onSendToVeo: (state: EnhanceState) => void;
}

// FIX: Added a return statement to the component to make it a valid React.FC.
const FloorPlanColoringTab: React.FC<FloorPlanColoringTabProps> = ({ 
    state, 
    setState, 
    onClear, 
    onEnhance, 
    onFullscreen,
    onRegenerate,
    onSendToTraining,
    onSendToTechDrawing,
    onSendToUpscale,
    onSendToVeo,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAssistantVisible, setIsAssistantVisible] = useState(false);
  
  const promptContainerRef = useRef<HTMLDivElement>(null);
  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();

  const handleFileChange = async (file: File | null, type: 'floorplan' | 'ref') => {
    if (file) {
      const dataUrl = await fileToDataURL(file);
      if (type === 'floorplan') {
        setState({ ...state, floorplanFile: file, floorplanUrl: dataUrl });
      } else {
        setState({ ...state, refImageFile: file, refImageUrl: dataUrl, selectedStylePreset: 'custom', customStylePrompt: '' });
      }
    } else {
      if (type === 'floorplan') {
        setState({ ...state, floorplanFile: null, floorplanUrl: null });
      } else {
        setState({ ...state, refImageFile: null, refImageUrl: null, selectedStylePreset: 'modern' });
      }
    }
  };
  
  const handleAnalyzeStyle = async () => {
      if (!state.refImageFile) {
          setError(t('floorPlanColoring.error.noRefImage'));
          return;
      }
      setIsAnalyzing(true);
      setError(null);
      try {
          const { base64, mimeType } = await fileToBase64(state.refImageFile);
          const stylePrompt = await analyzeImageForFloorPlanStyle(base64, mimeType);
          setState({ ...state, customStylePrompt: stylePrompt });
      } catch(e) {
          console.error(e);
          setError(t('training.error.analyzeFailed'));
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleGenerate = async () => {
    if (!state.floorplanFile) {
      setError(t('render.error.noImageGenerate'));
      return;
    }
    
    const stylePrompt = state.selectedStylePreset === 'custom' ? state.customStylePrompt : PRESETS[state.selectedStylePreset];

    if (!stylePrompt) {
        setError(t('floorPlanColoring.error.noStyle'));
        return;
    }

    setIsGenerating(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, result: null }));

    try {
      const { base64, mimeType } = await fileToBase64(state.floorplanFile);
      
      const perspectiveInstruction = state.renderTopViewOnly
            ? "The output MUST be a strictly 2D, top-down, orthographic plan view. Do not add any perspective or 3D effects."
            : "The output should be a top-down view with very subtle depth, like soft ambient occlusion shadows, to make it feel like";
      
      const fullPrompt = `
        **TASK:** You are an AI architectural visualizer specializing in creating beautifully colored and textured 2D floor plans.
        
        **INPUT:** You will be given a simple black and white 2D floor plan.
        
        **STYLE GUIDE (CRITICAL):** You must strictly follow this Python-style dictionary to define the aesthetic. This is your primary instruction for all visual choices.
        \`\`\`python
        ${stylePrompt}
        \`\`\`
        
        **ADDITIONAL USER INSTRUCTIONS:** "${state.prompt || 'None'}"
        
        **UNBREAKABLE RULES:**
        1.  **PRESERVE LAYOUT:** The wall layout from the input black and white plan is absolute. DO NOT change wall positions, add rooms, or alter the core architecture.
        2.  **APPLY STYLE:** Color the floors, add furniture symbols, and apply textures exactly as described in the "STYLE GUIDE".
        3.  **PERSPECTIVE:** ${perspectiveInstruction}
        4.  **CLEAN OUTPUT:** The final image should be a clean, high-quality colored floor plan. Do not include any text, dimensions, or annotations unless they are part of the style (e.g., room labels).
      `;

      const response = await generateImageFromImageAndText(fullPrompt, base64, mimeType);
      const resultB64 = getBase64FromResponse(response);
      
      if (resultB64) {
        const generationState = { ...state, floorplanFile: null, floorplanUrl: `data:${mimeType};base64,${base64}` };
        const newResult: ImageResultType = {
          id: nanoid(),
          base64: resultB64,
          mimeType: 'image/jpeg',
          generationInfo: {
            originTab: Tab.FloorPlanColoring,
            state: generationState,
          }
        };
        setState((prevState: any) => ({ ...prevState, result: newResult }));
        addMedia(newResult);
        decrementQuota(10);
      } else {
        setError(t('render.error.noImageInResponse'));
      }

    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.toLowerCase().includes('quota')) {
        setError(t('error.apiQuotaExceeded'));
        forceQuotaDepletion();
      } else {
        setError(t('render.error.generateFailed'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePromptFocus = () => setIsAssistantVisible(true);
  const handlePromptBlur = (e: React.FocusEvent) => {
      if (promptContainerRef.current && !promptContainerRef.current.contains(e.relatedTarget as Node)) {
          setIsAssistantVisible(false);
      }