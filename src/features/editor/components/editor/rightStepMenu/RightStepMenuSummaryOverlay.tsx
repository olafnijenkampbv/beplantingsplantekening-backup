"use client";

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
    RIGHT_STEP_STEP1_FOLLOW_UP_BY_LOCATION,
    RIGHT_STEP_STEP1_LOCATION_OPTIONS,
    RIGHT_STEP_STEP2_CERTIFICATION_OPTIONS,
    RIGHT_STEP_STEP2_MAINTENANCE_OPTIONS,
    RIGHT_STEP_STEP2_SOIL_OPTIONS,
    RIGHT_STEP_STEP2_STANDPLAATS_OPTIONS,
    RIGHT_STEP_STEP3_STRUCTURE_OPTIONS,
} from "@/features/editor/components/editor/rightStepMenu/rightStepMenuConfig";
import type {
    RightStepStep1State,
    RightStepStep2State,
    RightStepStep3State,
    RightStepStep4State,
} from "@/features/editor/state/rightStepMenuStore";

const COLORS = {
    orange: "#E94E1B",
    orangeSoft: "#FFF4EF",
    green: "#58694C",
    greenLight: "#EEF0ED",
    border: "#E3E2E2",
    mutedText: "#6B7280",
    softText: "#898988",
    text: "#111111",
};

type SummaryStatus = "filled" | "empty";

type SummaryRow = {
    label: string;
    value: string;
    status: SummaryStatus;
};

type SummarySection = {
    id: 1 | 2 | 3 | 4;
    title: string;
    badgeLabel: string;
    badgeStatus: SummaryStatus;
    rows: SummaryRow[];
};

type RightStepMenuSummaryOverlayProps = {
    step1: RightStepStep1State;
    step2: RightStepStep2State;
    step3: RightStepStep3State;
    step4: RightStepStep4State;
    isStep1Complete: boolean;
    isStep2Complete: boolean;
    isStep3Complete: boolean;
    isStep4Complete: boolean;
    onClose: () => void;
};

function mapValuesToLabels(
    values: string[],
    options: Array<{ value: string; label: string }>
) {
    const optionMap = new Map(options.map((option) => [option.value, option.label]));

    return values
        .map((value) => optionMap.get(value) ?? value)
        .filter(Boolean);
}

function mapValueToLabel(
    value: string | null,
    options: Array<{ value: string; label: string }>
) {
    if (!value) return "";
    return options.find((option) => option.value === value)?.label ?? value;
}

function SummaryStatusIcon(props: { status: SummaryStatus }) {
    const { status } = props;

    if (status === "filled") {
        return (
            <span
                className="flex items-center justify-center"
                style={{
                    width: 22,
                    height: 22,
                    flex: "0 0 auto",
                }}
            >
                <img
                    src="/icons/check-icon.svg"
                    alt=""
                    style={{
                        width: 22,
                        height: 22,
                        display: "block",
                    }}
                />
            </span>
        );
    }

    return (
        <span
            className="flex items-center justify-center"
            style={{
                width: 22,
                height: 22,
                flex: "0 0 auto",
            }}
        >
            <span
                style={{
                    width: 20,
                    height: 20,
                    borderRadius: "999px",
                    border: `1.75px dashed ${COLORS.green}`,
                    background: "#FFFFFF",
                    display: "block",
                    boxSizing: "border-box",
                }}
            />
        </span>
    );
}

function SummaryBadge(props: { label: string; status: SummaryStatus }) {
    const { label, status } = props;

    return (
        <span
            className="inline-flex items-center rounded-[4px] border px-2 py-[3px] text-[11px] leading-[1.2]"
            style={{
                borderColor: status === "filled" ? "#F4B49E" : "#D9D9D9",
                background: status === "filled" ? COLORS.orangeSoft : "#F5F5F5",
                color: status === "filled" ? COLORS.orange : "#8D8D8D",
            }}
        >
            {label}
        </span>
    );
}

