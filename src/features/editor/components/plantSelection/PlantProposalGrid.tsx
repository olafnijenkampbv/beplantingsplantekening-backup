"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StaffelPopover, StaffelLink } from "@/features/editor/components/StaffelPopover";
import { PlantImg } from "@/features/editor/components/PlantImg";
import type { BulkPriceTier } from "@/lib/db/plantTypes";
import { APP_NOTIFICATIONS, useAppNotify } from "@/state/allNotifications";
import type { PlantSelectionFiltersState } from "@/features/editor/state/plantSelectionStore";
import type {
    PlantGroupKey,
    PlantSelectionAdvancedArrayFilterKey,
    PlantSelectionAdvancedFilters,
    ViewMode,
} from "@/features/editor/lib/plantSelectionDummyData";
import type { ApiPlant } from "@/lib/db/plantTypes";
import { matchesSearchQuery } from "@/features/editor/lib/plantSelectionSearch";
import { usePlantVariantStore, type ApiPlantVariant } from "@/features/editor/state/plantVariantStore";
import { explainPlantScore, scorePlant, getLabelForScore, type ScoringInput, type SuitabilityLabel } from "@/features/editor/lib/plantScoring";
import { usePlantCatalogStore } from "@/features/editor/state/plantCatalogStore";
import ProductVariantSelectionModal from "@/features/editor/components/plantSelection/ProductVariantSelectionModal";

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    green: "#58694C",
    greenLight: "#EEF0ED",
    orange: "#E94E1B",
    text: "#111111",
    muted: "#6B7280",
};


const ITEMS_PER_PAGE = 9;

// ---------------------------------------------------------------------------
// Alfabetische filter helpers
// ---------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as string[];

function getLatinInitial(botanicalName: string): string {
    return botanicalName.trim().charAt(0).toUpperCase();
}

function buildAvailableInitials(plants: ApiPlant[]): Set<string> {
    const set = new Set<string>();
    for (const p of plants) {
        const ch = getLatinInitial(p.botanicalName);
        if (ch >= "A" && ch <= "Z") set.add(ch);
    }
    return set;
}

// Map van letter → aantal planten met die beginletter (alleen beschikbare letters staan erin)
type InitialCountMap = Map<string, number>;

type AlphabetBarProps = {
    activeLetter: string | null;
    availableInitials: InitialCountMap;
    filteredCount: number;
    totalCount: number;
    onSelectLetter: (letter: string | null) => void;
};

function AlphabetBar({
    activeLetter,
    availableInitials,
    filteredCount,
    totalCount,
    onSelectLetter,
}: AlphabetBarProps) {
    return (
        <div style={{ marginTop: 16 }}>
            {/* Label + teller BOVEN het groene blok */}
            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    gap: 8,
                }}
            >
                <span
                    style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#111111",
                    }}
                >
                    Filter op beginletter
                </span>

                {activeLetter && (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                        <span style={{ fontSize: 12, color: "#111111" }}>
                            <strong>{filteredCount}</strong> van {totalCount} resultaten
                        </span>
                        <button
                            type="button"
                            onClick={() => onSelectLetter(null)}
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#58694C",
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                textDecoration: "underline",
                                whiteSpace: "nowrap",
                            }}
                        >
                            Wis filter
                        </button>
                    </div>
                )}
            </div>

            {/* Groen blok met letterknopjes */}
            <div
                style={{
                    backgroundColor: "#EDF2EB",
                    borderRadius: 8,
                    padding: "10px 12px",
                    display: "flex",
                    flexWrap: "nowrap",
                    overflowX: "auto",
                    gap: 4,
                    paddingBottom: 10,
                }}
            >
                {ALPHABET.map((letter) => {
                    const isAvailable = availableInitials.has(letter);
                    const isActive = activeLetter === letter;

                    return (
                        <button
                            key={letter}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() =>
                                isAvailable ? onSelectLetter(isActive ? null : letter) : undefined
                            }
                            style={{
                                flexShrink: 0,
                                width: 30,
                                height: 30,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 6,
                                border: "none",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: isAvailable ? "pointer" : "not-allowed",
                                transition: "background-color 120ms ease, color 120ms ease",
                                backgroundColor: isActive
                                    ? "#58694C"
                                    : isAvailable
                                        ? "#FFFFFF"
                                        : "transparent",
                                color: isActive
                                    ? "#FFFFFF"
                                    : isAvailable
                                        ? "#58694C"
                                        : "#BBBBBB",
                            }}
                        >
                            {letter}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

type PageItem = number | "ellipsis-start" | "ellipsis-end";

// Toont een window van 9 opeenvolgende pagina's rondom de actieve pagina,
// aangevuld met de eerste en laatste pagina + ellips waar nodig.
// Voorbeeld (pagina 1 van 73):  1 2 3 4 5 6 7 8 9 … 73
// Voorbeeld (pagina 10 van 73): 1 … 6 7 8 9 10 11 12 13 14 … 73
function buildPageNumbers(current: number, total: number): PageItem[] {
    const WINDOW = 9;

    if (total <= WINDOW + 1) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    // Centreer window rondom current, maar clamp aan de randen
    let windowStart = Math.max(1, current - Math.floor(WINDOW / 2));
    let windowEnd = windowStart + WINDOW - 1;

    if (windowEnd > total) {
        windowEnd = total;
        windowStart = Math.max(1, windowEnd - WINDOW + 1);
    }

    const pages: PageItem[] = [];

    if (windowStart > 1) {
        pages.push(1);
        if (windowStart > 2) pages.push("ellipsis-start");
    }

    for (let p = windowStart; p <= windowEnd; p++) pages.push(p);

    if (windowEnd < total) {
        if (windowEnd < total - 1) pages.push("ellipsis-end");
        pages.push(total);
    }

    return pages;
}

type PaginationProps = {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
};

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    const pages = buildPageNumbers(currentPage, totalPages);

    const sharedBtn: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 32,
        height: 32,
        borderRadius: 6,
        border: "none",
        backgroundColor: "transparent",
        fontSize: 14,
        fontWeight: 500,
        flexShrink: 0,
        userSelect: "none",
        transition: "background-color 120ms ease, color 120ms ease",
        padding: "0 6px",
    };

    const btnActive: React.CSSProperties = {
        ...sharedBtn,
        backgroundColor: "#58694C",
        color: "#FFFFFF",
        fontWeight: 700,
        cursor: "default",
    };

    const btnInactive: React.CSSProperties = {
        ...sharedBtn,
        color: "#58694C",
        cursor: "pointer",
    };

    const btnDisabled: React.CSSProperties = {
        ...sharedBtn,
        color: "#C0C0C0",
        cursor: "not-allowed",
    };

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 28,
                flexWrap: "wrap",
            }}
        >
            {/* Vorige */}
            <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
                style={currentPage === 1 ? btnDisabled : btnInactive}
                aria-label="Vorige pagina"
            >
                ‹
            </button>

            {pages.map((page, idx) => {
                if (page === "ellipsis-start" || page === "ellipsis-end") {
                    return (
                        <span
                            key={page}
                            style={{ fontSize: 14, color: "#6B7280", padding: "0 2px", lineHeight: "36px" }}
                        >
                            …
                        </span>
                    );
                }
                return (
                    <button
                        key={`${page}-${idx}`}
                        type="button"
                        onClick={() => page !== currentPage && onPageChange(page)}
                        style={page === currentPage ? btnActive : btnInactive}
                        aria-label={`Pagina ${page}`}
                        aria-current={page === currentPage ? "page" : undefined}
                    >
                        {page}
                    </button>
                );
            })}

            {/* Volgende */}
            <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
                style={currentPage === totalPages ? btnDisabled : btnInactive}
                aria-label="Volgende pagina"
            >
                ›
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Keurmerk logos
// ---------------------------------------------------------------------------

function getKeurmerkImages(keurmerken: string[]): string[] {
    const images = new Set<string>();
    for (const k of keurmerken) {
        const v = k.trim();
        if (v.toUpperCase().startsWith("MPS")) {
            images.add("/images/keurmerken/MPS.png");
        } else if (v === "PlanetProof") {
            images.add("/images/keurmerken/planet-proof.svg");
        } else if (v === "NL greenlabel") {
            images.add("/images/keurmerken/nl-greenlabel.png");
        } else if (v === "Groenkeur") {
            images.add("/images/keurmerken/groenkeur.png");
        } else if (v === "Skal" || v === "Biologisch") {
            images.add("/images/keurmerken/skal-biologisch.png");
        } else if (v === "PP GK") {
            images.add("/images/keurmerken/planet-proof.svg");
            images.add("/images/keurmerken/groenkeur.png");
        }
    }
    return [...images];
}

