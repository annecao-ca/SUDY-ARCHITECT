import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import SelectInput from '../components/SelectInput';
import Slider from '../components/Slider';
import { SparklesIcon, LoadingSpinner, FolderOpenIcon, TrashIcon, WandIcon, LockClosedIcon } from '../components/icons/index';
import { ASPECT_RATIO_KEYS, IMAGE_GENERATION_MODELS, INSPIRATION_OPTIONS } from '../constants';
import { ImageResult as ImageResultType, EnhanceState, Tab, GenerationInfo } from '../types';
import { generateImageFromText, optimizePrompt, analyzeImageForInspiration, generateMoodBoardCommentary, generateImageFromImageAndText, getBase64FromResponse } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import EmptyStateGuide from '../components/EmptyStateGuide';
import { ARCH_PROMPTS, INTERIOR_PROMPTS, LANDSCAPE_PROMPTS } from '../promptSuggestions';
import { useActivation } from '../contexts/ActivationContext';
import FileUpload from '../components/FileUpload';
import { fileToDataURL, fileToBase64, dataURLtoBase64, extendImageToAspectRatio } from '../utils/file';
import ImageResultComponent from '../components/ImageResult';
import CatLoadingAnimation from '../components/CatLoadingAnimation';
import PromptAssistant from '../components/PromptAssistant';
import SpeechToTextButton from '../components/SpeechToTextButton';
import ResizablePanels from '../components/ResizablePanels';

