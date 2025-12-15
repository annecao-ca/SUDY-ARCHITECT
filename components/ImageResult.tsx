import React, { useState, useRef, useEffect } from 'react';
import { ImageResult as ImageResultType, EnhanceState, GenerationInfo, Tab } from '../types';
import { DownloadIcon, SparklesIcon, ExpandIcon, LoopIcon, ArrowUpOnSquareIcon, TrashIcon, WandIcon, DocumentTextIcon, VideoCameraIcon, BlueprintIcon, CubeIcon, LightningBoltIcon, PaintBrushIcon, ViewfinderCircleIcon, PhotoIcon } from './icons/index';
import { useTranslation } from '../hooks/useTranslation';

interface ImageResultProps {
  result: ImageResultType;
  onFullscreen: () => void;
  onRegenerate?: (info: GenerationInfo) => void;
  onDelete?: (id: string) => void;
  onUseAsInput?: () => void; // Specific to EnhanceTab
  
  // Comprehensive "Send To" props
  onSendToEnhance?: (state: EnhanceState) => void;
  onSendToQuickGenerateInspiration?: (state: EnhanceState) => void;
  onSendToRenderAIMain?: (state: EnhanceState) => void;
  onSendToRenderAIRef?: (state: EnhanceState) => void;
  onSendToTraining?: (state: EnhanceState) => void;
  onSendToFloorPlanRef?: (state: EnhanceState) => void;
  onSendToColoringRef?: (state: EnhanceState) => void;
  onSendToVirtualTour?: (state: EnhanceState) => void;
  onSendToTechDrawing?: (state: EnhanceState) => void;
  onSendToUpscale?: (state: EnhanceState) => void;
  onSendToVeo?: (state: EnhanceState) => void;
}

const ImageResult: React.FC<ImageResultProps> = (props) => {
  const { result, onFullscreen, onRegenerate, onDelete, onUseAsInput, ...sendToProps } = props;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  
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
    link.href = `data:${result.mimeType};base64,${result.base64}`;
    link.download = `result_${result.id}_sudyapp.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (result.generationInfo && onRegenerate) {
        onRegenerate(result.generationInfo);
    }
  };
  
  const handleUseAsInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    if(onUseAsInput) onUseAsInput();
  }

  const enhanceState: EnhanceState = { image: result.base64, mimeType: result.mimeType };

  const sendToMenuItems = [
    sendToProps.onSendToEnhance && { label: t('imageLibrary.action.enhance'), icon: <SparklesIcon className="w-5 h-5" />, action: () => sendToProps.onSendToEnhance!(enhanceState) },
    sendToProps.onSendToQuickGenerateInspiration && { label: t('imageLibrary.action.sendToQuickGen'), icon: <LightningBoltIcon className="w-5 h-5" />, action: () => sendToProps.onSendToQuickGenerateInspiration!(enhanceState) },
    sendToProps.onSendToRenderAIMain && { label: t('imageLibrary.action.sendToRenderMain'), icon: <CubeIcon className="w-5 h-5" />, action: () => sendToProps.onSendToRenderAIMain!(enhanceState) },
    sendToProps.onSendToRenderAIRef && { label: t('imageLibrary.action.sendToRenderRef'), icon: <WandIcon className="w-5 h-5" />, action: () => sendToProps.onSendToRenderAIRef!(enhanceState) },
    sendToProps.onSendToTraining && { label: t('imageLibrary.action.train'), icon: <PhotoIcon className="w-5 h-5" />, action: () => sendToProps.onSendToTraining!(enhanceState) },
    sendToProps.onSendToFloorPlanRef && { label: t('imageLibrary.action.sendToFloorPlanRef'), icon: <BlueprintIcon className="w-5 h-5" />, action: () => sendToProps.onSendToFloorPlanRef!(enhanceState) },
    sendToProps.onSendToColoringRef && { label: t('imageLibrary.action.sendToColoringRef'), icon: <PaintBrushIcon className="w-5 h-5" />, action: () => sendToProps.onSendToColoringRef!(enhanceState) },
    sendToProps.onSendToVirtualTour && { label: t('imageLibrary.action.sendToVirtualTour'), icon: <ViewfinderCircleIcon className="w-5 h-5" />, action: () => sendToProps.onSendToVirtualTour!(enhanceState) },
    sendToProps.onSendToTechDrawing && { label: t('imageLibrary.action.techDraw'), icon: <DocumentTextIcon className="w-5 h-5" />, action: () => sendToProps.onSendToTechDrawing!(enhanceState) },
    sendToProps.onSendToUpscale && { label: t('imageLibrary.action.upscale'), icon: <ArrowUpOnSquareIcon className="w-5 h-5" />, action: () => sendToProps.onSendToUpscale!(enhanceState) },
    sendToProps.onSendToVeo && { label: t('imageLibrary.action.veo'), icon: <VideoCameraIcon className="w-5 h-5" />, action: () => sendToProps.onSendToVeo!(enhanceState) },
  ].filter((item): item is NonNullable<typeof item> => !!item);


  return (
    <div className={`group relative bg-gray-200 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 ${isMenuOpen ? 'z-40' : ''}`}>
      <img src={`data:${result.mimeType};base64,${result.base64}`} alt="Generated result" className="w-full h-full object-contain rounded-lg"/>
      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2" onClick={() => isMenuOpen && setIsMenuOpen(false)}>
        <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
            <button onClick={handleDownload} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.download')}>
                <DownloadIcon className="w-5 h-5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onFullscreen(); }} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.view')}>
                <ExpandIcon className="w-5 h-5" />
            </button>
            {result.generationInfo && onRegenerate && (
                 <button onClick={handleRegen} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.regenerate')}>
                    <LoopIcon className="w-5 h-5" />
                </button>
            )}
            {onUseAsInput && (
                 <button onClick={handleUseAsInput} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.useAsInput')}>
                    <SparklesIcon className="w-5 h-5" />
                </button>
            )}
            {sendToMenuItems.length > 0 && (
                <div className="relative" ref={isMenuOpen ? menuRef : null}>
                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(prev => !prev); }} className="p-2 bg-gray-700/80 rounded-full text-white hover:bg-blue-600 transition-colors" title={t('imageLibrary.action.sendTo')}>
                        <ArrowUpOnSquareIcon className="w-5 h-5" />
                    </button>
                    {isMenuOpen && (
                        <div className="absolute top-full mt-2 right-1/2 translate-x-1/2 w-56 bg-gray-900/90 backdrop-blur-sm rounded-md shadow-lg z-40 border border-gray-700 p-1 max-h-60 overflow-y-auto">
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
            {onDelete && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(result.id); }} className="p-2 bg-red-700/80 rounded-full text-white hover:bg-red-600 transition-colors" title={t('imageLibrary.action.delete')}>
                    <TrashIcon className="w-5 h-5" />
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ImageResult;