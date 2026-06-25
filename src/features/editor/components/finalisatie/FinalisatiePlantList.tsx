"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StaffelLink, StaffelPopover } from "@/features/editor/components/StaffelPopover";
import { PlantImg } from "@/features/editor/components/PlantImg";
import { matchesSearchQuery } from "@/features/editor/lib/plantSelectionSearch";
import type { ApiPlant } from "@/lib/db/plantTypes";
import {
    usePlantSelectionStore,
    type PlantListItem,
} from "@/features/editor/state/plantSelectionStore";
import { usePlantVariantStore } from "@/features/editor/state/plantVariantStore";
import { useProjectStore, OBJECT_STYLES } from "@/state/projectStore";
import { type ObjectType } from "@/features/editor/components/editor/objectMenuConfig";
import { buildAdviceData, getEstimatedHedgeLengthInMeters, type ProjectPlantLike } from "@/features/editor/lib/plantAdvice";
import { getResolvedBulkPrices, getPlantTotalPriceForQuantity, getPlantUnitPriceForQuantity, withResolvedBulkPrices } from "@/features/editor/lib/plantPricing";
import type { PolyObject } from "@/state/projectStore";
import FinalisatieAdviceCalculation, {
    type PlantAdviceInfo,
    type VakAdviceEntry,
} from "./FinalisatieAdviceCalculation";
import ConfirmModal from "@/features/editor/components/ConfirmModal";
import { APP_NOTIFICATIONS, useAppNotify } from "@/state/allNotifications";

type DummyPlantSpecificationRow = {
    label: string;
    value: string;
    iconSrc: string;
};

type AccessoryAdviceInfo = {
    name: string;
    quantity: number;
    reason: string;
};

function stuksLabel(quantity: number): string {
    return quantity === 1 ? "stuk" : "stuks";
}

function AccessoryAdvicePopup({
    info,
    onClose,
}: {
    info: AccessoryAdviceInfo | null;
    onClose: () => void;
}) {
    if (!info) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{
                background: "rgba(0,0,0,0.33)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
            }}
            onMouseDown={onClose}
        >
            <div
                className="relative w-[480px] max-w-[calc(100vw-48px)] rounded-md bg-white shadow-lg"
                style={{ border: "1px solid #E0DEDF" }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="px-8 pt-7 pb-7">
                    <div className="text-[20px] font-bold text-black">
                        Hoe is dit advies berekend?
                    </div>

                    <div className="mt-4" style={{ height: 1, background: "#E0DEDF" }} />

                    <div className="mt-4 text-[14px] leading-[1.45] text-black">
                        {"Op basis van je plantenlijst stellen wij voor "}
                        <span className="font-bold">{info.name}</span>
                        {" een aantal van "}
                        <span className="font-bold">{info.quantity} {stuksLabel(info.quantity)}</span>
                        {" voor."}
                    </div>

                    <div
                        className="mt-5 rounded-[6px] px-4 py-3 text-[13px] leading-[1.45]"
                        style={{ backgroundColor: "#D9EDF7", color: "#31708F" }}
                    >
                        Dit is een advies. Je kunt het aantal in de plantenlijst zelf aanpassen.
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-6 h-11 w-full cursor-pointer rounded-md text-[13px] font-semibold text-white"
                        style={{ backgroundColor: "#E94E1B" }}
                    >
                        Sluiten
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

function buildSpecificationsFromApiPlant(plant: ApiPlant): {
    leftColumn: DummyPlantSpecificationRow[];
    rightColumn: DummyPlantSpecificationRow[];
    toelichting: string;
} {
    const leftColumn: DummyPlantSpecificationRow[] = [];
    const rightColumn: DummyPlantSpecificationRow[] = [];

    if (plant.dutchName) {
        leftColumn.push({ label: "Nederlandse naam", value: plant.dutchName, iconSrc: "/icons/nederlandse-naam.svg" });
    }
    if (plant.planthoeveelheidPerM2) {
        leftColumn.push({ label: "Planthoeveelheid/m²", value: String(plant.planthoeveelheidPerM2), iconSrc: "/icons/planthoeveelheid-per-m2.svg" });
    }
    if (plant.volwassenHoogte) {
        leftColumn.push({ label: "Volwassen hoogte", value: plant.volwassenHoogte, iconSrc: "/icons/volwassen-hoogte.svg" });
    }
    if (plant.kleuren.length > 0) {
        leftColumn.push({ label: "Kleur bloem", value: plant.kleuren.join(", "), iconSrc: "/icons/kleur-bloem.svg" });
    }
    if (plant.kleurBlad.length > 0) {
        leftColumn.push({ label: "Kleur blad", value: plant.kleurBlad.join(", "), iconSrc: "/icons/kleur-blad.svg" });
    }
    if (plant.bloeiperiode) {
        rightColumn.push({ label: "Bloeiperiode", value: plant.bloeiperiode, iconSrc: "/icons/bloeiperiode.svg" });
    }
    rightColumn.push({ label: "Inheems", value: plant.inheems ? "Ja" : "Nee", iconSrc: "/icons/inheems.svg" });
    if (plant.stikstofbehoefte) {
        rightColumn.push({ label: "Stikstofbehoefte", value: plant.stikstofbehoefte, iconSrc: "/icons/stikstofbehoefte.svg" });
    }
    if (plant.standplaatsen.length > 0) {
        rightColumn.push({ label: "Standplaats", value: plant.standplaatsen.join(", "), iconSrc: "/icons/standplaats.svg" });
    }
    if (plant.grondsoorten.length > 0) {
        rightColumn.push({ label: "Grondsoort", value: plant.grondsoorten.join(", "), iconSrc: "/icons/grondsoort.svg" });
    }

    return { leftColumn, rightColumn, toelichting: plant.toelichting ?? "" };
}

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    borderSoft: "#E0DEDF",
    green: "#58694C",
    greenLight: "#EEF0ED",
    orange: "#E94E1B",
    muted: "#6B7280",
    text: "#111111",
    searchBg: "#F2F2F2",
    softText: "#898988",
};

const ORANGE_ICON_FILTER =
    "brightness(0) saturate(100%) invert(51%) sepia(84%) saturate(3601%) hue-rotate(6deg) brightness(95%) contrast(93%)";

const GREEN_ICON_FILTER =
    "brightness(0) saturate(100%) invert(36%) sepia(13%) saturate(707%) hue-rotate(56deg) brightness(92%) contrast(86%)";

const DRAG_SCROLL_EDGE_SIZE = 96;
const DRAG_SCROLL_MAX_SPEED = 18;
const DRAG_SCROLL_LIST_MARGIN = 24;

const GRID_TEMPLATE =
    "108px minmax(200px,1fr) minmax(100px,0.4fr) minmax(130px,0.6fr) minmax(130px,0.6fr) minmax(105px,0.5fr) minmax(85px,0.35fr) 44px";

function formatPricePerPiece(price: number | undefined) {
    if (typeof price !== "number" || Number.isNaN(price)) {
        return "Prijs onbekend";
    }
    return `€${price.toFixed(2).replace(".", ",")} p/st`;
}

function formatTotalPrice(price: number) {
    return `€${price.toFixed(2).replace(".", ",")}`;
}

