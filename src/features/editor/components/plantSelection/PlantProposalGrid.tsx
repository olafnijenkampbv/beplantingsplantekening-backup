"use client";

import React, { useEffect, useMemo, useState } from "react";
import { APP_NOTIFICATIONS, useAppNotify } from "@/state/allNotifications";
import type { PlantSelectionFiltersState } from "@/features/editor/state/plantSelectionStore";
import type {
    DummyPlant,
    PlantGroupKey,
    PlantSelectionAdvancedArrayFilterKey,
    PlantSelectionAdvancedFilters,
    ViewMode,
} from "@/features/editor/lib/plantSelectionDummyData";
import { getDummyPlantSearchCardDataForPlant } from "@/features/editor/lib/plantSelectionDummyData";
import {
    matchesPlantSizeSearch,
    matchesSearchQuery,
} from "@/features/editor/lib/plantSelectionSearch";

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    green: "#58694C",
    greenLight: "#EEF0ED",
    orange: "#E94E1B",
    text: "#111111",
    muted: "#6B7280",
};

const INITIAL_VISIBLE_COUNT = 6;
const LOAD_MORE_STEP = 6;

const GREEN_ICON_FILTER =
    "brightness(0) saturate(100%) invert(36%) sepia(13%) saturate(707%) hue-rotate(56deg) brightness(92%) contrast(86%)";

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

function PlantTypeBadge(props: { label: string }) {
    const { label } = props;

    const meta =
        label === "Vaste plant"
            ? { backgroundColor: "#EEF0ED", color: "#58694C" }
            : label === "Bodembedekker"
                ? { backgroundColor: "#E0DED4", color: "#58694C" }
                : label === "Heesters & struiken"
                    ? { backgroundColor: "#58694C", color: "#FFFFFF" }
                    : { backgroundColor: "#FDF2E0", color: "#58694C" };

    return (
        <span
            className="inline-flex items-center rounded-[4px] px-3 py-[5px] text-[11px] font-semibold"
            style={meta}
        >
            {label}
        </span>
    );
}

