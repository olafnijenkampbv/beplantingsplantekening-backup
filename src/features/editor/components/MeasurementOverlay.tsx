import React, { useMemo } from "react";
import { Group, Line, Rect, Text } from "react-konva";
import { OBJECT_STYLES, ObjectType, PolyObject, normalizeBulges, useProjectStore } from "@/state/projectStore";
import { isBuildingObjectType } from "@/features/editor/components/editor/objectMenuConfig";
import {
    formatMeters,
    formatSquareMeters,
    getBoundingBoxFromPoints,
    getMetersFromEditorUnits,
    getObjectAreaInSquareMeters,
    getSegmentLengthInMeters,
    isAreaMeasurableObject,
} from "@/state/areaMetrics";
import { isUnifiedBoundaryType } from "@/features/editor/lib/boundarySystem";
import { arcSamples, densifyBulgedRing, STRAIGHT_THRESHOLD } from "@/features/editor/lib/bulgeMath";

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

type MeasurementOverlayProps = {
    unselectedObjects: PolyObject[];
    selectedObjects: PolyObject[];
    selectedObjectId: string | null;
    stageScale: number;
    activeTool: string;
    activeDrawType: ObjectType | null;
    draftPoints: number[];
    draftMeasurementPoints: number[];
    primaryMeasurementObject: PolyObject | null;
    plantbedNumberLayouts: Map<string, PlantbedNumberLayout>;
    showSelectedDimensions?: boolean;
    showDetailedSelectedDimensions?: boolean;
};
type AreaLabelRenderData =
    | {
        kind: "text";
        key: string;
        x: number;
        y: number;
        text: string;
        fontSize: number;
        fill: string;
        width?: number;
        align?: "center";
        wrap?: "none";
    }
    | {
        kind: "group-text";
        key: string;
        x: number;
        y: number;
        rotation: number;
        text: string;
        fontSize: number;
        fill: string;
    }
    | {
        kind: "group-text-with-bg";
        key: string;
        x: number;
        y: number;
        rotation: number;
        text: string;
        fontSize: number;
        fill: string;
        bgWidth: number;
        bgHeight: number;
        bgFill: string;
        bgCornerRadius: number;
    };

const COLORS = {
    orange: "#E94E1B",
    orangeLight: "#FFE5DD",
    green: "#58694C",
};

const MEASUREMENT_LABEL_LAYOUT = {
    areaFontSize: 14,
    areaFontWeight: "700",

    plantbedSpacing: 25,

    pillFontSize: 16,
    pillHeight: 28,
    pillPaddingX: 12,
    pillCornerRadius: 7,

    selectionOffset: 52,
    segmentOffset: -30,

    segmentDimensionOffset: 22,
    holeDimensionOffset: 16,
    segmentTextFontSize: 14,
    segmentTextGap: 10,
    witnessInset: 0,
};

const BUILDING_TYPES = {
    has(type: ObjectType) {
        return isBuildingObjectType(type);
    },
};

const INNER_MARGIN = 8;
const DEFAULT_AREA_FONT_SIZE = 16;
const COMPACT_AREA_FONT_SIZE = 13;
const BUILDING_LABEL_PADDING_X = 10;
const BUILDING_LABEL_PADDING_Y = 6;
const BUILDING_LABEL_CORNER_RADIUS = 6;

function estimateTextWidth(text: string, fontSize: number) {
    return text.length * fontSize * 0.58;
}

function sameArrayReference<T>(a: T[], b: T[]) {
    return a === b;
}

function getSegmentMidpoint(ax: number, ay: number, bx: number, by: number) {
    return {
        x: (ax + bx) / 2,
        y: (ay + by) / 2,
    };
}

function getPerpendicularOffset(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    distance: number
) {
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);

    if (length <= 1e-6) {
        return { x: 0, y: 0 };
    }

    return {
        x: (-dy / length) * distance,
        y: (dx / length) * distance,
    };
}

function flattenPoints(points: Array<{ x: number; y: number }>) {
    const out: number[] = [];
    for (const p of points) out.push(p.x, p.y);
    return out;
}

function getArcLengthInEditorUnits(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    bulge: number
) {
    const mids = arcSamples(ax, ay, bx, by, bulge, 28);
    const pts = [{ x: ax, y: ay }, ...mids.map(([x, y]) => ({ x, y })), { x: bx, y: by }];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i += 1) {
        total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    }
    return total;
}

function getMeasurementBoundsPoints(points: number[], bulges?: number[]) {
    const normalized = normalizeBulges(points, bulges);
    const hasBulges = normalized.some((b) => Math.abs(b) > STRAIGHT_THRESHOLD);
    if (!hasBulges) return points;
    return densifyBulgedRing(points, normalized, 36);
}

function circumcenter(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number
) {
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-7) return null;
    const a2 = ax * ax + ay * ay;
    const b2 = bx * bx + by * by;
    const c2 = cx * cx + cy * cy;
    const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
    const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    return { x: ux, y: uy };
}

function getPolylinePointAtHalfLength(points: Array<{ x: number; y: number }>) {
    if (points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return points[0];

    let total = 0;
    const segLens: number[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
        const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
        segLens.push(len);
        total += len;
    }
    const half = total / 2;
    let acc = 0;
    for (let i = 0; i < segLens.length; i += 1) {
        const len = segLens[i];
        if (acc + len >= half) {
            const t = len <= 1e-9 ? 0 : (half - acc) / len;
            return {
                x: points[i].x + (points[i + 1].x - points[i].x) * t,
                y: points[i].y + (points[i + 1].y - points[i].y) * t,
            };
        }
        acc += len;
    }
    return points[points.length - 1];
}

function pointInPolygon(px: number, py: number, poly: number[]) {
    let inside = false;

    for (let i = 0, j = poly.length - 2; i < poly.length; i += 2) {
        const xi = poly[i];
        const yi = poly[i + 1];
        const xj = poly[j];
        const yj = poly[j + 1];

        const intersect =
            (yi > py) !== (yj > py) &&
            px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;

        if (intersect) inside = !inside;
        j = i;
    }

    return inside;
}

function pointToSegmentDistance(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
        const ddx = px - x1;
        const ddy = py - y1;
        return Math.sqrt(ddx * ddx + ddy * ddy);
    }

    const t = Math.max(
        0,
        Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
    );

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const distX = px - projX;
    const distY = py - projY;

    return Math.sqrt(distX * distX + distY * distY);
}

