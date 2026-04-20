"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, FastLayer, Line, Rect, Group, Shape, Circle, Text } from "react-konva";
import { Html } from "react-konva-utils";
import { nanoid } from "nanoid";
import { useProjectStore, PolyObject, ObjectType, TreebedVariant, OBJECT_STYLES, TYPE_Z_INDEX } from "@/state/projectStore";
import EditorToolbar from "@/features/editor/components/EditorToolbar";
import LeftObjectsMenu from "@/features/editor/components/LeftObjectsMenu";
import PlantSidebar from "@/features/editor/components/PlantSidebar";
import ConfirmModal from "@/features/editor/components/ConfirmModal";
import TreebedVariantSwatch from "@/features/editor/components/TreebedVariantSwatch";
import { APP_NOTIFICATIONS, AppNotificationsRenderer, useAppNotify, useDismissAppNotification } from "@/state/allNotifications";
import FileMenuDropdown from "@/features/editor/components/FileMenuDropdown";
import DrawingsDashboardModal from "@/features/editor/components/DrawingsDashboardModal";
import CreateDrawingModal from "@/features/editor/components/CreateDrawingModal";
import MeasurementOverlay from "@/features/editor/components/MeasurementOverlay";
import CanvasScaleSummary from "@/features/editor/components/CanvasScaleSummary";
import { EDITOR_GRID_SIZE } from "@/features/editor/constants/editorGeometry";
import { formatSquareMeters, getObjectAreaInSquareMeters } from "@/state/areaMetrics";


type DrawMode = "draw";

const COLORS = {
    orange: "#E94E1B",
    orangeLight: "#FFE5DD",
    green: "#58694C",
    greenLight: "#EEF0ED",
    border: "#E3E2E2",
    grid: "#d7dcd5",
};

const BASE_SCALE = 0.6;
const HEADER_HEIGHT = 56;
const TOOLBAR_OFFSET = 12;
const GRID_SIZE = EDITOR_GRID_SIZE;
const FENCE_GATE_STROKE_WIDTH = 14;

type CompassDirection = "noord" | "oost" | "zuid" | "west";
const COMPASS_DIRECTIONS: CompassDirection[] = ["noord", "oost", "zuid", "west"];

const TREEBED_DYNAMIC_STROKE = {
    frequencyPercent: 100,
    wigglePercent: 50,
    smoothenPercent: 0,
    baseStepPx: 6,
    minStepPx: 2.25,
    maxWigglePx: 4,
    minWigglePx: 1.1,
    sizeReferencePx: 160,
};

type DynamicStrokePoint = { x: number; y: number };

function hashStringToInt(input: string) {
    let hash = 2166136261;

    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function getDeterministicUnitNoise(seedKey: string, index: number) {
    const seed = hashStringToInt(`${seedKey}:${index}`);
    const normalized = (seed % 10000) / 10000;
    return normalized * 2 - 1;
}

function getDynamicStrokeSamplePoints(
    points: number[],
    seedKey: string,
    closed = true
): DynamicStrokePoint[] {
    if (points.length < 4) return [];

    const source: DynamicStrokePoint[] = [];
    for (let i = 0; i < points.length; i += 2) {
        source.push({ x: points[i], y: points[i + 1] });
    }

    const segmentCount = closed ? source.length : source.length - 1;
    if (segmentCount <= 0) return source;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of source) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }

    const shapeSize = Math.max(1, Math.min(maxX - minX, maxY - minY));
    const sizeScale = clamp(shapeSize / TREEBED_DYNAMIC_STROKE.sizeReferencePx, 0.45, 1);

    const baseStepPx =
        TREEBED_DYNAMIC_STROKE.baseStepPx *
        (100 / Math.max(1, TREEBED_DYNAMIC_STROKE.frequencyPercent));

    const stepPx = clamp(
        baseStepPx * sizeScale,
        TREEBED_DYNAMIC_STROKE.minStepPx,
        baseStepPx
    );

    const baseWigglePx =
        TREEBED_DYNAMIC_STROKE.maxWigglePx *
        (TREEBED_DYNAMIC_STROKE.wigglePercent / 100);

    const wigglePx = clamp(
        baseWigglePx * sizeScale,
        TREEBED_DYNAMIC_STROKE.minWigglePx,
        baseWigglePx
    );

    const sampled: DynamicStrokePoint[] = [];

    for (let segIndex = 0; segIndex < segmentCount; segIndex += 1) {
        const a = source[segIndex];
        const b = source[(segIndex + 1) % source.length];

        if (segIndex === 0) {
            sampled.push(a);
        }

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);

        if (len <= 0.0001) {
            sampled.push(b);
            continue;
        }

        const nx = -dy / len;
        const ny = dx / len;
        const subdivisions = Math.max(2, Math.round(len / stepPx));

        for (let step = 1; step < subdivisions; step += 1) {
            const t = step / subdivisions;
            const baseX = a.x + dx * t;
            const baseY = a.y + dy * t;

            const envelope = Math.sin(t * Math.PI);
            const noise = getDeterministicUnitNoise(seedKey, segIndex * 1000 + step);
            const offset = noise * wigglePx * envelope;

            sampled.push({
                x: baseX + nx * offset,
                y: baseY + ny * offset,
            });
        }

        sampled.push(b);
    }

    return sampled;
}

function DynamicStrokeShape({
    points,
    stroke,
    strokeWidth,
    seedKey,
    closed = true,
    listening = false,
}: {
    points: number[];
    stroke: string;
    strokeWidth: number;
    seedKey: string;
    closed?: boolean;
    listening?: boolean;
}) {
    const sampled = getDynamicStrokeSamplePoints(points, seedKey, closed);

    return (
        <Shape
            listening={listening}
            perfectDrawEnabled={false}
            stroke={stroke}
            strokeWidth={strokeWidth}
            lineCap="round"
            lineJoin="round"
            sceneFunc={(ctx, shape) => {
                if (sampled.length < 2) return;

                ctx.beginPath();

                if (closed) {
                    const last = sampled[sampled.length - 1];
                    const first = sampled[0];
                    const startMid = {
                        x: (last.x + first.x) / 2,
                        y: (last.y + first.y) / 2,
                    };

                    ctx.moveTo(startMid.x, startMid.y);

                    for (let i = 0; i < sampled.length; i += 1) {
                        const current = sampled[i];
                        const next = sampled[(i + 1) % sampled.length];
                        const mid = {
                            x: (current.x + next.x) / 2,
                            y: (current.y + next.y) / 2,
                        };

                        ctx.quadraticCurveTo(current.x, current.y, mid.x, mid.y);
                    }

                    ctx.closePath();
                } else {
                    ctx.moveTo(sampled[0].x, sampled[0].y);

                    if (sampled.length === 2) {
                        ctx.lineTo(sampled[1].x, sampled[1].y);
                    } else {
                        for (let i = 1; i < sampled.length - 1; i += 1) {
                            const current = sampled[i];
                            const next = sampled[i + 1];
                            const mid = {
                                x: (current.x + next.x) / 2,
                                y: (current.y + next.y) / 2,
                            };

                            ctx.quadraticCurveTo(current.x, current.y, mid.x, mid.y);
                        }

                        const penultimate = sampled[sampled.length - 2];
                        const last = sampled[sampled.length - 1];
                        ctx.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y);
                    }
                }

                ctx.fillStrokeShape(shape);
            }}
        />
    );
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function estimateTextWidth(text: string, fontSize: number) {
    return text.length * fontSize * 0.58;
}

function snapToGrid(value: number, gridSize: number) {
    return Math.round(value / gridSize) * gridSize;
}

function snapPointsToGrid(points: number[], gridSize: number) {
    const next: number[] = [];

    for (let i = 0; i < points.length; i += 2) {
        next.push(
            snapToGrid(points[i], gridSize),
            snapToGrid(points[i + 1], gridSize)
        );
    }

    return next;
}

function snapHolesToGrid(holes: number[][] | undefined, gridSize: number) {
    if (!holes || holes.length === 0) return holes;
    return holes.map((hole) => snapPointsToGrid(hole, gridSize));
}

function snapPolyObjectToGrid(obj: PolyObject, gridSize: number): PolyObject {
    return {
        ...obj,
        points: snapPointsToGrid(obj.points, gridSize),
        holes: snapHolesToGrid(obj.holes, gridSize),
        renderPieces: obj.renderPieces?.map((piece) => snapPointsToGrid(piece, gridSize)),
    };
}

function getPointerWorldPos(stage: any) {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;

    const scale = stage.scaleX();
    const pos = stage.position();

    return {
        x: (pointer.x - pos.x) / scale,
        y: (pointer.y - pos.y) / scale,
    };
}

function getPointerWorldPosFromClient(stage: any, clientX: number, clientY: number) {
    const container = stage?.container?.();
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const scale = stage.scaleX();
    const pos = stage.position();

    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;

    return {
        x: (pointerX - pos.x) / scale,
        y: (pointerY - pos.y) / scale,
    };
}

function normalizeRect(x1: number, y1: number, x2: number, y2: number) {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    return { x, y, w, h };
}

function bboxFromPoints(points: number[]) {
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function getObjectsBoundingBox(objects: PolyObject[]) {
    const validObjects = objects.filter((obj) => Array.isArray(obj.points) && obj.points.length >= 2);
    if (validObjects.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const obj of validObjects) {
        const box = bboxFromPoints(obj.points);
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.w);
        maxY = Math.max(maxY, box.y + box.h);
    }

    return {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
    };
}

function rotatePointQuarterTurnClockwise(
    x: number,
    y: number,
    cx: number,
    cy: number,
    gridSize: number
) {
    const dx = x - cx;
    const dy = y - cy;

    return {
        x: snapToGrid(cx - dy, gridSize),
        y: snapToGrid(cy + dx, gridSize),
    };
}

function rotatePointsQuarterTurnClockwise(
    points: number[],
    cx: number,
    cy: number,
    gridSize: number
) {
    const next: number[] = [];

    for (let i = 0; i < points.length; i += 2) {
        const rotated = rotatePointQuarterTurnClockwise(
            points[i],
            points[i + 1],
            cx,
            cy,
            gridSize
        );

        next.push(rotated.x, rotated.y);
    }

    return next;
}

function rotateObjectQuarterTurnClockwise(
    obj: PolyObject,
    cx: number,
    cy: number,
    gridSize: number
): PolyObject {
    if (
        obj.type === "treebed" &&
        (obj.treebedVariant === "standard" || obj.treebedVariant === "multi_stem")
    ) {
        const visual = getTreebedVisual(obj.points, obj.treebedVariant);
        const rotatedCenter = rotatePointQuarterTurnClockwise(
            visual.cx,
            visual.cy,
            cx,
            cy,
            gridSize
        );

        const safeRadius =
            typeof visual.radius === "number"
                ? visual.radius
                : Math.min(
                    Math.abs(obj.points[2] - obj.points[0]),
                    Math.abs(obj.points[3] - obj.points[1])
                ) / 2;

        const rebuiltPoints = createTreebedPointsFromCircle(
            rotatedCenter.x,
            rotatedCenter.y,
            safeRadius
        );

        return {
            ...obj,
            points: rebuiltPoints,
            holes: undefined,
            renderPieces: undefined,
        };
    }

    return {
        ...obj,
        points: rotatePointsQuarterTurnClockwise(obj.points, cx, cy, gridSize),
        holes: obj.holes?.map((hole) =>
            rotatePointsQuarterTurnClockwise(hole, cx, cy, gridSize)
        ),
        renderPieces: obj.renderPieces?.map((piece) =>
            rotatePointsQuarterTurnClockwise(piece, cx, cy, gridSize)
        ),
    };
}

function getPlantbedOutlineSegments(plantbeds: PolyObject[]) {
    type Segment = [number, number, number, number];

    const round = (n: number) => Math.round(n * 1000) / 1000;

    const horizontals = new Map<number, Array<{ from: number; to: number }>>();
    const verticals = new Map<number, Array<{ from: number; to: number }>>();
    const others = new Map<string, Segment>();

    const makeSegmentKey = (ax: number, ay: number, bx: number, by: number) => {
        const a = `${round(ax)},${round(ay)}`;
        const b = `${round(bx)},${round(by)}`;
        return a < b ? `${a}|${b}` : `${b}|${a}`;
    };

    for (const pb of plantbeds) {
        const rings = [pb.points, ...(pb.holes ?? [])];

        for (const pts of rings) {
            if (!pts || pts.length < 6) continue;

            for (let i = 0; i < pts.length; i += 2) {
                const ax = round(pts[i]);
                const ay = round(pts[i + 1]);
                const ni = (i + 2) % pts.length;
                const bx = round(pts[ni]);
                const by = round(pts[ni + 1]);

                if (ay === by) {
                    const y = ay;
                    const from = Math.min(ax, bx);
                    const to = Math.max(ax, bx);
                    if (!horizontals.has(y)) horizontals.set(y, []);
                    horizontals.get(y)!.push({ from, to });
                } else if (ax === bx) {
                    const x = ax;
                    const from = Math.min(ay, by);
                    const to = Math.max(ay, by);
                    if (!verticals.has(x)) verticals.set(x, []);
                    verticals.get(x)!.push({ from, to });
                } else {
                    const key = makeSegmentKey(ax, ay, bx, by);
                    if (!others.has(key)) {
                        others.set(key, [ax, ay, bx, by]);
                    }
                }
            }
        }
    }

    const result: Segment[] = [];

    for (const [y, ranges] of horizontals.entries()) {
        const cuts = Array.from(
            new Set(ranges.flatMap((r) => [r.from, r.to]).map(round))
        ).sort((a, b) => a - b);

        for (let i = 0; i < cuts.length - 1; i++) {
            const from = cuts[i];
            const to = cuts[i + 1];
            if (to <= from) continue;

            const covered = ranges.some((r) => r.from <= from && r.to >= to);
            if (covered) {
                result.push([from, y, to, y]);
            }
        }
    }

    for (const [x, ranges] of verticals.entries()) {
        const cuts = Array.from(
            new Set(ranges.flatMap((r) => [r.from, r.to]).map(round))
        ).sort((a, b) => a - b);

        for (let i = 0; i < cuts.length - 1; i++) {
            const from = cuts[i];
            const to = cuts[i + 1];
            if (to <= from) continue;

            const covered = ranges.some((r) => r.from <= from && r.to >= to);
            if (covered) {
                result.push([x, from, x, to]);
            }
        }
    }

    result.push(...Array.from(others.values()));

    return result;
}

const TILES_PATTERN_GEOMETRY_CACHE = new Map<
    string,
    { verticalLines: number[][]; horizontalLines: number[][] }
>();
const TILES_PATTERN_HIDE_SCALE = 0.1;
const TILES_PATTERN_COMPACT_SCALE = 0.15;

function getTilesPatternGeometryCacheKey(
    renderPoints: number[],
    renderHoles: number[][],
    spacing: number
) {
    return [
        spacing,
        renderPoints.join(","),
        renderHoles.map((hole) => hole.join(",")).join("|"),
    ].join("::");
}

function getTilesPatternGeometry(
    renderPoints: number[],
    renderHoles: number[][],
    spacing: number
) {
    const cacheKey = getTilesPatternGeometryCacheKey(renderPoints, renderHoles, spacing);
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

function renderTilesPattern(
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

                ctx.beginPath();
                ctx.moveTo(renderPoints[0], renderPoints[1]);
                for (let i = 2; i < renderPoints.length; i += 2) {
                    ctx.lineTo(renderPoints[i], renderPoints[i + 1]);
                }
                ctx.closePath();

                for (const hole of renderHoles) {
                    if (!hole || hole.length < 6) continue;

                    ctx.moveTo(hole[0], hole[1]);
                    for (let i = 2; i < hole.length; i += 2) {
                        ctx.lineTo(hole[i], hole[i + 1]);
                    }
                    ctx.closePath();
                }

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

function pointInPolygon(px: number, py: number, poly: number[]) {
    let inside = false;
    for (let i = 0, j = poly.length - 2; i < poly.length; i += 2) {
        const xi = poly[i], yi = poly[i + 1];
        const xj = poly[j], yj = poly[j + 1];
        const intersect =
            (yi > py) !== (yj > py) &&
            px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
        if (intersect) inside = !inside;
        j = i;
    }
    return inside;
}

function pointInPolygonInclusive(px: number, py: number, poly: number[], boundaryEps = 6) {
    if (pointInPolygon(px, py, poly)) return true;
    return pointOnPolygonBoundary(px, py, poly, boundaryEps);
}

function getPlantbedHitAtWorldPoint(worldX: number, worldY: number, plantbeds: PolyObject[]) {
    return (
        plantbeds.find((pb) => {
            if (!pointInPolygonInclusive(worldX, worldY, pb.points)) return false;

            for (const hole of pb.holes ?? []) {
                if (pointInPolygonInclusive(worldX, worldY, hole)) return false;
            }

            return true;
        }) ?? null
    );
}

function getOrthogonalEdgeOrientation(ax: number, ay: number, bx: number, by: number) {
    if (ax === bx && ay !== by) return "vertical" as const;
    if (ay === by && ax !== bx) return "horizontal" as const;
    return null;
}

function getEdgeResizeCursor(orientation: "vertical" | "horizontal") {
    return orientation === "vertical" ? "ew-resize" : "ns-resize";
}

function pointOnPolygonBoundary(px: number, py: number, poly: number[], eps = 1e-6) {
    const n = poly.length / 2;
    if (n < 2) return false;

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = poly[i * 2];
        const ay = poly[i * 2 + 1];
        const bx = poly[j * 2];
        const by = poly[j * 2 + 1];

        if (distPointToSeg(px, py, ax, ay, bx, by) <= eps) {
            return true;
        }
    }

    return false;
}

function canAutoCloseAgainstSameTypeBoundary(
    base: number[],
    nextX: number,
    nextY: number,
    activeDrawType: ObjectType | null,
    objects: PolyObject[]
) {
    if (!activeDrawType || isFenceOrGate(activeDrawType) || activeDrawType === "plantbed") return false;
    if (base.length < 4) return false;

    const startX = base[0];
    const startY = base[1];

    const sameTypeObjects = objects.filter(
        (o) =>
            o.type === activeDrawType &&
            !isFenceOrGate(o.type) &&
            Array.isArray(o.points) &&
            o.points.length >= 6
    );

    if (sameTypeObjects.length === 0) return false;

    const startOnBoundary = sameTypeObjects.some((o) =>
        pointOnPolygonBoundary(startX, startY, o.points)
    );

    const endOnBoundary = sameTypeObjects.some((o) =>
        pointOnPolygonBoundary(nextX, nextY, o.points)
    );

    if (!startOnBoundary || !endOnBoundary) return false;

    // voorkom auto-close als gebruiker in feite nog op exact hetzelfde punt staat
    const lastX = base[base.length - 2];
    const lastY = base[base.length - 1];
    if (lastX === nextX && lastY === nextY) return false;

    return true;
}

function distPointToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;

    const abLen2 = abx * abx + aby * aby;
    if (abLen2 < 1e-12) return Math.hypot(px - ax, py - ay);

    let t = (apx * abx + apy * aby) / abLen2;
    t = Math.max(0, Math.min(1, t));

    const cx = ax + t * abx;
    const cy = ay + t * aby;
    return Math.hypot(px - cx, py - cy);
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

function rectContainsPoint(
    px: number,
    py: number,
    rect: { x: number; y: number; w: number; h: number },
    padding = 0
) {
    return (
        px >= rect.x - padding &&
        px <= rect.x + rect.w + padding &&
        py >= rect.y - padding &&
        py <= rect.y + rect.h + padding
    );
}

function rectsOverlap(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
) {
    return !(
        a.x + a.w <= b.x ||
        b.x + b.w <= a.x ||
        a.y + a.h <= b.y ||
        b.y + b.h <= a.y
    );
}

type TreebedLabelBlocker = { x: number; y: number; w: number; h: number };
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

function buildTreebedLabelBlockers(objects: PolyObject[]) {
    const circleBlockerFromCenter = (cx: number, cy: number, radius: number, padding = 0) => ({
        x: cx - radius - padding,
        y: cy - radius - padding,
        w: (radius + padding) * 2,
        h: (radius + padding) * 2,
    });

    return objects
        .filter((obj) => obj.type === "treebed" && Array.isArray(obj.points) && obj.points.length >= 8)
        .flatMap((obj) => {
            const bbox = bboxFromPoints(obj.points);
            const cx = bbox.x + bbox.w / 2;
            const cy = bbox.y + bbox.h / 2;

            const crownBlocker = {
                x: bbox.x,
                y: bbox.y,
                w: bbox.w,
                h: bbox.h,
            };

            const trunkRadius = Math.max(4, Math.min(bbox.w, bbox.h) * 0.08);
            const trunkPadding = Math.max(10, trunkRadius * 1.4);

            if (obj.treebedVariant === "multi_stem") {
                const clusterOffsetY = -trunkRadius * 0.6;
                const clusterOffsetX = -trunkRadius * 0.45;

                const mainTrunk = circleBlockerFromCenter(
                    cx + clusterOffsetX,
                    cy + clusterOffsetY + trunkRadius * 1.15,
                    trunkRadius * 1.08,
                    trunkPadding
                );

                const leftTrunk = circleBlockerFromCenter(
                    cx + clusterOffsetX,
                    cy + clusterOffsetY - trunkRadius * 0.85,
                    trunkRadius * 0.62,
                    trunkPadding
                );

                const rightTrunk = circleBlockerFromCenter(
                    cx + clusterOffsetX + trunkRadius * 1.85,
                    cy + clusterOffsetY + trunkRadius * 0.02,
                    trunkRadius * 0.88,
                    trunkPadding
                );

                return [crownBlocker, mainTrunk, leftTrunk, rightTrunk];
            }

            const singleTrunk = circleBlockerFromCenter(
                cx,
                cy,
                Math.max(trunkRadius, 10),
                trunkPadding
            );

            return [crownBlocker, singleTrunk];
        });
}

function getTreebedLabelBlockersForPlantbed(
    points: number[],
    treebedBlockers: TreebedLabelBlocker[]
) {
    const plantbedBox = bboxFromPoints(points);
    return treebedBlockers.filter((blocker) => rectsOverlap(plantbedBox, blocker));
}

function bestInsidePoint(
    points: number[],
    holes: number[][] = [],
    step: number,
    blockers: Array<{ x: number; y: number; w: number; h: number }> = [],
    labelWidth = 0,
    labelHeight = 0
) {
    const bb = bboxFromPoints(points);
    const candidates: { x: number; y: number; score: number }[] = [];
    const blockerPadding = Math.max(6, step * 0.6);

    const isInsideUsableArea = (x: number, y: number) => {
        if (!pointInPolygon(x, y, points)) return false;
        return !holes.some((hole) => pointInPolygon(x, y, hole));
    };

    const rectFitsInUsableArea = (rect: { x: number; y: number; w: number; h: number }) => {
        const corners = [
            { x: rect.x, y: rect.y },
            { x: rect.x + rect.w, y: rect.y },
            { x: rect.x, y: rect.y + rect.h },
            { x: rect.x + rect.w, y: rect.y + rect.h },
        ];

        return corners.every((corner) => isInsideUsableArea(corner.x, corner.y));
    };

    for (let y = bb.y + step; y < bb.y + bb.h; y += step) {
        for (let x = bb.x + step; x < bb.x + bb.w; x += step) {
            if (!isInsideUsableArea(x, y)) continue;

            const labelRect = {
                x: x - labelWidth / 2,
                y: y - labelHeight / 2,
                w: labelWidth,
                h: labelHeight,
            };

            if (!rectFitsInUsableArea(labelRect)) continue;

            let minDistOuter = Infinity;
            for (let i = 0; i < points.length; i += 2) {
                const x1 = points[i];
                const y1 = points[i + 1];
                const x2 = points[(i + 2) % points.length];
                const y2 = points[(i + 3) % points.length];
                const dist = pointToSegmentDistance(x, y, x1, y1, x2, y2);
                minDistOuter = Math.min(minDistOuter, dist);
            }

            let minDistHole = Infinity;
            for (const hole of holes) {
                for (let i = 0; i < hole.length; i += 2) {
                    const x1 = hole[i];
                    const y1 = hole[i + 1];
                    const x2 = hole[(i + 2) % hole.length];
                    const y2 = hole[(i + 3) % hole.length];
                    const dist = pointToSegmentDistance(x, y, x1, y1, x2, y2);
                    minDistHole = Math.min(minDistHole, dist);
                }
            }

            const nearestHoleDist = Number.isFinite(minDistHole) ? minDistHole : minDistOuter;
            const nearestOuterDist = minDistOuter;
            const minUsableDist = Math.min(nearestOuterDist, nearestHoleDist);

            const overlapsBlocker = blockers.some((blocker) =>
                rectsOverlap(labelRect, {
                    x: blocker.x - blockerPadding,
                    y: blocker.y - blockerPadding,
                    w: blocker.w + blockerPadding * 2,
                    h: blocker.h + blockerPadding * 2,
                })
            );

            const bbCenterX = bb.x + bb.w / 2;
            const bbCenterY = bb.y + bb.h / 2;
            const centerDist = Math.hypot(x - bbCenterX, y - bbCenterY);

            candidates.push({
                x,
                y,
                score: overlapsBlocker
                    ? minUsableDist - 10000
                    : minUsableDist * 2.2 + nearestHoleDist * 1.6 - centerDist * 0.04,
            });
        }
    }

    if (candidates.length === 0) {
        return { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2, score: -Infinity };
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
}

function getPlantbedNumberLayout(
    points: number[],
    holes: number[][] = [],
    plantbedNo: number | string,
    areaText: string,
    treebedBlockers: TreebedLabelBlocker[]
): PlantbedNumberLayout {
    const text = String(plantbedNo);
    const bb = bboxFromPoints(points);
    const relevantTreebedBlockers = getTreebedLabelBlockersForPlantbed(points, treebedBlockers);

    const safeWidth = Math.max(bb.w - GRID_SIZE * 0.45, GRID_SIZE * 0.55);
    const safeHeight = Math.max(bb.h - GRID_SIZE * 0.45, GRID_SIZE * 0.55);

    const fallbackCenter = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };

    const AREA_GAP = 8;
    const INNER_MARGIN = 4;
    const AREA_FONT_CANDIDATES = [16, 14, 12, 10] as const;

    let bestLayout:
        | {
            centerX: number;
            centerY: number;
            numberFontSize: number;
            numberTextWidth: number;
            numberTextHeight: number;
            compositeWidth: number;
            compositeHeight: number;
            areaFontSize: number;
            areaRotation: 0 | -90;
            areaTextWidth: number;
            areaTextHeight: number;
        }
        | null = null;

    const estimateNumberWidth = (fontSize: number) =>
        Math.max(fontSize * 0.9, fontSize * Math.max(1.05, text.length * 0.72));

    const estimateNumberHeight = (fontSize: number) => fontSize * 0.78;

    const initialNumberFontSizeByHeight = safeHeight * 0.32;
    const initialNumberFontSizeByWidth = safeWidth / Math.max(1, text.length * 0.72);
    const initialNumberFontSize = Math.round(
        clamp(Math.min(initialNumberFontSizeByHeight, initialNumberFontSizeByWidth), 4, 28)
    );

    for (let tryNumberFontSize = initialNumberFontSize; tryNumberFontSize >= 4; tryNumberFontSize -= 1) {
        const numberTextWidth = estimateNumberWidth(tryNumberFontSize);
        const numberTextHeight = estimateNumberHeight(tryNumberFontSize);

        for (const areaFontSize of AREA_FONT_CANDIDATES) {
            const areaTextWidth = estimateTextWidth(areaText, areaFontSize);
            const areaTextHeight = areaFontSize;

            const candidates = [
                {
                    areaRotation: 0 as const,
                    areaOccupiedWidth: areaTextWidth,
                    areaOccupiedHeight: areaTextHeight,
                },
                {
                    areaRotation: -90 as const,
                    areaOccupiedWidth: areaTextHeight,
                    areaOccupiedHeight: areaTextWidth,
                },
            ];

            for (const candidateLayout of candidates) {
                const compositeWidth = Math.max(numberTextWidth, candidateLayout.areaOccupiedWidth) + INNER_MARGIN * 2;
                const compositeHeight =
                    numberTextHeight + AREA_GAP + candidateLayout.areaOccupiedHeight + INNER_MARGIN * 2;

                const fallbackRect = {
                    x: fallbackCenter.x - compositeWidth / 2,
                    y: fallbackCenter.y - compositeHeight / 2,
                    w: compositeWidth,
                    h: compositeHeight,
                };

                const fallbackInHole = holes.some((hole) =>
                    pointInPolygon(fallbackCenter.x, fallbackCenter.y, hole) ||
                    pointInPolygon(fallbackRect.x, fallbackRect.y, hole) ||
                    pointInPolygon(fallbackRect.x + fallbackRect.w, fallbackRect.y, hole) ||
                    pointInPolygon(fallbackRect.x, fallbackRect.y + fallbackRect.h, hole) ||
                    pointInPolygon(fallbackRect.x + fallbackRect.w, fallbackRect.y + fallbackRect.h, hole)
                );

                const centerBlockedByTreebed =
                    relevantTreebedBlockers.length > 0 &&
                    relevantTreebedBlockers.some((blocker) => rectsOverlap(fallbackRect, blocker));

                const canUseFallbackCenter =
                    !fallbackInHole &&
                    !centerBlockedByTreebed &&
                    holes.length === 0 &&
                    relevantTreebedBlockers.length === 0 &&
                    isAxisAlignedRect(points);

                if (canUseFallbackCenter) {
                    bestLayout = {
                        centerX: fallbackCenter.x,
                        centerY: fallbackCenter.y,
                        numberFontSize: tryNumberFontSize,
                        numberTextWidth,
                        numberTextHeight,
                        compositeWidth,
                        compositeHeight,
                        areaFontSize,
                        areaRotation: candidateLayout.areaRotation,
                        areaTextWidth,
                        areaTextHeight,
                    };
                    break;
                }

                const candidate = bestInsidePoint(
                    points,
                    holes,
                    Math.max(2, GRID_SIZE / 5),
                    relevantTreebedBlockers,
                    compositeWidth,
                    compositeHeight
                );

                if (Number.isFinite(candidate.score)) {
                    bestLayout = {
                        centerX: candidate.x,
                        centerY: candidate.y,
                        numberFontSize: tryNumberFontSize,
                        numberTextWidth,
                        numberTextHeight,
                        compositeWidth,
                        compositeHeight,
                        areaFontSize,
                        areaRotation: candidateLayout.areaRotation,
                        areaTextWidth,
                        areaTextHeight,
                    };
                    break;
                }
            }

            if (bestLayout) break;
        }

        if (bestLayout) break;
    }

    if (!bestLayout) {
        const fallbackNumberFontSize = 4;
        const fallbackNumberWidth = estimateNumberWidth(fallbackNumberFontSize);
        const fallbackNumberHeight = estimateNumberHeight(fallbackNumberFontSize);
        const fallbackAreaFontSize = 8;
        const fallbackAreaTextWidth = estimateTextWidth(areaText, fallbackAreaFontSize);

        const compositeTopY =
            fallbackCenter.y - (fallbackNumberHeight + AREA_GAP + fallbackAreaFontSize) / 2;

        return {
            text,
            fontSize: fallbackNumberFontSize,
            x: fallbackCenter.x - fallbackNumberWidth / 2,
            y: compositeTopY,
            width: fallbackNumberWidth,
            areaText,
            areaFontSize: fallbackAreaFontSize,
            areaRotation: 0,
            areaX: fallbackCenter.x - fallbackAreaTextWidth / 2,
            areaY: compositeTopY + fallbackNumberHeight + AREA_GAP,
        };
    }

    const compositeTopY = bestLayout.centerY - bestLayout.compositeHeight / 2 + INNER_MARGIN;
    const numberY = compositeTopY;
    const numberX = bestLayout.centerX - bestLayout.numberTextWidth / 2;

    const areaTopY = compositeTopY + bestLayout.numberTextHeight + AREA_GAP;

    if (bestLayout.areaRotation === 0) {
        return {
            text,
            fontSize: bestLayout.numberFontSize,
            x: numberX,
            y: numberY,
            width: bestLayout.numberTextWidth,
            areaText,
            areaFontSize: bestLayout.areaFontSize,
            areaRotation: 0,
            areaX: bestLayout.centerX - bestLayout.areaTextWidth / 2,
            areaY: areaTopY,
        };
    }

    return {
        text,
        fontSize: bestLayout.numberFontSize,
        x: numberX,
        y: numberY,
        width: bestLayout.numberTextWidth,
        areaText,
        areaFontSize: bestLayout.areaFontSize,
        areaRotation: -90,
        areaX: bestLayout.centerX,
        areaY: areaTopY + bestLayout.areaTextWidth / 2,
    };
}

const TREEBED_MIN_SIZE = 20;
const TREEBED_ESPALIER_MIN_HEIGHT = 100;
const TREEBED_ESPALIER_WIDTH_RATIO = 0.18;

function getTreebedBBox(points: number[]) {
    return bboxFromPoints(points);
}

function createTreebedPointsFromRect(
    x: number,
    y: number,
    w: number,
    h: number
) {
    return [
        x, y,
        x + w, y,
        x + w, y + h,
        x, y + h,
    ];
}

function normalizeRotationDeg(rotationDeg: number) {
    let next = rotationDeg % 360;
    if (next < 0) next += 360;
    return next;
}

function rotatePointAround(
    x: number,
    y: number,
    cx: number,
    cy: number,
    rotationDeg: number
) {
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const dx = x - cx;
    const dy = y - cy;

    return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
    };
}

