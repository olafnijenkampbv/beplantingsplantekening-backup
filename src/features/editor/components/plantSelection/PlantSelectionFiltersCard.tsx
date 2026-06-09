"use client";

import React, { useMemo, useState } from "react";
import type { PlantSelectionFiltersState } from "@/features/editor/state/plantSelectionStore";
import type {
    PlantSelectionAdvancedArrayFilterKey,
    PlantSelectionAdvancedFilters,
} from "@/features/editor/lib/plantSelectionDummyData";
import {
    PLANT_SELECTION_BLOEIPERIODE_OPTIONS,
    PLANT_SELECTION_COLOR_OPTIONS,
    PLANT_SELECTION_GRONDSOORT_OPTIONS,
    PLANT_SELECTION_KEURMERK_OPTIONS,
    PLANT_SELECTION_PLANTGROUP_OPTIONS,
    PLANT_SELECTION_STANDPLAATS_OPTIONS,
    getVisiblePlantSelectionFilterSections,
} from "@/features/editor/lib/plantSelectionDummyData";

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    green: "#58694C",
    text: "#111111",
    softButtonBg: "#F8F7F6",
};

function ToggleRow(props: {
    label: string;
    checked: boolean;
    onClick: () => void;
}) {
    const { label, checked, onClick } = props;

    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full cursor-pointer items-center justify-between rounded-[6px] px-4 py-3 text-left"
            style={{
                backgroundColor: COLORS.softButtonBg,
                border: "none",
            }}
        >
            <span
                className="text-[14px] font-semibold"
                style={{ color: COLORS.text }}
            >
                {label}
            </span>

            <span
                className="relative inline-flex items-center rounded-full"
                style={{
                    width: 36,
                    height: 20,
                    backgroundColor: checked ? "#E94E1B" : "#B9B7B8",
                    transition: "background-color 120ms ease",
                }}
            >
                <span
                    className="absolute rounded-full bg-white"
                    style={{
                        width: 18,
                        height: 18,
                        left: checked ? 17 : 1,
                        transition: "left 120ms ease",
                    }}
                />
            </span>
        </button>
    );
}

function ExpandableFilterRow(props: {
    label: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    const { label, isOpen, onToggle, children } = props;

    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full cursor-pointer items-center justify-between rounded-[6px] px-4 py-3 text-left"
                style={{
                    backgroundColor: COLORS.softButtonBg,
                    border: "none",
                }}
            >
                <span
                    className="text-[14px] font-semibold"
                    style={{ color: COLORS.text }}
                >
                    {label}
                </span>

                <img
                    src={isOpen ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
                    alt=""
                    style={{
                        width: 16,
                        height: 16,
                        display: "block",
                    }}
                />
            </button>

            {isOpen ? <div className="px-1 pt-3">{children}</div> : null}
        </div>
    );
}

function CheckboxOptionRow(props: {
    label: string;
    checked: boolean;
    onClick: () => void;
}) {
    const { label, checked, onClick } = props;

    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full cursor-pointer items-center gap-3 py-1.5 text-left"
            style={{ background: "transparent", border: "none" }}
        >
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

            <span
                className="text-[14px] font-normal"
                style={{ color: COLORS.text }}
            >
                {label}
            </span>
        </button>
    );
}

type ExpandableFilterState = Record<PlantSelectionAdvancedArrayFilterKey, boolean>;

type PlantSelectionFiltersCardProps = {
    filters: PlantSelectionFiltersState;
    advancedFilters: PlantSelectionAdvancedFilters;
    isSearchMode: boolean;
    onToggleFilter: (key: keyof PlantSelectionFiltersState) => void;
    onToggleAdvancedFilter: (
        key: PlantSelectionAdvancedArrayFilterKey,
        value: string
    ) => void;
    onClearFilters: () => void;
};

