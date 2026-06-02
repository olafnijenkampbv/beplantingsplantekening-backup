"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { matchesSearchQuery } from "@/features/editor/lib/plantSelectionSearch";
import {
    usePlantSelectionStore,
    type PlantListItem,
} from "@/features/editor/state/plantSelectionStore";
import {
    usePlantVariantStore,
    type ApiPlantVariant,
} from "@/features/editor/state/plantVariantStore";
import type { ApiPlant } from "@/lib/db/plantTypes";

type DummyPlantSpecificationRow = {
    label: string;
    value: string;
    iconSrc: string;
};
import { APP_NOTIFICATIONS, useAppNotify } from "@/state/allNotifications";
import ConfirmModal from "@/features/editor/components/ConfirmModal";
import { goToPlantLinkingEditor } from "@/features/editor/lib/editorWorkflowNavigation";

// ---------------------------------------------------------------------------
// Helper: bouw plantspecificaties vanuit een ApiPlant
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helper: maatopties bouwen uit varianten
// ---------------------------------------------------------------------------

function buildSizeOptionsFromVariants(variants: ApiPlantVariant[]): string[] {
    if (variants.length === 0) return ["Geen maat geselecteerd"];
    return [
        "Geen maat geselecteerd",
        ...Array.from(new Set(variants.map((v) => v.sizeLabel))),
    ];
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
    searchText: "#898988",
};

const GREEN_ICON_FILTER =
    "brightness(0) saturate(100%) invert(36%) sepia(13%) saturate(707%) hue-rotate(56deg) brightness(92%) contrast(86%)";

const ORANGE_ICON_FILTER =
    "brightness(0) saturate(100%) invert(51%) sepia(84%) saturate(3601%) hue-rotate(6deg) brightness(95%) contrast(93%)";

const DRAG_SCROLL_EDGE_SIZE = 96;
const DRAG_SCROLL_MAX_SPEED = 18;
const DRAG_SCROLL_LIST_MARGIN = 24;

function formatPricePerPiece(price: number | undefined) {
    if (typeof price !== "number" || Number.isNaN(price)) {
        return "Prijs onbekend";
    }

    return `€${price.toFixed(2).replace(".", ",")} p/st`;
}

function PlantSpecificationInfoRow(props: DummyPlantSpecificationRow) {
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
    if (draggedItemId === targetItemId) {
        return list;
    }

    const draggedIndex = list.findIndex((item) => item.id === draggedItemId);
    const targetIndex = list.findIndex((item) => item.id === targetItemId);

    if (draggedIndex === -1 || targetIndex === -1) {
        return list;
    }

    const nextList = [...list];
    const [draggedItem] = nextList.splice(draggedIndex, 1);

    const targetIndexAfterRemoval = nextList.findIndex(
        (item) => item.id === targetItemId
    );

    if (targetIndexAfterRemoval === -1) {
        return list;
    }

    nextList.splice(targetIndexAfterRemoval + 1, 0, draggedItem);

    return nextList;
}

function movePlantListItemToTop(
    list: PlantListItem[],
    draggedItemId: string
) {
    const draggedIndex = list.findIndex((item) => item.id === draggedItemId);

    if (draggedIndex === -1) {
        return list;
    }

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

    useEffect(() => {
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
                className="flex h-[108px] items-start justify-between gap-3 overflow-hidden rounded-[4px] px-3 py-3 text-[14px]"
                style={{ color: COLORS.text }}
            >
                <span
                    className="min-w-0 flex-1 whitespace-normal leading-[1.35]"
                    style={{
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                    }}
                >
                    {value}
                </span>

                <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="shrink-0 cursor-pointer"
                    style={{ cursor: "pointer" }}
                >
                    <img
                        src="/icons/edit.svg"
                        alt=""
                        style={{
                            width: 16,
                            height: 16,
                            display: "block",
                            cursor: "pointer",
                        }}
                    />
                </button>
            </div>
        );
    }

    return (
        <div
            className="relative rounded-[4px] border bg-white"
            style={{
                height: 108,
                minHeight: 108,
                maxHeight: 108,
                borderColor: isFocused ? COLORS.orange : COLORS.borderSoft,
            }}
        >
            <textarea
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={handleSave}
                placeholder=""
                className="block h-full w-full resize-none overflow-hidden bg-transparent px-3 py-3 pr-10 text-[14px] leading-[1.35] outline-none"
                style={{
                    color: COLORS.text,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
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
                        style={{
                            width: 16,
                            height: 16,
                            display: "block",
                            cursor: "pointer",
                        }}
                    />
                </button>
            )}
        </div>
    );
}


