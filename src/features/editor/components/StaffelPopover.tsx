"use client";

/**
 * StaffelPopover.tsx
 *
 * Herbruikbare popover voor het tonen van staffelprijzen per variant.
 * Gebruikt een React portal zodat de popover boven tabelcontent zweeft
 * zonder de rijhoogte te beïnvloeden.
 *
 * Gebruik:
 *   <StaffelPopover
 *     isOpen={openItemId === item.id}
 *     onClose={() => setOpenItemId(null)}
 *     anchorRect={anchorRect}
 *     basePrice={selectedVariant.price}
 *     bulkPrices={selectedVariant.bulkPrices}
 *   />
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BulkPriceTier } from "@/lib/db/plantTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StaffelPopoverProps = {
    isOpen: boolean;
    onClose: () => void;
    /** getBoundingClientRect() van de trigger-knop */
    anchorRect: DOMRect | null;
    /** Basisprijs excl. BTW (voor 1 stuk) */
    basePrice: number;
    /** Staffeltiers, gesorteerd op minQty */
    bulkPrices: BulkPriceTier[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type StaffelRow = {
    range: string;
    price: number;
    isBase: boolean;
    discountPct: number;
};

function buildRows(basePrice: number, bulkPrices: BulkPriceTier[]): StaffelRow[] {
    const sorted = [...bulkPrices].sort((a, b) => a.minQty - b.minQty);
    const rows: StaffelRow[] = [];

    // Basisrij: 1 tot (eerste staffel - 1)
    const firstQty = sorted[0]?.minQty ?? null;
    rows.push({
        range: firstQty ? `1 – ${firstQty - 1} stuks` : "1+ stuks",
        price: basePrice,
        isBase: true,
        discountPct: 0,
    });

    // Staffelrijen
    sorted.forEach((tier, i) => {
        const nextMinQty = sorted[i + 1]?.minQty ?? null;
        const range = nextMinQty
            ? `${tier.minQty} – ${nextMinQty - 1} stuks`
            : `${tier.minQty}+ stuks`;
        const discountPct = Math.round((1 - tier.price / basePrice) * 100);
        rows.push({ range, price: tier.price, isBase: false, discountPct });
    });

    return rows;
}

function formatPrice(value: number): string {
    return `€ ${value.toFixed(2).replace(".", ",")}`;
}

// ---------------------------------------------------------------------------
// Popover
// ---------------------------------------------------------------------------

const POPOVER_WIDTH = 400;
const POPOVER_OFFSET_Y = 10;
const VIEWPORT_MARGIN = 12;

export function StaffelPopover({
    isOpen,
    onClose,
    anchorRect,
    basePrice,
    bulkPrices,
}: StaffelPopoverProps) {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number; openUpward: boolean }>({
        top: 0,
        left: 0,
        openUpward: false,
    });

    // Herbereken positie wanneer anchorRect wijzigt of popover opent
    useEffect(() => {
        if (!isOpen || !anchorRect) return;

        const popoverHeight = 360; // schatting; scrollt anders
        const vpW = window.innerWidth;
        const vpH = window.innerHeight;

        // Horizontaal: rechts uitgelijnd met de trigger, maar binnen viewport
        let left = anchorRect.right - POPOVER_WIDTH;
        if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
        if (left + POPOVER_WIDTH > vpW - VIEWPORT_MARGIN) {
            left = vpW - POPOVER_WIDTH - VIEWPORT_MARGIN;
        }

        // Vertikaal: bij voorkeur onder trigger, anders erboven
        const spaceBelow = vpH - anchorRect.bottom;
        const openUpward = spaceBelow < popoverHeight + POPOVER_OFFSET_Y + VIEWPORT_MARGIN;
        const top = openUpward
            ? anchorRect.top - popoverHeight - POPOVER_OFFSET_Y
            : anchorRect.bottom + POPOVER_OFFSET_Y;

        setPosition({ top, left, openUpward });
    }, [isOpen, anchorRect]);

    // Sluit bij klik buiten popover
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        // setTimeout zodat de klik die de popover opende niet meteen sluit
        const timerId = setTimeout(() => document.addEventListener("mousedown", handler), 0);
        return () => {
            clearTimeout(timerId);
            document.removeEventListener("mousedown", handler);
        };
    }, [isOpen, onClose]);

    // Sluit bij scrollen
    useEffect(() => {
        if (!isOpen) return;
        const handler = () => onClose();
        window.addEventListener("scroll", handler, { passive: true, capture: true });
        return () => window.removeEventListener("scroll", handler, { capture: true });
    }, [isOpen, onClose]);

    // ESC-toets
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [isOpen, onClose]);

    if (!isOpen || !anchorRect) return null;

    const rows = buildRows(basePrice, bulkPrices);

    // Kleine pijl: horizontale positie relatief aan de anchorRect
    const arrowLeft = Math.max(
        16,
        Math.min(
            anchorRect.left + anchorRect.width / 2 - position.left,
            POPOVER_WIDTH - 32
        )
    );

    const content = (
        <div
            ref={popoverRef}
            role="dialog"
            aria-label="Staffelprijzen"
            style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: POPOVER_WIDTH,
                zIndex: 9999,
                backgroundColor: "#FFFFFF",
                borderRadius: 10,
                boxShadow: "0 4px 24px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)",
                border: "1px solid #E3E2E2",
                overflow: "hidden",
            }}
        >
            {/* Pijltje */}
            {!position.openUpward && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        top: -7,
                        left: arrowLeft,
                        width: 14,
                        height: 7,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            top: 3,
                            left: 0,
                            width: 14,
                            height: 14,
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E3E2E2",
                            transform: "rotate(45deg)",
                            borderRadius: 2,
                        }}
                    />
                </div>
            )}
            {position.openUpward && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        bottom: -7,
                        left: arrowLeft,
                        width: 14,
                        height: 7,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            bottom: 3,
                            left: 0,
                            width: 14,
                            height: 14,
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E3E2E2",
                            transform: "rotate(45deg)",
                            borderRadius: 2,
                        }}
                    />
                </div>
            )}

            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "18px 18px 12px",
                    borderBottom: "1px solid #E3E2E2",
                }}
            >
                <img
                    src="/icons/discount.svg"
                    alt=""
                    style={{ width: 22, height: 22, display: "block", flexShrink: 0, filter: "brightness(0) saturate(100%) invert(36%) sepia(13%) saturate(707%) hue-rotate(56deg) brightness(92%) contrast(86%)" }}
                />
                <span
                    style={{
                        flex: 1,
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#111111",
                        lineHeight: "1.3",
                    }}
                >
                    Staffelprijzen
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Sluit staffelprijzen"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        flexShrink: 0,
                        color: "#6B7280",
                    }}
                >
                    <img
                        src="/icons/cancel.svg"
                        alt=""
                        style={{ width: 16, height: 16, display: "block" }}
                    />
                </button>
            </div>

            {/* Body */}
            <div style={{ padding: "14px 18px 18px" }}>
                <p
                    style={{
                        fontSize: 13,
                        color: "#6B7280",
                        marginBottom: 14,
                        lineHeight: "1.5",
                    }}
                >
                    De stukprijs is afhankelijk van het aantal dat je bestelt.
                </p>

                {/* Staffeltabel */}
                <div
                    style={{
                        border: "1px solid #E3E2E2",
                        borderRadius: 8,
                        overflow: "hidden",
                    }}
                >
                    {/* Tabelheader */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 100px 110px",
                            padding: "8px 14px",
                            backgroundColor: "#EDF2EB",
                            borderBottom: "1px solid #E3E2E2",
                        }}
                    >
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#58694C" }}>Vanaf</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#58694C" }}>Stukprijs</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#58694C" }}></span>
                    </div>

                    {/* Rijen */}
                    {rows.map((row, i) => (
                        <div
                            key={i}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 100px 110px",
                                alignItems: "center",
                                padding: "11px 14px",
                                borderBottom: i < rows.length - 1 ? "1px solid #F0EFEF" : "none",
                                backgroundColor: "#FFFFFF",
                            }}
                        >
                            <span style={{ fontSize: 14, color: "#111111" }}>{row.range}</span>
                            <span style={{ fontSize: 14, fontWeight: 500, color: "#111111" }}>
                                {formatPrice(row.price)}
                            </span>
                            {row.isBase ? (
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: "#6B7280",
                                        backgroundColor: "#F0F0F0",
                                        borderRadius: 99,
                                        padding: "3px 10px",
                                        whiteSpace: "nowrap",
                                        width: "fit-content",
                                    }}
                                >
                                    Basisprijs
                                </span>
                            ) : (
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: "#008000",
                                        backgroundColor: "#DEFFDE",
                                        borderRadius: 99,
                                        padding: "3px 10px",
                                        whiteSpace: "nowrap",
                                        width: "fit-content",
                                    }}
                                >
                                    {row.discountPct}% korting
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Info-box */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        marginTop: 14,
                        padding: "11px 14px",
                        backgroundColor: "#D9EDF7",
                        borderRadius: 8,
                    }}
                >
                    <img
                        src="/icons/info.svg"
                        alt=""
                        style={{
                            width: 16,
                            height: 16,
                            display: "block",
                            flexShrink: 0,
                            marginTop: 1,
                            filter: "brightness(0) saturate(100%) invert(41%) sepia(49%) saturate(393%) hue-rotate(152deg) brightness(88%) contrast(92%)",
                        }}
                    />
                    <span style={{ fontSize: 13, color: "#31708F", lineHeight: "1.5" }}>
                        De totaalprijs wordt automatisch berekend zodra de planten aan plantvakken zijn gekoppeld in de volgende stap.
                    </span>
                </div>
            </div>
        </div>
    );

    return typeof document !== "undefined"
        ? createPortal(content, document.body)
        : null;
}

// ---------------------------------------------------------------------------
// StaffelLink — de klikbare "Staffels" trigger in de prijskolom
// ---------------------------------------------------------------------------

export type StaffelLinkProps = {
    isOpen: boolean;
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export function StaffelLink({ isOpen, onClick }: StaffelLinkProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                marginTop: 4,
            }}
        >
            <img
                src="/icons/staffels.svg"
                alt=""
                style={{ width: 13, height: 13, display: "block", flexShrink: 0 }}
            />
            <span
                style={{
                    fontSize: 12,
                    color: "#111111",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                    lineHeight: "1.3",
                }}
            >
                Staffels
            </span>
        </button>
    );
}
