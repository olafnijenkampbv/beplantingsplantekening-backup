"use client";

import React, { useEffect, useMemo, useState } from "react";
import { OBJECT_STYLES, useProjectStore } from "@/state/projectStore";
import type { TreebedVariant } from "@/state/projectStore";
import TreebedVariantSwatch from "@/features/editor/components/TreebedVariantSwatch";
import { APP_NOTIFICATIONS, useAppNotify } from "@/state/allNotifications";
import { usePlantSelectionStore } from "@/features/editor/state/plantSelectionStore";
import { usePlantVariantStore } from "@/features/editor/state/plantVariantStore";
import { goToFinalisatie } from "@/features/editor/lib/editorWorkflowNavigation";
import { matchesSearchQuery } from "@/features/editor/lib/plantSelectionSearch";
import ConfirmModal from "@/features/editor/components/ConfirmModal";

const COLORS = {
    orange: "#E94E1B",
    orangeLight: "#FFE5DD",
    green: "#58694C",
    greenLight: "#EEF0ED",
    border: "#E3E2E2",
};

function getReadablePlantbedLabelColor(fillColor: string): string {
    const hex = (fillColor ?? "").trim().replace("#", "");
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return "#3F6B3F";
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (hex.toUpperCase() === "F2FDEF") return "#3F6B3F";
    const darken = (v: number) => Math.max(0, Math.round(v * 0.55));
    const lighten = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.55));
    const rr = luminance > 0.62 ? darken(r) : lighten(r);
    const gg = luminance > 0.62 ? darken(g) : lighten(g);
    const bb = luminance > 0.62 ? darken(b) : lighten(b);
    const toHex = (v: number) => v.toString(16).padStart(2, "0").toUpperCase();
    return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

const PLANT_LATIN_NAME_FONT_SIZE = 14;
const PLANT_DUTCH_NAME_FONT_SIZE = 12;

// ✅ align met EditorToolbar (zelfde waardes als HelloEditor)
const HEADER_HEIGHT = 56;
const TOOLBAR_OFFSET = 12;
const TOP_OFFSET = HEADER_HEIGHT + TOOLBAR_OFFSET; // 68px

type PlantItem = {
    id: string;
    nr: number;
    latin: string;
    dutch: string;
    size: string;
    imageSrc: string;
    pricePerPiece?: number;
};

type TabKey = "list" | "linked";

function IconSearch(props: { className?: string }) {
    return (
        <svg
            className={props.className}
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            style={{ color: "#898988" }}
        >
            <path
                d="M9 3.5C5.96243 3.5 3.5 5.96243 3.5 9C3.5 12.0376 5.96243 14.5 9 14.5C10.2402 14.5 11.3823 14.0907 12.3006 13.3996L15.2004 16.2994C15.4933 16.5923 15.9682 16.5923 16.2611 16.2994C16.554 16.0065 16.554 15.5316 16.2611 15.2387L13.3996 12.3772C14.0907 11.4589 14.5 10.3168 14.5 9C14.5 5.96243 12.0376 3.5 9 3.5ZM5 9C5 6.79086 6.79086 5 9 5C11.2091 5 13 6.79086 13 9C13 11.2091 11.2091 13 9 13C6.79086 13 5 11.2091 5 9Z"
                fill="currentColor"
            />
        </svg>
    );
}

function IconX(props: { className?: string }) {
    return (
        <svg className={props.className} width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path
                d="M5.3 5.3C5.6 5 6.1 5 6.4 5.3L10 8.9L13.6 5.3C13.9 5 14.4 5 14.7 5.3C15 5.6 15 6.1 14.7 6.4L11.1 10L14.7 13.6C15 13.9 15 14.4 14.7 14.7C14.4 15 13.9 15 13.6 14.7L10 11.1L6.4 14.7C6.1 15 5.6 15 5.3 14.7C5 14.4 5 13.9 5.3 13.6L8.9 10L5.3 6.4C5 6.1 5 5.6 5.3 5.3Z"
                fill="currentColor"
            />
        </svg>
    );
}

function BadgeCount(props: {
    count: number;
    tone?: "default" | "linked" | "empty";
}) {
    const { count, tone = "default" } = props;

    const palette =
        tone === "linked"
            ? {
                background: COLORS.orange,
                color: "#ffffff",
            }
            : tone === "empty"
                ? {
                    background: COLORS.orangeLight,
                    color: COLORS.orange,
                }
                : {
                    background: "#E0E6DB",
                    color: COLORS.green,
                };

    return (
        <span
            className="inline-flex items-center justify-center font-semibold"
            style={{
                minWidth: 24,
                height: 24,
                paddingLeft: 7,
                paddingRight: 7,
                borderRadius: 6,
                background: palette.background,
                color: palette.color,
                fontSize: 13,
                lineHeight: 1,
            }}
        >
            {count}
        </span>
    );
}

