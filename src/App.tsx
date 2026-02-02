import { useState, useRef } from 'react';
import { useCamera } from './hooks/useCamera';
import { useGeoLocation } from './hooks/useGeoLocation';
import { useOrientation } from './hooks/useOrientation';

function App() {
    const { videoRef, error: camError, ready: camReady } = useCamera();
    const { position, address, error: locError, retry: retryLoc } = useGeoLocation();
    const { orientation } = useOrientation();
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [capturing, setCapturing] = useState(false);

    // Hidden elements for processing
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Helper to create static map using Google Maps
    const createMapImage = async (lat: number, lon: number): Promise<HTMLCanvasElement> => {
        return new Promise((resolve, reject) => {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=15&size=512x512&maptype=satellite&markers=color:red%7C${lat},${lon}&key=${apiKey}`;

            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 512;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas);
                } else {
                    reject(new Error("Failed to get canvas context"));
                }
            };
            img.onerror = () => {
                reject(new Error("Failed to load map image"));
            };
            img.src = mapUrl;
        });
    };

    const handleCapture = async () => {
        // Debugging Checks
        if (!videoRef.current) { alert("Internal Error: Video ref missing"); return; }
        if (!camReady) { alert("Camera not ready yet (or permission denied)."); return; }
        if (!position) { alert("Location not found yet (GPS slow?). Check permissions."); return; }

        // Soft check for address - warn but allow proceed if user insists
        if (!address) {
            const proceed = confirm("Address is still loading. Capture with coordinates only?");
            if (!proceed) return;
        }

        if (!canvasRef.current) return;
        setCapturing(true);

        try {
            const { latitude, longitude } = position.coords;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Could not get 2D context");

            // Sync dims
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw Video
            ctx.drawImage(video, 0, 0);

            // Fetch Map (Resilient)
            let mapCanvas: HTMLCanvasElement | null = null;
            try {
                mapCanvas = await createMapImage(latitude, longitude);
            } catch (mapErr) {
                console.warn("Map generation failed, skipping", mapErr);
                // Continue without map
            }

            // Draw Overlay (Floating Centered Stamp)
            const refSize = 3840;
            const currentMaxDim = Math.max(canvas.width, canvas.height);
            const scale = currentMaxDim / refSize;

            const mapSize = 250 * scale;
            const fontSize = 42 * scale;
            const lineHeight = 58 * scale;
            const gap = 50 * scale;
            const boxPadding = 60 * scale;
            const bottomMargin = 80 * scale;

            // Prepare Text
            const now = new Date();
            const timeString = now.toLocaleString("en-US", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit", hour12: true,
            });
            const offset = -new Date().getTimezoneOffset();
            const offsetHours = Math.floor(Math.abs(offset) / 60);
            const offsetString = `GMT${offset >= 0 ? "+" : "-"}${offsetHours}`;
            const dateLine = `${timeString} • ${offsetString}`;

            const safeAddr = address || { city: "Location", state: "Coordinates Only", postal: "", country: "" };
            const lines = [
                `${safeAddr.city}, ${safeAddr.state}`.replace(/^, /, '').replace(/, $/, ''),
                `${safeAddr.postal}, ${safeAddr.country}`.replace(/^, /, '').replace(/, $/, ''),
                `Lat ${latitude.toFixed(5)}°  Long ${longitude.toFixed(5)}°`,
                dateLine
            ];

            // Measure Content
            ctx.font = `${Math.round(fontSize)}px 'Inter', sans-serif`;
            let maxTextWidth = 0;
            lines.forEach(l => {
                const w = ctx.measureText(l).width;
                if (w > maxTextWidth) maxTextWidth = w;
            });

            // Calculate Box Dimensions
            const contentWidth = mapSize + gap + maxTextWidth;
            const contentHeight = Math.max(mapSize, lines.length * lineHeight);
            const boxWidth = contentWidth + (boxPadding * 2);
            const boxHeight = contentHeight + (boxPadding * 2);

            // Positioning (Middle-Low, Centered)
            const boxX = (canvas.width - boxWidth) / 2;
            const boxY = canvas.height - boxHeight - bottomMargin;
            const contentX = boxX + boxPadding;
            const contentY = boxY + boxPadding;

            // Draw Rounded Background Box
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.beginPath();
            const r = 24 * scale;
            ctx.moveTo(boxX + r, boxY);
            ctx.arcTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + boxHeight, r);
            ctx.arcTo(boxX + boxWidth, boxY + boxHeight, boxX, boxY + boxHeight, r);
            ctx.arcTo(boxX, boxY + boxHeight, boxX, boxY, r);
            ctx.arcTo(boxX, boxY, boxX + boxWidth, boxY, r);
            ctx.closePath();
            ctx.fill();

            // Draw Map
            const mapX = contentX;
            const mapY = contentY + (contentHeight - mapSize) / 2;
            if (mapCanvas) {
                ctx.drawImage(mapCanvas, mapX, mapY, mapSize, mapSize);
            } else {
                ctx.fillStyle = "#333";
                ctx.fillRect(mapX, mapY, mapSize, mapSize);
                ctx.fillStyle = "#ccc";
                ctx.font = `${Math.round(fontSize * 0.5)}px Arial`;
                ctx.textAlign = "center";
                ctx.fillText("Map Error", mapX + mapSize / 2, mapY + mapSize / 2);
            }

            // Draw Text
            const textX = contentX + mapSize + gap;
            const textStartY = contentY + (contentHeight - (lines.length * lineHeight)) / 2 + (lineHeight / 2);

            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.font = `${Math.round(fontSize)}px 'Inter', sans-serif`;

            lines.forEach((line, i) => {
                ctx.fillStyle = i === 3 ? "#e2e8f0" : "white";
                ctx.fillText(line, textX, textStartY + (i * lineHeight));
            });

            // Branding (Centered at the very bottom or relative to box?)
            // Putting it slightly below the box
            ctx.font = `bold ${Math.round(fontSize * 0.8)}px Arial`;
            ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            ctx.textAlign = "center";
            ctx.fillText("GeoTag Webcam", canvas.width / 2, canvas.height - (bottomMargin / 2));
            ctx.textAlign = "left";

            // Save
            const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
            setCapturedImage(dataUrl);

        } catch (e: any) {
            console.error("Capture failed", e);
            alert("Capture Error: " + (e.message || JSON.stringify(e)));
        } finally {
            setCapturing(false);
        }
    };

    const downloadImage = () => {
        if (!capturedImage) return;
        const link = document.createElement('a');
        link.href = capturedImage;
        link.download = `geotag_${new Date().getTime()}.jpg`;
        link.click();
    };

    // --- Render ---

    // 1. Result View
    return (
        <>
            <video ref={videoRef} id="camera-feed" autoPlay playsInline muted className={capturedImage ? "hidden" : ""} />

            {/* Hidden processing canvas */}
            <canvas ref={canvasRef} className="hidden-canvas" />

            {/* UI Layer */}
            {!capturedImage && (
                <div className={`ui-layer ${orientation}`}>
                    <div className="status-bar">
                        {camError && <div className="status-pill error">{camError}</div>}
                        {locError && <div className="status-pill error">{locError}</div>}
                        {!address && !locError && <div className="status-pill">Acquiring Location...</div>}
                        {address && <div className="status-pill">Location Acquired 👍</div>}
                    </div>

                    <div className="controls-bar">
                        {locError ? (
                            <button className="icon-btn" onClick={retryLoc}>📍 Retry</button>
                        ) : (
                            <div className="spacer"></div>
                        )}

                        <button
                            className={`shutter-btn ${capturing ? 'capturing' : ''}`}
                            onClick={handleCapture}
                        // disabled={!camReady || !address || capturing} // DEBUG: Always enabled
                        />

                        <div className="spacer"></div>
                    </div>
                </div>
            )}

            {/* Result Modal */}
            {capturedImage && (
                <div className="modal">
                    <div className="photo-preview">
                        <img src={capturedImage} alt="Captured" />
                    </div>
                    <div className="modal-actions">
                        <button className="btn btn-secondary" onClick={() => setCapturedImage(null)}>Retake</button>
                        <div className="spacer"></div>
                        <button className="btn btn-primary" onClick={downloadImage}>Save Photo</button>
                    </div>
                </div>
            )}
        </>
    );
}

export default App;
