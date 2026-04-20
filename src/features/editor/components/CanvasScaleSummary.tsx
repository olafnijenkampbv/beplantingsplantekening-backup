"use client";

import React, { useMemo } from "react";
import type { PolyObject } from "@/state/projectStore";
import { getTotalAreaInSquareMeters } from "@/state/areaMetrics";

const COLORS = {
    green: "#58694C",
    border: "#E4E2E3",
    text: "#000",
    white: "#FFFFFF",
};

type Props = {
    leftOffset: number;
    bottomOffset?: number;
    stageScale: number;
    gridSize: number;
    objects: PolyObject[];
    selectedObjectId: string | null;
    selectedObjectIds: string[];
    compassAssetName: string;
    onCompassClick: () => void;
};

function formatAreaValue(value: number): string {
    const rounded = Math.round(value * 100) / 100;

    if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
        return `${Math.round(rounded)} m²`;
    }

    return `${rounded.toFixed(2).replace(/\.?0+$/, "")} m²`;
}

export default function CanvasScaleSummary({
    leftOffset,
    bottomOffset = 18,
    stageScale,
    gridSize,
    objects,
    selectedObjectId,
    selectedObjectIds,
    compassAssetName,
    onCompassClick,
}: Props) {
    const effectiveSelectedIds = useMemo(() => {
        if (selectedObjectIds && selectedObjectIds.length > 0) {
            return selectedObjectIds;
        }

        return selectedObjectId ? [selectedObjectId] : [];
    }, [selectedObjectId, selectedObjectIds]);

    const totalAreaM2 = useMemo(() => {
        return getTotalAreaInSquareMeters(objects ?? []);
    }, [objects]);

    const selectedAreaM2 = useMemo(() => {
        if (!effectiveSelectedIds.length) return 0;

        const selectedSet = new Set(effectiveSelectedIds);
        const selectedObjects = (objects ?? []).filter((obj) => selectedSet.has(obj.id));

        return getTotalAreaInSquareMeters(selectedObjects);
    }, [objects, effectiveSelectedIds]);

    const scaleWidthPx = gridSize * 10;
    const tickCount = 11;
    const minorTickCount = tickCount - 1;

    return (
        <div
            className="fixed z-30"
            style={{
                left: leftOffset,
                bottom: bottomOffset,
                pointerEvents: "none",
            }}
        >
            <div
                className="overflow-hidden bg-white"
                style={{
                   
                    borderRadius: 12,
                    boxShadow: "0px 6px 18px rgba(0,0,0,0.12)",
                    width: Math.max(240, scaleWidthPx + 76),
                    pointerEvents: "auto",
                }}
            >
            
                <div style={{ background: COLORS.white }}>
                    <div
                        style={{
                            position: "relative",
                            background: COLORS.green,
                            height: 32,
                        }}
                    >
                        <button
                            type="button"
                            onClick={onCompassClick}
                            aria-label="Draai tekening een kwartslag"
                            style={{
                                position: "absolute",
                                left: 12,
                                top: 10,
                                width: 44,
                                height: 44,
                                borderRadius: "999px",
                                background: COLORS.white,
                                border: `1px solid ${COLORS.border}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                zIndex: 3,
                                boxShadow: "0px 1px 2px rgba(0,0,0,0.06)",
                                cursor: "pointer",
                                padding: 0,
                            }}
                        >
                            <img
                                src={`/icons/${compassAssetName}`}
                                alt="Kompas"
                                style={{
                                    width: 32,
                                    height: 32,
                                    display: "block",
                                }}
                            />
                        </button>

                        <div
                            style={{
                                position: "absolute",
                                right: 14,
                                top: 10,
                                width: scaleWidthPx,
                                height: 18,
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    top: 0,
                                    height: 1,
                                    background: "rgba(255,255,255,0.95)",
                                }}
                            />

                            {Array.from({ length: tickCount }).map((_, index) => {
                                const left = (scaleWidthPx / minorTickCount) * index;
                                const isMajor = index === 0 || index === 5 || index === 10;

                                return (
                                    <div
                                        key={index}
                                        style={{
                                            position: "absolute",
                                            left,
                                            top: 0,
                                            width: 1,
                                            height: isMajor ? 13 : 8,
                                            background: "rgba(255,255,255,0.98)",
                                            transform: "translateX(-0.5px)",
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    <div
                        style={{
                            position: "relative",
                            height: 28,
                            paddingLeft: 12,
                            paddingRight: 14,
                            display: "flex",
                            justifyContent: "flex-end",
                            alignItems: "center",
                        }}
                    >
                        <div
                            style={{
                                position: "relative",
                                width: scaleWidthPx,
                                height: "100%",
                            }}
                        >
                            <span
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 6,
                                    transform: "translateX(-50%)",
                                    fontSize: 11,
                                    lineHeight: 1,
                                    color: "#000000",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                0 m
                            </span>

                            <span
                                style={{
                                    position: "absolute",
                                    left: scaleWidthPx / 2,
                                    top: 6,
                                    transform: "translateX(-50%)",
                                    fontSize: 11,
                                    lineHeight: 1,
                                    color: "#000000",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                0.5 m
                            </span>

                            <span
                                style={{
                                    position: "absolute",
                                    left: scaleWidthPx,
                                    top: 6,
                                    transform: "translateX(-50%)",
                                    fontSize: 11,
                                    lineHeight: 1,
                                    color: "#000000",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                1 m
                            </span>
                        </div>
                    </div>

                    <div
                        style={{
                            height: 1,
                            background: COLORS.border,
                            marginLeft: 12,
                            marginRight: 12,
                        }}
                    />

                    <div
                        style={{
                            padding: "10px 12px 12px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                fontSize: 13,
                                color: COLORS.text,
                                lineHeight: 1.2,
                            }}
                        >
                            <span>Aantal m² geselecteerd:</span>
                            <span>{formatAreaValue(selectedAreaM2)}</span>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                fontSize: 13,
                                color: COLORS.text,
                                lineHeight: 1.2,
                            }}
                        >
                            <span style={{ fontWeight: 700 }}>Totaal aantal m²:</span>
                            <span style={{ fontWeight: 700 }}>{formatAreaValue(totalAreaM2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}