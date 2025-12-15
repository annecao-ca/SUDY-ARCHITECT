import React from 'react';
import { SparklesIcon } from './icons';
import { AVATAR_BASE64 } from '../assets/avatar';
import { useTranslation } from '../hooks/useTranslation';

interface LoginScreenProps {
  onLoginSuccess: (user: { name: string, email: string, picture: string }) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { t } = useTranslation();

  const handleGuestLogin = () => {
    onLoginSuccess({
      name: 'Guest',
      email: 'guest@sudy.app',
      picture: AVATAR_BASE64,
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl text-center max-w-sm w-full mx-4">
        <h1 className="font-orbitron text-2xl font-bold text-gray-900 dark:text-white">
          {t('appTitle')}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {t('login.subtitle')}
        </p>
        <div className="mt-8">
          <button
            onClick={handleGuestLogin}
            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2"
          >
            <SparklesIcon className="w-5 h-5" />
            <span>{t('login.start')}</span>
          </button>
        </div>
        <p className="mt-8 text-xs text-gray-500 dark:text-gray-500">
          {t('login.note')}
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;