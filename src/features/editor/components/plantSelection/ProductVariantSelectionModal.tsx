"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { createPortal } from "react-dom";
import { PlantImg } from "@/features/editor/components/PlantImg";
import type { BulkPriceTier } from "@/lib/db/plantTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModalVariant = {
    id: string;
    sizeLabel: string;
    price: number;
    availability: string; // "in_stock" | anything else
    bulkPrices?: BulkPriceTier[];
};

export type ProductVariantSelectionModalProps = {
    /** Primaire naam: botanische naam (plant) of productnaam (materiaal) */
    name: string;
    /** Alleen voor planten: Nederlandse naam */
    dutchName?: string;
    imageUrl: string;
    /** Extra productfoto's naast de hoofdfoto */
    additionalImageUrls?: string[];
    /** Keurmerken — alleen voor planten; laat weg of geef [] voor materialen */
    keurmerken?: string[];
    /** Te kiezen varianten/maten */
    variants: ModalVariant[];
    /** True terwijl varianten worden opgehaald */
    isLoading?: boolean;
    /** Aangeroepen als gebruiker op "Toevoegen aan plantenlijst" klikt.
     *  selectedImageUrl = de door de gebruiker gekozen foto (kan afwijken van imageUrl) */
    onAdd: (sizeLabel: string, price: number, selectedImageUrl: string, bulkPrices: BulkPriceTier[]) => void;
    onClose: () => void;
};

// ---------------------------------------------------------------------------
// Constanten
// ---------------------------------------------------------------------------

const COLORS = {
    orange:      "#E94E1B",
    orangeLight: "#FFE5DD",
    green:       "#58694C",
    greenLight:  "#EEF0ED",
    border:      "#E3E2E2",
    text:        "#111111",
    muted:       "#6B7280",
    infoBlue:    "#D9EDF7",
    infoText:    "#31708F",
    overlay:     "rgba(0,0,0,0.45)",
};

const GREEN_ICON_FILTER =
    "brightness(0) saturate(100%) invert(36%) sepia(13%) saturate(707%) hue-rotate(56deg) brightness(92%) contrast(86%)";

const ORANGE_ICON_FILTER =
    "brightness(0) saturate(100%) invert(51%) sepia(84%) saturate(3601%) hue-rotate(6deg) brightness(95%) contrast(93%)";

const INFO_ICON_FILTER =
    "brightness(0) saturate(100%) invert(36%) sepia(19%) saturate(1182%) hue-rotate(164deg) brightness(97%) contrast(88%)";

const DISABLED_ADD_ICON_FILTER =
    "brightness(0) saturate(100%) invert(65%) sepia(18%) saturate(1044%) hue-rotate(322deg) brightness(85%) contrast(88%)";

const INITIAL_VISIBLE_VARIANTS = 5;

// ---------------------------------------------------------------------------
// Staffel helpers (zelfde logica als StaffelPopover — niet hergebruikt omdat
// buildRows/formatPrice daar niet geëxporteerd zijn)
// ---------------------------------------------------------------------------

type StaffelRow = {
    range: string;
    price: number;
    isBase: boolean;
    discountPct: number;
};

function buildStaffelRows(basePrice: number, bulkPrices: BulkPriceTier[]): StaffelRow[] {
    const sorted = [...bulkPrices].sort((a, b) => a.minQty - b.minQty);
    const rows: StaffelRow[] = [];
    const firstQty = sorted[0]?.minQty ?? null;
    rows.push({
        range: firstQty ? `1 – ${firstQty - 1} stuks` : "1+ stuks",
        price: basePrice,
        isBase: true,
        discountPct: 0,
    });
    sorted.forEach((tier, i) => {
        const nextMinQty = sorted[i + 1]?.minQty ?? null;
        const range = nextMinQty
            ? `${tier.minQty} – ${nextMinQty - 1} stuks`
            : `${tier.minQty}+ stuks`;
        const discountPct = Math.round((1 - tier.price / basePrice) * 100);
        rows.push({ range, price: tier.price, isBase: false, discountPct });
    });
    return rows;
}

