import React from "react";
import { Layer, Line, Rect, Group, Circle, Text } from "react-konva";
import { Html } from "react-konva-utils";
import { PolyObject, ObjectType, OBJECT_STYLES } from "@/state/projectStore";
import MeasurementOverlay from "@/features/editor/components/MeasurementOverlay";
import MeasureToolOverlay from "@/features/editor/components/editor/MeasureToolOverlay";
import TypeLabelCard from "@/features/editor/components/editor/TypeLabelCard";
import { APP_NOTIFICATIONS } from "@/state/allNotifications";
import { formatSquareMeters, getObjectAreaInSquareMeters } from "@/state/areaMetrics";
import { estimateTextWidth, snapToGrid, bboxFromPoints } from "@/features/editor/lib/editorCanvasMath";
import { getOrthogonalEdgeOrientation, getEdgeResizeCursor } from "@/features/editor/lib/editorSelectionMath";
import { renderTilesPattern } from "@/features/editor/lib/objectPatterns";
import {
    DynamicStrokeShape,
    getTreebedVisual,
    renderTreebedTrunks,
    createTreebedPointsFromCenterDrag,
    getTreebedResizeCorners,
    getTreebedRotateCursorFromPoint,
} from "@/features/editor/lib/treebedGeometry";
import {
    PolygonWithHoles,
    TYPE_LABELS,
    TREEBED_VARIANT_LABELS,
    getTreebedLabel,
    isFenceOrGate,
    isBuildingType,
    getBuildingPatternCanvas,
    getLineStrokeWidth,
} from "@/features/editor/lib/editorCanvasPrimitives";