function SummaryRowCard(props: SummaryRow) {
    const { label, value, status } = props;

    return (
        <div
            className="flex items-center gap-3 px-4 py-3"
            style={{
                minHeight: 58,
                borderTop: `1px solid ${COLORS.border}`,
            }}
        >
            <SummaryStatusIcon status={status} />

            <div className="min-w-0">
                <div
                    className="text-[11px] font-semibold leading-[1.2] mb-1"
                    style={{ color: COLORS.green }}
                >
                    {label}
                </div>

                <div
                    className={`leading-[1.35] ${status === "filled"
                            ? "text-[14px] font-semibold"
                            : "text-[12px] font-normal italic"
                        }`}
                    style={{ color: status === "filled" ? COLORS.text : "#9A9A9A" }}
                >
                    {value}
                </div>
            </div>
        </div>
    );
}

function SummarySectionCard(props: {
    section: SummarySection;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const { section, isExpanded, onToggle } = props;

    return (
        <div
            className="rounded-[8px] border bg-white overflow-hidden"
            style={{ borderColor: COLORS.border }}
        >
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{
                    cursor: "pointer",
                    background: "#FFFFFF",
                }}
            >
                <div
                    className="flex items-center justify-center rounded-full text-[14px] font-semibold"
                    style={{
                        width: 28,
                        height: 28,
                        background: COLORS.green,
                        color: "#FFFFFF",
                        flex: "0 0 auto",
                    }}
                >
                    {section.id}
                </div>

                <div className="min-w-0 flex-1">
                    <div
                        className="text-[15px] font-semibold leading-[1.2]"
                        style={{ color: COLORS.text }}
                    >
                        {section.title}
                    </div>
                </div>

                <SummaryBadge
                    label={section.badgeLabel}
                    status={section.badgeStatus}
                />

                <img
                    src={isExpanded ? "/icons/chevron-up.svg" : "/icons/chevron-down.svg"}
                    alt=""
                    style={{
                        width: 16,
                        height: 16,
                        display: "block",
                        flex: "0 0 auto",
                        objectFit: "contain",
                        opacity: 0.8,
                    }}
                />
            </button>

            {isExpanded ? (
                section.rows.length > 0 ? (
                    <div className="px-4 pb-4">
                        <div
                            className="overflow-hidden rounded-[6px] border bg-white"
                            style={{ borderColor: COLORS.border }}
                        >
                            {section.rows.map((row, index) => (
                                <div key={`${section.id}-${row.label}-${index}`}>
                                    {index === 0 ? (
                                        <div
                                            className="flex items-center gap-3 px-4 py-3"
                                            style={{ minHeight: 58 }}
                                        >
                                            <SummaryStatusIcon status={row.status} />

                                            <div className="min-w-0">
                                                <div
                                                    className="text-[11px] font-semibold leading-[1.2] mb-1"
                                                    style={{ color: COLORS.green }}
                                                >
                                                    {row.label}
                                                </div>

                                                <div
                                                    className={`leading-[1.35] ${row.status === "filled"
                                                            ? "text-[14px] font-semibold"
                                                            : "text-[12px] font-normal italic"
                                                        }`}
                                                    style={{
                                                        color:
                                                            row.status === "filled"
                                                                ? COLORS.text
                                                                : "#9A9A9A",
                                                    }}
                                                >
                                                    {row.value}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <SummaryRowCard {...row} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="px-4 pb-4">
                            <div
                                className="rounded-[6px] border px-4 py-4 text-[12px]"
                                style={{
                                    borderColor: COLORS.border,
                                    color: COLORS.softText,
                                    background: "#FFFFFF",
                                }}
                            >
                                Deze stap is nog leeg.
                            </div>
                    </div>
                )
            ) : null}
        </div>
    );
}

export default function RightStepMenuSummaryOverlay(
    props: RightStepMenuSummaryOverlayProps
) {
    const {
        step1,
        step2,
        step3,
        step4,
        isStep1Complete,
        isStep2Complete,
        isStep3Complete,
        isStep4Complete,
        onClose,
    } = props;

    const [expandedSectionIds, setExpandedSectionIds] = useState<Array<1 | 2 | 3 | 4>>([]);

    const sections = useMemo<SummarySection[]>(() => {
        const selectedLocationLabel = mapValueToLabel(
            step1.locationType,
            RIGHT_STEP_STEP1_LOCATION_OPTIONS
        );

        const followUpOptions = step1.locationType
            ? RIGHT_STEP_STEP1_FOLLOW_UP_BY_LOCATION[step1.locationType]?.options ?? []
            : [];

        const selectedGardenZoneLabels = mapValuesToLabels(
            step1.gardenZones,
            followUpOptions
        );

        const selectedStandplaatsLabels = mapValuesToLabels(
            step2.standplaatsen,
            RIGHT_STEP_STEP2_STANDPLAATS_OPTIONS
        );

        const selectedGroundTypeLabels = mapValuesToLabels(
            step2.groundTypes,
            RIGHT_STEP_STEP2_SOIL_OPTIONS
        );

        const selectedMaintenanceLabel = mapValueToLabel(
            step2.maintenanceLevel,
            RIGHT_STEP_STEP2_MAINTENANCE_OPTIONS
        );

        const selectedCertificationLabel = mapValueToLabel(
            step2.certificationPreference,
            RIGHT_STEP_STEP2_CERTIFICATION_OPTIONS
        );

        const selectedStructureOption =
            RIGHT_STEP_STEP3_STRUCTURE_OPTIONS.find(
                (option) => option.value === step3.structureStyle
            ) ?? null;

        const isCustomStructure = selectedStructureOption?.value === "vrij-samenstellen";

        const step3Rows: SummaryRow[] = selectedStructureOption
            ? [
                {
                    label: "Structuurstijl",
                    value: selectedStructureOption.label,
                    status: "filled",
                },
                {
                    label: "Bodembedekkers",
                    value: isCustomStructure
                        ? step3.customPercentages.bodembedekkers
                            ? `${step3.customPercentages.bodembedekkers}%`
                            : "Nog niet ingevuld"
                        : `${selectedStructureOption.distribution.bodembedekkers ?? 0}%`,
                    status:
                        isCustomStructure
                            ? step3.customPercentages.bodembedekkers
                                ? "filled"
                                : "empty"
                            : "filled",
                },
                {
                    label: "Vaste planten",
                    value: isCustomStructure
                        ? step3.customPercentages.vastePlanten
                            ? `${step3.customPercentages.vastePlanten}%`
                            : "Nog niet ingevuld"
                        : `${selectedStructureOption.distribution.vastePlanten ?? 0}%`,
                    status:
                        isCustomStructure
                            ? step3.customPercentages.vastePlanten
                                ? "filled"
                                : "empty"
                            : "filled",
                },
                {
                    label: "Heesters & struiken",
                    value: isCustomStructure
                        ? step3.customPercentages.heestersEnStruiken
                            ? `${step3.customPercentages.heestersEnStruiken}%`
                            : "Nog niet ingevuld"
                        : `${selectedStructureOption.distribution.heestersEnStruiken ?? 0}%`,
                    status:
                        isCustomStructure
                            ? step3.customPercentages.heestersEnStruiken
                                ? "filled"
                                : "empty"
                            : "filled",
                },
                {
                    label: "Bomen",
                    value: isCustomStructure
                        ? step3.customPercentages.bomen
                            ? `${step3.customPercentages.bomen}%`
                            : "Nog niet ingevuld"
                        : `${selectedStructureOption.distribution.bomen ?? 0}%`,
                    status:
                        isCustomStructure
                            ? step3.customPercentages.bomen
                                ? "filled"
                                : "empty"
                            : "filled",
                },
            ]
            : [
                {
                    label: "Structuurstijl",
                    value: "Nog niet ingevuld",
                    status: "empty",
                },
                {
                    label: "Bodembedekkers",
                    value: "Nog niet ingevuld",
                    status: "empty",
                },
                {
                    label: "Vaste planten",
                    value: "Nog niet ingevuld",
                    status: "empty",
                },
                {
                    label: "Heesters & struiken",
                    value: "Nog niet ingevuld",
                    status: "empty",
                },
                {
                    label: "Bomen",
                    value: "Nog niet ingevuld",
                    status: "empty",
                },
            ];

        const seasonExperienceMap = new Map<string, string>([
            ["seizoenspiek-voorjaar-zomer", "Seizoenspiek (voorjaar & zomer)"],
            ["hele-jaar-aantrekkelijk", "Het hele jaar aantrekkelijk"],
            ["sterk-herfst-winter", "Ook sterk in herfst & winter"],
        ]);

        const heightStyleMap = new Map<string, string>([
            ["laag-horizontaal", "Laag & horizontaal"],
            ["gelaagd-ruimtelijk", "Gelaagd & ruimtelijk"],
            ["accent-op-hoogte", "Accent op hoogte"],
        ]);

        const selectedSeasonExperienceLabel = step4.seasonExperience
            ? seasonExperienceMap.get(step4.seasonExperience) ?? step4.seasonExperience
            : "";

        const selectedHeightStyleLabel = step4.heightStyle
            ? heightStyleMap.get(step4.heightStyle) ?? step4.heightStyle
            : "";

        return [
            {
                id: 1,
                title: "Locatie bepalen",
                badgeLabel: isStep1Complete ? "Ingevuld" : "Niet ingevuld",
                badgeStatus: isStep1Complete ? "filled" : "empty",
                rows: [
                    {
                        label: "Locatie",
                        value: selectedLocationLabel || "Nog niet ingevuld",
                        status: selectedLocationLabel ? "filled" : "empty",
                    },
                    {
                        label: "Zone",
                        value:
                            selectedGardenZoneLabels.length > 0
                                ? selectedGardenZoneLabels.join(", ")
                                : "Nog niet ingevuld",
                        status: selectedGardenZoneLabels.length > 0 ? "filled" : "empty",
                    },
                ],
            },
            {
                id: 2,
                title: "Situatie & randvoorwaarden",
                badgeLabel: isStep2Complete ? "Ingevuld" : "Niet ingevuld",
                badgeStatus: isStep2Complete ? "filled" : "empty",
                rows: [
                    {
                        label: "Standplaats",
                        value:
                            selectedStandplaatsLabels.length > 0
                                ? selectedStandplaatsLabels.join(", ")
                                : "Nog niet ingevuld",
                        status:
                            selectedStandplaatsLabels.length > 0 ? "filled" : "empty",
                    },
                    {
                        label: "Grondsoort",
                        value:
                            selectedGroundTypeLabels.length > 0
                                ? selectedGroundTypeLabels.join(", ")
                                : "Nog niet ingevuld",
                        status:
                            selectedGroundTypeLabels.length > 0 ? "filled" : "empty",
                    },
                    {
                        label: "Onderhoudsniveau",
                        value: selectedMaintenanceLabel || "Nog niet ingevuld",
                        status: selectedMaintenanceLabel ? "filled" : "empty",
                    },
                    {
                        label: "Keurmerk",
                        value: selectedCertificationLabel || "Nog niet ingevuld",
                        status: selectedCertificationLabel ? "filled" : "empty",
                    },
                ],
            },
            {
                id: 3,
                title: "Structuur & opbouw",
                badgeLabel: isStep3Complete ? "Ingevuld" : "Niet ingevuld",
                badgeStatus: isStep3Complete ? "filled" : "empty",
                rows: step3Rows,
            },
            {
                id: 4,
                title: "Beleving & ruimte",
                badgeLabel: isStep4Complete ? "Ingevuld" : "Niet ingevuld",
                badgeStatus: isStep4Complete ? "filled" : "empty",
                rows: [
                    {
                        label: "Seizoensbeleving",
                        value: selectedSeasonExperienceLabel || "Nog niet ingevuld",
                        status: selectedSeasonExperienceLabel ? "filled" : "empty",
                    },
                    {
                        label: "Hoogtewerking",
                        value: selectedHeightStyleLabel || "Nog niet ingevuld",
                        status: selectedHeightStyleLabel ? "filled" : "empty",
                    },
                ],
            },
        ];
    }, [step1, step2, step3, step4, isStep1Complete, isStep2Complete, isStep3Complete, isStep4Complete]);

    const handleToggleSection = (sectionId: 1 | 2 | 3 | 4) => {
        setExpandedSectionIds((prev) =>
            prev.includes(sectionId)
                ? prev.filter((id) => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    return createPortal(
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.33)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: 24,
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: 520,
                    maxHeight: "85vh",
                    background: "#FFFFFF",
                    borderRadius: 10,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    boxShadow: "0 18px 48px rgba(0,0,0,0.16)",
                }}
            >
                <div
                    className="px-4 py-4 border-b shrink-0"
                    style={{ borderColor: COLORS.border }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div
                                className="flex items-center justify-center rounded-full"
                                style={{
                                    width: 42,
                                    height: 42,
                                    background: COLORS.green,
                                    flex: "0 0 auto",
                                }}
                            >
                                <img
                                    src="/icons/list.svg"
                                    alt=""
                                    style={{
                                        width: 20,
                                        height: 20,
                                        display: "block",
                                        filter: "brightness(0) invert(1)",
                                    }}
                                />
                            </div>

                            <div className="min-w-0">
                                <div
                                    className="font-semibold text-[16px] leading-[1.2]"
                                    style={{ color: COLORS.text }}
                                >
                                    Samenvatting
                                </div>

                                <div
                                    className="text-[12px] leading-[1.35]"
                                    style={{ color: COLORS.softText }}
                                >
                                    Je keuzes in één overzicht
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="flex items-center justify-center"
                            style={{
                                width: 24,
                                height: 24,
                                cursor: "pointer",
                                color: COLORS.text,
                                flex: "0 0 auto",
                                background: "transparent",
                                border: "none",
                            }}
                            aria-label="Sluiten"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div
                    className="summary-overlay-scroll flex-1 min-h-0 overflow-y-auto px-4 py-4"
                    style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "#B8B8B8 transparent",
                    }}
                >
                    <div className="space-y-4">
                        {sections.map((section) => (
                            <SummarySectionCard
                                key={section.id}
                                section={section}
                                isExpanded={expandedSectionIds.includes(section.id)}
                                onToggle={() => handleToggleSection(section.id)}
                            />
                        ))}
                    </div>
                </div>

                <div
                    className="px-4 py-4 border-t shrink-0"
                    style={{ borderColor: COLORS.border }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-lg px-4 py-3 font-semibold border flex items-center justify-center transition-colors"
                        style={{
                            borderColor: COLORS.orange,
                            background: COLORS.orange,
                            color: "#FFFFFF",
                            cursor: "pointer",
                        }}
                    >
                        Sluiten
                    </button>
                </div>
            </div>

            <style jsx>{`
                .summary-overlay-scroll::-webkit-scrollbar {
                    width: 8px;
                }

                .summary-overlay-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }

                .summary-overlay-scroll::-webkit-scrollbar-thumb {
                    background: #b8b8b8;
                    border-radius: 999px;
                    border: 2px solid transparent;
                    background-clip: padding-box;
                }

                .summary-overlay-scroll::-webkit-scrollbar-thumb:hover {
                    background: #9f9f9f;
                    border: 2px solid transparent;
                    background-clip: padding-box;
                }
            `}</style>
        </div>,
        document.body
    );
}