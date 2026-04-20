import ClipperLib from "clipper-lib";
import type { ObjectType, PolyObject } from "@/state/projectStore";
import { EDITOR_GRID_SIZE } from "@/features/editor/constants/editorGeometry";
import { isBoundaryObjectType } from "@/features/editor/components/editor/objectMenuConfig";
export const UNIFIED_BOUNDARY_TYPES = [
    "fence",
    "gate",
    "border_edge",
    "wall",
    "curb",
    "bollards",
    "poort",
] as const satisfies readonly ObjectType[];

export const LEGACY_LINE_BOUNDARY_TYPES = ["fence", "gate"] as const satisfies readonly ObjectType[];

const UNIFIED_BOUNDARY_TYPE_SET = new Set<ObjectType>(UNIFIED_BOUNDARY_TYPES);
const LEGACY_LINE_BOUNDARY_TYPE_SET = new Set<ObjectType>(LEGACY_LINE_BOUNDARY_TYPES);

function snapToBoundaryCellCenter(value: number, gridSize: number) {
    return Math.round((value - gridSize / 2) / gridSize) * gridSize + gridSize / 2;
}

function samePoint(ax: number, ay: number, bx: number, by: number, eps = 1e-6) {
    return Math.abs(ax - bx) <= eps && Math.abs(ay - by) <= eps;
}

function cleanupPolylinePoints(points: number[], eps = 1e-6) {
    if (!points || points.length < 2) return [];

    const out: number[] = [];

    for (let i = 0; i < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];
        const n = out.length;

        if (n >= 2 && samePoint(out[n - 2], out[n - 1], x, y, eps)) continue;
        out.push(x, y);
    }

    return out;
}

function cleanupPolygonPoints(points: number[], eps = 1e-6) {
    if (!points || points.length < 6) return points ?? [];

    const eq = (a: number, b: number) => Math.abs(a - b) <= eps;

    const same = (ax: number, ay: number, bx: number, by: number) =>
        eq(ax, bx) && eq(ay, by);

    const isCollinear = (
        ax: number,
        ay: number,
        bx: number,
        by: number,
        cx: number,
        cy: number
    ) => {
        const abx = bx - ax;
        const aby = by - ay;
        const bcx = cx - bx;
        const bcy = cy - by;
        const cross = abx * bcy - aby * bcx;
        return Math.abs(cross) <= eps;
    };

    const deduped: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];
        const n = deduped.length;

        if (n >= 2 && same(deduped[n - 2], deduped[n - 1], x, y)) continue;
        deduped.push(x, y);
    }

    if (deduped.length >= 4) {
        const fx = deduped[0];
        const fy = deduped[1];
        const lx = deduped[deduped.length - 2];
        const ly = deduped[deduped.length - 1];

        if (same(fx, fy, lx, ly)) {
            deduped.splice(deduped.length - 2, 2);
        }
    }

    let out = deduped;
    let changed = true;

    while (changed && out.length >= 8) {
        changed = false;
        const nPts = out.length / 2;
        const next: number[] = [];

        for (let i = 0; i < nPts; i++) {
            const ip = (i - 1 + nPts) % nPts;
            const inx = (i + 1) % nPts;

            const ax = out[ip * 2];
            const ay = out[ip * 2 + 1];
            const bx = out[i * 2];
            const by = out[i * 2 + 1];
            const cx = out[inx * 2];
            const cy = out[inx * 2 + 1];

            if (isCollinear(ax, ay, bx, by, cx, cy)) {
                changed = true;
                continue;
            }

            next.push(bx, by);
        }

        out = next;
    }

    return out.length >= 6 ? out : points;
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

function getPoint(points: number[], index: number) {
    return {
        x: points[index * 2],
        y: points[index * 2 + 1],
    };
}

function buildSegmentNormals(points: number[]) {
    const pointCount = points.length / 2;
    const normals: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < pointCount - 1; i++) {
        const a = getPoint(points, i);
        const b = getPoint(points, i + 1);

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

    return normals;
}