function getTreebedRectRotationDeg(points: number[]) {
    if (!points || points.length < 8) return 0;

    const ax = points[0];
    const ay = points[1];
    const bx = points[2];
    const by = points[3];

    return normalizeRotationDeg((Math.atan2(by - ay, bx - ax) * 180) / Math.PI);
}

function createRotatedTreebedRectPoints(
    cx: number,
    cy: number,
    width: number,
    height: number,
    rotationDeg: number
) {
    const hw = width / 2;
    const hh = height / 2;

    const tl = rotatePointAround(cx - hw, cy - hh, cx, cy, rotationDeg);
    const tr = rotatePointAround(cx + hw, cy - hh, cx, cy, rotationDeg);
    const br = rotatePointAround(cx + hw, cy + hh, cx, cy, rotationDeg);
    const bl = rotatePointAround(cx - hw, cy + hh, cx, cy, rotationDeg);

    return [
        tl.x, tl.y,
        tr.x, tr.y,
        br.x, br.y,
        bl.x, bl.y,
    ];
}

function getTreebedVisual(
    points: number[],
    treebedVariant: TreebedVariant | undefined = "standard"
) {
    const bb = getTreebedBBox(points);
    const cx = bb.x + bb.w / 2;
    const cy = bb.y + bb.h / 2;

    if (treebedVariant === "espalier") {
        const topWidth = Math.hypot(points[2] - points[0], points[3] - points[1]);
        const rightHeight = Math.hypot(points[4] - points[2], points[5] - points[3]);

        const rect = {
            x: cx - topWidth / 2,
            y: cy - rightHeight / 2,
            w: topWidth,
            h: rightHeight,
            rotationDeg: getTreebedRectRotationDeg(points),
        };

        return {
            shape: "rect" as const,
            cx,
            cy,
            rect,
            trunkRadius: Math.max(10, Math.min(rect.w, rect.h) * 0.22),
            bbox: bb,
            stroke: "#476D3C",
            fill: "#008000",
        };
    }

    if (treebedVariant === "roof") {
        const size = Math.max(Math.min(bb.w, bb.h), TREEBED_MIN_SIZE);

        const rect = {
            x: cx - size / 2,
            y: cy - size / 2,
            w: size,
            h: size,
            rotationDeg: 0,
        };

        return {
            shape: "rect" as const,
            cx,
            cy,
            rect,
            trunkRadius: Math.max(10, size * 0.05),
            bbox: {
                x: rect.x,
                y: rect.y,
                w: rect.w,
                h: rect.h,
            },
            stroke: "#476D3C",
            fill: "#008000",
        };
    }

    const size = Math.min(bb.w, bb.h);
    const radius = size / 2;

    return {
        shape: "circle" as const,
        cx,
        cy,
        radius,
        trunkRadius: Math.max(8, radius * 0.09),
        bbox: {
            x: cx - radius,
            y: cy - radius,
            w: radius * 2,
            h: radius * 2,
        },
        stroke: "#476D3C",
        fill: "#008000",
    };
}

function renderTreebedTrunks(
    treebedVariant: TreebedVariant | undefined,
    cx: number,
    cy: number,
    trunkRadius: number,
    keyPrefix: string,
    listening = false
) {
    const trunkFill = "#8B5E3C";

    if (treebedVariant === "multi_stem") {
        const clusterOffsetY = -trunkRadius * 0.6;
        const clusterOffsetX = -trunkRadius * 0.45;
        return (
            <>
                <Circle
                    key={`${keyPrefix}-trunk-main`}
                    x={cx + clusterOffsetX}
                    y={cy + clusterOffsetY + trunkRadius * 1.15}
                    radius={trunkRadius * 1.08}
                    fill={trunkFill}
                    listening={listening}
                    perfectDrawEnabled={false}
                />
                <Circle
                    key={`${keyPrefix}-trunk-left`}
                    x={cx + clusterOffsetX - trunkRadius * 0}
                    y={cy + clusterOffsetY - trunkRadius * 0.85}
                    radius={trunkRadius * 0.62}
                    fill={trunkFill}
                    listening={listening}
                    perfectDrawEnabled={false}
                />
                <Circle
                    key={`${keyPrefix}-trunk-right`}
                    x={cx + clusterOffsetX + trunkRadius * 1.85}
                    y={cy + clusterOffsetY + trunkRadius * 0.02}
                    radius={trunkRadius * 0.88}
                    fill={trunkFill}
                    listening={listening}
                    perfectDrawEnabled={false}
                />
            </>
        );
    }

    return (
        <Circle
            key={`${keyPrefix}-trunk-single`}
            x={cx}
            y={cy}
            radius={Math.max(trunkRadius, 10)}
            fill={trunkFill}
            listening={listening}
            perfectDrawEnabled={false}
        />
    );
}

function createTreebedPointsFromCircle(
    cx: number,
    cy: number,
    radius: number,
    segments = 40
) {
    const pts: number[] = [];
    for (let i = 0; i < segments; i++) {
        const a = (Math.PI * 2 * i) / segments;
        pts.push(
            cx + Math.cos(a) * radius,
            cy + Math.sin(a) * radius
        );
    }
    return pts;
}

function createTreebedPointsFromCenterDrag(
    cx: number,
    cy: number,
    pointerX: number,
    pointerY: number,
    treebedVariant: TreebedVariant | undefined = "standard"
) {
    const dx = pointerX - cx;
    const dy = pointerY - cy;

    if (treebedVariant === "espalier") {
        const height = Math.max(TREEBED_ESPALIER_MIN_HEIGHT, Math.abs(dy) * 2);
        const width = Math.max(TREEBED_MIN_SIZE, height * TREEBED_ESPALIER_WIDTH_RATIO);

        return createTreebedPointsFromRect(
            cx - width / 2,
            cy - height / 2,
            width,
            height
        );
    }

    if (treebedVariant === "roof") {
        const size = Math.max(TREEBED_MIN_SIZE, Math.max(Math.abs(dx), Math.abs(dy)) * 2);

        return createTreebedPointsFromRect(
            cx - size / 2,
            cy - size / 2,
            size,
            size
        );
    }

    const radius = Math.max(10, Math.hypot(dx, dy));
    return createTreebedPointsFromCircle(cx, cy, radius);
}

function createTreebedPointsFromCornerDrag(
    anchorX: number,
    anchorY: number,
    pointerX: number,
    pointerY: number,
    corner: "tl" | "tr" | "br" | "bl",
    treebedVariant: TreebedVariant | undefined = "standard"
) {
    if (treebedVariant === "espalier") {
        const rawH = Math.abs(pointerY - anchorY);
        const height = Math.max(rawH, TREEBED_ESPALIER_MIN_HEIGHT);
        const width = Math.max(TREEBED_MIN_SIZE, height * TREEBED_ESPALIER_WIDTH_RATIO);

        let x = anchorX;
        let y = anchorY;

        if (corner === "tl") {
            x = anchorX - width;
            y = anchorY - height;
        } else if (corner === "tr") {
            x = anchorX;
            y = anchorY - height;
        } else if (corner === "br") {
            x = anchorX;
            y = anchorY;
        } else if (corner === "bl") {
            x = anchorX - width;
            y = anchorY;
        }

        return createTreebedPointsFromRect(x, y, width, height);
    }

    const rawW = Math.abs(pointerX - anchorX);
    const rawH = Math.abs(pointerY - anchorY);
    const size = Math.max(rawW, rawH, TREEBED_MIN_SIZE);

    let x = anchorX;
    let y = anchorY;

    if (corner === "tl") {
        x = anchorX - size;
        y = anchorY - size;
    } else if (corner === "tr") {
        x = anchorX;
        y = anchorY - size;
    } else if (corner === "br") {
        x = anchorX;
        y = anchorY;
    } else if (corner === "bl") {
        x = anchorX - size;
        y = anchorY;
    }

    if (treebedVariant === "roof") {
        return createTreebedPointsFromRect(x, y, size, size);
    }

    const cx = x + size / 2;
    const cy = y + size / 2;
    const radius = size / 2;

    return createTreebedPointsFromCircle(cx, cy, radius);
}

function createEspalierPointsFromRotatedCornerDrag(
    anchorX: number,
    anchorY: number,
    pointerX: number,
    pointerY: number,
    corner: "tl" | "tr" | "br" | "bl",
    rotationDeg: number
) {
    const rad = (rotationDeg * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uy = Math.sin(rad);
    const vx = -Math.sin(rad);
    const vy = Math.cos(rad);

    const dx = pointerX - anchorX;
    const dy = pointerY - anchorY;

    const projectedV = dx * vx + dy * vy;

    const height =
        corner === "tl" || corner === "tr"
            ? Math.max(TREEBED_ESPALIER_MIN_HEIGHT, -projectedV)
            : Math.max(TREEBED_ESPALIER_MIN_HEIGHT, projectedV);

    const width = Math.max(TREEBED_MIN_SIZE, height * TREEBED_ESPALIER_WIDTH_RATIO);

    let centerX = anchorX;
    let centerY = anchorY;

    if (corner === "tl") {
        centerX += -ux * (width / 2) - vx * (height / 2);
        centerY += -uy * (width / 2) - vy * (height / 2);
    } else if (corner === "tr") {
        centerX += ux * (width / 2) - vx * (height / 2);
        centerY += uy * (width / 2) - vy * (height / 2);
    } else if (corner === "br") {
        centerX += ux * (width / 2) + vx * (height / 2);
        centerY += uy * (width / 2) + vy * (height / 2);
    } else {
        centerX += -ux * (width / 2) + vx * (height / 2);
        centerY += -uy * (width / 2) + vy * (height / 2);
    }

    return createRotatedTreebedRectPoints(
        centerX,
        centerY,
        width,
        height,
        rotationDeg
    );
}

function getTreebedResizeCorners(
    points: number[],
    treebedVariant: TreebedVariant | undefined = "standard"
) {
    if (treebedVariant === "espalier" && points.length >= 8) {
        return {
            tl: { x: points[0], y: points[1] },
            tr: { x: points[2], y: points[3] },
            br: { x: points[4], y: points[5] },
            bl: { x: points[6], y: points[7] },
        };
    }

    const { bbox } = getTreebedVisual(points, treebedVariant);

    return {
        tl: { x: bbox.x, y: bbox.y },
        tr: { x: bbox.x + bbox.w, y: bbox.y },
        br: { x: bbox.x + bbox.w, y: bbox.y + bbox.h },
        bl: { x: bbox.x, y: bbox.y + bbox.h },
    };
}

function getTreebedRotateCursorForAngleDeg(angleDeg: number) {
    const normalized = normalizeRotationDeg(angleDeg);

    if (normalized >= 0 && normalized < 90) {
        return "url(/icons/rotate-0.png) 16 16, auto";
    }

    if (normalized >= 90 && normalized < 180) {
        return "url(/icons/rotate-270.png) 16 16, auto";
    }

    if (normalized >= 180 && normalized < 270) {
        return "url(/icons/rotate-180.png) 16 16, auto";
    }

    return "url(/icons/rotate-90.png) 16 16, auto";
}

function getTreebedRotateCursorFromPoint(
    cx: number,
    cy: number,
    px: number,
    py: number
) {
    const angleDeg = normalizeRotationDeg(
        (Math.atan2(py - cy, px - cx) * 180) / Math.PI
    );

    return getTreebedRotateCursorForAngleDeg(angleDeg);
}

function isAxisAlignedRect(points: number[], eps = 1e-6) {
    if (points.length < 8) return false;

    const bb = bboxFromPoints(points);
    const xs: number[] = [];
    const ys: number[] = [];

    const pushUnique = (arr: number[], v: number) => {
        for (const a of arr) if (Math.abs(a - v) <= eps) return;
        arr.push(v);
    };

    for (let i = 0; i < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];

        const onMinX = Math.abs(x - bb.x) <= eps;
        const onMaxX = Math.abs(x - (bb.x + bb.w)) <= eps;
        const onMinY = Math.abs(y - bb.y) <= eps;
        const onMaxY = Math.abs(y - (bb.y + bb.h)) <= eps;

        if (!(onMinX || onMaxX || onMinY || onMaxY)) return false;

        pushUnique(xs, x);
        pushUnique(ys, y);

        if (xs.length > 2 || ys.length > 2) return false;
    }

    if (bb.w <= eps || bb.h <= eps) return false;

    return true;
}

function rectsIntersect(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
) {
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

function pointInRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function segSegIntersect(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    dx: number,
    dy: number,
    eps = 1e-9
) {
    const orient = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => {
        const v = (qy - py) * (rx - qx) - (qx - px) * (ry - qy);
        if (Math.abs(v) <= eps) return 0;
        return v > 0 ? 1 : 2;
    };

    const onSeg = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => {
        return (
            qx <= Math.max(px, rx) + eps &&
            qx + eps >= Math.min(px, rx) &&
            qy <= Math.max(py, ry) + eps &&
            qy + eps >= Math.min(py, ry)
        );
    };

    const o1 = orient(ax, ay, bx, by, cx, cy);
    const o2 = orient(ax, ay, bx, by, dx, dy);
    const o3 = orient(cx, cy, dx, dy, ax, ay);
    const o4 = orient(cx, cy, dx, dy, bx, by);

    if (o1 !== o2 && o3 !== o4) return true;

    if (o1 === 0 && onSeg(ax, ay, cx, cy, bx, by)) return true;
    if (o2 === 0 && onSeg(ax, ay, dx, dy, bx, by)) return true;
    if (o3 === 0 && onSeg(cx, cy, ax, ay, dx, dy)) return true;
    if (o4 === 0 && onSeg(cx, cy, bx, by, dx, dy)) return true;

    return false;
}

function segmentIntersectsRect(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    r: { x: number; y: number; w: number; h: number }
) {
    // if either endpoint inside rect => hit
    if (pointInRect(ax, ay, r) || pointInRect(bx, by, r)) return true;

    // rect corners
    const x1 = r.x;
    const y1 = r.y;
    const x2 = r.x + r.w;
    const y2 = r.y + r.h;

    // rect edges: (x1,y1)-(x2,y1), (x2,y1)-(x2,y2), (x2,y2)-(x1,y2), (x1,y2)-(x1,y1)
    if (segSegIntersect(ax, ay, bx, by, x1, y1, x2, y1)) return true;
    if (segSegIntersect(ax, ay, bx, by, x2, y1, x2, y2)) return true;
    if (segSegIntersect(ax, ay, bx, by, x2, y2, x1, y2)) return true;
    if (segSegIntersect(ax, ay, bx, by, x1, y2, x1, y1)) return true;

    return false;
}

function polyIntersectsRect(points: number[], r: { x: number; y: number; w: number; h: number }) {
    if (points.length < 6) return false;

    // A) any polygon vertex in rect
    for (let i = 0; i < points.length; i += 2) {
        if (pointInRect(points[i], points[i + 1], r)) return true;
    }

    // B) any rect corner inside polygon
    const corners = [
        { x: r.x, y: r.y },
        { x: r.x + r.w, y: r.y },
        { x: r.x + r.w, y: r.y + r.h },
        { x: r.x, y: r.y + r.h },
    ];
    for (const c of corners) {
        if (pointInPolygon(c.x, c.y, points)) return true;
    }

    // C) any polygon edge intersects rect
    const n = points.length / 2;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = points[i * 2];
        const ay = points[i * 2 + 1];
        const bx = points[j * 2];
        const by = points[j * 2 + 1];

        if (segmentIntersectsRect(ax, ay, bx, by, r)) return true;
    }

    return false;
}


/**
 * Super-performante grid:
 * - 1 Konva Shape i.p.v. duizenden React <Line> nodes
 * - tekent alleen zichtbare lijnen (viewport-based)
 */
// ✅ Polygon renderer mét holes (evenodd), zodat gras met holes echt uitgesneden wordt
function PolygonWithHoles(props: {
    points: number[];
    holes?: number[][];
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    listening?: boolean;
    perfectDrawEnabled?: boolean;
    dash?: number[];
    dashEnabled?: boolean;
    lineCap?: CanvasLineCap;
    lineJoin?: CanvasLineJoin;
    draggable?: boolean;
    fillPriority?: "color" | "pattern" | "linear-gradient" | "radial-gradient";
    fillPatternImage?: HTMLImageElement;
    fillPatternRepeat?: "repeat" | "repeat-x" | "repeat-y" | "no-repeat";
    onMouseEnter?: (e: any) => void;
    onMouseLeave?: (e: any) => void;
    onMouseDown?: (e: any) => void;
    onClick?: (e: any) => void;
}) {
    const {
        points,
        holes = [],
        fill,
        stroke,
        strokeWidth = 2,
        opacity = 1,
        listening = true,
        perfectDrawEnabled = false,
        dash,
        dashEnabled,
        lineCap,
        lineJoin,
        draggable = false,
        fillPriority,
        fillPatternImage,
        fillPatternRepeat,
        onMouseEnter,
        onMouseLeave,
        onMouseDown,
        onClick,
    } = props;

    return (
        <Shape
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
            listening={listening}
            perfectDrawEnabled={perfectDrawEnabled}
            dash={dash}
            dashEnabled={dashEnabled}
            lineCap={lineCap}
            lineJoin={lineJoin}
            draggable={draggable}
            fillPriority={fillPriority}
            fillPatternImage={fillPatternImage}
            fillPatternRepeat={fillPatternRepeat}
            fillRule="evenodd"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onMouseDown={onMouseDown}
            onClick={onClick}
            sceneFunc={(ctx, shape) => {
                if (!points || points.length < 6) return;

                ctx.beginPath();

                // outer
                ctx.moveTo(points[0], points[1]);
                for (let i = 2; i < points.length; i += 2) {
                    ctx.lineTo(points[i], points[i + 1]);
                }
                ctx.closePath();

                // holes
                for (const h of holes) {
                    if (!h || h.length < 6) continue;
                    ctx.moveTo(h[0], h[1]);
                    for (let i = 2; i < h.length; i += 2) {
                        ctx.lineTo(h[i], h[i + 1]);
                    }
                    ctx.closePath();
                }

                ctx.fillStrokeShape(shape);
            }}
        />
    );
}

function GridShape(props: {
    canvasW: number;
    canvasH: number;
    stageScale: number;
    stagePos: { x: number; y: number };
    gridSize: number;
}) {
    const { canvasW, canvasH, stageScale, stagePos, gridSize } = props;

    const bounds = useMemo(() => {
        const left = (-stagePos.x) / stageScale;
        const top = (-stagePos.y) / stageScale;
        const right = (canvasW - stagePos.x) / stageScale;
        const bottom = (canvasH - stagePos.y) / stageScale;

        // kleine marge zodat je niet “gaten” ziet aan de randen
        const pad = gridSize * 2;

        const startX = Math.floor((left - pad) / gridSize) * gridSize;
        const endX = Math.ceil((right + pad) / gridSize) * gridSize;
        const startY = Math.floor((top - pad) / gridSize) * gridSize;
        const endY = Math.ceil((bottom + pad) / gridSize) * gridSize;

        return { startX, endX, startY, endY };
    }, [canvasW, canvasH, stagePos.x, stagePos.y, stageScale, gridSize]);

    return (
        <Shape
            listening={false}
            perfectDrawEnabled={false}
            sceneFunc={(ctx, shape) => {
                ctx.beginPath();

                // Vertical lines
                for (let x = bounds.startX; x <= bounds.endX; x += gridSize) {
                    ctx.moveTo(x, bounds.startY);
                    ctx.lineTo(x, bounds.endY);
                }

                // Horizontal lines
                for (let y = bounds.startY; y <= bounds.endY; y += gridSize) {
                    ctx.moveTo(bounds.startX, y);
                    ctx.lineTo(bounds.endX, y);
                }

                ctx.strokeStyle = COLORS.grid;
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.closePath();
                // @ts-ignore
                shape.getSceneFunc && shape.getSceneFunc();
            }}
        />
    );
}

