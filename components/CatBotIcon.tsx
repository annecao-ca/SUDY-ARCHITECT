import React, { useEffect, useRef } from 'react';

interface CatBotIconProps {
    state: 'idle' | 'thinking' | 'talking';
    size?: 'small' | 'large';
}

const CatBotIcon: React.FC<CatBotIconProps> = ({ state, size = 'large' }) => {
    const aiHeadRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const aiHead = aiHeadRef.current;
        if (!aiHead) return;

        // Start with appear class for the floating animation
        aiHead.classList.add('appear');
        
        // Remove previous states
        aiHead.classList.remove('thinking', 'talking');

        // Add the new state if it's not idle
        if (state === 'thinking' || state === 'talking') {
            aiHead.classList.add(state);
        }
        
    }, [state]);
    
    // CSS adapted from user prompt, with renamed variables to avoid conflicts and scaling for different sizes.
    const styles = `
        :root {
            --cat-bg-color: #f7fafc;
            --cat-fill-color: #1A202C;
            --cat-outline-color: #1A202C; /* For pupils */
            --cat-think-glow: rgba(59, 130, 246, 0.7);
            --cat-talk-color: #f56565;
        }

        .dark {
            --cat-bg-color: #2D3748;
            --cat-fill-color: #1A202C; /* Cat remains black */
            --cat-outline-color: #E2E8F0; /* Outline and pupils become light */
            --cat-think-glow: rgba(59, 130, 246, 0.6);
            --cat-talk-color: #f87171;
        }

        .cat-bot-icon-container {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
        }

        .cat-silhouette-wrapper {
            transition: filter 0.3s ease;
            filter: none;
        }
        .dark .cat-silhouette-wrapper {
            filter: drop-shadow(1.5px 0 0 var(--cat-outline-color))
                    drop-shadow(-1.5px 0 0 var(--cat-outline-color))
                    drop-shadow(0 1.5px 0 var(--cat-outline-color))
                    drop-shadow(0 -1.5px 0 var(--cat-outline-color));
        }

        .ai-head {
            background-color: var(--cat-fill-color);
            border-radius: 50%;
            position: relative;
            transform: scale(1);
            transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .ear {
            background-color: var(--cat-fill-color);
            position: absolute;
            clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
            transition: transform 0.3s ease-in-out;
        }
        
        .eye {
            background-color: var(--cat-bg-color);
            position: absolute; border-radius: 50%;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex; justify-content: center; align-items: center;
            overflow: hidden;
        }
        .eye::after {
            content: '';
            background-color: var(--cat-outline-color);
            border-radius: 2px;
            transition: all 0.3s ease;
        }
        
        .mouth-wave {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0;
            transition: opacity 0.2s ease;
            overflow: visible;
        }
        .mouth-wave path { stroke: var(--cat-talk-color); stroke-linecap: round; fill: none; }

        /* Animations */
        .ai-head.appear {
            animation: cat-idle-float 3s infinite ease-in-out;
        }
        @keyframes cat-idle-float { 50% { transform: translateY(-3px); } }
        
        .ai-head.thinking {
            animation-name: cat-idle-float, cat-think-glow;
            animation-duration: 3s, 2s;
            animation-iteration-count: infinite, infinite;
        }
        
        .ai-head.thinking .ear.left { transform: rotate(-5deg); }
        .ai-head.thinking .ear.right { transform: rotate(5deg); }
        
        @keyframes cat-think-glow { 50% { box-shadow: 0 0 15px 3px var(--cat-think-glow); } }
        
        .ai-head.talking { animation: cat-talk-bob 0.5s infinite ease-in-out; }
        .ai-head.talking .eye { transform: scale(1.05); }
        .ai-head.talking .mouth-wave { opacity: 1; }
        .ai-head.talking .mouth-wave path { animation: cat-mouth-wave-anim 0.5s infinite ease-in-out; }
        
        @keyframes cat-talk-bob { 50% { transform: translateY(-4px) scale(1.02); } }
        
        /* Large Size (for 48px container) */
        .size-large .ai-head { width: 40px; height: 40px; }
        .size-large .ear { width: 18.5px; height: 24px; top: -8.5px; }
        .size-large .ear.left { left: 2.2px; transform: rotate(-18deg); transform-origin: bottom left; }
        .size-large .ear.right { right: 2.2px; transform: rotate(18deg); transform-origin: bottom right; }
        .size-large .eye { width: 9px; height: 9px; top: 13px; }
        .size-large .eye.left { left: 6.8px; } .size-large .eye.right { right: 6.8px; }
        .size-large .eye::after { width: 1.1px; height: 70%; }
        .size-large .mouth-wave { bottom: 5.1px; width: 11.4px; height: 5.7px; }
        .size-large .mouth-wave path { stroke-width: 1.1; }
        .size-large.ai-head.thinking .eye { height: 1.1px; top: 17px; }
        .size-large.ai-head.thinking .eye::after { height: 100%; width: 80%; }
        @keyframes cat-mouth-wave-anim {
            0%, 100% { d: path("M 0 2.8 Q 2.8 4.2 5.7 2.8 T 11.4 2.8"); }
            50% { d: path("M 0 2.8 Q 2.8 0 5.7 2.8 T 11.4 2.8"); }
        }

        /* Small Size (for 28px container) */
        .size-small .ai-head { width: 22px; height: 22px; }
        .size-small .ear { width: 10px; height: 13px; top: -5px; }
        .size-small .ear.left { left: 1.2px; transform: rotate(-18deg); transform-origin: bottom left; }
        .size-small .ear.right { right: 1.2px; transform: rotate(18deg); transform-origin: bottom right; }
        .size-small .eye { width: 5px; height: 5px; top: 7px; }
        .size-small .eye.left { left: 3.8px; } .size-small .eye.right { right: 3.8px; }
        .size-small .eye::after { width: 1px; height: 70%; }
        .size-small .mouth-wave { bottom: 2.8px; width: 6.2px; height: 3.1px; }
        .size-small .mouth-wave path { stroke-width: 1; }
        .size-small.ai-head.thinking .eye { height: 1px; top: 9.5px; }
        .size-small.ai-head.thinking .eye::after { height: 100%; width: 80%; }
        @keyframes cat-mouth-wave-anim {
            0%, 100% { d: path("M 0 1.5 Q 1.5 2.5 3.1 1.5 T 6.2 1.5"); }
            50% { d: path("M 0 1.5 Q 1.5 0 3.1 1.5 T 6.2 1.5"); }
        }
    `;

    return (
        <>
            <style>{styles}</style>
            <div className={`cat-bot-icon-container size-${size}`}>
                <div className="cat-silhouette-wrapper">
                    <div className={`ai-head appear size-${size} ${state}`} ref={aiHeadRef}>
                        <div className="ear left"></div>
                        <div className="ear right"></div>
                        <div className="eye left"></div>
                        <div className="eye right"></div>
                        <svg className="mouth-wave" viewBox={size === 'large' ? "0 0 11.4 5.7" : "0 0 6.2 3.1"}>
                            <path d={size === 'large' ? "M 0 2.8 Q 2.8 4.2 5.7 2.8 T 11.4 2.8" : "M 0 1.5 Q 1.5 2.5 3.1 1.5 T 6.2 1.5"} />
                        </svg>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CatBotIcon;
