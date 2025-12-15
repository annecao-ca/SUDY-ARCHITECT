import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileUpload from '../components/FileUpload';
import { SparklesIcon, LoadingSpinner, WandIcon, TrashIcon } from '../components/icons/index';
import { ImageResult as ImageResultType, EnhanceState, Tab, GenerationInfo } from '../types';
import ImageResult from '../components/ImageResult';
import { generateImageFromImageAndText, getBase64FromResponse, analyzeImagesWithText } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { base64ToFile, fileToDataURL, fileToBase64, dataURLtoBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';
import CatLoadingAnimation from '../components/CatLoadingAnimation';
import PromptAssistant from '../components/PromptAssistant';
import SpeechToTextButton from '../components/SpeechToTextButton';
import ResizablePanels from '../components/ResizablePanels';

interface TechnicalDrawingTabProps {
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
}

const TechnicalDrawingTab: React.FC<TechnicalDrawingTabProps> = ({ 
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
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAssistantVisible, setIsAssistantVisible] = useState(false);
  
  const promptContainerRef = useRef<HTMLDivElement>(null);
  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { remaining, decrementQuota, forceQuotaDepletion } = useApiQuota();

  const handleFileChange = useCallback(async (file: File | null) => {
    if (file) {
        const dataUrl = await fileToDataURL(file);
        setState((s: any) => ({ ...s, sourceImageFile: file, sourceImageUrl: dataUrl }));
    } else {
        setState((s: any) => ({ ...s, sourceImageFile: null, sourceImageUrl: null }));
    }
  }, [setState]);

  useEffect(() => {
    if (initialState) {
        const file = base64ToFile(initialState.image, `tech-drawing-source-${nanoid(5)}.jpg`, initialState.mimeType);
        handleFileChange(file);
        onConsumeInitialState();
    }
  }, [initialState, handleFileChange, onConsumeInitialState]);
  
  const handleAnalyze = async () => {
    if (!state.sourceImageFile) {
      setError(t('render.error.noImageAnalyze'));
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const { base64, mimeType } = await fileToBase64(state.sourceImageFile);
      const analysisPrompt = `Analyze this architectural image (exterior or interior). Provide a concise, one-sentence description of its key geometric features, shapes, and structural elements. This will be used for technical drawings.
      
If the user has already written a description, use it as a starting point, refine it for accuracy and technical detail based on the image, but keep the core idea.
User's current description: "${state.prompt}"`;
      const analysis = await analyzeImagesWithText(analysisPrompt, [{ base64, mimeType }], language);
      setState({ ...state, prompt: analysis });
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.toLowerCase().includes('quota')) {
        setError(t('error.apiQuotaExceeded'));
        forceQuotaDepletion();
      } else {
        setError(t('render.error.analyzeFailed'));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!state.sourceImageUrl) {
      setError(t('render.error.noImageGenerate'));
      return;
    }
    if (!state.prompt) {
      setError(t('techDraw.error.noPrompt'));
      return;
    }
    setIsGenerating(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, results: [] }));

    try {
        const { base64, mimeType } = state.sourceImageFile 
            ? await fileToBase64(state.sourceImageFile) 
            : dataURLtoBase64(state.sourceImageUrl);
        
        const views = [
            { name: t('techDraw.result.front'), prompt: "front elevation" },
            { name: t('techDraw.result.rear'), prompt: "rear elevation" },
            { name: t('techDraw.result.left'), prompt: "left side elevation" },
            { name: t('techDraw.result.right'), prompt: "right side elevation" }
        ];

        const fullPromptTemplate = (viewPrompt: string) => `
          **TASK:** Create a 2D technical elevation drawing from the provided 3D perspective image.
          **GEOMETRY DESCRIPTION:** ${state.prompt}
          **TARGET VIEW:** Create the **${viewPrompt}**.
          **CRITICAL STYLE INSTRUCTIONS:**
          - The output MUST be a clean, black and white line drawing.
          - Use thin, consistent line weights.
          - The background MUST be pure white.
          - DO NOT include any dimensions, text, annotations, shadows, colors, or textures.
          - The drawing must be a 2D orthographic projection, not a perspective drawing.
        `;

        const generationPromises = views.map(view => 
            generateImageFromImageAndText(fullPromptTemplate(view.prompt), base64, mimeType)
        );

        const responses = await Promise.all(generationPromises);

        const generationState = { ...state, sourceImageFile: null, sourceImageUrl: `data:${mimeType};base64,${base64}` };

        const newResults = responses.map((res, index): ImageResultType | null => {
            const resultB64 = getBase64FromResponse(res);
            if (!resultB64) return null;
            return {
                id: nanoid(),
                base64: resultB64,
                mimeType: 'image/jpeg',
                generationInfo: {
                    originTab: Tab.TechnicalDrawing,
                    state: generationState,
                },
                commentary: views[index].name
            };
        }).filter((r): r is ImageResultType => r !== null);

        if (newResults.length > 0) {
            setState((prevState: any) => ({ ...prevState, results: newResults }));
            if (newResults.length < 4) {
              setError(t('techDraw.error.partialResults', { count: newResults.length }));
            }
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
        setError(`${t('techDraw.error.generateFailed')}: ${String(e)}`);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [state, t, addMedia, decrementQuota, forceQuotaDepletion, setState, language]);

  useEffect(() => {
    if (state.shouldRegenerate) {
        setState((s: any) => ({ ...s, shouldRegenerate: false }));
        handleGenerate(); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.shouldRegenerate]);
  
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

  const isLoading = isGenerating || isAnalyzing;
  const canGenerate = !isLoading && !!state.sourceImageUrl && !!state.prompt;

  const leftPanel = (
    <div className="w-full h-full bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 overflow-y-auto no-scrollbar">
      <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('techDraw.title')}</h2>
          <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
              <TrashIcon className="w-5 h-5" />
          </button>
      </div>
      
      <div>
          <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('techDraw.upload.title')}</h3>
          <div className="w-full max-w-sm mx-auto lg:max-w-none lg:mx-0">
            <FileUpload id="tech-drawing-upload" onFileChange={handleFileChange} previewUrl={state.sourceImageUrl} onClear={() => handleFileChange(null)} containerClassName="h-48" />
          </div>
      </div>

      {state.sourceImageUrl && (
        <>
          <div
              ref={promptContainerRef}
              onBlur={handlePromptBlur}
              className="relative"
          >
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('techDraw.prompt.title')}</h3>
              <PromptAssistant
                  isVisible={isAssistantVisible}
                  currentPrompt={state.prompt}
                  onPromptUpdate={(newPrompt) => setState({ ...state, prompt: newPrompt })}
                  imageDataUrl={state.sourceImageUrl}
                  language={language}
              />
              <div className="relative">
                  <textarea 
                    value={state.prompt} 
                    onChange={e => setState({ ...state, prompt: e.target.value })} 
                    placeholder={t('techDraw.prompt.placeholder')} 
                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-20 resize-none pr-12"
                    onFocus={handlePromptFocus}
                  />
                  <div className="absolute bottom-2 right-2">
                      <SpeechToTextButton onTranscript={handleTranscript} language={language} />
                  </div>
              </div>
          </div>

          <div className="p-3 bg-gray-200 dark:bg-gray-900/50 rounded-md space-y-2">
              <button 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !state.sourceImageFile}
                  className="w-full py-2 px-2 rounded-md text-sm transition-colors bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-500 flex items-center justify-center space-x-2">
                      {isAnalyzing ? <LoadingSpinner className="w-4 h-4"/> : <WandIcon className="w-4 h-4"/>}
                      <span>{isAnalyzing ? t('render.button.analyzing') : t('render.button.analyze')}</span>
              </button>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-yellow-100/50 dark:bg-yellow-900/20 rounded-md border border-yellow-300/50 dark:border-yellow-700/40">
              {t('techDraw.note')}
          </p>

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {isLoading ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
            <span>{isLoading ? t('render.button.generating') : t('techDraw.button.generate')}</span>
          </button>
        </>
      )}
    </div>
  );

  const rightPanel = (
    <div className="w-full h-full bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 overflow-y-auto no-scrollbar">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('comparison.result')}</h2>
      {isLoading ? (
        <CatLoadingAnimation text={t('techDraw.status.generating')} />
      ) : error ? (
          <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md text-center">{error}</div>
      ) : state.results.length > 0 ? (
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {state.results.map((result: ImageResultType, index: number) => (
                  <div key={result.id}>
                      <h3 className="font-semibold mb-2 text-center text-gray-600 dark:text-gray-400">{result.commentary || `Result ${index + 1}`}</h3>
                      <div className="aspect-square">
                          <ImageResult
                              result={result}
                              onFullscreen={() => onFullscreen(state.results, index)}
                              onRegenerate={onRegenerate}
                              onSendToEnhance={onEnhance}
                              onSendToTraining={onSendToTraining}
                              onSendToTechDrawing={onSendToTechDrawing}
                              onSendToUpscale={onSendToUpscale}
                              onSendToVeo={onSendToVeo}
                          />
                      </div>
                  </div>
              ))}
          </div>
      ) : (
          <EmptyStateGuide tabType={Tab.TechnicalDrawing} />
      )}
    </div>
  );
  
  return (
    <div className="w-full h-full">
        <ResizablePanels leftPanel={leftPanel} rightPanel={rightPanel} />
    </div>
  );
};

export default TechnicalDrawingTab;