function formatStaffelPrice(value: number): string {
    return `€ ${value.toFixed(2).replace(".", ",")}`;
}

// Maximaal aantal thumbnail-sloten zichtbaar (het laatste slotje wordt "+N" als er meer zijn)
const MAX_THUMB_SLOTS = 4;

// ---------------------------------------------------------------------------
// Keurmerk helpers (geïsoleerd — geen import vanuit PlantProposalGrid)
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
    "/images/keurmerken/MPS.png":          "MPS",
    "/images/keurmerken/planet-proof.svg": "PlanetProof",
    "/images/keurmerken/nl-greenlabel.png":"NL Greenlabel",
    "/images/keurmerken/groenkeur.png":    "Groenkeur",
    "/images/keurmerken/skal-biologisch.png": "Skal / Biologisch",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function VariantAvailabilityCell({ availability }: { availability: string }) {
    const inStock = availability === "in_stock";
    return (
        <span
            className="inline-flex items-center gap-1 whitespace-nowrap text-[12px]"
            style={{ color: inStock ? "#008000" : "#807300" }}
        >
            <span
                style={{
                    width: 7, height: 7, borderRadius: "50%",
                    backgroundColor: inStock ? "#008000" : "#807300",
                    display: "inline-block", flexShrink: 0,
                }}
            />
            {!inStock && (
                <span
                    style={{
                        width: 7, height: 7, borderRadius: "50%",
                        backgroundColor: "#807300",
                        display: "inline-block", flexShrink: 0,
                        marginLeft: -3,
                    }}
                />
            )}
            <span>{inStock ? "Op voorraad" : "Binnen een week leverbaar"}</span>
        </span>
    );
}

function VariantSizeRow({
    variant,
    isSelected,
    onToggle,
}: {
    variant: ModalVariant;
    isSelected: boolean;
    onToggle: () => void;
}) {
    const hasStaffels = (variant.bulkPrices?.length ?? 0) > 0;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onToggle}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle();
                }
            }}
            className="grid w-full cursor-pointer items-center gap-3 rounded-[6px] border px-3 py-3 text-left"
            style={{
                gridTemplateColumns: "26px 1fr 100px 180px",
                backgroundColor: isSelected ? COLORS.orangeLight : "#FFFFFF",
                borderColor: isSelected ? COLORS.orange : COLORS.border,
                transition: "background-color 120ms ease, border-color 120ms ease",
                outline: "none",
            }}
        >
            <div
                className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[4px]"
                style={{
                    border: `2px solid ${isSelected ? COLORS.orange : "#BBBBBB"}`,
                    backgroundColor: isSelected ? COLORS.orange : "transparent",
                    transition: "background-color 120ms ease, border-color 120ms ease",
                }}
            >
                {isSelected && (
                    <img
                        src="/icons/check.svg"
                        alt=""
                        style={{
                            width: 11,
                            height: 11,
                            display: "block",
                            filter: "brightness(0) invert(1)",
                        }}
                    />
                )}
            </div>

            <div className="min-w-0 truncate text-[13px] font-medium" style={{ color: COLORS.text }}>
                {variant.sizeLabel}
            </div>

            <div className="flex flex-col items-start gap-[3px]">
                <div className="whitespace-nowrap text-[13px]" style={{ color: "#FF0000" }}>
                    {formatModalPrice(variant.price)}
                </div>
                {hasStaffels && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <img
                            src="/icons/staffels.svg"
                            alt=""
                            style={{ width: 13, height: 13, display: "block", flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 12, color: "#111111", lineHeight: "1.3" }}>
                            Staffels
                        </span>
                    </div>
                )}
            </div>

            <VariantAvailabilityCell availability={variant.availability} />
        </div>
    );
}

