
import React from 'react';
import { Tab } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { LockClosedIcon, SparklesIcon } from './icons';
import { useActivation } from '../contexts/ActivationContext';
import HomePromptBar from './HomePromptBar';

interface WelcomeScreenProps {
  setActiveTab: (tab: Tab) => void;
  TAB_ICONS: Record<Tab, React.ReactNode>;
  TABS_IN_ORDER: Tab[];
  onQuickGenerate: (prompt: string, options: any) => void;
}

const BACKGROUND_IMAGES: Partial<Record<Tab, string>> = {
    [Tab.Enhance]: 'https://loremflickr.com/320/240/photoshop,editing?lock=1',
    [Tab.QuickGenerate]: 'https://loremflickr.com/320/240/architecture,sketch?lock=2',
    [Tab.RenderAI]: 'https://loremflickr.com/320/240/modern,building?lock=3',
    [Tab.FloorPlanRender]: 'https://loremflickr.com/320/240/blueprint,plan?lock=4',
    [Tab.FloorPlanColoring]: 'https://loremflickr.com/320/240/interior,floorplan?lock=5',
    [Tab.ImageFromReference]: 'https://loremflickr.com/320/240/moodboard,design?lock=6',
    [Tab.TechnicalDrawing]: 'https://loremflickr.com/320/240/engineering,drawing?lock=7',
    [Tab.Upscale4K]: 'https://loremflickr.com/320/240/detail,texture?lock=8',
    [Tab.Veo]: 'https://loremflickr.com/320/240/cinema,movie?lock=9',
    [Tab.VirtualTour]: 'https://loremflickr.com/320/240/360,panorama?lock=10',
    [Tab.ImageLibrary]: 'https://loremflickr.com/320/240/gallery,portfolio?lock=11',
};

const ToolCard: React.FC<{ tab: Tab; onClick: () => void; TAB_ICONS: Record<Tab, React.ReactNode>, isLocked: boolean }> = ({ tab, onClick, TAB_ICONS, isLocked }) => {
    const { t } = useTranslation();
    const Icon = TAB_ICONS[tab];
    const title = t(tab);
    const description = t(`welcome.card.${tab}.desc`);
    const backgroundUrl = BACKGROUND_IMAGES[tab];

    return (
        <div 
            className={`relative group h-full rounded-xl cursor-pointer bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 flex flex-col items-center text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-blue-500/50 overflow-hidden`}
            onClick={onClick}
        >
            {/* Background Image with Overlay */}
            {backgroundUrl && (
                <div className="absolute inset-0 z-0">
                    <img 
                        src={backgroundUrl} 
                        alt="" 
                        className="w-full h-full object-cover opacity-10 dark:opacity-20 filter grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-100/80 to-gray-100 dark:via-gray-800/80 dark:to-gray-800"></div>
                </div>
            )}

            <div className="relative z-10 flex flex-col items-center w-full h-full p-6">
                <div className="flex-shrink-0 w-12 h-12 mb-4 text-blue-500 dark:text-blue-400 drop-shadow-sm transform group-hover:scale-110 transition-transform duration-300">
                    {Icon}
                </div>
                <div className="min-h-0 flex-grow flex flex-col overflow-y-auto no-scrollbar w-full">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white drop-shadow-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 font-medium">{description}</p>
                </div>
            </div>

            {isLocked && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 backdrop-blur-[1px]">
                    <div className="bg-gray-900/80 p-3 rounded-full">
                        <LockClosedIcon className="w-8 h-8 text-yellow-400" />
                    </div>
                </div>
            )}
        </div>
    );
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ setActiveTab, TAB_ICONS, TABS_IN_ORDER, onQuickGenerate }) => {
    const { t } = useTranslation();
    const { isActivated, openActivationModal } = useActivation();

    const isLocked = (tab: Tab) => {
        const lockedTabs = [Tab.Veo, Tab.FloorPlanColoring, Tab.Upscale4K];
        return lockedTabs.includes(tab) && !isActivated;
    };

    const handleCardClick = (tab: Tab) => {
        if (isLocked(tab)) {
            openActivationModal();
        } else {
            setActiveTab(tab);
        }
    };

    const getCardClass = (tab: Tab) => {
        const largeTabs = [Tab.RenderAI, Tab.Enhance, Tab.VirtualTour];
        if (largeTabs.includes(tab)) {
            return `lg:col-span-4 col-span-1 sm:col-span-1 min-h-[240px]`; 
        }
        return `lg:col-span-3 col-span-1 sm:col-span-1 min-h-[220px]`;
    };

    return (
        <div className="relative w-full h-full overflow-y-auto flex flex-col items-center p-4 sm:p-8">
            <div className="text-center z-10 my-8 pt-12">
                <h1 className="font-orbitron text-5xl md:text-6xl font-bold text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                    {t('appTitle')}
                </h1>
                <p className="mt-2 text-md md:text-lg text-gray-100 dark:text-gray-200" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    {t('welcome.subtitle')}
                </p>
            </div>
            
            <div className="w-full max-w-3xl z-20 mb-12">
                <div className="flex items-center justify-center gap-2 mb-3 text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    <SparklesIcon className="w-6 h-6 text-yellow-300 drop-shadow-lg" />
                    <h2 className="text-xl font-bold">{t('welcome.quickStart')}</h2>
                </div>
                <HomePromptBar onGenerate={onQuickGenerate} />
            </div>

            <div className="w-full max-w-6xl my-8">
                <div className="border-t border-white/30 dark:border-black/30"></div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6 max-w-7xl w-full z-10">
                {TABS_IN_ORDER.map(tab => (
                    <div key={tab} className={getCardClass(tab)}>
                        <ToolCard 
                            tab={tab} 
                            onClick={() => handleCardClick(tab)}
                            TAB_ICONS={TAB_ICONS} 
                            isLocked={isLocked(tab)} 
                        />
                    </div>
                ))}
            </div>
            <footer className="w-full text-center p-4 mt-auto z-10 text-xs text-gray-200 dark:text-gray-300" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                <p>{t('footerThankYou')}</p>
                <p className="mt-1">{t('footerDonors')}</p>
                <p className="mt-2 text-gray-300 dark:text-gray-400">{t('footer.copyright')}</p>
            </footer>
        </div>
    );
};

export default WelcomeScreen;