function isInsideUsableArea(
    x: number,
    y: number,
    points: number[],
    holes: number[][]
) {
    if (!pointInPolygon(x, y, points)) return false;
    return !holes.some((hole) => pointInPolygon(x, y, hole));
}

function rectFitsInsideUsableArea(
    rect: { x: number; y: number; w: number; h: number },
    points: number[],
    holes: number[][]
) {
    const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.w, y: rect.y },
        { x: rect.x, y: rect.y + rect.h },
        { x: rect.x + rect.w, y: rect.y + rect.h },
    ];

    return corners.every((corner) =>
        isInsideUsableArea(corner.x, corner.y, points, holes)
    );
}

function bestInsidePointForAreaLabel(
    points: number[],
    holes: number[][],
    step: number,
    labelWidth: number,
    labelHeight: number
) {
    const bbox = getBoundingBoxFromPoints(points);
    const candidates: { x: number; y: number; score: number }[] = [];

    for (let y = bbox.y + step; y < bbox.y + bbox.h; y += step) {
        for (let x = bbox.x + step; x < bbox.x + bbox.w; x += step) {
            if (!isInsideUsableArea(x, y, points, holes)) continue;

            const labelRect = {
                x: x - labelWidth / 2,
                y: y - labelHeight / 2,
                w: labelWidth,
                h: labelHeight,
            };

            if (!rectFitsInsideUsableArea(labelRect, points, holes)) continue;

            let minDistOuter = Infinity;
            for (let i = 0; i < points.length; i += 2) {
                const x1 = points[i];
                const y1 = points[i + 1];
                const x2 = points[(i + 2) % points.length];
                const y2 = points[(i + 3) % points.length];
                minDistOuter = Math.min(
                    minDistOuter,
                    pointToSegmentDistance(x, y, x1, y1, x2, y2)
                );
            }

            let minDistHole = Infinity;
            for (const hole of holes) {
                for (let i = 0; i < hole.length; i += 2) {
                    const x1 = hole[i];
                    const y1 = hole[i + 1];
                    const x2 = hole[(i + 2) % hole.length];
                    const y2 = hole[(i + 3) % hole.length];
                    minDistHole = Math.min(
                        minDistHole,
                        pointToSegmentDistance(x, y, x1, y1, x2, y2)
                    );
                }
            }

            const nearestHoleDist = Number.isFinite(minDistHole) ? minDistHole : minDistOuter;
            const nearestOuterDist = minDistOuter;
            const minUsableDist = Math.min(nearestOuterDist, nearestHoleDist);

            const centerX = bbox.x + bbox.w / 2;
            const centerY = bbox.y + bbox.h / 2;
            const centerDist = Math.hypot(x - centerX, y - centerY);

            candidates.push({
                x,
                y,
                score: minUsableDist * 2.2 + nearestHoleDist * 1.6 - centerDist * 0.04,
            });
        }
    }

    if (candidates.length === 0) {
        return {
            x: bbox.x + bbox.w / 2,
            y: bbox.y + bbox.h / 2,
            score: -Infinity,
        };
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
}

function OrangePillLabel({
    x,
    y,
    text,
    stageScale,
    rotation = 0,
}: {
    x: number;
    y: number;
    text: string;
    stageScale: number;
    rotation?: number;
}) {
    const clampedStageScale = Math.max(stageScale, 1);
    const visualScale = 1 / clampedStageScale;

    const fontSize = MEASUREMENT_LABEL_LAYOUT.pillFontSize;
    const pillHeight = MEASUREMENT_LABEL_LAYOUT.pillHeight;
    const paddingX = MEASUREMENT_LABEL_LAYOUT.pillPaddingX;
    const cornerRadius = MEASUREMENT_LABEL_LAYOUT.pillCornerRadius;
    const textWidth = estimateTextWidth(text, fontSize);
    const width = textWidth + paddingX * 2;

    return (
        <Group
            x={x}
            y={y}
            rotation={rotation}
            scaleX={visualScale}
            scaleY={visualScale}
            listening={false}
        >
            <Rect
                x={-width / 2}
                y={-pillHeight / 2}
                width={width}
                height={pillHeight}
                cornerRadius={cornerRadius}
                fill={COLORS.orange}
                listening={false}
                perfectDrawEnabled={false}
            />
            <Text
                x={-textWidth / 2}
                y={-fontSize / 2 - 1}
                text={text}
                fontSize={fontSize}
                fontStyle="700"
                fill="#ffffff"
                listening={false}
                perfectDrawEnabled={false}
            />
        </Group>
    );
}

function renderAreaLabel(label: AreaLabelRenderData) {
    if (label.kind === "text") {
        return (
            <Text
                key={label.key}
                x={label.x}
                y={label.y}
                width={label.width}
                align={label.align}
                wrap={label.wrap}
                text={label.text}
                fontSize={label.fontSize}
                fontStyle="700"
                fill={label.fill}
                listening={false}
                perfectDrawEnabled={false}
            />
        );
    }

    if (label.kind === "group-text") {
        const textWidth = estimateTextWidth(label.text, label.fontSize);
        const textHeight = label.fontSize;

        return (
            <Group
                key={label.key}
                x={label.x}
                y={label.y}
                rotation={label.rotation}
                listening={false}
            >
                <Text
                    x={-textWidth / 2}
                    y={-textHeight / 2}
                    text={label.text}
                    fontSize={label.fontSize}
                    fontStyle="700"
                    fill={label.fill}
                    listening={false}
                    perfectDrawEnabled={false}
                />
            </Group>
        );
    }

    const textWidth = estimateTextWidth(label.text, label.fontSize);
    const textHeight = label.fontSize;

    return (
        <Group
            key={label.key}
            x={label.x}
            y={label.y}
            rotation={label.rotation}
            listening={false}
        >
            <Rect
                x={-label.bgWidth / 2}
                y={-label.bgHeight / 2}
                width={label.bgWidth}
                height={label.bgHeight}
                cornerRadius={label.bgCornerRadius}
                fill={label.bgFill}
                listening={false}
                perfectDrawEnabled={false}
            />
            <Text
                x={-textWidth / 2}
                y={-textHeight / 2}
                text={label.text}
                fontSize={label.fontSize}
                fontStyle="700"
                fill={label.fill}
                listening={false}
                perfectDrawEnabled={false}
            />
        </Group>
    );
}

function buildAreaLabelRenderData(
    object: PolyObject,
    plantbedNumberLayouts: Map<string, PlantbedNumberLayout>,
    keyPrefix: string
): AreaLabelRenderData | null {
    if (!isAreaMeasurableObject(object)) return null;
    if (!object.points || object.points.length < 6) return null;
    if (isUnifiedBoundaryType(object.type)) return null;

    const strokeColor = OBJECT_STYLES[object.type].stroke;

    if (
        object.type === "plantbed" ||
        object.type === "hedge" ||
        object.type === "treebed" ||
        object.type === "parking"
    ) {
        return null;
    }
    
    const bbox = getBoundingBoxFromPoints(object.points);
    const holes = object.holes ?? [];
    const areaText = formatSquareMeters(getObjectAreaInSquareMeters(object));
    const isBuildingType = BUILDING_TYPES.has(object.type);

    const maxWidth = Math.max(0, bbox.w - INNER_MARGIN * 2);
    const maxHeight = Math.max(0, bbox.h - INNER_MARGIN * 2);

    if (maxWidth <= 0 || maxHeight <= 0) return null;

    const canFit = (blockWidth: number, blockHeight: number) => {
        return blockWidth <= maxWidth && blockHeight <= maxHeight;
    };

    const areaCandidates = [
        { fontSize: DEFAULT_AREA_FONT_SIZE, rotation: 0 },
        { fontSize: DEFAULT_AREA_FONT_SIZE, rotation: -90 },
        { fontSize: COMPACT_AREA_FONT_SIZE, rotation: 0 },
        { fontSize: COMPACT_AREA_FONT_SIZE, rotation: -90 },
    ];

    const chosenCandidate = areaCandidates.find((candidate) => {
        const currentTextWidth = estimateTextWidth(areaText, candidate.fontSize);
        const currentTextHeight = candidate.fontSize;

        const baseWidth = candidate.rotation === 0 ? currentTextWidth : currentTextHeight;
        const baseHeight = candidate.rotation === 0 ? currentTextHeight : currentTextWidth;

        const fittedWidth = isBuildingType
            ? baseWidth + BUILDING_LABEL_PADDING_X * 2
            : baseWidth;

        const fittedHeight = isBuildingType
            ? baseHeight + BUILDING_LABEL_PADDING_Y * 2
            : baseHeight;

        return canFit(fittedWidth, fittedHeight);
    });

    if (!chosenCandidate) return null;

    const fontSize = chosenCandidate.fontSize;
    const textWidth = estimateTextWidth(areaText, fontSize);
    const textHeight = fontSize;
    const rotation = chosenCandidate.rotation;

    const baseWidth = rotation === 0 ? textWidth : textHeight;
    const baseHeight = rotation === 0 ? textHeight : textWidth;

    const occupiedWidth = isBuildingType
        ? baseWidth + BUILDING_LABEL_PADDING_X * 2
        : baseWidth;

    const occupiedHeight = isBuildingType
        ? baseHeight + BUILDING_LABEL_PADDING_Y * 2
        : baseHeight;

    const fallbackCenterX = bbox.x + bbox.w / 2;
    const fallbackCenterY = bbox.y + bbox.h / 2;

    const fallbackRect = {
        x: fallbackCenterX - occupiedWidth / 2,
        y: fallbackCenterY - occupiedHeight / 2,
        w: occupiedWidth,
        h: occupiedHeight,
    };

    const canUseFallbackCenter = rectFitsInsideUsableArea(
        fallbackRect,
        object.points,
        holes
    );

    const bestPoint = canUseFallbackCenter
        ? { x: fallbackCenterX, y: fallbackCenterY }
        : bestInsidePointForAreaLabel(
            object.points,
            holes,
            3,
            occupiedWidth,
            occupiedHeight
        );

    const centerX = bestPoint.x;
    const centerY = bestPoint.y;

    if (isBuildingType) {
        return {
            kind: "group-text-with-bg",
            key: `${keyPrefix}-${object.id}`,
            x: centerX,
            y: centerY,
            rotation,
            text: areaText,
            fontSize,
            fill: strokeColor,
            bgWidth: textWidth + BUILDING_LABEL_PADDING_X * 2,
            bgHeight: textHeight + BUILDING_LABEL_PADDING_Y * 2,
            bgFill: OBJECT_STYLES[object.type].fill,
            bgCornerRadius: BUILDING_LABEL_CORNER_RADIUS,
        };
    }

    if (rotation === 0) {
        return {
            kind: "text",
            key: `${keyPrefix}-${object.id}`,
            x: centerX - textWidth / 2,
            y: centerY - textHeight / 2,
            text: areaText,
            fontSize,
            fill: strokeColor,
        };
    }

    return {
        kind: "group-text",
        key: `${keyPrefix}-${object.id}`,
        x: centerX,
        y: centerY,
        rotation,
        text: areaText,
        fontSize,
        fill: strokeColor,
    };
}

function DimensionArrow({
    fromX,
    fromY,
    toX,
    toY,
    stageScale,
}: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    stageScale: number;
}) {
    const clampedStageScale = Math.max(stageScale, 1);
    const visualScale = 1 / clampedStageScale;
    const strokeWidth = 1.5 * visualScale;
    const headSize = 6 * visualScale;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.hypot(dx, dy);

    if (length <= 1e-6) return null;

    const ux = dx / length;
    const uy = dy / length;

    const leftHeadX = fromX + ux * headSize;
    const leftHeadY = fromY + uy * headSize;

    const rightHeadX = toX - ux * headSize;
    const rightHeadY = toY - uy * headSize;

    const perpX = -uy;
    const perpY = ux;

    return (
        <>
            <Line
                points={[fromX, fromY, toX, toY]}
                stroke={COLORS.orange}
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />
            <Line
                points={[
                    fromX,
                    fromY,
                    leftHeadX + perpX * headSize * 0.5,
                    leftHeadY + perpY * headSize * 0.5,
                ]}
                stroke={COLORS.orange}
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />
            <Line
                points={[
                    fromX,
                    fromY,
                    leftHeadX - perpX * headSize * 0.5,
                    leftHeadY - perpY * headSize * 0.5,
                ]}
                stroke={COLORS.orange}
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />
            <Line
                points={[
                    toX,
                    toY,
                    rightHeadX + perpX * headSize * 0.5,
                    rightHeadY + perpY * headSize * 0.5,
                ]}
                stroke={COLORS.orange}
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />
            <Line
                points={[
                    toX,
                    toY,
                    rightHeadX - perpX * headSize * 0.5,
                    rightHeadY - perpY * headSize * 0.5,
                ]}
                stroke={COLORS.orange}
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />
        </>
    );
}

