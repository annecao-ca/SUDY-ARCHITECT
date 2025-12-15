import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SparklesIcon, ChevronDownIcon } from './icons';
import SelectInput from './SelectInput';
import Slider from './Slider';
import { ASPECT_RATIO_KEYS, IMAGE_GENERATION_MODELS } from '../constants';
import { useTranslation } from '../hooks/useTranslation';

interface HomePromptBarProps {
  onGenerate: (prompt: string, options: any) => void;
}

const HomePromptBar: React.FC<HomePromptBarProps> = ({ onGenerate }) => {
    const { t } = useTranslation();
    const [prompt, setPrompt] = useState('');
    const [isOptionsVisible, setIsOptionsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Default options from initialQuickGenerateState
    const [options, setOptions] = useState({
        aspectRatio: ASPECT_RATIO_KEYS[1],
        numResults: 1,
        imageModel: IMAGE_GENERATION_MODELS[0].value,
        isArtisticSketch: false,
        isMoodBoard: false,
    });
    
    const translatedModels = useMemo(() => IMAGE_GENERATION_MODELS.map(m => ({ ...m, name: t(m.nameKey) })), [t]);
    const translatedAspectRatios = useMemo(() => ASPECT_RATIO_KEYS.filter(r => r !== 'aspect.original').map(key => t(key)), [t]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOptionsVisible(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleGenerateClick = () => {
        if (prompt.trim()) {
            onGenerate(prompt, {
                ...options,
                aspectRatio: options.aspectRatio
            });
        }
    };

    return (
        <div ref={containerRef} className="relative w-full max-w-3xl mx-auto z-20" style={{ filter: 'drop-shadow(0 4px 15px rgba(0,0,0,0.4))' }}>
            <div 
                className="flex items-center gap-2 p-2 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full border border-white/30 dark:border-black/30 shadow-lg"
                onClick={() => setIsOptionsVisible(true)}
            >
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleGenerateClick();
                        }
                    }}
                    placeholder={t('quickGenerate.prompt.placeholder')}
                    className="flex-grow bg-transparent text-white dark:text-gray-100 placeholder-gray-200 dark:placeholder-gray-300 border-none focus:ring-0 resize-none p-2 text-sm leading-tight h-10"
                    rows={1}
                />
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOptionsVisible(prev => !prev);
                    }} 
                    className="p-2 text-white/70 hover:text-white"
                >
                    <ChevronDownIcon className={`w-5 h-5 transition-transform ${isOptionsVisible ? 'rotate-180' : ''}`} />
                </button>
                <button 
                    onClick={handleGenerateClick}
                    disabled={!prompt.trim()}
                    className="flex-shrink-0 bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700 disabled:bg-gray-500 transition-colors"
                    title={t('render.button.generate')}
                >
                    <SparklesIcon className="w-5 h-5" />
                </button>
            </div>

            {isOptionsVisible && (
                <div className="absolute top-full mt-2 w-full bg-white/20 dark:bg-black/20 backdrop-blur-xl rounded-2xl border border-white/30 dark:border-black/30 shadow-2xl p-4 space-y-4">
                     <SelectInput
                        label={t('quickGenerate.options.model')}
                        options={translatedModels.map(m => m.name)}
                        value={translatedModels.find(m => m.value === options.imageModel)?.name || ''}
                        onChange={(name) => {
                            const model = translatedModels.find(m => m.name === name);
                            if (model) setOptions(prev => ({ ...prev, imageModel: model.value }));
                        }}
                    />
                    <SelectInput 
                        label={t('render.options.aspectRatio')} 
                        options={translatedAspectRatios} 
                        value={t(options.aspectRatio)} 
                        onChange={(val) => {
                            const key = ASPECT_RATIO_KEYS.find(k => t(k) === val);
                            if(key) setOptions(prev => ({ ...prev, aspectRatio: key }));
                        }} 
                    />
                    <Slider 
                        label={t('render.options.resultCount')} 
                        min={1} max={6} step={1} 
                        value={options.numResults} 
                        onChange={(v) => setOptions(prev => ({ ...prev, numResults: v }))} 
                    />
                     <div className="flex flex-col sm:flex-row gap-4">
                        <label className="flex items-center space-x-2 cursor-pointer flex-1 text-white">
                            <input
                                type="checkbox"
                                checked={options.isArtisticSketch}
                                onChange={(e) => setOptions(prev => ({...prev, isArtisticSketch: e.target.checked}))}
                                className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-100 dark:text-gray-200">{t('quickGenerate.artisticSketch.label')}</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer flex-1 text-white">
                            <input
                                type="checkbox"
                                checked={options.isMoodBoard}
                                onChange={(e) => setOptions(prev => ({...prev, isMoodBoard: e.target.checked}))}
                                className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-100 dark:text-gray-200">{t('quickGenerate.moodBoard.label')}</span>
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePromptBar;