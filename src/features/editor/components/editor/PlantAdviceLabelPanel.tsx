"use client";

import React from "react";
import type { ObjectType, PolyObject } from "@/state/projectStore";
import { useProjectStore } from "@/state/projectStore";
import {
    formatMeters,
    formatSquareMeters,
    getMetersFromEditorUnits,
    getObjectAreaInSquareMeters,
} from "@/state/areaMetrics";
import {
    DUMMY_PLANTS,
    getDummyPlantSpecificationsForPlant,
} from "@/features/editor/lib/plantSelectionDummyData";

const PANEL_UI = {
    minWidth: 820,
    padding: 18,
    radius: 12,

    summaryHeight: 70,
    summaryPaddingX: 22,
    summaryGap: 16,
    summaryIconSize: 30,
    summaryChevronSize: 20,
    summaryTitleFontSize: 24,
    summaryTitleFontWeight: 700,
    summaryTotalFontSize: 22,
    summaryTotalFontWeight: 800,
    summarySubTextFontSize: 18,

    contentPaddingTop: 24,
    titleFontSize: 24,
    titleFontWeight: 800,

    areaBadgePaddingX: 18,
    areaBadgeHeight: 46,
    areaBadgeFontSize: 20,
    areaBadgeFontWeight: 800,
    measureNoteFontSize: 20,
    measureNoteFontWeight: 400,

    tableColumnGap: 20,
    tableHeaderPaddingBottom: 14,
    tableHeaderFontSize: 20,
    tableHeaderFontWeight: 800,
    tableHeaderSubFontSize: 16,
    tableRowMinHeight: 82,

    plantNameFontSize: 21,
    plantNameFontWeight: 800,
    plantSubNameFontSize: 19,

    valueFontSize: 20,
    valueFontWeight: 500,
    highlightValueFontSize: 22,
    highlightValueFontWeight: 800,

    infoMarginTop: 16,
    infoMinHeight: 48,
    infoPaddingX: 16,
    infoIconSize: 24,
    infoFontSize: 20,
    infoFontWeight: 500,

    animationMs: 220,
    animationEase: "cubic-bezier(0.22, 1, 0.36, 1)",
    animationOffsetY: -6,
} as const;

const COLORS = {
    orange: "#E94E1B",
    green: "#58694C",
    greenLight: "#F0F5EE",
    infoBackground: "#D9EDF7",
    infoBorder: "#BCE8F1",
    infoText: "#31708F",
    border: "#E3E2E2",
    text: "#111111",
    mutedText: "#444444",
};

const ICON_FILTERS = {
    green:
        "brightness(0) saturate(100%) invert(36%) sepia(13%) saturate(707%) hue-rotate(56deg) brightness(92%) contrast(86%)",
    info:
        "brightness(0) saturate(100%) invert(38%) sepia(17%) saturate(1115%) hue-rotate(158deg) brightness(88%) contrast(87%)",
};

const TABLE_GRID_TEMPLATE =
    "260px minmax(105px, 0.7fr) minmax(140px, 0.9fr) minmax(170px, 1fr) minmax(115px, 0.7fr)";

type ProjectPlantLike = {
    id: string;
    latin?: string;
    dutch?: string;
    name?: string;
    latinName?: string;
    botanicalName?: string;
    dutchName?: string;
    planthoeveelheidPerM2?: number | string | null;
    plantQuantityPerM2?: number | string | null;
    quantityPerSquareMeter?: number | string | null;
};

type AdviceMeasurementMode = "area" | "length";

type AdviceRow = {
    plantId: string;
    latinName: string;
    dutchName: string;
    distributionPercentage: number;
    assignedMeasureValue: number;
    quantityPerSquareMeter: number | null;
    adviceCount: number | null;
};

type AdviceData = {
    measurementMode: AdviceMeasurementMode;
    totalMeasureValue: number;
    totalSquareMeters: number;
    totalAdviceCount: number;
    rows: AdviceRow[];
};

type PlantAdviceLabelPanelProps = {
    selectedObject: PolyObject | null;
    currentType: ObjectType;
    labelText: string;
    linkedPlantIds: string[];
    borderRadius: number;
    shadow: string;
    borderColor: string;
};

