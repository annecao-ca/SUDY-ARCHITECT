import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { XMarkIcon, LoadingSpinner, SparklesIcon, PlusIcon } from './icons';

interface ZoomPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  initialPrompt: string;
  suggestions: string[];
  isLoading: boolean;
}

const ZoomPromptModal: React.FC<ZoomPromptModalProps> = ({ isOpen, onClose, onSubmit, initialPrompt, suggestions, isLoading }) => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPrompt(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(prev => prev ? `${prev}, ${suggestion}` : suggestion);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(prompt);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg m-4 relative border border-gray-300 dark:border-gray-700" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('virtualTour.zoomModal.title')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('virtualTour.zoomModal.description')}</p>
        
        <form onSubmit={handleSubmit}>
            {isLoading ? (
                <div className="h-48 flex flex-col items-center justify-center">
                    <LoadingSpinner className="w-8 h-8 text-blue-500" />
                    <p className="mt-2 text-gray-500">Analyzing...</p>
                </div>
            ) : (
                <>
                    <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder={t('virtualTour.zoomModal.placeholder')}
                        className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 h-32 resize-none"
                    />
                    {suggestions.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Suggestions:</h3>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleSuggestionClick(s)}
                                        className="flex items-center gap-1 text-sm bg-gray-200 dark:bg-gray-700/80 rounded-full px-3 py-1 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                                    >
                                        <PlusIcon className="w-3 h-3" />
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">
                    {t('close')}
                </button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-500 flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5" />
                    {t('render.button.generate')}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ZoomPromptModal;