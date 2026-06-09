"use client";

/**
 * PlantImg.tsx
 *
 * Herbruikbare <img>-wrapper voor plantfoto's.
 * Toont het bedrijfslogo als fallback wanneer:
 *  - imageUrl leeg / null / undefined is, of
 *  - de URL een kapot plaatje oplevert (onError).
 *
 * Gebruik:
 *   <PlantImg src={plant.imageUrl} alt={plant.botanicalName} className="block h-full w-full" />
 */

import React, { useState } from "react";

const FALLBACK_SRC = "/images/logo.png";

const COVER_STYLE: React.CSSProperties = {
    objectFit: "cover",
    objectPosition: "center",
};

const LOGO_STYLE: React.CSSProperties = {
    objectFit: "contain",
    objectPosition: "center",
    padding: "20%",
};

type PlantImgProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & {
    /** imageUrl uit de database; mag leeg / null / undefined zijn */
    src: string | null | undefined;
};

export function PlantImg({ src, style: _style, className, alt, ...rest }: PlantImgProps) {
    const [errored, setErrored] = useState(false);

    const useLogo = !src || errored;
    const effectiveSrc = useLogo ? FALLBACK_SRC : src;

    return (
        <img
            {...rest}
            src={effectiveSrc}
            alt={alt}
            className={className}
            style={useLogo ? LOGO_STYLE : COVER_STYLE}
            onError={() => setErrored(true)}
        />
    );
}
