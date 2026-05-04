"use client";

import React from "react";
import type { CSSProperties } from "react";
import type { ObjectType, TreebedVariant } from "@/state/projectStore";
import { OBJECT_STYLES, useProjectStore } from "@/state/projectStore";
import ObjectColorPanel from "@/features/editor/components/editor/ObjectColorPanel";
import { getObjectMenuSections } from "@/features/editor/components/editor/objectMenuConfig";
import { useRightStepMenuStore } from "@/features/editor/state/rightStepMenuStore";
import TreebedVariantSwatch from "@/features/editor/components/TreebedVariantSwatch";
import { isBuildingObjectType } from "@/features/editor/components/editor/objectMenuConfig";
import PlantAdviceLabelPanel from "@/features/editor/components/editor/PlantAdviceLabelPanel";

const COLORS = {
    orange: "#E94E1B",
    green: "#58694C",
    greenLight: "#EEF0ED",
};

export const LABEL_UI = {
    paddingX: 28,
    paddingY: 20,
    gap: 30,
    radius: 14,

    fontSizeTitle: 24,
    fontWeightTitle: 700,

    fontSizeAction: 22,
    fontWeightAction: 400,

    swatchSize: 18,
    swatchRadius: 3,

    badgeSize: 30,
    badgeFontSize: 16,

    shadow: "0px 3px 8px 0px rgba(0,0,0,0.25)",
    borderColor: "#E3E2E2",
};

export function getTypeLabelCardEstimatedSize({
    labelText,
    badgeCount,
    interactive,
}: {
    labelText: string;
    badgeCount: number | null;
    interactive: boolean;
}) {
    const textWidth = Math.max(
        40,
        Math.ceil(labelText.length * LABEL_UI.fontSizeTitle * 0.58)
    );

    const badgeWidth = badgeCount !== null ? LABEL_UI.badgeSize + 8 : 0;

    const leftBlockWidth =
        LABEL_UI.swatchSize +
        10 +
        textWidth +
        badgeWidth;

    const dividerWidth = 1;

    const duplicateWidth = interactive ? 110 : 0;
    const changeWidth = interactive ? 120 : 0;
    const interactiveWidth = interactive
        ? LABEL_UI.gap +
        dividerWidth +
        LABEL_UI.gap +
        duplicateWidth +
        LABEL_UI.gap +
        dividerWidth +
        LABEL_UI.gap +
        changeWidth
        : 0;

    const width =
        LABEL_UI.paddingX * 2 +
        leftBlockWidth +
        interactiveWidth;

    const height =
        LABEL_UI.paddingY * 2 +
        Math.max(LABEL_UI.fontSizeTitle, LABEL_UI.badgeSize);

    return {
        width,
        height,
    };
}

const isBoundaryType = (type: ObjectType) => {
    return type === "fence" || type === "gate" || type === "poort";
};

const isTypeChangeAllowed = (fromType: ObjectType, toType: ObjectType) => {
    if (fromType === toType) return false;

    const fromIsTreebed = fromType === "treebed";
    const toIsTreebed = toType === "treebed";

    // boomvak blijft een eigen familie en loopt niet via algemene typewijziging
    if (fromIsTreebed !== toIsTreebed) {
        return false;
    }

    const fromIsBoundary = isBoundaryType(fromType);
    const toIsBoundary = isBoundaryType(toType);

    // afbakening mag alleen naar afbakening, en niet naar andere families
    if (fromIsBoundary !== toIsBoundary) {
        return false;
    }

    return true;
};

const EMPTY_LINKED_PLANT_IDS: string[] = [];

type TypeLabelCardProps = {
    currentType: ObjectType;
    currentTreebedVariant?: TreebedVariant;
    currentCustomStyle?: Partial<(typeof OBJECT_STYLES)[ObjectType]>;
    labelText: string;
    badgeCount: number | null;
    interactive?: boolean;
    pointerSide?: "bottom" | "left" | "right";
    onDuplicate?: () => void;
    onChangeType?: (t: ObjectType) => void;
    onChangeTreebedVariant?: (variant: TreebedVariant) => void;
    onTreebedVariantChanged?: (fromVariant: TreebedVariant, toVariant: TreebedVariant) => void;
};

