import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './hooks/useTranslation';
import { ActivationProvider } from './contexts/ActivationContext';
import { ImageLibraryProvider } from './contexts/ImageLibraryContext';
import { ApiQuotaProvider } from './contexts/ApiQuotaContext';
import { SuggestionProvider } from './contexts/SuggestionContext';

const VERIFICATION_TOKEN = 'U1VEWV9BUkNISVRFQ1RVUkVfSU5URUdSSVRZX0NIRUNLXzEyMzQ1MTIzNDVfREVWRUxPUEVEX0JZX1RSVU9OR19ESUVOX0RVWV9WJk5fMjAyNA==';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <ActivationProvider>
        <SuggestionProvider>
          <ImageLibraryProvider>
            <ApiQuotaProvider>
              <App />
            </ApiQuotaProvider>
          </ImageLibraryProvider>
        </SuggestionProvider>
      </ActivationProvider>
    </LanguageProvider>
  </React.StrictMode>
);