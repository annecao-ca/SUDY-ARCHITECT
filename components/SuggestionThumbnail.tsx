import React, { useState, useEffect } from 'react';
import { useSuggestion } from '../contexts/SuggestionContext';
import { FolderOpenIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

const SuggestionThumbnail: React.FC = () => {
  const { suggestion, setSuggestion } = useSuggestion();
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (suggestion) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Allow fade-out animation to complete before clearing
        setTimeout(() => setSuggestion(null), 500); 
      }, 5000); // 5 seconds visible
      
      return () => clearTimeout(timer);
    }
  }, [suggestion, setSuggestion]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!suggestion) return;
    const data = JSON.stringify({
      base64: suggestion.base64,
      mimeType: suggestion.mimeType,
    });
    e.dataTransfer.setData('application/sudy-image-suggestion', data);
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (!suggestion) {
    return null;
  }
  
  const animationClass = isVisible ? 'suggestion-thumbnail-enter' : 'suggestion-thumbnail-leave';

  return (
    <div 
      className={`fixed bottom-24 left-24 z-50 p-2 bg-white/10 dark:bg-gray-900/50 backdrop-blur-md rounded-xl border border-gray-400 dark:border-gray-600 shadow-2xl ${animationClass}`}
      onDragStart={handleDragStart}
      draggable="true"
    >
      <div className="relative w-32 h-32 cursor-grab">
        <img 
          src={`data:${suggestion.mimeType};base64,${suggestion.base64}`} 
          alt={t('suggestion.alt')}
          className="w-full h-full object-cover rounded-lg pointer-events-none"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs text-center p-1">
          <FolderOpenIcon className="w-6 h-6 mb-1" />
          {t('suggestion.drag')}
        </div>
      </div>
    </div>
  );
};

export default SuggestionThumbnail;