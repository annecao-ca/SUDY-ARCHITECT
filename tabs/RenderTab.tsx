import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import FileUpload from '../components/FileUpload';
import SelectInput from '../components/SelectInput';
import Slider from '../components/Slider';
import { SparklesIcon, LoadingSpinner, WandIcon, TrashIcon, FolderOpenIcon, LockClosedIcon, PaintBrushIcon } from '../components/icons/index';
import { ASPECT_RATIO_KEYS } from '../constants';
import { ImageResult as ImageResultType, EnhanceState, Tab, GenerationInfo } from '../types';
import SideBySideComparison from '../components/SideBySideComparison';
import { getBase64FromResponse, generateImageFromImageAndText, generateWithContext, generateImageFromTextAndImages, analyzeImageForInspiration, prepareGoogleMapPrompt } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { fileToDataURL, fileToBase64, dataURLtoBase64, base64ToFile, extendImageToAspectRatio } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';
import { useActivation } from '../contexts/ActivationContext';
import InpaintingModal from '../components/InpaintingModal';
import CatLoadingAnimation from '../components/CatLoadingAnimation';
import PromptAssistant from '../components/PromptAssistant';
import SpeechToTextButton from '../components/SpeechToTextButton';
import ResizablePanels from '../components/ResizablePanels';
import ImageResult from '../components/ImageResult';


const PromptBank: React.FC<{ 
    activeCategory: string;
    setActiveCategory: (category: string) => void;
    onSelect: (prompt: string) => void 
}> = ({ activeCategory, setActiveCategory, onSelect }) => {
    const { t } = useTranslation();
    const categories = ['exterior', 'interior', 'landscape', 'planning'];

    const getPromptsForCategory = (category: string): string[] => {
        try {
            const key = `promptBank.${category}.prompts`;
            const promptsJson = t(key);
            if (promptsJson === key) return []; // Translation not found
            return JSON.parse(promptsJson);
        } catch (e) {
            console.error(`Failed to parse prompts for category: ${category}`, e);
            return [];
        }
    };
    
    return (
        <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-3">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.promptBank.title')}</h3>
            <div className="flex border-b border-gray-300 dark:border-gray-700 mb-2 overflow-x-auto no-scrollbar">
                {categories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${activeCategory === cat ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border-b-2 border-transparent'}`}
                    >
                        {t(`render.promptBank.${cat}`)}
                    </button>
                ))}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {getPromptsForCategory(activeCategory).map((prompt, index) => (
                    <button
                        key={`${activeCategory}-${index}`}
                        onClick={() => onSelect(prompt)}
                        className="w-full text-left text-xs p-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                        {prompt}
                    </button>
                ))}
            </div>
        </div>
    );
};

const INSPIRATION_OPTIONS = ['geometry', 'material', 'style', 'mood', 'representation', 'lighting', 'color_palette', 'character'];

interface RenderTabProps {
  initialState: EnhanceState | null;
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
  onConsumeInitialState: () => void;
  onRegenerate: (info: GenerationInfo) => void;
  onSendToTraining: (state: EnhanceState) => void;
  onSendToTechDrawing: (state: EnhanceState) => void;
  onSendToUpscale: (state: EnhanceState) => void;
  onSendToVeo: (state: EnhanceState) => void;
  onSendToRenderAIMain: (state: EnhanceState) => void;
}

const getImageDimensions = (dataUrl: string): Promise<{ width: number, height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
};

