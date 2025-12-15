import React, { createContext, useContext, ReactNode } from 'react';

interface ActivationContextType {
  isActivated: boolean;
  activate: (code: string) => boolean;
  isModalOpen: boolean;
  openActivationModal: () => void;
  closeActivationModal: () => void;
}

const ActivationContext = createContext<ActivationContextType | undefined>(undefined);

export const ActivationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const value: ActivationContextType = {
    isActivated: true,
    activate: (_code: string) => true,
    isModalOpen: false,
    openActivationModal: () => {},
    closeActivationModal: () => {},
  };

  return (
    <ActivationContext.Provider value={value}>
      {children}
    </ActivationContext.Provider>
  );
};

export const useActivation = (): ActivationContextType => {
  const context = useContext(ActivationContext);
  if (!context) {
    throw new Error('useActivation must be used within an ActivationProvider');
  }
  return context;
};