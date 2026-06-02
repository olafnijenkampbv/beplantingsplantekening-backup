import React from "react";
import { Group, Layer, Line, Text } from "react-konva";
import { PolyObject, OBJECT_STYLES, ObjectType } from "@/state/projectStore";
import { renderObjectPattern } from "@/features/editor/lib/objectPatterns";
import { isUnifiedBoundaryType, getBoundaryBandShapeForObject } from "@/features/editor/lib/boundarySystem";
import { bboxFromPoints, estimateTextWidth } from "@/features/editor/lib/editorCanvasMath";
import {
    PolygonWithHoles,
    isBuildingType,
    getBuildingPatternCanvas,
} from "@/features/editor/lib/editorCanvasPrimitives";

type PlantbedNumberLayout = {
    text: string;
    fontSize: number;
    x: number;
    y: number;
    width: number;
    areaText: string;
    areaFontSize: number;
    areaRotation: 0 | -90;
    areaX: number;
    areaY: number;
};

type BaseFillLayerProps = {
    unselectedNonPlantbeds: PolyObject[];
    unselectedPlantbeds: PolyObject[];
    objects: PolyObject[];
    stageRef: React.MutableRefObject<any>;
    activeTool: "select" | "draw" | "hand" | "cut" | "measure";
    isPanning: boolean;
    stageScale: number;
    viewVisibility: {
        showPlantNumbers: boolean;
        showAreaLabels: boolean;
        showGround: boolean;
        showBuildings: boolean;
        showBoundaries: boolean;
        showPlantbeds: boolean;
        showTreebeds: boolean;
    };
    plantbedNumberLayouts: Map<string, PlantbedNumberLayout>;
    pendingPlantbedClickRef: React.MutableRefObject<{
        id: string;
        startClientX: number;
        startClientY: number;
    } | null>;
    plantbedClickMovedRef: React.MutableRefObject<boolean>;
    handleObjectSelection: (clickedId: string, evt?: any) => void;
    getOneSidedPolylineRenderPoints: (
        points: number[],
        strokeWidth: number,
        side?: 1 | -1
    ) => number[];
    inferPolylineRenderSide: (
        points: number[],
        type: ObjectType,
        objects: PolyObject[],
        fallback?: 1 | -1
    ) => 1 | -1;
};

function getObjectRenderStyle(object: PolyObject) {
    return {
        ...OBJECT_STYLES[object.type],
        ...(object.customStyle ?? {}),
    };
}

