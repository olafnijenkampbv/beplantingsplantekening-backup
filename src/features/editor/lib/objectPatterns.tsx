import { Shape } from "react-konva";
import type { PolyObject } from "@/state/projectStore";
import { OBJECT_STYLES, normalizeBulges } from "@/state/projectStore";
import { EDITOR_GRID_SIZE } from "@/features/editor/constants/editorGeometry";
import { bboxFromPoints } from "@/features/editor/lib/editorCanvasMath";
import { formatSquareMeters, getObjectAreaInSquareMeters } from "@/state/areaMetrics";
import { densifyBulgedRing, STRAIGHT_THRESHOLD } from "@/features/editor/lib/bulgeMath";

const GRID_SIZE = EDITOR_GRID_SIZE;

const TILES_PATTERN_GEOMETRY_CACHE = new Map<
    string,
    { verticalLines: number[][]; horizontalLines: number[][] }
>();
const TILES_PATTERN_HIDE_SCALE = 0.1;
const TILES_PATTERN_COMPACT_SCALE = 0.15;

const PARKING_ICON_SRC = "/icons/park.svg";
const PARKING_ICON_HIDE_SCALE = 0.1;
const PARKING_ICON_MIN_SIZE = 18;
const PARKING_ICON_MAX_SIZE = GRID_SIZE * 6;
const PARKING_ICON_TO_LABEL_GAP = GRID_SIZE * 0.75;
const PARKING_AREA_LABEL_FONT_SIZE = 14;
const PARKING_AREA_LABEL_HEIGHT_ESTIMATE = 16;
const PARKING_BADGE_INNER_PADDING = GRID_SIZE * 0.35;
const PARKING_BADGE_TEXT_COLOR = OBJECT_STYLES.parking.stroke;

let parkingIconImage: HTMLImageElement | null = null;

export function clearTilesPatternGeometryCache() {
    TILES_PATTERN_GEOMETRY_CACHE.clear();
}

function getTilesPatternGeometryCacheKey(
    renderPoints: number[],
    renderHoles: number[][] | undefined | null,
    spacing: number
) {
    const safeHoles = Array.isArray(renderHoles) ? renderHoles : [];

    return [
        spacing,
        renderPoints.join(","),
        safeHoles.map((hole) => hole.join(",")).join("|"),
    ].join("::");
}

function getTilesPatternGeometry(
    renderPoints: number[],
    renderHoles: number[][] | undefined | null,
    spacing: number
) {
    const safeHoles = Array.isArray(renderHoles) ? renderHoles : [];
    const cacheKey = getTilesPatternGeometryCacheKey(renderPoints, safeHoles, spacing);
    const cached = TILES_PATTERN_GEOMETRY_CACHE.get(cacheKey);
    if (cached) return cached;

    const bb = bboxFromPoints(renderPoints);

    const startX = Math.floor(bb.x / spacing) * spacing;
    const endX = Math.ceil((bb.x + bb.w) / spacing) * spacing;
    const startY = Math.floor(bb.y / spacing) * spacing;
    const endY = Math.ceil((bb.y + bb.h) / spacing) * spacing;

    const verticalLines: number[][] = [];
    const horizontalLines: number[][] = [];

    for (let x = startX; x <= endX; x += spacing) {
        verticalLines.push([x, bb.y, x, bb.y + bb.h]);
    }

    for (let y = startY; y <= endY; y += spacing) {
        horizontalLines.push([bb.x, y, bb.x + bb.w, y]);
    }

    const next = { verticalLines, horizontalLines };
    TILES_PATTERN_GEOMETRY_CACHE.set(cacheKey, next);
    return next;
}

function ensureParkingIconImage() {
    if (typeof window === "undefined") return null;

    if (parkingIconImage) return parkingIconImage;

    const img = new window.Image();
    img.src = PARKING_ICON_SRC;
    parkingIconImage = img;

    return parkingIconImage;
}

function buildPolygonClipPath(
    ctx: any,
    renderPoints: number[],
    renderHoles: number[][] | undefined | null
) {
    const safeHoles = Array.isArray(renderHoles) ? renderHoles : [];

    ctx.beginPath();
    ctx.moveTo(renderPoints[0], renderPoints[1]);

    for (let i = 2; i < renderPoints.length; i += 2) {
        ctx.lineTo(renderPoints[i], renderPoints[i + 1]);
    }

    ctx.closePath();

    for (const hole of safeHoles) {
        if (!hole || hole.length < 6) continue;

        ctx.moveTo(hole[0], hole[1]);
        for (let i = 2; i < hole.length; i += 2) {
            ctx.lineTo(hole[i], hole[i + 1]);
        }
        ctx.closePath();
    }
}