function formatDutchNumber(value: number, decimals = 2) {
    return value.toLocaleString("nl-NL", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function formatAdviceMeasureValue(value: number, measurementMode: AdviceMeasurementMode) {
    if (measurementMode === "length") {
        return formatMeters(value, 2);
    }

    return formatSquareMeters(value);
}

type HedgeOutlineSegment = {
    length: number;
};

function getHedgeOutlineSegments(points: number[]) {
    if (!points || points.length < 6) return [];

    const segments: HedgeOutlineSegment[] = [];
    const pointCount = points.length / 2;

    for (let index = 0; index < pointCount; index += 1) {
        const currentIndex = index * 2;
        const nextIndex = ((index + 1) % pointCount) * 2;

        const ax = points[currentIndex];
        const ay = points[currentIndex + 1];
        const bx = points[nextIndex];
        const by = points[nextIndex + 1];

        const editorLength = Math.hypot(bx - ax, by - ay);
        const length = getMetersFromEditorUnits(editorLength);

        if (Number.isFinite(length) && length > 0.05) {
            segments.push({ length });
        }
    }

    return segments;
}

function getRingThicknessFromBoundingBoxes(
    outerPoints: number[],
    holes: number[][]
) {
    if (!holes || holes.length === 0) return null;

    const getBox = (points: number[]) => {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (let index = 0; index < points.length; index += 2) {
            minX = Math.min(minX, points[index]);
            minY = Math.min(minY, points[index + 1]);
            maxX = Math.max(maxX, points[index]);
            maxY = Math.max(maxY, points[index + 1]);
        }

        return {
            width: getMetersFromEditorUnits(maxX - minX),
            height: getMetersFromEditorUnits(maxY - minY),
        };
    };

    const outerBox = getBox(outerPoints);

    const thicknessCandidates = holes
        .flatMap((hole) => {
            const holeBox = getBox(hole);

            return [
                (outerBox.width - holeBox.width) / 2,
                (outerBox.height - holeBox.height) / 2,
            ];
        })
        .filter((value) => Number.isFinite(value) && value > 0.05);

    if (thicknessCandidates.length === 0) return null;

    return Math.min(...thicknessCandidates);
}

function getEstimatedHedgeWidthInMeters(object: PolyObject, segments: HedgeOutlineSegment[]) {
    const ringThickness = getRingThicknessFromBoundingBoxes(
        object.points,
        object.holes ?? []
    );

    if (ringThickness !== null) {
        return ringThickness;
    }

    const sortedLengths = segments
        .map((segment) => segment.length)
        .filter((length) => Number.isFinite(length) && length > 0.05)
        .sort((a, b) => a - b);

    return sortedLengths[0] ?? null;
}

function getEstimatedHedgeLengthInMeters(object: PolyObject, totalSquareMeters: number) {
    const segments = getHedgeOutlineSegments(object.points);
    const estimatedWidth = getEstimatedHedgeWidthInMeters(object, segments);

    if (!estimatedWidth || estimatedWidth <= 0) {
        return {
            hedgeLengthMeters: totalSquareMeters,
            hedgeWidthMeters: null,
        };
    }

    if ((object.holes?.length ?? 0) > 0) {
        const hedgeLengthMeters = totalSquareMeters / estimatedWidth;

        return {
            hedgeLengthMeters: hedgeLengthMeters > 0 ? hedgeLengthMeters : totalSquareMeters,
            hedgeWidthMeters: estimatedWidth,
        };
    }

    if (segments.length === 0) {
        return {
            hedgeLengthMeters: totalSquareMeters,
            hedgeWidthMeters: estimatedWidth,
        };
    }

    const widthSegmentThreshold = estimatedWidth * 1.8;

    const hedgeDirectionSegments = segments.filter(
        (segment) => segment.length > widthSegmentThreshold
    );

    const hedgeOutlineLength = hedgeDirectionSegments.reduce(
        (total, segment) => total + segment.length,
        0
    );

    const hedgeLengthMeters = hedgeOutlineLength / 2;

    return {
        hedgeLengthMeters: hedgeLengthMeters > 0 ? hedgeLengthMeters : totalSquareMeters,
        hedgeWidthMeters: estimatedWidth,
    };
}

function parsePositiveNumber(value: unknown) {
    if (typeof value === "number") {
        return Number.isFinite(value) && value > 0 ? value : null;
    }

    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().replace(",", ".");
    const parsed = Number(normalized);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getPlantQuantityPerSquareMeterFromSpecifications(plantId: string) {
    const dummyPlant = DUMMY_PLANTS.find((plant) => plant.id === plantId);
    if (!dummyPlant) return null;

    const specifications = getDummyPlantSpecificationsForPlant(dummyPlant);
    const rows = [...specifications.leftColumn, ...specifications.rightColumn];

    const quantityRow = rows.find(
        (row) => row.label.trim().toLowerCase() === "planthoeveelheid per m²"
    );

    return parsePositiveNumber(quantityRow?.value);
}

function getPlantQuantityPerSquareMeter(projectPlant: ProjectPlantLike | undefined, plantId: string) {
    return (
        parsePositiveNumber(projectPlant?.planthoeveelheidPerM2) ??
        parsePositiveNumber(projectPlant?.plantQuantityPerM2) ??
        parsePositiveNumber(projectPlant?.quantityPerSquareMeter) ??
        getPlantQuantityPerSquareMeterFromSpecifications(plantId)
    );
}

function getPlantDisplayNames(projectPlant: ProjectPlantLike | undefined, plantId: string) {
    const dummyPlant = DUMMY_PLANTS.find((plant) => plant.id === plantId);

    return {
        latinName:
            projectPlant?.latin ??
            projectPlant?.name ??
            projectPlant?.botanicalName ??
            dummyPlant?.name ??
            "Onbekende plant",
        dutchName:
            projectPlant?.dutch ??
            projectPlant?.latinName ??
            projectPlant?.dutchName ??
            dummyPlant?.latinName ??
            "",
    };
}

function buildAdviceData(params: {
    selectedObject: PolyObject;
    currentType: ObjectType;
    linkedPlantIds: string[];
    plants: ProjectPlantLike[];
}) {
    const { selectedObject, currentType, linkedPlantIds, plants } = params;

    const totalSquareMeters = getObjectAreaInSquareMeters(selectedObject);
    const measurementMode: AdviceMeasurementMode = currentType === "hedge" ? "length" : "area";

    const hedgeMeasurement =
        measurementMode === "length"
            ? getEstimatedHedgeLengthInMeters(selectedObject, totalSquareMeters)
            : null;

    const totalMeasureValue =
        measurementMode === "length"
            ? hedgeMeasurement?.hedgeLengthMeters ?? totalSquareMeters
            : totalSquareMeters;

    const distributionPercentage = 100 / linkedPlantIds.length;
    const assignedMeasureValue = totalMeasureValue / linkedPlantIds.length;

    const rows: AdviceRow[] = linkedPlantIds.map((plantId) => {
        const projectPlant = plants.find((plant) => plant.id === plantId);
        const quantityPerSquareMeter = getPlantQuantityPerSquareMeter(projectPlant, plantId);

        const assignedCalculationSquareMeters =
            measurementMode === "length" && hedgeMeasurement?.hedgeWidthMeters
                ? assignedMeasureValue * hedgeMeasurement.hedgeWidthMeters
                : totalSquareMeters / linkedPlantIds.length;

        const adviceCount =
            quantityPerSquareMeter !== null
                ? Math.ceil(assignedCalculationSquareMeters * quantityPerSquareMeter)
                : null;

        return {
            plantId,
            ...getPlantDisplayNames(projectPlant, plantId),
            distributionPercentage,
            assignedMeasureValue,
            quantityPerSquareMeter,
            adviceCount,
        };
    });

    return {
        measurementMode,
        totalMeasureValue,
        totalSquareMeters,
        rows,
        totalAdviceCount: rows.reduce((total, row) => total + (row.adviceCount ?? 0), 0),
    };
}

function AdviceSummaryButton(props: {
    open: boolean;
    summaryText: string;
    totalAdviceCount: number;
    onToggle: () => void;
}) {
    const { open, summaryText, totalAdviceCount, onToggle } = props;

    return (
        <button
            type="button"
            className="w-full"
            onClick={onToggle}
            style={{
                minHeight: PANEL_UI.summaryHeight,
                padding: `0 ${PANEL_UI.summaryPaddingX}px`,
                border: open ? `1px solid ${COLORS.green}` : "1px solid transparent",
                borderRadius: 6,
                background: COLORS.greenLight,
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto auto",
                alignItems: "center",
                gap: PANEL_UI.summaryGap,
                cursor: "pointer",
                color: COLORS.green,
            }}
        >
            <span
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: PANEL_UI.summaryGap,
                    minWidth: 0,
                }}
            >
                <img
                    src="/icons/advies.svg"
                    alt=""
                    style={{
                        width: PANEL_UI.summaryIconSize,
                        height: PANEL_UI.summaryIconSize,
                        filter: ICON_FILTERS.green,
                        flex: "0 0 auto",
                    }}
                />

                <span
                    style={{
                        fontSize: PANEL_UI.summaryTitleFontSize,
                        fontWeight: PANEL_UI.summaryTitleFontWeight,
                        lineHeight: 1.2,
                        color: COLORS.green,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {summaryText}
                </span>
            </span>

            <span
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    minWidth: 96,
                    color: COLORS.green,
                    lineHeight: 1.05,
                }}
            >
                <span
                    style={{
                        fontSize: PANEL_UI.summaryTotalFontSize,
                        fontWeight: PANEL_UI.summaryTotalFontWeight,
                    }}
                >
                    {totalAdviceCount} stuks
                </span>
                <span
                    style={{
                        fontSize: PANEL_UI.summarySubTextFontSize,
                        fontWeight: 400,
                    }}
                >
                    in totaal
                </span>
            </span>

            <img
                src={open ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
                alt=""
                style={{
                    width: PANEL_UI.summaryChevronSize,
                    height: PANEL_UI.summaryChevronSize,
                }}
            />
        </button>
    );
}

function AdviceContentHeader(props: {
    measurementMode: AdviceMeasurementMode;
    totalMeasureValue: number;
}) {
    const { measurementMode, totalMeasureValue } = props;

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto auto",
                alignItems: "center",
                gap: 18,
                marginBottom: 18,
            }}
        >
            <div
                style={{
                    fontSize: PANEL_UI.titleFontSize,
                    fontWeight: PANEL_UI.titleFontWeight,
                    color: COLORS.text,
                    lineHeight: 1.2,
                }}
            >
                Advies aantal planten
            </div>

            {measurementMode === "length" && (
                <div
                    style={{
                        fontSize: PANEL_UI.measureNoteFontSize,
                        fontWeight: PANEL_UI.measureNoteFontWeight,
                        fontStyle: "italic",
                        color: COLORS.text,
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                    }}
                >
                    Het advies wordt berekend op de strekkende meter
                </div>
            )}

            <div
                style={{
                    minHeight: PANEL_UI.areaBadgeHeight,
                    padding: `0 ${PANEL_UI.areaBadgePaddingX}px`,
                    borderRadius: 6,
                    background: COLORS.greenLight,
                    color: COLORS.green,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: PANEL_UI.areaBadgeFontSize,
                    fontWeight: PANEL_UI.areaBadgeFontWeight,
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                }}
            >
                {formatAdviceMeasureValue(totalMeasureValue, measurementMode)}
            </div>
        </div>
    );
}

