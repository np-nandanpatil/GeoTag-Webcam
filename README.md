# GeoTag Webcam

## Overview
A web-based webcam application that geotags captured photos with location data, map overlay, and timestamp.

## 🚀 How to Run (Important!)

Browsers block Camera and Location access on insecure connections (like `file://` or HTTP IP addresses). You **must** use a local server or HTTPS.

### 1. Simple Local Server (Laptop only)
To test on your computer:
```bash
python3 -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000)

### 2. Mobile Testing (Requires HTTPS)
To test on your phone, you cannot use your laptop's IP address directly (browser security will block the camera). You need a secure tunnel.

**Using Ngrok:**
1.  Install ngrok: `sudo snap install ngrok` (or download from ngrok.com)
2.  Start your python server: `python3 -m http.server 8000`
3.  In a new terminal, start tunnel: `ngrok http 8000`
4.  Copy the `https://....ngrok.io` link and open it on your phone.
