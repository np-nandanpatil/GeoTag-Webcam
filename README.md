# GeoTag Webcam 📸

A Progressive Web App (PWA) that adds geolocation overlays (Map + Address + Timestamp) to webcam photos. Built with **React**, **TypeScript**, and **Vite**.

## Features
-   **Native App Feel**: Fullscreen immersive UI, floating controls, dark mode.
-   **Smart Orientation**: Automatically requests High-Res Portrait (Vertical) or Landscape (Horizontal) video streams based on device rotation.
-   **Privacy Focused**: Runs entirely in the browser. No images are uploaded to any server.
-   **Secure**: Requires HTTPS (or `localhost`) to access Camera and Location APIs.

## Tech Stack
-   [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
-   [Vite](https://vitejs.dev/) - Build tool
-   [Leaflet](https://leafletjs.com/) - Map generation
-   [html2canvas](https://html2canvas.hertzen.com/) - Image composition

## Development

### Prerequisites
-   Node.js (v18+)

### Setup
```bash
npm install
npm run dev
```

### Mobile Testing
To test on your mobile device during development, you must serve over HTTPS.
1.  Start the dev server: `npm run dev`
2.  Use `ngrok` to tunnel port 5173 (default Vite port):
    ```bash
    ngrok http 5173
    ```
3.  Open the `https://....ngrok-free.app` URL on your phone.

## Build for Production
```bash
npm run build
```
The output will be in the `dist` folder.

## Deployment (Cloudflare Pages)
-   **Framework Preset**: Vite
-   **Build Command**: `npm run build`
-   **Output Directory**: `dist`
