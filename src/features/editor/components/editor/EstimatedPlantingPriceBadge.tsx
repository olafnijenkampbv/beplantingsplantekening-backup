"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/state/projectStore";
import { usePlantSelectionStore } from "@/features/editor/state/plantSelectionStore";
import {
    buildAdviceData,
    type ProjectPlantLike,
} from "@/features/editor/lib/plantAdvice";
import { getPlantUnitPriceForQuantity, withResolvedBulkPrices } from "@/features/editor/lib/plantPricing";
import { usePlantVariantStore } from "@/features/editor/state/plantVariantStore";
import type { BulkPriceTier } from "@/lib/db/plantTypes";

// ---------------------------------------------------------------------------
// Constanten
// ---------------------------------------------------------------------------

const COLORS = {
    green: "#58694C",
    greenLight: "#F0F5EE",
    progressTrack: "#E5E8E3",
    border: "#E0DEDF",
    divider: "#E4E2E3",
    infoBackground: "#D9EDF7",
    infoBorder: "#BCE8F1",
    infoText: "#31708F",
    priceRed: "#FF0000",
    text: "#111111",
    mutedText: "#6B7280",
};

const ICON_FILTER_INFO =
    "brightness(0) saturate(100%) invert(38%) sepia(17%) saturate(1115%) hue-rotate(158deg) brightness(88%) contrast(87%)";

