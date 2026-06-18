"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { usePlantSelectionStore } from "@/features/editor/state/plantSelectionStore";
import type { ApiPlant } from "@/lib/db/plantTypes";

type DummyPlantSpecificationRow = {
    label: string;
    value: string;
    iconSrc: string;
};

function buildSpecsFromApiPlant(plant: ApiPlant): {
    leftColumn: DummyPlantSpecificationRow[];
    rightColumn: DummyPlantSpecificationRow[];
    toelichting: string;
} {
    const left: DummyPlantSpecificationRow[] = [];
    const right: DummyPlantSpecificationRow[] = [];

    if (plant.dutchName) left.push({ label: "Nederlandse naam", value: plant.dutchName, iconSrc: "/icons/nederlandse-naam.svg" });
    if (plant.planthoeveelheidPerM2) left.push({ label: "Planthoeveelheid/m²", value: String(plant.planthoeveelheidPerM2), iconSrc: "/icons/planthoeveelheid-per-m2.svg" });
    if (plant.volwassenHoogte) left.push({ label: "Volwassen hoogte", value: plant.volwassenHoogte, iconSrc: "/icons/volwassen-hoogte.svg" });
    if (plant.kleuren.length > 0) left.push({ label: "Kleur bloem", value: plant.kleuren.join(", "), iconSrc: "/icons/kleur-bloem.svg" });
    if (plant.kleurBlad.length > 0) left.push({ label: "Kleur blad", value: plant.kleurBlad.join(", "), iconSrc: "/icons/kleur-blad.svg" });

    if (plant.bloeiperiode) right.push({ label: "Bloeiperiode", value: plant.bloeiperiode, iconSrc: "/icons/bloeiperiode.svg" });
    right.push({ label: "Inheems", value: plant.inheems ? "Ja" : "Nee", iconSrc: "/icons/inheems.svg" });
    if (plant.stikstofbehoefte) right.push({ label: "Stikstofbehoefte", value: plant.stikstofbehoefte, iconSrc: "/icons/stikstofbehoefte.svg" });
    if (plant.standplaatsen.length > 0) right.push({ label: "Standplaats", value: plant.standplaatsen.join(", "), iconSrc: "/icons/standplaats.svg" });
    if (plant.grondsoorten.length > 0) right.push({ label: "Grondsoort", value: plant.grondsoorten.join(", "), iconSrc: "/icons/grondsoort.svg" });

    return { leftColumn: left, rightColumn: right, toelichting: plant.toelichting ?? "" };
}

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
    toelichting?: string;
}) {
    const { leftColumn, rightColumn, toelichting } = props;

    return (
        <div className="flex flex-col gap-0">
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

            {toelichting ? (
                <>
                    <div className="h-px w-full my-3" style={{ backgroundColor: COLORS.border }} />
                    <PlantSpecificationOverlayInfoRow
                        label="Toelichting"
                        value={toelichting}
                        iconSrc="/icons/toelichting.svg"
                    />
                </>
            ) : null}
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
    useScrollLock(open);

    const plantListItems = usePlantSelectionStore((s) => s.plantListItems);

    const specificationData = useMemo((): {
        leftColumn: DummyPlantSpecificationRow[];
        rightColumn: DummyPlantSpecificationRow[];
        toelichting: string;
    } | null => {
        if (!plant) return null;
        const apiPlant = plantListItems.find((item) => item.id === plant.id)?.plant;
        if (!apiPlant) return { leftColumn: [], rightColumn: [], toelichting: "" };
        return buildSpecsFromApiPlant(apiPlant);
    }, [plant, plantListItems]);

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

    if (!shouldRender || !plant) return null;

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
                        leftColumn={specificationData?.leftColumn ?? []}
                        rightColumn={specificationData?.rightColumn ?? []}
                        toelichting={specificationData?.toelichting}
                    />
                </div>
            </div>
        </div>
    );
}