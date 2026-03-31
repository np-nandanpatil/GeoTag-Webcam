Looking at the codebase compared to the existing README, I found several discrepancies and missing information. Here's a corrected README:

# GeoTag Webcam 📸

A Progressive Web App (PWA) that adds geolocation overlays (Map + Address + Timestamp) to webcam photos. Built with **React**, **TypeScript**, and **Vite**.

## Features
- **Native App Feel**: Fullscreen immersive UI with floating controls
- **Smart Orientation Detection**: Automatically adapts camera constraints based on device orientation (portrait/landscape)
- **High-Resolution Camera**: Requests optimal resolution with back camera preference (environment facing mode)
- **Interactive Maps**: Uses Google Maps Static API for satellite view overlays with location markers
- **Reverse Geocoding**: Automatically resolves coordinates to human-readable addresses
- **Privacy Focused**: Runs entirely in the browser. No images are uploaded to any server
- **Secure**: Requires HTTPS (or `localhost`) to access Camera and Location APIs
- **Image Composition**: Combines webcam photo with map overlay and location details

## Tech Stack
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) - Build tool and dev server
- [Leaflet](https://leafletjs.com/) - Map utilities and marker icons
- [Google Maps Static API](https://developers.google.com/maps/documentation/maps-static) - Satellite map generation
- [Google Geocoding API](https://developers.google.com/maps/documentation/geocoding) - Address resolution
- [html2canvas](https://html2canvas.hertzen.com/) - Image composition and canvas manipulation

## Prerequisites
- Node.js (v18+)
- Google Maps API Key with the following APIs enabled:
  - Maps Static API
  - Geocoding API

## Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd geotag-webcam
npm install
```

### 2. Environment Configuration
Create a `.env` file in the project root:
```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### 3. Development Server
```bash
npm run dev
```

### 4. Mobile Testing (HTTPS Required)
Camera and geolocation APIs require HTTPS. For mobile testing:

1. Start the dev server: `npm run dev`
2. Use `ngrok` to create HTTPS tunnel:
   ```bash
   ngrok http 5173
   ```
3. Open the `https://....ngrok-free.app` URL on your mobile device

## Build for Production
```bash
npm run build
```
The output will be in the `dist` folder.

## Architecture

### Custom Hooks
- **`useCamera`**: Manages camera stream initialization with orientation-aware constraints and back camera detection
- **`useGeoLocation`**: Handles GPS positioning and reverse geocoding via Google APIs  
- **`useOrientation`**: Tracks device orientation changes for adaptive UI/camera behavior

### Key Components
- **App.tsx**: Main component orchestrating camera, location, and image capture workflow
- **Legacy Implementation**: Contains vanilla JS version in `_legacy/` folder for reference

## API Dependencies
This app requires a Google Cloud Platform project with Maps API access:
1. Enable **Maps Static API** for satellite map generation
2. Enable **Geocoding API** for address resolution
3. Add your domain/localhost to API key restrictions

## Deployment

### Cloudflare Pages
- **Framework Preset**: Vite
- **Build Command**: `npm run build`  
- **Output Directory**: `dist`
- **Environment Variables**: Add `VITE_GOOGLE_MAPS_API_KEY` in Pages settings

### Other Platforms
Ensure the deployment platform supports:
- HTTPS (required for camera/location access)
- Environment variable injection for Google Maps API key
- Static file serving from `dist` folder

## Browser Compatibility
- Modern browsers with `getUserMedia()` and `navigator.geolocation` support
- Secure context (HTTPS) required for production use
- Back camera detection works on mobile devices with multiple cameras