function PlantRow(props: { plant: PlantItem; isLinked: boolean; linkedCount: number; linkedLabelText?: string }) {
    const { plant, isLinked, linkedCount, linkedLabelText } = props;
    const clearSelection = useProjectStore((s: any) => s.clearSelection);

    const linkedLabel =
        linkedLabelText ??
        (linkedCount === 1
            ? "aan 1 plantvak gekoppeld"
            : `aan ${linkedCount} plantvakken gekoppeld`);

    return (
        <div
            className="flex items-center gap-3 px-4 py-3 border-b plant-row-draggable"
            style={{
                borderColor: COLORS.border,
                background: isLinked ? "#DEFFDE" : "#fff",
                cursor: "grab",
                userSelect: "none",
                position: "relative",
                borderLeft: isLinked ? "7px solid #008000" : "7px solid transparent",
                paddingLeft: isLinked ? 14 : 16,
            }}
            draggable
            onDragStart={(e) => {
                clearSelection();
                e.dataTransfer.setData("application/x-plant-id", plant.id);
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData("text/plain", plant.id);
                (e.currentTarget as HTMLDivElement).style.cursor = "grabbing";
            }}
            onDragEnd={(e) => {
                (e.currentTarget as HTMLDivElement).style.cursor = "grab";
            }}
        >
            <div
                className={`flex items-center justify-center font-bold text-white ${isLinked ? "rounded-full" : "rounded-md"
                    }`}
                style={{
                    width: 32,
                    height: 32,
                    background: isLinked ? "transparent" : COLORS.green,
                    flex: "0 0 auto",
                    pointerEvents: "none",
                    overflow: "visible",
                }}
            >
                {isLinked ? (
                    <img
                        src="/icons/check-icon.svg"
                        alt=""
                        style={{
                            width: 26,
                            height: 26,
                            display: "block",
                            objectFit: "contain",
                        }}
                    />
                ) : (
                    plant.nr
                )}
            </div>

            <div
                className="min-w-0 flex-1"
                style={{
                    pointerEvents: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                }}
            >
                <div
                    className="font-semibold leading-tight truncate text-black"
                    style={{ fontSize: PLANT_LATIN_NAME_FONT_SIZE }}
                >
                    {plant.latin}
                </div>

                <div
                    className="leading-tight truncate"
                    style={{
                        color: "#444",
                        marginTop: 2,
                        fontSize: PLANT_DUTCH_NAME_FONT_SIZE,
                    }}
                >
                    {plant.dutch}
                </div>

                <div
                    className="text-[14px] leading-tight truncate"
                    style={{ color: "#222", marginTop: 8 }}
                >
                    {plant.size}
                </div>

                {plant.pricePerPiece !== undefined && (
                    <div
                        className="leading-tight truncate"
                        style={{ color: "#FF0000", marginTop: 4, fontSize: 14 }}
                    >
                        {`€${plant.pricePerPiece.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p/st`}
                    </div>
                )}

                {linkedCount > 0 && (
                    <div
                        className="text-[12px] leading-tight font-semibold truncate"
                        style={{ color: "#008000", marginTop: 4 }}
                    >
                        {linkedLabel}
                    </div>
                )}
            </div>

            <div
                className="flex items-center gap-2"
                style={{ color: "#111", pointerEvents: "none", flex: "0 0 auto" }}
            >
                <img
                    src="/icons/drag-handle.svg"
                    alt=""
                    style={{
                        width: 26,
                        height: 26,
                        display: "block",
                    }}
                />
            </div>
        </div>
    );
}

function LinkedGroupHeader(props: {
    title: string;
    iconSrc: string;
    count: number;
    open: boolean;
    onToggle: () => void;
}) {
    const { title, iconSrc, count, open, onToggle } = props;

    return (
        <button
            type="button"
            className="w-full flex items-center justify-between"
            style={{
                background: "#F5F7F4",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                padding: "10px 12px",
                cursor: "pointer",
            }}
            onClick={onToggle}
        >
            <div className="flex items-center gap-10">
                <div className="flex items-center gap-10">
                    <img
                        src={iconSrc}
                        alt=""
                        style={{
                            width: 16,
                            height: 16,
                            display: "block",
                            objectFit: "contain",
                        }}
                    />
                    <div
                        className="font-semibold"
                        style={{
                            fontSize: 14,
                            color: COLORS.green,
                        }}
                    >
                        {title}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-10">
                <BadgeCount count={count} tone="default" />
                <img
                    src={open ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
                    alt=""
                    style={{
                        width: 18,
                        height: 18,
                        display: "block",
                    }}
                />
            </div>
        </button>
    );
}

function LinkedObjectHeader(props: {
    title: string;
    linkedCount: number;
    open: boolean;
    swatchFill: string;
    swatchStroke: string;
    swatchShape?: "square" | "circle";
    treebedVariant?: TreebedVariant;
    onToggle: () => void;
}) {
    const { title, linkedCount, open, swatchFill, swatchStroke, swatchShape = "square", treebedVariant, onToggle } = props;
    
    return (
        <button
            type="button"
            className="w-full flex items-center justify-between transition-colors duration-150"
            style={{
                padding: "12px 14px",
                background: open ? "#F7F7F7" : "#ffffff",
                border: "none",
                cursor: "pointer",
            }}
            onClick={onToggle}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#F7F7F7";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = open
                    ? "#F7F7F7"
                    : "#ffffff";
            }}
        >
            <div
                className="font-semibold flex items-center"
                style={{
                    color: "#111",
                    fontSize: 14,
                    textAlign: "left",
                    gap: 8,
                    minWidth: 0,
                }}
            >
                {treebedVariant ? (
                    <TreebedVariantSwatch
                        variant={treebedVariant}
                        size={14}
                    />
                ) : (
                    <span
                        style={{
                            width: 12,
                            height: 12,
                            borderRadius: swatchShape === "circle" ? 999 : 2,
                            background: swatchFill,
                            border: `1px solid ${swatchStroke}`,
                            flex: "0 0 auto",
                        }}
                    />
                )}
                <span>{title}</span>
            </div>

            <div className="flex items-center gap-10">
                <BadgeCount
                    count={linkedCount}
                    tone={linkedCount > 0 ? "linked" : "empty"}
                />
                <img
                    src={open ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
                    alt=""
                    style={{
                        width: 18,
                        height: 18,
                        display: "block",
                    }}
                />
            </div>
        </button>
    );
}

