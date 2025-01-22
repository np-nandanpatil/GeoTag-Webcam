const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("capture-btn");
const errorMsg = document.getElementById("error");
const infoMsg = document.getElementById("info");
const photoContainer = document.getElementById("photo-container");
const mapDiv = document.getElementById("map");

let curPos = null;
let addressDetails = "";
let map = null;

// Initialize camera with device's best resolution
async function initCamera() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device) => device.kind === "videoinput");

        // checking if back camera is available
        const backCamera = cameras.find(
            (camera) =>
                camera.label.toLowerCase().includes("back") ||
                camera.label.toLowerCase().includes("rear")
        );

        const constraints = {
            video: {
                deviceId: backCamera ? { exact: backCamera.deviceId } : undefined,
                width: 4096, /*{ideal: 3072},*/ // 4K
                height: 3072, /* {ideal: 4096},*/ // 4K
                facingMode: backCamera ? undefined : "environment",
            },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;

        // capture button is enabled only when the video is available (camera is working)
        video.onloadedmetadata = () => {
            captureBtn.disabled = false;
            console.log(`Camera resolution: ${video.videoWidth}x${video.videoHeight}`);
        };
    } catch (err) {
        console.error("Error accessing camera:", err);
        errorMsg.textContent = "Failed to access the camera! Please ensure you have granted the permission.";
    }
}

// Get address from coordinates using OpenStreetMap Nominatim
async function getAddressFromCoords(latitude, longitude) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, { headers: { "Accept-Language": "en" } });
        const data = await response.json();

        if (data.address) {
            addressDetails = {
                city:
                    data.address.city || data.address.town || data.address.village || "",
                    state: data.address.state || "",
                    country: data.address.country || "",
                    postal: data.address.postcode || "",
                    full: data.display_name,
            };
            return addressDetails;
        }
        throw new Error("Address not found");
    } catch (error) {
        console.error("Geocoding error:", error);
        errorMsg.textContent = "Failed to retrieve address. Please try again.";
        return null;
    }
}

// Creating static map using OpenStreetMap
async function createStaticMap(latitude, longitude) {
    // Initialize map if the map is not yet created
    if (!map) {
        map = L.map(mapDiv).setView([latitude, longitude], 15);
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png").addTo(map);
        L.marker([latitude, longitude]).addTo(map);     // pin (pointer) on the map
    } else {
        map.setView([latitude, longitude], 15);
    }

    mapDiv.style.display = "block";
    map.invalidateSize(); // Ensure map is sized properly for rendering

    // Wait for the map to load tiles before capturing the image
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // converting the map to image
    return new Promise((resolve) => {
        html2canvas(mapDiv, { useCORS: true }).then((canvas) => {
            resolve(canvas);
        });
    });
}

async function getLoc() {
    if ("geolocation" in navigator) {
        infoMsg.textContent = "Requesting location permission...";
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 0,
                });
            });

            curPos = position;
            const{latitude, longitude} = position.coords;

            // Get address
            addressDetails = await getAddressFromCoords(latitude, longitude);
            infoMsg.textContent = "Location acquired 👍🏻";
        } catch (err) {
            console.error("Error getting location:", err);
            let errorMessage = "Failed to get location: " + err.message;

            if (err.code === 1) {
                errorMessage = "Location permission denied. Please enable location services and reload.";
            } else if (err.code === 2) {
                errorMessage = "Location unavailable. Please check your connection.";
            } else if (err.code === 3) {
                errorMessage = "Location timeout. Please try again.";
            }

            errorMsg.textContent = errorMessage;
        }
    } else {
        errorMsg.textContent = "Geolocation is not supported by your browser";
    }
}

captureBtn.addEventListener("click", async () => {
    if (!curPos || !addressDetails) {
        errorMsg.textContent = "Please wait for location data to be available";
        return;
    }

    const{latitude, longitude} = curPos.coords;
    // map image
    const mapCanvas = await createStaticMap(latitude, longitude);
    // main canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");

    // Draw video frame
    context.drawImage(video, 0, 0);

    // Add overlay
    const overlayHeight = canvas.height/8;
    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.fillRect(canvas.width / 8, canvas.height - overlayHeight, (canvas.width / 4) * 3, overlayHeight);
    // context.fillRect(canvas.width - canvas.width / 4 - 130, canvas.height - overlayHeight - 25, 130 , 25);

    // Draw map
    const mapSize = overlayHeight - 30;
    const mapX = (canvas.width / 8) + 10;
    const mapY = canvas.height - overlayHeight + 15;
    context.drawImage(mapCanvas, mapX, mapY, mapSize, mapSize);

    // Add text
    context.fillStyle = "white";
    context.font = `${(overlayHeight/7)}px sans-serif`;

    const textX = (canvas.width / 8) + (mapSize + 20);
    let textY = canvas.height - overlayHeight + 35;
    const lineHeight = overlayHeight/5;

    // Draw location info
    context.fillText(`${addressDetails.city}, ${addressDetails.state}, ${addressDetails.country}`, textX, textY);
    textY += lineHeight;

    context.fillText(`${addressDetails.postal}, ${addressDetails.country}`, textX, textY);
    textY += lineHeight;

    // coordinates
    context.fillText(`Lat ${latitude.toFixed(6)}° Long ${longitude.toFixed(6)}°`, textX, textY);
    textY += lineHeight;

    // timestamp with timezone
    const now = new Date();
    const timeString = now.toLocaleString("en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offset) / 60);
    const offsetMinutes = Math.abs(offset) % 60;
    const offsetString = `GMT ${offset >= 0 ? "+" : "-"}${String(
        offsetHours
    ).padStart(2, "0")}:${String(offsetMinutes).padStart(2, "0")}`;

    context.fillText(`${timeString} ${offsetString}`, textX, textY);

    // GeoTag Webcam text
    // context.font = "18 px Arial";
    context.fillText("GeoTag Webcam", canvas.width - canvas.width / 4 - 120, canvas.height - overlayHeight - 5);

    // Create and display captured photo
    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/jpeg");
    img.alt = "Captured photo with geotag";

    const downloadBtn = document.createElement("a");
    downloadBtn.href = canvas.toDataURL("image/jpeg");
    downloadBtn.download = "geotagged_photo.jpg";
    downloadBtn.textContent = "Download Photo";
    downloadBtn.className = "download-btn";

    photoContainer.innerHTML = "";
    photoContainer.appendChild(img);
    photoContainer.appendChild(downloadBtn);
});

// Initialize everything
initCamera();
getLoc();