export default function PlantSelectionFiltersCard(props: PlantSelectionFiltersCardProps) {
    const {
        filters,
        advancedFilters,
        isSearchMode,
        onToggleFilter,
        onToggleAdvancedFilter,
        onClearFilters,
    } = props;

    const [openSections, setOpenSections] = useState<ExpandableFilterState>({
        plantgroepen: false,
        kleuren: false,
        standplaatsen: false,
        grondsoorten: false,
        bloeiperiodes: false,
        keurmerken: false,
    });

    const visibleSections = useMemo(
        () => getVisiblePlantSelectionFilterSections(isSearchMode),
        [isSearchMode]
    );

    const hasAnyExtraFilter = useMemo(() => {
        return (
            filters.opVoorraad ||
            filters.inheems ||
            advancedFilters.plantgroepen.length > 0 ||
            advancedFilters.kleuren.length > 0 ||
            advancedFilters.standplaatsen.length > 0 ||
            advancedFilters.grondsoorten.length > 0 ||
            advancedFilters.bloeiperiodes.length > 0 ||
            advancedFilters.keurmerken.length > 0
        );
    }, [advancedFilters, filters.inheems, filters.opVoorraad]);

    const getOptionsForFilter = (
        filterKey: PlantSelectionAdvancedArrayFilterKey
    ): string[] => {
        switch (filterKey) {
            case "plantgroepen":
                return PLANT_SELECTION_PLANTGROUP_OPTIONS;
            case "kleuren":
                return PLANT_SELECTION_COLOR_OPTIONS;
            case "standplaatsen":
                return PLANT_SELECTION_STANDPLAATS_OPTIONS;
            case "grondsoorten":
                return PLANT_SELECTION_GRONDSOORT_OPTIONS;
            case "bloeiperiodes":
                return PLANT_SELECTION_BLOEIPERIODE_OPTIONS;
            case "keurmerken":
                return PLANT_SELECTION_KEURMERK_OPTIONS;
        }
    };

    const renderScrollableOptions = (
        filterKey: PlantSelectionAdvancedArrayFilterKey
    ) => {
        const options = getOptionsForFilter(filterKey);
        const selectedValues = advancedFilters[filterKey];

        return (
            <div
                className="pr-2"
                style={{
                    maxHeight: 170,
                    overflowY: options.length > 5 ? "auto" : "visible",
                    scrollbarWidth: "thin",
                }}
            >
                <div className="space-y-1">
                    {options.map((option) => (
                        <CheckboxOptionRow
                            key={option}
                            label={option}
                            checked={selectedValues.includes(option)}
                            onClick={() => onToggleAdvancedFilter(filterKey, option)}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <section
            className="rounded-[10px] border p-4"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor: COLORS.border,
                boxShadow: "5px 3px 46px -25px rgba(0, 0, 0, 0.25)",
            }}
        >
            <div className="flex items-center justify-between gap-3">
                <h2
                    className="text-[18px] font-semibold"
                    style={{ color: COLORS.text }}
                >
                    Filters
                </h2>

                <button
                    type="button"
                    onClick={onClearFilters}
                    className="cursor-pointer text-[14px] font-semibold"
                    style={{
                        color: COLORS.green,
                        opacity: hasAnyExtraFilter ? 1 : 0.9,
                    }}
                >
                    Wis alle filters
                </button>
            </div>

            <div className="mt-4 space-y-3">
                {visibleSections.map((section) => {
                    if (section.kind === "toggle") {
                        const toggleKey = section.key as keyof PlantSelectionFiltersState;

                        return (
                            <ToggleRow
                                key={section.key}
                                label={section.label}
                                checked={filters[toggleKey]}
                                onClick={() => onToggleFilter(toggleKey)}
                            />
                        );
                    }

                    const expandableKey = section.key as PlantSelectionAdvancedArrayFilterKey;

                    return (
                        <ExpandableFilterRow
                            key={section.key}
                            label={section.label}
                            isOpen={openSections[expandableKey]}
                            onToggle={() =>
                                setOpenSections((prev) => ({
                                    ...prev,
                                    [expandableKey]: !prev[expandableKey],
                                }))
                            }
                        >
                            {renderScrollableOptions(expandableKey)}
                        </ExpandableFilterRow>
                    );
                })}
            </div>
        </section>
    );
}