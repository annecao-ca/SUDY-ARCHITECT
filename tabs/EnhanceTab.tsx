import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { EnhanceState, ImageResult, Tab, GenerationInfo } from '../types';
import { SparklesIcon, LoadingSpinner, PaintBrushIcon, FolderOpenIcon, TrashIcon, LockClosedIcon } from '../components/icons';
import { optimizeEnhancePrompt } from '../services/geminiService';
import FileUpload from '../components/FileUpload';
import InpaintingModal from '../components/InpaintingModal';
import { nanoid } from 'nanoid';
import { ASPECT_RATIO_KEYS } from '../constants';
import SelectInput from '../components/SelectInput';
import Slider from '../components/Slider';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { fileToDataURL, dataURLtoBase64, fileToBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';
import { useActivation } from '../contexts/ActivationContext';
import { ENHANCE_PROMPTS } from '../promptSuggestions';
import { getBase64FromResponse, generateImageWithElements } from '../services/geminiService';
import CatLoadingAnimation from '../components/CatLoadingAnimation';
import PromptAssistant from '../components/PromptAssistant';
import SpeechToTextButton from '../components/SpeechToTextButton';
import SideBySideComparison from '../components/SideBySideComparison';
import ResizablePanels from '../components/ResizablePanels';


const getImageDimensions = (dataUrl: string): Promise<{ width: number, height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
};

interface EnhanceTabProps {
  initialState: EnhanceState | null;
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onFullscreen: (images: ImageResult[], startIndex: number) => void;
  onConsumeInitialState: () => void;
  onRegenerate: (info: GenerationInfo) => void;
  onSendToEnhance: (state: EnhanceState) => void;
  onSendToQuickGenerateInspiration: (state: EnhanceState) => void;
  onSendToRenderAIMain: (state: EnhanceState) => void;
  onSendToRenderAIRef: (state: EnhanceState) => void;
  onSendToTraining: (state: EnhanceState) => void;
  onSendToFloorPlanRef: (state: EnhanceState) => void;
  onSendToColoringRef: (state: EnhanceState) => void;
  onSendToVirtualTour: (state: EnhanceState) => void;
  onSendToTechDrawing: (state: EnhanceState) => void;
  onSendToUpscale: (state: EnhanceState) => void;
  onSendToVeo: (state: EnhanceState) => void;
}

const EnhanceTab: React.FC<EnhanceTabProps> = ({ 
    initialState, 
    state, 
    setState, 
    onClear, 
    onFullscreen, 
    onConsumeInitialState,
    onRegenerate,
    ...sendToProps
}) => {
  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();
  const { isActivated, openActivationModal } = useActivation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [suggestions, setSuggestions] = useState<{ atmosphere: string[], materials: string[], objects: string[], style: string[] }>({ atmosphere: [], materials: [], objects: [], style: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAssistantVisible, setIsAssistantVisible] = useState(false);

  const styleFileInputRef = useRef<HTMLInputElement>(null);
  const promptContainerRef = useRef<HTMLDivElement>(null);
  
  const translatedAspectRatios = useMemo(() => ASPECT_RATIO_KEYS.map(key => t(key)), [t]);
  
  useEffect(() => {
    const shuffleArray = (array: string[]) => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };
    
    setSuggestions({
        atmosphere: shuffleArray(ENHANCE_PROMPTS.atmosphere).slice(0, 4),
        materials: shuffleArray(ENHANCE_PROMPTS.materials).slice(0, 4),
        objects: shuffleArray(ENHANCE_PROMPTS.objects).slice(0, 4),
        style: shuffleArray(ENHANCE_PROMPTS.style).slice(0, 4),
    });
  }, []);

  const handleSuggestionClick = (suggestion: string) => {
    setState((prevState: any) => ({
      ...prevState,
      prompt: prevState.prompt ? `${prevState.prompt}, ${suggestion}` : suggestion
    }));
  };

  const SuggestionButton: React.FC<{suggestion: string}> = ({ suggestion }) => (
    <button
      onClick={() => handleSuggestionClick(suggestion)}
      className="text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full px-3 py-1 hover:bg-blue-500/50 dark:hover:bg-blue-600/60 transition-colors text-left"
    >
      {suggestion}
    </button>
  );

  const parseAspectRatio = useCallback((ratioStr: string): number | null => {
      if (!ratioStr || ratioStr === t('aspect.original')) return null;
      const ratioMatch = ratioStr.match(/(\d+:\d+)/);
      if (!ratioMatch) return null;

      const [w, h] = ratioMatch[0].split(':').map(Number);
      if (isNaN(w) || isNaN(h) || h === 0) return null;
      return w / h;
  }, [t]);
  
  const resetImageState = useCallback(async (dataUrl: string) => {
      const dimensions = await getImageDimensions(dataUrl);
      setImageDimensions(dimensions);
      setState((prevState: any) => ({
          ...prevState,
          originalImageSrc: dataUrl,
          processedImageSrc: dataUrl,
          aspectRatio: t(ASPECT_RATIO_KEYS[0]),
          adaptationMode: null,
          results: [],
          drawingDataUrl: null,
          preInpaintSrc: null, // Reset pre-inpaint state when loading a new image
      }));
  }, [setState, t]);

  useEffect(() => {
    if (initialState) {
        const dataUrl = `data:${initialState.mimeType};base64,${initialState.image}`;
        resetImageState(dataUrl);
        onConsumeInitialState();
    }
  }, [initialState, resetImageState, onConsumeInitialState]);

  const handleFileChange = async (file: File | null) => {
      if (file) {
          const dataUrl = await fileToDataURL(file);
          await resetImageState(dataUrl);
      } else {
          onClear();
          setImageDimensions(null);
      }
  };
  
  const handleInpaintSave = (dataUrl: string) => {
    setState((prevState: any) => ({
        ...prevState,
        preInpaintSrc: prevState.preInpaintSrc || prevState.originalImageSrc,
        originalImageSrc: dataUrl,
        processedImageSrc: dataUrl,
        drawingDataUrl: null, // Drawing is baked in
    }));
  };

  const handleImageUpdateFromInpaint = (dataUrl: string) => {
      setState((prevState: any) => ({
          ...prevState,
          originalImageSrc: dataUrl,
          processedImageSrc: dataUrl,
          drawingDataUrl: null, // A new base image means the old drawing is invalid
          preInpaintSrc: null, // Reset pre-inpaint state
      }));
  };
  
  useEffect(() => {
    const processImage = async () => {
        if (!state.originalImageSrc || !imageDimensions || state.aspectRatio === t(ASPECT_RATIO_KEYS[0])) {
            if(state.originalImageSrc) setState((s:any) => ({...s, processedImageSrc: s.originalImageSrc}));
            return;
        }

        const targetAspectRatio = parseAspectRatio(state.aspectRatio);
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
             setState((s:any) => ({...s, processedImageSrc: canvas.toDataURL('image/jpeg')}));
        };
        img.src = state.originalImageSrc;
    };
    processImage();
  }, [state.aspectRatio, state.adaptationMode, state.originalImageSrc, imageDimensions, t, parseAspectRatio, setState]);

  const handleGenerate = useCallback(async () => {
    if (!state.processedImageSrc) {
      setError(t('enhance.error.noImage'));
      return;
    }
     if (state.aspectRatio !== t(ASPECT_RATIO_KEYS[0]) && !state.adaptationMode) {
      setError(t('enhance.button.generate.needsChoice'));
      return;
    }
    setIsLoading(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, results: [] }));

    try {
        const mainImage = dataURLtoBase64(state.processedImageSrc);
        const activeElements = state.elements.filter((el: any) => el.file && el.name.trim());
        const elementDatas = await Promise.all(
            activeElements.map(async (el: any) => {
                const { base64, mimeType } = await fileToBase64(el.file);
                return { base64, mimeType, name: el.name };
            })
        );
        
        let finalUserPrompt = state.prompt;
        const isInpaintingTask = state.preInpaintSrc != null;

        if (!isInpaintingTask && state.autoOptimizePrompt && state.prompt.trim()) {
            setIsOptimizing(true);
            try {
                finalUserPrompt = await optimizeEnhancePrompt(state.prompt, mainImage.base64, mainImage.mimeType, language);
            } catch (optError) {
                console.error("Prompt optimization failed, using original prompt.", optError);
            } finally {
                setIsOptimizing(false);
            }
        }
        
        const generationPromises = [];
        for (let i = 0; i < state.numResults; i++) {
             generationPromises.push(generateImageWithElements(
                finalUserPrompt,
                mainImage, 
                elementDatas,
                state.loraPrompt,
                state.creativity,
                isInpaintingTask
            ));
        }

        const responses = await Promise.all(generationPromises);
        
        const generationState = { ...state, initialStateFromOtherTab: null, originalImageSrc: null, processedImageSrc: state.processedImageSrc };

        const newResults = responses
             .map((res): ImageResult | null => {
                const b64 = getBase64FromResponse(res);
                if (!b64) return null;
                return { 
                  id: nanoid(), 
                  base64: b64, 
                  mimeType: 'image/jpeg',
                  generationInfo: {
                    originTab: Tab.Enhance,
                    state: generationState,
                  }
                };
            })
            .filter((r): r is ImageResult => r !== null);


        if (newResults.length > 0) {
            setState((prevState: any) => ({ ...prevState, results: newResults }));
            newResults.forEach(addMedia);
            decrementQuota(5 * newResults.length);
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
      setIsLoading(false);
      setIsOptimizing(false);
    }
  }, [state, t, language, addMedia, decrementQuota, forceQuotaDepletion, setState]);
  
  useEffect(() => {
    if (state.shouldRegenerate) {
        setState((s: any) => ({ ...s, shouldRegenerate: false }));
        handleGenerate(); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.shouldRegenerate]);
  
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
                    setError(t('render.error.invalidJson'));
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

  const handleElementFileChange = (index: number) => async (file: File | null) => {
    const dataUrl = file ? await fileToDataURL(file) : null;
    setState((prevState: any) => {
      const newElements = [...prevState.elements];
      newElements[index] = { ...newElements[index], file, dataUrl };
      return { ...prevState, elements: newElements };
    });
  };

  const handleElementNameChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
     setState((prevState: any) => {
      const newElements = [...prevState.elements];
      newElements[index] = { ...newElements[index], name: e.target.value };
      return { ...prevState, elements: newElements };
    });
  };

  const handleClearElement = (index: number) => {
    setState((prevState: any) => {
        const newElements = [...prevState.elements];
        newElements[index] = { id: nanoid(), file: null, name: '', dataUrl: null };
        return { ...prevState, elements: newElements };
    });
  };

  const handleInpaintClick = () => {
    if (!isActivated) {
      openActivationModal();
    } else {
      setIsModalOpen(true);
    }
  };
  
  const handleKeepInpaint = () => {
    setState({ ...state, preInpaintSrc: null });
  };
  
  const handleDiscardInpaint = () => {
    if (state.preInpaintSrc) {
        setState({ 
            ...state, 
            originalImageSrc: state.preInpaintSrc,
            processedImageSrc: state.preInpaintSrc,
            preInpaintSrc: null 
        });
    }
  };

  const handlePromptFocus = () => {
    setIsAssistantVisible(true);
    setShowSuggestions(true);
  };
  
  const handlePromptBlur = (e: React.FocusEvent) => {
    if (promptContainerRef.current && !promptContainerRef.current.contains(e.relatedTarget as Node)) {
        setIsAssistantVisible(false);
    }
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleTranscript = (transcript: string) => {
    setState((prevState: any) => ({
      ...prevState,
      prompt: prevState.prompt ? `${prevState.prompt} ${transcript}` : transcript
    }));
  };

  const canGenerate = !isLoading && !isOptimizing && !!state.processedImageSrc && (state.aspectRatio === t(ASPECT_RATIO_KEYS[0]) || !!state.adaptationMode);

  const leftPanel = (
    <div className="w-full h-full bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 overflow-y-auto no-scrollbar">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('enhance.title')}</h2>
          <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="text-sm bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-md border border-indigo-200 dark:border-indigo-800">
          <p className="text-gray-800 dark:text-gray-200">{t('enhance.magicToolsLink')}{' '} 
              <a href="https://aistudio.google.com/apps/drive/1fvOVAddGw7G5ZdRFs_8cgTNbTD4wRsB1?showPreview=true&showAssistant=true&fullscreenApplet=true" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                  SUDY Magic Tools
              </a>.
          </p>
      </div>

      <div>
        <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('enhance.upload.title')}</h3>
        <div className="w-full max-w-sm mx-auto lg:max-w-none lg:mx-0">
            <FileUpload id="enhance-upload" onFileChange={handleFileChange} previewUrl={state.originalImageSrc} onClear={onClear} containerClassName="h-48" />
        </div>
      </div>
      
      {state.originalImageSrc && (
        <>
          {state.preInpaintSrc && state.results.length > 0 && (
            <div className="mb-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700/50 rounded-md text-xs">
              <p className="mb-2 font-semibold">{t('enhance.inpaintActive')}</p>
              <div className="flex gap-2">
                <button onClick={handleKeepInpaint} className="flex-1 py-1 px-2 rounded bg-green-500 text-white hover:bg-green-600">{t('enhance.keepInpaint')}</button>
                <button onClick={handleDiscardInpaint} className="flex-1 py-1 px-2 rounded bg-red-500 text-white hover:bg-red-600">{t('enhance.discardInpaint')}</button>
              </div>
            </div>
          )}
          <button 
            onClick={handleInpaintClick} 
            title={!isActivated ? t('tooltip.requiresActivation') : t('enhance.button.inpaint')}
            className="w-full text-sm bg-indigo-600 text-white font-bold py-2 px-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
              <PaintBrushIcon className="w-4 h-4" />
              <span>{t('enhance.button.inpaint')}</span>
              {!isActivated && <LockClosedIcon className="w-3.5 h-3.5 ml-1" />}
          </button>

        <div 
          ref={promptContainerRef}
          onBlur={handlePromptBlur}
          className="relative"
        >
          <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('enhance.prompt.title')}</h3>
          <PromptAssistant
              isVisible={isAssistantVisible}
              currentPrompt={state.prompt}
              onPromptUpdate={(newPrompt) => setState({ ...state, prompt: newPrompt })}
              imageDataUrl={state.processedImageSrc}
              language={language}
          />
          <div className="relative">
            <textarea
              value={state.prompt}
              onChange={(e) => setState({ ...state, prompt: e.target.value })}
              placeholder={t('enhance.prompt.placeholder')}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-28 resize-none pr-12"
              onFocus={handlePromptFocus}
            />
            <div className="absolute bottom-2 right-2">
                <SpeechToTextButton onTranscript={handleTranscript} language={language} />
            </div>
          </div>
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 p-3 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg space-y-4">
                  <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('enhance.suggestions.atmosphere')}</h3>
                      <div className="flex flex-wrap gap-2">
                          {suggestions.atmosphere.map((p, i) => <SuggestionButton key={`atm-${i}`} suggestion={p} />)}
                      </div>
                  </div>
                  <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('enhance.suggestions.materials')}</h3>
                      <div className="flex flex-wrap gap-2">
                          {suggestions.materials.map((p, i) => <SuggestionButton key={`mat-${i}`} suggestion={p} />)}
                      </div>
                  </div>
                  <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('enhance.suggestions.objects')}</h3>
                      <div className="flex flex-wrap gap-2">
                          {suggestions.objects.map((p, i) => <SuggestionButton key={`obj-${i}`} suggestion={p} />)}
                      </div>
                  </div>
                  <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('enhance.suggestions.style')}</h3>
                      <div className="flex flex-wrap gap-2">
                          {suggestions.style.map((p, i) => <SuggestionButton key={`sty-${i}`} suggestion={p} />)}
                      </div>
                  </div>
              </div>
          )}
        </div>
        
        <div>
          <label className="flex items-center space-x-2 cursor-pointer">
              <input
                  type="checkbox"
                  checked={state.autoOptimizePrompt}
                  onChange={(e) => setState({...state, autoOptimizePrompt: e.target.checked})}
                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('enhance.optimize.label')}</span>
          </label>
          <p className="text-xs text-gray-500 mt-1 px-1">{t('enhance.optimize.hint')}</p>
        </div>

        <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('enhance.creativeOptions.title')}</h3>
          <Slider label={t('enhance.options.creativity')} min={0} max={10} step={1} value={state.creativity} onChange={(v) => setState({ ...state, creativity: v })} />
            <p className="text-xs text-gray-500 -mt-3 px-1">{t('enhance.options.creativityHint')}</p>
          <SelectInput 
              label={t('enhance.options.aspectRatio')} 
              options={translatedAspectRatios} 
              value={state.aspectRatio} 
              onChange={(val) => {
                  const adaptationRequired = val !== t(ASPECT_RATIO_KEYS[0]);
                  setState({ ...state, aspectRatio: val, adaptationMode: adaptationRequired ? 'crop' : null });
                  if (!adaptationRequired) setError(null);
              }} 
          />
            {state.aspectRatio !== t(ASPECT_RATIO_KEYS[0]) && (
              <div className="p-3 bg-gray-200 dark:bg-gray-900/50 rounded-md -mt-3">
                  <p className="text-sm font-medium mb-2">{t('enhance.options.adaptationPrompt')}</p>
                  <div className="flex space-x-2">
                        <button onClick={() => setState({ ...state, adaptationMode: 'crop' })} className={`w-full py-2 rounded-md text-sm transition-colors ${state.adaptationMode === 'crop' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-300'}`}>{t('enhance.options.adaptationCrop')}</button>
                      <button onClick={() => setState({ ...state, adaptationMode: 'extend' })} className={`w-full py-2 rounded-md text-sm transition-colors ${state.adaptationMode === 'extend' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-300'}`}>{t('enhance.options.adaptationExtend')}</button>
                  </div>
              </div>
          )}
            <Slider label={t('render.options.resultCount')} min={1} max={6} step={1} value={state.numResults} onChange={(v) => setState({ ...state, numResults: v })} />
            <div>
              <input type="file" accept=".json,.lora" ref={styleFileInputRef} onChange={handleStyleFileChange} className="hidden" />
              <div className="flex items-center gap-2">
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
        </div>
        
          <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                      type="checkbox"
                      checked={state.showAdvancedElements}
                      onChange={(e) => setState({...state, showAdvancedElements: e.target.checked})}
                      className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('enhance.advanced.toggle')}</span>
              </label>
          </div>

          {state.showAdvancedElements && (
                <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('enhance.advanced.title')}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {state.elements.map((element: any, index: number) => (
                          <div key={element.id} className="flex flex-col gap-2">
                              <FileUpload 
                                  id={`element-upload-${index}`} 
                                  onFileChange={handleElementFileChange(index)} 
                                  previewUrl={element.dataUrl}
                                  onClear={() => handleClearElement(index)}
                              />
                              <input
                                  type="text"
                                  value={element.name}
                                  onChange={handleElementNameChange(index)}
                                  placeholder={t('enhance.advanced.elementNamePlaceholder')}
                                  className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                          </div>
                      ))}
                  </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-blue-100/30 dark:bg-blue-900/20 rounded-md border border-blue-300/50 dark:border-blue-700/40">
                    {t('enhance.advanced.hint')}
                  </p>
              </div>
          )}


        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 flex items-center justify-center space-x-2"
        >
          {isLoading ? (
              <>
                  <LoadingSpinner className="w-5 h-5" />
                  <span>{isOptimizing ? t('enhance.status.optimizing') : t('enhance.status.generating')}</span>
              </>
          ) : (
              <>
                  <SparklesIcon className="w-5 h-5" />
                  <span>{t('enhance.button.generate')}</span>
              </>
          )}
        </button>
      </>
      )}
    </div>
  );

  const rightPanel = (
    <div className="w-full h-full bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 overflow-y-auto no-scrollbar flex items-center justify-center">
      {(isLoading || isOptimizing) ? (
        <CatLoadingAnimation text={isOptimizing ? t('enhance.status.optimizing') : t('enhance.status.generating')} />
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md">{error}</div>
      ) : state.results.length > 0 ? (
        <div className="w-full space-y-4">
            {state.results.map((result: ImageResult, index: number) => (
                <SideBySideComparison
                    key={result.id}
                    originalImageSrc={state.processedImageSrc}
                    generatedResult={result}
                    onFullscreen={() => onFullscreen(state.results, index)}
                    onRegenerate={onRegenerate}
                    onEnhance={sendToProps.onSendToEnhance}
                    onSendToTraining={sendToProps.onSendToTraining}
                    onSendToTechDrawing={sendToProps.onSendToTechDrawing}
                    onSendToUpscale={sendToProps.onSendToUpscale}
                    onSendToVeo={sendToProps.onSendToVeo}
                />
            ))}
        </div>
      ) : state.processedImageSrc ? (
        <div className="flex flex-col items-center justify-center">
            <p className="mb-2 font-semibold text-gray-700 dark:text-gray-300">{t('comparison.original')}</p>
            <img src={state.processedImageSrc} alt="Preview" className="max-w-full max-h-[70vh] rounded-lg shadow-md" />
        </div>
      ) : (
        <EmptyStateGuide tabType={Tab.Enhance} />
      )}
    </div>
  );

  return (
    <>
      <InpaintingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleInpaintSave}
        imageSrc={state.originalImageSrc}
        drawingDataUrl={state.drawingDataUrl}
        onDrawingChange={(url) => setState({ ...state, drawingDataUrl: url })}
        onImageChange={handleImageUpdateFromInpaint}
      />
      <div className="w-full h-full">
        <ResizablePanels leftPanel={leftPanel} rightPanel={rightPanel} />
      </div>
    </>
  );
};

export default EnhanceTab;