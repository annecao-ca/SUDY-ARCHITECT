
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { ImageResult, VideoResult } from '../types';
import { useSuggestion } from './SuggestionContext';

interface ImageLibraryContextType {
  images: ImageResult[];
  videos: VideoResult[];
  addMedia: (media: ImageResult | VideoResult) => void;
  deleteImage: (imageId: string) => void;
  deleteVideo: (videoId: string) => void;
  loadLibrary: (data: { images: ImageResult[]; videos: VideoResult[] }) => void;
}

const ImageLibraryContext = createContext<ImageLibraryContextType | undefined>(undefined);

export const ImageLibraryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [images, setImages] = useState<ImageResult[]>([]);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const { setSuggestion } = useSuggestion();

  const addMedia = (media: ImageResult | VideoResult) => {
    if ('url' in media) { // VideoResult
        setVideos(prev => {
            const existingIndex = prev.findIndex(v => v.id === media.id);
            if (existingIndex > -1) {
                const newVideos = [...prev];
                newVideos[existingIndex] = media;
                return newVideos;
            }
            return [media, ...prev];
        });
    } else { // ImageResult
        setImages(prev => {
            const existingIndex = prev.findIndex(img => img.id === media.id);
            if (existingIndex > -1) {
                const newImages = [...prev];
                newImages[existingIndex] = media;
                return newImages;
            }
            return [media, ...prev];
        });
        setSuggestion(media);
    }
  };

  const deleteImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const deleteVideo = (videoId: string) => {
    setVideos(prev => prev.filter(v => v.id !== videoId));
  };
  
  const loadLibrary = (data: { images: ImageResult[]; videos: VideoResult[] }) => {
    setImages(data.images || []);
    setVideos(data.videos || []);
  };

  return (
    <ImageLibraryContext.Provider value={{ images, videos, addMedia, deleteImage, deleteVideo, loadLibrary }}>
      {children}
    </ImageLibraryContext.Provider>
  );
};

export const useImageLibrary = (): ImageLibraryContextType => {
  const context = useContext(ImageLibraryContext);
  if (!context) {
    throw new Error('useImageLibrary must be used within an ImageLibraryProvider');
  }
  return context;
};