const ANIM_MS = 220;
const ANIM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const VAT_RATE = 0.09;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEuro(value: number): string {
    return `€${value.toLocaleString("nl-NL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatBudget(value: number): string {
    if (value % 1 === 0) {
        return `€${value.toLocaleString("nl-NL")},-`;
    }
    return `€${value.toLocaleString("nl-NL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

type PriceData = {
    subtotalExVat: number;
    vatAmount: number;
    totalIncVat: number;
    hasMissingPrices: boolean;
};

type LinkStatus = {
    linkedCount: number;
    totalCount: number;
    percentage: number;
};

// ---------------------------------------------------------------------------
// Berekeningslogica
// ---------------------------------------------------------------------------

function computePriceData(params: {
    plantListItems: Array<{ id: string; quantity: number; size?: string; bulkPrices?: BulkPriceTier[]; plant: { id: string; category?: string; pricePerPiece?: number } }>;
    objects: ReturnType<typeof useProjectStore.getState>["objects"];
    plantbedLinks: ReturnType<typeof useProjectStore.getState>["plantbedLinks"];
    projectPlants: ProjectPlantLike[];
    distributionOverrides: Record<string, Record<string, number>>;
    variantsByPlantId: Record<string, { sizeLabel: string; bulkPrices?: BulkPriceTier[] }[]>;
}): PriceData {
    const { plantListItems, objects, plantbedLinks, projectPlants, distributionOverrides, variantsByPlantId } = params;

    // Splits plantenlijst in planten en tuinmaterialen
    // Tuinmaterialen worden NOOIT via plantbedLinks geteld — altijd apart
    const tuinmaterialenItems = plantListItems.filter(
        (item) => item.plant.category === "Tuinmaterialen"
    );
    const tuinmaterialenIds = new Set(tuinmaterialenItems.map((item) => item.id));

    // Bouw een map PlantListItem.id -> lijstregel voor planten (excl. tuinmaterialen)
    // item.id gebruiken (PlantListItem.id) omdat plantbedLinks ook item.id opslaat
    const itemMap = new Map<string, (typeof plantListItems)[number]>();
    for (const item of plantListItems) {
        if (tuinmaterialenIds.has(item.id)) continue; // tuinmaterialen apart optellen
        itemMap.set(item.id, withResolvedBulkPrices(item, variantsByPlantId[item.plant.id]));
    }

    const quantityByItemId = new Map<string, number>();
    let hasMissingPrices = false;

    // Loop over alle objecten die gekoppelde planten hebben (alleen echte planten)
    for (const [objectId, linkedPlantIds] of Object.entries(plantbedLinks)) {
        if (!linkedPlantIds || linkedPlantIds.length === 0) continue;

        const object = objects.find((o) => o.id === objectId);
        if (!object) continue;

        const objectType = object.type;

        // Alleen planten meenemen — filter stale tuinmaterialen-IDs eruit
        const plantOnlyIds = linkedPlantIds.filter((id) => !tuinmaterialenIds.has(id));
        if (plantOnlyIds.length === 0) continue;

        // Bereken adviesdata voor dit object via de centrale helper
        const adviceData = buildAdviceData({
            selectedObject: object,
            currentType: objectType,
            linkedPlantIds: plantOnlyIds,
            plants: projectPlants,
            distributionOverrides: distributionOverrides[objectId],
        });

        for (const row of adviceData.rows) {
            if (row.adviceCount === null) continue;

            quantityByItemId.set(
                row.plantId,
                (quantityByItemId.get(row.plantId) ?? 0) + row.adviceCount
            );
        }
    }

    let subtotal = 0;
    for (const [itemId, count] of quantityByItemId) {
        const item = itemMap.get(itemId);
        if (!item) {
            hasMissingPrices = true;
            continue;
        }
        const price = getPlantUnitPriceForQuantity(
            withResolvedBulkPrices(item, variantsByPlantId[item.plant.id]),
            count
        );
        if (typeof price !== "number" || !Number.isFinite(price)) {
            hasMissingPrices = true;
            continue;
        }
        subtotal += count * price;
    }

    // Tuinmaterialen altijd apart optellen (niet via plantbedLinks)
    // Gebruik item.quantity als handmatig ingesteld, anders 1 als standaard
    for (const item of tuinmaterialenItems) {
        const count = item.quantity > 0 ? item.quantity : 1;
        const price = getPlantUnitPriceForQuantity(item, count);
        if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue;
        subtotal += count * price;
    }

    const vatAmount = subtotal * VAT_RATE;
    const totalIncVat = subtotal + vatAmount;

    return {
        subtotalExVat: subtotal,
        vatAmount,
        totalIncVat,
        hasMissingPrices,
    };
}

function computeLinkStatus(params: {
    plantListItems: Array<{ id: string; plant: { id: string; category?: string } }>;
    plantbedLinks: ReturnType<typeof useProjectStore.getState>["plantbedLinks"];
}): LinkStatus {
    const { plantListItems, plantbedLinks } = params;

    // Tuinmaterialen tellen niet mee — ze kunnen niet aan plantvakken gekoppeld worden
    const linkablePlants = plantListItems.filter(
        (item) => item.plant.category !== "Tuinmaterialen"
    );
    const totalCount = linkablePlants.length;

    // Verzamel unieke item.ids die minimaal één keer gekoppeld zijn
    const linkedPlantIdSet = new Set<string>();
    for (const plantIds of Object.values(plantbedLinks)) {
        for (const plantId of plantIds) {
            linkedPlantIdSet.add(plantId);
        }
    }

    const linkedCount = linkablePlants.filter((item) =>
        linkedPlantIdSet.has(item.id)
    ).length;

    const percentage =
        totalCount > 0 ? Math.round((linkedCount / totalCount) * 100) : 0;

    return { linkedCount, totalCount, percentage };
}

// ---------------------------------------------------------------------------
// Hoofdcomponent
// ---------------------------------------------------------------------------

export default function EstimatedPlantingPriceBadge({ budget }: { budget?: number }) {
    const [open, setOpen] = useState(false);
    const [contentHeight, setContentHeight] = useState(0);
    const contentRef = useRef<HTMLDivElement | null>(null);

    // Zustand selectors — reactief op undo/redo via plantbedLinks
    const objects = useProjectStore((s) => s.objects);
    const plantbedLinks = useProjectStore((s) => s.plantbedLinks);
    const projectPlants = useProjectStore((s) => s.plants as ProjectPlantLike[]);
    const distributionOverrides = useProjectStore((s) => (s as any).distributionOverrides as Record<string, Record<string, number>>);
    const plantListItems = usePlantSelectionStore((s) => s.plantListItems);
    const variantCache = usePlantVariantStore((s) => s.cache);
    const fetchVariants = usePlantVariantStore((s) => s.fetchVariants);

    React.useEffect(() => {
        for (const item of plantListItems) {
            if (item.plant.category !== "Tuinmaterialen") {
                fetchVariants(item.plant.id);
            }
        }
    }, [plantListItems, fetchVariants]);

    const variantsByPlantId = useMemo(() => {
        const map: Record<string, { sizeLabel: string; bulkPrices?: BulkPriceTier[] }[]> = {};
        for (const item of plantListItems) {
            map[item.plant.id] = variantCache[item.plant.id]?.variants ?? [];
        }
        return map;
    }, [plantListItems, variantCache]);

    const priceData = useMemo(
        () =>
            computePriceData({
                plantListItems,
                objects,
                plantbedLinks,
                projectPlants,
                distributionOverrides,
                variantsByPlantId,
            }),
        [plantListItems, objects, plantbedLinks, projectPlants, distributionOverrides, variantsByPlantId]
    );

    const linkStatus = useMemo(
        () => computeLinkStatus({ plantListItems, plantbedLinks }),
        [plantListItems, plantbedLinks]
    );

    const updateHeight = useCallback(() => {
        setContentHeight(contentRef.current?.scrollHeight ?? 0);
    }, []);

    const handleToggle = useCallback(() => {
        if (open) {
            const currentHeight = contentRef.current?.scrollHeight ?? 0;
            setContentHeight(currentHeight);
            requestAnimationFrame(() => {
                setContentHeight(0);
                setOpen(false);
            });
        } else {
            setOpen(true);
            requestAnimationFrame(() => {
                setContentHeight(contentRef.current?.scrollHeight ?? 0);
            });
        }
    }, [open]);

    React.useEffect(() => {
        if (!open) return;
        updateHeight();
        window.addEventListener("resize", updateHeight);
        return () => window.removeEventListener("resize", updateHeight);
    }, [open, priceData, updateHeight]);

    // Statuslabels
    const statusLabel =
        linkStatus.linkedCount === 0
            ? `0 van ${linkStatus.totalCount} planten gekoppeld`
            : linkStatus.linkedCount === linkStatus.totalCount
                ? "Alle planten gekoppeld"
                : `${linkStatus.linkedCount} van ${linkStatus.totalCount} planten gekoppeld`;

    const totalLabel = formatEuro(priceData.totalIncVat);

    // PlantSidebar: right 18, width 420 — badge sluit links daaraan aan met 10px marge
    const SIDEBAR_RIGHT = 18;
    const SIDEBAR_WIDTH = 420;
    const BADGE_RIGHT = SIDEBAR_RIGHT + SIDEBAR_WIDTH + 10;
    const BADGE_BOTTOM = 18;

    return (
        <div
            style={{
                position: "fixed",
                bottom: BADGE_BOTTOM,
                right: BADGE_RIGHT,
                zIndex: 40,
                width: 320,
            }}
        >
            <div
                style={{
                    background: "#ffffff",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 12,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column-reverse", // uitklap gaat naar boven
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ---- Koptegel (altijd zichtbaar, staat visueel onderaan) ---- */}
                <button
                    type="button"
                    onClick={handleToggle}
                    style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        flex: "0 0 auto",
                    }}
                >
                    {/* Regel 1: label + bedrag + chevron */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 6,
                            width: "100%",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: COLORS.text,
                                whiteSpace: "nowrap",
                            }}
                        >
                            Geschatte totaalbedrag:
                        </span>
                        <span
                            style={{
                                fontSize: 15,
                                fontWeight: 700,
                                color: COLORS.text,
                                flex: 1,
                                minWidth: 0,
                                wordBreak: "break-word",
                            }}
                        >
                            {totalLabel}
                        </span>
                        <img
                            src={open ? "/icons/chevron-up.svg" : "/icons/chevron-right.svg"}
                            alt=""
                            style={{ width: 16, height: 16, flex: "0 0 auto" }}
                        />
                    </div>

                    {/* Regel 2: budget-vergelijking (altijd zichtbaar) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: COLORS.mutedText,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {budget !== undefined
                                ? `Budget: ${formatBudget(budget)}`
                                : "Geen budget ingesteld"}
                        </span>
                        {budget !== undefined && priceData.totalIncVat > budget && (
                            <span
                                style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: COLORS.priceRed,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Je bent €{(priceData.totalIncVat - budget).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} boven je budget
                            </span>
                        )}
                    </div>

                    {/* Regel 3: koppelstatus + voortgangsbalk (altijd zichtbaar) */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: COLORS.green,
                                whiteSpace: "nowrap",
                                flex: "0 0 auto",
                            }}
                        >
                            {statusLabel}
                        </span>
                        <div
                            style={{
                                flex: 1,
                                height: 4,
                                borderRadius: 2,
                                background: COLORS.progressTrack,
                                overflow: "hidden",
                                minWidth: 0,
                            }}
                        >
                            <div
                                style={{
                                    height: "100%",
                                    width: `${linkStatus.percentage}%`,
                                    background: COLORS.green,
                                    borderRadius: 2,
                                    transition: `width ${ANIM_MS}ms ${ANIM_EASE}`,
                                }}
                            />
                        </div>
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: COLORS.green,
                                flex: "0 0 auto",
                            }}
                        >
                            {linkStatus.percentage}%
                        </span>
                    </div>
                </button>

                {/* ---- Uitklapbaar gedeelte (staat visueel bovenaan door column-reverse) ---- */}
                <div
                    style={{
                        height: contentHeight,
                        overflow: "hidden",
                        opacity: open ? 1 : 0,
                        transition: [
                            `height ${ANIM_MS}ms ${ANIM_EASE}`,
                            `opacity ${ANIM_MS}ms ${ANIM_EASE}`,
                        ].join(", "),
                        pointerEvents: open ? "auto" : "none",
                    }}
                >
                    <div ref={contentRef}>
                        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                            {/* Informatiebalk */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "8px 10px",
                                    background: COLORS.infoBackground,
                                    border: `1px solid ${COLORS.infoBorder}`,
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: COLORS.infoText,
                                }}
                            >
                                <img
                                    src="/icons/info.svg"
                                    alt=""
                                    style={{
                                        width: 14,
                                        height: 14,
                                        flex: "0 0 auto",
                                        filter: ICON_FILTER_INFO,
                                    }}
                                />
                                <span>Gebaseerd op adviesaantallen</span>
                            </div>

                            {/* Prijsopgave */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <span
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: COLORS.green,
                                    }}
                                >
                                    Prijsopgave
                                </span>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: COLORS.text,
                                    }}
                                >
                                    <span>Totaal (excl. BTW)</span>
                                    <span style={{ fontWeight: 700, color: COLORS.priceRed }}>
                                        {formatEuro(priceData.subtotalExVat)}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: COLORS.text,
                                    }}
                                >
                                    <span>BTW (9%)</span>
                                    <span>{formatEuro(priceData.vatAmount)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Scheidingslijn tussen content en koptegel */}
                        <div
                            style={{
                                height: 1,
                                background: COLORS.divider,
                                margin: "0 14px",
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
