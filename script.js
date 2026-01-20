const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("capture-btn");
const errorMsg = document.getElementById("error");
const infoMsg = document.getElementById("info");
const photoContainer = document.getElementById("photo-container");
const mapDiv = document.getElementById("map");
const retryLocBtn = document.getElementById("retry-loc-btn");

let curPos = null;
let addressDetails = "";
let map = null;

// Check for Secure Context immediately
if (!window.isSecureContext) {
    const warning = `
        <strong>⚠️ Security Restriction</strong><br>
        Camera and Location access are blocked by your browser because this page is not served over HTTPS.<br>
        <small>If testing on mobile, use a service like <code>ngrok</code> to create a secure tunnel.</small>
    `;
    errorMsg.innerHTML = warning;
}

// Initialize camera with a robust 2-step process
async function initCamera() {
    if (!window.isSecureContext) return; // Stop if not secure

    try {
        // Step 1: Request basic camera access
        let stream = await navigator.mediaDevices.getUserMedia({ video: true });

        // Step 2: Search for back camera
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const backCamera = devices.find(d =>
                d.kind === "videoinput" &&
                (d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment"))
            );

            if (backCamera) {
                stream.getTracks().forEach(t => t.stop());
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: backCamera.deviceId } }
                });
            }
        } catch (e) {
            console.warn("Could not switch to back camera:", e);
        }

        video.srcObject = stream;
        video.onloadedmetadata = () => {
            captureBtn.disabled = false;
            errorMsg.textContent = "";
        };
    } catch (err) {
        console.error("Camera Error:", err);
        let msg = "Failed to access camera.";
        if (err.name === 'NotAllowedError') msg = "Camera permission denied.";
        errorMsg.textContent = msg;
    }
}

// Get address from coordinates
async function getAddressFromCoords(latitude, longitude) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, { headers: { "Accept-Language": "en" } });
        const data = await response.json();

        if (data.address) {
            return {
                city: data.address.city || data.address.town || data.address.village || "",
                state: data.address.state || "",
                country: data.address.country || "",
                postal: data.address.postcode || "",
                full: data.display_name,
            };
        }
        throw new Error("Address not found");
    } catch (error) {
        console.error("Geocoding error:", error);
        return null;
    }
}

// Create static map image
async function createStaticMap(latitude, longitude) {
    if (!map) {
        map = L.map(mapDiv).setView([latitude, longitude], 15);
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png").addTo(map);
        L.marker([latitude, longitude]).addTo(map);
    } else {
        map.setView([latitude, longitude], 15);
    }

    mapDiv.style.display = "block";
    map.invalidateSize();

    // Wait for tiles to load
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return html2canvas(mapDiv, { useCORS: true });
}

// Get Location
async function getLoc() {
    if (!window.isSecureContext) return;
    if (retryLocBtn) retryLocBtn.style.display = "none";

    if (!("geolocation" in navigator)) {
        errorMsg.textContent = "Geolocation not supported";
        return;
    }

    infoMsg.textContent = "Requesting location...";

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            curPos = position;
            const { latitude, longitude } = position.coords;

            try {
                addressDetails = await getAddressFromCoords(latitude, longitude);
                infoMsg.textContent = "Location acquired 👍🏻";
            } catch (e) {
                infoMsg.textContent = "Location acquired (Address failed)";
            }
        },
        (err) => {
            console.error("Location Error:", err);
            let msg = "Location failed.";
            if (err.code === 1) msg = "Permission denied.";
            else if (err.code === 2) msg = "Position unavailable (Check GPS).";
            else if (err.code === 3) msg = "Timeout.";

            errorMsg.textContent = msg;
            if (retryLocBtn) retryLocBtn.style.display = "inline-flex";
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
}

// Listeners
if (retryLocBtn) {
    retryLocBtn.addEventListener("click", getLoc);
}

captureBtn.addEventListener("click", async () => {
    if (!curPos || !addressDetails) {
        errorMsg.textContent = "Wait for location data!";
        return;
    }

    const { latitude, longitude } = curPos.coords;
    const mapCanvas = await createStaticMap(latitude, longitude);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");

    context.drawImage(video, 0, 0);

    const overlayHeight = 150;
    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.fillRect(canvas.width / 4, canvas.height - overlayHeight, (canvas.width / 4) * 2, overlayHeight);
    context.fillRect(canvas.width - canvas.width / 4 - 130, canvas.height - overlayHeight - 25, 130, 25);

    const mapSize = 120;
    const mapX = (canvas.width / 4) + 10;
    const mapY = canvas.height - overlayHeight + 15;
    context.drawImage(mapCanvas, mapX, mapY, mapSize, mapSize);

    context.fillStyle = "white";
    context.font = "18px sans-serif";

    const textX = (canvas.width / 4) + 140;
    let textY = canvas.height - overlayHeight + 35;
    const lineHeight = 25;

    context.fillText(`${addressDetails.city}, ${addressDetails.state}, ${addressDetails.country}`, textX, textY);
    textY += lineHeight;
    context.fillText(`${addressDetails.postal}, ${addressDetails.country}`, textX, textY);
    textY += lineHeight;
    context.fillText(`Lat ${latitude.toFixed(6)}° Long ${longitude.toFixed(6)}°`, textX, textY);
    textY += lineHeight;

    const now = new Date();
    const timeString = now.toLocaleString("en-US", {
        day: "2-digit", year: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: true,
    });

    const offset = -new Date().getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offset) / 60);
    const offsetString = `GMT ${offset >= 0 ? "+" : "-"}${offsetHours}`;
    context.fillText(`${timeString} ${offsetString}`, textX, textY);

    context.font = "18px Arial";
    context.fillText("GeoTag Webcam", canvas.width - canvas.width / 4 - 120, canvas.height - overlayHeight - 5);

    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/jpeg");
    img.alt = "Captured photo";

    const downloadBtn = document.createElement("a");
    downloadBtn.href = canvas.toDataURL("image/jpeg");
    downloadBtn.download = "geotagged_photo.jpg";
    downloadBtn.textContent = "Download Photo";
    downloadBtn.className = "btn btn-primary";

    photoContainer.innerHTML = "";
    photoContainer.appendChild(img);
    photoContainer.appendChild(downloadBtn);
});

// Start
setTimeout(initCamera, 500);
setTimeout(getLoc, 1000);