function pointInPolygon(px: number, py: number, points: number[]) {
    let inside = false;

    for (let i = 0, j = points.length - 2; i < points.length; i += 2) {
        const xi = points[i];
        const yi = points[i + 1];
        const xj = points[j];
        const yj = points[j + 1];

        const intersect =
            (yi > py) !== (yj > py) &&
            px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;

        if (intersect) inside = !inside;
        j = i;
    }

    return inside;
}

function pointInPolygonWithHoles(
    px: number,
    py: number,
    renderPoints: number[],
    renderHoles: number[][]
) {
    if (!pointInPolygon(px, py, renderPoints)) return false;
    return !renderHoles.some((hole) => pointInPolygon(px, py, hole));
}

function rectFitsInsidePolygonWithHoles(
    rect: { x: number; y: number; w: number; h: number },
    renderPoints: number[],
    renderHoles: number[][]
) {
    const samplePoints = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.w, y: rect.y },
        { x: rect.x, y: rect.y + rect.h },
        { x: rect.x + rect.w, y: rect.y + rect.h },
        { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
    ];

    return samplePoints.every((point) =>
        pointInPolygonWithHoles(point.x, point.y, renderPoints, renderHoles)
    );
}

function estimateParkingAreaTextWidth(text: string, fontSize: number) {
    return text.length * fontSize * 0.58;
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
        return Math.hypot(px - x1, py - y1);
    }

    const t = Math.max(
        0,
        Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
    );

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.hypot(px - projX, py - projY);
}

function getDistanceToNearestPolygonEdge(
    px: number,
    py: number,
    renderPoints: number[],
    renderHoles: number[][]
) {
    let minDist = Infinity;

    for (let i = 0; i < renderPoints.length; i += 2) {
        const x1 = renderPoints[i];
        const y1 = renderPoints[i + 1];
        const x2 = renderPoints[(i + 2) % renderPoints.length];
        const y2 = renderPoints[(i + 3) % renderPoints.length];

        minDist = Math.min(
            minDist,
            pointToSegmentDistance(px, py, x1, y1, x2, y2)
        );
    }

    for (const hole of renderHoles) {
        if (!hole || hole.length < 6) continue;

        for (let i = 0; i < hole.length; i += 2) {
            const x1 = hole[i];
            const y1 = hole[i + 1];
            const x2 = hole[(i + 2) % hole.length];
            const y2 = hole[(i + 3) % hole.length];

            minDist = Math.min(
                minDist,
                pointToSegmentDistance(px, py, x1, y1, x2, y2)
            );
        }
    }

    return minDist;
}

function getParkingBadgeLayout(
    renderPoints: number[],
    renderHoles: number[][],
    stageScale: number,
    areaText: string
) {
    if (stageScale < PARKING_ICON_HIDE_SCALE) return null;
    if (!renderPoints || renderPoints.length < 6) return null;

    const bb = bboxFromPoints(renderPoints);
    if (bb.w <= 0 || bb.h <= 0) return null;

    const textWidth = estimateParkingAreaTextWidth(areaText, PARKING_AREA_LABEL_FONT_SIZE);
    const textHeight = PARKING_AREA_LABEL_HEIGHT_ESTIMATE;

    const maxIconWidth = bb.w * 0.42;
    const maxIconHeight = bb.h * 0.28;
    const rawIconSize = Math.min(maxIconWidth, maxIconHeight, PARKING_ICON_MAX_SIZE);

    if (!Number.isFinite(rawIconSize) || rawIconSize < PARKING_ICON_MIN_SIZE) {
        return null;
    }

    const iconSize = rawIconSize;
    const blockWidth =
        Math.max(iconSize, textWidth) + PARKING_BADGE_INNER_PADDING * 2;
    const blockHeight =
        iconSize +
        PARKING_ICON_TO_LABEL_GAP +
        textHeight +
        PARKING_BADGE_INNER_PADDING * 2;

    const step = Math.max(4, GRID_SIZE / 3);
    const startX = bb.x + blockWidth / 2;
    const endX = bb.x + bb.w - blockWidth / 2;
    const startY = bb.y + blockHeight / 2;
    const endY = bb.y + bb.h - blockHeight / 2;

    let bestCenter: { x: number; y: number; score: number } | null = null;

    if (endX >= startX && endY >= startY) {
        const bboxCenterX = bb.x + bb.w / 2;
        const bboxCenterY = bb.y + bb.h / 2;

        for (let y = startY; y <= endY; y += step) {
            for (let x = startX; x <= endX; x += step) {
                const rect = {
                    x: x - blockWidth / 2,
                    y: y - blockHeight / 2,
                    w: blockWidth,
                    h: blockHeight,
                };

                if (!rectFitsInsidePolygonWithHoles(rect, renderPoints, renderHoles)) {
                    continue;
                }

                const edgeDistance = getDistanceToNearestPolygonEdge(
                    x,
                    y,
                    renderPoints,
                    renderHoles
                );

                const centerPenalty = Math.hypot(x - bboxCenterX, y - bboxCenterY) * 0.08;
                const score = edgeDistance - centerPenalty;

                if (!bestCenter || score > bestCenter.score) {
                    bestCenter = { x, y, score };
                }
            }
        }
    }

    if (!bestCenter) {
        return null;
    }

    const blockY = bestCenter.y - blockHeight / 2;

    return {
        iconX: bestCenter.x - iconSize / 2,
        iconY: blockY + PARKING_BADGE_INNER_PADDING,
        iconSize,
        textX: bestCenter.x - textWidth / 2,
        textY:
            blockY +
            PARKING_BADGE_INNER_PADDING +
            iconSize +
            PARKING_ICON_TO_LABEL_GAP,
        textWidth,
        text: areaText,
    };
}

