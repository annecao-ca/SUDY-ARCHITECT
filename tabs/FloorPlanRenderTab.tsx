
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import FileUpload from '../components/FileUpload';
import SelectInput from '../components/SelectInput';
import Slider from '../components/Slider';
import { SparklesIcon, LoadingSpinner, PaintBrushIcon, FolderOpenIcon, TrashIcon, WandIcon, LockClosedIcon } from '../components/icons/index';
import { ASPECT_RATIO_KEYS, RENDER_VIEW_KEYS } from '../constants';
import { ImageResult as ImageResultType, EnhanceState, Tab, GenerationInfo } from '../types';
import ImageResult from '../components/ImageResult';
import { getBase64FromResponse, generatePerspectiveFromFloorplan, analyzeSceneForFloorplanRender } from '../services/geminiService';
import { nanoid } from 'nanoid';
import MultiSelectCheckbox from '../components/MultiSelectCheckbox';
import InpaintingModal from '../components/InpaintingModal';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { fileToDataURL, fileToBase64, dataURLtoBase64, base64ToFile } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';
import { useActivation } from '../contexts/ActivationContext';
import CatLoadingAnimation from '../components/CatLoadingAnimation';
import PromptAssistant from '../components/PromptAssistant';
import SpeechToTextButton from '../components/SpeechToTextButton';
import ResizablePanels from '../components/ResizablePanels';

