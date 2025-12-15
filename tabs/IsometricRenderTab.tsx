
import React, { useState, useRef, useEffect } from 'react';
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
import EmptyStateGuide from '../components/EmptyStateGuide';

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
            : "The output should be a top-down view with very subtle depth, like soft ambient occlusion shadows, to make it feel like a physical model.";
      
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
  };

  const handleTranscript = (transcript: string) => {
      setState((prevState: any) => ({
      ...prevState,
      prompt: prevState.prompt ? `${prevState.prompt} ${transcript}` : transcript
      }));
  };
  
  const canGenerate = !isGenerating && !isAnalyzing && !!state.floorplanUrl && (state.selectedStylePreset !== 'custom' || !!state.customStylePrompt);
  const styleButtonClass = (preset: StylePreset) => `flex-1 py-2 px-3 text-sm rounded-md transition-colors ${state.selectedStylePreset === preset ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 dark:bg-gray-700/80 hover:bg-gray-300 dark:hover:bg-gray-600'}`;

  const leftPanel = (
      <div className="w-full h-full bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 overflow-y-auto no-scrollbar">
          <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('floorPlanColoring.title')}</h2>
              <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
                  <TrashIcon className="w-5 h-5" />
              </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('floorPlanColoring.description')}</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 p-2 bg-yellow-100/50 dark:bg-yellow-900/20 rounded-md border border-yellow-300/50 dark:border-yellow-700/40">{t('floorPlanColoring.warning')}</p>

          <div>
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('floorPlanColoring.upload.floorplan')}</h3>
              <FileUpload id="fp-color-upload" onFileChange={(file) => handleFileChange(file, 'floorplan')} previewUrl={state.floorplanUrl} onClear={() => handleFileChange(null, 'floorplan')} containerClassName="h-40" />
          </div>

          <div
              ref={promptContainerRef}
              onBlur={handlePromptBlur}
              className="relative"
          >
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('floorPlanColoring.prompt.title')}</h3>
              <PromptAssistant
                  isVisible={isAssistantVisible}
                  currentPrompt={state.prompt}
                  onPromptUpdate={(newPrompt) => setState({ ...state, prompt: newPrompt })}
                  imageDataUrl={state.floorplanUrl}
                  language={language}
              />
              <div className="relative">
                  <textarea 
                      value={state.prompt} 
                      onChange={e => setState({ ...state, prompt: e.target.value })} 
                      placeholder={t('floorPlanColoring.prompt.placeholder')} 
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-20 resize-none pr-12"
                      onFocus={handlePromptFocus}
                  />
                  <div className="absolute bottom-2 right-2">
                      <SpeechToTextButton onTranscript={handleTranscript} language={language} />
                  </div>
              </div>
          </div>

          <div>
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('floorPlanColoring.style.title')}</h3>
              <div className="flex items-stretch gap-2">
                  <div className="flex flex-col gap-2 flex-grow">
                      <button onClick={() => setState({ ...state, selectedStylePreset: 'modern' })} className={styleButtonClass('modern')}>{t('style.modern')}</button>
                      <button onClick={() => setState({ ...state, selectedStylePreset: 'japanese' })} className={styleButtonClass('japanese')}>{t('style.japanese')}</button>
                      <button onClick={() => setState({ ...state, selectedStylePreset: 'neoclassical' })} className={styleButtonClass('neoclassical')}>{t('style.neoclassical')}</button>
                  </div>
                  <div className="flex items-center">
                      <div className="h-full w-px bg-gray-300 dark:bg-gray-600 mx-2"></div>
                      <span className="text-xs text-gray-500">{t('floorPlanColoring.style.or')}</span>
                      <div className="h-full w-px bg-gray-300 dark:bg-gray-600 mx-2"></div>
                  </div>
                  <div className="flex-grow flex flex-col gap-2">
                      <FileUpload id="fp-color-ref-upload" onFileChange={(file) => handleFileChange(file, 'ref')} previewUrl={state.refImageUrl} onClear={() => handleFileChange(null, 'ref')} containerClassName="flex-grow" />
                      <button onClick={handleAnalyzeStyle} disabled={isAnalyzing || !state.refImageFile} className="w-full text-sm bg-indigo-600 text-white font-bold py-2 px-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 transition-colors flex items-center justify-center space-x-2">
                          {isAnalyzing ? <LoadingSpinner className="w-4 h-4" /> : <WandIcon className="w-4 h-4" />}
                          <span>{isAnalyzing ? t('render.button.analyzing') : t('floorPlanColoring.style.analyze')}</span>
                      </button>
                  </div>
              </div>
              {state.selectedStylePreset === 'custom' && state.customStylePrompt && <p className="text-xs text-green-600 dark:text-green-400 px-1 pt-1">{t('floorPlanColoring.style.analyzed')}</p>}
          </div>

          <div className="border-t border-gray-300 dark:border-gray-700 pt-4 space-y-2">
               <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                      type="checkbox"
                      checked={state.renderTopViewOnly}
                      onChange={(e) => setState({...state, renderTopViewOnly: e.target.checked})}
                      className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('floorPlanColoring.options.renderTopViewOnly.label')}</span>
              </label>
              <p className="text-xs text-gray-500 px-1">{t('floorPlanColoring.options.renderTopViewOnly.hint')}</p>
          </div>


          <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 flex items-center justify-center space-x-2"
          >
              {isGenerating ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
              <span>{isGenerating ? t('render.button.generating') : t('render.button.generate')}</span>
          </button>
      </div>
  );

  const rightPanel = (
      <div className="w-full h-full bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 overflow-y-auto no-scrollbar flex items-center justify-center">
           {isGenerating ? (
              <CatLoadingAnimation text={t('render.status.generating')} />
          ) : error ? (
              <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md">{error}</div>
          ) : state.result ? (
              <div className="w-full max-w-2xl mx-auto">
                  <ImageResult
                      result={state.result}
                      onFullscreen={() => onFullscreen([state.result], 0)}
                      onRegenerate={onRegenerate}
                      onSendToEnhance={onEnhance}
                      onSendToTraining={onSendToTraining}
                      onSendToTechDrawing={onSendToTechDrawing}
                      onSendToUpscale={onSendToUpscale}
                      onSendToVeo={onSendToVeo}
                  />
              </div>
          ) : (
             <EmptyStateGuide tabType={Tab.FloorPlanColoring} />
          )}
      </div>
  );

  return (
    <div className="w-full h-full">
        <ResizablePanels leftPanel={leftPanel} rightPanel={rightPanel} />
    </div>
  );
};

export default FloorPlanColoringTab;
