import React, { useState, useCallback, useEffect, useRef } from 'react';
import FileUpload from '../components/FileUpload';
import { SparklesIcon, LoadingSpinner, TrashIcon, ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, ChevronUpIcon, ChevronDownIcon, ArrowPathIcon, ExpandIcon, ArrowUturnDownIcon, CheckIcon, XMarkIcon, CursorArrowRaysIcon, SelectionIcon, TypeIcon, LoopIcon, DownloadIcon, ArrowUpOnSquareIcon } from '../components/icons';
import { ImageResult as ImageResultType, EnhanceState, Tab } from '../types';
import { generateImageFromImageAndText, getBase64FromResponse, analyzeImageForZoomPrompt, generateVirtualTourSuggestion, getSuggestionsForZoomPrompt } from '../services/geminiService';
import { nanoid } from 'nanoid';
import { useTranslation } from '../hooks/useTranslation';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { fileToDataURL, dataURLtoBase64 } from '../utils/file';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import Slider from '../components/Slider';
import CatLoadingAnimation from '../components/CatLoadingAnimation';
import SpeechToTextButton from '../components/SpeechToTextButton';
import ResizablePanels from '../components/ResizablePanels';

const cropDataURL = (dataUrl: string, crop: { x: number, y: number, width: number, height: number }): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const sourceX = img.naturalWidth * crop.x;
            const sourceY = img.naturalHeight * crop.y;
            const sourceWidth = img.naturalWidth * crop.width;
            const sourceHeight = img.naturalHeight * crop.height;

            if (sourceWidth <= 0 || sourceHeight <= 0) {
                reject(new Error("Crop dimensions must be positive."));
                return;
            }

            const TARGET_PIXELS = 1024 * 1024;
            const aspectRatio = sourceWidth / sourceHeight;
            
            const targetWidth = Math.sqrt(TARGET_PIXELS * aspectRatio);
            const targetHeight = targetWidth / aspectRatio;

            canvas.width = Math.round(targetWidth);
            canvas.height = Math.round(targetHeight);

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            } else {
                reject(new Error("Could not get canvas context."));
            }
        };
        img.onerror = () => reject(new Error("Failed to load image for cropping."));
        img.src = dataUrl;
    });
};

const ZoomPromptModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (prompt: string) => void;
    zoomPrompt: string;
    setZoomPrompt: (value: string) => void;
    suggestions: string[];
    onSuggestionClick: (suggestion: string) => void;
    t: (key: string) => string;
}> = ({ isOpen, onClose, onGenerate, zoomPrompt, setZoomPrompt, suggestions, onSuggestionClick, t }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg w-full max-w-sm" 
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
            >
                <h3 className="font-bold mb-2">{t('virtualTour.zoomModal.title')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('virtualTour.zoomModal.description')}</p>
                <textarea
                    ref={textareaRef}
                    value={zoomPrompt}
                    onChange={e => setZoomPrompt(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            onGenerate(zoomPrompt);
                        }
                    }}
                    placeholder={t('virtualTour.zoomModal.placeholder')}
                    className="w-full h-20 p-2 border rounded bg-gray-100 dark:bg-gray-700 dark:border-gray-600"
                />
                 {suggestions.length > 0 && (
                    <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Suggestions:</h4>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => onSuggestionClick(suggestion)}
                                    className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full hover:bg-blue-200 dark:hover:bg-blue-500 transition-colors"
                                >
                                    + {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded">{t('close')}</button>
                    <button onClick={() => onGenerate(zoomPrompt)} className="px-4 py-2 bg-blue-600 text-white rounded">{t('render.button.generate')}</button>
                </div>
            </div>
        </div>
    );
};

interface RegenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => void;
  t: (key: string) => string;
}

