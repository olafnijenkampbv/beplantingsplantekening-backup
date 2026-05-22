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

function getOpenBoundaryBandShapeFromSegments(
    points: number[],
    type: ObjectType,
    gridSize = EDITOR_GRID_SIZE
) {
    const centerline = getBoundaryVertexPoints(points, gridSize);
    const halfThickness = getBoundaryStrokeWidth(type, gridSize) / 2;

    if (!centerline || centerline.length < 4) {
        return {
            outer: [],
            holes: [],
        };
    }

    const cappedCenterline = extendBoundaryCenterlineForFullCellCaps(
        centerline,
        halfThickness
    );

    const leftPath = buildOffsetPolyline(cappedCenterline, halfThickness, gridSize);
    const rightPath = buildOffsetPolyline(cappedCenterline, -halfThickness, gridSize);

    if (leftPath.length < 4 || rightPath.length < 4) {
        return {
            outer: [],
            holes: [],
        };
    }

    return {
        outer: cleanupPolygonPoints([
            ...leftPath,
            ...reversePolylinePoints(rightPath),
        ]),
        holes: [],
    };
}

function getBoundaryRenderPointKey(x: number, y: number) {
    return `${Math.round(x * 1000) / 1000}:${Math.round(y * 1000) / 1000}`;
}

function getBoundarySegmentEndpointDegrees(segments: number[][]) {
    const degrees = new Map<string, number>();

    for (const segment of segments) {
        if (!segment || segment.length < 4) continue;

        const startKey = getBoundaryRenderPointKey(segment[0], segment[1]);
        const endKey = getBoundaryRenderPointKey(
            segment[segment.length - 2],
            segment[segment.length - 1]
        );

        degrees.set(startKey, (degrees.get(startKey) ?? 0) + 1);
        degrees.set(endKey, (degrees.get(endKey) ?? 0) + 1);
    }

    return degrees;
}

function createBoundarySegmentBandWithSmartCaps(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    halfThickness: number,
    extendStart: boolean,
    extendEnd: boolean
) {
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);

    if (length < 1e-9) return null;

    const ux = dx / length;
    const uy = dy / length;

    const nx = -uy;
    const ny = ux;

    const startX = extendStart ? ax - ux * halfThickness : ax;
    const startY = extendStart ? ay - uy * halfThickness : ay;
    const endX = extendEnd ? bx + ux * halfThickness : bx;
    const endY = extendEnd ? by + uy * halfThickness : by;

    return [
        startX + nx * halfThickness,
        startY + ny * halfThickness,

        endX + nx * halfThickness,
        endY + ny * halfThickness,

        endX - nx * halfThickness,
        endY - ny * halfThickness,

        startX - nx * halfThickness,
        startY - ny * halfThickness,
    ];
}

function createJunctionFillerPolygon(cx: number, cy: number, radius: number): number[] {
    const pts: number[] = [];
    const sides = 8;
    // Iterate in DECREASING angle to produce CW winding (math coords),
    // matching the winding of the boundary band rectangles so Clipper's
    // pftNonZero fill rule fills the overlap instead of punching a hole.
    for (let i = sides - 1; i >= 0; i--) {
        const angle = (i / sides) * Math.PI * 2;
        pts.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    return pts;
}

function getBoundaryPolyNodeChildren(node: any): any[] {
    if (!node) return [];

    if (Array.isArray(node.m_Childs)) return node.m_Childs;
    if (Array.isArray(node.Childs)) return node.Childs;

    if (typeof node.Childs === "function") {
        const children = node.Childs();
        return Array.isArray(children) ? children : [];
    }

    return [];
}

function getBoundaryPolyNodeContour(node: any): Array<{ X: number; Y: number }> | null {
    if (!node) return null;

    if (Array.isArray(node.Contour)) return node.Contour;
    if (Array.isArray(node.m_polygon)) return node.m_polygon;

    if (typeof node.Contour === "function") {
        const contour = node.Contour();
        return Array.isArray(contour) ? contour : null;
    }

    return null;
}

function isBoundaryPolyNodeHole(node: any) {
    if (!node) return false;
    if (typeof node.IsHole === "function") return Boolean(node.IsHole());
    return Boolean(node.IsHole);
}

function extractBoundaryShapeFromPolyTree(polyTree: any) {
    const pieces: Array<{ outer: number[]; holes: number[][] }> = [];
    const stack = getBoundaryPolyNodeChildren(polyTree);

    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;

        if (isBoundaryPolyNodeHole(node)) {
            continue;
        }

        const contour = getBoundaryPolyNodeContour(node);
        if (!contour || contour.length < 3) {
            getBoundaryPolyNodeChildren(node).forEach((child) => stack.push(child));
            continue;
        }

        const outer = cleanupPolygonPoints(pathToPoints(contour));
        if (outer.length < 6) {
            getBoundaryPolyNodeChildren(node).forEach((child) => stack.push(child));
            continue;
        }

        const holes: number[][] = [];

        for (const child of getBoundaryPolyNodeChildren(node)) {
            if (!child || !isBoundaryPolyNodeHole(child)) continue;

            const holeContour = getBoundaryPolyNodeContour(child);
            if (!holeContour || holeContour.length < 3) continue;

            const hole = cleanupPolygonPoints(pathToPoints(holeContour));
            if (hole.length >= 6) {
                holes.push(hole);
            }
        }

        pieces.push({
            outer,
            holes,
        });

        getBoundaryPolyNodeChildren(node).forEach((child) => {
            if (!isBoundaryPolyNodeHole(child)) {
                stack.push(child);
            }
        });
    }

    if (pieces.length === 0) {
        return {
            outer: [],
            holes: [],
        };
    }

    const sortedPieces = [...pieces].sort(
        (a, b) =>
            Math.abs(ClipperLib.Clipper.Area(toClipperPath(b.outer))) -
            Math.abs(ClipperLib.Clipper.Area(toClipperPath(a.outer)))
    );

    return {
        outer: sortedPieces[0].outer,
        holes: sortedPieces[0].holes,
    };
}