function PlainDimensionText({
    x,
    y,
    text,
    stageScale,
    rotation = 0,
}: {
    x: number;
    y: number;
    text: string;
    stageScale: number;
    rotation?: number;
}) {
    const clampedStageScale = Math.max(stageScale, 1);
    const visualScale = 1 / clampedStageScale;
    const fontSize = MEASUREMENT_LABEL_LAYOUT.segmentTextFontSize;
    const textWidth = estimateTextWidth(text, fontSize);
    const textHeight = fontSize;

    return (
        <Group
            x={x}
            y={y}
            rotation={rotation}
            scaleX={visualScale}
            scaleY={visualScale}
            listening={false}
        >
            <Text
                x={-textWidth / 2}
                y={-textHeight / 2}
                text={text}
                fontSize={fontSize}
                fontStyle="400"
                fill="#000000"
                listening={false}
                perfectDrawEnabled={false}
            />
        </Group>
    );
}

function getPolygonCentroid(points: number[]) {
    if (!points || points.length < 6) {
        return { x: 0, y: 0 };
    }

    const bbox = getBoundingBoxFromPoints(points);
    return {
        x: bbox.x + bbox.w / 2,
        y: bbox.y + bbox.h / 2,
    };
}

function chooseOuterDimensionSide(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    points: number[],
    offsetDistance: number
) {
    const midpoint = getSegmentMidpoint(ax, ay, bx, by);
    const offset = getPerpendicularOffset(ax, ay, bx, by, offsetDistance);

    const candidateA = {
        x: midpoint.x + offset.x,
        y: midpoint.y + offset.y,
    };

    const candidateB = {
        x: midpoint.x - offset.x,
        y: midpoint.y - offset.y,
    };

    const aInside = pointInPolygon(candidateA.x, candidateA.y, points);
    const bInside = pointInPolygon(candidateB.x, candidateB.y, points);

    if (!aInside && bInside) {
        return offset;
    }

    if (aInside && !bInside) {
        return { x: -offset.x, y: -offset.y };
    }

    const centroid = getPolygonCentroid(points);
    const distA = Math.hypot(candidateA.x - centroid.x, candidateA.y - centroid.y);
    const distB = Math.hypot(candidateB.x - centroid.x, candidateB.y - centroid.y);

    return distA >= distB ? offset : { x: -offset.x, y: -offset.y };
}