const RegenerateModal: React.FC<RegenerateModalProps> = ({ isOpen, onClose, onGenerate, t }) => {
    const [prompt, setPrompt] = useState('');
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-30 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold mb-2">{t('virtualTour.actions.regenerate')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Mô tả thay đổi bạn muốn. Ví dụ: "thay sofa thành màu xanh", "thêm một bức tranh trên tường". Để trống để tăng cường độ nét.</p>
                <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Nhập mô tả..."
                    className="w-full h-20 p-2 border rounded bg-gray-100 dark:bg-gray-700 dark:border-gray-600"
                />
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded">Hủy</button>
                    <button onClick={() => { onGenerate(prompt); setPrompt(''); }} className="px-4 py-2 bg-blue-600 text-white rounded">Tạo lại</button>
                </div>
            </div>
        </div>
    );
};


interface VirtualTourTabProps {
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
}

const VirtualTourTab: React.FC<VirtualTourTabProps> = ({ state, setState, onClear, onFullscreen }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<'navigate' | 'select'>('navigate');
  const [loadingText, setLoadingText] = useState('');
  
  const [selection, setSelection] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [interaction, setInteraction] = useState<{
    type: 'move' | 'resize';
    handle: string;
    startMouse: { clientX: number, clientY: number };
    originalSelection: { x: number, y: number, width: number, height: number };
  } | null>(null);
  const [showCropHint, setShowCropHint] = useState(false);
  const [isZoomPromptModalOpen, setIsZoomPromptModalOpen] = useState(false);
  const [isRegenModalOpen, setIsRegenModalOpen] = useState(false);
  const [zoomPrompt, setZoomPrompt] = useState('');
  const [zoomSuggestions, setZoomSuggestions] = useState<string[]>([]);


  const timelineRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const { t, language } = useTranslation();
  const { addMedia } = useImageLibrary();
  const { decrementQuota, forceQuotaDepletion } = useApiQuota();

  const currentImage = state.history[state.historyIndex];
  const currentImageUrl = currentImage ? currentImage.imageUrl : null;

  useEffect(() => {
    if (timelineRef.current && state.historyIndex >= 0) {
        const activeElement = timelineRef.current.children[state.historyIndex] as HTMLElement;
        if (activeElement) {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
  }, [state.historyIndex]);

  const handleFileChange = useCallback(async (file: File | null) => {
    if (file) {
      const dataUrl = await fileToDataURL(file);
      setState((s: any) => ({ 
        ...s, 
        originalImageFile: file, 
        originalImageUrl: dataUrl, 
        history: [{ imageUrl: dataUrl, direction: null }],
        historyIndex: 0,
      }));
    } else {
      onClear();
    }
  }, [setState, onClear]);

  const getRelativeCoords = useCallback((e: React.MouseEvent) => {
    const container = imageContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isZoomPromptModalOpen) return;
    if (tool !== 'select' || !imageRef.current || interaction) return;
    const pos = getRelativeCoords(e);
    if (!pos) return;

    setIsDrawing(true);
    setSelection({ x: pos.x, y: pos.y, width: 0, height: 0 });
  }, [tool, interaction, getRelativeCoords, isZoomPromptModalOpen]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isZoomPromptModalOpen) return;
    if (tool !== 'select' || !isDrawing || !selection) return;
    const pos = getRelativeCoords(e);
    if (!pos) return;

    setSelection(prev => {
        if (!prev) return null;
        return {
            ...prev,
            width: pos.x - prev.x,
            height: pos.y - prev.y,
        };
    });
  }, [tool, isDrawing, selection, getRelativeCoords, isZoomPromptModalOpen]);
  
  const handleMouseUp = useCallback(() => {
    if (isZoomPromptModalOpen) return;
    setIsDrawing(false);
    setSelection(prev => {
        if (!prev) return null;
        const newSelection = {
            x: prev.width < 0 ? prev.x + prev.width : prev.x,
            y: prev.height < 0 ? prev.y + prev.height : prev.y,
            width: Math.abs(prev.width),
            height: Math.abs(prev.height),
        };
        if (newSelection.width < 0.01 || newSelection.height < 0.01) {
            return null;
        }
        return newSelection;
    });
  }, [isZoomPromptModalOpen]);
  
  const handleInteractionStart = useCallback((e: React.MouseEvent, type: 'move' | 'resize', handle: string) => {
    if (!selection) return;
    e.preventDefault();
    e.stopPropagation();
    setInteraction({
        type,
        handle,
        startMouse: { clientX: e.clientX, clientY: e.clientY },
        originalSelection: { ...selection }
    });
  }, [selection]);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!interaction || !imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const dx = (e.clientX - interaction.startMouse.clientX) / rect.width;
    const dy = (e.clientY - interaction.startMouse.clientY) / rect.height;

    let newSelection = { ...interaction.originalSelection };

    if (interaction.type === 'move') {
        newSelection.x += dx;
        newSelection.y += dy;
    } else if (interaction.type === 'resize') {
        const { handle } = interaction;
        if (handle.includes('e')) newSelection.width += dx;
        if (handle.includes('w')) { newSelection.x += dx; newSelection.width -= dx; }
        if (handle.includes('s')) newSelection.height += dy;
        if (handle.includes('n')) { newSelection.y += dy; newSelection.height -= dy; }
    }
    
    if (newSelection.width < 0) {
        newSelection.x = newSelection.x + newSelection.width;
        newSelection.width = Math.abs(newSelection.width);
    }
    if (newSelection.height < 0) {
        newSelection.y = newSelection.y + newSelection.height;
        newSelection.height = Math.abs(newSelection.height);
    }
    
    newSelection.x = Math.max(0, newSelection.x);
    newSelection.y = Math.max(0, newSelection.y);
    if (newSelection.x + newSelection.width > 1) newSelection.width = 1 - newSelection.x;
    if (newSelection.y + newSelection.height > 1) newSelection.height = 1 - newSelection.y;
    
    setSelection(newSelection);
  }, [interaction]);

  const handleGlobalMouseUp = useCallback(() => {
    setInteraction(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);
  
    const handleSuggestionClick = (suggestion: string) => {
        setZoomPrompt(prev => {
            if (prev.trim() === '') return suggestion;
            if (prev.trim().endsWith(',')) return `${prev.trim()} ${suggestion}`;
            return `${prev.trim()}, ${suggestion}`;
        });
    };

  const handleAIZoom = async (userHint: string) => {
    if (!selection || !currentImageUrl) return;

    setIsLoading(true);
    setLoadingText('Analyzing zoom area...');
    setIsZoomPromptModalOpen(false);
    setZoomPrompt('');
    setError(null);

    const currentSelection = { ...selection };
    setSelection(null); 

    try {
        setLoadingText(t('virtualTour.status.generating'));
        const croppedForGenerationUrl = await cropDataURL(currentImageUrl, currentSelection);
        const imageToSend = dataURLtoBase64(croppedForGenerationUrl);

        let finalPrompt = t('virtualTour.prompts.aiZoom');
        const autoSuggestion = zoomPrompt;

        if (autoSuggestion) {
            finalPrompt += `\n\n**AI's CONTEXTUAL DESCRIPTION OF THE SCENE:**\n${autoSuggestion}`;
        }
        if (userHint && userHint.trim() && userHint !== autoSuggestion) {
            finalPrompt += `\n\n**USER'S SPECIFIC INSTRUCTIONS TO ADD/MODIFY:**\n${userHint.trim()}`;
            finalPrompt += `\n\n**FINAL INSTRUCTION:** Generate the detailed image based on the AI's contextual description, but you **MUST** also incorporate the user's specific instructions.`;
        } else if (autoSuggestion) {
            finalPrompt += `\n\n**FINAL INSTRUCTION:** Generate the image based on the AI's contextual description above.`;
        }
        
        const response = await generateImageFromImageAndText(finalPrompt, imageToSend.base64, imageToSend.mimeType);
        const b64 = getBase64FromResponse(response);

        if (b64) {
            const newDataUrl = `data:image/jpeg;base64,${b64}`;
            const newHistory = state.history.slice(0, state.historyIndex + 1);
            newHistory.push({ imageUrl: newDataUrl, direction: 'zoom' });
            
            const generationState = { ...state, history: [], historyIndex: -1, };

            setState((s: any) => ({
                ...s,
                history: newHistory,
                historyIndex: newHistory.length - 1,
            }));
            
            const newImageResult: ImageResultType = { 
                id: nanoid(), 
                base64: b64, 
                mimeType: 'image/jpeg',
                generationInfo: {
                    originTab: Tab.VirtualTour,
                    state: generationState,
                }
            };
            addMedia(newImageResult);
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
        setIsLoading(false);
        setLoadingText('');
    }
};

  const handleNavigate = useCallback(async (direction: string) => {
    if (!currentImageUrl) {
      setError(t('virtualTour.error.noImage'));
      return;
    }
    setIsLoading(true);
    setError(null);
    setShowCropHint(false);
    
    try {
        const imageToSend = dataURLtoBase64(currentImageUrl);
        
        const intensityMap: { [key: number]: { distance: string; degrees: number } } = {
            1: { distance: t('virtualTour.prompts.intensity.1'), degrees: 10 },
            2: { distance: t('virtualTour.prompts.intensity.2'), degrees: 15 },
            3: { distance: t('virtualTour.prompts.intensity.3'), degrees: 20 },
            4: { distance: t('virtualTour.prompts.intensity.4'), degrees: 25 },
            5: { distance: t('virtualTour.prompts.intensity.5'), degrees: 30 },
        };
        const { distance, degrees } = intensityMap[state.movementIntensity];

        const commandMap: { [key: string]: string } = {
            'forward': t('virtualTour.commands.forward', { distance }),
            'backward': t('virtualTour.commands.backward', { distance }),
            'look-left': t('virtualTour.commands.lookLeft', { degrees }),
            'look-right': t('virtualTour.commands.lookRight', { degrees }),
            'look-up': t('virtualTour.commands.lookUp', { degrees }),
            'look-down': t('virtualTour.commands.lookDown', { degrees }),
            'strafe-left': t('virtualTour.commands.strafeLeft', { distance }),
            'strafe-right': t('virtualTour.commands.strafeRight', { distance }),
            'move-up': t('virtualTour.commands.moveUp', { distance }),
            'move-down': t('virtualTour.commands.moveDown', { distance }),
            'turn-180': t('virtualTour.commands.turn180'),
        };

        const simpleDirectionCommand = commandMap[direction] || 'do nothing';

        setLoadingText('Analyzing scene for next move...');
        const detailedNavigationCommand = await generateVirtualTourSuggestion(imageToSend, simpleDirectionCommand, state.prompt, language);

        setLoadingText(t('virtualTour.status.generating'));
        const finalPrompt = `
            **TASK:** You are an AI image generator continuing a virtual tour sequence.
            **INPUT:** The provided image is the *previous frame* in the sequence.
            **INSTRUCTION:** Generate the *next frame*. The new image must logically and visually connect to the previous frame as if the camera has moved.
            **MOVEMENT & SCENE DESCRIPTION:** The following text describes the specific camera movement and the new scene to be rendered. You must follow this description precisely.
            ---
            **USER'S OVERALL STYLE TO MAINTAIN:** ${state.prompt || 'None'}
            ---
            **DETAILED PROMPT FOR THIS FRAME:**
            ${detailedNavigationCommand}
        `;

        const response = await generateImageFromImageAndText(finalPrompt, imageToSend.base64, imageToSend.mimeType);
        const b64 = getBase64FromResponse(response);

        if (b64) {
            const newDataUrl = `data:image/jpeg;base64,${b64}`;
            
            const newHistory = state.history.slice(0, state.historyIndex + 1);
            newHistory.push({ imageUrl: newDataUrl, direction: direction });
            
            const generationState = { ...state, history: [], historyIndex: -1, };

            setState((s: any) => ({
                ...s,
                history: newHistory,
                historyIndex: newHistory.length - 1,
            }));
            
            const newImageResult: ImageResultType = {
                id: nanoid(),
                base64: b64,
                mimeType: 'image/jpeg',
                generationInfo: {
                    originTab: Tab.VirtualTour,
                    state: generationState,
                }
            };
            addMedia(newImageResult);
            decrementQuota(10);
        } else {
            setError(t('render.error.noImageInResponse'));
        }

    } catch (e) {
        console.error(e);
        const errorString = e instanceof Error ? e.message : String(e);
        if (errorString.toLowerCase().includes('quota')) {
            setError(t('error.apiQuotaExceeded'));
            forceQuotaDepletion();
        } else {
            setError(`${t('render.error.generateFailed')}: ${errorString}`);
        }
    } finally {
        setIsLoading(false);
        setLoadingText('');
    }
  }, [currentImageUrl, state.movementIntensity, state.prompt, state.history, state.historyIndex, t, language, setState, addMedia, decrementQuota, forceQuotaDepletion]);

    const handleOpenZoomPromptModal = async () => {
        if (!selection || !currentImageUrl) return;
        
        setIsLoading(true);
        setLoadingText('Analyzing zoom area...');
        setZoomPrompt('');
        setZoomSuggestions([]);
        
        try {
            const croppedForAnalysisUrl = await cropDataURL(currentImageUrl, selection);
            const fullImage = dataURLtoBase64(currentImageUrl);
            const croppedForAnalysisImage = dataURLtoBase64(croppedForAnalysisUrl);
            
            const [autoSuggestion, suggestionsArray] = await Promise.all([
                analyzeImageForZoomPrompt(fullImage, croppedForAnalysisImage, language),
                getSuggestionsForZoomPrompt(fullImage, croppedForAnalysisImage, language)
            ]);
            
            setZoomPrompt(autoSuggestion);
            setZoomSuggestions(suggestionsArray || []);

        } catch (analysisError) {
            console.error("Failed to generate auto-suggestion or suggestions for zoom:", analysisError);
            setZoomPrompt(''); 
            setZoomSuggestions([]);
        } finally {
            setIsLoading(false);
            setLoadingText('');
            setIsZoomPromptModalOpen(true);
        }
    };
    
    const handleEnhanceSharpness = async () => {
        if (!currentImageUrl) return;
        
        setIsLoading(true);
        setLoadingText('Đang tăng cường chi tiết...');
        setError(null);

        try {
            const imageToSend = dataURLtoBase64(currentImageUrl);
            const enhancePrompt = `**ULTIMATE TASK:** You are an expert image analysis and enhancement engine. Your goal is to recreate the provided image with maximum detail, clarity, and photorealism.

**PROCESS:**
1.  **INTERNAL ANALYSIS (DO NOT output this analysis):** First, conduct an exhaustive analysis of the provided source image. Deconstruct every aspect: identify the architectural style, composition, camera angle, all objects and their placement, every material and its texture (e.g., wood grain, concrete pores, fabric weave), the complete lighting scheme (sources, direction, color, shadows), and the overall mood. From this, create an extremely detailed, internal descriptive prompt that could perfectly recreate the image from scratch.
2.  **RE-GENERATION (This is your ONLY output):** Using your internal, hyper-detailed prompt, regenerate the image. The new image must be a 4K, professional-grade photograph of the exact same scene. Dramatically enhance all details based on your analysis: make textures palpable, sharpen all edges, refine lighting to be physically accurate, and perfect reflections and shadows.

**CRITICAL RULE:** The final output image MUST be compositionally identical to the source image. DO NOT add, remove, or change any objects, colors, or the overall architectural style. The goal is a higher-fidelity, technically superior version of the exact same image. Output only the final image.`;

            const response = await generateImageFromImageAndText(enhancePrompt, imageToSend.base64, imageToSend.mimeType);
            const b64 = getBase64FromResponse(response);

            if (b64) {
                const newDataUrl = `data:image/jpeg;base64,${b64}`;
                const newHistory = state.history.slice(0, state.historyIndex + 1);
                newHistory.push({ imageUrl: newDataUrl, direction: 'enhance' });

                const generationState = { ...state, history: [], historyIndex: -1, };

                setState((s: any) => ({
                    ...s,
                    history: newHistory,
                    historyIndex: newHistory.length - 1,
                }));

                addMedia({ 
                    id: nanoid(), 
                    base64: b64, 
                    mimeType: 'image/jpeg',
                    generationInfo: {
                        originTab: Tab.VirtualTour,
                        state: generationState,
                    }
                });
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
            setIsLoading(false);
            setLoadingText('');
        }
    };

    const handleRegenerateWithPrompt = async (prompt: string) => {
        setIsRegenModalOpen(false);
        if (!currentImageUrl) return;
    
        if (!prompt.trim()) {
            await handleEnhanceSharpness();
            return;
        }

        setIsLoading(true);
        setLoadingText('Đang tạo lại với các thay đổi của bạn...');
        setError(null);

        try {
            const imageToSend = dataURLtoBase64(currentImageUrl);
            const finalPrompt = `**TASK:** Modify the provided image based on the user's specific instruction. Preserve the overall scene, style, lighting, and composition as much as possible, but you MUST incorporate the following change. **USER INSTRUCTION:** "${prompt}" **OUTPUT:** Return only the modified image, maintaining the original's photorealistic quality.`;

            const response = await generateImageFromImageAndText(finalPrompt, imageToSend.base64, imageToSend.mimeType);
            const b64 = getBase64FromResponse(response);

            if (b64) {
                const newDataUrl = `data:image/jpeg;base64,${b64}`;
                const newHistory = state.history.slice(0, state.historyIndex + 1);
                newHistory.push({ imageUrl: newDataUrl, direction: 'regenerate' });
                
                const generationState = { ...state, history: [], historyIndex: -1, };

                setState((s: any) => ({
                    ...s,
                    history: newHistory,
                    historyIndex: newHistory.length - 1,
                }));
                
                addMedia({ 
                    id: nanoid(), 
                    base64: b64, 
                    mimeType: 'image/jpeg',
                    generationInfo: {
                        originTab: Tab.VirtualTour,
                        state: generationState,
                    }
                });
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
            setIsLoading(false);
            setLoadingText('');
        }
    };

    const handleDownload = () => {
        if (currentImageUrl) {
            const link = document.createElement('a');
            link.href = currentImageUrl;
            link.download = `sudy_vtour_step_${state.historyIndex}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleReset = () => {
        setState((s: any) => ({
        ...s,
        history: [{ imageUrl: s.originalImageUrl, direction: null }],
        historyIndex: 0,
        }));
    };

    const navigateHistory = (index: number) => {
        if (index >= 0 && index < state.history.length) {
            setState({...state, historyIndex: index});
        }
    };

    const handleTranscript = (transcript: string) => {
        setState((prevState: any) => ({
        ...prevState,
        prompt: prevState.prompt ? `${prevState.prompt} ${transcript}` : transcript
        }));
    };

  const NavButton: React.FC<{ direction: string; icon: React.ReactNode; label: string; className?: string; }> = ({ direction, icon, label, className = '' }) => (
    <button
      onClick={() => handleNavigate(direction)}
      disabled={isLoading || !currentImageUrl}
      className={`p-3 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center text-center transition-colors ${className}`}
      title={label}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );

  const SelectionBox: React.FC<{ selection: { x: number; y: number; width: number; height: number }; onInteractionStart: (e: React.MouseEvent, type: 'move' | 'resize', handle: string) => void; }> = ({ selection, onInteractionStart }) => {
        const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        return (
            <div
                className="absolute border-2 border-dashed border-blue-500 bg-blue-500/20 cursor-move pointer-events-auto"
                style={{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%`, width: `${selection.width * 100}%`, height: `${selection.height * 100}%` }}
                onMouseDown={(e) => onInteractionStart(e, 'move', 'move')}
            >
                {handles.map(handle => (
                    <div
                        key={handle}
                        className={`absolute w-3 h-3 bg-white border border-blue-600 -m-1.5 cursor-${handle}-resize`}
                        style={{
                            top: handle.includes('n') ? '0%' : handle.includes('s') ? '100%' : '50%',
                            left: handle.includes('w') ? '0%' : handle.includes('e') ? '100%' : '50%',
                            transform: `translate(${handle.includes('w') ? '-50%' : handle.includes('e') ? '50%' : '0'}, ${handle.includes('n') ? '-50%' : handle.includes('s') ? '50%' : '0'})`,
                        }}
                        onMouseDown={(e) => onInteractionStart(e, 'resize', handle)}
                    />
                ))}
            </div>
        );
    };

  const leftPanel = (
    <div className="w-full h-full bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-4 sm:p-6 space-y-6 overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t(Tab.VirtualTour)}</h2>
            <button onClick={onClear} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title={t('render.button.clear')}>
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
        <div>
          <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('virtualTour.upload.title')}</h3>
          <FileUpload id="virtual-tour-upload" onFileChange={handleFileChange} previewUrl={state.originalImageUrl} onClear={onClear} containerClassName="h-48" />
        </div>
        <div>
          <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('virtualTour.prompt.title')}</h3>
            <div className="relative">
                <textarea 
                    value={state.prompt} 
                    onChange={e => setState({ ...state, prompt: e.target.value })} 
                    placeholder={t('virtualTour.prompt.placeholder')} 
                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 h-20 resize-none pr-12" 
                />
                <div className="absolute bottom-2 right-2">
                    <SpeechToTextButton onTranscript={handleTranscript} language={language} />
                </div>
            </div>
        </div>
        <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
          <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('virtualTour.controls.title')}</h3>
          <div className="space-y-4">
            <div className="p-1 bg-gray-200 dark:bg-gray-700/50 rounded-lg flex gap-1 mb-4">
                <button onClick={() => setTool('navigate')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors flex items-center justify-center gap-2 ${tool === 'navigate' ? 'bg-blue-600 text-white shadow' : 'hover:bg-gray-300 dark:hover:bg-gray-600/50'}`}>
                    <CursorArrowRaysIcon className="w-5 h-5" />
                    {t('virtualTour.controls.navigate')}
                </button>
                <button onClick={() => { setTool('select'); setShowCropHint(true); }} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors flex items-center justify-center gap-2 ${tool === 'select' ? 'bg-blue-600 text-white shadow' : 'hover:bg-gray-300 dark:hover:bg-gray-600/50'}`}>
                    <SelectionIcon className="w-5 h-5" />
                    {t('virtualTour.controls.selectRegion')}
                </button>
            </div>

            <Slider label={t('virtualTour.controls.intensity')} min={1} max={5} step={1} value={state.movementIntensity} onChange={(v) => setState({ ...state, movementIntensity: v })} />
            
            <div className="grid grid-cols-3 gap-2">
              <div/>
              <NavButton direction="look-up" icon={<ChevronUpIcon className="w-5 h-5" />} label={t('virtualTour.controls.lookUp')} />
              <div/>

              <NavButton direction="look-left" icon={<ArrowUturnLeftIcon className="w-5 h-5" />} label={t('virtualTour.controls.lookLeft')} />
              <NavButton direction="look-down" icon={<ChevronDownIcon className="w-5 h-5" />} label={t('virtualTour.controls.lookDown')} />
              <NavButton direction="look-right" icon={<ArrowUturnRightIcon className="w-5 h-5" />} label={t('virtualTour.controls.lookRight')} />
              
              <div/>
              <NavButton direction="turn-180" icon={<ArrowUturnDownIcon className="w-5 h-5" />} label={t('virtualTour.controls.turn180')} />
              <div/>
            </div>
             <div className="grid grid-cols-3 gap-2">
              <div/>
              <NavButton direction="forward" icon={<ArrowUpIcon className="w-5 h-5" />} label={t('virtualTour.controls.forward')} />
              <div/>

              <NavButton direction="strafe-left" icon={<ArrowLeftIcon className="w-5 h-5" />} label={t('virtualTour.controls.strafeLeft')} />
              <NavButton direction="backward" icon={<ArrowDownIcon className="w-5 h-5" />} label={t('virtualTour.controls.backward')} />
              <NavButton direction="strafe-right" icon={<ArrowRightIcon className="w-5 h-5" />} label={t('virtualTour.controls.strafeRight')} />
            </div>
            
            <button onClick={handleReset} disabled={isLoading || !currentImageUrl} className="w-full p-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center gap-2">
              <ArrowPathIcon className="w-5 h-5"/>
              <span>{t('virtualTour.controls.reset')}</span>
            </button>
          </div>
        </div>
    </div>
  );

  const rightPanel = (
    <div className="w-full h-full flex flex-col bg-gray-100/20 dark:bg-gray-800/20 rounded-lg p-4 sm:p-6 lg:overflow-y-auto no-scrollbar">
      <div className="flex-grow relative flex items-center justify-center">
        {isLoading ? <CatLoadingAnimation text={loadingText || t('virtualTour.status.generating')} /> :
         error ? <div className="text-red-500">{error}</div> :
         currentImageUrl ? (
          <div 
            ref={imageContainerRef} 
            className={`relative w-full h-full ${tool === 'select' ? 'cursor-crosshair' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <img ref={imageRef} src={currentImageUrl} alt="Current view" className="w-full h-full object-contain pointer-events-none" />
            
            {currentImageUrl && !isLoading && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-row gap-2 bg-black/30 backdrop-blur-sm p-2 rounded-full">
                  <button onClick={handleEnhanceSharpness} title={t('virtualTour.actions.enhance')} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors">
                      <SparklesIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => setIsRegenModalOpen(true)} title={t('virtualTour.actions.regenerate')} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors">
                      <LoopIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => { setTool('select'); setShowCropHint(true); }} title={t('virtualTour.controls.selectRegion')} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors">
                      <SelectionIcon className="w-5 h-5" />
                  </button>
                  <button onClick={handleDownload} title={t('virtualTour.actions.download')} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors">
                      <DownloadIcon className="w-5 h-5" />
                  </button>
              </div>
            )}

            {selection && <SelectionBox selection={selection} onInteractionStart={handleInteractionStart} />}
            
            {selection && !isZoomPromptModalOpen && !interaction && (
                <div
                    className="absolute z-10 flex gap-2 p-2 bg-gray-800/80 backdrop-blur-sm rounded-full shadow-lg"
                    style={{
                        left: `calc(${(selection.x + selection.width / 2) * 100}%)`,
                        top: `calc(${(selection.y + selection.height) * 100}% + 1rem)`,
                        transform: 'translateX(-50%)',
                    }}
                    onMouseDown={e => e.stopPropagation()}
                >
                    <button 
                        onClick={handleOpenZoomPromptModal}
                        className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-transform hover:scale-110"
                        title="AI Zoom"
                    >
                        <SparklesIcon className="w-6 h-6" />
                    </button>
                    <button 
                        onClick={() => setSelection(null)}
                        className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-transform hover:scale-110"
                        title="Cancel"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
            )}

            {showCropHint && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-blue-500/80 text-white text-sm px-3 py-1 rounded-full animate-pulse pointer-events-none">
                  {t('virtualTour.cropHint')}
              </div>
            )}
            <ZoomPromptModal
              isOpen={isZoomPromptModalOpen}
              onClose={() => setIsZoomPromptModalOpen(false)}
              onGenerate={(prompt) => handleAIZoom(prompt)}
              zoomPrompt={zoomPrompt}
              setZoomPrompt={setZoomPrompt}
              suggestions={zoomSuggestions}
              onSuggestionClick={handleSuggestionClick}
              t={t}
            />
          </div>
         ) : (
           <div className="text-center text-gray-500">
             <p>{t('render.status.placeholder')}</p>
           </div>
         )}
      </div>
      {state.history.length > 0 && (
        <div className="flex-shrink-0 mt-4">
          <h3 className="text-md font-semibold mb-2">{t('virtualTour.timeline.title')}</h3>
          <div ref={timelineRef} className="flex gap-2 p-2 bg-gray-200 dark:bg-gray-900/50 rounded-lg overflow-x-auto">
            {state.history.map((step: { imageUrl: string }, index: number) => (
              <button key={index} onClick={() => navigateHistory(index)} className={`flex-shrink-0 w-24 h-16 rounded-md overflow-hidden border-2 ${state.historyIndex === index ? 'border-blue-500' : 'border-transparent'}`}>
                <img src={step.imageUrl} alt={`History ${index + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <RegenerateModal
          isOpen={isRegenModalOpen}
          onClose={() => setIsRegenModalOpen(false)}
          onGenerate={handleRegenerateWithPrompt}
          t={t}
      />
      <div className="w-full h-full">
        <ResizablePanels leftPanel={leftPanel} rightPanel={rightPanel} />
      </div>
    </>
  );
};

export default VirtualTourTab;