function AdviceTable(props: {
    rows: AdviceRow[];
    measurementMode: AdviceMeasurementMode;
}) {
    const { rows, measurementMode } = props;

    return (
        <div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: TABLE_GRID_TEMPLATE,
                    columnGap: PANEL_UI.tableColumnGap,
                    alignItems: "end",
                    paddingBottom: PANEL_UI.tableHeaderPaddingBottom,
                    borderBottom: `1px solid ${COLORS.border}`,
                    fontSize: PANEL_UI.tableHeaderFontSize,
                    fontWeight: PANEL_UI.tableHeaderFontWeight,
                    color: COLORS.text,
                }}
            >
                <div>Plant</div>
                <div>Verdeling</div>
                <div>{measurementMode === "length" ? "Toegewezen m" : "Toegewezen m²"}</div>
                <div style={{ textAlign: "center" }}>
                    <div>Planthoeveelheid</div>
                    <div
                        style={{
                            fontSize: PANEL_UI.tableHeaderSubFontSize,
                            fontWeight: 400,
                            marginTop: 4,
                        }}
                    >
                        (per m²)
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div>Advies</div>
                    <div
                        style={{
                            fontSize: PANEL_UI.tableHeaderSubFontSize,
                            fontWeight: 400,
                            marginTop: 4,
                        }}
                    >
                        (stuks)
                    </div>
                </div>
            </div>

            {rows.map((row) => (
                <div
                    key={row.plantId}
                    style={{
                        display: "grid",
                        gridTemplateColumns: TABLE_GRID_TEMPLATE,
                        columnGap: PANEL_UI.tableColumnGap,
                        alignItems: "center",
                        minHeight: PANEL_UI.tableRowMinHeight,
                        borderBottom: `1px solid ${COLORS.border}`,
                    }}
                >
                    <div
                        style={{
                            width: 260,
                            minWidth: 0,
                            whiteSpace: "normal",
                            overflowWrap: "break-word",
                            wordBreak: "break-word",
                        }}
                    >
                        <div
                            style={{
                                fontSize: PANEL_UI.plantNameFontSize,
                                fontWeight: PANEL_UI.plantNameFontWeight,
                                color: COLORS.text,
                                lineHeight: 1.15,
                            }}
                        >
                            {row.latinName}
                        </div>
                        <div
                            style={{
                                fontSize: PANEL_UI.plantSubNameFontSize,
                                fontWeight: 400,
                                color: COLORS.mutedText,
                                lineHeight: 1.2,
                                marginTop: 5,
                            }}
                        >
                            {row.dutchName}
                        </div>
                    </div>

                    <div
                        style={{
                            fontSize: PANEL_UI.highlightValueFontSize,
                            fontWeight: PANEL_UI.highlightValueFontWeight,
                            color: COLORS.orange,
                            lineHeight: 1,
                        }}
                    >
                        {Math.round(row.distributionPercentage)}%
                    </div>

                    <div
                        style={{
                            fontSize: PANEL_UI.valueFontSize,
                            fontWeight: PANEL_UI.valueFontWeight,
                            color: COLORS.text,
                            lineHeight: 1,
                        }}
                    >
                        {formatAdviceMeasureValue(row.assignedMeasureValue, measurementMode)}
                    </div>

                    <div
                        style={{
                            fontSize: PANEL_UI.valueFontSize,
                            fontWeight: PANEL_UI.valueFontWeight,
                            color: COLORS.text,
                            textAlign: "center",
                            lineHeight: 1,
                        }}
                    >
                        {row.quantityPerSquareMeter !== null
                            ? `${row.quantityPerSquareMeter}/m²`
                            : "-"}
                    </div>

                    <div
                        style={{
                            fontSize: PANEL_UI.highlightValueFontSize,
                            fontWeight: PANEL_UI.highlightValueFontWeight,
                            color: COLORS.orange,
                            textAlign: "right",
                            lineHeight: 1,
                        }}
                    >
                        {row.adviceCount !== null ? `${row.adviceCount} st.` : "-"}
                    </div>
                </div>
            ))}
        </div>
    );
}