function formatModalPrice(price: number): string {
    if (!price || price <= 0) return "—";
    return `€${price.toFixed(2).replace(".", ",")} p/st`;
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export default function ProductVariantSelectionModal(props: ProductVariantSelectionModalProps) {
    const {
        name,
        dutchName,
        imageUrl,
        additionalImageUrls = [],
        keurmerken = [],
        variants,
        isLoading = false,
        onAdd,
        onClose,
    } = props;

    // Alle beschikbare foto's: hoofdfoto + extra's (uniek, geen lege URLs)
    const allImages = [imageUrl, ...additionalImageUrls].filter(Boolean).filter(
        (url, i, arr) => arr.indexOf(url) === i
    );
    const hasMultipleImages = allImages.length > 1;

    // Carousel state
    const [selectedImageUrl, setSelectedImageUrl] = useState<string>(imageUrl);
    const [showAllThumbs, setShowAllThumbs] = useState(false);

    // Thumbnail logica: toon max MAX_THUMB_SLOTS sloten tenzij showAllThumbs=true.
    // Als er meer afbeeldingen zijn dan slots, wordt het laatste slot een "+N" pill.
    const showThumbOverflow = !showAllThumbs && allImages.length > MAX_THUMB_SLOTS;
    const visibleThumbs = showThumbOverflow
        ? allImages.slice(0, MAX_THUMB_SLOTS - 1)   // laat 1 slot vrij voor "+N"
        : allImages;
    const hiddenThumbCount = allImages.length - visibleThumbs.length;

    // Rij uitrekken (flex:1) alleen als alle MAX_THUMB_SLOTS slots gevuld zijn,
    // zodat thumbnails uitlijnen met de hoofdafbeelding. Bij minder foto's
    // blijven ze op vaste breedte staan (geen uitrekken).
    const thumbRowIsFull = !showAllThumbs && allImages.length >= MAX_THUMB_SLOTS;
    const thumbStyle = thumbRowIsFull
        ? { flex: 1, minWidth: 0, height: 64 }
        : { width: 64, height: 64, flexShrink: 0 };

    useScrollLock();
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [showAllVariants, setShowAllVariants] = useState(false);
    const [extraVariantsHeight, setExtraVariantsHeight] = useState(0);
    const [isAdded, setIsAdded] = useState(false);
    // false = staffeltabel ingeklapt, true = uitgevouwen
    const [isStaffelExpanded, setIsStaffelExpanded] = useState(false);
    const [staffelContentHeight, setStaffelContentHeight] = useState(0);
    const staffelContentRef = useRef<HTMLDivElement | null>(null);
    const extraVariantsRef = useRef<HTMLDivElement | null>(null);

    // Reset carousel naar hoofdfoto als imageUrl verandert
    useEffect(() => {
        setSelectedImageUrl(imageUrl);
    }, [imageUrl]);

    // Reset "meer maten" toggle en staffeltabel als varianten wijzigen
    useEffect(() => {
        setShowAllVariants(false);
        setExtraVariantsHeight(0);
        setSelectedVariantId(null);
        setIsStaffelExpanded(false);
    }, [variants.length]);

    useEffect(() => {
        if (!showAllVariants) return;
        setExtraVariantsHeight(extraVariantsRef.current?.scrollHeight ?? 0);
    }, [showAllVariants, variants.length]);

    // Staffeltabel altijd ingeklapt + hoogte resetten als je van maat wisselt
    useEffect(() => {
        setIsStaffelExpanded(false);
        setStaffelContentHeight(0);
    }, [selectedVariantId]);

    const toggleStaffel = useCallback(() => {
        const currentHeight = staffelContentRef.current?.scrollHeight ?? 0;
        if (isStaffelExpanded) {
            // Sluiten: pin hoogte, dan via rAF naar 0
            setStaffelContentHeight(currentHeight);
            requestAnimationFrame(() => {
                setStaffelContentHeight(0);
                setIsStaffelExpanded(false);
            });
        } else {
            // Openen: open zetten, dan via rAF echte scrollHeight meten
            setIsStaffelExpanded(true);
            requestAnimationFrame(() => {
                setStaffelContentHeight(staffelContentRef.current?.scrollHeight ?? currentHeight);
            });
        }
    }, [isStaffelExpanded]);

    // Escape toets sluit modal
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
    const keurmerkImages = getKeurmerkImages(keurmerken);

    const initialVariants = variants.slice(0, INITIAL_VISIBLE_VARIANTS);
    const extraVariants = variants.slice(INITIAL_VISIBLE_VARIANTS);
    const hiddenCount = variants.length - INITIAL_VISIBLE_VARIANTS;
    const hasMoreVariants = hiddenCount > 0;

    const toggleMoreVariants = useCallback(() => {
        const currentHeight = extraVariantsRef.current?.scrollHeight ?? 0;
        if (showAllVariants) {
            setExtraVariantsHeight(currentHeight);
            requestAnimationFrame(() => {
                setExtraVariantsHeight(0);
                setShowAllVariants(false);
            });
        } else {
            setShowAllVariants(true);
            requestAnimationFrame(() => {
                setExtraVariantsHeight(extraVariantsRef.current?.scrollHeight ?? currentHeight);
            });
        }
    }, [showAllVariants]);

    const handleAdd = () => {
        if (!selectedVariant || isAdded) return;
        onAdd(selectedVariant.sizeLabel, selectedVariant.price, selectedImageUrl, selectedVariant.bulkPrices ?? []);
        setIsAdded(true);
        // Geef visuele feedback, sluit modal daarna
        window.setTimeout(() => {
            setIsAdded(false);
            onClose();
        }, 600);
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{
                background: COLORS.overlay,
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
            }}
            onMouseDown={onClose}
        >
            <div
                className="relative flex flex-col overflow-hidden rounded-[12px] bg-white"
                style={{
                    width: "min(1080px, calc(100vw - 32px))",
                    maxHeight: "calc(100vh - 48px)",
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
                }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* ── Sluit-knop ─────────────────────────────────────── */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Sluiten"
                    className="absolute right-4 top-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full"
                    style={{ backgroundColor: "transparent", transition: "background-color 140ms ease" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F2F2F2"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                >
                    <img src="/icons/cancel.svg" alt="" style={{ width: 14, height: 14, display: "block" }} />
                </button>

                {/* ── Hoofd-body ─────────────────────────────────────── */}
                <div className="flex min-h-0 flex-1 overflow-hidden">

                    {/* Linker paneel — foto + info ─────────────── */}
                    <div
                        className="flex flex-col overflow-y-auto p-5"
                        style={{
                            width: 330,
                            flexShrink: 0,
                        }}
                    >
                        {/* Hoofdfoto */}
                        <div
                            className="overflow-hidden rounded-[8px] bg-[#F1F1EE]"
                            style={{ aspectRatio: "1 / 1", width: "100%" }}
                        >
                            <PlantImg
                                src={selectedImageUrl}
                                alt={name}
                                className="block h-full w-full"
                                style={{ transition: "opacity 150ms ease" }}
                            />
                        </div>

                        {/* Thumbnail-rij (alleen tonen als er meerdere foto's zijn) */}
                        {hasMultipleImages && (
                            <div className={`mt-2 flex gap-[6px]${showAllThumbs ? " flex-wrap" : ""}`}>
                                {visibleThumbs.map((url) => {
                                    const isActive = url === selectedImageUrl;
                                    return (
                                        <button
                                            key={url}
                                            type="button"
                                            onClick={() => setSelectedImageUrl(url)}
                                            className="overflow-hidden rounded-[5px] bg-[#F1F1EE]"
                                            style={{
                                                ...thumbStyle,
                                                border: isActive
                                                    ? `2px solid ${COLORS.orange}`
                                                    : "2px solid transparent",
                                                padding: 0, cursor: "pointer",
                                                transition: "border-color 120ms ease",
                                            }}
                                        >
                                            <PlantImg
                                                src={url}
                                                alt=""
                                                className="block h-full w-full"
                                                style={{ objectFit: "cover" }}
                                            />
                                        </button>
                                    );
                                })}

                                {/* "+N" overflow-pill — klik klapt alle thumbnails uit */}
                                {showThumbOverflow && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAllThumbs(true);
                                            const next = allImages[visibleThumbs.length];
                                            if (next) setSelectedImageUrl(next);
                                        }}
                                        className="flex items-center justify-center rounded-[5px]"
                                        style={{
                                            ...thumbStyle,
                                            backgroundColor: "rgb(227, 226, 226)",
                                            border: "2px solid transparent",
                                            cursor: "pointer",
                                            fontSize: 14, fontWeight: 600, color: "#374151",
                                        }}
                                    >
                                        +{hiddenThumbCount}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Namen */}
                        <div className="mt-4">
                            <div
                                className="text-[15px] font-semibold leading-[1.3]"
                                style={{ color: COLORS.text }}
                            >
                                {name}
                            </div>
                            {dutchName && dutchName !== name && (
                                <div
                                    className="mt-[3px] text-[13px]"
                                    style={{ color: COLORS.muted }}
                                >
                                    {dutchName}
                                </div>
                            )}
                        </div>

                        {/* Keurmerken (alleen als aanwezig) */}
                        {keurmerkImages.length > 0 && (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                {keurmerkImages.map((src) => (
                                    <img
                                        key={src}
                                        src={src}
                                        alt={KEURMERK_ALT[src] ?? "Keurmerk"}
                                        style={{
                                            height: 22, width: "auto",
                                            maxWidth: 70, objectFit: "contain",
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                    </div>

                    {/* Verticale scheidingslijn met witruimte boven en onder */}
                    <div style={{ width: 1, backgroundColor: COLORS.border, alignSelf: "stretch", marginTop: 20, marginBottom: 20, flexShrink: 0 }} />

                    {/* Rechter paneel — maatvoering ─────────────── */}
                    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

                        {/* Scrollbaar gedeelte */}
                        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5 pr-8">

                            <div
                                className="text-[19px] font-semibold"
                                style={{ color: COLORS.text }}
                            >
                                Kies maatvoering
                            </div>
                            <div className="mt-1 text-[13px]" style={{ color: COLORS.text }}>
                                Kies de maat die je wilt toevoegen aan je plantenlijst.
                            </div>

                            {/* Tabelkopjes */}
                            <div
                                className="mt-8 grid items-center gap-3 px-3 pb-3 text-[11px] font-semibold uppercase tracking-wide"
                                style={{
                                    gridTemplateColumns: "26px 1fr 100px 180px",
                                    color: COLORS.muted,
                                    borderBottom: `1px solid ${COLORS.border}`,
                                }}
                            >
                                <div />
                                <div>Maatvoering</div>
                                <div>Prijs</div>
                                <div>Beschikbaarheid</div>
                            </div>

                            {/* Laadstatus */}
                            {isLoading ? (
                                <div className="flex min-h-[120px] items-center justify-center">
                                    <div
                                        style={{
                                            width: 28, height: 28,
                                            border: "3px solid #E3E2E2",
                                            borderTopColor: COLORS.green,
                                            borderRadius: "50%",
                                            animation: "spin 0.8s linear infinite",
                                        }}
                                    />
                                </div>
                            ) : variants.length === 0 ? (
                                <div
                                    className="flex min-h-[80px] items-center text-[13px]"
                                    style={{ color: COLORS.muted }}
                                >
                                    Geen maten beschikbaar.
                                </div>
                            ) : (
                                <div className="mt-4 flex flex-col gap-[6px]">
                                    {initialVariants.map((variant) => {
                                        const isSelected = variant.id === selectedVariantId;
                                        const hasStaffels = (variant.bulkPrices?.length ?? 0) > 0;
                                        return (
                                            // ✅ <div role="button"> i.p.v. <button> zodat de staffellink
                                            // (ook een klikbaar element) geldig genest kan worden.
                                            <div
                                                key={variant.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => setSelectedVariantId((prev) => prev === variant.id ? null : variant.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault();
                                                        setSelectedVariantId((prev) => prev === variant.id ? null : variant.id);
                                                    }
                                                }}
                                                className="grid w-full cursor-pointer items-center gap-3 rounded-[6px] border px-3 py-3 text-left"
                                                style={{
                                                    gridTemplateColumns: "26px 1fr 100px 180px",
                                                    backgroundColor: isSelected ? COLORS.orangeLight : "#FFFFFF",
                                                    borderColor: isSelected ? COLORS.orange : COLORS.border,
                                                    transition: "background-color 120ms ease, border-color 120ms ease",
                                                    outline: "none",
                                                }}
                                            >
                                                {/* Checkbox */}
                                                <div
                                                    className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[4px]"
                                                    style={{
                                                        border: `2px solid ${isSelected ? COLORS.orange : "#BBBBBB"}`,
                                                        backgroundColor: isSelected ? COLORS.orange : "transparent",
                                                        transition: "background-color 120ms ease, border-color 120ms ease",
                                                    }}
                                                >
                                                    {isSelected && (
                                                        <img
                                                            src="/icons/check.svg"
                                                            alt=""
                                                            style={{
                                                                width: 11, height: 11,
                                                                display: "block",
                                                                filter: "brightness(0) invert(1)",
                                                            }}
                                                        />
                                                    )}
                                                </div>

                                                {/* Maatvoering label */}
                                                <div
                                                    className="min-w-0 truncate text-[13px] font-medium"
                                                    style={{ color: COLORS.text }}
                                                >
                                                    {variant.sizeLabel}
                                                </div>

                                                {/* Prijs + optionele staffellink */}
                                                <div className="flex flex-col items-start gap-[3px]">
                                                    <div
                                                        className="whitespace-nowrap text-[13px]"
                                                        style={{ color: "#FF0000" }}
                                                    >
                                                        {formatModalPrice(variant.price)}
                                                    </div>
                                                    {hasStaffels && (
                                                        <div
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: 4,
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
                                                                    lineHeight: "1.3",
                                                                }}
                                                            >
                                                                Staffels
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Beschikbaarheid */}
                                                <VariantAvailabilityCell availability={variant.availability} />
                                            </div>
                                        );
                                    })}

                                    {hasMoreVariants && (
                                        <div
                                            ref={extraVariantsRef}
                                            className="flex flex-col gap-[6px]"
                                            style={{
                                                height: extraVariantsHeight,
                                                overflow: "hidden",
                                                opacity: showAllVariants ? 1 : 0,
                                                transform: showAllVariants ? "translateY(0)" : "translateY(-6px)",
                                                transition: [
                                                    "height 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                                                    "opacity 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                                                    "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                                                ].join(", "),
                                                pointerEvents: showAllVariants ? "auto" : "none",
                                            }}
                                        >
                                            {extraVariants.map((variant) => (
                                                <VariantSizeRow
                                                    key={variant.id}
                                                    variant={variant}
                                                    isSelected={variant.id === selectedVariantId}
                                                    onToggle={() => setSelectedVariantId((prev) => prev === variant.id ? null : variant.id)}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Meer/minder toggle */}
                                    {hasMoreVariants && (
                                        <button
                                            type="button"
                                            onClick={toggleMoreVariants}
                                            className="mt-1 flex cursor-pointer items-center gap-2 text-[13px] font-medium"
                                            style={{ color: COLORS.green }}
                                        >
                                            <img
                                                src="/icons/chevron-down.svg"
                                                alt=""
                                                style={{
                                                    width: 14, height: 14, display: "block",
                                                    transform: showAllVariants ? "rotate(180deg)" : "rotate(0deg)",
                                                    transition: "transform 200ms ease",
                                                    filter: GREEN_ICON_FILTER,
                                                }}
                                            />
                                            {showAllVariants
                                                ? "Minder maten bekijken"
                                                : `Meer maten bekijken (${hiddenCount})`}
                                        </button>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* ── Info-box of staffeltabel (niet scrollbaar) ── */}
                        <div className="flex-shrink-0 px-6 pr-8">
                            {(() => {
                                const staffelVariant =
                                    selectedVariant && (selectedVariant.bulkPrices?.length ?? 0) > 0
                                        ? selectedVariant
                                        : null;

                                if (staffelVariant) {
                                    const rows = buildStaffelRows(staffelVariant.price, staffelVariant.bulkPrices!);
                                    return (
                                        <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 16, paddingBottom: 4 }}>
                                            {/* Klikbare titel met chevron */}
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={toggleStaffel}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault();
                                                        toggleStaffel();
                                                    }
                                                }}
                                                className="flex items-center gap-2 mb-3"
                                                style={{ cursor: "pointer", outline: "none" }}
                                            >
                                                <img
                                                    src="/icons/discount.svg"
                                                    alt=""
                                                    style={{
                                                        width: 16, height: 16, display: "block", flexShrink: 0,
                                                        filter: GREEN_ICON_FILTER,
                                                    }}
                                                />
                                                <span
                                                    className="text-[14px] font-semibold flex-1"
                                                    style={{ color: COLORS.text }}
                                                >
                                                    Staffelprijzen voor {staffelVariant.sizeLabel}
                                                </span>
                                                <img
                                                    src="/icons/chevron-down.svg"
                                                    alt=""
                                                    style={{
                                                        width: 14, height: 14, display: "block", flexShrink: 0,
                                                        filter: GREEN_ICON_FILTER,
                                                        transform: isStaffelExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                                                        transition: `transform 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
                                                    }}
                                                />
                                            </div>

                                            {/* Staffeltabel — geanimeerd open/dicht */}
                                            <div
                                                ref={staffelContentRef}
                                                style={{
                                                    height: staffelContentHeight,
                                                    overflow: "hidden",
                                                    opacity: isStaffelExpanded ? 1 : 0,
                                                    transform: isStaffelExpanded ? "translateY(0)" : "translateY(-6px)",
                                                    transition: [
                                                        "height 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                                                        "opacity 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                                                        "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                                                    ].join(", "),
                                                    pointerEvents: isStaffelExpanded ? "auto" : "none",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        border: `1px solid ${COLORS.border}`,
                                                        borderRadius: 8,
                                                        overflow: "hidden",
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    {/* Header */}
                                                    <div
                                                        style={{
                                                            display: "grid",
                                                            gridTemplateColumns: "1fr 100px 110px",
                                                            padding: "8px 14px",
                                                            backgroundColor: "#EDF2EB",
                                                            borderBottom: `1px solid ${COLORS.border}`,
                                                        }}
                                                    >
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.green }}>Vanaf</span>
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.green }}>Stukprijs</span>
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.green }}></span>
                                                    </div>

                                                    {/* Rijen */}
                                                    {rows.map((row, i) => (
                                                        <div
                                                            key={i}
                                                            style={{
                                                                display: "grid",
                                                                gridTemplateColumns: "1fr 100px 110px",
                                                                alignItems: "center",
                                                                padding: "10px 14px",
                                                                borderBottom: i < rows.length - 1 ? `1px solid #F0EFEF` : "none",
                                                                backgroundColor: "#FFFFFF",
                                                            }}
                                                        >
                                                            <span style={{ fontSize: 13, color: COLORS.text }}>{row.range}</span>
                                                            <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>
                                                                {formatStaffelPrice(row.price)}
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
                                            </div>
                                        </div>
                                    );
                                }

                                // Standaard: blauwe infobox
                                return (
                                    <div
                                        className="flex items-start gap-3 rounded-[6px] px-4 py-3"
                                        style={{ backgroundColor: COLORS.infoBlue, marginTop: 16, marginBottom: 16 }}
                                    >
                                        <img
                                            src="/icons/info.svg"
                                            alt=""
                                            style={{
                                                width: 15, height: 15, display: "block",
                                                flexShrink: 0, marginTop: 1,
                                                filter: INFO_ICON_FILTER,
                                            }}
                                        />
                                        <span
                                            className="text-[13px] leading-[1.5]"
                                            style={{ color: COLORS.infoText }}
                                        >
                                            Aantal kiezen is pas mogelijk nadat de planten zijn gekoppeld aan plantvakken.
                                            In de volgende stap worden aantallen automatisch berekend.
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* ── Samenvattingsbalk + Toevoegen-knop (niet scrollbaar) ── */}
                        <div className="flex-shrink-0">
                            {/* Inset scheidingslijn — uitgelijnd met scrollbaar blok (px-6 pr-8) */}
                            <div className="px-6 pr-8">
                                <div style={{ height: 1, backgroundColor: COLORS.border }} />
                            </div>
                            <div className="flex items-center justify-between gap-4 px-6 pr-8 py-4">
                                {/* Gekozen maat + prijs */}
                                <div className="flex items-center gap-6">
                                    <div>
                                        <div
                                            className="text-[11px] font-semibold uppercase tracking-wide"
                                            style={{ color: COLORS.muted }}
                                        >
                                            Gekozen maat
                                        </div>
                                        <div className="mt-1 min-h-[22px]">
                                            {selectedVariant ? (
                                                <span
                                                    className="text-[13px] font-semibold"
                                                    style={{ color: COLORS.text }}
                                                >
                                                    {selectedVariant.sizeLabel}
                                                </span>
                                            ) : (
                                                <span className="text-[13px]" style={{ color: "#C0C0C0" }}>Nog geen maat gekozen</span>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <div
                                            className="text-[11px] font-semibold uppercase tracking-wide"
                                            style={{ color: COLORS.muted }}
                                        >
                                            Prijs
                                        </div>
                                        <div
                                            className="mt-1 text-[14px] font-semibold"
                                            style={{ color: "#FF0000", minHeight: 22 }}
                                        >
                                            {selectedVariant
                                                ? formatModalPrice(selectedVariant.price)
                                                : null}
                                        </div>
                                    </div>
                                </div>

                                {/* Toevoegen-knop */}
                                <button
                                    type="button"
                                    onClick={handleAdd}
                                    disabled={!selectedVariant || isAdded}
                                    className="flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-[6px] px-5 text-[13px] font-semibold"
                                    style={{
                                        height: 44,
                                        backgroundColor: isAdded
                                            ? "#008000"
                                            : !selectedVariant
                                                ? "#F4C8B8"
                                                : COLORS.orange,
                                        color: !selectedVariant ? "#CC8D75" : "#FFFFFF",
                                        cursor: !selectedVariant ? "not-allowed" : "pointer",
                                        transition: "background-color 200ms ease",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    <img
                                        src={isAdded ? "/icons/check.svg" : "/icons/add-to-cart.svg"}
                                        alt=""
                                        style={{
                                            width: 18, height: 18, display: "block",
                                            filter: !selectedVariant
                                                ? DISABLED_ADD_ICON_FILTER
                                                : "brightness(0) invert(1)",
                                        }}
                                    />
                                    {isAdded ? "Toegevoegd!" : "Toevoegen aan plantenlijst"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Footer USP-balk ─────────────────────────────────── */}
                <div
                    className="flex-shrink-0"
                    style={{ backgroundColor: COLORS.greenLight }}
                >
                    <div className="flex items-center py-5">
                        {/* USP 1 */}
                        <div className="flex flex-1 items-center justify-center gap-3 px-8">
                            <img
                                src="/icons/clock.svg"
                                alt=""
                                style={{
                                    width: 20, height: 20, display: "block",
                                    flexShrink: 0, filter: GREEN_ICON_FILTER,
                                }}
                            />
                            <div>
                                <div className="text-[13px] font-semibold" style={{ color: COLORS.text }}>
                                    Bestel voor donderdag 12:00 uur
                                </div>
                                <div className="text-[12px] font-semibold" style={{ color: COLORS.green }}>
                                    → levering volgende week
                                </div>
                            </div>
                        </div>

                        {/* Divider met witruimte boven en onder */}
                        <div style={{ width: 1, backgroundColor: COLORS.border, alignSelf: "stretch", marginTop: 8, marginBottom: 8 }} />

                        {/* USP 2 */}
                        <div className="flex flex-1 items-center justify-center gap-3 px-8">
                            <img
                                src="/icons/shield-check.svg"
                                alt=""
                                style={{
                                    width: 20, height: 20, display: "block",
                                    flexShrink: 0, filter: GREEN_ICON_FILTER,
                                }}
                            />
                            <div>
                                <div className="text-[13px] font-semibold" style={{ color: COLORS.text }}>
                                    Gratis bezorgd vanaf € 350,-
                                </div>
                                <div className="text-[12px] font-semibold" style={{ color: COLORS.green }}>
                                    In alle provincies van Nederland
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