function formatPricePerPiece(price: number) {
    return `€${price.toFixed(2).replace(".", ",")} p/st`;
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
    plant: DummyPlant;
    onAddToPlantList: (plant: DummyPlant) => void;
}) {
    const { plant, onAddToPlantList } = props;
    const notify = useAppNotify();
    const [isAdded, setIsAdded] = useState(false);
    const cardData = getDummyPlantSearchCardDataForPlant(plant);

    const handleAddToPlantList = () => {
        onAddToPlantList(plant);
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(plant.name));
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
                <img
                    src={plant.imageSrc}
                    alt={cardData.botanicalName}
                    className="block h-full w-full"
                    style={{
                        objectFit: "cover",
                        objectPosition: "center",
                    }}
                />

                <div className="absolute right-2 top-2">
                    <AvailabilityBadge stockLabel={cardData.stockLabel} />
                </div>
            </div>

            <div className="flex min-h-[132px] flex-col p-3">
                <div
                    className="text-[15px] font-semibold leading-[1.35]"
                    style={{ color: COLORS.text }}
                >
                    {cardData.botanicalName}
                </div>

                <div
                    className="mt-1 text-[13px] leading-[1.35]"
                    style={{ color: COLORS.muted }}
                >
                    {cardData.dutchName}
                </div>

                <div
                    className="mt-3 text-[12px] leading-[1.35]"
                    style={{ color: COLORS.text }}
                >
                    {cardData.sizeLabel}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                    {cardData.plantGroupBadges.map((badge) => (
                        <PlantTypeBadge key={badge} label={badge} />
                    ))}
                </div>

                <div className="mt-3 text-[13px]" style={{ color: "#FF0000" }}>
                    {formatPricePerPiece(plant.pricePerPiece)}
                </div>

                <div className="mt-1 flex items-end justify-between gap-3">
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 text-[12px] underline"
                        style={{ color: COLORS.green }}
                    >
                        <span>Meer informatie</span>
                        <img
                            src="/icons/arrow-right.svg"
                            alt=""
                            style={{
                                width: 12,
                                height: 12,
                                display: "block",
                                filter: GREEN_ICON_FILTER,
                            }}
                        />
                    </button>

                    <button
                        type="button"
                        onClick={handleAddToPlantList}
                        className="flex shrink-0 cursor-pointer items-center justify-center rounded-[6px]"
                        style={{
                            width: 40,
                            height: 40,
                            backgroundColor: isAdded ? "#008000" : COLORS.orange,
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
    );
}

function SearchModeListCard(props: {
    plant: DummyPlant;
    onAddToPlantList: (plant: DummyPlant) => void;
}) {
    const { plant, onAddToPlantList } = props;
    const notify = useAppNotify();
    const [isAdded, setIsAdded] = useState(false);
    const cardData = getDummyPlantSearchCardDataForPlant(plant);

    const handleAddToPlantList = () => {
        onAddToPlantList(plant);
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(plant.name));
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
                <img
                    src={plant.imageSrc}
                    alt={cardData.botanicalName}
                    className="block h-full w-full"
                    style={{
                        objectFit: "cover",
                        objectPosition: "center",
                    }}
                />
            </div>

            <div className="flex min-w-0 flex-1 items-stretch justify-between gap-6">
                <div className="flex min-w-0 flex-1 flex-col">
                    <div
                        className="text-[18px] font-semibold leading-[1.35]"
                        style={{ color: COLORS.text }}
                    >
                        {cardData.botanicalName}
                    </div>

                    <div
                        className="mt-1 text-[14px] leading-[1.35]"
                        style={{ color: COLORS.muted }}
                    >
                        {cardData.dutchName}
                    </div>

                    <div
                        className="mt-4 text-[13px] leading-[1.35]"
                        style={{ color: COLORS.text }}
                    >
                        {cardData.sizeLabel}
                    </div>

                    <div className="mt-2 text-[13px]" style={{ color: "#FF0000" }}>
                        {formatPricePerPiece(plant.pricePerPiece)}
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                        {cardData.plantGroupBadges.map((badge) => (
                            <PlantTypeBadge key={badge} label={badge} />
                        ))}
                    </div>
                </div>

                <div className="flex shrink-0 flex-col items-start justify-center gap-4">
                    <AvailabilityBadge stockLabel={cardData.stockLabel} />

                    <button
                        type="button"
                        onClick={handleAddToPlantList}
                        className="flex cursor-pointer items-center gap-2 rounded-[6px] px-4"
                        style={{
                            height: 44,
                            backgroundColor: isAdded ? "#008000" : COLORS.orange,
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

                    <button
                        type="button"
                        className="inline-flex items-center gap-2 text-[12px] underline"
                        style={{ color: COLORS.green }}
                    >
                        <span>Meer informatie</span>
                        <img
                            src="/icons/arrow-right.svg"
                            alt=""
                            style={{
                                width: 12,
                                height: 12,
                                display: "block",
                                filter: GREEN_ICON_FILTER,
                            }}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
}

function DefaultPlantCard(props: {
    plant: DummyPlant;
    viewMode: ViewMode;
    onAddToPlantList: (plant: DummyPlant) => void;
}) {
    const { plant, viewMode, onAddToPlantList } = props;
    const notify = useAppNotify();
    const [isAdded, setIsAdded] = useState(false);

    const handleAddToPlantList = () => {
        onAddToPlantList(plant);
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(plant.name));
        setIsAdded(true);

        window.setTimeout(() => {
            setIsAdded(false);
        }, 3200);
    };

    if (viewMode === "list") {
        return (
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
                    className="shrink-0 overflow-hidden rounded-[6px] bg-[#F1F1EE]"
                    style={{
                        width: 140,
                        height: 140,
                    }}
                >
                    <img
                        src={plant.imageSrc}
                        alt={plant.name}
                        className="block h-full w-full"
                        style={{
                            objectFit: "cover",
                            objectPosition: "center",
                        }}
                    />
                </div>

                <div className="flex min-w-0 flex-1 items-stretch justify-between gap-4">
                    <div className="flex min-w-0 flex-1 flex-col">
                        <div
                            className="text-[16px] font-semibold leading-[1.35]"
                            style={{ color: COLORS.text }}
                        >
                            {plant.name}
                        </div>

                        <div
                            className="mt-1 text-[13px]"
                            style={{ color: COLORS.muted }}
                        >
                            {plant.latinName}
                        </div>

                        <div
                            className="mt-3 text-[13px]"
                            style={{ color: "#FF0000" }}
                        >
                            {formatPricePerPiece(plant.pricePerPiece)}
                        </div>

                        <div
                            className="mt-auto text-[12px]"
                            style={{ color: COLORS.orange }}
                        >
                            {plant.stockLabel}
                        </div>
                    </div>

                    <div className="flex shrink-0 items-end">
                        <button
                            type="button"
                            className="flex cursor-pointer items-center gap-2 rounded-[6px] px-4"
                            style={{
                                height: 44,
                                backgroundColor: isAdded ? "#008000" : COLORS.orange,
                                color: "#FFFFFF",
                                transition: "background-color 220ms ease, transform 220ms ease",
                                transform: isAdded ? "scale(1.03)" : "scale(1)",
                            }}
                            onClick={handleAddToPlantList}
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
        );
    }

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
                className="overflow-hidden bg-[#F1F1EE]"
                style={{
                    aspectRatio: "1 / 0.82",
                }}
            >
                <img
                    src={plant.imageSrc}
                    alt={plant.name}
                    className="block h-full w-full"
                    style={{
                        objectFit: "cover",
                        objectPosition: "center",
                    }}
                />
            </div>

            <div className="p-3">
                <div
                    className="text-[15px] font-semibold leading-[1.2]"
                    style={{ color: COLORS.text }}
                >
                    {plant.name}
                </div>

                <div className="mt-[2px] text-[13px]" style={{ color: COLORS.muted }}>
                    {plant.latinName}
                </div>

                <div className="mt-3 text-[13px]" style={{ color: "#FF0000" }}>
                    {formatPricePerPiece(plant.pricePerPiece)}
                </div>

                <div className="mt-2 flex items-center justify-between">
                    <div className="text-[12px]" style={{ color: COLORS.orange }}>
                        {plant.stockLabel}
                    </div>

                    <button
                        type="button"
                        className="flex shrink-0 cursor-pointer items-center justify-center rounded-[6px]"
                        style={{
                            width: 40,
                            height: 40,
                            backgroundColor: isAdded ? "#008000" : COLORS.orange,
                            transition: "background-color 220ms ease, transform 220ms ease",
                            transform: isAdded ? "scale(1.06)" : "scale(1)",
                        }}
                        onClick={handleAddToPlantList}
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
    );
}

type PlantProposalGridProps = {
    title: string;
    resultsCount: number;
    plants: DummyPlant[];
    viewMode: ViewMode;
    sortValue: string;
    selectedGroup: PlantGroupKey;
    filters: PlantSelectionFiltersState;
    advancedFilters: PlantSelectionAdvancedFilters;
    onChangeSort: (value: string) => void;
    onChangeViewMode: (mode: ViewMode) => void;
    onAddToPlantList: (plant: DummyPlant) => void;
    onRemoveFilterChip: (
        key: PlantSelectionAdvancedArrayFilterKey | keyof PlantSelectionFiltersState,
        value?: string
    ) => void;
    onClearAllFilters: () => void;
};

export default function PlantProposalGrid(props: PlantProposalGridProps) {
    const {
        title,
        resultsCount,
        plants,
        viewMode,
        sortValue,
        selectedGroup,
        filters,
        advancedFilters,
        onChangeSort,
        onChangeViewMode,
        onAddToPlantList,
        onRemoveFilterChip,
        onClearAllFilters,
    } = props;

    const isSearchMode = selectedGroup === "zoek-zelf";
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
    const [plantNameQuery, setPlantNameQuery] = useState("");
    const [sizeQuery, setSizeQuery] = useState("");
    const [isPlantNameSearchFocused, setIsPlantNameSearchFocused] = useState(false);
    const [isSizeSearchFocused, setIsSizeSearchFocused] = useState(false);

    useEffect(() => {
        setVisibleCount(INITIAL_VISIBLE_COUNT);
    }, [plants, title, viewMode, sortValue, plantNameQuery, sizeQuery, filters, advancedFilters]);

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

        return nextChips;
    }, [advancedFilters, filters.inheems, filters.opVoorraad]);

    const hasActiveFilterChips = chips.length > 0;

    const shouldShowSearchPlaceholder =
        isSearchMode &&
        plantNameQuery.trim().length < 2 &&
        sizeQuery.trim().length < 2 &&
        !hasActiveFilterChips;

    const filteredPlants = useMemo(() => {
        if (!isSearchMode) {
            return plants;
        }

        const normalizedPlantNameQuery = plantNameQuery.trim();
        const normalizedSizeQuery = sizeQuery.trim();

        const hasEnoughPlantNameInput = normalizedPlantNameQuery.length >= 2;
        const hasEnoughSizeInput = normalizedSizeQuery.length >= 2;

        if (!hasEnoughPlantNameInput && !hasEnoughSizeInput && !hasActiveFilterChips) {
            return [];
        }

        return plants.filter((plant) => {
            const cardData = getDummyPlantSearchCardDataForPlant(plant);

            const matchesPlantName =
                !normalizedPlantNameQuery ||
                matchesSearchQuery(cardData.botanicalName, normalizedPlantNameQuery) ||
                matchesSearchQuery(cardData.dutchName, normalizedPlantNameQuery);

            const matchesSize =
                !normalizedSizeQuery ||
                matchesPlantSizeSearch(cardData.sizeLabel, normalizedSizeQuery);

            return matchesPlantName && matchesSize;
        });
    }, [hasActiveFilterChips, isSearchMode, plantNameQuery, plants, sizeQuery]);

    const visiblePlants = useMemo(() => {
        return filteredPlants.slice(0, visibleCount);
    }, [filteredPlants, visibleCount]);

    const effectiveResultsCount = isSearchMode ? filteredPlants.length : resultsCount;
    const remainingCount = Math.max(0, filteredPlants.length - visiblePlants.length);
    const canLoadMore = remainingCount > 0;
    const canLoadLess =
        filteredPlants.length > INITIAL_VISIBLE_COUNT &&
        visibleCount > INITIAL_VISIBLE_COUNT;

    const handleLoadMore = () => {
        setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, filteredPlants.length));
    };

    const handleLoadLess = () => {
        setVisibleCount(INITIAL_VISIBLE_COUNT);
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
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
                            : "In de plantenlijst bepaal je de aantallen en maten voor je definitieve plan."}
                    </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                        <label
                            htmlFor="plant-sort"
                            className="text-[14px] font-normal"
                            style={{ color: COLORS.text }}
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
                                {isSearchMode ? null : (
                                    <option value="meest-geschikt">Meest geschikt</option>
                                )}
                                <option value="alfabetisch-a-z">Naam (A-Z)</option>
                                <option value="alfabetisch-z-a">Naam (Z-A)</option>
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
                                className="text-[14px] font-semibold underline"
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
                    <div
                        className={
                            viewMode === "grid"
                                ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                                : "space-y-4"
                        }
                    >
                        {visiblePlants.map((plant) =>
                            isSearchMode ? (
                                viewMode === "grid" ? (
                                    <SearchModeGridCard
                                        key={plant.id}
                                        plant={plant}
                                        onAddToPlantList={onAddToPlantList}
                                    />
                                ) : (
                                    <SearchModeListCard
                                        key={plant.id}
                                        plant={plant}
                                        onAddToPlantList={onAddToPlantList}
                                    />
                                )
                            ) : (
                                <DefaultPlantCard
                                    key={plant.id}
                                    plant={plant}
                                    viewMode={viewMode}
                                    onAddToPlantList={onAddToPlantList}
                                />
                            )
                        )}
                    </div>
                </div>
            ) : null}

            {canLoadMore ? (
                <div className="mt-6 flex justify-center">
                    <button
                        type="button"
                        onClick={handleLoadMore}
                        className="cursor-pointer text-[14px] font-medium underline"
                        style={{ color: COLORS.green }}
                    >
                        Meer laden ({remainingCount})
                    </button>
                </div>
            ) : canLoadLess ? (
                <div className="mt-6 flex justify-center">
                    <button
                        type="button"
                        onClick={handleLoadLess}
                        className="cursor-pointer text-[14px] font-medium underline"
                        style={{ color: COLORS.green }}
                    >
                        Minder laden
                    </button>
                </div>
            ) : null}
        </section>
    );
}