import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import TabButton from './components/TabButton';
import { Tab, EnhanceState, Theme, ImageResult, GenerationInfo, VideoResult, Message, ChatContext } from './types';
import { ASPECT_RATIO_KEYS, RENDER_VIEW_KEYS, IMAGE_GENERATION_MODELS } from './constants';
import FloorPlanRenderTab from './tabs/FloorPlanRenderTab';
import TrainingTab from './tabs/TrainingTab';
import EnhanceTab from './tabs/EnhanceTab';
import FullscreenView from './components/FullscreenView';
import QuickGenerateTab from './tabs/QuickGenerateTab';
import TechnicalDrawingTab from './tabs/TechnicalDrawingTab';
import RenderTab from './tabs/RenderTab';
import { useTranslation } from './hooks/useTranslation';
import DonationModal from './components/DonationModal';
import ImageLibraryTab from './tabs/ImageLibraryTab';
import { 
    SparklesIcon, 
    LightningBoltIcon,
    HomeIcon,
    FolderOpenIcon,
    BlueprintIcon,
    PhotoIcon,
    PencilRulerIcon,
    VideoCameraIcon,
    ArrowUpOnSquareIcon,
    LockClosedIcon,
    PaintBrushIcon,
    ViewfinderCircleIcon,
    AvatarIcon,
    CubeIcon,
} from './components/icons';
import { nanoid } from 'nanoid';
import { useImageLibrary } from './contexts/ImageLibraryContext';
import InfoModal from './components/InfoModal';
import WelcomeScreen from './components/WelcomeScreen';
import Upscale4KTab from './tabs/Upscale4KTab';
import VeoTab from './tabs/VeoTab';
import VirtualTourTab from './tabs/VirtualTourTab';
import { useActivation } from './contexts/ActivationContext';
import ActivationModal from './components/ActivationModal';
import FloorPlanColoringTab from './tabs/IsometricRenderTab';
import { Chatbot } from './components/Chatbot';
import { dataURLtoBase64, fileToDataURL, base64ToFile } from './utils/file';
import FloatingDonateButton from './components/FloatingDonateButton';
import { AVATAR_BASE64 } from './assets/avatar';
import { INTEGRITY_TOKEN } from './bugerror';
import AppCorruptedScreen from './components/AppCorruptedScreen';
import TamperedLockScreen from './components/TamperedLockScreen';
import { POLICY_ENFORCED } from './security_policy';
import { VERIFICATION_TOKEN as DONATION_TOKEN } from './components/DonationModal';
import { VERIFICATION_TOKEN as HEADER_TOKEN } from './components/Header';
import { VERIFICATION_TOKEN as FOOTER_TOKEN } from './components/Footer';
import { VERIFICATION_TOKEN as TYPES_TOKEN } from './types';
import SuggestionThumbnail from './components/SuggestionThumbnail';
import { VERIFICATION_TOKEN as CHATBOT_TOKEN } from './components/Chatbot';
import { useSuggestion } from './contexts/SuggestionContext';

const VERIFICATION_TOKEN = 'U1VEWV9BUkNISVRFQ1RVUkVfSU5URUdSSVRZX0NIRUNLXzEyMzQ1MTIzNDVfREVWRUxPUEVEX0JZX1RSVU9OR19ESUVOX0RVWV9WJk5fMjAyNA==';

const initialRenderAIState = {
  mainImageFile: null,
  mainImageUrl: null,
  processedImageUrl: null,
  refImageFile: null,
  refImageUrl: null,
  prompt: '',
  loraPrompt: '',
  aspectRatio: 'aspect.original',
  numResults: 1,
  results: [],
  useLineArt: false,
  sharpnessAdherence: 7,
  initialStateFromOtherTab: null,
  useRandomPrompts: false,
  promptBankCategory: 'exterior',
  adaptationMode: null,
  useContextImage: false,
  contextImageFile: null,
  contextImageUrl: null,
  contextInpaintedUrl: null,
  contextDrawingDataUrl: null,
  isContextModalOpen: false,
  inspirationOptions: [],
};

const initialQuickGenerateState = {
    prompt: '',
    aspectRatio: ASPECT_RATIO_KEYS[1],
    numResults: 1,
    imageModel: IMAGE_GENERATION_MODELS[0].value,
    creativity: 5,
    loraPrompt: '',
    results: [],
    isArtisticSketch: false,
    isMoodBoard: false,
    refImageFile: null,
    refImageUrl: null,
    inspirationOptions: [],
};

const initialEnhanceState = {
  originalImageSrc: null,
  processedImageSrc: null,
  prompt: '',
  autoOptimizePrompt: false, 
  creativity: 5,
  aspectRatio: ASPECT_RATIO_KEYS[0],
  numResults: 1,
  adaptationMode: null,
  loraPrompt: '',
  results: [],
  showAdvancedElements: false,
  elements: Array(6).fill(null).map(() => ({ id: nanoid(), file: null, name: '', dataUrl: null })),
  initialStateFromOtherTab: null,
  drawingDataUrl: null,
  preInpaintSrc: null,
};

const initialFloorPlanState = {
    floorplanFile: null,
    floorplanSrcForModal: null,
    inpaintedPlanDataUrl: null,
    refImageFile: null,
    refImageUrl: null,
    loraStylePrompt: '',
    prompt: '',
    aspectRatio: ASPECT_RATIO_KEYS[1],
    renderViews: [RENDER_VIEW_KEYS[10]],
    numResults: 1,
    results: [],
    showAdvancedElements: false,
    elements: Array(6).fill(null).map(() => ({ id: nanoid(), file: null, name: '', dataUrl: null })),
    drawingDataUrl: null,
};

