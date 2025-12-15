import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PaintBrushIcon, EraserIcon, UndoIcon, RedoIcon, TrashIcon, PhotoIcon, WandIcon, DocumentDuplicateIcon, LoadingSpinner, ArrowPathIcon, XMarkIcon, TypeIcon, CursorArrowRaysIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, MapPinIcon, LassoIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';
import { nanoid } from 'nanoid';
import { fileToDataURL, dataURLtoBase64 } from '../utils/file';
import { getBase64FromResponse, removeImageBackground, generateCompositeImage } from '../services/geminiService';


interface InpaintingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  imageSrc: string | null;
  drawingDataUrl: string | null;
  onDrawingChange: (url: string | null) => void;
  onImageChange: (dataUrl: string) => void;
}

// --- DATA STRUCTURES ---
interface ImageAsset {
  id: string;
  originalSrc: string;
  processedSrc: string | null;
  image: HTMLImageElement;
  processedImage: HTMLImageElement | null;
  isLoading: boolean;
}

interface PlacedObject {
  id: string;
  type: 'image' | 'text' | 'marker';
  x: number; // center x
  y: number; // center y
  width: number;
  height: number;
  rotation: number; // in radians
}

interface PlacedImage extends PlacedObject {
  type: 'image';
  assetId: string;
}

interface PlacedText extends PlacedObject {
    type: 'text';
    content: string;
    fontFamily: string;
    fontSize: number;
    color: string;
}

interface PlacedMarker extends PlacedObject {
  type: 'marker';
  number: number;
}

type CanvasObject = PlacedImage | PlacedText | PlacedMarker;
type TransformMode = 'move' | 'scale-tl' | 'scale-tr' | 'scale-bl' | 'scale-br' | 'stretch-t' | 'stretch-r' | 'stretch-b' | 'stretch-l' | 'rotate' | null;
type Tool = 'brush' | 'eraser' | 'transform' | 'text' | 'marker' | 'lasso';

interface HistoryState {
    objects: CanvasObject[];
    drawing: ImageData;
}

const FONTS = [ { name: 'Roboto', class: 'font-roboto' }, { name: 'Lora', class: 'font-lora' }, { name: 'Dancing Script', class: 'font-dancing-script' }, { name: 'Exo 2', class: 'font-exo-2' }];

