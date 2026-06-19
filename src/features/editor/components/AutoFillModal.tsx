"use client";

import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { PlantImg } from "@/features/editor/components/PlantImg";
import ProductVariantSelectionModal from "@/features/editor/components/plantSelection/ProductVariantSelectionModal";
import type { ModalVariant } from "@/features/editor/components/plantSelection/ProductVariantSelectionModal";
import type { BulkPriceTier } from "@/lib/db/plantTypes";
import type { ApiPlant } from "@/lib/db/plantTypes";
import type { ConfirmModalItem } from "@/features/editor/components/ConfirmModal";
import { useRightStepMenuStore } from "@/features/editor/state/rightStepMenuStore";
import { useProjectStore, OBJECT_STYLES } from "@/state/projectStore";
import { usePlantSelectionStore, type PlantListItem } from "@/features/editor/state/plantSelectionStore";
import { usePlantVariantStore } from "@/features/editor/state/plantVariantStore";
import { buildAdviceData, type ProjectPlantLike } from "@/features/editor/lib/plantAdvice";
import { getPlantUnitPriceForQuantity, withResolvedBulkPrices } from "@/features/editor/lib/plantPricing";
import type { PolyObject } from "@/state/projectStore";
import { explainPlantScore, type ScoringInput, type SuitabilityLabel } from "@/features/editor/lib/plantScoring";
import { getObjectAreaInSquareMeters, formatSquareMeters } from "@/state/areaMetrics";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type AutoFillView = 1 | 2 | 3 | 4 | 5 | 6;

type ProposalVariant = { id: string; sizeLabel: string; price: number; availability: string; bulkPrices?: BulkPriceTier[] };

type ProposalPlant = {
    id: string;
    apiPlant: ApiPlant;
    botanicalName: string;
    dutchName: string;
    imageUrl: string | null;
    suitability: SuitabilityLabel;
    keurmerken: string[];
    variants: ProposalVariant[];
};

type ProposalSection = {
    bedId: string;
    bedNr: string;
    bedTitle: string;
    nrBg: string;
    nrColor: string;
    nrBorder?: string | null;
    plants: ProposalPlant[];
};

type AddedLink = { plantId: string; plantName: string };

export type AutoFillModalProps = {
    open: boolean;
    items: ConfirmModalItem[];
    onClose: () => void;
    onGoToFinalisatie: () => void;
    budget?: number;
    initialView?: AutoFillView;
    successTitle?: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const COLORS = {
    orange: "#E94E1B",
    orangeLight: "#FFE5DD",
    green: "#58694C",
    greenLight: "#EEF0ED",
    border: "#E3E2E2",
    text: "#111111",
    muted: "#6B7280",
    red: "#FF0000",
    overlay: "rgba(0,0,0,0.34)",
};

const GREEN_ICON_FILTER =
    "brightness(0) saturate(100%) invert(36%) sepia(13%) saturate(707%) hue-rotate(56deg) brightness(92%) contrast(86%)";

const VAT_RATE = 0.09;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatFromPrice(price: number): string {
    if (!price || price <= 0) return "";
    return `Vanaf €${price.toFixed(2).replace(".", ",")} p/st`;
}

function getKeurmerkImages(keurmerken: string[]): string[] {
    const images = new Set<string>();
    for (const k of keurmerken) {
        const v = k.trim();
        if (v.toUpperCase().startsWith("MPS")) images.add("/images/keurmerken/MPS.png");
        else if (v === "PlanetProof") images.add("/images/keurmerken/planet-proof.svg");
        else if (v === "NL greenlabel") images.add("/images/keurmerken/nl-greenlabel.png");
        else if (v === "Groenkeur") images.add("/images/keurmerken/groenkeur.png");
        else if (v === "Skal" || v === "Biologisch") images.add("/images/keurmerken/skal-biologisch.png");
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

function bedLabel(bedNr: string): "plantvak" | "haagvak" | "boomvak" {
    if (bedNr.startsWith("H")) return "haagvak";
    if (bedNr.startsWith("B")) return "boomvak";
    return "plantvak";
}

function bedObjectType(bedNr: string): "plantbed" | "hedge" | "treebed" {
    if (bedNr.startsWith("H")) return "hedge";
    if (bedNr.startsWith("B")) return "treebed";
    return "plantbed";
}

function bedTypeFromNr(nr: string): string {
    if (nr.startsWith("H")) return "hedge";
    if (nr.startsWith("B")) return "treebed";
    return "plantbed";
}

function formatEuro(v: number) {
    return `€${v.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Payload types for AI proposal API call
// ──────────────────────────────────────────────────────────────────────────────

type UserPlantSpec = {
    plantListItemId: string;
    plantId: string;
    latinName: string;
    dutchName: string;
    appGroup: string;
    maxHeightCm: number;
    standplaatsen: string[];
    grondsoorten: string[];
    keurmerken: string[];
    linkedBedIds: string[];
};

type NeighborPlantSpec = {
    latinName: string;
    dutchName: string;
    maxHeightCm: number;
    standplaatsen: string[];
    grondsoorten: string[];
    keurmerken: string[];
    bedNr?: string;
    bedTitle?: string;
};

type NeighborContext = {
    bedId: string;
    neighborPlants: NeighborPlantSpec[];
};

// ──────────────────────────────────────────────────────────────────────────────
// BBox helpers (used for neighbor detection in the API payload)
// ──────────────────────────────────────────────────────────────────────────────

type BBox = { minX: number; minY: number; maxX: number; maxY: number };

function getBoundingBox(points: number[]): BBox {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length - 1; i += 2) {
        if (points[i] < minX) minX = points[i];
        if (points[i] > maxX) maxX = points[i];
        if (points[i + 1] < minY) minY = points[i + 1];
        if (points[i + 1] > maxY) maxY = points[i + 1];
    }
    return { minX, minY, maxX, maxY };
}

function areBBoxesNear(a: BBox, b: BBox, margin = 80): boolean {
    return a.maxX + margin >= b.minX && b.maxX + margin >= a.minX &&
        a.maxY + margin >= b.minY && b.maxY + margin >= a.minY;
}

function getBadgeColorsForObject(obj: PolyObject): { nrBg: string; nrColor: string; nrBorder: string | null } {
    if (obj.type === "hedge") return { nrBg: "#95CE86", nrColor: "#56793E", nrBorder: null };
    if (obj.type === "treebed") return { nrBg: "#8FC38E", nrColor: "#476D3C", nrBorder: "#476D3C" };
    const style = { ...OBJECT_STYLES[obj.type as keyof typeof OBJECT_STYLES], ...(((obj as any).customStyle) ?? {}) };
    const fill = (style as any).fill ?? "#58694C";
    const stroke = (style as any).stroke ?? null;
    const hex = fill.trim().replace("#", "");
    let nrColor = "#3F6B3F";
    if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (hex.toUpperCase() !== "F2FDEF") {
            const adj = (v: number) => luminance > 0.62 ? Math.max(0, Math.round(v * 0.55)) : Math.min(255, Math.round(v + (255 - v) * 0.55));
            nrColor = `#${adj(r).toString(16).padStart(2, "0").toUpperCase()}${adj(g).toString(16).padStart(2, "0").toUpperCase()}${adj(b).toString(16).padStart(2, "0").toUpperCase()}`;
        }
    }
    return { nrBg: fill, nrColor, nrBorder: stroke ?? null };
}

function buildSectionsFromStore(objects: PolyObject[], plantbedLinks: Record<string, string[]>): ProposalSection[] {
    return objects
        .filter((obj) => (obj.type === "plantbed" || obj.type === "hedge" || obj.type === "treebed") && (plantbedLinks[obj.id]?.length ?? 0) > 0)
        .map((obj) => {
            const no = (obj as any).plantbedNo ?? 1;
            const prefix = obj.type === "hedge" ? "H" : obj.type === "treebed" ? "B" : "P";
            const label = obj.type === "hedge" ? "Haag" : obj.type === "treebed" ? "Boomvak" : "Plantvak";
            const { nrBg, nrColor, nrBorder } = getBadgeColorsForObject(obj);
            return {
                bedId: obj.id,
                bedNr: `${prefix}${no}`,
                bedTitle: `${label} ${no}`,
                nrBg,
                nrColor,
                nrBorder,
                plants: [],
            };
        });
}


// ──────────────────────────────────────────────────────────────────────────────
// BudgetRow — compact budget/price display for the footer
// ──────────────────────────────────────────────────────────────────────────────

function BudgetRow({ budget }: { budget?: number }) {
    const objects = useProjectStore((s) => s.objects);
    const plantbedLinks = useProjectStore((s) => s.plantbedLinks);
    const projectPlants = useProjectStore((s) => s.plants as ProjectPlantLike[]);
    const distributionOverrides = useProjectStore((s) => (s as any).distributionOverrides as Record<string, Record<string, number>>);
    const plantListItems = usePlantSelectionStore((s) => s.plantListItems);
    const variantCache = usePlantVariantStore((s) => s.cache);
    const fetchVariants = usePlantVariantStore((s) => s.fetchVariants);

    useEffect(() => {
        for (const item of plantListItems) {
            if (item.plant.category !== "Tuinmaterialen") fetchVariants(item.plant.id);
        }
    }, [plantListItems, fetchVariants]);

    const variantsByPlantId = useMemo(() => {
        const map: Record<string, { sizeLabel: string; bulkPrices?: BulkPriceTier[] }[]> = {};
        for (const item of plantListItems) map[item.plant.id] = variantCache[item.plant.id]?.variants ?? [];
        return map;
    }, [plantListItems, variantCache]);

    const totalIncVat = useMemo(() => {
        const tuinmatIds = new Set(plantListItems.filter(i => i.plant.category === "Tuinmaterialen").map(i => i.id));
        const itemMap = new Map<string, (typeof plantListItems)[number]>();
        for (const item of plantListItems) {
            if (tuinmatIds.has(item.id)) continue;
            itemMap.set(item.id, withResolvedBulkPrices(item, variantsByPlantId[item.plant.id]));
        }
        const quantityByItemId = new Map<string, number>();
        for (const [objectId, linkedPlantIds] of Object.entries(plantbedLinks)) {
            if (!linkedPlantIds?.length) continue;
            const object = objects.find((o) => o.id === objectId);
            if (!object) continue;
            const plantOnlyIds = linkedPlantIds.filter(id => !tuinmatIds.has(id));
            if (!plantOnlyIds.length) continue;
            const adviceData = buildAdviceData({
                selectedObject: object,
                currentType: object.type,
                linkedPlantIds: plantOnlyIds,
                plants: projectPlants,
                distributionOverrides: distributionOverrides[objectId],
            });
            for (const row of adviceData.rows) {
                if (row.adviceCount === null) continue;
                quantityByItemId.set(row.plantId, (quantityByItemId.get(row.plantId) ?? 0) + row.adviceCount);
            }
        }
        let subtotal = 0;
        for (const [itemId, count] of quantityByItemId) {
            const item = itemMap.get(itemId);
            if (!item) continue;
            const price = getPlantUnitPriceForQuantity(withResolvedBulkPrices(item, variantsByPlantId[item.plant.id]), count);
            if (typeof price === "number" && Number.isFinite(price)) subtotal += count * price;
        }
        // tuinmaterialen altijd apart
        for (const item of plantListItems.filter(i => tuinmatIds.has(i.id))) {
            const count = item.quantity > 0 ? item.quantity : 1;
            const price = getPlantUnitPriceForQuantity(item, count);
            if (typeof price === "number" && Number.isFinite(price) && price > 0) subtotal += count * price;
        }
        return subtotal * (1 + VAT_RATE);
    }, [plantListItems, objects, plantbedLinks, projectPlants, distributionOverrides, variantsByPlantId]);

    const over = budget !== undefined && totalIncVat > budget ? totalIncVat - budget : null;

    return (
        <div className="flex flex-col justify-center" style={{ minWidth: 0, flex: "0 0 auto", maxWidth: 280 }}>
            <div className="flex items-baseline gap-[5px] flex-wrap">
                <span className="text-[12px] whitespace-nowrap" style={{ color: COLORS.muted }}>Geschatte totaalbedrag:</span>
                <span className="text-[14px] font-bold whitespace-nowrap" style={{ color: COLORS.text }}>{formatEuro(totalIncVat)}</span>
                <span className="text-[11px] whitespace-nowrap" style={{ color: COLORS.muted }}>incl. BTW</span>
            </div>
            <div className="flex items-baseline gap-[5px] flex-wrap">
                {budget !== undefined ? (
                    <>
                        <span className="text-[12px] whitespace-nowrap" style={{ color: COLORS.muted }}>Budget:</span>
                        <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: COLORS.muted }}>
                            {formatEuro(budget)}
                        </span>
                        {over !== null && (
                            <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: COLORS.red }}>
                                · {formatEuro(over)} boven budget
                            </span>
                        )}
                    </>
                ) : (
                    <span className="text-[12px]" style={{ color: COLORS.muted }}>Geen budget ingesteld</span>
                )}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function KeurmerkLogos({ images }: { images: string[] }) {
    if (images.length === 0) return null;
    return (
        <div className="flex items-center gap-2" style={{ minHeight: 18 }}>
            {images.map((src) => (
                <img key={src} src={src} alt={KEURMERK_ALT[src] ?? "Keurmerk"}
                    style={{ height: 16, width: "auto", maxWidth: 56, display: "block", objectFit: "contain" }} />
            ))}
        </div>
    );
}