function chooseHoleDimensionSide(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    holePoints: number[],
    offsetDistance: number
) {
    const midpoint = getSegmentMidpoint(ax, ay, bx, by);
    const offset = getPerpendicularOffset(ax, ay, bx, by, offsetDistance);

    const candidateA = {
        x: midpoint.x + offset.x,
        y: midpoint.y + offset.y,
    };

    const candidateB = {
        x: midpoint.x - offset.x,
        y: midpoint.y - offset.y,
    };

    const aInside = pointInPolygon(candidateA.x, candidateA.y, holePoints);
    const bInside = pointInPolygon(candidateB.x, candidateB.y, holePoints);

    if (aInside && !bInside) {
        return offset;
    }

    if (!aInside && bInside) {
        return { x: -offset.x, y: -offset.y };
    }

    const centroid = getPolygonCentroid(holePoints);
    const distA = Math.hypot(candidateA.x - centroid.x, candidateA.y - centroid.y);
    const distB = Math.hypot(candidateB.x - centroid.x, candidateB.y - centroid.y);

    return distA <= distB ? offset : { x: -offset.x, y: -offset.y };
}

function SegmentDimensionLine({
    ax,
    ay,
    bx,
    by,
    offsetX,
    offsetY,
    stageScale,
    text,
}: {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    offsetX: number;
    offsetY: number;
    stageScale: number;
    text: string;
}) {
    const clampedStageScale = Math.max(stageScale, 1);
    const visualScale = 1 / clampedStageScale;
    const strokeWidth = 1.2 * visualScale;

    const startX = ax + offsetX;
    const startY = ay + offsetY;
    const endX = bx + offsetX;
    const endY = by + offsetY;

    const dx = endX - startX;
    const dy = endY - startY;
    const lineLength = Math.hypot(dx, dy);

    if (lineLength <= 1e-6) return null;

    const ux = dx / lineLength;
    const uy = dy / lineLength;

    const fontSize = MEASUREMENT_LABEL_LAYOUT.segmentTextFontSize;
    const textWidth = estimateTextWidth(text, fontSize);
    const textGap = MEASUREMENT_LABEL_LAYOUT.segmentTextGap;

    const gapLength = textWidth + textGap * 2;

    const halfGap = Math.min(gapLength / 2, Math.max(0, lineLength / 2 - 2));

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    const gapStartX = midX - ux * halfGap;
    const gapStartY = midY - uy * halfGap;
    const gapEndX = midX + ux * halfGap;
    const gapEndY = midY + uy * halfGap;

    const inset = 6;
    const tickSize = 6;

    const px = -uy;
    const py = ux;

    const insetStartX = startX + ux * inset;
    const insetStartY = startY + uy * inset;
    const insetEndX = endX - ux * inset;
    const insetEndY = endY - uy * inset;

    const insetGapStartX = gapStartX;
    const insetGapStartY = gapStartY;
    const insetGapEndX = gapEndX;
    const insetGapEndY = gapEndY;

    return (
        <>
            <Line
                points={[insetStartX, insetStartY, insetGapStartX, insetGapStartY]}
                stroke="#000000"
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />
            <Line
                points={[insetGapEndX, insetGapEndY, insetEndX, insetEndY]}
                stroke="#000000"
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />

            <Line
                points={[
                    insetStartX - px * tickSize,
                    insetStartY - py * tickSize,
                    insetStartX + px * tickSize,
                    insetStartY + py * tickSize,
                ]}
                stroke="#000000"
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />
            <Line
                points={[
                    insetEndX - px * tickSize,
                    insetEndY - py * tickSize,
                    insetEndX + px * tickSize,
                    insetEndY + py * tickSize,
                ]}
                stroke="#000000"
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />
        </>
    );
}