const KEURMERK_ALT: Record<string, string> = {
    "/images/keurmerken/MPS.png": "MPS",
    "/images/keurmerken/planet-proof.svg": "PlanetProof",
    "/images/keurmerken/nl-greenlabel.png": "NL Greenlabel",
    "/images/keurmerken/groenkeur.png": "Groenkeur",
    "/images/keurmerken/skal-biologisch.png": "Skal / Biologisch",
};

function KeurmerkLogos({ images }: { images: string[] }) {
    return (
        <div className="flex items-center gap-2" style={{ minHeight: 20 }}>
            {images.map((src) => (
                <img
                    key={src}
                    src={src}
                    alt={KEURMERK_ALT[src] ?? "Keurmerk"}
                    style={{ height: 16, width: "auto", maxWidth: 56, display: "block", objectFit: "contain" }}
                />
            ))}
        </div>
    );
}

const GREEN_ICON_FILTER =
    "brightness(0) saturate(100%) invert(36%) sepia(13%) saturate(707%) hue-rotate(56deg) brightness(92%) contrast(86%)";


function formatVariantPrice(price: number): string {
    if (!price || price <= 0) return "";
    return `€${price.toFixed(2).replace(".", ",")} p/st`;
}

function formatFromPrice(price: number): string {
    if (!price || price <= 0) return "";
    return `Vanaf €${price.toFixed(2).replace(".", ",")} p/st`;
}

const SEARCH_ICON_FILTER =
    "brightness(0) saturate(100%) invert(66%) sepia(1%) saturate(0%) hue-rotate(179deg) brightness(91%) contrast(86%)";

function AvailabilityBadge(props: { stockLabel: string }) {
    const { stockLabel } = props;
    const isDirectlyAvailable = stockLabel.toLowerCase().includes("op voorraad");

    return (
        <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-[6px] text-[11px] font-semibold"
            style={{
                backgroundColor: isDirectlyAvailable ? "#DEFFDE" : "#FDFFC6",
                color: isDirectlyAvailable ? "#008000" : "#807300",
            }}
        >
            <span className="inline-flex items-center gap-1">
                <span
                    className="rounded-full"
                    style={{
                        width: 7,
                        height: 7,
                        backgroundColor: isDirectlyAvailable ? "#008000" : "#807300",
                    }}
                />
                {!isDirectlyAvailable ? (
                    <span
                        className="rounded-full"
                        style={{
                            width: 7,
                            height: 7,
                            backgroundColor: "#807300",
                            marginLeft: -3,
                        }}
                    />
                ) : null}
            </span>
            <span>{stockLabel}</span>
        </span>
    );
}



const SUITABILITY_CONFIG: Record<SuitabilityLabel, { text: string; icon: string; green: boolean }> = {
    "zeer-geschikt":    { text: "Zeer geschikt",    icon: "/icons/dubble-check.svg", green: true },
    "geschikt":         { text: "Geschikt",          icon: "/icons/check-icon.svg",   green: true },
    "goede-aanvulling": { text: "Goede aanvulling",  icon: "/icons/plus.svg",         green: false },
};