const TYPE_LABELS: Record<string, string> = {
    grass: "Gras",
    tiles: "Tegels/bestrating",
    water: "Water",
    gravel: "Grind",
    sand: "Zand",
    wood: "Hout",
    patio: "Terras",
    house: "Woning",
    garage: "Garage",
    shed: "Schuur",
    garden_house: "Tuinhuis",
    carport: "Carport",
    veranda: "Veranda",
    canopy: "Overkapping",
    fence: "Schutting",
    gate: "Hek",
    plantbed: "Plantvak",
    treebed: "Boomvak",
};

const TREEBED_VARIANT_LABELS: Record<TreebedVariant, string> = {
    standard: "standaard",
    multi_stem: "meerstammig",
    espalier: "leivorm",
    roof: "dakvorm",
};

function getTreebedLabel(obj: Pick<PolyObject, "type" | "treebedVariant">) {
    if (obj.type !== "treebed") {
        return TYPE_LABELS[obj.type] ?? obj.type;
    }

    const variant = obj.treebedVariant ?? "standard";
    if (variant === "standard") return "Boomvak";

    return `Boomvak (${TREEBED_VARIANT_LABELS[variant]})`;
}

const BUILDING_TYPES = ["house", "garage", "shed", "garden_house", "carport", "veranda", "canopy"] as const;
type BuildingType = (typeof BUILDING_TYPES)[number];

const BUILDING_PATTERN_CACHE = new Map<string, HTMLCanvasElement>();
const BUILDING_PATTERN_SIZE = 22;
const BUILDING_PATTERN_SPACING = 22;
const BUILDING_PATTERN_STROKE_WIDTH = 1;

function isFenceOrGate(t: any): t is ObjectType {
    return t === "fence" || t === "gate";
}

function isBuildingType(t: any): t is BuildingType {
    return BUILDING_TYPES.includes(t as BuildingType);
}

function getViewVisibilityKeyForType(type: ObjectType) {
    switch (type) {
        case "grass":
        case "tiles":
        case "water":
        case "gravel":
        case "sand":
        case "wood":
        case "patio":
            return "showGround" as const;

        case "house":
        case "garage":
        case "shed":
        case "garden_house":
        case "carport":
        case "veranda":
        case "canopy":
            return "showBuildings" as const;

        case "fence":
        case "gate":
            return "showBoundaries" as const;

        case "plantbed":
            return "showPlantbeds" as const;

        case "treebed":
            return "showTreebeds" as const;
    }
}

function getViewVisibilityLabelForType(type: ObjectType) {
    switch (type) {
        case "grass":
        case "tiles":
        case "water":
        case "gravel":
        case "sand":
        case "wood":
        case "patio":
            return "Toon ondergrond";

        case "house":
        case "garage":
        case "shed":
        case "garden_house":
        case "carport":
        case "veranda":
        case "canopy":
            return "Toon gebouwen";

        case "fence":
        case "gate":
            return "Toon afbakening";

        case "plantbed":
            return "Toon plantvak";

        case "treebed":
            return "Toon boomvak";
    }
}

function getBuildingPatternCanvas(type: BuildingType): HTMLCanvasElement | undefined {
    if (typeof document === "undefined") return undefined;

    const { fill, stroke } = OBJECT_STYLES[type];
    const key = `${fill}_${stroke}`;

    const cached = BUILDING_PATTERN_CACHE.get(key);
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    canvas.width = BUILDING_PATTERN_SIZE;
    canvas.height = BUILDING_PATTERN_SIZE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = stroke;
    ctx.lineWidth = BUILDING_PATTERN_STROKE_WIDTH;

    for (
        let offset = -BUILDING_PATTERN_SIZE;
        offset <= BUILDING_PATTERN_SIZE;
        offset += BUILDING_PATTERN_SPACING
    ) {
        ctx.beginPath();
        ctx.moveTo(offset, BUILDING_PATTERN_SIZE);
        ctx.lineTo(offset + BUILDING_PATTERN_SIZE, 0);
        ctx.stroke();
    }

    BUILDING_PATTERN_CACHE.set(key, canvas);
    return canvas;
}

function getLineStrokeWidth(t: any) {
    return isFenceOrGate(t) ? FENCE_GATE_STROKE_WIDTH : 2;
}

const ORTHO_GUIDE_TOLERANCE = GRID_SIZE * 0.6;
const ANGLE_LOCK_STEP = Math.PI / 4;

type ResolvedDrawPreviewPoint = {
    x: number;
    y: number;
    primaryGuidePoints: number[] | null;
    secondaryGuidePoints: number[] | null;
};

function shouldShowDraftGuidesForTool(
    tool: "select" | "draw" | "hand" | "cut"
) {
    return tool === "draw";
}

function snapWorldPointAgainstFenceBoundary(
    rawX: number,
    rawY: number,
    _targetType: ObjectType | null | undefined,
    _objects: PolyObject[]
) {
    return {
        x: snapToGrid(rawX, GRID_SIZE),
        y: snapToGrid(rawY, GRID_SIZE),
    };
}

function getAngleLockedPoint(
    anchorX: number,
    anchorY: number,
    rawX: number,
    rawY: number
) {
    const dx = rawX - anchorX;
    const dy = rawY - anchorY;

    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
        return { x: anchorX, y: anchorY };
    }

    const rawAngle = Math.atan2(dy, dx);
    const snappedAngle = Math.round(rawAngle / ANGLE_LOCK_STEP) * ANGLE_LOCK_STEP;

    const angleIndex = ((Math.round(snappedAngle / ANGLE_LOCK_STEP) % 8) + 8) % 8;
    const isDiagonal = angleIndex % 2 === 1;

    const dirX = Math.cos(snappedAngle);
    const dirY = Math.sin(snappedAngle);

    const projectedDistance = dx * dirX + dy * dirY;
    const step = isDiagonal ? GRID_SIZE * Math.SQRT2 : GRID_SIZE;
    const snappedDistance = Math.round(projectedDistance / step) * step;

    const nextX = anchorX + dirX * snappedDistance;
    const nextY = anchorY + dirY * snappedDistance;

    const roundedX = Math.abs(nextX) < 1e-9 ? 0 : nextX;
    const roundedY = Math.abs(nextY) < 1e-9 ? 0 : nextY;

    return {
        x: roundedX,
        y: roundedY,
    };
}

function resolveDrawPreviewPoint(
    rawX: number,
    rawY: number,
    basePoints: number[],
    shiftKey: boolean,
    targetType: ObjectType | null | undefined,
    objects: PolyObject[],
    options?: {
        showGuides?: boolean;
    }
): ResolvedDrawPreviewPoint {
    const showGuides = options?.showGuides ?? true;
    const gridSnapped = snapWorldPointAgainstFenceBoundary(rawX, rawY, targetType, objects);

    if (basePoints.length < 2) {
        return {
            x: gridSnapped.x,
            y: gridSnapped.y,
            primaryGuidePoints: null,
            secondaryGuidePoints: null,
        };
    }

    const anchorX = basePoints[basePoints.length - 2];
    const anchorY = basePoints[basePoints.length - 1];
    const hasStartPoint = basePoints.length >= 4;
    const startX = hasStartPoint ? basePoints[0] : null;
    const startY = hasStartPoint ? basePoints[1] : null;

    const buildCornerGuides = (
        projectedX: number,
        projectedY: number
    ): ResolvedDrawPreviewPoint => {
        let nextX = projectedX;
        let nextY = projectedY;
        let primaryGuidePoints: number[] | null =
            showGuides ? [anchorX, anchorY, projectedX, projectedY] : null;
        let secondaryGuidePoints: number[] | null = null;

        if (showGuides && startX !== null && startY !== null) {
            const alignsVerticalWithStart = Math.abs(projectedX - startX) <= ORTHO_GUIDE_TOLERANCE;
            const alignsHorizontalWithStart = Math.abs(projectedY - startY) <= ORTHO_GUIDE_TOLERANCE;

            if (alignsVerticalWithStart) {
                nextX = startX;
                primaryGuidePoints = [anchorX, anchorY, nextX, nextY];

                if (!(anchorX === nextX && anchorY === startY)) {
                    secondaryGuidePoints = [startX, startY, nextX, nextY];
                }

                return {
                    x: nextX,
                    y: nextY,
                    primaryGuidePoints,
                    secondaryGuidePoints,
                };
            }

            if (alignsHorizontalWithStart) {
                nextY = startY;
                primaryGuidePoints = [anchorX, anchorY, nextX, nextY];

                if (!(anchorX === startX && anchorY === nextY)) {
                    secondaryGuidePoints = [startX, startY, nextX, nextY];
                }

                return {
                    x: nextX,
                    y: nextY,
                    primaryGuidePoints,
                    secondaryGuidePoints,
                };
            }
        }

        return {
            x: nextX,
            y: nextY,
            primaryGuidePoints,
            secondaryGuidePoints,
        };
    };

    if (shiftKey) {
        const locked = getAngleLockedPoint(anchorX, anchorY, rawX, rawY);
        return buildCornerGuides(locked.x, locked.y);
    }

    const rawDx = rawX - anchorX;
    const rawDy = rawY - anchorY;

    const nearVerticalFromAnchor = Math.abs(rawDx) <= ORTHO_GUIDE_TOLERANCE;
    const nearHorizontalFromAnchor = Math.abs(rawDy) <= ORTHO_GUIDE_TOLERANCE;

    if (nearVerticalFromAnchor || nearHorizontalFromAnchor) {
        if (Math.abs(rawDx) <= Math.abs(rawDy)) {
            return buildCornerGuides(anchorX, gridSnapped.y);
        }

        return buildCornerGuides(gridSnapped.x, anchorY);
    }

    return {
        x: gridSnapped.x,
        y: gridSnapped.y,
        primaryGuidePoints: null,
        secondaryGuidePoints: null,
    };
}

function lineIntersection(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    dx: number,
    dy: number
) {
    const abx = bx - ax;
    const aby = by - ay;
    const cdx = dx - cx;
    const cdy = dy - cy;

    const det = abx * cdy - aby * cdx;
    if (Math.abs(det) < 1e-9) return null;

    const t = ((cx - ax) * cdy - (cy - ay) * cdx) / det;

    return {
        x: ax + t * abx,
        y: ay + t * aby,
    };
}

function pointInPolygonWithHoles(px: number, py: number, obj: PolyObject) {
    const points = obj.points ?? [];
    if (points.length < 6) return false;

    let inside = false;
    for (let i = 0, j = points.length - 2; i < points.length; i += 2) {
        const xi = points[i], yi = points[i + 1];
        const xj = points[j], yj = points[j + 1];

        const intersect =
            ((yi > py) !== (yj > py)) &&
            (px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi);

        if (intersect) inside = !inside;
        j = i;
    }

    if (!inside) return false;

    const holes = obj.holes ?? [];
    for (const hole of holes) {
        let inHole = false;
        for (let i = 0, j = hole.length - 2; i < hole.length; i += 2) {
            const xi = hole[i], yi = hole[i + 1];
            const xj = hole[j], yj = hole[j + 1];

            const intersect =
                ((yi > py) !== (yj > py)) &&
                (px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi);

            if (intersect) inHole = !inHole;
            j = i;
        }

        if (inHole) return false;
    }

    return true;
}

function inferPolylineRenderSide(
    points: number[],
    type: ObjectType,
    objects: PolyObject[],
    fallback: 1 | -1 = 1
): 1 | -1 {
    if (!points || points.length < 4) return fallback;
    if (type !== "fence" && type !== "gate") return fallback;

    const blockers = objects.filter(
        (o) => o.type !== "fence" && o.type !== "gate" && o.points && o.points.length >= 6
    );

    if (blockers.length === 0) return fallback;

    const sampleOffset = getLineStrokeWidth(type) / 2 + 4;

    let leftScore = 0;
    let rightScore = 0;

    for (let i = 0; i <= points.length - 4; i += 2) {
        const ax = points[i];
        const ay = points[i + 1];
        const bx = points[i + 2];
        const by = points[i + 3];

        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);

        if (len < 1e-9) continue;

        const nx = -dy / len;
        const ny = dx / len;

        const mx = (ax + bx) * 0.5;
        const my = (ay + by) * 0.5;

        const leftX = mx + nx * sampleOffset;
        const leftY = my + ny * sampleOffset;
        const rightX = mx - nx * sampleOffset;
        const rightY = my - ny * sampleOffset;

        let leftHit = false;
        let rightHit = false;

        for (const blocker of blockers) {
            if (!leftHit && pointInPolygonWithHoles(leftX, leftY, blocker)) leftHit = true;
            if (!rightHit && pointInPolygonWithHoles(rightX, rightY, blocker)) rightHit = true;
            if (leftHit && rightHit) break;
        }

        if (leftHit) leftScore += len;
        if (rightHit) rightScore += len;
    }

    if (leftScore === rightScore) return fallback;

    return leftScore > rightScore ? -1 : 1;
}

function getOneSidedPolylineRenderPoints(
    points: number[],
    strokeWidth: number,
    side: 1 | -1 = 1
) {
    if (!points || points.length < 4) return points;

    const pointCount = points.length / 2;
    if (pointCount < 2) return points;

    const offset = (strokeWidth / 2) * side;

    const getPoint = (index: number) => ({
        x: points[index * 2],
        y: points[index * 2 + 1],
    });

    const normals: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < pointCount - 1; i++) {
        const a = getPoint(i);
        const b = getPoint(i + 1);

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);

        if (len < 1e-9) {
            normals.push({ x: 0, y: 0 });
            continue;
        }

        normals.push({
            x: -dy / len,
            y: dx / len,
        });
    }

    const out: number[] = [];

    for (let i = 0; i < pointCount; i++) {
        const p = getPoint(i);

        if (i === 0) {
            const n = normals[0];
            out.push(p.x + n.x * offset, p.y + n.y * offset);
            continue;
        }

        if (i === pointCount - 1) {
            const n = normals[normals.length - 1];
            out.push(p.x + n.x * offset, p.y + n.y * offset);
            continue;
        }

        const prev = normals[i - 1];
        const next = normals[i];

        const prevPoint = getPoint(i - 1);
        const nextPoint = getPoint(i + 1);

        const a1x = prevPoint.x + prev.x * offset;
        const a1y = prevPoint.y + prev.y * offset;
        const a2x = p.x + prev.x * offset;
        const a2y = p.y + prev.y * offset;

        const b1x = p.x + next.x * offset;
        const b1y = p.y + next.y * offset;
        const b2x = nextPoint.x + next.x * offset;
        const b2y = nextPoint.y + next.y * offset;

        const hit = lineIntersection(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y);

        if (hit) {
            out.push(hit.x, hit.y);
            continue;
        }

        const avgX = (prev.x + next.x) * 0.5;
        const avgY = (prev.y + next.y) * 0.5;
        out.push(p.x + avgX * offset, p.y + avgY * offset);
    }

    return out;
}

// ==============================
// ✅ Fence/Gate merge (alleen endpoints)
// ==============================
function reversePolylinePoints(points: number[]) {
    const out: number[] = [];
    for (let i = points.length - 2; i >= 0; i -= 2) {
        out.push(points[i], points[i + 1]);
    }
    return out;
}

function samePoint(ax: number, ay: number, bx: number, by: number) {
    return ax === bx && ay === by;
}

function mergeFenceOrGateEndpoints(
    type: "fence" | "gate",
    newPoints: number[],
    objects: PolyObject[]
) {
    let merged = [...newPoints];
    const removeIds: string[] = [];

    // herhaal: na 1 merge kan er weer een endpoint-match ontstaan
    while (true) {
        const nsx = merged[0], nsy = merged[1];
        const nex = merged[merged.length - 2], ney = merged[merged.length - 1];

        // zoek 1 match (eerste die past)
        const hit = objects.find((o) => o.type === type && !removeIds.includes(o.id));
        if (!hit) break;

        let didMerge = false;

        for (const o of objects) {
            if (o.type !== type) continue;
            if (removeIds.includes(o.id)) continue;

            const op = o.points;
            if (!op || op.length < 4) continue;

            const osx = op[0], osy = op[1];
            const oex = op[op.length - 2], oey = op[op.length - 1];

            // CASE 1: newEnd == oldStart  => merged = new + old(omit first point)
            if (samePoint(nex, ney, osx, osy)) {
                merged = merged.concat(op.slice(2));
                removeIds.push(o.id);
                didMerge = true;
                break;
            }

            // CASE 2: newEnd == oldEnd    => reverse old, then concat
            if (samePoint(nex, ney, oex, oey)) {
                const ro = reversePolylinePoints(op);
                merged = merged.concat(ro.slice(2));
                removeIds.push(o.id);
                didMerge = true;
                break;
            }

            // CASE 3: newStart == oldEnd  => merged = old + new(omit first point)
            if (samePoint(nsx, nsy, oex, oey)) {
                merged = op.concat(merged.slice(2));
                removeIds.push(o.id);
                didMerge = true;
                break;
            }

            // CASE 4: newStart == oldStart => reverse old, then old + new
            if (samePoint(nsx, nsy, osx, osy)) {
                const ro = reversePolylinePoints(op);
                merged = ro.concat(merged.slice(2));
                removeIds.push(o.id);
                didMerge = true;
                break;
            }
        }

        if (!didMerge) break;
    }

    return { mergedPoints: merged, removeIds };
}

function getNextSelectionIdsForToggle(
    currentSelectedIds: string[],
    selectedObjectId: string | null,
    clickedId: string
) {
    const baseIds =
        currentSelectedIds.length > 0
            ? currentSelectedIds
            : selectedObjectId
                ? [selectedObjectId]
                : [];

    if (baseIds.includes(clickedId)) {
        return baseIds.filter((id) => id !== clickedId);
    }

    return [...baseIds, clickedId];
}

