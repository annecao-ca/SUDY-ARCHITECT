import React, { useState, useEffect, useRef } from 'react';
import { MicrophoneIcon } from './icons';

// Add this to the top of the file to extend the window object type
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechToTextButtonProps {
  onTranscript: (transcript: string) => void;
  language: string; // 'vi' or 'en'
}

const SpeechToTextButton: React.FC<SpeechToTextButtonProps> = ({ onTranscript, language }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === 'vi' ? 'vi-VN' : 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
        setIsListening(false);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      onTranscript(transcript);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [language, onTranscript]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!recognitionRef.current) {
        // Silently fail or provide a one-time alert if needed.
        // alert("Speech recognition is not supported on your browser.");
        return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Could not start speech recognition:", error);
      }
    }
  };

  const buttonClass = `p-2 rounded-full transition-colors ${
    isListening 
      ? 'bg-red-500 text-white animate-pulse' 
      : 'text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'
  }`;

  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      return null;
  }

  return (
    <button onClick={toggleListening} className={buttonClass} title="Voice Input">
      <MicrophoneIcon className="w-5 h-5" />
    </button>
  );
};

export default SpeechToTextButton;