function SuitabilityBadge({
    label,
    isOpen,
    onClick,
}: {
    label: SuitabilityLabel;
    isOpen?: boolean;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
    const { text, icon, green } = SUITABILITY_CONFIG[label];
    return (
        <button
            type="button"
            onClick={onClick}
            onPointerDown={(event) => event.stopPropagation()}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            title={`Waarom ${text.toLowerCase()}?`}
            className="inline-flex items-center gap-[5px] rounded-full px-3 py-[6px] text-[11px] font-semibold whitespace-nowrap"
            style={{
                backgroundColor: green ? "#DEFFDE" : "#FDFFC6",
                color: green ? "#008000" : "#807300",
                border: "none",
                cursor: "pointer",
            }}
        >
            {green ? (
                // dubble-check.svg en check-icon.svg hebben al een groene cirkel + witte check ingebakken
                <img src={icon} alt="" style={{ width: 13, height: 13, display: "block", flexShrink: 0 }} />
            ) : (
                // plus.svg heeft witte strokes: brightness(0) maakt ze zwart, filter kleurt naar #807300
                <img
                    src={icon}
                    alt=""
                    style={{
                        width: 13,
                        height: 13,
                        display: "block",
                        flexShrink: 0,
                        filter: "brightness(0) saturate(100%) invert(37%) sepia(100%) saturate(450%) hue-rotate(16deg) brightness(60%)",
                    }}
                />
            )}
            {text}
        </button>
    );
}

function SuitabilityExplanationPopover(props: {
    plant: ApiPlant;
    label: SuitabilityLabel;
    scoringInput: ScoringInput;
    anchorRect: DOMRect | null;
    onClose: () => void;
}) {
    const { plant, label, scoringInput, anchorRect, onClose } = props;
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const explanation = useMemo(
        () => explainPlantScore(plant, scoringInput),
        [plant, scoringInput]
    );

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (popoverRef.current?.contains(target)) return;
            onClose();
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        const handleScroll = () => onClose();

        const timerId = window.setTimeout(() => document.addEventListener("pointerdown", handlePointerDown), 0);
        document.addEventListener("keydown", handleEscape);
        window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
        return () => {
            window.clearTimeout(timerId);
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
            window.removeEventListener("scroll", handleScroll, { capture: true });
        };
    }, [onClose]);

    if (!anchorRect || typeof document === "undefined") return null;

    const { text } = SUITABILITY_CONFIG[label];
    const iconByLabel: Record<string, string> = {
        Standplaats: "/icons/standplaats.svg",
        Grondsoort: "/icons/grondsoort.svg",
        Hoogtewerking: "/icons/volwassen-hoogte.svg",
        Keurmerken: "/icons/keurmerk.svg",
    };
    const statusForScore = (score: number): { label: string; color: string; isMatch: boolean } => {
        if (score >= 75) return { label: "Match", color: "#008000", isMatch: true };
        if (score >= 40) return { label: "Goede aanvulling", color: "#FF8A00", isMatch: false };
        return { label: "Geen match", color: "#B42318", isMatch: false };
    };
    const width = 400;
    const margin = 12;
    const left = Math.min(
        Math.max(anchorRect.right - width, margin),
        window.innerWidth - width - margin
    );
    const estimatedHeight = 380;
    const openUpward = window.innerHeight - anchorRect.bottom < estimatedHeight + margin;
    const top = openUpward
        ? Math.max(margin, anchorRect.top - estimatedHeight - 8)
        : anchorRect.bottom + 8;
    const arrowLeft = Math.max(18, Math.min(anchorRect.left + anchorRect.width / 2 - left, width - 34));

    return createPortal(
        <div
            ref={popoverRef}
            role="dialog"
            aria-label={`Uitleg ${text}`}
            style={{
                position: "fixed",
                top,
                left,
                width,
                backgroundColor: "#FFFFFF",
                borderRadius: 10,
                boxShadow: "0 4px 24px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)",
                border: "1px solid #E3E2E2",
                overflow: "hidden",
                zIndex: 9999,
            }}
        >
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    left: arrowLeft,
                    top: openUpward ? undefined : -7,
                    bottom: openUpward ? -7 : undefined,
                    width: 14,
                    height: 7,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        top: openUpward ? undefined : 3,
                        bottom: openUpward ? 3 : undefined,
                        width: 14,
                        height: 14,
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E3E2E2",
                        transform: "rotate(45deg)",
                        borderRadius: 2,
                    }}
                />
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px 11px",
                    borderBottom: "1px solid #E3E2E2",
                }}
            >
                <div
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        backgroundColor: COLORS.orange,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <img
                        src="/icons/idea.svg"
                        alt=""
                        style={{
                            width: 15,
                            height: 15,
                            display: "block",
                            filter: "brightness(0) invert(1)",
                        }}
                    />
                </div>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "#111111", lineHeight: "1.3" }}>
                    Waarom is dit {text.toLowerCase()}?
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Sluit uitleg"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        flexShrink: 0,
                    }}
                >
                    <img src="/icons/cancel.svg" alt="" style={{ width: 13, height: 13, display: "block" }} />
                </button>
            </div>

            <div style={{ padding: "18px 20px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
                    <p style={{ flex: 1, fontSize: 14, color: "#111111", lineHeight: "1.18", margin: 0 }}>
                        De <span style={{ fontWeight: 600 }}>{plant.botanicalName}</span> sluit goed aan op jouw ingevulde wensen.
                    </p>
                    <div
                        style={{
                            display: "inline-flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: 68,
                            minHeight: 54,
                            borderRadius: 8,
                            padding: "8px 12px",
                            backgroundColor: "#DEFFDE",
                            flexShrink: 0,
                        }}
                    >
                        <span
                            style={{
                                color: "#008000",
                                fontSize: 18,
                                fontWeight: 700,
                                lineHeight: 1,
                            }}
                        >
                            {Math.round(explanation.totalScore ?? 100)}%
                        </span>
                        <span style={{ marginTop: 3, fontSize: 13, fontWeight: 400, color: "#111111", lineHeight: 1 }}>
                            match
                        </span>
                    </div>
                </div>

                <div style={{ height: 1, backgroundColor: "#111111", opacity: 0.65, margin: "18px 0" }} />

                <div style={{ fontSize: 12, fontWeight: 700, color: "#111111", marginBottom: 16 }}>
                    Match op basis van jouw keuzes
                </div>

                {explanation.items.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {explanation.items.map((item) => {
                            const status = statusForScore(item.score);
                            return (
                                <div
                                    key={item.label}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "38px minmax(150px, 1fr) auto",
                                        alignItems: "center",
                                        gap: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 38,
                                            height: 38,
                                            borderRadius: 5,
                                            backgroundColor: "#F1F3EF",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <img
                                            src={iconByLabel[item.label] ?? "/icons/idea.svg"}
                                            alt=""
                                            style={{
                                                width: 23,
                                                height: 23,
                                                display: "block",
                                                filter: "brightness(0) saturate(100%) invert(37%) sepia(13%) saturate(650%) hue-rotate(57deg) brightness(91%) contrast(87%)",
                                            }}
                                        />
                                    </div>

                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111111", lineHeight: "1.2" }}>
                                            {item.label === "Hoogtewerking" ? "Volwassen hoogte" : item.label}
                                        </div>
                                        <div style={{ marginTop: 1, fontSize: 12, color: "#111111", lineHeight: "1.25" }}>
                                            {item.value}
                                        </div>
                                        {item.preference && !status.isMatch ? (
                                            <div
                                                style={{
                                                    marginTop: 3,
                                                    fontSize: 11,
                                                    color: "#7B7B7B",
                                                    lineHeight: "1.25",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                Jouw voorkeur: {item.preference}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 7,
                                            color: status.color,
                                            fontSize: 13,
                                            fontWeight: 700,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {status.isMatch ? (
                                            <img
                                                src="/icons/check-icon.svg"
                                                alt=""
                                                style={{ width: 13, height: 13, display: "block", flexShrink: 0 }}
                                            />
                                        ) : (
                                            <span
                                                aria-hidden
                                                style={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: "50%",
                                                    border: `2px solid ${status.color}`,
                                                    flexShrink: 0,
                                                }}
                                            />
                                        )}
                                        <span>{status.label}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        </div>,
        document.body
    );
}

function SearchFilterChip(props: {
    label: string;
    onRemove: () => void;
}) {
    const { label, onRemove } = props;

    return (
        <span
            className="inline-flex items-center gap-3 rounded-[6px] px-4 py-2 text-[14px]"
            style={{
                backgroundColor: "#EEF0ED",
                color: "#111111",
            }}
        >
            <span className="font-semibold">{label}</span>
            <button
                type="button"
                onClick={onRemove}
                className="cursor-pointer"
                style={{ lineHeight: 1 }}
            >
                <img
                    src="/icons/cancel.svg"
                    alt=""
                    style={{
                        width: 12,
                        height: 12,
                        display: "block",
                    }}
                />
            </button>
        </span>
    );
}

function SearchModeGridCard(props: {
    plant: ApiPlant;
    sizeLabel: string;
    variantPrice: number;
    variantInStock: boolean;
    bulkPrices: BulkPriceTier[];
    onAddToPlantList: (plant: ApiPlant, size: string, fixedSize?: boolean, bulkPrices?: BulkPriceTier[]) => void;
}) {
    const { plant, sizeLabel, variantPrice, variantInStock, bulkPrices, onAddToPlantList } = props;
    const notify = useAppNotify();
    const [isAdded, setIsAdded] = useState(false);
    const [isCartHovered, setIsCartHovered] = useState(false);
    const [staffelAnchorRect, setStaffelAnchorRect] = useState<DOMRect | null>(null);

    const handleToggleStaffel = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setStaffelAnchorRect((prev) => prev ? null : rect);
    }, []);
    const stockLabel = variantInStock ? "Op voorraad" : "Binnen een week leverbaar";

    const handleAddToPlantList = () => {
        onAddToPlantList({ ...plant, pricePerPiece: variantPrice }, sizeLabel, true, bulkPrices);
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(plant.botanicalName));
        setIsAdded(true);

        window.setTimeout(() => {
            setIsAdded(false);
        }, 3200);
    };

    return (
        <div
            className="overflow-hidden rounded-[8px] border"
            style={{
                backgroundColor: "#FFFFFF",
                borderColor: COLORS.border,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
        >
            <div
                className="relative overflow-hidden bg-[#F1F1EE]"
                style={{ aspectRatio: "1 / 0.82" }}
            >
                <PlantImg
                    src={plant.imageUrl}
                    alt={plant.botanicalName}
                    className="block h-full w-full"
                />

                <div className="absolute right-2 top-2">
                    <AvailabilityBadge stockLabel={stockLabel} />
                </div>
            </div>

            <div className="flex min-h-[132px] flex-col p-3">
                <div
                    className="text-[15px] font-semibold leading-[1.35]"
                    style={{ color: COLORS.text }}
                >
                    {plant.botanicalName}
                </div>

                <div
                    className="mt-1 text-[13px] leading-[1.35]"
                    style={{ color: COLORS.muted }}
                >
                    {plant.dutchName}
                </div>

                {sizeLabel ? (
                    <div
                        className="mt-3 text-[13px] leading-[1.35]"
                        style={{ color: COLORS.text }}
                    >
                        {sizeLabel}
                    </div>
                ) : null}

                <div className="mt-auto pt-2">
                    <KeurmerkLogos images={getKeurmerkImages(plant.keurmerken)} />
                    <div className="mt-2 flex items-end justify-between gap-3">
                        <div>
                            {formatVariantPrice(variantPrice) ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                        className="text-[13px] leading-[1.35]"
                                        style={{ color: "#FF0000" }}
                                    >
                                        {formatVariantPrice(variantPrice)}
                                    </span>
                                    {bulkPrices.length > 0 && (
                                        <StaffelLink
                                            isOpen={!!staffelAnchorRect}
                                            onClick={handleToggleStaffel}
                                        />
                                    )}
                                </div>
                            ) : <div />}
                        </div>

                        <button
                            type="button"
                            onClick={handleAddToPlantList}
                            onMouseEnter={() => setIsCartHovered(true)}
                            onMouseLeave={() => setIsCartHovered(false)}
                            className="flex shrink-0 cursor-pointer items-center justify-center rounded-[6px]"
                            style={{
                                width: 40,
                                height: 40,
                                backgroundColor: isAdded ? "#008000" : isCartHovered ? "#BF3D12" : COLORS.orange,
                                transition: "background-color 220ms ease, transform 220ms ease",
                                transform: isAdded ? "scale(1.06)" : "scale(1)",
                            }}
                        >
                            <img
                                src={isAdded ? "/icons/check.svg" : "/icons/add-to-cart.svg"}
                                alt=""
                                style={{
                                    width: isAdded ? 20 : 16,
                                    height: isAdded ? 20 : 16,
                                    display: "block",
                                    filter: "brightness(0) invert(1)",
                                }}
                            />
                        </button>
                    </div>
                </div>
            </div>
            <StaffelPopover
                isOpen={!!staffelAnchorRect}
                onClose={() => setStaffelAnchorRect(null)}
                anchorRect={staffelAnchorRect}
                basePrice={variantPrice}
                bulkPrices={bulkPrices}
            />
        </div>
    );
}

function SearchModeListCard(props: {
    plant: ApiPlant;
    sizeLabel: string;
    variantPrice: number;
    variantInStock: boolean;
    bulkPrices: BulkPriceTier[];
    onAddToPlantList: (plant: ApiPlant, size: string, fixedSize?: boolean, bulkPrices?: BulkPriceTier[]) => void;
}) {
    const { plant, sizeLabel, variantPrice, variantInStock, bulkPrices, onAddToPlantList } = props;
    const notify = useAppNotify();
    const [isAdded, setIsAdded] = useState(false);
    const [isCartHovered, setIsCartHovered] = useState(false);
    const [staffelAnchorRect, setStaffelAnchorRect] = useState<DOMRect | null>(null);

    const handleToggleStaffel = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setStaffelAnchorRect((prev) => prev ? null : rect);
    }, []);
    const stockLabel = variantInStock ? "Op voorraad" : "Binnen een week leverbaar";

    const handleAddToPlantList = () => {
        onAddToPlantList({ ...plant, pricePerPiece: variantPrice }, sizeLabel, true, bulkPrices);
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(plant.botanicalName));
        setIsAdded(true);

        window.setTimeout(() => {
            setIsAdded(false);
        }, 3200);
    };

    return (
        <div
            className="flex items-stretch gap-5 rounded-[8px] border p-4"
            style={{
                backgroundColor: "#FFFFFF",
                borderColor: COLORS.border,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                minHeight: 184,
            }}
        >
            <div
                className="shrink-0 overflow-hidden rounded-[6px] bg-[#F1F1EE]"
                style={{
                    width: 168,
                    height: 168,
                }}
            >
                <PlantImg
                    src={plant.imageUrl}
                    alt={plant.botanicalName}
                    className="block h-full w-full"
                />
            </div>

            <div className="flex min-w-0 flex-1 items-stretch justify-between gap-6">
                <div className="flex min-w-0 flex-1 flex-col">
                    <div
                        className="text-[18px] font-semibold leading-[1.35]"
                        style={{ color: COLORS.text }}
                    >
                        {plant.botanicalName}
                    </div>

                    <div
                        className="mt-1 text-[14px] leading-[1.35]"
                        style={{ color: COLORS.muted }}
                    >
                        {plant.dutchName}
                    </div>

                    {sizeLabel ? (
                        <div
                            className="mt-2 text-[13px] leading-[1.35]"
                            style={{ color: COLORS.text }}
                        >
                            {sizeLabel}
                        </div>
                    ) : null}

                    {formatVariantPrice(variantPrice) ? (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span
                                className="text-[13px] leading-[1.35]"
                                style={{ color: "#FF0000" }}
                            >
                                {formatVariantPrice(variantPrice)}
                            </span>
                            {bulkPrices.length > 0 && (
                                <StaffelLink
                                    isOpen={!!staffelAnchorRect}
                                    onClick={handleToggleStaffel}
                                />
                            )}
                        </div>
                    ) : null}

                    <div className="mt-auto pt-1">
                        <KeurmerkLogos images={getKeurmerkImages(plant.keurmerken)} />
                    </div>
                </div>

                <div className="flex shrink-0 flex-col items-start justify-center gap-4">
                    <AvailabilityBadge stockLabel={stockLabel} />

                    <button
                        type="button"
                        onClick={handleAddToPlantList}
                        onMouseEnter={() => setIsCartHovered(true)}
                        onMouseLeave={() => setIsCartHovered(false)}
                        className="flex cursor-pointer items-center gap-2 rounded-[6px] px-4"
                        style={{
                            height: 44,
                            backgroundColor: isAdded ? "#008000" : isCartHovered ? "#BF3D12" : COLORS.orange,
                            color: "#FFFFFF",
                            transition: "background-color 220ms ease, transform 220ms ease",
                            transform: isAdded ? "scale(1.03)" : "scale(1)",
                        }}
                    >
                        <img
                            src={isAdded ? "/icons/check.svg" : "/icons/add-to-cart.svg"}
                            alt=""
                            style={{
                                width: isAdded ? 22 : 18,
                                height: isAdded ? 22 : 18,
                                display: "block",
                                filter: "brightness(0) invert(1)",
                            }}
                        />
                        <span className="text-[13px] font-semibold text-white">
                            {isAdded ? "Toegevoegd" : "Toevoegen aan plantenlijst"}
                        </span>
                    </button>
                </div>
            </div>
            <StaffelPopover
                isOpen={!!staffelAnchorRect}
                onClose={() => setStaffelAnchorRect(null)}
                anchorRect={staffelAnchorRect}
                basePrice={variantPrice}
                bulkPrices={bulkPrices}
            />
        </div>
    );
}

function DefaultPlantCard(props: {
    plant: ApiPlant;
    viewMode: ViewMode;
    suitabilityLabel: SuitabilityLabel | null;
    scoringInput: ScoringInput;
    onAddToPlantList: (plant: ApiPlant, size?: string, fixedSize?: boolean, bulkPrices?: BulkPriceTier[]) => void;
}) {
    const { plant, viewMode, suitabilityLabel, scoringInput, onAddToPlantList } = props;
    const notify = useAppNotify();
    const [isAdded, setIsAdded] = useState(false);
    const [isCartHovered, setIsCartHovered] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [suitabilityAnchorRect, setSuitabilityAnchorRect] = useState<DOMRect | null>(null);

    // Haal varianten op voor deze plant (pre-fetch zodra de kaart verschijnt)
    const variantState = usePlantVariantStore((s) => s.cache[plant.id]);
    const fetchVariants = usePlantVariantStore((s) => s.fetchVariants);

    useEffect(() => {
        fetchVariants(plant.id);
    }, [plant.id, fetchVariants]);

    const variantsLoaded = variantState?.status === "success";
    const variants = variantsLoaded ? variantState.variants : [];
    const isVariantsLoading = variantState?.status === "loading" || variantState?.status === "idle" || !variantState;
    const isSingleVariant = variantsLoaded && variants.length === 1;
    const isMultiVariant  = variantsLoaded && variants.length > 1;
    const hasNoVariants   = variantsLoaded && variants.length === 0;
    const minPrice = isMultiVariant
        ? Math.min(...variants.map((v) => v.price))
        : variants[0]?.price ?? plant.pricePerPiece;

    const stockLabel = plant.inStock ? "Op voorraad" : "Binnen een week leverbaar";

    // Direct toevoegen — alleen voor single-variant plants
    const handleDirectAdd = () => {
        if (!isSingleVariant && !hasNoVariants) return;
        const variant = variants[0] ?? null;
        const updatedPlant = variant ? { ...plant, pricePerPiece: variant.price } : plant;
        const sizeLabel    = variant?.sizeLabel ?? "";
        onAddToPlantList(updatedPlant, sizeLabel || undefined, !!sizeLabel, variant?.bulkPrices ?? []);
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(plant.botanicalName));
        setIsAdded(true);
        window.setTimeout(() => setIsAdded(false), 3200);
    };

    // Toevoegen vanuit de modal — voor multi-variant plants
    // selectedImageUrl = de foto die de gebruiker in de carousel heeft gekozen
    const handleModalAdd = (sizeLabel: string, price: number, selectedImageUrl: string, bulkPrices: BulkPriceTier[]) => {
        const updatedPlant = { ...plant, pricePerPiece: price, imageUrl: selectedImageUrl };
        onAddToPlantList(updatedPlant, sizeLabel, false, bulkPrices); // fixedSize=false: dropdown blijft beschikbaar
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(plant.botanicalName));
        setIsAdded(true);
        window.setTimeout(() => setIsAdded(false), 3200);
        // Modal sluit zichzelf na zijn eigen feedback-animatie
    };

    const handleCartClick = () => {
        if (isSingleVariant || hasNoVariants) {
            handleDirectAdd();
        } else {
            // Multi-variant OF nog laden: open de modal
            setIsModalOpen(true);
        }
    };

    const handleToggleSuitability = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setSuitabilityAnchorRect((prev) => prev ? null : rect);
    }, []);

    // ── Maatvoering-blok (boven keurmerken) ─────────────────────────────────
    const renderSizeInfo = () => {
        if (isMultiVariant) {
            return (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
                    className="cursor-pointer text-[14px] underline underline-offset-2"
                    style={{ color: COLORS.text, background: "none", border: "none", padding: 0 }}
                >
                    Bekijk de {variants.length} maten
                </button>
            );
        }
        if (isSingleVariant && variants[0].sizeLabel) {
            return (
                <div className="text-[13px]" style={{ color: COLORS.text }}>
                    {variants[0].sizeLabel}
                </div>
            );
        }
        return null;
    };

    // ── Prijs-blok (onder keurmerken) ────────────────────────────────────────
    const renderPrice = () => {
        if (isMultiVariant) {
            return (
                <div className="text-[13px]" style={{ color: "#FF0000" }}>
                    {formatFromPrice(minPrice)}
                </div>
            );
        }
        if (isSingleVariant) {
            return (
                <div className="text-[13px]" style={{ color: "#FF0000" }}>
                    {formatVariantPrice(variants[0].price)}
                </div>
            );
        }
        // Laden / geen varianten: voorraadstatus als fallback
        return (
            <div className="text-[12px]" style={{ color: COLORS.orange }}>
                {stockLabel}
            </div>
        );
    };

    // ── LISTWEERGAVE ─────────────────────────────────────────────────────────
    if (viewMode === "list") {
        return (
            <>
                <div
                    className="flex items-stretch gap-4 rounded-[8px] border p-3"
                    style={{
                        backgroundColor: "#FFFFFF",
                        borderColor: COLORS.border,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        minHeight: 166,
                    }}
                >
                    <div
                        className="relative shrink-0 overflow-hidden rounded-[6px] bg-[#F1F1EE]"
                        style={{ width: 140, height: 140 }}
                    >
                        <PlantImg
                            src={plant.imageUrl}
                            alt={plant.botanicalName}
                            className="block h-full w-full"
                        />
                    </div>

                    <div className="flex min-w-0 flex-1 items-stretch justify-between gap-4">
                        <div className="flex min-w-0 flex-1 flex-col">
                            <div
                                className="text-[16px] font-semibold leading-[1.35]"
                                style={{ color: COLORS.text }}
                            >
                                {plant.botanicalName}
                            </div>
                            <div className="mt-1 text-[13px]" style={{ color: COLORS.muted }}>
                                {plant.dutchName}
                            </div>
                            {renderSizeInfo() && (
                                <div className="mt-2">{renderSizeInfo()}</div>
                            )}
                            <div className="mt-auto flex flex-col gap-1 pt-2">
                                <KeurmerkLogos images={getKeurmerkImages(plant.keurmerken)} />
                                {renderPrice()}
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end justify-center gap-3">
                            {suitabilityLabel ? (
                                <SuitabilityBadge
                                    label={suitabilityLabel}
                                    isOpen={!!suitabilityAnchorRect}
                                    onClick={handleToggleSuitability}
                                />
                            ) : null}
                            <button
                                type="button"
                                className="flex cursor-pointer items-center gap-2 rounded-[6px] px-4"
                                style={{
                                    height: 44,
                                    backgroundColor: isAdded ? "#008000" : isCartHovered ? "#BF3D12" : COLORS.orange,
                                    color: "#FFFFFF",
                                    transition: "background-color 220ms ease, transform 220ms ease",
                                    transform: isAdded ? "scale(1.03)" : "scale(1)",
                                }}
                                onClick={handleCartClick}
                                onMouseEnter={() => setIsCartHovered(true)}
                                onMouseLeave={() => setIsCartHovered(false)}
                            >
                                <img
                                    src={isAdded ? "/icons/check.svg" : "/icons/add-to-cart.svg"}
                                    alt=""
                                    style={{
                                        width: isAdded ? 22 : 18,
                                        height: isAdded ? 22 : 18,
                                        display: "block",
                                        filter: "brightness(0) invert(1)",
                                    }}
                                />
                                <span className="whitespace-nowrap text-[13px] font-semibold text-white">
                                    {isAdded ? "Toegevoegd" : "Toevoegen aan plantenlijst"}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {isModalOpen && (
                    <ProductVariantSelectionModal
                        name={plant.botanicalName}
                        dutchName={plant.dutchName}
                        imageUrl={plant.imageUrl}
                        additionalImageUrls={plant.additionalImageUrls}
                        keurmerken={plant.keurmerken}
                        variants={variants}
                        isLoading={isVariantsLoading}
                        onAdd={handleModalAdd}
                        onClose={() => setIsModalOpen(false)}
                    />
                )}
                {suitabilityLabel && suitabilityAnchorRect ? (
                    <SuitabilityExplanationPopover
                        plant={plant}
                        label={suitabilityLabel}
                        scoringInput={scoringInput}
                        anchorRect={suitabilityAnchorRect}
                        onClose={() => setSuitabilityAnchorRect(null)}
                    />
                ) : null}
            </>
        );
    }

    // ── GRIDWEERGAVE ─────────────────────────────────────────────────────────
    return (
        <>
            <div
                className="overflow-hidden rounded-[8px] border"
                style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: COLORS.border,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
            >
                <div
                    className="relative overflow-hidden bg-[#F1F1EE]"
                    style={{ aspectRatio: "1 / 0.82" }}
                >
                    <PlantImg
                        src={plant.imageUrl}
                        alt={plant.botanicalName}
                        className="block h-full w-full"
                    />
                    {suitabilityLabel ? (
                        <div className="absolute right-2 top-2">
                            <SuitabilityBadge
                                label={suitabilityLabel}
                                isOpen={!!suitabilityAnchorRect}
                                onClick={handleToggleSuitability}
                            />
                        </div>
                    ) : null}
                </div>

                <div className="p-3">
                    <div
                        className="text-[15px] font-semibold leading-[1.2]"
                        style={{ color: COLORS.text }}
                    >
                        {plant.botanicalName}
                    </div>
                    <div className="mt-[2px] text-[13px]" style={{ color: COLORS.muted }}>
                        {plant.dutchName}
                    </div>

                    {renderSizeInfo() && (
                        <div className="mt-2">{renderSizeInfo()}</div>
                    )}

                    <div className="mt-2">
                        <KeurmerkLogos images={getKeurmerkImages(plant.keurmerken)} />
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            {renderPrice()}
                        </div>

                        <button
                            type="button"
                            className="flex shrink-0 cursor-pointer items-center justify-center rounded-[6px]"
                            style={{
                                width: 40,
                                height: 40,
                                backgroundColor: isAdded ? "#008000" : isCartHovered ? "#BF3D12" : COLORS.orange,
                                transition: "background-color 220ms ease, transform 220ms ease",
                                transform: isAdded ? "scale(1.06)" : "scale(1)",
                            }}
                            onClick={handleCartClick}
                            onMouseEnter={() => setIsCartHovered(true)}
                            onMouseLeave={() => setIsCartHovered(false)}
                        >
                            <img
                                src={isAdded ? "/icons/check.svg" : "/icons/add-to-cart.svg"}
                                alt=""
                                style={{
                                    width: isAdded ? 20 : 16,
                                    height: isAdded ? 20 : 16,
                                    display: "block",
                                    filter: "brightness(0) invert(1)",
                                }}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <ProductVariantSelectionModal
                    name={plant.botanicalName}
                    dutchName={plant.dutchName}
                    imageUrl={plant.imageUrl}
                    additionalImageUrls={plant.additionalImageUrls}
                    keurmerken={plant.keurmerken}
                    variants={variants}
                    isLoading={isVariantsLoading}
                    onAdd={handleModalAdd}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
            {suitabilityLabel && suitabilityAnchorRect ? (
                <SuitabilityExplanationPopover
                    plant={plant}
                    label={suitabilityLabel}
                    scoringInput={scoringInput}
                    anchorRect={suitabilityAnchorRect}
                    onClose={() => setSuitabilityAnchorRect(null)}
                />
            ) : null}
        </>
    );
}

