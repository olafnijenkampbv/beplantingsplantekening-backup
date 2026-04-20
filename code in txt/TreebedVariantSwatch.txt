"use client";

import React from "react";
import { TreebedVariant } from "@/state/projectStore";

const TREEBED_SWATCH_COLORS = {
    fill: "rgba(0, 128, 0, 0.35)",
    stroke: "#476D3C",
    trunk: "#8B5E3C",
};

type Props = {
    variant?: TreebedVariant;
    size?: number;
    className?: string;
};

export default function TreebedVariantSwatch({
    variant = "standard",
    size = 14,
    className = "",
}: Props) {
    const outerStyle: React.CSSProperties =
        variant === "espalier"
            ? {
                width: Math.max(8, Math.round(size * 0.62)),
                height: Math.max(14, Math.round(size * 1.18)),
                borderRadius: 2,
            }
            : variant === "roof"
                ? {
                    width: size,
                    height: size,
                    borderRadius: 3,
                }
                : {
                    width: size,
                    height: size,
                    borderRadius: "999px",
                };

    const trunkSize = Math.max(3, Math.round(size * 0.28));
    const singleTrunkStyle: React.CSSProperties = {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: trunkSize,
        height: trunkSize,
        borderRadius: "999px",
        background: TREEBED_SWATCH_COLORS.trunk,
        transform: "translate(-50%, -50%)",
    };

    return (
        <span
            className={className}
            style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
                ...outerStyle,
                background: TREEBED_SWATCH_COLORS.fill,
                border: `1px solid ${TREEBED_SWATCH_COLORS.stroke}`,
                boxSizing: "border-box",
            }}
        >
            {variant === "multi_stem" ? (
                <>
                    <span
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: Math.max(3, Math.round(size * 0.2)),
                            height: Math.max(3, Math.round(size * 0.2)),
                            borderRadius: "999px",
                            background: TREEBED_SWATCH_COLORS.trunk,
                            transform: "translate(calc(-50% - 2px), 12%)",
                        }}
                    />
                    <span
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: Math.max(2, Math.round(size * 0.15)),
                            height: Math.max(2, Math.round(size * 0.15)),
                            borderRadius: "999px",
                            background: TREEBED_SWATCH_COLORS.trunk,
                            transform: `translate(calc(-50% - ${Math.round(size * 0.1)}px), calc(-50% - ${Math.round(
                                size * 0.15
                            )}px))`,
                        }}
                    />
                    <span
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: Math.max(2, Math.round(size * 0.2)),
                            height: Math.max(2, Math.round(size * 0.2)),
                            borderRadius: "999px",
                            background: TREEBED_SWATCH_COLORS.trunk,
                            transform: `translate(calc(-50% + ${Math.round(size * 0.15)}px), calc(-50% - ${Math.round(
                                size * -0
                            )}px))`,
                        }}
                    />
                </>
            ) : (
                <span style={singleTrunkStyle} />
            )}
        </span>
    );
}