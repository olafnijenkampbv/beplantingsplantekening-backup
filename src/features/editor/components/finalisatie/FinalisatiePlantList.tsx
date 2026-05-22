"use client";

import React, { useMemo, useState } from "react";
import { getDummyPlantSpecificationsForPlant } from "@/features/editor/lib/plantSelectionDummyData";
import { matchesSearchQuery } from "@/features/editor/lib/plantSelectionSearch";
import {
    usePlantSelectionStore,
    type PlantListItem,
} from "@/features/editor/state/plantSelectionStore";
import { useProjectStore } from "@/state/projectStore";
import { buildAdviceData } from "@/features/editor/lib/plantAdvice";
import type { PolyObject } from "@/state/projectStore";
import PlantSpecificationsPanel from "@/features/editor/components/finalisatie/FinalisatiePlantSpecificationsPanel";

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

function formatPricePerPiece(price: number | undefined) {
    if (typeof price !== "number" || Number.isNaN(price)) {
        return "Prijs onbekend";
    }
    return `€${price.toFixed(2).replace(".", ",")} p/st`;
}

function formatTotalPrice(price: number) {
    return `€${price.toFixed(2).replace(".", ",")}`;
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
                style={{ color: COLORS.text, minHeight: 44 }}
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
                minHeight: 44,
                borderColor: isFocused ? COLORS.orange : COLORS.borderSoft,
            }}
        >
            <textarea
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={handleSave}
                placeholder="Notitie toevoegen..."
                className="block h-full w-full resize-none bg-transparent px-3 py-2 pr-10 text-[14px] leading-[1.35] outline-none"
                style={{
                    color: COLORS.text,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    minHeight: 44,
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

type ObjectLinkGroup = {
    typeLabel: string;
    labels: string[];
};

function buildLinkGroups(
    plantId: string,
    plantbedLinks: Record<string, string[]>,
    objects: PolyObject[]
): ObjectLinkGroup[] {
    const plantbedLabels: string[] = [];
    const hedgeLabels: string[] = [];
    const treebedLabels: string[] = [];

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

        if (object.type === "hedge") {
            hedgeLabels.push(label);
        } else if (object.type === "treebed") {
            treebedLabels.push(label);
        } else {
            plantbedLabels.push(label);
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

export default function FinalisatiePlantList() {
    const items = usePlantSelectionStore((s) => s.plantListItems);
    const setPlantListItems = usePlantSelectionStore((s) => s.setPlantListItems);

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
    const plants = useProjectStore(
        (s: { plants: import("@/features/editor/lib/plantAdvice").ProjectPlantLike[] }) =>
            s.plants
    );

    const [searchQuery, setSearchQuery] = useState("");
    const [sortValue, setSortValue] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [openSpecificationItemIds, setOpenSpecificationItemIds] = useState<string[]>([]);

    const visibleItems = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        let nextItems = items.filter((item) => {
            if (!normalizedQuery) return true;
            return (
                matchesSearchQuery(item.plant.name, normalizedQuery) ||
                matchesSearchQuery(item.plant.latinName, normalizedQuery)
            );
        });

        if (sortValue === "naam-a-z") {
            nextItems = [...nextItems].sort((a, b) =>
                a.plant.name.localeCompare(b.plant.name)
            );
        } else if (sortValue === "naam-z-a") {
            nextItems = [...nextItems].sort((a, b) =>
                b.plant.name.localeCompare(a.plant.name)
            );
        }

        return nextItems;
    }, [items, searchQuery, sortValue]);

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

    const handleTogglePlantSpecifications = (itemId: string) => {
        setOpenSpecificationItemIds((prev) =>
            prev.includes(itemId)
                ? prev.filter((id) => id !== itemId)
                : [...prev, itemId]
        );
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
                Pas hier je definitieve aantallen aan voor jou definitieve plantenlijst.
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
                    <div className="mt-6 flex items-center justify-between gap-4">
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

                    <div className="mt-6 overflow-x-auto">
                        <div className="min-w-[1100px]">
                            <div
                                className="grid items-center gap-4 pb-4 text-[15px] font-semibold"
                                style={{
                                    gridTemplateColumns:
                                        "108px minmax(200px,1fr) minmax(120px,0.5fr) minmax(160px,0.7fr) minmax(160px,0.7fr) minmax(120px,0.5fr) minmax(130px,0.5fr)",
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
                            </div>

                            <div
                                className="h-px w-full"
                                style={{ backgroundColor: COLORS.borderSoft }}
                            />

                            {visibleItems.map((item) => {
                                const isSpecificationsOpen =
                                    openSpecificationItemIds.includes(item.id);
                                const specificationColumns =
                                    getDummyPlantSpecificationsForPlant(item.plant);

                                const linkGroups = buildLinkGroups(
                                    item.plant.id,
                                    plantbedLinks,
                                    objects
                                );

                                const adviceCount = buildTotalAdviceCount(
                                    item.plant.id,
                                    plantbedLinks,
                                    objects,
                                    plants,
                                    distributionOverrides
                                );

                                const effectiveCount =
                                    item.quantity > 0 ? item.quantity : adviceCount;

                                const totalPrice =
                                    effectiveCount * (item.plant.pricePerPiece ?? 0);

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
                                                className="grid items-start gap-4 px-3 py-4"
                                                style={{
                                                    gridTemplateColumns:
                                                        "108px minmax(200px,1fr) minmax(120px,0.5fr) minmax(160px,0.7fr) minmax(160px,0.7fr) minmax(120px,0.5fr) minmax(130px,0.5fr)",
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
                                                        <img
                                                            src={item.plant.imageSrc}
                                                            alt={item.plant.name}
                                                            className="block h-full w-full"
                                                            style={{
                                                                objectFit: "cover",
                                                                objectPosition: "center",
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Plantnaam + specificaties link */}
                                                <div className="flex min-h-[108px] flex-col pt-1">
                                                    <div
                                                        className="text-[15px] font-semibold leading-[1.35]"
                                                        style={{ color: COLORS.text }}
                                                    >
                                                        {item.plant.name}
                                                    </div>
                                                    <div
                                                        className="mt-1 text-[14px] leading-[1.35]"
                                                        style={{ color: COLORS.muted }}
                                                    >
                                                        {item.plant.latinName}
                                                    </div>
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
                                                </div>

                                                {/* Maatvoering vast */}
                                                <div
                                                    className="pt-2 text-[14px]"
                                                    style={{ color: COLORS.text }}
                                                >
                                                    {item.size || "—"}
                                                </div>

                                                {/* Gekoppeld aan */}
                                                <div className="flex flex-col gap-2 pt-1">
                                                    {linkGroups.length === 0 ? (
                                                        <span
                                                            className="text-[13px]"
                                                            style={{ color: COLORS.softText }}
                                                        >
                                                            Niet gekoppeld
                                                        </span>
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
                                                                    {group.labels.map((label) => (
                                                                        <span
                                                                            key={label}
                                                                            className="inline-flex items-center rounded-[4px] px-2 py-0.5 text-[12px] font-semibold"
                                                                            style={{
                                                                                backgroundColor:
                                                                                    "#EEF0ED",
                                                                                color: COLORS.green,
                                                                            }}
                                                                        >
                                                                            {label}
                                                                        </span>
                                                                    ))}
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
                                                <div className="flex flex-col gap-1 pt-1">
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
                                                            placeholder={String(adviceCount)}
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
                                                    <span
                                                        className="text-[12px]"
                                                        style={{ color: COLORS.softText }}
                                                    >
                                                        Advies: {adviceCount} st.
                                                    </span>
                                                </div>

                                                {/* Prijs */}
                                                <div className="flex flex-col gap-1 pt-1">
                                                    <span
                                                        className="text-[13px]"
                                                        style={{ color: "#FF0000" }}
                                                    >
                                                        {formatPricePerPiece(
                                                            item.plant.pricePerPiece
                                                        )}
                                                    </span>
                                                    <span
                                                        className="text-[14px] font-bold"
                                                        style={{ color: "#FF0000" }}
                                                    >
                                                        {formatTotalPrice(totalPrice)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {isSpecificationsOpen ? (
                                            <div className="px-3 pb-3">
                                                <div
                                                    className="grid gap-4"
                                                    style={{
                                                        gridTemplateColumns:
                                                            "108px minmax(200px,1fr)",
                                                    }}
                                                >
                                                    <div style={{ gridColumn: "2 / 3" }}>
                                                        <PlantSpecificationsPanel
                                                            leftColumn={
                                                                specificationColumns.leftColumn
                                                            }
                                                            rightColumn={
                                                                specificationColumns.rightColumn
                                                            }
                                                        />
                                                    </div>
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
        </section>
    );
}