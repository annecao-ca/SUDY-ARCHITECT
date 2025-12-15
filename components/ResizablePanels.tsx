import React, { useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface ResizablePanelsProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  initialLeftWidth?: number; // percentage
}

const ResizablePanels: React.FC<ResizablePanelsProps> = ({ leftPanel, rightPanel, initialLeftWidth = 33.33 }) => {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const isResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const handlePointerDown = (e: React.PointerEvent) => {
    isResizing.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (isResizing.current) {
        isResizing.current = false;
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch(err) {}
    }
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isResizing.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftWidth(Math.max(20, Math.min(80, newLeftWidth)));
  }, []);
  
  const handleTapCycle = useCallback(() => {
    if (window.innerWidth < 1024) {
        const cyclePoints = [25, 50, 75];
        const currentPointIndex = cyclePoints.findIndex(p => Math.abs(p - leftWidth) < 5);
        const nextIndex = (currentPointIndex + 1) % cyclePoints.length;
        setLeftWidth(cyclePoints[nextIndex] || 50);
    }
  }, [leftWidth]);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    }
  }, [handlePointerMove, handlePointerUp]);

  return (
    <div ref={containerRef} className="flex flex-col lg:flex-row w-full h-full p-4 md:p-8 gap-4 sm:gap-8">
      <div className="relative h-1/2 lg:h-full lg:w-auto overflow-hidden" style={{ flexBasis: `${leftWidth}%` }}>
        {leftPanel}
      </div>
      
      <div
        className="flex-shrink-0 w-full lg:w-3 h-3 lg:h-full cursor-row-resize lg:cursor-col-resize bg-transparent flex items-center justify-center group z-10 -mx-4 lg:mx-0 lg:-my-8"
        onPointerDown={handlePointerDown}
        onClick={handleTapCycle}
        title={t('resizable.title')}
      >
        <div className="w-8 h-8 lg:w-3 lg:h-12 rounded-full flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
            <div className="flex lg:flex-col gap-0.5">
                <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
            </div>
        </div>
      </div>

      <div className="relative flex-grow h-1/2 lg:h-full overflow-hidden">
        {rightPanel}
      </div>
    </div>
  );
};

export default ResizablePanels;