function unionBoundaryBandPolygons(bands: number[][]) {
    return unionBoundaryBandPolygonsWithCutouts(bands, []);
}

function unionBoundaryBandPolygonsWithCutouts(
    bands: number[][],
    cutouts: number[][] = []
) {
    if (bands.length === 0) {
        return {
            outer: [],
            holes: [],
        };
    }

    const clipper = new ClipperLib.Clipper();

    clipper.AddPaths(
        bands.map((band) => toClipperPath(band)) as any,
        ClipperLib.PolyType.ptSubject,
        true
    );

    const safeCutouts = cutouts.filter((cutout) => cutout.length >= 6);

    if (safeCutouts.length > 0) {
        clipper.AddPaths(
            safeCutouts.map((cutout) => toClipperPath(cutout)) as any,
            ClipperLib.PolyType.ptClip,
            true
        );
    }

    const polyTree = new (ClipperLib.PolyTree as any)();

    const ok = clipper.Execute(
        safeCutouts.length > 0
            ? ClipperLib.ClipType.ctDifference
            : ClipperLib.ClipType.ctUnion,
        polyTree as any,
        ClipperLib.PolyFillType.pftNonZero,
        ClipperLib.PolyFillType.pftNonZero
    );

    if (!ok) {
        return {
            outer: [],
            holes: [],
        };
    }

    return extractBoundaryShapeFromPolyTree(polyTree);
}

function subtractBoundaryBandCutouts(
    band: number[],
    cutouts: number[][]
): number[][] {
    const safeCutouts = cutouts.filter((cutout) => cutout.length >= 6);

    if (band.length < 6 || safeCutouts.length === 0) {
        return band.length >= 6 ? [band] : [];
    }

    const clipper = new ClipperLib.Clipper();

    clipper.AddPath(
        toClipperPath(band) as any,
        ClipperLib.PolyType.ptSubject,
        true
    );

    clipper.AddPaths(
        safeCutouts.map((cutout) => toClipperPath(cutout)) as any,
        ClipperLib.PolyType.ptClip,
        true
    );

    const solution = new ClipperLib.Paths();

    const ok = clipper.Execute(
        ClipperLib.ClipType.ctDifference,
        solution,
        ClipperLib.PolyFillType.pftNonZero,
        ClipperLib.PolyFillType.pftNonZero
    );

    if (!ok) return [band];

    return Array.from(solution as Array<{ X: number; Y: number }[]>)
        .map((path) => cleanupPolygonPoints(pathToPoints(path)))
        .filter((points) => points.length >= 6);
}

function extendBoundaryCenterlineCaps(
    points: number[],
    extension: number,
    extendStart: boolean,
    extendEnd: boolean
) {
    const cleaned = cleanupPolylinePoints(points);
    const pointCount = cleaned.length / 2;

    if (pointCount < 2 || extension <= 0) return cleaned;

    const out = [...cleaned];

    if (extendStart) {
        const startX = cleaned[0];
        const startY = cleaned[1];
        const nextX = cleaned[2];
        const nextY = cleaned[3];

        const dx = nextX - startX;
        const dy = nextY - startY;
        const length = Math.hypot(dx, dy);

        if (length >= 1e-9) {
            out[0] = startX - (dx / length) * extension;
            out[1] = startY - (dy / length) * extension;
        }
    }

    if (extendEnd) {
        const endX = cleaned[cleaned.length - 2];
        const endY = cleaned[cleaned.length - 1];
        const prevX = cleaned[cleaned.length - 4];
        const prevY = cleaned[cleaned.length - 3];

        const dx = endX - prevX;
        const dy = endY - prevY;
        const length = Math.hypot(dx, dy);

        if (length >= 1e-9) {
            out[out.length - 2] = endX + (dx / length) * extension;
            out[out.length - 1] = endY + (dy / length) * extension;
        }
    }

    return out;
}