const RenderTab: React.FC<RenderTabProps> = ({ 
    initialState, 
    state, 
    setState, 
    onClear, 
    onEnhance, 
    onFullscreen, 
    onConsumeInitialState,
    onRegenerate,
    onSendToTraining,
    onSendToTechDrawing,
    onSendToUpscale,
    onSendToVeo,
    onSendToRenderAIMain,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styleFileInputRef = useRef<HTMLInputElement>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isAssistantVisible, setIsAssistantVisible] = useState(false);
  const promptContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();
  const { isActivated, openActivationModal } = useActivation();

  const translatedAspectRatios = useMemo(() => ASPECT_RATIO_KEYS.map(key => t(key)), [t]);
  
  const handleFileChange = useCallback(async (file: File | null) => {
    if (file) {
      const dataUrl = await fileToDataURL(file);
      const dimensions = await getImageDimensions(dataUrl);
      setImageDimensions(dimensions);
      setState((prevState: any) => ({ 
        ...prevState, 
        mainImageFile: file, 
        mainImageUrl: dataUrl, 
        processedImageUrl: dataUrl,
        aspectRatio: 'aspect.original',
        adaptationMode: null,
      }));
    } else {
      setState((prevState: any) => ({ ...prevState, mainImageFile: null, mainImageUrl: null, processedImageUrl: null }));
      setImageDimensions(null);
    }
  }, [setState]);
  
  const handleContextFileChange = useCallback(async (file: File | null) => {
    if (file) {
      const dataUrl = await fileToDataURL(file);
      setState((prevState: any) => ({ 
        ...prevState, 
        contextImageFile: file, 
        contextImageUrl: dataUrl,
        contextInpaintedUrl: null, // Reset when new image is uploaded
        contextDrawingDataUrl: null,
      }));
    } else {
      setState((prevState: any) => ({ 
        ...prevState, 
        contextImageFile: null, 
        contextImageUrl: null,
        contextInpaintedUrl: null,
        contextDrawingDataUrl: null,
      }));
    }
  }, [setState]);


  useEffect(() => {
    if (initialState) {
        const file = base64ToFile(initialState.image, `render-ai-source-${nanoid(5)}.jpg`, initialState.mimeType);
        handleFileChange(file);
        onConsumeInitialState();
    }
  }, [initialState, handleFileChange, onConsumeInitialState]);

  const handleRefImageChange = async (file: File | null) => {
    if (file) {
        const dataUrl = await fileToDataURL(file);
        setState({ ...state, refImageFile: file, refImageUrl: dataUrl });
    } else {
        setState({ ...state, refImageFile: null, refImageUrl: null });
    }
  };

  const handleInspirationChange = (option: string) => {
    setState((prevState: any) => {
        const newOptions = prevState.inspirationOptions.includes(option)
            ? prevState.inspirationOptions.filter((o: string) => o !== option)
            : [...prevState.inspirationOptions, option];
        return { ...prevState, inspirationOptions: newOptions };
    });
  };

  const parseAspectRatio = useCallback((ratioStr: string): number | null => {
      if (!ratioStr || ratioStr === t('aspect.original')) return null;
      const ratioMatch = ratioStr.match(/(\d+:\d+)/);
      if (!ratioMatch) return null;

      const [w, h] = ratioMatch[0].split(':').map(Number);
      if (isNaN(w) || isNaN(h) || h === 0) return null;
      return w / h;
  }, [t]);

  useEffect(() => {
    const processImage = async () => {
        if (!state.mainImageUrl || !imageDimensions || state.aspectRatio === 'aspect.original') {
            if(state.mainImageUrl) setState((s:any) => ({...s, processedImageUrl: s.mainImageUrl}));
            return;
        }

        const targetAspectRatio = parseAspectRatio(t(state.aspectRatio));
        if (targetAspectRatio === null) return;

        const originalAspectRatio = imageDimensions.width / imageDimensions.height;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = new Image();
        img.onload = () => {
            if (state.adaptationMode === 'crop') {
                let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
                if (targetAspectRatio > originalAspectRatio) { // Taller than target
                    sHeight = img.width / targetAspectRatio;
                    sy = (img.height - sHeight) / 2;
                } else { // Wider than target
                    sWidth = img.height * targetAspectRatio;
                    sx = (img.width - sWidth) / 2;
                }
                canvas.width = sWidth;
                canvas.height = sHeight;
                ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

            } else if (state.adaptationMode === 'extend') {
                let newWidth, newHeight;
                if (targetAspectRatio > originalAspectRatio) { // Wider than original
                    newWidth = img.height * targetAspectRatio;
                    newHeight = img.height;
                } else { // Taller than original
                    newWidth = img.width;
                    newHeight = img.width / targetAspectRatio;
                }
                canvas.width = newWidth;
                canvas.height = newHeight;
                
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                const dx = (newWidth - img.width) / 2;
                const dy = (newHeight - img.height) / 2;

                ctx.drawImage(img, dx, dy);
            }
             setState((s:any) => ({...s, processedImageUrl: canvas.toDataURL('image/jpeg')}));
        };
        img.src = state.mainImageUrl;
    };
    processImage();
  }, [state.aspectRatio, state.adaptationMode, state.mainImageUrl, imageDimensions, t, parseAspectRatio, setState]);

  const getPromptsForCategory = (category: string): string[] => {
    try {
        const key = `promptBank.${category}.prompts`;
        const promptsJson = t(key);
        if (promptsJson === key) return []; // Translation not found
        return JSON.parse(promptsJson);
    } catch (e) {
        console.error(`Failed to parse prompts for category: ${category}`, e);
        return [];
    }
  };


  const handleGenerate = async () => {
    if (!state.processedImageUrl) {
      setError(t('render.error.noImageGenerate'));
      return;
    }
    setIsGenerating(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, results: []}));

    try {
        const generationState = { ...state, mainImageFile: null, mainImageUrl: state.mainImageUrl, processedImageUrl: state.processedImageUrl, refImageFile: null, refImageUrl: null };

        // New Google Maps image detection workflow
        const mainImageForAnalysis = dataURLtoBase64(state.mainImageUrl); // Always analyze original
        const googleMapPrompt = await prepareGoogleMapPrompt(mainImageForAnalysis, state.prompt, language);

        if (googleMapPrompt) {
            // It's a Google Maps image, run the special generation
            const response = await generateImageFromImageAndText(googleMapPrompt, mainImageForAnalysis.base64, mainImageForAnalysis.mimeType);
            const b64 = getBase64FromResponse(response);
            if(b64) {
                 const newResult = { 
                  id: nanoid(), 
                  base64: b64, 
                  mimeType: 'image/jpeg',
                  generationInfo: { originTab: Tab.RenderAI, state: generationState }
                };
                setState((prevState: any) => ({ ...prevState, results: [newResult] }));
                addMedia(newResult);
                decrementQuota(15);
            } else {
                setError(t('render.error.noImageInResponse'));
            }

        } else if (state.useContextImage && state.contextInpaintedUrl) {
            // Existing context image workflow
            const mainImageInfo = dataURLtoBase64(state.processedImageUrl);
            const contextImageInfo = dataURLtoBase64(state.contextInpaintedUrl);
            const response = await generateWithContext(
                mainImageInfo,
                contextImageInfo,
                state.prompt,
                state.loraPrompt, // Context mode doesn't use inspiration analysis for now
                state.sharpnessAdherence
            );
            const b64 = getBase64FromResponse(response);
            if(b64) {
                 const newResult = { 
                  id: nanoid(), 
                  base64: b64, 
                  mimeType: 'image/jpeg',
                  generationInfo: { originTab: Tab.RenderAI, state: generationState }
                };
                setState((prevState: any) => ({ ...prevState, results: [newResult] }));
                addMedia(newResult);
                decrementQuota(15);
            } else {
                setError(t('render.error.noImageInResponse'));
            }
        } else {
            // Standard generation workflow
            const sourceImageInfo = dataURLtoBase64(state.processedImageUrl);
            const imagesToGenerate = [sourceImageInfo];
            let styleAnalysis = '';
            let characterInstruction = '';

            if (state.refImageFile) {
                setIsAnalyzing(true);
                const characterSelected = state.inspirationOptions.includes('character');
                const ratioMatch = t(state.aspectRatio).match(/(\d+:\d+)/);
                let refImageInfo;
                
                if (characterSelected && state.aspectRatio !== 'aspect.original' && ratioMatch) {
                    const targetAspectRatioNumber = (() => {
                        const [w, h] = ratioMatch[0].split(':').map(Number);
                        return h > 0 ? w / h : 1;
                    })();
                    refImageInfo = await extendImageToAspectRatio(state.refImageFile, targetAspectRatioNumber);
                } else {
                    refImageInfo = await fileToBase64(state.refImageFile);
                }

                imagesToGenerate.push(refImageInfo);

                let optionsToAnalyze = state.inspirationOptions;
                if (optionsToAnalyze.length === 0) {
                    optionsToAnalyze = ['style'];
                }
                
                const styleOptions = optionsToAnalyze.filter((opt: string) => opt !== 'character');

                if (styleOptions.length > 0) {
                   const originalRefImageInfo = await fileToBase64(state.refImageFile);
                   styleAnalysis = await analyzeImageForInspiration(originalRefImageInfo, styleOptions, language);
                }

                if (characterSelected) {
                    characterInstruction = `
**UNBREAKABLE RULE #3: INSERT CHARACTER & APPLY CINEMATIC COMPOSITION.**
- **INSERT CHARACTER:** The mood reference image (provided as the second image after this prompt) also contains a person. You **MUST** perfectly replicate this person (their exact face, clothing, and appearance) and place them naturally within the newly rendered scene. The person should complement the architecture, not be the main focus.
- **APPLY CINEMATIC COMPOSITION:** The overall composition MUST be cinematic and dynamic. Use principles like the **Rule of Thirds**, **leading lines**, **depth**, and **framing** to create a visually interesting image. Position the character and architectural elements thoughtfully to create balance or tension. Avoid flat, static compositions.
                    `;
                }
                setIsAnalyzing(false);
            }
            
            const imageSourceDescription = state.useLineArt
                ? "The first image provided is line art. Use it for the subject's structure but apply materials based on the style guide. Do not render the black lines."
                : "The first image provided is the full-color source. Use it as the primary base for structure and materials.";

            const ratioMatch = t(state.aspectRatio).match(/(\d+:\d+)/);
            const validAspectRatio = state.aspectRatio !== 'aspect.original' && ratioMatch ? ratioMatch[0] : null;
            let aspectRatioInstruction = '';
            if (validAspectRatio) {
                const ruleIndex = characterInstruction ? 4 : 3;
                aspectRatioInstruction = `
**UNBREAKABLE RULE #${ruleIndex}: OUTPUT ASPECT RATIO.**
The final generated image **MUST** have an aspect ratio of **${validAspectRatio}**. This is a mandatory, non-negotiable output format. Do NOT derive the aspect ratio from any of the reference images; you MUST use ${validAspectRatio}.
                `;
            }

            const promptStructure = `
                **TASK:** Photorealistically render a new image by combining a main subject from a source image with a new atmosphere and style.
                ${imagesToGenerate.length > 1 ? `**INPUTS:**\n1. **Source Image:** Contains the primary architectural subject.\n2. **Mood Reference Image:** Contains style cues (and possibly a person).` : ''}

                **UNBREAKABLE RULE #1: PRESERVE THE SUBJECT'S MATERIALS.**
                You are given a source image containing a primary architectural subject. You **MUST** identify this subject (e.g., a building, an interior room). The materials, textures, and colors of **THIS SUBJECT** must be **PRESERVED EXACTLY** as they are in the source image. This is the highest priority instruction.

                **UNBREAKABLE RULE #2: APPLY NEW ATMOSPHERE.**
                The "STYLE GUIDE" below defines the new **ENVIRONMENT, ATMOSPHERE, LIGHTING, and COLOR PALETTE** for the entire scene. You must place the preserved subject into this new context.
                
                ${characterInstruction}

                ${aspectRatioInstruction}
                ---
                **SOURCE IMAGE CONTEXT:**
                -   ${imageSourceDescription}

                **STYLE GUIDE (from mood reference image):**
                """
                ${styleAnalysis || 'Not specified. Rely on User Prompt and LoRA Style.'}
                """

                **USER PROMPT (specific instructions):**
                """
                {{USER_PROMPT}}
                """
                
                **LoRA STYLE (technical details):**
                """
                ${state.loraPrompt || 'Not specified.'}
                """

                **TECHNICAL REQUESTS:**
                - **Structural Adherence (0=Creative, 10=Strict):** ${state.sharpnessAdherence}
                
                **NEGATIVE PROMPTS:** Do not change the materials of the main building. No watermarks, text, signatures. Avoid blurry, out of focus, cgi, render, unreal engine, fake results.
            `;
            
            const generationPromises = [];
            const randomPrompts = state.useRandomPrompts ? getPromptsForCategory(state.promptBankCategory) : [];
            const numResults = state.useContextImage ? 1 : state.numResults;

            for (let i = 0; i < numResults; i++) {
                let currentPrompt = state.prompt;
                if (state.useRandomPrompts && randomPrompts.length > 0) {
                    currentPrompt = randomPrompts[Math.floor(Math.random() * randomPrompts.length)];
                }
                const fullPrompt = promptStructure.replace('{{USER_PROMPT}}', currentPrompt);
                
                if (imagesToGenerate.length > 1) {
                    generationPromises.push(generateImageFromTextAndImages(fullPrompt, imagesToGenerate));
                } else {
                    generationPromises.push(generateImageFromImageAndText(fullPrompt, imagesToGenerate[0].base64, imagesToGenerate[0].mimeType));
                }
            }

            const responses = await Promise.all(generationPromises);
            
            const newResults = responses
                .map((res): ImageResultType | null => {
                    const b64 = getBase64FromResponse(res);
                    if (!b64) return null;
                    return { id: nanoid(), base64: b64, mimeType: 'image/jpeg', generationInfo: { originTab: Tab.RenderAI, state: generationState }};
                })
                .filter((r): r is ImageResultType => r !== null);
            
            if (newResults.length > 0) {
                setState((prevState: any) => ({ ...prevState, results: newResults }));
                newResults.forEach(addMedia);
                decrementQuota(10 * generationPromises.length);
            } else {
                 setError(t('render.error.noImageInResponse'));
            }
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
      setIsAnalyzing(false);
    }
  };
  
  const handleLoadStyleFileClick = () => {
    if (!isActivated) {
      openActivationModal();
    } else {
      styleFileInputRef.current?.click();
    }
  };

  const handleStyleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const json = JSON.parse(content);
                // Check for new .lora format first, then fall back to old .json format
                if (json.stylePrompt && typeof json.stylePrompt === 'string') {
                    setState({ ...state, loraPrompt: json.stylePrompt });
                    setError(null);
                } else if (json.trainedStylePrompt && typeof json.trainedStylePrompt === 'string') {
                    setState({ ...state, loraPrompt: json.trainedStylePrompt });
                    setError(null);
                } else {
                     // Fallback for this tab's specific auto-analysis format which might be a full JSON object
                    setState({ ...state, loraPrompt: JSON.stringify(json, null, 2) });
                    setError(null);
                }
            } catch (err) {
                setError(t('render.error.readJsonFailed'));
                console.error(err);
            }
        };
        reader.readAsText(file);
    }
    if(e.target) e.target.value = '';
  };
  
  const handlePromptFocus = () => {
    setIsAssistantVisible(true);
  };
  
  const handlePromptBlur = (e: React.FocusEvent) => {
    if (promptContainerRef.current && !promptContainerRef.current.contains(e.relatedTarget as Node)) {
        setIsAssistantVisible(false);
    }
  };

  const handleTranscript = (transcript: string) => {
    setState((prevState: any) => ({
      ...prevState,
      prompt: prevState.prompt ? `${prevState.prompt} ${transcript}` : transcript
    }));
  };
  
  const handleRefDragStart = (e: React.DragEvent) => {
    if (state.refImageFile) {
        e.dataTransfer.setData('application/sudy-instant-style', 'true');
        e.dataTransfer.effectAllowed = 'copy';
    }
  };
  
  const handleInstantStyleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.getData('application/sudy-instant-style') === 'true') {
        if (!state.mainImageFile) {
            setError(t('render.error.noImageGenerate'));
            return;
        }
        if (canGenerate) {
            handleGenerate();
        } else {
            setError(t('render.error.noImageGenerate'));
        }
    }
  };


  const canGenerate = !isGenerating && !isAnalyzing && !!state.processedImageUrl && (state.aspectRatio === 'aspect.original' || !!state.adaptationMode);

  const leftPanel = (
    <div className="w-full h-full bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 overflow-y-auto no-scrollbar">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t(Tab.RenderAI)}</h2>
        <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
      
      <FileUpload id={`main-upload-render`} onFileChange={handleFileChange} previewUrl={state.mainImageUrl} onClear={() => handleFileChange(null)} containerClassName="h-32" />

      {state.mainImageUrl && (
        <>
          <div className="grid grid-cols-1 gap-4 items-start">
              <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.upload.ref.title')}</h3>
                  <FileUpload 
                    id={`ref-upload-render`} 
                    onFileChange={handleRefImageChange} 
                    previewUrl={state.refImageUrl} 
                    onClear={() => setState({...state, refImageFile: null, refImageUrl: null, inspirationOptions: []})} 
                    containerClassName="h-32" 
                    draggable={!!state.refImageFile}
                    onDragStart={handleRefDragStart}
                  />
              </div>
          </div>

          {state.refImageUrl && (
              <div className="p-3 bg-gray-200 dark:bg-gray-900/50 rounded-md space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('quickGenerate.inspiration.title')}</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                      {INSPIRATION_OPTIONS.map(option => (
                          <div key={option} className="relative group">
                              <label className="flex items-center space-x-2 p-2 rounded-md bg-gray-50 dark:bg-gray-800 cursor-pointer">
                                  <input
                                      type="checkbox"
                                      checked={state.inspirationOptions.includes(option)}
                                      onChange={() => handleInspirationChange(option)}
                                      className="form-checkbox h-4 w-4 text-blue-600 bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm text-gray-800 dark:text-gray-200">{t(`inspiration.${option}`)}</span>
                              </label>
                              <div className="absolute bottom-full mb-2 w-64 p-2 text-xs text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                  {t(`inspiration.tooltip.${option}`)}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          <div className="border-t border-gray-300 dark:border-gray-700 pt-4 mt-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                      type="checkbox"
                      checked={state.useContextImage}
                      onChange={(e) => setState({...state, useContextImage: e.target.checked})}
                      className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('render.useContext')}</span>
              </label>
          </div>

          {state.useContextImage && (
              <div className="space-y-3 p-3 bg-gray-200 dark:bg-gray-900/50 rounded-lg border border-gray-300 dark:border-gray-700">
                  <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">{t('render.upload.context')}</h3>
                  <FileUpload id="context-upload" onFileChange={handleContextFileChange} previewUrl={state.contextInpaintedUrl || state.contextImageUrl} onClear={() => handleContextFileChange(null)} containerClassName="h-32" />
                  {state.contextImageUrl && (
                      <button
                          onClick={() => setState({...state, isContextModalOpen: true})}
                          className="w-full text-sm bg-indigo-600 text-white font-bold py-2 px-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2"
                      >
                          <PaintBrushIcon className="w-4 h-4" />
                          <span>{t('render.button.markPosition')}</span>
                      </button>
                  )}
                  {state.contextInpaintedUrl && <p className="text-xs text-green-600 dark:text-green-400 text-center">{t('render.context.marked')}</p>}
              </div>
          )}
          
          <div
              ref={promptContainerRef}
              onBlur={handlePromptBlur}
              className="relative"
          >
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.prompt.title')}</h3>
               <PromptAssistant
                  isVisible={isAssistantVisible}
                  currentPrompt={state.prompt}
                  onPromptUpdate={(newPrompt) => setState({ ...state, prompt: newPrompt })}
                  imageDataUrl={state.processedImageUrl || state.refImageUrl}
                  language={language}
              />
              <div className="relative">
                <textarea
                    value={state.prompt}
                    onChange={(e) => setState({ ...state, prompt: e.target.value })}
                    placeholder={t('render.prompt.placeholder')}
                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-24 resize-none pr-12"
                    disabled={state.useRandomPrompts}
                    onFocus={handlePromptFocus}
                />
                <div className="absolute bottom-2 right-2">
                    <SpeechToTextButton onTranscript={handleTranscript} language={language} />
                </div>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer mt-2">
                  <input
                      type="checkbox"
                      checked={state.useRandomPrompts}
                      onChange={(e) => setState({...state, useRandomPrompts: e.target.checked})}
                      className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('enhance.useRandomPrompts')}</span>
              </label>
          </div>
          
          {language === 'vi' && <PromptBank 
              activeCategory={state.promptBankCategory}
              setActiveCategory={(cat) => setState({...state, promptBankCategory: cat})}
              onSelect={(p) => setState({ ...state, prompt: p })} 
          />}

           <div>
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.lora.title')}</h3>
              <textarea
                  value={state.loraPrompt}
                  onChange={(e) => setState({ ...state, loraPrompt: e.target.value })}
                  placeholder={t('render.lora.placeholder')}
                  className="w-full bg-white dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-md p-2 h-24 resize-none font-mono text-xs"
              />
              <div className="flex items-center gap-2 pt-2">
                  <input type="file" accept=".json,.lora" ref={styleFileInputRef} onChange={handleStyleFileChange} className="hidden" />
                  <button 
                    onClick={handleLoadStyleFileClick} 
                    title={!isActivated ? t('tooltip.requiresActivation') : t('training.button.loadStyleFile')}
                    className={`w-full text-sm bg-gray-300/80 dark:bg-gray-700/80 text-gray-800 dark:text-white font-medium py-2 px-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 ${!isActivated ? 'opacity-50 cursor-pointer' : ''}`}
                  >
                      <FolderOpenIcon className="w-4 h-4" />
                      <span>{t('training.button.loadStyleFile')}</span>
                      {!isActivated && <LockClosedIcon className="w-3 h-3 text-yellow-500 ml-1" />}
                  </button>
                  {state.loraPrompt && (
                      <button onClick={() => setState({...state, loraPrompt: ''})} className="p-2 bg-red-500/20 text-red-500 rounded-md hover:bg-red-500/40">
                          <TrashIcon className="w-4 h-4" />
                      </button>
                  )}
              </div>
              {state.loraPrompt && <p className="text-xs text-green-600 dark:text-green-400 px-1 pt-1">{t('render.lora.loaded')}</p>}
          </div>
          
          <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-6">
              <SelectInput 
                  label={t('render.options.aspectRatio')} 
                  options={translatedAspectRatios} 
                  value={t(state.aspectRatio)} 
                  onChange={(val) => {
                      const key = ASPECT_RATIO_KEYS[translatedAspectRatios.indexOf(val)] || 'aspect.original';
                      const adaptationRequired = key !== 'aspect.original';
                      setState({ ...state, aspectRatio: key, adaptationMode: adaptationRequired ? 'crop' : null });
                  }} 
              />
               {state.aspectRatio !== 'aspect.original' && (
                  <div className="p-3 bg-gray-200 dark:bg-gray-900/50 rounded-md -mt-3">
                      <p className="text-sm font-medium mb-2">{t('enhance.options.adaptationPrompt')}</p>
                      <div className="flex space-x-2">
                           <button onClick={() => setState({ ...state, adaptationMode: 'crop' })} className={`w-full py-2 rounded-md text-sm transition-colors ${state.adaptationMode === 'crop' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-300'}`}>{t('enhance.options.adaptationCrop')}</button>
                          <button onClick={() => setState({ ...state, adaptationMode: 'extend' })} className={`w-full py-2 rounded-md text-sm transition-colors ${state.adaptationMode === 'extend' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-300'}`}>{t('enhance.options.adaptationExtend')}</button>
                      </div>
                  </div>
              )}
              {!state.useContextImage && <Slider label={t('render.options.resultCount')} min={1} max={6} step={1} value={state.numResults} onChange={(v) => setState({ ...state, numResults: v })} />}
              <Slider label={t('render.options.sharpnessAdherence')} min={0} max={10} step={1} value={state.sharpnessAdherence} onChange={(v) => setState({ ...state, sharpnessAdherence: v })} />
              <p className="text-xs text-gray-500 -mt-3 px-1">{t('render.options.sharpnessAdherence.hint')}</p>
               <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                      type="checkbox"
                      checked={state.useLineArt}
                      onChange={(e) => setState({...state, useLineArt: e.target.checked})}
                      className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('render.options.useLineArt')}</span>
              </label>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 flex items-center justify-center space-x-2"
          >
            {isGenerating || isAnalyzing ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
            <span>{isGenerating ? t('render.button.generating') : isAnalyzing ? t('render.button.analyzing') : t('render.button.generate')}</span>
          </button>
        </>
      )}
    </div>
  );

  const rightPanel = (
    <div 
      className={`w-full h-full bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 overflow-y-auto no-scrollbar flex justify-center items-start transition-all ${isDraggingOver ? 'border-4 border-dashed border-blue-500 bg-blue-900/20' : 'border-transparent'}`}
      onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/sudy-instant-style')) {
              e.preventDefault();
          }
      }}
      onDragEnter={(e) => {
          if (e.dataTransfer.types.includes('application/sudy-instant-style') && state.mainImageFile) {
              e.preventDefault();
              setIsDraggingOver(true);
          }
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleInstantStyleDrop}
    >
      {(isGenerating || isAnalyzing) ? (
        <CatLoadingAnimation text={t('render.status.generating')} />
      ) : error ? (
          <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md">{error}</div>
      ) : state.results.length === 1 ? (
          <SideBySideComparison
              key={state.results[0].id}
              originalImageSrc={state.useContextImage ? state.contextInpaintedUrl : state.processedImageUrl}
              generatedResult={state.results[0]}
              onFullscreen={() => onFullscreen(state.results, 0)}
              onEnhance={onEnhance}
              onRegenerate={onRegenerate}
              onSendToTraining={onSendToTraining}
              onSendToTechDrawing={onSendToTechDrawing}
              onSendToUpscale={onSendToUpscale}
              onSendToVeo={onSendToVeo}
              onSendToRenderAIMain={onSendToRenderAIMain}
          />
      ) : state.results.length > 1 ? (
        <div className="w-full flex flex-col gap-4">
            <div>
                <h3 className="font-semibold mb-2 text-center text-gray-600 dark:text-gray-400">{t('comparison.original')}</h3>
                <div className="bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 max-h-48 w-full flex items-center justify-center">
                    { (state.useContextImage ? state.contextInpaintedUrl : state.processedImageUrl) ? (
                        <img src={state.useContextImage ? state.contextInpaintedUrl! : state.processedImageUrl} alt="Original" className="max-h-48 max-w-full object-contain" />
                    ) : (
                        <p className="text-gray-500">{t('comparison.noOriginal')}</p>
                    )}
                </div>
            </div>
             <h3 className="font-semibold text-center text-gray-600 dark:text-gray-400">{t('comparison.result')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {state.results.map((result: ImageResultType, index: number) => (
                    <div key={result.id} className="aspect-square">
                        <ImageResult
                            result={result}
                            onFullscreen={() => onFullscreen(state.results, index)}
                            onRegenerate={onRegenerate}
                            onSendToEnhance={onEnhance}
                            onSendToTraining={onSendToTraining}
                            onSendToTechDrawing={onSendToTechDrawing}
                            onSendToUpscale={onSendToUpscale}
                            onSendToVeo={onSendToVeo}
                            onSendToRenderAIMain={onSendToRenderAIMain}
                        />
                    </div>
                ))}
            </div>
        </div>
      ) : (
          <EmptyStateGuide tabType={Tab.RenderAI} />
      )}
    </div>
  );
  
  return (
    <>
      <InpaintingModal
          isOpen={state.isContextModalOpen}
          onClose={() => setState({...state, isContextModalOpen: false})}
          onSave={(dataUrl) => {
              setState({
                  ...state,
                  contextInpaintedUrl: dataUrl, 
                  isContextModalOpen: false,
                  contextDrawingDataUrl: null,
              });
          }}
          imageSrc={state.contextImageUrl}
          drawingDataUrl={state.contextDrawingDataUrl}
          onDrawingChange={(url) => setState({ ...state, contextDrawingDataUrl: url })}
          onImageChange={async (dataUrl) => {
              const { base64, mimeType } = dataURLtoBase64(dataUrl);
              const file = base64ToFile(base64, 'new_context.jpg', mimeType);
              await handleContextFileChange(file);
          }}
      />
      <div className="w-full h-full">
        <ResizablePanels leftPanel={leftPanel} rightPanel={rightPanel} />
      </div>
    </>
  );
};
export default RenderTab;
