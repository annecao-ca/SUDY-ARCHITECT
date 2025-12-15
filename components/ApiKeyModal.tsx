import React, { useState } from 'react';
import { XMarkIcon, KeyIcon, CheckIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';
import { useApiQuota } from '../contexts/ApiQuotaContext';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { limit, setLimit } = useApiQuota();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('user_api_key') || '');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('user_api_key', apiKey);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md m-4 relative border border-gray-300 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
        
        <div className="flex items-center mb-6">
            <KeyIcon className="w-8 h-8 text-blue-500 mr-3 flex-shrink-0" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('apiKey.title')}</h2>
        </div>
        
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('apiKey.userKeyTitle')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {t('apiKey.description')}
                </p>
                <div className="flex items-center space-x-2">
                    <input
                        id="api-key-input"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={t('apiKey.placeholder')}
                        className="flex-grow w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button 
                        onClick={handleSave} 
                        className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors flex items-center justify-center w-20 ${isSaved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isSaved ? <CheckIcon className="w-5 h-5"/> : <span>{t('apiKey.save')}</span>}
                    </button>
                </div>
                {isSaved && <p className="text-green-500 text-xs mt-1">{t('apiKey.savedMessage')}</p>}
                <p className="text-xs text-gray-500 mt-2">{t('apiKey.envFallbackDescription')}</p>
            </div>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('quota.title')}</h3>
              
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="quota-limit">
                {t('quota.dailyLimit')}
              </label>
              <input
                id="quota-limit"
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
              />
            </div>
        </div>

        <div className="mt-6 flex justify-end space-x-2">
           <button 
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;