function BedBadge({ label, bg, color, border }: { label: string; bg: string; color: string; border?: string | null }) {
    return (
        <div className="flex shrink-0 items-center justify-center rounded-md text-[12px] font-bold"
            style={{ width: 28, height: 28, backgroundColor: bg, color, border: border ? `1px solid ${border}` : "none" }}>
            {label}
        </div>
    );
}

const SUITABILITY_CONFIG: Record<SuitabilityLabel, { text: string; icon: string; green: boolean }> = {
    "zeer-geschikt": { text: "Zeer geschikt", icon: "/icons/dubble-check.svg", green: true },
    "geschikt": { text: "Geschikt", icon: "/icons/check-icon.svg", green: true },
    "goede-aanvulling": { text: "Goede aanvulling", icon: "/icons/plus.svg", green: false },
};

function SuitabilityBadge({ label, onClick, isOpen }: {
    label: SuitabilityLabel;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    isOpen?: boolean;
}) {
    const { text, icon, green } = SUITABILITY_CONFIG[label];
    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                onPointerDown={(e) => e.stopPropagation()}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                className="inline-flex items-center gap-[5px] rounded-full px-3 py-[6px] text-[11px] font-semibold whitespace-nowrap"
                style={{ backgroundColor: green ? "#DEFFDE" : "#FDFFC6", color: green ? "#008000" : "#807300",
                    border: "none", cursor: "pointer" }}>
                <img src={icon} alt="" style={{ width: 13, height: 13, display: "block", flexShrink: 0,
                    filter: green ? undefined : "brightness(0) saturate(100%) invert(37%) sepia(100%) saturate(450%) hue-rotate(16deg) brightness(60%)" }} />
                {text}
            </button>
        );
    }
    return (
        <span className="inline-flex items-center gap-[5px] rounded-full px-3 py-[6px] text-[11px] font-semibold whitespace-nowrap"
            style={{ backgroundColor: green ? "#DEFFDE" : "#FDFFC6", color: green ? "#008000" : "#807300" }}>
            <img src={icon} alt="" style={{ width: 13, height: 13, display: "block", flexShrink: 0,
                filter: green ? undefined : "brightness(0) saturate(100%) invert(37%) sepia(100%) saturate(450%) hue-rotate(16deg) brightness(60%)" }} />
            {text}
        </span>
    );
}

// ── Suitability popover for AI proposal cards ──────────────────────────────────

const ICON_BY_LABEL: Record<string, string> = {
    "Standplaats":       "/icons/standplaats.svg",
    "Grondsoort":        "/icons/grondsoort.svg",
    "Hoogtewerking":     "/icons/volwassen-hoogte.svg",
    "Keurmerken":        "/icons/keurmerk.svg",
    "Structuur & opbouw": "/icons/idea.svg",
};