function getBoundaryBandShapeFromChain(
    points: number[],
    type: ObjectType,
    gridSize: number,
    extendStart: boolean,
    extendEnd: boolean
) {
    const centerline = getBoundaryVertexPoints(points, gridSize);
    const halfThickness = getBoundaryStrokeWidth(type, gridSize) / 2;

    if (!centerline || centerline.length < 4) {
        return {
            outer: [],
            holes: [],
        };
    }

    const cappedCenterline = extendBoundaryCenterlineCaps(
        centerline,
        halfThickness,
        extendStart,
        extendEnd
    );

    const leftPath = buildOffsetPolyline(cappedCenterline, halfThickness, gridSize);
    const rightPath = buildOffsetPolyline(cappedCenterline, -halfThickness, gridSize);

    if (leftPath.length < 4 || rightPath.length < 4) {
        return {
            outer: [],
            holes: [],
        };
    }

    return {
        outer: cleanupPolygonPoints([
            ...leftPath,
            ...reversePolylinePoints(rightPath),
        ]),
        holes: [],
    };
}

type BoundaryRenderEdge = {
    id: string;
    aKey: string;
    bKey: string;
    a: { x: number; y: number };
    b: { x: number; y: number };
};

function getBoundaryRenderPointFromKey(key: string) {
    const [xRaw, yRaw] = key.split(":");
    return {
        x: Number(xRaw),
        y: Number(yRaw),
    };
}

function buildBoundaryRenderEdges(segments: number[][], gridSize: number) {
    const edgeMap = new Map<string, BoundaryRenderEdge>();

    for (const segment of segments) {
        const points = getBoundaryVertexPoints(segment, gridSize);
        if (points.length < 4) continue;

        for (let index = 0; index < points.length - 2; index += 2) {
            const ax = points[index];
            const ay = points[index + 1];
            const bx = points[index + 2];
            const by = points[index + 3];

            const aKey = getBoundaryRenderPointKey(ax, ay);
            const bKey = getBoundaryRenderPointKey(bx, by);

            if (aKey === bKey) continue;

            const edgeKey = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;

            if (!edgeMap.has(edgeKey)) {
                edgeMap.set(edgeKey, {
                    id: edgeKey,
                    aKey,
                    bKey,
                    a: { x: ax, y: ay },
                    b: { x: bx, y: by },
                });
            }
        }
    }

    return Array.from(edgeMap.values());
}

function buildBoundaryAdjacency(edges: BoundaryRenderEdge[]) {
    const adjacency = new Map<string, BoundaryRenderEdge[]>();

    for (const edge of edges) {
        if (!adjacency.has(edge.aKey)) adjacency.set(edge.aKey, []);
        if (!adjacency.has(edge.bKey)) adjacency.set(edge.bKey, []);

        adjacency.get(edge.aKey)!.push(edge);
        adjacency.get(edge.bKey)!.push(edge);
    }

    return adjacency;
}

function getOtherBoundaryEdgeKey(edge: BoundaryRenderEdge, key: string) {
    return edge.aKey === key ? edge.bKey : edge.aKey;
}

function edgeToBoundaryPointPair(edge: BoundaryRenderEdge, startKey: string) {
    if (edge.aKey === startKey) {
        return [
            edge.a.x,
            edge.a.y,
            edge.b.x,
            edge.b.y,
        ];
    }

    return [
        edge.b.x,
        edge.b.y,
        edge.a.x,
        edge.a.y,
    ];
}

function buildBoundaryRenderChains(edges: BoundaryRenderEdge[]) {
    const adjacency = buildBoundaryAdjacency(edges);
    const visited = new Set<string>();
    const chains: Array<{
        points: number[];
        startDegree: number;
        endDegree: number;
    }> = [];

    const walkChain = (startKey: string, firstEdge: BoundaryRenderEdge) => {
        let currentKey = startKey;
        let edge = firstEdge;
        const chainPoints: number[] = [];
        const startDegree = adjacency.get(startKey)?.length ?? 0;

        while (edge && !visited.has(edge.id)) {
            visited.add(edge.id);

            const pair = edgeToBoundaryPointPair(edge, currentKey);

            if (chainPoints.length === 0) {
                chainPoints.push(...pair);
            } else {
                chainPoints.push(pair[2], pair[3]);
            }

            const nextKey = getOtherBoundaryEdgeKey(edge, currentKey);
            const nextEdges = adjacency.get(nextKey) ?? [];
            const nextDegree = nextEdges.length;

            if (nextDegree !== 2) {
                const endDegree = nextDegree;

                chains.push({
                    points: cleanupPolylinePoints(chainPoints),
                    startDegree,
                    endDegree,
                });

                return;
            }

            const nextEdge = nextEdges.find((candidate) => !visited.has(candidate.id));
            if (!nextEdge) {
                const endDegree = nextDegree;

                chains.push({
                    points: cleanupPolylinePoints(chainPoints),
                    startDegree,
                    endDegree,
                });

                return;
            }

            currentKey = nextKey;
            edge = nextEdge;
        }
    };

    for (const [key, connectedEdges] of adjacency.entries()) {
        const degree = connectedEdges.length;
        if (degree === 2) continue;

        for (const edge of connectedEdges) {
            if (visited.has(edge.id)) continue;
            walkChain(key, edge);
        }
    }

    for (const edge of edges) {
        if (visited.has(edge.id)) continue;

        const startKey = edge.aKey;
        walkChain(startKey, edge);
    }

    return chains.filter((chain) => chain.points.length >= 4);
}

