import React, { useEffect, useRef } from 'react';

interface CatLoadingAnimationProps {
  text?: string;
}

const CatLoadingAnimation: React.FC<CatLoadingAnimationProps> = ({ text }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pupilsRef = useRef<NodeListOf<HTMLDivElement> | null>(null);
  const mousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (containerRef.current) {
      pupilsRef.current = containerRef.current.querySelectorAll('.pupil');
    }

    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;

    const updateEyes = () => {
      if (pupilsRef.current) {
        pupilsRef.current.forEach(pupil => {
          const eyeSocket = pupil.parentElement;
          if (!eyeSocket) return;

          const eyeSocketRect = eyeSocket.getBoundingClientRect();
          const eyeCenterX = eyeSocketRect.left + eyeSocketRect.width / 2;
          const eyeCenterY = eyeSocketRect.top + eyeSocketRect.height / 2;
          const deltaX = mousePosition.current.x - eyeCenterX;
          const deltaY = mousePosition.current.y - eyeCenterY;
          const angle = Math.atan2(deltaY, deltaX);
          
          const isBigEye = eyeSocket.parentElement?.parentElement?.classList.contains('yellow-char');
          const maxMove = isBigEye ? 8 : 5;

          const moveDistance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), maxMove);
          const moveX = Math.cos(angle) * moveDistance;
          const moveY = Math.sin(angle) * moveDistance;
          
          (pupil as HTMLElement).style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
      }
      animationFrameId = requestAnimationFrame(updateEyes);
    };

    updateEyes();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const customStyles = `
    .character-container {
        position: relative;
        width: 300px;
        height: 300px;
    }

    .character {
        position: absolute;
        bottom: 0;
    }

    .orange-char {
        width: 200px; height: 100px; background-color: #f36f29;
        border-radius: 100px 100px 0 0; left: 0; z-index: 4;
    }
    .purple-char {
        width: 100px; height: 220px; background-color: #662d91;
        left: 80px; z-index: 3;
    }
    .black-char {
        width: 65px; height: 160px; background-color: #231f20;
        left: 170px; z-index: 2;
    }
    .yellow-char {
        width: 70px; height: 120px; background-color: #fbb03b;
        border-radius: 35px 35px 0 0; left: 225px; z-index: 1;
        animation: gentleBounce 2s ease-in-out infinite;
    }

    .face {
        display: flex; justify-content: center; align-items: center;
        gap: 15px; width: 100%; height: 100%;
    }
    .purple-char .face, .black-char .face, .yellow-char .face {
        align-items: flex-start; padding-top: 20px;
    }
    .black-char .face { padding-top: 25px; }
    .yellow-char .face { padding-top: 40px; }
    
    .orange-char .face { 
        position: relative; transform: translateY(-10px);
    }
    .orange-char .mouth {
        position: absolute; width: 25px; height: 12px;
        border-bottom: 4px solid #231f20; border-radius: 0 0 20px 20px;
        bottom: 25px; left: 50%; transform: translateX(-50%);
    }

    .eye-socket {
        width: 20px; height: 20px; background-color: white; border-radius: 50%;
        display: flex; justify-content: center; align-items: center;
        border: 1px solid #231f20; box-sizing: border-box;
    }
    .pupil {
        width: 8px; height: 8px; background-color: #231f20; border-radius: 50%;
        transition: transform 0.1s linear;
    }
    
    .orange-char .eye-socket { width: 14px; height: 14px; }
    .orange-char .pupil { width: 7px; height: 7px; }

    .yellow-char .eye-socket {
        width: 32px;
        height: 32px;
    }
    .yellow-char .pupil {
        width: 14px;
        height: 14px;
    }

    @keyframes gentleBounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
    }
  `;

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <style>{customStyles}</style>
      <div ref={containerRef} className="character-container">
        <div className="character orange-char">
          <div className="face">
            <div className="eye-socket"><div className="pupil"></div></div>
            <div className="eye-socket"><div className="pupil"></div></div>
            <div className="mouth"></div>
          </div>
        </div>
        <div className="character purple-char">
          <div className="face">
            <div className="eye-socket"><div className="pupil"></div></div>
            <div className="eye-socket"><div className="pupil"></div></div>
          </div>
        </div>
        <div className="character black-char">
          <div className="face">
            <div className="eye-socket"><div className="pupil"></div></div>
            <div className="eye-socket"><div className="pupil"></div></div>
          </div>
        </div>
        <div className="character yellow-char">
          <div className="face">
            <div className="eye-socket"><div className="pupil"></div></div>
          </div>
        </div>
      </div>
       <div className="text-center mt-8 text-xl font-semibold text-gray-600 dark:text-gray-300 animate-pulse">
        <p>{text || 'SUDY đang suy nghĩ, bạn chờ xíu nhé'}</p>
      </div>
    </div>
  );
};

export default CatLoadingAnimation;
