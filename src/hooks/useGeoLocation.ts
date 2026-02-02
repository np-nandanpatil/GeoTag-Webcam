import { useState, useEffect } from 'react';

export interface AddressDetails {
    city: string;
    state: string;
    country: string;
    postal: string;
    full: string;
}

export const useGeoLocation = () => {
    const [position, setPosition] = useState<GeolocationPosition | null>(null);
    const [address, setAddress] = useState<AddressDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const getAddressFromCoords = async (lat: number, lon: number) => {
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`
            );
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const addressComponents = data.results[0].address_components;

                const getComponent = (types: string[]) => {
                    const comp = addressComponents.find((c: any) =>
                        types.some(t => c.types.includes(t))
                    );
                    return comp ? comp.long_name : "";
                };

                setAddress({
                    city: getComponent(['locality', 'administrative_area_level_2', 'sublocality']),
                    state: getComponent(['administrative_area_level_1']),
                    country: getComponent(['country']),
                    postal: getComponent(['postal_code']),
                    full: data.results[0].formatted_address,
                });
            }
        } catch (err) {
            console.warn("Google Geocoding failed", err);
            // Keep position but maybe address is null
        }
    };

    const fetchLocation = () => {
        setLoading(true);
        setError(null);

        if (!navigator.geolocation) {
            setError("Geolocation not supported");
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                setPosition(pos);
                await getAddressFromCoords(pos.coords.latitude, pos.coords.longitude);
                setLoading(false);
            },
            (err) => {
                console.error("Loc Error", err);
                let msg = "Location failed.";
                if (err.code === 1) msg = "Location denied. Enable in settings.";
                else if (err.code === 2) msg = "GPS unavailable.";
                else if (err.code === 3) msg = "Timeout.";
                setError(msg);
                setLoading(false);
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
        );
    };

    useEffect(() => {
        fetchLocation();
    }, []);

    return { position, address, error, loading, retry: fetchLocation };
};