function buildClosedBoundaryLoopFromDegreeTwoEdges(edges: BoundaryRenderEdge[]) {
    if (edges.length < 3) return null;

    const adjacency = buildBoundaryAdjacency(edges);
    const hasOnlyClosedLoopDegrees = Array.from(adjacency.values()).every(
        (connectedEdges) => connectedEdges.length === 2
    );

    if (!hasOnlyClosedLoopDegrees) return null;

    const visited = new Set<string>();
    const firstEdge = edges[0];
    const startKey = firstEdge.aKey;

    let currentKey = startKey;
    let currentEdge: BoundaryRenderEdge | undefined = firstEdge;

    const loopPoints: number[] = [];

    while (currentEdge && !visited.has(currentEdge.id)) {
        visited.add(currentEdge.id);

        const pair = edgeToBoundaryPointPair(currentEdge, currentKey);

        if (loopPoints.length === 0) {
            loopPoints.push(...pair);
        } else {
            loopPoints.push(pair[2], pair[3]);
        }

        const nextKey = getOtherBoundaryEdgeKey(currentEdge, currentKey);
        const nextEdges = adjacency.get(nextKey) ?? [];
        const nextEdge = nextEdges.find((edge) => !visited.has(edge.id));

        currentKey = nextKey;
        currentEdge = nextEdge;

        if (currentKey === startKey && visited.size === edges.length) {
            break;
        }
    }

    if (visited.size !== edges.length) return null;
    if (loopPoints.length < 6) return null;

    const firstX = loopPoints[0];
    const firstY = loopPoints[1];
    const lastX = loopPoints[loopPoints.length - 2];
    const lastY = loopPoints[loopPoints.length - 1];

    if (!samePoint(firstX, firstY, lastX, lastY)) {
        loopPoints.push(firstX, firstY);
    }

    return cleanupPolylinePoints(loopPoints);
}

function getBoundaryLoopKey(points: number[]) {
    const clean = cleanupPolylinePoints(points);
    const source =
        clean.length >= 8 &&
            samePoint(clean[0], clean[1], clean[clean.length - 2], clean[clean.length - 1])
            ? clean.slice(0, -2)
            : clean;

    const keys: string[] = [];

    for (let index = 0; index < source.length; index += 2) {
        keys.push(getBoundaryRenderPointKey(source[index], source[index + 1]));
    }

    if (keys.length < 3) return "";

    const rotations: string[] = [];

    for (let index = 0; index < keys.length; index += 1) {
        rotations.push([...keys.slice(index), ...keys.slice(0, index)].join("|"));
    }

    const reversed = [...keys].reverse();

    for (let index = 0; index < reversed.length; index += 1) {
        rotations.push([...reversed.slice(index), ...reversed.slice(0, index)].join("|"));
    }

    return rotations.sort()[0] ?? "";
}