function NeighborBedAccordion({ group, isOpen, onToggle }: {
    group: { bedNr: string; bedTitle: string; plants: NeighborPlantSpec[] };
    isOpen: boolean;
    onToggle: () => void;
}) {
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const [height, setHeight] = useState(0);

    const handleToggle = () => {
        if (isOpen) {
            const current = contentRef.current?.scrollHeight ?? 0;
            setHeight(current);
            requestAnimationFrame(() => setHeight(0));
        }
        onToggle();
    };

    useEffect(() => {
        if (isOpen) {
            setHeight(contentRef.current?.scrollHeight ?? 0);
        } else {
            setHeight(0);
        }
    }, [isOpen]);

    const ease = ACCORDION_EASE;
    const ms = ACCORDION_MS;

    return (
        <div style={{ borderRadius: 6, border: `1px solid #E3E2E2`, overflow: "hidden" }}>
            <button type="button" onClick={handleToggle}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", background: isOpen ? "#F1F3EF" : "#F7F7F5",
                    border: "none", borderBottom: isOpen ? "1px solid #E3E2E2" : "none",
                    cursor: "pointer", textAlign: "left",
                    transition: `background ${ms}ms ${ease}` }}>
                <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center",
                    padding: "1px 7px", borderRadius: 4, backgroundColor: "#EEF1EB",
                    fontSize: 11, fontWeight: 700, color: "#58694C", lineHeight: "1.6" }}>
                    {group.bedNr}
                </span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#111111" }}>
                    {group.bedTitle}
                </span>
                <span style={{ fontSize: 11, color: "#7B7B7B", whiteSpace: "nowrap" }}>
                    {group.plants.length} {group.plants.length === 1 ? "plant" : "planten"}
                </span>
                <img src="/icons/chevron-down.svg" alt="" style={{
                    width: 14, height: 14, display: "block", flexShrink: 0,
                    filter: "brightness(0) saturate(100%) invert(46%)",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: `transform ${ms}ms ${ease}`,
                }} />
            </button>
            <div style={{ height, overflow: "hidden",
                transition: `height ${ms}ms ${ease}` }}>
                <div ref={contentRef} style={{ padding: "8px 10px 10px",
                    display: "flex", flexDirection: "column", gap: 5 }}>
                    {group.plants.map((n, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
                            fontSize: 12 }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%",
                                backgroundColor: COLORS.green, flexShrink: 0 }} />
                            <span style={{ flex: 1, color: "#111111", fontStyle: "italic" }}>{n.latinName}</span>
                            {n.maxHeightCm > 0 && (
                                <span style={{ color: COLORS.muted, whiteSpace: "nowrap" }}>{n.maxHeightCm} cm</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ProposalSuitabilityPopover({ plant, label, scoringInput, neighborPlants, anchorRect, onClose }: {
    plant: ProposalPlant;
    label: SuitabilityLabel;
    scoringInput: ScoringInput;
    neighborPlants: NeighborPlantSpec[];
    anchorRect: DOMRect;
    onClose: () => void;
}) {
    const popoverRef = React.useRef<HTMLDivElement | null>(null);
    const explanation = React.useMemo(
        () => explainPlantScore(plant.apiPlant, scoringInput),
        [plant.apiPlant, scoringInput],
    );
    const [resolvedPos, setResolvedPos] = useState<{ top: number; openUpward: boolean } | null>(null);
    const [openBedNr, setOpenBedNr] = useState<string | null>(null);

    useEffect(() => {
        const handlePointerDown = (e: PointerEvent) => {
            if (!(e.target instanceof Node)) return;
            if (popoverRef.current?.contains(e.target)) return;
            onClose();
        };
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        const handleScroll = () => onClose();
        const t = window.setTimeout(() => document.addEventListener("pointerdown", handlePointerDown), 0);
        document.addEventListener("keydown", handleKey);
        window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
        return () => {
            window.clearTimeout(t);
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKey);
            window.removeEventListener("scroll", handleScroll, { capture: true });
        };
    }, [onClose]);

    useLayoutEffect(() => {
        if (!popoverRef.current) return;
        const height = popoverRef.current.offsetHeight;
        const margin = 12;
        const spaceBelow = window.innerHeight - anchorRect.bottom - 8 - margin;
        const spaceAbove = anchorRect.top - 8 - margin;
        let top: number;
        let openUpward: boolean;
        if (height <= spaceBelow) {
            top = anchorRect.bottom + 8;
            openUpward = false;
        } else if (height <= spaceAbove) {
            top = anchorRect.top - 8 - height;
            openUpward = true;
        } else if (spaceBelow >= spaceAbove) {
            top = anchorRect.bottom + 8;
            openUpward = false;
        } else {
            top = anchorRect.top - 8 - height;
            openUpward = true;
        }
        top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
        setResolvedPos({ top, openUpward });
    }, [anchorRect]);

    if (typeof document === "undefined") return null;

    const { text } = SUITABILITY_CONFIG[label];
    const statusForScore = (score: number) => {
        if (score >= 75) return { label: "Match", color: "#008000", isMatch: true };
        if (score >= 40) return { label: "Goede aanvulling", color: "#FF8A00", isMatch: false };
        return { label: "Geen match", color: "#B42318", isMatch: false };
    };

    const width = 400;
    const margin = 12;
    const left = Math.min(Math.max(anchorRect.right - width, margin), window.innerWidth - width - margin);
    const openUpward = resolvedPos?.openUpward ?? false;
    const top = resolvedPos?.top ?? (anchorRect.bottom + 8);
    const arrowLeft = Math.max(18, Math.min(anchorRect.left + anchorRect.width / 2 - left, width - 34));

    return createPortal(
        <div ref={popoverRef} role="dialog" aria-label={`Uitleg ${text}`}
            style={{ position: "fixed", top, left, width, backgroundColor: "#FFFFFF",
                borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)",
                border: "1px solid #E3E2E2", overflow: "hidden", zIndex: 9999,
                visibility: resolvedPos ? "visible" : "hidden" }}>

            {/* Arrow */}
            <div aria-hidden style={{ position: "absolute", left: arrowLeft,
                top: openUpward ? undefined : -7, bottom: openUpward ? -7 : undefined,
                width: 14, height: 7, overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0,
                    top: openUpward ? undefined : 3, bottom: openUpward ? 3 : undefined,
                    width: 14, height: 14, backgroundColor: "#FFFFFF", border: "1px solid #E3E2E2",
                    transform: "rotate(45deg)", borderRadius: 2 }} />
            </div>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px 11px", borderBottom: "1px solid #E3E2E2" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: COLORS.orange,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <img src="/icons/idea.svg" alt=""
                        style={{ width: 15, height: 15, display: "block", filter: "brightness(0) invert(1)" }} />
                </div>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "#111111", lineHeight: "1.3" }}>
                    Waarom is dit {text.toLowerCase()}?
                </span>
                <button type="button" onClick={onClose} aria-label="Sluit uitleg"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center",
                        width: 22, height: 22, borderRadius: 4, background: "none", border: "none",
                        cursor: "pointer", flexShrink: 0 }}>
                    <img src="/icons/cancel.svg" alt="" style={{ width: 13, height: 13, display: "block" }} />
                </button>
            </div>

            {/* Body */}
            <div style={{ padding: "18px 20px 20px" }}>
                {/* Score + intro */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
                    <p style={{ flex: 1, fontSize: 14, color: "#111111", lineHeight: "1.18", margin: 0 }}>
                        De <span style={{ fontWeight: 600 }}>{plant.botanicalName}</span> sluit aan op jouw plantenlijst, plantvak en de vooraf ingestelde voorkeur voor je beplanting.
                    </p>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", minWidth: 68, minHeight: 54, borderRadius: 8,
                        padding: "8px 12px", backgroundColor: "#DEFFDE", flexShrink: 0 }}>
                        <span style={{ color: "#008000", fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                            {Math.round(explanation.totalScore ?? 100)}%
                        </span>
                        <span style={{ marginTop: 3, fontSize: 13, color: "#111111", lineHeight: 1 }}>match</span>
                    </div>
                </div>

                <div style={{ height: 1, backgroundColor: "#111111", opacity: 0.65, margin: "18px 0" }} />

                {/* Wizard-filters */}
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111111", marginBottom: 16 }}>
                    Match op basis van jouw voorkeur
                </div>
                {explanation.items.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
                        {explanation.items.map((item) => {
                            const status = statusForScore(item.score);
                            return (
                                <div key={item.label} style={{ display: "grid",
                                    gridTemplateColumns: "38px minmax(150px, 1fr) auto",
                                    alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 5,
                                        backgroundColor: "#F1F3EF", display: "flex",
                                        alignItems: "center", justifyContent: "center" }}>
                                        <img src={ICON_BY_LABEL[item.label] ?? "/icons/idea.svg"} alt=""
                                            style={{ width: 23, height: 23, display: "block",
                                                filter: "brightness(0) saturate(100%) invert(37%) sepia(13%) saturate(650%) hue-rotate(57deg) brightness(91%) contrast(87%)" }} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111111", lineHeight: "1.2" }}>
                                            {item.label === "Hoogtewerking" ? "Volwassen hoogte" : item.label}
                                        </div>
                                        <div style={{ marginTop: 1, fontSize: 12, color: "#111111", lineHeight: "1.25" }}>
                                            {item.value}
                                        </div>
                                        {item.preference && !status.isMatch && (
                                            <div style={{ marginTop: 3, fontSize: 11, color: "#7B7B7B", lineHeight: "1.25" }}>
                                                Jouw voorkeur: {item.preference}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5,
                                        color: status.color, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                                        {status.isMatch && (
                                            <img src="/icons/check-icon.svg" alt=""
                                                style={{ width: 14, height: 14, display: "block" }} />
                                        )}
                                        {status.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Burencontext */}
                {neighborPlants.length > 0 && (() => {
                    const bedGroups: { bedNr: string; bedTitle: string; plants: NeighborPlantSpec[] }[] = [];
                    for (const n of neighborPlants) {
                        const key = n.bedNr ?? "?";
                        let group = bedGroups.find((g) => g.bedNr === key);
                        if (!group) {
                            group = { bedNr: key, bedTitle: n.bedTitle ?? key, plants: [] };
                            bedGroups.push(group);
                        }
                        group.plants.push(n);
                    }
                    return (
                        <>
                            <div style={{ height: 1, backgroundColor: "#E3E2E2", margin: "4px 0 14px" }} />
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#111111", marginBottom: 8 }}>
                                Aangrenzende vakken ({bedGroups.length} {bedGroups.length === 1 ? "vak" : "vakken"})
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                {bedGroups.map((group) => (
                                    <NeighborBedAccordion
                                        key={group.bedNr}
                                        group={group}
                                        isOpen={openBedNr === group.bedNr}
                                        onToggle={() => setOpenBedNr((prev) => prev === group.bedNr ? null : group.bedNr)}
                                    />
                                ))}
                            </div>
                        </>
                    );
                })()}
            </div>
        </div>,
        document.body,
    );
}

type ProposalPlantCardProps = {
    plant: ProposalPlant;
    animDelay: number;
    bedId: string;
    bedNr: string;
    onLinked: (plantId: string, plantName: string) => void;
    scoringInput: ScoringInput;
    neighborPlants: NeighborPlantSpec[];
    isPopoverOpen: boolean;
    onRequestOpenPopover: (rect: DOMRect) => void;
    onRequestClosePopover: () => void;
};

function ProposalPlantCard({ plant, animDelay, bedId, bedNr, onLinked, scoringInput, neighborPlants, isPopoverOpen, onRequestOpenPopover, onRequestClosePopover }: ProposalPlantCardProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdded, setIsAdded] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [suitabilityAnchorRect, setSuitabilityAnchorRect] = useState<DOMRect | null>(null);

    const handleToggleSuitability = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (isPopoverOpen) {
            onRequestClosePopover();
            setSuitabilityAnchorRect(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            setSuitabilityAnchorRect(rect);
            onRequestOpenPopover(rect);
        }
    };

    const linkPlantToPlantbed = useProjectStore((s: any) => s.linkPlantToPlantbed);
    const typeLabel = bedLabel(bedNr);

    const minPrice = plant.variants.length > 0 ? Math.min(...plant.variants.map((v) => v.price)) : 0;
    const keurmerkImages = getKeurmerkImages(plant.keurmerken);

    const modalVariants: ModalVariant[] = plant.variants.map((v) => ({
        id: v.id, sizeLabel: v.sizeLabel, price: v.price, availability: v.availability,
    }));

    const doLink = (chosenSize?: string, chosenBulkPrices?: BulkPriceTier[]) => {
        const store = usePlantSelectionStore.getState();
        const currentItems = store.plantListItems;

        // Find or create a PlantListItem for this plant
        let listItemId = currentItems.find((i) => i.plant.id === plant.apiPlant.id)?.id;

        if (!listItemId) {
            listItemId = `plant-list-${plant.apiPlant.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const firstVariant = plant.variants[0];
            const newItem: PlantListItem = {
                id: listItemId,
                plant: plant.apiPlant,
                size: chosenSize ?? firstVariant?.sizeLabel ?? "",
                fixedSize: false,
                bulkPrices: chosenBulkPrices ?? firstVariant?.bulkPrices ?? [],
                note: "",
                quantity: 1,
                isSelected: false,
            };
            store.setPlantListItems([...currentItems, newItem]);
        }

        linkPlantToPlantbed(listItemId, bedId);
        onLinked(listItemId, plant.botanicalName);
        setIsAdded(true);
        setTimeout(() => setIsAdded(false), 3200);
    };

    const handleVariantAdd = (sizeLabel: string, _price: number, _img: string, bulk: BulkPriceTier[]) => {
        setIsModalOpen(false);
        doLink(sizeLabel, bulk);
    };

    const handleCartClick = () => {
        if (plant.variants.length <= 1) doLink();
        else setIsModalOpen(true);
    };

    return (
        <>
            <div className="flex flex-col overflow-hidden rounded-[8px] border"
                style={{ backgroundColor: "#FFFFFF", borderColor: COLORS.border,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)", opacity: 0,
                    animation: `ai-card-in 0.38s cubic-bezier(.22,1,.36,1) ${animDelay}ms forwards` }}>
                <div className="relative overflow-hidden bg-[#F1F1EE]" style={{ aspectRatio: "1 / 0.82" }}>
                    <PlantImg src={plant.imageUrl} alt={plant.botanicalName} className="block h-full w-full" />
                    <div className="absolute right-2 top-2">
                        <SuitabilityBadge
                            label={plant.suitability}
                            onClick={handleToggleSuitability}
                            isOpen={!!suitabilityAnchorRect}
                        />
                    </div>
                </div>
                <div className="flex flex-1 flex-col p-3">
                    {/* Naam + categorie — altijd bovenaan */}
                    <div className="text-[15px] font-semibold leading-[1.2]" style={{ color: COLORS.text }}>{plant.botanicalName}</div>
                    <div className="mt-[2px] text-[13px]" style={{ color: COLORS.muted }}>{plant.dutchName}</div>

                    {/* Maat — vaste hoogte zodat volgende rijen gelijk lopen */}
                    <div className="mt-2" style={{ minHeight: 20 }}>
                        {plant.variants.length > 1 && (
                            <button type="button" onClick={() => setIsModalOpen(true)}
                                className="cursor-pointer text-[13px] underline underline-offset-2"
                                style={{ color: COLORS.text, background: "none", border: "none", padding: 0 }}>
                                Bekijk de {plant.variants.length} maten
                            </button>
                        )}
                        {plant.variants.length === 1 && plant.variants[0].sizeLabel && (
                            <span className="text-[13px]" style={{ color: COLORS.text }}>{plant.variants[0].sizeLabel}</span>
                        )}
                    </div>

                    {/* Keurmerk-zone — altijd gereserveerde hoogte */}
                    <div style={{ marginTop: 8, minHeight: 26 }}>
                        <KeurmerkLogos images={keurmerkImages} />
                    </div>

                    {/* Spacer — duwt prijs + knop naar onderkant */}
                    <div className="flex-1" />

                    {/* Prijs */}
                    <div className="mt-3 text-[13px]" style={{ color: COLORS.red }}>
                        {plant.variants.length > 1 ? formatFromPrice(minPrice)
                            : plant.variants[0] ? `€${plant.variants[0].price.toFixed(2).replace(".", ",")} p/st` : ""}
                    </div>

                    {/* Knop */}
                    <button type="button" onClick={handleCartClick}
                        onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
                        className="mt-2 flex w-full cursor-pointer items-center justify-center gap-[7px] rounded-[6px]"
                        style={{ height: 38, backgroundColor: isAdded ? "#008000" : isHovered ? "#D2440F" : COLORS.orange,
                            transition: "background-color 220ms ease", border: "none", flexShrink: 0 }}>
                        <img src={isAdded ? "/icons/check.svg" : "/icons/add-to-cart.svg"} alt=""
                            style={{ width: isAdded ? 16 : 14, height: isAdded ? 16 : 14, display: "block",
                                filter: "brightness(0) invert(1)", flexShrink: 0 }} />
                        <span className="text-[12px] font-semibold text-white whitespace-nowrap">
                            {isAdded ? "Toegevoegd!" : `Toevoegen aan ${typeLabel}`}
                        </span>
                    </button>
                </div>
            </div>
            {isModalOpen && (
                <ProductVariantSelectionModal
                    name={plant.botanicalName} dutchName={plant.dutchName}
                    imageUrl={plant.imageUrl ?? ""} keurmerken={plant.keurmerken}
                    variants={modalVariants} isLoading={false}
                    onAdd={handleVariantAdd} onClose={() => setIsModalOpen(false)} />
            )}
            {isPopoverOpen && suitabilityAnchorRect && (
                <ProposalSuitabilityPopover
                    plant={plant}
                    label={plant.suitability}
                    scoringInput={scoringInput}
                    neighborPlants={neighborPlants}
                    anchorRect={suitabilityAnchorRect}
                    onClose={() => { onRequestClosePopover(); setSuitabilityAnchorRect(null); }}
                />
            )}
        </>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Shared button
// ──────────────────────────────────────────────────────────────────────────────

function ModalBtn({ variant, onClick, disabled, children, icon }: {
    variant: "cancel" | "orange" | "green-outline" | "orange-outline";
    onClick?: () => void; disabled?: boolean;
    children: React.ReactNode; icon?: React.ReactNode;
}) {
    const [hovered, setHovered] = useState(false);
    const styles: Record<string, React.CSSProperties> = {
        cancel: { background: hovered ? "#F2F0EF" : "#F9F8F7", border: "1px solid #BDBDBD", color: "#898988" },
        orange: { background: disabled ? COLORS.orange : hovered ? "#D2440F" : COLORS.orange,
            border: `1px solid ${hovered ? "#D2440F" : COLORS.orange}`, color: "#FFFFFF" },
        "green-outline": { background: hovered ? COLORS.greenLight : "#FFFFFF", border: `1px solid ${COLORS.green}`, color: COLORS.green },
        "orange-outline": { background: hovered ? COLORS.orangeLight : "#FFFFFF", border: `1px solid ${COLORS.orange}`, color: COLORS.orange },
    };
    return (
        <button type="button" onClick={onClick} disabled={disabled}
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            className="h-12 flex-1 rounded-md text-[13px] font-semibold flex items-center justify-center gap-2"
            style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
                transition: "background 180ms ease, opacity 180ms ease", ...styles[variant] }}>
            {icon}{children}
        </button>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// BedAdviceTable — compact inline table matching PlantAdviceLabelPanel columns
// ──────────────────────────────────────────────────────────────────────────────

type BedAdviceTableProps = {
    bedId: string;
    bedNr: string;
    bedTitle: string;
    nrBg?: string;
    nrColor?: string;
    nrBorder?: string | null;
};

function redistributeAfterChange(
    plantIds: string[],
    changedId: string,
    newPct: number,
): Record<string, number> {
    const clamped = Math.min(100, Math.max(0, newPct));
    const otherIds = plantIds.filter((id) => id !== changedId);
    if (otherIds.length === 0) return { [changedId]: 100 };
    const perOther = (100 - clamped) / otherIds.length;
    const result: Record<string, number> = { [changedId]: clamped };
    for (const id of otherIds) result[id] = perOther;
    return result;
}

function BedAdviceTable({ bedId, bedNr }: BedAdviceTableProps) {
    const objects = useProjectStore((s) => s.objects);
    const plantbedLinks = useProjectStore((s) => s.plantbedLinks);
    const projectPlants = useProjectStore((s) => s.plants as ProjectPlantLike[]);
    const distributionOverrides = useProjectStore((s) => (s as any).distributionOverrides as Record<string, Record<string, number>>);
    const setDistributionOverridesForObject = useProjectStore((s: any) => s.setDistributionOverridesForObject);
    const plantListItems = usePlantSelectionStore((s) => s.plantListItems);
    const variantCache = usePlantVariantStore((s) => s.cache);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const linkedIds = plantbedLinks[bedId] ?? [];
    const selectedObject = (objects.find((o) => o.id === bedId) as PolyObject) ?? null;
    const currentType = bedObjectType(bedNr);

    const variantsByPlantId = useMemo(() => {
        const map: Record<string, { sizeLabel: string; bulkPrices?: BulkPriceTier[] }[]> = {};
        for (const item of plantListItems) map[item.plant.id] = variantCache[item.plant.id]?.variants ?? [];
        return map;
    }, [plantListItems, variantCache]);

    const adviceData = useMemo(() => {
        if (!selectedObject || linkedIds.length === 0) return null;
        return buildAdviceData({
            selectedObject,
            currentType,
            linkedPlantIds: linkedIds,
            plants: projectPlants,
            distributionOverrides: distributionOverrides[bedId],
        });
    }, [selectedObject, linkedIds, currentType, projectPlants, distributionOverrides, bedId]);

    if (!adviceData || adviceData.rows.length === 0) return null;

    const multiPlant = adviceData.rows.length > 1;

    const startEdit = (plantId: string, pct: number) => {
        setEditingId(plantId);
        setEditValue(String(Math.round(pct)));
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const commitEdit = (plantId: string) => {
        const parsed = parseFloat(editValue.replace(",", "."));
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
            const newOverrides = redistributeAfterChange(linkedIds, plantId, parsed);
            setDistributionOverridesForObject(bedId, newOverrides);
        }
        setEditingId(null);
        setEditValue("");
    };

    const rows = adviceData.rows.map((row) => {
        const listItem = plantListItems.find((i) => i.id === row.plantId);
        const resolvedItem = listItem
            ? withResolvedBulkPrices(listItem, variantsByPlantId[listItem.plant.id])
            : null;
        const unitPrice = resolvedItem && row.adviceCount
            ? getPlantUnitPriceForQuantity(resolvedItem, row.adviceCount)
            : null;
        const totalPrice = typeof unitPrice === "number" && row.adviceCount
            ? unitPrice * row.adviceCount
            : null;
        return { row, unitPrice, totalPrice };
    });

    const PX = 16;

    const thBase: React.CSSProperties = {
        fontSize: 12, fontWeight: 700, color: COLORS.text,
        borderBottom: `1px solid ${COLORS.border}`, whiteSpace: "nowrap",
        padding: "6px 8px", textAlign: "left",
    };
    const tdBase: React.CSSProperties = {
        padding: "8px 8px", fontSize: 13, color: COLORS.text,
        verticalAlign: "middle", borderBottom: `1px solid ${COLORS.border}`,
    };

    return (
        <div style={{ borderTop: `1px solid ${COLORS.border}`, overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: `12px ${PX}px 10px`, gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Advies aantal planten</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.green,
                    background: COLORS.greenLight, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>
                    {adviceData.totalSquareMeters.toFixed(2).replace(".", ",")} m²
                </span>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                <thead>
                    <tr>
                        <th style={{ ...thBase, paddingLeft: PX }}>Plant</th>
                        <th style={{ ...thBase }}>Verdeling</th>
                        <th style={{ ...thBase, textAlign: "right" }}>Toegewezen m²</th>
                        <th style={{ ...thBase, textAlign: "right" }}>
                            <span>Planthoeveelheid</span>
                            <span style={{ display: "block", fontWeight: 400, color: COLORS.muted }}>(per m²)</span>
                        </th>
                        <th style={{ ...thBase, textAlign: "right" }}>
                            <span>Advies</span>
                            <span style={{ display: "block", fontWeight: 400, color: COLORS.muted }}>(stuks)</span>
                        </th>
                        <th style={{ ...thBase, textAlign: "right", paddingRight: PX }}>
                            <span>Prijs</span>
                            <span style={{ display: "block", fontWeight: 400, color: COLORS.muted }}>(p/st + totaal)</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ row, unitPrice, totalPrice }, idx) => {
                        const isEditing = editingId === row.plantId;
                        return (
                            <tr key={row.plantId} style={{ background: idx % 2 === 1 ? "#FAFAF9" : "#FFFFFF" }}>
                                <td style={{ ...tdBase, paddingLeft: PX, verticalAlign: "top", paddingTop: 10 }}>
                                    <span style={{ fontWeight: 600 }}>{row.latinName}</span>
                                    {row.dutchName && (
                                        <div style={{ fontSize: 11, color: COLORS.muted }}>{row.dutchName}</div>
                                    )}
                                </td>
                                <td style={{ ...tdBase }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {isEditing ? (
                                            <input
                                                ref={inputRef}
                                                type="number" min={0} max={100}
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={() => commitEdit(row.plantId)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") commitEdit(row.plantId);
                                                    if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                style={{ width: 56, fontSize: 13, fontWeight: 700,
                                                    color: COLORS.orange, border: `1px solid ${COLORS.border}`,
                                                    borderRadius: 4, padding: "2px 5px", outline: "none", background: "#fff" }}
                                                autoFocus
                                            />
                                        ) : (
                                            <span style={{ fontWeight: 700, color: COLORS.orange, fontSize: 13 }}>
                                                {Math.round(row.distributionPercentage)}%
                                            </span>
                                        )}
                                        {!isEditing && multiPlant && (
                                            <button type="button" title="Verdeling aanpassen"
                                                onClick={(e) => { e.stopPropagation(); startEdit(row.plantId, row.distributionPercentage); }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                style={{ background: "transparent", border: "none", padding: 2,
                                                    cursor: "pointer", display: "flex", alignItems: "center",
                                                    borderRadius: 3, opacity: 0.55 }}
                                                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                                                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.55")}>
                                                <img src="/icons/edit.svg" alt="Bewerk verdeling"
                                                    style={{ width: 20, height: 20, display: "block" }} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td style={{ ...tdBase, textAlign: "right" }}>
                                    {row.assignedMeasureValue.toFixed(2).replace(".", ",")} m²
                                </td>
                                <td style={{ ...tdBase, textAlign: "right" }}>
                                    {row.quantityPerSquareMeter != null ? `${row.quantityPerSquareMeter}/m²` : "—"}
                                </td>
                                <td style={{ ...tdBase, textAlign: "right", fontWeight: 700, color: COLORS.orange }}>
                                    {row.adviceCount != null ? `${row.adviceCount} st.` : "—"}
                                </td>
                                <td style={{ ...tdBase, textAlign: "right", paddingRight: PX }}>
                                    {unitPrice != null ? (
                                        <>
                                            <div>€{unitPrice.toFixed(2).replace(".", ",")} p/st</div>
                                            {totalPrice != null && (
                                                <div style={{ fontWeight: 700, color: COLORS.orange }}>
                                                    € {totalPrice.toFixed(2).replace(".", ",")}
                                                </div>
                                            )}
                                        </>
                                    ) : "—"}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Info note — exact PlantAdviceLabelPanel colors */}
            <div style={{ display: "flex", alignItems: "center", gap: 10,
                margin: `10px ${PX}px 12px`, background: "#D9EDF7",
                border: "1px solid #BCE8F1", borderRadius: 5,
                padding: "8px 14px", fontSize: 12, color: "#31708F" }}>
                <img src="/icons/info.svg" alt=""
                    style={{ width: 18, height: 18, flexShrink: 0,
                        filter: "brightness(0) saturate(100%) invert(38%) sepia(17%) saturate(1115%) hue-rotate(158deg) brightness(88%) contrast(87%)" }} />
                Dit is een advies. In de volgende stap kun je de aantallen zelf aanpassen.
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// AccordionBedRow — animated expand/collapse row for state 5
// ──────────────────────────────────────────────────────────────────────────────

const ACCORDION_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ACCORDION_MS = 220;

type AccordionBedRowProps = {
    section: ProposalSection;
    area?: string;
    linked: AddedLink[];
    linkedIds: string[];
};

function AccordionBedRow({ section, area, linked, linkedIds }: AccordionBedRowProps) {
    const [open, setOpen] = useState(false);
    const [contentHeight, setContentHeight] = useState(0);
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    const toggle = () => {
        const current = contentRef.current?.scrollHeight ?? 0;
        if (open) {
            setContentHeight(current);
            requestAnimationFrame(() => {
                setContentHeight(0);
                setOpen(false);
            });
        } else {
            setOpen(true);
            requestAnimationFrame(() => {
                setContentHeight(contentRef.current?.scrollHeight ?? current);
            });
        }
    };

    // Re-measure when linkedIds change (new plants added while open)
    useEffect(() => {
        if (open) {
            setContentHeight(contentRef.current?.scrollHeight ?? 0);
        }
    }, [linkedIds, open]);

    const transition = [
        `height ${ACCORDION_MS}ms ${ACCORDION_EASE}`,
        `opacity ${ACCORDION_MS}ms ${ACCORDION_EASE}`,
        `transform ${ACCORDION_MS}ms ${ACCORDION_EASE}`,
    ].join(", ");

    return (
        <div className="rounded-[8px] border overflow-hidden" style={{ borderColor: COLORS.border }}>
            <button type="button" onClick={toggle}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ background: open ? COLORS.greenLight : "#fff", cursor: "pointer",
                    border: "none", borderBottom: open ? `1px solid ${COLORS.border}` : "none",
                    transition: `background ${ACCORDION_MS}ms ${ACCORDION_EASE}` }}>
                <BedBadge label={section.bedNr} bg={section.nrBg} color={section.nrColor} border={section.nrBorder} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                        <span className="text-[14px] font-bold" style={{ color: COLORS.text }}>{section.bedTitle}</span>
                        {area && <span className="text-[12px]" style={{ color: COLORS.muted }}>{area}</span>}
                    </div>
                    {linked.length > 0 ? (
                        <div className="text-[12px] truncate" style={{ color: COLORS.green }}>
                            {linked.map(l => l.plantName).join(" · ")}
                        </div>
                    ) : (
                        <div className="text-[12px]" style={{ color: COLORS.muted }}>Geen planten gekoppeld</div>
                    )}
                </div>
                <img src={open ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"} alt=""
                    style={{ width: 16, height: 16, flexShrink: 0 }} />
            </button>

            <div style={{
                height: contentHeight, overflow: "hidden",
                opacity: open ? 1 : 0,
                transform: open ? "translateY(0)" : "translateY(-6px)",
                transition,
                pointerEvents: open ? "auto" : "none",
            }}>
                <div ref={contentRef}>
                    {linkedIds.length > 0 ? (
                        <BedAdviceTable
                            bedId={section.bedId}
                            bedNr={section.bedNr}
                            bedTitle={section.bedTitle}
                            nrBg={section.nrBg}
                            nrColor={section.nrColor}
                            nrBorder={section.nrBorder}
                        />
                    ) : (
                        <div className="px-4 py-4 text-[13px]" style={{ color: COLORS.muted }}>
                            Voeg eerst een plant toe via het voorstel.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function AutoFillBannerBtn({ onClick }: { onClick: () => void }) {
    const [hovered, setHovered] = useState(false);
    return (
        <button type="button" onClick={onClick}
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            className="shrink-0 self-center rounded-[6px] px-4 py-2 text-[13px] font-semibold whitespace-nowrap"
            style={{ border: "none", color: "#FFFFFF", background: hovered ? "#476D3C" : COLORS.green,
                cursor: "pointer", transition: "background 150ms ease" }}>
            Zoek planten voor de lege vakken
        </button>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────

export default function AutoFillModal({ open, items, onClose, onGoToFinalisatie, budget, initialView, successTitle }: AutoFillModalProps) {
    const [view, setView] = useState<AutoFillView>(initialView ?? 1);
    const [loadProgress, setLoadProgress] = useState(0);
    const [loadStep, setLoadStep] = useState<string>("querying_db");
    const [proposalSections, setProposalSections] = useState<ProposalSection[]>([]);
    const [addedLinks, setAddedLinks] = useState<Map<string, AddedLink[]>>(() => new Map());
    const [proposedScoringInput, setProposedScoringInput] = useState<ScoringInput | null>(null);
    const [proposedNeighborContext, setProposedNeighborContext] = useState<NeighborContext[]>([]);
    const [openPopoverCardId, setOpenPopoverCardId] = useState<string | null>(null);

    const step2 = useRightStepMenuStore((s) => s.step2);
    const step3 = useRightStepMenuStore((s) => s.step3);
    const step4 = useRightStepMenuStore((s) => s.step4);
    const plantbedLinks = useProjectStore((s) => s.plantbedLinks);
    const objects = useProjectStore((s) => s.objects);

    useScrollLock(open);

    useEffect(() => {
        if (open) {
            setView(initialView ?? 1);
            if (initialView === 5) {
                const { objects: objs, plantbedLinks: links } = useProjectStore.getState();
                setProposalSections(buildSectionsFromStore(objs as PolyObject[], links));
            }
        } else {
            const t = setTimeout(() => {
                setView(1); setLoadProgress(0);
                setAddedLinks(new Map());
            }, 300);
            return () => clearTimeout(t);
        }
    }, [open]);

    // View 2: fetch AI proposal via /api/plants/ai-proposal (SSE stream)
    useEffect(() => {
        if (view !== 2) return;
        setLoadProgress(0);
        setLoadStep("querying_db");
        setAddedLinks(new Map());

        let cancelled = false;
        const controller = new AbortController();

        (async () => {
            try {
                const { plantListItems } = usePlantSelectionStore.getState();
                const { objects, plantbedLinks } = useProjectStore.getState();

                const emptyBedIds = new Set(items.map((i) => i.id));

                // Bounding boxes voor buurbedding detectie
                const bboxes = new Map<string, BBox>();
                for (const obj of objects) {
                    if ((obj as PolyObject).points?.length >= 2) {
                        bboxes.set(obj.id, getBoundingBox((obj as PolyObject).points));
                    }
                }

                // Wizard-filters (ScoringInput)
                const validKeurmerk =
                    step2.certificationPreference === "alleen-met-keurmerk" ||
                    step2.certificationPreference === "alleen-zonder-keurmerk" ||
                    step2.certificationPreference === "maakt-niet-uit"
                        ? (step2.certificationPreference as ScoringInput["keurmerkFilter"])
                        : undefined;

                const scoringInput: ScoringInput = {
                    heightStyle: (step4.heightStyle as ScoringInput["heightStyle"]) ?? null,
                    standplaatsen: (step2.standplaatsen ?? []).filter(
                        (s: string) => s !== "wisselend-onbekend",
                    ),
                    groundTypes: step2.groundTypes ?? [],
                    keurmerkFilter: validKeurmerk,
                    structureStyle: step3.structureStyle ?? null,
                    structureCustomPercentages: step3.structureStyle === "vrij-samenstellen"
                        ? {
                            bodembedekkers: Number(step3.customPercentages.bodembedekkers || 0),
                            vastePlanten: Number(step3.customPercentages.vastePlanten || 0),
                            heestersEnStruiken: Number(step3.customPercentages.heestersEnStruiken || 0),
                            bomen: Number(step3.customPercentages.bomen || 0),
                        }
                        : null,
                };

                // Lege vakken
                const emptyBeds = items.map((item) => ({
                    id: item.id,
                    nr: String(item.nr ?? ""),
                    title: item.title,
                    type: bedTypeFromNr(String(item.nr ?? "")),
                    nrBg: item.nrBg ?? "#58694C",
                    nrColor: item.nrColor ?? "#ffffff",
                    nrBorder: item.nrBorder ?? null,
                }));

                // Gebruikers plantlijst met volledige specs
                const userPlantList: UserPlantSpec[] = plantListItems.map((li) => ({
                    plantListItemId: li.id,
                    plantId: li.plant.id,
                    latinName: li.plant.botanicalName,
                    dutchName: li.plant.dutchName,
                    appGroup: li.plant.appGroup,
                    maxHeightCm: li.plant.maxHeightCm,
                    standplaatsen: li.plant.standplaatsen,
                    grondsoorten: li.plant.grondsoorten,
                    keurmerken: li.plant.keurmerken,
                    linkedBedIds: Object.entries(plantbedLinks)
                        .filter(([bedId, ids]) => ids?.includes(li.id) && !emptyBedIds.has(bedId))
                        .map(([bedId]) => bedId),
                }));

                // Buurbedding context per leeg vak
                const neighborContext: NeighborContext[] = items.map((item) => {
                    const emptyBbox = bboxes.get(item.id);
                    const emptyObj = objects.find((o) => o.id === item.id) as (PolyObject & { plantbedNo?: number }) | undefined;
                    const neighborPlants: NeighborPlantSpec[] = [];
                    if (emptyBbox) {
                        for (const [objId, linkedIds] of Object.entries(plantbedLinks)) {
                            if (emptyBedIds.has(objId) || !linkedIds?.length) continue;
                            const neighborBbox = bboxes.get(objId);
                            if (!neighborBbox || !areBBoxesNear(emptyBbox, neighborBbox)) continue;
                            // Bepaal bedNr/bedTitle van het aangrenzende vak
                            const neighborObj = objects.find((o) => o.id === objId) as (PolyObject & { plantbedNo?: number }) | undefined;
                            // Boomvakken zijn geen aangrenzende context voor plantvakken en hagen
                            if (neighborObj?.type === "treebed" && emptyObj?.type !== "treebed") continue;
                            const no = neighborObj?.plantbedNo ?? 1;
                            const prefix = neighborObj?.type === "hedge" ? "H" : neighborObj?.type === "treebed" ? "B" : "P";
                            const typeLabel = neighborObj?.type === "hedge" ? "Haag" : neighborObj?.type === "treebed" ? "Boomvak" : "Plantvak";
                            const bedNr = `${prefix}${no}`;
                            const bedTitle = `${typeLabel} ${no}`;
                            for (const listItemId of linkedIds) {
                                const li = plantListItems.find((x) => x.id === listItemId);
                                if (li) {
                                    neighborPlants.push({
                                        latinName: li.plant.botanicalName,
                                        dutchName: li.plant.dutchName,
                                        maxHeightCm: li.plant.maxHeightCm,
                                        standplaatsen: li.plant.standplaatsen,
                                        grondsoorten: li.plant.grondsoorten,
                                        keurmerken: li.plant.keurmerken,
                                        bedNr,
                                        bedTitle,
                                    });
                                }
                            }
                        }
                    }
                    return { bedId: item.id, neighborPlants };
                });

                setProposedScoringInput(scoringInput);
                setProposedNeighborContext(neighborContext);

                const resp = await fetch("/api/plants/ai-proposal", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scoringInput, emptyBeds, userPlantList, neighborContext }),
                    signal: controller.signal,
                });

                if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

                const reader = resp.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done || cancelled) break;

                    buffer += decoder.decode(value, { stream: true });
                    // SSE events zijn gescheiden door dubbele newlines
                    const parts = buffer.split("\n\n");
                    buffer = parts.pop() ?? "";

                    for (const part of parts) {
                        for (const line of part.split("\n")) {
                            if (!line.startsWith("data: ") || cancelled) continue;
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.type === "progress") {
                                    setLoadProgress(data.pct);
                                    if (data.step) setLoadStep(data.step);
                                } else if (data.type === "result") {
                                    const sections = data.sections as ProposalSection[];
                                    if (!sections.length || sections.every((s) => s.plants.length === 0)) {
                                        setTimeout(() => { if (!cancelled) setView(6); }, 400);
                                    } else {
                                        setProposalSections(sections);
                                        setTimeout(() => { if (!cancelled) setView(3); }, 300);
                                    }
                                } else if (data.type === "error") {
                                    if (!cancelled) setView(6);
                                }
                            } catch {
                                // negeer onvolledige chunks
                            }
                        }
                    }
                }
            } catch (err: unknown) {
                if (!cancelled && (err as Error)?.name !== "AbortError") {
                    setView(6);
                }
            }
        })();

        return () => {
            cancelled = true;
            controller.abort();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view]);

    // State 4: succes-animatie → auto-redirect naar finalisatie
    useEffect(() => {
        if (view !== 4) return;
        const t = setTimeout(() => onGoToFinalisatie(), 2200);
        return () => clearTimeout(t);
    }, [view, onGoToFinalisatie]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && view !== 4) onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, view]);

    if (!open) return null;

    // ── Helpers ───────────────────────────────────────────────────────────────

    const getBadgeForNr = (bedNr: string) => {
        const item = items.find((it) => String(it.nr ?? "") === bedNr);
        if (item) return { nrBg: item.nrBg ?? COLORS.green, nrColor: item.nrColor ?? "#ffffff", nrBorder: item.nrBorder };
        return { nrBg: COLORS.green, nrColor: "#ffffff", nrBorder: null };
    };

    // ID-based lookup is more reliable than nr-string comparison
    const getBadgeForId = (bedId: string) => {
        const item = items.find((it) => it.id === bedId);
        if (item) return { nrBg: item.nrBg ?? COLORS.green, nrColor: item.nrColor ?? "#ffffff", nrBorder: item.nrBorder };
        return { nrBg: COLORS.green, nrColor: "#ffffff", nrBorder: null };
    };

    const getAreaForId = (bedId: string) => {
        const fromItems = items.find((it) => it.id === bedId)?.area;
        if (fromItems) return fromItems;
        const obj = objects.find((o) => o.id === bedId);
        return obj ? formatSquareMeters(getObjectAreaInSquareMeters(obj as PolyObject)) : undefined;
    };

    const handleLinked = (bedId: string, plantId: string, plantName: string) => {
        setAddedLinks((prev) => {
            const next = new Map(prev);
            const existing = next.get(bedId) ?? [];
            if (!existing.some((l) => l.plantId === plantId)) next.set(bedId, [...existing, { plantId, plantName }]);
            return next;
        });
    };

    const handleGoToFinalisatie = () => {
        // Succes-animatie alleen als alle lege vakken nu gevuld zijn
        const allFilled = items.every(item => (plantbedLinks[item.id]?.length ?? 0) > 0);
        if (allFilled) setView(4);
        else onGoToFinalisatie();
    };

    // ── Close button ──────────────────────────────────────────────────────────
    const closeBtn = (
        <button type="button" onClick={onClose}
            style={{ position: "absolute", top: 16, right: 16, width: 24, height: 24, padding: 0,
                border: "none", outline: "none", background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/icons/cancel.svg" alt="Sluiten"
                style={{ width: 18, height: 18, display: "block", filter: "brightness(0)" }} />
        </button>
    );

    // ── Header ────────────────────────────────────────────────────────────────
    const renderHeader = () => {
        if (view === 1) return (
            <>
                <div className="text-[20px] font-bold pr-8" style={{ color: COLORS.text }}>Lege vakken in je tekening</div>
                <div className="mt-4" style={{ height: 1, background: COLORS.border }} />
            </>
        );
        if (view === 2) return (
            <>
                <div className="text-[16px] font-bold pr-8" style={{ color: COLORS.text }}>Het voorstel wordt geladen</div>
                <div className="mt-1 text-[12px]" style={{ color: COLORS.muted }}>Dit duurt meestal 5–10 seconden</div>
                <div className="mt-4" style={{ height: 1, background: COLORS.border }} />
            </>
        );
        if (view === 3) return (
            <>
                <div className="text-[18px] font-bold pr-8" style={{ color: COLORS.text }}>Plantvoorstel voor de lege vakken</div>
                <div className="mt-1 text-[13px]" style={{ color: COLORS.text }}>
                    Bekijk het voorstel hieronder. Je kunt daarna altijd individuele planten verwisselen.
                </div>
                <div className="mt-4" style={{ height: 1, background: COLORS.border }} />
            </>
        );
        if (view === 4) return null;
        if (view === 5) return (
            <>
                <div className="text-[20px] font-bold pr-8" style={{ color: COLORS.text }}>De planten zijn toegevoegd aan de lege vakken</div>
                <div className="mt-4" style={{ height: 1, background: COLORS.border }} />
            </>
        );
        if (view === 6) return (
            <>
                <div className="text-[18px] font-bold pr-8" style={{ color: COLORS.text }}>Geen voorstel beschikbaar</div>
                <div className="mt-4" style={{ height: 1, background: COLORS.border }} />
            </>
        );
        return null;
    };

    // ── Body ──────────────────────────────────────────────────────────────────
    const renderBody = () => {
        // State 1
        if (view === 1) return (
            <div className="flex flex-col gap-0">
                <div className="mt-4 text-[14px] leading-[1.35]" style={{ color: COLORS.text }}>
                    De volgende plantvakken, boomvakken of haagvakken hebben nog geen planten gekoppeld.
                    Wil je toch doorgaan naar de afrondpagina?
                </div>
                <div className="mt-4 flex flex-col">
                    {items.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-3 px-3 py-3"
                            style={{ borderBottom: idx < items.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                            <div className="flex shrink-0 items-center justify-center rounded-md text-[12px] font-bold"
                                style={{ width: 28, height: 28, backgroundColor: item.nrBg ?? COLORS.green,
                                    color: item.nrColor ?? "#ffffff", border: item.nrBorder ? `1px solid ${item.nrBorder}` : "none" }}>
                                {item.nr ?? ""}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-[14px] font-bold truncate" style={{ color: COLORS.text }}>{item.title}</span>
                                    {item.area && !String(item.nr ?? "").startsWith("B") && <span className="shrink-0 text-[12px]" style={{ color: COLORS.muted }}>{item.area}</span>}
                                </div>
                                {item.subtitle && <div className="text-[12px] truncate" style={{ color: COLORS.muted }}>{item.subtitle}</div>}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex items-start gap-3 rounded-[8px] p-[14px]" style={{ backgroundColor: COLORS.greenLight }}>
                    <img src="/icons/idea.svg" alt=""
                        style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1, filter: GREEN_ICON_FILTER }} />
                    <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-bold" style={{ color: COLORS.text }}>
                            Lege plantvakken automatisch aanvullen?
                        </div>
                        <div className="mt-[3px] text-[12px]" style={{ color: COLORS.muted }}>
                            Op basis van jouw gekozen plantenlijst, ingevulde filters en gekoppelde plantvakken stellen wij automatisch passende planten voor voor de nog lege plantvakken.
                        </div>
                    </div>
                    <AutoFillBannerBtn onClick={() => setView(2)} />
                </div>
            </div>
        );

        // View 2
        if (view === 2) {
            // Bepaal welke stap actief is op basis van het laatste SSE-step event
            const activeStepIdx =
                loadStep === "querying_db" || loadStep === "scoring_candidates" ? 0 :
                loadStep === "building_prompt" || loadStep === "asking_openai" ? 1 :
                2; // generating, parsing_result

            const doneIcon = (
                <img src="/icons/check-icon.svg" alt=""
                    style={{ width: 20, height: 20, display: "block" }} />
            );
            const activeIcon = (
                <div style={{ width: 20, height: 20, border: "2.5px solid #FFE5DD",
                    borderTopColor: COLORS.orange, borderRadius: "50%" }} className="animate-spin" />
            );
            const pendingIcon = (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="#C9CAC6" strokeWidth="2" />
                    <path d="M12 7v5l3 3" stroke="#C9CAC6" strokeWidth="2" strokeLinecap="round" />
                </svg>
            );

            const steps = [
                { label: "Filters toepassen" },
                { label: "Aangrenzende vakken analyseren…" },
                { label: "Plantencombinatie kiezen…" },
            ];

            return (
                <div className="mt-4 flex flex-col gap-4">
                    {steps.map((step, i) => {
                        const status = i < activeStepIdx ? "done" : i === activeStepIdx ? "active" : "pending";
                        const icon = status === "done" ? doneIcon : status === "active" ? activeIcon : pendingIcon;
                        return (
                            <div key={i} className="flex items-center gap-3">
                                <div className="shrink-0">{icon}</div>
                                <span className="text-[14px]" style={{
                                    color: status === "active" ? COLORS.text : COLORS.muted,
                                    fontWeight: status === "active" ? 700 : 400,
                                }}>{step.label}</span>
                            </div>
                        );
                    })}
                    <div className="mt-2 overflow-hidden rounded-full" style={{ height: 6, backgroundColor: COLORS.greenLight }}>
                        <div style={{ height: "100%", width: `${loadProgress}%`, backgroundColor: COLORS.orange,
                            borderRadius: 99, transition: "width 2.5s cubic-bezier(.4,0,.2,1)" }} />
                    </div>
                </div>
            );
        }

        // State 3
        if (view === 3) return (
            <div className="mt-4 flex flex-col">
                {proposalSections.map((section, sIdx) => {
                    const area = getAreaForId(section.bedId);
                    return (
                        <div key={section.bedId}
                            style={{ borderTop: sIdx === 0 ? "none" : `1px solid ${COLORS.border}`,
                                paddingTop: sIdx === 0 ? 0 : 20, marginTop: sIdx === 0 ? 0 : 20 }}>
                            <div className="flex items-center gap-2 mb-3">
                                <BedBadge label={section.bedNr} bg={section.nrBg} color={section.nrColor} border={section.nrBorder} />
                                <span className="text-[14px] font-bold" style={{ color: COLORS.text }}>{section.bedTitle}</span>
                                {area && !section.bedNr.startsWith("B") && <span className="text-[13px]" style={{ color: COLORS.muted }}>{area}</span>}
                            </div>
                            {section.plants.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {section.plants.map((plant, pIdx) => (
                                        <ProposalPlantCard key={plant.id} plant={plant}
                                            animDelay={sIdx * 60 + pIdx * 80} bedId={section.bedId} bedNr={section.bedNr}
                                            onLinked={(plantId, plantName) => handleLinked(section.bedId, plantId, plantName)}
                                            scoringInput={proposedScoringInput ?? { heightStyle: null, standplaatsen: [], groundTypes: [] }}
                                            neighborPlants={proposedNeighborContext.find((nc) => nc.bedId === section.bedId)?.neighborPlants ?? []}
                                            isPopoverOpen={openPopoverCardId === plant.id}
                                            onRequestOpenPopover={() => setOpenPopoverCardId(plant.id)}
                                            onRequestClosePopover={() => setOpenPopoverCardId(null)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[13px]" style={{ color: COLORS.muted }}>Geen passende planten gevonden voor dit vak.</p>
                            )}
                        </div>
                    );
                })}
            </div>
        );

        // State 4 — succes-animatie (geen knoppen, auto-redirect)
        if (view === 4) return (
            <div className="my-10 flex flex-col items-center gap-5">
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                    <circle cx="50" cy="50" r="44" stroke={COLORS.green} strokeWidth="4" fill={COLORS.greenLight}
                        strokeDasharray="276.5" strokeDashoffset="276.5"
                        style={{ animation: "af-draw-circle 0.65s cubic-bezier(.4,0,.2,1) 0.1s forwards" }} />
                    <path d="M28 50l16 16 28-28" stroke={COLORS.green} strokeWidth="5"
                        strokeLinecap="round" strokeLinejoin="round" fill="none"
                        strokeDasharray="62" strokeDashoffset="62"
                        style={{ animation: "af-draw-check 0.45s cubic-bezier(.4,0,.2,1) 0.6s forwards" }} />
                </svg>
                <div className="text-[22px] font-bold text-center"
                    style={{ color: COLORS.text, opacity: 0, animation: "af-fade-in 0.4s ease 0.9s forwards" }}>
                    {successTitle ?? "De lege vakken zijn gevuld!"}
                </div>
                <div className="text-[14px] text-center"
                    style={{ color: COLORS.muted, maxWidth: 400, opacity: 0, animation: "af-fade-in 0.4s ease 1.1s forwards" }}>
                    Je wordt doorgestuurd naar de afrondpagina…
                </div>
            </div>
        );

        // State 5 — overzicht met PlantAdviceLabelPanel
        if (view === 5) return (
            <div className="mt-4 flex flex-col gap-4">
                <div className="text-[14px] leading-[1.35]" style={{ color: COLORS.text }}>
                    Hieronder zie je welke planten aan welke vakken zijn gekoppeld. Klik op een vak om het advies te bekijken.
                </div>
                {proposalSections.map((section) => {
                    const area = getAreaForId(section.bedId);
                    const linked = addedLinks.get(section.bedId) ?? [];
                    const linkedIds = plantbedLinks[section.bedId] ?? [];
                    return (
                        <AccordionBedRow
                            key={section.bedId}
                            section={section}
                            area={section.bedNr.startsWith("B") ? undefined : area}
                            linked={linked}
                            linkedIds={linkedIds}
                        />
                    );
                })}
            </div>
        );

        // State 6
        if (view === 6) return (
            <div className="my-6 flex flex-col items-center gap-3 text-center">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M16 3L30 28H2L16 3z" stroke={COLORS.orange} strokeWidth="2" fill="none" strokeLinejoin="round" />
                    <path d="M16 13v6" stroke={COLORS.orange} strokeWidth="2" strokeLinecap="round" />
                    <circle cx="16" cy="23" r="1.2" fill={COLORS.orange} />
                </svg>
                <div className="text-[16px] font-bold" style={{ color: COLORS.text }}>Kon geen voorstel genereren</div>
                <div className="text-[13px] leading-[1.5]" style={{ color: COLORS.muted, maxWidth: 440 }}>
                    Er zijn te weinig planten beschikbaar die passen bij jouw ingestelde filters.
                    Voeg meer planten toe aan je selectie in stap 5, of vul de vakken handmatig in.
                </div>
            </div>
        );

        return null;
    };

    // ── Footer ────────────────────────────────────────────────────────────────
    const renderFooter = () => {
        const budgetRow = <BudgetRow budget={budget} />;

        if (view === 1) return (
            <div className="flex items-center gap-4">
                <ModalBtn variant="cancel" onClick={onClose}>Ga terug</ModalBtn>
                <ModalBtn variant="orange" onClick={onGoToFinalisatie}>Toch verder gaan</ModalBtn>
            </div>
        );
        if (view === 2) return null;
        if (view === 3) return (
            <div className="flex items-center gap-4">
                {budgetRow}
                <div className="flex flex-1 items-center gap-4">
                    <ModalBtn variant="cancel" onClick={() => setView(2)}
                        icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M12 2a6.5 6.5 0 1 0 1.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M13.5 2v4.5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>}>
                        Opnieuw genereren
                    </ModalBtn>
                    <ModalBtn variant="orange" onClick={() => setView(5)}>Ga verder</ModalBtn>
                </div>
            </div>
        );
        if (view === 4) return null;
        if (view === 5) return (
            <div className="flex items-center gap-4">
                {budgetRow}
                <div className="flex flex-1 items-center gap-4">
                    {initialView === 5
                        ? <ModalBtn variant="cancel" onClick={onClose}>Terug</ModalBtn>
                        : <ModalBtn variant="cancel" onClick={() => setView(3)}>Terug naar voorstel</ModalBtn>
                    }
                    <ModalBtn variant="orange" onClick={handleGoToFinalisatie}>Beplantingsplan afronden</ModalBtn>
                </div>
            </div>
        );
        if (view === 6) return (
            <div className="flex items-center gap-4">
                <ModalBtn variant="cancel" onClick={onClose}>Handmatig invullen</ModalBtn>
                <ModalBtn variant="orange" onClick={onClose}>Terug naar stap 5</ModalBtn>
            </div>
        );
        return null;
    };

    const footer = renderFooter();

    return createPortal(
        <>
            <style>{`
                @keyframes ai-card-in {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes af-draw-circle {
                    from { stroke-dashoffset: 276.5; }
                    to   { stroke-dashoffset: 0; }
                }
                @keyframes af-draw-check {
                    from { stroke-dashoffset: 62; }
                    to   { stroke-dashoffset: 0; }
                }
                @keyframes af-fade-in {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div className="fixed inset-0 z-[9999] flex items-center justify-center"
                style={{ background: COLORS.overlay, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                onMouseDown={view !== 4 ? onClose : undefined}>
                <div className="relative flex flex-col bg-white rounded-[8px]"
                    style={{ width: "min(1100px, calc(100vw - 40px))", border: `1px solid ${COLORS.border}`,
                        boxShadow: "0 8px 40px rgba(0,0,0,0.12)", maxHeight: "calc(100vh - 130px)" }}
                    onMouseDown={(e) => e.stopPropagation()}>
                    {view !== 4 && closeBtn}
                    <div className="px-8 pt-7 pb-0 shrink-0">{renderHeader()}</div>
                    <div className="flex-1 overflow-y-auto px-8 pb-6" style={{ minHeight: 0 }}>{renderBody()}</div>
                    {footer && <div className="px-8 pb-7 pt-4 shrink-0" style={{ borderTop: `1px solid ${COLORS.border}` }}>{footer}</div>}
                </div>
            </div>
        </>,
        document.body
    );
}