export default function PlantSelectionListCard() {
    const items = usePlantSelectionStore((s) => s.plantListItems);
    const setPlantListItems = usePlantSelectionStore((s) => s.setPlantListItems);
    const notify = useAppNotify();
    const { getVariants, fetchVariants } = usePlantVariantStore();

    const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortValue, setSortValue] = useState("");
    const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
    const [dropAfterItemId, setDropAfterItemId] = useState<string | null>(null);
    const [isDroppingAtTop, setIsDroppingAtTop] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [openSpecificationItemIds, setOpenSpecificationItemIds] = useState<string[]>([]);
    const [showIncompleteSizeMessage, setShowIncompleteSizeMessage] = useState(false);

    const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const plantListDragBoundsRef = useRef<HTMLDivElement | null>(null);
    const dragPreviewNodeRef = useRef<HTMLDivElement | null>(null);
    const draggingItemIdRef = useRef<string | null>(null);
    const dragScrollAnimationFrameRef = useRef<number | null>(null);
    const dragScrollSpeedRef = useRef(0);
    const visibleItems = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        const compactQuery = normalizedQuery.replace(/\s+/g, "");

        let nextItems = items.filter((item) => {
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
        }

        return nextItems;
    }, [items, searchQuery, sortValue]);

    const firstVisibleItemId = visibleItems[0]?.id ?? null;

    const selectedCount = useMemo(() => {
        return items.filter((item) => item.isSelected).length;
    }, [items]);

    const selectedItems = useMemo(() => {
        return items.filter((item) => item.isSelected);
    }, [items]);

    const allSelected = items.length > 0 && items.every((item) => item.isSelected);

    const canLinkPlantsToDrawing =
        items.length > 0 &&
        items.every((item) => {
            const normalizedSize = item.size.trim().toLowerCase();
            return normalizedSize.length > 0 && normalizedSize !== "geen maat geselecteerd";
        });

    useEffect(() => {
        for (const item of items) {
            fetchVariants(item.plant.id);
        }
    }, [items, fetchVariants]);

    useEffect(() => {
        if (canLinkPlantsToDrawing) {
            setShowIncompleteSizeMessage(false);
        }
    }, [canLinkPlantsToDrawing]);

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

        window.scrollTo({
            top: nextScrollY,
            left: window.scrollX,
            behavior: "auto",
        });

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

    const updateItem = (itemId: string, updater: (item: PlantListItem) => PlantListItem) => {
        setPlantListItems(items.map((item) => (item.id === itemId ? updater(item) : item)));
    };

    const handleToggleSelectAll = () => {
        const nextSelectedState = !allSelected;

        setPlantListItems(
            items.map((item) => ({
                ...item,
                isSelected: nextSelectedState,
            }))
        );
    };

    const handleToggleRow = (itemId: string) => {
        updateItem(itemId, (item) => ({
            ...item,
            isSelected: !item.isSelected,
        }));
    };

    const handleRemoveSelected = () => {
        if (selectedItems.length === 0) return;
        setIsRemoveConfirmOpen(true);
    };

    const handleCancelRemoveSelected = () => {
        setIsRemoveConfirmOpen(false);
    };

    const handleConfirmRemoveSelected = () => {
        if (selectedItems.length === 0) {
            setIsRemoveConfirmOpen(false);
            return;
        }

        setPlantListItems(items.filter((item) => !item.isSelected));
        setIsRemoveConfirmOpen(false);

        if (selectedItems.length === 1) {
            notify(APP_NOTIFICATIONS.plantRemovedFromPlantList(selectedItems[0].plant.botanicalName));
            return;
        }

        notify(APP_NOTIFICATIONS.multiplePlantsRemovedFromPlantList());
    };

    const handleDuplicateSelected = () => {
        const selectedItems = items.filter((item) => item.isSelected);
        if (selectedItems.length === 0) return;

        const duplicatedItems = selectedItems.map((item) => ({
            ...item,
            id: `${item.id}-copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            isSelected: false,
        }));

        const clearedOriginalItems = items.map((item) => ({
            ...item,
            isSelected: false,
        }));

        setPlantListItems([...clearedOriginalItems, ...duplicatedItems]);

        if (selectedItems.length === 1) {
            notify(APP_NOTIFICATIONS.plantDuplicatedInPlantList(selectedItems[0].plant.botanicalName));
            return;
        }

        notify(APP_NOTIFICATIONS.multiplePlantsDuplicatedInPlantList());
    };

    const handleChangeSize = (itemId: string, value: string) => {
        updateItem(itemId, (item) => {
            // Zoek de geselecteerde variant op zodat we de exacte prijs kunnen opslaan
            const variants = getVariants(item.plant.id);
            const selectedVariant = variants.find((v) => v.sizeLabel === value) ?? null;
            return {
                ...item,
                size: value,
                plant: {
                    ...item.plant,
                    pricePerPiece: selectedVariant ? selectedVariant.price : item.plant.pricePerPiece,
                },
            };
        });
    };

    const handleChangeNote = (itemId: string, value: string) => {
        updateItem(itemId, (item) => ({
            ...item,
            note: value,
        }));
    };

    const handleTogglePlantSpecifications = (itemId: string) => {
        setOpenSpecificationItemIds((prev) =>
            prev.includes(itemId)
                ? prev.filter((id) => id !== itemId)
                : [...prev, itemId]
        );
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
        previewShell.style.opacity = "1";
        previewShell.style.overflow = "hidden";
        previewShell.style.transform = "scale(0.92)";
        previewShell.style.transformOrigin = "top left";

        const previewContent = rowNode.cloneNode(true) as HTMLDivElement;
        previewContent.style.margin = "0";
        previewContent.style.width = `${rowRect.width}px`;
        previewContent.style.height = `${rowRect.height}px`;
        previewContent.style.opacity = "1";
        previewContent.style.background = "#FFFFFF";
        previewContent.style.transform = "none";
        previewContent.style.filter = "none";

        previewContent
            .querySelectorAll<HTMLElement>("[data-plant-list-row-id]")
            .forEach((element) => {
                element.style.opacity = "1";
            });

        previewContent
            .querySelectorAll<
                HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
            >("button, input, select, textarea")
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

        const shouldDropAtTop =
            itemId === firstVisibleItemId && isUpperHalf;

        if (shouldDropAtTop) {
            if (!isDroppingAtTop) {
                setIsDroppingAtTop(true);
            }

            if (dropAfterItemId !== null) {
                setDropAfterItemId(null);
            }

            return;
        }

        if (isDroppingAtTop) {
            setIsDroppingAtTop(false);
        }

        if (dropAfterItemId !== itemId) {
            setDropAfterItemId(itemId);
        }
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

        const shouldDropAtTop =
            itemId === firstVisibleItemId && isUpperHalf;

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

    const renderCheckbox = (checked: boolean) => (
        <img
            src={checked ? "/icons/checkbox-checked.svg" : "/icons/checkbox-unchecked.svg"}
            alt=""
            style={{
                width: 20,
                height: 20,
                display: "block",
                flex: "0 0 auto",
            }}
        />
    );

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
                Plantenlijst
            </h2>

            <p
                className="mt-3 text-[14px]"
                style={{ color: COLORS.text }}
            >
                Aantallen en totaalprijs worden berekend zodra de planten aan plantvakken zijn gekoppeld. De planten koppel je aan de plantvakken in de volgende stap.
            </p>

            {items.length === 0 ? (
                <div
                    className="mt-5 h-px w-full"
                    style={{ backgroundColor: COLORS.border }}
                />
            ) : null}

            {items.length === 0 ? (
                <>
                    <div
                        className="flex min-h-[340px] items-center justify-center rounded-[6px]"
                        style={{ color: "#B0B0B0" }}
                    >
                        <span className="text-center text-[16px]">
                            Kies een plant of boom hierboven om de plantenlijst te vullen
                        </span>
                    </div>

                    <div
                        className="h-px w-full"
                        style={{ backgroundColor: COLORS.border }}
                    />

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            disabled
                            className="h-[48px] rounded-[6px] px-8 text-[15px] font-semibold text-white"
                            style={{
                                minWidth: 144,
                                backgroundColor: "#F4C8B8",
                                color: "#CC8D75",
                                cursor: "not-allowed",
                            }}
                        >
                            Koppel de planten in mijn tekening
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-wrap items-center gap-5">
                                <button
                                    type="button"
                                    onClick={handleToggleSelectAll}
                                    className="flex cursor-pointer items-center gap-2 text-[14px]"
                                    style={{ color: COLORS.text }}
                                >
                                    {renderCheckbox(allSelected)}
                                    <span>Selecteer alles</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleRemoveSelected}
                                    disabled={selectedCount === 0}
                                    className="flex items-center gap-2 text-[14px]"
                                    style={{
                                        color: COLORS.text,
                                        opacity: selectedCount === 0 ? 0.5 : 1,
                                        cursor: selectedCount === 0 ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <img
                                        src="/icons/delete-tool.svg"
                                        alt=""
                                        style={{
                                            width: 16,
                                            height: 16,
                                            display: "block",
                                        }}
                                    />
                                    <span>Verwijder ({selectedCount})</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleDuplicateSelected}
                                    disabled={selectedCount === 0}
                                    className="flex items-center gap-2 text-[14px]"
                                    style={{
                                        color: COLORS.text,
                                        opacity: selectedCount === 0 ? 0.5 : 1,
                                        cursor: selectedCount === 0 ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <img
                                        src="/icons/duplicate.svg"
                                        alt=""
                                        style={{
                                            width: 16,
                                            height: 16,
                                            display: "block",
                                        }}
                                    />
                                    <span>Dupliceren ({selectedCount})</span>
                                </button>
                            </div>

                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                <div
                                    className="flex h-[44px] min-w-[290px] items-center gap-3 rounded-[4px] px-4"
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
                                        style={{
                                            width: 18,
                                            height: 18,
                                            display: "block",
                                            opacity: 0.7,
                                        }}
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
                                    htmlFor="plant-list-sort"
                                    className="text-[14px]"
                                    style={{ color: COLORS.text }}
                                >
                                    Sorteren op
                                </label>

                                <div className="relative">
                                        <select
                                            id="plant-list-sort"
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
                        </div>
                    </div>

                        <div ref={plantListDragBoundsRef} className="mt-6 overflow-x-auto">
                            <div className="min-w-[1240px]">
                                <div
                                    className="grid items-center gap-4 pb-4 text-[15px] font-semibold"
                                    style={{
                                        gridTemplateColumns: "32px 108px minmax(220px,1fr) minmax(230px,0.9fr) minmax(180px,0.75fr) minmax(110px,0.35fr) 44px",
                                        color: COLORS.text,
                                    }}
                                >
                                    <div />
                                    <div>Product</div>
                                    <div>Plantnaam</div>
                                    <div>Maatvoering</div>
                                    <div>Notitie</div>
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
                                                Laat hier los om "{draggingItem.plant.botanicalName}" hierheen te verplaatsen
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

                                    const isSpecificationsOpen = openSpecificationItemIds.includes(item.id);

                                    return (
                                        <div key={item.id}>
                                            {(() => {
                                                const isSpecificationsOpen = openSpecificationItemIds.includes(item.id);
                                                const specificationColumns =
                                                    buildSpecificationsFromApiPlant(item.plant);
                                                const variants = getVariants(item.plant.id);
                                                const sizeOptions = buildSizeOptionsFromVariants(variants);
                                                const selectedVariant =
                                                    item.size && item.size !== "Geen maat geselecteerd"
                                                        ? variants.find((v) => v.sizeLabel === item.size) ?? null
                                                        : null;

                                                return (
                                                    <>
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
                                                                onDragOver={(event) => handleDragOverRow(event, item.id)}
                                                                onDrop={(event) => handleDropRow(event, item.id)}
                                                                className="grid items-start gap-4 px-3 py-4"
                                                                style={{
                                                                    gridTemplateColumns:
                                                                        "32px 108px minmax(220px,1fr) minmax(230px,0.9fr) minmax(180px,0.75fr) minmax(110px,0.35fr) 44px",
                                                                    opacity: isDragging ? 0.3 : 1,
                                                                    transition: "opacity 160ms ease",
                                                                }}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleRow(item.id)}
                                                                    className="mt-9 flex cursor-pointer justify-center"
                                                                >
                                                                    {renderCheckbox(item.isSelected)}
                                                                </button>

                                                                <div className="pt-1">
                                                                    <div
                                                                        className="overflow-hidden rounded-[2px]"
                                                                        style={{
                                                                            width: 108,
                                                                            height: 108,
                                                                            backgroundColor: "#F1F1EE",
                                                                        }}
                                                                    >
                                                                        <img
                                                                            src={item.plant.imageUrl || "/images/logo.png"}
                                                                            alt={item.plant.botanicalName}
                                                                            className="block h-full w-full"
                                                                            style={item.plant.imageUrl ? {
                                                                                objectFit: "cover",
                                                                                objectPosition: "center",
                                                                            } : {
                                                                                objectFit: "contain",
                                                                                objectPosition: "center",
                                                                                padding: "20%",
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>

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
                                                                            style={{ color: COLORS.text }}
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

                                                                <div className="pt-2">
                                                                    {item.fixedSize ? (
                                                                        <div
                                                                            className="flex h-[44px] items-center text-[14px]"
                                                                            style={{ color: COLORS.text }}
                                                                        >
                                                                            {item.size || "—"}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="relative">
                                                                            <select
                                                                                value={item.size}
                                                                                onChange={(event) =>
                                                                                    handleChangeSize(
                                                                                        item.id,
                                                                                        event.target.value
                                                                                    )
                                                                                }
                                                                                className="h-[44px] w-full appearance-none rounded-[4px] border bg-white pl-3 pr-10 text-[14px] outline-none"
                                                                                style={{
                                                                                    borderColor: COLORS.borderSoft,
                                                                                    color: COLORS.text,
                                                                                    cursor: "pointer",
                                                                                }}
                                                                            >
                                                                                {sizeOptions.map((option, i) => (
                                                                                    <option
                                                                                        key={`${i}-${option}`}
                                                                                        value={option}
                                                                                    >
                                                                                        {option}
                                                                                    </option>
                                                                                ))}
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
                                                                    )}
                                                                </div>

                                                                <div className="pt-2 self-stretch">
                                                                    <ProductRowNote
                                                                        value={item.note}
                                                                        onSave={(value) =>
                                                                            handleChangeNote(item.id, value)
                                                                        }
                                                                    />
                                                                </div>

                                                                <div
                                                                    className="pt-2 text-[13px] leading-[1.35]"
                                                                    style={{ color: "#FF0000" }}
                                                                >
                                                                    {selectedVariant
                                                                        ? formatPricePerPiece(selectedVariant.price)
                                                                        : item.fixedSize && item.plant.pricePerPiece
                                                                            ? formatPricePerPiece(item.plant.pricePerPiece)
                                                                            : null}
                                                                </div>

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
                                                                            cursor: isDragging
                                                                                ? "grabbing"
                                                                                : "grab",
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
                                                                            gridTemplateColumns:
                                                                                "32px 108px minmax(220px,1fr) minmax(260px,1fr) minmax(180px,0.9fr) 44px",
                                                                        }}
                                                                    >
                                                                        <div
                                                                            style={{
                                                                                gridColumn: "2 / 6",
                                                                            }}
                                                                        >
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
                                                                        Laat hier los om "
                                                                        {draggingItem?.plant.botanicalName}" hierheen te
                                                                        verplaatsen
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : null}

                                                        <div
                                                            className="h-px w-full"
                                                            style={{
                                                                backgroundColor: COLORS.borderSoft,
                                                            }}
                                                        />
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                        <div className="mt-4 flex items-end justify-between gap-4">
                            <div
                                className="text-[14px]"
                                style={{
                                    color: COLORS.orange,
                                    
                                    fontStyle: "italic",
                                    opacity: showIncompleteSizeMessage ? 1 : 0,
                                    transition: "opacity 160ms ease",
                                    pointerEvents: "none",
                                }}
                            >
                                *Vul eerst alle maten in voordat je de planten kunt koppelen aan je tekening
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    if (!canLinkPlantsToDrawing) {
                                        setShowIncompleteSizeMessage(true);
                                        return;
                                    }

                                    setShowIncompleteSizeMessage(false);
                                    goToPlantLinkingEditor();
                                }}
                                className="h-[48px] rounded-[6px] px-8 text-[15px] font-semibold text-white"
                                style={{
                                    minWidth: 144,
                                    backgroundColor: canLinkPlantsToDrawing ? COLORS.orange : "#F4C8B8",
                                    color: canLinkPlantsToDrawing ? "#FFFFFF" : "#CC8D75",
                                    cursor: canLinkPlantsToDrawing ? "pointer" : "not-allowed",
                                }}
                                aria-disabled={!canLinkPlantsToDrawing}
                            >
                                Koppel de planten in mijn tekening
                            </button>
                        </div>
                </>
            )}
            <ConfirmModal
                open={isRemoveConfirmOpen}
                title={selectedItems.length === 1 ? "Product regel verwijderen" : "Product regels verwijderen"}
                description={
                    selectedItems.length === 1
                        ? "Weet je zeker dat je deze regel wilt verwijderen?"
                        : "Weet je zeker dat je deze regels wilt verwijderen?"
                }
                cancelText="Nee, ga terug"
                confirmText="Ja, verwijder"
                onCancel={handleCancelRemoveSelected}
                onConfirm={handleConfirmRemoveSelected}
            />
        </section>
    );
}