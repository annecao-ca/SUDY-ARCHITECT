import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { PaperAirplaneIcon, XMarkIcon, HeartIcon, PhotoIcon, PauseCircleIcon } from './icons';
import SpeechToTextButton from './SpeechToTextButton';
import { getChatbotResponse, getChatbotProactiveSuggestions } from '../services/geminiService';
import { fileToBase64 } from '../utils/file';
// FIX: Moved ChatContext import from geminiService to types, as it is exported from types.ts.
import { Tab, Message, Theme, ChatContext } from '../types';
import { nanoid } from 'nanoid';
import CatBotIcon from './CatBotIcon';

export const VERIFICATION_TOKEN = 'U1VEWV9BUkNISVRFQ1RVUkVfSU5URUdSSVRZX0NIRUNLXzEyMzQ1MTIzNDVfREVWRUxPUEVEX0JZX1RSVU9OR19ESUVOX0RVWV9WJk5fMjAyNA==';

interface ChatbotProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onAction: (tab: Tab, stateUpdate: any, file: File | null) => void;
  onOpenDonationModal: () => void;
  initialFile: File | null;
  onInitialFileConsumed: () => void;
  proactiveImage: { file: File, trigger: 'upload' | 'generation', sourceTab: Tab } | null;
  onProactiveImageConsumed: () => void;
  onApplySuggestion: (suggestion: { text: string; targetTab?: Tab; prompt?: string }, message: Message) => void;
  activeTab: Tab;
  chatContext: ChatContext;
  setTheme: (theme: Theme) => void;
  isSnoozed: boolean;
  setIsSnoozed: (snoozed: boolean) => void;
  onSnooze: () => void;
  snoozeCount: number;
  isMobile: boolean;
  isTampered: boolean;
  onBeforeClose?: () => boolean; // Returns true to prevent close
}

interface TypingIndicatorProps {}

const TypingIndicator: React.FC<TypingIndicatorProps> = () => (
    <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:0.2s]"></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:0.4s]"></div>
    </div>
);

interface BotMessageContentProps {
    message: Message;
    isLastBotMessage: boolean;
    onTyping: () => void;
    onTypingStart?: () => void;
    onTypingEnd?: () => void;
}

const BotMessageContent: React.FC<BotMessageContentProps> = ({ message, isLastBotMessage, onTyping, onTypingStart, onTypingEnd }) => {
    const [typedText, setTypedText] = useState('');
    const fullText = message.text;
    const isFirstRender = useRef(true);
    
    useEffect(() => {
        if (isLastBotMessage && !message.isLoadingMore) {
            if (isFirstRender.current) {
                isFirstRender.current = false;
                onTypingStart?.();
                setTypedText('');
                let i = 0;
                const timer = setInterval(() => {
                    if (i < fullText.length) {
                        setTypedText(fullText.substring(0, i + 1));
                        onTyping();
                        i++;
                    } else {
                        clearInterval(timer);
                        onTypingEnd?.();
                    }
                }, 30);

                return () => {
                    clearInterval(timer);
                    onTypingEnd?.();
                };
            } else {
                 setTypedText(fullText);
            }
        } else {
            setTypedText(fullText);
        }
    }, [fullText, isLastBotMessage, message.isLoadingMore, onTyping, onTypingStart, onTypingEnd]);

    return <p className="text-sm whitespace-pre-wrap">{typedText}</p>;
};


