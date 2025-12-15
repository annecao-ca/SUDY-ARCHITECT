import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { WandIcon, LightBulbIcon, ArrowsRightLeftIcon, CameraIcon, LoadingSpinner, XMarkIcon, DocumentDuplicateIcon, PlusIcon } from './icons';
import { expandPrompt, shortenPrompt, suggestCreativePrompt, suggestCameraSettings } from '../services/geminiService';
import { dataURLtoBase64 } from '../utils/file';

interface PromptAssistantProps {
  currentPrompt: string;
  onPromptUpdate: (newPrompt: string) => void;
  imageDataUrl?: string | null;
  language: string;
  isVisible: boolean;
}

const PromptAssistant: React.FC<PromptAssistantProps> = ({ currentPrompt, onPromptUpdate, imageDataUrl, language, isVisible }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [suggestionMenuOpen, setSuggestionMenuOpen] = useState(false);
  const [cameraSuggestions, setCameraSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const assistantRef = useRef<HTMLDivElement>(null);
  const image = imageDataUrl ? dataURLtoBase64(imageDataUrl) : null;

  useEffect(() => {
    // Reset suggestion menu when assistant becomes visible
    if (isVisible) {
      setSuggestionMenuOpen(false);
    }
  }, [isVisible]);

  const runAction = async (action: string, serviceCall: () => Promise<any>) => {
    setIsLoading(action);
    setError(null);
    try {
      const result = await serviceCall();
      if (action === 'camera') {
        setCameraSuggestions(result || []);
      } else {
        onPromptUpdate(result);
      }
    } catch (e) {
      console.error(`Prompt assistant error (${action}):`, e);
      setError(t('promptAssistant.error', { action }));
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsLoading(null);
    }
  };

  const handleExpand = () => runAction('expand', () => expandPrompt(currentPrompt, image, language));
  const handleShorten = () => runAction('shorten', () => shortenPrompt(currentPrompt, language));
  const handleSuggestCamera = () => runAction('camera', () => suggestCameraSettings(currentPrompt, image, language));
  const handleSuggestCreative = (type: 'surreal' | 'stylist' | 'moodboard') => {
    if (!image) return;
    setSuggestionMenuOpen(false);
    runAction('suggest', () => suggestCreativePrompt(currentPrompt, image, type, language));
  };

  const copyAndClose = (suggestion: string) => {
    navigator.clipboard.writeText(suggestion);
    setCameraSuggestions([]);
  };
  
  const appendAndClose = (suggestion: string) => {
    onPromptUpdate(currentPrompt ? `${currentPrompt}, ${suggestion}` : suggestion);
    setCameraSuggestions([]);
  };

  const buttonClass = "p-1.5 rounded-full text-gray-300 hover:bg-gray-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <>
      <div 
        ref={assistantRef}
        className={`absolute top-full left-0 mt-2 w-auto bg-gray-700/90 backdrop-blur-sm border border-gray-600 rounded-lg shadow-lg flex items-center gap-1 p-1 z-30 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <span className="text-xs font-bold text-pink-400 px-2">{t('promptAssistant.title')}</span>

        <button onClick={handleExpand} disabled={!!isLoading} className={buttonClass} title={t('promptAssistant.expand')}>
            {isLoading === 'expand' ? <LoadingSpinner className="w-5 h-5"/> : <LightBulbIcon className="w-5 h-5"/>}
        </button>
        <button onClick={handleShorten} disabled={!!isLoading} className={buttonClass} title={t('promptAssistant.shorten')}>
            {isLoading === 'shorten' ? <LoadingSpinner className="w-5 h-5"/> : <ArrowsRightLeftIcon className="w-5 h-5"/>}
        </button>
        <button onClick={handleSuggestCamera} disabled={!!isLoading} className={buttonClass} title={t('promptAssistant.suggestCamera')}>
            {isLoading === 'camera' ? <LoadingSpinner className="w-5 h-5"/> : <CameraIcon className="w-5 h-5"/>}
        </button>

        <div className="relative">
            <button 
                onClick={() => setSuggestionMenuOpen(prev => !prev)} 
                disabled={!!isLoading || !image} 
                className={buttonClass}
                title={t('promptAssistant.suggestCreative')}
            >
                {isLoading === 'suggest' ? <LoadingSpinner className="w-5 h-5"/> : <WandIcon className="w-5 h-5"/>}
            </button>
            {suggestionMenuOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-32 bg-gray-800 border border-gray-600 rounded-md shadow-xl p-1">
                    <button onClick={() => handleSuggestCreative('surreal')} className="w-full text-left text-sm p-1.5 rounded hover:bg-gray-700">{t('promptAssistant.creative.surreal')}</button>
                    <button onClick={() => handleSuggestCreative('stylist')} className="w-full text-left text-sm p-1.5 rounded hover:bg-gray-700">{t('promptAssistant.creative.stylistic')}</button>
                    <button onClick={() => handleSuggestCreative('moodboard')} className="w-full text-left text-sm p-1.5 rounded hover:bg-gray-700">{t('promptAssistant.creative.moodboard')}</button>
                </div>
            )}
        </div>
        
        {error && <div className="absolute top-full mt-2 text-xs text-red-400">{error}</div>}
      </div>

      {cameraSuggestions.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-gray-800 border border-gray-600 rounded-md shadow-xl p-2 z-20">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold">{t('promptAssistant.cameraSuggestions.title')}</h4>
            <button onClick={() => setCameraSuggestions([])} className="p-1 rounded-full hover:bg-gray-700">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {cameraSuggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-1.5 bg-gray-700 rounded-md">
                <span className="flex-grow">{s}</span>
                <div className="flex items-center flex-shrink-0 ml-2">
                  <button onClick={() => appendAndClose(s)} className="p-1 hover:bg-gray-600 rounded" title={t('promptAssistant.cameraSuggestions.append')}>
                    <PlusIcon className="w-4 h-4"/>
                  </button>
                  <button onClick={() => copyAndClose(s)} className="p-1 hover:bg-gray-600 rounded" title={t('promptAssistant.cameraSuggestions.copy')}>
                    <DocumentDuplicateIcon className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default PromptAssistant;