function buildOffsetPolyline(
    points: number[],
    offset: number,
    _gridSize = EDITOR_GRID_SIZE
) {
    if (!points || points.length < 4) return points ?? [];

    const cleaned = cleanupPolylinePoints(points);
    const pointCount = cleaned.length / 2;
    if (pointCount < 2) return cleaned;

    const normals = buildSegmentNormals(cleaned);
    const out: number[] = [];

    for (let i = 0; i < pointCount; i++) {
        const p = getPoint(cleaned, i);

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

        const prevPoint = getPoint(cleaned, i - 1);
        const nextPoint = getPoint(cleaned, i + 1);

        const prevDx = p.x - prevPoint.x;
        const prevDy = p.y - prevPoint.y;
        const nextDx = nextPoint.x - p.x;
        const nextDy = nextPoint.y - p.y;

        const turnCross = prevDx * nextDy - prevDy * nextDx;
        const isOuterJoin = turnCross * offset < 0;

        const prevOffsetX = p.x + prev.x * offset;
        const prevOffsetY = p.y + prev.y * offset;
        const nextOffsetX = p.x + next.x * offset;
        const nextOffsetY = p.y + next.y * offset;

        const a1x = prevPoint.x + prev.x * offset;
        const a1y = prevPoint.y + prev.y * offset;
        const a2x = prevOffsetX;
        const a2y = prevOffsetY;

        const b1x = nextOffsetX;
        const b1y = nextOffsetY;
        const b2x = nextPoint.x + next.x * offset;
        const b2y = nextPoint.y + next.y * offset;

        const hit = lineIntersection(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y);

        if (hit) {
            if (!isOuterJoin) {
                out.push(hit.x, hit.y);
                continue;
            }

            const miterLimit = Math.abs(offset) * 2;
            const miterLength = Math.hypot(hit.x - p.x, hit.y - p.y);

            if (miterLength <= miterLimit) {
                out.push(hit.x, hit.y);
                continue;
            }

            const bevelExtension = Math.abs(offset);

            const prevLen = Math.hypot(prevDx, prevDy);
            const nextLen = Math.hypot(nextDx, nextDy);

            if (prevLen < 1e-9 || nextLen < 1e-9) {
                out.push(prevOffsetX, prevOffsetY);
                out.push(nextOffsetX, nextOffsetY);
                continue;
            }

            const prevUx = prevDx / prevLen;
            const prevUy = prevDy / prevLen;
            const nextUx = nextDx / nextLen;
            const nextUy = nextDy / nextLen;

            const prevBevelX = prevOffsetX + prevUx * bevelExtension;
            const prevBevelY = prevOffsetY + prevUy * bevelExtension;
            const nextBevelX = nextOffsetX - nextUx * bevelExtension;
            const nextBevelY = nextOffsetY - nextUy * bevelExtension;

            out.push(prevBevelX, prevBevelY);
            out.push(nextBevelX, nextBevelY);
            continue;
        }

        if (isOuterJoin) {
            out.push(prevOffsetX, prevOffsetY);
            out.push(nextOffsetX, nextOffsetY);
            continue;
        }

        const avgX = prev.x + next.x;
        const avgY = prev.y + next.y;
        const avgLen = Math.hypot(avgX, avgY);

        if (avgLen < 1e-9) {
            out.push(prevOffsetX, prevOffsetY);
            continue;
        }

        const scale = offset / avgLen;

        out.push(
            p.x + avgX * scale,
            p.y + avgY * scale
        );
    }

    return out;
}

function reversePolylinePoints(points: number[]) {
    const out: number[] = [];
    for (let i = points.length - 2; i >= 0; i -= 2) {
        out.push(points[i], points[i + 1]);
    }
    return out;
}

const CLIPPER_SCALE = 1000;

function toClipperPath(points: number[]) {
    const path: Array<{ X: number; Y: number }> = [];
    for (let i = 0; i < points.length; i += 2) {
        path.push({
            X: Math.round(points[i] * CLIPPER_SCALE),
            Y: Math.round(points[i + 1] * CLIPPER_SCALE),
        });
    }
    return path;
}