function buildClosedBoundaryLoopsFromGraph(edges: BoundaryRenderEdge[]) {
    if (edges.length < 3) return [];

    const adjacency = buildBoundaryAdjacency(edges);
    const loopsByKey = new Map<
        string,
        {
            points: number[];
            edgeIds: Set<string>;
        }
    >();

    const maxDepth = Math.min(edges.length, 80);

    const walk = (
        startKey: string,
        currentKey: string,
        pointKeys: string[],
        edgeIds: string[],
        visitedEdgeIds: Set<string>
    ) => {
        if (edgeIds.length > maxDepth) return;

        const connectedEdges = adjacency.get(currentKey) ?? [];

        for (const edge of connectedEdges) {
            if (visitedEdgeIds.has(edge.id)) continue;

            const nextKey = getOtherBoundaryEdgeKey(edge, currentKey);

            if (nextKey === startKey && edgeIds.length >= 2) {
                const loopKeys = [...pointKeys, startKey];
                const points: number[] = [];

                for (const key of loopKeys) {
                    const point = getBoundaryRenderPointFromKey(key);
                    points.push(point.x, point.y);
                }

                const cleanedPoints = cleanupPolylinePoints(points);
                const loopKey = getBoundaryLoopKey(cleanedPoints);

                if (loopKey && !loopsByKey.has(loopKey)) {
                    loopsByKey.set(loopKey, {
                        points: cleanedPoints,
                        edgeIds: new Set([...edgeIds, edge.id]),
                    });
                }

                continue;
            }

            if (pointKeys.includes(nextKey)) continue;

            walk(
                startKey,
                nextKey,
                [...pointKeys, nextKey],
                [...edgeIds, edge.id],
                new Set([...visitedEdgeIds, edge.id])
            );
        }
    };

    for (const edge of edges) {
        walk(edge.aKey, edge.bKey, [edge.aKey, edge.bKey], [edge.id], new Set([edge.id]));
        walk(edge.bKey, edge.aKey, [edge.bKey, edge.aKey], [edge.id], new Set([edge.id]));
    }

    return Array.from(loopsByKey.values()).sort(
        (a, b) =>
            Math.abs(ClipperLib.Clipper.Area(toClipperPath(b.points))) -
            Math.abs(ClipperLib.Clipper.Area(toClipperPath(a.points)))
    );
}

function getBoundaryBandShapeFromSegmentList(
    segments: number[][],
    type: ObjectType,
    gridSize = EDITOR_GRID_SIZE
) {
    const edges = buildBoundaryRenderEdges(segments, gridSize);

    if (edges.length === 0) {
        return {
            outer: [],
            holes: [],
        };
    }

    const closedLoop = buildClosedBoundaryLoopFromDegreeTwoEdges(edges);
    if (closedLoop && closedLoop.length >= 8) {
        return getClosedBoundaryBandShape(closedLoop, type, gridSize);
    }

    if (edges.length === 1) {
        return getBoundaryBandShapeFromChain(
            [
                edges[0].a.x,
                edges[0].a.y,
                edges[0].b.x,
                edges[0].b.y,
            ],
            type,
            gridSize,
            true,
            true
        );
    }

    const halfThickness = getBoundaryStrokeWidth(type, gridSize) / 2;
    const adjacency = buildBoundaryAdjacency(edges);
    const hasJunction = Array.from(adjacency.values()).some(
        (connectedEdges) => connectedEdges.length > 2
    );

    const appendSegmentBands = (
        sourceEdges: BoundaryRenderEdge[],
        target: number[][]
    ) => {
        for (const edge of sourceEdges) {
            const startDegree = adjacency.get(edge.aKey)?.length ?? 1;
            const endDegree = adjacency.get(edge.bKey)?.length ?? 1;

            const band = createBoundarySegmentBandWithSmartCaps(
                edge.a.x,
                edge.a.y,
                edge.b.x,
                edge.b.y,
                halfThickness,
                startDegree <= 1,
                endDegree <= 1
            );

            if (band && band.length >= 6) {
                target.push(band);
            }
        }
    };

    const appendJunctionFillers = (target: number[][]) => {
        for (const [key, connectedEdges] of adjacency.entries()) {
            if (connectedEdges.length >= 3) {
                const jp = getBoundaryRenderPointFromKey(key);
                target.push(createJunctionFillerPolygon(jp.x, jp.y, halfThickness));
            }
        }
    };

    const graphLoops = buildClosedBoundaryLoopsFromGraph(edges);

    if (graphLoops.length > 0) {
        const loopEdgeIds = new Set<string>();
        const bandPolygons: number[][] = [];

        for (const loop of graphLoops) {
            for (const edgeId of loop.edgeIds) {
                loopEdgeIds.add(edgeId);
            }

            const loopBand = getClosedBoundaryBandShape(loop.points, type, gridSize);

            if (loopBand.outer.length >= 6) {
                bandPolygons.push(
                    ...subtractBoundaryBandCutouts(
                        loopBand.outer,
                        loopBand.holes ?? []
                    )
                );
            }
        }

        const remainingEdges = edges.filter((edge) => !loopEdgeIds.has(edge.id));

        if (hasJunction) {
            appendSegmentBands(remainingEdges, bandPolygons);
            appendJunctionFillers(bandPolygons);
        } else {
            const remainingChains = buildBoundaryRenderChains(remainingEdges);

            for (const chain of remainingChains) {
                const band = getBoundaryBandShapeFromChain(
                    chain.points,
                    type,
                    gridSize,
                    chain.startDegree <= 1,
                    chain.endDegree <= 1
                );

                if (band.outer && band.outer.length >= 6) {
                    bandPolygons.push(band.outer);
                }
            }
        }

        return unionBoundaryBandPolygons(bandPolygons);
    }

    const bandPolygons: number[][] = [];

    if (hasJunction) {
        appendSegmentBands(edges, bandPolygons);
        appendJunctionFillers(bandPolygons);
        return unionBoundaryBandPolygons(bandPolygons);
    }

    const chains = buildBoundaryRenderChains(edges);

    for (const chain of chains) {
        const band = getBoundaryBandShapeFromChain(
            chain.points,
            type,
            gridSize,
            chain.startDegree <= 1,
            chain.endDegree <= 1
        );

        if (band.outer && band.outer.length >= 6) {
            bandPolygons.push(band.outer);
        }
    }

    return unionBoundaryBandPolygons(bandPolygons);
}