function AdviceInfoBox() {
    return (
        <div
            style={{
                marginTop: PANEL_UI.infoMarginTop,
                minHeight: PANEL_UI.infoMinHeight,
                padding: `0 ${PANEL_UI.infoPaddingX}px`,
                borderRadius: 5,
                background: COLORS.infoBackground,
                border: `1px solid ${COLORS.infoBorder}`,
                color: COLORS.infoText,
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: PANEL_UI.infoFontSize,
                fontWeight: PANEL_UI.infoFontWeight,
                lineHeight: 1.35,
            }}
        >
            <img
                src="/icons/info.svg"
                alt=""
                style={{
                    width: PANEL_UI.infoIconSize,
                    height: PANEL_UI.infoIconSize,
                    filter: ICON_FILTERS.info,
                    flex: "0 0 auto",
                }}
            />
            <span>
                Dit is een advies. In de volgende stap kun je de aantallen zelf aanpassen.
            </span>
        </div>
    );
}

export default function PlantAdviceLabelPanel(props: PlantAdviceLabelPanelProps) {
    const {
        selectedObject,
        currentType,
        linkedPlantIds,
        borderRadius,
        shadow,
        borderColor,
    } = props;

    const [open, setOpen] = React.useState(false);
    const [contentHeight, setContentHeight] = React.useState(0);
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    const plants = useProjectStore((s) => s.plants as ProjectPlantLike[]);

    const isSupportedType = currentType === "plantbed" || currentType === "hedge";
    const adviceData = React.useMemo<AdviceData | null>(() => {
        if (!selectedObject || !isSupportedType || linkedPlantIds.length === 0) {
            return null;
        }

        return buildAdviceData({
            selectedObject,
            currentType,
            linkedPlantIds,
            plants,
        });
    }, [isSupportedType, linkedPlantIds, plants, selectedObject]);

    React.useEffect(() => {
        setOpen(false);
        setContentHeight(0);
    }, [selectedObject?.id]);

    React.useEffect(() => {
        if (!open) return;

        const updateHeight = () => {
            setContentHeight(contentRef.current?.scrollHeight ?? 0);
        };

        updateHeight();

        window.addEventListener("resize", updateHeight);
        return () => window.removeEventListener("resize", updateHeight);
    }, [open, adviceData]);

    const toggleAdvicePanel = () => {
        const currentHeight = contentRef.current?.scrollHeight ?? 0;

        if (open) {
            setContentHeight(currentHeight);

            requestAnimationFrame(() => {
                setContentHeight(0);
                setOpen(false);
            });

            return;
        }

        setOpen(true);

        requestAnimationFrame(() => {
            setContentHeight(contentRef.current?.scrollHeight ?? currentHeight);
        });
    };

    if (!adviceData) return null;

    const summaryText =
        currentType === "hedge"
            ? "Totaal advies voor deze haag"
            : "Totaal advies voor dit plantvak";

    return (
        <div
            className="border border-t-0 bg-white"
            style={{
                width: "100%",
                minWidth: PANEL_UI.minWidth,
                borderColor,
                borderRadius: `0 0 ${borderRadius}px ${borderRadius}px`,
                boxShadow: shadow,
                padding: PANEL_UI.padding,
                marginTop: -1,
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            <AdviceSummaryButton
                open={open}
                summaryText={summaryText}
                totalAdviceCount={adviceData.totalAdviceCount}
                onToggle={toggleAdvicePanel}
            />

            <div
                style={{
                    height: contentHeight,
                    overflow: "hidden",
                    opacity: open ? 1 : 0,
                    transform: open
                        ? "translateY(0)"
                        : `translateY(${PANEL_UI.animationOffsetY}px)`,
                    transition: [
                        `height ${PANEL_UI.animationMs}ms ${PANEL_UI.animationEase}`,
                        `opacity ${PANEL_UI.animationMs}ms ${PANEL_UI.animationEase}`,
                        `transform ${PANEL_UI.animationMs}ms ${PANEL_UI.animationEase}`,
                    ].join(", "),
                    pointerEvents: open ? "auto" : "none",
                }}
            >
                <div ref={contentRef}>
                    <div style={{ paddingTop: PANEL_UI.contentPaddingTop }}>
                        <AdviceContentHeader
                            measurementMode={adviceData.measurementMode}
                            totalMeasureValue={adviceData.totalMeasureValue}
                        />
                        <AdviceTable
                            rows={adviceData.rows}
                            measurementMode={adviceData.measurementMode}
                        />
                        <AdviceInfoBox />
                    </div>
                </div>
            </div>
        </div>
    );
}