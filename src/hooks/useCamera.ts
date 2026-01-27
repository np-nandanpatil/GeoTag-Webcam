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
            // 1. Generic request to trigger permission
            let stream = await navigator.mediaDevices.getUserMedia({ video: true });

            // 2. Determine constraints
            const isPortrait = window.innerHeight > window.innerWidth;
            const videoConfig = isPortrait
                ? { width: { ideal: 2160 }, height: { ideal: 3840 }, aspectRatio: 9 / 16 }
                : { width: { ideal: 3840 }, height: { ideal: 2160 }, aspectRatio: 16 / 9 };

            // 3. Find back camera
            const devices = await navigator.mediaDevices.enumerateDevices();
            const backCamera = devices.find(d =>
                d.kind === "videoinput" &&
                (d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment"))
            );

            // 4. Re-request with specific constraints
            stream.getTracks().forEach(t => t.stop());
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: backCamera ? { exact: backCamera.deviceId } : undefined,
                    ...videoConfig
                }
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    setReady(true);
                };
            }
            setError(null);
        } catch (err: any) {
            console.error("Camera Error", err);
            let msg = "Camera failed.";
            if (err.name === 'NotAllowedError') msg = "Camera permission denied.";
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
