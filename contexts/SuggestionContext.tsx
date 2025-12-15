import React, { createContext, useState, useContext, ReactNode } from 'react';
import { ImageResult } from '../types';

interface SuggestionContextType {
  suggestion: ImageResult | null;
  setSuggestion: (image: ImageResult | null) => void;
}

const SuggestionContext = createContext<SuggestionContextType | undefined>(undefined);

export const SuggestionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [suggestion, setSuggestion] = useState<ImageResult | null>(null);

  return (
    <SuggestionContext.Provider value={{ suggestion, setSuggestion }}>
      {children}
    </SuggestionContext.Provider>
  );
};

export const useSuggestion = (): SuggestionContextType => {
  const context = useContext(SuggestionContext);
  if (!context) {
    throw new Error('useSuggestion must be used within a SuggestionProvider');
  }
  return context;
};