export function getBoundaryBandShapeForObject(
    object: PolyObject,
    gridSize = EDITOR_GRID_SIZE
) {
    const segments = object.boundarySegments?.length
        ? object.boundarySegments
        : [object.points];

    return getBoundaryBandShapeFromSegmentList(segments, object.type, gridSize);
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

    return getOpenBoundaryBandShapeFromSegments(centerline, type, gridSize);
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

type BoundaryMergePoint = {
    x: number;
    y: number;
};

function boundaryPointListToFlatPoints(points: BoundaryMergePoint[]) {
    return points.flatMap((point) => [point.x, point.y]);
}

function flatPointsToBoundaryPointList(points: number[]) {
    const out: BoundaryMergePoint[] = [];

    for (let i = 0; i < points.length; i += 2) {
        out.push({
            x: points[i],
            y: points[i + 1],
        });
    }

    return out;
}

function closestPointOnBoundarySegment(
    point: BoundaryMergePoint,
    a: BoundaryMergePoint,
    b: BoundaryMergePoint
) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq <= 1e-9) {
        return {
            point: a,
            distance: Math.hypot(point.x - a.x, point.y - a.y),
            t: 0,
        };
    }

    const rawT =
        ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;

    const t = Math.max(0, Math.min(1, rawT));

    const projected = {
        x: a.x + dx * t,
        y: a.y + dy * t,
    };

    return {
        point: projected,
        distance: Math.hypot(point.x - projected.x, point.y - projected.y),
        t,
    };
}

function boundarySegmentIntersection(
    a: BoundaryMergePoint,
    b: BoundaryMergePoint,
    c: BoundaryMergePoint,
    d: BoundaryMergePoint
): BoundaryMergePoint | null {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const cdx = d.x - c.x;
    const cdy = d.y - c.y;

    const det = abx * cdy - aby * cdx;
    if (Math.abs(det) < 1e-9) return null;

    const t = ((c.x - a.x) * cdy - (c.y - a.y) * cdx) / det;
    const u = ((c.x - a.x) * aby - (c.y - a.y) * abx) / det;

    if (t < -1e-6 || t > 1 + 1e-6) return null;
    if (u < -1e-6 || u > 1 + 1e-6) return null;

    return {
        x: a.x + t * abx,
        y: a.y + t * aby,
    };
}

function getBoundaryBandIntersectionArea(
    aPoints: number[],
    aType: ObjectType,
    bPoints: number[],
    bType: ObjectType,
    gridSize: number
) {
    const aShape = getBoundaryBandShape(aPoints, aType, gridSize);
    const bShape = getBoundaryBandShape(bPoints, bType, gridSize);

    if (!aShape.outer || aShape.outer.length < 6) return 0;
    if (!bShape.outer || bShape.outer.length < 6) return 0;

    const clipper = new ClipperLib.Clipper();
    clipper.AddPath(toClipperPath(aShape.outer), ClipperLib.PolyType.ptSubject, true);
    clipper.AddPath(toClipperPath(bShape.outer), ClipperLib.PolyType.ptClip, true);

    const solution = new ClipperLib.Paths();

    const ok = clipper.Execute(
        ClipperLib.ClipType.ctIntersection,
        solution,
        ClipperLib.PolyFillType.pftNonZero,
        ClipperLib.PolyFillType.pftNonZero
    );

    if (!ok || !solution.length) return 0;

    return (solution as Array<Array<{ X: number; Y: number }>>).reduce(
        (total: number, path: Array<{ X: number; Y: number }>) =>
            total + Math.abs(ClipperLib.Clipper.Area(path)),
        0
    );
}

