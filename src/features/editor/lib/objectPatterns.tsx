import { Shape } from "react-konva";
import type { PolyObject } from "@/state/projectStore";
import { OBJECT_STYLES } from "@/state/projectStore";
import { EDITOR_GRID_SIZE } from "@/features/editor/constants/editorGeometry";
import { bboxFromPoints } from "@/features/editor/lib/editorCanvasMath";

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
const PARKING_ICON_TOP_PADDING = GRID_SIZE * 0.4;
const PARKING_ICON_TO_LABEL_GAP = GRID_SIZE * 1;
const PARKING_AREA_LABEL_HEIGHT_ESTIMATE = 16;

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

function getParkingIconLayout(renderPoints: number[], stageScale: number) {
    if (stageScale < PARKING_ICON_HIDE_SCALE) return null;
    if (!renderPoints || renderPoints.length < 6) return null;

    const bb = bboxFromPoints(renderPoints);
    if (bb.w <= 0 || bb.h <= 0) return null;

    const maxIconWidth = bb.w * 0.42;
    const maxIconHeight = bb.h * 0.3;
    const iconSize = Math.min(maxIconWidth, maxIconHeight, PARKING_ICON_MAX_SIZE);

    if (!Number.isFinite(iconSize) || iconSize < PARKING_ICON_MIN_SIZE) {
        return null;
    }

    const requiredHeight =
        PARKING_ICON_TOP_PADDING +
        iconSize +
        PARKING_ICON_TO_LABEL_GAP +
        PARKING_AREA_LABEL_HEIGHT_ESTIMATE +
        GRID_SIZE * 0.2;

    if (requiredHeight > bb.h) {
        return null;
    }

    const centerX = bb.x + bb.w / 2;
    const labelCenterY = bb.y + bb.h / 2;
    const iconY =
        labelCenterY -
        PARKING_AREA_LABEL_HEIGHT_ESTIMATE / 2 -
        PARKING_ICON_TO_LABEL_GAP -
        iconSize;

    if (iconY < bb.y + PARKING_ICON_TOP_PADDING) {
        return null;
    }

    return {
        x: centerX - iconSize / 2,
        y: iconY,
        size: iconSize,
    };
}

export function renderTilesPattern(
    obj: PolyObject,
    keyPrefix: string,
    stageScale: number,
    pointsOverride?: number[],
    holesOverride?: number[][]
) {
    if (stageScale < TILES_PATTERN_HIDE_SCALE) return null;

    const renderPoints = pointsOverride ?? obj.points;
    const renderHoles = holesOverride ?? obj.holes ?? [];
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
    const layout = getParkingIconLayout(renderPoints, stageScale);

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
                buildPolygonClipPath(ctx, renderPoints, renderHoles);
                ctx.clip("evenodd");
                ctx.drawImage(img, layout.x, layout.y, layout.size, layout.size);
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
    holesOverride?: number[][]
) {
    if (obj.type === "tiles") {
        return renderTilesPattern(obj, keyPrefix, stageScale, pointsOverride, holesOverride);
    }

    if (obj.type === "parking") {
        return renderParkingPattern(obj, keyPrefix, stageScale, pointsOverride, holesOverride);
    }
    
    return null;
}