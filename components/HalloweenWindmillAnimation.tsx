import React, { useEffect, useRef } from 'react';

// Declare the Sketchfab global variable to satisfy TypeScript
declare const Sketchfab: any;

const HalloweenWindmillAnimation: React.FC = () => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const frame = iframeRef.current;
        if (!frame || typeof Sketchfab === 'undefined') {
            return;
        }

        const uid = '376b0d57f63d4d66967d02b805e806fb';
        const client = new Sketchfab(frame);

        client.init(uid, {
            success: (api: any) => {
                api.start();
                api.addEventListener('viewerready', () => {
                    const cameraPosition = [0, 0.1, 1.2];
                    const cameraTarget = [0, 0.1, 0];
                    api.setCameraLookAt(cameraPosition, cameraTarget, 0);
                });
            },
            error: () => {
                console.error('Sketchfab viewer error');
            },
            autospin: 0.2,
            transparent: 1,
            ui_hint: 0,
            ui_infos: 0,
            ui_controls: 0,
            ui_fullscreen: 0,
        });

    }, []); // Empty dependency array ensures this runs only once on mount

    const customStyles = `
        .circle-mask-container {
            width: 90vmin;
            aspect-ratio: 1 / 1;
            max-width: 500px;
            border-radius: 50%;
            overflow: hidden;
            position: relative;
            margin-bottom: 30px;
        }

        .circle-mask-container iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: 0;
        }
    `;

    return (
        // The animation is only shown on large screens (lg breakpoint and up)
        <div className="hidden lg:flex flex-col items-center justify-center">
            <style>{customStyles}</style>
            <div className="circle-mask-container">
                <iframe
                    ref={iframeRef}
                    src="" // src is set by the API
                    title="Stylised Snow Globe"
                    allow="autoplay; fullscreen; xr-spatial-tracking"
                    allowFullScreen
                ></iframe>
            </div>
        </div>
    );
};

export default HalloweenWindmillAnimation;