type PlantProposalGridProps = {
    title: string;
    resultsCount: number;
    currentPage: number;
    totalPages: number;
    plants: ApiPlant[];
    viewMode: ViewMode;
    sortValue: string;
    selectedGroup: PlantGroupKey;
    filters: PlantSelectionFiltersState;
    advancedFilters: PlantSelectionAdvancedFilters;
    scoringInput: ScoringInput;
    onChangeSort: (value: string) => void;
    onChangeViewMode: (mode: ViewMode) => void;
    onAddToPlantList: (plant: ApiPlant, size?: string, fixedSize?: boolean, bulkPrices?: BulkPriceTier[]) => void;
    onRemoveFilterChip: (
        key: PlantSelectionAdvancedArrayFilterKey | keyof PlantSelectionFiltersState,
        value?: string
    ) => void;
    onClearAllFilters: () => void;
    onLoadMoreFromApi: () => void;
    /** Called (debounced) when the user types in the plant-name search box */
    onSearchQueryChange: (q: string) => void;
};

export default function PlantProposalGrid(props: PlantProposalGridProps) {
    const {
        title,
        resultsCount,
        currentPage,
        totalPages,
        plants,
        viewMode,
        sortValue,
        selectedGroup,
        filters,
        advancedFilters,
        scoringInput,
        onChangeSort,
        onChangeViewMode,
        onAddToPlantList,
        onRemoveFilterChip,
        onClearAllFilters,
        onLoadMoreFromApi,
        onSearchQueryChange,
    } = props;

    const isSearchMode = selectedGroup === "zoek-zelf";
    const catalogFilters = usePlantCatalogStore((s) => s.filters);
    const [uiPage, setUiPage] = useState(1);
    const [initialLetterFilter, setInitialLetterFilter] = useState<string | null>(null);
    const [plantNameQuery, setPlantNameQuery] = useState("");
    const [sizeQuery, setSizeQuery] = useState("");
    const [isPlantNameSearchFocused, setIsPlantNameSearchFocused] = useState(false);
    const [isSizeSearchFocused, setIsSizeSearchFocused] = useState(false);

    const variantCache = usePlantVariantStore((s) => s.cache);
    const fetchVariants = usePlantVariantStore((s) => s.fetchVariants);

    // Pre-fetch variants for all loaded plants in search mode so sizeQuery filtering works.
    useEffect(() => {
        if (!isSearchMode) return;
        plants.forEach((p) => fetchVariants(p.id));
    }, [isSearchMode, plants, fetchVariants]);

    // Debounce the plant-name search so the API is called 300 ms after the user
    // stops typing instead of on every keystroke.
    useEffect(() => {
        if (!isSearchMode) return;
        const timer = setTimeout(() => {
            onSearchQueryChange(plantNameQuery);
        }, 300);
        return () => clearTimeout(timer);
    // onSearchQueryChange is stable (Zustand action), no need in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSearchMode, plantNameQuery]);

    useEffect(() => {
        setUiPage(1);
        setInitialLetterFilter(null);
    // plants wordt bewust NIET meegenomen: het prop verandert ook wanneer
    // onLoadMoreFromApi() meer data toevoegt. Categorie-wissels zijn al
    // gedekt door selectedGroup, title en filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, viewMode, sortValue, plantNameQuery, sizeQuery, filters, advancedFilters, selectedGroup]);

    const chips = useMemo(() => {
        const nextChips: Array<{
            key:
            | PlantSelectionAdvancedArrayFilterKey
            | keyof PlantSelectionFiltersState;
            label: string;
            value?: string;
        }> = [];

        if (filters.opVoorraad) {
            nextChips.push({ key: "opVoorraad", label: "Op voorraad" });
        }

        if (filters.inheems) {
            nextChips.push({ key: "inheems", label: "Inheems" });
        }

        advancedFilters.plantgroepen.forEach((value) => {
            nextChips.push({ key: "plantgroepen", label: value, value });
        });

        advancedFilters.kleuren.forEach((value) => {
            nextChips.push({ key: "kleuren", label: value, value });
        });

        advancedFilters.standplaatsen.forEach((value) => {
            nextChips.push({ key: "standplaatsen", label: value, value });
        });

        advancedFilters.grondsoorten.forEach((value) => {
            nextChips.push({ key: "grondsoorten", label: value, value });
        });

        advancedFilters.bloeiperiodes.forEach((value) => {
            nextChips.push({ key: "bloeiperiodes", label: value, value });
        });

        advancedFilters.keurmerken.forEach((value) => {
            nextChips.push({ key: "keurmerken", label: value, value });
        });

        return nextChips;
    }, [advancedFilters, filters.inheems, filters.opVoorraad]);

    const hasActiveFilterChips = chips.length > 0;

    const shouldShowSearchPlaceholder =
        isSearchMode &&
        plantNameQuery.trim().length < 2 &&
        sizeQuery.trim().length < 2 &&
        !hasActiveFilterChips;

    // Score every plant once — only in proposal (non-search) mode.
    const scoringResults = useMemo(() => {
        if (isSearchMode) return null;
        const scores = new Map<string, number | null>();
        const labels = new Map<string, SuitabilityLabel | null>();
        for (const plant of plants) {
            const score = scorePlant(plant, scoringInput);
            scores.set(plant.id, score);
            labels.set(plant.id, getLabelForScore(score));
        }
        return { scores, labels };
    }, [isSearchMode, plants, scoringInput]);

    const filteredPlants = useMemo(() => {
        if (isSearchMode) {
            const normalizedPlantNameQuery = plantNameQuery.trim();
            const normalizedSizeQuery = sizeQuery.trim();
            const hasEnoughPlantNameInput = normalizedPlantNameQuery.length >= 2;
            const hasEnoughSizeInput = normalizedSizeQuery.length >= 2;

            if (!hasEnoughPlantNameInput && !hasEnoughSizeInput && !hasActiveFilterChips) {
                return [];
            }

            return plants.filter((plant) =>
                !normalizedPlantNameQuery ||
                matchesSearchQuery(plant.botanicalName, normalizedPlantNameQuery) ||
                matchesSearchQuery(plant.dutchName, normalizedPlantNameQuery)
            );
        }

        // Proposal mode: remove plants below the score threshold.
        if (!scoringResults) return plants;

        let result = plants.filter((plant) => scoringResults.labels.get(plant.id) !== null);

        if (sortValue === "meest-geschikt") {
            result = [...result].sort((a, b) => {
                const scoreA = scoringResults.scores.get(a.id) ?? 100;
                const scoreB = scoringResults.scores.get(b.id) ?? 100;
                return scoreB - scoreA;
            });
        } else if (sortValue === "minst-geschikt") {
            result = [...result].sort((a, b) => {
                const scoreA = scoringResults.scores.get(a.id) ?? 100;
                const scoreB = scoringResults.scores.get(b.id) ?? 100;
                return scoreA - scoreB;
            });
        }

        return result;
    }, [hasActiveFilterChips, isSearchMode, plantNameQuery, plants, sizeQuery, scoringResults, sortValue]);

    // Server-side initials: Map van letter → aantal planten over álle matchende planten in de DB.
    // Start met alle 26 letters beschikbaar zodat de balk direct bruikbaar is;
    // na de fetch worden de letters zonder resultaten uitgeschakeld.
    const [serverInitials, setServerInitials] = useState<InitialCountMap>(
        () => new Map(ALPHABET.map((l) => [l, 1]))
    );

    // Helper: bouw URLSearchParams vanuit de huidige categorie + filters.
    // Wordt hergebruikt door zowel de initials-fetch als de letter-plants-fetch.
    //
    // Categorie-tabs: gebruik de catalogstore-filters (wizard-waarden) zodat de
    // alfabet-balk en de letter-fetch dezelfde filterset hanteren als de gewone
    // paginering. Zo verschijnen alleen letters/planten die ook in de 655 resultaten
    // zitten, en is er geen inconsistentie tussen de alfabet-filter en pagina 73.
    //
    // Zoek-zelf: gebruik de advancedFilters (handmatige selecties van de gebruiker).
    const buildFilterParams = useCallback((): URLSearchParams => {
        const params = new URLSearchParams();
        if (selectedGroup !== "tuinmaterialen") params.set("appGroup", selectedGroup);
        if (filters.inheems) params.set("inheems", "true");

        if (isSearchMode) {
            for (const v of advancedFilters.standplaatsen) params.append("standplaats", v);
            for (const v of advancedFilters.grondsoorten) params.append("grondsoort", v);
            for (const v of advancedFilters.bloeiperiodes) params.append("bloeiperiode", v);
            for (const v of advancedFilters.kleuren) params.append("kleur", v);
            for (const v of advancedFilters.plantgroepen) params.append("category", v);
            for (const v of advancedFilters.keurmerken) params.append("keurmerk", v);
        } else {
            for (const v of catalogFilters.standplaatsen) params.append("standplaats", v);
            for (const v of catalogFilters.grondsoorten) params.append("grondsoort", v);
            for (const v of catalogFilters.bloeiperiodes) params.append("bloeiperiode", v);
            for (const v of catalogFilters.kleuren) params.append("kleur", v);
            for (const v of catalogFilters.keurmerken) params.append("keurmerk", v);
            if (catalogFilters.minHeightCm !== undefined)
                params.set("minHeightCm", String(catalogFilters.minHeightCm));
            if (catalogFilters.maxHeightCm !== undefined)
                params.set("maxHeightCm", String(catalogFilters.maxHeightCm));
            if (catalogFilters.keurmerkFilter && catalogFilters.keurmerkFilter !== "maakt-niet-uit")
                params.set("keurmerkFilter", catalogFilters.keurmerkFilter);
        }
        return params;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGroup, filters.opVoorraad, filters.inheems, isSearchMode,
        advancedFilters.standplaatsen, advancedFilters.grondsoorten,
        advancedFilters.bloeiperiodes, advancedFilters.kleuren,
        advancedFilters.plantgroepen, advancedFilters.keurmerken,
        catalogFilters.standplaatsen, catalogFilters.grondsoorten,
        catalogFilters.bloeiperiodes, catalogFilters.kleuren,
        catalogFilters.keurmerken, catalogFilters.minHeightCm,
        catalogFilters.maxHeightCm, catalogFilters.keurmerkFilter]);

    // Effect 1: haal beginletter-counts op zodra categorie of filters veranderen.
    useEffect(() => {
        if (isSearchMode) return;
        const params = buildFilterParams();
        let cancelled = false;
        fetch(`/api/plants/initials?${params.toString()}`)
            .then((r) => r.json())
            .then((data: { initials: { letter: string; count: number }[] }) => {
                if (!cancelled) {
                    setServerInitials(new Map(data.initials.map((i) => [i.letter, i.count])));
                }
            })
            .catch(() => { /* bij fout: huidige staat behouden */ });
        return () => { cancelled = true; };
    }, [isSearchMode, buildFilterParams]);

    // Auto-clear de letterfilter als de actieve letter niet meer beschikbaar is.
    useEffect(() => {
        if (initialLetterFilter && !serverInitials.has(initialLetterFilter)) {
            setInitialLetterFilter(null);
        }
    }, [serverInitials, initialLetterFilter]);

    // Effect 2: haal alle planten op met de actieve beginletter van de server.
    // Dit is nodig omdat de catalog store slechts een pagina laadt (bijv. 48 planten).
    const [letterFetchedPlants, setLetterFetchedPlants] = useState<ApiPlant[] | null>(null);

    useEffect(() => {
        if (!initialLetterFilter || isSearchMode) {
            setLetterFetchedPlants(null);
            return;
        }
        const params = buildFilterParams();
        params.set("initialLetter", initialLetterFilter);
        params.set("limit", "200");
        params.set("sort", "a-z");
        let cancelled = false;
        fetch(`/api/plants?${params.toString()}`)
            .then((r) => r.json())
            .then((data: { plants: ApiPlant[] }) => {
                if (!cancelled) setLetterFetchedPlants(data.plants);
            })
            .catch(() => { if (!cancelled) setLetterFetchedPlants([]); });
        return () => { cancelled = true; };
    }, [initialLetterFilter, isSearchMode, buildFilterParams]);

    // Apply the initial letter filter as the final step (after scoring/search).
    // Wanneer een letter actief is, worden de server-gefetchte planten gescoord en getoond.
    const filteredPlantsWithInitial = useMemo(() => {
        if (!initialLetterFilter) return filteredPlants;

        // Gebruik server-gefetchte planten voor deze letter (volledige set, niet alleen geladen batch)
        if (letterFetchedPlants !== null) {
            if (isSearchMode || !scoringResults) return letterFetchedPlants;
            // Score de server-gefetchte planten direct (scorePlant is een pure functie)
            let result = letterFetchedPlants.filter((p) => {
                const score = scorePlant(p, scoringInput);
                return getLabelForScore(score) !== null;
            });
            if (sortValue === "meest-geschikt") {
                result = [...result].sort((a, b) => {
                    const scoreA = scorePlant(a, scoringInput) ?? 100;
                    const scoreB = scorePlant(b, scoringInput) ?? 100;
                    return scoreB - scoreA;
                });
            } else if (sortValue === "minst-geschikt") {
                result = [...result].sort((a, b) => {
                    const scoreA = scorePlant(a, scoringInput) ?? 100;
                    const scoreB = scorePlant(b, scoringInput) ?? 100;
                    return scoreA - scoreB;
                });
            }
            return result;
        }

        // Fallback (tijdens laden): filter de al geladen batch
        return filteredPlants.filter(
            (p) => getLatinInitial(p.botanicalName) === initialLetterFilter
        );
    }, [filteredPlants, initialLetterFilter, letterFetchedPlants, isSearchMode, scoringResults, scoringInput, sortValue]);

    // In search mode: one entry per plant×variant combination so each size gets its own card.
    const searchModeCombos = useMemo(() => {
        if (!isSearchMode) return [];
        const normalizedSizeQuery = sizeQuery.trim().toLowerCase();
        const combos: Array<{ key: string; plant: ApiPlant; variant: ApiPlantVariant }> = [];
        const seenComboKeys = new Set<string>();

        for (const plant of filteredPlants) {
            const cached = variantCache[plant.id];
            if (!cached || cached.status !== "success") continue;

            for (const variant of cached.variants) {
                if (normalizedSizeQuery && !variant.sizeLabel.toLowerCase().includes(normalizedSizeQuery)) {
                    continue;
                }

                const variantKey = variant.id || `${variant.sizeLabel}-${variant.price}`;
                const comboKey = `${plant.id}-${variantKey}`;
                if (seenComboKeys.has(comboKey)) continue;
                seenComboKeys.add(comboKey);

                combos.push({ key: comboKey, plant, variant });
            }
        }

        // Prijs-sortering (client-side, op variantprijs)
        if (sortValue === "prijs-laag-hoog") {
            combos.sort((a, b) => (a.variant.price ?? Infinity) - (b.variant.price ?? Infinity));
        } else if (sortValue === "prijs-hoog-laag") {
            combos.sort((a, b) => (b.variant.price ?? -Infinity) - (a.variant.price ?? -Infinity));
        }

        return combos;
    }, [isSearchMode, filteredPlants, variantCache, sizeQuery, sortValue]);

    // Pagina-gebaseerde slices
    const pageStart = (uiPage - 1) * ITEMS_PER_PAGE;
    const pageEnd = pageStart + ITEMS_PER_PAGE;

    const visiblePlants = useMemo(() => {
        return filteredPlantsWithInitial.slice(pageStart, pageEnd);
    }, [filteredPlantsWithInitial, pageStart, pageEnd]);

    const visibleCombos = useMemo(() => {
        return searchModeCombos.slice(pageStart, pageEnd);
    }, [searchModeCombos, pageStart, pageEnd]);

    // In search mode with a text query: count combo cards (one per variant).
    // In search mode with only filter chips (no text): use the API plant total.
    // In category mode: use the API plant total directly.
    const hasTextSearch = plantNameQuery.trim().length >= 2 || sizeQuery.trim().length >= 2;
    const effectiveResultsCount = shouldShowSearchPlaceholder
        ? 0
        : isSearchMode
            ? (hasTextSearch && searchModeCombos.length > 0 ? searchModeCombos.length : resultsCount)
            : resultsCount;

    // Totaal aantal UI-pagina's:
    // - Met letterfilter: gebaseerd op de server-gefetchte planten voor die letter
    // - Zonder letterfilter, categoriemode: gebaseerd op API-totaal (bijv. 655)
    // - Zoek-modus: gebaseerd op geladen resultaten
    const totalUiPages = useMemo(() => {
        if (isSearchMode) {
            const loadedPages = Math.max(1, Math.ceil(searchModeCombos.length / ITEMS_PER_PAGE));
            // Als er meer API-pagina's zijn, toon één extra pagina zodat laden wordt getriggerd
            return currentPage < totalPages ? loadedPages + 1 : loadedPages;
        }
        if (initialLetterFilter) {
            return Math.max(1, Math.ceil(filteredPlantsWithInitial.length / ITEMS_PER_PAGE));
        }
        return Math.max(1, Math.ceil(resultsCount / ITEMS_PER_PAGE));
    }, [isSearchMode, searchModeCombos.length, currentPage, totalPages, initialLetterFilter, filteredPlantsWithInitial.length, resultsCount]);

    const sectionRef = useRef<HTMLElement | null>(null);

    // Laad meer van de API wanneer de gebruiker naar een pagina navigeert
    // waarvoor de data nog niet geladen is.
    useEffect(() => {
        const neededItems = uiPage * ITEMS_PER_PAGE;
        if (isSearchMode) {
            if (neededItems > searchModeCombos.length && currentPage < totalPages) {
                onLoadMoreFromApi();
            }
        } else if (!initialLetterFilter) {
            if (neededItems > filteredPlantsWithInitial.length && currentPage < totalPages) {
                onLoadMoreFromApi();
            }
        }
    // onLoadMoreFromApi is stable (Zustand action)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uiPage, isSearchMode, searchModeCombos.length, filteredPlantsWithInitial.length, currentPage, totalPages, initialLetterFilter]);

    // Geeft aan of de huidige pagina meer data nodig heeft dan er al geladen is.
    // Als dit het geval is, loopt de cascade-loading nog en moeten we een laad-indicator tonen
    // zodat de gebruiker niet verwarrende/onvolledige resultaten te zien krijgt.
    const needsMoreData =
        !isSearchMode &&
        !initialLetterFilter &&
        pageEnd > filteredPlantsWithInitial.length &&
        currentPage < totalPages;

    const handlePageChange = (page: number) => {
        setUiPage(page);
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <section
            ref={sectionRef}
            className="rounded-[10px] border p-5"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor: COLORS.border,
                boxShadow: "5px 3px 46px -25px rgba(0, 0, 0, 0.25)",
            }}
        >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <h2
                        className="text-[28px] font-semibold leading-[1.2]"
                        style={{ color: COLORS.text }}
                    >
                        {title}{" "}
                        <span
                            className="text-[14px] font-normal"
                            style={{ color: COLORS.muted }}
                        >
                            ({effectiveResultsCount} resultaten)
                        </span>
                    </h2>

                    <p
                        className="mt-3 text-[14px]"
                        style={{ color: COLORS.text }}
                    >
                        {isSearchMode
                            ? "Doorzoek onze volledige plantendatabase en voeg zelf planten of bomen toe aan je plantenlijst"
                            : "In de plantenlijst onderaan de pagina bepaal je de maten voor je definitieve plan."}
                    </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <label
                            htmlFor="plant-sort"
                            className="text-[14px] font-normal"
                            style={{ color: COLORS.text, whiteSpace: "nowrap" }}
                        >
                            Sorteren op
                        </label>

                        <div className="relative">
                            <select
                                id="plant-sort"
                                value={sortValue}
                                onChange={(event) => onChangeSort(event.target.value)}
                                className="h-[40px] min-w-[170px] appearance-none rounded-[8px] border bg-white pl-4 pr-10 text-[14px] font-semibold outline-none"
                                style={{
                                    borderColor: "#E0DEDF",
                                    color: COLORS.text,
                                }}
                            >
                                <option value="">Geen sortering</option>
                                {isSearchMode ? (
                                    <>
                                        <option value="prijs-laag-hoog">Prijs p/st (Laag - Hoog)</option>
                                        <option value="prijs-hoog-laag">Prijs p/st (Hoog - Laag)</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="meest-geschikt">Meest geschikt</option>
                                        <option value="minst-geschikt">Minst geschikt</option>
                                    </>
                                )}
                            </select>

                            <img
                                src="/icons/chevron-down.svg"
                                alt=""
                                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                                style={{
                                    width: 16,
                                    height: 16,
                                    display: "block",
                                }}
                            />
                        </div>
                    </div>

                    <div
                        className="inline-flex overflow-hidden rounded-[8px] border bg-white"
                        style={{ borderColor: "#E0DEDF" }}
                    >
                        <button
                            type="button"
                            onClick={() => onChangeViewMode("grid")}
                            className="flex h-[40px] w-[56px] cursor-pointer items-center justify-center border-r"
                            style={{
                                backgroundColor: viewMode === "grid" ? "#58694C" : "#FFFFFF",
                                borderRightColor: "#E0DEDF",
                            }}
                        >
                            <img
                                src="/icons/grid.svg"
                                alt=""
                                style={{
                                    width: 20,
                                    height: 20,
                                    display: "block",
                                    filter:
                                        viewMode === "grid"
                                            ? "brightness(0) invert(1)"
                                            : GREEN_ICON_FILTER,
                                }}
                            />
                        </button>

                        <button
                            type="button"
                            onClick={() => onChangeViewMode("list")}
                            className="flex h-[40px] w-[56px] cursor-pointer items-center justify-center"
                            style={{
                                backgroundColor: viewMode === "list" ? "#58694C" : "#FFFFFF",
                            }}
                        >
                            <img
                                src="/icons/list.svg"
                                alt=""
                                style={{
                                    width: 20,
                                    height: 20,
                                    display: "block",
                                    filter:
                                        viewMode === "list"
                                            ? "brightness(0) invert(1)"
                                            : GREEN_ICON_FILTER,
                                }}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Alfabetische filterbar — alleen in categoriemodus (niet in zoek-zelf) */}
            {!isSearchMode && (
                <AlphabetBar
                    activeLetter={initialLetterFilter}
                    availableInitials={serverInitials}
                    filteredCount={filteredPlantsWithInitial.length}
                    totalCount={resultsCount}
                    onSelectLetter={(letter) => {
                        setInitialLetterFilter(letter);
                        setUiPage(1);
                    }}
                />
            )}

            {isSearchMode ? (
                <>
                    <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <div
                            className="flex h-[44px] items-center gap-3 rounded-[6px] px-4"
                            style={{
                                backgroundColor: "#F2F2F2",
                                boxShadow: isPlantNameSearchFocused
                                    ? "0px 1px 3px rgba(0, 0, 0, 0.14)"
                                    : "none",
                                transition: "box-shadow 180ms ease-in-out",
                            }}
                        >
                            <img
                                src="/icons/search.svg"
                                alt=""
                                style={{
                                    width: 18,
                                    height: 18,
                                    display: "block",
                                    filter: SEARCH_ICON_FILTER,
                                }}
                            />
                            <input
                                type="text"
                                value={plantNameQuery}
                                onChange={(event) => setPlantNameQuery(event.target.value)}
                                onFocus={() => setIsPlantNameSearchFocused(true)}
                                onBlur={() => setIsPlantNameSearchFocused(false)}
                                placeholder="Zoek op plantnaam (NL of Latijns)"
                                className="h-full w-full bg-transparent text-[14px] text-black outline-none placeholder:text-[#898988]"
                            />
                        </div>

                        <div
                            className="flex h-[44px] items-center gap-3 rounded-[6px] px-4"
                            style={{
                                backgroundColor: "#F2F2F2",
                                boxShadow: isSizeSearchFocused
                                    ? "0px 1px 3px rgba(0, 0, 0, 0.14)"
                                    : "none",
                                transition: "box-shadow 180ms ease-in-out",
                            }}
                        >
                            <img
                                src="/icons/search.svg"
                                alt=""
                                style={{
                                    width: 18,
                                    height: 18,
                                    display: "block",
                                    filter: SEARCH_ICON_FILTER,
                                }}
                            />
                            <input
                                type="text"
                                value={sizeQuery}
                                onChange={(event) => setSizeQuery(event.target.value)}
                                onFocus={() => setIsSizeSearchFocused(true)}
                                onBlur={() => setIsSizeSearchFocused(false)}
                                placeholder="Typ hier jouw gewenste maatvoering"
                                className="h-full w-full bg-transparent text-[14px] text-black outline-none placeholder:text-[#898988]"
                            />
                        </div>
                    </div>

                    {chips.length > 0 ? (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            {chips.map((chip) => (
                                <SearchFilterChip
                                    key={`${chip.key}-${chip.value ?? chip.label}`}
                                    label={chip.label}
                                    onRemove={() => onRemoveFilterChip(chip.key, chip.value)}
                                />
                            ))}

                            <button
                                type="button"
                                onClick={onClearAllFilters}
                                className="cursor-pointer text-[14px] font-semibold underline"
                                style={{ color: COLORS.green }}
                            >
                                Wis filters
                            </button>
                        </div>
                    ) : null}
                </>
            ) : null}

            {shouldShowSearchPlaceholder ? (
                <div
                    className="mt-6 flex min-h-[280px] items-center justify-center"
                    style={{
                        backgroundColor: "#FFFFFF",
                    }}
                >
                    <span
                        className="text-center text-[16px]"
                        style={{ color: "#898988" }}
                    >
                        Typ minimaal 2 tekens in een van de zoekvelden om resultaten te tonen
                    </span>
                </div>
            ) : null}

            {!shouldShowSearchPlaceholder ? (
                <div className="mt-6">
                    {needsMoreData ? (
                        /* Cascade-loading nog bezig: toon laadstatus in plaats van onvolledige data */
                        <div
                            className="flex min-h-[280px] items-center justify-center"
                            style={{ backgroundColor: "#FFFFFF" }}
                        >
                            <div style={{ textAlign: "center" }}>
                                <div
                                    style={{
                                        width: 32,
                                        height: 32,
                                        border: "3px solid #E3E2E2",
                                        borderTopColor: "#58694C",
                                        borderRadius: "50%",
                                        animation: "spin 0.8s linear infinite",
                                        margin: "0 auto 12px",
                                    }}
                                />
                                <span
                                    className="text-[14px]"
                                    style={{ color: "#6B7280" }}
                                >
                                    Planten worden geladen…
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div
                            className={
                                viewMode === "grid"
                                    ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                                    : "space-y-4"
                            }
                        >
                            {isSearchMode
                                ? visibleCombos.map((combo) =>
                                    viewMode === "grid" ? (
                                        <SearchModeGridCard
                                            key={combo.key}
                                            plant={combo.plant}
                                            sizeLabel={combo.variant.sizeLabel}
                                            variantPrice={combo.variant.price}
                                            variantInStock={combo.variant.availability === "in_stock"}
                                            bulkPrices={combo.variant.bulkPrices ?? []}
                                            onAddToPlantList={onAddToPlantList}
                                        />
                                    ) : (
                                        <SearchModeListCard
                                            key={combo.key}
                                            plant={combo.plant}
                                            sizeLabel={combo.variant.sizeLabel}
                                            variantPrice={combo.variant.price}
                                            variantInStock={combo.variant.availability === "in_stock"}
                                            bulkPrices={combo.variant.bulkPrices ?? []}
                                            onAddToPlantList={onAddToPlantList}
                                        />
                                    )
                                )
                                : visiblePlants.map((plant) => {
                                    const score = scoringResults?.scores.get(plant.id) ?? scorePlant(plant, scoringInput);
                                    return (
                                        <DefaultPlantCard
                                            key={plant.id}
                                            plant={plant}
                                            viewMode={viewMode}
                                            suitabilityLabel={getLabelForScore(score)}
                                            scoringInput={scoringInput}
                                            onAddToPlantList={(p, size, fixedSize, bulkPrices) => onAddToPlantList(p, size, fixedSize, bulkPrices)}
                                        />
                                    );
                                })
                            }
                        </div>
                    )}
                </div>
            ) : null}

            {!shouldShowSearchPlaceholder && (
                <Pagination
                    currentPage={uiPage}
                    totalPages={totalUiPages}
                    onPageChange={handlePageChange}
                />
            )}
        </section>
    );
}
