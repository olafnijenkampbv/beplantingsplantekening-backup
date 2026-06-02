"use client";

import React from "react";
import type { ObjectType, PolyObject } from "@/state/projectStore";
import { useProjectStore } from "@/state/projectStore";
import { usePlantSelectionStore } from "@/features/editor/state/plantSelectionStore";
import {
    formatMeters,
    formatSquareMeters,
    getObjectAreaInSquareMeters,
} from "@/state/areaMetrics";
import {
    buildAdviceData,
    type AdviceData,
    type AdviceMeasurementMode,
    type AdviceRow,
    type ProjectPlantLike,
} from "@/features/editor/lib/plantAdvice";
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
    "260px minmax(105px, 0.7fr) minmax(140px, 0.9fr) minmax(170px, 1fr) minmax(115px, 0.7fr) minmax(130px, 0.8fr)";

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

function redistributeAfterChange(
    plantIds: string[],
    changedPlantId: string,
    newPercentage: number
): Record<string, number> {
    const clamped = Math.min(100, Math.max(0, newPercentage));
    const remaining = 100 - clamped;
    const otherIds = plantIds.filter((id) => id !== changedPlantId);

    if (otherIds.length === 0) {
        return { [changedPlantId]: 100 };
    }

    const perOther = remaining / otherIds.length;
    const result: Record<string, number> = { [changedPlantId]: clamped };
    for (const id of otherIds) {
        result[id] = perOther;
    }
    return result;
}