export function EditorTopLayer(props: any) {
    const {
        unselectedNonPlantbeds,
        dragOverPlantbedId,
        objects,
        selected,
        selectedObjectId,
        activeTool,
        activeDrawType,
        draftPoints,
        draftMeasurementPreviewPoint,
        measurePoints,
        measurePreviewPoint,
        measureLines,
        shouldHideHeavySceneDecorations,
        stageScale,
        plantbedNumberLayouts,
        livePlantbedNumberLayouts,
        livePrimaryMeasurementObject,
        shouldShowCursorCrosshair,
        cursorCrosshairPoint,
        stagePos,
        canvasSize,
        COLORS,

        stageRef,
        isPanning,
        handleObjectSelection,
        selectedObjectIds,
        selectObjects,
        moveObjectAndMerge,
        moveObjectsBatch,
        setLiveSelectionDragDelta,
        isVertexDragging,
        isEdgeResizing,
        setIsEdgeResizing,
        setIsVertexDragging,
        isBoxSelecting,
        shouldHideSelectionLabelsForPerformance,
        viewVisibility,

        treebedRotatePreview,
        treebedResizePreview,
        startMiddleMousePan,
        suppressPlantbedFocusRef,
        GRID_SIZE,
        isEdgeResizingRef,
        isResizeEdgeHoveredRef,
        isTreebedResizeHandleHoveredRef,
        isTreebedRotateHotspotHoveredRef,
        treebedRotateRef,
        treebedResizeRef,
        treebedRotateCursorRef,
        isVertexDraggingRef,
        activeVertexIndexRef,
        selectedLineRefs,
        vertexHandleRefs,
        vertexEditRef,
        edgeResizeRef,
        pendingPlantbedClickRef,
        plantbedClickMovedRef,
        startTreebedRotate,
        startTreebedResize,
        notify,
        BASE_SCALE,
        getOneSidedPolylineRenderPoints,
        inferPolylineRenderSide,
        getPolylineRenderPieces,
        renderTilesPattern: renderTilesPatternProp,
        treebedLabelBlockers,
        getPlantbedNumberLayout,
        getPlantbedLinkedCount,
        handleDuplicateSelection,
        requestChangeObjectType,
        changeTreebedVariant,
        useProjectStore,
        activeTreebedDrawVariant,
        treebedDraftPreviewPoint,
        createTreebedPointsFromCenterDrag: createTreebedPointsFromCenterDragProp,
        draftGuideLineRef,
        draftSecondaryGuideLineRef,
        draftPreviewLineRef,
        applyViewportWheel,
    } = props;

    const unselectedNonPlantbedsTyped = unselectedNonPlantbeds as PolyObject[];
    const objectsTyped = objects as PolyObject[];
    const selectedTyped = selected as PolyObject[];
    const renderTilesPatternSafe = renderTilesPatternProp ?? renderTilesPattern;
    const createTreebedPointsFromCenterDragSafe =
        createTreebedPointsFromCenterDragProp ?? createTreebedPointsFromCenterDrag;

    return (
        <>
            {/* =============== TOP LAYER (treebeds + selection + draft) =============== */}
            <Layer>
                {unselectedNonPlantbedsTyped
                    .filter((obj: PolyObject) => obj.type === "treebed")
                    .map((obj: PolyObject) => {
                        const liveTreebedPoints =
                            treebedRotatePreview?.objectId === obj.id
                                ? treebedRotatePreview.points
                                : treebedResizePreview?.objectId === obj.id
                                    ? treebedResizePreview.points
                                    : obj.points;

                        const treebedVisual = getTreebedVisual(liveTreebedPoints, obj.treebedVariant);
                        const { cx, cy, trunkRadius } = treebedVisual;

                        const displayRotationDeg =
                            treebedVisual.shape === "rect"
                                ? treebedVisual.rect.rotationDeg ?? 0
                                : 0;

                        return (
                            <React.Fragment key={`treebed-overlay-${obj.id}`}>
                                {treebedVisual.shape === "rect" ? (
                                    <>
                                        <Line
                                            points={liveTreebedPoints}
                                            closed
                                            fill={treebedVisual.fill}
                                            opacity={0.4}
                                            listening={true}
                                            perfectDrawEnabled={false}
                                            onMouseEnter={() => {
                                                const st = stageRef.current;
                                                if (!st) return;

                                                if (isPanning) {
                                                    st.container().style.cursor = "grabbing";
                                                    return;
                                                }

                                                if (activeTool === "draw" || activeTool === "cut") {
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
                                            }}
                                            onMouseLeave={() => {
                                                const st = stageRef.current;
                                                if (!st) return;

                                                st.container().style.cursor = isPanning
                                                    ? "grabbing"
                                                    : activeTool === "hand"
                                                        ? "grab"
                                                        : activeTool === "select"
                                                            ? "default"
                                                            : activeTool === "draw" || activeTool === "cut"
                                                                ? "crosshair"
                                                                : "default";
                                            }}
                                            onMouseDown={(evt) => {
                                                if (evt?.evt?.button === 1) {
                                                    return;
                                                }

                                                if (activeTool !== "select") return;
                                                evt.cancelBubble = true;
                                                handleObjectSelection(obj.id, evt.evt);
                                            }}
                                            onClick={(evt) => {
                                                if (evt?.evt?.button === 1 || isPanning) {
                                                    evt.cancelBubble = true;
                                                    return;
                                                }

                                                if (activeTool !== "select") return;
                                                evt.cancelBubble = true;
                                            }}
                                        />
                                        <DynamicStrokeShape
                                            points={liveTreebedPoints}
                                            stroke={treebedVisual.stroke}
                                            strokeWidth={2}
                                            seedKey={`treebed-stroke:${obj.id}:${obj.treebedVariant ?? "standard"}:base`}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <Circle
                                            x={cx}
                                            y={cy}
                                            radius={treebedVisual.radius}
                                            fill={treebedVisual.fill}
                                            opacity={0.4}
                                            listening={true}
                                            perfectDrawEnabled={false}
                                            onMouseEnter={() => {
                                                const st = stageRef.current;
                                                if (!st) return;

                                                if (isPanning) {
                                                    st.container().style.cursor = "grabbing";
                                                    return;
                                                }

                                                if (activeTool === "draw" || activeTool === "cut") {
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
                                            }}
                                            onMouseLeave={() => {
                                                const st = stageRef.current;
                                                if (!st) return;

                                                st.container().style.cursor = isPanning
                                                    ? "grabbing"
                                                    : activeTool === "hand"
                                                        ? "grab"
                                                        : activeTool === "select"
                                                            ? "default"
                                                            : activeTool === "draw" || activeTool === "cut"
                                                                ? "crosshair"
                                                                : "default";
                                            }}
                                            onMouseDown={(evt) => {
                                                if (evt?.evt?.button === 1) {
                                                    return;
                                                }

                                                if (activeTool !== "select") return;
                                                evt.cancelBubble = true;
                                                handleObjectSelection(obj.id, evt.evt);
                                            }}
                                            onClick={(evt) => {
                                                if (evt?.evt?.button === 1 || isPanning) {
                                                    evt.cancelBubble = true;
                                                    return;
                                                }

                                                if (activeTool !== "select") return;
                                                evt.cancelBubble = true;
                                            }}
                                        />
                                        <DynamicStrokeShape
                                            points={liveTreebedPoints}
                                            stroke={treebedVisual.stroke}
                                            strokeWidth={2}
                                            seedKey={`treebed-stroke:${obj.id}:${obj.treebedVariant ?? "standard"}:base`}
                                        />
                                    </>
                                )}
                                {renderTreebedTrunks(
                                    obj.treebedVariant,
                                    cx,
                                    cy,
                                    trunkRadius,
                                    `treebed-overlay-${obj.id}`,
                                    false
                                )}
                            </React.Fragment>
                        );
                    })}

                {dragOverPlantbedId && (() => {
                    const pb = objectsTyped.find((o: PolyObject) => o.id === dragOverPlantbedId && o.type === "plantbed");
                    if (!pb) return null;

                    return (
                        <>
                            <Line
                                points={pb.points}
                                closed
                                fillEnabled={false}
                                stroke={COLORS.orange}
                                strokeWidth={4}
                                dash={[10, 6]}
                                dashEnabled
                                listening={false}
                                perfectDrawEnabled={false}
                                opacity={1}
                            />

                            {(pb.holes ?? []).map((hole, holeIndex) => (
                                <Line
                                    key={`${pb.id}-drag-hole-${holeIndex}`}
                                    points={hole}
                                    closed
                                    fillEnabled={false}
                                    stroke={COLORS.orange}
                                    strokeWidth={4}
                                    dash={[10, 6]}
                                    dashEnabled
                                    listening={false}
                                    perfectDrawEnabled={false}
                                    opacity={1}
                                />
                            ))}
                        </>
                    );
                })()}

                {/* Selected */}
                {selected.length > 0 && (
                    <Group
                        listening={activeTool === "select"}
                        draggable={activeTool === "select" && !isVertexDragging && !isEdgeResizing && !isPanning}
                        onMouseDown={(evt) => {
                            if (activeTool !== "select") return;

                            if (evt?.evt?.button === 1) {
                                evt.cancelBubble = true;
                                startMiddleMousePan(evt.evt);
                                return;
                            }
                        }}
                        onDragStart={(evt) => {
                            if (activeTool !== "select") {
                                evt.target.stopDrag();
                                return;
                            }

                            if (isPanning || evt?.evt?.button === 1) {
                                evt.target.stopDrag();
                                return;
                            }

                            setLiveSelectionDragDelta({ x: 0, y: 0 });

                            // ✅ drag gestart -> eventuele “klik na drag” blokkeren
                            suppressPlantbedFocusRef.current = true;
                        }}
                        onDragMove={(evt) => {
                            if (activeTool !== "select") return;

                            const g = evt.target;
                            const rawDx = g.x();
                            const rawDy = g.y();

                            const snappedDx = snapToGrid(rawDx, GRID_SIZE);
                            const snappedDy = snapToGrid(rawDy, GRID_SIZE);

                            const isTreebedOnlySelection =
                                selectedTyped.length > 0 && selectedTyped.every((o: PolyObject) => o.type === "treebed");

                            const effectiveDx = isTreebedOnlySelection ? rawDx : snappedDx;
                            const effectiveDy = isTreebedOnlySelection ? rawDy : snappedDy;

                            if (effectiveDx === 0 && effectiveDy === 0) {
                                setLiveSelectionDragDelta(null);
                                return;
                            }

                            setLiveSelectionDragDelta({
                                x: effectiveDx,
                                y: effectiveDy,
                            });
                        }}
                        onDragEnd={(evt) => {
                            if (activeTool !== "select") {
                                evt.target.position({ x: 0, y: 0 });
                                setLiveSelectionDragDelta(null);
                                return;
                            }

                            const g = evt.target;
                            const rawDx = g.x();
                            const rawDy = g.y();

                            const snappedDx = snapToGrid(rawDx, GRID_SIZE);
                            const snappedDy = snapToGrid(rawDy, GRID_SIZE);

                            g.position({ x: 0, y: 0 });
                            setLiveSelectionDragDelta(null);

                            const isTreebedOnlySelection =
                                selectedTyped.length > 0 && selectedTyped.every((o: PolyObject) => o.type === "treebed");

                            const effectiveDx = isTreebedOnlySelection ? rawDx : snappedDx;
                            const effectiveDy = isTreebedOnlySelection ? rawDy : snappedDy;

                            if (effectiveDx === 0 && effectiveDy === 0) {
                                requestAnimationFrame(() => {
                                    suppressPlantbedFocusRef.current = false;
                                });
                                return;
                            }

                            if (selected.length === 1) {
                                const o = selected[0];

                                const dx = o.type === "treebed" ? rawDx : snappedDx;
                                const dy = o.type === "treebed" ? rawDy : snappedDy;

                                const newPoints: number[] = [];
                                for (let i = 0; i < o.points.length; i += 2) {
                                    newPoints.push(o.points[i] + dx, o.points[i + 1] + dy);
                                }
                                moveObjectAndMerge(o.id, newPoints);

                                requestAnimationFrame(() => {
                                    suppressPlantbedFocusRef.current = false;
                                });
                                return;
                            }

                            const batch = selectedTyped.map((o: PolyObject) => {
                                const dx = o.type === "treebed" ? rawDx : snappedDx;
                                const dy = o.type === "treebed" ? rawDy : snappedDy;

                                const newPoints: number[] = [];
                                for (let i = 0; i < o.points.length; i += 2) {
                                    newPoints.push(o.points[i] + dx, o.points[i + 1] + dy);
                                }
                                return { id: o.id, toPoints: newPoints };
                            });

                            moveObjectsBatch(batch);

                            requestAnimationFrame(() => {
                                suppressPlantbedFocusRef.current = false;
                            });
                        }}
                        onMouseEnter={() => {
                            if (activeTool !== "select") return;

                            const st = stageRef.current;
                            if (!st) return;
                            if (isEdgeResizingRef.current) return;
                            if (isResizeEdgeHoveredRef.current) return;

                            if (isTreebedResizeHandleHoveredRef.current) {
                                st.container().style.cursor = "nwse-resize";
                                return;
                            }

                            if (isTreebedRotateHotspotHoveredRef.current || treebedRotateRef.current) {
                                st.container().style.cursor =
                                    treebedRotateCursorRef.current ?? "url(/icons/rotate-0.png) 16 16, auto";
                                return;
                            }

                            if (isPanning) {
                                st.container().style.cursor = "grabbing";
                                return;
                            }

                            st.container().style.cursor = isVertexDraggingRef.current ? "default" : "move";
                        }}
                        onMouseMove={() => {
                            if (activeTool !== "select") return;

                            const st = stageRef.current;
                            if (!st) return;
                            if (isEdgeResizingRef.current) return;
                            if (isResizeEdgeHoveredRef.current) return;

                            if (isTreebedResizeHandleHoveredRef.current) {
                                return;
                            }

                            if (isTreebedRotateHotspotHoveredRef.current || treebedRotateRef.current) {
                                st.container().style.cursor =
                                    treebedRotateCursorRef.current ?? "url(/icons/rotate-0.png) 16 16, auto";
                                return;
                            }

                            if (isPanning) {
                                st.container().style.cursor = "grabbing";
                                return;
                            }

                            st.container().style.cursor = isVertexDraggingRef.current ? "default" : "move";
                        }}
                        onMouseLeave={() => {
                            if (activeTool !== "select") return;

                            const st = stageRef.current;
                            if (!st) return;
                            if (isEdgeResizingRef.current) return;
                            if (isResizeEdgeHoveredRef.current) return;

                            if (treebedRotateRef.current) {
                                st.container().style.cursor =
                                    treebedRotateCursorRef.current ?? "url(/icons/rotate-0.png) 16 16, auto";
                                return;
                            }

                            if (treebedResizeRef.current) {
                                return;
                            }

                            st.container().style.cursor = isPanning ? "grabbing" : "default";
                        }}
                    >
                        {selectedTyped.map((obj: PolyObject) => (
                            <React.Fragment key={obj.id}>
                                {obj.type === "treebed" ? (
                                    (() => {
                                        const liveTreebedPoints =
                                            treebedRotatePreview?.objectId === obj.id
                                                ? treebedRotatePreview.points
                                                : treebedResizePreview?.objectId === obj.id
                                                    ? treebedResizePreview.points
                                                    : obj.points;

                                        const treebedVisual = getTreebedVisual(liveTreebedPoints, obj.treebedVariant);
                                        const { cx, cy, trunkRadius, bbox } = treebedVisual;
                                        const corners = getTreebedResizeCorners(liveTreebedPoints, obj.treebedVariant);
                                        const handleRadius = 6;
                                        const handleHitRadius = 14;
                                        const rotateHotspotRadius = 16;

                                        const displayRotationDeg =
                                            treebedVisual.shape === "rect"
                                                ? treebedVisual.rect.rotationDeg ?? 0
                                                : 0;

                                        const canRotateTreebed =
                                            obj.treebedVariant === "espalier" &&
                                            treebedVisual.shape === "rect";

                                        const rotateHotspots = canRotateTreebed
                                            ? ([
                                                corners.tl,
                                                corners.tr,
                                                corners.br,
                                                corners.bl,
                                            ].map((corner) => {
                                                const dx = corner.x - cx;
                                                const dy = corner.y - cy;
                                                const len = Math.hypot(dx, dy) || 1;
                                                const outward = handleHitRadius + 12;

                                                return {
                                                    x: corner.x + (dx / len) * outward,
                                                    y: corner.y + (dy / len) * outward,
                                                };
                                            }))
                                            : [];

                                        const onSelectClick = (evt?: any) => {
                                            const multi = !!(evt?.evt?.ctrlKey || evt?.evt?.metaKey);

                                            if (multi) {
                                                handleObjectSelection(obj.id, evt?.evt);
                                                return;
                                            }

                                            const ids = selectedObjectIds;
                                            if (!ids.includes(obj.id)) return;

                                            const next = [obj.id, ...ids.filter((x: string) => x !== obj.id)];
                                            selectObjects(next);
                                        };

                                        const treebedHandles: Array<{
                                            corner: "tl" | "tr" | "br" | "bl";
                                            point: { x: number; y: number };
                                        }> = [
                                                { corner: "tl", point: corners.tl },
                                                { corner: "tr", point: corners.tr },
                                                { corner: "br", point: corners.br },
                                                { corner: "bl", point: corners.bl },
                                            ];

                                        const treebedSelectionStrokeWidth = 3;

                                        return (
                                            <React.Fragment key={`selected-treebed-${obj.id}`}>
                                                {treebedVisual.shape === "rect" ? (
                                                    <>
                                                        <Line
                                                            points={liveTreebedPoints}
                                                            closed
                                                            fill={treebedVisual.fill}
                                                            opacity={0.4}
                                                            strokeEnabled={false}
                                                            onClick={(evt) => onSelectClick(evt)}
                                                            perfectDrawEnabled={false}
                                                        />

                                                        <DynamicStrokeShape
                                                            points={liveTreebedPoints}
                                                            stroke={COLORS.orange}
                                                            strokeWidth={treebedSelectionStrokeWidth}
                                                            seedKey={`treebed-stroke:${obj.id}:${obj.treebedVariant ?? "standard"}:selected`}
                                                        />

                                                        {canRotateTreebed && rotateHotspots.map((spot, index) => {
                                                            return (
                                                                <Circle
                                                                    key={`treebed-rotate-hotspot-${obj.id}-${index}`}
                                                                    x={spot.x}
                                                                    y={spot.y}
                                                                    radius={rotateHotspotRadius}
                                                                    fill="rgba(0,0,0,0.001)"
                                                                    strokeEnabled={false}
                                                                    perfectDrawEnabled={false}
                                                                    onMouseEnter={() => {
                                                                        const st = stageRef.current;
                                                                        if (!st) return;
                                                                        if (treebedResizeRef.current) return;

                                                                        isTreebedRotateHotspotHoveredRef.current = true;

                                                                        const rotateCursor = getTreebedRotateCursorFromPoint(
                                                                            cx,
                                                                            cy,
                                                                            spot.x,
                                                                            spot.y
                                                                        );
                                                                        treebedRotateCursorRef.current = rotateCursor;
                                                                        st.container().style.cursor = rotateCursor;
                                                                    }}
                                                                    onMouseMove={() => {
                                                                        const st = stageRef.current;
                                                                        if (!st) return;
                                                                        if (treebedResizeRef.current) return;

                                                                        isTreebedRotateHotspotHoveredRef.current = true;

                                                                        const rotateCursor = getTreebedRotateCursorFromPoint(
                                                                            cx,
                                                                            cy,
                                                                            spot.x,
                                                                            spot.y
                                                                        );
                                                                        treebedRotateCursorRef.current = rotateCursor;
                                                                        st.container().style.cursor = rotateCursor;
                                                                    }}
                                                                    onMouseLeave={() => {
                                                                        const st = stageRef.current;
                                                                        if (!st) return;
                                                                        isTreebedRotateHotspotHoveredRef.current = false;

                                                                        if (treebedRotateRef.current) {
                                                                            st.container().style.cursor =
                                                                                treebedRotateCursorRef.current ?? "url(/icons/rotate-0.png) 16 16, auto";
                                                                            return;
                                                                        }

                                                                        treebedRotateCursorRef.current = null;
                                                                        st.container().style.cursor = isPanning ? "grabbing" : "default";
                                                                    }}
                                                                    onMouseDown={(evt) => {
                                                                        if (activeTool !== "select") return;
                                                                        evt.cancelBubble = true;
                                                                        startTreebedRotate(obj);
                                                                    }}
                                                                />
                                                            );
                                                        })}

                                                        {treebedRotatePreview?.objectId === obj.id && (() => {
                                                            const labelText = `${Math.round(treebedRotatePreview.rotationDeg)}°`;
                                                            const clampedStageScale = Math.max(stageScale, 1);
                                                            const visualScale = 1 / clampedStageScale;

                                                            const pillFontSize = 16;
                                                            const pillHeight = 28;
                                                            const pillPaddingX = 12;
                                                            const pillCornerRadius = 7;

                                                            const textWidth = estimateTextWidth(labelText, pillFontSize);
                                                            const pillWidth = textWidth + pillPaddingX * 2;

                                                            return (
                                                                <Group
                                                                    x={treebedRotatePreview.labelX}
                                                                    y={treebedRotatePreview.labelY}
                                                                    scaleX={visualScale}
                                                                    scaleY={visualScale}
                                                                    listening={false}
                                                                >
                                                                    <Rect
                                                                        x={-pillWidth / 2}
                                                                        y={-pillHeight / 2}
                                                                        width={pillWidth}
                                                                        height={pillHeight}
                                                                        fill={COLORS.orange}
                                                                        cornerRadius={pillCornerRadius}
                                                                        listening={false}
                                                                        perfectDrawEnabled={false}
                                                                    />
                                                                    <Text
                                                                        x={-textWidth / 2}
                                                                        y={-pillFontSize / 2 - 1}
                                                                        text={labelText}
                                                                        fontSize={pillFontSize}
                                                                        fontStyle="700"
                                                                        fill="#FFFFFF"
                                                                        listening={false}
                                                                        perfectDrawEnabled={false}
                                                                    />
                                                                </Group>
                                                            );
                                                        })()}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Circle
                                                            x={cx}
                                                            y={cy}
                                                            radius={treebedVisual.radius}
                                                            fill={treebedVisual.fill}
                                                            opacity={0.4}
                                                            strokeEnabled={false}
                                                            onClick={(evt) => onSelectClick(evt)}
                                                            perfectDrawEnabled={false}
                                                        />

                                                        <DynamicStrokeShape
                                                            points={liveTreebedPoints}
                                                            stroke={COLORS.orange}
                                                            strokeWidth={treebedSelectionStrokeWidth}
                                                            seedKey={`treebed-stroke:${obj.id}:${obj.treebedVariant ?? "standard"}:selected`}
                                                        />

                                                        <Rect
                                                            x={bbox.x}
                                                            y={bbox.y}
                                                            width={bbox.w}
                                                            height={bbox.h}
                                                            fillEnabled={false}
                                                            stroke={COLORS.orange}
                                                            strokeWidth={treebedSelectionStrokeWidth}
                                                            listening={false}
                                                            perfectDrawEnabled={false}
                                                        />
                                                    </>
                                                )}
                                                {renderTreebedTrunks(
                                                    obj.treebedVariant,
                                                    cx,
                                                    cy,
                                                    trunkRadius,
                                                    `selected-treebed-${obj.id}`,
                                                    false
                                                )}

                                                {treebedHandles.map(({ corner, point }) => {
                                                    const resizeCursor =
                                                        corner === "tl" || corner === "br"
                                                            ? "nwse-resize"
                                                            : "nesw-resize";

                                                    return (
                                                        <React.Fragment key={`${obj.id}-${corner}`}>
                                                            <Circle
                                                                x={point.x}
                                                                y={point.y}
                                                                radius={handleHitRadius}
                                                                fill="rgba(0,0,0,0.001)"
                                                                strokeEnabled={false}
                                                                draggable={false}
                                                                perfectDrawEnabled={false}
                                                                onMouseDown={(e) => {
                                                                    e.cancelBubble = true;
                                                                    isTreebedResizeHandleHoveredRef.current = true;
                                                                    startTreebedResize(e, obj, corner, liveTreebedPoints);

                                                                    const st = stageRef.current;
                                                                    if (!st) return;
                                                                    st.container().style.cursor = resizeCursor;
                                                                }}
                                                                onMouseEnter={() => {
                                                                    const st = stageRef.current;
                                                                    if (!st) return;
                                                                    isTreebedResizeHandleHoveredRef.current = true;
                                                                    st.container().style.cursor = resizeCursor;
                                                                }}
                                                                onMouseMove={() => {
                                                                    const st = stageRef.current;
                                                                    if (!st) return;
                                                                    isTreebedResizeHandleHoveredRef.current = true;
                                                                    st.container().style.cursor = resizeCursor;
                                                                }}
                                                                onMouseLeave={() => {
                                                                    const st = stageRef.current;
                                                                    if (!st) return;
                                                                    isTreebedResizeHandleHoveredRef.current = false;
                                                                    if (treebedResizeRef.current) return;
                                                                    st.container().style.cursor = isPanning ? "grabbing" : "default";
                                                                }}
                                                            />

                                                            <Circle
                                                                x={point.x}
                                                                y={point.y}
                                                                radius={handleRadius}
                                                                fill="#ffffff"
                                                                stroke={COLORS.orange}
                                                                strokeWidth={2}
                                                                draggable={false}
                                                                listening={false}
                                                                perfectDrawEnabled={false}
                                                            />
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })()
                                ) : ((obj.holes?.length ?? 0) > 0) ? (
                                    (() => {
                                        const lineOnly = isFenceOrGate(obj.type);

                                        const isVertexEditingThisPolygon =
                                            isVertexDraggingRef.current &&
                                            vertexEditRef.current?.objectId === obj.id &&
                                            Array.isArray(vertexEditRef.current?.workingPoints) &&
                                            vertexEditRef.current!.workingPoints.length >= 6;

                                        const isEdgeEditingThisPolygon =
                                            isEdgeResizingRef.current &&
                                            edgeResizeRef.current?.objectId === obj.id &&
                                            Array.isArray(edgeResizeRef.current?.workingPoints) &&
                                            edgeResizeRef.current!.workingPoints.length >= 6;

                                        const livePolygonPoints = isVertexEditingThisPolygon
                                            ? vertexEditRef.current!.workingPoints
                                            : isEdgeEditingThisPolygon
                                                ? edgeResizeRef.current!.workingPoints
                                                : obj.points;

                                        const livePolygonHoles = isVertexEditingThisPolygon
                                            ? (vertexEditRef.current!.workingHoles ?? obj.holes ?? [])
                                            : isEdgeEditingThisPolygon
                                                ? (edgeResizeRef.current!.workingHoles ?? obj.holes ?? [])
                                                : (obj.holes ?? []);

                                        const selectedPatternImage = isBuildingType(obj.type)
                                            ? getBuildingPatternCanvas(obj.type)
                                            : undefined;

                                        const onSelectClick = (evt?: any) => {
                                            const multi = !!(evt?.evt?.ctrlKey || evt?.evt?.metaKey);

                                            if (multi) {
                                                handleObjectSelection(obj.id, evt?.evt);
                                                return;
                                            }

                                            const ids = selectedObjectIds;
                                            if (!ids.includes(obj.id)) return;

                                            const next = [obj.id, ...ids.filter((x: string) => x !== obj.id)];
                                            selectObjects(next);
                                        };

                                        const renderResizeEdgeHits = (ringPoints: number[], holeIndex: number | null) =>
                                            activeTool === "select" &&
                                            selected.length === 1 &&
                                            !lineOnly &&
                                            Array.from({ length: ringPoints.length / 2 }).map((_, edgeIndex) => {
                                                const pointCount = ringPoints.length / 2;
                                                const aIdx = edgeIndex * 2;
                                                const bIdx = ((edgeIndex + 1) % pointCount) * 2;

                                                const ax = ringPoints[aIdx];
                                                const ay = ringPoints[aIdx + 1];
                                                const bx = ringPoints[bIdx];
                                                const by = ringPoints[bIdx + 1];

                                                const orientation = getOrthogonalEdgeOrientation(ax, ay, bx, by);
                                                if (!orientation) return null;

                                                return (
                                                    <Line
                                                        key={`${obj.id}-${holeIndex === null ? "outer" : `hole-${holeIndex}`}-edge-hit-${edgeIndex}`}
                                                        points={[ax, ay, bx, by]}
                                                        closed={false}
                                                        stroke="rgba(0,0,0,0)"
                                                        strokeWidth={18}
                                                        hitStrokeWidth={18}
                                                        lineCap="butt"
                                                        lineJoin="miter"
                                                        perfectDrawEnabled={false}
                                                        onMouseEnter={() => {
                                                            const st = stageRef.current;
                                                            if (!st || isVertexDraggingRef.current) return;

                                                            isResizeEdgeHoveredRef.current = true;
                                                            st.container().style.cursor = getEdgeResizeCursor(orientation);
                                                        }}
                                                        onMouseLeave={() => {
                                                            const st = stageRef.current;
                                                            if (!st) return;

                                                            isResizeEdgeHoveredRef.current = false;

                                                            if (isEdgeResizingRef.current) return;

                                                            st.container().style.cursor = "move";
                                                        }}
                                                        onMouseDown={(evt) => {
                                                            evt.cancelBubble = true;
                                                            evt.evt.preventDefault();

                                                            if (activeTool !== "select") return;
                                                            if (isVertexDraggingRef.current) return;

                                                            suppressPlantbedFocusRef.current = true;
                                                            pendingPlantbedClickRef.current = null;
                                                            plantbedClickMovedRef.current = false;

                                                            edgeResizeRef.current = {
                                                                objectId: obj.id,
                                                                edgeIndex,
                                                                orientation,
                                                                holeIndex,
                                                                workingPoints: [...livePolygonPoints],
                                                                workingHoles: livePolygonHoles.map((h: number[]) => [...h]),
                                                            };

                                                            isEdgeResizingRef.current = true;
                                                            setIsEdgeResizing(true);

                                                            const st = stageRef.current;
                                                            if (st) {
                                                                st.container().style.cursor = getEdgeResizeCursor(orientation);
                                                            }
                                                        }}
                                                    />
                                                );
                                            });

                                        const renderSelectionContour = (
                                            ringPoints: number[],
                                            key: string,
                                            strokeWidth: number
                                        ) => (
                                            <Line
                                                key={key}
                                                points={ringPoints}
                                                closed
                                                fillEnabled={false}
                                                stroke={COLORS.orange}
                                                strokeWidth={strokeWidth}
                                                lineCap="butt"
                                                lineJoin="miter"
                                                listening={false}
                                                perfectDrawEnabled={false}
                                                opacity={1}
                                            />
                                        );

                                        return (
                                            <React.Fragment key={`sel-hole-poly-${obj.id}`}>
                                                <PolygonWithHoles
                                                    points={livePolygonPoints}
                                                    holes={livePolygonHoles}
                                                    fill={selectedPatternImage ? undefined : OBJECT_STYLES[obj.type].fill}
                                                    fillPriority={selectedPatternImage ? "pattern" : "color"}
                                                    fillPatternImage={selectedPatternImage as unknown as HTMLImageElement | undefined}
                                                    fillPatternRepeat={selectedPatternImage ? "repeat" : undefined}
                                                    stroke={undefined}
                                                    strokeWidth={0}
                                                    opacity={1}
                                                    draggable={false}
                                                    listening
                                                    perfectDrawEnabled={false}
                                                    onMouseEnter={() => {
                                                        const st = stageRef.current;
                                                        if (!st) return;
                                                        if (isEdgeResizingRef.current) return;
                                                        if (isResizeEdgeHoveredRef.current) return;
                                                        st.container().style.cursor = isVertexDraggingRef.current ? "default" : "move";
                                                    }}
                                                    onMouseLeave={() => {
                                                        const st = stageRef.current;
                                                        if (!st) return;
                                                        if (isEdgeResizingRef.current) return;
                                                        if (isResizeEdgeHoveredRef.current) return;
                                                        st.container().style.cursor =
                                                            activeTool === "hand"
                                                                ? "grab"
                                                                : activeTool === "select"
                                                                    ? "default"
                                                                    : activeTool === "draw" || activeTool === "cut"
                                                                        ? "crosshair"
                                                                        : "default";
                                                    }}
                                                    onClick={(evt) => onSelectClick(evt)}
                                                />

                                                {obj.type === "tiles"
                                                    ? renderTilesPatternSafe(
                                                        obj,
                                                        `selected-fill-pattern-${obj.id}`,
                                                        stageScale,
                                                        livePolygonPoints,
                                                        livePolygonHoles
                                                    )
                                                    : null}

                                                {renderSelectionContour(
                                                    livePolygonPoints,
                                                    `${obj.id}-outer-contour`,
                                                    obj.id === selectedObjectId ? 4 : 3
                                                )}

                                                {livePolygonHoles.map((holePts: number[], holeIndex: number) =>
                                                    renderSelectionContour(
                                                        holePts,
                                                        `${obj.id}-hole-contour-${holeIndex}`,
                                                        obj.id === selectedObjectId ? 4 : 3
                                                    )
                                                )}

                                                {renderResizeEdgeHits(livePolygonPoints, null)}
                                                {livePolygonHoles.map((holePts: number[], holeIndex: number) => renderResizeEdgeHits(holePts, holeIndex))}
                                            </React.Fragment>
                                        );
                                    })()
                                ) : (
                                    (() => {
                                        const lineOnly = isFenceOrGate(obj.type);
                                        const lineW = getLineStrokeWidth(obj.type);

                                        const isEditingThisLine =
                                            isVertexDraggingRef.current &&
                                            vertexEditRef.current?.objectId === obj.id &&
                                            Array.isArray(vertexEditRef.current?.workingPoints) &&
                                            vertexEditRef.current!.workingPoints.length >= 4;

                                        const livePoints = isEditingThisLine ? vertexEditRef.current!.workingPoints : obj.points;

                                        const pieces = (isEditingThisLine
                                            ? (getPolylineRenderPieces(livePoints, obj.type) as number[][])
                                            : ((obj.renderPieces ?? []) as number[][]));

                                        const onSelectClick = (evt?: any) => {
                                            const multi = !!(evt?.evt?.ctrlKey || evt?.evt?.metaKey);

                                            if (multi) {
                                                handleObjectSelection(obj.id, evt?.evt);
                                                return;
                                            }

                                            const ids = selectedObjectIds;
                                            if (!ids.includes(obj.id)) return;

                                            const next = [obj.id, ...ids.filter((x: string) => x !== obj.id)];
                                            selectObjects(next);
                                        };

                                        if (lineOnly) {
                                            const hitStrokeWidth = lineW + 14;
                                            const highlightW = 4;
                                            const visualPoints = getOneSidedPolylineRenderPoints(
                                                livePoints,
                                                lineW,
                                                inferPolylineRenderSide(
                                                    livePoints,
                                                    obj.type,
                                                    objects,
                                                    obj.renderSide ?? 1
                                                )
                                            );

                                            return (
                                                <React.Fragment key={`sel-${obj.id}`}>
                                                    <Line
                                                        ref={(node) => {
                                                            if (!node) return;
                                                            selectedLineRefs.current[obj.id] = node;
                                                        }}
                                                        points={visualPoints}
                                                        closed={false}
                                                        fillEnabled={false}
                                                        stroke="rgba(0,0,0,0)"
                                                        strokeWidth={hitStrokeWidth}
                                                        hitStrokeWidth={hitStrokeWidth}
                                                        lineCap="square"
                                                        lineJoin="miter"
                                                        opacity={1}
                                                        draggable={false}
                                                        onClick={(evt) => onSelectClick(evt)}
                                                    />

                                                    <Line
                                                        points={visualPoints}
                                                        closed={false}
                                                        fillEnabled={false}
                                                        stroke={COLORS.orange}
                                                        strokeWidth={lineW + highlightW}
                                                        lineCap="square"
                                                        lineJoin="miter"
                                                        listening={false}
                                                        perfectDrawEnabled={false}
                                                        opacity={1}
                                                    />

                                                    <Line
                                                        points={visualPoints}
                                                        closed={false}
                                                        fillEnabled={false}
                                                        stroke={OBJECT_STYLES[obj.type].stroke}
                                                        strokeWidth={lineW - 1}
                                                        lineCap="square"
                                                        lineJoin="miter"
                                                        listening={false}
                                                        perfectDrawEnabled={false}
                                                        opacity={1}
                                                    />

                                                    <Line
                                                        points={visualPoints}
                                                        closed={false}
                                                        fillEnabled={false}
                                                        stroke={OBJECT_STYLES[obj.type].fill}
                                                        strokeWidth={Math.max(1, lineW - 3)}
                                                        lineCap="square"
                                                        lineJoin="miter"
                                                        listening={false}
                                                        perfectDrawEnabled={false}
                                                        opacity={1}
                                                    />
                                                </React.Fragment>
                                            );
                                        }

                                        const isVertexEditingThisPolygon =
                                            isVertexDraggingRef.current &&
                                            vertexEditRef.current?.objectId === obj.id &&
                                            Array.isArray(vertexEditRef.current?.workingPoints) &&
                                            vertexEditRef.current!.workingPoints.length >= 6;

                                        const isEdgeEditingThisPolygon =
                                            isEdgeResizingRef.current &&
                                            edgeResizeRef.current?.objectId === obj.id &&
                                            Array.isArray(edgeResizeRef.current?.workingPoints) &&
                                            edgeResizeRef.current!.workingPoints.length >= 6;

                                        const livePolygonPoints = isVertexEditingThisPolygon
                                            ? vertexEditRef.current!.workingPoints
                                            : isEdgeEditingThisPolygon
                                                ? edgeResizeRef.current!.workingPoints
                                                : obj.points;

                                        const selectedPatternImage = isBuildingType(obj.type)
                                            ? getBuildingPatternCanvas(obj.type)
                                            : undefined;

                                        return (
                                            <React.Fragment key={`sel-poly-${obj.id}`}>
                                                <>
                                                    <Line
                                                        ref={(node) => {
                                                            if (!node) return;
                                                            selectedLineRefs.current[obj.id] = node;
                                                        }}
                                                        points={livePolygonPoints}
                                                        closed
                                                        fill={selectedPatternImage ? undefined : OBJECT_STYLES[obj.type].fill}
                                                        fillEnabled
                                                        fillPriority={selectedPatternImage ? "pattern" : "color"}
                                                        fillPatternImage={selectedPatternImage as unknown as HTMLImageElement | undefined}
                                                        fillPatternRepeat={selectedPatternImage ? "repeat" : undefined}
                                                        stroke={COLORS.orange}
                                                        strokeWidth={obj.id === selectedObjectId ? 4 : 3}
                                                        lineCap="butt"
                                                        lineJoin="miter"
                                                        opacity={1}
                                                        draggable={false}
                                                        onMouseEnter={() => {
                                                            const st = stageRef.current;
                                                            if (!st) return;
                                                            if (isEdgeResizingRef.current) return;
                                                            st.container().style.cursor = "move";
                                                        }}
                                                        onMouseLeave={() => {
                                                            const st = stageRef.current;
                                                            if (!st) return;
                                                            if (isEdgeResizingRef.current) return;
                                                            st.container().style.cursor =
                                                                activeTool === "hand"
                                                                    ? "grab"
                                                                    : activeTool === "select"
                                                                        ? "default"
                                                                        : activeTool === "draw" || activeTool === "cut"
                                                                            ? "crosshair"
                                                                            : "default";
                                                        }}
                                                        onClick={(evt) => onSelectClick(evt)}
                                                    />
                                                    {obj.type === "tiles"
                                                        ? renderTilesPattern(
                                                            obj,
                                                            `selected-fill-pattern-${obj.id}`,
                                                            stageScale,
                                                            livePolygonPoints
                                                        )
                                                        : null}
                                                </>

                                                {activeTool === "select" &&
                                                    selected.length === 1 &&
                                                    !lineOnly &&
                                                    (obj.holes?.length ?? 0) === 0 &&
                                                    Array.from({ length: livePolygonPoints.length / 2 }).map((_, edgeIndex) => {
                                                        const pointCount = livePolygonPoints.length / 2;
                                                        const aIdx = edgeIndex * 2;
                                                        const bIdx = ((edgeIndex + 1) % pointCount) * 2;

                                                        const ax = livePolygonPoints[aIdx];
                                                        const ay = livePolygonPoints[aIdx + 1];
                                                        const bx = livePolygonPoints[bIdx];
                                                        const by = livePolygonPoints[bIdx + 1];

                                                        const orientation = getOrthogonalEdgeOrientation(ax, ay, bx, by);
                                                        if (!orientation) return null;

                                                        return (
                                                            <Line
                                                                key={`${obj.id}-edge-hit-${edgeIndex}`}
                                                                points={[ax, ay, bx, by]}
                                                                closed={false}
                                                                stroke="rgba(0,0,0,0)"
                                                                strokeWidth={18}
                                                                hitStrokeWidth={18}
                                                                lineCap="butt"
                                                                lineJoin="miter"
                                                                perfectDrawEnabled={false}
                                                                onMouseEnter={() => {
                                                                    const st = stageRef.current;
                                                                    if (!st || isVertexDraggingRef.current) return;

                                                                    isResizeEdgeHoveredRef.current = true;

                                                                    if (isEdgeResizingRef.current) {
                                                                        st.container().style.cursor = getEdgeResizeCursor(orientation);
                                                                        return;
                                                                    }

                                                                    st.container().style.cursor = getEdgeResizeCursor(orientation);
                                                                }}
                                                                onMouseLeave={() => {
                                                                    const st = stageRef.current;
                                                                    if (!st) return;

                                                                    isResizeEdgeHoveredRef.current = false;

                                                                    if (isEdgeResizingRef.current) return;

                                                                    st.container().style.cursor = "move";
                                                                }}
                                                                onMouseDown={(evt) => {
                                                                    evt.cancelBubble = true;
                                                                    evt.evt.preventDefault();

                                                                    if (activeTool !== "select") return;
                                                                    if (isVertexDraggingRef.current) return;

                                                                    suppressPlantbedFocusRef.current = true;
                                                                    pendingPlantbedClickRef.current = null;
                                                                    plantbedClickMovedRef.current = false;

                                                                    edgeResizeRef.current = {
                                                                        objectId: obj.id,
                                                                        edgeIndex,
                                                                        orientation,
                                                                        holeIndex: null,
                                                                        workingPoints: [...livePolygonPoints],
                                                                        workingHoles: (obj.holes ?? []).map((h: number[]) => [...h]),
                                                                    };

                                                                    isEdgeResizingRef.current = true;
                                                                    setIsEdgeResizing(true);

                                                                    const st = stageRef.current;
                                                                    if (st) {
                                                                        st.container().style.cursor = getEdgeResizeCursor(orientation);
                                                                    }
                                                                }}
                                                            />
                                                        );
                                                    })}
                                            </React.Fragment>
                                        );
                                    })()
                                )}

                                {obj.type === "plantbed" && (() => {
                                    if (!(viewVisibility as { showPlantNumbers: boolean }).showPlantNumbers) return null;

                                    const isVertexEditingThisPlantbed =
                                        isVertexDraggingRef.current &&
                                        vertexEditRef.current?.objectId === obj.id &&
                                        Array.isArray(vertexEditRef.current?.workingPoints) &&
                                        vertexEditRef.current.workingPoints.length >= 6;

                                    const isEdgeEditingThisPlantbed =
                                        isEdgeResizingRef.current &&
                                        edgeResizeRef.current?.objectId === obj.id &&
                                        Array.isArray(edgeResizeRef.current?.workingPoints) &&
                                        edgeResizeRef.current.workingPoints.length >= 6;

                                    const isLiveEditingThisPlantbed =
                                        isVertexEditingThisPlantbed || isEdgeEditingThisPlantbed;

                                    const livePoints = isVertexEditingThisPlantbed
                                        ? vertexEditRef.current!.workingPoints
                                        : isEdgeEditingThisPlantbed
                                            ? edgeResizeRef.current!.workingPoints
                                            : obj.points;

                                    const no = (obj as any).plantbedNo ?? 0;
                                    const areaText = formatSquareMeters(
                                        getObjectAreaInSquareMeters({
                                            ...obj,
                                            points: livePoints,
                                        })
                                    );

                                    const label = isLiveEditingThisPlantbed
                                        ? getPlantbedNumberLayout(
                                            livePoints,
                                            (obj.holes ?? []),
                                            no,
                                            areaText,
                                            treebedLabelBlockers
                                        )
                                        : plantbedNumberLayouts.get(obj.id);

                                    if (!label) return null;

                                    return (
                                        <Text
                                            x={label.x}
                                            y={label.y}
                                            width={label.width}
                                            align="center"
                                            wrap="none"
                                            text={label.text}
                                            fontSize={label.fontSize}
                                            fontStyle="bold"
                                            fill={OBJECT_STYLES[obj.type].stroke}
                                            listening={false}
                                            perfectDrawEnabled={false}
                                        />
                                    );
                                })()}

                                {activeTool === "select" && obj.type !== "treebed" && (() => {
                                    const isVertexEditingThisPolygon =
                                        isVertexDraggingRef.current &&
                                        vertexEditRef.current?.objectId === obj.id &&
                                        Array.isArray(vertexEditRef.current?.workingPoints) &&
                                        vertexEditRef.current!.workingPoints.length >= 6;

                                    const isEdgeEditingThisPolygon =
                                        isEdgeResizingRef.current &&
                                        edgeResizeRef.current?.objectId === obj.id &&
                                        Array.isArray(edgeResizeRef.current?.workingPoints) &&
                                        edgeResizeRef.current!.workingPoints.length >= 6;

                                    const pts = isVertexEditingThisPolygon
                                        ? vertexEditRef.current!.workingPoints
                                        : isEdgeEditingThisPolygon
                                            ? edgeResizeRef.current!.workingPoints
                                            : obj.points;

                                    const liveHoles = isVertexEditingThisPolygon
                                        ? (vertexEditRef.current!.workingHoles ?? obj.holes ?? [])
                                        : isEdgeEditingThisPolygon
                                            ? (edgeResizeRef.current!.workingHoles ?? obj.holes ?? [])
                                            : (obj.holes ?? []);

                                    const handleRadius = 6;

                                    if (!vertexHandleRefs.current[obj.id]) vertexHandleRefs.current[obj.id] = {};

                                    const uniqueOuterHandles = (() => {
                                        const seen = new Set<string>();
                                        const out: Array<{ i: number; x: number; y: number }> = [];

                                        for (let i = 0; i < pts.length / 2; i++) {
                                            const x = pts[i * 2];
                                            const y = pts[i * 2 + 1];
                                            const key = `${x}:${y}`;

                                            if (seen.has(key)) continue;
                                            seen.add(key);

                                            out.push({ i, x, y });
                                        }

                                        return out;
                                    })();

                                    const uniqueHoleHandles = liveHoles.map((holePts: number[], holeIdx: number) => {
                                        const seen = new Set<string>();
                                        const out: Array<{ i: number; x: number; y: number; holeIdx: number }> = [];

                                        for (let i = 0; i < holePts.length / 2; i++) {
                                            const x = holePts[i * 2];
                                            const y = holePts[i * 2 + 1];
                                            const key = `${x}:${y}`;

                                            if (seen.has(key)) continue;
                                            seen.add(key);

                                            out.push({ i, x, y, holeIdx });
                                        }

                                        return out;
                                    });

                                    return (
                                        <React.Fragment key={`${obj.id}-all-vh`}>
                                            {uniqueOuterHandles.map(({ i, x, y }) => (
                                                <Circle
                                                    key={`${obj.id}-vh-${i}`}
                                                    x={x}
                                                    y={y}
                                                    radius={handleRadius}
                                                    fill="#ffffff"
                                                    stroke={COLORS.orange}
                                                    strokeWidth={2}
                                                    opacity={1}
                                                    perfectDrawEnabled={false}
                                                    ref={(node) => {
                                                        if (!node) return;
                                                        vertexHandleRefs.current[obj.id][`${i}`] = node;
                                                    }}
                                                    draggable={false}
                                                    onMouseDown={(evt) => {
                                                        evt.cancelBubble = true;
                                                        evt.evt.preventDefault();

                                                        suppressPlantbedFocusRef.current = true;
                                                        pendingPlantbedClickRef.current = null;
                                                        plantbedClickMovedRef.current = false;

                                                        isVertexDraggingRef.current = true;
                                                        setIsVertexDragging(true);

                                                        activeVertexIndexRef.current = i * 2;

                                                        vertexEditRef.current = {
                                                            objectId: obj.id,
                                                            vertexIndex: i * 2,
                                                            holeIndex: null,
                                                            workingPoints: [...pts],
                                                            workingHoles: liveHoles.map((h: number[]) => [...h]),
                                                        };

                                                        const st = stageRef.current;
                                                        if (st) st.container().style.cursor = "grabbing";
                                                    }}
                                                    onMouseEnter={() => {
                                                        const st = stageRef.current;
                                                        if (!st) return;
                                                        st.container().style.cursor = "pointer";
                                                    }}
                                                    onMouseLeave={() => {
                                                        const st = stageRef.current;
                                                        if (!st) return;
                                                        st.container().style.cursor = "default";
                                                    }}
                                                />
                                            ))}

                                            {uniqueHoleHandles.map((holeHandles: Array<{ i: number; x: number; y: number; holeIdx: number }>) =>
                                                holeHandles.map(({ i, x, y, holeIdx }: { i: number; x: number; y: number; holeIdx: number }) => (
                                                    <Circle
                                                        key={`${obj.id}-hole-${holeIdx}-vh-${i}`}
                                                        x={x}
                                                        y={y}
                                                        radius={handleRadius}
                                                        fill="#ffffff"
                                                        stroke={COLORS.orange}
                                                        strokeWidth={2}
                                                        opacity={1}
                                                        perfectDrawEnabled={false}
                                                        ref={(node) => {
                                                            if (!node) return;
                                                            vertexHandleRefs.current[obj.id][`h-${holeIdx}-${i}`] = node;
                                                        }}
                                                        draggable={false}
                                                        onMouseDown={(evt) => {
                                                            evt.cancelBubble = true;
                                                            evt.evt.preventDefault();

                                                            suppressPlantbedFocusRef.current = true;
                                                            pendingPlantbedClickRef.current = null;
                                                            plantbedClickMovedRef.current = false;

                                                            isVertexDraggingRef.current = true;
                                                            setIsVertexDragging(true);

                                                            activeVertexIndexRef.current = i * 2;

                                                            vertexEditRef.current = {
                                                                objectId: obj.id,
                                                                vertexIndex: i * 2,
                                                                holeIndex: holeIdx,
                                                                workingPoints: [...pts],
                                                                workingHoles: liveHoles.map((h: number[]) => [...h]),
                                                            };

                                                            const st = stageRef.current;
                                                            if (st) st.container().style.cursor = "grabbing";
                                                        }}
                                                        onMouseEnter={() => {
                                                            const st = stageRef.current;
                                                            if (!st) return;
                                                            st.container().style.cursor = "pointer";
                                                        }}
                                                        onMouseLeave={() => {
                                                            const st = stageRef.current;
                                                            if (!st) return;
                                                            st.container().style.cursor = "default";
                                                        }}
                                                    />
                                                ))
                                            )}
                                        </React.Fragment>
                                    );
                                })()}
                            </React.Fragment>
                        ))}

                        {/* ✅ Jouw labels block blijft hier (zoals je al had) */}
                        {activeTool === "select" &&
                            selected.length > 0 &&
                            !isBoxSelecting &&
                            !shouldHideHeavySceneDecorations &&
                            !shouldHideSelectionLabelsForPerformance && (
                                <>
                                    {selected.map((obj: PolyObject) => {
                                        const isVertexEditingThisPolygon =
                                            isVertexDraggingRef.current &&
                                            vertexEditRef.current?.objectId === obj.id &&
                                            Array.isArray(vertexEditRef.current?.workingPoints) &&
                                            vertexEditRef.current!.workingPoints.length >= 6;

                                        const isEdgeEditingThisPolygon =
                                            isEdgeResizingRef.current &&
                                            edgeResizeRef.current?.objectId === obj.id &&
                                            Array.isArray(edgeResizeRef.current?.workingPoints) &&
                                            edgeResizeRef.current!.workingPoints.length >= 6;

                                        const isTreebedResizeEditingThisObject =
                                            treebedResizePreview?.objectId === obj.id &&
                                            Array.isArray(treebedResizePreview?.points) &&
                                            treebedResizePreview.points.length >= 6;

                                        const isTreebedRotateEditingThisObject =
                                            treebedRotatePreview?.objectId === obj.id &&
                                            Array.isArray(treebedRotatePreview?.points) &&
                                            treebedRotatePreview.points.length >= 6;

                                        const labelPoints = isTreebedRotateEditingThisObject
                                            ? treebedRotatePreview!.points
                                            : isTreebedResizeEditingThisObject
                                                ? treebedResizePreview!.points
                                                : isVertexEditingThisPolygon
                                                    ? vertexEditRef.current!.workingPoints
                                                    : isEdgeEditingThisPolygon
                                                        ? edgeResizeRef.current!.workingPoints
                                                        : obj.points;

                                        const labelText =
                                            obj.type === "plantbed"
                                                ? `Plantvak ${(obj as any).plantbedNo ?? "?"}`
                                                : getTreebedLabel(obj);

                                        const count =
                                            obj.type === "plantbed"
                                                ? (typeof getPlantbedLinkedCount === "function" ? getPlantbedLinkedCount(obj.id) : 0)
                                                : null;

                                        const invScale = BASE_SCALE / stageScale;
                                        const LABEL_GAP_PX = 32;

                                        let centerX = 0;
                                        let anchorY = 0;

                                        if (isFenceOrGate(obj.type)) {
                                            const lineW = getLineStrokeWidth(obj.type);
                                            const visualPts = getOneSidedPolylineRenderPoints(
                                                labelPoints,
                                                lineW,
                                                inferPolylineRenderSide(
                                                    labelPoints,
                                                    obj.type,
                                                    objects,
                                                    obj.renderSide ?? 1
                                                )
                                            );

                                            let totalLen = 0;
                                            const segLens: number[] = [];
                                            for (let i = 0; i <= visualPts.length - 4; i += 2) {
                                                const len = Math.hypot(
                                                    visualPts[i + 2] - visualPts[i],
                                                    visualPts[i + 3] - visualPts[i + 1]
                                                );
                                                segLens.push(len);
                                                totalLen += len;
                                            }

                                            let target = totalLen / 2;
                                            let idx = 0;
                                            while (idx < segLens.length && target > segLens[idx]) {
                                                target -= segLens[idx];
                                                idx++;
                                            }

                                            const ax = visualPts[idx * 2];
                                            const ay = visualPts[idx * 2 + 1];
                                            const bx = visualPts[idx * 2 + 2];
                                            const by = visualPts[idx * 2 + 3];
                                            const segLen = segLens[idx] || 1;
                                            const t = target / segLen;

                                            centerX = ax + (bx - ax) * t;
                                            const cy = ay + (by - ay) * t;

                                            const dx = bx - ax;
                                            const dy = by - ay;
                                            const len = Math.hypot(dx, dy) || 1;
                                            const nx = -dy / len;
                                            const ny = dx / len;

                                            anchorY = cy + ny * (LABEL_GAP_PX / stageScale);
                                        } else {
                                            const bb = bboxFromPoints(labelPoints);
                                            const pts = labelPoints;

                                            const eps = 1e-6;
                                            const topY = bb.y;

                                            let minTopX = Infinity;
                                            let maxTopX = -Infinity;

                                            for (let i = 0; i < pts.length; i += 2) {
                                                const x = pts[i];
                                                const y = pts[i + 1];
                                                if (Math.abs(y - topY) <= eps) {
                                                    if (x < minTopX) minTopX = x;
                                                    if (x > maxTopX) maxTopX = x;
                                                }
                                            }

                                            centerX =
                                                Number.isFinite(minTopX) && Number.isFinite(maxTopX)
                                                    ? (minTopX + maxTopX) / 2
                                                    : bb.x + bb.w / 2;

                                            anchorY = topY - (LABEL_GAP_PX / stageScale);
                                        }

                                        const isPrimary = obj.id === selectedObjectId && selected.length === 1;
                                        const disableLabelPointerEvents =
                                            isEdgeEditingThisPolygon ||
                                            isVertexEditingThisPolygon ||
                                            isTreebedResizeEditingThisObject ||
                                            isTreebedRotateEditingThisObject;

                                        return (
                                            <Html
                                                key={`sel-label-${obj.id}`}
                                                transform
                                                groupProps={{
                                                    x: centerX,
                                                    y: anchorY,
                                                }}
                                                divProps={{ style: { pointerEvents: "none" } }}
                                            >
                                                <div
                                                    style={{
                                                        transform: `translate(-50%, -100%) scale(${invScale})`,
                                                        transformOrigin: "bottom center",
                                                        pointerEvents:
                                                            isPrimary && !disableLabelPointerEvents
                                                                ? "auto"
                                                                : "none",
                                                    }}
                                                    onMouseDown={(e) => {
                                                        if (!isPrimary || disableLabelPointerEvents) return;
                                                        e.stopPropagation();
                                                    }}
                                                    onClick={(e) => {
                                                        if (!isPrimary || disableLabelPointerEvents) return;
                                                        e.stopPropagation();
                                                    }}
                                                    onWheelCapture={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                    }}
                                                >
                                                    <TypeLabelCard
                                                        currentType={obj.type as ObjectType}
                                                        currentTreebedVariant={obj.treebedVariant ?? "standard"}
                                                        labelText={labelText}
                                                        badgeCount={count !== null ? Number(count) : null}
                                                        interactive={isPrimary}
                                                        onDuplicate={() => {
                                                            if (!isPrimary) return;
                                                            handleDuplicateSelection();
                                                        }}
                                                        onChangeType={(t) => {
                                                            if (!isPrimary) return;

                                                            const fromLabel =
                                                                obj.type === "plantbed"
                                                                    ? `Plantvak ${(obj as any).plantbedNo ?? "?"}`
                                                                    : obj.type === "treebed"
                                                                        ? getTreebedLabel(obj)
                                                                        : (TYPE_LABELS[obj.type as ObjectType] ?? obj.type);

                                                            const toLabel =
                                                                t === "plantbed"
                                                                    ? "Plantvak"
                                                                    : (TYPE_LABELS[t] ?? t);

                                                            const hasPlantbedLinks =
                                                                obj.type === "plantbed" &&
                                                                t !== "plantbed" &&
                                                                ((useProjectStore.getState().plantbedLinks?.[obj.id] ?? []).length > 0);

                                                            if (typeof requestChangeObjectType === "function") {
                                                                requestChangeObjectType(obj.id, t);
                                                            }

                                                            if (!hasPlantbedLinks) {
                                                                notify(APP_NOTIFICATIONS.objectTypeChanged(fromLabel, toLabel));
                                                            }
                                                        }}
                                                        onChangeTreebedVariant={(variant) => {
                                                            if (!isPrimary) return;
                                                            if (typeof changeTreebedVariant === "function") {
                                                                changeTreebedVariant(obj.id, variant);
                                                            }
                                                        }}
                                                        onTreebedVariantChanged={(fromVariant, toVariant) => {
                                                            const capitalize = (value: string) =>
                                                                value.charAt(0).toUpperCase() + value.slice(1);

                                                            notify(
                                                                APP_NOTIFICATIONS.treebedVariantChanged(
                                                                    capitalize(TREEBED_VARIANT_LABELS[fromVariant]),
                                                                    capitalize(TREEBED_VARIANT_LABELS[toVariant])
                                                                )
                                                            );
                                                        }}
                                                    />
                                                </div>
                                            </Html>
                                        );
                                    })}
                                </>
                            )}
                        {selected.length > 0 && (
                            <MeasurementOverlay
                                unselectedObjects={[]}
                                selectedObjects={selected}
                                selectedObjectId={selectedObjectId}
                                stageScale={stageScale}
                                activeTool={"select"}
                                activeDrawType={activeDrawType}
                                draftPoints={[]}
                                draftMeasurementPoints={[]}
                                primaryMeasurementObject={livePrimaryMeasurementObject}
                                plantbedNumberLayouts={livePlantbedNumberLayouts}
                                showSelectedDimensions={
                                    selected.length === 1 && !shouldHideSelectionLabelsForPerformance
                                }
                            />
                        )}
                    </Group>
                )}

                {!shouldHideHeavySceneDecorations && (
                    <>
                        {measureLines.map((linePoints: number[], index: number) => (
                            <MeasureToolOverlay
                                key={`measure-line-${index}-${linePoints.join(",")}`}
                                stageScale={stageScale}
                                committedPoints={linePoints}
                                previewPoint={null}
                            />
                        ))}

                        <MeasureToolOverlay
                            stageScale={stageScale}
                            committedPoints={measurePoints}
                            previewPoint={measurePreviewPoint}
                        />

                        {activeTool === "draw" && (
                            <MeasurementOverlay
                                unselectedObjects={[]}
                                selectedObjects={[]}
                                selectedObjectId={null}
                                stageScale={stageScale}
                                activeTool={activeTool}
                                activeDrawType={activeDrawType}
                                draftPoints={draftPoints}
                                draftMeasurementPoints={
                                    draftMeasurementPreviewPoint
                                        ? [
                                            ...draftPoints,
                                            draftMeasurementPreviewPoint.x,
                                            draftMeasurementPreviewPoint.y,
                                        ]
                                        : draftPoints
                                }
                                primaryMeasurementObject={null}
                                plantbedNumberLayouts={plantbedNumberLayouts}
                            />
                        )}
                    </>
                )}

                {shouldShowCursorCrosshair && cursorCrosshairPoint && (() => {
                    const visibleLeft = (-stagePos.x) / stageScale;
                    const visibleTop = (-stagePos.y) / stageScale;
                    const visibleRight = visibleLeft + canvasSize.w / stageScale;
                    const visibleBottom = visibleTop + canvasSize.h / stageScale;
                    const dash = [6, 6];

                    return (
                        <>
                            <Line
                                points={[
                                    cursorCrosshairPoint.x,
                                    visibleTop,
                                    cursorCrosshairPoint.x,
                                    visibleBottom,
                                ]}
                                stroke={COLORS.green}
                                strokeWidth={1}
                                strokeScaleEnabled={false}
                                dash={dash}
                                dashEnabled
                                opacity={0.85}
                                listening={false}
                                perfectDrawEnabled={false}
                            />
                            <Line
                                points={[
                                    visibleLeft,
                                    cursorCrosshairPoint.y,
                                    visibleRight,
                                    cursorCrosshairPoint.y,
                                ]}
                                stroke={COLORS.green}
                                strokeWidth={1}
                                strokeScaleEnabled={false}
                                dash={dash}
                                dashEnabled
                                opacity={0.85}
                                listening={false}
                                perfectDrawEnabled={false}
                            />
                        </>
                    );
                })()}

                {activeTool === "draw" &&
                    activeDrawType !== null &&
                    activeDrawType !== "treebed" &&
                    draftMeasurementPreviewPoint &&
                    draftMeasurementPreviewPoint &&
                    draftPoints.length >= 2 && (
                        <Line
                            points={[
                                draftPoints[draftPoints.length - 2],
                                draftPoints[draftPoints.length - 1],
                                draftMeasurementPreviewPoint.x,
                                draftMeasurementPreviewPoint.y,
                            ]}
                            stroke={COLORS.orange}
                            strokeWidth={2}
                            dash={[8, 8]}
                            dashEnabled
                            listening={false}
                            perfectDrawEnabled={false}
                        />
                    )}

                {/* Draft lines bovenop */}
                {activeDrawType === "treebed" && draftPoints.length === 2 && (() => {
                    const cx = draftPoints[0];
                    const cy = draftPoints[1];
                    const previewX = treebedDraftPreviewPoint?.x ?? cx;
                    const previewY = treebedDraftPreviewPoint?.y ?? cy;

                    const previewPoints = createTreebedPointsFromCenterDragSafe(
                        cx,
                        cy,
                        previewX,
                        previewY,
                        activeTreebedDrawVariant
                    );
                    const treebedVisual = getTreebedVisual(previewPoints, activeTreebedDrawVariant);

                    return (
                        <>
                            {treebedVisual.shape === "rect" ? (
                                <>
                                    <Line
                                        points={previewPoints}
                                        closed
                                        fill={treebedVisual.fill}
                                        opacity={0.18}
                                        listening={false}
                                        perfectDrawEnabled={false}
                                    />
                                    <Line
                                        points={previewPoints}
                                        closed
                                        fillEnabled={false}
                                        stroke={COLORS.orange}
                                        strokeWidth={2}
                                        dash={[8, 8]}
                                        dashEnabled
                                        listening={false}
                                        perfectDrawEnabled={false}
                                    />
                                </>
                            ) : (
                                <>
                                    <Circle
                                        x={treebedVisual.cx}
                                        y={treebedVisual.cy}
                                        radius={treebedVisual.radius}
                                        fill={treebedVisual.fill}
                                        opacity={0.18}
                                        listening={false}
                                        perfectDrawEnabled={false}
                                    />
                                    <Circle
                                        x={treebedVisual.cx}
                                        y={treebedVisual.cy}
                                        radius={treebedVisual.radius}
                                        fillEnabled={false}
                                        stroke={COLORS.orange}
                                        strokeWidth={2}
                                        dash={[8, 8]}
                                        dashEnabled
                                        listening={false}
                                        perfectDrawEnabled={false}
                                    />
                                </>
                            )}

                            {renderTreebedTrunks(
                                activeTreebedDrawVariant,
                                treebedVisual.cx,
                                treebedVisual.cy,
                                treebedVisual.trunkRadius,
                                "treebed-draft-preview",
                                false
                            )}

                            <Circle
                                x={treebedVisual.cx}
                                y={treebedVisual.cy}
                                radius={5}
                                fill={COLORS.orange}
                                stroke="#ffffff"
                                strokeWidth={2}
                                listening={false}
                                perfectDrawEnabled={false}
                                shadowColor="rgba(0,0,0,0.18)"
                                shadowBlur={2}
                                shadowOffset={{ x: 0, y: 1 }}
                            />
                        </>
                    );
                })()}

                {activeDrawType !== "treebed" && draftPoints.length >= 2 && (() => {
                    const lineOnly = isFenceOrGate(activeDrawType);
                    const lineW = getLineStrokeWidth(activeDrawType);

                    return (
                        <>
                            {!lineOnly && (
                                <Line
                                    points={draftPoints}
                                    closed={false}
                                    fillEnabled={false}
                                    stroke={COLORS.orange}
                                    strokeWidth={2}
                                    dash={activeTool === "cut" ? [8, 8] : undefined}
                                    dashEnabled={activeTool === "cut"}
                                    lineCap="round"
                                    lineJoin="round"
                                    listening={false}
                                    perfectDrawEnabled={false}
                                />
                            )}

                            {lineOnly && activeDrawType && (() => {
                                const visualDraftPoints = getOneSidedPolylineRenderPoints(
                                    draftPoints,
                                    lineW,
                                    inferPolylineRenderSide(
                                        draftPoints,
                                        activeDrawType,
                                        objects,
                                        1
                                    )
                                );

                                return (
                                    <>
                                        <>
                                            <Line
                                                points={visualDraftPoints}
                                                closed={false}
                                                fillEnabled={false}
                                                stroke={OBJECT_STYLES[activeDrawType].stroke}
                                                strokeWidth={lineW - 1}
                                                lineCap="square"
                                                lineJoin="miter"
                                                opacity={1}
                                                draggable={false}
                                                listening={false}
                                                perfectDrawEnabled={false}
                                            />
                                            <Line
                                                points={visualDraftPoints}
                                                closed={false}
                                                fillEnabled={false}
                                                stroke={OBJECT_STYLES[activeDrawType].fill}
                                                strokeWidth={Math.max(1, lineW - 5)}
                                                lineCap="square"
                                                lineJoin="miter"
                                                opacity={1}
                                                draggable={false}
                                                listening={false}
                                                perfectDrawEnabled={false}
                                            />
                                        </>
                                    </>
                                );
                            })()}

                            {!lineOnly && activeTool !== "cut" && (
                                <Line
                                    points={draftPoints}
                                    closed={false}
                                    fillEnabled={false}
                                    stroke={COLORS.orange}
                                    strokeWidth={2}
                                    lineCap="round"
                                    lineJoin="round"
                                    listening={false}
                                    perfectDrawEnabled={false}
                                />
                            )}

                            <Line
                                ref={draftGuideLineRef}
                                stroke="#58694C"
                                strokeWidth={1}
                                opacity={0.9}
                                dashEnabled
                                listening={false}
                                perfectDrawEnabled={false}
                            />

                            <Line
                                ref={draftSecondaryGuideLineRef}
                                stroke="#58694C"
                                strokeWidth={2}
                                dash={[4, 6]}
                                dashEnabled
                                opacity={0.9}
                                listening={false}
                                perfectDrawEnabled={false}
                            />
                            <Line
                                ref={draftPreviewLineRef}
                                stroke={COLORS.orange}
                                strokeWidth={2}
                                dash={[8, 8]}
                                dashEnabled
                                lineCap="butt"
                                lineJoin="miter"
                                listening={false}
                                perfectDrawEnabled={false}
                            />

                            {Array.from({ length: draftPoints.length / 2 }).map((_, i) => {
                                const x = draftPoints[i * 2];
                                const y = draftPoints[i * 2 + 1];
                                const isLast = i === draftPoints.length / 2 - 1;

                                return (
                                    <Circle
                                        key={`draft-pt-${i}`}
                                        x={x}
                                        y={y}
                                        radius={5}
                                        fill={isLast ? COLORS.orange : "#ffffff"}
                                        stroke={COLORS.orange}
                                        strokeWidth={2}
                                        opacity={1}
                                        listening={false}
                                        perfectDrawEnabled={false}
                                        shadowColor="rgba(0,0,0,0.18)"
                                        shadowBlur={2}
                                        shadowOffset={{ x: 0, y: 1 }}
                                    />
                                );
                            })}
                        </>
                    );
                })()}
            </Layer>
        </>
    );
}