export default function HelloEditor() {
    const notify = useAppNotify();
    const dismissNotification = useDismissAppNotification();

    const [isShiftHintDismissed, setIsShiftHintDismissed] = useState(false);
    const [hasUsedShiftForStraightLine, setHasUsedShiftForStraightLine] = useState(false);
    const [isRotateShiftHintDismissed, setIsRotateShiftHintDismissed] = useState(false);
    const [hasUsedShiftForRotateSnap, setHasUsedShiftForRotateSnap] = useState(false);
    const [isFenceHintDismissed, setIsFenceHintDismissed] = useState(false);
    const [compassDirection, setCompassDirection] = useState<CompassDirection>("noord");

    const dismissShiftHintForever = useCallback(() => {
        setIsShiftHintDismissed(true);
        dismissNotification("draw-shift-hint");
    }, [dismissNotification]);

    const markShiftHintAsLearned = useCallback(() => {
        setHasUsedShiftForStraightLine(true);
        dismissNotification("draw-shift-hint");
    }, [dismissNotification]);

    const dismissRotateShiftHintForever = useCallback(() => {
        setIsRotateShiftHintDismissed(true);
        dismissNotification("rotate-shift-hint");
    }, [dismissNotification]);

    const markRotateShiftHintAsLearned = useCallback(() => {
        setHasUsedShiftForRotateSnap(true);
        dismissNotification("rotate-shift-hint");
    }, [dismissNotification]);

    const stageRef = useRef<any>(null);
    const draftLineRef = useRef<any>(null);
    const draftPreviewLineRef = useRef<any>(null);
    const draftGuideLineRef = useRef<any>(null);
    const draftSecondaryGuideLineRef = useRef<any>(null);
    const lastPointerClientPosRef = useRef<{ x: number; y: number } | null>(null);
    const leftMenuShellRef = useRef<HTMLDivElement | null>(null);

    const fileMenuRef = useRef<HTMLDivElement | null>(null);
    const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
    const [isDrawingsDashboardOpen, setIsDrawingsDashboardOpen] = useState(false);
    const [isCreateDrawingOpen, setIsCreateDrawingOpen] = useState(false);
    const [createDrawingOpenSource, setCreateDrawingOpenSource] = useState<"editor" | "dashboard">("editor");

    type PersistedDrawingSnapshot = {
        objects: PolyObject[];
        plantbedLinks: Record<string, string[]>;
        viewVisibility: {
            showPlantNumbers: boolean;
            showGround: boolean;
            showBuildings: boolean;
            showBoundaries: boolean;
            showPlantbeds: boolean;
            showTreebeds: boolean;
        };
        nextPlantbedNo: number;
        compassDirection: CompassDirection;
    };

    type PersistedDrawingDocument = {
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
        schemaVersion: number;
        snapshot: PersistedDrawingSnapshot;
    };

    const DRAWINGS_STORAGE_KEY = "hello-editor:drawings:v1";
    const DRAWING_SCHEMA_VERSION = 1;

    const DEFAULT_DRAWING_VIEW_VISIBILITY: PersistedDrawingSnapshot["viewVisibility"] = {
        showPlantNumbers: true,
        showGround: true,
        showBuildings: true,
        showBoundaries: true,
        showPlantbeds: true,
        showTreebeds: true,
    };

    const clonePolyObject = useCallback((obj: PolyObject): PolyObject => {
        return {
            ...obj,
            points: [...obj.points],
            holes: obj.holes?.map((hole) => [...hole]),
            renderPieces: obj.renderPieces?.map((piece) => [...piece]),
        };
    }, []);

    const clonePlantbedLinks = useCallback((links: Record<string, string[]> = {}) => {
        return Object.fromEntries(
            Object.entries(links).map(([plantbedId, plantIds]) => [plantbedId, [...plantIds]])
        );
    }, []);

    const createEmptyDrawingSnapshot = useCallback((): PersistedDrawingSnapshot => {
        return {
            objects: [],
            plantbedLinks: {},
            viewVisibility: { ...DEFAULT_DRAWING_VIEW_VISIBILITY },
            nextPlantbedNo: 1,
            compassDirection: "noord",
        };
    }, []);

    const cloneDrawingSnapshot = useCallback(
        (snapshot: PersistedDrawingSnapshot): PersistedDrawingSnapshot => {
            return {
                objects: snapshot.objects.map(clonePolyObject),
                plantbedLinks: clonePlantbedLinks(snapshot.plantbedLinks),
                viewVisibility: {
                    ...DEFAULT_DRAWING_VIEW_VISIBILITY,
                    ...(snapshot.viewVisibility ?? {}),
                },
                nextPlantbedNo: snapshot.nextPlantbedNo ?? 1,
                compassDirection: snapshot.compassDirection ?? "noord",
            };
        },
        [clonePlantbedLinks, clonePolyObject]
    );

    const sanitizeDrawingSnapshot = useCallback(
        (value: any): PersistedDrawingSnapshot => {
            const rawObjects = Array.isArray(value?.objects) ? value.objects : [];
            const rawPlantbedLinks =
                value?.plantbedLinks && typeof value.plantbedLinks === "object"
                    ? value.plantbedLinks
                    : {};
            const rawViewVisibility =
                value?.viewVisibility && typeof value.viewVisibility === "object"
                    ? value.viewVisibility
                    : {};
            const rawNextPlantbedNo =
                typeof value?.nextPlantbedNo === "number" && Number.isFinite(value.nextPlantbedNo)
                    ? value.nextPlantbedNo
                    : 1;

            const rawCompassDirection =
                value?.compassDirection === "noord" ||
                    value?.compassDirection === "oost" ||
                    value?.compassDirection === "zuid" ||
                    value?.compassDirection === "west"
                    ? value.compassDirection
                    : "noord";

            return {
                objects: rawObjects.map((obj: PolyObject) => clonePolyObject(obj)),
                plantbedLinks: clonePlantbedLinks(rawPlantbedLinks),
                viewVisibility: {
                    ...DEFAULT_DRAWING_VIEW_VISIBILITY,
                    ...rawViewVisibility,
                },
                nextPlantbedNo: rawNextPlantbedNo,
                compassDirection: rawCompassDirection,
            };
        },
        [clonePlantbedLinks, clonePolyObject]
    );

    const sanitizeDrawingDocument = useCallback(
        (value: any): PersistedDrawingDocument | null => {
            if (!value || typeof value !== "object") return null;
            if (typeof value.id !== "string" || typeof value.name !== "string") return null;

            const trimmedName = value.name.trim();
            const nowIso = new Date().toISOString();

            return {
                id: value.id,
                name: trimmedName || "Nieuwe tekening",
                createdAt: typeof value.createdAt === "string" ? value.createdAt : nowIso,
                updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : nowIso,
                schemaVersion:
                    typeof value.schemaVersion === "number"
                        ? value.schemaVersion
                        : DRAWING_SCHEMA_VERSION,
                snapshot: sanitizeDrawingSnapshot(value.snapshot),
            };
        },
        [sanitizeDrawingSnapshot]
    );

    const getValidPlantbedIdsFromObjects = useCallback((objects: PolyObject[]) => {
        return new Set(
            objects
                .filter((obj) => obj.type === "plantbed")
                .map((obj) => obj.id)
        );
    }, []);

    const sanitizePlantbedLinksForObjects = useCallback(
        (links: Record<string, string[]>, objects: PolyObject[]) => {
            const validPlantbedIds = getValidPlantbedIdsFromObjects(objects);
            const nextLinks: Record<string, string[]> = {};

            for (const [plantbedId, plantIds] of Object.entries(links ?? {})) {
                if (!validPlantbedIds.has(plantbedId)) continue;
                if (!Array.isArray(plantIds) || plantIds.length === 0) continue;

                const dedupedPlantIds = Array.from(
                    new Set(
                        plantIds.filter(
                            (plantId): plantId is string =>
                                typeof plantId === "string" && plantId.trim().length > 0
                        )
                    )
                );

                if (dedupedPlantIds.length === 0) continue;
                nextLinks[plantbedId] = dedupedPlantIds;
            }

            return nextLinks;
        },
        [getValidPlantbedIdsFromObjects]
    );

    const buildPlantbedLinkedCountFromLinks = useCallback((links: Record<string, string[]>) => {
        return Object.fromEntries(
            Object.entries(links).map(([plantbedId, plantIds]) => [
                plantbedId,
                Array.isArray(plantIds) ? plantIds.length : 0,
            ])
        );
    }, []);

    const exportSnapshotFromStore = useCallback((): PersistedDrawingSnapshot => {
        const state = useProjectStore.getState() as any;
        const safeObjects = (state.objects as PolyObject[]).map(clonePolyObject);
        const safeLinks = sanitizePlantbedLinksForObjects(
            clonePlantbedLinks(state.plantbedLinks ?? {}),
            safeObjects
        );

        return {
            objects: safeObjects,
            plantbedLinks: safeLinks,
            viewVisibility: {
                ...DEFAULT_DRAWING_VIEW_VISIBILITY,
                ...(state.viewVisibility ?? {}),
            },
            nextPlantbedNo: typeof state.nextPlantbedNo === "number" ? state.nextPlantbedNo : 1,
            compassDirection,
        };
    }, [
        clonePlantbedLinks,
        clonePolyObject,
        sanitizePlantbedLinksForObjects,
        compassDirection,
    ]);

    const loadSnapshotIntoStore = useCallback(
        (snapshot: PersistedDrawingSnapshot | null | undefined) => {
            const safeSnapshot = snapshot
                ? cloneDrawingSnapshot(snapshot)
                : createEmptyDrawingSnapshot();

            const nextObjects = safeSnapshot.objects.map(clonePolyObject);
            const nextLinks = sanitizePlantbedLinksForObjects(
                clonePlantbedLinks(safeSnapshot.plantbedLinks),
                nextObjects
            );
            const nextCounts = buildPlantbedLinkedCountFromLinks(nextLinks);

            useProjectStore.setState({
                objects: nextObjects,
                plantbedLinks: nextLinks,
                plantbedLinkedCount: nextCounts,
                nextPlantbedNo: safeSnapshot.nextPlantbedNo ?? 1,
                viewVisibility: {
                    ...DEFAULT_DRAWING_VIEW_VISIBILITY,
                    ...safeSnapshot.viewVisibility,
                },
                selectedObjectId: null,
                selectedObjectIds: [],
                undoStack: [],
                redoStack: [],
                confirmModal: null,
            });

            setCompassDirection(safeSnapshot.compassDirection ?? "noord");
        },
        [
            buildPlantbedLinkedCountFromLinks,
            cloneDrawingSnapshot,
            clonePlantbedLinks,
            clonePolyObject,
            createEmptyDrawingSnapshot,
            sanitizePlantbedLinksForObjects,
            setCompassDirection,
        ]
    );

    const createDrawingDocument = useCallback(
        (name: string, snapshot?: PersistedDrawingSnapshot): PersistedDrawingDocument => {
            const nowIso = new Date().toISOString();

            return {
                id: `drawing-${Date.now()}`,
                name: name.trim(),
                createdAt: nowIso,
                updatedAt: nowIso,
                schemaVersion: DRAWING_SCHEMA_VERSION,
                snapshot: snapshot
                    ? cloneDrawingSnapshot(snapshot)
                    : createEmptyDrawingSnapshot(),
            };
        },
        [cloneDrawingSnapshot, createEmptyDrawingSnapshot]
    );

    function getCurrentDateTimeLabel(date: string | null): string {
        if (!date) return "";

        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return "";

        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();

        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");

        return `${day}-${month}-${year}, ${hours}:${minutes}`;
    }

    function getRelativeUpdatedAtLabel(date: string | null): string {
        if (!date) return "";

        const now = new Date();
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return "";

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfTargetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        const diffMs = startOfToday.getTime() - startOfTargetDay.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");

        if (diffDays === 0) {
            return `Laatst gewijzigd vandaag om ${hours}:${minutes}`;
        }

        if (diffDays === 1) {
            return `Laatst gewijzigd gisteren om ${hours}:${minutes}`;
        }

        if (diffDays >= 2 && diffDays <= 3) {
            return `Laatst gewijzigd ${diffDays} dagen geleden`;
        }

        return `Laatst gewijzigd op ${getCurrentDateTimeLabel(date)}`;
    }

    const [editorDrawings, setEditorDrawings] = useState<PersistedDrawingDocument[]>([]);
    const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);
    const [isDrawingsHydrated, setIsDrawingsHydrated] = useState(false);
    const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");

    const autosaveTimerRef = useRef<number | null>(null);
    const isRestoringDrawingRef = useRef(false);

    const activeDrawing = useMemo(() => {
        return editorDrawings.find((drawing) => drawing.id === activeDrawingId) ?? null;
    }, [editorDrawings, activeDrawingId]);

    const handleOpenDrawingsDashboard = useCallback(() => {
        setIsFileMenuOpen(false);
        setIsCreateDrawingOpen(false);
        setIsDrawingsDashboardOpen(true);
    }, []);

    const handleOpenCreateDrawingModal = useCallback((source: "editor" | "dashboard") => {
        setCreateDrawingOpenSource(source);
        setIsFileMenuOpen(false);
        setIsDrawingsDashboardOpen(false);
        setIsCreateDrawingOpen(true);
    }, []);

    const handleCloseDrawingsDashboard = useCallback(() => {
        setIsDrawingsDashboardOpen(false);
    }, []);

    const handleOpenDrawingFromDashboard = useCallback((drawingId: string) => {
        const drawing = editorDrawings.find((item) => item.id === drawingId);
        if (!drawing) return;

        isRestoringDrawingRef.current = true;
        loadSnapshotIntoStore(drawing.snapshot);
        setActiveDrawingId(drawingId);
        setSaveState("saved");
        setIsCreateDrawingOpen(false);
        setIsDrawingsDashboardOpen(false);
        setIsFileMenuOpen(false);
    }, [editorDrawings, loadSnapshotIntoStore]);

    const handleCreateDrawingFromDashboard = useCallback((name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;

        const nextDrawing = createDrawingDocument(trimmed);

        setEditorDrawings((prev) => [...prev, nextDrawing]);

        isRestoringDrawingRef.current = true;
        loadSnapshotIntoStore(nextDrawing.snapshot);
        setActiveDrawingId(nextDrawing.id);
        setSaveState("saved");
        setIsCreateDrawingOpen(false);
        setIsDrawingsDashboardOpen(false);
        setIsFileMenuOpen(false);
    }, [createDrawingDocument, loadSnapshotIntoStore]);

    const handleDuplicateDrawingFromDashboard = useCallback((drawingId: string) => {
        setEditorDrawings((prev) => {
            const source = prev.find((drawing) => drawing.id === drawingId);
            if (!source) return prev;

            const baseName = source.name.trim();

            const escapeRegExp = (value: string) =>
                value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            const duplicatePattern = new RegExp(
                `^${escapeRegExp(baseName)} kopie(?: (\\d+))?$`,
                "i"
            );

            const usedNumbers = prev
                .map((drawing) => {
                    const match = drawing.name.trim().match(duplicatePattern);
                    if (!match) return null;
                    return match[1] ? Number(match[1]) : 1;
                })
                .filter((value): value is number => value !== null);

            const nextCopyNumber =
                usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;

            const duplicateName =
                nextCopyNumber === 1
                    ? `${baseName} kopie`
                    : `${baseName} kopie ${nextCopyNumber}`;

            const duplicatedDrawing: PersistedDrawingDocument = {
                ...source,
                id: `drawing-${Date.now()}`,
                name: duplicateName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                snapshot: cloneDrawingSnapshot(source.snapshot),
            };

            return [...prev, duplicatedDrawing];
        });
    }, [cloneDrawingSnapshot]);

    const handleDeleteDrawingFromDashboard = useCallback((drawingId: string) => {
        const nextDrawings = editorDrawings.filter((drawing) => drawing.id !== drawingId);

        setEditorDrawings(nextDrawings);

        if (nextDrawings.length === 0) {
            isRestoringDrawingRef.current = true;
            loadSnapshotIntoStore(createEmptyDrawingSnapshot());
            setActiveDrawingId(null);
            setSaveState("saved");
            setIsDrawingsDashboardOpen(true);
            return;
        }

        if (drawingId === activeDrawingId) {
            const fallbackDrawing = nextDrawings[0];
            isRestoringDrawingRef.current = true;
            loadSnapshotIntoStore(fallbackDrawing.snapshot);
            setActiveDrawingId(fallbackDrawing.id);
            setSaveState("saved");
        }
    }, [activeDrawingId, createEmptyDrawingSnapshot, editorDrawings, loadSnapshotIntoStore]);

    const handleRenameDrawingFromDashboard = useCallback((drawingId: string, nextName: string) => {
        const nowIso = new Date().toISOString();

        setEditorDrawings((prev) =>
            prev.map((drawing) =>
                drawing.id === drawingId
                    ? { ...drawing, name: nextName, updatedAt: nowIso }
                    : drawing
            )
        );
    }, []);

    const handleManualSaveActiveDrawing = useCallback(() => {
        if (!activeDrawingId) return;

        const nextSnapshot = exportSnapshotFromStore();
        const nowIso = new Date().toISOString();

        setSaveState("saving");

        setEditorDrawings((prev) =>
            prev.map((drawing) =>
                drawing.id === activeDrawingId
                    ? {
                        ...drawing,
                        updatedAt: nowIso,
                        snapshot: nextSnapshot,
                    }
                    : drawing
            )
        );

        window.setTimeout(() => {
            setSaveState("saved");
        }, 0);
    }, [activeDrawingId, exportSnapshotFromStore]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        try {
            const raw = window.localStorage.getItem(DRAWINGS_STORAGE_KEY);

            if (!raw) {
                isRestoringDrawingRef.current = true;
                loadSnapshotIntoStore(createEmptyDrawingSnapshot());
                setEditorDrawings([]);
                setActiveDrawingId(null);
                setSaveState("saved");
                setIsDrawingsDashboardOpen(true);
                setIsDrawingsHydrated(true);
                return;
            }

            const parsed = JSON.parse(raw);
            const rawDrawings = Array.isArray(parsed?.drawings) ? parsed.drawings : [];

            const nextDrawings: PersistedDrawingDocument[] = rawDrawings
                .map((item: any) => sanitizeDrawingDocument(item))
                .filter((item: PersistedDrawingDocument | null): item is PersistedDrawingDocument => item !== null);

            if (nextDrawings.length === 0) {
                isRestoringDrawingRef.current = true;
                loadSnapshotIntoStore(createEmptyDrawingSnapshot());
                setEditorDrawings([]);
                setActiveDrawingId(null);
                setSaveState("saved");
                setIsDrawingsDashboardOpen(true);
                setIsDrawingsHydrated(true);
                return;
            }

            const restoredActiveDrawingId =
                typeof parsed?.activeDrawingId === "string" &&
                    nextDrawings.some((drawing: PersistedDrawingDocument) => drawing.id === parsed.activeDrawingId)
                    ? parsed.activeDrawingId
                    : nextDrawings[0].id;

            const restoredDrawing =
                nextDrawings.find((drawing: PersistedDrawingDocument) => drawing.id === restoredActiveDrawingId) ??
                nextDrawings[0];

            setEditorDrawings(nextDrawings);
            setActiveDrawingId(restoredDrawing.id);

            isRestoringDrawingRef.current = true;
            loadSnapshotIntoStore(restoredDrawing.snapshot);

            setSaveState("saved");
            setIsDrawingsDashboardOpen(false);
            setIsDrawingsHydrated(true);
        } catch {
            isRestoringDrawingRef.current = true;
            loadSnapshotIntoStore(createEmptyDrawingSnapshot());
            setEditorDrawings([]);
            setActiveDrawingId(null);
            setSaveState("saved");
            setIsDrawingsDashboardOpen(true);
            setIsDrawingsHydrated(true);
        }
    }, [
        createEmptyDrawingSnapshot,
        loadSnapshotIntoStore,
        sanitizeDrawingDocument,
    ]);

    useEffect(() => {
        if (!isDrawingsHydrated || typeof window === "undefined") return;

        window.localStorage.setItem(
            DRAWINGS_STORAGE_KEY,
            JSON.stringify({
                drawings: editorDrawings,
                activeDrawingId,
            })
        );
    }, [activeDrawingId, editorDrawings, isDrawingsHydrated]);

    const getPlantbedLinkedCount = useProjectStore((s: any) => s.getPlantbedLinkedCount);
    const [topLeftNoticeLeft, setTopLeftNoticeLeft] = useState(0);

    // Viewport
    // Viewport
    const [stageScale, setStageScale] = useState(BASE_SCALE);
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
    const PAN_LIMIT = 3000;

    const showCenterButton =
        Math.abs(stagePos.x) > PAN_LIMIT ||
        Math.abs(stagePos.y) > PAN_LIMIT;

    // Refs (stale-closure proof)
    const stageScaleRef = useRef(stageScale);
    const stagePosRef = useRef(stagePos);
    useEffect(() => void (stageScaleRef.current = stageScale), [stageScale]);
    useEffect(() => void (stagePosRef.current = stagePos), [stagePos]);

    const viewportRafRef = useRef<number | null>(null);
    const pendingViewportRef = useRef<{ scale: number; pos: { x: number; y: number } } | null>(null);

    const flushViewportState = useCallback(() => {
        viewportRafRef.current = null;

        const next = pendingViewportRef.current;
        if (!next) return;

        pendingViewportRef.current = null;
        setStageScale(next.scale);
        setStagePos(next.pos);
    }, []);

    const scheduleViewportState = useCallback((next: {
        scale?: number;
        pos?: { x: number; y: number };
    }) => {
        const resolvedScale = next.scale ?? stageScaleRef.current;
        const resolvedPos = next.pos ?? stagePosRef.current;

        stageScaleRef.current = resolvedScale;
        stagePosRef.current = resolvedPos;
        pendingViewportRef.current = {
            scale: resolvedScale,
            pos: resolvedPos,
        };

        const stage = stageRef.current;
        if (stage) {
            stage.scale({ x: resolvedScale, y: resolvedScale });
            stage.position(resolvedPos);
            stage.batchDraw();
        }

        if (!viewportRafRef.current) {
            viewportRafRef.current = requestAnimationFrame(flushViewportState);
        }
    }, [flushViewportState]);

    useEffect(() => {
        return () => {
            if (viewportRafRef.current) {
                cancelAnimationFrame(viewportRafRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const node = leftMenuShellRef.current;
        if (!node) return;

        const updateLeft = () => {
            const rect = node.getBoundingClientRect();
            setTopLeftNoticeLeft(rect.width + 16);
        };

        updateLeft();

        const ro = new ResizeObserver(() => updateLeft());
        ro.observe(node);

        window.addEventListener("resize", updateLeft);
        return () => {
            window.removeEventListener("resize", updateLeft);
            ro.disconnect();
        };
    }, []);
    const isShiftPressedRef = useRef(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Shift") {
                isShiftPressedRef.current = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Shift") {
                isShiftPressedRef.current = false;
            }
        };

        const handleWindowBlur = () => {
            isShiftPressedRef.current = false;
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener("blur", handleWindowBlur);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("blur", handleWindowBlur);
        };
    }, []);

    // Pan state
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef<{ x: number; y: number } | null>(null);
    const stagePosStartRef = useRef<{ x: number; y: number } | null>(null);

    const startMiddleMousePan = useCallback((evt: MouseEvent | any) => {
        evt?.preventDefault?.();

        const clientX = evt?.clientX ?? 0;
        const clientY = evt?.clientY ?? 0;

        setIsPanning(true);
        panStartRef.current = { x: clientX, y: clientY };
        stagePosStartRef.current = { ...stagePosRef.current };

        const st = stageRef.current;
        if (st) {
            st.container().style.cursor = "grabbing";
        }
    }, []);

    // Mode
    const [mode] = useState<DrawMode>("draw");

    const objects = useProjectStore((s) => s.objects);
    const plantbedLinks = useProjectStore((s: any) => s.plantbedLinks);
    const plants = useProjectStore((s: any) => s.plants);
    const getPolylineRenderPieces = useProjectStore((s: any) => s.getPolylineRenderPieces);;

    const treebedLabelBlockers = useMemo(() => {
        return buildTreebedLabelBlockers(objects as PolyObject[]);
    }, [objects]);

    const plantbedNumberLayouts = useMemo(() => {
        const layouts = new Map<string, PlantbedNumberLayout>();

        for (const obj of objects as PolyObject[]) {
            if (obj.type !== "plantbed") continue;

            layouts.set(
                obj.id,
                getPlantbedNumberLayout(
                    obj.points,
                    obj.holes ?? [],
                    obj.plantbedNo ?? 0,
                    formatSquareMeters(getObjectAreaInSquareMeters(obj)),
                    treebedLabelBlockers
                )
            );
        }

        return layouts;
    }, [objects, treebedLabelBlockers]);

    const selectObject = useProjectStore((s) => s.selectObject);
    const selectObjects = useProjectStore((s) => s.selectObjects);
    const clearSelection = useProjectStore((s) => s.clearSelection);
    const duplicateSelected = useProjectStore((s: any) => s.duplicateSelected);

    const handleDuplicateSelection = useCallback(() => {
        duplicateSelected();
    }, [duplicateSelected]);

    const handleCenterCanvas = useCallback(() => {
        scheduleViewportState({
            scale: BASE_SCALE,
            pos: { x: 0, y: 0 },
        });
    }, [scheduleViewportState]);

    const linkPlantToPlantbed = useProjectStore((s: any) => s.linkPlantToPlantbed);
    const getPlantById = useProjectStore((s: any) => s.getPlantById);
    const focusSidebarOnPlantbed = useProjectStore((s: any) => s.focusSidebarOnPlantbed);
    const canvasFocusRequest = useProjectStore((s: any) => s.canvasFocusRequest);
    const viewVisibility = useProjectStore((s: any) => s.viewVisibility);

    // ✅ Live box-select throttling (Figma-like)
    const objectsRef = useRef(objects);

    type DeletePlantbedsModalItem = {
        plantbedId: string;
        plantbedNo: number | null;
        linkedCount: number;
        plantIds: string[];
    };

    useEffect(() => {
        objectsRef.current = objects;
    }, [objects]);

    // ✅ Drag-over highlight (plantbed)
    const [dragOverPlantbedId, setDragOverPlantbedId] = useState<string | null>(null);
    const dragOverPlantbedIdRef = useRef<string | null>(null);

    useEffect(() => {
        dragOverPlantbedIdRef.current = dragOverPlantbedId;
    }, [dragOverPlantbedId]);

    const boxSelectRafRef = useRef<number | null>(null);
    const pendingBoxRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
    const lastBoxIdsKeyRef = useRef<string>("");

    const commitLiveBoxSelection = useCallback(() => {
        boxSelectRafRef.current = null;

        const rect = pendingBoxRectRef.current;
        if (!rect) return;

        const objs = objectsRef.current as PolyObject[];

        const ids = objs
            .filter((o) => rectsIntersect(rect, bboxFromPoints(o.points)))
            .filter((o) => {
                if (isFenceOrGate(o.type)) {
                    const pts = o.points;
                    if (pts.length < 4) return false;

                    for (let i = 0; i <= pts.length - 4; i += 2) {
                        const ax = pts[i], ay = pts[i + 1];
                        const bx = pts[i + 2], by = pts[i + 3];
                        if (segmentIntersectsRect(ax, ay, bx, by, rect)) return true;
                    }
                    return false;
                }

                return polyIntersectsRect(o.points, rect);
            })
            .map((o) => o.id);

        const key = ids.join("|");
        if (key === lastBoxIdsKeyRef.current) return;

        lastBoxIdsKeyRef.current = key;
        selectObjects(ids);
    }, [selectObjects]);

    const selectedObjectId = useProjectStore((s) => s.selectedObjectId);
    const selectedObjectIds = useProjectStore((s) => s.selectedObjectIds);

    const handleObjectSelection = useCallback(
        (clickedId: string, evt?: MouseEvent | PointerEvent | KeyboardEvent | any) => {
            const multi = !!(evt?.ctrlKey || evt?.metaKey);

            if (!multi) {
                selectObject(clickedId);
                return;
            }

            const nextIds = getNextSelectionIdsForToggle(
                selectedObjectIds,
                selectedObjectId,
                clickedId
            );

            if (nextIds.length === 0) {
                clearSelection();
                return;
            }

            selectObjects(nextIds);
        },
        [selectObject, selectObjects, clearSelection, selectedObjectId, selectedObjectIds]
    );

    const confirmModal = useProjectStore((s: any) => s.confirmModal);
    const closeConfirmModal = useProjectStore((s: any) => s.closeConfirmModal);
    const confirmModalPrimaryAction = useProjectStore((s: any) => s.confirmModalPrimaryAction);

    const activeTool = useProjectStore((s) => s.activeTool);
    const setActiveTool = useProjectStore((s) => s.setActiveTool);

    const activeDrawType = useProjectStore((s) => s.activeDrawType);

    const activeDrawTypeRef = useRef(activeDrawType);
    const viewVisibilityRef = useRef(viewVisibility);
    useEffect(() => void (activeDrawTypeRef.current = activeDrawType), [activeDrawType]);
    useEffect(() => void (viewVisibilityRef.current = viewVisibility), [viewVisibility]);
    const setActiveDrawType = useProjectStore((s) => s.setActiveDrawType);

    const addObject = useProjectStore((s) => s.addObject);
    const cutObjectsByPolygon = useProjectStore((s) => s.cutObjectsByPolygon);
    const moveObjectsBatch = useProjectStore((s) => s.moveObjectsBatch);
    const moveObjectAndMerge = useProjectStore((s) => s.moveObjectAndMerge);
    const moveObject = useProjectStore((s) => s.moveObject);
    const setObjectsWithHistory = useProjectStore((s: any) => s.setObjectsWithHistory);

    const requestChangeObjectType = useProjectStore((s: any) => s.requestChangeObjectType);
    const changeTreebedVariant = useProjectStore((s: any) => s.changeTreebedVariant);

    const deleteSelected = useProjectStore((s) => s.deleteSelected);

    const undoObject = useProjectStore((s) => s.undo);
    const redoObject = useProjectStore((s) => s.redo);

    useEffect(() => {
        if (!isDrawingsHydrated || !activeDrawingId) return;

        if (isRestoringDrawingRef.current) {
            isRestoringDrawingRef.current = false;
            return;
        }

        const nextSnapshot = exportSnapshotFromStore();

        setSaveState((prev) => (prev === "saving" ? prev : "unsaved"));

        if (autosaveTimerRef.current !== null) {
            window.clearTimeout(autosaveTimerRef.current);
        }

        autosaveTimerRef.current = window.setTimeout(() => {
            const nowIso = new Date().toISOString();

            setSaveState("saving");

            setEditorDrawings((prev) =>
                prev.map((drawing) =>
                    drawing.id === activeDrawingId
                        ? {
                            ...drawing,
                            updatedAt: nowIso,
                            snapshot: nextSnapshot,
                        }
                        : drawing
                )
            );

            window.setTimeout(() => {
                setSaveState("saved");
            }, 0);

            autosaveTimerRef.current = null;
        }, 250);

        return () => {
            if (autosaveTimerRef.current !== null) {
                window.clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }
        };
    }, [
        activeDrawingId,
        exportSnapshotFromStore,
        isDrawingsHydrated,
        objects,
        plantbedLinks,
        viewVisibility,
    ]);

    const saveStatusLabel = useMemo(() => {
        if (!activeDrawingId) return "Geen actieve tekening";
        if (saveState === "saving") return "Opslaan...";
        if (saveState === "unsaved") return "Niet opgeslagen wijzigingen";
        return "Opgeslagen";
    }, [activeDrawingId, saveState]);

    // -----------------------------
    // Fence/Gate helpers + dblclick guard
    // -----------------------------
    const isFenceOrGateCb = useCallback((t: any) => isFenceOrGate(t), []);

    // ✅ Eigen, strengere dubbelklik-threshold voor fence/gate
    // Lager = minder snel per ongeluk afsluiten
    const FENCE_GATE_DBLCLICK_MS = 180;

    const lastDblClickAtRef = useRef<number>(0);
    const lastDrawClickAtRef = useRef<number>(0);
    const lastDrawClickDeltaRef = useRef<number>(Infinity);

    // Draft points (React state alleen bij clicks/undo/redo -> smooth)
    const [draftPoints, setDraftPoints] = useState<number[]>([]);
    const draftPointsRef = useRef<number[]>([]);
    useEffect(() => void (draftPointsRef.current = draftPoints), [draftPoints]);
    const [draftRedoPoints, setDraftRedoPoints] = useState<number[]>([]);
    const [treebedDraftPreviewPoint, setTreebedDraftPreviewPoint] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [draftMeasurementPreviewPoint, setDraftMeasurementPreviewPoint] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [liveSelectionDragDelta, setLiveSelectionDragDelta] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [activeTreebedDrawVariant, setActiveTreebedDrawVariant] = useState<TreebedVariant>("standard");

    const translatePoints = useCallback((points: number[], dx: number, dy: number) => {
        const next: number[] = [];
        for (let i = 0; i < points.length; i += 2) {
            next.push(points[i] + dx, points[i + 1] + dy);
        }
        return next;
    }, []);

    const draftRedoPointsRef = useRef<number[]>([]);
    useEffect(() => void (draftRedoPointsRef.current = draftRedoPoints), [draftRedoPoints]);

    const [cursorCrosshairPoint, setCursorCrosshairPoint] = useState<{
        x: number;
        y: number;
    } | null>(null);

    const shouldShowCursorCrosshair =
        !isPanning &&
        ((activeTool === "draw" && activeDrawType !== null) || activeTool === "cut");

    const clearCursorCrosshair = useCallback(() => {
        setCursorCrosshairPoint((prev) => (prev === null ? prev : null));
    }, []);

    const updateCursorCrosshairPoint = useCallback(
        (rawX: number, rawY: number, targetType: ObjectType | null | undefined) => {
            const snapped = snapWorldPointAgainstFenceBoundary(
                rawX,
                rawY,
                targetType,
                objectsRef.current as PolyObject[]
            );

            setCursorCrosshairPoint((prev) => {
                if (prev && prev.x === snapped.x && prev.y === snapped.y) {
                    return prev;
                }

                return snapped;
            });
        },
        []
    );

    const updateCursorCrosshairFromStage = useCallback(
        (stage: any, targetType: ObjectType | null | undefined) => {
            const world = getPointerWorldPos(stage);
            if (!world) return;

            updateCursorCrosshairPoint(world.x, world.y, targetType);
        },
        [updateCursorCrosshairPoint]
    );

    const updateCursorCrosshairFromClient = useCallback(
        (clientX: number, clientY: number, targetType: ObjectType | null | undefined) => {
            const stage = stageRef.current;
            if (!stage) return;

            const container = stage.container?.();
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const isInsideStage =
                clientX >= rect.left &&
                clientX <= rect.right &&
                clientY >= rect.top &&
                clientY <= rect.bottom;

            if (!isInsideStage) {
                clearCursorCrosshair();
                return;
            }

            const world = getPointerWorldPosFromClient(stage, clientX, clientY);
            if (!world) return;

            updateCursorCrosshairPoint(world.x, world.y, targetType);
        },
        [clearCursorCrosshair, updateCursorCrosshairPoint]
    );

    useEffect(() => {
        if (
            (activeTool !== "draw" && activeTool !== "cut") ||
            activeDrawType === "treebed" ||
            draftPoints.length < 2
        ) {
            setDraftMeasurementPreviewPoint(null);
        }
    }, [activeTool, activeDrawType, draftPoints.length]);

    useEffect(() => {
        if (!shouldShowCursorCrosshair) {
            clearCursorCrosshair();
            return;
        }

        const lastPointer = lastPointerClientPosRef.current;
        if (!lastPointer) return;

        updateCursorCrosshairFromClient(
            lastPointer.x,
            lastPointer.y,
            activeTool === "draw" ? activeDrawType : null
        );
    }, [
        shouldShowCursorCrosshair,
        activeTool,
        activeDrawType,
        clearCursorCrosshair,
        updateCursorCrosshairFromClient,
    ]);

    const selectedObjectIdRef = useRef<string | null>(null);
    useEffect(() => void (selectedObjectIdRef.current = selectedObjectId), [selectedObjectId]);

    // Box select
    const [isBoxSelecting, setIsBoxSelecting] = useState(false);
    const boxStartRef = useRef<{ x: number; y: number } | null>(null);
    const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

    // ✅ Vertex editing (Figma-like)
    const [isVertexDragging, setIsVertexDragging] = useState(false);
    const isVertexDraggingRef = useRef(false);
    const suppressPlantbedFocusRef = useRef(false);

    const [treebedResizePreview, setTreebedResizePreview] = useState<{
        objectId: string;
        points: number[];
    } | null>(null);

    const treebedResizePreviewRef = useRef<{
        objectId: string;
        points: number[];
    } | null>(null);

    const [treebedRotatePreview, setTreebedRotatePreview] = useState<{
        objectId: string;
        points: number[];
        rotationDeg: number;
        labelX: number;
        labelY: number;
    } | null>(null);

    const treebedRotatePreviewRef = useRef<{
        objectId: string;
        points: number[];
        rotationDeg: number;
        labelX: number;
        labelY: number;
    } | null>(null);

    const treebedResizeRef = useRef<null | {
        objectId: string;
        corner: "tl" | "tr" | "br" | "bl";
        anchorX: number;
        anchorY: number;
        treebedVariant: TreebedVariant | undefined;
        rotationDeg?: number;
    }>(null);

    const treebedRotateRef = useRef<null | {
        objectId: string;
        cx: number;
        cy: number;
        startPointerAngleDeg: number;
        startRotationDeg: number;
        width: number;
        height: number;
    }>(null);

    const isTreebedResizeHandleHoveredRef = useRef(false);
    const isTreebedRotateHotspotHoveredRef = useRef(false);
    const treebedRotateCursorRef = useRef<string | null>(null);

    const startTreebedResize = useCallback(
        (
            e: any,
            obj: PolyObject,
            corner: "tl" | "tr" | "br" | "bl",
            livePoints?: number[]
        ) => {
            e.cancelBubble = true;
            e.evt?.preventDefault?.();

            const points = livePoints ?? obj.points;
            const corners = getTreebedResizeCorners(points, obj.treebedVariant);
            const visual = getTreebedVisual(points, obj.treebedVariant);

            const opposite =
                corner === "tl"
                    ? corners.br
                    : corner === "tr"
                        ? corners.bl
                        : corner === "br"
                            ? corners.tl
                            : corners.tr;

            treebedResizeRef.current = {
                objectId: obj.id,
                corner,
                anchorX: opposite.x,
                anchorY: opposite.y,
                treebedVariant: obj.treebedVariant,
                rotationDeg:
                    obj.treebedVariant === "espalier" && visual.shape === "rect"
                        ? visual.rect.rotationDeg ?? 0
                        : undefined,
            };

            const st = stageRef.current;
            if (st) {
                st.container().style.cursor =
                    corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize";
            }
        },
        []
    );

    const updateTreebedResize = useCallback(() => {
        const active = treebedResizeRef.current;
        if (!active) return;

        const stage = stageRef.current;
        if (!stage) return;

        stage.container().style.cursor =
            active.corner === "tl" || active.corner === "br" ? "nwse-resize" : "nesw-resize";

        const world = getPointerWorldPos(stage);
        if (!world) return;

        const nextPoints =
            active.treebedVariant === "espalier"
                ? createEspalierPointsFromRotatedCornerDrag(
                    active.anchorX,
                    active.anchorY,
                    world.x,
                    world.y,
                    active.corner,
                    active.rotationDeg ?? 0
                )
                : createTreebedPointsFromCornerDrag(
                    active.anchorX,
                    active.anchorY,
                    world.x,
                    world.y,
                    active.corner,
                    active.treebedVariant
                );

        const nextPreview = {
            objectId: active.objectId,
            points: nextPoints,
        };

        treebedResizePreviewRef.current = nextPreview;
        setTreebedResizePreview(nextPreview);
    }, []);

    const finishTreebedResize = useCallback(() => {
        const active = treebedResizeRef.current;
        if (!active) return;

        const preview = treebedResizePreviewRef.current;
        treebedResizeRef.current = null;
        treebedResizePreviewRef.current = null;
        isTreebedResizeHandleHoveredRef.current = false;

        const st = stageRef.current;
        if (st) {
            st.container().style.cursor = isPanning ? "grabbing" : "default";
        }

        if (!preview || preview.objectId !== active.objectId) {
            setTreebedResizePreview(null);
            return;
        }

        moveObject(active.objectId, preview.points);
        setTreebedResizePreview(null);
    }, [isPanning, moveObject]);

    const startTreebedRotate = useCallback((obj: PolyObject) => {
        if (obj.type !== "treebed" || obj.treebedVariant !== "espalier") return;

        const stage = stageRef.current;
        if (!stage) return;

        const world = getPointerWorldPos(stage);
        if (!world) return;

        const visual = getTreebedVisual(obj.points, obj.treebedVariant);
        if (visual.shape !== "rect") return;

        isTreebedRotateHotspotHoveredRef.current = true;

        const rotateCursor = getTreebedRotateCursorFromPoint(
            visual.cx,
            visual.cy,
            world.x,
            world.y
        );
        treebedRotateCursorRef.current = rotateCursor;

        treebedRotateRef.current = {
            objectId: obj.id,
            cx: visual.cx,
            cy: visual.cy,
            startPointerAngleDeg: (Math.atan2(world.y - visual.cy, world.x - visual.cx) * 180) / Math.PI,
            startRotationDeg: visual.rect.rotationDeg ?? 0,
            width: visual.rect.w,
            height: visual.rect.h,
        };

        if (
            !isShiftPressedRef.current &&
            !isRotateShiftHintDismissed &&
            !hasUsedShiftForRotateSnap
        ) {
            notify(APP_NOTIFICATIONS.holdShiftForRotateSnap(dismissRotateShiftHintForever));
        }

        stage.container().style.cursor = rotateCursor;
    }, [
        notify,
        isRotateShiftHintDismissed,
        hasUsedShiftForRotateSnap,
        dismissRotateShiftHintForever,
    ]);

    const updateTreebedRotate = useCallback(() => {
        const active = treebedRotateRef.current;
        if (!active) return;

        const stage = stageRef.current;
        if (!stage) return;

        const world = getPointerWorldPos(stage);
        if (!world) return;

        const currentPointerAngleDeg =
            (Math.atan2(world.y - active.cy, world.x - active.cx) * 180) / Math.PI;

        let nextRotationDeg = normalizeRotationDeg(
            active.startRotationDeg + (currentPointerAngleDeg - active.startPointerAngleDeg)
        );

        if (isShiftPressedRef.current) {
            if (!hasUsedShiftForRotateSnap) {
                markRotateShiftHintAsLearned();
            }

            const ROTATE_SNAP_STEP = 15;
            nextRotationDeg = normalizeRotationDeg(
                Math.round(nextRotationDeg / ROTATE_SNAP_STEP) * ROTATE_SNAP_STEP
            );
        }

        const nextPreview = {
            objectId: active.objectId,
            points: createRotatedTreebedRectPoints(
                active.cx,
                active.cy,
                active.width,
                active.height,
                nextRotationDeg
            ),
            rotationDeg: nextRotationDeg,
            labelX: active.cx,
            labelY: active.cy + active.height / 2 + 38,
        };
        treebedRotatePreviewRef.current = nextPreview;
        setTreebedRotatePreview(nextPreview);

        const rotateCursor = getTreebedRotateCursorFromPoint(
            active.cx,
            active.cy,
            world.x,
            world.y
        );
        treebedRotateCursorRef.current = rotateCursor;
        stage.container().style.cursor = rotateCursor;
    }, [hasUsedShiftForRotateSnap, markRotateShiftHintAsLearned]);

    const finishTreebedRotate = useCallback(() => {
        const active = treebedRotateRef.current;
        if (!active) return;

        const preview = treebedRotatePreviewRef.current;
        treebedRotateRef.current = null;
        treebedRotatePreviewRef.current = null;
        isTreebedRotateHotspotHoveredRef.current = false;
        treebedRotateCursorRef.current = null;

        const st = stageRef.current;
        if (st) {
            st.container().style.cursor = isPanning ? "grabbing" : "default";
        }

        if (!preview || preview.objectId !== active.objectId) {
            setTreebedRotatePreview(null);
            return;
        }

        moveObject(active.objectId, preview.points);
        setTreebedRotatePreview(null);
    }, [isPanning, moveObject]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            lastPointerClientPosRef.current = {
                x: e.clientX,
                y: e.clientY,
            };

            if (shouldShowCursorCrosshair) {
                updateCursorCrosshairFromClient(
                    e.clientX,
                    e.clientY,
                    activeTool === "draw" ? activeDrawType : null
                );
            } else {
                clearCursorCrosshair();
            }

            if (treebedResizeRef.current) {
                updateTreebedResize();
                return;
            }

            if (treebedRotateRef.current) {
                updateTreebedRotate();
            }
        };

        const handleMouseUp = () => {
            if (treebedResizeRef.current) {
                finishTreebedResize();
                return;
            }

            if (treebedRotateRef.current) {
                finishTreebedRotate();
            }
        };

        const handleWindowBlur = () => {
            clearCursorCrosshair();
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("blur", handleWindowBlur);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("blur", handleWindowBlur);
        };
    }, [
        finishTreebedResize,
        updateTreebedResize,
        finishTreebedRotate,
        updateTreebedRotate,
        shouldShowCursorCrosshair,
        activeTool,
        activeDrawType,
        updateCursorCrosshairFromClient,
        clearCursorCrosshair,
    ]);

    // ✅ Force React rerender tijdens vertex-drag (alleen nodig voor fence/gate corridor pieces)
    const [vertexDragTick, setVertexDragTick] = useState(0);
    const vertexDragRafRef = useRef<number | null>(null);
    const requestVertexDragRerender = useCallback(() => {
        if (vertexDragRafRef.current) return;
        vertexDragRafRef.current = requestAnimationFrame(() => {
            vertexDragRafRef.current = null;
            setVertexDragTick((t) => t + 1);
        });
    }, []);

    // ✅ Plantvak “echte klik” detectie (mousedown -> mouseup zonder drag)
    const pendingPlantbedClickRef = useRef<{
        id: string;
        startClientX: number;
        startClientY: number;
    } | null>(null);

    const plantbedClickMovedRef = useRef(false);
    const clickStartPosRef = useRef<{ x: number; y: number } | null>(null);

    const vertexEditRef = useRef<{
        objectId: string;
        vertexIndex: number; // index in actieve ring (0..n-2 step 2)
        holeIndex: number | null; // null = outer ring, anders index in holes[]
        workingPoints: number[];
        workingHoles?: number[][];
    } | null>(null);

    const [isEdgeResizing, setIsEdgeResizing] = useState(false);
    const isEdgeResizingRef = useRef(false);
    const isResizeEdgeHoveredRef = useRef(false);

    const edgeResizeRef = useRef<{
        objectId: string;
        edgeIndex: number;
        orientation: "vertical" | "horizontal";
        holeIndex: number | null; // null = outer ring, anders holes[index]
        workingPoints: number[];
        workingHoles?: number[][];
    } | null>(null);

    // ✅ Force rerender tijdens edge resize zodat outline + vertex bolletjes live meebewegen
    const [edgeResizeTick, setEdgeResizeTick] = useState(0);
    const edgeResizeRafRef = useRef<number | null>(null);
    const requestEdgeResizeRerender = useCallback(() => {
        if (edgeResizeRafRef.current) return;
        edgeResizeRafRef.current = requestAnimationFrame(() => {
            edgeResizeRafRef.current = null;
            setEdgeResizeTick((t) => t + 1);
        });
    }, []);

    const livePrimaryMeasurementObject = useMemo<PolyObject | null>(() => {
        if (!selectedObjectId) return null;

        const baseObject =
            (objects as PolyObject[]).find((object) => object.id === selectedObjectId) ?? null;

        if (!baseObject) return null;

        if (
            treebedRotatePreview?.objectId === baseObject.id &&
            Array.isArray(treebedRotatePreview.points) &&
            treebedRotatePreview.points.length >= 6
        ) {
            return {
                ...baseObject,
                points: treebedRotatePreview.points,
            };
        }

        if (
            treebedResizePreview?.objectId === baseObject.id &&
            Array.isArray(treebedResizePreview.points) &&
            treebedResizePreview.points.length >= 6
        ) {
            return {
                ...baseObject,
                points: treebedResizePreview.points,
            };
        }

        if (
            isVertexDraggingRef.current &&
            vertexEditRef.current?.objectId === baseObject.id &&
            Array.isArray(vertexEditRef.current.workingPoints) &&
            vertexEditRef.current.workingPoints.length >= 6
        ) {
            return {
                ...baseObject,
                points: vertexEditRef.current.workingPoints,
                holes: vertexEditRef.current.workingHoles ?? baseObject.holes ?? [],
            };
        }

        if (
            isEdgeResizingRef.current &&
            edgeResizeRef.current?.objectId === baseObject.id &&
            Array.isArray(edgeResizeRef.current.workingPoints) &&
            edgeResizeRef.current.workingPoints.length >= 6
        ) {
            return {
                ...baseObject,
                points: edgeResizeRef.current.workingPoints,
                holes: edgeResizeRef.current.workingHoles ?? baseObject.holes ?? [],
            };
        }

        return baseObject;
    }, [
        objects,
        selectedObjectId,
        treebedResizePreview,
        treebedRotatePreview,
        vertexDragTick,
        edgeResizeTick,
    ]);

    const livePlantbedNumberLayouts = useMemo(() => {
        const layouts = new Map(plantbedNumberLayouts);

        if (livePrimaryMeasurementObject?.type !== "plantbed") {
            return layouts;
        }

        layouts.set(
            livePrimaryMeasurementObject.id,
            getPlantbedNumberLayout(
                livePrimaryMeasurementObject.points,
                livePrimaryMeasurementObject.holes ?? [],
                livePrimaryMeasurementObject.plantbedNo ?? 0,
                formatSquareMeters(getObjectAreaInSquareMeters(livePrimaryMeasurementObject)),
                treebedLabelBlockers
            )
        );

        return layouts;
    }, [plantbedNumberLayouts, livePrimaryMeasurementObject, treebedLabelBlockers]);

    const selectedLineRefs = useRef<Record<string, any>>({});
    const vertexHandleRefs = useRef<Record<string, Record<string, any>>>({});
    const activeVertexIndexRef = useRef<number | null>(null);

    const NOTICE_FADE_MS = 250;

    // ==============================
    // ✅ Fence/Gate hint blijft lokaal, want dit is geen algemene app-notificatie
    // ==============================
    const [fenceHint, setFenceHint] = useState<{ msg: string; dismissible?: boolean } | null>(null);
    const [fenceHintVisible, setFenceHintVisible] = useState(false);

    const fenceHintTimerRef = useRef<number | null>(null);
    const fenceHintRaf1Ref = useRef<number | null>(null);
    const fenceHintRaf2Ref = useRef<number | null>(null);

    const lastFenceHintMsgRef = useRef<string>("");

    const showFenceHint = useCallback((msg: string) => {
        setFenceHint({ msg, dismissible: true });
        setFenceHintVisible(false);

        if (fenceHintTimerRef.current) window.clearTimeout(fenceHintTimerRef.current);
        if (fenceHintRaf1Ref.current) cancelAnimationFrame(fenceHintRaf1Ref.current);
        if (fenceHintRaf2Ref.current) cancelAnimationFrame(fenceHintRaf2Ref.current);

        fenceHintRaf1Ref.current = requestAnimationFrame(() => {
            fenceHintRaf2Ref.current = requestAnimationFrame(() => {
                setFenceHintVisible(true);
                fenceHintRaf2Ref.current = null;
            });
            fenceHintRaf1Ref.current = null;
        });
    }, []);

    const hideFenceHint = useCallback(() => {
        setFenceHintVisible(false);

        if (fenceHintTimerRef.current) window.clearTimeout(fenceHintTimerRef.current);

        fenceHintTimerRef.current = window.setTimeout(() => {
            setFenceHint(null);
        }, NOTICE_FADE_MS);
    }, []);

    const dismissFenceHintForever = useCallback(() => {
        setIsFenceHintDismissed(true);
        lastFenceHintMsgRef.current = "";
        hideFenceHint();
    }, [hideFenceHint]);

    useEffect(() => {
        const isDrawingFence =
            activeTool === "draw" &&
            (activeDrawType === "fence" || activeDrawType === "gate") &&
            draftPoints.length >= 2 &&
            !isFenceHintDismissed;

        if (isDrawingFence) {
            const label = activeDrawType === "gate" ? "hek" : "schutting";
            const msg = `Dubbelklik om de ${label} te voltooien`;

            if (lastFenceHintMsgRef.current !== msg) {
                lastFenceHintMsgRef.current = msg;
                showFenceHint(msg);
            }
            return;
        }

        if (lastFenceHintMsgRef.current) {
            lastFenceHintMsgRef.current = "";
            hideFenceHint();
        }
    }, [activeTool, activeDrawType, draftPoints.length, isFenceHintDismissed, showFenceHint, hideFenceHint]);

    useEffect(() => {
        const shouldShowShiftHint =
            activeTool === "draw" &&
            !!activeDrawType &&
            !isFenceOrGate(activeDrawType) &&
            activeDrawType !== "treebed" &&
            draftPoints.length >= 2 &&
            !isShiftHintDismissed &&
            !hasUsedShiftForStraightLine;

        if (shouldShowShiftHint) {
            notify(APP_NOTIFICATIONS.holdShiftForStraightLines(dismissShiftHintForever));
            return;
        }

        dismissNotification("draw-shift-hint");
    }, [
        activeTool,
        activeDrawType,
        draftPoints.length,
        isShiftHintDismissed,
        hasUsedShiftForStraightLine,
        notify,
        dismissNotification,
        dismissShiftHintForever,
    ]);

    useEffect(() => {
        const shouldShowDuplicateHint =
            activeTool === "select" &&
            selectedObjectIds.length > 1;

        if (shouldShowDuplicateHint) {
            notify(
                APP_NOTIFICATIONS.duplicatedSelection(() => {
                    handleDuplicateSelection();
                })
            );
            return;
        }

        dismissNotification("duplicate-selection-hint");
    }, [activeTool, selectedObjectIds.length, notify, dismissNotification, handleDuplicateSelection]);

    useEffect(() => {
        if (showCenterButton) {
            notify(
                APP_NOTIFICATIONS.centeredCanvas(() => {
                    handleCenterCanvas();
                })
            );
            return;
        }

        dismissNotification("center-canvas-hint");
    }, [showCenterButton, notify, dismissNotification, handleCenterCanvas]);

    useEffect(() => {
        const isRotatingTreebed = !!treebedRotateRef.current;

        if (isRotatingTreebed) {
            return;
        }

        dismissNotification("rotate-shift-hint");
    });

    const HINT_MARGIN = 16;
    // ⚠️ Pas deze aan als jouw linker menu breder/smaller is:
    const LEFT_MENU_WIDTH = 260;

    useEffect(() => {
        return () => {
            dismissNotification("draw-shift-hint");
            dismissNotification("rotate-shift-hint");

            if (fenceHintTimerRef.current) window.clearTimeout(fenceHintTimerRef.current);
            if (fenceHintRaf1Ref.current) cancelAnimationFrame(fenceHintRaf1Ref.current);
            if (fenceHintRaf2Ref.current) cancelAnimationFrame(fenceHintRaf2Ref.current);

            if (vertexDragRafRef.current) cancelAnimationFrame(vertexDragRafRef.current);
        };
    }, [dismissNotification]);

    useEffect(() => {
        return () => {
            if (boxSelectRafRef.current) cancelAnimationFrame(boxSelectRafRef.current);
        };
    }, []);

    // ✅ Drag-over op canvas (HTML5 drag events)
    useEffect(() => {
        const stage = stageRef.current;
        const container: HTMLDivElement | null = stage?.container?.() ?? null;
        if (!container) return;

        const hasPlantPayloadType = (e: DragEvent) => {
            const types = Array.from(e.dataTransfer?.types ?? []);
            return (
                types.includes("application/x-plant-id") ||
                types.includes("text/plain")
            );
        };

        const getDroppedPlantId = (e: DragEvent) => {
            const types = Array.from(e.dataTransfer?.types ?? []);

            const rawPlantId =
                (types.includes("application/x-plant-id")
                    ? e.dataTransfer?.getData("application/x-plant-id")
                    : "") ||
                (types.includes("text/plain")
                    ? e.dataTransfer?.getData("text/plain")
                    : "") ||
                "";

            const plantId = rawPlantId.trim();
            if (!plantId) return null;

            const plant = useProjectStore.getState().getPlantById(plantId);
            if (!plant) return null;

            return plantId;
        };

        const clientToWorld = (clientX: number, clientY: number) => {
            const rect = container.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;

            const scale = stageScaleRef.current;
            const pos = stagePosRef.current;

            return {
                x: (x - pos.x) / scale,
                y: (y - pos.y) / scale,
            };
        };

        const clearDragOverPlantbed = () => {
            dragOverPlantbedIdRef.current = null;
            setDragOverPlantbedId(null);
        };

        const onDragOver = (e: DragEvent) => {
            if (!hasPlantPayloadType(e)) {
                clearDragOverPlantbed();
                return;
            }

            e.preventDefault();

            const world = clientToWorld(e.clientX, e.clientY);
            const objs = objectsRef.current as PolyObject[];
            const plantbeds = objs.filter((o) => o.type === "plantbed");

            const hit = getPlantbedHitAtWorldPoint(world.x, world.y, plantbeds);
            const nextId = hit ? hit.id : null;

            dragOverPlantbedIdRef.current = nextId;
            setDragOverPlantbedId(nextId);
        };

        const onDragLeave = (e: DragEvent) => {
            if (!hasPlantPayloadType(e)) return;

            const rect = container.getBoundingClientRect();
            const clientX = e.clientX;
            const clientY = e.clientY;

            const isStillInsideContainer =
                clientX >= rect.left &&
                clientX <= rect.right &&
                clientY >= rect.top &&
                clientY <= rect.bottom;

            if (isStillInsideContainer) return;

            clearDragOverPlantbed();
        };

        const onDrop = (e: DragEvent) => {
            const plantId = getDroppedPlantId(e);
            if (!plantId) {
                clearDragOverPlantbed();
                return;
            }

            e.preventDefault();

            const world = clientToWorld(e.clientX, e.clientY);
            const objs = useProjectStore.getState().objects as PolyObject[];
            const plantbeds = objs.filter((o) => o.type === "plantbed");

            let hit = getPlantbedHitAtWorldPoint(world.x, world.y, plantbeds);

            if (!hit && dragOverPlantbedIdRef.current) {
                hit =
                    plantbeds.find((pb) => pb.id === dragOverPlantbedIdRef.current) ??
                    null;
            }

            if (!hit) {
                clearDragOverPlantbed();
                notify(APP_NOTIFICATIONS.plantsOnlyInPlantbeds());
                return;
            }

            const plantbedId = hit.id;

            const state = useProjectStore.getState();
            const plant = state.getPlantById(plantId);

            if (!plant) {
                clearDragOverPlantbed();
                return;
            }

            const alreadyLinkedIds: string[] = state.plantbedLinks?.[plantbedId] ?? [];

            if (alreadyLinkedIds.includes(plantId)) {
                const plantbedNo = (hit as any).plantbedNo ?? "?";
                clearDragOverPlantbed();
                notify(APP_NOTIFICATIONS.plantAlreadyLinkedToPlantbed(plantbedNo));
                return;
            }

            linkPlantToPlantbed(plantId, plantbedId);

            const plantName = plant.latin ?? "Plant";
            const plantbedNo = (hit as any).plantbedNo ?? "?";

            clearDragOverPlantbed();
            notify(APP_NOTIFICATIONS.plantLinkedToPlantbed(plantName, plantbedNo));
        };

        container.addEventListener("dragover", onDragOver);
        container.addEventListener("dragleave", onDragLeave);
        container.addEventListener("drop", onDrop);

        return () => {
            container.removeEventListener("dragover", onDragOver);
            container.removeEventListener("dragleave", onDragLeave);
            container.removeEventListener("drop", onDrop);
        };
    }, []);

    const canvasWrapRef = useRef<HTMLDivElement | null>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

    const bringObjectIntoView = useCallback((objectId: string) => {
        const target = (objectsRef.current as any[])?.find((o) => o?.id === objectId);
        if (!target?.points?.length) return;

        const viewportW = canvasSize.w;
        const viewportH = canvasSize.h;
        if (!viewportW || !viewportH) return;

        const scale = stageScaleRef.current;
        const pos = stagePosRef.current;

        const bbox = bboxFromPoints(target.points);
        const bboxLeft = bbox.x;
        const bboxTop = bbox.y;
        const bboxRight = bbox.x + bbox.w;
        const bboxBottom = bbox.y + bbox.h;

        const visibleLeft = (-pos.x) / scale;
        const visibleTop = (-pos.y) / scale;
        const visibleRight = visibleLeft + viewportW / scale;
        const visibleBottom = visibleTop + viewportH / scale;

        const margin = GRID_SIZE * 6;

        const fullyVisible =
            bboxLeft >= visibleLeft + margin &&
            bboxRight <= visibleRight - margin &&
            bboxTop >= visibleTop + margin &&
            bboxBottom <= visibleBottom - margin;

        if (fullyVisible) return;

        const targetCenterX = bbox.x + bbox.w / 2;
        const targetCenterY = bbox.y + bbox.h / 2;

        scheduleViewportState({
            pos: {
                x: viewportW / 2 - targetCenterX * scale,
                y: viewportH / 2 - targetCenterY * scale,
            },
        });
    }, [canvasSize.w, canvasSize.h]);

    useEffect(() => {
        const objectId = canvasFocusRequest?.objectId;
        if (!objectId) return;

        requestAnimationFrame(() => {
            bringObjectIntoView(objectId);
        });
    }, [canvasFocusRequest?.nonce, bringObjectIntoView]);

    useEffect(() => {
        const el = canvasWrapRef.current;
        if (!el) return;

        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width, height } = entry.contentRect;
            setCanvasSize({ w: Math.max(0, Math.floor(width)), h: Math.max(0, Math.floor(height)) });
        });

        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        return () => {
            if (viewportRafRef.current) {
                cancelAnimationFrame(viewportRafRef.current);
                viewportRafRef.current = null;
            }

            if (previewRafRef.current) {
                cancelAnimationFrame(previewRafRef.current);
                previewRafRef.current = null;
            }

            if (boxSelectRafRef.current) {
                cancelAnimationFrame(boxSelectRafRef.current);
                boxSelectRafRef.current = null;
            }

            if (vertexDragRafRef.current) {
                cancelAnimationFrame(vertexDragRafRef.current);
                vertexDragRafRef.current = null;
            }

            if (edgeResizeRafRef.current) {
                cancelAnimationFrame(edgeResizeRafRef.current);
                edgeResizeRafRef.current = null;
            }

            if (fenceHintRaf1Ref.current) {
                cancelAnimationFrame(fenceHintRaf1Ref.current);
                fenceHintRaf1Ref.current = null;
            }

            if (fenceHintRaf2Ref.current) {
                cancelAnimationFrame(fenceHintRaf2Ref.current);
                fenceHintRaf2Ref.current = null;
            }

            if (fenceHintTimerRef.current) {
                window.clearTimeout(fenceHintTimerRef.current);
                fenceHintTimerRef.current = null;
            }

            if (autosaveTimerRef.current !== null) {
                window.clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }

            pendingViewportRef.current = null;
            pendingPreviewRef.current = null;
            pendingBoxRectRef.current = null;

            const stage = stageRef.current;
            if (stage) {
                stage.destroy();
                stageRef.current = null;
            }

            TILES_PATTERN_GEOMETRY_CACHE.clear();
            BUILDING_PATTERN_CACHE.clear();
        };
    }, []);

    // Preview segment — ZERO React state updates (imperative Konva update)
    const previewRafRef = useRef<number | null>(null);
    const pendingPreviewRef = useRef<ResolvedDrawPreviewPoint | null>(null);
    const lastPreviewKeyRef = useRef<string>("");

    const commitPreview = useCallback(() => {
        previewRafRef.current = null;

        const next = pendingPreviewRef.current;
        pendingPreviewRef.current = null;

        const base = draftPointsRef.current;

        const solid = draftLineRef.current;
        if (solid) solid.points(base);

        const preview = draftPreviewLineRef.current;
        const guide = draftGuideLineRef.current;
        const secondaryGuide = draftSecondaryGuideLineRef.current;

        if (base.length < 2) {
            setDraftMeasurementPreviewPoint(null);

            if (preview) preview.points([]);
            if (guide) guide.points([]);
            if (secondaryGuide) secondaryGuide.points([]);

            const layer =
                preview?.getLayer?.() ??
                solid?.getLayer?.() ??
                guide?.getLayer?.() ??
                secondaryGuide?.getLayer?.();

            if (layer) layer.batchDraw();
            return;
        }

        const lastX = base[base.length - 2];
        const lastY = base[base.length - 1];

        const fallbackNext = next ?? {
            x: lastX,
            y: lastY,
            primaryGuidePoints: null,
            secondaryGuidePoints: null,
        };

        if (activeTool === "draw" && activeDrawType !== "treebed") {
            setDraftMeasurementPreviewPoint({
                x: fallbackNext.x,
                y: fallbackNext.y,
            });
        } else {
            setDraftMeasurementPreviewPoint(null);
        }

        if (preview) {
            const previewType = activeDrawType;
            const rawPreviewPoints = [lastX, lastY, fallbackNext.x, fallbackNext.y];

            const visualPreviewPoints =
                isFenceOrGate(previewType)
                    ? getOneSidedPolylineRenderPoints(
                        rawPreviewPoints,
                        getLineStrokeWidth(previewType),
                        inferPolylineRenderSide(rawPreviewPoints, previewType, objects, 1)
                    )
                    : rawPreviewPoints;

            preview.points(visualPreviewPoints);
        }

        if (guide) {
            guide.points(fallbackNext.primaryGuidePoints ?? []);
        }

        if (secondaryGuide) {
            secondaryGuide.points(fallbackNext.secondaryGuidePoints ?? []);
        }

        const layer =
            preview?.getLayer?.() ??
            solid?.getLayer?.() ??
            guide?.getLayer?.() ??
            secondaryGuide?.getLayer?.();

        if (layer) layer.batchDraw();
    }, [activeTool, activeDrawType]);

    // ✅ Undo/Redo callbacks
    const handleUndo = useCallback(() => {
        if ((activeTool === "draw" || activeTool === "cut") && draftPointsRef.current.length >= 2) {
            setDraftPoints((prev) => {
                if (prev.length < 2) return prev;

                const lastTwo = prev.slice(prev.length - 2);
                setDraftRedoPoints((redo) => [...redo, ...lastTwo]);

                const next = prev.slice(0, prev.length - 2);

                pendingPreviewRef.current = null;
                if (!previewRafRef.current) {
                    previewRafRef.current = requestAnimationFrame(commitPreview);
                }

                return next;
            });
            return;
        }

        undoObject();

        pendingPreviewRef.current = null;
        if (!previewRafRef.current) {
            previewRafRef.current = requestAnimationFrame(commitPreview);
        }
    }, [activeTool, undoObject, commitPreview]);

    const handleRedo = useCallback(() => {
        if ((activeTool === "draw" || activeTool === "cut") && draftRedoPointsRef.current.length >= 2) {
            setDraftRedoPoints((redo) => {
                if (redo.length < 2) return redo;

                const lastTwo = redo.slice(redo.length - 2);

                setDraftPoints((prev) => {
                    const next = [...prev, ...lastTwo];

                    pendingPreviewRef.current = null;
                    if (!previewRafRef.current) {
                        previewRafRef.current = requestAnimationFrame(commitPreview);
                    }

                    return next;
                });

                return redo.slice(0, redo.length - 2);
            });
            return;
        }

        redoObject();

        pendingPreviewRef.current = null;
        if (!previewRafRef.current) {
            previewRafRef.current = requestAnimationFrame(commitPreview);
        }
    }, [activeTool, redoObject, commitPreview]);

    useEffect(() => {
        if (draftPoints.length >= 2) return;

        lastPreviewKeyRef.current = "";

        if (draftGuideLineRef.current) draftGuideLineRef.current.points([]);
        if (draftSecondaryGuideLineRef.current) draftSecondaryGuideLineRef.current.points([]);
        draftGuideLineRef.current?.getLayer()?.batchDraw();

        const layer =
            draftGuideLineRef.current?.getLayer?.() ??
            draftSecondaryGuideLineRef.current?.getLayer?.();

        if (layer) layer.batchDraw();
    }, [draftPoints.length]);

    const applyViewportWheel = useCallback((evt: WheelEvent) => {
        evt.preventDefault();

        const stage = stageRef.current;
        if (!stage) return;

        const container = stage.container?.();
        if (!container) return;

        const isZoomGesture = evt.ctrlKey || evt.metaKey;

        if (isZoomGesture) {
            const rect = container.getBoundingClientRect();
            const pointer = {
                x: evt.clientX - rect.left,
                y: evt.clientY - rect.top,
            };

            const oldScale = stageScaleRef.current;
            const zoomDirection = evt.deltaY > 0 ? -1 : 1;
            const zoomFactor = 1.22;
            const newScale = zoomDirection > 0 ? oldScale * zoomFactor : oldScale / zoomFactor;
            const clamped = clamp(newScale, 0.04, 12);

            const oldPos = stagePosRef.current;
            const mousePointTo = {
                x: (pointer.x - oldPos.x) / oldScale,
                y: (pointer.y - oldPos.y) / oldScale,
            };

            const newPos = {
                x: pointer.x - mousePointTo.x * clamped,
                y: pointer.y - mousePointTo.y * clamped,
            };

            scheduleViewportState({
                scale: clamped,
                pos: newPos,
            });
            return;
        }

        const panSpeed = 1;
        const dx = evt.shiftKey ? -evt.deltaY * panSpeed : -evt.deltaX * panSpeed;
        const dy = evt.shiftKey ? 0 : -evt.deltaY * panSpeed;

        const currentPos = stagePosRef.current;
        scheduleViewportState({
            pos: {
                x: currentPos.x + dx,
                y: currentPos.y + dy,
            },
        });
    }, [scheduleViewportState]);

    const handleWheel = useCallback(
        (e: any) => {
            applyViewportWheel(e.evt as WheelEvent);
        },
        [applyViewportWheel]
    );

    const handleMouseDown = useCallback(
        (e: any) => {
            const stage = stageRef.current;
            if (!stage) return;

            const evt = e.evt as MouseEvent;

            if (
                evt.shiftKey &&
                activeTool === "draw" &&
                !!activeDrawType &&
                !isFenceOrGate(activeDrawType) &&
                !hasUsedShiftForStraightLine
            ) {
                markShiftHintAsLearned();
            }

            if (pendingPlantbedClickRef.current) {
                const dx = Math.abs((evt.clientX ?? 0) - pendingPlantbedClickRef.current.startClientX);
                const dy = Math.abs((evt.clientY ?? 0) - pendingPlantbedClickRef.current.startClientY);
                if (dx > 3 || dy > 3) {
                    plantbedClickMovedRef.current = true;
                }
            }

            if (evt.button === 0) {
                clickStartPosRef.current = { x: evt.clientX, y: evt.clientY };
            }

            if (activeTool === "hand" && evt.button === 0) {
                setIsPanning(true);
                panStartRef.current = { x: evt.clientX, y: evt.clientY };
                stagePosStartRef.current = { ...stagePosRef.current };

                const st = stageRef.current;
                if (st) st.container().style.cursor = "grabbing";

                return;
            }

            if (evt.button === 0 && activeTool === "select") {
                const clickedOnEmpty = e.target === e.target.getStage();
                if (clickedOnEmpty) {
                    const world = getPointerWorldPos(stage);
                    if (!world) return;

                    setIsBoxSelecting(true);
                    boxStartRef.current = { x: world.x, y: world.y };
                    setSelectionBox({ x: world.x, y: world.y, w: 0, h: 0 });
                    clearSelection();
                    return;
                }
                return;
            }

            if (evt.button === 1) {
                e.cancelBubble = true;
                startMiddleMousePan(evt);
                return;
            }

            if (evt.button === 0 && mode === "draw" && (activeTool === "draw" || activeTool === "cut")) {
                // ✅ Registreer eigen click-timing voor fence/gate
                const now = performance.now();
                lastDrawClickDeltaRef.current =
                    lastDrawClickAtRef.current > 0 ? now - lastDrawClickAtRef.current : Infinity;
                lastDrawClickAtRef.current = now;

                // Guard: voorkom extra punt rondom een echte dblclick-afronding
                if (activeTool === "draw") {
                    if (now - lastDblClickAtRef.current < FENCE_GATE_DBLCLICK_MS) return;
                    if ((evt as any).detail && (evt as any).detail > 1) return;
                }

                if (activeTool === "draw") {
                    const currentDrawType = activeDrawTypeRef.current;
                    const currentViewVisibility = viewVisibilityRef.current;

                    if (!currentDrawType) {
                        notify(APP_NOTIFICATIONS.chooseObjectTypeFirst());
                        return;
                    }

                    const visibilityKey = getViewVisibilityKeyForType(currentDrawType);
                    if (!currentViewVisibility[visibilityKey]) {
                        const label = getViewVisibilityLabelForType(currentDrawType);
                        notify(APP_NOTIFICATIONS.drawingBlockedByViewToggle(label));
                        return;
                    }
                }

                const world = getPointerWorldPos(stage);
                if (!world) return;

                const resolved = resolveDrawPreviewPoint(
                    world.x,
                    world.y,
                    draftPointsRef.current,
                    evt.shiftKey,
                    activeTool === "cut" ? null : activeDrawType,
                    objectsRef.current as PolyObject[],
                    {
                        showGuides:
                            shouldShowDraftGuidesForTool(activeTool) &&
                            !isFenceOrGate(activeDrawType),
                    }
                );

                const x = resolved.x;
                const y = resolved.y;

                // ✅ CUT TOOL: zelfde tekenflow, maar commit = uitsnijden
                if (activeTool === "cut") {
                    const base = draftPointsRef.current;

                    if (base.length >= 6) {
                        const firstX = base[0];
                        const firstY = base[1];

                        if (x === firstX && y === firstY) {
                            cutObjectsByPolygon(base);

                            setDraftPoints([]);
                            setDraftRedoPoints([]);

                            lastPreviewKeyRef.current = "";
                            pendingPreviewRef.current = null;
                            if (draftLineRef.current) draftLineRef.current.points([]);
                            if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);

                            const layer = draftLineRef.current?.getLayer?.() ?? draftPreviewLineRef.current?.getLayer?.();
                            if (layer) layer.batchDraw();

                            return;
                        }
                    }

                    setDraftPoints((prev) => {
                        if (prev.length >= 2 && prev[prev.length - 2] === x && prev[prev.length - 1] === y) return prev;
                        return [...prev, x, y];
                    });
                    setDraftRedoPoints([]);

                    lastPreviewKeyRef.current = `${x},${y}`;
                    pendingPreviewRef.current = resolved;

                    if (!previewRafRef.current) {
                        previewRafRef.current = requestAnimationFrame(commitPreview);
                    }
                    return;
                }

                // ✅ Fence/Gate: alleen punten zetten, NIET sluiten door op eerste punt te klikken
                if (isFenceOrGate(activeDrawType)) {
                    if (!activeDrawType) {
                        notify(APP_NOTIFICATIONS.chooseObjectTypeFirst());
                        return;
                    }

                    setDraftPoints((prev) => {
                        if (prev.length >= 2 && prev[prev.length - 2] === x && prev[prev.length - 1] === y) return prev;
                        return [...prev, x, y];
                    });
                    setDraftRedoPoints([]);

                    lastPreviewKeyRef.current = `${x},${y}`;
                    pendingPreviewRef.current = resolved;

                    if (!previewRafRef.current) {
                        previewRafRef.current = requestAnimationFrame(commitPreview);
                    }
                    return;
                }

                const base = draftPointsRef.current;

                if (!activeDrawType) {
                    notify(APP_NOTIFICATIONS.chooseObjectTypeFirst());
                    return;
                }

                if (activeDrawType === "treebed") {
                    if (base.length === 0) {
                        setDraftPoints([x, y]);
                        setDraftRedoPoints([]);
                        setTreebedDraftPreviewPoint({ x, y });

                        lastPreviewKeyRef.current = `${x},${y}`;
                        pendingPreviewRef.current = resolved;

                        if (draftLineRef.current) draftLineRef.current.points([]);
                        if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);

                        const layer =
                            draftLineRef.current?.getLayer?.() ??
                            draftPreviewLineRef.current?.getLayer?.();

                        if (layer) layer.batchDraw();
                        return;
                    }

                    if (base.length === 2) {
                        const cx = base[0];
                        const cy = base[1];

                        addObject({
                            id: nanoid(),
                            type: activeDrawType,
                            treebedVariant: activeTreebedDrawVariant,
                            points: createTreebedPointsFromCenterDrag(
                                cx,
                                cy,
                                x,
                                y,
                                activeTreebedDrawVariant
                            ),
                        });

                        setDraftPoints([]);
                        setDraftRedoPoints([]);
                        setTreebedDraftPreviewPoint(null);

                        lastPreviewKeyRef.current = "";
                        pendingPreviewRef.current = null;
                        if (draftLineRef.current) draftLineRef.current.points([]);
                        if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);

                        const layer =
                            draftLineRef.current?.getLayer?.() ??
                            draftPreviewLineRef.current?.getLayer?.();

                        if (layer) layer.batchDraw();

                        setActiveTool("select");
                        setActiveDrawType(null);
                        return;
                    }
                }

                const lineOnly = isFenceOrGate(activeDrawType);

                if (!lineOnly && base.length >= 6) {
                    const firstX = base[0];
                    const firstY = base[1];

                    if (x === firstX && y === firstY) {
                        addObject({ id: nanoid(), type: activeDrawType, points: base });

                        setDraftPoints([]);
                        setDraftRedoPoints([]);
                        setTreebedDraftPreviewPoint(null);

                        lastPreviewKeyRef.current = "";
                        pendingPreviewRef.current = null;
                        if (draftLineRef.current) draftLineRef.current.points([]);
                        if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);

                        const layer = draftLineRef.current?.getLayer?.() ?? draftPreviewLineRef.current?.getLayer?.();
                        if (layer) layer.batchDraw();

                        setActiveTool("select");
                        setActiveDrawType(null);
                        return;
                    }

                    if (
                        canAutoCloseAgainstSameTypeBoundary(
                            base,
                            x,
                            y,
                            activeDrawType,
                            objectsRef.current as PolyObject[]
                        )
                    ) {
                        addObject({
                            id: nanoid(),
                            type: activeDrawType,
                            points: [...base, x, y],
                        });

                        setDraftPoints([]);
                        setDraftRedoPoints([]);
                        setTreebedDraftPreviewPoint(null);

                        lastPreviewKeyRef.current = "";
                        pendingPreviewRef.current = null;
                        if (draftLineRef.current) draftLineRef.current.points([]);
                        if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);

                        const layer = draftLineRef.current?.getLayer?.() ?? draftPreviewLineRef.current?.getLayer?.();
                        if (layer) layer.batchDraw();

                        setActiveTool("select");
                        setActiveDrawType(null);
                        return;
                    }
                }

                setDraftPoints((prev) => [...prev, x, y]);
                setDraftRedoPoints([]);
                setTreebedDraftPreviewPoint(null);

                lastPreviewKeyRef.current = `${x},${y}`;
                pendingPreviewRef.current = resolved;

                if (!previewRafRef.current) {
                    previewRafRef.current = requestAnimationFrame(commitPreview);
                }
            }
        },
        [activeTool, clearSelection, mode, commitPreview, activeDrawType, addObject, cutObjectsByPolygon, setActiveTool, setActiveDrawType, notify, startMiddleMousePan]
    );

    const handleMouseMove = useCallback(
        (e: any) => {
            const stage = stageRef.current;
            if (!stage) return;

            const evt = e.evt as MouseEvent;

            if (treebedRotateRef.current && activeTool === "select") {
                updateTreebedRotate();
                return;
            }

            if (
                evt.shiftKey &&
                activeTool === "draw" &&
                !!activeDrawType &&
                !isFenceOrGate(activeDrawType) &&
                !hasUsedShiftForStraightLine
            ) {
                markShiftHintAsLearned();
            }

            if (isEdgeResizingRef.current && activeTool === "select") {
                const edit = edgeResizeRef.current;
                const world = getPointerWorldPos(stage);
                if (!edit || !world) return;

                const editedObj = (objectsRef.current as PolyObject[]).find((o) => o.id === edit.objectId);

                const snapped = snapWorldPointAgainstFenceBoundary(
                    world.x,
                    world.y,
                    editedObj?.type ?? null,
                    objectsRef.current as PolyObject[]
                );

                const cx = snapped.x;
                const cy = snapped.y;

                if (edit.holeIndex !== null) {
                    const nextHoles = (edit.workingHoles ?? []).map((h) => [...h]);
                    const ring = nextHoles[edit.holeIndex];
                    if (!ring || ring.length < 6) return;

                    const pointCount = ring.length / 2;
                    const aIdx = edit.edgeIndex * 2;
                    const bIdx = ((edit.edgeIndex + 1) % pointCount) * 2;

                    if (edit.orientation === "vertical") {
                        ring[aIdx] = cx;
                        ring[bIdx] = cx;
                    } else {
                        ring[aIdx + 1] = cy;
                        ring[bIdx + 1] = cy;
                    }

                    edit.workingHoles = nextHoles;
                    requestEdgeResizeRerender();

                    const line = selectedLineRefs.current[edit.objectId];
                    const layer = line?.getLayer?.();
                    if (layer) layer.batchDraw();

                    return;
                }

                const nextPoints = [...edit.workingPoints];
                const pointCount = nextPoints.length / 2;

                const aIdx = edit.edgeIndex * 2;
                const bIdx = ((edit.edgeIndex + 1) % pointCount) * 2;

                if (edit.orientation === "vertical") {
                    nextPoints[aIdx] = cx;
                    nextPoints[bIdx] = cx;
                } else {
                    nextPoints[aIdx + 1] = cy;
                    nextPoints[bIdx + 1] = cy;
                }

                edit.workingPoints = nextPoints;
                requestEdgeResizeRerender();

                const line = selectedLineRefs.current[edit.objectId];
                if (line) {
                    line.points(nextPoints);
                    const layer = line.getLayer?.();
                    if (layer) layer.batchDraw();
                }

                return;
            }

            if (isVertexDraggingRef.current && activeTool === "select") {
                const edit = vertexEditRef.current;
                const vi = activeVertexIndexRef.current;

                const world = getPointerWorldPos(stage);
                if (!edit || vi === null || !world) return;

                const editedObj = (objectsRef.current as PolyObject[]).find((o) => o.id === edit.objectId);

                const snapped = snapWorldPointAgainstFenceBoundary(
                    world.x,
                    world.y,
                    editedObj?.type ?? null,
                    objectsRef.current as PolyObject[]
                );

                const cx = snapped.x;
                const cy = snapped.y;

                if (edit.holeIndex !== null) {
                    if (!edit.workingHoles || !edit.workingHoles[edit.holeIndex]) return;

                    edit.workingHoles[edit.holeIndex][vi] = cx;
                    edit.workingHoles[edit.holeIndex][vi + 1] = cy;
                } else {
                    edit.workingPoints[vi] = cx;
                    edit.workingPoints[vi + 1] = cy;
                }

                // ✅ pak de line van het object dat je daadwerkelijk aan het editen bent
                const line = selectedLineRefs.current[edit.objectId];
                if (line && edit.holeIndex === null) {
                    line.points(edit.workingPoints);
                }

                // ✅ pak de handle van het juiste object
                const handleIdx = vi / 2;
                const handleKey =
                    edit.holeIndex === null ? `${handleIdx}` : `h-${edit.holeIndex}-${handleIdx}`;

                const h = vertexHandleRefs.current[edit.objectId]?.[handleKey];
                if (h) {
                    h.position({ x: cx, y: cy });
                }

                // ✅ Tijdens vertex-drag altijd een throttled React rerender forceren,
                // zodat ook labels/live afgeleide UI direct meebewegen.
                requestVertexDragRerender();

                const layer = (line ?? h)?.getLayer?.();
                if (layer) layer.batchDraw();

                return;
            }

            if (isBoxSelecting && activeTool === "select") {
                const start = boxStartRef.current;
                const world = getPointerWorldPos(stage);
                if (!start || !world) return;

                const r = normalizeRect(start.x, start.y, world.x, world.y);
                setSelectionBox(r);

                // ✅ live selection (throttled)
                pendingBoxRectRef.current = r;
                if (!boxSelectRafRef.current) {
                    boxSelectRafRef.current = requestAnimationFrame(commitLiveBoxSelection);
                }

                return;
            }

            if (isPanning) {
                const start = panStartRef.current;
                const posStart = stagePosStartRef.current;
                if (!start || !posStart) return;

                const dx = evt.clientX - start.x;
                const dy = evt.clientY - start.y;

                scheduleViewportState({
                    pos: {
                        x: posStart.x + dx,
                        y: posStart.y + dy,
                    },
                });
                return;
            }

            if ((activeTool === "draw" || activeTool === "cut") && draftPointsRef.current.length >= 2) {
                const world = getPointerWorldPos(stage);
                if (!world) return;

                const resolved = resolveDrawPreviewPoint(
                    world.x,
                    world.y,
                    draftPointsRef.current,
                    evt.shiftKey,
                    activeDrawType,
                    objectsRef.current as PolyObject[],
                    {
                        showGuides:
                            shouldShowDraftGuidesForTool(activeTool) &&
                            !isFenceOrGate(activeDrawType),
                    }
                );

                const previewKey = [
                    resolved.x,
                    resolved.y,
                    evt.shiftKey ? 1 : 0,
                    resolved.primaryGuidePoints?.join(",") ?? "",
                    resolved.secondaryGuidePoints?.join(",") ?? "",
                ].join("|");

                if (activeTool === "draw" && activeDrawType === "treebed" && draftPointsRef.current.length === 2) {
                    if (previewKey === lastPreviewKeyRef.current) return;

                    lastPreviewKeyRef.current = previewKey;
                    setDraftMeasurementPreviewPoint(null);
                    setTreebedDraftPreviewPoint({ x: resolved.x, y: resolved.y });
                    return;
                }

                if (previewKey === lastPreviewKeyRef.current) return;

                lastPreviewKeyRef.current = previewKey;
                pendingPreviewRef.current = resolved;

                if (!previewRafRef.current) {
                    previewRafRef.current = requestAnimationFrame(commitPreview);
                }
            }
        },
        [activeTool, isBoxSelecting, isPanning, commitPreview]
    );

    const handleMouseUp = useCallback(
        (e: any) => {
            const evt = e.evt as MouseEvent;

            if (treebedRotateRef.current && evt.button === 0) {
                finishTreebedRotate();
                return;
            }

            // ✅ Plantvak focus alleen bij “echte klik” (geen drag/vertex/boxselect)
            if (evt.button === 0 && pendingPlantbedClickRef.current) {
                const pending = pendingPlantbedClickRef.current;
                pendingPlantbedClickRef.current = null;

                const isRealClick =
                    !plantbedClickMovedRef.current &&
                    !suppressPlantbedFocusRef.current &&
                    activeTool === "select" &&
                    !isBoxSelecting &&
                    !isVertexDraggingRef.current;

                plantbedClickMovedRef.current = false;

                if (isRealClick) {
                    focusSidebarOnPlantbed(pending.id);
                }
            }
            if (evt.button === 0 && clickStartPosRef.current) {
                const dx = Math.abs(evt.clientX - clickStartPosRef.current.x);
                const dy = Math.abs(evt.clientY - clickStartPosRef.current.y);

                const moved = dx > 3 || dy > 3;

                // Alleen als er echt bewogen is -> suppress
                suppressPlantbedFocusRef.current = moved;

                clickStartPosRef.current = null;

                if (!moved) {
                    // echte klik -> direct vrijgeven
                    suppressPlantbedFocusRef.current = false;
                }
            }
            if (isEdgeResizingRef.current && evt.button === 0) {
                const edit = edgeResizeRef.current;

                edgeResizeRef.current = null;
                isEdgeResizingRef.current = false;
                setIsEdgeResizing(false);

                if (edit) {
                    moveObjectAndMerge(edit.objectId, edit.workingPoints, edit.workingHoles);
                }

                requestAnimationFrame(() => {
                    suppressPlantbedFocusRef.current = false;

                    const st = stageRef.current;
                    if (st) {
                        st.container().style.cursor = "default";
                    }
                });

                return;
            }

            if (isVertexDraggingRef.current && evt.button === 0) {
                const edit = vertexEditRef.current;

                vertexEditRef.current = null;
                activeVertexIndexRef.current = null;

                isVertexDraggingRef.current = false;
                setIsVertexDragging(false);

                if (edit) {
                    moveObjectAndMerge(edit.objectId, edit.workingPoints, edit.workingHoles);
                }

                requestAnimationFrame(() => {
                    suppressPlantbedFocusRef.current = false;
                });

                return;
            }

            if (evt.button === 0 && isBoxSelecting && activeTool === "select") {
                setIsBoxSelecting(false);

                const box = selectionBox;

                // force last live update (if any) before cleanup
                if (boxSelectRafRef.current) {
                    cancelAnimationFrame(boxSelectRafRef.current);
                    boxSelectRafRef.current = null;
                }

                if (box && box.w >= 2 && box.h >= 2) {
                    pendingBoxRectRef.current = box;
                    commitLiveBoxSelection();
                }

                // cleanup
                pendingBoxRectRef.current = null;
                boxStartRef.current = null;
                setSelectionBox(null);

                return;
            }

            if (evt.button === 1 || (activeTool === "hand" && evt.button === 0)) {
                setIsPanning(false);
                panStartRef.current = null;
                stagePosStartRef.current = null;

                const st = stageRef.current;
                if (st) {
                    st.container().style.cursor =
                        activeTool === "hand"
                            ? "grab"
                            : activeTool === "select"
                                ? "default"
                                : activeTool === "draw" || activeTool === "cut"
                                    ? "crosshair"
                                    : "default";
                }
            }
        },
        [activeTool, isBoxSelecting, objects, selectionBox, selectObjects, moveObjectAndMerge]
    );

    // Keyboard
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (mode !== "draw") return;

            if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "v") {
                setActiveTool("select");
                setActiveDrawType(null); // ✅ highlight links uit
                return;
            }
            if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "h") {
                setActiveTool("hand");
                setActiveDrawType(null); // ✅ highlight links uit
                return;
            }
            if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "c") {
                clearSelection();
                setActiveTool("cut");
                setActiveDrawType(null); // ✅ highlight links uit
                return;
            }
            const key = e.key.toLowerCase();
            const isUndo = (e.ctrlKey || e.metaKey) && key === "z";
            const isRedo = (e.ctrlKey || e.metaKey) && key === "y";
            const isDuplicate = (e.ctrlKey || e.metaKey) && key === "d";

            if (isDuplicate) {
                e.preventDefault();

                const state = useProjectStore.getState();
                const hasSelection =
                    (state.selectedObjectIds && state.selectedObjectIds.length > 0) ||
                    !!state.selectedObjectId;

                if (!hasSelection) return;
                if (state.activeTool !== "select") return;

                handleDuplicateSelection();
                return;
            }

            const target = e.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase();

            const isTypingTarget =
                !!target &&
                (
                    tagName === "input" ||
                    tagName === "textarea" ||
                    target.isContentEditable
                );

            if (isTypingTarget) {
                return;
            }

            const isDeleteKey = e.key === "Delete" || e.key === "Backspace";
            if (isDeleteKey) {
                e.preventDefault();
                if (!selectedObjectIdRef.current) return;

                useProjectStore.getState().requestDeleteSelected();
                return;
            }

            if (!isUndo && !isRedo && e.key === "Enter") {
                const prev = draftPointsRef.current;

                if (activeTool === "cut") {
                    if (prev.length < 6) {
                        notify(APP_NOTIFICATIONS.polygonNeedsAtLeastThreePoints());
                        return;
                    }

                    cutObjectsByPolygon(prev);

                    setDraftPoints([]);
                    setDraftRedoPoints([]);

                    lastPreviewKeyRef.current = "";
                    pendingPreviewRef.current = null;
                    if (draftLineRef.current) draftLineRef.current.points([]);
                    if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);

                    const layer = draftLineRef.current?.getLayer?.() ?? draftPreviewLineRef.current?.getLayer?.();
                    if (layer) layer.batchDraw();

                    return;
                }

                const currentDrawType = activeDrawTypeRef.current;
                const currentViewVisibility = viewVisibilityRef.current;

                if (!currentDrawType) {
                    notify(APP_NOTIFICATIONS.chooseObjectTypeFirst());
                    return;
                }

                const visibilityKey = getViewVisibilityKeyForType(currentDrawType);
                if (!currentViewVisibility[visibilityKey]) {
                    const label = getViewVisibilityLabelForType(currentDrawType);
                    notify(APP_NOTIFICATIONS.drawingBlockedByViewToggle(label));
                    return;
                }

                if (currentDrawType === "treebed") {
                    if (prev.length < 2 || !treebedDraftPreviewPoint) {
                        notify(APP_NOTIFICATIONS.chooseObjectTypeFirst());
                        return;
                    }

                    const cx = prev[0];
                    const cy = prev[1];

                    addObject({
                        id: nanoid(),
                        type: currentDrawType,
                        treebedVariant: activeTreebedDrawVariant,
                        points: createTreebedPointsFromCenterDrag(
                            cx,
                            cy,
                            treebedDraftPreviewPoint.x,
                            treebedDraftPreviewPoint.y,
                            activeTreebedDrawVariant
                        ),
                    });

                    setDraftPoints([]);
                    setDraftRedoPoints([]);
                    setTreebedDraftPreviewPoint(null);

                    lastPreviewKeyRef.current = "";
                    pendingPreviewRef.current = null;
                    if (draftLineRef.current) draftLineRef.current.points([]);
                    if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);

                    const layer = draftLineRef.current?.getLayer?.() ?? draftPreviewLineRef.current?.getLayer?.();
                    if (layer) layer.batchDraw();

                    setActiveTool("select");
                    setActiveDrawType(null);
                    return;
                }

                if (prev.length < 6) {
                    notify(APP_NOTIFICATIONS.polygonNeedsAtLeastThreePoints());
                    return;
                }

                addObject({ id: nanoid(), type: currentDrawType, points: prev });

                setDraftPoints([]);
                setDraftRedoPoints([]);
                setTreebedDraftPreviewPoint(null);

                lastPreviewKeyRef.current = "";
                pendingPreviewRef.current = null;
                if (draftLineRef.current) draftLineRef.current.points([]);
                if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);

                const layer = draftLineRef.current?.getLayer?.() ?? draftPreviewLineRef.current?.getLayer?.();
                if (layer) layer.batchDraw();

                setActiveTool("select");
                setActiveDrawType(null);
                return;
            }

            if (!isUndo && !isRedo && e.key === "Escape") {
                setDraftPoints([]);
                setDraftRedoPoints([]);
                setTreebedDraftPreviewPoint(null);

                lastPreviewKeyRef.current = "";
                pendingPreviewRef.current = null;
                if (draftLineRef.current) draftLineRef.current.points([]);
                if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);

                const layer = draftLineRef.current?.getLayer?.() ?? draftPreviewLineRef.current?.getLayer?.();
                if (layer) layer.batchDraw();

                setActiveTool("select");
                setActiveDrawType(null);
                return;
            }

            if (!isUndo && !isRedo) return;
            e.preventDefault();

            if (isUndo) handleUndo();
            if (isRedo) handleRedo();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [mode, activeTool, setActiveTool, handleUndo, handleRedo, deleteSelected, activeDrawType, addObject, cutObjectsByPolygon, setActiveDrawType, notify, handleDuplicateSelection, clearSelection]);

    const handleRotateCanvasClockwise = useCallback(() => {
        const currentObjects = useProjectStore.getState().objects as PolyObject[];
        if (currentObjects.length === 0) return;

        const worldBounds = getObjectsBoundingBox(currentObjects);
        if (!worldBounds) return;

        const centerX = worldBounds.x + worldBounds.w / 2;
        const centerY = worldBounds.y + worldBounds.h / 2;

        const nextObjects = currentObjects.map((obj) =>
            rotateObjectQuarterTurnClockwise(obj, centerX, centerY, GRID_SIZE)
        );

        const nextSelectedIds =
            selectedObjectIds.length > 0
                ? selectedObjectIds
                : selectedObjectId
                    ? [selectedObjectId]
                    : [];

        setDraftPoints([]);
        setDraftRedoPoints([]);
        setTreebedDraftPreviewPoint(null);
        setDraftMeasurementPreviewPoint(null);
        setTreebedResizePreview(null);
        setTreebedRotatePreview(null);

        pendingPreviewRef.current = null;
        lastPreviewKeyRef.current = "";

        if (draftLineRef.current) draftLineRef.current.points([]);
        if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);
        if (draftGuideLineRef.current) draftGuideLineRef.current.points([]);
        if (draftSecondaryGuideLineRef.current) draftSecondaryGuideLineRef.current.points([]);

        const draftLayer =
            draftLineRef.current?.getLayer?.() ??
            draftPreviewLineRef.current?.getLayer?.() ??
            draftGuideLineRef.current?.getLayer?.() ??
            draftSecondaryGuideLineRef.current?.getLayer?.();

        if (draftLayer) {
            draftLayer.batchDraw();
        }

        setObjectsWithHistory(nextObjects, nextSelectedIds[0] ?? null);

        if (nextSelectedIds.length > 0) {
            selectObjects(nextSelectedIds);
        } else {
            clearSelection();
        }

        setCompassDirection((prev) => {
            const currentIndex = COMPASS_DIRECTIONS.indexOf(prev);
            const nextIndex = (currentIndex + 1) % COMPASS_DIRECTIONS.length;
            return COMPASS_DIRECTIONS[nextIndex];
        });
    }, [
        selectedObjectId,
        selectedObjectIds,
        setObjectsWithHistory,
        selectObjects,
        clearSelection,
        setDraftPoints,
        setDraftRedoPoints,
        setTreebedDraftPreviewPoint,
        setDraftMeasurementPreviewPoint,
        setTreebedResizePreview,
        setTreebedRotatePreview,
    ]);

    const handleResetView = useCallback(() => {
        handleCenterCanvas();
    }, [handleCenterCanvas]);

    const shouldHideHeavySceneDecorations =
        treebedRotatePreview !== null;

    const shouldHideSelectionLabelsForPerformance =
        isVertexDragging || isEdgeResizing;

    const sceneObjectBuckets = useMemo(() => {
        const selectedSet = new Set<string>(selectedObjectIds);

        const zSort = (a: PolyObject, b: PolyObject) =>
            TYPE_Z_INDEX[a.type] - TYPE_Z_INDEX[b.type];

        const visibleObjects = (objects as PolyObject[]).filter((o) => {
            const key = getViewVisibilityKeyForType(o.type);
            return viewVisibility[key];
        });

        const selected = visibleObjects
            .filter((o) => selectedSet.has(o.id))
            .sort(zSort);

        const unselected = visibleObjects
            .filter((o) => !selectedSet.has(o.id))
            .sort(zSort);

        const unselectedPlantbeds = unselected.filter((o) => o.type === "plantbed");
        const unselectedNonPlantbeds = unselected.filter((o) => o.type !== "plantbed");

        return {
            visibleObjects,
            selected,
            unselected,
            unselectedPlantbeds,
            unselectedNonPlantbeds,
        };
    }, [objects, selectedObjectIds, viewVisibility]);

    return (
        <div className="h-screen w-screen overflow-hidden" style={{ background: COLORS.greenLight }}>
            {fenceHint && (
                <div
                    className="fixed z-[120]"
                    style={{
                        top: HEADER_HEIGHT + HINT_MARGIN,
                        left: LEFT_MENU_WIDTH + HINT_MARGIN,
                        opacity: fenceHintVisible ? 1 : 0,
                        transition: `opacity ${NOTICE_FADE_MS}ms ease`,
                        pointerEvents: "auto",
                    }}
                >
                    <div
                        style={{
                            background: COLORS.green,
                            color: "#ffffff",
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "stretch",
                            overflow: "hidden",
                            fontSize: 14,
                            boxShadow: "0px 2px 6px rgba(0,0,0,0.15)",
                        }}
                    >
                        <div
                            style={{
                                padding: "10px 18px",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                            }}
                        >
                            <img
                                src="/icons/info.svg"
                                alt=""
                                style={{
                                    width: 16,
                                    height: 16,
                                    filter: "brightness(0) invert(1)",
                                }}
                            />
                            <span>{fenceHint.msg}</span>
                        </div>

                        {fenceHint.dismissible && (
                            <>
                                <div
                                    style={{
                                        width: 1,
                                        background: "rgba(255,255,255,0.18)",
                                    }}
                                />

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        dismissFenceHintForever();
                                    }}
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        color: "#ffffff",
                                        cursor: "pointer",
                                        fontSize: 16,
                                        lineHeight: 1,
                                        width: 36,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                    aria-label="Sluiten"
                                >
                                    ×
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
            {confirmModal && (() => {
                // ---------- CHANGE TYPE (plantbed -> ander type met gekoppelde planten) ----------
                if (confirmModal.kind === "change-plantbed-type") {
                    const plantbedNo = confirmModal.plantbedNo ?? "[nr]";
                    const plantIds = confirmModal.plantIds ?? [];
                    const nextType = confirmModal.nextType;

                    const items = plantIds
                        .map((pid: string) => {
                            const p = getPlantById(pid);
                            if (!p) return null;
                            return {
                                id: p.id,
                                nr: p.nr,
                                title: p.latin,
                                subtitle: p.dutch,
                            };
                        })
                        .filter(Boolean) as { id: string; nr?: number | string; title: string; subtitle?: string }[];

                    const count = items.length;
                    const toLabel = TYPE_LABELS[nextType] ?? nextType;

                    const description =
                        count === 1 ? (
                            <>
                                Aan dit plantvak is <strong>1 plant gekoppeld</strong>.<br />
                                Als u het type wijzigt naar <strong>{toLabel}</strong>, wordt deze koppeling verwijderd.
                            </>
                        ) : (
                            <>
                                Aan dit plantvak zijn <strong>{count} planten gekoppeld</strong>.<br />
                                Als u het type wijzigt naar <strong>{toLabel}</strong>, worden deze koppelingen verwijderd.
                            </>
                        );

                    return (
                        <ConfirmModal
                            open={true}
                            title={`Plantvak ${plantbedNo} wijzigen naar ${toLabel}?`}
                            description={description}
                            items={items}
                            maxPreviewItems={3}
                            moreLabel={(n) => `+ ${n} andere`}
                            lessLabel="Minder weergeven"
                            cancelText="Nee, behouden"
                            confirmText="Ja, wijzigen"
                            onCancel={closeConfirmModal}
                            onConfirm={() => {
                                confirmModalPrimaryAction();
                                closeConfirmModal(); // ✅ veilig: als store 'm al cleared is dit een noop
                                notify({
                                    kind: "success",
                                    placement: "bottom-center",
                                    message: `Plantvak ${plantbedNo} gewijzigd naar '${toLabel}'`,
                                });
                            }}
                        />
                    );
                }

                // ---------- SINGLE ----------
                if (confirmModal.kind === "delete-plantbed") {
                    const plantbedNo = confirmModal.plantbedNo ?? "[nr]";
                    const plantIds = confirmModal.plantIds ?? [];

                    const items = plantIds
                        .map((pid: string) => {
                            const p = getPlantById(pid);
                            if (!p) return null;
                            return {
                                id: p.id,
                                nr: p.nr,
                                title: p.latin,
                                subtitle: p.dutch,
                            };
                        })
                        .filter(Boolean) as { id: string; nr?: number | string; title: string; subtitle?: string }[];

                    const count = items.length;

                    const description =
                        count === 1 ? (
                            <>
                                Aan dit plantvak is <strong>1 plant gekoppeld</strong>.<br />
                                Als u dit plantvak verwijdert, wordt deze koppeling ook verwijderd.
                            </>
                        ) : (
                            <>
                                Aan dit plantvak zijn <strong>{count} planten gekoppeld</strong>.<br />
                                Als u dit plantvak verwijdert, worden deze koppelingen ook verwijderd.
                            </>
                        );

                    return (
                        <ConfirmModal
                            open={true}
                            title={`Plantvak ${plantbedNo} verwijderen?`}
                            description={description}
                            items={items}
                            maxPreviewItems={3}
                            moreLabel={(n) => `+ ${n} andere`}
                            lessLabel="Minder weergeven"
                            cancelText="Nee, behouden"
                            confirmText="Ja, verwijderen"
                            onCancel={closeConfirmModal}
                            onConfirm={() => {
                                confirmModalPrimaryAction();
                                closeConfirmModal(); // ✅ popup sluiten
                                notify({
                                    kind: "success",
                                    placement: "bottom-center",
                                    message: `Plantvak ${plantbedNo} verwijderd`,
                                });

                            }}
                        />
                    );
                }

                // ---------- MULTI ----------
                if (confirmModal.kind === "delete-plantbeds") {
                    const modalItems: DeletePlantbedsModalItem[] = confirmModal.items ?? [];
                    const linkedPlantbedCount = modalItems.length;
                    const totalSelected = confirmModal.totalSelected ?? linkedPlantbedCount;

                    const description =
                        linkedPlantbedCount === 1 ? (
                            <>
                                U staat op het punt <strong>{totalSelected} objecten</strong> te verwijderen.<br />
                                In <strong>1</strong> plantvak zitten gekoppelde planten. Deze koppelingen worden ook verwijderd.
                            </>
                        ) : (
                            <>
                                U staat op het punt <strong>{totalSelected} objecten</strong> te verwijderen.<br />
                                In <strong>{linkedPlantbedCount}</strong> plantvakken zitten gekoppelde planten. Deze koppelingen worden ook verwijderd.
                            </>
                        );

                    const items = modalItems.map((it) => ({
                        id: it.plantbedId,
                        nr: it.plantbedNo ?? "?",
                        title: `Plantvak ${it.plantbedNo ?? "?"}`,
                        subtitle: `${it.linkedCount} gekoppelde planten`,
                    }));

                    return (
                        <ConfirmModal
                            open={true}
                            title={`Meerdere plantvakken verwijderen?`}
                            description={description}
                            items={items}
                            maxPreviewItems={3}
                            moreLabel={(n) => `+ ${n} andere`}
                            lessLabel="Minder weergeven"
                            cancelText="Nee, behouden"
                            confirmText="Ja, verwijderen"
                            onCancel={closeConfirmModal}
                            onConfirm={() => {
                                const removedNos = modalItems
                                    .map((x) => x.plantbedNo)
                                    .filter((n): n is number => typeof n === "number");

                                confirmModalPrimaryAction();
                                closeConfirmModal(); // ✅ popup sluiten

                                if (removedNos.length === 1) {
                                    notify({
                                        kind: "success",
                                        placement: "bottom-center",
                                        message: `Plantvak ${removedNos[0]} verwijderd`,
                                    });

                                } else if (removedNos.length > 1) {
                                    notify({
                                        kind: "success",
                                        placement: "bottom-center",
                                        message: `Plantvakken met gekoppelde planten verwijderd (${removedNos.join(", ")})`,
                                    });

                                } else {
                                    notify({
                                        kind: "success",
                                        placement: "bottom-center",
                                        message: `Plantvakken verwijderd`,
                                    });

                                }
                            }}
                        />
                    );
                }

                return null;
            })()}
            <DrawingsDashboardModal
                isOpen={isDrawingsDashboardOpen}
                drawings={editorDrawings.map((drawing: PersistedDrawingDocument) => {
                    const linkedPlantIds = new Set<string>();

                    Object.values(drawing.snapshot.plantbedLinks ?? {}).forEach((plantIds) => {
                        (plantIds ?? []).forEach((plantId) => linkedPlantIds.add(plantId));
                    });

                    return {
                        id: drawing.id,
                        name: drawing.name,
                        linkedPlantCount: linkedPlantIds.size,
                        totalPlantCount: plants.length,
                        createdAtLabel: getRelativeUpdatedAtLabel(drawing.updatedAt),
                        previewObjects: drawing.snapshot.objects ?? [],
                    };
                })}
                activeDrawingId={activeDrawingId}
                onClose={handleCloseDrawingsDashboard}
                showCloseButton={activeDrawingId !== null}
                onOpenCreate={() => handleOpenCreateDrawingModal("dashboard")}
                onOpenDrawing={handleOpenDrawingFromDashboard}
                onCreateDrawing={handleCreateDrawingFromDashboard}
                onDuplicateDrawing={handleDuplicateDrawingFromDashboard}
                onDeleteDrawing={handleDeleteDrawingFromDashboard}
                onRenameDrawing={handleRenameDrawingFromDashboard}
            />

            <CreateDrawingModal
                isOpen={isCreateDrawingOpen}
                onClose={() => {
                    setIsCreateDrawingOpen(false);
                    setIsDrawingsDashboardOpen(createDrawingOpenSource === "dashboard");
                    setIsFileMenuOpen(false);
                }}
                onSubmit={handleCreateDrawingFromDashboard}
                drawings={editorDrawings.map((drawing: PersistedDrawingDocument) => ({ name: drawing.name }))}
            />

            <AppNotificationsRenderer topLeftLeftOffset={topLeftNoticeLeft} />

            <div className="w-full relative z-50" style={{ height: HEADER_HEIGHT, background: COLORS.green }}>
                <FileMenuDropdown
                    isOpen={isFileMenuOpen}
                    onToggle={() => setIsFileMenuOpen((prev) => !prev)}
                    onClose={() => setIsFileMenuOpen(false)}
                    drawingName={activeDrawing?.name ?? "Nieuwe tekening"}
                    createdAtLabel={getCurrentDateTimeLabel(activeDrawing?.createdAt ?? null)}
                    createdByLabel="[account naam]"
                    onDrawingNameChange={(nextName) => {
                        if (!activeDrawingId) return false;

                        const duplicateExists = editorDrawings.some(
                            (drawing) =>
                                drawing.id !== activeDrawingId &&
                                drawing.name.trim().toLowerCase() === nextName.trim().toLowerCase()
                        );

                        if (duplicateExists) {
                            return false;
                        }

                        setEditorDrawings((prev) =>
                            prev.map((drawing) =>
                                drawing.id === activeDrawingId
                                    ? {
                                        ...drawing,
                                        name: nextName,
                                        updatedAt: new Date().toISOString(),
                                    }
                                    : drawing
                            )
                        );

                        return true;
                    }}
                    onNew={() => handleOpenCreateDrawingModal("editor")}
                    onOpen={handleOpenDrawingsDashboard}
                    onSave={handleManualSaveActiveDrawing}
                />
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: "#ffffff",
                        pointerEvents: "none"
                    }}
                >
                    <span
                        style={{
                            fontWeight: 600,
                            fontSize: 16
                        }}
                    >
                        [Projectnaam]
                    </span>

                    <span
                        style={{
                            fontSize: 14,
                            opacity: 0.85
                        }}
                    >
                        · {activeDrawing?.name ?? "Nieuwe tekening"}
                    </span>
                </div>

                <div
                    style={{
                        position: "absolute",
                        right: 16,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#ffffff",
                        fontSize: 12,
                        opacity: 0.9,
                        pointerEvents: "none",
                    }}
                >
                    {saveStatusLabel}
                </div>
            </div>


            <div className="flex w-full" style={{ height: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
                <div ref={leftMenuShellRef} className="relative z-40">
                    <LeftObjectsMenu
                        activeDrawType={activeDrawType}
                        activeTreebedVariant={activeTreebedDrawVariant}
                        onPickDrawType={(t) => {
                            clearSelection();
                            setIsBoxSelecting(false);
                            setSelectionBox(null);

                            setActiveDrawType(t);
                            setActiveTool("draw");

                            setDraftPoints([]);
                            setDraftRedoPoints([]);
                            setTreebedDraftPreviewPoint(null);

                            lastPreviewKeyRef.current = "";
                            pendingPreviewRef.current = null;
                            if (draftLineRef.current) draftLineRef.current.points([]);
                            if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);

                            const layer = draftLineRef.current?.getLayer?.() ?? draftPreviewLineRef.current?.getLayer?.();
                            if (layer) layer.batchDraw();
                        }}
                        onPickTreebedVariant={(variant) => {
                            clearSelection();
                            setIsBoxSelecting(false);
                            setSelectionBox(null);

                            setActiveTreebedDrawVariant(variant);
                            setActiveDrawType("treebed");
                            setActiveTool("draw");

                            setDraftPoints([]);
                            setDraftRedoPoints([]);
                            setTreebedDraftPreviewPoint(null);

                            lastPreviewKeyRef.current = "";
                            pendingPreviewRef.current = null;
                            if (draftLineRef.current) draftLineRef.current.points([]);
                            if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);

                            const layer = draftLineRef.current?.getLayer?.() ?? draftPreviewLineRef.current?.getLayer?.();
                            if (layer) layer.batchDraw();
                        }}
                    />
                </div>

                <div className="relative flex-1 min-w-0">
                    <div className="fixed left-1/2 z-50 -translate-x-1/2 flex flex-col items-center gap-2" style={{ top: HEADER_HEIGHT + TOOLBAR_OFFSET }}>
                        <EditorToolbar
                            activeTool={activeTool}
                            onSelectTool={(tool) => {
                                setActiveTool(tool);

                                if (tool === "cut") {
                                    clearSelection();
                                }

                                if (tool !== "draw") {
                                    setActiveDrawType(null);
                                }
                            }}
                            onUndo={handleUndo}
                            onRedo={handleRedo}
                            onZoomIn={() => {
                                const stage = stageRef.current;
                                const pointer = stage?.getPointerPosition();
                                const oldScale = stageScaleRef.current;
                                const step = 0.1 * BASE_SCALE;
                                const clamped = clamp(Math.round((oldScale + step) * 1000) / 1000, 0.2, 4);

                                if (!pointer) {
                                    scheduleViewportState({ scale: clamped });
                                    return;
                                }

                                const oldPos = stagePosRef.current;
                                const mousePointTo = {
                                    x: (pointer.x - oldPos.x) / oldScale,
                                    y: (pointer.y - oldPos.y) / oldScale,
                                };

                                scheduleViewportState({
                                    scale: clamped,
                                    pos: {
                                        x: pointer.x - mousePointTo.x * clamped,
                                        y: pointer.y - mousePointTo.y * clamped,
                                    },
                                });
                            }}
                            onZoomOut={() => {
                                const stage = stageRef.current;
                                const pointer = stage?.getPointerPosition();
                                const oldScale = stageScaleRef.current;
                                const step = 0.1 * BASE_SCALE;
                                const clamped = clamp(Math.round((oldScale - step) * 1000) / 1000, 0.2, 4);

                                if (!pointer) {
                                    scheduleViewportState({ scale: clamped });
                                    return;
                                }

                                const oldPos = stagePosRef.current;
                                const mousePointTo = {
                                    x: (pointer.x - oldPos.x) / oldScale,
                                    y: (pointer.y - oldPos.y) / oldScale,
                                };

                                scheduleViewportState({
                                    scale: clamped,
                                    pos: {
                                        x: pointer.x - mousePointTo.x * clamped,
                                        y: pointer.y - mousePointTo.y * clamped,
                                    },
                                });
                            }}
                            onResetZoom={handleResetView}
                            zoomPercent={Math.round((stageScale / BASE_SCALE) * 100)}
                            onDelete={() => {
                                if (!selectedObjectId) return;
                                useProjectStore.getState().requestDeleteSelected();
                            }}
                            canDelete={Boolean(selectedObjectId)}
                        />
                    </div>

                    <div className="relative z-40">
                        <PlantSidebar />
                    </div>

                    <CanvasScaleSummary
                        leftOffset={topLeftNoticeLeft}
                        bottomOffset={18}
                        stageScale={stageScale}
                        gridSize={GRID_SIZE}
                        objects={objects}
                        selectedObjectId={selectedObjectId}
                        selectedObjectIds={selectedObjectIds}
                        compassAssetName={`compass-${compassDirection}.svg`}
                        onCompassClick={handleRotateCanvasClockwise}
                    />

                    <div
                        ref={canvasWrapRef}
                        className="h-full w-full relative z-0 overflow-hidden"
                        style={{ background: COLORS.greenLight }}
                    >
                        <Stage
                            ref={stageRef}
                            width={canvasSize.w}
                            height={canvasSize.h}
                            scaleX={stageScale}
                            scaleY={stageScale}
                            x={stagePos.x}
                            y={stagePos.y}
                            onWheel={handleWheel}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseEnter={(e) => {
                                const evt = e.evt as MouseEvent;
                                lastPointerClientPosRef.current = {
                                    x: evt.clientX,
                                    y: evt.clientY,
                                };

                                if (!shouldShowCursorCrosshair) return;

                                const stage = stageRef.current;
                                if (!stage) return;

                                updateCursorCrosshairFromStage(
                                    stage,
                                    activeTool === "draw" ? activeDrawTypeRef.current : null
                                );
                            }}
                            onMouseLeave={() => {
                                clearCursorCrosshair();
                            }}
                            onDblClick={(e) => {
                                // ✅ Alleen fence/gate sluiten met echte dubbelklik
                                if (activeTool !== "draw") return;
                                if (!activeDrawType) return;
                                if (!isFenceOrGate(activeDrawType)) return;

                                // ✅ Native dblclick van browser/Konva is te ruim.
                                // Daarom alleen afronden als onze eigen click-delta kort genoeg was.
                                if (lastDrawClickDeltaRef.current > FENCE_GATE_DBLCLICK_MS) {
                                    return;
                                }

                                const currentDrawType = activeDrawTypeRef.current;
                                const currentViewVisibility = viewVisibilityRef.current;

                                if (!currentDrawType) {
                                    notify(APP_NOTIFICATIONS.chooseObjectTypeFirst());
                                    return;
                                }

                                const visibilityKey = getViewVisibilityKeyForType(currentDrawType);
                                if (!currentViewVisibility[visibilityKey]) {
                                    const label = getViewVisibilityLabelForType(currentDrawType);
                                    notify(APP_NOTIFICATIONS.drawingBlockedByViewToggle(label));
                                    return;
                                }

                                lastDblClickAtRef.current = performance.now();

                                e.cancelBubble = true;

                                const pts = draftPointsRef.current;

                                // minimaal 2 punten (1 segment) om überhaupt iets te kunnen sluiten
                                if (pts.length < 4) return;

                                // ==============================
                                // ✅ MERGE op endpoints (fence/gate)
                                // ==============================
                                const state = useProjectStore.getState();
                                const all = (state.objects ?? []) as PolyObject[];

                                const type = activeDrawType as "fence" | "gate";

                                const sameType = all.filter((o) => o.type === type);
                                const other = all.filter((o) => o.type !== type);

                                const { mergedPoints, removeIds } = mergeFenceOrGateEndpoints(type, pts, sameType);

                                // verwijder gemergde fences + voeg 1 nieuwe toe
                                const remainingSameType = sameType.filter((o) => !removeIds.includes(o.id));
                                const mergedObj: PolyObject = {
                                    id: nanoid(),
                                    type,
                                    points: mergedPoints,
                                } as any;

                                useProjectStore
                                    .getState()
                                    .setObjectsWithHistory([...other, ...remainingSameType, mergedObj], mergedObj.id);

                                // reset draft
                                setDraftPoints([]);
                                setDraftRedoPoints([]);

                                lastPreviewKeyRef.current = "";
                                pendingPreviewRef.current = null;

                                if (draftLineRef.current) draftLineRef.current.points([]);
                                if (draftPreviewLineRef.current) draftPreviewLineRef.current.points([]);

                                const layer = draftLineRef.current?.getLayer?.() ?? draftPreviewLineRef.current?.getLayer?.();
                                if (layer) layer.batchDraw();

                                setActiveTool("select");
                                setActiveDrawType(null);
                            }}
                            style={{
                                cursor: isPanning
                                    ? "grabbing"
                                    : activeTool === "hand"
                                        ? "grab"
                                        : activeTool === "select"
                                            ? "default"
                                            : activeTool === "draw" || activeTool === "cut"
                                                ? "crosshair"
                                                : mode === "draw"
                                                    ? "crosshair"
                                                    : "default",
                                overflow: "hidden",
                            }}
                        >

                            {(() => {
                                const {
                                    visibleObjects,
                                    selected,
                                    unselected,
                                    unselectedPlantbeds,
                                    unselectedNonPlantbeds,
                                } = sceneObjectBuckets;

                                return (
                                    <>
                                        <FastLayer listening={false}>
                                            <GridShape
                                                canvasW={canvasSize.w}
                                                canvasH={canvasSize.h}
                                                stageScale={stageScale}
                                                stagePos={stagePos}
                                                gridSize={GRID_SIZE}
                                            />
                                        </FastLayer>

                                        {/* =============== BASE FILL LAYER (fills, nooit wissen) =============== */}
                                        <Layer>
                                            {/* Fills voor unselected non-plantbeds (GEEN stroke!) */}
                                            {unselectedNonPlantbeds.map((obj) => {
                                                const hasHoles = (obj.holes?.length ?? 0) > 0;
                                                const lineOnly = isFenceOrGate(obj.type);
                                                const lineW = getLineStrokeWidth(obj.type);
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

                                                        if (activeTool === "draw" || activeTool === "cut") st.container().style.cursor = "crosshair";
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
                                                                    : activeTool === "draw" || activeTool === "cut"
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

                                                // ✅ Line-only (schutting/hek):
                                                // Visueel NOOIT als polygon fill renderen.
                                                // Alleen een invisible hit-catcher in de fill layer.
                                                if (lineOnly) {
                                                    const visualPoints = getOneSidedPolylineRenderPoints(
                                                        obj.points,
                                                        lineW,
                                                        obj.renderSide ?? inferPolylineRenderSide(obj.points, obj.type, objects, 1)
                                                    );

                                                    const hitStrokeWidth = Math.max(lineW + 14, 24);

                                                    return (
                                                        <React.Fragment key={`fencefill-${obj.id}`}>
                                                            <Line
                                                                key={`hit-${obj.id}`}
                                                                {...common}
                                                                points={visualPoints}
                                                                closed={false}
                                                                fillEnabled={false}
                                                                stroke="rgba(0,0,0,0)"
                                                                strokeWidth={hitStrokeWidth}
                                                                hitStrokeWidth={hitStrokeWidth}
                                                                lineCap="square"
                                                                lineJoin="miter"
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
                                                            {obj.type === "tiles"
                                                                ? renderTilesPattern(
                                                                    obj,
                                                                    `fill-pattern-${obj.id}`,
                                                                    stageScale,
                                                                    obj.points,
                                                                    obj.holes
                                                                )
                                                                : null}
                                                        </React.Fragment>
                                                    );
                                                }

                                                if (obj.type === "treebed") {
                                                    return null;
                                                }

                                                return (
                                                    <React.Fragment key={`fill-${obj.id}`}>
                                                        <Line
                                                            {...common}
                                                            points={obj.points}
                                                            closed
                                                            fill={isBuildingType(obj.type) ? undefined : OBJECT_STYLES[obj.type].fill}
                                                            fillEnabled
                                                            fillPriority={isBuildingType(obj.type) ? "pattern" : "color"}
                                                            fillPatternImage={
                                                                isBuildingType(obj.type)
                                                                    ? (getBuildingPatternCanvas(obj.type) as unknown as HTMLImageElement | undefined)
                                                                    : undefined
                                                            }
                                                            fillPatternRepeat={isBuildingType(obj.type) ? "repeat" : undefined}
                                                            strokeEnabled={false}
                                                        />
                                                        {obj.type === "tiles"
                                                            ? renderTilesPattern(obj, `fill-pattern-${obj.id}`, stageScale)
                                                            : null}
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
                                                    },
                                                    onMouseLeave: () => {
                                                        const st = stageRef.current;
                                                        if (!st) return;
                                                        st.container().style.cursor =
                                                            activeTool === "hand"
                                                                ? "grab"
                                                                : activeTool === "select"
                                                                    ? "default"
                                                                    : activeTool === "draw" || activeTool === "cut"
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
                                                                    fill={OBJECT_STYLES.plantbed.stroke}
                                                                    listening={false}
                                                                    perfectDrawEnabled={false}
                                                                />
                                                            );
                                                        })()}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </Layer>

                                        {/* =============== BASE STROKE LAYER (strokes + erase + dashed) =============== */}
                                        <Layer>
                                            {/* Strokes voor unselected non-plantbeds */}
                                            {unselectedNonPlantbeds.map((obj) => {
                                                const hasHoles = (obj.holes?.length ?? 0) > 0;
                                                const lineOnly = isFenceOrGate(obj.type);
                                                const lineW = getLineStrokeWidth(obj.type);

                                                if (hasHoles) {
                                                    return (
                                                        <PolygonWithHoles
                                                            key={`stroke-${obj.id}`}
                                                            points={obj.points}
                                                            holes={obj.holes}
                                                            fill={undefined}
                                                            stroke={OBJECT_STYLES[obj.type].stroke}
                                                            strokeWidth={2}
                                                            opacity={1}
                                                            listening={false}
                                                            perfectDrawEnabled={false}
                                                        />
                                                    );
                                                }

                                                if (lineOnly) {
                                                    const visualPoints = getOneSidedPolylineRenderPoints(
                                                        obj.points,
                                                        lineW,
                                                        obj.renderSide ?? inferPolylineRenderSide(obj.points, obj.type, objects, 1)
                                                    );

                                                    return (
                                                        <React.Fragment key={`stroke-${obj.id}`}>
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
                                                                strokeWidth={Math.max(1, lineW - 5)}
                                                                lineCap="square"
                                                                lineJoin="miter"
                                                                listening={false}
                                                                perfectDrawEnabled={false}
                                                                opacity={1}
                                                            />
                                                        </React.Fragment>
                                                    );
                                                }

                                                if (obj.type === "treebed") {
                                                    return null;
                                                }

                                                return (
                                                    <Line
                                                        key={`stroke-${obj.id}`}
                                                        points={obj.points}
                                                        closed
                                                        fillEnabled={false}
                                                        stroke={OBJECT_STYLES[obj.type].stroke}
                                                        strokeWidth={2}
                                                        lineCap="butt"
                                                        lineJoin="miter"
                                                        listening={false}
                                                        perfectDrawEnabled={false}
                                                        opacity={1}
                                                    />
                                                );
                                            })}
                                            {/* Erase PASS: snij alleen strokes weg bij plantbed-rand (fills zitten in andere layer => geen gap) */}
                                            {unselectedPlantbeds.map((pb) => (
                                                <Line
                                                    key={`pb-erase-${pb.id}`}
                                                    points={pb.points}
                                                    closed
                                                    fillEnabled={false}
                                                    stroke="black"
                                                    strokeWidth={3}                 // ✅ klein beetje > 2
                                                    lineCap="butt"
                                                    lineJoin="miter"
                                                    listening={false}
                                                    perfectDrawEnabled={false}
                                                    globalCompositeOperation="destination-out"
                                                    opacity={1}
                                                />
                                            ))}

                                            {/* Plantbed dashed outline bovenop */}
                                            {getPlantbedOutlineSegments(
                                                unselectedPlantbeds.filter((pb) => dragOverPlantbedId !== pb.id)
                                            ).map((seg, index) => (
                                                <Line
                                                    key={`pb-dash-seg-${index}`}
                                                    points={seg}
                                                    closed={false}
                                                    fillEnabled={false}
                                                    stroke={OBJECT_STYLES.plantbed.stroke}
                                                    strokeWidth={2}
                                                    dash={[6, 4]}
                                                    dashEnabled
                                                    lineCap="butt"
                                                    lineJoin="miter"
                                                    listening={false}
                                                    perfectDrawEnabled={false}
                                                    opacity={1}
                                                />
                                            ))}

                                            {/* Fence/gate visueel altijd boven plantbed-outline houden */}
                                            {unselectedNonPlantbeds
                                                .filter((obj) => isFenceOrGate(obj.type))
                                                .map((obj) => {
                                                    const lineW = getLineStrokeWidth(obj.type);
                                                    const visualPoints = getOneSidedPolylineRenderPoints(
                                                        obj.points,
                                                        lineW,
                                                        obj.renderSide ?? inferPolylineRenderSide(obj.points, obj.type, objects, 1)
                                                    );

                                                    return (
                                                        <React.Fragment key={`boundary-overlay-${obj.id}`}>
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
                                                                strokeWidth={Math.max(1, lineW - 5)}
                                                                lineCap="square"
                                                                lineJoin="miter"
                                                                listening={false}
                                                                perfectDrawEnabled={false}
                                                                opacity={1}
                                                            />
                                                        </React.Fragment>
                                                    );
                                                })}
                                        </Layer>

                                        {!shouldHideHeavySceneDecorations && (
                                            <Layer listening={false}>
                                                <MeasurementOverlay
                                                    unselectedObjects={unselected}
                                                    selectedObjects={[]}
                                                    selectedObjectId={null}
                                                    stageScale={stageScale}
                                                    activeTool={"select"}
                                                    activeDrawType={activeDrawType}
                                                    draftPoints={[]}
                                                    draftMeasurementPoints={[]}
                                                    primaryMeasurementObject={null}
                                                    plantbedNumberLayouts={plantbedNumberLayouts}
                                                />
                                            </Layer>
                                        )}

                                        {/* =============== TOP LAYER (treebeds + selection + draft) =============== */}
                                        <Layer>
                                            {unselectedNonPlantbeds
                                                .filter((obj) => obj.type === "treebed")
                                                .map((obj) => {
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
                                                const pb = (objects as PolyObject[]).find((o) => o.id === dragOverPlantbedId && o.type === "plantbed");
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
                                                            selected.length > 0 && selected.every((o) => o.type === "treebed");

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
                                                            selected.length > 0 && selected.every((o) => o.type === "treebed");

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

                                                        const batch = selected.map((o) => {
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
                                                    {selected.map((obj) => (
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

                                                                        const next = [obj.id, ...ids.filter((x) => x !== obj.id)];
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

                                                                        const next = [obj.id, ...ids.filter((x) => x !== obj.id)];
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
                                                                                            workingHoles: livePolygonHoles.map((h) => [...h]),
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
                                                                                ? renderTilesPattern(
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

                                                                            {livePolygonHoles.map((holePts, holeIndex) =>
                                                                                renderSelectionContour(
                                                                                    holePts,
                                                                                    `${obj.id}-hole-contour-${holeIndex}`,
                                                                                    obj.id === selectedObjectId ? 4 : 3
                                                                                )
                                                                            )}

                                                                            {renderResizeEdgeHits(livePolygonPoints, null)}
                                                                            {livePolygonHoles.map((holePts, holeIndex) => renderResizeEdgeHits(holePts, holeIndex))}
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

                                                                        const next = [obj.id, ...ids.filter((x) => x !== obj.id)];
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
                                                                                                    workingHoles: (obj.holes ?? []).map((h) => [...h]),
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
                                                                if (!viewVisibility.showPlantNumbers) return null;

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

                                                                const uniqueHoleHandles = liveHoles.map((holePts, holeIdx) => {
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
                                                                                        workingHoles: liveHoles.map((h) => [...h]),
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

                                                                        {uniqueHoleHandles.map((holeHandles) =>
                                                                            holeHandles.map(({ i, x, y, holeIdx }) => (
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
                                                                                            workingHoles: liveHoles.map((h) => [...h]),
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

                                                                        let best: {
                                                                            midX: number;
                                                                            topY: number;
                                                                            isHorizontal: boolean;
                                                                            len: number;
                                                                        } | null = null;

                                                                        for (let i = 0; i <= visualPts.length - 4; i += 2) {
                                                                            const ax = visualPts[i];
                                                                            const ay = visualPts[i + 1];
                                                                            const bx = visualPts[i + 2];
                                                                            const by = visualPts[i + 3];

                                                                            const dx = bx - ax;
                                                                            const dy = by - ay;
                                                                            const len = Math.hypot(dx, dy);
                                                                            if (len < 1e-6) continue;

                                                                            const isHorizontal = Math.abs(dy) <= 1e-6;
                                                                            const segTopY = Math.min(ay, by);
                                                                            const midX = (ax + bx) / 2;

                                                                            if (!best) {
                                                                                best = { midX, topY: segTopY, isHorizontal, len };
                                                                                continue;
                                                                            }

                                                                            if (isHorizontal && !best.isHorizontal) {
                                                                                best = { midX, topY: segTopY, isHorizontal, len };
                                                                                continue;
                                                                            }

                                                                            if (isHorizontal === best.isHorizontal) {
                                                                                if (segTopY < best.topY - 1e-6) {
                                                                                    best = { midX, topY: segTopY, isHorizontal, len };
                                                                                    continue;
                                                                                }

                                                                                if (Math.abs(segTopY - best.topY) <= 1e-6 && len > best.len) {
                                                                                    best = { midX, topY: segTopY, isHorizontal, len };
                                                                                    continue;
                                                                                }
                                                                            }
                                                                        }

                                                                        if (best) {
                                                                            centerX = best.midX;
                                                                            anchorY = best.topY - ((LABEL_GAP_PX + lineW * 0.5) / stageScale);
                                                                        } else {
                                                                            const bb = bboxFromPoints(visualPts);
                                                                            centerX = bb.x + bb.w / 2;
                                                                            anchorY = bb.y - ((LABEL_GAP_PX + lineW * 0.5) / stageScale);
                                                                        }
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
                                                    {!shouldHideHeavySceneDecorations && (
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
                                                        />
                                                    )}
                                                </Group>
                                            )}

                                            {!shouldHideHeavySceneDecorations && (
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

                                                const previewPoints = createTreebedPointsFromCenterDrag(
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

                                        <Layer listening={false}>
                                            {selectionBox && (
                                                <Rect
                                                    x={selectionBox.x}
                                                    y={selectionBox.y}
                                                    width={selectionBox.w}
                                                    height={selectionBox.h}
                                                    stroke={COLORS.orange}
                                                    strokeWidth={1}
                                                    dash={[6, 4]}
                                                    fill={COLORS.orangeLight}
                                                    opacity={0.35}
                                                    listening={false}
                                                />
                                            )}
                                        </Layer>
                                    </>
                                );
                            })()}
                        </Stage>
                    </div>
                </div>
            </div>
        </div>

    );
}

// ==============================
// ✅ 1 centrale label component
// ==============================

const LABEL_UI = {
    // Pas ALLES hier aan (één plek)
    paddingX: 28,
    paddingY: 20,
    gap: 30,
    radius: 14,

    fontSizeTitle: 24,
    fontWeightTitle: 700,

    fontSizeAction: 20,
    fontWeightAction: 400,

    swatchSize: 18,
    swatchRadius: 3,

    badgeSize: 28,
    badgeFontSize: 14,

    shadow: "0px 3px 8px 0px rgba(0,0,0,0.25)",
    borderColor: "#E3E2E2",
};

function TypeLabelCard(props: {
    currentType: ObjectType;
    currentTreebedVariant?: TreebedVariant;
    labelText: string;
    badgeCount: number | null;

    // ✅ Alleen bij single-select interactief
    interactive?: boolean;
    onDuplicate?: () => void;
    onChangeType?: (t: ObjectType) => void;
    onChangeTreebedVariant?: (variant: TreebedVariant) => void;
    onTreebedVariantChanged?: (fromVariant: TreebedVariant, toVariant: TreebedVariant) => void;
}) {
    const {
        currentType,
        currentTreebedVariant = "standard",
        labelText,
        badgeCount,
        interactive = false,
        onDuplicate,
        onChangeType,
        onChangeTreebedVariant,
        onTreebedVariantChanged,
    } = props;

    const [open, setOpen] = React.useState(false);
    const [hoverType, setHoverType] = React.useState<ObjectType | TreebedVariant | null>(null);

    React.useEffect(() => {
        if (!open) return;
        const onDown = () => setOpen(false);
        window.addEventListener("mousedown", onDown);
        return () => window.removeEventListener("mousedown", onDown);
    }, [open]);

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
        const ondergrond: ObjectType[] = ["grass", "tiles", "gravel", "sand", "water", "wood", "patio"];
        const gebouwen: ObjectType[] = ["house", "garage", "shed", "garden_house", "carport", "veranda", "canopy"];
        const afbakening: ObjectType[] = ["fence", "gate"];
        const beplanting: ObjectType[] = ["plantbed", "treebed"];

        const isAfbakening = currentType === "fence" || currentType === "gate";
        const isTreebed = currentType === "treebed";

        if (isAfbakening) {
            return [{ title: "Afbakening", items: afbakening }];
        }

        if (isTreebed) {
            return [];
        }

        return [
            { title: "Beplanting", items: beplanting.filter((t) => t !== "treebed") },
            { title: "Ondergrond", items: ondergrond },
            { title: "Gebouwen", items: gebouwen },
        ];
    }, [currentType]);

    const GROUPS_FILTERED = React.useMemo(() => {
        return GROUPS
            .map((g) => ({ ...g, items: g.items.filter((t) => t !== currentType) }))
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
        const s = OBJECT_STYLES[type];

        const isBuilding =
            type === "house" ||
            type === "garage" ||
            type === "shed" ||
            type === "garden_house" ||
            type === "carport" ||
            type === "veranda" ||
            type === "canopy";

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

    const actionButtonStyle: React.CSSProperties = {
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

    const dividerStyle: React.CSSProperties = {
        width: 1,
        alignSelf: "stretch",
        background: LABEL_UI.borderColor,
        opacity: 1,
    };

    return (
        <div className="relative" style={{ display: "inline-flex" }}>
            <div
                className="flex items-center border"
                style={{
                    background: "#ffffff",
                    borderColor: LABEL_UI.borderColor,
                    padding: `${LABEL_UI.paddingY}px ${LABEL_UI.paddingX}px`,
                    gap: LABEL_UI.gap,
                    borderRadius: LABEL_UI.radius,
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
                                    background: COLORS.orange,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#ffffff",
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
                                setOpen((v) => !v);
                            }}
                        >
                            {currentType === "treebed" ? "Wijzig boomvorm" : "Wijzigen"}
                            <img
                                src="/icons/chevron-right.svg"
                                alt=""
                                style={{
                                    width: 14,
                                    height: 14,
                                    transform: open ? "rotate(90deg)" : "rotate(0deg)",
                                    transition: "transform 120ms ease",
                                }}
                            />
                        </button>
                    </>
                )}
            </div>

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

            {interactive && open && (
                <div
                    className="absolute rounded-xl border bg-white overflow-hidden z-50"
                    style={{
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
                                            setOpen(false);

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

                                {g.items.map((t) => {
                                    const hovered = hoverType === t;

                                    return (
                                        <button
                                            key={t}
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
                                            onMouseEnter={() => setHoverType(t)}
                                            onMouseLeave={() => setHoverType(null)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpen(false);
                                                onChangeType?.(t);
                                            }}
                                        >
                                            <Swatch type={t} />
                                            <span style={{ display: "flex", alignItems: "center", lineHeight: 1 }}>
                                                {TYPE_LABELS[t] ?? t}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}