import { useEffect } from "react";

/**
 * Vergrendelt het scrollen van document.body terwijl `active` true is.
 * Herstelt de oorspronkelijke overflow-waarde bij unmount of als active false wordt.
 */
export function useScrollLock(active = true) {
    useEffect(() => {
        if (!active) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [active]);
}