const InpaintingModal: React.FC<InpaintingModalProps> = ({ isOpen, onClose, onSave, imageSrc, drawingDataUrl, onDrawingChange, onImageChange }) => {
  const { t, language } = useTranslation();
  
  // --- REFS ---
  const objectCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLImageElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const lassoPointsRef = useRef<{x: number; y: number}[]>([]);

  const interactionRef = useRef<{
    mode: TransformMode;
    originalObject: CanvasObject;
    startPos: { x: number; y: number };
    startAngle: number;
    oppositeCorner: { x: number; y: number };
  } | null>(null);
  const panStartRef = useRef({ x: 0, y: 0 });

  // --- STATE ---
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [activeTool, setActiveTool] = useState<Tool>('transform');
  const [brushSize, setBrushSize] = useState(20);
  const [brushColor, setBrushColor] = useState('#ef4444');
  
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number, y: number } | null>(null);
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const [isMixing, setIsMixing] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  
  // Zoom & Pan State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // Text specific state
  const [textFont, setTextFont] = useState(FONTS[0].name);
  const [textSize, setTextSize] = useState(48);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [editingText, setEditingText] = useState<{object: PlacedText, isNew: boolean} | null>(null);

  // Tooltip State
  const [showInitialTooltips, setShowInitialTooltips] = useState(true);
  
  const pushState = useCallback((newObjects: CanvasObject[], newDrawing?: ImageData) => {
    const drawingCanvas = drawingCanvasRef.current;
    if (!drawingCanvas) return;
    const drawingCtx = drawingCanvas.getContext('2d');
    if (!drawingCtx) return;

    const drawing = newDrawing || drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
    
    setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push({ objects: newObjects, drawing });
        return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);
  
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
    }
  };

  useEffect(() => {
    const currentState = history[historyIndex];
    if (currentState) {
        setObjects(currentState.objects);
        
        const drawingCtx = drawingCanvasRef.current?.getContext('2d');
        if (drawingCtx && currentState.drawing) {
            drawingCtx.putImageData(currentState.drawing, 0, 0);
        }
    }
  }, [history, historyIndex]);


  // --- RENDERING ---
  const measureText = (text: string, font: string, size: number) => {
    const tempCtx = document.createElement('canvas').getContext('2d')!;
    tempCtx.font = `${size}px ${font}`;
    const metrics = tempCtx.measureText(text);
    return { width: metrics.width, height: size * 1.2 };
  }

  const redrawObjectLayer = useCallback(() => {
    const canvas = objectCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    objects.forEach(obj => {
      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.rotate(obj.rotation);

      if (obj.type === 'image') {
          const asset = assets.find(a => a.id === obj.assetId);
          if (!asset) return;
          const imageToDraw = asset.processedImage || asset.image;
          if (imageToDraw) {
            ctx.drawImage(imageToDraw, -obj.width/2, -obj.height/2, obj.width, obj.height);
          }
      } else if (obj.type === 'text') {
          ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
          ctx.fillStyle = obj.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(obj.content, 0, 0);
      } else if (obj.type === 'marker') {
            const marker = obj as PlacedMarker;
            const radius = marker.width / 2;
            ctx.fillStyle = '#ef4444'; // Red color for marker
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = 'white';
            ctx.font = `bold ${radius * 1.2}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(marker.number), 0, 1);
      }
      ctx.restore();
    });
  }, [assets, objects]);
  
  // --- INITIALIZATION ---
  useEffect(() => {
    if (isOpen) {
      setShowInitialTooltips(true);
      // Reset all state when modal is opened or image source changes
      setAssets([]);
      setSelectedObjectId(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setCanvasSize({ width: 0, height: 0 }); // Reset size to force recalculation
      setModalError(null);
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, [isOpen, imageSrc]);

  const initializeCanvases = useCallback(() => {
    const bgImg = backgroundRef.current;
    const viewport = canvasViewportRef.current;
    if (!bgImg || !bgImg.complete || bgImg.naturalWidth === 0 || !viewport) return;
    
    // Calculate the display size of the image to fit within the viewport while maintaining aspect ratio
    const PADDING = 32; // Some padding to prevent touching the edges
    const viewportWidth = viewport.clientWidth - PADDING;
    const viewportHeight = viewport.clientHeight - PADDING;
    const imgWidth = bgImg.naturalWidth;
    const imgHeight = bgImg.naturalHeight;

    const imgAspectRatio = imgWidth / imgHeight;
    const viewportAspectRatio = viewportWidth / viewportHeight;

    let displayWidth, displayHeight;

    if (imgAspectRatio > viewportAspectRatio) {
      displayWidth = viewportWidth;
      displayHeight = viewportWidth / imgAspectRatio;
    } else {
      displayHeight = viewportHeight;
      displayWidth = viewportHeight * imgAspectRatio;
    }

    setCanvasSize({ width: displayWidth, height: displayHeight });
    
    setTimeout(() => { 
      const drawingCanvas = drawingCanvasRef.current;
      const drawingCtx = drawingCanvas?.getContext('2d');
      if (drawingCtx && drawingCanvas && drawingCanvas.width > 0 && drawingCanvas.height > 0) {
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        
        let initialImageData: ImageData;
        
        if (drawingDataUrl) {
            const img = new Image();
            img.onload = () => {
                drawingCtx.drawImage(img, 0, 0, drawingCanvas.width, drawingCanvas.height);
                initialImageData = drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
                setHistory([{ objects: [], drawing: initialImageData }]);
                setHistoryIndex(0);
            };
            img.src = drawingDataUrl;
        } else {
            initialImageData = drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
            setHistory([{ objects: [], drawing: initialImageData }]);
            setHistoryIndex(0);
        }
      }
      redrawObjectLayer();
    }, 0);
  }, [redrawObjectLayer, drawingDataUrl]);

  useEffect(() => {
    redrawObjectLayer();
  }, [objects, assets, canvasSize, redrawObjectLayer]);
  
  // --- TEXT EDITING ---
  useEffect(() => {
    if (editingText && textInputRef.current) {
        textInputRef.current.focus();
        textInputRef.current.select();
    }
  }, [editingText]);

  const finishEditingText = () => {
    if (!editingText) return;
    const { object, isNew } = editingText;
    const finalContent = textInputRef.current?.value || object.content;

    let newObjects = [...objects];

    if (!finalContent.trim()) { // If empty, remove the object if it was new
        if (isNew) {
            newObjects = newObjects.filter(o => o.id !== object.id);
        }
    } else {
        const { width, height } = measureText(finalContent, object.fontFamily, object.fontSize);
        newObjects = newObjects.map(o => o.id === object.id ? { ...object, content: finalContent, width, height } : o);
    }
    
    setEditingText(null);
    setObjects(newObjects);
    pushState(newObjects);
  }

  const handleToolChange = (newTool: Tool) => {
    if (editingText) {
        finishEditingText();
    }
    setActiveTool(newTool);
  };

  // --- ASSET MANAGEMENT ---
  const handleAddAsset = async (file: File) => {
    if (assets.length >= 6) return;
    const dataUrl = await fileToDataURL(file);
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
        const newAsset: ImageAsset = {
            id: nanoid(),
            originalSrc: dataUrl,
            processedSrc: null,
            image: img,
            processedImage: null,
            isLoading: false,
        };
        setAssets(prev => [...prev, newAsset]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleAddAsset(e.target.files[0]);
    }
  };

  const handleRemoveBackground = async (objectId: string) => {
    const object = objects.find(o => o.id === objectId);
    if (!object || object.type !== 'image') return;
    const asset = assets.find(a => a.id === (object as PlacedImage).assetId);
    if (!asset || asset.isLoading) return;

    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, isLoading: true } : a));

    try {
        const { base64, mimeType } = dataURLtoBase64(asset.originalSrc);
        const response = await removeImageBackground(base64, mimeType);
        const resultB64 = getBase64FromResponse(response);
        if (resultB64) {
            const processedSrc = `data:image/png;base64,${resultB64}`;
            const processedImage = new Image();
            processedImage.src = processedSrc;
            processedImage.onload = () => {
                 setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, processedSrc, processedImage, isLoading: false } : a));
            }
        } else {
             throw new Error("No image in response");
        }
    } catch (error) {
        console.error("BG removal failed:", error);
        setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, isLoading: false } : a));
    }
  };
  
  const handleMagicMix = async (objectId: string) => {
    const objectToMix = objects.find(o => o.id === objectId);
    if (!objectToMix || objectToMix.type !== 'image' || !imageSrc || canvasSize.width === 0) return;
    
    const asset = assets.find(a => a.id === (objectToMix as PlacedImage).assetId);
    if (!asset || isMixing) return;

    setIsMixing(objectId);
    setModalError(null);
    try {
        const objectImage = dataURLtoBase64(asset.processedSrc || asset.originalSrc);
        const environmentImage = dataURLtoBase64(imageSrc);
        const position = {
            x: objectToMix.x / canvasSize.width,
            y: objectToMix.y / canvasSize.height
        };
        
        const { finalImageUrl } = await generateCompositeImage(objectImage.base64, environmentImage.base64, position, language);

        onImageChange(finalImageUrl); 
        
        setObjects([]);
        setSelectedObjectId(null);
        const drawingCtx = drawingCanvasRef.current?.getContext('2d');
        if (drawingCtx) {
            drawingCtx.clearRect(0, 0, drawingCtx.canvas.width, drawingCtx.canvas.height);
            pushState([], drawingCtx.getImageData(0, 0, drawingCtx.canvas.width, drawingCtx.canvas.height));
        } else {
            pushState([]);
        }
        onDrawingChange(null);
        
    } catch (err) {
        console.error("Magic Mix failed:", err);
        setModalError(t('inpainting.error.generic', { message: err instanceof Error ? err.message : 'Unknown error'}));
    } finally {
        setIsMixing(null);
    }
  };


  const handleDuplicateObject = (objectId: string) => {
    const original = objects.find(p => p.id === objectId);
    if (original) {
        const newObject: CanvasObject = {
            ...original,
            id: nanoid(),
            x: original.x + 20 / zoom,
            y: original.y + 20 / zoom,
        };
        const newObjects = [...objects, newObject];
        setObjects(newObjects);
        pushState(newObjects);
        setSelectedObjectId(newObject.id);
    }
  }

  const handleDeleteObject = (objectId: string) => {
      const newObjects = objects.filter(p => p.id !== objectId);
      setObjects(newObjects);
      pushState(newObjects);
      if (selectedObjectId === objectId) {
          setSelectedObjectId(null);
      }
  }
  
  const handleDeleteAsset = (assetIdToDelete: string) => {
    const instanceIds = objects.filter(o => o.type === 'image' && (o as PlacedImage).assetId === assetIdToDelete).map(o => o.id);
    if (selectedObjectId && instanceIds.includes(selectedObjectId)) {
        setSelectedObjectId(null);
    }
    setAssets(prev => prev.filter(a => a.id !== assetIdToDelete));
    
    const newObjects = objects.filter(o => o.type !== 'image' || (o as PlacedImage).assetId !== assetIdToDelete);
    setObjects(newObjects);
    pushState(newObjects);
  };


  // --- CANVAS INTERACTION & TRANSFORMATION ---
    const getPointerPos = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
        const canvas = objectCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        const logicalX = (clientX - rect.left) / zoom;
        const logicalY = (clientY - rect.top) / zoom;

        return { x: logicalX, y: logicalY };
    };

  const getTransformedCoords = (x: number, y: number, object: CanvasObject) => {
      const dx = x - object.x;
      const dy = y - object.y;
      const angle = -object.rotation;
      return {
          x: dx * Math.cos(angle) - dy * Math.sin(angle),
          y: dx * Math.sin(angle) + dy * Math.cos(angle),
      };
  }
  
  const rotatePoint = (point: {x:number, y:number}, angle: number) => {
      return {
          x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
          y: point.x * Math.sin(angle) + point.y * Math.cos(angle)
      };
  }

  const hitTestCanvas = (pos: {x:number, y:number}) => {
      for(let i = objects.length - 1; i >= 0; i--) {
          const obj = objects[i];
          const localPos = getTransformedCoords(pos.x, pos.y, obj);
          if (Math.abs(localPos.x) < obj.width / 2 && Math.abs(localPos.y) < obj.height / 2) {
              return obj;
          }
      }
      return null;
  }
  
  const finalizeLassoPolygon = useCallback(() => {
    if (lassoPointsRef.current.length > 2) {
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (ctx) {
            const lastHistoryState = history[historyIndex];
            if (lastHistoryState?.drawing) ctx.putImageData(lastHistoryState.drawing, 0, 0);
            else ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            ctx.beginPath();
            ctx.moveTo(lassoPointsRef.current[0].x, lassoPointsRef.current[0].y);
            lassoPointsRef.current.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.closePath();
            
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = brushColor;
            ctx.fill();
            ctx.globalAlpha = 1.0;

            pushState(objects);
        }
    }
    setIsDrawing(false);
    lassoPointsRef.current = [];
    setActiveTool('transform');
  }, [history, historyIndex, brushColor, pushState, objects]);
  
  const handleDoubleClick = (e: React.MouseEvent) => {
      if (activeTool === 'transform') {
        const pos = getPointerPos(e.nativeEvent);
        if (!pos) return;
        const hitObject = hitTestCanvas(pos);
        if(hitObject && hitObject.type === 'text') {
            setEditingText({object: hitObject as PlacedText, isNew: false});
        }
      } else if (activeTool === 'lasso' && isDrawing && lassoPointsRef.current.length > 2) {
        finalizeLassoPolygon();
      }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (editingText) {
        finishEditingText();
        return;
    }
    const pos = getPointerPos(e.nativeEvent);
    if (!pos) return;

    switch (activeTool) {
        case 'brush':
        case 'eraser':
            setIsDrawing(true);
            setLastPos(pos);
            break;
        case 'lasso':
            if (!isDrawing) { 
                setIsDrawing(true);
                lassoPointsRef.current = [pos];
            } else { 
                const firstPoint = lassoPointsRef.current[0];
                const dist = Math.hypot(pos.x - firstPoint.x, pos.y - firstPoint.y);
                if (lassoPointsRef.current.length > 2 && dist < (10 / zoom)) {
                    finalizeLassoPolygon();
                } else {
                    lassoPointsRef.current.push(pos);
                }
            }
            break;
        case 'marker': {
            const existingMarkers = objects.filter(o => o.type === 'marker') as PlacedMarker[];
            if (existingMarkers.length >= 10) return;
            const nextNumber = (existingMarkers.reduce((max, m) => Math.max(max, m.number), 0) + 1);
            
            const newMarker: PlacedMarker = {
                id: nanoid(), type: 'marker', number: nextNumber,
                x: pos.x, y: pos.y,
                width: 30, height: 30, rotation: 0
            };
            const newObjects = [...objects, newMarker];
            setObjects(newObjects);
            pushState(newObjects);
            setSelectedObjectId(newMarker.id);
            setActiveTool('transform');
            break;
        }
        case 'text': {
            const {width, height} = measureText("Your text", textFont, textSize);
            const newTextObject: PlacedText = {
                id: nanoid(), type: 'text', content: 'Your text',
                fontFamily: textFont, fontSize: textSize, color: textColor,
                x: pos.x, y: pos.y, width, height, rotation: 0
            };
            const newObjects = [...objects, newTextObject];
            setObjects(newObjects);
            setSelectedObjectId(newTextObject.id);
            setEditingText({object: newTextObject, isNew: true});
            setActiveTool('transform');
            break;
        }
        case 'transform': {
            const hitObject = hitTestCanvas(pos);
            setSelectedObjectId(hitObject ? hitObject.id : null);
            if (hitObject) {
                handleTransformMouseDown(e, 'move', hitObject);
            } else {
                const viewport = canvasViewportRef.current;
                if (viewport) {
                    const rect = viewport.getBoundingClientRect();
                    const clientX = 'touches' in e.nativeEvent ? e.nativeEvent.touches[0].clientX : e.nativeEvent.clientX;
                    const clientY = 'touches' in e.nativeEvent ? e.nativeEvent.touches[0].clientY : e.nativeEvent.clientY;
                    setIsPanning(true);
                    panStartRef.current = { x: clientX - rect.left - pan.x, y: clientY - rect.top - pan.y };
                }
            }
            break;
        }
    }
  };
  
  const handleTransformMouseDown = (e: React.MouseEvent | React.TouchEvent, mode: TransformMode, object: CanvasObject) => {
    e.preventDefault();
    e.stopPropagation();

    const pos = getPointerPos(e.nativeEvent);
    if (!pos) return;

    let opposite = { x: 0, y: 0 };
    if (mode?.includes('scale')) {
      const { x, y, width, height, rotation } = object;
      const corner = mode.split('-')[1];
      const oppX = corner.includes('l') ? width / 2 : -width / 2;
      const oppY = corner.includes('t') ? height / 2 : -height / 2;
      const rotatedOpp = rotatePoint({ x: oppX, y: oppY }, rotation);
      opposite = { x: x + rotatedOpp.x, y: y + rotatedOpp.y };
    }
    
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const clientX = 'touches' in e.nativeEvent ? e.nativeEvent.touches[0].clientX : e.nativeEvent.clientX;
    const clientY = 'touches' in e.nativeEvent ? e.nativeEvent.touches[0].clientY : e.nativeEvent.clientY;

    interactionRef.current = {
      mode,
      originalObject: object,
      startPos: { x: clientX - rect.left, y: clientY - rect.top },
      startAngle: Math.atan2((clientY - rect.top) - (object.y * zoom + pan.y + (viewport.clientHeight - canvasSize.height * zoom) / 2), (clientX - rect.left) - (object.x * zoom + pan.x + (viewport.clientWidth - canvasSize.width * zoom) / 2)),
      oppositeCorner: opposite
    };
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    const canvasPos = getPointerPos(e);
    if (isDrawing && (activeTool === 'brush' || activeTool === 'eraser') && canvasPos) {
      const ctx = drawingCanvasRef.current?.getContext('2d');
      const last = lastPos;
      if (ctx && last) {
        ctx.globalAlpha = activeTool === 'brush' ? 0.6 : 1.0;
        ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.beginPath();
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize / zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(canvasPos.x, canvasPos.y);
        ctx.stroke();
        setLastPos(canvasPos);
        ctx.globalAlpha = 1.0;
      }
      return;
    }

    if (isDrawing && activeTool === 'lasso' && canvasPos) {
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (ctx) {
            const lastHistoryState = history[historyIndex];
            if (lastHistoryState?.drawing) ctx.putImageData(lastHistoryState.drawing, 0, 0);
            else ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.lineWidth = 1 / zoom;
            ctx.setLineDash([4 / zoom, 4 / zoom]);
            ctx.moveTo(lassoPointsRef.current[0].x, lassoPointsRef.current[0].y);
            lassoPointsRef.current.forEach(p => ctx.lineTo(p.x, p.y));

            if (lassoPointsRef.current.length > 0) {
              ctx.lineTo(canvasPos.x, canvasPos.y);
            }
            
            ctx.stroke();
            ctx.setLineDash([]);
        }
        return;
    }

    if (isPanning) {
        const viewport = canvasViewportRef.current;
        if(viewport) {
            const rect = viewport.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            setPan({ x: clientX - rect.left - panStartRef.current.x, y: clientY - rect.top - panStartRef.current.y });
        }
        return;
    }
    
    if (!interactionRef.current || !canvasPos) return;
    
    e.preventDefault();
    
    const { mode, originalObject, oppositeCorner, startPos } = interactionRef.current;
    const viewport = canvasViewportRef.current!;
    const rect = viewport.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const pos = {x: clientX - rect.left, y: clientY - rect.top};

    setObjects(prev => prev.map(p => {
        if (p.id !== originalObject.id) return p;
        const newP = { ...p };
        
        if (mode === 'move') {
            newP.x = originalObject.x + (pos.x - startPos.x) / zoom;
            newP.y = originalObject.y + (pos.y - startPos.y) / zoom;
        } else if (mode === 'rotate') {
            const currentAngle = Math.atan2(pos.y - (originalObject.y * zoom + pan.y + (viewport.clientHeight - canvasSize.height * zoom) / 2), pos.x - (originalObject.x * zoom + pan.x + (viewport.clientWidth - canvasSize.width * zoom) / 2));
            newP.rotation = originalObject.rotation + (currentAngle - interactionRef.current!.startAngle);
        } else if (mode?.includes('scale')) {
            const anchor = {
                x: oppositeCorner.x * zoom + pan.x + (viewport.clientWidth - canvasSize.width * zoom) / 2,
                y: oppositeCorner.y * zoom + pan.y + (viewport.clientHeight - canvasSize.height * zoom) / 2
            };
            const currentVec = { x: pos.x - anchor.x, y: pos.y - anchor.y };
            const originalCenterInViewport = {
                x: originalObject.x * zoom + pan.x + (viewport.clientWidth - canvasSize.width * zoom) / 2,
                y: originalObject.y * zoom + pan.y + (viewport.clientHeight - canvasSize.height * zoom) / 2
            };
            const originalVecFromAnchor = { x: (originalCenterInViewport.x - anchor.x) * 2, y: (originalCenterInViewport.y - anchor.y) * 2 };
            const originalMagSq = (originalVecFromAnchor.x ** 2) + (originalVecFromAnchor.y ** 2);
            if (originalMagSq === 0) return newP;
            const dotProduct = currentVec.x * originalVecFromAnchor.x + currentVec.y * originalVecFromAnchor.y;
            const scaleFactor = Math.abs(dotProduct / originalMagSq);
            const scaledWidth = Math.max(10, originalObject.width * scaleFactor);
            const scaledHeight = Math.max(10, originalObject.height * scaleFactor);
            
            if (newP.type === 'text') {
                (newP as PlacedText).fontSize = Math.max(8, (originalObject as PlacedText).fontSize * scaleFactor);
                const {width, height} = measureText(newP.content, newP.fontFamily, (newP as PlacedText).fontSize);
                newP.width = width;
                newP.height = height;
            } else {
                newP.width = scaledWidth;
                newP.height = scaledHeight;
            }
            const newCenterOffsetFromAnchor = {
                x: (originalCenterInViewport.x - anchor.x) * scaleFactor,
                y: (originalCenterInViewport.y - anchor.y) * scaleFactor
            };
            const newCenterInViewport = {
                x: anchor.x + newCenterOffsetFromAnchor.x,
                y: anchor.y + newCenterOffsetFromAnchor.y,
            };
            newP.x = (newCenterInViewport.x - pan.x - (viewport.clientWidth - canvasSize.width * zoom) / 2) / zoom;
            newP.y = (newCenterInViewport.y - pan.y - (viewport.clientHeight - canvasSize.height * zoom) / 2) / zoom;
        } else if (mode?.includes('stretch')) {
             const localPos = getTransformedCoords(canvasPos.x, canvasPos.y, originalObject);
             const side = mode.split('-')[1];
             switch(side) {
                case 't': { const newH = Math.max(10, originalObject.height - 2 * localPos.y); const offset = rotatePoint({x: 0, y: -(newH - originalObject.height)/2}, originalObject.rotation); newP.height = newH; newP.x = originalObject.x + offset.x; newP.y = originalObject.y + offset.y; break; }
                case 'b': { const newH = Math.max(10, originalObject.height + 2 * localPos.y); const offset = rotatePoint({x: 0, y: (newH - originalObject.height)/2}, originalObject.rotation); newP.height = newH; newP.x = originalObject.x + offset.x; newP.y = originalObject.y + offset.y; break; }
                case 'l': { const newW = Math.max(10, originalObject.width - 2 * localPos.x); const offset = rotatePoint({x: -(newW - originalObject.width)/2, y: 0}, originalObject.rotation); newP.width = newW; newP.x = originalObject.x + offset.x; newP.y = originalObject.y + offset.y; break; }
                case 'r': { const newW = Math.max(10, originalObject.width + 2 * localPos.x); const offset = rotatePoint({x: (newW - originalObject.width)/2, y: 0}, originalObject.rotation); newP.width = newW; newP.x = originalObject.x + offset.x; newP.y = originalObject.y + offset.y; break; }
             }
        }
        return newP;
    }));
  }, [isDrawing, activeTool, brushColor, brushSize, lastPos, isPanning, pan, zoom, canvasSize, history, historyIndex, objects]);

  const handleGlobalMouseUp = useCallback(() => {
    if (isDrawing && (activeTool === 'brush' || activeTool === 'eraser')) {
        pushState(objects);
        setIsDrawing(false);
    }
    
    if (interactionRef.current) {
        pushState(objects);
    }
    
    setIsPanning(false);
    setLastPos(null);
    interactionRef.current = null;
  }, [isDrawing, activeTool, pushState, objects]);

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchmove', handleGlobalMouseMove);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalMouseMove);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);
  
  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const pos = getPointerPos(e.nativeEvent);
      const assetId = e.dataTransfer.getData("assetId");
      const asset = assets.find(a => a.id === assetId);
      if(pos && asset) {
        const img = asset.processedImage || asset.image;
        const maxDim = 200;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
            if (w > h) { h = h * (maxDim / w); w = maxDim; } 
            else { w = w * (maxDim / h); h = maxDim; }
        }

        const placed: PlacedImage = { id: nanoid(), type: 'image', assetId: asset.id, x: pos.x, y: pos.y, width: w, height: h, rotation: 0 }
        const newObjects = [...objects, placed];
        setObjects(newObjects);
        pushState(newObjects);
        setSelectedObjectId(placed.id);
        setActiveTool('transform');
      }
  }

  const handleSave = () => {
    const bgImage = backgroundRef.current;
    if (!bgImage) return;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = bgImage.naturalWidth;
    finalCanvas.height = bgImage.naturalHeight;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;
    
    const scaleX = bgImage.naturalWidth / canvasSize.width;
    const scaleY = bgImage.naturalHeight / canvasSize.height;

    ctx.drawImage(bgImage, 0, 0);

    objects.forEach(obj => {
        const finalX = obj.x * scaleX;
        const finalY = obj.y * scaleY;
        ctx.save();
        ctx.translate(finalX, finalY);
        ctx.rotate(obj.rotation);

        if (obj.type === 'image') {
            const asset = assets.find(a => a.id === (obj as PlacedImage).assetId);
            if(!asset) return;
            const imageToDraw = asset.processedImage || asset.image;
            const finalW = obj.width * scaleX;
            const finalH = obj.height * scaleY;
            ctx.drawImage(imageToDraw, -finalW/2, -finalH/2, finalW, finalH);
        } else if (obj.type === 'text') {
            const textObj = obj as PlacedText;
            const finalFontSize = textObj.fontSize * Math.min(scaleX, scaleY);
            ctx.font = `${finalFontSize}px ${textObj.fontFamily}`;
            ctx.fillStyle = textObj.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(textObj.content, 0, 0);
        } else if (obj.type === 'marker') {
            const marker = obj as PlacedMarker;
            const radius = (marker.width / 2) * scaleX;
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2 * scaleX;
            ctx.stroke();

            ctx.fillStyle = 'white';
            ctx.font = `bold ${radius * 1.2}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(marker.number), 0, 1 * scaleY);
        }
        ctx.restore();
    });

    if(drawingCanvasRef.current) {
        ctx.drawImage(drawingCanvasRef.current, 0, 0, finalCanvas.width, finalCanvas.height);
    }
    
    onSave(finalCanvas.toDataURL('image/jpeg'));
    onClose();
  };
  
    const handleClose = () => {
        if (drawingCanvasRef.current) {
            const canvas = drawingCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
                const isDirty = pixelBuffer.some(color => color !== 0);
                if (isDirty) {
                    onDrawingChange(canvas.toDataURL('image/png'));
                } else {
                    onDrawingChange(null);
                }
            }
        }
        onClose();
    };


    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (isDrawing || interactionRef.current) return;
        const newZoom = zoom - e.deltaY * 0.005;
        const clampedZoom = Math.max(0.5, Math.min(newZoom, 5));
        
        const viewport = canvasViewportRef.current;
        if (viewport) {
            const rect = viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const newPanX = mouseX - (mouseX - pan.x) * (clampedZoom / zoom);
            const newPanY = mouseY - (mouseY - pan.y) * (clampedZoom / zoom);
            
            if (clampedZoom === 1) {
                setPan({ x: 0, y: 0 });
            } else {
                setPan({ x: newPanX, y: newPanY });
            }
        }
        
        setZoom(clampedZoom);
    };

    const getCursor = () => {
        if (isPanning) return 'grabbing';
        switch (activeTool) {
            case 'brush':
            case 'eraser':
            case 'lasso':
                return 'crosshair';
            case 'text':
                return 'text';
            case 'marker':
                return 'copy';
            case 'transform':
                return 'grab';
            default:
                return 'default';
        }
    };


  const toolButtonClass = (t: string) => `p-2.5 rounded-md ${activeTool === t ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'} transition-colors`;
  const historyButtonClass = (disabled: boolean) => `p-2.5 rounded-md ${disabled ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'} transition-colors`;
  const tooltipClass = `absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-xs bg-gray-900 text-white text-xs rounded py-1 px-2 pointer-events-none transition-opacity duration-200 ${showInitialTooltips ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`;
  const selectedObject = objects.find(p => p.id === selectedObjectId);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 backdrop-blur-sm p-4" 
      ref={modalContentRef}
      onClick={() => showInitialTooltips && setShowInitialTooltips(false)}
    >
       <div className="absolute top-4 left-1/2 -translate-x-1/2 w-11/12 max-w-5xl bg-gray-900/70 p-2 rounded-xl flex flex-wrap items-center justify-center gap-x-3 gap-y-2 backdrop-blur-sm border border-gray-700 shadow-lg z-20">
        <div className="flex items-center space-x-1">
          <div className="relative group"><button onClick={() => handleToolChange('transform')} className={toolButtonClass('transform')} title={t('tooltip.transform')}><CursorArrowRaysIcon className="w-6 h-6"/></button><div className={tooltipClass}><i>{t('tooltip.transform')}</i></div></div>
          <div className="relative group"><button onClick={() => handleToolChange('brush')} className={toolButtonClass('brush')} title={t('tooltip.brush')}><PaintBrushIcon className="w-6 h-6"/></button><div className={tooltipClass}><i>{t('tooltip.brush')}</i></div></div>
          <div className="relative group"><button onClick={() => handleToolChange('eraser')} className={toolButtonClass('eraser')} title={t('tooltip.eraser')}><EraserIcon className="w-6 h-6"/></button><div className={tooltipClass}><i>{t('tooltip.eraser')}</i></div></div>
          <div className="relative group"><button onClick={() => handleToolChange('lasso')} className={toolButtonClass('lasso')} title={t('tooltip.lasso')}><LassoIcon className="w-6 h-6"/></button><div className={tooltipClass}><i>{t('tooltip.lasso')}</i></div></div>
          <div className="relative group"><button onClick={() => handleToolChange('text')} className={toolButtonClass('text')} title={t('tooltip.addText')}><TypeIcon className="w-6 h-6"/></button><div className={tooltipClass}><i>{t('tooltip.addText')}</i></div></div>
          <div className="relative group"><button onClick={() => handleToolChange('marker')} className={toolButtonClass('marker')} title={t('tooltip.marker')}><MapPinIcon className="w-6 h-6"/></button><div className={tooltipClass}><i>{t('tooltip.marker')}</i></div></div>
        </div>
        <div className="h-8 w-px bg-gray-600 hidden sm:block"></div>
        <div className="flex items-center space-x-1">
            <div className="relative group"><button onClick={undo} disabled={historyIndex <= 0} className={historyButtonClass(historyIndex <= 0)} title={t('tooltip.undo')}><UndoIcon className="w-6 h-6"/></button><div className={tooltipClass}><i>{t('tooltip.undo')}</i></div></div>
            <div className="relative group"><button onClick={redo} disabled={historyIndex >= history.length - 1} className={historyButtonClass(historyIndex >= history.length - 1)} title={t('tooltip.redo')}><RedoIcon className="w-6 h-6"/></button><div className={tooltipClass}><i>{t('tooltip.redo')}</i></div></div>
        </div>
        <div className="h-8 w-px bg-gray-600 hidden sm:block"></div>
        
        {(activeTool === 'brush' || activeTool === 'eraser') && (
          <div className="flex items-center space-x-2">
            <div className="relative group">
                <label title={t('tooltip.brushColor')} className="w-8 h-8 rounded-md cursor-pointer border-2 border-gray-600 overflow-hidden" style={{backgroundColor: brushColor}}>
                    <input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)} className="opacity-0 w-full h-full cursor-pointer" disabled={activeTool === 'eraser'}/>
                </label>
                <div className={tooltipClass}><i>{t('tooltip.brushColor')}</i></div>
            </div>
            <div className="relative group">
                <div className="flex items-center space-x-2 text-white">
                    <input type="range" min="2" max="80" step="1" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-24 cursor-pointer"/>
                    <span className="text-sm w-6 text-center">{brushSize}</span>
                </div>
                <div className={tooltipClass}><i>{t('tooltip.brushSize')}</i></div>
            </div>
          </div>
        )}
        {activeTool === 'text' && (
          <div className="flex items-center space-x-2">
            <div className="relative group">
              <select value={textFont} onChange={e => setTextFont(e.target.value)} className={`bg-gray-700 text-white rounded-md p-2 border border-gray-600 ${FONTS.find(f => f.name === textFont)?.class}`}>
                  {FONTS.map(font => <option key={font.name} value={font.name} className={font.class}>{font.name}</option>)}
              </select>
              <div className={tooltipClass}><i>{t('tooltip.fontFamily')}</i></div>
            </div>
            <div className="relative group">
              <input type="number" value={textSize} onChange={e => setTextSize(parseInt(e.target.value))} className="w-20 bg-gray-700 text-white p-2 rounded-md border border-gray-600"/>
              <div className={tooltipClass}><i>{t('tooltip.fontSize')}</i></div>
            </div>
            <div className="relative group">
              <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-10 h-10 p-1 bg-gray-700 rounded-md border border-gray-600"/>
              <div className={tooltipClass}><i>{t('tooltip.fontColor')}</i></div>
            </div>
          </div>
        )}
      </div>

      {modalError && <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-600/90 text-white text-sm rounded-lg py-2 px-4 z-30 shadow-lg">{modalError}</div>}

       <div className={`absolute top-24 left-1/2 -translate-x-1/2 bg-blue-600/80 text-white text-sm rounded-lg py-2 px-4 pointer-events-none transition-opacity duration-300 z-20 ${showInitialTooltips ? 'opacity-100' : 'opacity-0'}`}>
          <i>{t('tooltip.initialHint')}</i>
      </div>
      
      <div className="absolute top-4 right-4 flex space-x-2 z-20">
        <div className="relative group">
          <button onClick={handleSave} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-md hover:bg-blue-700 transition-colors">
            {t('inpainting.complete')}
          </button>
          <div className={tooltipClass}><i>{t('tooltip.complete')}</i></div>
        </div>
        <div className="relative group">
          <button onClick={handleClose} className="bg-gray-700 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors">
            &times;
          </button>
          <div className={`${tooltipClass} right-0 left-auto translate-x-0`}><i>{t('tooltip.close')}</i></div>
        </div>
      </div>

      <div className="flex w-full h-full pt-20">
        <div 
            ref={canvasViewportRef}
            className="relative flex-grow flex items-center justify-center h-full overflow-hidden"
            onWheel={handleWheel}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
        >
            <div 
                className="relative"
                style={{
                    width: canvasSize.width,
                    height: canvasSize.height,
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                }}
            >
                {imageSrc && (
                    <div className="relative w-full h-full" onDoubleClick={handleDoubleClick}>
                         <img
                            key={imageSrc}
                            ref={backgroundRef}
                            src={imageSrc}
                            alt="Inpainting background"
                            onLoad={initializeCanvases}
                            className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none select-none"
                        />
                        <canvas ref={objectCanvasRef} width={canvasSize.width} height={canvasSize.height} className="absolute top-0 left-0 pointer-events-none" />
                        <canvas
                            ref={drawingCanvasRef}
                            width={canvasSize.width}
                            height={canvasSize.height}
                            className="absolute top-0 left-0"
                            style={{ cursor: getCursor() }}
                            onMouseDown={handleCanvasMouseDown}
                            onTouchStart={handleCanvasMouseDown}
                        />
                        {selectedObject && activeTool === 'transform' && <TransformControls selectedObject={selectedObject} onTransformMouseDown={handleTransformMouseDown} onDelete={handleDeleteObject} onDuplicate={handleDuplicateObject} onRemoveBackground={handleRemoveBackground} onMagicMix={handleMagicMix} isMixing={isMixing === selectedObject.id} showTooltips={showInitialTooltips} zoom={zoom} />}
                        {editingText && <TextEditor editingText={editingText} textInputRef={textInputRef} onFinish={finishEditingText} />}
                    </div>
                )}
            </div>
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-900/70 p-2 rounded-lg backdrop-blur-sm z-20">
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-2 text-white rounded-md hover:bg-gray-700"><MagnifyingGlassMinusIcon className="w-5 h-5"/></button>
                <span className="text-white text-sm font-semibold w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
                <button onClick={() => setZoom(z => Math.min(5, z + 0.2))} className="p-2 text-white rounded-md hover:bg-gray-700"><MagnifyingGlassPlusIcon className="w-5 h-5"/></button>
            </div>
        </div>

        <div className="w-72 flex-shrink-0 h-full bg-gray-900/70 p-3 rounded-lg ml-4 backdrop-blur-sm border border-gray-700 flex flex-col">
            <h3 className="text-white font-semibold mb-2">{t('inpainting.tools.assets')}</h3>
            <div className="grid grid-cols-2 gap-3 flex-grow overflow-y-auto pr-1 no-scrollbar">
                {assets.map(asset => (
                    <div key={asset.id} className="relative group aspect-square bg-gray-800 rounded cursor-grab" draggable onDragStart={e => e.dataTransfer.setData('assetId', asset.id)}>
                        <div className="relative group/delete">
                          <button onClick={() => handleDeleteAsset(asset.id)} title={t('inpainting.asset.deleteAsset')} className="absolute top-1 right-1 bg-red-600/80 text-white rounded-full p-0.5 shadow-md hover:bg-red-700 transition-transform hover:scale-110 z-10 opacity-0 group-hover/delete:opacity-100">
                              <XMarkIcon className="w-3 h-3" />
                          </button>
                          <div className={`absolute right-full mr-2 top-1/2 -translate-y-1/2 w-max max-w-xs bg-gray-900 text-white text-xs rounded py-1 px-2 pointer-events-none transition-opacity duration-200 opacity-0 group-hover/delete:opacity-100`}>
                            <i>{t('tooltip.deleteAsset')}</i>
                          </div>
                        </div>
                        <img src={asset.processedSrc || asset.originalSrc} className="w-full h-full object-contain p-1 pointer-events-none" alt="asset"/>
                        <div className={`absolute inset-0 flex items-center justify-center bg-black/60 text-white text-xs text-center p-1 pointer-events-none transition-opacity duration-200 ${showInitialTooltips ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <i>{t('tooltip.dragAsset')}</i>
                        </div>
                        {asset.isLoading && <div className="absolute inset-0 bg-black/70 flex items-center justify-center"><LoadingSpinner className="w-6 h-6 text-white"/></div>}
                    </div>
                ))}
                 {assets.length < 6 && (
                    <div className="relative group">
                      <button onClick={() => assetInputRef.current?.click()} className="aspect-square bg-gray-800 rounded border-2 border-dashed border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-400 flex flex-col items-center justify-center transition-colors">
                          <PhotoIcon className="w-8 h-8"/>
                          <span className="text-xs mt-1">{t('inpainting.tools.addImage')}</span>
                      </button>
                      <div className={tooltipClass}><i>{t('tooltip.addImage')}</i></div>
                    </div>
                )}
            </div>
             <input type="file" accept="image/*" ref={assetInputRef} onChange={handleFileChange} className="hidden" />
        </div>
      </div>
    </div>
  );
};

const TransformControls: React.FC<{
  selectedObject: CanvasObject;
  onTransformMouseDown: (e: React.MouseEvent | React.TouchEvent, mode: TransformMode, object: CanvasObject) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemoveBackground: (id: string) => void;
  onMagicMix: (id: string) => void;
  isMixing: boolean;
  showTooltips: boolean;
  zoom: number;
}> = ({ selectedObject, onTransformMouseDown, onDelete, onDuplicate, onRemoveBackground, onMagicMix, isMixing, showTooltips, zoom }) => {
    const { t } = useTranslation();
    const { id, x, y, width, height, rotation, type } = selectedObject;

    const controlBoxStyle: React.CSSProperties = {
        position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`,
        transform: `translate(-50%, -50%) rotate(${rotation}rad)`, pointerEvents: 'none',
    };
    
    const handleScale = 1 / zoom;
    
    const handleClass = "absolute bg-white border-2 border-blue-500 rounded-sm w-3 h-3 -m-1.5 pointer-events-auto z-10";
    const actionButtonClass = "p-2.5 bg-gray-800 text-white rounded-full shadow-lg hover:bg-blue-600 hover:scale-110 transition-all";
    const tooltipClass = `absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-xs bg-gray-900 text-white text-xs rounded py-1 px-2 pointer-events-none transition-opacity duration-200 ${showTooltips ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`;

    return (
        <div style={controlBoxStyle}>
            <div className="absolute inset-0 cursor-move pointer-events-auto" onMouseDown={(e) => onTransformMouseDown(e, 'move', selectedObject)} />
            <div className="absolute inset-0 border-2 border-dashed border-blue-500 pointer-events-none" style={{ transform: `scale(${handleScale})` }} />
            {isMixing && <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-md pointer-events-auto"><LoadingSpinner className="w-8 h-8 text-white"/></div>}
            <div onMouseDown={(e) => onTransformMouseDown(e, 'scale-tl', selectedObject)} className={`${handleClass} top-0 left-0 cursor-nwse-resize`} style={{ transform: `scale(${handleScale})` }} />
            <div onMouseDown={(e) => onTransformMouseDown(e, 'scale-tr', selectedObject)} className={`${handleClass} top-0 right-0 cursor-nesw-resize`} style={{ transform: `scale(${handleScale})` }} />
            <div onMouseDown={(e) => onTransformMouseDown(e, 'scale-bl', selectedObject)} className={`${handleClass} bottom-0 left-0 cursor-nesw-resize`} style={{ transform: `scale(${handleScale})` }} />
            <div onMouseDown={(e) => onTransformMouseDown(e, 'scale-br', selectedObject)} className={`${handleClass} bottom-0 right-0 cursor-nwse-resize`} style={{ transform: `scale(${handleScale})` }} />
            {type === 'image' && <>
                <div onMouseDown={(e) => onTransformMouseDown(e, 'stretch-t', selectedObject)} className={`${handleClass} top-0 left-1/2 -translate-x-1/2 cursor-ns-resize`} style={{ transform: `scale(${handleScale})` }} />
                <div onMouseDown={(e) => onTransformMouseDown(e, 'stretch-b', selectedObject)} className={`${handleClass} bottom-0 left-1/2 -translate-x-1/2 cursor-ns-resize`} style={{ transform: `scale(${handleScale})` }} />
                <div onMouseDown={(e) => onTransformMouseDown(e, 'stretch-l', selectedObject)} className={`${handleClass} top-1/2 -translate-y-1/2 left-0 cursor-ew-resize`} style={{ transform: `scale(${handleScale})` }} />
                <div onMouseDown={(e) => onTransformMouseDown(e, 'stretch-r', selectedObject)} className={`${handleClass} top-1/2 -translate-y-1/2 right-0 cursor-ew-resize`} style={{ transform: `scale(${handleScale})` }} />
            </>}
            <div 
                className="absolute top-full mt-4 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-gray-900/80 backdrop-blur-sm p-2 rounded-lg shadow-lg pointer-events-auto transition-opacity duration-200 z-20"
                style={{ transform: `scale(${handleScale})`, transformOrigin: 'top center' }}
            >
                <div className="relative group">
                  <button onClick={() => onDelete(id)} title={t('tooltip.transform.delete')} className={actionButtonClass}><TrashIcon className="w-5 h-5" /></button>
                  <div className={tooltipClass}><i>{t('tooltip.transform.delete')}</i></div>
                </div>
                <div className="relative group">
                  <button onClick={() => onDuplicate(id)} title={t('tooltip.transform.duplicate')} className={actionButtonClass}><DocumentDuplicateIcon className="w-5 h-5" /></button>
                  <div className={tooltipClass}><i>{t('tooltip.transform.duplicate')}</i></div>
                </div>
                {type === 'image' && 
                  <div className="relative group">
                    <button onClick={() => onMagicMix(id)} title={t('tooltip.transform.magicMix')} className={actionButtonClass}><WandIcon className="w-5 h-5" /></button>
                    <div className={tooltipClass}><i>{t('tooltip.transform.magicMix')}</i></div>
                  </div>
                }
                {type === 'image' && 
                  <div className="relative group">
                    <button onClick={() => onRemoveBackground(id)} title={t('tooltip.transform.removeBg')} className={actionButtonClass}><EraserIcon className="w-5 h-5" /></button>
                    <div className={tooltipClass}><i>{t('tooltip.transform.removeBg')}</i></div>
                  </div>
                }
                <div className="relative group">
                  <button onMouseDown={(e) => onTransformMouseDown(e, 'rotate', selectedObject)} title={t('tooltip.transform.rotate')} className={`${actionButtonClass} cursor-grab active:cursor-grabbing`}><ArrowPathIcon className="w-5 h-5" /></button>
                  <div className={tooltipClass}><i>{t('tooltip.transform.rotate')}</i></div>
                </div>
            </div>
        </div>
    )
}

const TextEditor: React.FC<{
  editingText: { object: PlacedText };
  textInputRef: React.RefObject<HTMLTextAreaElement>;
  onFinish: () => void;
}> = ({ editingText, textInputRef, onFinish }) => {
    const { object } = editingText;
    const { x, y, width, height, rotation, content, fontFamily, fontSize, color } = object;

    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: `${width + 20}px`,
        height: `${height + 20}px`,
        transform: `translate(-50%, -50%) rotate(${rotation}rad)`,
        fontFamily: fontFamily,
        fontSize: `${fontSize}px`,
        color: color,
        lineHeight: 1,
        textAlign: 'center',
        background: 'rgba(0,0,0,0.5)',
        border: '1px dashed #fff',
        resize: 'none',
        outline: 'none',
        overflow: 'hidden',
    };

    return <textarea ref={textInputRef} defaultValue={content} onBlur={onFinish} style={style} />;
};

export default InpaintingModal;