function PlantSpecificationInfoRow(props: DummyPlantSpecificationRow) {
    const { label, value, iconSrc } = props;

    return (
        <div
            className="grid items-start gap-4 py-3"
            style={{ gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)" }}
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

function PlantSpecificationsPanel(props: {
    leftColumn: DummyPlantSpecificationRow[];
    rightColumn: DummyPlantSpecificationRow[];
    toelichting?: string;
}) {
    const { leftColumn, rightColumn, toelichting } = props;

    return (
        <div
            className="rounded-[6px] border bg-white px-4 py-3"
            style={{ borderColor: COLORS.borderSoft }}
        >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
                <div>
                    {leftColumn.map((row, index) => (
                        <React.Fragment key={row.label}>
                            <PlantSpecificationInfoRow {...row} />
                            {index < leftColumn.length - 1 ? (
                                <div className="h-px w-full" style={{ backgroundColor: COLORS.borderSoft }} />
                            ) : null}
                        </React.Fragment>
                    ))}
                </div>

                <div className="hidden xl:block" style={{ backgroundColor: COLORS.borderSoft }} />

                <div>
                    {rightColumn.map((row, index) => (
                        <React.Fragment key={row.label}>
                            <PlantSpecificationInfoRow {...row} />
                            {index < rightColumn.length - 1 ? (
                                <div className="h-px w-full" style={{ backgroundColor: COLORS.borderSoft }} />
                            ) : null}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {toelichting ? (
                <>
                    <div className="h-px w-full my-3" style={{ backgroundColor: COLORS.borderSoft }} />
                    <PlantSpecificationInfoRow
                        label="Toelichting"
                        value={toelichting}
                        iconSrc="/icons/toelichting.svg"
                    />
                </>
            ) : null}
        </div>
    );
}

function movePlantListItemAfter(
    list: PlantListItem[],
    draggedItemId: string,
    targetItemId: string
) {
    if (draggedItemId === targetItemId) return list;

    const draggedIndex = list.findIndex((item) => item.id === draggedItemId);
    const targetIndex = list.findIndex((item) => item.id === targetItemId);

    if (draggedIndex === -1 || targetIndex === -1) return list;

    const nextList = [...list];
    const [draggedItem] = nextList.splice(draggedIndex, 1);
    const targetIndexAfterRemoval = nextList.findIndex((item) => item.id === targetItemId);

    if (targetIndexAfterRemoval === -1) return list;

    nextList.splice(targetIndexAfterRemoval + 1, 0, draggedItem);
    return nextList;
}

function movePlantListItemToTop(list: PlantListItem[], draggedItemId: string) {
    const draggedIndex = list.findIndex((item) => item.id === draggedItemId);
    if (draggedIndex === -1) return list;

    const nextList = [...list];
    const [draggedItem] = nextList.splice(draggedIndex, 1);
    nextList.unshift(draggedItem);
    return nextList;
}

function ProductRowNote(props: {
    value: string;
    onSave: (value: string) => void;
}) {
    const { value, onSave } = props;
    const [isEditing, setIsEditing] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [draftValue, setDraftValue] = useState(value);

    React.useEffect(() => {
        setDraftValue(value);
        if (value.length === 0) {
            setIsEditing(true);
            setIsFocused(false);
        }
    }, [value]);

    const handleSave = () => {
        const nextValue = draftValue.trim();
        onSave(nextValue);
        setIsFocused(false);
        setIsEditing(nextValue.length === 0);
    };

    if (!isEditing && value.length > 0) {
        return (
            <div
                className="flex items-start justify-between gap-3 overflow-hidden rounded-[4px] px-3 py-3 text-[14px]"
                style={{ color: COLORS.text, minHeight: 108 }}
            >
                <span
                    className="min-w-0 flex-1 whitespace-normal leading-[1.35]"
                    style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                >
                    {value}
                </span>
                <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="shrink-0 cursor-pointer"
                >
                    <img
                        src="/icons/edit.svg"
                        alt=""
                        style={{ width: 16, height: 16, display: "block" }}
                    />
                </button>
            </div>
        );
    }

    return (
        <div
            className="relative rounded-[4px] border bg-white"
            style={{
                minHeight: 108,
                borderColor: isFocused ? COLORS.orange : COLORS.borderSoft,
            }}
        >
            <textarea
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={handleSave}
                className="block h-full w-full resize-none bg-transparent px-3 py-2 pr-10 text-[14px] leading-[1.35] outline-none"
                style={{
                    color: COLORS.text,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    minHeight: 108,
                }}
            />
            {!isEditing ? null : (
                <button
                    type="button"
                    onMouseDown={(event) => {
                        event.preventDefault();
                        setIsEditing(true);
                        setIsFocused(true);
                    }}
                    className="absolute right-[12px] top-[12px] cursor-pointer"
                    style={{
                        display: draftValue.length > 0 || isFocused ? "none" : "block",
                    }}
                >
                    <img
                        src="/icons/edit.svg"
                        alt=""
                        style={{ width: 16, height: 16, display: "block" }}
                    />
                </button>
            )}
        </div>
    );
}

type LabelItem = {
    label: string;
    fill: string;
    stroke: string;
    objectType: string;
};

type ObjectLinkGroup = {
    typeLabel: string;
    labels: LabelItem[];
};

function getReadablePlantbedLabelColor(fillColor: string): string {
    const hex = fillColor.trim().replace("#", "");
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return "#3F6B3F";
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const darken = (v: number) => Math.max(0, Math.round(v * 0.55));
    const lighten = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.55));
    if (hex.toUpperCase() === "F2FDEF") return "#3F6B3F";
    const rr = luminance > 0.62 ? darken(r) : lighten(r);
    const gg = luminance > 0.62 ? darken(g) : lighten(g);
    const bb = luminance > 0.62 ? darken(b) : lighten(b);
    const toHex = (v: number) => v.toString(16).padStart(2, "0").toUpperCase();
    return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

function getVakLabelStyle(objectType: string, fill: string, stroke: string): {
    bg: string;
    border: string | null;
    text: string;
} {
    if (objectType === "hedge") return { bg: "#95CE86", border: null, text: "#56793E" };
    if (objectType === "treebed") return { bg: "#8FC38E", border: "#476D3C", text: "#476D3C" };
    return { bg: fill, border: stroke, text: getReadablePlantbedLabelColor(fill) };
}

function buildLinkGroups(
    plantId: string,
    plantbedLinks: Record<string, string[]>,
    objects: PolyObject[]
): ObjectLinkGroup[] {
    const plantbedLabels: LabelItem[] = [];
    const hedgeLabels: LabelItem[] = [];
    const treebedLabels: LabelItem[] = [];

    for (const [objectId, linkedPlantIds] of Object.entries(plantbedLinks)) {
        if (!linkedPlantIds.includes(plantId)) continue;

        const object = objects.find((o) => o.id === objectId);
        if (!object) continue;

        const objectsOfType = objects.filter((o) => o.type === object.type);
        const indexOfType = objectsOfType.findIndex((o) => o.id === object.id);
        const displayNumber =
            object.type === "plantbed" && typeof object.plantbedNo === "number"
                ? object.plantbedNo
                : indexOfType + 1;

        const label =
            object.type === "hedge"
                ? `H${displayNumber}`
                : object.type === "treebed"
                    ? `B${displayNumber}`
                    : `P${displayNumber}`;

        const fill =
            object.customStyle?.fill ??
            OBJECT_STYLES[object.type as ObjectType]?.fill ??
            "#DCE9DC";
        const stroke =
            object.customStyle?.stroke ??
            OBJECT_STYLES[object.type as ObjectType]?.stroke ??
            "#4F6B4F";

        const labelItem: LabelItem = { label, fill, stroke, objectType: object.type };

        if (object.type === "hedge") {
            hedgeLabels.push(labelItem);
        } else if (object.type === "treebed") {
            treebedLabels.push(labelItem);
        } else {
            plantbedLabels.push(labelItem);
        }
    }

    const groups: ObjectLinkGroup[] = [];

    if (plantbedLabels.length > 0) {
        groups.push({
            typeLabel: plantbedLabels.length === 1 ? "Plantvak" : "Plantvakken",
            labels: plantbedLabels,
        });
    }

    if (hedgeLabels.length > 0) {
        groups.push({
            typeLabel: hedgeLabels.length === 1 ? "Haag" : "Hagen",
            labels: hedgeLabels,
        });
    }

    if (treebedLabels.length > 0) {
        groups.push({
            typeLabel: treebedLabels.length === 1 ? "Boomvak" : "Boomvakken",
            labels: treebedLabels,
        });
    }

    return groups;
}

function buildTotalAdviceCount(
    plantId: string,
    plantbedLinks: Record<string, string[]>,
    objects: PolyObject[],
    plants: import("@/features/editor/lib/plantAdvice").ProjectPlantLike[],
    distributionOverrides: Record<string, Record<string, number>>
): number {
    let total = 0;

    for (const [objectId, linkedPlantIds] of Object.entries(plantbedLinks)) {
        if (!linkedPlantIds.includes(plantId)) continue;

        const object = objects.find((o) => o.id === objectId);
        if (!object) continue;

        const adviceData = buildAdviceData({
            selectedObject: object,
            currentType: object.type,
            linkedPlantIds,
            plants,
            distributionOverrides: distributionOverrides[objectId] ?? {},
        });

        const row = adviceData.rows.find((r) => r.plantId === plantId);
        if (row && row.adviceCount !== null) {
            total += row.adviceCount;
        }
    }

    return total;
}

export function buildPlantAdviceInfoForList(
    plantId: string,
    plantListItems: PlantListItem[],
    objects: PolyObject[],
    plants: import("@/features/editor/lib/plantAdvice").ProjectPlantLike[],
    plantbedLinks: Record<string, string[]>,
    distributionOverrides: Record<string, Record<string, number>>
): PlantAdviceInfo | null {
    const linkedEntries = Object.entries(plantbedLinks)
        .filter(([, ids]) => ids.includes(plantId))
        .map(([objectId, linkedIds]) => ({
            objectId,
            linkedIds,
            object: objects.find((o) => o.id === objectId),
        }))
        .filter(
            (e): e is { objectId: string; linkedIds: string[]; object: PolyObject } =>
                e.object != null &&
                ["plantbed", "hedge", "treebed"].includes(e.object.type)
        );

    if (!linkedEntries.length) return null;

    const item = plantListItems.find((li) => li.id === plantId);
    let displayName = item?.plant.botanicalName ?? "";
    let dutchName = item?.plant.dutchName ?? "";

    const vakken: VakAdviceEntry[] = [];

    for (const { objectId, linkedIds, object } of linkedEntries) {
        const adviceData = buildAdviceData({
            selectedObject: object,
            currentType: object.type,
            linkedPlantIds: linkedIds,
            plants,
            distributionOverrides: distributionOverrides[objectId] ?? {},
        });

        const row = adviceData.rows.find((r) => r.plantId === plantId);
        if (!row) continue;

        if (!displayName) displayName = row.latinName;
        if (!dutchName) dutchName = row.dutchName;

        // Build vak label (H1, P1, B1 …)
        const objectsOfType = objects.filter((o) => o.type === object.type);
        const indexOfType = objectsOfType.findIndex((o) => o.id === object.id);
        const displayNumber =
            object.type === "plantbed" && typeof object.plantbedNo === "number"
                ? object.plantbedNo
                : indexOfType + 1;
        const label =
            object.type === "hedge"
                ? `H${displayNumber}`
                : object.type === "treebed"
                ? `B${displayNumber}`
                : `P${displayNumber}`;

        const fill =
            object.customStyle?.fill ??
            OBJECT_STYLES[object.type as ObjectType]?.fill ??
            "#DCE9DC";
        const stroke =
            object.customStyle?.stroke ??
            OBJECT_STYLES[object.type as ObjectType]?.stroke ??
            "#4F6B4F";
        const style = getVakLabelStyle(object.type, fill, stroke);

        const isTreebed = object.type === "treebed";
        const isHedge = object.type === "hedge";

        // For hedges, get the actual length and estimated width
        let hedgeLength: number | undefined;
        let hedgeWidth: number | null | undefined;
        if (isHedge) {
            const hm = getEstimatedHedgeLengthInMeters(object, adviceData.totalSquareMeters);
            hedgeLength = row.assignedMeasureValue; // assigned length portion
            hedgeWidth = hm.hedgeWidthMeters;
        }

        // For hedges with a known width use length × width; otherwise fall back to area × distribution
        const assignedArea =
            isHedge && hedgeLength != null && hedgeWidth != null
                ? hedgeLength * hedgeWidth
                : adviceData.totalSquareMeters * (row.distributionPercentage / 100);

        const rawAdvice =
            !isTreebed && row.quantityPerSquareMeter != null
                ? assignedArea * row.quantityPerSquareMeter
                : null;

        vakken.push({
            objectId,
            label,
            vakType: object.type as "plantbed" | "hedge" | "treebed",
            style,
            measurementMode: adviceData.measurementMode,
            totalArea: adviceData.totalSquareMeters,
            distribution: row.distributionPercentage,
            assignedArea,
            density: row.quantityPerSquareMeter,
            rawAdvice,
            advice: row.adviceCount ?? 0,
            hedgeLength,
            hedgeWidth: isHedge ? (hedgeWidth ?? null) : undefined,
        });
    }

    if (!vakken.length) return null;

    return {
        plantId,
        name: displayName || plantId,
        latinName: dutchName,
        vakken,
    };
}

export default function FinalisatiePlantList() {
    const items = usePlantSelectionStore((s) => s.plantListItems);
    const setPlantListItems = usePlantSelectionStore((s) => s.setPlantListItems);
    const variantCache = usePlantVariantStore((s) => s.cache);
    const fetchVariants = usePlantVariantStore((s) => s.fetchVariants);
    const notify = useAppNotify();
    const [removeItemId, setRemoveItemId] = useState<string | null>(null);
    const [accessoryAdviceInfo, setAccessoryAdviceInfo] = useState<AccessoryAdviceInfo | null>(null);

    const objects = useProjectStore(
        (s: { objects: PolyObject[] }) => s.objects
    );
    const plantbedLinks = useProjectStore(
        (s: { plantbedLinks: Record<string, string[]> }) => s.plantbedLinks
    );
    const distributionOverrides = useProjectStore(
        (s: { distributionOverrides: Record<string, Record<string, number>> }) =>
            s.distributionOverrides
    );
    useEffect(() => {
        for (const item of items) {
            if (item.plant.category !== "Tuinmaterialen") {
                fetchVariants(item.plant.id);
            }
        }
    }, [items, fetchVariants]);

    const pricedItems = useMemo(
        () =>
            items.map((item) =>
                withResolvedBulkPrices(item, variantCache[item.plant.id]?.variants ?? [])
            ),
        [items, variantCache]
    );

    const plants = useMemo<ProjectPlantLike[]>(() => {
        return pricedItems.map((item) => ({
            id: item.id,
            latin: item.plant.botanicalName,
            dutch: item.plant.dutchName,
            planthoeveelheidPerM2: item.plant.planthoeveelheidPerM2,
        }));
    }, [pricedItems]);

    const [searchQuery, setSearchQuery] = useState("");
    const [sortValue, setSortValue] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [openSpecificationItemIds, setOpenSpecificationItemIds] = useState<string[]>([]);
    const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
    const [dropAfterItemId, setDropAfterItemId] = useState<string | null>(null);
    const [isDroppingAtTop, setIsDroppingAtTop] = useState(false);
    const [advicePopupInfo, setAdvicePopupInfo] = useState<PlantAdviceInfo | null>(null);
    const [hoveredAdviceId, setHoveredAdviceId] = useState<string | null>(null);
    const [staffelState, setStaffelState] = useState<{
        itemId: string;
        anchorRect: DOMRect;
    } | null>(null);

    const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const plantListDragBoundsRef = useRef<HTMLDivElement | null>(null);
    const dragPreviewNodeRef = useRef<HTMLDivElement | null>(null);
    const draggingItemIdRef = useRef<string | null>(null);
    const dragScrollAnimationFrameRef = useRef<number | null>(null);
    const dragScrollSpeedRef = useRef(0);

    const visibleItems = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        let nextItems = pricedItems.filter((item) => {
            if (!normalizedQuery) return true;
            return (
                matchesSearchQuery(item.plant.botanicalName, normalizedQuery) ||
                matchesSearchQuery(item.plant.dutchName, normalizedQuery)
            );
        });

        if (sortValue === "naam-a-z") {
            nextItems = [...nextItems].sort((a, b) =>
                a.plant.botanicalName.localeCompare(b.plant.botanicalName)
            );
        } else if (sortValue === "naam-z-a") {
            nextItems = [...nextItems].sort((a, b) =>
                b.plant.botanicalName.localeCompare(a.plant.botanicalName)
            );
        } else if (sortValue === "prijs-laag-hoog") {
            nextItems = [...nextItems].sort((a, b) =>
                (a.plant.pricePerPiece ?? 0) - (b.plant.pricePerPiece ?? 0)
            );
        } else if (sortValue === "prijs-hoog-laag") {
            nextItems = [...nextItems].sort((a, b) =>
                (b.plant.pricePerPiece ?? 0) - (a.plant.pricePerPiece ?? 0)
            );
        } else if (
            sortValue === "totaalprijs-laag-hoog" ||
            sortValue === "totaalprijs-hoog-laag"
        ) {
            const totalPriceMap = new Map<string, number>();
            for (const item of pricedItems) {
                const adviceCount = buildTotalAdviceCount(
                    item.id,
                    plantbedLinks,
                    objects,
                    plants,
                    distributionOverrides
                );
                const effectiveCount = item.quantity > 0 ? item.quantity : adviceCount;
                totalPriceMap.set(item.id, getPlantTotalPriceForQuantity(item, effectiveCount) ?? 0);
            }
            nextItems = [...nextItems].sort((a, b) => {
                const diff = (totalPriceMap.get(a.id) ?? 0) - (totalPriceMap.get(b.id) ?? 0);
                return sortValue === "totaalprijs-laag-hoog" ? diff : -diff;
            });
        }

        return nextItems;
    }, [pricedItems, searchQuery, sortValue, plantbedLinks, objects, plants, distributionOverrides]);

    const firstVisibleItemId = visibleItems[0]?.id ?? null;

    const draggingItem = useMemo(() => {
        if (!draggingItemId) return null;
        return items.find((item) => item.id === draggingItemId) ?? null;
    }, [draggingItemId, items]);

    useEffect(() => {
        draggingItemIdRef.current = draggingItemId;
    }, [draggingItemId]);

    const stopDragAutoScroll = () => {
        dragScrollSpeedRef.current = 0;
        if (dragScrollAnimationFrameRef.current !== null) {
            window.cancelAnimationFrame(dragScrollAnimationFrameRef.current);
            dragScrollAnimationFrameRef.current = null;
        }
    };

    const runDragAutoScroll = () => {
        const boundsNode = plantListDragBoundsRef.current;
        if (!boundsNode || dragScrollSpeedRef.current === 0) {
            stopDragAutoScroll();
            return;
        }

        const boundsRect = boundsNode.getBoundingClientRect();
        const currentScrollY = window.scrollY;
        const boundsTopY = currentScrollY + boundsRect.top;
        const boundsBottomY = currentScrollY + boundsRect.bottom;

        const minScrollY = Math.max(0, boundsTopY - DRAG_SCROLL_LIST_MARGIN);
        const maxScrollY = Math.max(
            minScrollY,
            boundsBottomY - window.innerHeight + DRAG_SCROLL_LIST_MARGIN
        );

        const nextScrollY = Math.max(
            minScrollY,
            Math.min(maxScrollY, currentScrollY + dragScrollSpeedRef.current)
        );

        if (nextScrollY === currentScrollY) {
            stopDragAutoScroll();
            return;
        }

        window.scrollTo({ top: nextScrollY, left: window.scrollX, behavior: "auto" });
        dragScrollAnimationFrameRef.current = window.requestAnimationFrame(runDragAutoScroll);
    };

    const updateDragAutoScroll = (clientY: number) => {
        if (typeof window === "undefined") return;

        const viewportHeight = window.innerHeight;
        const distanceToTop = clientY;
        const distanceToBottom = viewportHeight - clientY;

        if (distanceToTop < DRAG_SCROLL_EDGE_SIZE) {
            const intensity = 1 - Math.max(0, distanceToTop) / DRAG_SCROLL_EDGE_SIZE;
            dragScrollSpeedRef.current = -Math.ceil(intensity * DRAG_SCROLL_MAX_SPEED);
        } else if (distanceToBottom < DRAG_SCROLL_EDGE_SIZE) {
            const intensity = 1 - Math.max(0, distanceToBottom) / DRAG_SCROLL_EDGE_SIZE;
            dragScrollSpeedRef.current = Math.ceil(intensity * DRAG_SCROLL_MAX_SPEED);
        } else {
            dragScrollSpeedRef.current = 0;
        }

        if (
            dragScrollSpeedRef.current !== 0 &&
            dragScrollAnimationFrameRef.current === null
        ) {
            dragScrollAnimationFrameRef.current =
                window.requestAnimationFrame(runDragAutoScroll);
        }

        if (dragScrollSpeedRef.current === 0) {
            stopDragAutoScroll();
        }
    };

    const clearDragState = () => {
        stopDragAutoScroll();
        setDraggingItemId(null);
        setDropAfterItemId(null);
        setIsDroppingAtTop(false);
        draggingItemIdRef.current = null;
        document.body.style.cursor = "";

        if (
            dragPreviewNodeRef.current &&
            document.body.contains(dragPreviewNodeRef.current)
        ) {
            document.body.removeChild(dragPreviewNodeRef.current);
        }

        dragPreviewNodeRef.current = null;
    };

    const handleDragStart = (
        event: React.DragEvent<HTMLButtonElement>,
        itemId: string
    ) => {
        const draggedItem = items.find((item) => item.id === itemId);
        if (!draggedItem) return;

        setDraggingItemId(itemId);
        draggingItemIdRef.current = itemId;
        setDropAfterItemId(null);
        setIsDroppingAtTop(false);
        document.body.style.cursor = "grabbing";

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", itemId);
        event.dataTransfer.setData("application/x-plant-list-item-id", itemId);

        const rowNode = rowRefs.current[itemId];
        if (!rowNode) return;

        if (
            dragPreviewNodeRef.current &&
            document.body.contains(dragPreviewNodeRef.current)
        ) {
            document.body.removeChild(dragPreviewNodeRef.current);
        }

        const rowRect = rowNode.getBoundingClientRect();
        const previewShell = document.createElement("div");

        previewShell.style.position = "fixed";
        previewShell.style.top = "-10000px";
        previewShell.style.left = "-10000px";
        previewShell.style.width = `${rowRect.width}px`;
        previewShell.style.height = `${rowRect.height}px`;
        previewShell.style.pointerEvents = "none";
        previewShell.style.zIndex = "9999";
        previewShell.style.background = "#FFFFFF";
        previewShell.style.border = `1px solid ${COLORS.borderSoft}`;
        previewShell.style.borderRadius = "6px";
        previewShell.style.boxShadow = "0px 12px 28px rgba(0,0,0,0.18)";
        previewShell.style.overflow = "hidden";
        previewShell.style.transform = "scale(0.92)";
        previewShell.style.transformOrigin = "top left";

        const previewContent = rowNode.cloneNode(true) as HTMLDivElement;
        previewContent.style.margin = "0";
        previewContent.style.width = `${rowRect.width}px`;
        previewContent.style.height = `${rowRect.height}px`;
        previewContent.style.background = "#FFFFFF";
        previewContent.style.transform = "none";
        previewContent.style.filter = "none";

        previewContent
            .querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
                "button, input, select, textarea"
            )
            .forEach((element) => {
                element.disabled = true;
                element.style.pointerEvents = "none";
            });

        previewShell.appendChild(previewContent);
        document.body.appendChild(previewShell);
        dragPreviewNodeRef.current = previewShell;

        event.dataTransfer.setDragImage(previewShell, 24, 24);
    };

    const handleDragEnd = () => {
        clearDragState();
    };

    const handleDragOverRow = (
        event: React.DragEvent<HTMLDivElement>,
        itemId: string
    ) => {
        const draggedId =
            draggingItemIdRef.current ||
            event.dataTransfer.getData("application/x-plant-list-item-id") ||
            event.dataTransfer.getData("text/plain");

        if (!draggedId || draggedId === itemId) return;

        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";

        updateDragAutoScroll(event.clientY);

        const rowNode = rowRefs.current[itemId];
        const rowRect = rowNode?.getBoundingClientRect() ?? null;
        const isUpperHalf =
            !!rowRect && event.clientY < rowRect.top + rowRect.height / 2;

        const shouldDropAtTop = itemId === firstVisibleItemId && isUpperHalf;

        if (shouldDropAtTop) {
            if (!isDroppingAtTop) setIsDroppingAtTop(true);
            if (dropAfterItemId !== null) setDropAfterItemId(null);
            return;
        }

        if (isDroppingAtTop) setIsDroppingAtTop(false);
        if (dropAfterItemId !== itemId) setDropAfterItemId(itemId);
    };

    const handleDropRow = (
        event: React.DragEvent<HTMLDivElement>,
        itemId: string
    ) => {
        event.preventDefault();
        event.stopPropagation();

        const draggedId =
            draggingItemIdRef.current ||
            event.dataTransfer.getData("application/x-plant-list-item-id") ||
            event.dataTransfer.getData("text/plain");

        if (!draggedId || draggedId === itemId) {
            clearDragState();
            return;
        }

        const rowNode = rowRefs.current[itemId];
        const rowRect = rowNode?.getBoundingClientRect() ?? null;
        const isUpperHalf =
            !!rowRect && event.clientY < rowRect.top + rowRect.height / 2;

        const shouldDropAtTop = itemId === firstVisibleItemId && isUpperHalf;

        usePlantSelectionStore.setState((state) => ({
            plantListItems: shouldDropAtTop
                ? movePlantListItemToTop(state.plantListItems, draggedId)
                : movePlantListItemAfter(state.plantListItems, draggedId, itemId),
        }));

        clearDragState();
    };

    useEffect(() => {
        return () => {
            stopDragAutoScroll();
            document.body.style.cursor = "";

            if (
                dragPreviewNodeRef.current &&
                document.body.contains(dragPreviewNodeRef.current)
            ) {
                document.body.removeChild(dragPreviewNodeRef.current);
            }
        };
    }, []);

    const updateItem = (
        itemId: string,
        updater: (item: PlantListItem) => PlantListItem
    ) => {
        setPlantListItems(items.map((item) => (item.id === itemId ? updater(item) : item)));
    };

    const handleChangeNote = (itemId: string, value: string) => {
        updateItem(itemId, (item) => ({ ...item, note: value }));
    };

    const handleChangeQuantity = (itemId: string, value: string) => {
        const parsed = parseInt(value, 10);
        const nextQuantity = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
        updateItem(itemId, (item) => ({ ...item, quantity: nextQuantity }));
    };

    const handleCancelRemove = () => setRemoveItemId(null);

    const handleConfirmRemove = () => {
        if (!removeItemId) return;
        const target = items.find((item) => item.id === removeItemId);
        setPlantListItems(items.filter((item) => item.id !== removeItemId));
        setRemoveItemId(null);
        if (target) {
            notify(APP_NOTIFICATIONS.plantRemovedFromPlantList(target.plant.botanicalName));
        }
    };

    const handleTogglePlantSpecifications = (itemId: string) => {
        setOpenSpecificationItemIds((prev) =>
            prev.includes(itemId)
                ? prev.filter((id) => id !== itemId)
                : [...prev, itemId]
        );
    };

    const handleToggleStaffel = (
        event: React.MouseEvent<HTMLButtonElement>,
        itemId: string
    ) => {
        event.stopPropagation();
        if (staffelState?.itemId === itemId) {
            setStaffelState(null);
            return;
        }
        setStaffelState({
            itemId,
            anchorRect: event.currentTarget.getBoundingClientRect(),
        });
    };

    return (
        <section
            className="rounded-[10px] border p-5"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor: COLORS.border,
                boxShadow: "5px 3px 46px -25px rgba(0, 0, 0, 0.25)",
            }}
        >
            <h2
                className="text-[22px] font-semibold"
                style={{ color: COLORS.green }}
            >
                Definitieve plantenlijst
            </h2>

            <p className="mt-2 text-[14px]" style={{ color: COLORS.text }}>
                Pas hier je definitieve aantallen aan voor jou definitieve plantenlijst.<br />
                Wil je een plant verwijderen? Ga dan terug naar stap 5 en verwijder de plant uit de plantenlijst.
            </p>

            {items.length === 0 ? (
                <div
                    className="mt-6 flex min-h-[200px] items-center justify-center rounded-[6px]"
                    style={{ color: "#B0B0B0" }}
                >
                    <span className="text-center text-[16px]">
                        Geen planten in de plantenlijst
                    </span>
                </div>
            ) : (
                <>
                    <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                        <div
                            className="flex h-[44px] w-full sm:w-auto sm:min-w-[290px] items-center gap-3 rounded-[4px] px-4"
                            style={{
                                backgroundColor: COLORS.searchBg,
                                boxShadow: isSearchFocused
                                    ? "0px 1px 3px rgba(0, 0, 0, 0.14)"
                                    : "none",
                                transition: "box-shadow 180ms ease-in-out",
                            }}
                        >
                            <img
                                src="/icons/search.svg"
                                alt=""
                                style={{ width: 18, height: 18, display: "block", opacity: 0.7 }}
                            />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setIsSearchFocused(false)}
                                placeholder="Zoeken in plantenlijst..."
                                className="h-full w-full bg-transparent text-[14px] text-black outline-none placeholder:text-[#898988]"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <label
                                htmlFor="finalisatie-plant-list-sort"
                                className="text-[14px]"
                                style={{ color: COLORS.text }}
                            >
                                Sorteren op
                            </label>

                            <div className="relative">
                                <select
                                    id="finalisatie-plant-list-sort"
                                    value={sortValue}
                                    onChange={(event) => setSortValue(event.target.value)}
                                    className="h-[40px] min-w-[140px] appearance-none rounded-[4px] border bg-white pl-4 pr-10 text-[14px] font-semibold outline-none"
                                    style={{
                                        borderColor: COLORS.borderSoft,
                                        color: COLORS.text,
                                        cursor: "pointer",
                                    }}
                                >
                                    <option value="">Geen sortering</option>
                                    <option value="naam-a-z">Naam (A-Z)</option>
                                    <option value="naam-z-a">Naam (Z-A)</option>
                                    <option value="prijs-laag-hoog">Prijs p/st (Laag - Hoog)</option>
                                    <option value="prijs-hoog-laag">Prijs p/st (Hoog - Laag)</option>
                                    <option value="totaalprijs-laag-hoog">Totaalprijs (Laag - Hoog)</option>
                                    <option value="totaalprijs-hoog-laag">Totaalprijs (Hoog - Laag)</option>
                                </select>

                                <img
                                    src="/icons/chevron-down.svg"
                                    alt=""
                                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                                    style={{ width: 16, height: 16, display: "block" }}
                                />
                            </div>
                        </div>
                    </div>

                    <div ref={plantListDragBoundsRef} className="mt-6 overflow-x-auto">
                        <div>
                            <div
                                className="grid items-center gap-4 pb-4 text-[15px] font-semibold"
                                style={{
                                    gridTemplateColumns: GRID_TEMPLATE,
                                    color: COLORS.text,
                                }}
                            >
                                <div>Product</div>
                                <div>Plantnaam</div>
                                <div>Maatvoering</div>
                                <div>Gekoppeld aan</div>
                                <div>Notitie</div>
                                <div>Aantal</div>
                                <div>Prijs</div>
                                <div />
                            </div>

                            <div
                                className="h-px w-full"
                                style={{ backgroundColor: COLORS.borderSoft }}
                            />

                            {isDroppingAtTop && draggingItem ? (
                                <div
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        event.dataTransfer.dropEffect = "move";
                                    }}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();

                                        const draggedId =
                                            draggingItemIdRef.current ||
                                            event.dataTransfer.getData("application/x-plant-list-item-id") ||
                                            event.dataTransfer.getData("text/plain");

                                        if (!draggedId) {
                                            clearDragState();
                                            return;
                                        }

                                        usePlantSelectionStore.setState((state) => ({
                                            plantListItems: movePlantListItemToTop(
                                                state.plantListItems,
                                                draggedId
                                            ),
                                        }));

                                        clearDragState();
                                    }}
                                    className="my-4 flex min-h-[72px] items-center justify-center rounded-[6px] border-2 border-dashed px-6"
                                    style={{
                                        borderColor: COLORS.green,
                                        backgroundColor: COLORS.greenLight,
                                    }}
                                >
                                    <div
                                        className="flex items-center gap-3 text-center text-[15px] font-semibold"
                                        style={{ color: COLORS.green }}
                                    >
                                        <img
                                            src="/icons/arrow-down.svg"
                                            alt=""
                                            style={{
                                                width: 18,
                                                height: 18,
                                                display: "block",
                                                filter:
                                                    "brightness(0) saturate(100%) invert(36%) sepia(14%) saturate(756%) hue-rotate(52deg) brightness(90%) contrast(88%)",
                                            }}
                                        />
                                        <span>
                                            Laat hier los om &ldquo;{draggingItem.plant.botanicalName}&rdquo; hierheen te verplaatsen
                                        </span>
                                    </div>
                                </div>
                            ) : null}

                            {visibleItems.map((item) => {
                                const isDragging = draggingItemId === item.id;
                                const showDropPlaceholder =
                                    !!draggingItem &&
                                    draggingItem.id !== item.id &&
                                    dropAfterItemId === item.id;

                                const isSpecificationsOpen =
                                    openSpecificationItemIds.includes(item.id);
                                const specificationColumns =
                                    buildSpecificationsFromApiPlant(item.plant);

                                const linkGroups = buildLinkGroups(
                                    item.id,
                                    plantbedLinks,
                                    objects
                                );

                                const adviceCount = buildTotalAdviceCount(
                                    item.id,
                                    plantbedLinks,
                                    objects,
                                    plants,
                                    distributionOverrides
                                );

                                const isGardenMaterial = item.plant.category === "Tuinmaterialen";
                                const isAccessoryAdvice = item.addedFrom === "accessory-advice";
                                // Tuinmaterialen hebben geen advies (niet gekoppeld aan vakken)
                                // gebruik item.quantity, of het AI-advies, of standaard 1 als minimum
                                const effectiveCount =
                                    item.quantity > 0
                                        ? item.quantity
                                        : isAccessoryAdvice
                                            ? item.adviceQuantity ?? 1
                                            : isGardenMaterial
                                                ? 1
                                                : adviceCount;

                                const unitPrice = getPlantUnitPriceForQuantity(item, effectiveCount);
                                const totalPrice = unitPrice !== null ? effectiveCount * unitPrice : 0;

                                return (
                                    <div key={item.id}>
                                        <div
                                            style={{
                                                backgroundColor: isSpecificationsOpen
                                                    ? "#F6F7F5"
                                                    : "transparent",
                                                transition: "background-color 160ms ease",
                                            }}
                                        >
                                            <div
                                                ref={(node) => {
                                                    rowRefs.current[item.id] = node;
                                                }}
                                                data-plant-list-row-id={item.id}
                                                onDragOver={(event) =>
                                                    handleDragOverRow(event, item.id)
                                                }
                                                onDrop={(event) =>
                                                    handleDropRow(event, item.id)
                                                }
                                                className="grid items-start gap-4 px-3 py-4"
                                                style={{
                                                    gridTemplateColumns: GRID_TEMPLATE,
                                                    opacity: isDragging ? 0.3 : 1,
                                                    transition: "opacity 160ms ease",
                                                }}
                                            >
                                                {/* Product foto */}
                                                <div className="pt-1">
                                                    <div
                                                        className="overflow-hidden rounded-[2px]"
                                                        style={{
                                                            width: 108,
                                                            height: 108,
                                                            backgroundColor: "#F1F1EE",
                                                        }}
                                                    >
                                                        <PlantImg
                                                            src={item.plant.imageUrl}
                                                            alt={item.plant.botanicalName}
                                                            className="block h-full w-full"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Plantnaam + specificaties link */}
                                                <div className="flex min-h-[108px] flex-col pt-1">
                                                    <div
                                                        className="text-[15px] font-semibold leading-[1.35]"
                                                        style={{ color: COLORS.text }}
                                                    >
                                                        {item.plant.botanicalName}
                                                    </div>
                                                    {item.plant.category !== "Tuinmaterialen" ? (
                                                        <div
                                                            className="mt-1 text-[14px] leading-[1.35]"
                                                            style={{ color: COLORS.muted }}
                                                        >
                                                            {item.plant.dutchName}
                                                        </div>
                                                    ) : null}
                                                    {item.plant.category !== "Tuinmaterialen" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleTogglePlantSpecifications(item.id)
                                                            }
                                                            className="mt-auto inline-flex cursor-pointer items-center gap-2 text-[14px]"
                                                            style={{ color: COLORS.orange }}
                                                        >
                                                            <img
                                                                src={
                                                                    isSpecificationsOpen
                                                                        ? "/icons/cancel.svg"
                                                                        : "/icons/info.svg"
                                                                }
                                                                alt=""
                                                                style={{
                                                                    width: 16,
                                                                    height: 16,
                                                                    display: "block",
                                                                    filter: ORANGE_ICON_FILTER,
                                                                }}
                                                            />
                                                            <span>
                                                                {isSpecificationsOpen
                                                                    ? "Verberg plantspecificaties"
                                                                    : "Bekijk plantspecificaties"}
                                                            </span>
                                                        </button>
                                                    ) : null}
                                                </div>

                                                {/* Maatvoering */}
                                                <div
                                                    className="pt-2 text-[14px]"
                                                    style={{ color: COLORS.text }}
                                                >
                                                    {item.size || "—"}
                                                </div>

                                                {/* Gekoppeld aan */}
                                                <div className="flex flex-col gap-2 pt-1">
                                                    {linkGroups.length === 0 ? (
                                                        item.plant.category !== "Tuinmaterialen" ? (
                                                            <span
                                                                className="text-[13px]"
                                                                style={{ color: COLORS.softText }}
                                                            >
                                                                Niet gekoppeld
                                                            </span>
                                                        ) : null
                                                    ) : (
                                                        linkGroups.map((group) => (
                                                            <div key={group.typeLabel}>
                                                                <div
                                                                    className="mb-1 text-[12px] font-semibold"
                                                                    style={{ color: COLORS.muted }}
                                                                >
                                                                    {group.typeLabel}:
                                                                </div>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {group.labels.map((labelItem) => {
                                                                        const ls = getVakLabelStyle(
                                                                            labelItem.objectType,
                                                                            labelItem.fill,
                                                                            labelItem.stroke
                                                                        );
                                                                        return (
                                                                            <span
                                                                                key={labelItem.label}
                                                                                className="inline-flex items-center rounded-[4px] px-2 py-0.5 text-[13px] font-bold"
                                                                                style={{
                                                                                    backgroundColor: ls.bg,
                                                                                    border: ls.border
                                                                                        ? `1.5px solid ${ls.border}`
                                                                                        : "none",
                                                                                    color: ls.text,
                                                                                }}
                                                                            >
                                                                                {labelItem.label}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Notitie */}
                                                <div className="pt-1">
                                                    <ProductRowNote
                                                        value={item.note}
                                                        onSave={(value) =>
                                                            handleChangeNote(item.id, value)
                                                        }
                                                    />
                                                </div>

                                                {/* Aantal */}
                                                <div className="flex flex-col gap-1 pt-1 min-h-[108px]">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={
                                                                item.quantity > 0
                                                                    ? item.quantity
                                                                    : ""
                                                            }
                                                            onChange={(event) =>
                                                                handleChangeQuantity(
                                                                    item.id,
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder={
                                                                isAccessoryAdvice
                                                                    ? String(item.adviceQuantity ?? 1)
                                                                    : isGardenMaterial
                                                                        ? "1"
                                                                        : String(adviceCount)
                                                            }
                                                            className="h-[40px] w-[72px] rounded-[4px] border bg-white px-3 text-[14px] outline-none"
                                                            style={{
                                                                borderColor: COLORS.borderSoft,
                                                                color: COLORS.text,
                                                            }}
                                                        />
                                                        <span
                                                            className="text-[13px]"
                                                            style={{ color: COLORS.muted }}
                                                        >
                                                            st.
                                                        </span>
                                                    </div>
                                                    {item.plant.category !== "Tuinmaterialen" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const info = buildPlantAdviceInfoForList(
                                                                    item.id,
                                                                    items,
                                                                    objects,
                                                                    plants,
                                                                    plantbedLinks,
                                                                    distributionOverrides
                                                                );
                                                                if (info) setAdvicePopupInfo(info);
                                                            }}
                                                            className="mt-auto inline-flex flex-col rounded-[4px] px-2 py-1 text-[14px]"
                                                            onMouseEnter={() => setHoveredAdviceId(item.id)}
                                                            onMouseLeave={() => setHoveredAdviceId(null)}
                                                            style={{
                                                                backgroundColor: "#F0F5EE",
                                                                border: hoveredAdviceId === item.id
                                                                    ? `1.5px solid ${COLORS.green}`
                                                                    : "1.5px solid transparent",
                                                                cursor: "pointer",
                                                                textAlign: "left",
                                                                transition: "border-color 120ms ease",
                                                            }}
                                                        >
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <img
                                                                    src="/icons/help.svg"
                                                                    alt=""
                                                                    style={{
                                                                        width: 14,
                                                                        height: 14,
                                                                        display: "block",
                                                                        flexShrink: 0,
                                                                    }}
                                                                />
                                                                <span
                                                                    className="font-semibold"
                                                                    style={{ color: COLORS.green }}
                                                                >
                                                                    Advies:
                                                                </span>
                                                            </span>
                                                            <span
                                                                className="mt-0.5 text-[14px]"
                                                                style={{ color: COLORS.text }}
                                                            >
                                                                {adviceCount} {stuksLabel(adviceCount)}
                                                            </span>
                                                        </button>
                                                    ) : isAccessoryAdvice ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setAccessoryAdviceInfo({
                                                                    name: item.plant.botanicalName,
                                                                    quantity: item.adviceQuantity ?? 1,
                                                                    reason: item.adviceReason ?? "",
                                                                })
                                                            }
                                                            className="mt-auto inline-flex flex-col rounded-[4px] px-2 py-1 text-[14px]"
                                                            onMouseEnter={() => setHoveredAdviceId(item.id)}
                                                            onMouseLeave={() => setHoveredAdviceId(null)}
                                                            style={{
                                                                backgroundColor: "#F0F5EE",
                                                                border: hoveredAdviceId === item.id
                                                                    ? `1.5px solid ${COLORS.green}`
                                                                    : "1.5px solid transparent",
                                                                cursor: "pointer",
                                                                textAlign: "left",
                                                                transition: "border-color 120ms ease",
                                                            }}
                                                        >
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <img
                                                                    src="/icons/help.svg"
                                                                    alt=""
                                                                    style={{
                                                                        width: 14,
                                                                        height: 14,
                                                                        display: "block",
                                                                        flexShrink: 0,
                                                                    }}
                                                                />
                                                                <span
                                                                    className="font-semibold"
                                                                    style={{ color: COLORS.green }}
                                                                >
                                                                    Advies:
                                                                </span>
                                                            </span>
                                                            <span
                                                                className="mt-0.5 text-[14px]"
                                                                style={{ color: COLORS.text }}
                                                            >
                                                                {item.adviceQuantity ?? 1} {stuksLabel(item.adviceQuantity ?? 1)}
                                                            </span>
                                                        </button>
                                                    ) : null}
                                                </div>

                                                {/* Prijs */}
                                                <div className="flex flex-col gap-1 pt-1">
                                                    <span
                                                        className="text-[13px]"
                                                        style={{ color: "#FF0000" }}
                                                    >
                                                        {formatPricePerPiece(unitPrice ?? undefined)}
                                                    </span>
                                                    <span
                                                        className="text-[14px] font-bold"
                                                        style={{ color: "#FF0000" }}
                                                    >
                                                        {formatTotalPrice(totalPrice)}
                                                    </span>
                                                    {Array.isArray(item.bulkPrices) && item.bulkPrices.length > 0 ? (
                                                        <StaffelLink
                                                            isOpen={staffelState?.itemId === item.id}
                                                            onClick={(event) => handleToggleStaffel(event, item.id)}
                                                        />
                                                    ) : null}

                                                    {item.addedFrom === "accessory-advice" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setRemoveItemId(item.id)}
                                                            className="mt-1 inline-flex w-fit cursor-pointer items-center gap-1.5 text-[13px]"
                                                            style={{ color: COLORS.muted }}
                                                            aria-label={`Verwijder ${item.plant.botanicalName}`}
                                                        >
                                                            <img
                                                                src="/icons/delete-tool.svg"
                                                                alt=""
                                                                style={{ width: 14, height: 14, display: "block" }}
                                                            />
                                                            <span>Verwijderen</span>
                                                        </button>
                                                    ) : null}
                                                </div>

                                                {/* Drag handle */}
                                                <div className="flex h-full items-center justify-center pt-2">
                                                    <button
                                                        type="button"
                                                        draggable
                                                        onDragStart={(event) =>
                                                            handleDragStart(event, item.id)
                                                        }
                                                        onDragEnd={handleDragEnd}
                                                        className="flex h-[108px] w-[44px] items-center justify-center rounded-[4px]"
                                                        style={{
                                                            cursor: isDragging ? "grabbing" : "grab",
                                                        }}
                                                        aria-label={`Verplaats ${item.plant.botanicalName}`}
                                                    >
                                                        <span
                                                            className="flex h-full w-full items-center justify-center"
                                                            style={{
                                                                cursor: isDragging
                                                                    ? "grabbing"
                                                                    : "grab",
                                                            }}
                                                        >
                                                            <img
                                                                src="/icons/drag-handle.svg"
                                                                alt=""
                                                                style={{
                                                                    width: 18,
                                                                    height: 18,
                                                                    display: "block",
                                                                    opacity: 0.9,
                                                                    cursor: isDragging
                                                                        ? "grabbing"
                                                                        : "grab",
                                                                }}
                                                            />
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>

                                            {isSpecificationsOpen ? (
                                                <div className="px-3 pb-3">
                                                    <div
                                                        className="grid gap-4"
                                                        style={{
                                                            gridTemplateColumns: GRID_TEMPLATE,
                                                        }}
                                                    >
                                                        <div style={{ gridColumn: "1 / 8" }}>
                                                            <PlantSpecificationsPanel
                                                                leftColumn={specificationColumns.leftColumn}
                                                                rightColumn={specificationColumns.rightColumn}
                                                                toelichting={specificationColumns.toelichting}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>

                                        {showDropPlaceholder ? (
                                            <div
                                                onDragOver={(event) =>
                                                    handleDragOverRow(event, item.id)
                                                }
                                                onDrop={(event) =>
                                                    handleDropRow(event, item.id)
                                                }
                                                className="mb-4 flex min-h-[72px] items-center justify-center rounded-[6px] border-2 border-dashed px-6"
                                                style={{
                                                    borderColor: COLORS.green,
                                                    backgroundColor: COLORS.greenLight,
                                                }}
                                            >
                                                <div
                                                    className="flex items-center gap-3 text-center text-[15px] font-semibold"
                                                    style={{ color: COLORS.green }}
                                                >
                                                    <img
                                                        src="/icons/arrow-down.svg"
                                                        alt=""
                                                        style={{
                                                            width: 18,
                                                            height: 18,
                                                            display: "block",
                                                            filter:
                                                                "brightness(0) saturate(100%) invert(36%) sepia(14%) saturate(756%) hue-rotate(52deg) brightness(90%) contrast(88%)",
                                                        }}
                                                    />
                                                    <span>
                                                        Laat hier los om &ldquo;{draggingItem?.plant.botanicalName}&rdquo; hierheen te verplaatsen
                                                    </span>
                                                </div>
                                            </div>
                                        ) : null}

                                        <div
                                            className="h-px w-full"
                                            style={{ backgroundColor: COLORS.borderSoft }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* ── Advice calculation popup ── */}
            {staffelState && (() => {
                const openItem = pricedItems.find((item) => item.id === staffelState.itemId);
                if (!openItem || !Array.isArray(openItem.bulkPrices) || openItem.bulkPrices.length === 0) {
                    return null;
                }
                return (
                    <StaffelPopover
                        isOpen
                        onClose={() => setStaffelState(null)}
                        anchorRect={staffelState.anchorRect}
                        basePrice={openItem.plant.pricePerPiece}
                        bulkPrices={openItem.bulkPrices}
                    />
                );
            })()}

            <FinalisatieAdviceCalculation
                open={advicePopupInfo != null}
                onClose={() => setAdvicePopupInfo(null)}
                plant={advicePopupInfo}
            />

            <AccessoryAdvicePopup
                info={accessoryAdviceInfo}
                onClose={() => setAccessoryAdviceInfo(null)}
            />

            <ConfirmModal
                open={removeItemId != null}
                title="Product regel verwijderen"
                description="Weet je zeker dat je deze regel wilt verwijderen?"
                cancelText="Nee, ga terug"
                confirmText="Ja, verwijder"
                onCancel={handleCancelRemove}
                onConfirm={handleConfirmRemove}
            />
        </section>
    );
}