export default function TypeLabelCard(props: TypeLabelCardProps) {
    const {
        currentType,
        currentTreebedVariant = "standard",
        currentCustomStyle,
        labelText,
        badgeCount,
        interactive = false,
        pointerSide = "bottom",
        onDuplicate,
        onChangeType,
        onChangeTreebedVariant,
        onTreebedVariantChanged,
    } = props;

    const [openPanel, setOpenPanel] = React.useState<"object" | "color" | null>(null);
    const [hoverType, setHoverType] = React.useState<ObjectType | TreebedVariant | null>(null);

    const selectedLocationType = useRightStepMenuStore((s) => s.step1.locationType);

    const selectedObjectId = useProjectStore((s) => s.selectedObjectId);
    const selectedObject = useProjectStore((s) =>
        selectedObjectId ? s.objects.find((object) => object.id === selectedObjectId) ?? null : null
    );
    const updateObjectStyle = useProjectStore((s) => s.updateObjectStyle);
    const resetObjectStyle = useProjectStore((s) => s.resetObjectStyle);
    const linkedPlantIdsForAdvice = useProjectStore((s: any) => {
        if (!selectedObjectId) return EMPTY_LINKED_PLANT_IDS;

        return s.plantbedLinks?.[selectedObjectId] ?? EMPTY_LINKED_PLANT_IDS;
    });

    const canShowAdvicePanel =
        interactive &&
        selectedObject !== null &&
        (currentType === "plantbed" || currentType === "hedge") &&
        linkedPlantIdsForAdvice.length > 0;

    const currentStyle = {
        ...OBJECT_STYLES[currentType],
        ...(currentCustomStyle ?? (interactive ? selectedObject?.customStyle : {}) ?? {}),
    };

    const canChangeColor = currentType === "plantbed";

    React.useEffect(() => {
        if (!openPanel) return;

        const onDown = () => setOpenPanel(null);
        window.addEventListener("mousedown", onDown);

        return () => window.removeEventListener("mousedown", onDown);
    }, [openPanel]);

    const treebedLabelParts = React.useMemo(() => {
        if (currentType !== "treebed") return null;

        const match = /^Boomvak(?:\s*\((.+)\))?$/.exec(labelText);
        if (!match) {
            return { base: labelText, variant: null as string | null };
        }

        return {
            base: "Boomvak",
            variant: match[1] ?? null,
        };
    }, [currentType, labelText]);

    const GROUPS = React.useMemo(() => {
        const isTreebed = currentType === "treebed";

        if (isTreebed) {
            return [];
        }

        return getObjectMenuSections(selectedLocationType).map((section) => ({
            title: section.label,
            items: section.items,
        }));
    }, [currentType, selectedLocationType]);

    const GROUPS_FILTERED = React.useMemo(() => {
        return GROUPS
            .map((g) => ({
                ...g,
                items: g.items.filter((item) =>
                    isTypeChangeAllowed(currentType, item.id)
                ),
            }))
            .filter((g) => g.items.length > 0);
    }, [GROUPS, currentType]);

    const TREEBED_VARIANTS = React.useMemo(
        () =>
            ([
                { key: "standard", label: "Standaard" },
                { key: "multi_stem", label: "Meerstammig" },
                { key: "espalier", label: "Leivorm" },
                { key: "roof", label: "Dakvorm" },
            ] as const).filter((item) => item.key !== currentTreebedVariant),
        [currentTreebedVariant]
    );

    const Swatch = ({ type }: { type: ObjectType }) => {
        const s =
            type === currentType
                ? {
                    ...OBJECT_STYLES[type],
                    ...(currentCustomStyle ?? (interactive ? selectedObject?.customStyle : {}) ?? {}),
                }
                : OBJECT_STYLES[type];

        const isBuilding = isBuildingObjectType(type);

        const isTreebed = type === "treebed";

        const withAlpha = (color: string, alpha: number) => {
            if (color.startsWith("rgba(")) {
                return color.replace(/rgba\(([^)]+),\s*[\d.]+\)/, `rgba($1, ${alpha})`);
            }

            if (color.startsWith("rgb(")) {
                const match = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
                if (match) {
                    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
                }
            }

            if (color.startsWith("#")) {
                const hex = color.slice(1);
                const normalized =
                    hex.length === 3
                        ? hex.split("").map((ch) => ch + ch).join("")
                        : hex;

                if (normalized.length === 6) {
                    const r = parseInt(normalized.slice(0, 2), 16);
                    const g = parseInt(normalized.slice(2, 4), 16);
                    const b = parseInt(normalized.slice(4, 6), 16);
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                }
            }

            return color;
        };

        return (
            <span
                style={{
                    width: LABEL_UI.swatchSize,
                    height: LABEL_UI.swatchSize,
                    borderRadius: isTreebed ? "999px" : LABEL_UI.swatchRadius,
                    backgroundColor: isTreebed ? withAlpha(s.fill, 0.6) : s.fill,
                    border: `1px solid ${s.stroke}`,
                    display: "inline-block",
                    flex: "0 0 auto",
                    backgroundImage: isBuilding
                        ? `linear-gradient(
                        135deg,
                        transparent 0%,
                        transparent 35%,
                        ${s.stroke} 35%,
                        ${s.stroke} 40%,
                        transparent 40%,
                        transparent 60%,
                        ${s.stroke} 60%,
                        ${s.stroke} 65%,
                        transparent 65%,
                        transparent 100%
                    )`
                        : undefined,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "100% 100%",
                    backgroundPosition: "center",
                }}
            />
        );
    };

    const actionButtonStyle: CSSProperties = {
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: "#000000",
        fontSize: LABEL_UI.fontSizeAction,
        fontWeight: LABEL_UI.fontWeightAction,
        lineHeight: 1,
        whiteSpace: "nowrap",
    };

    const dividerStyle: CSSProperties = {
        width: 1,
        alignSelf: "stretch",
        background: LABEL_UI.borderColor,
        opacity: 1,
    };

    return (
        <div
            className="relative"
            style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "stretch",
                position: "relative",
                zIndex: openPanel ? 1600 : 1100,
            }}
        >
            <div
                className="flex items-center border"
                style={{
                    background: "#ffffff",
                    borderColor: LABEL_UI.borderColor,
                    padding: `${LABEL_UI.paddingY}px ${LABEL_UI.paddingX}px`,
                    gap: LABEL_UI.gap,
                    borderRadius: canShowAdvicePanel
                        ? `${LABEL_UI.radius}px ${LABEL_UI.radius}px 0 0`
                        : LABEL_UI.radius,
                    boxShadow: LABEL_UI.shadow,
                    alignItems: "center",
                }}
                onMouseDown={(e) => {
                    if (!interactive) return;
                    e.stopPropagation();
                }}
                onClick={(e) => {
                    if (!interactive) return;
                    e.stopPropagation();
                }}
            >
                <div
                    className="flex items-center"
                    style={{ gap: 10, alignItems: "center" }}
                >
                    {currentType === "treebed" ? (
                        <TreebedVariantSwatch
                            variant={currentTreebedVariant ?? "standard"}
                            size={LABEL_UI.swatchSize}
                        />
                    ) : (
                        <Swatch type={currentType} />
                    )}

                    <div
                        style={{
                            fontWeight: LABEL_UI.fontWeightTitle,
                            fontSize: LABEL_UI.fontSizeTitle,
                            lineHeight: 1,
                            color: "#000000",
                            whiteSpace: "nowrap",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        {treebedLabelParts ? (
                            <span
                                style={{
                                    display: "inline-flex",
                                    alignItems: "baseline",
                                    gap: 8,
                                    lineHeight: 1,
                                }}
                            >
                                <span>{treebedLabelParts.base}</span>

                                {treebedLabelParts.variant && (
                                    <span
                                        style={{
                                            fontSize: LABEL_UI.fontSizeAction,
                                            fontWeight: LABEL_UI.fontWeightAction,
                                            lineHeight: 1,
                                        }}
                                    >
                                        ({treebedLabelParts.variant})
                                    </span>
                                )}
                            </span>
                        ) : (
                            labelText
                        )}

                        {badgeCount !== null && (
                            <span
                                style={{
                                    width: LABEL_UI.badgeSize,
                                    height: LABEL_UI.badgeSize,
                                    borderRadius: 999,
                                    background: badgeCount > 0 ? COLORS.orange : "#FFE5DD",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: badgeCount > 0 ? "#ffffff" : COLORS.orange,
                                    fontWeight: 700,
                                    fontSize: LABEL_UI.badgeFontSize,
                                    lineHeight: 1,
                                }}
                            >
                                {badgeCount}
                            </span>
                        )}
                        
                    </div>
                </div>

                {interactive && (
                    <>
                        <div style={dividerStyle} />

                        <button
                            type="button"
                            style={actionButtonStyle}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onDuplicate?.();
                            }}
                        >
                            <img
                                src="/icons/duplicate.svg"
                                alt=""
                                style={{ width: 18, height: 18 }}
                            />
                            Dupliceren
                        </button>

                        <div style={dividerStyle} />

                        <button
                            type="button"
                            style={actionButtonStyle}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpenPanel((value) => value === "object" ? null : "object");
                            }}
                        >
                            {currentType === "treebed" ? "Wijzig boomvorm" : "Wijzig object"}
                            <img
                                src="/icons/chevron-right.svg"
                                alt=""
                                style={{
                                    width: 14,
                                    height: 14,
                                    transform: openPanel === "object" ? "rotate(90deg)" : "rotate(0deg)",
                                    transition: "transform 120ms ease",
                                }}
                            />
                        </button>

                        {canChangeColor && (
                            <>
                                <div style={dividerStyle} />

                                <button
                                    type="button"
                                    style={actionButtonStyle}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenPanel((value) => value === "color" ? null : "color");
                                    }}
                                >
                                    Wijzig kleur
                                    <img
                                        src="/icons/chevron-right.svg"
                                        alt=""
                                        style={{
                                            width: 14,
                                            height: 14,
                                            transform: openPanel === "color" ? "rotate(90deg)" : "rotate(0deg)",
                                            transition: "transform 120ms ease",
                                        }}
                                    />
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>

            {canShowAdvicePanel && (
                <PlantAdviceLabelPanel
                    selectedObject={selectedObject}
                    currentType={currentType}
                    labelText={labelText}
                    linkedPlantIds={linkedPlantIdsForAdvice}
                    borderRadius={LABEL_UI.radius}
                    shadow={LABEL_UI.shadow}
                    borderColor={LABEL_UI.borderColor}
                />
            )}

            {pointerSide === "bottom" && (
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        bottom: -10,
                        width: 0,
                        height: 0,
                        transform: "translateX(-50%)",
                        borderLeft: "9px solid transparent",
                        borderRight: "9px solid transparent",
                        borderTop: "10px solid #ffffff",
                        filter: "drop-shadow(0px 3px 8px rgba(0,0,0,0.25))",
                        pointerEvents: "none",
                    }}
                />
            )}

            {pointerSide === "left" && (
                <div
                    style={{
                        position: "absolute",
                        left: -10,
                        top: "50%",
                        width: 0,
                        height: 0,
                        transform: "translateY(-50%)",
                        borderTop: "9px solid transparent",
                        borderBottom: "9px solid transparent",
                        borderRight: "10px solid #ffffff",
                        filter: "drop-shadow(0px 3px 8px rgba(0,0,0,0.25))",
                        pointerEvents: "none",
                    }}
                />
            )}

            {pointerSide === "right" && (
                <div
                    style={{
                        position: "absolute",
                        right: -10,
                        top: "50%",
                        width: 0,
                        height: 0,
                        transform: "translateY(-50%)",
                        borderTop: "9px solid transparent",
                        borderBottom: "9px solid transparent",
                        borderLeft: "10px solid #ffffff",
                        filter: "drop-shadow(0px 3px 8px rgba(0,0,0,0.25))",
                        pointerEvents: "none",
                    }}
                />
            )}

            {interactive && openPanel === "object" && (
                <div
                    className="absolute rounded-xl border bg-white overflow-hidden"
                    style={{
                        zIndex: 1700,
                        borderColor: LABEL_UI.borderColor,
                        width: 300,
                        left: "calc(100% + 14px)",
                        top: 0,
                        boxShadow: LABEL_UI.shadow,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    {currentType === "treebed" ? (
                        <div>
                            <div
                                style={{
                                    background: COLORS.greenLight,
                                    color: COLORS.green,
                                    fontSize: 22,
                                    fontWeight: 600,
                                    padding: "10px 12px",
                                }}
                            >
                                Boomvorm
                            </div>

                            {TREEBED_VARIANTS.map((item) => {
                                const hovered = hoverType === item.key;

                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            padding: "12px 12px",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            background: hovered ? "#f2f2f2" : "#ffffff",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "#000000",
                                            fontSize: 20,
                                            fontWeight: 400,
                                            lineHeight: 1,
                                        }}
                                        onMouseEnter={() => setHoverType(item.key)}
                                        onMouseLeave={() => setHoverType(null)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenPanel(null);

                                            const fromVariant = currentTreebedVariant ?? "standard";
                                            const toVariant = item.key;

                                            onChangeTreebedVariant?.(toVariant);

                                            if (fromVariant !== toVariant) {
                                                onTreebedVariantChanged?.(fromVariant, toVariant);
                                            }
                                        }}
                                    >
                                        <TreebedVariantSwatch variant={item.key} size={LABEL_UI.swatchSize} />
                                        <span style={{ display: "flex", alignItems: "center", lineHeight: 1 }}>
                                            {item.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                            GROUPS_FILTERED.map((g) => (
                                <div key={g.title}>
                                    <div
                                        style={{
                                            background: COLORS.greenLight,
                                            color: COLORS.green,
                                            fontSize: 22,
                                            fontWeight: 600,
                                            padding: "10px 12px",
                                        }}
                                    >
                                        {g.title}
                                    </div>

                                    {g.items.map((item) => {
                                        const hovered = hoverType === item.id;

                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                style={{
                                                    width: "100%",
                                                    textAlign: "left",
                                                    padding: "12px 12px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                    background: hovered ? "#f2f2f2" : "#ffffff",
                                                    border: "none",
                                                    cursor: "pointer",
                                                    color: "#000000",
                                                    fontSize: 20,
                                                    fontWeight: 400,
                                                    lineHeight: 1,
                                                }}
                                                onMouseEnter={() => setHoverType(item.id)}
                                                onMouseLeave={() => setHoverType(null)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenPanel(null);
                                                    onChangeType?.(item.id);
                                                }}
                                            >
                                                <Swatch type={item.id} />
                                                <span style={{ display: "flex", alignItems: "center", lineHeight: 1 }}>
                                                    {item.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))
                    )}
                </div>
            )}
            {interactive && canChangeColor && openPanel === "color" && selectedObject && (
                <ObjectColorPanel
                    labelText={labelText}
                    currentType={currentType}
                    fill={currentStyle.fill}
                    stroke={currentStyle.stroke}
                    onApply={(style) => {
                        updateObjectStyle(selectedObject.id, style);
                    }}
                    onClose={() => {
                        setOpenPanel(null);
                    }}
                />
            )}
        </div>
    );
}