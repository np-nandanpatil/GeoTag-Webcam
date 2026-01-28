import { useState, useEffect } from 'react';

export type Orientation = 'portrait' | 'landscape';

export const useOrientation = () => {
    const [orientation, setOrientation] = useState<Orientation>(
        window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
    );

    useEffect(() => {
        const handleResize = () => {
            const newOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
            setOrientation(newOrientation);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return {
        orientation,
        isPortrait: orientation === 'portrait',
        isLandscape: orientation === 'landscape'
    };
};
