import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImageResult as ImageResultType, EnhanceState, GenerationInfo } from '../types';
import { DownloadIcon, SparklesIcon, ExpandIcon, ChevronLeftIcon, ChevronRightIcon, LoopIcon, ArrowUpOnSquareIcon, WandIcon, DocumentTextIcon, VideoCameraIcon, CubeIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

interface SideBySideComparisonProps {
  originalImageSrc: string | null;
  generatedResult: ImageResultType;
  onFullscreen: () => void;
  onEnhance?: (state: EnhanceState) => void;
  onRegenerate?: (info: GenerationInfo) => void;
  onSendToTraining?: (state: EnhanceState) => void;
  onSendToTechDrawing?: (state: EnhanceState) => void;
  onSendToUpscale?: (state: EnhanceState) => void;
  onSendToVeo?: (state: EnhanceState) => void;
  onSendToRenderAIMain?: (state: EnhanceState) => void;
}

const SideBySideComparison: React.FC<SideBySideComparisonProps> = ({ 
    originalImageSrc, 
    generatedResult, 
    onFullscreen,
    onEnhance,
    onRegenerate,
    onSendToTraining,
    onSendToTechDrawing,
    onSendToUpscale,
    onSendToVeo,
    onSendToRenderAIMain
}) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newPos = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(newPos);
  }, []);
  
   useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setIsMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = `data:${generatedResult.mimeType};base64,${generatedResult.base64}`;
    link.download = `result_${generatedResult.id}_sudyapp.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (generatedResult.generationInfo && onRegenerate) {
        onRegenerate(generatedResult.generationInfo);
    }
  };
  
  const generatedImageUrl = `data:${generatedResult.mimeType};base64,${generatedResult.base64}`;
  const enhanceState = { image: generatedResult.base64, mimeType: generatedResult.mimeType };

  const sendToMenuItems = [
    onEnhance && { label: t('imageLibrary.action.enhance'), icon: <SparklesIcon className="w-5 h-5" />, action: () => onEnhance(enhanceState) },
    onSendToRenderAIMain && { label: t('imageLibrary.action.sendToRenderMain'), icon: <CubeIcon className="w-5 h-5" />, action: () => onSendToRenderAIMain(enhanceState) },
    onSendToTraining && { label: t('imageLibrary.action.train'), icon: <WandIcon className="w-5 h-5" />, action: () => onSendToTraining(enhanceState) },
    onSendToTechDrawing && { label: t('imageLibrary.action.techDraw'), icon: <DocumentTextIcon className="w-5 h-5" />, action: () => onSendToTechDrawing(enhanceState) },
    onSendToUpscale && { label: t('imageLibrary.action.upscale'), icon: <ArrowUpOnSquareIcon className="w-5 h-5" />, action: () => onSendToUpscale(enhanceState) },
    onSendToVeo && { label: t('imageLibrary.action.veo'), icon: <VideoCameraIcon className="w-5 h-5" />, action: () => onSendToVeo(enhanceState) },
  ].filter((item): item is NonNullable<typeof item> => !!item);


  return (
    <div className={`group relative w-full ${isMenuOpen ? 'z-30' : ''}`}>
        <div ref={containerRef} className="relative aspect-square w-full select-none overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800">
            {originalImageSrc && (
                <img src={originalImageSrc} alt={t('comparison.original')} draggable={false} className="absolute inset-0 w-full h-full object-contain"/>
            )}
            <div className="absolute inset-0 w-full h-full" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                <img src={generatedImageUrl} alt={t('comparison.result')} draggable={false} className="absolute inset-0 w-full h-full object-contain" />
            </div>
            <div
                className="absolute top-0 bottom-0 -ml-0.5 w-1 bg-white/80 cursor-ew-resize flex items-center justify-center z-10"
                style={{ left: `${sliderPos}%` }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                <div className="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center text-gray-800 shadow-lg pointer-events-none">
                    <ChevronLeftIcon className="w-4 h-4 -mr-1" />
                    <ChevronRightIcon className="w-4 h-4 -ml-1" />
                </div>
            </div>
        </div>
        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2" onClick={() => isMenuOpen && setIsMenuOpen(false)}>
             <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                <button onClick={handleDownload} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.download')}>
                    <DownloadIcon className="w-5 h-5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onFullscreen(); }} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.view')}>
                    <ExpandIcon className="w-5 h-5" />
                </button>
                {generatedResult.generationInfo && onRegenerate && (
                     <button onClick={handleRegen} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.regenerate')}>
                        <LoopIcon className="w-5 h-5" />
                    </button>
                )}
                {sendToMenuItems.length > 0 && (
                    <div className="relative" ref={isMenuOpen ? menuRef : null}>
                        <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(prev => !prev); }} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('sideBySide.sendTo')}>
                            <ArrowUpOnSquareIcon className="w-5 h-5" />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute top-full mt-2 right-1/2 translate-x-1/2 w-48 bg-gray-900/90 backdrop-blur-sm rounded-md shadow-lg z-40 border border-gray-700 p-1">
                                {sendToMenuItems.map(item => (
                                    <button key={item.label} onClick={() => { item.action(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-gray-200 hover:bg-blue-600/50 rounded-md">
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default SideBySideComparison;