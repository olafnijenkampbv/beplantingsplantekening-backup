"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PlantImg } from "@/features/editor/components/PlantImg";
import { APP_NOTIFICATIONS, useAppNotify } from "@/state/allNotifications";
import type { ApiGardenMaterial, ApiGardenMaterialVariant } from "@/lib/db/gardenMaterialTypes";
import type { ViewMode } from "@/features/editor/lib/plantSelectionDummyData";
import ProductVariantSelectionModal from "@/features/editor/components/plantSelection/ProductVariantSelectionModal";
import type { ModalVariant } from "@/features/editor/components/plantSelection/ProductVariantSelectionModal";

// ---------------------------------------------------------------------------
// Constanten & kleuren
// ---------------------------------------------------------------------------

const COLORS = {
    cardBg:  "#FFFFFF",
    border:  "#E3E2E2",
    orange:  "#E94E1B",
    green:   "#58694C",
    text:    "#111111",
    muted:   "#6B7280",
};

const GREEN_ICON_FILTER =
    "brightness(0) saturate(100%) invert(36%) sepia(13%) saturate(707%) hue-rotate(56deg) brightness(92%) contrast(86%)";

const ITEMS_PER_PAGE = 9;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(price: number): string {
    if (!price || price <= 0) return "";
    return `€${price.toFixed(2).replace(".", ",")} p/st`;
}

function formatFromPrice(price: number): string {
    if (!price || price <= 0) return "";
    return `Vanaf €${price.toFixed(2).replace(".", ",")} p/st`;
}

function toModalVariants(variants: ApiGardenMaterialVariant[]): ModalVariant[] {
    return variants.map((v) => ({
        id:           v.id,
        sizeLabel:    v.sizeLabel,
        price:        v.price,
        availability: v.availability,
    }));
}

function getMaterialInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase();
}

// ---------------------------------------------------------------------------
// Availability badge
// ---------------------------------------------------------------------------

