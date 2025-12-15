import React, { useState, useCallback, useEffect, useRef } from 'react';
import { UploadIcon, XMarkIcon } from './icons/index';
import { useTranslation } from '../hooks/useTranslation';
import { base64ToFile } from '../utils/file';
import { nanoid } from 'nanoid';

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  id: string;
  multiple?: boolean;
  previewUrl?: string | null;
  onClear: () => void;
  containerClassName?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, id, multiple = false, previewUrl, onClear, containerClassName = "aspect-square", draggable, onDragStart }) => {
  const [internalPreview, setInternalPreview] = useState<string | null>(null);
  const { t } = useTranslation();
  const labelRef = useRef<HTMLLabelElement>(null);

  const currentPreview = previewUrl || internalPreview;

  // Clear internal preview if the parent-provided previewUrl is removed
  useEffect(() => {
    if (!previewUrl) {
      setInternalPreview(null);
    }
  }, [previewUrl]);


  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      const newPreviewUrl = URL.createObjectURL(file);
      setInternalPreview(newPreviewUrl);
      onFileChange(file);
    } else {
      onFileChange(null);
    }
  };
  
  const handleClear = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if(internalPreview) {
          URL.revokeObjectURL(internalPreview);
      }
      setInternalPreview(null);
      onClear();
  }

  const onDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    const suggestionData = event.dataTransfer.getData('application/sudy-image-suggestion');

    if (suggestionData) {
        try {
            const { base64, mimeType } = JSON.parse(suggestionData);
            const file = base64ToFile(base64, `sudy-suggestion-${nanoid(6)}.jpg`, mimeType);
            const dt = new DataTransfer();
            dt.items.add(file);
            handleFileChange(dt.files);
        } catch (e) {
            console.error("Failed to handle dropped suggestion:", e);
            // Fallback to normal file handling just in case
            handleFileChange(event.dataTransfer.files);
        }
    } else {
        handleFileChange(event.dataTransfer.files);
    }
  }, [handleFileChange]);

  const onDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Prioritize image data from clipboard (e.g., screenshots)
    const items = event.clipboardData.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            // Create a FileList-like object to pass to handleFileChange
            const dt = new DataTransfer();
            dt.items.add(file);
            handleFileChange(dt.files);
            return; // Found an image, we're done
          }
        }
      }
    }

    // Fallback for files copied from the file system
    if (event.clipboardData.files.length > 0) {
      handleFileChange(event.clipboardData.files);
    }
  }, [handleFileChange]);

  return (
    <div className="relative" draggable={draggable} onDragStart={onDragStart}>
      <label
        ref={labelRef}
        htmlFor={id}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onPaste={handlePaste}
        onMouseEnter={() => labelRef.current?.focus()}
        onMouseLeave={() => labelRef.current?.blur()}
        tabIndex={0}
        className={`cursor-pointer bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 flex flex-col items-center justify-center text-center hover:border-blue-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors w-full h-full ${containerClassName}`}
      >
        <input
          id={id}
          type="file"
          className="hidden"
          accept="image/*"
          multiple={multiple}
          onChange={(e) => handleFileChange(e.target.files)}
        />
        {currentPreview ? (
          <img src={currentPreview} alt={t('upload.alt.preview')} className="max-h-full max-w-full rounded-md object-contain" />
        ) : (
          <>
            <UploadIcon className="w-8 h-8 text-gray-400 dark:text-gray-500 mb-2" />
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('upload.dragAndDrop')}</span>
            <span className="text-xs text-gray-600 dark:text-gray-500 mt-1">{t('upload.fileTypes')}</span>
          </>
        )}
      </label>
       {currentPreview && (
         <button 
            onClick={handleClear} 
            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700 transition-transform hover:scale-110"
            title={t('close')}
        >
            <XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default FileUpload;