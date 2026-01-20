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
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
                { headers: { "Accept-Language": "en" } }
            );
            const data = await response.json();

            if (data.address) {
                setAddress({
                    city: data.address.city || data.address.town || data.address.village || "",
                    state: data.address.state || "",
                    country: data.address.country || "",
                    postal: data.address.postcode || "",
                    full: data.display_name,
                });
            }
        } catch (err) {
            console.warn("Geocoding failed", err);
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