function pathToPoints(path: Array<{ X: number; Y: number }>) {
    const points: number[] = [];
    for (const point of path) {
        points.push(point.X / CLIPPER_SCALE, point.Y / CLIPPER_SCALE);
    }
    return points;
}

function getPathAreaAbs(path: Array<{ X: number; Y: number }>) {
    return Math.abs(ClipperLib.Clipper.Area(path));
}

function isClosedBoundaryCenterline(points: number[]) {
    if (!points || points.length < 8) return false;

    return samePoint(
        points[0],
        points[1],
        points[points.length - 2],
        points[points.length - 1]
    );
}

function getClosedBoundaryLoopPoints(points: number[]) {
    if (!isClosedBoundaryCenterline(points)) return points;

    return points.slice(0, -2);
}

function getClosedBoundaryBandShape(
    points: number[],
    type: ObjectType,
    gridSize = EDITOR_GRID_SIZE
) {
    const centerline = getBoundaryVertexPoints(points, gridSize);
    if (!centerline || centerline.length < 8) {
        return {
            outer: [],
            holes: [],
        };
    }

    const closedLoop = getClosedBoundaryLoopPoints(centerline);
    if (!closedLoop || closedLoop.length < 6) {
        return {
            outer: [],
            holes: [],
        };
    }

    const halfThickness = getBoundaryStrokeWidth(type, gridSize) / 2;
    const subjectPath = toClipperPath(closedLoop);

    const outerOffset = new ClipperLib.ClipperOffset();
    outerOffset.AddPath(
        subjectPath,
        ClipperLib.JoinType.jtMiter,
        ClipperLib.EndType.etClosedPolygon
    );

    const outerSolution = new ClipperLib.Paths();
    outerOffset.Execute(outerSolution, halfThickness * CLIPPER_SCALE);

    const innerOffset = new ClipperLib.ClipperOffset();
    innerOffset.AddPath(
        subjectPath,
        ClipperLib.JoinType.jtMiter,
        ClipperLib.EndType.etClosedPolygon
    );

    const innerSolution = new ClipperLib.Paths();
    innerOffset.Execute(innerSolution, -halfThickness * CLIPPER_SCALE);

    if (!outerSolution.length) {
        return {
            outer: [],
            holes: [],
        };
    }

    const outerPath = [...outerSolution].sort((a, b) => getPathAreaAbs(b) - getPathAreaAbs(a))[0];
    const holePaths = [...innerSolution]
        .filter((path) => path.length >= 3)
        .sort((a, b) => getPathAreaAbs(b) - getPathAreaAbs(a));

    return {
        outer: cleanupPolygonPoints(pathToPoints(outerPath)),
        holes: holePaths
            .map((path) => cleanupPolygonPoints(pathToPoints(path)))
            .filter((hole) => hole.length >= 6),
    };
}

export function getBoundaryBandShape(
    points: number[],
    type: ObjectType,
    gridSize = EDITOR_GRID_SIZE
) {
    if (!isUnifiedBoundaryType(type)) {
        return {
            outer: points ?? [],
            holes: [],
        };
    }

    if (!points || points.length < 4) {
        return {
            outer: [],
            holes: [],
        };
    }

    const centerline = getBoundaryVertexPoints(points, gridSize);

    if (isClosedBoundaryCenterline(centerline)) {
        return getClosedBoundaryBandShape(centerline, type, gridSize);
    }

    const halfThickness = getBoundaryStrokeWidth(type, gridSize) / 2;
    const cappedCenterline = extendBoundaryCenterlineEndCaps(centerline, halfThickness);

    const leftPath = buildOffsetPolyline(cappedCenterline, halfThickness);
    const rightPath = buildOffsetPolyline(cappedCenterline, -halfThickness);

    if (leftPath.length < 4 || rightPath.length < 4) {
        return {
            outer: [],
            holes: [],
        };
    }

    return {
        outer: cleanupPolygonPoints([...leftPath, ...reversePolylinePoints(rightPath)]),
        holes: [],
    };
}

