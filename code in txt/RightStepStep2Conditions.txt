"use client";

import React, { useMemo, useState } from "react";
import type {
    RightStepStep2MaintenanceOption,
    RightStepStep2SoilOption,
    WizardOptionRowOption,
} from "@/features/editor/components/editor/rightStepMenu/rightStepMenuConfig";
import WizardOptionRow from "@/features/editor/components/editor/rightStepMenu/WizardOptionRow";

const COLORS = {
    orange: "#E94E1B",
    orangeSoft: "#FFF4EF",
    green: "#58694C",
    greenLight: "#EEF0ED",
    border: "#E3E2E2",
    mutedText: "#6B7280",
    softText: "#7A7A7A",
    text: "#111111",
    dotOuter: "#E5E8E3",
    dotMiddle: "#9BA594",
    dotCenter: "#58694C",
};

type RightStepStep2ConditionsProps = {
    stepLabel: string;
    selectedStandplaatsen: string[];
    selectedGroundTypes: string[];
    selectedMaintenanceLevel: string;
    selectedCertificationPreference: string;
    standplaatsOptions: WizardOptionRowOption[];
    soilOptions: RightStepStep2SoilOption[];
    maintenanceOptions: RightStepStep2MaintenanceOption[];
    certificationOptions: WizardOptionRowOption[];
    onToggleStandplaats: (value: string) => void;
    onSelectGroundType: (value: string) => void;
    onSelectMaintenanceLevel: (value: string) => void;
    onSelectCertificationPreference: (value: string) => void;
};

function SoilCard(props: {
    label: string;
    description: string;
    imageSrc: string;
    isSelected: boolean;
    onClick: () => void;
}) {
    const { label, description, imageSrc, isSelected, onClick } = props;

    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full rounded-lg overflow-hidden border text-left transition-all flex flex-col bg-white"
            style={{
                borderColor: isSelected ? COLORS.orange : COLORS.border,
                background: isSelected ? COLORS.orangeSoft : "#FFFFFF",
                boxShadow: isSelected ? "0 0 0 1px rgba(233,78,27,0.08)" : "none",
                cursor: "pointer",
                height: "100%",
            }}
        >
            <div
                className="relative overflow-hidden"
                style={{
                    aspectRatio: "4 / 3",
                    background: "#E9E9E9",
                    flex: "0 0 auto",
                }}
            >
                <img
                    src={imageSrc}
                    alt=""
                    className="block w-full h-full"
                    style={{
                        objectFit: "cover",
                        objectPosition: "center",
                    }}
                />

                <div
                    className="absolute left-2 top-2 flex items-center justify-center"
                    style={{
                        width: 18,
                        height: 18,
                    }}
                >
                    <img
                        src={isSelected ? "/icons/checkbox-checked.svg" : "/icons/checkbox-unchecked.svg"}
                        alt=""
                        style={{
                            width: 18,
                            height: 18,
                            display: "block",
                        }}
                    />
                </div>
            </div>

            <div
                className="px-3 pt-3 pb-3 flex flex-col"
                style={{
                    flex: "1 1 auto",
                    justifyContent: "space-between",
                }}
            >
                <div
                    className="text-[13px] font-semibold leading-[1.35]"
                    style={{ color: "#1F2937", minHeight: 36 }}
                >
                    {label}
                </div>

                <div
                    className="my-2"
                    style={{
                        height: 1,
                        background: COLORS.border,
                    }}
                />

                <p
                    className="text-[11px] italic leading-[1.45]"
                    style={{ color: "#4B5563" }}
                >
                    {description}
                </p>
            </div>
        </button>
    );
}

function SoilDots(props: {
    count: number;
    activeIndex: number;
}) {
    const { count, activeIndex } = props;

    return (
        <div className="flex items-center justify-center gap-[7px]">
            {Array.from({ length: count }).map((_, index) => {
                const isActive = index === activeIndex;

                return (
                    <span
                        key={index}
                        style={{
                            width: isActive ? 8 : 7,
                            height: isActive ? 8 : 7,
                            borderRadius: 999,
                            background: isActive ? COLORS.green : "#C9CEC5",
                            display: "block",
                            flex: "0 0 auto",
                        }}
                    />
                );
            })}
        </div>
    );
}