function LinkedPlantRow(props: { plant: PlantItem; onClick: () => void; onUnlink: () => void }) {
    const { plant, onClick, onUnlink } = props;

    return (
        <div
            className="flex items-center gap-3 px-4 py-3 border-b"
            style={{
                borderColor: COLORS.border,
                background: "#ffffff",
            }}
        >
            <button
                type="button"
                className="linked-plant-name-button flex items-center gap-3 min-w-0 flex-1 text-left"
                style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                }}
                onClick={onClick}
            >
                <div
                    className="flex items-center justify-center rounded-md font-bold text-white"
                    style={{
                        width: 32,
                        height: 32,
                        background: COLORS.green,
                        flex: "0 0 auto",
                    }}
                >
                    {plant.nr}
                </div>

                <div className="min-w-0 flex-1">
                    <div
                        className="linked-plant-latin-name font-semibold leading-tight truncate text-black"
                        style={{ fontSize: PLANT_LATIN_NAME_FONT_SIZE }}
                    >
                        {plant.latin}
                    </div>
                    <div
                        className="leading-tight truncate"
                        style={{
                            color: "#444",
                            fontSize: PLANT_DUTCH_NAME_FONT_SIZE,
                        }}
                    >
                        {plant.dutch}
                    </div>
                    <div
                        className="leading-tight truncate"
                        style={{
                            color: "#111",
                            fontSize: 14,
                            marginTop: 8,
                        }}
                    >
                        {plant.size}
                    </div>

                    {plant.pricePerPiece !== undefined && (
                        <div
                            className="leading-tight truncate"
                            style={{ color: "#FF0000", fontSize: 14, marginTop: 4 }}
                        >
                            {`€${plant.pricePerPiece.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p/st`}
                        </div>
                    )}
                </div>
            </button>

            <button
                type="button"
                className="h-9 w-9 rounded-md flex items-center justify-center transition-colors duration-150"
                style={{ color: "#111", cursor: "pointer", flex: "0 0 auto" }}
                onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = "#f2f2f2";
                    el.style.color = "#D11A2A";
                }}
                onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = "transparent";
                    el.style.color = "#111";
                }}
                onClick={onUnlink}
                title="Ontkoppelen"
            >
                <IconX />
            </button>
        </div>
    );
}

function ChevronDownIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
                d="M6 8L10 12L14 8"
                stroke="#111"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function ChevronUpIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
                d="M6 12L10 8L14 12"
                stroke="#111"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