function extendBoundaryCenterlineEndCaps(points: number[], extension: number) {
    const cleaned = cleanupPolylinePoints(points);
    const pointCount = cleaned.length / 2;

    if (pointCount < 2 || extension <= 0) return cleaned;

    const out = [...cleaned];

    const startX = cleaned[0];
    const startY = cleaned[1];
    const nextX = cleaned[2];
    const nextY = cleaned[3];

    const endX = cleaned[cleaned.length - 2];
    const endY = cleaned[cleaned.length - 1];
    const prevX = cleaned[cleaned.length - 4];
    const prevY = cleaned[cleaned.length - 3];

    const startDx = nextX - startX;
    const startDy = nextY - startY;
    const startLen = Math.hypot(startDx, startDy);

    const endDx = endX - prevX;
    const endDy = endY - prevY;
    const endLen = Math.hypot(endDx, endDy);

    if (startLen >= 1e-9) {
        out[0] = startX - (startDx / startLen) * extension;
        out[1] = startY - (startDy / startLen) * extension;
    }

    if (endLen >= 1e-9) {
        out[out.length - 2] = endX + (endDx / endLen) * extension;
        out[out.length - 1] = endY + (endDy / endLen) * extension;
    }

    return out;
}

function extendBoundaryCenterlineForFullCellCaps(points: number[], extension: number) {
    const cleaned = cleanupPolylinePoints(points);
    const pointCount = cleaned.length / 2;

    if (pointCount < 2 || extension <= 0) return cleaned;

    const startX = cleaned[0];
    const startY = cleaned[1];
    const nextX = cleaned[2];
    const nextY = cleaned[3];

    const endX = cleaned[cleaned.length - 2];
    const endY = cleaned[cleaned.length - 1];
    const prevX = cleaned[cleaned.length - 4];
    const prevY = cleaned[cleaned.length - 3];

    const startDx = nextX - startX;
    const startDy = nextY - startY;
    const startLen = Math.hypot(startDx, startDy);

    const endDx = endX - prevX;
    const endDy = endY - prevY;
    const endLen = Math.hypot(endDx, endDy);

    if (startLen < 1e-9 || endLen < 1e-9) return cleaned;

    const startUx = startDx / startLen;
    const startUy = startDy / startLen;
    const endUx = endDx / endLen;
    const endUy = endDy / endLen;

    const out = [...cleaned];

    out[0] = startX - startUx * extension;
    out[1] = startY - startUy * extension;

    out[out.length - 2] = endX + endUx * extension;
    out[out.length - 1] = endY + endUy * extension;

    return out;
}

export function isUnifiedBoundaryType(type: ObjectType): boolean {
    return UNIFIED_BOUNDARY_TYPE_SET.has(type) || isBoundaryObjectType(type);
}

export function isLegacyLineBoundaryType(type: ObjectType): boolean {
    return LEGACY_LINE_BOUNDARY_TYPE_SET.has(type);
}

export function getBoundaryStrokeWidth(_type: ObjectType, gridSize = EDITOR_GRID_SIZE) {
    return gridSize;
}

export function getBoundarySnapPoint(
    rawX: number,
    rawY: number,
    gridSize = EDITOR_GRID_SIZE
) {
    return {
        x: snapToBoundaryCellCenter(rawX, gridSize),
        y: snapToBoundaryCellCenter(rawY, gridSize),
    };
}

export function getBoundaryVertexPoints(
    points: number[],
    gridSize = EDITOR_GRID_SIZE
) {
    if (!points || points.length < 2) return points ?? [];

    const out: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
        out.push(
            snapToBoundaryCellCenter(points[i], gridSize),
            snapToBoundaryCellCenter(points[i + 1], gridSize)
        );
    }

    return cleanupPolylinePoints(out);
}

export function getBoundaryBandPoints(
    points: number[],
    type: ObjectType,
    gridSize = EDITOR_GRID_SIZE
): number[] {
    return getBoundaryBandShape(points, type, gridSize).outer;
}

export function inferBoundaryRenderSide(
    _points: number[],
    _type: ObjectType,
    _objects: PolyObject[],
    fallback: 1 | -1 = 1
): 1 | -1 {
    return fallback;
}

