"use client";

import React, { useMemo, useState } from "react";
import type { PlantSelectionFiltersState } from "@/features/editor/state/plantSelectionStore";

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    green: "#58694C",
    text: "#111111",
    softButtonBg: "#F8F7F6",
};

const COLOR_OPTIONS = ["Blauw", "Rood", "Geel", "Wit", "Roze", "Paars"];
const BLOEIPERIODE_OPTIONS = ["jan - mrt", "mrt - mei", "juni - aug", "sept - nov"];

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

type PlantSelectionFiltersCardProps = {
    filters: PlantSelectionFiltersState;
    onToggleFilter: (key: keyof PlantSelectionFiltersState) => void;
    onClearFilters: () => void;
};

export default function PlantSelectionFiltersCard(props: PlantSelectionFiltersCardProps) {
    const { filters, onToggleFilter, onClearFilters } = props;

    const [isColorOpen, setIsColorOpen] = useState(false);
    const [isBloomOpen, setIsBloomOpen] = useState(false);
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [selectedBloomPeriods, setSelectedBloomPeriods] = useState<string[]>([]);

    const hasAnyExtraFilter = useMemo(() => {
        return (
            filters.opVoorraad ||
            filters.inheems ||
            selectedColors.length > 0 ||
            selectedBloomPeriods.length > 0
        );
    }, [filters.inheems, filters.opVoorraad, selectedBloomPeriods.length, selectedColors.length]);

    const handleToggleColor = (value: string) => {
        setSelectedColors((prev) =>
            prev.includes(value)
                ? prev.filter((item) => item !== value)
                : [...prev, value]
        );
    };

    const handleToggleBloomPeriod = (value: string) => {
        setSelectedBloomPeriods((prev) =>
            prev.includes(value)
                ? prev.filter((item) => item !== value)
                : [...prev, value]
        );
    };

    const handleClearAll = () => {
        onClearFilters();
        setSelectedColors([]);
        setSelectedBloomPeriods([]);
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
                    onClick={handleClearAll}
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
                <ToggleRow
                    label="Op voorraad"
                    checked={filters.opVoorraad}
                    onClick={() => onToggleFilter("opVoorraad")}
                />

                <ToggleRow
                    label="Inheems"
                    checked={filters.inheems}
                    onClick={() => onToggleFilter("inheems")}
                />

                <ExpandableFilterRow
                    label="Kleur"
                    isOpen={isColorOpen}
                    onToggle={() => setIsColorOpen((prev) => !prev)}
                >
                    <div
                        className="pr-2"
                        style={{
                            maxHeight: 170,
                            overflowY: COLOR_OPTIONS.length > 5 ? "auto" : "visible",
                            scrollbarWidth: "thin",
                        }}
                    >
                        <div className="space-y-1">
                            {COLOR_OPTIONS.map((option) => (
                                <CheckboxOptionRow
                                    key={option}
                                    label={option}
                                    checked={selectedColors.includes(option)}
                                    onClick={() => handleToggleColor(option)}
                                />
                            ))}
                        </div>
                    </div>
                </ExpandableFilterRow>

                <ExpandableFilterRow
                    label="Bloeiperiode"
                    isOpen={isBloomOpen}
                    onToggle={() => setIsBloomOpen((prev) => !prev)}
                >
                    <div
                        className="pr-2"
                        style={{
                            maxHeight: 170,
                            overflowY:
                                BLOEIPERIODE_OPTIONS.length > 5 ? "auto" : "visible",
                            scrollbarWidth: "thin",
                        }}
                    >
                        <div className="space-y-1">
                            {BLOEIPERIODE_OPTIONS.map((option) => (
                                <CheckboxOptionRow
                                    key={option}
                                    label={option}
                                    checked={selectedBloomPeriods.includes(option)}
                                    onClick={() => handleToggleBloomPeriod(option)}
                                />
                            ))}
                        </div>
                    </div>
                </ExpandableFilterRow>
            </div>
        </section>
    );
}