function AvailabilityBadge({ inStock }: { inStock: boolean }) {
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-[6px] text-[11px] font-semibold"
            style={{
                backgroundColor: inStock ? "#DEFFDE" : "#FDFFC6",
                color:           inStock ? "#008000" : "#807300",
            }}
        >
            <span
                className="rounded-full"
                style={{ width: 7, height: 7, backgroundColor: inStock ? "#008000" : "#807300" }}
            />
            {!inStock && (
                <span
                    className="rounded-full"
                    style={{ width: 7, height: 7, backgroundColor: "#807300", marginLeft: -3 }}
                />
            )}
            {inStock ? "Op voorraad" : "Binnen een week leverbaar"}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Subcategory tab bar (client-side)
// ---------------------------------------------------------------------------

const SUBCATEGORY_ORDER = ["Potgrond", "Daktuinen", "Gazon", "Meststoffen", "Overig"];

type SubcategoryTabBarProps = {
    activeSubcategory: string | null;
    subcategoryCounts: Map<string, number>;
    totalCount:        number;
    onSelectSubcategory: (subcategory: string | null) => void;
};

function SubcategoryTabBar({
    activeSubcategory,
    subcategoryCounts,
    totalCount,
    onSelectSubcategory,
}: SubcategoryTabBarProps) {
    const tabs = SUBCATEGORY_ORDER.filter((s) => (subcategoryCounts.get(s) ?? 0) > 0);
    if (tabs.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2">
            <button
                type="button"
                onClick={() => onSelectSubcategory(null)}
                className="cursor-pointer rounded-full px-4 py-[6px] text-[13px] font-semibold"
                style={{
                    backgroundColor: activeSubcategory === null ? COLORS.green : "#FFFFFF",
                    color:           activeSubcategory === null ? "#FFFFFF" : COLORS.green,
                    border:          `1px solid ${COLORS.green}`,
                }}
            >
                Alle ({totalCount})
            </button>
            {tabs.map((sub) => {
                const isActive = activeSubcategory === sub;
                return (
                    <button
                        key={sub}
                        type="button"
                        onClick={() => onSelectSubcategory(isActive ? null : sub)}
                        className="cursor-pointer rounded-full px-4 py-[6px] text-[13px] font-semibold"
                        style={{
                            backgroundColor: isActive ? COLORS.green : "#FFFFFF",
                            color:           isActive ? "#FFFFFF" : COLORS.green,
                            border:          `1px solid ${COLORS.green}`,
                        }}
                    >
                        {sub} ({subcategoryCounts.get(sub) ?? 0})
                    </button>
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Alphabet bar (client-side)
// ---------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as string[];

type InitialCountMap = Map<string, number>;

type AlphabetBarProps = {
    activeLetter:    string | null;
    availableInitials: InitialCountMap;
    filteredCount:   number;
    totalCount:      number;
    onSelectLetter:  (letter: string | null) => void;
};

function AlphabetBar({ activeLetter, availableInitials, filteredCount, totalCount, onSelectLetter }: AlphabetBarProps) {
    return (
        <div style={{ marginTop: 16 }}>
            <div
                style={{
                    display:        "flex",
                    alignItems:     "baseline",
                    justifyContent: "space-between",
                    marginBottom:   8,
                    gap:            8,
                }}
            >
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111111" }}>
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
                                fontSize:       12,
                                fontWeight:     600,
                                color:          "#58694C",
                                background:     "none",
                                border:         "none",
                                padding:        0,
                                cursor:         "pointer",
                                textDecoration: "underline",
                                whiteSpace:     "nowrap",
                            }}
                        >
                            Wis filter
                        </button>
                    </div>
                )}
            </div>

            <div
                style={{
                    backgroundColor: "#EDF2EB",
                    borderRadius:    8,
                    padding:         "10px 12px",
                    display:         "flex",
                    flexWrap:        "nowrap",
                    overflowX:       "auto",
                    gap:             4,
                    paddingBottom:   10,
                }}
            >
                {ALPHABET.map((letter) => {
                    const isAvailable = availableInitials.has(letter);
                    const isActive    = activeLetter === letter;

                    return (
                        <button
                            key={letter}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => isAvailable ? onSelectLetter(isActive ? null : letter) : undefined}
                            style={{
                                flexShrink:      0,
                                width:           30,
                                height:          30,
                                display:         "flex",
                                alignItems:      "center",
                                justifyContent:  "center",
                                borderRadius:    6,
                                border:          "none",
                                fontSize:        13,
                                fontWeight:      600,
                                cursor:          isAvailable ? "pointer" : "not-allowed",
                                transition:      "background-color 120ms ease, color 120ms ease",
                                backgroundColor: isActive ? "#58694C" : isAvailable ? "#FFFFFF" : "transparent",
                                color:           isActive ? "#FFFFFF" : isAvailable ? "#58694C" : "#BBBBBB",
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

function buildPageNumbers(current: number, total: number): PageItem[] {
    const WINDOW = 9;
    if (total <= WINDOW + 1) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    let windowStart = Math.max(1, current - Math.floor(WINDOW / 2));
    let windowEnd   = windowStart + WINDOW - 1;

    if (windowEnd > total) {
        windowEnd   = total;
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

function Pagination({ currentPage, totalPages, onPageChange }: {
    currentPage:  number;
    totalPages:   number;
    onPageChange: (page: number) => void;
}) {
    if (totalPages <= 1) return null;

    const pages = buildPageNumbers(currentPage, totalPages);

    const sharedBtn: React.CSSProperties = {
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        minWidth:        32,
        height:          32,
        borderRadius:    6,
        border:          "none",
        backgroundColor: "transparent",
        fontSize:        14,
        fontWeight:      500,
        flexShrink:      0,
        userSelect:      "none",
        transition:      "background-color 120ms ease, color 120ms ease",
        padding:         "0 6px",
    };

    const btnActive:   React.CSSProperties = { ...sharedBtn, backgroundColor: "#58694C", color: "#FFFFFF", fontWeight: 700, cursor: "default" };
    const btnInactive: React.CSSProperties = { ...sharedBtn, color: "#58694C", cursor: "pointer" };
    const btnDisabled: React.CSSProperties = { ...sharedBtn, color: "#C0C0C0", cursor: "not-allowed" };

    return (
        <div
            style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                gap:            6,
                marginTop:      28,
                flexWrap:       "wrap",
            }}
        >
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
                        <span key={page} style={{ fontSize: 14, color: "#6B7280", padding: "0 2px", lineHeight: "36px" }}>
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
// GardenMaterialGridCard — gridweergave
// ---------------------------------------------------------------------------

function parseReasonParts(reason: string): { intro: string; plantNames: string[]; explanation: string } {
    const lines = reason.split("\n");
    const intro: string[] = [];
    const plantNames: string[] = [];
    const explanation: string[] = [];
    let inPlants = false;
    for (const line of lines) {
        if (line.startsWith("- ")) {
            inPlants = true;
            plantNames.push(line.slice(2).trim());
        } else if (inPlants) {
            explanation.push(line);
        } else {
            intro.push(line);
        }
    }
    return {
        intro: intro.join("\n").trim(),
        plantNames,
        explanation: explanation.join("\n").trim(),
    };
}

export function GardenMaterialGridCard(props: {
    material:       ApiGardenMaterial;
    onAddToPlantList: (material: ApiGardenMaterial, variant: ApiGardenMaterialVariant, fixedSize?: boolean) => void;
    reason?: string;
    suggestedQuantity?: number;
    plantNames?: string[];
}) {
    const { material, onAddToPlantList, reason, suggestedQuantity, plantNames: plantNamesProp } = props;
    const notify = useAppNotify();
    const [isAdded,       setIsAdded]       = useState(false);
    const [isCartHovered, setIsCartHovered] = useState(false);
    const [isModalOpen,   setIsModalOpen]   = useState(false);
    const [isReasonOpen,  setIsReasonOpen]  = useState(false);
    const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null);
    const reasonPopoverRef = useRef<HTMLDivElement | null>(null);
    const reasonBtnRef = useRef<HTMLButtonElement | null>(null);

    const variants        = material.variants;
    const isSingleVariant = variants.length === 1;
    const isMultiVariant  = variants.length > 1;
    const singleVariant   = isSingleVariant ? variants[0] : null;
    const minPrice        = material.minPrice > 0
        ? material.minPrice
        : variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0;

    const handleDirectAdd = () => {
        if (!singleVariant) return;
        onAddToPlantList(material, singleVariant, true);
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(material.name));
        setIsAdded(true);
        window.setTimeout(() => setIsAdded(false), 3200);
    };

    const handleModalAdd = (sizeLabel: string) => {
        const chosenVariant = variants.find((v) => v.sizeLabel === sizeLabel) ?? variants[0];
        onAddToPlantList(material, chosenVariant, true);
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(material.name));
        setIsAdded(true);
        window.setTimeout(() => setIsAdded(false), 3200);
    };

    const handleCartClick = () => {
        if (isSingleVariant) handleDirectAdd();
        else if (isMultiVariant) setIsModalOpen(true);
    };

    useEffect(() => {
        if (!isReasonOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (reasonPopoverRef.current?.contains(target)) return;
            if (reasonBtnRef.current?.contains(target)) return;
            setIsReasonOpen(false);
        };

        const handleScroll = () => {
            if (!reasonBtnRef.current) return;
            const rect = reasonBtnRef.current.getBoundingClientRect();
            setPopoverPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
        };

        document.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("scroll", handleScroll, { capture: true });
        };
    }, [isReasonOpen]);

    return (
        <>
            <div className="relative h-full">
                <div
                    className="flex h-full flex-col overflow-hidden rounded-[8px] border"
                    style={{
                        backgroundColor: COLORS.cardBg,
                        borderColor:     COLORS.border,
                        boxShadow:       "0 2px 8px rgba(0,0,0,0.04)",
                    }}
                >
                    {/* Afbeelding */}
                    <div
                        className="relative shrink-0 overflow-hidden bg-[#F1F1EE]"
                        style={{ aspectRatio: "1 / 0.82" }}
                    >
                        <PlantImg src={material.imageUrl} alt={material.name} className="block h-full w-full" />
                        {!reason && (
                            <div className="absolute right-2 top-2">
                                <AvailabilityBadge inStock={material.inStock} />
                            </div>
                        )}
                    </div>

                    {/* Tekst-blok */}
                    <div className="flex flex-1 flex-col p-3">
                        <div
                            className="text-[15px] font-semibold leading-[1.2]"
                            style={{ color: COLORS.text }}
                        >
                            {material.name}
                        </div>

                        {/* Maten-link of sizeLabel */}
                        {isMultiVariant ? (
                            <div className="mt-2">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
                                    className="cursor-pointer text-[13px] underline underline-offset-2"
                                    style={{ color: COLORS.text, background: "none", border: "none", padding: 0 }}
                                >
                                    Bekijk de {variants.length} maten
                                </button>
                            </div>
                        ) : singleVariant?.sizeLabel ? (
                            <div className="mt-2 text-[13px]" style={{ color: COLORS.text }}>
                                {singleVariant.sizeLabel}
                            </div>
                        ) : null}

                        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                            <div className="min-w-0 flex-1">
                                {isMultiVariant ? (
                                    <div className="text-[13px]" style={{ color: "#FF0000" }}>
                                        {formatFromPrice(minPrice)}
                                    </div>
                                ) : singleVariant ? (
                                    <div className="text-[13px]" style={{ color: "#FF0000" }}>
                                        {formatPrice(singleVariant.price)}
                                    </div>
                                ) : null}
                            </div>

                            <button
                                type="button"
                                onClick={handleCartClick}
                                onMouseEnter={() => setIsCartHovered(true)}
                                onMouseLeave={() => setIsCartHovered(false)}
                                className="flex shrink-0 cursor-pointer items-center justify-center rounded-[6px]"
                                style={{
                                    width:           40,
                                    height:          40,
                                    backgroundColor: isAdded ? "#008000" : isCartHovered ? "#BF3D12" : COLORS.orange,
                                    transition:      "background-color 220ms ease, transform 220ms ease",
                                    transform:       isAdded ? "scale(1.06)" : "scale(1)",
                                }}
                            >
                                <img
                                    src={isAdded ? "/icons/check.svg" : "/icons/add-to-cart.svg"}
                                    alt=""
                                    style={{
                                        width:   isAdded ? 20 : 16,
                                        height:  isAdded ? 20 : 16,
                                        display: "block",
                                        filter:  "brightness(0) invert(1)",
                                    }}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {reason && (
                    <div className="absolute right-2 top-2 z-20">
                        <button
                            ref={reasonBtnRef}
                            type="button"
                            aria-label="Waarom wordt dit product aangeboden?"
                            aria-expanded={isReasonOpen}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isReasonOpen && reasonBtnRef.current) {
                                    const rect = reasonBtnRef.current.getBoundingClientRect();
                                    setPopoverPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                                }
                                setIsReasonOpen((open) => !open);
                            }}
                            className="flex cursor-pointer items-center justify-center rounded-full shadow-md"
                            style={{
                                width: 32,
                                height: 32,
                                backgroundColor: COLORS.orange,
                            }}
                        >
                            <img
                                src="/icons/idea.svg"
                                alt=""
                                style={{ width: 16, height: 16, display: "block", filter: "brightness(0) invert(1)" }}
                            />
                        </button>
                    </div>
                )}

                {isReasonOpen && reason && popoverPos && typeof document !== "undefined" && createPortal((() => {
                    const parsed = parseReasonParts(reason);
                    const plantNames = (plantNamesProp && plantNamesProp.length > 0) ? plantNamesProp : parsed.plantNames;
                    const intro = (plantNamesProp && plantNamesProp.length > 0) ? reason : parsed.intro;
                    const explanation = (plantNamesProp && plantNamesProp.length > 0) ? "" : parsed.explanation;
                    return (
                        <div
                            ref={reasonPopoverRef}
                            style={{
                                position: "fixed",
                                top: popoverPos.top,
                                right: popoverPos.right,
                                width: 290,
                                backgroundColor: "#FFFFFF",
                                borderRadius: 10,
                                boxShadow: "0 4px 24px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)",
                                border: "1px solid #E3E2E2",
                                overflow: "hidden",
                                zIndex: 9999,
                            }}
                        >
                            {/* Header */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "14px 14px 10px",
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
                                        style={{ width: 15, height: 15, display: "block", filter: "brightness(0) invert(1)" }}
                                    />
                                </div>
                                <span
                                    style={{
                                        flex: 1,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "#111111",
                                        lineHeight: "1.3",
                                    }}
                                >
                                    Waarom is dit een goed voorstel?
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setIsReasonOpen(false); }}
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

                            {/* Body */}
                            <div style={{ padding: "12px 14px" }}>
                                {intro ? (
                                    <p style={{ fontSize: 13, color: "#111111", lineHeight: "1.5", margin: "0 0 10px 0" }}>
                                        {intro}
                                    </p>
                                ) : null}

                                {plantNames.length > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: explanation ? 10 : 0 }}>
                                        {plantNames.map((name) => (
                                            <div key={name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <img
                                                    src="/icons/check-icon.svg"
                                                    alt=""
                                                    style={{ width: 18, height: 18, display: "block", flexShrink: 0 }}
                                                />
                                                <span style={{ fontSize: 13, fontWeight: 700, color: "#111111" }}>{name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {explanation ? (
                                    <p style={{ fontSize: 13, color: "#111111", lineHeight: "1.5", margin: 0 }}>
                                        {explanation}
                                    </p>
                                ) : null}

                                {suggestedQuantity !== undefined && suggestedQuantity > 0 && (
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            marginTop: 12,
                                            padding: "8px 12px",
                                            backgroundColor: "#EEF0ED",
                                            borderRadius: 8,
                                        }}
                                    >
                                        <img
                                            src="/icons/info.svg"
                                            alt=""
                                            style={{ width: 18, height: 18, display: "block", flexShrink: 0, filter: GREEN_ICON_FILTER }}
                                        />
                                        <span style={{ fontSize: 13, color: "#111111" }}>
                                            Aanbevolen aantal:{" "}
                                            <strong>{suggestedQuantity} {suggestedQuantity === 1 ? "stuk" : "stuks"}</strong>
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })(), document.body)}
            </div>

            {isModalOpen && (
                <ProductVariantSelectionModal
                    name={material.name}
                    imageUrl={material.imageUrl}
                    keurmerken={[]}
                    variants={toModalVariants(variants)}
                    isLoading={false}
                    onAdd={handleModalAdd}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// GardenMaterialListCard — lijstweergave
// ---------------------------------------------------------------------------

function GardenMaterialListCard(props: {
    material:       ApiGardenMaterial;
    onAddToPlantList: (material: ApiGardenMaterial, variant: ApiGardenMaterialVariant, fixedSize?: boolean) => void;
}) {
    const { material, onAddToPlantList } = props;
    const notify = useAppNotify();
    const [isAdded,       setIsAdded]       = useState(false);
    const [isCartHovered, setIsCartHovered] = useState(false);
    const [isModalOpen,   setIsModalOpen]   = useState(false);

    const variants        = material.variants;
    const isSingleVariant = variants.length === 1;
    const isMultiVariant  = variants.length > 1;
    const singleVariant   = isSingleVariant ? variants[0] : null;
    const minPrice        = material.minPrice > 0
        ? material.minPrice
        : variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0;

    const handleDirectAdd = () => {
        if (!singleVariant) return;
        onAddToPlantList(material, singleVariant, true);
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(material.name));
        setIsAdded(true);
        window.setTimeout(() => setIsAdded(false), 3200);
    };

    const handleModalAdd = (sizeLabel: string) => {
        const chosenVariant = variants.find((v) => v.sizeLabel === sizeLabel) ?? variants[0];
        onAddToPlantList(material, chosenVariant, true);
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(material.name));
        setIsAdded(true);
        window.setTimeout(() => setIsAdded(false), 3200);
    };

    const handleCartClick = () => {
        if (isSingleVariant) handleDirectAdd();
        else if (isMultiVariant) setIsModalOpen(true);
    };

    return (
        <>
            <div
                className="flex items-stretch gap-4 rounded-[8px] border p-3"
                style={{
                    backgroundColor: COLORS.cardBg,
                    borderColor:     COLORS.border,
                    boxShadow:       "0 2px 8px rgba(0,0,0,0.04)",
                    minHeight:       166,
                }}
            >
                {/* Afbeelding */}
                <div
                    className="shrink-0 overflow-hidden rounded-[6px] bg-[#F1F1EE]"
                    style={{ width: 140, height: 140 }}
                >
                    <PlantImg src={material.imageUrl} alt={material.name} className="block h-full w-full" />
                </div>

                {/* Info */}
                <div className="flex min-w-0 flex-1 items-stretch justify-between gap-4">
                    <div className="flex min-w-0 flex-1 flex-col">
                        <div
                            className="text-[16px] font-semibold leading-[1.35]"
                            style={{ color: COLORS.text }}
                        >
                            {material.name}
                        </div>

                        {isMultiVariant ? (
                            <div className="mt-2">
                                <div className="text-[13px]" style={{ color: "#FF0000" }}>
                                    {formatFromPrice(minPrice)}
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
                                    className="cursor-pointer text-[13px] underline underline-offset-2"
                                    style={{ color: COLORS.text, background: "none", border: "none", padding: 0 }}
                                >
                                    Bekijk de {variants.length} maten
                                </button>
                            </div>
                        ) : singleVariant ? (
                            <div className="mt-2">
                                {singleVariant.sizeLabel ? (
                                    <div className="text-[13px]" style={{ color: COLORS.text }}>
                                        {singleVariant.sizeLabel}
                                    </div>
                                ) : null}
                                {formatPrice(singleVariant.price) && (
                                    <div className="text-[13px]" style={{ color: "#FF0000" }}>
                                        {formatPrice(singleVariant.price)}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>

                    {/* Rechterkolom: badge + knop */}
                    <div className="flex shrink-0 flex-col items-end justify-center gap-3">
                        <AvailabilityBadge inStock={material.inStock} />

                        <button
                            type="button"
                            onClick={handleCartClick}
                            onMouseEnter={() => setIsCartHovered(true)}
                            onMouseLeave={() => setIsCartHovered(false)}
                            className="flex cursor-pointer items-center gap-2 rounded-[6px] px-4"
                            style={{
                                height:          44,
                                backgroundColor: isAdded ? "#008000" : isCartHovered ? "#BF3D12" : COLORS.orange,
                                color:           "#FFFFFF",
                                transition:      "background-color 220ms ease, transform 220ms ease",
                                transform:       isAdded ? "scale(1.03)" : "scale(1)",
                            }}
                        >
                            <img
                                src={isAdded ? "/icons/check.svg" : "/icons/add-to-cart.svg"}
                                alt=""
                                style={{
                                    width:   isAdded ? 22 : 18,
                                    height:  isAdded ? 22 : 18,
                                    display: "block",
                                    filter:  "brightness(0) invert(1)",
                                }}
                            />
                            <span className="text-[13px] font-semibold text-white">
                                {isAdded ? "Toegevoegd" : "Toevoegen aan plantenlijst"}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <ProductVariantSelectionModal
                    name={material.name}
                    imageUrl={material.imageUrl}
                    keurmerken={[]}
                    variants={toModalVariants(variants)}
                    isLoading={false}
                    onAdd={handleModalAdd}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// GardenMaterialGrid — hoofd-component
// ---------------------------------------------------------------------------

type GardenMaterialGridProps = {
    materials:        ApiGardenMaterial[];
    total:            number;
    isLoading:        boolean;
    viewMode:         ViewMode;
    sortValue:        string;
    onChangeSort:     (value: string) => void;
    onChangeViewMode: (mode: ViewMode) => void;
    onAddToPlantList: (material: ApiGardenMaterial, variant: ApiGardenMaterialVariant, fixedSize?: boolean) => void;
};

export default function GardenMaterialGrid(props: GardenMaterialGridProps) {
    const {
        materials,
        total,
        isLoading,
        viewMode,
        sortValue,
        onChangeSort,
        onChangeViewMode,
        onAddToPlantList,
    } = props;

    const sectionRef = useRef<HTMLElement | null>(null);

    const [uiPage,             setUiPage]             = useState(1);
    const [activeLetter,       setActiveLetter]       = useState<string | null>(null);
    const [activeSubcategory,  setActiveSubcategory]  = useState<string | null>(null);

    // Reset pagina als iets verandert
    useEffect(() => {
        setUiPage(1);
        setActiveLetter(null);
    }, [sortValue, activeSubcategory, materials.length]);

    useEffect(() => {
        setUiPage(1);
    }, [activeLetter]);

    // 1. Gesorteerde materialen
    const sortedMaterials = useMemo(() => {
        const sorted = [...materials];
        if (sortValue === "alfabetisch-z-a") {
            sorted.sort((a, b) => b.name.localeCompare(a.name, "nl"));
        } else {
            // Standaard A-Z (ook bij "geen sortering")
            sorted.sort((a, b) => a.name.localeCompare(b.name, "nl"));
        }
        return sorted;
    }, [materials, sortValue]);

    // Beschikbare subcategorieën + aantal per subcategorie
    const subcategoryCounts = useMemo(() => {
        const map = new Map<string, number>();
        for (const m of sortedMaterials) {
            const key = m.subcategory || "Overig";
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        return map;
    }, [sortedMaterials]);

    const subcategoryFilteredMaterials = useMemo(() => {
        if (!activeSubcategory) return sortedMaterials;
        return sortedMaterials.filter(
            (m) => (m.subcategory || "Overig") === activeSubcategory
        );
    }, [sortedMaterials, activeSubcategory]);

    // 2. Gefilterd op subcategorie (geen los zoekfilter meer op deze pagina)
    const searchFilteredMaterials = subcategoryFilteredMaterials;

    // 3. Beschikbare beginletters op basis van zoekresultaat
    const availableInitials = useMemo<InitialCountMap>(() => {
        const map: InitialCountMap = new Map();
        for (const m of searchFilteredMaterials) {
            const ch = getMaterialInitial(m.name);
            if (ch >= "A" && ch <= "Z") {
                map.set(ch, (map.get(ch) ?? 0) + 1);
            }
        }
        return map;
    }, [searchFilteredMaterials]);

    // Auto-clear letter als die niet meer beschikbaar is
    useEffect(() => {
        if (activeLetter && !availableInitials.has(activeLetter)) {
            setActiveLetter(null);
        }
    }, [availableInitials, activeLetter]);

    // 4. Gefilterd op beginletter
    const letterFilteredMaterials = useMemo(() => {
        if (!activeLetter) return searchFilteredMaterials;
        return searchFilteredMaterials.filter(
            (m) => getMaterialInitial(m.name) === activeLetter
        );
    }, [searchFilteredMaterials, activeLetter]);

    // 5. Paginering
    const totalPages = Math.max(1, Math.ceil(letterFilteredMaterials.length / ITEMS_PER_PAGE));
    const pageStart  = (uiPage - 1) * ITEMS_PER_PAGE;
    const pageEnd    = pageStart + ITEMS_PER_PAGE;

    const visibleMaterials = useMemo(
        () => letterFilteredMaterials.slice(pageStart, pageEnd),
        [letterFilteredMaterials, pageStart, pageEnd]
    );

    const handlePageChange = (page: number) => {
        setUiPage(page);
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const displayTotal = isLoading ? total : searchFilteredMaterials.length;

    return (
        <section
            ref={sectionRef}
            className="rounded-[10px] border p-5"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor:     COLORS.border,
                boxShadow:       "5px 3px 46px -25px rgba(0, 0, 0, 0.25)",
            }}
        >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2
                        className="text-[28px] font-semibold leading-[1.2]"
                        style={{ color: COLORS.text }}
                    >
                        Tuinmaterialen{" "}
                        <span className="text-[14px] font-normal" style={{ color: COLORS.muted }}>
                            ({displayTotal} resultaten)
                        </span>
                    </h2>
                    <p className="mt-3 text-[14px]" style={{ color: COLORS.text }}>
                        In de plantenlijst bepaal je de aantallen voor je definitieve plan.
                    </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                        <label
                            htmlFor="material-sort"
                            className="text-[14px] font-normal"
                            style={{ color: COLORS.text, whiteSpace: "nowrap" }}
                        >
                            Sorteren op
                        </label>

                        <div className="relative">
                            <select
                                id="material-sort"
                                value={sortValue}
                                onChange={(e) => onChangeSort(e.target.value)}
                                className="h-[40px] min-w-[170px] appearance-none rounded-[8px] border bg-white pl-4 pr-10 text-[14px] font-semibold outline-none"
                                style={{ borderColor: "#E0DEDF", color: COLORS.text }}
                            >
                                <option value="">Naam (A-Z)</option>
                                <option value="alfabetisch-z-a">Naam (Z-A)</option>
                            </select>
                            <img
                                src="/icons/chevron-down.svg"
                                alt=""
                                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                                style={{ width: 16, height: 16, display: "block" }}
                            />
                        </div>
                    </div>

                    {/* Grid / lijst toggle */}
                    <div
                        className="inline-flex overflow-hidden rounded-[8px] border bg-white"
                        style={{ borderColor: "#E0DEDF" }}
                    >
                        <button
                            type="button"
                            onClick={() => onChangeViewMode("grid")}
                            className="flex h-[40px] w-[56px] cursor-pointer items-center justify-center border-r"
                            style={{
                                backgroundColor:  viewMode === "grid" ? "#58694C" : "#FFFFFF",
                                borderRightColor: "#E0DEDF",
                            }}
                        >
                            <img
                                src="/icons/grid.svg"
                                alt=""
                                style={{
                                    width: 20, height: 20, display: "block",
                                    filter: viewMode === "grid" ? "brightness(0) invert(1)" : GREEN_ICON_FILTER,
                                }}
                            />
                        </button>
                        <button
                            type="button"
                            onClick={() => onChangeViewMode("list")}
                            className="flex h-[40px] w-[56px] cursor-pointer items-center justify-center"
                            style={{ backgroundColor: viewMode === "list" ? "#58694C" : "#FFFFFF" }}
                        >
                            <img
                                src="/icons/list.svg"
                                alt=""
                                style={{
                                    width: 20, height: 20, display: "block",
                                    filter: viewMode === "list" ? "brightness(0) invert(1)" : GREEN_ICON_FILTER,
                                }}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Subcategorie-tabs ───────────────────────────────────────── */}
            <div className="mt-5">
                <SubcategoryTabBar
                    activeSubcategory={activeSubcategory}
                    subcategoryCounts={subcategoryCounts}
                    totalCount={sortedMaterials.length}
                    onSelectSubcategory={setActiveSubcategory}
                />
            </div>

            {/* ── Alfabet-filterbalk ──────────────────────────────────────── */}
            <AlphabetBar
                activeLetter={activeLetter}
                availableInitials={availableInitials}
                filteredCount={letterFilteredMaterials.length}
                totalCount={searchFilteredMaterials.length}
                onSelectLetter={setActiveLetter}
            />

            {/* ── Grid / lijst ────────────────────────────────────────────── */}
            <div className="mt-6">
                {isLoading ? (
                    <div
                        className="flex min-h-[280px] items-center justify-center"
                        style={{ backgroundColor: "#FFFFFF" }}
                    >
                        <div style={{ textAlign: "center" }}>
                            <div
                                style={{
                                    width:           32,
                                    height:          32,
                                    border:          "3px solid #E3E2E2",
                                    borderTopColor:  "#58694C",
                                    borderRadius:    "50%",
                                    animation:       "spin 0.8s linear infinite",
                                    margin:          "0 auto 12px",
                                }}
                            />
                            <span className="text-[14px]" style={{ color: "#6B7280" }}>
                                Tuinmaterialen worden geladen…
                            </span>
                        </div>
                    </div>
                ) : visibleMaterials.length === 0 ? (
                    <div className="flex min-h-[200px] items-center justify-center">
                        <span className="text-[14px]" style={{ color: COLORS.muted }}>
                            Geen tuinmaterialen gevonden.
                        </span>
                    </div>
                ) : (
                    <div
                        className={
                            viewMode === "grid"
                                ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                                : "space-y-4"
                        }
                    >
                        {visibleMaterials.map((material) =>
                            viewMode === "grid" ? (
                                <GardenMaterialGridCard
                                    key={material.id}
                                    material={material}
                                    onAddToPlantList={onAddToPlantList}
                                />
                            ) : (
                                <GardenMaterialListCard
                                    key={material.id}
                                    material={material}
                                    onAddToPlantList={onAddToPlantList}
                                />
                            )
                        )}
                    </div>
                )}
            </div>

            {/* ── Paginering ──────────────────────────────────────────────── */}
            {!isLoading && (
                <Pagination
                    currentPage={uiPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                />
            )}
        </section>
    );
}