export function getBoundaryPreviewGuidePoints(
    points: number[],
    type: ObjectType,
    gridSize = EDITOR_GRID_SIZE
) {
    return getBoundaryBandPoints(points, type, gridSize);
}

export function inferPolylineRenderSide(
    points: number[],
    type: ObjectType,
    objects: PolyObject[],
    fallback: 1 | -1 = 1
): 1 | -1 {
    return inferBoundaryRenderSide(points, type, objects, fallback);
}

export function getOneSidedPolylineRenderPoints(
    points: number[],
    strokeWidth: number,
    side: 1 | -1 = 1,
    gridSize = EDITOR_GRID_SIZE
) {
    if (!points || points.length < 2) return points ?? [];
    const centerline = getBoundaryVertexPoints(points, gridSize);
    if (centerline.length < 4) return centerline;

    const cappedCenterline = extendBoundaryCenterlineEndCaps(
        centerline,
        strokeWidth / 2
    );

    return buildOffsetPolyline(cappedCenterline, (strokeWidth / 2) * side, gridSize);
}

export function getBoundaryPreviewOutlinePaths(
    points: number[],
    type: ObjectType,
    gridSize = EDITOR_GRID_SIZE
) {
    if (!isUnifiedBoundaryType(type)) {
        return {
            topPath: points,
            bottomPath: [],
        };
    }

    const centerline = getBoundaryVertexPoints(points, gridSize);
    if (!centerline || centerline.length < 4) {
        return {
            topPath: [],
            bottomPath: [],
        };
    }

    const halfThickness = getBoundaryStrokeWidth(type, gridSize) / 2;
    const cappedCenterline = extendBoundaryCenterlineEndCaps(centerline, halfThickness);

    return {
        topPath: buildOffsetPolyline(cappedCenterline, halfThickness, gridSize),
        bottomPath: buildOffsetPolyline(cappedCenterline, -halfThickness, gridSize),
    };
}

function mergeSameEndpointPolyline(
    merged: number[],
    op: number[],
    mode: "end-start" | "end-end" | "start-end" | "start-start"
) {
    if (mode === "end-start") {
        return merged.concat(op.slice(2));
    }

    if (mode === "end-end") {
        const ro = reversePolylinePoints(op);
        return merged.concat(ro.slice(2));
    }

    if (mode === "start-end") {
        return op.concat(merged.slice(2));
    }

    const ro = reversePolylinePoints(op);
    return ro.concat(merged.slice(2));
}

export function mergeFenceOrGateEndpoints(
    type: "fence" | "gate",
    newPoints: number[],
    objects: PolyObject[]
) {
    let merged = [...newPoints];
    const removeIds: string[] = [];

    while (true) {
        const nsx = merged[0];
        const nsy = merged[1];
        const nex = merged[merged.length - 2];
        const ney = merged[merged.length - 1];

        let didMerge = false;

        for (const o of objects) {
            if (o.type !== type) continue;
            if (removeIds.includes(o.id)) continue;

            const op = cleanupPolylinePoints(o.points);
            if (!op || op.length < 4) continue;

            const osx = op[0];
            const osy = op[1];
            const oex = op[op.length - 2];
            const oey = op[op.length - 1];

            if (samePoint(nex, ney, osx, osy)) {
                merged = mergeSameEndpointPolyline(merged, op, "end-start");
                removeIds.push(o.id);
                didMerge = true;
                break;
            }

            if (samePoint(nex, ney, oex, oey)) {
                merged = mergeSameEndpointPolyline(merged, op, "end-end");
                removeIds.push(o.id);
                didMerge = true;
                break;
            }

            if (samePoint(nsx, nsy, oex, oey)) {
                merged = mergeSameEndpointPolyline(merged, op, "start-end");
                removeIds.push(o.id);
                didMerge = true;
                break;
            }

            if (samePoint(nsx, nsy, osx, osy)) {
                merged = mergeSameEndpointPolyline(merged, op, "start-start");
                removeIds.push(o.id);
                didMerge = true;
                break;
            }
        }

        if (!didMerge) break;
    }

    return {
        mergedPoints: cleanupPolylinePoints(merged),
        removeIds,
    };
}