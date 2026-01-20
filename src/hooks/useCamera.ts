import { useState, useEffect, useRef } from 'react';

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
                ? { width: { ideal: 2160 }, height: { ideal: 3840 } }
                : { width: { ideal: 3840 }, height: { ideal: 2160 } };

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
        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                console.log("Resize detected, restarting camera...");
                initCamera();
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