interface FloorPlanRenderTabProps {
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

const FloorPlanRenderTab: React.FC<FloorPlanRenderTabProps> = ({ 
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAssistantVisible, setIsAssistantVisible] = useState(false);
  
  const styleFileInputRef = useRef<HTMLInputElement>(null);
  const promptContainerRef = useRef<HTMLDivElement>(null);
  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();
  const { isActivated, openActivationModal } = useActivation();

  const translatedAspectRatios = useMemo(() => ASPECT_RATIO_KEYS.map(key => t(key)), [t]);
  const translatedRenderViews = useMemo(() => RENDER_VIEW_KEYS.map(key => t(key)), [t]);
  
  const handleFloorplanFileChange = async (file: File | null) => {
      if (file) {
          const dataUrl = await fileToDataURL(file);
          setState({...state, floorplanFile: file, floorplanSrcForModal: dataUrl, inpaintedPlanDataUrl: null, drawingDataUrl: null });
      } else {
          setState({...state, floorplanFile: null, floorplanSrcForModal: null, inpaintedPlanDataUrl: null, drawingDataUrl: null });
      }
  };

  const handleRefImageChange = async (file: File | null) => {
    if (file) {
        const dataUrl = await fileToDataURL(file);
        // Reset the generated prompt when a new image is uploaded
        setState({ ...state, refImageFile: file, refImageUrl: dataUrl, loraStylePrompt: '', prompt: '' });
    } else {
        setState({ ...state, refImageFile: null, refImageUrl: null });
    }
  };
  
  const handleAnalyzeStyle = async () => {
    if (!state.refImageFile || !state.inpaintedPlanDataUrl) {
      setError(t('training.error.noRefImages'));
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const refImage = await fileToBase64(state.refImageFile);
      const inpaintedPlan = dataURLtoBase64(state.inpaintedPlanDataUrl);

      const analysis = await analyzeSceneForFloorplanRender(inpaintedPlan.base64, refImage.base64, language);
      
      setState({ 
        ...state, 
        loraStylePrompt: JSON.stringify(analysis.loraStylePrompt, null, 2),
        prompt: analysis.description 
      });
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.toLowerCase().includes('quota')) {
        setError(t('error.apiQuotaExceeded'));
        forceQuotaDepletion();
      } else {
        setError(t('training.error.analyzeFailed'));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handleGenerate = useCallback(async () => {
    if (!state.inpaintedPlanDataUrl) {
      setError(t('floorplan.error.noInpaint'));
      return;
    }
     if (!state.loraStylePrompt) {
        setError(t('training.error.noPrompt'));
        return;
    }
    setIsGenerating(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, results: [] }));

    try {
        const inpaintedPlanData = dataURLtoBase64(state.inpaintedPlanDataUrl);
        
        const activeElements = state.showAdvancedElements ? state.elements.filter((el: any) => el.file && el.name.trim()) : [];
        const elementDatas = await Promise.all(
            activeElements.map(async (el: any) => {
                const { base64, mimeType } = await fileToBase64(el.file);
                return { base64, mimeType, name: el.name };
            })
        );
        
        const viewsToRender = state.renderViews.filter((v: string) => v !== RENDER_VIEW_KEYS[0]);
        if (viewsToRender.length === 0) {
            viewsToRender.push(RENDER_VIEW_KEYS[0]); // Use default if nothing specific is selected
        }
        
        const generationPromises = [];
        for (let i = 0; i < state.numResults; i++) {
            const currentView = viewsToRender[i % viewsToRender.length];
            generationPromises.push(generatePerspectiveFromFloorplan(
                inpaintedPlanData.base64,
                state.loraStylePrompt,
                state.prompt,
                t(currentView),
                t(state.aspectRatio),
                elementDatas
            ));
        }

        const responses = await Promise.all(generationPromises);

        const generationState = { ...state, floorplanFile: null, refImageFile: null };

        const newResults = responses
            .map((res): ImageResultType | null => {
                const b64 = getBase64FromResponse(res);
                if (!b64) return null;
                return { 
                  id: nanoid(), 
                  base64: b64, 
                  mimeType: 'image/jpeg',
                  generationInfo: {
                    originTab: Tab.FloorPlanRender,
                    state: generationState
                  }
                };
            })
            .filter((r): r is ImageResultType => r !== null);
        
        if (newResults.length > 0) {
            setState((prevState: any) => ({ ...prevState, results: newResults }));
            newResults.forEach(addMedia);
            decrementQuota(10 * newResults.length);
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
  }, [state, t, setState, addMedia, decrementQuota, forceQuotaDepletion]);
  
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
                let promptToSet = '';
                
                // Check for new .lora format first
                if (json.stylePrompt && typeof json.stylePrompt === 'string') {
                    promptToSet = json.stylePrompt;
                } 
                // Fallback to old .json format for this tab
                else if (json.trainedStylePrompt && typeof json.trainedStylePrompt === 'string') {
                    promptToSet = json.trainedStylePrompt;
                }
                // Fallback for this tab's specific auto-analysis format
                else if (json.style_mood) {
                     promptToSet = JSON.stringify(json, null, 2);
                }
                else {
                    setError(t('render.error.invalidJson'));
                    return;
                }

                setState({ ...state, loraStylePrompt: promptToSet });
                setError(null);

            } catch (err) {
                setError(t('render.error.readJsonFailed'));
                console.error(err);
            }
        };
        reader.readAsText(file);
    }
    if(e.target) e.target.value = '';
  };

  const handleInpaintClick = () => {
    if (!isActivated) {
      openActivationModal();
    } else {
      setIsModalOpen(true);
    }
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
  
  const canGenerate = !isGenerating && !isAnalyzing && !!state.inpaintedPlanDataUrl && !!state.loraStylePrompt;

  const leftPanel = (
    <div className="w-full h-full bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 overflow-y-auto no-scrollbar">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('floorplan.title')}</h2>
          <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('floorplan.upload.title')}</h3>
          <FileUpload id="floorplan-upload" onFileChange={handleFloorplanFileChange} previewUrl={state.floorplanSrcForModal} onClear={() => handleFloorplanFileChange(null)} containerClassName="h-32" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('floorplan.upload.ref.title')}</h3>
          <FileUpload id="floorplan-ref-upload" onFileChange={handleRefImageChange} previewUrl={state.refImageUrl} onClear={() => handleRefImageChange(null)} containerClassName="h-32" />
        </div>
      </div>
      
      {state.floorplanSrcForModal && (
        <>
          <div className="space-y-2">
            <button 
              onClick={handleInpaintClick} 
              disabled={!state.floorplanSrcForModal}
              title={!isActivated ? t('tooltip.requiresActivation') : t('floorplan.button.markPosition')}
              className="w-full text-sm bg-indigo-600 text-white font-bold py-2 px-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                <PaintBrushIcon className="w-4 h-4" />
                <span>{t('floorplan.button.markPosition')}</span>
                {!isActivated && <LockClosedIcon className="w-3.5 h-3.5 ml-1" />}
            </button>
            {state.inpaintedPlanDataUrl && (
              <div className="text-xs text-center text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 p-2 rounded-md">
                  {t('floorplan.cameraMarked')}
              </div>
            )}
          </div>

          {state.refImageFile && state.inpaintedPlanDataUrl && (
              <button onClick={handleAnalyzeStyle} disabled={isAnalyzing} className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 transition-colors flex items-center justify-center space-x-2">
                {isAnalyzing ? <LoadingSpinner className="w-5 h-5" /> : <WandIcon className="w-5 h-5" />}
                <span>{isAnalyzing ? t('render.button.analyzing') : t('floorplan.analyzeStyle')}</span>
            </button>
          )}

          <div
              ref={promptContainerRef}
              onBlur={handlePromptBlur}
              className="relative"
          >
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('floorplan.prompt.title')}</h3>
              <PromptAssistant
                  isVisible={isAssistantVisible}
                  currentPrompt={state.prompt}
                  onPromptUpdate={(newPrompt) => setState({ ...state, prompt: newPrompt })}
                  imageDataUrl={state.refImageUrl || state.inpaintedPlanDataUrl}
                  language={language}
              />
              <div className="relative">
                  <textarea 
                    value={state.prompt} 
                    onChange={e => setState({ ...state, prompt: e.target.value })} 
                    placeholder={t('floorplan.prompt.placeholder')} 
                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-20 resize-none pr-12"
                    onFocus={handlePromptFocus}
                  />
                  <div className="absolute bottom-2 right-2">
                      <SpeechToTextButton onTranscript={handleTranscript} language={language} />
                  </div>
              </div>
          </div>
          
          <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('render.lora.title')}</h3>
            <textarea value={state.loraStylePrompt} onChange={e => setState({ ...state, loraStylePrompt: e.target.value })} placeholder={t('render.lora.placeholder')} className="w-full bg-white dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-md p-2 h-24 resize-none font-mono text-xs" />
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
                {state.loraStylePrompt && (
                    <button onClick={() => setState({...state, loraStylePrompt: ''})} className="p-2 bg-red-500/20 text-red-500 rounded-md hover:bg-red-500/40">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
            {state.loraStylePrompt && <p className="text-xs text-green-600 dark:text-green-400 px-1 pt-1">{t('render.lora.loaded')}</p>}
          </div>

          <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-6">
            <MultiSelectCheckbox
                label={t('render.options.renderView')}
                options={translatedRenderViews}
                selectedOptions={state.renderViews.map((v: string) => t(v))}
                onChange={(selected) => {
                    const keys = RENDER_VIEW_KEYS.filter(k => selected.includes(t(k)));
                    setState({ ...state, renderViews: keys, numResults: Math.max(1, keys.length) });
                }}
            />
            <SelectInput 
                label={t('render.options.aspectRatio')} 
                options={translatedAspectRatios} 
                value={t(state.aspectRatio)} 
                onChange={(val) => {
                    const key = ASPECT_RATIO_KEYS[translatedAspectRatios.indexOf(val)];
                    setState({ ...state, aspectRatio: key });
                }} 
            />
              <Slider label={t('render.options.resultCount')} min={1} max={6} step={1} value={state.numResults} onChange={(v) => setState({ ...state, numResults: v })} />
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={state.showAdvancedElements}
                    onChange={(e) => setState({...state, showAdvancedElements: e.target.checked})}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('floorplan.advanced.toggle')}</span>
            </label>
          </div>
          {state.showAdvancedElements && (
            <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('enhance.advanced.title')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {state.elements.map((element: any, index: number) => (
                      <div key={element.id} className="flex flex-col gap-2">
                          <FileUpload 
                              id={`fp-element-upload-${index}`} 
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
            {isGenerating ? (
                <>
                    <LoadingSpinner className="w-5 h-5" />
                    <span>{t('render.button.generating')}</span>
                </>
            ) : (
                <>
                    <SparklesIcon className="w-5 h-5" />
                    <span>{t('render.button.generate')}</span>
                </>
            )}
          </button>
        </>
      )}
    </div>
  );

  const rightPanel = (
    <div className="w-full h-full bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 overflow-y-auto no-scrollbar">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('comparison.result')}</h2>
      {(isGenerating || isAnalyzing) && <CatLoadingAnimation text={t('floorplan.status.generating')} />}
      {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md">{error}</div>}
      
      {!isGenerating && !isAnalyzing && state.results.length === 0 && !error && (
        <EmptyStateGuide tabType={Tab.FloorPlanRender} />
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
                />
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <>
      <InpaintingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(dataUrl) => setState({ ...state, inpaintedPlanDataUrl: dataUrl, drawingDataUrl: null })}
        imageSrc={state.floorplanSrcForModal}
        drawingDataUrl={state.drawingDataUrl}
        onDrawingChange={(url) => setState({ ...state, drawingDataUrl: url })}
        onImageChange={async (dataUrl) => {
            const { base64, mimeType } = dataURLtoBase64(dataUrl);
            const file = base64ToFile(base64, 'new_floorplan.jpg', mimeType);
            await handleFloorplanFileChange(file);
        }}
      />
      <div className="w-full h-full">
        <ResizablePanels leftPanel={leftPanel} rightPanel={rightPanel} />
      </div>
    </>
  );
};

export default FloorPlanRenderTab;