export default function PlantSidebar(props: {
    onLinkedPlantSelect?: (plant: { id: string; latin: string; dutch: string; imageSrc: string } | null) => void;
    hidden?: boolean;
}) {
    const { onLinkedPlantSelect, hidden = false } = props;

    const [collapsed, setCollapsed] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<TabKey>("list");
    const [query, setQuery] = React.useState("");
    const [showEmptyBedsModal, setShowEmptyBedsModal] = React.useState(false);
    const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
    const [openLinkedGroups, setOpenLinkedGroups] = React.useState<Record<"plantbed" | "hedge" | "treebed", boolean>>({
        plantbed: true,
        hedge: false,
        treebed: false,
    });

    const linkedScrollRef = React.useRef<HTMLDivElement | null>(null);
    const linkedSectionRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

    // ✅ Smooth open/close (footer blijft vast, we animeren alleen bovenpaneel)
    const headerRowRef = React.useRef<HTMLDivElement | null>(null);
    const footerRef = React.useRef<HTMLDivElement | null>(null);

    // ✅ alleen nodig om collapsed hoogte te meten (zonder dat je "2 menu's" ziet)
    const collapsedMeasureRef = React.useRef<HTMLDivElement | null>(null);

    const [panelHeight, setPanelHeight] = React.useState<number>(0);
    const panelHeightRef = React.useRef<number>(0);

    const ANIM_MS = 220;
    const ANIM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

    const notify = useAppNotify();

    const getExpandedPanelTargetHeight = React.useCallback(() => {
        const bottomMargin = 18; // zelfde als wrapper bottom
        const maxCardHeight = window.innerHeight - TOP_OFFSET - bottomMargin;

        const headerH = headerRowRef.current?.getBoundingClientRect().height ?? 0;
        const footerH = footerRef.current?.getBoundingClientRect().height ?? 0;

        // ✅ panel = ALLES tussen header en footer (dus scharnier bij de lijn boven de knop)
        return Math.max(0, Math.floor(maxCardHeight - headerH - footerH));
    }, []);

    // ✅ Plants uit de drawing-aware plantenlijststore
    const plantListItems = usePlantSelectionStore((s) => s.plantListItems);
    const variantCache = usePlantVariantStore((s) => s.cache);
    const fetchVariants = usePlantVariantStore((s) => s.fetchVariants);

    // Zorg dat variant-data geladen is voor alle planten in de lijst
    useEffect(() => {
        for (const item of plantListItems) {
            fetchVariants(item.plant.id);
        }
    }, [plantListItems, fetchVariants]);

    const plants = useMemo(() => {
        let nextNr = 1;

        return plantListItems.filter((item) => item.plant.category !== "Tuinmaterialen").map((item) => {
            const plantId = item.plant.id;
            const variants = variantCache[plantId]?.variants ?? [];
            const selectedVariant =
                item.size && item.size !== "Geen maat geselecteerd"
                    ? variants.find((v) => v.sizeLabel === item.size) ?? null
                    : null;

            return {
                id: item.id,
                nr: nextNr++,
                latin: item.plant.botanicalName,
                dutch: item.plant.dutchName,
                size: item.size || "Geen maat geselecteerd",
                imageSrc: item.plant.imageUrl ?? "/images/placeholder-plant.jpg",
                pricePerPiece: selectedVariant ? selectedVariant.price : item.plant.pricePerPiece,
                planthoeveelheidPerM2: item.plant.planthoeveelheidPerM2,
            };
        });
    }, [plantListItems, variantCache]);

    const plantsById = useMemo(() => {
        return Object.fromEntries(
            plants.map((plant) => [plant.id, plant])
        ) as Record<string, PlantItem>;
    }, [plants]);

    const setPlants = useProjectStore((s: any) => s.setPlants);
    const isPlantLinked = useProjectStore((s: any) => s.isPlantLinked);
    const plantSidebarFocus = useProjectStore((s: any) => s.plantSidebarFocus);

    const selectObject = useProjectStore((s: any) => s.selectObject);
    const focusCanvasOnObject = useProjectStore((s: any) => s.focusCanvasOnObject);

    // ✅ subscribe op echte state, zodat UI DIRECT rerendert bij link/unlink
    const plantbedLinks = useProjectStore((s: any) => s.plantbedLinks) as Record<string, string[]>;
    const plantbedLinkedCountMap = useProjectStore((s: any) => s.plantbedLinkedCount) as Record<string, number>;
    const unlinkPlantFromPlantbedByPlantId = useProjectStore((s: any) => s.unlinkPlantFromPlantbedByPlantId);

    const validPlantIds = useMemo(() => {
        return new Set(plants.map((plant) => plant.id));
    }, [plants]);

    useEffect(() => {
        setPlants(plants);

        for (const [plantbedId, linkedPlantIds] of Object.entries(plantbedLinks ?? {})) {
            for (const linkedPlantId of linkedPlantIds ?? []) {
                if (!validPlantIds.has(linkedPlantId)) {
                    unlinkPlantFromPlantbedByPlantId(plantbedId, linkedPlantId);
                }
            }
        }
    }, [plants, plantbedLinks, setPlants, unlinkPlantFromPlantbedByPlantId, validPlantIds]);

    // ✅ hoe vaak elke plant gekoppeld is (plantId -> count)
    const plantLinkedCountMap = useMemo(() => {
        const counts: Record<string, number> = {};

        for (const plantIds of Object.values(plantbedLinks ?? {})) {
            for (const pid of plantIds ?? []) {
                counts[pid] = (counts[pid] ?? 0) + 1;
            }
        }

        return counts;
    }, [plantbedLinks]);

    // ✅ Plantvakken uit canvas (live, dus undo/redo werkt automatisch)
    const objects = useProjectStore((s: any) => s.objects);

    const plantLinkedLabelMap = useMemo(() => {
        const objectById = new Map(
            (objects as any[]).map((obj) => [obj.id as string, obj])
        );

        const getLinkedObjectLabelPart = (
            count: number,
            singular: string,
            plural: string
        ) => {
            if (count <= 0) return null;
            if (count === 1) return `een ${singular}`;
            return `${count} ${plural}`;
        };

        const joinLabelParts = (parts: string[]) => {
            if (parts.length === 1) return parts[0];
            if (parts.length === 2) return `${parts[0]} en ${parts[1]}`;

            return `${parts.slice(0, -1).join(", ")} en ${parts[parts.length - 1]}`;
        };

        const labels: Record<string, string> = {};

        for (const plant of plants) {
            const linkedObjectIds = Object.entries(plantbedLinks ?? {})
                .filter(([, plantIds]) => (plantIds ?? []).includes(plant.id))
                .map(([objectId]) => objectId);

            const linkedObjects = linkedObjectIds
                .map((objectId) => objectById.get(objectId))
                .filter(Boolean) as any[];

            if (linkedObjects.length === 0) continue;

            const plantbedCount = linkedObjects.filter((object) => object.type === "plantbed").length;
            const hedgeCount = linkedObjects.filter((object) => object.type === "hedge").length;
            const treebedCount = linkedObjects.filter((object) => object.type === "treebed").length;

            const labelParts = [
                getLinkedObjectLabelPart(treebedCount, "boomvak", "boomvakken"),
                getLinkedObjectLabelPart(hedgeCount, "haag", "hagen"),
                getLinkedObjectLabelPart(plantbedCount, "plantvak", "plantvakken"),
            ].filter(Boolean) as string[];

            if (labelParts.length === 0) continue;

            labels[plant.id] = `aan ${joinLabelParts(labelParts)} gekoppeld`;
        }

        return labels;
    }, [objects, plantbedLinks, plants]);

    const plantbeds = useMemo(() => {
        const numberedObjects = (objects as any[])
            .filter((o) => o?.type === "plantbed" || o?.type === "hedge" || o?.type === "treebed")
            .map((obj, idx) => ({
                id: obj.id as string,
                type: obj.type as "plantbed" | "hedge" | "treebed",
                no: typeof obj.plantbedNo === "number" ? obj.plantbedNo : idx + 1,
                title:
                    obj.type === "hedge"
                        ? `Haag ${typeof obj.plantbedNo === "number" ? obj.plantbedNo : idx + 1}`
                        : obj.type === "treebed"
                            ? `Boomvak ${typeof obj.plantbedNo === "number" ? obj.plantbedNo : idx + 1}`
                            : `Plantvak ${typeof obj.plantbedNo === "number" ? obj.plantbedNo : idx + 1}`,
                swatchFill: {
                    ...OBJECT_STYLES[obj.type as keyof typeof OBJECT_STYLES],
                    ...(obj.customStyle ?? {}),
                }.fill,
                swatchStroke: {
                    ...OBJECT_STYLES[obj.type as keyof typeof OBJECT_STYLES],
                    ...(obj.customStyle ?? {}),
                }.stroke,
                swatchShape: (obj.type === "treebed" ? "circle" : "square") as "circle" | "square",
                treebedVariant: obj.type === "treebed" ? (obj.treebedVariant ?? "standard") as TreebedVariant : undefined,
            }))
            .sort((a, b) => {
                if (a.type !== b.type) {
                    const order = { plantbed: 0, hedge: 1, treebed: 2 };
                    return order[a.type] - order[b.type];
                }
                return a.no - b.no;
            });

        return numberedObjects;
    }, [objects]);

    const linkedGroups = useMemo(() => {
        return {
            plantbed: plantbeds.filter((item) => item.type === "plantbed"),
            hedge: plantbeds.filter((item) => item.type === "hedge"),
            treebed: plantbeds.filter((item) => item.type === "treebed"),
        };
    }, [plantbeds]);

    const hasPlantbeds = plantbeds.length > 0;

    useEffect(() => {
        const focusedPlantbedId = plantSidebarFocus?.plantbedId;
        if (!focusedPlantbedId) return;

        const focusedPlantbed = plantbeds.find((pb) => pb.id === focusedPlantbedId);
        if (!focusedPlantbed) return;

        setCollapsed(false);
        setActiveTab("linked");

        setOpenLinkedGroups({
            plantbed: focusedPlantbed.type === "plantbed",
            hedge: focusedPlantbed.type === "hedge",
            treebed: focusedPlantbed.type === "treebed",
        });

        setOpenSections(() => {
            const next: Record<string, boolean> = {};
            for (const pb of plantbeds) next[pb.id] = false;
            next[focusedPlantbedId] = true;
            return next;
        });

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const container = linkedScrollRef.current;
                const target = linkedSectionRefs.current[focusedPlantbedId];

                if (!container || !target) return;

                const containerRect = container.getBoundingClientRect();
                const targetRect = target.getBoundingClientRect();

                const TOP_PADDING = 8;

                const targetScrollTop =
                    container.scrollTop + (targetRect.top - containerRect.top) - TOP_PADDING;

                container.scrollTo({
                    top: Math.max(0, targetScrollTop),
                    behavior: "auto",
                });
            });
        });
    }, [plantSidebarFocus?.nonce, plantbeds]);
    
    const filteredPlants = useMemo(() => {
        const q = query.trim();
        if (!q) return plants;

        return plants.filter((p) => {
            return (
                matchesSearchQuery(p.latin, q) ||
                matchesSearchQuery(p.dutch, q) ||
                String(p.nr).includes(q)
            );
        });
    }, [query, plants]);

    const linkedSummary = useMemo(() => {
        const total = plants?.length ?? 0;

        let linked = 0;
        for (const p of plants ?? []) {
            if ((plantLinkedCountMap?.[p.id] ?? 0) > 0) linked += 1;
        }

        return { linked, total };
    }, [plants, plantLinkedCountMap]);

    // ✅ 1x success toast zodra alles gekoppeld is (alleen bij overgang)
    const prevCanGenerateRef = React.useRef<boolean>(false);

    useEffect(() => {
        const total = linkedSummary.total ?? 0;
        const linked = linkedSummary.linked ?? 0;

        const canGenerateNow = total > 0 && linked === total;
        const canGeneratePrev = prevCanGenerateRef.current;

        if (!canGeneratePrev && canGenerateNow) {
            notify(APP_NOTIFICATIONS.allPlantsLinkedReadyToGenerate());
        }

        prevCanGenerateRef.current = canGenerateNow;
    }, [linkedSummary.total, linkedSummary.linked, notify]);

    // ✅ Houd openSections in sync met plantvakken (add/remove keys)
    useEffect(() => {
        setOpenSections((prev) => {
            const next: Record<string, boolean> = {};

            for (const pb of plantbeds) {
                next[pb.id] = prev[pb.id] ?? false;
            }

            return next;
        });
    }, [plantbeds]);

    useEffect(() => {
        setOpenLinkedGroups((prev) => ({
            plantbed: linkedGroups.plantbed.length > 0 ? prev.plantbed : false,
            hedge: linkedGroups.hedge.length > 0 ? prev.hedge : false,
            treebed: linkedGroups.treebed.length > 0 ? prev.treebed : false,
        }));
    }, [linkedGroups]);

    useEffect(() => {
        const setHeights = () => {
            const collapsedH = collapsedMeasureRef.current?.scrollHeight ?? 0;
            const expandedH = getExpandedPanelTargetHeight();

            const next = collapsed ? collapsedH : expandedH;
            setPanelHeight(next);
            panelHeightRef.current = next;
        };

        setHeights();

        window.addEventListener("resize", setHeights);
        return () => window.removeEventListener("resize", setHeights);
    }, [collapsed, getExpandedPanelTargetHeight]);

    useEffect(() => {
        if (collapsed || activeTab !== "linked") {
            onLinkedPlantSelect?.(null);
        }
    }, [collapsed, activeTab, onLinkedPlantSelect]);

    return (
        <>
            <div
                className="fixed"
                style={{
                    zIndex: 30,
                    right: 18,
                    bottom: 18,
                    width: 420,
                    maxWidth: "calc(100vw - 24px)",
                    maxHeight: `calc(100vh - ${TOP_OFFSET + 18}px)`,
                    opacity: hidden ? 0 : 1,
                    pointerEvents: hidden ? "none" : "auto",
                    willChange: "opacity",
                }}
            >
            <div
                className="rounded-md overflow-hidden border bg-white flex flex-col"
                style={{
                    position: "relative",          // ✅ nodig voor absolute collapsed panel
                    height: "100%",
                    maxHeight: "100%",
                    borderColor: COLORS.border,
                    boxShadow: "0px 6px 18px rgba(0,0,0,0.18)",
                }}
            >
                {/* Header: titel + chevron, daaronder tabs */}
                <div className="border-b" style={{ borderColor: COLORS.border }}>
                    {/* Rij 1: kop + chevron */}
                    <div ref={headerRowRef} className="flex items-center justify-between px-5 py-4">
                        <div
                            className="font-semibold"
                            style={{
                                fontSize: 18,
                                color: COLORS.green,
                            }}
                        >
                            Plantenlijst
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                const current = panelHeightRef.current;

                                const collapsedH = collapsedMeasureRef.current?.scrollHeight ?? 0;
                                const expandedH = getExpandedPanelTargetHeight();
                                const target = collapsed ? expandedH : collapsedH;

                                setPanelHeight(current);

                                if (!collapsed) {
                                    onLinkedPlantSelect?.(null);
                                }

                                setCollapsed((v) => !v);

                                requestAnimationFrame(() => {
                                    setPanelHeight(target);
                                    panelHeightRef.current = target;
                                });
                            }}
                            className="h-10 w-10 flex items-center justify-center"
                            style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                color: "#111",
                            }}
                            title={collapsed ? "Uitklappen" : "Inklappen"}
                        >
                            {collapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </button>
                    </div>

                    {/* ✅ Animated panel (ALLES tussen header en footer) */}
                    <div
                        style={{
                            height: panelHeight,
                            overflow: "hidden",
                            transition: `height ${ANIM_MS}ms ${ANIM_EASE}`,
                        }}
                    >
                        {/* ✅ Visible content (geen overlap => geen gevoel van 2 panelen) */}
                        <div
                            style={{
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                opacity: 1,
                            }}
                        >
                            {!collapsed ? (
                                <>
                                    {/* Tabs */}
                                    <div className="flex" style={{ paddingLeft: 8, paddingRight: 8 }}>
                                        <button
                                            type="button"
                                            className="flex-1 py-3 font-semibold cursor-pointer"
                                            style={{
                                                fontSize: 15,
                                                color: activeTab === "list" ? COLORS.green : "#111",
                                                background: activeTab === "list" ? "#ffffff" : "#f2f2f2",
                                                borderTopLeftRadius: 5,
                                                borderTopRightRadius: 5,
                                                borderBottom: activeTab === "list" ? `2px solid ${COLORS.green}` : "2px solid transparent",
                                            }}
                                                onClick={() => {
                                                    setActiveTab("list");
                                                    onLinkedPlantSelect?.(null);
                                                }}
                                        >
                                            Planten
                                        </button>

                                        <button
                                            type="button"
                                            className="flex-1 py-3 font-semibold cursor-pointer"
                                            style={{
                                                fontSize: 15,
                                                color: activeTab === "linked" ? COLORS.green : "#111",
                                                background: activeTab === "linked" ? "#ffffff" : "#f2f2f2",
                                                borderTopLeftRadius: 5,
                                                borderTopRightRadius: 5,
                                                borderBottom: activeTab === "linked" ? `2px solid ${COLORS.green}` : "2px solid transparent",
                                            }}
                                            onClick={() => setActiveTab("linked")}
                                        >
                                            Gekoppelde planten
                                        </button>
                                    </div>

                                        {/* Content */}
                                        <div className="flex-1 min-h-0 overflow-hidden">
                                            <div className="h-full min-h-0 overflow-hidden">
                                                {activeTab === "list" ? (
                                                    <div className="pt-4 px-4 h-full flex flex-col">
                                                        <div className="text-[14px] mb-3 italic" style={{ color: "#000" }}>
                                                            Sleep de planten in de getekende plantvakken. Je kan planten aan meerdere plantvakken koppelen.
                                                        </div>

                                                        <div
                                                            className="flex items-center gap-2 px-3 py-2"
                                                            style={{ borderRadius: 5, background: "#f2f2f2" }}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            onPointerDown={(e) => e.stopPropagation()}
                                                        >
                                                            <IconSearch className="opacity-100" />
                                                            <input
                                                                value={query}
                                                                onChange={(e) => setQuery(e.target.value)}
                                                                placeholder="Zoeken in plantenlijst..."
                                                                className="w-full bg-transparent outline-none plant-search-input"
                                                                style={{ fontSize: 15, color: "#000" }}
                                                                onKeyDown={(e) => e.stopPropagation()}
                                                            />
                                                        </div>

                                                        <div className="mt-3 -mx-4 border-t" style={{ borderColor: COLORS.border }} />

                                                        <div className="mt-0 -mx-4 flex-1 min-h-0 overflow-y-auto app-thin-scrollbar">
                                                            {filteredPlants.map((p) => (
                                                                <PlantRow
                                                                    key={p.id}
                                                                    plant={p}
                                                                    isLinked={Boolean(isPlantLinked(p.id))}
                                                                    linkedCount={plantLinkedCountMap?.[p.id] ?? 0}
                                                                    linkedLabelText={plantLinkedLabelMap?.[p.id]}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="pt-4 px-4 h-full flex flex-col">
                                                        {!hasPlantbeds ? (
                                                            <div
                                                                className="flex items-center justify-center"
                                                                style={{
                                                                    paddingTop: 32,
                                                                    color: "#898988",
                                                                    fontSize: 14,
                                                                    fontWeight: 400,
                                                                    textAlign: "center",
                                                                }}
                                                            >
                                                                Teken eerst een plantvak.
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="text-[14px] mb-3 italic" style={{ color: "#000" }}>
                                                                   Hier vind je een overzicht van de planten die je aan de vakken hebt gekoppeld. In de volgende stap kun je de aantallen zelf aanpassen.
                                                                </div>

                                                                <div
                                                                    ref={linkedScrollRef}
                                                                    className="flex-1 min-h-0 overflow-y-auto app-thin-scrollbar"
                                                                >
                                                                    <div className="flex flex-col gap-3 pb-2">
                                                                        {[
                                                                            {
                                                                                key: "plantbed" as const,
                                                                                title: "Plantvakken",
                                                                                iconSrc: "/icons/plantvakken.svg",
                                                                                items: linkedGroups.plantbed,
                                                                            },
                                                                            {
                                                                                key: "hedge" as const,
                                                                                title: "Hagen",
                                                                                iconSrc: "/icons/hagen.svg",
                                                                                items: linkedGroups.hedge,
                                                                            },
                                                                            {
                                                                                key: "treebed" as const,
                                                                                title: "Boomvakken",
                                                                                iconSrc: "/icons/boomvakken.svg",
                                                                                items: linkedGroups.treebed,
                                                                            },
                                                                        ]
                                                                            .filter((group) => group.items.length > 0)
                                                                            .map((group) => (
                                                                                <div key={group.key} className="flex flex-col gap-2">
                                                                                    <LinkedGroupHeader
                                                                                        title={group.title}
                                                                                        iconSrc={group.iconSrc}
                                                                                        count={group.items.length}
                                                                                        open={openLinkedGroups[group.key]}
                                                                                        onToggle={() => {
                                                                                            setOpenLinkedGroups((prev) => ({
                                                                                                ...prev,
                                                                                                [group.key]: !prev[group.key],
                                                                                            }));
                                                                                        }}
                                                                                    />

                                                                                    {openLinkedGroups[group.key] && (
                                                                                        <div
                                                                                            style={{
                                                                                                border: `1px solid ${COLORS.border}`,
                                                                                                borderRadius: 6,
                                                                                                background: "#ffffff",
                                                                                                overflow: "hidden",
                                                                                            }}
                                                                                        >
                                                                                            {group.items.map((pb, index) => {
                                                                                                const linkedPlantIds = plantbedLinks?.[pb.id] ?? [];
                                                                                                const linkedCount =
                                                                                                    plantbedLinkedCountMap?.[pb.id] ?? linkedPlantIds.length;

                                                                                                const linkedPlants = linkedPlantIds
                                                                                                    .map((pid: string) => plantsById[pid])
                                                                                                    .filter(Boolean) as PlantItem[];

                                                                                                return (
                                                                                                    <div
                                                                                                        key={pb.id}
                                                                                                        ref={(el) => {
                                                                                                            linkedSectionRefs.current[pb.id] = el;
                                                                                                        }}
                                                                                                        style={{
                                                                                                            borderTop:
                                                                                                                index === 0 ? "none" : `1px solid ${COLORS.border}`,
                                                                                                        }}
                                                                                                    >
                                                                                                        <LinkedObjectHeader
                                                                                                            title={pb.title}
                                                                                                            linkedCount={linkedCount}
                                                                                                            open={Boolean(openSections[pb.id])}
                                                                                                            swatchFill={pb.swatchFill}
                                                                                                            swatchStroke={pb.swatchStroke}
                                                                                                            swatchShape={pb.swatchShape}
                                                                                                            treebedVariant={pb.treebedVariant}
                                                                                                            onToggle={() => {
                                                                                                                selectObject(pb.id);
                                                                                                                focusCanvasOnObject(pb.id);

                                                                                                                setOpenSections((prev) => {
                                                                                                                    const willOpen = !Boolean(prev[pb.id]);

                                                                                                                    const next: Record<string, boolean> = {};
                                                                                                                    for (const other of plantbeds) {
                                                                                                                        next[other.id] = false;
                                                                                                                    }

                                                                                                                    next[pb.id] = willOpen;
                                                                                                                    return next;
                                                                                                                });
                                                                                                            }}
                                                                                                        />

                                                                                                        {openSections[pb.id] && (
                                                                                                            <>
                                                                                                                {linkedPlants.length > 0 ? (
                                                                                                                    <>
                                                                                                                        {linkedPlants.map((plant) => (
                                                                                                                            <LinkedPlantRow
                                                                                                                                key={`${pb.id}-${plant.id}`}
                                                                                                                                plant={plant}
                                                                                                                                onClick={() => {
                                                                                                                                    onLinkedPlantSelect?.({
                                                                                                                                        id: plant.id,
                                                                                                                                        latin: plant.latin,
                                                                                                                                        dutch: plant.dutch,
                                                                                                                                        imageSrc: plant.imageSrc,
                                                                                                                                    });
                                                                                                                                }}
                                                                                                                                onUnlink={() => {
                                                                                                                                    unlinkPlantFromPlantbedByPlantId(pb.id, plant.id);
                                                                                                                                    onLinkedPlantSelect?.(null);

                                                                                                                                    const objectLabel =
                                                                                                                                        pb.type === "treebed"
                                                                                                                                            ? "boomvak"
                                                                                                                                            : pb.type === "hedge"
                                                                                                                                                ? "haag"
                                                                                                                                                : "plantvak";

                                                                                                                                    notify(
                                                                                                                                        APP_NOTIFICATIONS.plantUnlinkedFromObject(
                                                                                                                                            plant.latin,
                                                                                                                                            objectLabel,
                                                                                                                                            pb.no
                                                                                                                                        )
                                                                                                                                    );
                                                                                                                                }}
                                                                                                                            />
                                                                                                                        ))}
                                                                                                                    </>
                                                                                                                ) : (
                                                                                                                    <div
                                                                                                                        className="px-4 py-3 text-[12px] italic"
                                                                                                                        style={{
                                                                                                                            color: "#333",
                                                                                                                            borderTop: `1px solid ${COLORS.border}`,
                                                                                                                            background: "#ffffff",
                                                                                                                        }}
                                                                                                                    >
                                                                                                                        {pb.type === "treebed"
                                                                                                                            ? "Nog geen bomen gekoppeld."
                                                                                                                            : pb.type === "hedge"
                                                                                                                                ? "Nog geen haagplanten gekoppeld."
                                                                                                                                : "Nog geen planten gekoppeld."}
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </>
                                                                                                        )}
                                                                                                    </div>
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                </>
                            ) : (
                                // ✅ Collapsed tekst (kleinere ruimte onder titel zoals je design)
                                <div className="px-5 pt-2 pb-3">
                                        <div className="text-[13px]" style={{ color: "#111" }}>
                                            {linkedSummary.total > 0 && linkedSummary.linked === linkedSummary.total ? (
                                                <>
                                                    <span className="font-semibold">Alle planten gekoppeld.</span>{" "}
                                                    Je kan nu je beplantingstekening afronden.
                                                </>
                                            ) : (
                                                <>
                                                    <span className="font-semibold">{linkedSummary.linked}</span> van{" "}
                                                    <span className="font-semibold">{linkedSummary.total}</span> planten gekoppeld. Je kunt pas afronden
                                                    wanneer alle planten en bomen gekoppeld zijn.
                                                </>
                                            )}
                                        </div>
                                </div>
                            )}
                        </div>

                        {/* ✅ Hidden meet-node (alleen voor scrollHeight, nooit zichtbaar) */}
                        <div
                            style={{
                                position: "absolute",
                                visibility: "hidden",
                                pointerEvents: "none",
                                left: 0,
                                top: 0,
                                width: "100%",
                            }}
                        >
                            <div ref={collapsedMeasureRef} className="px-5 pt-2 pb-3">
                                <div className="text-[13px]" style={{ color: "#111" }}>
                                    {linkedSummary.total > 0 && linkedSummary.linked === linkedSummary.total ? (
                                        <>
                                            <span className="font-semibold">Alle planten gekoppeld.</span>{" "}
                                            Je kan nu je beplantingstekening afronden.
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-semibold">{linkedSummary.linked}</span> van{" "}
                                            <span className="font-semibold">{linkedSummary.total}</span> planten gekoppeld. Je kunt pas afronden
                                            wanneer alle planten en bomen gekoppeld zijn.
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div ref={footerRef} className="p-4 border-t" style={{ borderColor: COLORS.border }}>
                        {(() => {
                            const total = linkedSummary.total ?? 0;
                            const linked = linkedSummary.linked ?? 0;

                            const canGenerate = total > 0 && linked === total;
                            const progress = total > 0 ? Math.max(0, Math.min(1, linked / total)) : 0;

                            const statusText = `${linked} van ${total} planten gekoppeld. Je kunt pas afronden wanneer alle planten en bomen gekoppeld zijn.`;

                            const showStatusText = collapsed;
                            // ✅ Alleen tonen wanneer sidebar ingeklapt is

                            return (
                                <>
                                    <button
                                        type="button"
                                        aria-disabled={!canGenerate}
                                        className="w-full rounded-md px-4 py-3 font-semibold border"
                                        style={{
                                            position: "relative",
                                            overflow: "hidden",
                                            background: canGenerate ? COLORS.orange : COLORS.orangeLight,
                                            borderColor: canGenerate ? COLORS.orange : COLORS.orangeLight,
                                            color: canGenerate ? "#fff" : COLORS.orange,
                                            cursor: canGenerate ? "pointer" : "default",
                                        }}
                                        onClick={() => {
                                            if (!canGenerate) {
                                                notify(APP_NOTIFICATIONS.generateBlockedByUnlinkedPlants(linked, total));
                                                return;
                                            }

                                            const emptyBeds = plantbeds.filter(
                                                (pb) => (plantbedLinks?.[pb.id]?.length ?? 0) === 0
                                            );
                                            if (emptyBeds.length > 0) {
                                                setShowEmptyBedsModal(true);
                                                return;
                                            }

                                            goToFinalisatie();
                                        }}
                                    >
                                        {(() => {
                                            const progressPct = `${Math.max(0, Math.min(1, progress)) * 100}%`;

                                            // ✅ tint witte svg naar #E94E1B (zodat cancel ook oranje is bij 0 gekoppeld)
                                            const ORANGE_FILTER =
                                                "invert(41%) sepia(97%) saturate(2284%) hue-rotate(343deg) brightness(95%) contrast(101%)";

                                            const iconSrc = canGenerate ? "/icons/check.svg" : "/icons/cancel.svg";

                                            return (
                                                <>
                                                    {/* ✅ PROGRESS FILL (altijd #E94E1B, ook bij disabled) */}
                                                    <div
                                                        aria-hidden="true"
                                                        style={{
                                                            position: "absolute",
                                                            left: 0,
                                                            top: 0,
                                                            bottom: 0,
                                                            width: progressPct,
                                                            background: COLORS.orange,
                                                            transition: "width 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                                                            pointerEvents: "none",
                                                        }}
                                                    />

                                                    {/* ✅ BASISLAAG (altijd gecentreerd) — tekst/icoon ORANJE bij disabled */}
                                                    <div
                                                        className="relative flex items-center justify-center gap-3"
                                                        style={{
                                                            height: "100%",
                                                            paddingLeft: 16,
                                                            paddingRight: 16,
                                                            color: canGenerate ? "#fff" : COLORS.orange,
                                                            pointerEvents: "none",
                                                            userSelect: "none",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        <img
                                                            src={iconSrc}
                                                            alt=""
                                                            style={{
                                                                width: 18,
                                                                height: 18,
                                                                // enabled = wit icoon, disabled = oranje icoon (ook bij 0 gekoppeld)
                                                                filter: canGenerate ? "brightness(0) invert(1)" : ORANGE_FILTER,
                                                                flex: "0 0 auto",
                                                            }}
                                                        />
                                                        <span>Afronden</span>
                                                    </div>

                                                    {/* ✅ OVERLAYLAAG (wit) — NIET meer in smalle container, maar full width + clipPath */}
                                                    {!canGenerate && (
                                                        <div
                                                            aria-hidden="true"
                                                            style={{
                                                                position: "absolute",
                                                                inset: 0,
                                                                pointerEvents: "none",
                                                                clipPath: `inset(0 calc(100% - ${progressPct}) 0 0)`,
                                                                transition: "clip-path 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                                                            }}
                                                        >
                                                            <div
                                                                className="flex items-center justify-center gap-3"
                                                                style={{
                                                                    height: "100%",
                                                                    paddingLeft: 16,
                                                                    paddingRight: 16,
                                                                    color: "#fff",
                                                                    userSelect: "none",
                                                                    whiteSpace: "nowrap",
                                                                }}
                                                            >
                                                                <img
                                                                    src="/icons/cancel.svg"
                                                                    alt=""
                                                                    style={{
                                                                        width: 18,
                                                                        height: 18,
                                                                        filter: "brightness(0) invert(1)",
                                                                        flex: "0 0 auto",
                                                                    }}
                                                                />
                                                                <span>Afronden</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>
            <style jsx global>{`
                .plant-search-input::placeholder {
                    color: #898988;
                    opacity: 1;
                }

                                .plant-row-draggable:active {
                    cursor: grabbing;
                }

                .linked-plant-name-button:hover .linked-plant-latin-name {
                    text-decoration: underline;
                    text-underline-offset: 2px;
                }
            `}</style>
        </div>
        <ConfirmModal
            open={showEmptyBedsModal}
            title="Lege vakken in je tekening"
            description={
                <>
                    De volgende plantvakken, boomvakken of haagvakken hebben nog geen planten gekoppeld.
                    Wil je toch doorgaan naar de afrondpagina?
                </>
            }
            items={plantbeds
                .filter((pb) => (plantbedLinks?.[pb.id]?.length ?? 0) === 0)
                .map((pb) => {
                    let nrBg: string;
                    let nrColor: string;
                    let nrBorder: string | null;
                    if (pb.type === "hedge") {
                        nrBg = "#95CE86"; nrColor = "#56793E"; nrBorder = null;
                    } else if (pb.type === "treebed") {
                        nrBg = "#8FC38E"; nrColor = "#476D3C"; nrBorder = "#476D3C";
                    } else {
                        nrBg = pb.swatchFill ?? COLORS.green;
                        nrColor = getReadablePlantbedLabelColor(pb.swatchFill ?? "");
                        nrBorder = pb.swatchStroke ?? null;
                    }
                    return {
                        id: pb.id,
                        nr: pb.type === "hedge" ? `H${pb.no}` : pb.type === "treebed" ? `B${pb.no}` : `P${pb.no}`,
                        nrBg,
                        nrColor,
                        nrBorder,
                        title: pb.title,
                        subtitle:
                            pb.type === "treebed"
                                ? "Geen bomen gekoppeld"
                                : pb.type === "hedge"
                                    ? "Geen haagplanten gekoppeld"
                                    : "Geen planten gekoppeld",
                    };
                })}
            listVariant="cards"
            cancelText="Ga terug"
            confirmText="Toch verder gaan"
            onCancel={() => setShowEmptyBedsModal(false)}
            onConfirm={() => {
                setShowEmptyBedsModal(false);
                goToFinalisatie();
            }}
        />
    </>
    );
}