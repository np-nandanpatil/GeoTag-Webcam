import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


export const useCamera = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    const stopStream = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
    };

    const initCamera = async () => {
        if (!window.isSecureContext) {
            setError("HTTPS required for Camera access.");
            return;
        }

        stopStream();

        try {
            // Determine constraints based on orientation
            // We'll use a more compatible height/width approach
            const isPortrait = window.innerHeight > window.innerWidth;

            // Standard HD/Full HD preferences, letting the browser scale if needed
            const videoConfig: MediaTrackConstraints = {
                facingMode: { ideal: "environment" },
                width: { ideal: isPortrait ? 1080 : 1920 },
                height: { ideal: isPortrait ? 1920 : 1080 },
                aspectRatio: isPortrait ? 9 / 16 : 16 / 9
            };

            const stream = await navigator.mediaDevices.getUserMedia({
                video: videoConfig
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Try to play immediately
                try {
                    await videoRef.current.play();
                    setReady(true);
                    setError(null);
                } catch (playErr) {
                    console.error("Video play failed", playErr);
                    setError("Tap to start camera");
                }
            }
        } catch (err: any) {
            console.error("Camera Error", err);
            let msg = "Camera failed.";
            if (err.name === 'NotAllowedError') msg = "Camera permission denied.";
            if (err.name === 'NotFoundError') msg = "No camera found.";
            if (err.name === 'NotReadableError') msg = "Camera is already in use.";
            setError(msg);
        }
    };

    // Orientation Listener
    useEffect(() => {
        let resizeTimer: any;
        let lastIsPortrait = window.innerHeight > window.innerWidth;

        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const currentIsPortrait = window.innerHeight > window.innerWidth;
                // Only restart if the orientation actually flipped (e.g. 90deg rotation)
                // Small pixel changes (URL bar) should NOT trigger this.
                if (currentIsPortrait !== lastIsPortrait) {
                    console.log("Orientation flip detected, restarting camera...");
                    lastIsPortrait = currentIsPortrait;
                    initCamera();
                }
            }, 500);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Initial Mount
    useEffect(() => {
        initCamera();
        return stopStream;
    }, []);

    return { videoRef, error, ready };
};