const initialFloorPlanColoringState = {
    floorplanFile: null,
    floorplanUrl: null,
    prompt: '',
    selectedStylePreset: 'modern',
    refImageFile: null,
    refImageUrl: null,
    customStylePrompt: '',
    renderTopViewOnly: true,
    result: null,
};

const initialTrainingState = {
    descriptionPrompt: '',
    refImages: Array(6).fill(null),
    analysisResult: '',
    generationPrompt: '',
    numResults: 1,
    creativity: 5,
    results: [],
    initialStateFromOtherTab: null,
    generationMode: 'text', // 'text' or 'sketch'
    imageModel: IMAGE_GENERATION_MODELS[0].value,
    aspectRatio: ASPECT_RATIO_KEYS[1], // 16:9
    extractionOptions: [],
    moodboardResult: null,
};

const initialTechDrawingState = {
    sourceImageFile: null,
    sourceImageUrl: null,
    prompt: '',
    results: [],
    initialStateFromOtherTab: null,
};

const initialUpscaleState = {
    sourceImageFile: null,
    sourceImageUrl: null,
    result: null,
    initialStateFromOtherTab: null,
};

const initialVeoState = {
    sourceImageFile: null,
    sourceImageUrl: null,
    prompt: '',
    aspectRatio: '16:9',
    result: null,
    initialStateFromOtherTab: null,
};

const initialVirtualTourState = {
    originalImageFile: null,
    originalImageUrl: null,
    prompt: '',
    movementIntensity: 3,
    history: [],
    historyIndex: -1,
};

const getInitialTabStates = (t: (key: string) => string) => ({
    [Tab.Enhance]: { ...initialEnhanceState, aspectRatio: ASPECT_RATIO_KEYS[0] },
    [Tab.QuickGenerate]: initialQuickGenerateState,
    [Tab.RenderAI]: initialRenderAIState,
    [Tab.FloorPlanRender]: initialFloorPlanState,
    [Tab.FloorPlanColoring]: initialFloorPlanColoringState,
    [Tab.ImageFromReference]: initialTrainingState,
    [Tab.TechnicalDrawing]: initialTechDrawingState,
    [Tab.Upscale4K]: initialUpscaleState,
    [Tab.Veo]: initialVeoState,
    [Tab.VirtualTour]: initialVirtualTourState,
});

const getTabIcons = (isActivated: boolean): Record<Tab, React.ReactNode> => {
    const renderIcon = (icon: React.ReactNode, isLocked: boolean) => {
        if (isLocked && !isActivated) {
            return (
                <div className="relative w-6 h-6">
                    {icon}
                    <LockClosedIcon className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-gray-100 dark:bg-gray-800 text-yellow-500 p-0.5 rounded-full" />
                </div>
            );
        }
        return <div className="w-6 h-6">{icon}</div>;
    };

    return {
        [Tab.Welcome]: renderIcon(<HomeIcon />, false),
        [Tab.Enhance]: renderIcon(<SparklesIcon />, false),
        [Tab.QuickGenerate]: renderIcon(<LightningBoltIcon />, false),
        [Tab.RenderAI]: renderIcon(<CubeIcon />, false),
        [Tab.FloorPlanRender]: renderIcon(<BlueprintIcon />, false),
        [Tab.FloorPlanColoring]: renderIcon(<PaintBrushIcon />, true),
        [Tab.ImageFromReference]: renderIcon(<PhotoIcon />, false),
        [Tab.TechnicalDrawing]: renderIcon(<PencilRulerIcon />, false),
        [Tab.Upscale4K]: renderIcon(<ArrowUpOnSquareIcon />, true),
        [Tab.Veo]: renderIcon(<VideoCameraIcon />, true),
        [Tab.VirtualTour]: renderIcon(<ViewfinderCircleIcon />, false),
        [Tab.ImageLibrary]: renderIcon(<FolderOpenIcon />, false),
    };
};

const UPLOAD_TRIGGERS: { tab: Tab; prop: string; type: 'file' | 'dataURL' | 'fileArray', context: string }[] = [
    { tab: Tab.Enhance, prop: 'originalImageSrc', type: 'dataURL', context: 'enhance-main-image' },
    { tab: Tab.RenderAI, prop: 'mainImageFile', type: 'file', context: 'renderai-main-image' },
    { tab: Tab.RenderAI, prop: 'refImageFile', type: 'file', context: 'renderai-style-ref' },
    { tab: Tab.QuickGenerate, prop: 'refImageFile', type: 'file', context: 'quickgen-inspiration' },
    { tab: Tab.ImageFromReference, prop: 'refImages', type: 'fileArray', context: 'lora-training-reference' },
    { tab: Tab.FloorPlanRender, prop: 'floorplanFile', type: 'file', context: 'floorplan-main-image' },
    { tab: Tab.FloorPlanRender, prop: 'refImageFile', type: 'file', context: 'floorplan-style-ref' },
    { tab: Tab.FloorPlanColoring, prop: 'floorplanFile', type: 'file', context: 'floorplan-coloring-main' },
    { tab: Tab.FloorPlanColoring, prop: 'refImageFile', type: 'file', context: 'floorplan-coloring-ref' },
    { tab: Tab.TechnicalDrawing, prop: 'sourceImageFile', type: 'file', context: 'tech-drawing-source' },
    { tab: Tab.Upscale4K, prop: 'sourceImageFile', type: 'file', context: 'upscale-source' },
    { tab: Tab.Veo, prop: 'sourceImageFile', type: 'file', context: 'veo-source' },
    { tab: Tab.VirtualTour, prop: 'originalImageFile', type: 'file', context: 'virtual-tour-start' },
];

const useIsMobile = (breakpoint = 1024) => { // lg breakpoint
    const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < breakpoint);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);

    return isMobile;
};

