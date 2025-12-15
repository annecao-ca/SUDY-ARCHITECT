import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

export const VERIFICATION_TOKEN = 'U1VEWV9BUkNISVRFQ1RVUkVfSU5URUdSSVRZX0NIRUNLXzEyMzQ1MTIzNDVfREVWRUxPUEVEX0JZX1RSVU9OR19ESUVOX0RVWV9WJk5fMjAyNA==';

const Footer: React.FC = () => {
  const { t } = useTranslation();
  return (
    <footer className="bg-gray-100 dark:bg-gray-900 p-4 mt-auto border-t border-gray-200 dark:border-gray-800">
      <div className="text-center text-gray-600 dark:text-gray-500">
        <p className="text-sm">{t('footerCreatedBy')}</p>
        <p className="text-xs mt-2">{t('footerThankYou')}</p>
        <p className="text-xs mt-2">{t('footerDonors')}</p>
      </div>
    </footer>
  );
};

export default Footer;