export const Chatbot: React.FC<ChatbotProps> = ({
  messages,
  setMessages,
  onAction,
  onOpenDonationModal,
  initialFile,
  onInitialFileConsumed,
  proactiveImage,
  onProactiveImageConsumed,
  onApplySuggestion,
  activeTab,
  chatContext,
  setTheme,
  isSnoozed,
  setIsSnoozed,
  onSnooze,
  snoozeCount,
  isMobile,
  isTampered,
  onBeforeClose,
}) => {
  const { t, language } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [isRendered, setIsRendered] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [hasNotification, setHasNotification] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const welcomeMessageSent = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleClose = useCallback(() => {
    if (onBeforeClose && onBeforeClose()) {
      return; 
    }
    if (isTampered) return; 
    
    setIsOpen(false);
    setHasNotification(false);
    setTimeout(() => {
        setIsRendered(false);
    }, 300); 
  }, [isTampered, onBeforeClose]);

  const handleOpen = useCallback(() => {
    if (isRendered) return;
    setHasNotification(false);
    setIsSnoozed(false); 
    setIsRendered(true);
    setTimeout(() => setIsOpen(true), 10);
  }, [isRendered, setIsSnoozed]);
  
  useEffect(() => {
    if (isTampered) {
      setIsRendered(true);
      setIsOpen(true);
    }
  }, [isTampered]);
  
    useEffect(() => {
        const hasHadInteraction = messages.length > 0;
        if (!hasHadInteraction && !welcomeMessageSent.current && !isSnoozed) {
            
            setHasNotification(true);
            
            let welcomeText = t('chatbot.welcomeProactive');

            try {
                const welcomeOptions = JSON.parse(welcomeText);

                if (typeof welcomeOptions === 'object' && welcomeOptions !== null && !Array.isArray(welcomeOptions)) {
                    const hour = new Date().getHours();
                    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';

                    if (hour >= 5 && hour < 12) {
                        timeOfDay = 'morning';
                    } else if (hour >= 12 && hour < 18) {
                        timeOfDay = 'afternoon';
                    } else if (hour >= 18 && hour < 23) {
                        timeOfDay = 'evening';
                    } else {
                        timeOfDay = 'night';
                    }
                    
                    const messagesForTime = welcomeOptions[timeOfDay];
                    if (Array.isArray(messagesForTime) && messagesForTime.length > 0) {
                        welcomeText = messagesForTime[Math.floor(Math.random() * messagesForTime.length)];
                    } else {
                        const allMessages = Object.values(welcomeOptions).flat();
                        if (allMessages.length > 0) {
                             welcomeText = allMessages[Math.floor(Math.random() * allMessages.length)] as string;
                        }
                    }
                }
                else if (Array.isArray(welcomeOptions) && welcomeOptions.length > 0) {
                     welcomeText = welcomeOptions[Math.floor(Math.random() * welcomeOptions.length)];
                }
            } catch (e) {
                // It's a plain string, do nothing.
            }

            setMessages([{
                id: nanoid(),
                sender: 'bot',
                text: welcomeText,
            }]);
            welcomeMessageSent.current = true;
        }
    }, [messages.length, setMessages, t, isSnoozed]);

    useEffect(() => {
        if (isSnoozed && !isTampered) {
            handleClose();
        }
    }, [isSnoozed, isTampered, handleClose]);

  useEffect(() => {
    if(isRendered) {
        scrollToBottom();
    }
  }, [messages, isRendered, scrollToBottom]);
  
   useEffect(() => {
    if (initialFile) {
      setImageFile(initialFile);
      setImagePreview(URL.createObjectURL(initialFile));
      handleOpen();
      onInitialFileConsumed();
    }
  }, [initialFile, onInitialFileConsumed, handleOpen]);

  const handleProactiveSuggestions = useCallback(async (file: File, trigger: 'upload' | 'generation', sourceTab: Tab) => {
    setIsLoading(true);
    const tempId = nanoid();
    setMessages(prev => [...prev, { id: tempId, sender: 'bot', text: '', isLoadingMore: true }]);

    try {
        const image = await fileToBase64(file);
        const { warning, suggestions, theme_change } = await getChatbotProactiveSuggestions(image.base64, trigger, language, sourceTab);
        
        if (theme_change) {
            setTheme(theme_change);
        }

        const botMessage: Message = {
            id: nanoid(),
            sender: 'bot',
            text: warning || `Đây là một vài ý tưởng sáng tạo cho bức ảnh ${trigger === 'upload' ? 'bạn vừa tải lên' : 'vừa được tạo ra'}:`,
            suggestions: suggestions.map((s: any) => ({ text: s.text, targetTab: s.targetTab as Tab, prompt: s.prompt || undefined })),
            proactiveContext: { imageFile: file, trigger, sourceTab }
        };

        setMessages(prev => prev.filter(m => m.id !== tempId).concat(botMessage));
    } catch(e) {
        console.error("Proactive suggestion failed:", e);
        setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
        setIsLoading(false);
    }
  }, [setMessages, language, setTheme]);

  useEffect(() => {
    if (proactiveImage) {
      if (!isOpen) {
        setHasNotification(true);
      }
      handleProactiveSuggestions(proactiveImage.file, proactiveImage.trigger, proactiveImage.sourceTab);
      onProactiveImageConsumed();
    }
  }, [proactiveImage, onProactiveImageConsumed, handleProactiveSuggestions, isOpen]);


  const handleSendMessage = useCallback(async () => {
    const userPrompt = inputValue.trim();
    if (!userPrompt && !imageFile) return;

    const userMessage: Message = { id: nanoid(), sender: 'user', text: userPrompt, imageFile: imageFile || undefined, imagePreview: imagePreview || undefined };
    
    const tempBotMessageId = nanoid();
    const tempBotMessage: Message = { id: tempBotMessageId, sender: 'bot', text: '', isLoadingMore: true };
    setMessages(prev => [...prev, userMessage, tempBotMessage]);
    
    setInputValue('');
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    
    setIsLoading(true);

    try {
      const image = imageFile ? await fileToBase64(imageFile) : null;
      
      // FORCE UPDATE CONTEXT HERE to ensure activeTab is latest
      const currentContext = {
          ...chatContext,
          activeTab: activeTab 
      };

      const responseText = await getChatbotResponse(userPrompt, image ? image.base64 : null, language, currentContext);
      
      const responseData = JSON.parse(responseText);

      if (responseData.theme_change) {
        setTheme(responseData.theme_change as Theme);
      }

      const botMessage: Message = {
        id: nanoid(),
        sender: 'bot',
        text: responseData.explanation,
        botAction: responseData.recommended_tab ? {
            tab: responseData.recommended_tab,
            prompt: responseData.suggested_prompt,
            buttonText: responseData.action_button_text || "Thử ngay",
        } : undefined,
        suggestedPrompt: responseData.recommended_tab ? responseData.suggested_prompt : undefined,
        suggestions: responseData.suggestions
      };
      setMessages(prev => prev.map(m => m.id === tempBotMessageId ? botMessage : m));

    } catch (e) {
      console.error(e);
      const errorMessage: Message = { id: nanoid(), sender: 'bot', text: t('chatbot.error') };
      setMessages(prev => prev.map(m => m.id === tempBotMessageId ? errorMessage : m));
    } finally {
      setIsLoading(false);
      const messageCount = parseInt(localStorage.getItem('sudy_message_count') || '0') + 1;
      localStorage.setItem('sudy_message_count', messageCount.toString());
      
      setTimeout(() => {
          const zaloDismissed = localStorage.getItem('sudy_zalo_dismissed') === 'true';
          const donateDismissed = localStorage.getItem('sudy_donate_dismissed') === 'true';

          // Zalo reminder: start at message 5, repeat every 10 messages
          if (messageCount >= 5 && messageCount % 10 === 5 && !zaloDismissed) {
              setMessages(prev => [...prev, {
                  id: nanoid(),
                  sender: 'bot',
                  text: t('chatbot.zaloReminder'),
                  suggestions: [{ text: t('chatbot.zaloConfirm') }]
              }]);
          }
          
          // Donate reminder: start at message 10, repeat every 10 messages
          if (messageCount >= 10 && messageCount % 10 === 0 && !donateDismissed) {
              setMessages(prev => [...prev, {
                  id: nanoid(),
                  sender: 'bot',
                  text: t('chatbot.donateReminder'),
                  suggestions: [{ text: t('chatbot.donateConfirm') }]
              }]);
          }
      }, 1500);
    }
  }, [inputValue, imageFile, imagePreview, setMessages, language, t, chatContext, activeTab, setTheme]);

    const handleReminderAction = (suggestion: { text: string; targetTab?: Tab; prompt?: string }, message: Message) => {
        if (suggestion.text === t('chatbot.zaloConfirm')) {
            localStorage.setItem('sudy_zalo_dismissed', 'true');
            setMessages(prev => prev.filter(m => m.id !== message.id));
        } else if (suggestion.text === t('chatbot.donateConfirm')) {
            localStorage.setItem('sudy_donate_dismissed', 'true');
            setMessages(prev => prev.filter(m => m.id !== message.id));
        } else {
            onApplySuggestion(suggestion, message);
        }
    };

  const handleTranscript = (transcript: string) => {
    setInputValue(prev => prev ? `${prev} ${transcript}` : transcript);
  };

  const handleClearImage = () => {
    if(imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };
  
  const handleUploadClick = () => fileInputRef.current?.click();
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        handleClearImage();
        const file = e.target.files[0];
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    }
    // Reset file input to allow re-uploading the same file
    if (e.target) e.target.value = '';
  };


  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        handleClearImage();
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
      }
    }
  };
  
  const handleTypingStart = useCallback(() => setIsBotTyping(true), []);
  const handleTypingEnd = useCallback(() => setIsBotTyping(false), []);

  let catState: 'idle' | 'thinking' | 'talking' = 'idle';
  if (isLoading) {
    catState = 'thinking';
  } else if (isBotTyping) {
    catState = 'talking';
  }

  if (!isRendered && !isTampered) {
    return (
      <button onClick={handleOpen} className="relative w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 hover:scale-110 hover:bg-blue-700 p-2">
        <CatBotIcon state={'idle'} size="large" />
        {hasNotification && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
        )}
      </button>
    );
  }
  
  const animationClass = isOpen ? 'chatbot-enter-active' : 'chatbot-leave-active';

  return (
    <div className={`fixed bottom-5 right-5 w-[380px] h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-700 z-40 ${animationClass}`} style={{ transformOrigin: 'bottom right' }}>
      <header className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex-shrink-0">
            <CatBotIcon state={catState} size="large" />
          </div>
          <h3 className="font-bold text-lg">{t('chatbot.title')}</h3>
        </div>
        <div className="flex items-center gap-1">
            <button 
                onClick={() => { if (!isTampered) onSnooze(); }}
                disabled={snoozeCount >= 10 || isTampered} 
                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed relative group"
                title={`Tạm ẩn (${10 - snoozeCount} lần còn lại)`}
            >
                <PauseCircleIcon className="w-6 h-6" />
                {snoozeCount < 10 && <span className="absolute -top-1 -right-1 text-xs bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">{10 - snoozeCount}</span>}
            </button>
            <button onClick={handleClose} disabled={isTampered} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
              <XMarkIcon className="w-6 h-6" />
            </button>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => {
            const isLastMessage = index === messages.length - 1;
            const isLastBotMessage = isLastMessage && msg.sender === 'bot';

            return (
                <div key={msg.id} className={`flex gap-3 ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                    {msg.sender === 'bot' && (
                        <div className="w-7 h-7 flex-shrink-0 mt-1">
                           <CatBotIcon state={'idle'} size="small"/>
                        </div>
                    )}
                    <div className={`max-w-xs rounded-2xl px-4 py-2 ${msg.sender === 'bot' ? 'bg-gray-100 dark:bg-gray-700 rounded-tl-none' : 'bg-blue-500 text-white rounded-br-none'}`}>
                        {msg.isLoadingMore ? (
                            <TypingIndicator />
                        ) : msg.sender === 'bot' ? (
                            <BotMessageContent 
                                message={msg} 
                                isLastBotMessage={isLastBotMessage} 
                                onTyping={scrollToBottom} 
                                onTypingStart={isLastBotMessage ? handleTypingStart : undefined}
                                onTypingEnd={isLastBotMessage ? handleTypingEnd : undefined}
                            />
                        ) : (
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        )}
                        
                        {msg.imagePreview && <img src={msg.imagePreview} alt="preview" className="mt-2 rounded-lg max-h-40" />}
                        {msg.botAction && (
                            <button onClick={() => onAction(msg.botAction!.tab, { prompt: msg.botAction?.prompt || '' }, msg.imageFile || (msg.proactiveContext ? msg.proactiveContext.imageFile : null))} className="mt-2 w-full text-sm bg-blue-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors">
                                {msg.botAction.buttonText}
                            </button>
                        )}
                        {msg.suggestions && (
                            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600 space-y-2">
                                {msg.suggestions.map((s: any, i: number) => (
                                    <button key={i} onClick={() => handleReminderAction(s, msg)} className="w-full text-left text-xs p-2 rounded-md bg-blue-100/50 dark:bg-blue-900/40 hover:bg-blue-200/50 dark:hover:bg-blue-800/50 text-blue-800 dark:text-blue-200 transition-colors">
                                        &rarr; {s.text}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )
        })}
        <div ref={messagesEndRef} />
      </div>

      <footer className="p-3 border-t border-gray-200 dark:border-gray-700">
        {imagePreview && (
          <div className="relative w-20 h-20 mb-2">
            <img src={imagePreview} alt="upload preview" className="w-full h-full object-cover rounded-md" />
            <button onClick={handleClearImage} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
              <XMarkIcon className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="relative">
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={t('chatbot.placeholder')}
            className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-xl p-3 pr-28 text-sm resize-none focus:ring-2 focus:ring-blue-500"
            rows={1}
            style={{ maxHeight: '80px' }}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
             <button onClick={handleUploadClick} className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400">
                <PhotoIcon className="w-5 h-5" />
            </button>
            <SpeechToTextButton onTranscript={handleTranscript} language={language} />
            <button onClick={handleSendMessage} disabled={isLoading || (!inputValue && !imageFile)} className="p-2 text-white bg-blue-600 rounded-full disabled:bg-gray-400 dark:disabled:bg-gray-600">
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};