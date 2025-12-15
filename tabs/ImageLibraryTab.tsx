import React, { useRef, useState } from 'react';
import { useImageLibrary } from '../contexts/ImageLibraryContext';
import { useTranslation } from '../hooks/useTranslation';
import { ImageResult as ImageResultType, EnhanceState, GenerationInfo, VideoResult, Tab } from '../types';
import { FolderOpenIcon, DownloadIcon, ArrowUpOnSquareIcon, TrashIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon } from '../components/icons';
import VideoResultComponent from '../components/VideoResult';
import ImageResultComponent from '../components/ImageResult';
import { nanoid } from 'nanoid';
import { fileToBase64 } from '../utils/file';

interface ImageLibraryTabProps {
    onFullscreen: (images: ImageResultType[], startIndex: number) => void;
    onRegenerate: (info: GenerationInfo) => void;
    onSendToEnhance: (state: EnhanceState) => void;
    onSendToQuickGenerateInspiration: (state: EnhanceState) => void;
    onSendToRenderAIMain: (state: EnhanceState) => void;
    onSendToRenderAIRef?: (state: EnhanceState) => void;
    onSendToTraining: (state: EnhanceState) => void;
    onSendToFloorPlanRef?: (state: EnhanceState) => void;
    onSendToColoringRef?: (state: EnhanceState) => void;
    onSendToVirtualTour?: (state: EnhanceState) => void;
    onSendToTechDrawing: (state: EnhanceState) => void;
    onSendToUpscale: (state: EnhanceState) => void;
    onSendToVeo: (state: EnhanceState) => void;
}

