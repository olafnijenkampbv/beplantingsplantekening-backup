import React, { useRef, useImperativeHandle, useEffect } from "react";
import { Circle, Shape } from "react-konva";
import type { PolyObject, TreebedVariant } from "@/state/projectStore";
import { clamp, bboxFromPoints, snapToGrid } from "@/features/editor/lib/editorCanvasMath";

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

export const TREEBED_MIN_SIZE = 20;
export const TREEBED_ESPALIER_MIN_HEIGHT = 100;
export const TREEBED_ESPALIER_WIDTH_RATIO = 0.18;

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

export type DynamicStrokeShapeHandle = {
    setPoints: (newPoints: number[]) => void;
};

export const DynamicStrokeShape = React.forwardRef<
    DynamicStrokeShapeHandle,
    {
        points: number[];
        stroke: string;
        strokeWidth: number;
        seedKey: string;
        closed?: boolean;
        listening?: boolean;
        dash?: number[];
        dashEnabled?: boolean;
        opacity?: number;
    }
>(function DynamicStrokeShape(
    {
        points,
        stroke,
        strokeWidth,
        seedKey,
        closed = true,
        listening = false,
        dash,
        dashEnabled,
        opacity,
    },
    ref
) {
    // Cache the sampled points: only recompute when this object's points actually change.
    // getDynamicStrokeSamplePoints is expensive (3 nested loops + noise math per edge segment).
    // Zustand maintains referential stability per object, so `points` only gets a new reference
    // when the object is actually modified — making this cache hit rate very high during interaction.
    const sampled = React.useMemo(
        () => getDynamicStrokeSamplePoints(points, seedKey, closed),
        [points, seedKey, closed]
    );

    // Mutable ref so sceneFunc always reads the latest sampled points without closure staleness.
    const sampledRef = useRef<DynamicStrokePoint[]>(sampled);
    const shapeRef = useRef<any>(null);

    useEffect(() => {
        sampledRef.current = sampled;
    }, [sampled]);

    useImperativeHandle(ref, () => ({
        setPoints(newPoints: number[]) {
            sampledRef.current = getDynamicStrokeSamplePoints(newPoints, seedKey, closed);
            shapeRef.current?.getLayer()?.batchDraw();
        },
    }));

    return (
        <Shape
            ref={shapeRef}
            listening={listening}
            perfectDrawEnabled={false}
            stroke={stroke}
            strokeWidth={strokeWidth}
            lineCap="round"
            lineJoin="round"
            dash={dash}
            dashEnabled={dashEnabled}
            opacity={opacity}
            sceneFunc={(ctx, shape) => {
                const s = sampledRef.current;
                if (s.length < 2) return;

                ctx.beginPath();

                if (closed) {
                    const last = s[s.length - 1];
                    const first = s[0];
                    const startMid = {
                        x: (last.x + first.x) / 2,
                        y: (last.y + first.y) / 2,
                    };

                    ctx.moveTo(startMid.x, startMid.y);

                    for (let i = 0; i < s.length; i += 1) {
                        const current = s[i];
                        const next = s[(i + 1) % s.length];
                        const mid = {
                            x: (current.x + next.x) / 2,
                            y: (current.y + next.y) / 2,
                        };

                        ctx.quadraticCurveTo(current.x, current.y, mid.x, mid.y);
                    }

                    ctx.closePath();
                } else {
                    ctx.moveTo(s[0].x, s[0].y);

                    if (s.length === 2) {
                        ctx.lineTo(s[1].x, s[1].y);
                    } else {
                        for (let i = 1; i < s.length - 1; i += 1) {
                            const current = s[i];
                            const next = s[i + 1];
                            const mid = {
                                x: (current.x + next.x) / 2,
                                y: (current.y + next.y) / 2,
                            };

                            ctx.quadraticCurveTo(current.x, current.y, mid.x, mid.y);
                        }

                        const penultimate = s[s.length - 2];
                        const last = s[s.length - 1];
                        ctx.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y);
                    }
                }

                ctx.fillStrokeShape(shape);
            }}
        />
    );
});

export function rotatePointQuarterTurnClockwise(
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

export function rotatePointsQuarterTurnClockwise(
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

export function createTreebedPointsFromCircle(
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

export function getTreebedBBox(points: number[]) {
    return bboxFromPoints(points);
}

export function createTreebedPointsFromRect(
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

export function normalizeRotationDeg(rotationDeg: number) {
    let next = rotationDeg % 360;
    if (next < 0) next += 360;
    return next;
}

export function rotatePointAround(
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

export function getTreebedRectRotationDeg(points: number[]) {
    if (!points || points.length < 8) return 0;

    const ax = points[0];
    const ay = points[1];
    const bx = points[2];
    const by = points[3];

    return normalizeRotationDeg((Math.atan2(by - ay, bx - ax) * 180) / Math.PI);
}

export function createRotatedTreebedRectPoints(
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

export function getTreebedVisual(
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

export function renderTreebedTrunks(
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

export function createTreebedPointsFromCenterDrag(
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

export function createTreebedPointsFromCornerDrag(
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

export function createEspalierPointsFromRotatedCornerDrag(
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

export function getTreebedResizeCorners(
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

export function getTreebedRotateCursorForAngleDeg(angleDeg: number) {
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

export function getTreebedRotateCursorFromPoint(
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

export function rotateObjectQuarterTurnClockwise(
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

