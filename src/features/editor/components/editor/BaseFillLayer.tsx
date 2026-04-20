import React from "react";
import { Group, Layer, Line, Text } from "react-konva";
import { PolyObject, OBJECT_STYLES, ObjectType } from "@/state/projectStore";
import { renderObjectPattern } from "@/features/editor/lib/objectPatterns";
import { isUnifiedBoundaryType, getBoundaryBandShape } from "@/features/editor/lib/boundarySystem";
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

export default function BaseFillLayer({
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
                    ? getBoundaryBandShape(obj.points, obj.type)
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

                if (isUnifiedBoundary && boundaryBandShape && boundaryBandShape.outer.length >= 6) {
                    return (
                        <React.Fragment key={`boundary-fill-${obj.id}`}>
                            <PolygonWithHoles
                                {...common}
                                points={boundaryBandShape.outer}
                                holes={boundaryBandShape.holes}
                                fill={OBJECT_STYLES[obj.type].fill}
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
                                fill={patternImage ? undefined : OBJECT_STYLES[obj.type].fill}
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
                    return (
                        <React.Fragment key={`fill-${obj.id}`}>
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
                            {renderObjectPattern(obj, `fill-pattern-${obj.id}`, stageScale)}
                        </React.Fragment>
                    );
                }

                const objectStyle = OBJECT_STYLES[obj.type as ObjectType];

                return (
                    <React.Fragment key={`fill-${obj.id}`}>
                        <Line
                            {...common}
                            points={obj.points}
                            closed
                            fill={objectStyle.fill}
                            fillEnabled
                            fillPriority="color"
                            strokeEnabled={false}
                        />
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

                return (
                    <React.Fragment key={`pb-fill-${pb.id}`}>
                        {hasHoles ? (
                            <PolygonWithHoles
                                {...plantbedCommon}
                                points={pb.points}
                                holes={pb.holes}
                                fill={OBJECT_STYLES.plantbed.fill}
                                stroke={undefined}
                                strokeWidth={0}
                            />
                        ) : (
                            <Line
                                {...plantbedCommon}
                                points={pb.points}
                                closed
                                fill={OBJECT_STYLES.plantbed.fill}
                                strokeEnabled={false}
                            />
                        )}

                        {(() => {
                            if (!viewVisibility.showPlantNumbers) return null;

                            const label = plantbedNumberLayouts.get(pb.id);
                            if (!label) return null;

                            const bbox = bboxFromPoints(pb.points);
                            const numberTextWidth = estimateTextWidth(label.text, label.fontSize);
                            const areaTextWidth = estimateTextWidth(label.areaText, label.areaFontSize);

                            const horizontalBlockWidth = Math.max(label.width, areaTextWidth);
                            const shouldRotatePlantbedLabel =
                                bbox.h > bbox.w &&
                                bbox.w < horizontalBlockWidth + 12;

                            if (shouldRotatePlantbedLabel) {
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

                                const verticalGap = 4;
                                const blockHeight = label.fontSize + verticalGap + label.areaFontSize;

                                return (
                                    <Group
                                        x={centerX}
                                        y={centerY}
                                        rotation={-90}
                                        listening={false}
                                    >
                                        <Text
                                            x={-numberTextWidth / 2}
                                            y={-blockHeight / 2}
                                            text={label.text}
                                            fontSize={label.fontSize}
                                            fontStyle="bold"
                                            fill={OBJECT_STYLES.plantbed.stroke}
                                            listening={false}
                                            perfectDrawEnabled={false}
                                        />
                                        <Text
                                            x={-areaTextWidth / 2}
                                            y={-blockHeight / 2 + label.fontSize + verticalGap}
                                            text={label.areaText}
                                            fontSize={label.areaFontSize}
                                            fontStyle="700"
                                            fill={OBJECT_STYLES.plantbed.stroke}
                                            listening={false}
                                            perfectDrawEnabled={false}
                                        />
                                    </Group>
                                );
                            }

                            return (
                                <React.Fragment>
                                    <Text
                                        x={label.x}
                                        y={label.y}
                                        width={label.width}
                                        align="center"
                                        wrap="none"
                                        text={label.text}
                                        fontSize={label.fontSize}
                                        fontStyle="bold"
                                        fill={OBJECT_STYLES.plantbed.stroke}
                                        listening={false}
                                        perfectDrawEnabled={false}
                                    />

                                    {label.areaRotation === 0 ? (
                                        <Text
                                            x={label.areaX}
                                            y={label.areaY}
                                            width={areaTextWidth}
                                            align="center"
                                            wrap="none"
                                            text={label.areaText}
                                            fontSize={label.areaFontSize}
                                            fontStyle="700"
                                            fill={OBJECT_STYLES.plantbed.stroke}
                                            listening={false}
                                            perfectDrawEnabled={false}
                                        />
                                    ) : (
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
                                                fill={OBJECT_STYLES.plantbed.stroke}
                                                listening={false}
                                                perfectDrawEnabled={false}
                                            />
                                        </Group>
                                    )}
                                </React.Fragment>
                            );
                        })()}
                    </React.Fragment>
                );
            })}
        </Layer>
    );
}