const ImageLibraryTab: React.FC<ImageLibraryTabProps> = ({ 
    onFullscreen, 
    onRegenerate,
    ...sendToProps
}) => {
    const { images, videos, deleteImage, deleteVideo, loadLibrary, addMedia } = useImageLibrary();
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [zoomLevel, setZoomLevel] = useState(3); // 1 (smallest) to 5 (largest)

    const zoomToGridCols: { [key: number]: string } = {
        1: 'sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
        2: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
        3: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4', // Default
        4: 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3',
        5: 'sm:grid-cols-1 md:grid-cols-2',
    };

    const handleSaveLibrary = () => {
        const libraryData = {
            images,
            videos,
        };
        const jsonString = JSON.stringify(libraryData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `Sudy_Library_${timestamp}.SudyLibrary`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleLoadLibraryClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleUploadClick = () => {
        uploadInputRef.current?.click();
    };

    const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const { base64, mimeType } = await fileToBase64(file);
                const newImage: ImageResultType = {
                    id: nanoid(),
                    base64,
                    mimeType,
                };
                addMedia(newImage);
            } catch (error) {
                console.error("Error uploading image:", error);
                alert("Failed to upload image.");
            }
        }
        if (event.target) {
            event.target.value = '';
        }
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("File content is not readable text.");
                const data = JSON.parse(text);

                if (!data || (!Array.isArray(data.images) && !Array.isArray(data.videos))) {
                    throw new Error("Invalid .SudyLibrary file format. It must contain 'images' and/or 'videos' arrays.");
                }
                
                const dataToLoad = {
                    images: data.images || [],
                    videos: data.videos || [],
                };

                if (window.confirm("Are you sure you want to load this library? This will replace your current library and cannot be undone.")) {
                    loadLibrary(dataToLoad);
                }
            } catch (err) {
                alert(`Error loading library file: ${err instanceof Error ? err.message : 'Unknown error'}`);
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    };
    
    const handleDeleteImage = (imageId: string) => {
        if (window.confirm(t('imageLibrary.confirmDeleteImage'))) {
            deleteImage(imageId);
        }
    };

    const handleDeleteVideo = (videoId: string) => {
        if (window.confirm(t('imageLibrary.confirmDeleteVideo'))) {
            deleteVideo(videoId);
        }
    };
    
    if (images.length === 0 && videos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500 p-8 min-h-[calc(100vh-250px)]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full max-w-7xl mx-auto mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">{t(Tab.ImageLibrary)}</h1>
                    <div className="flex gap-2">
                        <input type="file" ref={uploadInputRef} className="hidden" accept="image/*" onChange={handleUploadFile} />
                        <button onClick={handleUploadClick} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                            <ArrowUpOnSquareIcon className="w-5 h-5" />
                            <span>{t('imageLibrary.uploadImage')}</span>
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".SudyLibrary,application/json,text/plain,application/octet-stream" onChange={handleFileSelected} />
                        <button onClick={handleLoadLibraryClick} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            <FolderOpenIcon className="w-5 h-5" />
                            <span>{t('imageLibrary.loadLibrary')}</span>
                        </button>
                        <button onClick={handleSaveLibrary} disabled className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md transition-colors opacity-50 cursor-not-allowed">
                            <DownloadIcon className="w-5 h-5" />
                            <span>{t('imageLibrary.saveLibrary')}</span>
                        </button>
                    </div>
                </div>

                <FolderOpenIcon className="w-24 h-24 mb-4 text-gray-300 dark:text-gray-600" />
                <h2 className="text-2xl font-bold text-gray-600 dark:text-gray-400">{t('imageLibrary.empty.title')}</h2>
                <p className="mt-2 text-gray-500">{t('imageLibrary.empty.subtitle')}</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto relative p-4 md:p-8 space-y-8 no-scrollbar">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-gray-800/80 text-white p-2 rounded-full shadow-lg backdrop-blur-sm">
                <button onClick={() => setZoomLevel(z => Math.max(1, z - 1))} disabled={zoomLevel === 1} className="p-1 disabled:opacity-50"><MagnifyingGlassMinusIcon className="w-5 h-5"/></button>
                <span className="w-4 text-center text-sm font-mono font-semibold">{zoomLevel}</span>
                <button onClick={() => setZoomLevel(z => Math.min(5, z + 1))} disabled={zoomLevel === 5} className="p-1 disabled:opacity-50"><MagnifyingGlassPlusIcon className="w-5 h-5"/></button>
            </div>

             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">{t(Tab.ImageLibrary)}</h1>
                <div className="flex gap-2 items-center">
                    <input type="file" ref={uploadInputRef} className="hidden" accept="image/*" onChange={handleUploadFile} />
                    <button onClick={handleUploadClick} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                        <ArrowUpOnSquareIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">{t('imageLibrary.uploadImage')}</span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".SudyLibrary,application/json,text/plain,application/octet-stream"
                        onChange={handleFileSelected}
                    />
                    <button onClick={handleLoadLibraryClick} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                        <FolderOpenIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">{t('imageLibrary.loadLibrary')}</span>
                    </button>
                    <button onClick={handleSaveLibrary} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                        <DownloadIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">{t('imageLibrary.saveLibrary')}</span>
                    </button>
                </div>
            </div>

            {videos.length > 0 && (
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">{t('imageLibrary.videos.title')}</h2>
                    <div className={`grid grid-cols-1 ${zoomToGridCols[zoomLevel]} gap-4`}>
                        {videos.map((video) => (
                             <VideoResultComponent
                                key={video.id}
                                result={video}
                                onRegenerate={video.generationInfo ? (e) => onRegenerate(video.generationInfo!) : undefined}
                                onDelete={() => handleDeleteVideo(video.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {images.length > 0 && (
                 <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">{t('imageLibrary.images.title')}</h2>
                    <div className={`grid grid-cols-1 ${zoomToGridCols[zoomLevel]} gap-4`}>
                        {images.map((image, index) => (
                            <div key={image.id} className="aspect-square">
                                <ImageResultComponent
                                    result={image}
                                    onFullscreen={() => onFullscreen(images, index)}
                                    onRegenerate={image.generationInfo ? onRegenerate : undefined}
                                    onDelete={() => handleDeleteImage(image.id)}
                                    {...sendToProps}
                                />
                            </div>
                        ))}
                    </div>
                 </div>
            )}
        </div>
    );
};

export default ImageLibraryTab;