function insertBoundaryBranchIntoPolyline(
    currentPoints: number[],
    branchPoints: number[],
    type: ObjectType,
    gridSize: number
): number[] | null {
    const current = flatPointsToBoundaryPointList(
        getBoundaryVertexPoints(currentPoints, gridSize)
    );

    const branch = flatPointsToBoundaryPointList(
        getBoundaryVertexPoints(branchPoints, gridSize)
    );

    if (current.length < 2 || branch.length < 2) return null;

    const branchStart = branch[0];
    const maxAttachDistance = getBoundaryStrokeWidth(type, gridSize);

    let best:
        | {
            index: number;
            attachPoint: BoundaryMergePoint;
            distance: number;
            score: number;
        }
        | null = null;

    for (let index = 0; index < current.length - 1; index += 1) {
        const a = current[index];
        const b = current[index + 1];

        const closest = closestPointOnBoundarySegment(branchStart, a, b);

        if (closest.distance <= maxAttachDistance) {
            const score = closest.distance;
            if (!best || score < best.score) {
                best = {
                    index,
                    attachPoint: closest.point,
                    distance: closest.distance,
                    score,
                };
            }
        }

        for (let branchIndex = 0; branchIndex < branch.length - 1; branchIndex += 1) {
            const c = branch[branchIndex];
            const d = branch[branchIndex + 1];

            const intersection = boundarySegmentIntersection(a, b, c, d);
            if (!intersection) continue;

            const distanceFromBranchStart = Math.hypot(
                branchStart.x - intersection.x,
                branchStart.y - intersection.y
            );

            const score = distanceFromBranchStart * 0.25;

            if (!best || score < best.score) {
                best = {
                    index,
                    attachPoint: intersection,
                    distance: 0,
                    score,
                };
            }
        }
    }

    const bandTouchArea = getBoundaryBandIntersectionArea(
        currentPoints,
        type,
        branchPoints,
        type,
        gridSize
    );

    if (!best && bandTouchArea <= 0) {
        return null;
    }

    if (!best) {
        for (let index = 0; index < current.length - 1; index += 1) {
            const a = current[index];
            const b = current[index + 1];
            const closest = closestPointOnBoundarySegment(branchStart, a, b);

            if (!best || closest.distance < best.distance) {
                best = {
                    index,
                    attachPoint: closest.point,
                    distance: closest.distance,
                    score: closest.distance,
                };
            }
        }
    }

    if (!best) return null;

    const a = current[best.index];
    const b = current[best.index + 1];

    const attachPoint = samePoint(best.attachPoint.x, best.attachPoint.y, a.x, a.y)
        ? a
        : samePoint(best.attachPoint.x, best.attachPoint.y, b.x, b.y)
            ? b
            : best.attachPoint;

    const normalizedBranch = samePoint(branchStart.x, branchStart.y, attachPoint.x, attachPoint.y)
        ? branch
        : [attachPoint, ...branch.slice(1)];

    const before = current.slice(0, best.index + 1);
    const after = current.slice(best.index + 1);

    const splitPoint =
        samePoint(a.x, a.y, attachPoint.x, attachPoint.y) ||
            samePoint(b.x, b.y, attachPoint.x, attachPoint.y)
            ? []
            : [attachPoint];

    return cleanupPolylinePoints(
        boundaryPointListToFlatPoints([
            ...before,
            ...splitPoint,
            ...normalizedBranch.slice(1),
            attachPoint,
            ...after,
        ])
    );
}

function mergeBoundaryPolylinesOnce(
    basePoints: number[],
    candidatePoints: number[],
    type: ObjectType,
    gridSize: number
): number[] | null {
    const base = getBoundaryVertexPoints(basePoints, gridSize);
    const candidate = getBoundaryVertexPoints(candidatePoints, gridSize);

    if (base.length < 4 || candidate.length < 4) return null;

    const bsx = base[0];
    const bsy = base[1];
    const bex = base[base.length - 2];
    const bey = base[base.length - 1];

    const csx = candidate[0];
    const csy = candidate[1];
    const cex = candidate[candidate.length - 2];
    const cey = candidate[candidate.length - 1];

    if (samePoint(bex, bey, csx, csy)) {
        return cleanupPolylinePoints(mergeSameEndpointPolyline(base, candidate, "end-start"));
    }

    if (samePoint(bex, bey, cex, cey)) {
        return cleanupPolylinePoints(mergeSameEndpointPolyline(base, candidate, "end-end"));
    }

    if (samePoint(bsx, bsy, cex, cey)) {
        return cleanupPolylinePoints(mergeSameEndpointPolyline(base, candidate, "start-end"));
    }

    if (samePoint(bsx, bsy, csx, csy)) {
        return cleanupPolylinePoints(mergeSameEndpointPolyline(base, candidate, "start-start"));
    }

    // Belangrijk:
    // Bij een aftakking moet de bestaande boundary de trunk blijven.
    // base = nieuw/verplaatst object, candidate = bestaande boundary.
    // Daarom proberen we eerst base als tak in candidate te plaatsen.
    const baseStartIntoCandidate = insertBoundaryBranchIntoPolyline(
        candidate,
        base,
        type,
        gridSize
    );

    if (baseStartIntoCandidate) return baseStartIntoCandidate;

    const baseEndIntoCandidate = insertBoundaryBranchIntoPolyline(
        candidate,
        reversePolylinePoints(base),
        type,
        gridSize
    );

    if (baseEndIntoCandidate) return baseEndIntoCandidate;

    const candidateStartIntoBase = insertBoundaryBranchIntoPolyline(
        base,
        candidate,
        type,
        gridSize
    );

    if (candidateStartIntoBase) return candidateStartIntoBase;

    const candidateEndIntoBase = insertBoundaryBranchIntoPolyline(
        base,
        reversePolylinePoints(candidate),
        type,
        gridSize
    );

    if (candidateEndIntoBase) return candidateEndIntoBase;

    return null;
}

