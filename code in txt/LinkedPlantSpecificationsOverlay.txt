"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    DUMMY_PLANTS,
    getDummyPlantSpecificationsForPlant,
    type DummyPlantSpecificationRow,
} from "@/features/editor/lib/plantSelectionDummyData";

const COLORS = {
    orange: "#E94E1B",
    border: "#E3E2E2",
    text: "#111111",
};

const GREEN_ICON_FILTER =
    "brightness(0) saturate(100%) invert(36%) sepia(13%) saturate(707%) hue-rotate(56deg) brightness(92%) contrast(86%)";

function PlantSpecificationOverlayInfoRow(props: DummyPlantSpecificationRow) {
    const { label, value, iconSrc } = props;

    return (
        <div
            className="grid items-start gap-4 py-3"
            style={{
                gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)",
            }}
        >
            <div className="flex min-w-0 items-center gap-3">
                <img
                    src={iconSrc}
                    alt=""
                    style={{
                        width: 16,
                        height: 16,
                        display: "block",
                        flex: "0 0 auto",
                        filter: GREEN_ICON_FILTER,
                    }}
                />

                <span
                    className="text-[13px] font-semibold leading-[1.35]"
                    style={{ color: COLORS.text }}
                >
                    {label}
                </span>
            </div>

            <div
                className="min-w-0 text-[13px] leading-[1.5]"
                style={{
                    color: COLORS.text,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                }}
            >
                {value}
            </div>
        </div>
    );
}

function PlantSpecificationOverlayPanel(props: {
    leftColumn: DummyPlantSpecificationRow[];
    rightColumn: DummyPlantSpecificationRow[];
}) {
    const { leftColumn, rightColumn } = props;

    return (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
            <div>
                {leftColumn.map((row, index) => (
                    <React.Fragment key={row.label}>
                        <PlantSpecificationOverlayInfoRow {...row} />
                        {index < leftColumn.length - 1 ? (
                            <div className="h-px w-full" style={{ backgroundColor: COLORS.border }} />
                        ) : null}
                    </React.Fragment>
                ))}
            </div>

            <div className="hidden xl:block" style={{ backgroundColor: COLORS.border }} />

            <div>
                {rightColumn.map((row, index) => (
                    <React.Fragment key={row.label}>
                        <PlantSpecificationOverlayInfoRow {...row} />
                        {index < rightColumn.length - 1 ? (
                            <div className="h-px w-full" style={{ backgroundColor: COLORS.border }} />
                        ) : null}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

export default function LinkedPlantSpecificationsOverlay(props: {
    open: boolean;
    plant: {
        id: string;
        latin: string;
        dutch: string;
        imageSrc: string;
    } | null;
    topOffset: number;
    onClose: () => void;
}) {
    const { open, plant, topOffset, onClose } = props;

    const [shouldRender, setShouldRender] = useState(open);
    const [isVisible, setIsVisible] = useState(false);

    const specificationData = useMemo(() => {
        if (!plant) return null;

        const dummyPlant = DUMMY_PLANTS.find((item) => item.id === plant.id) ?? null;
        if (!dummyPlant) return null;

        return getDummyPlantSpecificationsForPlant(dummyPlant);
    }, [plant]);

    useEffect(() => {
        if (open) {
            setShouldRender(true);

            const frame = requestAnimationFrame(() => {
                setIsVisible(true);
            });

            return () => cancelAnimationFrame(frame);
        }

        setIsVisible(false);

        const timeout = window.setTimeout(() => {
            setShouldRender(false);
        }, 220);

        return () => window.clearTimeout(timeout);
    }, [open]);

    if (!shouldRender || !plant || !specificationData) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{
                background: isVisible ? "rgba(0,0,0,0.33)" : "rgba(0,0,0,0)",
                backdropFilter: isVisible ? "blur(2px)" : "blur(0px)",
                paddingTop: 24,
                paddingBottom: 24,
                paddingLeft: 24,
                paddingRight: 24,
                opacity: isVisible ? 1 : 0,
                transition: "opacity 220ms ease, background 220ms ease, backdrop-filter 220ms ease",
            }}
            onMouseDown={onClose}
        >
            <div
                className="relative bg-white shadow-lg"
                style={{
                    width: "min(1280px, calc(100vw - 96px))",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    padding: 22,
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.985)",
                    transition: "opacity 220ms ease, transform 220ms ease",
                }}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    aria-label="Sluiten"
                    onClick={onClose}
                    className="absolute flex items-center justify-center"
                    style={{
                        top: 14,
                        right: 14,
                        width: 32,
                        height: 32,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                    }}
                >
                    <img
                        src="/icons/cancel.svg"
                        alt=""
                        style={{
                            width: 18,
                            height: 18,
                            display: "block",
                        }}
                    />
                </button>

                <div
                    className="grid gap-8"
                    style={{
                        gridTemplateColumns: "200px minmax(0, 1fr)",
                        paddingRight: 36,
                    }}
                >
                    <div>
                        <div
                            style={{
                                width: 190,
                                height: 190,
                                borderRadius: 4,
                                overflow: "hidden",
                                background: "#F3F3F3",
                            }}
                        >
                            <img
                                src={plant.imageSrc}
                                alt={plant.latin}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: "block",
                                }}
                            />
                        </div>

                        <div
                            style={{
                                marginTop: 12,
                                fontSize: 16,
                                fontWeight: 700,
                                lineHeight: 1.25,
                                color: COLORS.text,
                            }}
                        >
                            {plant.latin}
                        </div>
                    </div>

                    <PlantSpecificationOverlayPanel
                        leftColumn={specificationData.leftColumn}
                        rightColumn={specificationData.rightColumn}
                    />
                </div>
            </div>
        </div>
    );
}