function ArcSegmentDimensionLine({
    points,
    stageScale,
    text,
}: {
    points: Array<{ x: number; y: number }>;
    stageScale: number;
    text: string;
}) {
    if (points.length < 2) return null;
    const clampedStageScale = Math.max(stageScale, 1);
    const strokeWidth = 1 / clampedStageScale;
    const tickSize = 6;

    const first = points[0];
    const second = points[1];
    const last = points[points.length - 1];
    const prev = points[points.length - 2];

    const t1x = second.x - first.x;
    const t1y = second.y - first.y;
    const t1Len = Math.hypot(t1x, t1y) || 1;
    const n1x = -t1y / t1Len;
    const n1y = t1x / t1Len;

    const t2x = last.x - prev.x;
    const t2y = last.y - prev.y;
    const t2Len = Math.hypot(t2x, t2y) || 1;
    const n2x = -t2y / t2Len;
    const n2y = t2x / t2Len;

    const fontSize = MEASUREMENT_LABEL_LAYOUT.segmentTextFontSize;
    const textWidth = estimateTextWidth(text, fontSize);
    const textGap = MEASUREMENT_LABEL_LAYOUT.segmentTextGap;
    const gapLength = textWidth + textGap * 2;

    const segLens: number[] = [];
    let totalLen = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
        const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
        segLens.push(len);
        totalLen += len;
    }

    const half = totalLen / 2;
    const gapHalf = Math.min(gapLength / 2, Math.max(0, totalLen / 2 - 2));
    const cutA = Math.max(0, half - gapHalf);
    const cutB = Math.min(totalLen, half + gapHalf);

    const pointAtDistance = (d: number) => {
        if (d <= 0) return points[0];
        if (d >= totalLen) return points[points.length - 1];
        let acc = 0;
        for (let i = 0; i < segLens.length; i += 1) {
            const len = segLens[i];
            if (acc + len >= d) {
                const t = len <= 1e-9 ? 0 : (d - acc) / len;
                return {
                    x: points[i].x + (points[i + 1].x - points[i].x) * t,
                    y: points[i].y + (points[i + 1].y - points[i].y) * t,
                };
            }
            acc += len;
        }
        return points[points.length - 1];
    };

    const cutPointA = pointAtDistance(cutA);
    const cutPointB = pointAtDistance(cutB);

    const firstArc: Array<{ x: number; y: number }> = [points[0]];
    const secondArc: Array<{ x: number; y: number }> = [cutPointB];

    let acc = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
        const nextAcc = acc + segLens[i];
        const pNext = points[i + 1];
        if (nextAcc < cutA) {
            firstArc.push(pNext);
        } else if (acc < cutA && nextAcc >= cutA) {
            firstArc.push(cutPointA);
        }

        if (acc <= cutB && nextAcc > cutB) {
            secondArc.push(pNext);
        } else if (acc > cutB) {
            secondArc.push(pNext);
        }
        acc = nextAcc;
    }

    if (secondArc[secondArc.length - 1] !== last) {
        secondArc.push(last);
    }

    return (
        <>
            <Line
                points={flattenPoints(firstArc)}
                stroke="#000000"
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />
            <Line
                points={flattenPoints(secondArc)}
                stroke="#000000"
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />
            <Line
                points={[
                    first.x - n1x * tickSize,
                    first.y - n1y * tickSize,
                    first.x + n1x * tickSize,
                    first.y + n1y * tickSize,
                ]}
                stroke="#000000"
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />
            <Line
                points={[
                    last.x - n2x * tickSize,
                    last.y - n2y * tickSize,
                    last.x + n2x * tickSize,
                    last.y + n2y * tickSize,
                ]}
                stroke="#000000"
                strokeWidth={strokeWidth}
                listening={false}
                perfectDrawEnabled={false}
            />
        </>
    );
}