function getBoundaryObjectSegments(object: PolyObject, gridSize: number) {
    const sourceSegments = object.boundarySegments?.length
        ? object.boundarySegments
        : [object.points];

    return sourceSegments
        .map((segment) => getBoundaryVertexPoints(segment, gridSize))
        .filter((segment) => segment.length >= 4);
}

function boundarySegmentsTouch(
    aPoints: number[],
    bPoints: number[],
    type: ObjectType,
    gridSize: number
) {
    const maxDistance = getBoundaryStrokeWidth(type, gridSize);

    const a = flatPointsToBoundaryPointList(aPoints);
    const b = flatPointsToBoundaryPointList(bPoints);

    if (a.length < 2 || b.length < 2) return false;

    for (let ai = 0; ai < a.length - 1; ai += 1) {
        const a1 = a[ai];
        const a2 = a[ai + 1];

        for (let bi = 0; bi < b.length - 1; bi += 1) {
            const b1 = b[bi];
            const b2 = b[bi + 1];

            if (boundarySegmentIntersection(a1, a2, b1, b2)) {
                return true;
            }

            const b1ToA = closestPointOnBoundarySegment(b1, a1, a2);
            const b2ToA = closestPointOnBoundarySegment(b2, a1, a2);
            const a1ToB = closestPointOnBoundarySegment(a1, b1, b2);
            const a2ToB = closestPointOnBoundarySegment(a2, b1, b2);

            if (b1ToA.distance <= maxDistance) return true;
            if (b2ToA.distance <= maxDistance) return true;
            if (a1ToB.distance <= maxDistance) return true;
            if (a2ToB.distance <= maxDistance) return true;
        }
    }

    const intersectionArea = getBoundaryBandIntersectionArea(
        aPoints,
        type,
        bPoints,
        type,
        gridSize
    );

    return intersectionArea > 0;
}

export function mergeConnectedBoundaryPolylines(
    baseObject: PolyObject,
    objects: PolyObject[],
    gridSize = EDITOR_GRID_SIZE
): {
    mergedObject: PolyObject;
    removeIds: string[];
} {
    if (!isUnifiedBoundaryType(baseObject.type)) {
        return {
            mergedObject: baseObject,
            removeIds: [],
        };
    }

    const mergedSegments: number[][] = getBoundaryObjectSegments(baseObject, gridSize);
    const removeIds: string[] = [];

    let changed = true;

    while (changed) {
        changed = false;

        for (const candidate of objects) {
            if (candidate.id === baseObject.id) continue;
            if (candidate.type !== baseObject.type) continue;
            if (!isUnifiedBoundaryType(candidate.type)) continue;
            if (removeIds.includes(candidate.id)) continue;

            const candidateSegments = getBoundaryObjectSegments(candidate, gridSize);

            const touches = candidateSegments.some((candidateSegment) =>
                mergedSegments.some((mergedSegment) =>
                    boundarySegmentsTouch(
                        mergedSegment,
                        candidateSegment,
                        baseObject.type,
                        gridSize
                    )
                )
            );

            if (!touches) continue;

            mergedSegments.push(...candidateSegments);
            removeIds.push(candidate.id);
            changed = true;
            break;
        }
    }

    const cleanedSegments = mergedSegments
        .map((segment) => cleanupPolylinePoints(segment))
        .filter((segment) => segment.length >= 4);

    const primaryPoints =
        cleanedSegments.find((segment) => segment.length > 4) ??
        cleanedSegments[0] ??
        getBoundaryVertexPoints(baseObject.points, gridSize);

    return {
        mergedObject: {
            ...baseObject,
            geometry: "polyline",
            points: primaryPoints,
            boundarySegments: cleanedSegments,
        },
        removeIds,
    };
}

export function mergeFenceOrGateEndpoints(
    type: "fence" | "gate",
    newPoints: number[],
    objects: PolyObject[]
) {
    const baseObject: PolyObject = {
        id: "__boundary_merge_preview__",
        type,
        geometry: "polyline",
        points: newPoints,
    };

    const { mergedObject, removeIds } = mergeConnectedBoundaryPolylines(
        baseObject,
        objects
    );

    return {
        mergedPoints: cleanupPolylinePoints(mergedObject.points),
        removeIds,
    };
}