const simpleHash = (s: string): string => {
    let hash = 0;
    if (s.length === 0) return "0";
    const str = s.length > 5000 ? s.substring(0, 2500) + s.substring(s.length - 2500) : s;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
};


const App: React.FC = () => {
  const GUEST_USER = {
    name: 'Guest',
    email: 'guest@sudy.app',
    picture: AVATAR_BASE64,
  };

  const [isCorrupted, setIsCorrupted] = useState(false);
  const { t, language } = useTranslation();

  const [activeTab, setActiveTab] = useState<Tab>(Tab.Welcome);
  const [tabStates, setTabStates] = useState<any>(() => getInitialTabStates(t));
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const [fullscreenState, setFullscreenState] = useState<{ images: ImageResult[], currentIndex: number } | null>(null);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const { images, addMedia } = useImageLibrary();
  const { isActivated, openActivationModal } = useActivation();
  const [imageForChatbot, setImageForChatbot] = useState<File | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  
  const [user, setUser] = useState<{name: string, email: string, picture: string} | null>(GUEST_USER);
  
  const [proactiveImageForChatbot, setProactiveImageForChatbot] = useState<{ file: File, trigger: 'upload' | 'generation', sourceTab: Tab, uploadContext?: string } | null>(null);
  const { suggestion } = useSuggestion();
  const processedSuggestionId = useRef<string | null>(null);
  const prevTabStates = useRef(tabStates);
  const [chatContext, setChatContext] = useState<ChatContext>({ recentMessages: [], activeTab: Tab.Welcome, isTampered: false, recentImageHashes: [], isActivated: false });
  const [recentImageHashes, setRecentImageHashes] = useState<string[]>([]);

  const [snoozeCount, setSnoozeCount] = useState<number>(() => parseInt(localStorage.getItem('sudy_snooze_count') || '0'));
  const [isSnoozed, setIsSnoozed] = useState(false);
  const isMobile = useIsMobile();
  
  const [isTamperLocked, setIsTamperLocked] = useState(false);
  const generationPatrolCount = useRef(0);


  const TAB_ICONS = getTabIcons(isActivated);

  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const shownFeedbackMilestones = useRef(new Set());

  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || Theme.Halloween;
  });

  const onProactiveImageConsumed = useCallback(() => {
    setProactiveImageForChatbot(null);
  }, []);

  useEffect(() => {
    try {
      const tokens = [INTEGRITY_TOKEN, DONATION_TOKEN, HEADER_TOKEN, FOOTER_TOKEN, TYPES_TOKEN, CHATBOT_TOKEN];
      const allTokensMatch = tokens.every(token => token === VERIFICATION_TOKEN);

      if (!allTokensMatch || !POLICY_ENFORCED) {
        setIsCorrupted(true);
      }
    } catch (error) {
      console.error("Integrity check failed:", error);
      setIsCorrupted(true);
    }
  }, []);
  
    const isAppTamperedNow = useCallback(() => {
        const appTitle = t('appTitle');
        const authorName = t('footerCreatedBy');
        const chatbotTitle = t('chatbot.title');
        const accountHolder = t('donation.accountHolderValue');
        const accountNumber = t('donation.accountNumberValue');

        const correctValues = {
            appTitle: ['SUDY ARCHITECT', 'SUDY 建筑师'],
            authorName: ['Trương Điền Duy', 'Truong Dien Duy', '张田维'],
            chatbotTitle: ['SUDY'],
            accountHolder: ['TRUONG DIEN DUY'],
            accountNumber: ['1014685607']
        };

        const isAppTitleTampered = !correctValues.appTitle.some(val => appTitle.includes(val));
        const isAuthorNameTampered = !correctValues.authorName.some(val => authorName.includes(val));
        const isChatbotTitleTampered = !correctValues.chatbotTitle.some(val => chatbotTitle.includes(val));
        const isDonationTampered = !correctValues.accountHolder.some(val => accountHolder.includes(val)) || !correctValues.accountNumber.some(val => accountNumber.includes(val));

        return isAppTitleTampered || isAuthorNameTampered || isChatbotTitleTampered || isDonationTampered;
    }, [t]);

    const runTamperCheck = useCallback(() => {
        const isCurrentlyTampered = isAppTamperedNow();
        if (isCurrentlyTampered) {
            setIsTamperLocked(true);
        }
        return isCurrentlyTampered;
    }, [isAppTamperedNow]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            runTamperCheck();
        }, 15000); 

        return () => clearInterval(intervalId);
    }, [runTamperCheck]);
  
  useEffect(() => {
    document.body.classList.toggle('welcome-body-background', activeTab === Tab.Welcome);
    return () => {
      document.body.classList.remove('welcome-body-background');
    };
  }, [activeTab]);
  
  useEffect(() => {
    if (suggestion && suggestion.id !== processedSuggestionId.current) {
        generationPatrolCount.current += 1;
        if (generationPatrolCount.current % 3 === 0) {
            runTamperCheck();
        }

        const hash = simpleHash(suggestion.base64);
        setRecentImageHashes(prev => [hash, ...prev.slice(0, 19)]); // Keep last 20

        if (!isSnoozed) {
            const file = base64ToFile(suggestion.base64, `generated-${suggestion.id}.jpg`, suggestion.mimeType);
            setProactiveImageForChatbot({ file, trigger: 'generation', sourceTab: suggestion.generationInfo!.originTab });
        }
        processedSuggestionId.current = suggestion.id;
    }
  }, [suggestion, isSnoozed, runTamperCheck]);

  useEffect(() => {
    if (isSnoozed) return;
    let triggered = false;

    const processFile = async (fileToProcess: File, trigger: any) => {
        const { base64 } = await dataURLtoBase64(await fileToDataURL(fileToProcess));
        const hash = simpleHash(base64);
        setRecentImageHashes(prev => [hash, ...prev.slice(0, 19)]);
        setProactiveImageForChatbot({ file: fileToProcess, trigger: 'upload', sourceTab: trigger.tab, uploadContext: trigger.context });
        triggered = true;
    }

    for (const trigger of UPLOAD_TRIGGERS) {
        if (triggered) break;

        const { tab, prop, type } = trigger;
        
        const oldState = prevTabStates.current[tab];
        const newState = tabStates[tab];
        if (!oldState || !newState) continue;

        const oldVal = oldState[prop];
        const newVal = newState[prop];

        let hasChanged = false;
        let fileToProcess: File | null = null;

        if (type === 'fileArray') {
            if (Array.isArray(newVal) && Array.isArray(oldVal)) {
                const newFileIndex = newVal.findIndex((file, i) => file instanceof File && (i >= oldVal.length || oldVal[i] === null || newVal[i] !== oldVal[i]));
                if (newFileIndex !== -1) {
                    hasChanged = true;
                    fileToProcess = newVal[newFileIndex];
                }
            }
        } else {
            if (newVal && newVal !== oldVal) {
                hasChanged = true;
                if (type === 'file' && newVal instanceof File) {
                    fileToProcess = newVal;
                } else if (type === 'dataURL' && typeof newVal === 'string') {
                    const { base64, mimeType } = dataURLtoBase64(newVal);
                    fileToProcess = base64ToFile(base64, `upload-${tab}.jpg`, mimeType);
                }
            }
        }

        if (hasChanged && fileToProcess) {
            processFile(fileToProcess, trigger);
        }
    }

    prevTabStates.current = tabStates;
  }, [tabStates, isSnoozed]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  };

  const handleSnooze = () => {
    if (snoozeCount < 10) {
      const newCount = snoozeCount + 1;
      setSnoozeCount(newCount);
      localStorage.setItem('sudy_snooze_count', newCount.toString());
      setIsSnoozed(true);
    }
  };

  useEffect(() => {
    // Automatically open the welcome modal on first load after "login"
    setIsWelcomeModalOpen(true);
  }, []);

  useEffect(() => {
    const imageCount = images.length;
    if (imageCount > 0 && imageCount % 8 === 0) {
      if (!shownFeedbackMilestones.current.has(imageCount)) {
        setIsFeedbackModalOpen(true);
        shownFeedbackMilestones.current.add(imageCount);
      }
    }
  }, [images.length]);

  useEffect(() => {
      let lastImage: { base64: string; mimeType: string } | undefined;
      if (suggestion) {
          lastImage = { base64: suggestion.base64, mimeType: suggestion.mimeType };
      }
      setChatContext({
          lastGeneratedImage: lastImage,
          recentMessages: chatMessages.slice(-6),
          activeTab: activeTab,
          isTampered: isTamperLocked,
          recentImageHashes,
          isActivated, // Pass current activation status
      });
  }, [suggestion, chatMessages, activeTab, isTamperLocked, recentImageHashes, isActivated]);

  const updateTabState = (tab: Tab, newStateOrFn: any) => {
    setTabStates((prev: any) => {
      const currentTabState = prev[tab];
      const newTabState =
        typeof newStateOrFn === 'function'
          ? newStateOrFn(currentTabState)
          : newStateOrFn;
      return {
        ...prev,
        [tab]: newTabState,
      };
    });
  };
  
  const handleBotAction = async (tab: Tab, stateUpdate: any, file: File | null) => {
    const newState = { ...stateUpdate };

    if (file) {
      const imageUrl = await fileToDataURL(file);
      const { base64, mimeType } = dataURLtoBase64(imageUrl);
      const imagePayload = { image: base64, mimeType };
      newState.initialStateFromOtherTab = imagePayload;
    }

    updateTabState(tab, (prevState: any) => ({
      ...getInitialTabStates(t)[tab as keyof ReturnType<typeof getInitialTabStates>],
      ...newState,
    }));
    setActiveTab(tab);
  };

  const handleApplySuggestion = async (suggestion: { text: string; targetTab?: Tab; prompt?: string }, message: Message) => {
    const { targetTab } = suggestion;
    const promptToUse = suggestion.prompt || suggestion.text;
    const imageToMove = message?.proactiveContext?.imageFile;

    if (targetTab && targetTab !== activeTab && imageToMove) {
        const file = imageToMove;
        let promptKey = 'prompt';
        if (targetTab === Tab.ImageFromReference) {
            promptKey = 'generationPrompt';
        }

        const stateUpdate: { [key: string]: any } = { [promptKey]: promptToUse };
        
        const dataUrl = await fileToDataURL(file);
        const { base64, mimeType } = dataURLtoBase64(dataUrl);

        switch (targetTab) {
            case Tab.Enhance:
            case Tab.TechnicalDrawing:
            case Tab.Upscale4K:
            case Tab.Veo:
                stateUpdate.initialStateFromOtherTab = { image: base64, mimeType };
                break;
            case Tab.RenderAI:
                stateUpdate.mainImageFile = file;
                stateUpdate.mainImageUrl = dataUrl;
                stateUpdate.processedImageUrl = dataUrl;
                break;
            case Tab.VirtualTour:
                stateUpdate.originalImageFile = file;
                stateUpdate.originalImageUrl = dataUrl;
                stateUpdate.history = [{ imageUrl: dataUrl, direction: null }];
                stateUpdate.historyIndex = 0;
                break;
            case Tab.ImageFromReference:
                {
                    const newRefImages = [...getInitialTabStates(t)[Tab.ImageFromReference].refImages];
                    newRefImages[0] = file;
                    stateUpdate.refImages = newRefImages;
                }
                break;
            case Tab.QuickGenerate:
                stateUpdate.refImageFile = file;
                stateUpdate.refImageUrl = dataUrl;
                break;
            case Tab.FloorPlanRender:
                stateUpdate.floorplanFile = file;
                stateUpdate.floorplanSrcForModal = dataUrl;
                break;
            case Tab.FloorPlanColoring:
                 stateUpdate.floorplanFile = file;
                 stateUpdate.floorplanUrl = dataUrl;
                 break;
            default:
                console.warn(`No specific image handling for targetTab: ${targetTab} in handleApplySuggestion`);
                break;
        }

        updateTabState(targetTab, () => ({
            ...getInitialTabStates(t)[targetTab as keyof ReturnType<typeof getInitialTabStates>],
            ...stateUpdate,
        }));
        setActiveTab(targetTab);
    } else {
      const tabToUpdate = targetTab || activeTab;
      if (!tabToUpdate) return;
      
      let promptKey = 'prompt';
      if (tabToUpdate === Tab.ImageFromReference) {
          promptKey = 'generationPrompt';
      }
      
      if (tabStates[tabToUpdate] && promptKey in tabStates[tabToUpdate]) {
          updateTabState(tabToUpdate, (prevState: any) => ({
              ...prevState,
              [promptKey]: promptToUse,
          }));
      }
      
      if (targetTab && targetTab !== activeTab) {
          setActiveTab(targetTab);
      }
    }
  };

  const consumeInitialStateForTab = (tab: Tab) => {
    setTabStates(prev => {
        if (prev[tab]?.initialStateFromOtherTab) {
            const newTabState = { ...prev[tab], initialStateFromOtherTab: null };
            return { ...prev, [tab]: newTabState };
        }
        return prev;
    });
  };

  const clearTabState = (tab: Tab) => {
      setTabStates((prev: any) => ({
          ...prev,
          [tab]: getInitialTabStates(t)[tab as keyof ReturnType<typeof getInitialTabStates>],
      }));
  };

  useEffect(() => {
    const root = window.document.documentElement;
    
    root.classList.toggle('theme-pink', theme === Theme.Pink);
    root.classList.toggle('theme-halloween', theme === Theme.Halloween);

    const isDark =
      theme === Theme.Dark ||
      theme === Theme.Pink ||
      theme === Theme.Halloween ||
      (theme === Theme.System && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', isDark);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === Theme.System) {
        root.classList.toggle('dark', mediaQuery.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);


  const TABS_FOR_SIDEBAR = [
    Tab.QuickGenerate,
    Tab.Enhance,
    Tab.RenderAI,
    Tab.VirtualTour,
    Tab.ImageFromReference,
    Tab.FloorPlanRender,
    Tab.FloorPlanColoring,
    Tab.TechnicalDrawing,
    Tab.Upscale4K,
    Tab.Veo,
    Tab.ImageLibrary,
  ];

  const TABS_FOR_WELCOME = [
    Tab.RenderAI,
    Tab.Enhance,
    Tab.VirtualTour,
    Tab.QuickGenerate,
    Tab.ImageFromReference,
    Tab.FloorPlanRender,
    Tab.FloorPlanColoring,
    Tab.Veo,
    Tab.TechnicalDrawing,
    Tab.Upscale4K,
    Tab.ImageLibrary,
  ];
  
  const NEW_TABS = [Tab.Veo, Tab.TechnicalDrawing, Tab.FloorPlanColoring, Tab.FloorPlanRender, Tab.VirtualTour, Tab.RenderAI];

  const handleSendToTab = async (targetTab: Tab, stateUpdate: Partial<any>) => {
    updateTabState(targetTab, (prevState: any) => ({
        ...getInitialTabStates(t)[targetTab as keyof ReturnType<typeof getInitialTabStates>],
        ...stateUpdate,
    }));
    setActiveTab(targetTab);
  };

  const handleSendToEnhance = (state: EnhanceState) => {
    handleSendToTab(Tab.Enhance, { initialStateFromOtherTab: state });
  };
  
  const handleSendToQuickGenerateInspiration = async (state: EnhanceState) => {
      const file = base64ToFile(state.image, 'inspiration.jpg', state.mimeType);
      const dataUrl = await fileToDataURL(file);
      handleSendToTab(Tab.QuickGenerate, { refImageFile: file, refImageUrl: dataUrl });
  };
  
  const handleSendToRenderAIMain = async (state: EnhanceState) => {
      const file = base64ToFile(state.image, 'render-main.jpg', state.mimeType);
      const dataUrl = await fileToDataURL(file);
      handleSendToTab(Tab.RenderAI, { mainImageFile: file, mainImageUrl: dataUrl, processedImageUrl: dataUrl });
  };
  
  const handleSendToRenderAIRef = async (state: EnhanceState) => {
      const file = base64ToFile(state.image, 'render-ref.jpg', state.mimeType);
      const dataUrl = await fileToDataURL(file);
      handleSendToTab(Tab.RenderAI, { refImageFile: file, refImageUrl: dataUrl });
  };

  const handleSendToTraining = (state: EnhanceState) => {
    handleSendToTab(Tab.ImageFromReference, { initialStateFromOtherTab: state });
  };
  
  const handleSendToFloorPlanRef = async (state: EnhanceState) => {
      const file = base64ToFile(state.image, 'plan-ref.jpg', state.mimeType);
      const dataUrl = await fileToDataURL(file);
      handleSendToTab(Tab.FloorPlanRender, { refImageFile: file, refImageUrl: dataUrl });
  };
  
  const handleSendToColoringRef = async (state: EnhanceState) => {
      if (!isActivated) { openActivationModal(); return; }
      const file = base64ToFile(state.image, 'coloring-ref.jpg', state.mimeType);
      const dataUrl = await fileToDataURL(file);
      handleSendToTab(Tab.FloorPlanColoring, { refImageFile: file, refImageUrl: dataUrl, selectedStylePreset: 'custom' });
  };
  
  const handleSendToVirtualTour = async (state: EnhanceState) => {
      const file = base64ToFile(state.image, 'vt-start.jpg', state.mimeType);
      const dataUrl = await fileToDataURL(file);
      handleSendToTab(Tab.VirtualTour, { 
          originalImageFile: file, 
          originalImageUrl: dataUrl,
          history: [{ imageUrl: dataUrl, direction: null }],
          historyIndex: 0 
      });
  };

  const handleSendToTechDrawing = (state: EnhanceState) => {
    handleSendToTab(Tab.TechnicalDrawing, { initialStateFromOtherTab: state });
  };

  const handleSendToUpscale = (state: EnhanceState) => {
    if (!isActivated) {
        openActivationModal();
        return;
    }
    handleSendToTab(Tab.Upscale4K, { initialStateFromOtherTab: state });
  };

  const handleSendToVeo = (state: EnhanceState) => {
    if (!isActivated) {
        openActivationModal();
        return;
    }
    handleSendToTab(Tab.Veo, { initialStateFromOtherTab: state });
  };
  
  const handleFullscreen = (images: ImageResult[], startIndex: number) => {
    setFullscreenState({ images, currentIndex: startIndex });
  };
  
  const handleCloseFullscreen = () => setFullscreenState(null);
  const handleNextFullscreen = () => {
    if (fullscreenState) {
        const nextIndex = (fullscreenState.currentIndex + 1) % fullscreenState.images.length;
        setFullscreenState({ ...fullscreenState, currentIndex: nextIndex });
    }
  };
  const handlePrevFullscreen = () => {
    if (fullscreenState) {
        const prevIndex = (fullscreenState.currentIndex - 1 + fullscreenState.images.length) % fullscreenState.images.length;
        setFullscreenState({ ...fullscreenState, currentIndex: prevIndex });
    }
  };
  
  const handleRegenerate = (info: GenerationInfo) => {
      generationPatrolCount.current += 1;
      if (generationPatrolCount.current % 3 === 0) {
          runTamperCheck();
      }
      const newState = { ...info.state, shouldRegenerate: true };
      updateTabState(info.originTab, newState);
      setActiveTab(info.originTab);
  };
  
  const handleSaveFilteredImage = (newImage: ImageResult) => {
    addMedia(newImage);
  };

  const handleSendToChatbot = (image: ImageResult) => {
    const file = base64ToFile(image.base64, `image-from-view-${image.id}.jpg`, image.mimeType);
    setImageForChatbot(file);
    setChatMessages(prev => [...prev]); // Trigger chatbot to notice file
    setFullscreenState(null); // Close fullscreen view
  };

  const handleQuickGenerateFromHome = (prompt: string, options: any) => {
    generationPatrolCount.current += 1;
    if (generationPatrolCount.current % 3 === 0) {
        runTamperCheck();
    }
    updateTabState(Tab.QuickGenerate, () => ({
      ...getInitialTabStates(t)[Tab.QuickGenerate],
      prompt: prompt,
      aspectRatio: options.aspectRatio,
      numResults: options.numResults,
      imageModel: options.imageModel,
      isArtisticSketch: options.isArtisticSketch,
      isMoodBoard: options.isMoodBoard,
      shouldRegenerate: true,
    }));
    setActiveTab(Tab.QuickGenerate);
  };

  const WelcomeModalContent = () => {
    const { t } = useTranslation();
    const features: string[] = JSON.parse(t('welcomeModal.features'));
    return (
      <>
        <p>{t('welcomeModal.greeting')}</p>
        <p className="font-semibold mt-2">{t('welcomeModal.versionIntro')}</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          {features.map((feature, index) => (
            <li key={index} dangerouslySetInnerHTML={{ __html: feature.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-800 dark:text-gray-200">$1</strong>') }} />
          ))}
        </ul>
        <p className="mt-4" dangerouslySetInnerHTML={{ __html: t('welcomeModal.partners').replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-800 dark:text-gray-200">$1</strong>') }} />
        <p className="mt-2" dangerouslySetInnerHTML={{ __html: t('welcomeModal.donors').replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-800 dark:text-gray-200">$1</strong>') }} />
        <p className="mt-3 italic">{t('welcomeModal.support')}</p>
      </>
    );
  };
  
  const FeedbackModalContent = () => {
      const { t } = useTranslation();
      return (
        <>
            <p className="font-semibold text-lg text-gray-900 dark:text-white">{t('feedbackModal.thankYou')}</p>
            <p dangerouslySetInnerHTML={{ __html: t('feedbackModal.request').replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-800 dark:text-gray-200">$1</strong>') }} />
            <div className="mt-4 p-3 bg-blue-100/50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="font-semibold text-blue-800 dark:text-blue-300">{t('feedbackModal.proTipTitle')}</p>
                <p className="text-sm" dangerouslySetInnerHTML={{ __html: t('feedbackModal.proTipContent').replace(/`(.*?)`/g, '<code class="bg-gray-200 dark:bg-gray-700 rounded px-1 py-0.5 text-xs font-mono">$1</code>') }} />
            </div>
        </>
      );
  };

  const handleTabClick = (tabKey: Tab) => {
      const isExperimental = tabKey === Tab.Upscale4K || tabKey === Tab.Veo || tabKey === Tab.FloorPlanColoring;
      if (isExperimental && !isActivated) {
          openActivationModal();
      } else {
          setActiveTab(tabKey);
      }
  };

  const handleLogout = () => {
    // The concept of logging out now means reverting to a guest user.
    setUser(GUEST_USER);
  };
  
  const allSendToProps = {
    onEnhance: handleSendToEnhance,
    onSendToEnhance: handleSendToEnhance,
    onSendToQuickGenerateInspiration: handleSendToQuickGenerateInspiration,
    onSendToRenderAIMain: handleSendToRenderAIMain,
    onSendToRenderAIRef: handleSendToRenderAIRef,
    onSendToTraining: handleSendToTraining,
    onSendToFloorPlanRef: handleSendToFloorPlanRef,
    onSendToColoringRef: handleSendToColoringRef,
    onSendToVirtualTour: handleSendToVirtualTour,
    onSendToTechDrawing: handleSendToTechDrawing,
    onSendToUpscale: handleSendToUpscale,
    onSendToVeo: handleSendToVeo,
  };

  const renderContent = () => {
    if (activeTab === Tab.Welcome) {
        return <WelcomeScreen 
          setActiveTab={setActiveTab} 
          TAB_ICONS={TAB_ICONS} 
          TABS_IN_ORDER={TABS_FOR_WELCOME} 
          onQuickGenerate={handleQuickGenerateFromHome}
        />;
    }
    switch (activeTab) {
      case Tab.Enhance:
        return <EnhanceTab 
                    initialState={tabStates[Tab.Enhance].initialStateFromOtherTab} 
                    state={tabStates[Tab.Enhance]}
                    setState={(s) => updateTabState(Tab.Enhance, s)}
                    onClear={() => clearTabState(Tab.Enhance)}
                    onFullscreen={handleFullscreen}
                    onConsumeInitialState={() => consumeInitialStateForTab(Tab.Enhance)}
                    onRegenerate={handleRegenerate}
                    {...allSendToProps}
                />;
      case Tab.QuickGenerate:
        return <QuickGenerateTab 
                    state={tabStates[Tab.QuickGenerate]}
                    setState={(s) => updateTabState(Tab.QuickGenerate, s)}
                    onClear={() => clearTabState(Tab.QuickGenerate)}
                    onFullscreen={handleFullscreen}
                    onRegenerate={handleRegenerate}
                    {...allSendToProps}
                />;
      case Tab.RenderAI:
        return <RenderTab
                    initialState={tabStates[Tab.RenderAI].initialStateFromOtherTab}
                    state={tabStates[Tab.RenderAI]}
                    setState={(s) => updateTabState(Tab.RenderAI, s)}
                    onClear={() => clearTabState(Tab.RenderAI)} 
                    onFullscreen={handleFullscreen} 
                    onConsumeInitialState={() => consumeInitialStateForTab(Tab.RenderAI)}
                    onRegenerate={handleRegenerate}
                    {...allSendToProps}
                />;
      case Tab.FloorPlanRender:
        return <FloorPlanRenderTab 
                    state={tabStates[Tab.FloorPlanRender]}
                    setState={(s) => updateTabState(Tab.FloorPlanRender, s)}
                    onClear={() => clearTabState(Tab.FloorPlanRender)}
                    onFullscreen={handleFullscreen} 
                    onRegenerate={handleRegenerate}
                    {...allSendToProps}
                />;
      case Tab.FloorPlanColoring:
        return <FloorPlanColoringTab 
                    state={tabStates[Tab.FloorPlanColoring]}
                    setState={(s) => updateTabState(Tab.FloorPlanColoring, s)}
                    onClear={() => clearTabState(Tab.FloorPlanColoring)}
                    onFullscreen={handleFullscreen} 
                    onRegenerate={handleRegenerate}
                    {...allSendToProps}
                />;
      case Tab.ImageFromReference:
        return <TrainingTab 
                    initialState={tabStates[Tab.ImageFromReference].initialStateFromOtherTab}
                    state={tabStates[Tab.ImageFromReference]}
                    setState={(s) => updateTabState(Tab.ImageFromReference, s)}
                    onClear={() => clearTabState(Tab.ImageFromReference)}
                    onFullscreen={handleFullscreen}
                    onConsumeInitialState={() => consumeInitialStateForTab(Tab.ImageFromReference)}
                    onRegenerate={handleRegenerate}
                    {...allSendToProps}
                />;
      case Tab.TechnicalDrawing:
        return <TechnicalDrawingTab 
                    initialState={tabStates[Tab.TechnicalDrawing].initialStateFromOtherTab}
                    state={tabStates[Tab.TechnicalDrawing]}
                    setState={(s) => updateTabState(Tab.TechnicalDrawing, s)}
                    onClear={() => clearTabState(Tab.TechnicalDrawing)}
                    onFullscreen={handleFullscreen}
                    onConsumeInitialState={() => consumeInitialStateForTab(Tab.TechnicalDrawing)}
                    onRegenerate={handleRegenerate}
                    {...allSendToProps}
                />;
      case Tab.Upscale4K:
        return <Upscale4KTab 
                    initialState={tabStates[Tab.Upscale4K].initialStateFromOtherTab}
                    state={tabStates[Tab.Upscale4K]}
                    setState={(s) => updateTabState(Tab.Upscale4K, s)}
                    onClear={() => clearTabState(Tab.Upscale4K)}
                    onFullscreen={handleFullscreen}
                    onConsumeInitialState={() => consumeInitialStateForTab(Tab.Upscale4K)}
                    onRegenerate={handleRegenerate}
                    {...allSendToProps}
                />;
      case Tab.Veo:
        return <VeoTab 
                    initialState={tabStates[Tab.Veo].initialStateFromOtherTab}
                    state={tabStates[Tab.Veo]}
                    setState={(s) => updateTabState(Tab.Veo, s)}
                    onClear={() => clearTabState(Tab.Veo)}
                    onConsumeInitialState={() => consumeInitialStateForTab(Tab.Veo)}
                />;
       case Tab.VirtualTour:
        return <VirtualTourTab 
                    state={tabStates[Tab.VirtualTour]}
                    setState={(s) => updateTabState(Tab.VirtualTour, s)}
                    onClear={() => clearTabState(Tab.VirtualTour)}
                    onFullscreen={handleFullscreen}
                />;
      case Tab.ImageLibrary:
        return <ImageLibraryTab 
                  onFullscreen={handleFullscreen}
                  onRegenerate={handleRegenerate}
                  {...allSendToProps}
                />;
      default:
        return null;
    }
  };
  
  if (isCorrupted) {
    return <AppCorruptedScreen />;
  }
  
  if (isTamperLocked) {
    return <TamperedLockScreen />;
  }
  
  const appContainerClass = activeTab === Tab.Welcome ? 'bg-transparent dark:bg-transparent' : 'bg-white dark:bg-gray-900';

  return (
    <div className={`flex h-screen font-sans text-gray-800 dark:text-gray-200 overflow-hidden ${appContainerClass}`}>
        <ActivationModal />
        {/* Sidebar */}
        <nav 
            className={`flex flex-col flex-shrink-0 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${isSidebarExpanded ? 'w-64' : 'w-20'}`}
            onMouseEnter={() => setIsSidebarExpanded(true)}
            onMouseLeave={() => setIsSidebarExpanded(false)}
        >
            <button
                onClick={() => setActiveTab(Tab.Welcome)}
                className={`flex items-center h-16 border-b border-gray-200 dark:border-gray-700 w-full text-left px-4 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 ${isSidebarExpanded ? 'justify-start' : 'justify-center'}`}
            >
                <AvatarIcon className="w-10 h-10 flex-shrink-0" />
                <h1 className={`text-sm font-bold text-gray-900 dark:text-white font-orbitron uppercase ml-3 transition-opacity duration-200 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
                    {isSidebarExpanded ? t('appTitle') : ''}
                </h1>
            </button>
            <div className="flex-grow overflow-y-auto overflow-x-hidden p-2">
                 <TabButton
                    key="home"
                    label={t(Tab.Welcome)}
                    icon={TAB_ICONS[Tab.Welcome]}
                    isActive={activeTab === Tab.Welcome}
                    isExpanded={isSidebarExpanded}
                    onClick={() => setActiveTab(Tab.Welcome)}
                />
                <div className="my-2 border-t border-gray-300 dark:border-gray-600"></div>
                {TABS_FOR_SIDEBAR.map((tabKey) => (
                    <TabButton
                    key={tabKey}
                    label={t(tabKey)}
                    icon={TAB_ICONS[tabKey]}
                    isActive={activeTab === tabKey}
                    isExpanded={isSidebarExpanded}
                    onClick={() => handleTabClick(tabKey)}
                    isNew={NEW_TABS.includes(tabKey)}
                    />
                ))}
            </div>
        </nav>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
            <Header
                user={user}
                onLogout={handleLogout}
                theme={theme} 
                setTheme={setTheme} 
                onGoHome={() => setActiveTab(Tab.Welcome)}
            />
            <main className="flex-grow overflow-hidden relative">
                <div key={activeTab} className={`tab-content-animation w-full h-full ${activeTab === Tab.Welcome ? 'bg-transparent' : 'bg-gray-50 dark:bg-gray-900/50'}`}>
                    {renderContent()}
                </div>
            </main>
        </div>
        
        <SuggestionThumbnail />

        <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
            <Chatbot 
                messages={chatMessages}
                setMessages={setChatMessages}
                onAction={handleBotAction}
                onOpenDonationModal={() => setIsDonationModalOpen(true)}
                initialFile={imageForChatbot}
                onInitialFileConsumed={() => setImageForChatbot(null)}
                proactiveImage={proactiveImageForChatbot}
                onProactiveImageConsumed={onProactiveImageConsumed}
                onApplySuggestion={handleApplySuggestion}
                activeTab={activeTab}
                chatContext={chatContext}
                setTheme={setTheme}
                isSnoozed={isSnoozed}
                setIsSnoozed={setIsSnoozed}
                onSnooze={handleSnooze}
                snoozeCount={snoozeCount}
                isMobile={isMobile}
                isTampered={isTamperLocked}
                onBeforeClose={runTamperCheck}
            />
            <FloatingDonateButton onClick={() => setIsDonationModalOpen(true)} />
        </div>


        {fullscreenState && (
            <FullscreenView 
                images={fullscreenState.images} 
                currentIndex={fullscreenState.currentIndex}
                onClose={handleCloseFullscreen}
                onNext={handleNextFullscreen}
                onPrev={handlePrevFullscreen}
                onSave={handleSaveFilteredImage}
                onSendToChatbot={handleSendToChatbot}
            />
        )}
        <DonationModal isOpen={isDonationModalOpen} onClose={() => setIsDonationModalOpen(false)} />

        <InfoModal
            isOpen={isWelcomeModalOpen}
            onClose={() => setIsWelcomeModalOpen(false)}
            title={t('welcomeModal.title')}
            showDonateButton={true}
            onOpenDonationModal={() => setIsDonationModalOpen(true)}
        >
            <WelcomeModalContent />
        </InfoModal>

        <InfoModal
            isOpen={isFeedbackModalOpen}
            onClose={() => setIsFeedbackModalOpen(false)}
            title={t('feedbackModal.title')}
            showDonateButton={true}
            onOpenDonationModal={() => setIsDonationModalOpen(true)}
        >
            <FeedbackModalContent />
        </InfoModal>
        
    </div>
  );
};

export default App;