interface QuickGenerateTabProps {
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
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

const QuickGenerateTab: React.FC<QuickGenerateTabProps> = ({ 
    state, 
    setState, 
    onClear, 
    onFullscreen, 
    onRegenerate, 
    ...sendToProps 
}) => {
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isInspirationAnalyzing, setIsInspirationAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ arch: string[], interior: string[], landscape: string[] }>({ arch: [], interior: [], landscape: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [commentaries, setCommentaries] = useState<Record<string, string>>({});
  const [isAssistantVisible, setIsAssistantVisible] = useState(false);
  
  const styleFileInputRef = useRef<HTMLInputElement>(null);
  const promptContainerRef = useRef<HTMLDivElement>(null);
  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();
  const { isActivated, openActivationModal } = useActivation();

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
        arch: shuffleArray(ARCH_PROMPTS).slice(0, 6),
        interior: shuffleArray(INTERIOR_PROMPTS).slice(0, 6),
        landscape: shuffleArray(LANDSCAPE_PROMPTS).slice(0, 6)
    });
  }, []);

  const translatedModels = useMemo(() => IMAGE_GENERATION_MODELS.map(m => ({ ...m, name: t(m.nameKey) })), [t]);
  const translatedAspectRatios = useMemo(() => ASPECT_RATIO_KEYS.filter(r => r !== 'aspect.original').map(key => t(key)), [t]);

  const handleClear = () => {
    onClear();
    setCommentaries({});
  };

  const handleSuggestionClick = (suggestion: string) => {
    setState((prevState: any) => ({
      ...prevState,
      prompt: prevState.prompt ? `${prevState.prompt}, ${suggestion}` : suggestion
    }));
  };

  const handleOptimizePrompt = async () => {
    if (!state.prompt.trim()) {
        setError(t('quickGenerate.error.noPrompt'));
        return;
    }
    setIsOptimizing(true);
    setError(null);
    try {
        const optimized = await optimizePrompt(state.prompt, language);
        setState({ ...state, prompt: optimized });
    } catch (e) {
        console.error(e);
        setError(t('quickGenerate.optimize.error'));
    } finally {
        setIsOptimizing(false);
    }
  };
  
  const handleRefImageChange = async (file: File | null) => {
    if (file) {
        const dataUrl = await fileToDataURL(file);
        setState({ ...state, refImageFile: file, refImageUrl: dataUrl });
    } else {
        setState({ ...state, refImageFile: null, refImageUrl: null, inspirationOptions: [] });
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

    const handleGenerate = useCallback(async () => {
      const suggestionPrompt = state.prompt;
      if (!suggestionPrompt.trim()) {
          setError(t('quickGenerate.error.noPrompt'));
          return;
      }

      setIsGeneratingImage(true);
      setError(null);
      setState((prevState: any) => ({ ...prevState, results: [] }));
      setCommentaries({});

      try {
        const isCharacterInsertion = state.inspirationOptions.includes('character') && state.refImageFile;

        if (isCharacterInsertion) {
            const ratioMatch = t(state.aspectRatio).match(/(\d+:\d+)/);
            const validAspectRatioNumber = ratioMatch ? (() => {
                const [w, h] = ratioMatch[0].split(':').map(Number);
                return h > 0 ? w / h : 1;
            })() : 1;
            
            const image = await extendImageToAspectRatio(state.refImageFile, validAspectRatioNumber);
            
            const otherInspirationOptions = state.inspirationOptions.filter((opt: string) => opt !== 'character');
            let otherInspirationPrompt = '';
            if (otherInspirationOptions.length > 0) {
                setIsInspirationAnalyzing(true);
                try {
                    const originalImageInfo = await fileToBase64(state.refImageFile);
                    otherInspirationPrompt = await analyzeImageForInspiration({ base64: originalImageInfo.base64, mimeType: originalImageInfo.mimeType }, otherInspirationOptions, language);
                } catch (e) {
                    console.error("Analysis of other inspirations failed", e);
                } finally {
                    setIsInspirationAnalyzing(false);
                }
            }

            const validAspectRatio = ratioMatch ? ratioMatch[0] : '1:1';

            const insertionPrompt = `**TASK:** Create a new architectural scene featuring a person from a reference image.
**UNBREAKABLE RULES:**
1.  **CHARACTER FIDELITY (HIGHEST PRIORITY):** You **MUST** perfectly replicate the person from the provided reference image. This includes their **exact face, hairstyle, clothing, and physical appearance**. Do not change them. This is the most important instruction.
2.  **SCENE INTEGRATION:** Place this replicated person naturally into a new architectural scene. The scene is described as: "${suggestionPrompt}". The architecture/landscape is the main subject, and the person is an element within it.
3.  **POSE:** The person's pose should be natural and appropriate for the environment (e.g., sitting on a sofa, standing and looking out a window, walking through the space).
4.  **CINEMATIC COMPOSITION (CRITICAL):** Apply strong, cinematic composition rules. Use principles like the **Rule of Thirds**, **leading lines**, **depth of field**, **framing**, and **dynamic angles** to create a visually compelling image. Position the character and architectural elements thoughtfully to create balance, tension, or a clear focal point. Avoid flat, static, or centered compositions.
5.  **ADDITIONAL STYLE CUES:** Also incorporate these stylistic elements from the reference image, if any: "${otherInspirationPrompt || 'None'}".
6.  **ASPECT RATIO (CRITICAL RULE):** The final generated image **MUST** have an aspect ratio of **${validAspectRatio}**. This is a mandatory, non-negotiable output format. Do NOT derive the aspect ratio from the reference image; you MUST use ${validAspectRatio}.
7.  **FINAL OUTPUT:** The result must be a single, cohesive, photorealistic image.`;
            
            const generationPromises = [];
            for (let i = 0; i < state.numResults; i++) {
                generationPromises.push(generateImageFromImageAndText(insertionPrompt, image.base64, image.mimeType));
            }

            const responses = await Promise.all(generationPromises);

            const newResults = responses.map((res): ImageResultType | null => {
                const b64 = getBase64FromResponse(res);
                if (!b64) return null;
                return { 
                  id: nanoid(), 
                  base64: b64, 
                  mimeType: 'image/jpeg',
                  generationInfo: {
                    originTab: Tab.QuickGenerate,
                    state: { ...state, results: [] }
                  }
                };
            }).filter((r): r is ImageResultType => r !== null);

            setState((prevState: any) => ({ ...prevState, results: newResults }));
            newResults.forEach(addMedia);
            decrementQuota(10 * newResults.length);

        } else {
            let inspirationPrompt = '';
            if (state.refImageFile && state.inspirationOptions.length > 0) {
                setIsInspirationAnalyzing(true);
                try {
                    const image = await fileToBase64(state.refImageFile);
                    inspirationPrompt = await analyzeImageForInspiration(image, state.inspirationOptions, language);
                } catch (e) {
                    console.error("Inspiration analysis failed, continuing without it.", e);
                } finally {
                    setIsInspirationAnalyzing(false);
                }
            }

            let generationPrompt;

            if (state.isMoodBoard) {
                const inspirationContext = inspirationPrompt 
                    ? `**Primary Inspiration Source:** A user-provided reference image. The mood board's visual elements (images, colors, textures) MUST heavily reflect your analysis of these aspects: **[${state.inspirationOptions.join(', ')}]**. Your analysis is: "${inspirationPrompt}".`
                    : `**Primary Inspiration Source:** The user has not provided a reference image. Create a mood board purely based on the theme described below.`;

                generationPrompt = `
                    **ROLE:** You are an elite-level graphic designer and architectural concept artist.
                    **TASK:** Create a professional, clean, and highly focused mood board based on a core theme.

                    **CORE THEME:** "${suggestionPrompt}"

                    ${inspirationContext}

                    ---
                    **UNBREAKABLE RULES OF COMPOSITION & CONTENT:**
                    ---

                    **1. HIERARCHY & THE FOCAL IMAGE:**
                    - Your first step is to identify the single most important concept from the "Core Theme" and render it as the **Focal Image**.
                    - This Focal Image **MUST** be the largest and most prominent element on the board. All other elements exist to support it.

                    **2. MINIMALISM & PRECISION ("Less is More"):**
                    - Do **NOT** clutter the board. A professional mood board is about clarity and focus.
                    - You must include the **Focal Image** plus **ONLY 2 to 4 smaller, highly relevant supporting elements**.
                    - Supporting elements MUST be directly related to the Focal Image (e.g., a material detail, an inspirational sketch, a color palette).

                    **3. CONTEXT-AWARE SUPPORTING ELEMENTS:**
                    - Intelligently analyze the "Core Theme" to decide what supporting elements are most useful.
                    - If the theme describes a simple building or space (e.g., 'a small cabin', 'a minimalist living room'), a key supporting element should be either a **clean, conceptual 2D floor plan sketch** OR a **simple 2D elevation sketch**. Choose the one that best explains the design idea.
                    - If the theme is about atmosphere or style, the supporting elements should be abstract, like material textures or a color palette extracted from the Focal Image.

                    **4. PROFESSIONAL & DYNAMIC LAYOUT:**
                    - The final layout MUST be **impeccably neat, organized, and professional**.
                    - Use dynamic, asymmetrical layouts inspired by high-end graphic design magazines (e.g., Dezeen, Architectural Digest).
                    - Use whitespace effectively to create a clean, uncluttered feel.
                    - **NEGATIVE PROMPT (Layout):** Absolutely no boring, symmetrical grids. The composition must be sophisticated.

                    **5. ACCURATE & MINIMAL ANNOTATIONS:**
                    - Include a clear main title and a smaller subtitle.
                    - Use very short, precise, professional labels for elements (e.g., "Concept Render," "Material Palette," "Floor Plan Sketch").
                    - Use thin, clean leader lines to connect labels to specific details where necessary.
                    - **NEGATIVE PROMPT (Text):** No long sentences or paragraphs. No spelling errors. Text must be purposeful and accurate.

                    **Final Output:** A single, cohesive, and impressive image that is the complete mood board, demonstrating a clear understanding of visual hierarchy, focused content selection, and professional graphic design principles.
                `;
            } else {
                let userAndInspirationPrompt = suggestionPrompt;
                if (inspirationPrompt) {
                    userAndInspirationPrompt += `, with the following characteristics: ${inspirationPrompt}`;
                }

                if (state.isArtisticSketch) {
                    userAndInspirationPrompt = `ballpoint pen architectural sketch with light watercolor wash, loose and artistic style, expressive lines, concept sketch, ${userAndInspirationPrompt}`;
                }
                
                generationPrompt = `
                    **LoRA/Trained Style:** ${state.loraPrompt || 'None'}
                    **User Prompt:** ${userAndInspirationPrompt}
                    **Creativity Level (0=faithful, 10=highly creative):** ${state.creativity}
                `;
            }

              const resultBase64s = await generateImageFromText(generationPrompt, t(state.aspectRatio), state.numResults, state.imageModel);
              const newResults = resultBase64s.map(base64 => ({ 
                id: nanoid(), 
                base64, 
                mimeType: 'image/jpeg',
                generationInfo: {
                  originTab: Tab.QuickGenerate,
                  state: { ...state, results: [] }
                }
              }));

              setState((prevState: any) => ({ ...prevState, results: newResults }));
              newResults.forEach(addMedia);
              decrementQuota(15);

              if (state.isMoodBoard && newResults.length > 0) {
                    const loadingCommentaries = newResults.reduce((acc, result) => {
                        acc[result.id] = 'Generating commentary...';
                        return acc;
                    }, {} as Record<string, string>);
                    setCommentaries(loadingCommentaries);

                    const commentaryResults = await Promise.all(newResults.map(async result => {
                        try {
                            const text = await generateMoodBoardCommentary(
                                { base64: result.base64, mimeType: result.mimeType },
                                suggestionPrompt,
                                language
                            );
                            decrementQuota(1);
                            return { id: result.id, text };
                        } catch (err) {
                            console.error(`Failed to generate commentary for ${result.id}`, err);
                            return { id: result.id, text: 'Commentary generation failed.' };
                        }
                    }));
                    
                    const finalCommentaries = commentaryResults.reduce((acc, res) => {
                        acc[res.id] = res.text;
                        return acc;
                    }, {} as Record<string, string>);

                    setCommentaries(prev => ({ ...prev, ...finalCommentaries }));

                    // Update results in state and library with the new commentary
                    const resultsWithCommentary = newResults.map(r => ({
                        ...r,
                        commentary: finalCommentaries[r.id],
                    }));

                    setState(prevState => ({ ...prevState, results: resultsWithCommentary }));
                    resultsWithCommentary.forEach(addMedia); // This will update the entries in the library
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
          setIsGeneratingImage(false);
          setIsInspirationAnalyzing(false);
      }
    }, [state, t, language, addMedia, decrementQuota, forceQuotaDepletion, setState]);

  useEffect(() => {
    if (state.shouldRegenerate) {
        setState((s: any) => ({ ...s, shouldRegenerate: false }));
        handleGenerate(); 
    }
  }, [state.shouldRegenerate, handleGenerate, setState]);

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

  const SuggestionButton: React.FC<{suggestion: string}> = ({ suggestion }) => (
    <button
      onClick={() => handleSuggestionClick(suggestion)}
      className="text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full px-3 py-1 hover:bg-blue-500/50 dark:hover:bg-blue-600/60 transition-colors text-left"
    >
      {suggestion.split(',')[0]}
    </button>
  );

  const renderCommentary = (text: string) => {
    if (text === 'Generating commentary...') {
        return <div className="flex items-center gap-2 text-xs"><LoadingSpinner className="w-3 h-3" /><span>{text}</span></div>;
    }
    return text.split('\n').filter(line => line.trim() !== '').map((line, index) => {
        const parts = line.split(':');
        if (parts.length > 1) {
            const title = parts[0];
            const content = parts.slice(1).join(':');
            return (
                <p key={index} className="mb-1">
                    <strong className="font-semibold text-gray-800 dark:text-gray-200 uppercase text-xs">{title}:</strong>
                    <span className="ml-1 text-sm">{content.trim()}</span>
                </p>
            );
        }
        return <p key={index} className="text-sm">{line}</p>;
    });
  };

  const renderResultCard = (result: ImageResultType, index: number) => (
    <div key={result.id} className="flex flex-col rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow-lg">
        <div className="w-full aspect-square">
            <ImageResultComponent
                result={result}
                onFullscreen={() => onFullscreen(state.results, index)}
                onRegenerate={onRegenerate}
                {...sendToProps}
            />
        </div>
        {commentaries[result.id] && (
            <div className="p-3 border-t border-gray-300 dark:border-gray-700">
                {renderCommentary(commentaries[result.id])}
            </div>
        )}
    </div>
  );
  
  const handlePromptFocus = () => {
    setIsAssistantVisible(true);
    setShowSuggestions(true);
  };
  
  const handlePromptBlur = (e: React.FocusEvent) => {
    // Hide assistant if focus moves outside the container
    if (promptContainerRef.current && !promptContainerRef.current.contains(e.relatedTarget as Node)) {
        setIsAssistantVisible(false);
    }
    // Hide suggestions dropdown specifically
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleTranscript = (transcript: string) => {
    setState((prevState: any) => ({
      ...prevState,
      prompt: prevState.prompt ? `${prevState.prompt} ${transcript}` : transcript
    }));
  };

  const isLoading = isGeneratingImage || isOptimizing || isInspirationAnalyzing;
  const canGenerate = !isLoading && !!state.prompt.trim();

  const leftPanel = (
    <div className="w-full h-full bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('quickGenerate.title')}</h2>
            <button onClick={handleClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
        
        <div 
            ref={promptContainerRef} 
            onBlur={handlePromptBlur} 
            className="relative"
        >
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('quickGenerate.prompt.title')}</h3>
            <PromptAssistant
                isVisible={isAssistantVisible}
                currentPrompt={state.prompt}
                onPromptUpdate={(newPrompt) => setState({ ...state, prompt: newPrompt })}
                imageDataUrl={state.refImageUrl}
                language={language}
            />
            <div className="relative">
              <textarea 
                value={state.prompt} 
                onChange={e => setState({ ...state, prompt: e.target.value })} 
                placeholder={t('quickGenerate.prompt.placeholder')} 
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-32 resize-none pr-12" 
                onFocus={handlePromptFocus}
              />
              <div className="absolute bottom-2 right-2">
                <SpeechToTextButton onTranscript={handleTranscript} language={language} />
              </div>
            </div>
            {showSuggestions && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 p-3 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('quickGenerate.suggestions.arch')}</h3>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.arch.map((p, i) => <SuggestionButton key={`arch-${i}`} suggestion={p} />)}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('quickGenerate.suggestions.interior')}</h3>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.interior.map((p, i) => <SuggestionButton key={`int-${i}`} suggestion={p} />)}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('quickGenerate.suggestions.landscape')}</h3>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.landscape.map((p, i) => <SuggestionButton key={`land-${i}`} suggestion={p} />)}
                        </div>
                    </div>
                </div>
            )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 -mt-2">
            <label className="flex items-center space-x-2 cursor-pointer flex-1">
                <input
                    type="checkbox"
                    checked={state.isArtisticSketch}
                    onChange={(e) => setState({...state, isArtisticSketch: e.target.checked})}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('quickGenerate.artisticSketch.label')}</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer flex-1">
                <input
                    type="checkbox"
                    checked={state.isMoodBoard}
                    onChange={(e) => setState({...state, isMoodBoard: e.target.checked})}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('quickGenerate.moodBoard.label')}</span>
            </label>
        </div>


        <div className="p-3 bg-gray-200 dark:bg-gray-900/50 rounded-md space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('quickGenerate.optimize.title')}</h3>
            <button 
                onClick={handleOptimizePrompt}
                disabled={isOptimizing || !state.prompt.trim()}
                className="w-full py-2 px-2 rounded-md text-sm transition-colors bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-500 flex items-center justify-center space-x-2">
                    {isOptimizing ? <LoadingSpinner className="w-4 h-4"/> : <WandIcon className="w-4 h-4"/>}
                    <span>{isOptimizing ? t('quickGenerate.optimize.optimizing') : t('quickGenerate.optimize.button')}</span>
            </button>
        </div>
        
        <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">{t('quickGenerate.inspiration.title')}</h3>
            <FileUpload
                id="quick-generate-ref"
                onFileChange={handleRefImageChange}
                previewUrl={state.refImageUrl}
                onClear={() => handleRefImageChange(null)}
                containerClassName="h-40"
            />
            {state.refImageUrl && (
                <div className="p-3 bg-gray-200 dark:bg-gray-900/50 rounded-md space-y-2">
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
        </div>


        <div className="border-t border-gray-300 dark:border-gray-700 pt-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('quickGenerate.options.title')}</h3>
             <SelectInput
                label={t('quickGenerate.options.model')}
                options={translatedModels.map(m => m.name)}
                value={translatedModels.find(m => m.value === state.imageModel)?.name || ''}
                onChange={(name) => {
                    const model = translatedModels.find(m => m.name === name);
                    if (model) setState({ ...state, imageModel: model.value });
                }}
            />
            <Slider label={t('enhance.options.creativity')} min={0} max={10} step={1} value={state.creativity} onChange={(v) => setState({ ...state, creativity: v })} />
            <p className="text-xs text-gray-500 -mt-3 px-1">{t('enhance.options.creativityHint')}</p>

            <SelectInput 
                label={t('render.options.aspectRatio')} 
                options={translatedAspectRatios} 
                value={t(state.aspectRatio)} 
                onChange={(val) => {
                    const key = ASPECT_RATIO_KEYS.find(k => t(k) === val);
                    if(key) setState({ ...state, aspectRatio: key });
                }} 
            />
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
            
            <button onClick={handleGenerate} disabled={!canGenerate} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 flex items-center justify-center space-x-2">
                 {isLoading ? (
                    <>
                        <LoadingSpinner className="w-5 h-5" />
                        <span>
                            {isGeneratingImage ? t('render.button.generating') : 
                             isInspirationAnalyzing ? t('render.button.analyzing') :
                             t('quickGenerate.optimize.optimizing')}
                        </span>
                    </>
                ) : (
                    <>
                        <SparklesIcon className="w-5 h-5" />
                        <span>{t('render.button.generate')}</span>
                    </>
                )}
            </button>
        </div>
      </div>
  );

  const rightPanel = (
    <div className="w-full h-full bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 overflow-y-auto no-scrollbar flex justify-center items-start">
      {isLoading ? (
          <CatLoadingAnimation text={
              isGeneratingImage ? t('quickGenerate.status.generating') :
              isInspirationAnalyzing ? t('render.button.analyzing') :
              t('quickGenerate.optimize.optimizing')
          } />
      ) : error ? (
          <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-md">{error}</div>
      ) : state.results.length === 1 ? (
          <div className="w-full max-w-xl">
              {renderResultCard(state.results[0], 0)}
          </div>
      ) : state.results.length > 1 ? (
          <div className="w-full flex flex-col gap-4">
              {state.refImageUrl && (
                  <div>
                      <h3 className="font-semibold mb-2 text-center text-gray-600 dark:text-gray-400">{t('comparison.original')}</h3>
                      <div className="bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 max-h-48 w-full flex items-center justify-center">
                          <img src={state.refImageUrl} alt="Reference" className="max-h-48 max-w-full object-contain" />
                      </div>
                  </div>
              )}
              <h3 className="font-semibold text-center text-gray-600 dark:text-gray-400">{t('comparison.result')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {state.results.map((result: ImageResultType, index: number) => renderResultCard(result, index))}
              </div>
          </div>
      ) : (
          <EmptyStateGuide tabType={Tab.QuickGenerate} />
      )}
    </div>
  );

  return (
    <div className="w-full h-full">
        <ResizablePanels leftPanel={leftPanel} rightPanel={rightPanel} />
    </div>
  );
};

export default QuickGenerateTab;
