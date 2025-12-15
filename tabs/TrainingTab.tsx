import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import FileUpload from '../components/FileUpload';
import { SparklesIcon, LoadingSpinner, DownloadIcon, FolderOpenIcon, TrashIcon, LockClosedIcon } from '../components/icons/index';
import { ImageResult as ImageResultType, EnhanceState, Tab, LoraFileContent, GenerationInfo } from '../types';
import ImageResultComponent from '../components/ImageResult';
import { generateMoodboardFromImages, analyzeMoodboardForJson, getBase64FromResponse, generateImageFromImageAndText, generateImageFromText } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { base64ToFile, fileToBase64, dataURLtoBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';
import { useActivation } from '../contexts/ActivationContext';
import DrawingCanvas, { DrawingCanvasRef } from '../components/DrawingCanvas';
import Slider from '../components/Slider';
import SelectInput from '../components/SelectInput';
import { IMAGE_GENERATION_MODELS, ASPECT_RATIO_KEYS, INSPIRATION_OPTIONS } from '../constants';
import CatLoadingAnimation from '../components/CatLoadingAnimation';
import PromptAssistant from '../components/PromptAssistant';
import SpeechToTextButton from '../components/SpeechToTextButton';
import ResizablePanels from '../components/ResizablePanels';

interface TrainingTabProps {
  initialState: EnhanceState | null;
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
  onConsumeInitialState: () => void;
  onRegenerate: (info: GenerationInfo) => void;
  onSendToQuickGenerateInspiration: (state: EnhanceState) => void;
  onSendToRenderAIMain: (state: EnhanceState) => void;
  onSendToRenderAIRef: (state: EnhanceState) => void;
  onSendToTraining: (state: EnhanceState) => void;
  onSendToTechDrawing: (state: EnhanceState) => void;
  onSendToUpscale: (state: EnhanceState) => void;
  onSendToVeo: (state: EnhanceState) => void;
}

const TrainingTab: React.FC<TrainingTabProps> = ({ 
    initialState, 
    state, 
    setState, 
    onClear, 
    onEnhance, 
    onFullscreen, 
    onConsumeInitialState,
    onRegenerate,
    ...sendToProps
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAssistant1Visible, setIsAssistant1Visible] = useState(false);
  const [isAssistant2Visible, setIsAssistant2Visible] = useState(false);
  
  const styleFileInputRef = useRef<HTMLInputElement>(null);
  const drawingCanvasRef = useRef<DrawingCanvasRef>(null);
  const promptContainerRef1 = useRef<HTMLDivElement>(null);
  const promptContainerRef2 = useRef<HTMLDivElement>(null);
  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();
  const { isActivated, openActivationModal } = useActivation();
  
  const translatedModels = useMemo(() => IMAGE_GENERATION_MODELS.map(m => ({ ...m, name: t(m.nameKey) })), [t]);
  const translatedAspectRatios = useMemo(() => ASPECT_RATIO_KEYS.filter(r => r !== 'aspect.original').map(key => t(key)), [t]);

  useEffect(() => {
    if (initialState) {
        const file = base64ToFile(initialState.image, `training-ref-${nanoid(5)}.jpg`, initialState.mimeType);
        setState((prevState: any) => {
            const newRefImages = [...prevState.refImages];
            newRefImages[0] = file;
            return { ...prevState, refImages: newRefImages };
        });
        onConsumeInitialState();
    }
  }, [initialState, setState, onConsumeInitialState]);

  const handleFileChange = (index: number) => (file: File | null) => {
    setState((prevState: any) => {
        const newImages = [...prevState.refImages];
        newImages[index] = file;
        return { ...prevState, refImages: newImages };
    });
  };

    const handleExtractionOptionChange = (option: string) => {
        setState((prevState: any) => {
            const newOptions = prevState.extractionOptions.includes(option)
                ? prevState.extractionOptions.filter((o: string) => o !== option)
                : [...prevState.extractionOptions, option];
            return { ...prevState, extractionOptions: newOptions };
        });
    };

  const handleAnalyze = async () => {
    const validImages = state.refImages.filter((f: File | null): f is File => f !== null);
    if (validImages.length === 0) {
      setError(t('training.error.noRefImages'));
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setState({ ...state, analysisResult: '', moodboardResult: null, results: [] }); // Clear all previous results

    try {
      const imageDatas = await Promise.all(validImages.map(file => fileToBase64(file)));
      
      // Step 1: Generate moodboard image
      const moodboardResponse = await generateMoodboardFromImages(imageDatas, state.extractionOptions, state.descriptionPrompt);
      const moodboardBase64 = getBase64FromResponse(moodboardResponse);

      if (moodboardBase64) {
          // Step 2: Generate JSON analysis based on the moodboard
          const jsonAnalysis = await analyzeMoodboardForJson(
              imageDatas, 
              { base64: moodboardBase64, mimeType: 'image/jpeg' },
              state.extractionOptions,
              state.descriptionPrompt
          );
          
          const formattedJson = JSON.stringify(JSON.parse(jsonAnalysis), null, 2);
          
          const moodboardResultWithCommentary: ImageResultType = {
            id: nanoid(),
            base64: moodboardBase64,
            mimeType: 'image/jpeg',
            commentary: formattedJson, // Attach the JSON prompt as a commentary
            generationInfo: {
                originTab: Tab.ImageFromReference,
                state: { ...state, refImages: [], results: [], moodboardResult: null, analysisResult: '' }
            }
          };

          // Save the moodboard with its commentary to the image library
          addMedia(moodboardResultWithCommentary);

          // Update local state for immediate display
          setState((prevState: any) => ({ 
              ...prevState, 
              moodboardResult: moodboardResultWithCommentary,
              analysisResult: formattedJson 
          }));

      } else {
          setError("Moodboard generation failed.");
      }

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

  const handleGenerateSketch = useCallback(async () => {
    const sketchDataUrl = drawingCanvasRef.current?.getCanvasDataURL();
      if (!sketchDataUrl) {
          setError(t('training.error.noSketch'));
          return;
      }

      if (!state.analysisResult && !state.generationPrompt) {
          setError(t('training.error.noPrompt'));
          return;
      }
      
      setIsGenerating(true);
      setError(null);
      setState((prevState: any) => ({ ...prevState, results: [] }));

      try {
          const sketchImage = dataURLtoBase64(sketchDataUrl);

          const generationPromises = [];
          for (let i = 0; i < state.numResults; i++) {
              const finalPrompt = `
                **Task:** Render a photorealistic architectural image based on the provided sketch.
                **Style Guidance (CRITICAL):** Strictly adhere to the following detailed style analysis. This is the primary stylistic instruction.
                **Style Analysis:** """${state.analysisResult || 'A realistic architectural style.'}"""
                ---
                **Additional User Instructions:** ${state.generationPrompt || 'None'}
                ---
                **Creativity Level (0=Strictly adhere to sketch and style, 10=Highly creative interpretation):** ${state.creativity}
                **Negative Prompts:** Do not show text, watermarks, or signatures. Avoid blurry or out-of-focus results.
              `;
              generationPromises.push(generateImageFromImageAndText(finalPrompt, sketchImage.base64, sketchImage.mimeType));
          }
          
          const responses = await Promise.all(generationPromises);
          
          const generationState = { ...state, refImages: [], results: [] };

          const newResults = responses
              .map((res): ImageResultType | null => {
                  const b64 = getBase64FromResponse(res);
                  if (!b64) return null;
                  return { 
                    id: nanoid(), 
                    base64: b64, 
                    mimeType: 'image/jpeg',
                    generationInfo: {
                      originTab: Tab.ImageFromReference,
                      state: generationState
                    }
                  };
              })
              .filter((r): r is ImageResultType => r !== null);

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
            setError(t('training.error.generateFailed'));
          }
      } finally {
          setIsGenerating(false);
      }
  }, [state, t, addMedia, decrementQuota, forceQuotaDepletion, setState]);

  const handleGenerateText = useCallback(async () => {
    if (!state.analysisResult && !state.generationPrompt.trim()) {
        setError(t('training.error.noPrompt'));
        return;
    }
    setIsGenerating(true);
    setError(null);
    setState((prevState: any) => ({ ...prevState, results: [] }));

    try {
        const finalPrompt = `
            **Style Prompt (LoRA):** """${state.analysisResult}"""
            ---
            **Scene Description:** ${state.generationPrompt}
            ---
            **Instructions:** Create a high-quality, photorealistic architectural image. The primary style MUST be derived from the "Style Prompt (LoRA)". The "Scene Description" dictates the content of the image.
            **Creativity Level (0=Strict, 10=Artistic):** ${state.creativity}
        `;

        const resultBase64s = await generateImageFromText(
            finalPrompt,
            t(state.aspectRatio),
            state.numResults,
            state.imageModel
        );
        
        const generationState = { ...state, refImages: [], results: [] };
        
        const newResults = resultBase64s.map(base64 => ({ 
            id: nanoid(), 
            base64, 
            mimeType: 'image/jpeg',
            generationInfo: {
                originTab: Tab.ImageFromReference,
                state: generationState
            }
        }));

        if (newResults.length > 0) {
            setState((prevState: any) => ({ ...prevState, results: newResults }));
            newResults.forEach(addMedia);
            decrementQuota(15 * newResults.length);
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
        if (state.generationMode === 'sketch') {
            handleGenerateSketch();
        } else {
            handleGenerateText();
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.shouldRegenerate]);


  const handleDownloadJson = () => {
      if (!state.analysisResult) return;
      const blob = new Blob([state.analysisResult], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sudy_style_prompt.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleSaveLora = async () => {
    if (!state.analysisResult || !state.moodboardResult) {
      setError("Please analyze a style and generate a moodboard before saving.");
      return;
    }
    
    const validImages = state.refImages.filter((f: File | null): f is File => f !== null);
    if (validImages.length === 0) {
      setError("At least one reference image is required to save a LORA file.");
      return;
    }

    const refImageDatas = await Promise.all(validImages.map(async (file) => {
        const { base64, mimeType } = await fileToBase64(file);
        return { base64, mimeType, name: file.name };
    }));

    const loraContent: LoraFileContent = {
        refImages: refImageDatas,
        stylePrompt: state.analysisResult,
        moodboardImage: state.moodboardResult.base64,
    };

    const jsonContent = JSON.stringify(loraContent, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trained_style.lora';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
                // Check for new .lora format
                if (json.stylePrompt && json.moodboardImage) {
                    const formattedJson = JSON.stringify(JSON.parse(json.stylePrompt), null, 2);
                    const moodboardResult: ImageResultType = {
                        id: nanoid(),
                        base64: json.moodboardImage,
                        mimeType: 'image/jpeg',
                        commentary: formattedJson,
                    };
                    setState({ 
                        ...state, 
                        analysisResult: formattedJson, 
                        moodboardResult: moodboardResult,
                    });
                    setError(null);
                } else if (json.trainedStylePrompt) { // Fallback for old .json
                    setState({ ...state, analysisResult: json.trainedStylePrompt, moodboardResult: null });
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

  const canGenerate = !isGenerating && !isAnalyzing && (!!state.analysisResult || !!state.generationPrompt.trim());
  const modeButtonClass = (mode: 'text' | 'sketch') => {
      const base = 'w-full py-2 px-4 text-sm font-semibold rounded-md transition-colors focus:outline-none';
      if (state.generationMode === mode) {
          return `${base} bg-blue-600 text-white shadow`;
      }
      return `${base} bg-transparent text-gray-600 dark:text-gray-300 hover:bg-blue-200 dark:hover:bg-blue-900/50`;
  };

  const handleClear = () => {
    onClear();
    drawingCanvasRef.current?.clearCanvas();
  }

  const handlePromptFocus1 = () => setIsAssistant1Visible(true);
  const handlePromptBlur1 = (e: React.FocusEvent) => {
      if (promptContainerRef1.current && !promptContainerRef1.current.contains(e.relatedTarget as Node)) {
          setIsAssistant1Visible(false);
      }
  };
  const handleTranscript1 = (transcript: string) => {
      setState((prevState: any) => ({
        ...prevState,
        descriptionPrompt: prevState.descriptionPrompt ? `${prevState.descriptionPrompt} ${transcript}` : transcript
      }));
  };

  const handlePromptFocus2 = () => setIsAssistant2Visible(true);
  const handlePromptBlur2 = (e: React.FocusEvent) => {
      if (promptContainerRef2.current && !promptContainerRef2.current.contains(e.relatedTarget as Node)) {
          setIsAssistant2Visible(false);
      }
  };
  const handleTranscript2 = (transcript: string) => {
      setState((prevState: any) => ({
        ...prevState,
        generationPrompt: prevState.generationPrompt ? `${prevState.generationPrompt} ${transcript}` : transcript
      }));
  };


  const leftPanel = (
    <div className="w-full h-full bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('training.title')}</h2>
            <button onClick={handleClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
        
        <div className="space-y-4">
            <div 
                ref={promptContainerRef1}
                onBlur={handlePromptBlur1}
                className="relative"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">1. {t('training.prompt.title')}</h3>
               <PromptAssistant
                    isVisible={isAssistant1Visible}
                    currentPrompt={state.descriptionPrompt}
                    onPromptUpdate={(newPrompt) => setState({ ...state, descriptionPrompt: newPrompt })}
                    imageDataUrl={state.refImages.find(Boolean) ? URL.createObjectURL(state.refImages.find(Boolean)) : null}
                    language={language}
                />
               <div className="relative">
                  <textarea 
                    value={state.descriptionPrompt} 
                    onChange={e => setState({...state, descriptionPrompt: e.target.value})} 
                    placeholder={t('training.prompt.placeholder')} 
                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-24 resize-none pr-12" 
                    onFocus={handlePromptFocus1}
                  />
                  <div className="absolute bottom-2 right-2">
                      <SpeechToTextButton onTranscript={handleTranscript1} language={language} />
                  </div>
              </div>
            </div>

            <div>
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('training.upload.ref.title')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('training.upload.ref.hint')}</p>
              <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                      <FileUpload 
                          key={i} 
                          id={`ref-upload-training-${i}`} 
                          onFileChange={handleFileChange(i)} 
                          previewUrl={state.refImages[i] ? URL.createObjectURL(state.refImages[i]) : null}
                          onClear={() => handleFileChange(i)(null)}
                      />
                  ))}
              </div>
            </div>

             <div>
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('training.featureExtraction.title')}</h3>
                 <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select aspects to focus on for the moodboard. If none are selected, AI will choose automatically.</p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {INSPIRATION_OPTIONS.map(option => (
                        <div key={option} className="relative group">
                            <label className="flex items-center space-x-2 p-2 rounded-md bg-gray-50 dark:bg-gray-800 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={state.extractionOptions.includes(option)}
                                    onChange={() => handleExtractionOptionChange(option)}
                                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                                />
                                <span className="text-sm text-gray-800 dark:text-gray-200">{t(`inspiration.${option}`)}</span>
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            <button onClick={handleAnalyze} disabled={isAnalyzing || state.refImages.filter(Boolean).length === 0} className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 transition-colors flex items-center justify-center space-x-2">
                {isAnalyzing ? <LoadingSpinner className="w-5 h-5" /> : null}
                <span>2. {t('training.button.analyze')}</span>
            </button>
        </div>
        
        <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">3. {t('training.mode.title')}</h3>
            <div className="flex bg-gray-200 dark:bg-gray-700/50 rounded-lg p-1 space-x-1">
                <button onClick={() => setState({...state, generationMode: 'text'})} className={modeButtonClass('text')}>{t('training.mode.text')}</button>
                <button onClick={() => setState({...state, generationMode: 'sketch'})} className={modeButtonClass('sketch')}>{t('training.mode.sketch')}</button>
            </div>
        </div>

        {state.generationMode === 'sketch' ? (
            <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('training.generate.title.sketch')}</h3>
                <DrawingCanvas ref={drawingCanvasRef} width={320} height={240} />
                <div
                    ref={promptContainerRef2}
                    onBlur={handlePromptBlur2}
                    className="relative"
                >
                    <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('training.generate.prompt.title')}</h4>
                    <PromptAssistant
                        isVisible={isAssistant2Visible}
                        currentPrompt={state.generationPrompt}
                        onPromptUpdate={(newPrompt) => setState({ ...state, generationPrompt: newPrompt })}
                        imageDataUrl={drawingCanvasRef.current?.getCanvasDataURL()}
                        language={language}
                    />
                    <div className="relative">
                        <textarea 
                          value={state.generationPrompt} 
                          onChange={e => setState({...state, generationPrompt: e.target.value})} 
                          placeholder={t('training.generate.prompt.placeholder.sketch')} 
                          className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-20 resize-none pr-12"
                          onFocus={handlePromptFocus2} 
                        />
                        <div className="absolute bottom-2 right-2">
                          <SpeechToTextButton onTranscript={handleTranscript2} language={language} />
                        </div>
                    </div>
                </div>
                <Slider label={t('enhance.options.creativity')} min={0} max={10} step={1} value={state.creativity} onChange={(v) => setState({ ...state, creativity: v })} />
                <Slider label={t('render.options.resultCount')} min={1} max={4} step={1} value={state.numResults} onChange={(v) => setState({ ...state, numResults: v })} />
                <button onClick={handleGenerateSketch} disabled={!canGenerate} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 flex items-center justify-center space-x-2">
                    {isGenerating ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                    <span>{t('render.button.generate')}</span>
                </button>
            </div>
        ) : (
            <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('training.generate.title.text')}</h3>
                 <div
                    ref={promptContainerRef2}
                    onBlur={handlePromptBlur2}
                    className="relative"
                 >
                    <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('quickGenerate.prompt.title')}</h4>
                    <PromptAssistant
                        isVisible={isAssistant2Visible}
                        currentPrompt={state.generationPrompt}
                        onPromptUpdate={(newPrompt) => setState({ ...state, generationPrompt: newPrompt })}
                        imageDataUrl={state.moodboardResult?.base64 ? `data:${state.moodboardResult.mimeType};base64,${state.moodboardResult.base64}` : null}
                        language={language}
                    />
                    <div className="relative">
                      <textarea 
                        value={state.generationPrompt} 
                        onChange={e => setState({...state, generationPrompt: e.target.value})} 
                        placeholder={t('training.generate.prompt.placeholder.text')} 
                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-20 resize-none pr-12"
                        onFocus={handlePromptFocus2}
                      />
                      <div className="absolute bottom-2 right-2">
                          <SpeechToTextButton onTranscript={handleTranscript2} language={language} />
                      </div>
                    </div>
                </div>
                <SelectInput
                    label={t('quickGenerate.options.model')}
                    options={translatedModels.map(m => m.name)}
                    value={translatedModels.find(m => m.value === state.imageModel)?.name || ''}
                    onChange={(name) => {
                        const model = translatedModels.find(m => m.name === name);
                        if (model) setState({ ...state, imageModel: model.value });
                    }}
                />
                <SelectInput 
                    label={t('render.options.aspectRatio')} 
                    options={translatedAspectRatios} 
                    value={t(state.aspectRatio)} 
                    onChange={(val) => {
                        const key = ASPECT_RATIO_KEYS.find(k => t(k) === val);
                        if(key) setState({ ...state, aspectRatio: key });
                    }} 
                />
                <Slider label={t('enhance.options.creativity')} min={0} max={10} step={1} value={state.creativity} onChange={(v) => setState({ ...state, creativity: v })} />
                <Slider label={t('render.options.resultCount')} min={1} max={6} step={1} value={state.numResults} onChange={(v) => setState({ ...state, numResults: v })} />
                <button onClick={handleGenerateText} disabled={!canGenerate} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 flex items-center justify-center space-x-2">
                    {isGenerating ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                    <span>{t('render.button.generate')}</span>
                </button>
            </div>
        )}
    </div>
  );

  const rightPanel = (
    <div className="w-full h-full bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 overflow-y-auto no-scrollbar">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('comparison.result')}</h2>
        
        {(isAnalyzing || isGenerating) && (
          <CatLoadingAnimation text={isAnalyzing ? t('training.status.analyzing') : t('training.status.generating')} />
        )}
        
        {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md">{error}</div>}
        
        {!isAnalyzing && !isGenerating && state.moodboardResult && state.results.length === 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Analysis Result</h3>
            <div className="max-w-md mx-auto aspect-square">
                <ImageResultComponent
                    result={state.moodboardResult}
                    onFullscreen={() => onFullscreen([state.moodboardResult], 0)}
                    {...sendToProps}
                />
            </div>
            
            {state.analysisResult && (
              <div className="bg-gray-200 dark:bg-gray-900/50 p-3 rounded-md">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-300">Style Prompt (JSON)</h4>
                  <div className="flex items-center gap-2">
                    <button onClick={handleDownloadJson} className="flex items-center gap-2 px-3 py-1 text-xs bg-gray-300 dark:bg-gray-700 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600">
                      <DownloadIcon className="w-4 h-4" />
                      JSON
                    </button>
                    <button onClick={handleSaveLora} className="flex items-center gap-2 px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600">
                        <DownloadIcon className="w-4 h-4" />
                        .LORA
                    </button>
                  </div>
                </div>
                <pre className="text-xs text-gray-600 dark:text-gray-400 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-2 rounded whitespace-pre-wrap font-mono">{state.analysisResult}</pre>
              </div>
            )}
             <div className="mt-4 flex items-center gap-2">
                <input type="file" accept=".json,.lora" ref={styleFileInputRef} onChange={handleStyleFileChange} className="hidden" />
                <button 
                  onClick={handleLoadStyleFileClick} 
                  title={!isActivated ? t('tooltip.requiresActivation') : t('training.button.loadStyleFile')}
                  className={`w-full text-sm bg-gray-300/80 dark:bg-gray-700/80 text-gray-800 dark:text-white font-medium py-2 px-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 ${!isActivated ? 'opacity-50 cursor-pointer' : ''}`}
                >
                    <FolderOpenIcon className="w-4 h-4" />
                    <span>{t('training.button.loadStyleFile')}</span>
                     {!isActivated && <LockClosedIcon className="w-3.5 h-3.5 ml-1" />}
                </button>
            </div>
          </div>
        )}

        {!isGenerating && state.results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {state.results.map((result: ImageResultType, index: number) => (
                <div key={result.id} className="aspect-square">
                    <ImageResultComponent
                        result={result} 
                        onFullscreen={() => onFullscreen(state.results, index)}
                        onRegenerate={onRegenerate}
                        {...sendToProps}
                    />
                </div>
            ))}
          </div>
        )}

        {!isAnalyzing && !isGenerating && !state.moodboardResult && state.results.length === 0 && !error && (
            <EmptyStateGuide tabType={Tab.ImageFromReference} />
        )}
    </div>
  );
  
    return (
        <div className="w-full h-full">
            <ResizablePanels leftPanel={leftPanel} rightPanel={rightPanel} />
        </div>
    );
};

export default TrainingTab;