function MaintenanceRow(props: {
    label: string;
    value: string;
    features: string[];
    checked: boolean;
    expanded: boolean;
    onRowClick: () => void;
    onToggleExpand: () => void;
}) {
    const { label, value, features, checked, expanded, onRowClick, onToggleExpand } = props;

    return (
        <div>
            <button
                type="button"
                onClick={onRowClick}
                className="w-full flex items-center gap-3 rounded-md border px-3 py-[11px] text-left transition-all"
                style={{
                    borderColor: checked ? COLORS.orange : COLORS.border,
                    background: checked ? COLORS.orangeSoft : "#FFFFFF",
                    color: "#374151",
                    cursor: "pointer",
                }}
            >
                <span
                    className="flex items-center justify-center"
                    style={{
                        width: 18,
                        height: 18,
                        flex: "0 0 auto",
                    }}
                >
                    <img
                        src={checked ? "/icons/checkbox-checked.svg" : "/icons/checkbox-unchecked.svg"}
                        alt=""
                        style={{
                            width: 18,
                            height: 18,
                            display: "block",
                        }}
                    />
                </span>

                <span className="text-[12px] flex-1">{label}</span>

                <span
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggleExpand();
                    }}
                    className="flex items-center gap-1.5"
                    style={{
                        color: COLORS.green,
                        fontSize: 11,
                        flex: "0 0 auto",
                    }}
                >
                    <img
                        src={expanded ? "/icons/minus.svg" : "/icons/plus.svg"}
                        alt=""
                        style={{
                            width: 12,
                            height: 12,
                            display: "block",
                            filter:
                                "brightness(0) saturate(100%) invert(37%) sepia(15%) saturate(650%) hue-rotate(56deg) brightness(91%) contrast(88%)",
                        }}
                    />
                    <span>Kenmerken</span>
                </span>
            </button>

            {expanded ? (
                <div className="pl-[16px] pr-2 pt-2 pb-1">
                    <div className="flex gap-3">
                        <div
                            style={{
                                width: 2,
                                borderRadius: 999,
                                background: COLORS.green,
                                flex: "0 0 2px",
                            }}
                        />

                        <div className="flex-1 pt-0.5 space-y-2">
                            {features.map((feature) => (
                                <div key={`${value}-${feature}`} className="flex items-start gap-2">
                                    <img
                                        src="/icons/check-icon.svg"
                                        alt=""
                                        style={{
                                            width: 14,
                                            height: 14,
                                            marginTop: 1,
                                            flex: "0 0 auto",
                                        }}
                                    />

                                    <span
                                        className="text-[12px] leading-[1.45]"
                                        style={{ color: "#374151" }}
                                    >
                                        {feature}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default function RightStepStep2Conditions(props: RightStepStep2ConditionsProps) {
    const {
        stepLabel,
        selectedStandplaatsen,
        selectedGroundTypes,
        selectedMaintenanceLevel,
        selectedCertificationPreference,
        standplaatsOptions,
        soilOptions,
        maintenanceOptions,
        certificationOptions,
        onToggleStandplaats,
        onSelectGroundType,
        onSelectMaintenanceLevel,
        onSelectCertificationPreference,
    } = props;

    const [soilIndex, setSoilIndex] = useState(0);
    const [expandedMaintenanceValue, setExpandedMaintenanceValue] = useState<string | null>(null);

    const maxSoilIndex = Math.max(0, soilOptions.length - 2);
    const soilSlideCount = maxSoilIndex + 1;

    const handlePrevSoil = () => {
        setSoilIndex((prev) => Math.max(0, prev - 1));
    };

    const handleNextSoil = () => {
        setSoilIndex((prev) => Math.min(maxSoilIndex, prev + 1));
    };

    const handleSelectVisibleSoil = (value: string) => {
        onSelectGroundType(value);
    };

    return (
        <div className="px-4 pt-4 pb-5">
            <h2
                className="text-[15px] font-semibold mb-1"
                style={{ color: COLORS.green }}
            >
                {stepLabel}
            </h2>

            <p
                className="text-[13px] leading-[1.5] mb-5"
                style={{ color: COLORS.text }}
            >
                Geef de omstandigheden op zoals zonligging, grondsoort, onderhoudsniveau en keurmerk.
            </p>

            <section className="mb-5">
                <h3
                    className="text-[14px] font-semibold mb-1"
                    style={{ color: COLORS.green }}
                >
                    Standplaats
                </h3>

                <p
                    className="text-[12px] leading-[1.45] mb-3"
                    style={{ color: COLORS.text }}
                >
                    Je kan meerdere opties selecteren
                </p>

                <div className="grid grid-cols-2 gap-2">
                    {standplaatsOptions.map((option) => (
                        <WizardOptionRow
                            key={option.value}
                            label={option.label}
                            checked={selectedStandplaatsen.includes(option.value)}
                            onClick={() => onToggleStandplaats(option.value)}
                        />
                    ))}
                </div>
            </section>

            <section className="mb-5">
                <h3
                    className="text-[14px] font-semibold mb-1"
                    style={{ color: COLORS.green }}
                >
                    Grondsoort
                </h3>

                <p
                    className="text-[12px] leading-[1.45] mb-3"
                    style={{ color: COLORS.text }}
                >
                    Je kan meerdere opties selecteren
                </p>

                <div
                    style={{
                        overflow: "hidden",
                        width: "100%",
                    }}
                >
                    <div
                        className="flex gap-2"
                        style={{
                            width: "100%",
                            transform: `translateX(calc(-${soilIndex} * (50% + 4px)))`,
                            transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
                            willChange: "transform",
                        }}
                    >
                        {soilOptions.map((option) => (
                            <div
                                key={option.value}
                                style={{
                                    flex: "0 0 calc(50% - 4px)",
                                }}
                            >
                                <SoilCard
                                    label={option.label}
                                    description={option.description}
                                    imageSrc={option.imageSrc}
                                    isSelected={selectedGroundTypes.includes(option.value)}
                                    onClick={() => handleSelectVisibleSoil(option.value)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-4">
                    <button
                        type="button"
                        onClick={handlePrevSoil}
                        disabled={soilIndex === 0}
                        className="flex items-center justify-center rounded-[4px] border"
                        style={{
                            width: 18,
                            height: 18,
                            borderColor: soilIndex === 0 ? "#D8D8D8" : COLORS.green,
                            background: soilIndex === 0 ? "#F2F2F2" : COLORS.green,
                            cursor: soilIndex === 0 ? "not-allowed" : "pointer",
                            flex: "0 0 auto",
                        }}
                        aria-label="Vorige grondsoort"
                    >
                        <img
                            src="/icons/chevron-left.svg"
                            alt=""
                            style={{
                                width: 10,
                                height: 10,
                                display: "block",
                                filter:
                                    soilIndex === 0
                                        ? "brightness(0) saturate(100%) opacity(0.35)"
                                        : "brightness(0) invert(1)",
                            }}
                        />
                    </button>

                    <SoilDots
                        count={soilSlideCount}
                        activeIndex={soilIndex}
                    />

                    <button
                        type="button"
                        onClick={handleNextSoil}
                        disabled={soilIndex >= maxSoilIndex}
                        className="flex items-center justify-center rounded-[4px] border"
                        style={{
                            width: 18,
                            height: 18,
                            borderColor: soilIndex >= maxSoilIndex ? "#D8D8D8" : COLORS.green,
                            background: soilIndex >= maxSoilIndex ? "#F2F2F2" : COLORS.green,
                            cursor: soilIndex >= maxSoilIndex ? "not-allowed" : "pointer",
                            flex: "0 0 auto",
                        }}
                        aria-label="Volgende grondsoort"
                    >
                        <img
                            src="/icons/chevron-right.svg"
                            alt=""
                            style={{
                                width: 10,
                                height: 10,
                                display: "block",
                                filter:
                                    soilIndex >= maxSoilIndex
                                        ? "brightness(0) saturate(100%) opacity(0.35)"
                                        : "brightness(0) invert(1)",
                            }}
                        />
                    </button>
                </div>
            </section>

            <section className="mb-5">
                <h3
                    className="text-[14px] font-semibold mb-3"
                    style={{ color: COLORS.green }}
                >
                    Onderhoudsniveau
                </h3>

                <div className="space-y-2">
                    {maintenanceOptions.map((option) => (
                        <MaintenanceRow
                            key={option.value}
                            label={option.label}
                            value={option.value}
                            features={option.features}
                            checked={selectedMaintenanceLevel === option.value}
                            expanded={expandedMaintenanceValue === option.value}
                            onRowClick={() => onSelectMaintenanceLevel(option.value)}
                            onToggleExpand={() =>
                                setExpandedMaintenanceValue((prev) =>
                                    prev === option.value ? null : option.value
                                )
                            }
                        />
                    ))}
                </div>
            </section>

            <section>
                <h3
                    className="text-[14px] font-semibold mb-1"
                    style={{ color: COLORS.green }}
                >
                    Keurmerken
                </h3>

                <p
                    className="text-[12px] leading-[1.45] mb-3"
                    style={{ color: COLORS.text }}
                >
                    Kies of keurmerken een vereiste zijn voor dit plan.
                </p>
                <div className="space-y-2">
                    {certificationOptions.map((option) => (
                        <WizardOptionRow
                            key={option.value}
                            label={option.label}
                            checked={selectedCertificationPreference === option.value}
                            onClick={() => onSelectCertificationPreference(option.value)}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}