function getReadablePlantbedLabelColor(fillColor: string) {
    const hex = fillColor.trim().replace("#", "");

    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        return "#3F6B3F";
    }

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    const luminance =
        (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    const darken = (value: number) =>
        Math.max(0, Math.round(value * 0.55));

    const lighten = (value: number) =>
        Math.min(255, Math.round(value + (255 - value) * 0.55));

    if (hex.toUpperCase() === "F2FDEF") {
        return "#3F6B3F";
    }

    const rr = luminance > 0.62 ? darken(r) : lighten(r);
    const gg = luminance > 0.62 ? darken(g) : lighten(g);
    const bb = luminance > 0.62 ? darken(b) : lighten(b);

    const toHex = (value: number) =>
        value.toString(16).padStart(2, "0").toUpperCase();

    return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

// React.memo prevents re-renders when props haven't changed.
// During panning and object dragging, objects/layouts don't change → layer stays frozen,
// which means Konva doesn't redraw these shapes and the canvas stays smooth.
export default React.memo(function BaseFillLayer({
    unselectedNonPlantbeds,
    unselectedPlantbeds,
    objects,
    stageRef,
    activeTool,
    isPanning,
    stageScale,
    viewVisibility,
    plantbedNumberLayouts,
    pendingPlantbedClickRef,
    plantbedClickMovedRef,
    handleObjectSelection,
    getOneSidedPolylineRenderPoints,
    inferPolylineRenderSide,
}: BaseFillLayerProps) {
    return (
        <Layer>
            {/* Fills voor unselected non-plantbeds (GEEN stroke!) */}
            {unselectedNonPlantbeds.map((obj) => {
                const hasHoles = (obj.holes?.length ?? 0) > 0;
                const isUnifiedBoundary = isUnifiedBoundaryType(obj.type);
                const boundaryBandShape = isUnifiedBoundary
                    ? getBoundaryBandShapeForObject(obj)
                    : null;
                const patternImage = isBuildingType(obj.type)
                    ? getBuildingPatternCanvas(obj.type)
                    : undefined;

                const common = {
                    draggable: false,
                    listening: true,
                    perfectDrawEnabled: false,
                    onMouseEnter: () => {
                        const st = stageRef.current;
                        if (!st) return;

                        if (isPanning) {
                            st.container().style.cursor = "grabbing";
                            return;
                        }

                        if (activeTool === "draw" || activeTool === "cut" || activeTool === "measure") st.container().style.cursor = "crosshair";
                        else if (activeTool === "select") st.container().style.cursor = "pointer";
                        else if (activeTool === "hand") st.container().style.cursor = "grab";
                        else st.container().style.cursor = "default";
                    },
                    onMouseLeave: () => {
                        const st = stageRef.current;
                        if (!st) return;

                        st.container().style.cursor = isPanning
                            ? "grabbing"
                            : activeTool === "hand"
                                ? "grab"
                                : activeTool === "select"
                                    ? "default"
                                    : activeTool === "draw" || activeTool === "cut" || activeTool === "measure"
                                        ? "crosshair"
                                        : "default";
                    },
                    onMouseDown: (evt: any) => {
                        if (evt?.evt?.button === 1) {
                            return;
                        }

                        if (activeTool !== "select") return;
                        evt.cancelBubble = true;

                        const multi = !!(evt.evt?.ctrlKey || evt.evt?.metaKey);

                        // Zelfde klikvoorbereiding als plantvakken:
                        // bij single click mag HelloEditor na mouse-up de gekoppelde sidebar-sectie openen
                        if (!multi) {
                            pendingPlantbedClickRef.current = {
                                id: obj.id,
                                startClientX: evt.evt?.clientX ?? 0,
                                startClientY: evt.evt?.clientY ?? 0,
                            };
                            plantbedClickMovedRef.current = false;
                        } else {
                            pendingPlantbedClickRef.current = null;
                            plantbedClickMovedRef.current = false;
                        }

                        handleObjectSelection(obj.id, evt.evt);
                    },
                    onClick: (evt: any) => {
                        if (evt?.evt?.button === 1 || isPanning) {
                            evt.cancelBubble = true;
                            return;
                        }

                        if (activeTool !== "select") return;
                        evt.cancelBubble = true;
                    },
                };

                const objectStyle = getObjectRenderStyle(obj);

                if (isUnifiedBoundary && boundaryBandShape && boundaryBandShape.outer.length >= 6) {
                    return (
                        <React.Fragment key={`boundary-fill-${obj.id}`}>
                            <PolygonWithHoles
                                {...common}
                                points={boundaryBandShape.outer}
                                holes={boundaryBandShape.holes}
                                fill={objectStyle.fill}
                                fillPriority="color"
                                stroke={undefined}
                                strokeWidth={0}
                            />
                        </React.Fragment>
                    );
                }

                if (hasHoles) {
                    return (
                        <React.Fragment key={`fill-${obj.id}`}>
                            <PolygonWithHoles
                                {...common}
                                points={obj.points}
                                holes={obj.holes}
                                bulges={obj.bulges}
                                fill={patternImage ? undefined : objectStyle.fill}
                                fillPriority={patternImage ? "pattern" : "color"}
                                fillPatternImage={patternImage as unknown as HTMLImageElement | undefined}
                                fillPatternRepeat={patternImage ? "repeat" : undefined}
                                stroke={undefined}
                                strokeWidth={0}
                            />
                            {renderObjectPattern(
                                obj,
                                `fill-pattern-${obj.id}`,
                                stageScale,
                                obj.points,
                                obj.holes
                            )}
                        </React.Fragment>
                    );
                }

                if (obj.type === "treebed") {
                    return null;
                }

                if (isBuildingType(obj.type)) {
                    const hasBulges = obj.bulges?.some((b) => Math.abs(b) > 0.004);
                    return (
                        <React.Fragment key={`fill-${obj.id}`}>
                            {hasBulges ? (
                                <PolygonWithHoles
                                    {...common}
                                    points={obj.points}
                                    holes={[]}
                                    bulges={obj.bulges}
                                    fill={undefined}
                                    fillPriority="pattern"
                                    fillPatternImage={
                                        getBuildingPatternCanvas(obj.type) as unknown as HTMLImageElement | undefined
                                    }
                                    fillPatternRepeat="repeat"
                                    stroke={undefined}
                                    strokeWidth={0}
                                />
                            ) : (
                                <Line
                                    {...common}
                                    points={obj.points}
                                    closed
                                    fill={undefined}
                                    fillEnabled
                                    fillPriority="pattern"
                                    fillPatternImage={
                                        getBuildingPatternCanvas(obj.type) as unknown as HTMLImageElement | undefined
                                    }
                                    fillPatternRepeat="repeat"
                                    strokeEnabled={false}
                                />
                            )}
                            {renderObjectPattern(obj, `fill-pattern-${obj.id}`, stageScale)}
                        </React.Fragment>
                    );
                }

                // ✅ BOGEN — gebruik PolygonWithHoles als het object bogen heeft
                const hasBulges = obj.bulges?.some((b) => Math.abs(b) > 0.004);
                return (
                    <React.Fragment key={`fill-${obj.id}`}>
                        {hasBulges ? (
                            <PolygonWithHoles
                                {...common}
                                points={obj.points}
                                holes={[]}
                                bulges={obj.bulges}
                                fill={objectStyle.fill}
                                fillPriority="color"
                                stroke={undefined}
                                strokeWidth={0}
                            />
                        ) : (
                            <Line
                                {...common}
                                points={obj.points}
                                closed
                                fill={objectStyle.fill}
                                fillEnabled
                                fillPriority="color"
                                strokeEnabled={false}
                            />
                        )}
                        {renderObjectPattern(obj, `fill-pattern-${obj.id}`, stageScale)}
                    </React.Fragment>
                );
            })}

            {/* Plantbed fill */}
            {unselectedPlantbeds.map((pb) => {
                const hasHoles = (pb.holes?.length ?? 0) > 0;

                const plantbedCommon = {
                    opacity: 1,
                    draggable: false,
                    onMouseEnter: () => {
                        const st = stageRef.current;
                        if (!st) return;

                        if (activeTool === "draw" || activeTool === "cut" || activeTool === "measure") {
                            st.container().style.cursor = "crosshair";
                            return;
                        }
                        if (activeTool === "select") {
                            st.container().style.cursor = "pointer";
                            return;
                        }
                        if (activeTool === "hand") {
                            st.container().style.cursor = "grab";
                            return;
                        }
                        st.container().style.cursor = "default";
                    },
                    onMouseLeave: () => {
                        const st = stageRef.current;
                        if (!st) return;
                        st.container().style.cursor =
                            activeTool === "hand"
                                ? "grab"
                                : activeTool === "select"
                                    ? "default"
                                    : activeTool === "draw" || activeTool === "cut" || activeTool === "measure"
                                        ? "crosshair"
                                        : "default";
                    },
                    onMouseDown: (evt: any) => {
                        if (evt?.evt?.button === 1) {
                            return;
                        }

                        if (activeTool !== "select") return;
                        evt.cancelBubble = true;

                        const multi = !!(evt.evt?.ctrlKey || evt.evt?.metaKey);

                        // Alleen een "echte klik"-focus voorbereiden bij normale single click
                        if (!multi) {
                            pendingPlantbedClickRef.current = {
                                id: pb.id,
                                startClientX: evt.evt?.clientX ?? 0,
                                startClientY: evt.evt?.clientY ?? 0,
                            };
                            plantbedClickMovedRef.current = false;
                        } else {
                            pendingPlantbedClickRef.current = null;
                            plantbedClickMovedRef.current = false;
                        }

                        handleObjectSelection(pb.id, evt.evt);
                    },
                    onClick: (evt: any) => {
                        if (activeTool !== "select") return;
                        evt.cancelBubble = true;
                        // ✅ sidebar focus gebeurt alleen in handleMouseUp (echte klik detectie)
                    },
                };

                // ✅ BOGEN — gebruik PolygonWithHoles als het plantbed bogen heeft
                const pbHasBulges = pb.bulges?.some((b) => Math.abs(b) > 0.004);
                return (
                    <React.Fragment key={`pb-fill-${pb.id}`}>
                        {hasHoles || pbHasBulges ? (
                            <PolygonWithHoles
                                {...plantbedCommon}
                                points={pb.points}
                                holes={pb.holes ?? []}
                                bulges={pb.bulges}
                                fill={getObjectRenderStyle(pb).fill}
                                stroke={undefined}
                                strokeWidth={0}
                            />
                        ) : (
                            <Line
                                {...plantbedCommon}
                                points={pb.points}
                                closed
                                fill={getObjectRenderStyle(pb).fill}
                                strokeEnabled={false}
                            />
                        )}

                        {(() => {
                            const showPlantNumber = viewVisibility.showPlantNumbers !== false;
                            const showAreaLabel = viewVisibility.showAreaLabels !== false;

                            if (!showPlantNumber && !showAreaLabel) return null;

                            const label = plantbedNumberLayouts.get(pb.id);
                            if (!label) return null;

                            const plantbedStyle = {
                                ...OBJECT_STYLES.plantbed,
                                ...(pb.customStyle ?? {}),
                            };
                            const labelColor = getReadablePlantbedLabelColor(plantbedStyle.fill);

                            const bbox = bboxFromPoints(pb.points);
                            const numberTextWidth = showPlantNumber
                                ? estimateTextWidth(label.text, label.fontSize)
                                : 0;
                            const areaTextWidth = showAreaLabel
                                ? estimateTextWidth(label.areaText, label.areaFontSize)
                                : 0;

                            const verticalGap = 4;
                            const inlineGap = 6;

                            const stackedBlockHeight =
                                showPlantNumber && showAreaLabel
                                    ? label.fontSize + verticalGap + label.areaFontSize
                                    : showPlantNumber
                                        ? label.fontSize
                                        : label.areaFontSize;

                            const inlineBlockWidth =
                                showPlantNumber && showAreaLabel
                                    ? numberTextWidth + inlineGap + areaTextWidth
                                    : showPlantNumber
                                        ? numberTextWidth
                                        : areaTextWidth;

                            const inlineBlockHeight =
                                showPlantNumber && showAreaLabel
                                    ? Math.max(label.fontSize, label.areaFontSize)
                                    : showPlantNumber
                                        ? label.fontSize
                                        : label.areaFontSize;
                           
                            const horizontalBlockWidth = Math.max(label.width, areaTextWidth);
                            const shouldRotatePlantbedLabel =
                                bbox.h > bbox.w &&
                                bbox.w < horizontalBlockWidth + 12;

                            const numberCenterX = label.x + label.width / 2;
                            const numberCenterY = label.y + label.fontSize / 2;

                            const areaCenterX =
                                label.areaRotation === 0
                                    ? label.areaX + areaTextWidth / 2
                                    : label.areaX;

                            const areaCenterY =
                                label.areaRotation === 0
                                    ? label.areaY + label.areaFontSize / 2
                                    : label.areaY;

                            const centerX = (numberCenterX + areaCenterX) / 2;
                            const centerY = (numberCenterY + areaCenterY) / 2;

                            if (shouldRotatePlantbedLabel) {
                                const canUseVerticalStacked = bbox.w >= stackedBlockHeight + 8;
                                const canUseVerticalInline = bbox.w >= inlineBlockHeight + 8 && bbox.h >= inlineBlockWidth + 8;

                                if (canUseVerticalInline && (!canUseVerticalStacked || bbox.w < stackedBlockHeight + 8)) {
                                    return (
                                        <Group
                                            x={centerX}
                                            y={centerY}
                                            rotation={-90}
                                            listening={false}
                                        >
                                            {showPlantNumber && (
                                                <Text
                                                    x={-inlineBlockWidth / 2}
                                                    y={-inlineBlockHeight / 2}
                                                    text={label.text}
                                                    fontSize={label.fontSize}
                                                    fontStyle="bold"
                                                    fill={labelColor}
                                                    listening={false}
                                                    perfectDrawEnabled={false}
                                                />
                                            )}
                                            {showAreaLabel && (
                                                <Text
                                                    x={
                                                        showPlantNumber
                                                            ? -inlineBlockWidth / 2 + numberTextWidth + inlineGap
                                                            : -inlineBlockWidth / 2
                                                    }
                                                    y={-inlineBlockHeight / 2}
                                                    text={label.areaText}
                                                    fontSize={label.areaFontSize}
                                                    fontStyle="700"
                                                    fill={labelColor}
                                                    listening={false}
                                                    perfectDrawEnabled={false}
                                                />
                                            )}
                                        </Group>
                                    );
                                }

                                if (canUseVerticalStacked) {
                                    return (
                                        <Group
                                            x={centerX}
                                            y={centerY}
                                            rotation={-90}
                                            listening={false}
                                        >
                                            {showPlantNumber && (
                                                <Text
                                                    x={-numberTextWidth / 2}
                                                    y={-stackedBlockHeight / 2}
                                                    text={label.text}
                                                    fontSize={label.fontSize}
                                                    fontStyle="bold"
                                                    fill={labelColor}
                                                    listening={false}
                                                    perfectDrawEnabled={false}
                                                />
                                            )}
                                            {showAreaLabel && (
                                                <Text
                                                    x={-areaTextWidth / 2}
                                                    y={
                                                        showPlantNumber
                                                            ? -stackedBlockHeight / 2 + label.fontSize + verticalGap
                                                            : -stackedBlockHeight / 2
                                                    }
                                                    text={label.areaText}
                                                    fontSize={label.areaFontSize}
                                                    fontStyle="700"
                                                    fill={labelColor}
                                                    listening={false}
                                                    perfectDrawEnabled={false}
                                                />
                                            )}
                                        </Group>
                                    );
                                }

                                return null;
                            }

                            const canUseHorizontalStacked = bbox.h >= stackedBlockHeight + 8;
                            const canUseHorizontalInline = bbox.h >= inlineBlockHeight + 8 && bbox.w >= inlineBlockWidth + 8;

                            if (!canUseHorizontalStacked && canUseHorizontalInline) {
                                return (
                                    <Group
                                        x={centerX}
                                        y={centerY}
                                        listening={false}
                                    >
                                        {showPlantNumber && (
                                            <Text
                                                x={-inlineBlockWidth / 2}
                                                y={-inlineBlockHeight / 2}
                                                text={label.text}
                                                fontSize={label.fontSize}
                                                fontStyle="bold"
                                                fill={labelColor}
                                                listening={false}
                                                perfectDrawEnabled={false}
                                            />
                                        )}

                                        {showAreaLabel && (
                                            <Text
                                                x={
                                                    showPlantNumber
                                                        ? -inlineBlockWidth / 2 + numberTextWidth + inlineGap
                                                        : -inlineBlockWidth / 2
                                                }
                                                y={-inlineBlockHeight / 2}
                                                text={label.areaText}
                                                fontSize={label.areaFontSize}
                                                fontStyle="700"
                                                fill={labelColor}
                                                listening={false}
                                                perfectDrawEnabled={false}
                                            />
                                        )}
                                    </Group>
                                );
                            }

                            if (!canUseHorizontalStacked && !canUseHorizontalInline) {
                                return null;
                            }

                            return (
                                <React.Fragment>
                                    {showPlantNumber && (
                                        <Text
                                            x={label.x}
                                            y={
                                                showAreaLabel
                                                    ? label.y
                                                    : label.y + label.areaFontSize / 2
                                            }
                                            width={label.width}
                                            align="center"
                                            wrap="none"
                                            text={label.text}
                                            fontSize={label.fontSize}
                                            fontStyle="bold"
                                            fill={labelColor}
                                            listening={false}
                                            perfectDrawEnabled={false}
                                        />
                                    )}

                                    {showAreaLabel && label.areaRotation === 0 ? (
                                        <Text
                                            x={label.areaX}
                                            y={label.areaY}
                                            width={areaTextWidth}
                                            align="center"
                                            wrap="none"
                                            text={label.areaText}
                                            fontSize={label.areaFontSize}
                                            fontStyle="700"
                                            fill={labelColor}
                                            listening={false}
                                            perfectDrawEnabled={false}
                                        />
                                    ) : showAreaLabel ? (
                                        <Group
                                            x={label.areaX}
                                            y={label.areaY}
                                            rotation={label.areaRotation}
                                            listening={false}
                                        >
                                            <Text
                                                x={-areaTextWidth / 2}
                                                y={-label.areaFontSize / 2}
                                                text={label.areaText}
                                                fontSize={label.areaFontSize}
                                                fontStyle="700"
                                                fill={labelColor}
                                                listening={false}
                                                perfectDrawEnabled={false}
                                            />
                                        </Group>
                                    ) : null}
                                </React.Fragment>
                            );
                        })()}
                    </React.Fragment>
                );
            })}
        </Layer>
    );
});
