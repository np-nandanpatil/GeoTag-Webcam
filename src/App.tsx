import { useState, useRef } from 'react';
import { useCamera } from './hooks/useCamera';
import { useGeoLocation } from './hooks/useGeoLocation';
import { useOrientation } from './hooks/useOrientation';
import L from 'leaflet';
import html2canvas from 'html2canvas';

function App() {
    const { videoRef, error: camError, ready: camReady } = useCamera();
    const { position, address, error: locError, retry: retryLoc } = useGeoLocation();
    const { orientation } = useOrientation();
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [capturing, setCapturing] = useState(false);

    // Hidden elements for processing
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Helper to create static map
    const createMapImage = async (lat: number, lon: number): Promise<HTMLCanvasElement> => {
        return new Promise((resolve) => {
            // Create a temporary container for leaflet


            // We need to attach it to DOM briefly to render, or just use offscreen?
            // Leaflet needs DOM. Let's use the hidden ref we have.
            // Actually, reusing the same div might be tricky with React.
            // Let's create a fresh map on a temporary div attached to body, then remove it.
            const tempDiv = document.createElement('div');
            tempDiv.style.width = '512px';
            tempDiv.style.height = '512px';
            tempDiv.style.position = 'absolute';
            tempDiv.style.top = '-9999px';
            document.body.appendChild(tempDiv);

            const leafletMap = L.map(tempDiv).setView([lat, lon], 15);
            L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png").addTo(leafletMap);
            L.marker([lat, lon]).addTo(leafletMap);

            // Wait for tiles
            setTimeout(async () => {
                const canvas = await html2canvas(tempDiv, { useCORS: true });
                leafletMap.remove();
                document.body.removeChild(tempDiv);
                resolve(canvas);
            }, 1500);
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

            // Draw Overlay (Logic Ported)
            const refSize = 3840;
            const currentMaxDim = Math.max(canvas.width, canvas.height);
            const scale = currentMaxDim / refSize;

            const overlayHeight = 350 * scale;
            const mapSize = 250 * scale;
            const fontSize = 40 * scale;
            const lineHeight = 55 * scale;
            const gap = 40 * scale;

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

            // Prepare Address (Handle null fallback)
            const safeAddr = address || { city: "Location", state: "Coordinates Only", postal: "", country: "" };

            const lines = [
                `${safeAddr.city}, ${safeAddr.state}`.replace(/^, /, '').replace(/, $/, ''),
                `${safeAddr.postal}, ${safeAddr.country}`.replace(/^, /, '').replace(/, $/, ''),
                `Lat ${latitude.toFixed(5)}°  Long ${longitude.toFixed(5)}°`,
                dateLine
            ];

            // Measure
            ctx.font = `${Math.round(fontSize)}px 'Inter', sans-serif`;
            let maxTextWidth = 0;
            lines.forEach(l => {
                const w = ctx.measureText(l).width;
                if (w > maxTextWidth) maxTextWidth = w;
            });

            // Layout
            const contentWidth = mapSize + gap + maxTextWidth;
            const mapX = (canvas.width - contentWidth) / 2;
            const textX = mapX + mapSize + gap;

            // Draw BG
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.fillRect(0, canvas.height - overlayHeight, canvas.width, overlayHeight);

            // Draw Map (if success)
            const mapY = canvas.height - overlayHeight + ((overlayHeight - mapSize) / 2);
            if (mapCanvas) {
                ctx.drawImage(mapCanvas, mapX, mapY, mapSize, mapSize);
            } else {
                // Placeholder for failed map
                ctx.fillStyle = "#333";
                ctx.fillRect(mapX, mapY, mapSize, mapSize);
                ctx.fillStyle = "#ccc";
                ctx.font = `${Math.round(fontSize * 0.5)}px Arial`;
                ctx.textAlign = "center";
                ctx.fillText("Map Error", mapX + mapSize / 2, mapY + mapSize / 2);
            }

            // Draw Text
            ctx.textAlign = "left"; // Reset align
            ctx.textBaseline = "middle";
            const totalTextHeight = lines.length * lineHeight;
            let textStartY = canvas.height - overlayHeight + ((overlayHeight - totalTextHeight) / 2) + (lineHeight / 2);

            lines.forEach((line, i) => {
                ctx.fillStyle = i === 3 ? "#e2e8f0" : "white";
                ctx.fillText(line, textX, textStartY + (i * lineHeight));
            });

            // Branding
            ctx.font = `bold ${Math.round(fontSize * 0.8)}px Arial`;
            ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            ctx.textAlign = "right";
            ctx.fillText("GeoTag Webcam", canvas.width - (20 * scale), canvas.height - (20 * scale));
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