function OuterSegmentDimensions({
    object,
    stageScale,
}: {
    object: Pick<PolyObject, "points" | "bulges">;
    stageScale: number;
}) {
    const points = object.points;
    if (!points || points.length < 6) return null;

    const pointCount = points.length / 2;
    const offsetDistance = MEASUREMENT_LABEL_LAYOUT.segmentDimensionOffset;
    const bulges = normalizeBulges(points, object.bulges);

    return (
        <>
            {Array.from({ length: pointCount }).map((_, index) => {
                const ax = points[index * 2];
                const ay = points[index * 2 + 1];
                const nextIndex = (index + 1) % pointCount;
                const bx = points[nextIndex * 2];
                const by = points[nextIndex * 2 + 1];

                const length = Math.hypot(bx - ax, by - ay);
                if (length <= 1e-6) return null;

                const bulge = bulges[index] ?? 0;
                const isArc = Math.abs(bulge) > STRAIGHT_THRESHOLD;
                const labelText = isArc
                    ? formatMeters(getMetersFromEditorUnits(getArcLengthInEditorUnits(ax, ay, bx, by, bulge)))
                    : formatMeters(getSegmentLengthInMeters(ax, ay, bx, by));
                const midpoint = getSegmentMidpoint(ax, ay, bx, by);
                const chosenOffset = chooseOuterDimensionSide(
                    ax,
                    ay,
                    bx,
                    by,
                    points,
                    offsetDistance
                );

                const offsetMidX = midpoint.x + chosenOffset.x;
                const offsetMidY = midpoint.y + chosenOffset.y;

                const isVertical = Math.abs(ax - bx) < 1e-6 && Math.abs(ay - by) > 1e-6;

                return (
                    <React.Fragment key={`outer-segment-dimension-${index}`}>
                        {isArc ? (
                            (() => {
                                const baseArcPts = [
                                    { x: ax, y: ay },
                                    ...arcSamples(ax, ay, bx, by, bulge, 28).map(([x, y]) => ({ x, y })),
                                    { x: bx, y: by },
                                ];

                                const apexSample = arcSamples(ax, ay, bx, by, bulge, 2)[0];
                                const apex = apexSample
                                    ? { x: apexSample[0], y: apexSample[1] }
                                    : getSegmentMidpoint(ax, ay, bx, by);
                                const ccRaw = circumcenter(ax, ay, apex.x, apex.y, bx, by);
                                const cc =
                                    ccRaw &&
                                    Number.isFinite(ccRaw.x) &&
                                    Number.isFinite(ccRaw.y)
                                        ? ccRaw
                                        : null;

                                const offsetMagnitude = Math.hypot(chosenOffset.x, chosenOffset.y);
                                let arcPts = baseArcPts;

                                if (cc && offsetMagnitude > 0.001) {
                                    const mid = getPolylinePointAtHalfLength(baseArcPts);
                                    const rmx = mid.x - cc.x;
                                    const rmy = mid.y - cc.y;
                                    const rmlen = Math.hypot(rmx, rmy) || 1;
                                    const radialAtMid = { x: rmx / rmlen, y: rmy / rmlen };
                                    const dir = (radialAtMid.x * chosenOffset.x + radialAtMid.y * chosenOffset.y) >= 0 ? 1 : -1;

                                    arcPts = baseArcPts.map((p) => {
                                        const rx = p.x - cc.x;
                                        const ry = p.y - cc.y;
                                        const rlen = Math.hypot(rx, ry) || 1;
                                        return {
                                            x: p.x + (rx / rlen) * offsetMagnitude * dir,
                                            y: p.y + (ry / rlen) * offsetMagnitude * dir,
                                        };
                                    });
                                } else {
                                    arcPts = baseArcPts.map((p) => ({
                                        x: p.x + chosenOffset.x,
                                        y: p.y + chosenOffset.y,
                                    }));
                                }

                                const labelPt = getPolylinePointAtHalfLength(arcPts);

                                return (
                                    <>
                                        <ArcSegmentDimensionLine
                                            points={arcPts}
                                            stageScale={stageScale}
                                            text={labelText}
                                        />
                                        <PlainDimensionText
                                            x={labelPt.x}
                                            y={labelPt.y}
                                            text={labelText}
                                            stageScale={stageScale}
                                            rotation={0}
                                        />
                                    </>
                                );
                            })()
                        ) : (
                            <SegmentDimensionLine
                                ax={ax}
                                ay={ay}
                                bx={bx}
                                by={by}
                                offsetX={chosenOffset.x}
                                offsetY={chosenOffset.y}
                                stageScale={stageScale}
                                text={labelText}
                            />
                        )}
                        {!isArc && (
                            <PlainDimensionText
                                x={offsetMidX}
                                y={offsetMidY}
                                text={labelText}
                                stageScale={stageScale}
                                rotation={isVertical ? -90 : 0}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
}

function HoleDimensions({
    holes,
    stageScale,
}: {
    holes: number[][];
    stageScale: number;
}) {
    if (!holes || holes.length === 0) return null;

    const offsetDistance = MEASUREMENT_LABEL_LAYOUT.holeDimensionOffset;

    return (
        <>
            {holes.map((hole, holeIndex) => {
                if (!hole || hole.length < 6) return null;

                const pointCount = hole.length / 2;

                return (
                    <React.Fragment key={`hole-dimensions-${holeIndex}`}>
                        {Array.from({ length: pointCount }).map((_, index) => {
                            const ax = hole[index * 2];
                            const ay = hole[index * 2 + 1];
                            const nextIndex = (index + 1) % pointCount;
                            const bx = hole[nextIndex * 2];
                            const by = hole[nextIndex * 2 + 1];

                            const length = Math.hypot(bx - ax, by - ay);
                            if (length <= 1e-6) return null;

                            const labelText = formatMeters(
                                getSegmentLengthInMeters(ax, ay, bx, by)
                            );

                            const midpoint = getSegmentMidpoint(ax, ay, bx, by);
                            const chosenOffset = chooseHoleDimensionSide(
                                ax,
                                ay,
                                bx,
                                by,
                                hole,
                                offsetDistance
                            );

                            const offsetMidX = midpoint.x + chosenOffset.x;
                            const offsetMidY = midpoint.y + chosenOffset.y;

                            const isVertical =
                                Math.abs(ax - bx) < 1e-6 && Math.abs(ay - by) > 1e-6;

                            return (
                                <React.Fragment key={`hole-${holeIndex}-segment-${index}`}>
                                    <SegmentDimensionLine
                                        ax={ax}
                                        ay={ay}
                                        bx={bx}
                                        by={by}
                                        offsetX={chosenOffset.x}
                                        offsetY={chosenOffset.y}
                                        stageScale={stageScale}
                                        text={labelText}
                                        rotation={isVertical ? -90 : 0}
                                    />
                                    <PlainDimensionText
                                        x={offsetMidX}
                                        y={offsetMidY}
                                        text={labelText}
                                        stageScale={stageScale}
                                        rotation={isVertical ? -90 : 0}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </React.Fragment>
                );
            })}
        </>
    );
}

function SelectedObjectDimensions({
    object,
    stageScale,
    showDetailedDimensions = true,
}: {
    object: PolyObject;
    stageScale: number;
    showDetailedDimensions?: boolean;
}) {
    if (!isAreaMeasurableObject(object)) return null;
    if (!object.points || object.points.length < 6) return null;

    const measurementBoundsPoints = getMeasurementBoundsPoints(object.points, object.bulges);
    const bbox = getBoundingBoxFromPoints(measurementBoundsPoints);
    const widthMeters = getMetersFromEditorUnits(bbox.w);
    const heightMeters = getMetersFromEditorUnits(bbox.h);

    if (bbox.w <= 0 || bbox.h <= 0) return null;

    const offset = MEASUREMENT_LABEL_LAYOUT.selectionOffset;
    const horizontalY = bbox.y + bbox.h + offset;
    const horizontalStartX = bbox.x;
    const horizontalEndX = bbox.x + bbox.w;

    const verticalX = bbox.x + bbox.w + offset;
    const verticalStartY = bbox.y;
    const verticalEndY = bbox.y + bbox.h;

    const isTreebed = object.type === "treebed";
    const shouldRenderDetailedDimensions =
        showDetailedDimensions && !isTreebed;

    return (
        <>
            {shouldRenderDetailedDimensions && (
                <>
                    <OuterSegmentDimensions object={object} stageScale={stageScale} />
                    <HoleDimensions holes={object.holes ?? []} stageScale={stageScale} />
                </>
            )}

            <DimensionArrow
                fromX={horizontalStartX}
                fromY={horizontalY}
                toX={horizontalEndX}
                toY={horizontalY}
                stageScale={stageScale}
            />
            <OrangePillLabel
                x={bbox.x + bbox.w / 2}
                y={horizontalY}
                text={formatMeters(widthMeters)}
                stageScale={stageScale}
            />

            <DimensionArrow
                fromX={verticalX}
                fromY={verticalStartY}
                toX={verticalX}
                toY={verticalEndY}
                stageScale={stageScale}
            />
            <OrangePillLabel
                x={verticalX}
                y={bbox.y + bbox.h / 2}
                text={formatMeters(heightMeters)}
                stageScale={stageScale}
                rotation={-90}
            />
        </>
    );
}

function DraftCommittedSegmentDimensions({
    draftPoints,
    stageScale,
}: {
    draftPoints: number[];
    stageScale: number;
}) {
    if (!draftPoints || draftPoints.length < 4) return null;

    const pointCount = draftPoints.length / 2;
    const offsetDistance = MEASUREMENT_LABEL_LAYOUT.segmentOffset;

    return (
        <>
            {Array.from({ length: pointCount - 1 }).map((_, index) => {
                const ax = draftPoints[index * 2];
                const ay = draftPoints[index * 2 + 1];
                const bx = draftPoints[(index + 1) * 2];
                const by = draftPoints[(index + 1) * 2 + 1];

                const length = Math.hypot(bx - ax, by - ay);
                if (length <= 1e-6) return null;

                const labelText = formatMeters(getSegmentLengthInMeters(ax, ay, bx, by));
                const midpoint = getSegmentMidpoint(ax, ay, bx, by);
                const offset = getPerpendicularOffset(ax, ay, bx, by, offsetDistance);
                const isVertical = Math.abs(ax - bx) < 1e-6 && Math.abs(ay - by) > 1e-6;

                return (
                    <React.Fragment key={`draft-committed-segment-${index}`}>
                        <SegmentDimensionLine
                            ax={ax}
                            ay={ay}
                            bx={bx}
                            by={by}
                            offsetX={offset.x}
                            offsetY={offset.y}
                            stageScale={stageScale}
                            text={labelText}
                            rotation={isVertical ? -90 : 0}
                        />
                        <PlainDimensionText
                            x={midpoint.x + offset.x}
                            y={midpoint.y + offset.y}
                            text={labelText}
                            stageScale={stageScale}
                            rotation={isVertical ? -90 : 0}
                        />
                    </React.Fragment>
                );
            })}
        </>
    );
}

function DraftPreviewSegmentMeasurement({
    draftMeasurementPoints,
    stageScale,
}: {
    draftMeasurementPoints: number[];
    stageScale: number;
}) {
    if (!draftMeasurementPoints || draftMeasurementPoints.length < 4) return null;

    const offsetDistance = MEASUREMENT_LABEL_LAYOUT.segmentOffset;
    const lastIndex = draftMeasurementPoints.length / 2 - 2;

    if (lastIndex < 0) return null;

    const ax = draftMeasurementPoints[lastIndex * 2];
    const ay = draftMeasurementPoints[lastIndex * 2 + 1];
    const bx = draftMeasurementPoints[(lastIndex + 1) * 2];
    const by = draftMeasurementPoints[(lastIndex + 1) * 2 + 1];

    const meters = getSegmentLengthInMeters(ax, ay, bx, by);
    const labelText = formatMeters(meters);
    const midpoint = getSegmentMidpoint(ax, ay, bx, by);
    const offset = getPerpendicularOffset(ax, ay, bx, by, offsetDistance);

    const isVertical = Math.abs(ax - bx) < 1e-6 && Math.abs(ay - by) > 1e-6;

    return (
        <OrangePillLabel
            key={`draft-preview-segment-measure-${lastIndex}`}
            x={midpoint.x + offset.x}
            y={midpoint.y + offset.y}
            text={labelText}
            stageScale={stageScale}
            rotation={isVertical ? -90 : 0}
        />
    );
}

function overlayPropsAreEqual(
    prev: MeasurementOverlayProps,
    next: MeasurementOverlayProps
) {
    return (
        prev.selectedObjectId === next.selectedObjectId &&
        prev.stageScale === next.stageScale &&
        prev.activeTool === next.activeTool &&
        prev.activeDrawType === next.activeDrawType &&
        sameArrayReference(prev.unselectedObjects, next.unselectedObjects) &&
        sameArrayReference(prev.selectedObjects, next.selectedObjects) &&
        prev.primaryMeasurementObject === next.primaryMeasurementObject &&
        prev.draftMeasurementPoints === next.draftMeasurementPoints &&
        prev.plantbedNumberLayouts === next.plantbedNumberLayouts &&
        prev.showSelectedDimensions === next.showSelectedDimensions &&
        prev.showDetailedSelectedDimensions === next.showDetailedSelectedDimensions
    );
}

const MeasurementOverlay = React.memo(function MeasurementOverlay({
    unselectedObjects,
    selectedObjects,
    selectedObjectId,
    stageScale,
    activeTool,
    activeDrawType,
    draftPoints,
    draftMeasurementPoints,
    primaryMeasurementObject,
    plantbedNumberLayouts,
    showSelectedDimensions = true,
    showDetailedSelectedDimensions = true,
}: MeasurementOverlayProps) {
    const showAreaLabels = useProjectStore((s) => s.viewVisibility.showAreaLabels);

    const primarySelectedObject = useMemo(
        () =>
            primaryMeasurementObject ??
            (selectedObjects.length === 1
                ? selectedObjects.find((object) => object.id === selectedObjectId) ?? selectedObjects[0]
                : null),
        [primaryMeasurementObject, selectedObjects, selectedObjectId]
    );

    const shouldRenderDraftMeasurements =
        activeTool === "draw" &&
        activeDrawType !== null &&
        activeDrawType !== "treebed" &&
        draftMeasurementPoints.length >= 4;

    const selectedObjectBlockers = useMemo(() => {
        if (!showAreaLabels) return [];

        const blockers = selectedObjects.map((object) => {
            const bbox = getBoundingBoxFromPoints(object.points);

            return {
                x: bbox.x,
                y: bbox.y,
                w: bbox.w,
                h: bbox.h,
            };
        });

        if (selectedObjects.length === 1 && primarySelectedObject) {
            const bbox = getBoundingBoxFromPoints(primarySelectedObject.points);
            const offset = MEASUREMENT_LABEL_LAYOUT.selectionOffset;

            blockers.push(
                {
                    x: bbox.x,
                    y: bbox.y + bbox.h + offset - 20,
                    w: bbox.w,
                    h: 40,
                },
                {
                    x: bbox.x + bbox.w + offset - 20,
                    y: bbox.y,
                    w: 40,
                    h: bbox.h,
                }
            );
        }

        return blockers;
    }, [selectedObjects, primarySelectedObject, showAreaLabels]);

    const visibleUnselectedObjects = useMemo(() => {
        if (!showAreaLabels) return [];

        const rectsOverlap = (
            a: { x: number; y: number; w: number; h: number },
            b: { x: number; y: number; w: number; h: number }
        ) => {
            return !(
                a.x + a.w <= b.x ||
                b.x + b.w <= a.x ||
                a.y + a.h <= b.y ||
                b.y + b.h <= a.y
            );
        };

        return unselectedObjects.filter((object) => {
            const bbox = getBoundingBoxFromPoints(object.points);
            return !selectedObjectBlockers.some((blocker) => rectsOverlap(bbox, blocker));
        });
    }, [unselectedObjects, selectedObjectBlockers, showAreaLabels]);

    const unselectedAreaLabels = useMemo(() => {
        if (!showAreaLabels || visibleUnselectedObjects.length === 0) return [];

        return visibleUnselectedObjects
            .map((object) => buildAreaLabelRenderData(object, plantbedNumberLayouts, "area"))
            .filter(Boolean) as AreaLabelRenderData[];
    }, [visibleUnselectedObjects, plantbedNumberLayouts, showAreaLabels]);

    const selectedAreaLabels = useMemo(() => {
        if (!showAreaLabels) return [];

        const selectedObjectsForAreaLabels =
            selectedObjects.length === 1 && primarySelectedObject
                ? [primarySelectedObject]
                : selectedObjects;

        if (selectedObjectsForAreaLabels.length === 0) return [];

        return selectedObjectsForAreaLabels
            .map((object) =>
                buildAreaLabelRenderData(object, plantbedNumberLayouts, "selected-area")
            )
            .filter(Boolean) as AreaLabelRenderData[];
    }, [selectedObjects, primarySelectedObject, plantbedNumberLayouts, showAreaLabels]);
    return (
        <Group listening={false}>
            {unselectedAreaLabels.map(renderAreaLabel)}

            {selectedAreaLabels.map(renderAreaLabel)}

            {showSelectedDimensions && selectedObjects.length === 1 && primarySelectedObject ? (
                <SelectedObjectDimensions
                    object={primarySelectedObject}
                    stageScale={stageScale}
                    showDetailedDimensions={showDetailedSelectedDimensions}
                />
            ) : null}

            {shouldRenderDraftMeasurements ? (
                <>
                    <DraftCommittedSegmentDimensions
                        draftPoints={draftPoints}
                        stageScale={stageScale}
                    />
                    <DraftPreviewSegmentMeasurement
                        draftMeasurementPoints={draftMeasurementPoints}
                        stageScale={stageScale}
                    />
                </>
            ) : null}
        </Group>
    );
}, overlayPropsAreEqual);

export default MeasurementOverlay;