function AdviceTable(props: {
    rows: AdviceRow[];
    measurementMode: AdviceMeasurementMode;
    onDistributionChange: (plantId: string, newPercentage: number) => void;
    priceMap: Map<string, number>;
}) {
    const { rows, measurementMode, onDistributionChange, priceMap } = props;

    const [editingPlantId, setEditingPlantId] = React.useState<string | null>(null);
    const [editValue, setEditValue] = React.useState<string>("");
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const startEdit = (plantId: string, currentPercentage: number) => {
        setEditingPlantId(plantId);
        setEditValue(String(Math.round(currentPercentage)));
        setTimeout(() => {
            inputRef.current?.select();
        }, 0);
    };

    const commitEdit = (plantId: string) => {
        const parsed = parseFloat(editValue.replace(",", "."));
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
            onDistributionChange(plantId, parsed);
        }
        setEditingPlantId(null);
        setEditValue("");
    };

    const handleKeyDown = (e: React.KeyboardEvent, plantId: string) => {
        if (e.key === "Enter") {
            commitEdit(plantId);
        }
        if (e.key === "Escape") {
            setEditingPlantId(null);
            setEditValue("");
        }
    };

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
                <div style={{ textAlign: "right" }}>
                    <div>Prijs</div>
                    <div
                        style={{
                            fontSize: PANEL_UI.tableHeaderSubFontSize,
                            fontWeight: 400,
                            marginTop: 4,
                        }}
                    >
                        (p/st + totaal)
                    </div>
                </div>
            </div>

            {rows.map((row) => {
                const isEditing = editingPlantId === row.plantId;
                const isOnlyRow = rows.length === 1;

                return (
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
                        {/* Plant naam */}
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

                        {/* Verdeling cel */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                lineHeight: 1,
                            }}
                        >
                            {isEditing ? (
                                <input
                                    ref={inputRef}
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => commitEdit(row.plantId)}
                                    onKeyDown={(e) => handleKeyDown(e, row.plantId)}
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    style={{
                                        width: 60,
                                        fontSize: PANEL_UI.highlightValueFontSize,
                                        fontWeight: PANEL_UI.highlightValueFontWeight,
                                        color: COLORS.orange,
                                        border: `1px solid ${COLORS.border}`,
                                        borderRadius: 4,
                                        padding: "2px 6px",
                                        outline: "none",
                                        background: "#fff",
                                    }}
                                    autoFocus
                                />
                            ) : (
                                <span
                                    style={{
                                        fontSize: PANEL_UI.highlightValueFontSize,
                                        fontWeight: PANEL_UI.highlightValueFontWeight,
                                        color: COLORS.orange,
                                    }}
                                >
                                    {Math.round(row.distributionPercentage)}%
                                </span>
                            )}

                            {!isEditing && !isOnlyRow && (
                                <button
                                    type="button"
                                    title="Verdeling aanpassen"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        startEdit(row.plantId, row.distributionPercentage);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        padding: 2,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        borderRadius: 3,
                                        opacity: 0.55,
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLButtonElement).style.opacity = "0.55";
                                    }}
                                >
                                    <img
                                        src="/icons/edit.svg"
                                        alt="Bewerk verdeling"
                                        style={{
                                            width: 28,
                                            height: 28,
                                            display: "block",
                                        }}
                                    />
                                </button>
                            )}
                        </div>

                        {/* Toegewezen m² / m */}
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

                        {/* Planthoeveelheid */}
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

                        {/* Advies */}
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

                        {/* Prijs */}
                        <div
                            style={{
                                textAlign: "right",
                                lineHeight: 1.4,
                            }}
                        >
                            {(() => {
                                const price = priceMap.get(row.plantId);
                                if (typeof price !== "number") {
                                    return (
                                        <span
                                            style={{
                                                fontSize: PANEL_UI.valueFontSize,
                                                color: COLORS.mutedText,
                                            }}
                                        >
                                            -
                                        </span>
                                    );
                                }

                                const priceFormatted = `€\u00a0${price.toLocaleString("nl-NL", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })} p/st`;

                                const totalPrice =
                                    row.adviceCount !== null ? price * row.adviceCount : null;

                                const totalFormatted =
                                    totalPrice !== null
                                        ? `€\u00a0${totalPrice.toLocaleString("nl-NL", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}`
                                        : null;

                                return (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        <span
                                            style={{
                                                fontSize: PANEL_UI.valueFontSize,
                                                fontWeight: PANEL_UI.valueFontWeight,
                                                color: COLORS.text,
                                            }}
                                        >
                                            {priceFormatted}
                                        </span>
                                        {totalFormatted !== null && (
                                            <span
                                                style={{
                                                    fontSize: PANEL_UI.highlightValueFontSize,
                                                    fontWeight: PANEL_UI.highlightValueFontWeight,
                                                    color: COLORS.orange,
                                                }}
                                            >
                                                {totalFormatted}
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                );
            })}
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
    const allDistributionOverrides = useProjectStore(
        (s) => (s as any).distributionOverrides as Record<string, Record<string, number>>
    );

    const distributionOverrides = React.useMemo(
        () => allDistributionOverrides[selectedObject?.id ?? ""] ?? {},
        [allDistributionOverrides, selectedObject?.id]
    );
    const setDistributionOverridesForObject = useProjectStore((s: any) => s.setDistributionOverridesForObject);

    const plants = useProjectStore((s) => s.plants as ProjectPlantLike[]);

const plantListItems = usePlantSelectionStore((s) => s.plantListItems);

    const priceMap = React.useMemo(() => {
        const map = new Map<string, number>();
        for (const item of plantListItems) {
            const price = item.plant.pricePerPiece;
            if (typeof price === "number" && Number.isFinite(price)) {
                map.set(item.id, price);
            }
        }
        return map;
    }, [plantListItems]);

    const isSupportedType = currentType === "plantbed" || currentType === "hedge" || currentType === "treebed";
    const adviceData = React.useMemo<AdviceData | null>(() => {
        if (!selectedObject || !isSupportedType || linkedPlantIds.length === 0) {
            return null;
        }

        return buildAdviceData({
            selectedObject,
            currentType,
            linkedPlantIds,
            plants,
            distributionOverrides: Object.keys(distributionOverrides).length > 0
                ? distributionOverrides
                : undefined,
        });
    }, [isSupportedType, linkedPlantIds, plants, selectedObject, distributionOverrides, plantListItems]);

    const handleDistributionChange = React.useCallback(
        (plantId: string, newPercentage: number) => {
            if (!selectedObject) return;
            const newOverrides = redistributeAfterChange(linkedPlantIds, plantId, newPercentage);
            setDistributionOverridesForObject(selectedObject.id, newOverrides);
        },
        [linkedPlantIds, selectedObject, setDistributionOverridesForObject]
    );

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
                            onDistributionChange={handleDistributionChange}
                            priceMap={priceMap}
                        />
                        <AdviceInfoBox />
                    </div>
                </div>
            </div>
        </div>
    );
}