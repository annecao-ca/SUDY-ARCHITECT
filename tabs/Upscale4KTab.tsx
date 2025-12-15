import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { ArrowUpOnSquareIcon } from '../components/icons';
import { EnhanceState, GenerationInfo, ImageResult as ImageResultType } from '../types';

// Keep props for compatibility with App.tsx, but they won't be used.
interface Upscale4KTabProps {
  initialState: EnhanceState | null;
  state: any;
  setState: (state: any) => void;
  onClear: () => void;
  onEnhance: (state: EnhanceState) => void;
  onFullscreen: (images: ImageResultType[], startIndex: number) => void;
  onConsumeInitialState: () => void;
  onRegenerate: (info: GenerationInfo) => void;
  onSendToTraining: (state: EnhanceState) => void;
  onSendToTechDrawing: (state: EnhanceState) => void;
  onSendToUpscale: (state: EnhanceState) => void;
  onSendToVeo: (state: EnhanceState) => void;
}

const Upscale4KTab: React.FC<Upscale4KTabProps> = () => {
  const { t } = useTranslation();
  const guideImageUrl = 'https://i.postimg.cc/Kvv4kRC6/UPSCALE.jpg';
  const guideLink = 'https://www.seaart.ai/workFlowDetail/d3q799de878c73e6fd10';

  return (
    <div className="w-full h-full flex items-center justify-center p-4 md:p-8 overflow-y-auto no-scrollbar">
      <div className="max-w-4xl w-full bg-gray-100 dark:bg-gray-800/50 rounded-lg p-6 sm:p-8 space-y-6 text-center">
        <div className="flex justify-center items-center gap-4">
          <ArrowUpOnSquareIcon className="w-10 h-10 text-blue-500" />
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{t('upscale.title')}</h2>
        </div>

        <p className="text-gray-700 dark:text-gray-300">
          {t('upscale.guide.description')}
        </p>

        <a
          href={guideLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 transition-colors"
        >
          {t('upscale.guide.button')}
        </a>
        
        <div className="mt-6 border-t border-gray-300 dark:border-gray-700 pt-6">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">{t('upscale.guide.preview')}</h3>
          <img
            src={guideImageUrl}
            alt="Upscale guide preview"
            className="w-full rounded-lg shadow-lg border border-gray-300 dark:border-gray-600"
          />
        </div>
      </div>
    </div>
  );
};

export default Upscale4KTab;