export function renderTilesPattern(
    obj: PolyObject,
    keyPrefix: string,
    stageScale: number,
    pointsOverride?: number[],
    holesOverride?: number[][],
    bulgesOverride?: number[]
) {
    if (stageScale < TILES_PATTERN_HIDE_SCALE) return null;

    const basePoints = pointsOverride ?? obj.points;
    const renderHoles = holesOverride ?? obj.holes ?? [];
    const bulges = normalizeBulges(basePoints, bulgesOverride ?? obj.bulges);
    const renderPoints = bulges.some((b) => Math.abs(b) > STRAIGHT_THRESHOLD)
        ? densifyBulgedRing(basePoints, bulges, 48)
        : basePoints;
    const spacing =
        stageScale < TILES_PATTERN_COMPACT_SCALE
            ? GRID_SIZE * 4
            : GRID_SIZE * 2;

    const { verticalLines, horizontalLines } = getTilesPatternGeometry(
        renderPoints,
        renderHoles,
        spacing
    );

    return (
        <Shape
            key={keyPrefix}
            listening={false}
            perfectDrawEnabled={false}
            opacity={0.5}
            sceneFunc={(ctx, shape) => {
                if (!renderPoints || renderPoints.length < 6) return;

                ctx.save();
                buildPolygonClipPath(ctx, renderPoints, renderHoles);
                ctx.clip("evenodd");

                ctx.beginPath();

                for (const line of verticalLines) {
                    ctx.moveTo(line[0], line[1]);
                    ctx.lineTo(line[2], line[3]);
                }

                for (const line of horizontalLines) {
                    ctx.moveTo(line[0], line[1]);
                    ctx.lineTo(line[2], line[3]);
                }

                ctx.strokeStyle = OBJECT_STYLES.tiles.stroke;
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.restore();
                ctx.fillStrokeShape(shape);
            }}
        />
    );
}

export function renderParkingPattern(
    obj: PolyObject,
    keyPrefix: string,
    stageScale: number,
    pointsOverride?: number[],
    holesOverride?: number[][]
) {
    const renderPoints = pointsOverride ?? obj.points;
    const renderHoles = holesOverride ?? obj.holes ?? [];
    const safeAreaText = formatSquareMeters(
        getObjectAreaInSquareMeters({
            type: obj.type,
            points: renderPoints,
            holes: renderHoles,
        })
    );

    const layout = getParkingBadgeLayout(
        renderPoints,
        renderHoles,
        stageScale,
        safeAreaText
    );

    if (!layout) return null;

    return (
        <Shape
            key={keyPrefix}
            listening={false}
            perfectDrawEnabled={false}
            sceneFunc={(ctx, shape) => {
                if (!renderPoints || renderPoints.length < 6) return;

                const img = ensureParkingIconImage();
                if (!img) return;

                if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
                    img.onload = () => {
                        shape.getLayer()?.batchDraw();
                    };
                    return;
                }

                ctx.save();

                ctx.drawImage(
                    img,
                    layout.iconX,
                    layout.iconY,
                    layout.iconSize,
                    layout.iconSize
                );

                ctx.font = `700 ${PARKING_AREA_LABEL_FONT_SIZE}px sans-serif`;
                ctx.fillStyle = PARKING_BADGE_TEXT_COLOR;
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(layout.text, layout.textX, layout.textY);

                ctx.restore();

                ctx.fillStrokeShape(shape);
            }}
        />
    );
}

export function renderObjectPattern(
    obj: PolyObject,
    keyPrefix: string,
    stageScale: number,
    pointsOverride?: number[],
    holesOverride?: number[][],
    bulgesOverride?: number[]
) {
    if (obj.type === "tiles") {
        return renderTilesPattern(obj, keyPrefix, stageScale, pointsOverride, holesOverride, bulgesOverride);
    }

    if (obj.type === "parking") {
        return renderParkingPattern(obj, keyPrefix, stageScale, pointsOverride, holesOverride);
    }
    
    return null;
}
