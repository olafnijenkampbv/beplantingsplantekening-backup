import { create } from "zustand";
import ClipperLib from "clipper-lib";
import { EDITOR_GRID_SIZE } from "@/features/editor/constants/editorGeometry";
import {
    LEGACY_LINE_BOUNDARY_TYPES,
    isUnifiedBoundaryType,
    getBoundaryBandPoints,
    getBoundaryBandShape,
    getBoundaryBandShapeForObject,
    mergeConnectedBoundaryPolylines,
} from "@/features/editor/lib/boundarySystem";

function rectsIntersect(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
) {
    return !(
        a.x + a.w < b.x ||
        b.x + b.w < a.x ||
        a.y + a.h < b.y ||
        b.y + b.h < a.y
    );
}

function toClipperPath(points: number[]) {
    const path: { X: number; Y: number }[] = [];
    for (let i = 0; i < points.length; i += 2) {
        path.push({
            X: Math.round(points[i] * CLIPPER_SCALE),
            Y: Math.round(points[i + 1] * CLIPPER_SCALE),
        });
    }
    return path;
}

function getSegments(points: number[]) {
    const segments: Array<{
        ax: number;
        ay: number;
        bx: number;
        by: number;
    }> = [];

    if (points.length < 6) return segments;

    for (let i = 0; i < points.length; i += 2) {
        const ni = (i + 2) % points.length;
        segments.push({
            ax: points[i],
            ay: points[i + 1],
            bx: points[ni],
            by: points[ni + 1],
        });
    }

    return segments;
}

function cross(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number
) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function isBetween(a: number, b: number, c: number) {
    return Math.min(a, b) <= c + 1e-6 && c <= Math.max(a, b) + 1e-6;
}

function pointOnSegment(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number
) {
    const area = cross(ax, ay, bx, by, px, py);
    if (Math.abs(area) > 1e-6) return false;

    return isBetween(ax, bx, px) && isBetween(ay, by, py);
}

function segmentsIntersectOrTouch(
    a1x: number,
    a1y: number,
    a2x: number,
    a2y: number,
    b1x: number,
    b1y: number,
    b2x: number,
    b2y: number
) {
    const d1 = cross(a1x, a1y, a2x, a2y, b1x, b1y);
    const d2 = cross(a1x, a1y, a2x, a2y, b2x, b2y);
    const d3 = cross(b1x, b1y, b2x, b2y, a1x, a1y);
    const d4 = cross(b1x, b1y, b2x, b2y, a2x, a2y);

    const properIntersect =
        ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));

    if (properIntersect) return true;

    if (pointOnSegment(b1x, b1y, a1x, a1y, a2x, a2y)) return true;
    if (pointOnSegment(b2x, b2y, a1x, a1y, a2x, a2y)) return true;
    if (pointOnSegment(a1x, a1y, b1x, b1y, b2x, b2y)) return true;
    if (pointOnSegment(a2x, a2y, b1x, b1y, b2x, b2y)) return true;

    return false;
}

function getPolygonIntersectionArea(a: number[], b: number[]) {
    const clipper = new ClipperLib.Clipper();

    clipper.AddPath(toClipperPath(a), ClipperLib.PolyType.ptSubject, true);
    clipper.AddPath(toClipperPath(b), ClipperLib.PolyType.ptClip, true);

    const solution = new ClipperLib.Paths();
    clipper.Execute(
        ClipperLib.ClipType.ctIntersection,
        solution,
        ClipperLib.PolyFillType.pftNonZero,
        ClipperLib.PolyFillType.pftNonZero
    );

    let total = 0;
    for (const path of solution) {
        total += Math.abs(ClipperLib.Clipper.Area(path));
    }

    return total / (CLIPPER_SCALE * CLIPPER_SCALE);
}

function polygonsActuallyTouchOrOverlap(a: number[], b: number[]) {
    const bbA = bboxFromPoints(a);
    const bbB = bboxFromPoints(b);

    if (!rectsIntersect(bbA, bbB)) return false;

    const intersectionArea = getPolygonIntersectionArea(a, b);
    if (intersectionArea > 1e-6) return true;

    const segA = getSegments(a);
    const segB = getSegments(b);

    for (const sa of segA) {
        for (const sb of segB) {
            if (
                segmentsIntersectOrTouch(
                    sa.ax,
                    sa.ay,
                    sa.bx,
                    sa.by,
                    sb.ax,
                    sb.ay,
                    sb.bx,
                    sb.by
                )
            ) {
                return true;
            }
        }
    }

    return false;
}

function pickPrimaryMergedShapeIndex(mergedPaths: number[][], movedPoints: number[]) {
    if (mergedPaths.length === 0) return -1;
    if (mergedPaths.length === 1) return 0;

    let bestIdx = 0;
    let bestScore = -Infinity;

    const movedBox = bboxFromPoints(movedPoints);
    const movedCx = movedBox.x + movedBox.w / 2;
    const movedCy = movedBox.y + movedBox.h / 2;

    mergedPaths.forEach((pts, idx) => {
        const overlapArea = getPolygonIntersectionArea(pts, movedPoints);

        const bb = bboxFromPoints(pts);
        const cx = bb.x + bb.w / 2;
        const cy = bb.y + bb.h / 2;
        const distSq = (cx - movedCx) * (cx - movedCx) + (cy - movedCy) * (cy - movedCy);

        const score = overlapArea > 1e-6 ? overlapArea : -distSq;

        if (score > bestScore) {
            bestScore = score;
            bestIdx = idx;
        }
    });

    return bestIdx;
}

function polygonContainsPolygon(outer: number[], inner: number[]): boolean {
    if (!outer || outer.length < 6 || !inner || inner.length < 6) return false;

    const outerPath = pointsToPath(outer);
    const innerPath = pointsToPath(inner);

    // neem één punt uit inner polygon
    const testPoint = innerPath[0];

    return ClipperLib.Clipper.PointInPolygon(testPoint, outerPath) !== 0;
}

function signedArea(points: number[]): number {
    if (!points || points.length < 6) return 0;

    let area = 0;
    const n = points.length / 2;

    for (let i = 0; i < n; i++) {
        const x1 = points[i * 2];
        const y1 = points[i * 2 + 1];

        const j = (i + 1) % n;
        const x2 = points[j * 2];
        const y2 = points[j * 2 + 1];

        area += x1 * y2 - x2 * y1;
    }

    return area / 2;
}

function polygonAreaAbs(points: number[]): number {
    if (!points || points.length < 6) return 0;
    return Math.abs(signedArea(points));
}

function isUsableHole(points: number[], eps = 1e-4): boolean {
    if (!points || points.length < 6) return false;

    const cleaned = cleanupPoints(points);
    if (cleaned.length < 6) return false;

    const bb = bboxFromPoints(cleaned);
    if (bb.w <= eps || bb.h <= eps) return false;

    const area = polygonAreaAbs(cleaned);
    if (area <= eps) return false;

    return true;
}

function sanitizeHoles(holes: number[][] | undefined, minArea = 1e-4): number[][] | undefined {
    if (!holes || holes.length === 0) return undefined;

    const cleaned = holes
        .map((hole) => cleanupPoints(hole))
        .filter((hole) => hole.length >= 6)
        .filter((hole) => isUsableHole(hole, minArea));

    return cleaned.length ? cleaned : undefined;
}


function getSelfUnionPieces(obj: PolyObject): DiffPiece[] {
    if (!obj || !obj.points || obj.points.length < 6) return [];

    const FILL = ClipperLib.PolyFillType.pftNonZero;
    const subjPaths = polyObjectToClipperPaths(obj);
    if (!subjPaths || subjPaths.length === 0) return [];

    const clip = new ClipperLib.Clipper();
    clip.AddPaths(subjPaths as any, ClipperLib.PolyType.ptSubject, true);

    const polyTree = new (ClipperLib.PolyTree as any)();
    const ok = clip.Execute(ClipperLib.ClipType.ctUnion, polyTree as any, FILL, FILL);
    if (!ok) return [];

    const isHole = (node: any) => {
        if (!node) return false;
        if (typeof node.IsHole === "function") return Boolean(node.IsHole());
        return Boolean(node.IsHole);
    };

    const contourOf = (node: any): ClipperPath | null => {
        if (!node) return null;
        if (Array.isArray(node.Contour)) return node.Contour as ClipperPath;
        if (Array.isArray(node.m_polygon)) return node.m_polygon as ClipperPath;
        if (typeof node.Contour === "function") {
            const c = node.Contour();
            return Array.isArray(c) ? (c as ClipperPath) : null;
        }
        return null;
    };

    const childrenOf = (node: any) => getPolyNodeChildren(node);

    const pieces: DiffPiece[] = [];
    const stack = childrenOf(polyTree);

    for (const node of stack) {
        if (!node) continue;
        if (isHole(node)) continue;

        const outerPath = contourOf(node);
        if (!outerPath || outerPath.length < 3) continue;

        const outerPts = cleanupPoints(pathToPoints(outerPath));
        if (outerPts.length < 6) continue;

        const holes: number[][] = [];
        const kids = childrenOf(node);

        for (const kid of kids) {
            if (!kid) continue;
            if (!isHole(kid)) continue;

            const holePath = contourOf(kid);
            if (!holePath || holePath.length < 3) continue;

            const holePts = cleanupPoints(pathToPoints(holePath));
            if (!holePts || holePts.length < 6) continue;
            if (!isUsableHole(holePts)) continue;

            holes.push(holePts);
        }

        pieces.push({
            outer: outerPts,
            holes: sanitizeHoles(holes) ?? [],
        });
    }

    return pieces;
}

function normalizeObjectFromOuterMinusHoles(obj: PolyObject): PolyObject[] | null {
    const cleanedOuter = cleanupPointsKeepCollinear(obj.points);
    if (!cleanedOuter || cleanedOuter.length < 6) return null;

    const cleanedHoles = (obj.holes ?? [])
        .map((h) => cleanupPointsKeepCollinear(h))
        .filter((h) => h.length >= 6);

    if (cleanedHoles.length === 0) {
        return [{
            ...obj,
            points: cleanupPoints(cleanedOuter),
            holes: undefined,
        }];
    }

    const subject: PolyObject = {
        ...obj,
        points: cleanedOuter,
        holes: undefined,
    };

    const cutters: PolyObject[] = cleanedHoles.map((hole) => ({
        id: makeId(),
        type: obj.type,
        points: hole,
        holes: undefined,
        plantbedNo: obj.plantbedNo,
    }));

    const pieces = subtractPolygonsPieces(subject, cutters);
    if (!pieces || pieces.length === 0) return null;

    return pieces
        .filter((piece) => piece.outer.length >= 6)
        .map((piece, idx) => ({
            ...obj,
            id: idx === 0 ? obj.id : makeId(),
            points: cleanupPoints(piece.outer),
            holes: sanitizeHoles(piece.holes),
            plantbedNo: obj.plantbedNo,
        }));
}

function normalizeSingleObjectToPieces(obj: PolyObject): PolyObject[] {
    if (!obj.points || obj.points.length < 6) return [obj];

    const prepared: PolyObject = {
        ...obj,
        points: cleanupPointsKeepCollinear(obj.points),
        holes: obj.holes?.map((h) => cleanupPointsKeepCollinear(h)),
    };

    // Bij objecten met holes willen we NIET via self-union reconstrueren.
    // We willen exact: outer MINUS holes.
    // Daardoor geldt:
    // - hole klapt in -> hole verdwijnt
    // - hole raakt outer -> interne seam verdwijnt
    // - hole gaat over outer heen -> het stuk buiten de outer wordt genegeerd
    //   en de vorm wordt netjes afgeknipt i.p.v. een rare extra shape
    if ((prepared.holes?.length ?? 0) > 0) {
        const holeNormalized = normalizeObjectFromOuterMinusHoles(prepared);
        if (holeNormalized && holeNormalized.length > 0) {
            return holeNormalized;
        }

        return [{
            ...obj,
            points: cleanupPoints(prepared.points),
            holes: undefined,
        }];
    }

    const selfNormalizedRaw = normalizeSelfUnionToDonut(prepared);
    const selfNormalized: PolyObject = {
        ...selfNormalizedRaw,
        holes: sanitizeHoles(selfNormalizedRaw.holes),
    };

    if ((selfNormalized.holes?.length ?? 0) > 0) {
        return [selfNormalized];
    }

    const pieces = unionPolygonPieces([selfNormalized.points]);
    if (!pieces || pieces.length === 0) return [selfNormalized];

    return pieces
        .filter((piece) => piece.outer.length >= 6)
        .map((piece, idx) => ({
            ...selfNormalized,
            id: idx === 0 ? selfNormalized.id : makeId(),
            points: piece.outer,
            holes: sanitizeHoles(piece.holes),
        }));
}

function normalizeSelfUnionToDonut(obj: PolyObject): PolyObject {
    if (!obj || !obj.points || obj.points.length < 6) return obj;

    // Zodra er holes aanwezig zijn, moet de reconstructie via:
    // outer MINUS holes
    // en niet via self-union van outer+holes.
    if ((obj.holes?.length ?? 0) > 0) {
        const normalized = normalizeObjectFromOuterMinusHoles(obj);
        if (normalized && normalized.length > 0) {
            return normalized[0];
        }

        return {
            ...obj,
            points: cleanupPoints(obj.points),
            holes: undefined,
        };
    }

    const FILL = ClipperLib.PolyFillType.pftNonZero;
    const subjPaths = polyObjectToClipperPaths(obj);
    if (!subjPaths || subjPaths.length === 0) return obj;

    const clip = new ClipperLib.Clipper();
    clip.AddPaths(subjPaths as any, ClipperLib.PolyType.ptSubject, true);

    const polyTree = new (ClipperLib.PolyTree as any)();
    const ok = clip.Execute(ClipperLib.ClipType.ctUnion, polyTree as any, FILL, FILL);
    if (!ok) return obj;

    const isHole = (node: any) => {
        if (!node) return false;
        if (typeof node.IsHole === "function") return Boolean(node.IsHole());
        return Boolean(node.IsHole);
    };

    const contourOf = (node: any): ClipperPath | null => {
        if (!node) return null;
        if (Array.isArray(node.Contour)) return node.Contour as ClipperPath;
        if (Array.isArray(node.m_polygon)) return node.m_polygon as ClipperPath;
        if (typeof node.Contour === "function") {
            const c = node.Contour();
            return Array.isArray(c) ? (c as ClipperPath) : null;
        }
        return null;
    };

    const childrenOf = (node: any) => getPolyNodeChildren(node);

    const pieces: DiffPiece[] = [];
    const stack = childrenOf(polyTree);

    for (const node of stack) {
        if (!node) continue;
        if (isHole(node)) continue;

        const outerPath = contourOf(node);
        if (!outerPath || outerPath.length < 3) continue;

        const outerPts = cleanupPoints(pathToPoints(outerPath));
        if (outerPts.length < 6) continue;

        const holes: number[][] = [];
        const kids = childrenOf(node);

        for (const kid of kids) {
            if (!kid) continue;
            if (!isHole(kid)) continue;

            const holePath = contourOf(kid);
            if (!holePath || holePath.length < 3) continue;

            const holePts = cleanupPoints(pathToPoints(holePath));
            if (!holePts || holePts.length < 6) continue;
            if (!isUsableHole(holePts)) continue;

            holes.push(holePts);
        }

        pieces.push({
            outer: outerPts,
            holes: sanitizeHoles(holes) ?? [],
        });
    }

    if (pieces.length === 0) return obj;

    const main = pieces[0];
    const nextHoles = sanitizeHoles(main.holes);

    return {
        ...obj,
        points: main.outer,
        holes: nextHoles,
    };
}

// -----------------------------
// ✅ Plants + linking (types OUTSIDE store)
// -----------------------------
export type PlantItem = {
    id: string;
    nr: number;
    latin: string;
    dutch: string;
};

export type PlantbedLinksMap = Record<string, string[]>; // key = plantbedId, value = plantIds[]
export type DistributionOverridesMap = Record<string, Record<string, number>>; // key = objectId, value = Record<plantId, percentage>

function clonePlantbedLinks(links: PlantbedLinksMap = {}) {
    return Object.fromEntries(
        Object.entries(links).map(([plantbedId, plantIds]) => [
            plantbedId,
            [...plantIds],
        ])
    ) as PlantbedLinksMap;
}

// -----------------------------
// ✅ Dummy plants (kan later vervangen worden door echte setPlants(...))
// -----------------------------
const BASE_DUMMY_PLANTS: PlantItem[] = [
    { id: "p1", nr: 1, latin: "Vinca minor ‘Alba’", dutch: "Maagdenpalm" },
    { id: "p2", nr: 2, latin: "Geranium macrorrhizum", dutch: "Ooievaarsbek" },
    { id: "p3", nr: 3, latin: "Pachysandra terminalis 'Green Carpet'", dutch: "Schaduwkruid" },
    { id: "p4", nr: 4, latin: "Aralia elata 'Aureovariegata'", dutch: "Duivelswandelstok" },
    { id: "p5", nr: 5, latin: "Acer campestre", dutch: "Esdoorn" },
];

const EXTRA_DUMMY_PLANTS: PlantItem[] = [
    { id: "p6", nr: 6, latin: "Lavandula angustifolia", dutch: "Lavendel" },
    { id: "p7", nr: 7, latin: "Salvia nemorosa", dutch: "Salie" },
    { id: "p8", nr: 8, latin: "Heuchera micrantha", dutch: "Purperklokje" },
    { id: "p9", nr: 9, latin: "Hydrangea macrophylla", dutch: "Hortensia" },
    { id: "p10", nr: 10, latin: "Echinacea purpurea", dutch: "Zonnehoed" },
    { id: "p11", nr: 11, latin: "Hosta sieboldiana", dutch: "Hartlelie" },
    { id: "p12", nr: 12, latin: "Buxus sempervirens", dutch: "Buxus" },
    { id: "p13", nr: 13, latin: "Cornus alba", dutch: "Rode kornoelje" },
    { id: "p14", nr: 14, latin: "Rudbeckia fulgida", dutch: "Zonnehoed" },
    { id: "p15", nr: 15, latin: "Geranium 'Rozanne'", dutch: "Ooievaarsbek" },
];

export type { ObjectType, TreebedVariant, GeometryKind } from "@/features/editor/components/editor/objectMenuConfig";
import {
    OBJECT_STYLES,
    TYPE_Z_INDEX,
    getObjectGeometryKind,
    type ObjectType,
    type TreebedVariant,
    type GeometryKind,
} from "@/features/editor/components/editor/objectMenuConfig";

export type PolyObjectStyle = {
    fill?: string;
    stroke?: string;
};

export type PolyObject = {
    id: string;
    type: ObjectType;

    // ✅ Geometry: polygon = gesloten vlak, polyline = open lijn
    geometry?: GeometryKind;

    // Polygon outer ring OF polyline points (zelfde format: [x1,y1,x2,y2,...])
    points: number[];

    //rotaten boomvak leivorm
    rotationDeg?: number

    // ✅ Custom objectstijl per object
    customStyle?: PolyObjectStyle;

    // ✅ Holes (counter-clockwise). Alleen gebruikt bij polygonen met “gaten” (bv water in gras)
    holes?: number[][];

    // Alleen relevant voor plantbed (Plantvak)
    plantbedNo?: number;

    // ✅ Alleen relevant voor boomvak
    treebedVariant?: TreebedVariant;

    /**
     * ✅ Alleen voor polyline objects (fence/gate):
     * Aan welke zijde de zichtbare lijn wordt gerenderd t.o.v. de centerline.
     *  1  = linker normaal van de point-volgorde
     * -1  = rechter normaal van de point-volgorde
     */
    renderSide?: 1 | -1;

    /**
 * ✅ Alleen voor polyline/boundary objects:
 * Losse centerline-segmenten binnen één boundary-object.
 * Hiermee kan één schutting meerdere uiteindes/aftakkingen hebben zonder
 * dat de lijn als één ingeklapte polyline terug naar het aansluitpunt hoeft te lopen.
 */
    boundarySegments?: number[][];

    /**
     * ✅ Alleen voor polyline objects (fence/gate):
     * Render-stukken (polygons) zodat de "dikke lijn" NIET door vlakken heen tekent.
     * Dit is afgeleid/cached; source of truth blijft points[] + boundarySegments[].
     */
    renderPieces?: number[][];

};

export { OBJECT_STYLES, TYPE_Z_INDEX };

export type EditorTool = "select" | "hand" | "cut" | "draw" | "measure";

export type ViewVisibilityKey =
    | "showPlantNumbers"
    | "showAreaLabels"
    | "showGround"
    | "showBuildings"
    | "showTrafficUse"
    | "showBoundaries"
    | "showPlantbeds"
    | "showTreebeds";

export type ViewVisibilityState = {
    showPlantNumbers: boolean;
    showAreaLabels: boolean;
    showGround: boolean;
    showBuildings: boolean;
    showTrafficUse: boolean;
    showBoundaries: boolean;
    showPlantbeds: boolean;
    showTreebeds: boolean;
};

export type CompassDirection = "noord" | "oost" | "zuid" | "west";

// -----------------------------
// ✅ Geometry helpers
// -----------------------------
const LINE_TYPES: ObjectType[] = [...LEGACY_LINE_BOUNDARY_TYPES];

function isLineType(t: ObjectType) {
    return LINE_TYPES.includes(t);
}

function getGeometryForType(t: ObjectType) {
    if (isUnifiedBoundaryType(t)) return "polyline";
    return getObjectGeometryKind(t);
}
function isPolylineObject(o: PolyObject) {
    // backward compatible: als geometry ontbreekt, leid af uit type
    const g = o.geometry ?? getGeometryForType(o.type);
    return g === "polyline";
}

function cleanupPolylineCommitPoints(points: number[], eps = 1e-6) {
    if (!points || points.length < 2) return points ?? [];

    const samePoint = (ax: number, ay: number, bx: number, by: number) =>
        Math.abs(ax - bx) <= eps && Math.abs(ay - by) <= eps;

    const out: number[] = [];

    for (let i = 0; i < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];
        const n = out.length;

        // alleen consecutive duplicates verwijderen
        if (n >= 2 && samePoint(out[n - 2], out[n - 1], x, y)) continue;

        out.push(x, y);
    }

    return out;
}

function preserveClosedBoundaryEndpoint(points: number[], type: ObjectType) {
    const cleaned = cleanupPolylineCommitPoints(points);

    const pointsMatch = (
        ax: number,
        ay: number,
        bx: number,
        by: number,
        eps = 1e-6
    ) => Math.abs(ax - bx) <= eps && Math.abs(ay - by) <= eps;

    if (!isUnifiedBoundaryType(type)) {
        return cleaned;
    }

    if (!points || points.length < 8) {
        return cleaned;
    }

    const firstX = points[0];
    const firstY = points[1];
    const lastX = points[points.length - 2];
    const lastY = points[points.length - 1];

    if (!pointsMatch(firstX, firstY, lastX, lastY)) {
        return cleaned;
    }

    if (cleaned.length < 6) {
        return cleaned;
    }

    const cleanedFirstX = cleaned[0];
    const cleanedFirstY = cleaned[1];
    const cleanedLastX = cleaned[cleaned.length - 2];
    const cleanedLastY = cleaned[cleaned.length - 1];

    if (pointsMatch(cleanedFirstX, cleanedFirstY, cleanedLastX, cleanedLastY)) {
        return cleaned;
    }

    return [...cleaned, cleanedFirstX, cleanedFirstY];
}

function getBoundarySegmentsForObject(obj: PolyObject) {
    if (obj.boundarySegments?.length) {
        return obj.boundarySegments;
    }

    return [obj.points];
}

function isBoundaryPointOnSegmentForSplit(
    point: BoundaryPoint,
    a: BoundaryPoint,
    b: BoundaryPoint,
    eps = 1e-6
) {
    const crossValue =
        (b.x - a.x) * (point.y - a.y) -
        (b.y - a.y) * (point.x - a.x);

    if (Math.abs(crossValue) > eps) return false;

    const dotValue =
        (point.x - a.x) * (b.x - a.x) +
        (point.y - a.y) * (b.y - a.y);

    if (dotValue < -eps) return false;

    const squaredLength =
        (b.x - a.x) * (b.x - a.x) +
        (b.y - a.y) * (b.y - a.y);

    if (dotValue - squaredLength > eps) return false;

    return true;
}

function getBoundarySegmentSplitT(
    point: BoundaryPoint,
    a: BoundaryPoint,
    b: BoundaryPoint
) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const squaredLength = dx * dx + dy * dy;

    if (squaredLength <= 1e-9) return 0;

    return (
        ((point.x - a.x) * dx + (point.y - a.y) * dy) /
        squaredLength
    );
}

function pointKeyForBoundarySplit(point: BoundaryPoint) {
    return `${Math.round(point.x * 1000) / 1000}:${Math.round(point.y * 1000) / 1000}`;
}

function getBoundarySegmentIntersectionPoint(
    a: BoundaryPoint,
    b: BoundaryPoint,
    c: BoundaryPoint,
    d: BoundaryPoint
): BoundaryPoint | null {
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

function splitBoundarySegmentsAtJunctions(segments: number[][]) {
    const sourceSegments = segments
        .map((segment) => cleanupPolylineCommitPoints(segment))
        .filter((segment) => segment.length >= 4);

    const allPoints: BoundaryPoint[] = [];
    const atomicSegments: Array<{ a: BoundaryPoint; b: BoundaryPoint }> = [];

    for (const segment of sourceSegments) {
        const points = boundaryPointsToPointList(segment);

        for (let index = 0; index < points.length; index += 1) {
            allPoints.push(points[index]);
        }

        for (let index = 0; index < points.length - 1; index += 1) {
            atomicSegments.push({
                a: points[index],
                b: points[index + 1],
            });
        }
    }

    for (let index = 0; index < atomicSegments.length; index += 1) {
        const current = atomicSegments[index];

        for (let compareIndex = index + 1; compareIndex < atomicSegments.length; compareIndex += 1) {
            const candidate = atomicSegments[compareIndex];

            const intersection = getBoundarySegmentIntersectionPoint(
                current.a,
                current.b,
                candidate.a,
                candidate.b
            );

            if (!intersection) continue;

            allPoints.push(intersection);
        }
    }

    const nextSegments: number[][] = [];

    for (const segment of sourceSegments) {
        const points = boundaryPointsToPointList(segment);

        for (let index = 0; index < points.length - 1; index += 1) {
            const a = points[index];
            const b = points[index + 1];

            const splitPointsByKey = new Map<string, BoundaryPoint>();
            splitPointsByKey.set(pointKeyForBoundarySplit(a), a);
            splitPointsByKey.set(pointKeyForBoundarySplit(b), b);

            for (const candidate of allPoints) {
                if (!isBoundaryPointOnSegmentForSplit(candidate, a, b)) continue;

                splitPointsByKey.set(pointKeyForBoundarySplit(candidate), candidate);
            }

            const splitPoints = Array.from(splitPointsByKey.values()).sort(
                (p1, p2) =>
                    getBoundarySegmentSplitT(p1, a, b) -
                    getBoundarySegmentSplitT(p2, a, b)
            );

            for (let splitIndex = 0; splitIndex < splitPoints.length - 1; splitIndex += 1) {
                const from = splitPoints[splitIndex];
                const to = splitPoints[splitIndex + 1];

                if (areBoundaryPointsEqual(from, to)) continue;

                nextSegments.push([from.x, from.y, to.x, to.y]);
            }
        }
    }

    const uniqueSegments = new Map<string, number[]>();

    for (const segment of nextSegments) {
        const a = { x: segment[0], y: segment[1] };
        const b = { x: segment[2], y: segment[3] };

        const keyA = pointKeyForBoundarySplit(a);
        const keyB = pointKeyForBoundarySplit(b);
        const key = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;

        if (!uniqueSegments.has(key)) {
            uniqueSegments.set(key, segment);
        }
    }

    return simplifyCollinearBoundarySegments(
        Array.from(uniqueSegments.values())
    );
}

function simplifyCollinearBoundarySegments(segments: number[][]) {
    let currentSegments = segments.filter((segment) => segment.length >= 4);
    let changed = true;

    while (changed) {
        changed = false;

        const pointToSegments = new Map<string, number[]>();

        currentSegments.forEach((segment, segmentIndex) => {
            const start = { x: segment[0], y: segment[1] };
            const end = { x: segment[2], y: segment[3] };

            const startKey = pointKeyForBoundarySplit(start);
            const endKey = pointKeyForBoundarySplit(end);

            pointToSegments.set(startKey, [
                ...(pointToSegments.get(startKey) ?? []),
                segmentIndex,
            ]);

            pointToSegments.set(endKey, [
                ...(pointToSegments.get(endKey) ?? []),
                segmentIndex,
            ]);
        });

        for (const [pointKey, segmentIndexes] of pointToSegments.entries()) {
            if (segmentIndexes.length !== 2) continue;

            const [firstIndex, secondIndex] = segmentIndexes;
            const firstSegment = currentSegments[firstIndex];
            const secondSegment = currentSegments[secondIndex];

            if (!firstSegment || !secondSegment) continue;

            const middlePoint = (() => {
                const [xRaw, yRaw] = pointKey.split(":");
                return {
                    x: Number(xRaw),
                    y: Number(yRaw),
                };
            })();

            if (!Number.isFinite(middlePoint.x) || !Number.isFinite(middlePoint.y)) continue;

            const firstOtherPoint =
                areBoundaryPointsEqual(
                    { x: firstSegment[0], y: firstSegment[1] },
                    middlePoint
                )
                    ? { x: firstSegment[2], y: firstSegment[3] }
                    : { x: firstSegment[0], y: firstSegment[1] };

            const secondOtherPoint =
                areBoundaryPointsEqual(
                    { x: secondSegment[0], y: secondSegment[1] },
                    middlePoint
                )
                    ? { x: secondSegment[2], y: secondSegment[3] }
                    : { x: secondSegment[0], y: secondSegment[1] };

            const crossValue =
                (middlePoint.x - firstOtherPoint.x) *
                (secondOtherPoint.y - middlePoint.y) -
                (middlePoint.y - firstOtherPoint.y) *
                (secondOtherPoint.x - middlePoint.x);

            if (Math.abs(crossValue) > 1e-6) continue;

            const mergedSegment = [
                firstOtherPoint.x,
                firstOtherPoint.y,
                secondOtherPoint.x,
                secondOtherPoint.y,
            ];

            currentSegments = currentSegments.filter(
                (_segment, index) => index !== firstIndex && index !== secondIndex
            );

            currentSegments.push(mergedSegment);

            changed = true;
            break;
        }
    }

    const uniqueSegments = new Map<string, number[]>();

    for (const segment of currentSegments) {
        const a = { x: segment[0], y: segment[1] };
        const b = { x: segment[2], y: segment[3] };

        if (areBoundaryPointsEqual(a, b)) continue;

        const keyA = pointKeyForBoundarySplit(a);
        const keyB = pointKeyForBoundarySplit(b);
        const key = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;

        if (!uniqueSegments.has(key)) {
            uniqueSegments.set(key, segment);
        }
    }

    return Array.from(uniqueSegments.values());
}

function normalizeBoundaryObjectSegments(obj: PolyObject): PolyObject {
    if (!isPolylineObject(obj)) return obj;

    const segments = splitBoundarySegmentsAtJunctions(
        getBoundarySegmentsForObject(obj)
            .map((segment) => preserveClosedBoundaryEndpoint(segment, obj.type))
            .filter((segment) => segment.length >= 4)
    );

    return {
        ...obj,
        geometry: "polyline",
        points: segments[0] ?? preserveClosedBoundaryEndpoint(obj.points, obj.type),
        boundarySegments: segments,
    };
}

function translateBoundarySegments(
    segments: number[][] | undefined,
    dx: number,
    dy: number
) {
    if (!segments || segments.length === 0) return segments;

    return segments.map((segment) => translatePoints(segment, dx, dy));
}

type BoundaryPoint = {
    x: number;
    y: number;
};

function boundaryPointsToPointList(points: number[]): BoundaryPoint[] {
    const out: BoundaryPoint[] = [];

    for (let i = 0; i < points.length; i += 2) {
        out.push({
            x: points[i],
            y: points[i + 1],
        });
    }

    return out;
}

function boundaryPointListToPoints(points: BoundaryPoint[]): number[] {
    return points.flatMap((point) => [point.x, point.y]);
}

function areBoundaryPointsEqual(a: BoundaryPoint, b: BoundaryPoint, eps = 1e-6) {
    return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

function findBoundaryOverlapLength(a: BoundaryPoint[], b: BoundaryPoint[]) {
    const maxOverlap = Math.min(a.length, b.length);

    for (let overlap = maxOverlap; overlap >= 1; overlap -= 1) {
        let matches = true;

        for (let index = 0; index < overlap; index += 1) {
            const aPoint = a[a.length - overlap + index];
            const bPoint = b[index];

            if (!areBoundaryPointsEqual(aPoint, bPoint)) {
                matches = false;
                break;
            }
        }

        if (matches) return overlap;
    }

    return 0;
}

function getClosestBoundaryPointOnSegment(
    point: BoundaryPoint,
    a: BoundaryPoint,
    b: BoundaryPoint
): {
    point: BoundaryPoint;
    distance: number;
    t: number;
} {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const squaredLength = dx * dx + dy * dy;

    if (squaredLength <= 1e-9) {
        return {
            point: a,
            distance: Math.hypot(point.x - a.x, point.y - a.y),
            t: 0,
        };
    }

    const rawT =
        ((point.x - a.x) * dx + (point.y - a.y) * dy) /
        squaredLength;

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

function insertBoundaryBranchAtSegment(
    current: BoundaryPoint[],
    branch: BoundaryPoint[]
): BoundaryPoint[] | null {
    if (current.length < 2 || branch.length < 2) return null;

    const branchStart = branch[0];
    const maxAttachDistance = SNAP_GRID_SIZE;

    let best:
        | {
            index: number;
            attachPoint: BoundaryPoint;
            distance: number;
            t: number;
        }
        | null = null;

    for (let index = 0; index < current.length - 1; index += 1) {
        const a = current[index];
        const b = current[index + 1];

        const candidate = getClosestBoundaryPointOnSegment(branchStart, a, b);

        if (candidate.distance > maxAttachDistance) continue;

        if (!best || candidate.distance < best.distance) {
            best = {
                index,
                attachPoint: candidate.point,
                distance: candidate.distance,
                t: candidate.t,
            };
        }
    }

    if (!best) return null;

    const a = current[best.index];
    const b = current[best.index + 1];

    const normalizedAttachPoint =
        areBoundaryPointsEqual(best.attachPoint, a)
            ? a
            : areBoundaryPointsEqual(best.attachPoint, b)
                ? b
                : best.attachPoint;

    const normalizedBranch =
        areBoundaryPointsEqual(branchStart, normalizedAttachPoint)
            ? branch
            : [normalizedAttachPoint, ...branch.slice(1)];

    const before = current.slice(0, best.index + 1);
    const after = current.slice(best.index + 1);

    const splitPoint =
        areBoundaryPointsEqual(a, normalizedAttachPoint) ||
            areBoundaryPointsEqual(b, normalizedAttachPoint)
            ? []
            : [normalizedAttachPoint];

    return [
        ...before,
        ...splitPoint,
        ...normalizedBranch.slice(1),
        normalizedAttachPoint,
        ...after,
    ];
}

function mergeBoundaryPointArrays(
    currentPoints: number[],
    candidatePoints: number[],
    type: ObjectType
): number[] | null {
    const current = boundaryPointsToPointList(
        cleanupPolylineCommitPoints(currentPoints)
    );

    const candidate = boundaryPointsToPointList(
        cleanupPolylineCommitPoints(candidatePoints)
    );

    if (current.length < 2 || candidate.length < 2) return null;

    const currentVariants = [
        current,
        [...current].reverse(),
    ];

    const candidateVariants = [
        candidate,
        [...candidate].reverse(),
    ];

    let bestMerged: BoundaryPoint[] | null = null;
    let bestScore = -Infinity;

    for (const currentVariant of currentVariants) {
        for (const candidateVariant of candidateVariants) {
            const overlapForward = findBoundaryOverlapLength(
                currentVariant,
                candidateVariant
            );

            if (overlapForward > 0) {
                const merged = [
                    ...currentVariant,
                    ...candidateVariant.slice(overlapForward),
                ];

                const score = overlapForward * 100000 + merged.length;

                if (score > bestScore) {
                    bestScore = score;
                    bestMerged = merged;
                }
            }

            const overlapBackward = findBoundaryOverlapLength(
                candidateVariant,
                currentVariant
            );

            if (overlapBackward > 0) {
                const merged = [
                    ...candidateVariant,
                    ...currentVariant.slice(overlapBackward),
                ];

                const score = overlapBackward * 100000 + merged.length;

                if (score > bestScore) {
                    bestScore = score;
                    bestMerged = merged;
                }
            }

            const branchMerged = insertBoundaryBranchAtSegment(
                currentVariant,
                candidateVariant
            );

            if (branchMerged) {
                const score = 50000 + branchMerged.length;

                if (score > bestScore) {
                    bestScore = score;
                    bestMerged = branchMerged;
                }
            }

            const reverseBranchMerged = insertBoundaryBranchAtSegment(
                currentVariant,
                [...candidateVariant].reverse()
            );

            if (reverseBranchMerged) {
                const score = 50000 + reverseBranchMerged.length;

                if (score > bestScore) {
                    bestScore = score;
                    bestMerged = reverseBranchMerged;
                }
            }
        }
    }

    if (!bestMerged || bestMerged.length < 2) return null;

    return preserveClosedBoundaryEndpoint(
        cleanupPolylineCommitPoints(boundaryPointListToPoints(bestMerged)),
        type
    );
}

function mergeConnectedBoundaryObjects(
    baseObj: PolyObject,
    candidates: PolyObject[]
): {
    mergedObject: PolyObject;
    mergedCandidateIds: string[];
} {
    let mergedObject: PolyObject = {
        ...baseObj,
        points: preserveClosedBoundaryEndpoint(baseObj.points, baseObj.type),
    };

    const mergedCandidateIds: string[] = [];
    let changed = true;

    while (changed) {
        changed = false;

        for (const candidate of candidates) {
            if (mergedCandidateIds.includes(candidate.id)) continue;

            const mergedPoints = mergeBoundaryPointArrays(
                mergedObject.points,
                candidate.points,
                mergedObject.type
            );

            if (!mergedPoints) continue;

            mergedObject = {
                ...mergedObject,
                points: mergedPoints,
            };

            mergedCandidateIds.push(candidate.id);
            changed = true;
        }
    }

    return {
        mergedObject,
        mergedCandidateIds,
    };
}

function createBoundaryDifferenceCutter(obj: PolyObject): PolyObject | null {
    if (!isUnifiedBoundaryType(obj.type)) return null;

    const normalizedBoundary = normalizeBoundaryObjectSegments(obj);
    const shape = getBoundaryBandShapeForObject(normalizedBoundary, SNAP_GRID_SIZE);

    if (!shape.outer || shape.outer.length < 6) return null;

    return {
        ...normalizedBoundary,
        geometry: "polygon",
        points: shape.outer,
        holes: shape.holes?.length ? shape.holes : undefined,
    };
}

type Command =
    | { kind: "addObject"; object: PolyObject }
    | { kind: "removeObject"; object: PolyObject }
    | { kind: "moveObject"; id: string; fromPoints: number[]; toPoints: number[] }
    | { kind: "moveMany"; items: { id: string; fromPoints: number[]; toPoints: number[] }[] }
    | { kind: "removeMany"; objects: PolyObject[] }
    | { kind: "addMany"; objects: PolyObject[] }
    | { kind: "replaceMany"; before: PolyObject[]; after: PolyObject[] }
    | {
        kind: "rotateCanvas";
        before: PolyObject[];
        after: PolyObject[];
        compassBefore: CompassDirection;
        compassAfter: CompassDirection;
    }

    // ✅ NEW: type-change / merge (replaceMany) + plantbed-links snapshot in 1 undo stap
    | {
        kind: "replaceManyWithPlantbedLinks";
        before: PolyObject[];
        after: PolyObject[];
        removedLinks: PlantbedLinksMap;          // plantbedId -> plantIds[]
        removedCounts: Record<string, number>;   // plantbedId -> count

        // ✅ Optioneel volledig snapshot voor acties waarbij links verplaatst worden,
        // zoals hedge-merge. Hiermee blijven undo/redo en PlantSidebar altijd synchroon.
        beforeLinks?: PlantbedLinksMap;
        beforeCounts?: Record<string, number>;
        afterLinks?: PlantbedLinksMap;
        afterCounts?: Record<string, number>;
    }

    // ✅ Plant-links undo/redo
    | { kind: "linkPlant"; plantId: string; plantbedId: string }
    | { kind: "unlinkPlant"; plantId: string; plantbedId: string }

    // ✅ Delete plantbed(s) + onthoud links/counts zodat undo het kan terugzetten
    | {
        kind: "removeManyWithPlantbedLinks";
        objects: PolyObject[];
        removedLinks: PlantbedLinksMap; // plantbedId -> plantIds[]
        removedCounts: Record<string, number>; // plantbedId -> count
    }
    | {
        kind: "addManyWithPlantbedLinks";
        objects: PolyObject[];
        restoredLinks: PlantbedLinksMap;
        restoredCounts: Record<string, number>;
    };

type ProjectState = {
    objects: PolyObject[];

    compassDirection: CompassDirection;
    setCompassDirection: (direction: CompassDirection) => void;
    rotateCanvasWithHistory: (
        nextObjects: PolyObject[],
        compassBefore: CompassDirection,
        compassAfter: CompassDirection,
        nextSelectionId?: string | null
    ) => void;

    nextPlantbedNo: number;

    // Aantal gekoppelde planten per plantvak-id
    plantbedLinkedCount: Record<string, number>;
    distributionOverrides: DistributionOverridesMap;

    // ✅ Plants + linking
    plants: PlantItem[];
    plantbedLinks: PlantbedLinksMap;

    // helpers voor UI
    getPlantbedNo: (id: string) => number | null;
    requestChangeObjectType: (objectId: string, nextType: ObjectType) => void;
    changeTreebedVariant: (id: string, nextVariant: TreebedVariant) => void;

    clearPlantbedLinksForPlantbed: (plantbedId: string) => void;
    getPlantbedLinkedCount: (plantbedId: string) => number;

    setPlants: (plants: PlantItem[]) => void;
    setDistributionOverridesForObject: (objectId: string, overrides: Record<string, number>) => void;
    clearDistributionOverridesForObject: (objectId: string) => void;
    ensureDummyPlants: (useExtended: boolean) => void;

    getPlantById: (plantId: string) => PlantItem | null;
    getLinkedPlantIdsForPlantbed: (plantbedId: string) => string[];
    isPlantLinked: (plantId: string) => boolean;

    getLinkedProgress: () => { linked: number; total: number };

    linkPlantToPlantbed: (plantId: string, plantbedId: string) => boolean;
    unlinkPlantFromPlantbedByPlantId: (plantbedId: string, plantId: string) => void;

    // ✅ UI focus trigger voor PlantSidebar (tab + plantvak openzetten)
    plantSidebarFocus: { plantbedId: string; nonce: number } | null;
    focusSidebarOnPlantbed: (plantbedId: string) => void;

    // ✅ UI focus trigger voor HelloEditor (object in beeld brengen)
    canvasFocusRequest: { objectId: string; nonce: number } | null;
    focusCanvasOnObject: (objectId: string) => void;

    selectedObjectId: string | null;
    selectedObjectIds: string[];

    activeTool: EditorTool;
    setActiveTool: (tool: EditorTool) => void;

    activeDrawType: ObjectType | null;
    setActiveDrawType: (t: ObjectType | null) => void;

    viewVisibility: ViewVisibilityState;
    setViewVisibility: (key: ViewVisibilityKey, value: boolean) => void;
    toggleViewVisibility: (key: ViewVisibilityKey) => void;

    undoStack: Command[];
    redoStack: Command[];

    selectObject: (id: string | null) => void;
    selectObjects: (ids: string[]) => void;
    clearSelection: () => void;

    addObject: (obj: PolyObject) => void;
    cutObjectsByPolygon: (cutterPoints: number[]) => void;

    // ✅ Dupliceren huidige selectie
    duplicateSelected: () => void;

    // ✅ Draft/preview helpers (voor live renderPieces tijdens tekenen)
    getPolylineRenderPieces: (points: number[], type: ObjectType) => number[][];

    removeObjectById: (id: string) => void;
    moveObject: (id: string, toPoints: number[]) => void;
    moveObjectsBatch: (items: { id: string; toPoints: number[] }[]) => void;
    moveObjectAndMerge: (id: string, toPoints: number[], toHoles?: number[][]) => void;
    updateObjectPoints: (id: string, toPoints: number[]) => void;
    commitBoundarySegmentsEdit: (
        objectId: string,
        beforeObject: PolyObject,
        afterBoundarySegments: number[][]
    ) => void;
    changeObjectType: (id: string, nextType: ObjectType) => void;
    updateObjectStyle: (id: string, style: PolyObjectStyle) => void;
    resetObjectStyle: (id: string) => void;
    setObjectsWithHistory: (nextObjects: PolyObject[], nextSelectionId?: string | null) => void;

    confirmModal:
    | null
    | {
        kind: "delete-plantbed";
        plantbedId: string;
        plantbedNo: number | null;
        plantIds: string[];
    }
    | {
        kind: "delete-plantbeds";
        selectedIds: string[]; // volledige selectie die bevestigd wordt
        plantbedIds: string[]; // alleen de plantvakken die links hebben (voor de modal)
        items: { plantbedId: string; plantbedNo: number | null; linkedCount: number; plantIds: string[] }[];
        totalSelected: number; // totaal aantal geselecteerde objects (plantbed + non-plantbed)
    }
    | {
        kind: "change-plantbed-type";
        plantbedId: string;
        plantbedNo: number | null;
        nextType: ObjectType;
        plantIds: string[];
    };

    openDeletePlantbedModal: (plantbedId: string) => void;

    openDeletePlantbedsModal: (payload: {
        selectedIds: string[];
        plantbedIds: string[];
        items: { plantbedId: string; plantbedNo: number | null; linkedCount: number; plantIds: string[] }[];
        totalSelected: number;
    }) => void;
    closeConfirmModal: () => void;

    // ✅ Delete “request” (intercept) i.p.v. direct deleten
    requestDeleteSelected: () => void;
    confirmModalPrimaryAction: () => void;

    // ✅ Bestaande delete blijft bestaan (wordt pas uitgevoerd na confirm)
    deleteSelected: () => void;

    undo: () => void;
    redo: () => void;

    clearHistory: () => void;


};

function applyCommand(state: ProjectState, cmd: Command): PolyObject[] {
    const finalize = (objects: PolyObject[]) => renumberPlantbedsSequential(objects);

    switch (cmd.kind) {
        case "addObject": {
            if (state.objects.some((o) => o.id === cmd.object.id)) return state.objects;
            return finalize([...state.objects, cmd.object]);
        }

        case "removeObject":
            return finalize(state.objects.filter((o) => o.id !== cmd.object.id));

        case "removeMany": {
            const ids = new Set(cmd.objects.map((o) => o.id));
            return finalize(state.objects.filter((o) => !ids.has(o.id)));
        }

        case "addMany": {
            const existingIds = new Set(state.objects.map((o) => o.id));
            const toAdd = cmd.objects.filter((o) => !existingIds.has(o.id));
            return finalize([...state.objects, ...toAdd]);
        }

        case "moveObject": {
            const dx = (cmd.toPoints?.[0] ?? 0) - (cmd.fromPoints?.[0] ?? 0);
            const dy = (cmd.toPoints?.[1] ?? 0) - (cmd.fromPoints?.[1] ?? 0);

            const translate = (pts: number[]) => {
                const out = [...pts];
                for (let i = 0; i < out.length; i += 2) {
                    out[i] += dx;
                    out[i + 1] += dy;
                }
                return out;
            };

            const nextObjects = state.objects.map((o) => {
                if (o.id !== cmd.id) return o;

                const nextHoles = o.holes ? o.holes.map((h) => translate(h)) : o.holes;

                return {
                    ...o,
                    points: cmd.toPoints,
                    holes: nextHoles,
                };
            });

            return finalize(nextObjects);
        }

        case "moveMany": {
            const itemMap = new Map(cmd.items.map((it) => [it.id, it]));

            const translateWith = (pts: number[], dx: number, dy: number) => {
                const out = [...pts];
                for (let i = 0; i < out.length; i += 2) {
                    out[i] += dx;
                    out[i + 1] += dy;
                }
                return out;
            };

            const nextObjects = state.objects.map((o) => {
                const it = itemMap.get(o.id);
                if (!it) return o;

                const dx = (it.toPoints?.[0] ?? 0) - (it.fromPoints?.[0] ?? 0);
                const dy = (it.toPoints?.[1] ?? 0) - (it.fromPoints?.[1] ?? 0);

                const nextHoles = o.holes ? o.holes.map((h) => translateWith(h, dx, dy)) : o.holes;

                return {
                    ...o,
                    points: it.toPoints,
                    holes: nextHoles,
                };
            });

            return finalize(nextObjects);
        }

        case "removeManyWithPlantbedLinks": {
            const ids = new Set(cmd.objects.map((o) => o.id));
            return finalize(state.objects.filter((o) => !ids.has(o.id)));
        }

        case "addManyWithPlantbedLinks": {
            const existingIds = new Set(state.objects.map((o) => o.id));
            const toAdd = cmd.objects.filter((o) => !existingIds.has(o.id));
            return finalize([...state.objects, ...toAdd]);
        }

        case "replaceMany": {
            const removeIds = new Set(cmd.before.map((o) => o.id));
            const remaining = state.objects.filter((o) => !removeIds.has(o.id));

            const existingIds = new Set(remaining.map((o) => o.id));
            const toAdd = cmd.after.filter((o) => !existingIds.has(o.id));

            return finalize([...remaining, ...toAdd]);
        }

        case "rotateCanvas": {
            return finalize(cmd.after);
        }

        case "replaceManyWithPlantbedLinks": {
            const removeIds = new Set(cmd.before.map((o) => o.id));
            const remaining = state.objects.filter((o) => !removeIds.has(o.id));

            const existingIds = new Set(remaining.map((o) => o.id));
            const toAdd = cmd.after.filter((o) => !existingIds.has(o.id));

            return finalize([...remaining, ...toAdd]);
        }

        default:
            return state.objects;
    }
}

function invertCommand(cmd: Command): Command {
    switch (cmd.kind) {
        case "addObject":
            return { kind: "removeObject", object: cmd.object };
        case "removeObject":
            return { kind: "addObject", object: cmd.object };
        case "moveObject":
            return { kind: "moveObject", id: cmd.id, fromPoints: cmd.toPoints, toPoints: cmd.fromPoints };
        case "moveMany":
            return {
                kind: "moveMany",
                items: cmd.items.map((it) => ({
                    id: it.id,
                    fromPoints: it.toPoints,
                    toPoints: it.fromPoints,
                })),
            };
        case "removeMany":
            return { kind: "addMany", objects: cmd.objects };
        case "addMany":
            return { kind: "removeMany", objects: cmd.objects };
        case "replaceMany":
            return { kind: "replaceMany", before: cmd.after, after: cmd.before };

        case "rotateCanvas":
            return {
                kind: "rotateCanvas",
                before: cmd.after,
                after: cmd.before,
                compassBefore: cmd.compassAfter,
                compassAfter: cmd.compassBefore,
            };

        case "replaceManyWithPlantbedLinks":
            return {
                kind: "replaceManyWithPlantbedLinks",
                before: cmd.after,
                after: cmd.before,
                removedLinks: cmd.removedLinks,
                removedCounts: cmd.removedCounts,
            };

        // ✅ plant link commands
        case "linkPlant":
            return { kind: "unlinkPlant", plantId: cmd.plantId, plantbedId: cmd.plantbedId };
        case "unlinkPlant":
            return { kind: "linkPlant", plantId: cmd.plantId, plantbedId: cmd.plantbedId };

        // ✅ plantbed delete commands
        case "removeManyWithPlantbedLinks":
            return {
                kind: "addManyWithPlantbedLinks",
                objects: cmd.objects,
                restoredLinks: cmd.removedLinks,
                restoredCounts: cmd.removedCounts,
            };

        case "addManyWithPlantbedLinks":
            return {
                kind: "removeManyWithPlantbedLinks",
                objects: cmd.objects,
                removedLinks: cmd.restoredLinks,
                removedCounts: cmd.restoredCounts,
            };
    }
}

const CLIPPER_SCALE = 1000;
const MERGE_EPS = 0.5;

type ClipperPoint = { X: number; Y: number };
type ClipperPath = ClipperPoint[];
type ClipperPaths = ClipperPath[];

function makeId() {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function bboxFromPoints(points: number[]) {
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

    for (let i = 0; i < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }

    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

const TREEBED_MIN_SIZE = 20;
const TREEBED_ESPALIER_MIN_HEIGHT = 100;
const TREEBED_ESPALIER_WIDTH_RATIO = 0.18;

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

function rebuildTreebedPointsForVariant(
    points: number[],
    nextVariant: TreebedVariant
) {
    const bb = bboxFromPoints(points);
    const cx = bb.x + bb.w / 2;
    const cy = bb.y + bb.h / 2;

    if (nextVariant === "espalier") {
        const sourceHeight = Math.max(bb.h, bb.w, TREEBED_ESPALIER_MIN_HEIGHT);
        const height = sourceHeight;
        const width = Math.max(TREEBED_MIN_SIZE, height * TREEBED_ESPALIER_WIDTH_RATIO);

        return createTreebedPointsFromRect(
            cx - width / 2,
            cy - height / 2,
            width,
            height
        );
    }

    const sourceSize = Math.max(Math.min(bb.w, bb.h), TREEBED_MIN_SIZE * 2);

    if (nextVariant === "roof") {
        return createTreebedPointsFromRect(
            cx - sourceSize / 2,
            cy - sourceSize / 2,
            sourceSize,
            sourceSize
        );
    }

    return createTreebedPointsFromCircle(cx, cy, sourceSize / 2);
}

const SNAP_GRID_SIZE = EDITOR_GRID_SIZE;

function snapValueToGrid(value: number, gridSize: number) {
    return Math.round(value / gridSize) * gridSize;
}
function snapPointsToGrid(points: number[], gridSize: number) {
    const out: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
        out.push(
            snapValueToGrid(points[i], gridSize),
            snapValueToGrid(points[i + 1], gridSize)
        );
    }
    return out;
}

function translatePoints(points: number[], dx: number, dy: number) {
    const out: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
        out.push(points[i] + dx, points[i + 1] + dy);
    }
    return out;
}

function translateHoles(holes: number[][] | undefined, dx: number, dy: number) {
    if (!holes || holes.length === 0) return holes;
    return holes.map((h) => translatePoints(h, dx, dy));
}

function bboxUnion(boxes: { x: number; y: number; w: number; h: number }[]) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const b of boxes) {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w);
        maxY = Math.max(maxY, b.y + b.h);
    }

    return {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
    };
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

function clipperPathsIntersect(a: ClipperPaths, b: ClipperPaths) {
    if (!a.length || !b.length) return false;

    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(a as any, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(b as any, ClipperLib.PolyType.ptClip, true);

    const solution = new ClipperLib.Paths();
    const succeeded = clipper.Execute(
        ClipperLib.ClipType.ctIntersection,
        solution as any,
        ClipperLib.PolyFillType.pftNonZero,
        ClipperLib.PolyFillType.pftNonZero
    );

    return Boolean(succeeded && solution.length > 0);
}

function translatePolyObjectForDuplicate(obj: PolyObject, dx: number, dy: number): PolyObject {
    return {
        ...obj,
        points: translatePoints(obj.points, dx, dy),
        boundarySegments: obj.boundarySegments?.map((segment) =>
            translatePoints(segment, dx, dy)
        ),
        holes: translateHoles(obj.holes, dx, dy),
    };
}

function duplicatePlacementCollides(
    translatedSources: PolyObject[],
    blockers: PolyObject[]
) {
    for (const source of translatedSources) {
        const sourceBox = bboxFromPoints(source.points);
        const sourceGeometry = source.geometry ?? getGeometryForType(source.type);

        for (const blocker of blockers) {
            const blockerBox = bboxFromPoints(blocker.points);

            if (!rectsOverlap(sourceBox, blockerBox)) continue;

            const blockerGeometry = blocker.geometry ?? getGeometryForType(blocker.type);

            if (sourceGeometry !== "polygon" || blockerGeometry !== "polygon") {
                return true;
            }

            const sourcePaths = polyObjectToClipperPaths(source);
            const blockerPaths = polyObjectToClipperPaths(blocker);

            if (clipperPathsIntersect(sourcePaths, blockerPaths)) {
                return true;
            }
        }
    }

    return false;
}

function findFirstFreeDuplicateDx(
    sourceObjects: PolyObject[],
    blockerObjects: PolyObject[],
    gap: number,
    step: number
) {
    const sourceBox = bboxUnion(sourceObjects.map((o) => bboxFromPoints(o.points)));
    let dx = sourceBox.w + gap;

    while (true) {
        const translatedSources = sourceObjects.map((obj) =>
            translatePolyObjectForDuplicate(obj, dx, 0)
        );

        const hasCollision = duplicatePlacementCollides(translatedSources, blockerObjects);
        if (!hasCollision) return dx;

        dx += step;
    }
}

const NUMBERED_LINKABLE_OBJECT_TYPES: ObjectType[] = ["plantbed", "hedge", "treebed"];

function isNumberedLinkableObjectType(type: ObjectType) {
    return NUMBERED_LINKABLE_OBJECT_TYPES.includes(type);
}

function getLowestFreePlantbedNoFromObjects(
    objects: PolyObject[],
    targetType: ObjectType = "plantbed"
) {
    const used = new Set(
        objects
            .filter((o) => o.type === targetType)
            .map((o) => o.plantbedNo ?? 0)
            .filter((n) => Number.isFinite(n) && n > 0)
    );

    let no = 1;
    while (used.has(no)) no++;
    return no;
}

function renumberPlantbedsSequential(objects: PolyObject[]) {
    const nextObjects = [...objects];

    for (const targetType of NUMBERED_LINKABLE_OBJECT_TYPES) {
        const numberedObjectsSorted = nextObjects
            .filter((obj) => obj.type === targetType)
            .slice()
            .sort((a, b) => {
                const aNo =
                    Number.isFinite(a.plantbedNo) && (a.plantbedNo ?? 0) > 0
                        ? (a.plantbedNo as number)
                        : Number.MAX_SAFE_INTEGER;

                const bNo =
                    Number.isFinite(b.plantbedNo) && (b.plantbedNo ?? 0) > 0
                        ? (b.plantbedNo as number)
                        : Number.MAX_SAFE_INTEGER;

                if (aNo !== bNo) return aNo - bNo;
                return nextObjects.indexOf(a) - nextObjects.indexOf(b);
            });

        const nextNoById = new Map<string, number>();
        numberedObjectsSorted.forEach((obj, index) => {
            nextNoById.set(obj.id, index + 1);
        });

        for (let i = 0; i < nextObjects.length; i += 1) {
            const obj = nextObjects[i];
            if (obj.type !== targetType) continue;

            const nextNo = nextNoById.get(obj.id);
            if (nextNo === undefined) continue;
            if (obj.plantbedNo === nextNo) continue;

            nextObjects[i] = {
                ...obj,
                plantbedNo: nextNo,
            };
        }
    }

    return nextObjects;
}

function cleanupPoints(points: number[], eps = 1e-6) {
    if (points.length < 6) return points;

    const eq = (a: number, b: number) => Math.abs(a - b) <= eps;

    const samePoint = (ax: number, ay: number, bx: number, by: number) =>
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

    // 1) remove consecutive duplicates
    const tmp: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];
        const n = tmp.length;

        if (n >= 2 && samePoint(tmp[n - 2], tmp[n - 1], x, y)) continue;
        tmp.push(x, y);
    }

    // 2) if last == first, drop last
    if (tmp.length >= 4) {
        const fx = tmp[0];
        const fy = tmp[1];
        const lx = tmp[tmp.length - 2];
        const ly = tmp[tmp.length - 1];

        if (samePoint(fx, fy, lx, ly)) {
            tmp.splice(tmp.length - 2, 2);
        }
    }

    let out = tmp;
    let changed = true;

    while (changed && out.length >= 8) {
        changed = false;
        const nPts = out.length / 2;

        // 3) remove any duplicate point that appears elsewhere in the same ring
        const nextNoDup: number[] = [];
        const seen: Array<{ x: number; y: number }> = [];

        for (let i = 0; i < nPts; i++) {
            const x = out[i * 2];
            const y = out[i * 2 + 1];

            const alreadySeen = seen.some((p) => samePoint(p.x, p.y, x, y));
            if (alreadySeen) {
                changed = true;
                continue;
            }

            seen.push({ x, y });
            nextNoDup.push(x, y);
        }

        out = nextNoDup;
        if (out.length < 6) break;

        // 4) remove collinear points
        const nAfterDup = out.length / 2;
        const nextNoCollinear: number[] = [];

        for (let i = 0; i < nAfterDup; i++) {
            const ip = (i - 1 + nAfterDup) % nAfterDup;
            const inx = (i + 1) % nAfterDup;

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

            nextNoCollinear.push(bx, by);
        }

        out = nextNoCollinear;
    }

    // Na snap + cleanup nog één keer laatste=eerste en consecutive duplicates bewaken
    if (out.length >= 4) {
        const fx = out[0];
        const fy = out[1];
        const lx = out[out.length - 2];
        const ly = out[out.length - 1];

        if (samePoint(fx, fy, lx, ly)) {
            out = out.slice(0, -2);
        }
    }

    const finalOut: number[] = [];
    for (let i = 0; i < out.length; i += 2) {
        const x = out[i];
        const y = out[i + 1];
        const n = finalOut.length;

        if (n >= 2 && samePoint(finalOut[n - 2], finalOut[n - 1], x, y)) continue;
        finalOut.push(x, y);
    }

    return finalOut.length >= 6 ? finalOut : points;
}

type CellKey = string;

// "cx:cy"
function cellKey(cx: number, cy: number): CellKey {
    return `${cx}:${cy}`;
}
function parseCellKey(k: CellKey) {
    const [a, b] = k.split(":");
    return { cx: Number(a), cy: Number(b) };
}

function pointInPolygon(px: number, py: number, poly: number[]) {
    // Ray casting (even/odd)
    let inside = false;
    for (let i = 0, j = poly.length - 2; i < poly.length; i += 2) {
        const xi = poly[i], yi = poly[i + 1];
        const xj = poly[j], yj = poly[j + 1];

        const intersect =
            ((yi > py) !== (yj > py)) &&
            (px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi);

        if (intersect) inside = !inside;
        j = i;
    }
    return inside;
}

function polyToCells(points: number[], gridSize: number): Set<CellKey> {
    const cells = new Set<CellKey>();
    if (points.length < 6) return cells;

    const bb = bboxFromPoints(points);

    const minCx = Math.floor(bb.x / gridSize) - 1;
    const maxCx = Math.ceil((bb.x + bb.w) / gridSize) + 1;
    const minCy = Math.floor(bb.y / gridSize) - 1;
    const maxCy = Math.ceil((bb.y + bb.h) / gridSize) + 1;

    // sample cell centers
    for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
            const centerX = (cx + 0.5) * gridSize;
            const centerY = (cy + 0.5) * gridSize;

            if (pointInPolygon(centerX, centerY, points)) {
                cells.add(cellKey(cx, cy));
            }
        }
    }

    return cells;
}

// Boundary extraction: cells -> 1..N polygons (orthogonal, grid-aligned)
function cellsToPolygons(cells: Set<CellKey>, gridSize: number): number[][] {
    if (cells.size === 0) return [];

    const has = (cx: number, cy: number) => cells.has(cellKey(cx, cy));

    // directed edges (clockwise)
    // edge key: "x1,y1|x2,y2"
    const edges = new Map<string, { x1: number; y1: number; x2: number; y2: number }>();

    const addEdge = (x1: number, y1: number, x2: number, y2: number) => {
        const k = `${x1},${y1}|${x2},${y2}`;
        edges.set(k, { x1, y1, x2, y2 });
    };

    for (const k of cells) {
        const { cx, cy } = parseCellKey(k);

        const x0 = cx * gridSize;
        const y0 = cy * gridSize;
        const x1 = (cx + 1) * gridSize;
        const y1 = (cy + 1) * gridSize;

        // top (cw: left->right) if no neighbor above
        if (!has(cx, cy - 1)) addEdge(x0, y0, x1, y0);

        // right (cw: top->bottom) if no neighbor right
        if (!has(cx + 1, cy)) addEdge(x1, y0, x1, y1);

        // bottom (cw: right->left) if no neighbor below
        if (!has(cx, cy + 1)) addEdge(x1, y1, x0, y1);

        // left (cw: bottom->top) if no neighbor left
        if (!has(cx - 1, cy)) addEdge(x0, y1, x0, y0);
    }

    // Build adjacency from edges
    const edgeByStart = new Map<string, string>(); // startPointKey -> edgeKey

    for (const [ek, e] of edges) {
        const s = `${e.x1},${e.y1}`;
        edgeByStart.set(s, ek);
    }

    const polygons: number[][] = [];

    // Walk loops until edges exhausted
    while (edges.size > 0) {
        // pick any remaining edge
        const [firstKey, firstEdge] = edges.entries().next().value as any;
        const start = `${firstEdge.x1},${firstEdge.y1}`;

        const pts: number[] = [];
        let cur = start;
        let safety = 0;

        while (safety++ < 200000) {
            const ek = edgeByStart.get(cur);
            if (!ek) break;

            const e = edges.get(ek);
            if (!e) break;

            // consume edge
            edges.delete(ek);

            // append start point
            pts.push(e.x1, e.y1);

            // move
            cur = `${e.x2},${e.y2}`;

            if (cur === start) break;
        }

        if (pts.length >= 6) {
            polygons.push(cleanupPoints(pts));
        }
    }

    return polygons;
}

function isOrthogonalPolygon(points: number[], eps = 1e-6) {
    if (points.length < 6) return true;

    const snapped = snapPointsToGrid(points, SNAP_GRID_SIZE);
    const n = snapped.length / 2;

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;

        const x1 = snapped[i * 2];
        const y1 = snapped[i * 2 + 1];
        const x2 = snapped[j * 2];
        const y2 = snapped[j * 2 + 1];

        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);

        if (dx > eps && dy > eps) return false;
    }

    return true;
}

function shouldUseCellMerge(polys: PolyObject[]) {
    for (const p of polys) {
        if (!isOrthogonalPolygon(p.points)) return false;

        if ((p.holes?.length ?? 0) > 0) {
            return false;
        }
    }

    return true;
}

function normalizeMergeRing(points: number[]) {
    // Alle editor-input is grid-snapped.
    // Union/difference kan mini-float-artifacts teruggeven zoals 950.207 / 950.5 / 950.793.
    // Die moeten terug naar het raster voordat we cleanup doen, anders ontstaan micro-segmenten
    // en dus extra vertexbolletjes.
    const snapped = snapPointsToGrid(points, SNAP_GRID_SIZE);
    return cleanupPoints(snapped);
}

function normalizeMergePieces(pieces: DiffPiece[] | null): DiffPiece[] | null {
    if (!pieces || pieces.length === 0) return null;

    const normalized = pieces
        .map((piece) => ({
            outer: normalizeMergeRing(piece.outer),
            holes: (piece.holes ?? [])
                .map((h) => normalizeMergeRing(h))
                .filter((h) => h.length >= 6),
        }))
        .filter((piece) => piece.outer.length >= 6);

    return normalized.length > 0 ? normalized : null;
}

function mergeSameTypeViaCells(polys: PolyObject[], gridSize: number): DiffPiece[] | null {
    if (polys.length < 2) return null;

    const all = new Set<CellKey>();

    for (const p of polys) {
        const outerPts = snapPointsToGrid(p.points, gridSize);
        const outerCells = polyToCells(outerPts, gridSize);
        for (const c of outerCells) all.add(c);

        for (const hole of p.holes ?? []) {
            const holePts = snapPointsToGrid(hole, gridSize);
            const holeCells = polyToCells(holePts, gridSize);
            for (const c of holeCells) all.delete(c);
        }
    }

    const out = cellsToPolygons(all, gridSize);

    if (!out || out.length === 0) return null;

    return normalizeMergePieces(unionPolygonPieces(out));
}

function pointsToPath(points: number[]): ClipperPath {
    const path: ClipperPath = [];
    for (let i = 0; i < points.length; i += 2) {
        path.push({
            X: Math.round(points[i] * CLIPPER_SCALE),
            Y: Math.round(points[i + 1] * CLIPPER_SCALE),
        });
    }
    return path;
}

function pathToPoints(path: ClipperPath): number[] {
    const pts: number[] = [];
    for (const p of path) {
        pts.push(p.X / CLIPPER_SCALE, p.Y / CLIPPER_SCALE);
    }
    return pts;
}

function ensureClockwise(path: ClipperPath): ClipperPath {
    // In clipper-lib: Orientation(path) === true betekent doorgaans "clockwise"
    const isClockwise = ClipperLib.Clipper.Orientation(path as any);
    if (isClockwise) return path;
    return [...path].reverse();
}

function ensureCounterClockwise(path: ClipperPath): ClipperPath {
    const isClockwise = ClipperLib.Clipper.Orientation(path as any);
    if (!isClockwise) return path;
    return [...path].reverse();
}

function normalizeWinding(paths: ClipperPaths): ClipperPaths {
    return paths.map((p) => ensureClockwise(p));
}

function polyObjectToClipperPaths(obj: PolyObject): ClipperPaths {
    const out: ClipperPaths = [];

    // Belangrijk:
    // voor self-touch / resize -> donut scenario's mogen we hier NIET cleanupPoints gebruiken,
    // want die haalt duplicate vertices en collineaire structuur weg die Clipper juist nodig heeft
    // om outer + hole correct te reconstrueren.
    const outer = cleanupPointsKeepCollinear(obj.points);
    if (outer.length >= 6) {
        out.push(ensureClockwise(pointsToPath(outer)));
    }

    for (const hole of obj.holes ?? []) {
        const preparedHole = cleanupPointsKeepCollinear(hole);
        if (preparedHole.length >= 6) {
            out.push(ensureCounterClockwise(pointsToPath(preparedHole)));
        }
    }

    return out;
}

function offsetPaths(paths: ClipperPaths, deltaCanvasUnits: number): ClipperPaths {
    if (!paths || paths.length === 0) return [];

    const co = new (ClipperLib.ClipperOffset as any)(2, 0.25 * CLIPPER_SCALE);
    co.AddPaths(paths as any, ClipperLib.JoinType.jtSquare, ClipperLib.EndType.etClosedPolygon);

    const out: ClipperPaths = new (ClipperLib.Paths as any)();
    co.Execute(out as any, Math.round(deltaCanvasUnits * CLIPPER_SCALE));
    return out;
}

function extractOuterPathsFromPolyTree(polyTree: any): ClipperPaths {
    const result: ClipperPaths = [];

    const stack: any[] = getPolyNodeChildren(polyTree);

    const isHole = (node: any) => {
        if (!node) return false;
        // clipper-lib: vaak IsHole() als functie
        if (typeof node.IsHole === "function") return Boolean(node.IsHole());
        return Boolean(node.IsHole);
    };

    const contourOf = (node: any): ClipperPath | null => {
        if (!node) return null;
        // soms is Contour een property, soms m_polygon, soms een functie
        if (Array.isArray(node.Contour)) return node.Contour as ClipperPath;
        if (Array.isArray(node.m_polygon)) return node.m_polygon as ClipperPath;
        if (typeof node.Contour === "function") {
            const c = node.Contour();
            return Array.isArray(c) ? (c as ClipperPath) : null;
        }
        return null;
    };

    while (stack.length) {
        const node = stack.pop();
        if (!node) continue;

        const contour = contourOf(node);

        if (!isHole(node) && contour && contour.length >= 3) {
            result.push(contour);
        }

        const kids = getPolyNodeChildren(node);
        for (const c of kids) stack.push(c);
    }

    return result;
}

function extractDiffPiecesFromPolyTree(polyTree: any): DiffPiece[] {
    const pieces: DiffPiece[] = [];
    const stack: any[] = getPolyNodeChildren(polyTree);

    const isHole = (node: any) => {
        if (!node) return false;
        if (typeof node.IsHole === "function") return Boolean(node.IsHole());
        return Boolean(node.IsHole);
    };

    const contourOf = (node: any): ClipperPath | null => {
        if (!node) return null;
        if (Array.isArray(node.Contour)) return node.Contour as ClipperPath;
        if (Array.isArray(node.m_polygon)) return node.m_polygon as ClipperPath;
        if (typeof node.Contour === "function") {
            const c = node.Contour();
            return Array.isArray(c) ? (c as ClipperPath) : null;
        }
        return null;
    };

    while (stack.length) {
        const node = stack.pop();
        if (!node) continue;

        if (isHole(node)) continue;

        const outerContour = contourOf(node);
        if (!outerContour || outerContour.length < 3) continue;

        const outerPtsRaw = pathToPoints(outerContour);
        const outerPtsMaybeSnapped = isOrthogonalPolygon(outerPtsRaw)
            ? snapPointsToGrid(outerPtsRaw, SNAP_GRID_SIZE)
            : outerPtsRaw;

        const outerPts = cleanupPoints(outerPtsMaybeSnapped);
        if (outerPts.length < 6) continue;

        const holes: number[][] = [];

        for (const child of getPolyNodeChildren(node)) {
            if (!child || !isHole(child)) continue;

            const holeContour = contourOf(child);
            if (!holeContour || holeContour.length < 3) continue;

            const holePtsRaw = pathToPoints(holeContour);
            const holePtsMaybeSnapped = isOrthogonalPolygon(holePtsRaw)
                ? snapPointsToGrid(holePtsRaw, SNAP_GRID_SIZE)
                : holePtsRaw;

            const holePts = cleanupPoints(holePtsMaybeSnapped);
            if (holePts.length < 6) continue;
            if (!isUsableHole(holePts)) continue;

            holes.push(holePts);
        }

        pieces.push({
            outer: outerPts,
            holes: sanitizeHoles(holes) ?? [],
        });

        const kids = getPolyNodeChildren(node);
        for (const c of kids) stack.push(c);
    }

    return pieces;
}

function getPolyNodeChildren(node: any): any[] {
    if (!node) return [];

    // Meest voorkomend in clipper-lib builds: m_Childs
    if (Array.isArray(node.m_Childs)) return node.m_Childs;

    // Soms is Childs een array-property
    if (Array.isArray(node.Childs)) return node.Childs;

    // Soms is Childs een functie
    if (typeof node.Childs === "function") {
        const res = node.Childs();
        return Array.isArray(res) ? res : [];
    }

    return [];
}

function unionSameTypePolygons(polys: PolyObject[]): DiffPiece[] | null {
    if (polys.length < 2) return null;

    const rawPaths: ClipperPaths = polys.flatMap((p) => polyObjectToClipperPaths(p));
    const FILL = ClipperLib.PolyFillType.pftNonZero;

    const hasHoles = polys.some((p) => (p.holes?.length ?? 0) > 0);

    // Belangrijk:
    // Bij objecten met holes mogen we de winding NIET globaal normaliseren.
    // normalizeWinding(...) maakt namelijk ook hole-contours clockwise,
    // waardoor Clipper die holes als gewone vlakken ziet en het gat dichtloopt.
    const simplifiedIn: ClipperPaths =
        hasHoles
            ? rawPaths
            : ((ClipperLib.Clipper.SimplifyPolygons(rawPaths as any, FILL) as any) || []);

    const subjects: ClipperPaths =
        hasHoles
            ? simplifiedIn
            : normalizeWinding(simplifiedIn);

    if (!subjects || subjects.length === 0) return null;

    // Voor shapes zonder holes houden we de bestaande touch-merge semantiek via inflate.
    // Voor shapes mét holes mogen we NIET inflaten, anders lopen gaten dicht.
    const unionInput: ClipperPaths = hasHoles ? subjects : offsetPaths(subjects, MERGE_EPS);
    if (!unionInput || unionInput.length === 0) return null;

    const clip = new ClipperLib.Clipper();
    clip.AddPaths(unionInput as any, ClipperLib.PolyType.ptSubject, true);

    const polyTree = new (ClipperLib.PolyTree as any)();
    const ok = clip.Execute(ClipperLib.ClipType.ctUnion, polyTree as any, FILL, FILL);
    if (!ok) return null;

    const pieces = extractDiffPiecesFromPolyTree(polyTree);
    if (!pieces || pieces.length === 0) return null;

    return normalizeMergePieces(pieces);
}
// -----------------------------
// ✅ Fence/Gate compatibility helpers
// We halen hier bewust alle speciale fence-boundary snapping en corridor-masking uit.
// Polygonen blijven gewoon op raster-snapping werken.
// Fence/Gate blijven line-only objecten.
// -----------------------------
const FENCE_STROKE_WIDTH = 14;

function cleanupPointsKeepCollinear(points: number[], eps = 1e-6) {
    if (points.length < 6) return points;

    const eq = (a: number, b: number) => Math.abs(a - b) <= eps;

    const tmp: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];
        const n = tmp.length;

        if (n >= 2 && eq(tmp[n - 2], x) && eq(tmp[n - 1], y)) continue;
        tmp.push(x, y);
    }

    if (tmp.length >= 4) {
        const fx = tmp[0];
        const fy = tmp[1];
        const lx = tmp[tmp.length - 2];
        const ly = tmp[tmp.length - 1];

        if (eq(fx, lx) && eq(fy, ly)) {
            tmp.splice(tmp.length - 2, 2);
        }
    }

    return tmp;
}

function snapPolygonEdgesToLineBoundaries(
    subject: PolyObject,
    _lineObjects: PolyObject[],
    _polygonObjects: PolyObject[]
) {
    if (isPolylineObject(subject)) {
        return {
            ...subject,
            geometry: subject.geometry ?? getGeometryForType(subject.type),
            renderPieces: [],
        };
    }

    return {
        ...subject,
        geometry: subject.geometry ?? getGeometryForType(subject.type),

        // Belangrijk:
        // bij edge-resize / self-touch vormen mogen we de contour hier nog NIET
        // agressief opschonen, anders verdwijnt precies de topologie die later
        // door self-union naar een donut moet worden omgezet.
        points: cleanupPointsKeepCollinear(subject.points),
        holes: subject.holes?.map((h) => cleanupPointsKeepCollinear(h)),
    };
}

function reconcilePolygonsAgainstLineObjects(objects: PolyObject[], _lineObjects: PolyObject[]) {
    return objects.map((o) => {
        if (isPolylineObject(o)) {
            return {
                ...o,
                geometry: o.geometry ?? getGeometryForType(o.type),
                renderPieces: [],
            };
        }

        return {
            ...o,
            geometry: o.geometry ?? getGeometryForType(o.type),
            points: cleanupPoints(o.points),
            holes: o.holes?.map((h) => cleanupPoints(h)),
        };
    });
}

function polylineToStrokePolygons(_points: number[], _strokeWidth: number): number[][] {
    return [];
}

function diffPolygons(subjects: number[][], _cutters: PolyObject[]): number[][] {
    return subjects;
}

function computeLineRenderPieces(_lineObj: PolyObject, _allObjects: PolyObject[]): number[][] {
    return [];
}

function pointInPolyObject(px: number, py: number, obj: PolyObject) {
    if (isPolylineObject(obj)) return false;
    if (!obj.points || obj.points.length < 6) return false;
    if (!pointInPolygon(px, py, obj.points)) return false;

    const holes = obj.holes ?? [];
    for (const hole of holes) {
        if (hole.length >= 6 && pointInPolygon(px, py, hole)) {
            return false;
        }
    }

    return true;
}

function inferPolylineRenderSide(
    obj: PolyObject,
    allObjects: PolyObject[],
    fallback: 1 | -1 = 1
): 1 | -1 {
    if (!isPolylineObject(obj)) return fallback;
    if (!obj.points || obj.points.length < 4) return fallback;

    const blockers = allObjects.filter(
        (o) => o.id !== obj.id && !isPolylineObject(o) && o.points && o.points.length >= 6
    );

    if (blockers.length === 0) return fallback;

    const visualHalfWidth = obj.type === "gate" || obj.type === "fence" ? 7 : 1;
    const sampleOffset = visualHalfWidth + 4;

    let leftScore = 0;
    let rightScore = 0;

    for (let i = 0; i <= obj.points.length - 4; i += 2) {
        const ax = obj.points[i];
        const ay = obj.points[i + 1];
        const bx = obj.points[i + 2];
        const by = obj.points[i + 3];

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
            if (!leftHit && pointInPolyObject(leftX, leftY, blocker)) leftHit = true;
            if (!rightHit && pointInPolyObject(rightX, rightY, blocker)) rightHit = true;
            if (leftHit && rightHit) break;
        }

        if (leftHit) leftScore += len;
        if (rightHit) rightScore += len;
    }

    if (leftScore === rightScore) return fallback;

    // huidige renderfunctie gebruikt + normaal als "linker" zijde.
    // Als links de binnenkant raakt, moet de zichtbare lijn naar rechts.
    return leftScore > rightScore ? -1 : 1;
}

function withLinePieces(obj: PolyObject, allObjects: PolyObject[]): PolyObject {
    const normalized: PolyObject = normalizeBoundaryObjectSegments({
        ...obj,
        geometry: obj.geometry ?? getGeometryForType(obj.type),
    });

    if (!isPolylineObject(normalized)) return normalized;

    const renderSide = inferPolylineRenderSide(
        normalized,
        allObjects,
        normalized.renderSide ?? 1
    );

    const bandShape = getBoundaryBandShapeForObject(normalized, SNAP_GRID_SIZE);

    return {
        ...normalized,
        renderSide,
        renderPieces: bandShape.outer && bandShape.outer.length >= 6
            ? [bandShape.outer]
            : [],
    };
}

function recalcLinePiecesForWorld(objects: PolyObject[]): PolyObject[] {
    if (!objects || objects.length === 0) return objects;

    const normalizedWorld = objects.map((o) => ({
        ...o,
        geometry: o.geometry ?? getGeometryForType(o.type),
    })) as PolyObject[];

    return normalizedWorld.map((o) => {
        if (isPolylineObject(o)) {
            return withLinePieces(
                normalizeBoundaryObjectSegments({
                    ...o,
                    points: preserveClosedBoundaryEndpoint(o.points, o.type),
                }),
                normalizedWorld
            );
        }

        return {
            ...o,
            points: cleanupPoints(o.points),
            holes: o.holes?.map((h) => cleanupPoints(h)),
        };
    });
}

// -------------------------
// ✅ Cell-diff helpers (orthogonal only)
// -------------------------
function rectToPoints(x0: number, y0: number, x1: number, y1: number): number[] {
    return cleanupPoints([x0, y0, x1, y0, x1, y1, x0, y1]);
}

function cellsToRectangles(cells: Set<CellKey>, gridSize: number): number[][] {
    if (cells.size === 0) return [];

    // Parse cells into numeric coords for fast scan
    const coords: { cx: number; cy: number }[] = [];
    for (const k of cells) coords.push(parseCellKey(k));

    // Build lookup + bounds
    const has = (cx: number, cy: number) => cells.has(cellKey(cx, cy));

    let minCx = Infinity, minCy = Infinity, maxCx = -Infinity, maxCy = -Infinity;
    for (const { cx, cy } of coords) {
        if (cx < minCx) minCx = cx;
        if (cy < minCy) minCy = cy;
        if (cx > maxCx) maxCx = cx;
        if (cy > maxCy) maxCy = cy;
    }

    const visited = new Set<CellKey>();
    const rects: number[][] = [];

    for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
            const k = cellKey(cx, cy);
            if (!has(cx, cy) || visited.has(k)) continue;

            // 1) grow width
            let w = 1;
            while (has(cx + w, cy) && !visited.has(cellKey(cx + w, cy))) w++;

            // 2) grow height while full row blocks
            let h = 1;
            outer: while (true) {
                const ny = cy + h;
                for (let dx = 0; dx < w; dx++) {
                    const nk = cellKey(cx + dx, ny);
                    if (!has(cx + dx, ny) || visited.has(nk)) break outer;
                }
                h++;
            }

            // 3) mark visited
            for (let dy = 0; dy < h; dy++) {
                for (let dx = 0; dx < w; dx++) {
                    visited.add(cellKey(cx + dx, cy + dy));
                }
            }

            // 4) convert to polygon (rect)
            const x0 = cx * gridSize;
            const y0 = cy * gridSize;
            const x1 = (cx + w) * gridSize;
            const y1 = (cy + h) * gridSize;

            rects.push(rectToPoints(x0, y0, x1, y1));
        }
    }

    return rects;
}

type DiffPiece = { outer: number[]; holes: number[][] };

function subtractPolygonsPieces(subject: PolyObject, cutters: PolyObject[]): DiffPiece[] | null {
    if (!cutters.length) return null;

    const FILL = ClipperLib.PolyFillType.pftNonZero;

    const subjPaths = polyObjectToClipperPaths(subject);
    const clipPaths = cutters.flatMap((c) => polyObjectToClipperPaths(c));

    if (subjPaths.length === 0 || clipPaths.length === 0) return null;

    const clip = new ClipperLib.Clipper();
    clip.AddPaths(subjPaths as any, ClipperLib.PolyType.ptSubject, true);
    clip.AddPaths(clipPaths as any, ClipperLib.PolyType.ptClip, true);

    const polyTree = new (ClipperLib.PolyTree as any)();
    const ok = clip.Execute(ClipperLib.ClipType.ctDifference, polyTree as any, FILL, FILL);
    if (!ok) return null;

    const isHole = (node: any) => {
        if (!node) return false;
        if (typeof node.IsHole === "function") return Boolean(node.IsHole());
        return Boolean(node.IsHole);
    };

    const contourOf = (node: any): ClipperPath | null => {
        if (!node) return null;
        if (Array.isArray(node.Contour)) return node.Contour as ClipperPath;
        if (Array.isArray(node.m_polygon)) return node.m_polygon as ClipperPath;
        if (typeof node.Contour === "function") {
            const c = node.Contour();
            return Array.isArray(c) ? (c as ClipperPath) : null;
        }
        return null;
    };

    const childrenOf = (node: any) => getPolyNodeChildren(node);

    const pieces: DiffPiece[] = [];
    const stack = childrenOf(polyTree);

    for (const node of stack) {
        if (!node) continue;
        if (isHole(node)) continue;

        const outerPath = contourOf(node);
        if (!outerPath || outerPath.length < 3) continue;

        const outerPts = cleanupPoints(pathToPoints(outerPath));
        if (outerPts.length < 6) continue;

        const holes: number[][] = [];
        const kids = childrenOf(node);

        for (const kid of kids) {
            if (!kid) continue;
            if (!isHole(kid)) continue;

            const holePath = contourOf(kid);
            if (!holePath || holePath.length < 3) continue;

            const holePts = cleanupPoints(pathToPoints(holePath));
            if (holePts.length < 6) continue;

            holes.push(holePts);
        }

        pieces.push({ outer: outerPts, holes });
    }

    if (pieces.length === 0) return null;

    return pieces;
}

function unionPolygonPieces(subjects: number[][]): DiffPiece[] | null {
    if (!subjects.length) return null;

    const FILL = ClipperLib.PolyFillType.pftNonZero;
    const subjPaths: ClipperPaths = subjects.map((pts) => pointsToPath(pts));

    const clip = new ClipperLib.Clipper();
    clip.AddPaths(subjPaths as any, ClipperLib.PolyType.ptSubject, true);

    const polyTree = new (ClipperLib.PolyTree as any)();
    const ok = clip.Execute(ClipperLib.ClipType.ctUnion, polyTree as any, FILL, FILL);
    if (!ok) return null;

    const isHole = (node: any) => {
        if (!node) return false;
        if (typeof node.IsHole === "function") return Boolean(node.IsHole());
        return Boolean(node.IsHole);
    };

    const contourOf = (node: any): ClipperPath | null => {
        if (!node) return null;
        if (Array.isArray(node.Contour)) return node.Contour as ClipperPath;
        if (Array.isArray(node.m_polygon)) return node.m_polygon as ClipperPath;
        if (typeof node.Contour === "function") {
            const c = node.Contour();
            return Array.isArray(c) ? (c as ClipperPath) : null;
        }
        return null;
    };

    const childrenOf = (node: any) => getPolyNodeChildren(node);

    const pieces: DiffPiece[] = [];
    const stack = childrenOf(polyTree);

    for (const node of stack) {
        if (!node) continue;
        if (isHole(node)) continue;

        const outerPath = contourOf(node);
        if (!outerPath || outerPath.length < 3) continue;

        const outerPts = cleanupPoints(pathToPoints(outerPath));
        if (outerPts.length < 6) continue;

        const holes: number[][] = [];
        const kids = childrenOf(node);

        for (const kid of kids) {
            if (!kid) continue;
            if (!isHole(kid)) continue;

            const holePath = contourOf(kid);
            if (!holePath || holePath.length < 3) continue;

            const holePts = cleanupPoints(pathToPoints(holePath));
            if (holePts.length < 6) continue;

            holes.push(holePts);
        }

        pieces.push({ outer: outerPts, holes });
    }

    if (pieces.length === 0) return null;

    return pieces;
}

function subtractPolygons(subject: PolyObject, cutters: PolyObject[]): number[][] | null {
    const pieces = subtractPolygonsPieces(subject, cutters);
    if (!pieces || pieces.length === 0) return null;

    const outers = pieces
        .map((p) => p.outer)
        .filter((pts) => Array.isArray(pts) && pts.length >= 6);

    return outers.length ? outers : null;
}

function recalcNextPlantbedNo(objects: PolyObject[]) {
    const used = new Set(
        objects
            .filter((o) => o.type === "plantbed")
            .map((o) => o.plantbedNo ?? 0)
            .filter((n) => Number.isFinite(n) && n > 0)
    );

    let no = 1;
    while (used.has(no)) no++;
    return no; // ✅ laagste vrije nummer
}

function applyLink(state: ProjectState, plantId: string, plantbedId: string) {
    const prevLinks = state.plantbedLinks;
    const prevArr = prevLinks[plantbedId] ?? [];

    const nextArr = prevArr.includes(plantId) ? prevArr : [...prevArr, plantId];

    const nextLinks: PlantbedLinksMap = {
        ...prevLinks,
        [plantbedId]: nextArr,
    };

    const nextCounts = {
        ...state.plantbedLinkedCount,
        [plantbedId]: nextArr.length,
    };

    return { plantbedLinks: nextLinks, plantbedLinkedCount: nextCounts };
}

function applyUnlink(state: ProjectState, plantId: string, plantbedId: string) {
    const prevLinks = state.plantbedLinks;
    const prevArr = prevLinks[plantbedId] ?? [];
    if (prevArr.length === 0) return { plantbedLinks: prevLinks, plantbedLinkedCount: state.plantbedLinkedCount };

    const nextArr = prevArr.filter((id) => id !== plantId);

    const nextLinks: PlantbedLinksMap = {
        ...prevLinks,
        [plantbedId]: nextArr,
    };

    const nextCounts = {
        ...state.plantbedLinkedCount,
        [plantbedId]: nextArr.length,
    };

    return { plantbedLinks: nextLinks, plantbedLinkedCount: nextCounts };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    objects: [],
    nextPlantbedNo: 1,
    plantbedLinkedCount: {},
    distributionOverrides: {},

    // ✅ Plants + linking state
    plants: [],
    plantbedLinks: {} as PlantbedLinksMap,

    setPlants: (plants) => set({ plants }),

    setDistributionOverridesForObject: (objectId, overrides) =>
        set((state) => ({
            distributionOverrides: {
                ...state.distributionOverrides,
                [objectId]: { ...overrides },
            },
        })),

    clearDistributionOverridesForObject: (objectId) =>
        set((state) => {
            const next = { ...state.distributionOverrides };
            delete next[objectId];
            return { distributionOverrides: next };
        }),

    ensureDummyPlants: (useExtended) => {
        const existing = get().plants;
        if (existing && existing.length > 0) return;

        set({
            plants: useExtended ? [...BASE_DUMMY_PLANTS, ...EXTRA_DUMMY_PLANTS] : BASE_DUMMY_PLANTS,
        });
    },

    getPlantById: (plantId) => {
        return get().plants.find((p) => p.id === plantId) ?? null;
    },

    getLinkedPlantIdsForPlantbed: (plantbedId) => {
        const state = get();
        const isValidLinkedObject = state.objects.some(
            (obj) => obj.id === plantbedId && isNumberedLinkableObjectType(obj.type)
        );

        if (!isValidLinkedObject) return [];
        return state.plantbedLinks[plantbedId] ?? [];
    },

    isPlantLinked: (plantId) => {
        const state = get();
        const validPlantbedIds = new Set(
            state.objects
                .filter((obj) => isNumberedLinkableObjectType(obj.type))
                .map((obj) => obj.id)
        );

        return Object.entries(state.plantbedLinks).some(([plantbedId, arr]) => {
            if (!validPlantbedIds.has(plantbedId)) return false;
            return (arr ?? []).includes(plantId);
        });
    },

    getLinkedProgress: () => {
        const state = get();
        const total = state.plants.length;
        const validPlantbedIds = new Set(
            state.objects
                .filter((obj) => isNumberedLinkableObjectType(obj.type))
                .map((obj) => obj.id)
        );

        const linkedPlantIds = new Set<string>();

        Object.entries(state.plantbedLinks).forEach(([plantbedId, arr]) => {
            if (!validPlantbedIds.has(plantbedId)) return;
            (arr ?? []).forEach((pid) => linkedPlantIds.add(pid));
        });

        return { linked: linkedPlantIds.size, total };
    },

    linkPlantToPlantbed: (plantId, plantbedId) => {
        let didLink = false;

        set((state) => {
            const isValidPlantbed = state.objects.some(
                (obj) => obj.id === plantbedId && isNumberedLinkableObjectType(obj.type)
            );

            if (!isValidPlantbed) return state;

            const existingLinks = state.plantbedLinks?.[plantbedId] ?? [];
            if (existingLinks.includes(plantId)) return state;

            const cmd: Command = { kind: "linkPlant", plantId, plantbedId };

            const { plantbedLinks, plantbedLinkedCount } = applyLink(
                state as ProjectState,
                plantId,
                plantbedId
            );

            didLink = true;

            return {
                plantbedLinks,
                plantbedLinkedCount,
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        });

        return didLink;
    },

    unlinkPlantFromPlantbedByPlantId: (plantbedId, plantId) =>
        set((state) => {
            const hasLink = (state.plantbedLinks[plantbedId] ?? []).includes(plantId);
            if (!hasLink) return state;

            const cmd: Command = { kind: "unlinkPlant", plantId, plantbedId };

            const { plantbedLinks, plantbedLinkedCount } = applyUnlink(state as ProjectState, plantId, plantbedId);

            return {
                plantbedLinks,
                plantbedLinkedCount,
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    getPlantbedNo: (id) => {
        const o = get().objects.find((x) => x.id === id);
        return o && isNumberedLinkableObjectType(o.type) ? (o.plantbedNo ?? null) : null;
    },

    getPlantbedLinkedCount: (id) => {
        const state = get();
        const isValidPlantbed = state.objects.some(
            (obj) => obj.id === id && isNumberedLinkableObjectType(obj.type)
        );

        if (!isValidPlantbed) return 0;
        return state.plantbedLinkedCount[id] ?? 0;
    },

    // ✅ Gebruik dezelfde corridor+clipping logic als “final”, maar dan voor draft points
    getPolylineRenderPieces: (points, type) => {
        if (!points || points.length < 4) return [];
        if (!isUnifiedBoundaryType(type)) return [];

        const bandPoints = getBoundaryBandPoints(points, type, SNAP_GRID_SIZE);
        if (!bandPoints || bandPoints.length < 6) return [];

        return [bandPoints];
    },

    duplicateSelected: () =>
        set((state) => {
            const ids =
                state.selectedObjectIds && state.selectedObjectIds.length > 0
                    ? state.selectedObjectIds
                    : state.selectedObjectId
                        ? [state.selectedObjectId]
                        : [];

            if (ids.length === 0) return state;

            const sourceObjects = ids
                .map((id) => state.objects.find((o) => o.id === id))
                .filter(Boolean) as PolyObject[];

            if (sourceObjects.length === 0) return state;

            const blockerObjects = state.objects.filter((o) => !ids.includes(o.id));

            const dx = findFirstFreeDuplicateDx(
                sourceObjects,
                blockerObjects,
                SNAP_GRID_SIZE,
                SNAP_GRID_SIZE
            );

            const dy = 0;

            let nextPlantbedNo = getLowestFreePlantbedNoFromObjects(state.objects);

            const nextLinksMap: PlantbedLinksMap = { ...state.plantbedLinks };
            const nextCountsMap: Record<string, number> = { ...state.plantbedLinkedCount };

            const duplicatedRaw: PolyObject[] = sourceObjects.map((obj) => {
                const nextId = makeId();

                const duplicated: PolyObject = {
                    ...obj,
                    id: nextId,
                    points: translatePoints(obj.points, dx, dy),
                    boundarySegments: obj.boundarySegments?.map((segment) =>
                        translatePoints(segment, dx, dy)
                    ),
                    holes: translateHoles(obj.holes, dx, dy),
                    geometry: obj.geometry ?? getGeometryForType(obj.type),
                };

                if (duplicated.type === "plantbed") {
                    duplicated.plantbedNo = nextPlantbedNo;
                    nextLinksMap[nextId] = [];
                    nextCountsMap[nextId] = 0;
                    nextPlantbedNo++;
                }

                return duplicated;
            });

            const cmd: Command = {
                kind: "addMany",
                objects: duplicatedRaw,
            };

            const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
            const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

            const nextSelectedIds = duplicatedRaw.map((o) => o.id);

            return {
                objects: nextObjects,
                selectedObjectId: nextSelectedIds.length > 0 ? nextSelectedIds[0] : null,
                selectedObjectIds: nextSelectedIds,
                plantbedLinks: nextLinksMap,
                plantbedLinkedCount: nextCountsMap,
                nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    selectedObjectId: null,
    selectedObjectIds: [],

    activeTool: "select",
    setActiveTool: (tool) => set({ activeTool: tool }),

    activeDrawType: null,
    setActiveDrawType: (t) => set({ activeDrawType: t }),

    viewVisibility: {
        showPlantNumbers: true,
        showAreaLabels: true,
        showGround: true,
        showBuildings: true,
        showTrafficUse: true,
        showBoundaries: true,
        showPlantbeds: true,
        showTreebeds: true,
    },

    setViewVisibility: (key, value) =>
        set((state) => ({
            viewVisibility: {
                ...state.viewVisibility,
                [key]: value,
            },
        })),
    toggleViewVisibility: (key) =>
        set((state) => ({
            viewVisibility: {
                ...state.viewVisibility,
                [key]: !state.viewVisibility[key],
            },
        })),

    compassDirection: "noord",

    setCompassDirection: (direction) =>
        set({
            compassDirection: direction,
        }),

    undoStack: [],
    redoStack: [],

    clearPlantbedLinksForPlantbed: (plantbedId: string) => {
        set((state: any) => {
            const nextLinks = { ...(state.plantbedLinks ?? {}) };
            if (nextLinks[plantbedId]) {
                delete nextLinks[plantbedId];
            }

            const nextCounts = { ...(state.plantbedLinkedCount ?? {}) };
            if (nextCounts[plantbedId] !== undefined) {
                delete nextCounts[plantbedId];
            }

            return {
                plantbedLinks: nextLinks,
                plantbedLinkedCount: nextCounts,
            };
        });
    },
    selectObject: (id) =>
        set({
            selectedObjectId: id,
            selectedObjectIds: id ? [id] : [],
        }),

    selectObjects: (ids) =>
        set({
            selectedObjectIds: ids,
            selectedObjectId: ids.length > 0 ? ids[0] : null,
        }),

    clearSelection: () =>
        set({
            selectedObjectId: null,
            selectedObjectIds: [],
        }),

    // ✅ NEW: commit objects via history (dus undo/redo werkt)
    setObjectsWithHistory: (nextObjects, nextSelectionId = null) =>
        set((state) => {
            // ✅ Hier géén globale polygon-vs-boundary reconcile doen.
            // Anders gaan gewone plantvak-updates (move / resize / vertex edit)
            // onbedoeld bestaande boundaries opnieuw meenemen of vervormen.
            const normalized = (nextObjects ?? []).map((o) => {
                const geometry = getGeometryForType((o as any).type);

                if (geometry === "polyline") {
                    return {
                        ...o,
                        geometry: "polyline" as const,
                        points: preserveClosedBoundaryEndpoint(
                            (o as any).points,
                            (o as any).type
                        ),
                    };
                }

                return {
                    ...o,
                    geometry,
                };
            }) as PolyObject[];

            // world waartegen we alleen boundary renderPieces opnieuw opbouwen
            const world = normalized;

            const withPieces = world.map((o) => {
                if (!isPolylineObject(o)) {
                    return {
                        ...o,
                        points: cleanupPoints(o.points),
                        holes: o.holes?.map((h) => cleanupPoints(h)),
                    };
                }

                return withLinePieces(
                    {
                        ...o,
                        geometry: "polyline",
                        points: preserveClosedBoundaryEndpoint(o.points, o.type),
                    },
                    world
                );
            });

            const cmd: Command = {
                kind: "replaceMany",
                before: state.objects,
                after: withPieces,
            };

            // selectie netjes zetten (optioneel)
            const selId = nextSelectionId;
            const selIds = selId ? [selId] : [];

            return {
                objects: applyCommand(state as ProjectState, cmd),
                selectedObjectId: selId,
                selectedObjectIds: selIds,
                nextPlantbedNo: recalcNextPlantbedNo(withPieces),
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    rotateCanvasWithHistory: (nextObjects, compassBefore, compassAfter, nextSelectionId = null) =>
        set((state) => {
            const normalized = (nextObjects ?? []).map((o) => {
                const geometry = getGeometryForType((o as any).type);

                if (geometry === "polyline") {
                    return {
                        ...o,
                        geometry: "polyline" as const,
                        points: preserveClosedBoundaryEndpoint(
                            (o as any).points,
                            (o as any).type
                        ),
                    };
                }

                return {
                    ...o,
                    geometry,
                    points: cleanupPoints(o.points),
                    holes: o.holes?.map((h) => cleanupPoints(h)),
                };
            }) as PolyObject[];

            const withPieces = recalcLinePiecesForWorld(normalized);

            const cmd: Command = {
                kind: "rotateCanvas",
                before: state.objects,
                after: withPieces,
                compassBefore,
                compassAfter,
            };

            const selId = nextSelectionId;
            const selIds = selId ? [selId] : [];

            return {
                objects: applyCommand(state as ProjectState, cmd),
                compassDirection: compassAfter,
                selectedObjectId: selId,
                selectedObjectIds: selIds,
                nextPlantbedNo: recalcNextPlantbedNo(withPieces),
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    addObject: (obj) =>

        set((state) => {
            let newObj: PolyObject = {
                ...obj,
                geometry: getGeometryForType(obj.type),
            };

            // ✅ Unified boundaries: blijven polyline als source of truth,
            // maar mogen wél lagere polygon-objecten wegsnijden via hun boundary-band.
            if (isPolylineObject(newObj)) {
                const id = newObj.id ?? makeId();

                const baseObj: PolyObject = normalizeBoundaryObjectSegments({
                    ...newObj,
                    id,
                    geometry: "polyline",
                    points: preserveClosedBoundaryEndpoint(newObj.points, newObj.type),
                    boundarySegments: [
                        preserveClosedBoundaryEndpoint(newObj.points, newObj.type),
                    ],
                });

                let updatedObjects = [...state.objects] as PolyObject[];

                const boundaryCutter = createBoundaryDifferenceCutter(baseObj);
                if (boundaryCutter) {
                    const newZ = TYPE_Z_INDEX[baseObj.type];
                    const toRemove: PolyObject[] = [];
                    const toAdd: PolyObject[] = [];
                    const cutterBox = bboxFromPoints(boundaryCutter.points);

                    for (const lower of updatedObjects) {
                        if (lower.type === "treebed") continue;
                        if (isPolylineObject(lower)) continue;

                        const z = TYPE_Z_INDEX[lower.type];
                        if (z >= newZ) continue;

                        const lowerBox = bboxFromPoints(lower.points);
                        if (!rectsOverlap(cutterBox, lowerBox)) continue;

                        const pieces = subtractPolygonsPieces(lower, [boundaryCutter]);
                        if (!pieces || pieces.length === 0) continue;

                        toRemove.push(lower);

                        for (let idx = 0; idx < pieces.length; idx++) {
                            const p = pieces[idx];
                            if (p.outer.length < 6) continue;

                            toAdd.push({
                                id: idx === 0 ? lower.id : makeId(),
                                type: lower.type,
                                points: p.outer,
                                holes: p.holes,
                                plantbedNo: lower.plantbedNo,
                            });
                        }
                    }

                    if (toRemove.length > 0) {
                        const removeIds = new Set(toRemove.map((o) => o.id));
                        updatedObjects = updatedObjects.filter((o) => !removeIds.has(o.id));
                        updatedObjects.push(...toAdd);
                    }
                }

                const {
                    mergedObject: mergedBoundaryObj,
                    removeIds: mergedBoundaryRemoveIds,
                } = mergeConnectedBoundaryPolylines(
                    baseObj,
                    updatedObjects as PolyObject[],
                    SNAP_GRID_SIZE
                );

                const mergedBoundaryRemoveIdSet = new Set(mergedBoundaryRemoveIds);

                const worldWithoutMergedBoundaries = updatedObjects.filter(
                    (object) => !mergedBoundaryRemoveIdSet.has(object.id)
                );

                const reconciledExisting = reconcilePolygonsAgainstLineObjects(
                    worldWithoutMergedBoundaries as PolyObject[],
                    [mergedBoundaryObj]
                );

                const worldWithNew = [...reconciledExisting, mergedBoundaryObj] as PolyObject[];
                const objWithPieces = withLinePieces(mergedBoundaryObj, worldWithNew);

                const cmd: Command = {
                    kind: "replaceMany",
                    before: state.objects,
                    after: [...reconciledExisting, objWithPieces],
                };

                const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                return {
                    objects: nextObjects,
                    selectedObjectId: objWithPieces.id,
                    selectedObjectIds: [objWithPieces.id],
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    undoStack: [...state.undoStack, cmd],
                    redoStack: [],
                };
            }

            newObj = snapPolygonEdgesToLineBoundaries(
                newObj,
                state.objects.filter((o) => isPolylineObject(o)) as PolyObject[],
                state.objects.filter((o) => !isPolylineObject(o)) as PolyObject[]
            );

            if (newObj.type === "plantbed" || newObj.type === "hedge") {
                const plantbedNo = getLowestFreePlantbedNoFromObjects(
                    state.objects,
                    newObj.type
                );

                newObj = { ...newObj, plantbedNo };
            }

            const type = newObj.type;
            const newZ = TYPE_Z_INDEX[type];

            // ✅ TREEBED is een overlay primitive:
            // - snijdt nooit andere objecten weg
            // - wordt niet geclipt door andere objecten
            // - merge't niet met andere treebeds
            if (type === "treebed") {
                const treebedToAdd: PolyObject = {
                    ...newObj,
                    id: newObj.id ?? makeId(),
                    type: "treebed",
                    holes: undefined,
                    plantbedNo: getLowestFreePlantbedNoFromObjects(state.objects, "treebed"),
                    treebedVariant: newObj.treebedVariant ?? "standard",
                    rotationDeg: newObj.rotationDeg ?? 0,
                };

                const cmd: Command = {
                    kind: "replaceMany",
                    before: state.objects,
                    after: [...state.objects, treebedToAdd],
                };

                const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                return {
                    objects: nextObjects,
                    selectedObjectId: treebedToAdd.id,
                    selectedObjectIds: [treebedToAdd.id],
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    undoStack: [...state.undoStack, cmd],
                    redoStack: [],
                };
            }

            // 1️⃣ Eerst: snijd alles met lagere Z-index uit
            let updatedObjects = [...state.objects];
            const toRemove: PolyObject[] = [];
            const toAdd: PolyObject[] = [];
            const newObjBox = bboxFromPoints(newObj.points);

            for (const lower of updatedObjects) {
                if (lower.type === "treebed") continue;
                if (isPolylineObject(lower)) continue;

                const z = TYPE_Z_INDEX[lower.type];
                if (z >= newZ) continue;

                const lowerBox = bboxFromPoints(lower.points);
                if (!rectsOverlap(newObjBox, lowerBox)) continue;

                const pieces = subtractPolygonsPieces(lower, [newObj]);
                if (!pieces || pieces.length === 0) continue;

                // ✅ vervang lower alleen als er echt overlap-difference uit komt
                toRemove.push(lower);

                for (let idx = 0; idx < pieces.length; idx++) {
                    const p = pieces[idx];
                    if (p.outer.length < 6) continue;

                    toAdd.push({
                        id: idx === 0 ? lower.id : makeId(),
                        type: lower.type,
                        points: p.outer,
                        holes: p.holes,
                        plantbedNo: lower.plantbedNo,
                    });
                }
            }

            if (toRemove.length > 0) {
                const removeIds = new Set(toRemove.map((o) => o.id));
                updatedObjects = updatedObjects.filter((o) => !removeIds.has(o.id));
                updatedObjects.push(...toAdd);
            }

            // 1️⃣B: snijd de NIEUWE shape weg door alles wat HOGER ligt
            // ✅ treebed blokkeert nooit andere objecten
            // ✅ fence/gate zijn line-only en mogen nieuwe polygonen NOOIT blokkeren
            const higherBlockers = updatedObjects.filter(
                (o) =>
                    o.type !== "treebed" &&
                    TYPE_Z_INDEX[o.type] > newZ &&
                    !isPolylineObject(o)
            );

            let drawShapes: number[][] = [newObj.points];

            if (higherBlockers.length > 0) {
                const cut = subtractPolygons(newObj, higherBlockers);

                if (!cut || cut.length === 0) {
                    drawShapes = [];
                } else {
                    drawShapes = cut;
                }
            }

            // 2️⃣ Plantbed logica (nooit unionen; wél overlap wegsnijden zodat plantvakken naast elkaar blijven)
            if (type === "plantbed") {
                const existingSameTypeObjects = updatedObjects.filter((o) => o.type === type);

                const finalShapes: number[][] = [];

                for (const pts of drawShapes) {
                    const subject: PolyObject = { ...newObj, points: pts };

                    // snijd nieuw plantvak weg door bestaande plantvakken van hetzelfde type
                    const diff = subtractPolygons(subject, existingSameTypeObjects);

                    if (diff && diff.length) {
                        for (const d of diff) {
                            if (d.length >= 6) finalShapes.push(d);
                        }
                    } else {
                        if (pts.length >= 6) finalShapes.push(pts);
                    }
                }

                if (finalShapes.length === 0) {
                    const cmd: Command = {
                        kind: "replaceMany",
                        before: state.objects,
                        after: updatedObjects,
                    };
                    const nextObjects = applyCommand(state as ProjectState, cmd);

                    return {
                        objects: nextObjects,
                        selectedObjectId: null,
                        selectedObjectIds: [],
                        undoStack: [...state.undoStack, cmd],
                        redoStack: [],
                    };
                }

                const assignedNo = newObj.plantbedNo ?? state.nextPlantbedNo;
                const nextLinked = { ...state.plantbedLinkedCount };
                const nextLinksMap = { ...state.plantbedLinks };

                const newPlantbeds = finalShapes.map((pts) => {
                    const id = makeId();
                    nextLinked[id] = 0;
                    nextLinksMap[id] = [];

                    return {
                        id,
                        type: "plantbed" as ObjectType,
                        points: pts,
                        plantbedNo: assignedNo,
                    };
                });

                const cmd: Command = {
                    kind: "replaceMany",
                    before: state.objects,
                    after: [...updatedObjects, ...newPlantbeds],
                };
                const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                return {
                    objects: nextObjects,
                    selectedObjectId: null,
                    selectedObjectIds: [],
                    plantbedLinkedCount: nextLinked,
                    plantbedLinks: nextLinksMap,
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    undoStack: [...state.undoStack, cmd],
                    redoStack: [],
                };
            }

            const sameType = updatedObjects.filter((o) => o.type === type);

            // maak tijdelijke polys van alle drawShapes (na clipping)
            const drawPolys: PolyObject[] = drawShapes
                .filter((pts) => pts.length >= 6)
                .map((pts) => ({
                    id: makeId(),
                    type,
                    points: pts,
                }));

            // plantbed en hedge worden al eerder in addObject via hun eigen branch afgehandeld
            const shouldNeverMergeSameType = false;

            // -------------------------------------------
            // ✅ Alleen "lokale" merge: laat ander gras met rust
            // -------------------------------------------
            const pad = SNAP_GRID_SIZE * 2;

            const bboxOverlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
                return !(
                    a.x + a.w < b.x - pad ||
                    b.x + b.w < a.x - pad ||
                    a.y + a.h < b.y - pad ||
                    b.y + b.h < a.y - pad
                );
            };

            const drawBbs = drawPolys.map((p) => bboxFromPoints(p.points));

            const isCandidate = (o: PolyObject) => {
                const bb = bboxFromPoints(o.points);
                for (const dbb of drawBbs) {
                    if (bboxOverlaps(bb, dbb)) return true;
                }
                return false;
            };

            const candidates = sameType.filter(isCandidate);
            const untouched = sameType.filter((o) => !isCandidate(o));

            // -------------------------------------------
            // ✅ Merge candidates + new draw polys
            // -------------------------------------------
            const mergeInput = [...candidates, ...drawPolys];

            const useCellMerge =
                !shouldNeverMergeSameType &&
                mergeInput.length >= 2 &&
                shouldUseCellMerge(mergeInput);

            const mergedPieces =
                !shouldNeverMergeSameType && mergeInput.length >= 2
                    ? (useCellMerge
                        ? mergeSameTypeViaCells(mergeInput, SNAP_GRID_SIZE)
                        : unionSameTypePolygons(mergeInput))
                    : null;

            // -------------------------------------------
            // ✅ Na merge altijd opnieuw clippen tegen hogere lagen
            // (dit voorkomt "gras terug over tegels")
            // én bewaart holes als holes
            // -------------------------------------------
            const clipAgainstHigher = (pieces: DiffPiece[]) => {
                if (!higherBlockers || higherBlockers.length === 0) return pieces;

                const out: DiffPiece[] = [];
                for (const piece of pieces) {
                    if (!piece.outer || piece.outer.length < 6) continue;

                    const subject: PolyObject = {
                        id: makeId(),
                        type,
                        points: piece.outer,
                        holes: piece.holes?.length ? piece.holes : undefined,
                    };

                    const cut = subtractPolygonsPieces(subject, higherBlockers);

                    if (cut && cut.length) {
                        for (const c of cut) {
                            if (c.outer.length >= 6) out.push(c);
                        }
                    }
                }
                return out;
            };

            let nextTypeObjects: PolyObject[] = [];

            if (shouldNeverMergeSameType) {
                nextTypeObjects = [
                    ...sameType,
                    ...drawPolys.map((p) => ({
                        id: makeId(),
                        type,
                        points: p.points,
                        holes: p.holes?.length ? p.holes : undefined,
                    })),
                ];
            } else if (!mergedPieces) {
                nextTypeObjects = [
                    ...untouched,
                    ...candidates,
                    ...drawPolys.map((p) => ({
                        id: makeId(),
                        type,
                        points: p.points,
                        holes: p.holes?.length ? p.holes : undefined,
                    })),
                ];
            } else {
                const clipped = clipAgainstHigher(mergedPieces);
                nextTypeObjects = [
                    ...untouched,
                    ...clipped.map((piece) => ({
                        id: makeId(),
                        type,
                        points: piece.outer,
                        holes: piece.holes?.length ? piece.holes : undefined,
                    })),
                ];
            }

            const nextLinksMap: PlantbedLinksMap = { ...state.plantbedLinks };
            const nextCountsMap: Record<string, number> = { ...state.plantbedLinkedCount };

            if (type === "hedge" && candidates.length > 0) {
                const untouchedIds = new Set(untouched.map((object) => object.id));
                const mergedTarget = nextTypeObjects.find((object) => !untouchedIds.has(object.id));
                const mergedPlantIds = Array.from(
                    new Set(
                        candidates.flatMap((candidate) => state.plantbedLinks[candidate.id] ?? [])
                    )
                );

                if (mergedTarget) {
                    for (const candidate of candidates) {
                        delete nextLinksMap[candidate.id];
                        delete nextCountsMap[candidate.id];
                    }

                    nextLinksMap[mergedTarget.id] = mergedPlantIds;
                    nextCountsMap[mergedTarget.id] = mergedPlantIds.length;
                }
            }

            // verwijder alle oude objects van dit type en voeg terug: untouched + (candidates/new merged)
            updatedObjects = updatedObjects.filter((o) => o.type !== type);

            const afterObjects = [...updatedObjects, ...nextTypeObjects];

            const cmd: Command =
                type === "hedge"
                    ? {
                        kind: "replaceManyWithPlantbedLinks",
                        before: state.objects,
                        after: afterObjects,
                        removedLinks: {},
                        removedCounts: {},
                        beforeLinks: clonePlantbedLinks(state.plantbedLinks),
                        beforeCounts: { ...state.plantbedLinkedCount },
                        afterLinks: clonePlantbedLinks(nextLinksMap),
                        afterCounts: { ...nextCountsMap },
                    }
                    : {
                        kind: "replaceMany",
                        before: state.objects,
                        after: afterObjects,
                    };

            const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
            const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

            return {
                objects: nextObjects,
                selectedObjectId: null,
                selectedObjectIds: [],
                plantbedLinks: type === "hedge" ? nextLinksMap : state.plantbedLinks,
                plantbedLinkedCount: type === "hedge" ? nextCountsMap : state.plantbedLinkedCount,
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    cutObjectsByPolygon: (cutterPoints) =>
        set((state) => {
            const cleanedCutter = cleanupPoints(cutterPoints ?? []);
            if (cleanedCutter.length < 6) return state;

            const cutter: PolyObject = {
                id: makeId(),
                type: "grass",
                geometry: "polygon",
                points: cleanedCutter,
            };

            const toRemoveIds = new Set<string>();
            const toAdd: PolyObject[] = [];
            let changed = false;

            for (const obj of state.objects as PolyObject[]) {
                // nooit op line-only objects
                if (isPolylineObject(obj)) continue;

                // boomvakken nooit knippen
                if (obj.type === "treebed") continue;

                const mayAffect =
                    polygonsActuallyTouchOrOverlap(obj.points, cleanedCutter) ||
                    polygonContainsPolygon(cleanedCutter, obj.points) ||
                    polygonContainsPolygon(obj.points, cleanedCutter);

                if (!mayAffect) continue;

                const pieces = subtractPolygonsPieces(obj, [cutter]);

                // volledig weggeknipt
                if (!pieces || pieces.length === 0) {
                    if (polygonContainsPolygon(cleanedCutter, obj.points)) {
                        toRemoveIds.add(obj.id);
                        changed = true;
                    }
                    continue;
                }

                const sameAsOriginal =
                    pieces.length === 1 &&
                    JSON.stringify(pieces[0].outer) === JSON.stringify(obj.points) &&
                    JSON.stringify(pieces[0].holes ?? []) === JSON.stringify(obj.holes ?? []);

                if (sameAsOriginal) continue;

                toRemoveIds.add(obj.id);
                changed = true;

                pieces.forEach((piece, idx) => {
                    if (piece.outer.length < 6) return;

                    toAdd.push({
                        ...obj,
                        id: idx === 0 ? obj.id : makeId(),
                        geometry: obj.geometry ?? getGeometryForType(obj.type),
                        points: piece.outer,
                        holes: piece.holes?.length ? piece.holes : undefined,
                        renderPieces: undefined,
                    });
                });
            }

            if (!changed) return state;

            const nextObjectsRaw = [
                ...(state.objects as PolyObject[]).filter((o) => !toRemoveIds.has(o.id)),
                ...toAdd,
            ] as PolyObject[];

            const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

            const cmd: Command = {
                kind: "replaceMany",
                before: state.objects,
                after: nextObjects,
            };

            return {
                objects: applyCommand(state as ProjectState, cmd),
                selectedObjectId: null,
                selectedObjectIds: [],
                nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    removeObjectById: (id) =>
        set((state) => {
            const existing = state.objects.find((o) => o.id === id);
            if (!existing) return state;

            const cmd: Command = { kind: "removeObject", object: existing };
            const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
            const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

            const nextSelectedIds = state.selectedObjectIds.filter((sid) => sid !== id);

            return {
                objects: nextObjects,
                selectedObjectId: nextSelectedIds.length > 0 ? nextSelectedIds[0] : null,
                selectedObjectIds: nextSelectedIds,
                // ✅ linkedCount NIET deleten; zo blijft undo/redo correct
                plantbedLinkedCount: state.plantbedLinkedCount,
                nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    moveObject: (id, toPoints) => {
        get().moveObjectAndMerge(id, toPoints);
    },

    moveObjectAndMerge: (id, toPoints, toHoles) =>
        set((state) => {
            const existing = state.objects.find((o) => o.id === id);
            if (!existing) return state;

            const fromPoints = existing.points;
            const same =
                fromPoints.length === toPoints.length && fromPoints.every((v, i) => v === toPoints[i]);

            const sameHoles =
                toHoles === undefined ||
                JSON.stringify(existing.holes ?? []) === JSON.stringify(toHoles ?? []);

            if (same && sameHoles) {
                return state;
            }

            let moved: PolyObject = {
                ...existing,
                geometry: getGeometryForType(existing.type),
                points: toPoints,
            };

            // ✅ Unified boundaries: bij move/vertex/resize ook lagere polygon-objecten wegsnijden
            if (isPolylineObject(moved)) {
                let worldWithout = state.objects.filter((o) => o.id !== id) as PolyObject[];

                const dx = (toPoints[0] ?? 0) - (existing.points[0] ?? 0);
                const dy = (toPoints[1] ?? 0) - (existing.points[1] ?? 0);

                const translatedBoundarySegments =
                    existing.boundarySegments?.length
                        ? translateBoundarySegments(existing.boundarySegments, dx, dy)
                        : [preserveClosedBoundaryEndpoint(toPoints, moved.type)];

                const baseObj: PolyObject = normalizeBoundaryObjectSegments({
                    ...moved,
                    id,
                    geometry: "polyline",
                    points: preserveClosedBoundaryEndpoint(toPoints, moved.type),
                    boundarySegments: translatedBoundarySegments,
                });

                const boundaryCutter = createBoundaryDifferenceCutter(baseObj);
                if (boundaryCutter) {
                    const movedZ = TYPE_Z_INDEX[baseObj.type];
                    const toRemoveLower: PolyObject[] = [];
                    const toAddLower: PolyObject[] = [];
                    const cutterBox = bboxFromPoints(boundaryCutter.points);

                    for (const lower of worldWithout) {
                        if (lower.type === "treebed") continue;
                        if (isPolylineObject(lower)) continue;

                        const z = TYPE_Z_INDEX[lower.type];
                        if (z >= movedZ) continue;

                        const lowerBox = bboxFromPoints(lower.points);
                        if (!rectsOverlap(cutterBox, lowerBox)) continue;

                        const pieces = subtractPolygonsPieces(lower, [boundaryCutter]);
                        if (!pieces || pieces.length === 0) continue;

                        toRemoveLower.push(lower);

                        pieces.forEach((p, idx) => {
                            if (p.outer.length < 6) return;

                            toAddLower.push({
                                id: idx === 0 ? lower.id : makeId(),
                                type: lower.type,
                                points: p.outer,
                                holes: p.holes,
                                plantbedNo: lower.plantbedNo,
                                customStyle: lower.customStyle,
                            });
                        });
                    }

                    if (toRemoveLower.length > 0) {
                        const removeIds = new Set(toRemoveLower.map((o) => o.id));
                        worldWithout = worldWithout.filter((o) => !removeIds.has(o.id));
                        worldWithout.push(...toAddLower);
                    }
                }

                const {
                    mergedObject: mergedBoundaryObj,
                    removeIds: mergedBoundaryRemoveIds,
                } = mergeConnectedBoundaryPolylines(
                    baseObj,
                    worldWithout as PolyObject[],
                    SNAP_GRID_SIZE
                );

                const mergedBoundaryRemoveIdSet = new Set(mergedBoundaryRemoveIds);

                const worldWithoutMergedBoundaries = worldWithout.filter(
                    (object) => !mergedBoundaryRemoveIdSet.has(object.id)
                );

                const reconciledWorldWithout = reconcilePolygonsAgainstLineObjects(
                    worldWithoutMergedBoundaries,
                    [mergedBoundaryObj]
                );

                const worldWithNew = [...reconciledWorldWithout, mergedBoundaryObj] as PolyObject[];

                const movedWithPieces = withLinePieces(mergedBoundaryObj, worldWithNew);

                const cmd: Command = {
                    kind: "replaceMany",
                    before: state.objects,
                    after: [...reconciledWorldWithout, movedWithPieces],
                };

                const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                return {
                    objects: nextObjects,
                    selectedObjectId: movedWithPieces.id,
                    selectedObjectIds: [movedWithPieces.id],
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    undoStack: [...state.undoStack, cmd],
                    redoStack: [],
                };
            }

            moved = snapPolygonEdgesToLineBoundaries(
                moved,
                state.objects.filter((o) => o.id !== id && isPolylineObject(o)) as PolyObject[],
                state.objects.filter((o) => o.id !== id && !isPolylineObject(o)) as PolyObject[]
            );

            const type = moved.type;
            const newZ = TYPE_Z_INDEX[type];

            // ✅ TREEBED is een overlay primitive:
            // - snijdt nooit andere objecten weg bij move/resize
            // - wordt niet geclipt door andere objecten
            // - merge't niet met andere treebeds
            if (type === "treebed") {
                const movedTreebed: PolyObject = {
                    ...moved,
                    id: existing.id,
                    type: "treebed",
                    points: toPoints,
                    holes: undefined,
                };

                const without = state.objects.filter((o) => o.id !== id);

                const cmd: Command = {
                    kind: "replaceMany",
                    before: state.objects,
                    after: [...without, movedTreebed],
                };

                const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                return {
                    objects: nextObjects,
                    selectedObjectId: movedTreebed.id,
                    selectedObjectIds: [movedTreebed.id],
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    undoStack: [...state.undoStack, cmd],
                    redoStack: [],
                };
            }

            let updatedObjects = state.objects.filter((o) => o.id !== id);

            const toRemoveLower: PolyObject[] = [];
            const toAddLower: PolyObject[] = [];
            const movedBox = bboxFromPoints(moved.points);

            for (const obj of updatedObjects) {
                if (obj.type === "treebed") continue;
                if (isPolylineObject(obj)) continue;

                const z = TYPE_Z_INDEX[obj.type];
                if (z >= newZ) continue;

                const objBox = bboxFromPoints(obj.points);
                if (!rectsOverlap(movedBox, objBox)) continue;

                const pieces = subtractPolygonsPieces(obj, [moved]);
                if (!pieces || pieces.length === 0) continue;

                toRemoveLower.push(obj);

                pieces.forEach((p, idx) => {
                    if (p.outer.length < 6) return;

                    toAddLower.push({
                        id: idx === 0 ? obj.id : makeId(),
                        type: obj.type,
                        points: p.outer,
                        holes: p.holes?.length ? p.holes : undefined,
                        plantbedNo: obj.plantbedNo,
                        customStyle: obj.customStyle,
                    });
                });
            }

            if (toRemoveLower.length > 0) {
                const removeIds = new Set(toRemoveLower.map((o) => o.id));
                updatedObjects = updatedObjects.filter((o) => !removeIds.has(o.id));
                updatedObjects.push(...toAddLower);
            }

            const movedHasHoles = (existing.holes?.length ?? 0) > 0;

            // ✅ Hole-safe move / reshape:
            // - pure translation => holes meevertalen
            // - outer reshape => bestaande holes laten staan
            // - expliciete hole-edit => meegegeven holes gebruiken
            if (movedHasHoles) {
                const isPureTranslation =
                    fromPoints.length === toPoints.length &&
                    fromPoints.length >= 2 &&
                    (() => {
                        const dx = (toPoints[0] ?? 0) - (fromPoints[0] ?? 0);
                        const dy = (toPoints[1] ?? 0) - (fromPoints[1] ?? 0);

                        for (let i = 0; i < fromPoints.length; i += 2) {
                            if ((toPoints[i] ?? 0) - (fromPoints[i] ?? 0) !== dx) return false;
                            if ((toPoints[i + 1] ?? 0) - (fromPoints[i + 1] ?? 0) !== dy) return false;
                        }

                        return true;
                    })();

                const dx = (toPoints[0] ?? 0) - (fromPoints[0] ?? 0);
                const dy = (toPoints[1] ?? 0) - (fromPoints[1] ?? 0);

                const nextHoles =
                    toHoles !== undefined
                        ? toHoles.map((h) => [...h])
                        : isPureTranslation
                            ? translateHoles(existing.holes, dx, dy)
                            : (existing.holes ?? []).map((h) => [...h]);

                const movedWithHoles: PolyObject = {
                    ...moved,
                    id: existing.id,
                    holes: nextHoles,
                    plantbedNo: existing.plantbedNo,
                    customStyle: existing.customStyle,
                };

                const sameType = updatedObjects.filter((o) => o.type === movedWithHoles.type);
                const otherTypes = updatedObjects.filter((o) => o.type !== movedWithHoles.type);

                const movedPlantbedHasHoles =
                    movedWithHoles.type === "plantbed" &&
                    ((movedWithHoles.holes?.length ?? 0) > 0);

                const mergeCandidates = sameType.filter((o) =>
                    polygonsActuallyTouchOrOverlap(o.points, movedWithHoles.points)
                );

                const untouchedSameType = sameType.filter(
                    (o) => !mergeCandidates.some((m) => m.id === o.id)
                );

                // ✅ Plantvakken met gaten:
                // - mogen NIET mergen
                // - mogen ook NIET overlappen
                // - het verplaatste plantvak blijft leidend
                // - bestaande geraakte plantvakken worden door het verplaatste plantvak weggesneden
                if (
                    movedWithHoles.type === "plantbed" &&
                    ((movedWithHoles.holes?.length ?? 0) > 0)
                ) {
                    const normalizedMovedObjects =
                        toHoles !== undefined
                            ? normalizeSingleObjectToPieces(movedWithHoles)
                            : [movedWithHoles];

                    const cutCandidates: PolyObject[] = [];
                    for (const candidate of mergeCandidates) {
                        const pieces = subtractPolygonsPieces(candidate, normalizedMovedObjects);

                        if (!pieces || pieces.length === 0) {
                            continue;
                        }

                        for (let i = 0; i < pieces.length; i += 1) {
                            const piece = pieces[i];
                            if (!piece.outer || piece.outer.length < 6) continue;

                            cutCandidates.push({
                                ...candidate,
                                id: i === 0 ? candidate.id : makeId(),
                                points: piece.outer,
                                holes: piece.holes?.length ? piece.holes : undefined,
                                plantbedNo: candidate.plantbedNo,
                                customStyle: candidate.customStyle,
                            });
                        }
                    }

                    const cmd: Command = {
                        kind: "replaceMany",
                        before: state.objects,
                        after: [...otherTypes, ...untouchedSameType, ...cutCandidates, ...normalizedMovedObjects],
                    };

                    const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                    const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                    const nextSelectedId =
                        normalizedMovedObjects.find((o) => o.id === existing.id)?.id ??
                        (normalizedMovedObjects.length ? normalizedMovedObjects[0].id : null);

                    return {
                        objects: nextObjects,
                        selectedObjectId: nextSelectedId,
                        selectedObjectIds: nextSelectedId ? [nextSelectedId] : [],
                        undoStack: [...state.undoStack, cmd],
                        redoStack: [],
                    };
                }

                const mergeInput = [...mergeCandidates, movedWithHoles];

                const useCellMerge =
                    mergeInput.length >= 2 && shouldUseCellMerge(mergeInput);

                const mergedPieces =
                    mergeInput.length >= 2
                        ? (
                            useCellMerge
                                ? mergeSameTypeViaCells(mergeInput, SNAP_GRID_SIZE)
                                : unionSameTypePolygons(mergeInput)
                        )
                        : null;

                if (!mergedPieces || mergedPieces.length === 0) {
                    const normalizedMovedObjects =
                        toHoles !== undefined
                            ? normalizeSingleObjectToPieces(movedWithHoles)
                            : [movedWithHoles];

                    const cmd: Command = {
                        kind: "replaceMany",
                        before: state.objects,
                        after: [...otherTypes, ...untouchedSameType, ...normalizedMovedObjects],
                    };

                    const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                    const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                    const nextSelectedId =
                        normalizedMovedObjects.find((o) => o.id === existing.id)?.id ??
                        (normalizedMovedObjects.length ? normalizedMovedObjects[0].id : null);

                    return {
                        objects: nextObjects,
                        selectedObjectId: nextSelectedId,
                        selectedObjectIds: nextSelectedId ? [nextSelectedId] : [],
                        undoStack: [...state.undoStack, cmd],
                        redoStack: [],
                    };
                }

                const mergedObjects: PolyObject[] = mergedPieces
                    .filter((piece) => piece.outer.length >= 6)
                    .map((piece, idx) => ({
                        ...movedWithHoles,
                        id: idx === 0 ? existing.id : makeId(),
                        points: piece.outer,
                        holes: piece.holes?.length ? piece.holes : undefined,
                        plantbedNo: existing.plantbedNo,
                    }));

                const cmd: Command = {
                    kind: "replaceMany",
                    before: state.objects,
                    after: [...otherTypes, ...untouchedSameType, ...mergedObjects],
                };

                const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                const nextSelectedId =
                    mergedObjects.find((o) => o.id === existing.id)?.id ??
                    (mergedObjects.length ? mergedObjects[0].id : null);

                return {
                    objects: nextObjects,
                    selectedObjectId: nextSelectedId,
                    selectedObjectIds: nextSelectedId ? [nextSelectedId] : [],
                    undoStack: [...state.undoStack, cmd],
                    redoStack: [],
                };
            }

            const higher = updatedObjects.filter(
                (o) =>
                    o.type !== "treebed" &&
                    TYPE_Z_INDEX[o.type] > newZ &&
                    !isPolylineObject(o)
            );
            const movedCut = higher.length ? subtractPolygons(moved, higher) : null;
            const movedShapes = movedCut ?? [moved.points];

            if (type === "plantbed") {
                const otherPlantbeds = updatedObjects.filter((o) => o.type === "plantbed");

                const nextLinked = { ...state.plantbedLinkedCount };
                const nextLinksMap = { ...state.plantbedLinks };

                const pbRemove: PolyObject[] = [];
                const pbAdd: PolyObject[] = [];

                const cutter = movedShapes[0];
                const cutterObj: PolyObject = {
                    ...moved,
                    points: cutter,
                    holes: undefined,
                    type: "plantbed",
                };

                for (const pb of otherPlantbeds) {
                    const diffPieces = subtractPolygonsPieces(pb, [cutterObj]);
                    if (!diffPieces) continue;

                    pbRemove.push(pb);

                    diffPieces.forEach((piece, idx) => {
                        if (piece.outer.length < 6) return;

                        const idToUse = idx === 0 ? pb.id : makeId();

                        if (idx !== 0) {
                            nextLinked[idToUse] = 0;
                            nextLinksMap[idToUse] = [];
                        }

                        pbAdd.push({
                            id: idToUse,
                            type: "plantbed",
                            points: piece.outer,
                            holes: piece.holes?.length ? piece.holes : undefined,
                            plantbedNo: pb.plantbedNo,
                            customStyle: pb.customStyle,
                        });
                    });
                }

                if (pbRemove.length > 0) {
                    const removeIds = new Set(pbRemove.map((o) => o.id));
                    updatedObjects = updatedObjects.filter((o) => !removeIds.has(o.id));
                    updatedObjects.push(...pbAdd);
                }

                const movedSeedPlantbeds = normalizeSingleObjectToPieces({
                    id: existing.id,
                    type: "plantbed",
                    points: moved.points,

                    // Belangrijk:
                    // - bij expliciete hole-edit moeten de live holes mee
                    // - bij gewone edge-resize/self-touch moet de nieuwe contour zichzelf
                    //   weer als donut/holes kunnen normaliseren
                    holes: toHoles !== undefined ? toHoles.map((h) => [...h]) : undefined,

                    plantbedNo: existing.plantbedNo,
                    customStyle: existing.customStyle,
                });

                const movedPlantbeds: PolyObject[] = movedSeedPlantbeds.flatMap((seed, seedIdx) => {
                    const cutPieces = higher.length ? subtractPolygonsPieces(seed, higher) : null;

                    if (cutPieces === null) {
                        const normalized = normalizeSingleObjectToPieces({
                            ...seed,
                            id: seedIdx === 0 ? existing.id : makeId(),
                            plantbedNo: existing.plantbedNo,
                        });

                        normalized.forEach((piece, pieceIdx) => {
                            if (!(seedIdx === 0 && pieceIdx === 0)) {
                                nextLinked[piece.id] = 0;
                                nextLinksMap[piece.id] = [];
                            }
                        });

                        return normalized;
                    }

                    if (cutPieces.length === 0) {
                        return [];
                    }

                    const pieces = cutPieces
                        .filter((piece) => piece.outer.length >= 6)
                        .flatMap((piece, pieceIdx) =>
                            normalizeSingleObjectToPieces({
                                ...seed,
                                id: seedIdx === 0 && pieceIdx === 0 ? existing.id : makeId(),
                                points: piece.outer,
                                holes: piece.holes?.length ? piece.holes : undefined,
                                plantbedNo: existing.plantbedNo,
                            })
                        );

                    pieces.forEach((piece, pieceIdx) => {
                        if (!(seedIdx === 0 && pieceIdx === 0)) {
                            nextLinked[piece.id] = 0;
                            nextLinksMap[piece.id] = [];
                        }
                    });

                    return pieces;
                });

                const cmd: Command = {
                    kind: "replaceMany",
                    before: state.objects,
                    after: [...updatedObjects, ...movedPlantbeds],
                };

                const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                const nextSelectedId = movedPlantbeds.length ? movedPlantbeds[0].id : null;

                return {
                    objects: nextObjects,
                    selectedObjectId: nextSelectedId,
                    selectedObjectIds: nextSelectedId ? [nextSelectedId] : [],
                    plantbedLinkedCount: nextLinked,
                    plantbedLinks: nextLinksMap,
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    undoStack: [...state.undoStack, cmd],
                    redoStack: [],
                };
            }

            const movedSeedObjects = normalizeSingleObjectToPieces({
                id: existing.id,
                type,
                points: moved.points,

                // Belangrijk:
                // - bij expliciete hole-edit moeten de live holes mee
                // - bij gewone edge-resize van een object zonder holes moet de nieuwe contour
                //   zichzelf weer kunnen normaliseren naar een donut
                holes: toHoles !== undefined ? toHoles.map((h) => [...h]) : undefined,

                plantbedNo: existing.plantbedNo,
            });

            const movedObjectsRaw: PolyObject[] = movedSeedObjects.flatMap((seed, seedIdx) => {
                const cutPieces = higher.length ? subtractPolygonsPieces(seed, higher) : null;

                if (cutPieces === null) {
                    return normalizeSingleObjectToPieces({
                        ...seed,
                        id: seedIdx === 0 ? existing.id : makeId(),
                        plantbedNo: existing.plantbedNo,
                    });
                }

                if (cutPieces.length === 0) {
                    return [];
                }

                return cutPieces
                    .filter((piece) => piece.outer.length >= 6)
                    .flatMap((piece, pieceIdx) =>
                        normalizeSingleObjectToPieces({
                            ...seed,
                            id: seedIdx === 0 && pieceIdx === 0 ? existing.id : makeId(),
                            points: piece.outer,
                            holes: piece.holes?.length ? piece.holes : undefined,
                            plantbedNo: existing.plantbedNo,
                        })
                    );
            });

            let updatedObjectsFinal = updatedObjects;
            let afterObjectsFinal = movedObjectsRaw;
            let mergedSourceObjectsForLinks: PolyObject[] = [];

            if (movedObjectsRaw.length > 0) {
                const sameType = updatedObjects.filter((o) => o.type === type);

                const candidates = sameType.filter((o) =>
                    movedObjectsRaw.some((m) => polygonsActuallyTouchOrOverlap(o.points, m.points))
                );

                if (candidates.length > 0) {
                    const mergeInput = [...candidates, ...movedObjectsRaw];

                    const relevantHigher = updatedObjects.filter(
                        (o) => TYPE_Z_INDEX[o.type] > newZ && !isPolylineObject(o)
                    );

                    const hasNonOrthogonalHigher = relevantHigher.some((h) => !isOrthogonalPolygon(h.points));

                    const useCellMerge =
                        shouldUseCellMerge(mergeInput) &&
                        !hasNonOrthogonalHigher;

                    const mergedPieces = useCellMerge
                        ? mergeSameTypeViaCells(mergeInput, SNAP_GRID_SIZE)
                        : unionSameTypePolygons(mergeInput);

                    if (mergedPieces && mergedPieces.length > 0) {
                        mergedSourceObjectsForLinks = mergeInput;

                        const removeIds = new Set(candidates.map((o) => o.id));
                        updatedObjectsFinal = updatedObjectsFinal.filter((o) => !removeIds.has(o.id));

                        const clipAgainstHigher = (pieces: DiffPiece[]) => {
                            if (!higher || higher.length === 0) return pieces;

                            const out: DiffPiece[] = [];
                            for (const piece of pieces) {
                                if (!piece.outer || piece.outer.length < 6) continue;

                                const subject: PolyObject = {
                                    id: makeId(),
                                    type,
                                    points: piece.outer,
                                    holes: piece.holes?.length ? piece.holes : undefined,
                                };

                                const cut = subtractPolygonsPieces(subject, higher);

                                if (cut && cut.length) {
                                    for (const c of cut) {
                                        if (c.outer.length >= 6) out.push(c);
                                    }
                                }
                            }
                            return out;
                        };

                        const clippedMerged = clipAgainstHigher(mergedPieces);

                        let mergedObjects: PolyObject[] = clippedMerged
                            .filter((piece) => piece.outer.length >= 6)
                            .map((piece, idx) => ({
                                id: idx === 0 ? existing.id : makeId(),
                                type,
                                points: piece.outer,
                                holes: piece.holes?.length ? piece.holes : undefined,
                                plantbedNo: existing.plantbedNo,
                                customStyle: existing.customStyle,
                            }));

                        if (mergedObjects.length > 1) {
                            const outer = mergedObjects[0];
                            const holes: number[][] = [];

                            for (let i = 1; i < mergedObjects.length; i++) {
                                const inner = mergedObjects[i];

                                if (polygonContainsPolygon(outer.points, inner.points)) {
                                    holes.push(inner.points);
                                }
                            }

                            if (holes.length > 0) {
                                mergedObjects = [
                                    {
                                        ...outer,
                                        holes: [...(outer.holes ?? []), ...holes],
                                    },
                                ];
                            }
                        }

                        mergedObjects = mergedObjects.map((o) => normalizeSelfUnionToDonut(o));

                        afterObjectsFinal = mergedObjects;
                    }
                }
            }

            if (afterObjectsFinal.length === 0) {
                afterObjectsFinal = movedObjectsRaw;
            }

            const afterObjects = [...updatedObjectsFinal, ...afterObjectsFinal];

            const nextLinksMap: PlantbedLinksMap = clonePlantbedLinks(state.plantbedLinks);
            const nextCountsMap: Record<string, number> = { ...state.plantbedLinkedCount };

            if (type === "hedge" && mergedSourceObjectsForLinks.length > 0 && afterObjectsFinal.length > 0) {
                const mergedTarget =
                    afterObjectsFinal.find((object) => object.id === existing.id) ??
                    afterObjectsFinal[0];

                const mergedPlantIds = Array.from(
                    new Set(
                        mergedSourceObjectsForLinks.flatMap((object) =>
                            state.plantbedLinks[object.id] ?? []
                        )
                    )
                );

                for (const object of mergedSourceObjectsForLinks) {
                    delete nextLinksMap[object.id];
                    delete nextCountsMap[object.id];
                }

                nextLinksMap[mergedTarget.id] = mergedPlantIds;
                nextCountsMap[mergedTarget.id] = mergedPlantIds.length;
            }

            const cmd: Command =
                type === "hedge" && mergedSourceObjectsForLinks.length > 0
                    ? {
                        kind: "replaceManyWithPlantbedLinks",
                        before: state.objects,
                        after: afterObjects,
                        removedLinks: {},
                        removedCounts: {},
                        beforeLinks: clonePlantbedLinks(state.plantbedLinks),
                        beforeCounts: { ...state.plantbedLinkedCount },
                        afterLinks: clonePlantbedLinks(nextLinksMap),
                        afterCounts: { ...nextCountsMap },
                    }
                    : {
                        kind: "replaceMany",
                        before: state.objects,
                        after: afterObjects,
                    };

            const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
            const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

            const nextSelectedId =
                afterObjectsFinal.find((o) => o.id === existing.id)?.id ??
                (afterObjectsFinal.length ? afterObjectsFinal[0].id : null);

            return {
                objects: nextObjects,
                selectedObjectId: nextSelectedId,
                selectedObjectIds: nextSelectedId ? [nextSelectedId] : [],
                plantbedLinks: type === "hedge" ? nextLinksMap : state.plantbedLinks,
                plantbedLinkedCount: type === "hedge" ? nextCountsMap : state.plantbedLinkedCount,
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    updateObjectPoints: (id, toPoints) => {
        get().moveObjectAndMerge(id, toPoints);
    },

    commitBoundarySegmentsEdit: (objectId, beforeObject, afterBoundarySegments) =>
        set((state) => {
            const currentObject = state.objects.find((object) => object.id === objectId);
            if (!currentObject || !isPolylineObject(currentObject)) return state;

            const cleanedSegments = splitBoundarySegmentsAtJunctions(
                afterBoundarySegments
                    .map((segment) => preserveClosedBoundaryEndpoint(segment, currentObject.type))
                    .filter((segment) => segment.length >= 4)
            );

            if (cleanedSegments.length === 0) return state;

            const beforeObjects = state.objects.map((object) =>
                object.id === objectId ? beforeObject : object
            );

            const afterObjectsRaw = state.objects.map((object) => {
                if (object.id !== objectId) return object;

                return {
                    ...object,
                    geometry: "polyline" as const,
                    points: cleanedSegments[0],
                    boundarySegments: cleanedSegments,
                };
            });

            const afterObjects = recalcLinePiecesForWorld(afterObjectsRaw);

            const cmd: Command = {
                kind: "replaceMany",
                before: beforeObjects,
                after: afterObjects,
            };

            return {
                objects: afterObjects,
                selectedObjectId: objectId,
                selectedObjectIds: [objectId],
                nextPlantbedNo: recalcNextPlantbedNo(afterObjects),
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    updateObjectStyle: (id, style) =>
        set((state) => {
            const existing = state.objects.find((o) => o.id === id);
            if (!existing) return state;

            const nextObjects = state.objects.map((object) => {
                if (object.id !== id) return object;

                return {
                    ...object,
                    customStyle: {
                        ...(object.customStyle ?? {}),
                        ...style,
                    },
                };
            });

            const cmd: Command = {
                kind: "replaceMany",
                before: state.objects,
                after: nextObjects,
            };

            return {
                objects: applyCommand(state as ProjectState, cmd),
                selectedObjectId: id,
                selectedObjectIds: state.selectedObjectIds.includes(id)
                    ? state.selectedObjectIds
                    : [id],
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    resetObjectStyle: (id) =>
        set((state) => {
            const existing = state.objects.find((o) => o.id === id);
            if (!existing) return state;

            const nextObjects = state.objects.map((object) => {
                if (object.id !== id) return object;

                return {
                    ...object,
                    customStyle: undefined,
                };
            });

            const cmd: Command = {
                kind: "replaceMany",
                before: state.objects,
                after: nextObjects,
            };

            return {
                objects: applyCommand(state as ProjectState, cmd),
                selectedObjectId: id,
                selectedObjectIds: state.selectedObjectIds.includes(id)
                    ? state.selectedObjectIds
                    : [id],
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    changeObjectType: (id, nextType) =>
        set((state) => {
            const existing = state.objects.find((o) => o.id === id);
            if (!existing) return state;
            if (existing.type === nextType) return state;

            // ✅ treebed is een eigen objectfamilie en mag niet via algemene type-change
            // omgezet worden van/naar andere objecttypes
            const existingIsTreebed = existing.type === "treebed";
            const nextIsTreebed = nextType === "treebed";

            if (existingIsTreebed !== nextIsTreebed) {
                return state;
            }

            const isBoundaryType = (type: ObjectType) =>
                type === "fence" || type === "gate" || type === "poort";

            const existingIsBoundary = isBoundaryType(existing.type);
            const nextIsBoundary = isBoundaryType(nextType);

            // ✅ afbakening mag niet veranderen naar andere families, en andersom ook niet
            if (existingIsBoundary !== nextIsBoundary) {
                return state;
            }

            // linked-count mapping up-front kopiëren (we passen 'm evt aan)
            const nextLinked = { ...state.plantbedLinkedCount };

            // ✅ Als polyline betrokken is (fence/gate), doe simpele replace (geen clipper/merge)
            const existingObj: PolyObject = {
                ...existing,
                geometry: existing.geometry ?? getGeometryForType(existing.type),
            };

            const nextObj: PolyObject = {
                ...existingObj,
                type: nextType,
                geometry: getGeometryForType(nextType),
                // bij verlaten plantbed: plantbedNo weg
                plantbedNo: nextType === "plantbed" ? existingObj.plantbedNo : undefined,
            };

            if (isPolylineObject(existingObj) || isPolylineObject(nextObj)) {
                const without = state.objects.filter((o) => o.id !== id) as PolyObject[];
                const worldWith = [...without, nextObj] as PolyObject[];

                const nextFinal = isPolylineObject(nextObj) ? withLinePieces(nextObj, worldWith) : nextObj;

                const finalAfter =
                    existing.type === "plantbed" && nextType !== "plantbed"
                        ? renumberPlantbedsSequential([...without, nextFinal])
                        : [...without, nextFinal];

                const cmd: Command = {
                    kind: "replaceMany",
                    before: state.objects,
                    after: finalAfter,
                };

                const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                return {
                    objects: nextObjects,
                    selectedObjectId: nextFinal.id,
                    selectedObjectIds: [nextFinal.id],
                    plantbedLinkedCount: nextLinked,
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    undoStack: [...state.undoStack, cmd],
                    redoStack: [],
                };
            }

            // helper: laagste vrije plantbedNo
            const getLowestFreePlantbedNo = (objs: PolyObject[]) => {
                const used = new Set(
                    objs
                        .filter((o) => o.type === "plantbed")
                        .map((o) => o.plantbedNo ?? 0)
                        .filter((n) => Number.isFinite(n) && n > 0)
                );
                let no = 1;
                while (used.has(no)) no++;
                return no;
            };

            // Start vanuit de wereld zonder het oude object
            let updatedObjects = state.objects.filter((o) => o.id !== id);

            // newObj basis (bij verlaten plantbed: plantbedNo verwijderen)
            const newObj: PolyObject = {
                ...existing,
                type: nextType,
                plantbedNo: nextType === "plantbed" ? existing.plantbedNo : undefined,
            };

            const type = newObj.type;
            const newZ = TYPE_Z_INDEX[type];
            const newObjBox = bboxFromPoints(newObj.points);
            const MIN_BOOLEAN_OVERLAP_AREA = 0.0001;

            // 1) Snijd lagere lagen weg (nieuw “verft” erover)
            // ✅ hole-aware: bestaande holes van lagere lagen moeten behouden blijven
            const toRemove: PolyObject[] = [];
            const toAdd: PolyObject[] = [];

            for (const obj of updatedObjects) {
                if (obj.type === "treebed") continue;
                if (isPolylineObject(obj)) continue;

                const z = TYPE_Z_INDEX[obj.type];
                if (z >= newZ) continue;

                const objBox = bboxFromPoints(obj.points);
                if (!rectsOverlap(objBox, newObjBox)) continue;

                const overlapArea = getPolygonIntersectionArea(obj.points, newObj.points);
                if (overlapArea <= MIN_BOOLEAN_OVERLAP_AREA) continue;

                const diffPieces = subtractPolygonsPieces(obj, [newObj]);
                if (!diffPieces || diffPieces.length === 0) continue;

                toRemove.push(obj);

                for (const piece of diffPieces) {
                    if (piece.outer.length < 6) continue;

                    toAdd.push({
                        id: makeId(),
                        type: obj.type,
                        points: piece.outer,
                        holes: piece.holes?.length ? piece.holes : undefined,
                        plantbedNo: obj.plantbedNo,
                    });
                }
            }
            if (toRemove.length > 0) {
                const removeIds = new Set(toRemove.map((o) => o.id));
                updatedObjects = updatedObjects.filter((o) => !removeIds.has(o.id));
                updatedObjects.push(...toAdd);
            }

            // 2) Snijd de NIEUWE shape weg door alles wat hoger ligt
            // ✅ hole-aware: type change moet bestaande gaten van het object behouden
            const higherBlockers = updatedObjects.filter((o) => {
                if (o.id === id) return false;
                if (o.type === "treebed") return false;
                if (isPolylineObject(o)) return false;
                if (TYPE_Z_INDEX[o.type] <= newZ) return false;

                const blockerBox = bboxFromPoints(o.points);
                if (!rectsOverlap(newObjBox, blockerBox)) return false;

                const overlapArea = getPolygonIntersectionArea(o.points, newObj.points);
                return overlapArea > MIN_BOOLEAN_OVERLAP_AREA;
            });
            let drawPieces: DiffPiece[] = [{
                outer: newObj.points,
                holes: newObj.holes ?? [],
            }];

            if (higherBlockers.length > 0) {
                const cut = subtractPolygonsPieces(newObj, higherBlockers);
                drawPieces = cut && cut.length ? cut : [];
            }

            // niets over
            if (drawPieces.length === 0) {
                const finalAfter =
                    existing.type === "plantbed" && nextType !== "plantbed"
                        ? renumberPlantbedsSequential(updatedObjects)
                        : updatedObjects;

                const cmd: Command = { kind: "replaceMany", before: state.objects, after: finalAfter };
                const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                return {
                    objects: nextObjects,
                    selectedObjectId: null,
                    selectedObjectIds: [],
                    plantbedLinkedCount: nextLinked,
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    undoStack: [...state.undoStack, cmd],
                    redoStack: [],
                };
            }

            // 3) Plantbed: nooit unionen, wel overlap wegsnijden door bestaande plantbeds
            if (type === "plantbed") {
                const existingPlantbeds = updatedObjects.filter((o) => o.type === "plantbed");

                const finalPieces: DiffPiece[] = [];

                for (const piece of drawPieces) {
                    const subject: PolyObject = {
                        ...newObj,
                        type: "plantbed",
                        points: piece.outer,
                        holes: piece.holes?.length ? piece.holes : undefined,
                    };

                    const diffPieces = subtractPolygonsPieces(subject, existingPlantbeds);

                    if (diffPieces && diffPieces.length) {
                        for (const d of diffPieces) {
                            if (d.outer.length >= 6) finalPieces.push(d);
                        }
                    } else if (piece.outer.length >= 6) {
                        finalPieces.push(piece);
                    }
                }

                if (finalPieces.length === 0) {
                    const cmd: Command = { kind: "replaceMany", before: state.objects, after: updatedObjects };
                    const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                    const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                    return {
                        objects: nextObjects,
                        selectedObjectId: null,
                        selectedObjectIds: [],
                        plantbedLinkedCount: nextLinked,
                        nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                        undoStack: [...state.undoStack, cmd],
                        redoStack: [],
                    };
                }

                const plantbedNo = getLowestFreePlantbedNo(updatedObjects);

                const nextLinksMap: PlantbedLinksMap = { ...state.plantbedLinks };

                const newPlantbeds: PolyObject[] = finalPieces.map((piece) => {
                    const newId = makeId();
                    nextLinked[newId] = 0;
                    nextLinksMap[newId] = [];

                    return {
                        id: newId,
                        type: "plantbed",
                        points: piece.outer,
                        holes: piece.holes?.length ? piece.holes : undefined,
                        plantbedNo,
                    };
                });

                const cmd: Command = {
                    kind: "replaceMany",
                    before: state.objects,
                    after: [...updatedObjects, ...newPlantbeds],
                };

                const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);
                const nextSelectedId = newPlantbeds.length ? newPlantbeds[0].id : null;

                return {
                    objects: nextObjects,
                    selectedObjectId: nextSelectedId,
                    selectedObjectIds: nextSelectedId ? [nextSelectedId] : [],
                    plantbedLinks: nextLinksMap,
                    plantbedLinkedCount: nextLinked,
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    undoStack: [...state.undoStack, cmd],
                    redoStack: [],
                };
            }

            const sameType = updatedObjects.filter((o) => o.type === type);

            const drawPolys: PolyObject[] = drawPieces.map((piece) => ({
                id: makeId(),
                type,
                points: piece.outer,
                holes: piece.holes?.length ? piece.holes : undefined,
            }));

            const mergeInput = [...sameType, ...drawPolys];

            const mergedPieces =
                mergeInput.length >= 2
                    ? (shouldUseCellMerge(mergeInput)
                        ? mergeSameTypeViaCells(mergeInput, SNAP_GRID_SIZE)
                        : unionSameTypePolygons(mergeInput))
                    : null;

            const afterObjectsRaw: PolyObject[] = mergedPieces
                ? mergedPieces
                    .filter((piece) => piece.outer.length >= 6)
                    .map((piece) => ({
                        id: makeId(),
                        type,
                        points: piece.outer,
                        holes: piece.holes?.length ? piece.holes : undefined,
                    }))
                : drawPieces
                    .filter((piece) => piece.outer.length >= 6)
                    .map((piece) => ({
                        id: makeId(),
                        type,
                        points: piece.outer,
                        holes: piece.holes?.length ? piece.holes : undefined,
                    }));

            // ✅ selectie moet blijven op het object dat net is gewijzigd,
            // niet op het eerste object van dit type in de lijst
            const existingBox = bboxFromPoints(existing.points);
            const existingCenterX = existingBox.x + existingBox.w / 2;
            const existingCenterY = existingBox.y + existingBox.h / 2;

            // vervang alle objects van dit type door de nieuwe merged set
            updatedObjects = updatedObjects.filter((o) => o.type !== type);

            const finalAfter =
                existing.type === "plantbed" && nextType !== "plantbed"
                    ? renumberPlantbedsSequential([...updatedObjects, ...afterObjectsRaw])
                    : [...updatedObjects, ...afterObjectsRaw];

            const candidateSelectionObjects = finalAfter.filter((o) => o.type === type);

            const nextSelectedObject =
                candidateSelectionObjects.length > 0
                    ? candidateSelectionObjects.reduce((best, candidate) => {
                        const bestBox = bboxFromPoints(best.points);
                        const candBox = bboxFromPoints(candidate.points);

                        const bestCenterX = bestBox.x + bestBox.w / 2;
                        const bestCenterY = bestBox.y + bestBox.h / 2;
                        const candCenterX = candBox.x + candBox.w / 2;
                        const candCenterY = candBox.y + candBox.h / 2;

                        const bestDist =
                            (bestCenterX - existingCenterX) * (bestCenterX - existingCenterX) +
                            (bestCenterY - existingCenterY) * (bestCenterY - existingCenterY);

                        const candDist =
                            (candCenterX - existingCenterX) * (candCenterX - existingCenterX) +
                            (candCenterY - existingCenterY) * (candCenterY - existingCenterY);

                        return candDist < bestDist ? candidate : best;
                    })
                    : null;

            const cmd: Command = {
                kind: "replaceMany",
                before: state.objects,
                after: finalAfter,
            };

            const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
            const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);
            const nextSelectedId = nextSelectedObject ? nextSelectedObject.id : null;

            return {
                objects: nextObjects,
                selectedObjectId: nextSelectedId,
                selectedObjectIds: nextSelectedId ? [nextSelectedId] : [],
                plantbedLinkedCount: nextLinked,
                nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    moveObjectsBatch: (items) =>
        set((state) => {
            if (!items.length) return state;

            const itemMap = new Map(items.map((it) => [it.id, it.toPoints]));
            const movedIds = new Set(items.map((it) => it.id));

            const movedExisting = state.objects.filter((o) => itemMap.has(o.id));
            if (!movedExisting.length) return state;

            const movedObjects: PolyObject[] = movedExisting.map((o) => {
                const toPoints = itemMap.get(o.id)!;
                const dx = (toPoints[0] ?? 0) - (o.points[0] ?? 0);
                const dy = (toPoints[1] ?? 0) - (o.points[1] ?? 0);

                return {
                    ...o,
                    points: toPoints,
                    holes: o.holes ? translateHoles(o.holes, dx, dy) : o.holes,
                };
            });

            // wereld zonder de objecten die verplaatst worden
            let updatedObjects = state.objects.filter((o) => !movedIds.has(o.id));

            // ✅ 1) lagere lagen hole-aware wegsnijden door ALLE verplaatste objecten
            const toRemove = new Set<string>();
            const toAdd: PolyObject[] = [];

            for (const obj of updatedObjects) {
                if (isPolylineObject(obj) || obj.type === "treebed") continue;

                const relevantMoved = movedObjects.filter(
                    (m) =>
                        !isPolylineObject(m) &&
                        m.type !== "treebed" &&
                        TYPE_Z_INDEX[obj.type] < TYPE_Z_INDEX[m.type]
                );

                if (relevantMoved.length === 0) continue;

                const pieces = subtractPolygonsPieces(obj, relevantMoved);
                if (!pieces || pieces.length === 0) continue;

                toRemove.add(obj.id);

                for (let idx = 0; idx < pieces.length; idx++) {
                    const piece = pieces[idx];
                    if (piece.outer.length < 6) continue;

                    toAdd.push({
                        ...obj,
                        id: idx === 0 ? obj.id : makeId(),
                        points: piece.outer,
                        holes: piece.holes?.length ? piece.holes : undefined,
                    });
                }
            }

            if (toRemove.size > 0) {
                updatedObjects = updatedObjects.filter((o) => !toRemove.has(o.id));
                updatedObjects.push(...toAdd);
            }

            // ✅ 2) verplaatste objecten zelf hole-aware wegknippen tegen hogere lagen
            const finalMoved: PolyObject[] = [];
            const nextSelectedIdsSet = new Set<string>();

            for (const moved of movedObjects) {
                if (isPolylineObject(moved)) {
                    finalMoved.push(moved);
                    nextSelectedIdsSet.add(moved.id);
                    continue;
                }

                if (moved.type === "treebed") {
                    finalMoved.push({
                        ...moved,
                        holes: undefined,
                    });
                    nextSelectedIdsSet.add(moved.id);
                    continue;
                }

                const higherBlockers = updatedObjects.filter(
                    (o) =>
                        o.type !== "treebed" &&
                        !isPolylineObject(o) &&
                        TYPE_Z_INDEX[o.type] > TYPE_Z_INDEX[moved.type]
                );

                const cutPieces =
                    higherBlockers.length > 0
                        ? subtractPolygonsPieces(moved, higherBlockers)
                        : [{ outer: moved.points, holes: moved.holes ?? [] }];

                if (!cutPieces || cutPieces.length === 0) continue;

                // plantbeds nooit unionen
                // moved plantbeds hebben prioriteit → zij snijden bestaande plantbeds weg
                if (moved.type === "plantbed") {

                    const existingPlantbeds = updatedObjects.filter((o) => o.type === "plantbed");

                    const movedPieces: PolyObject[] = cutPieces
                        .filter((piece) => piece.outer.length >= 6)
                        .map((piece) => ({
                            ...moved,
                            points: piece.outer,
                            holes: piece.holes?.length ? piece.holes : undefined,
                        }));

                    // eerst moved pieces toevoegen
                    movedPieces.forEach((piece, idx) => {
                        const nextId = idx === 0 ? moved.id : makeId();

                        finalMoved.push({
                            ...piece,
                            id: nextId,
                        });

                        nextSelectedIdsSet.add(nextId);
                    });

                    // Alleen bestaande plantvakken die echt geraakt worden mogen worden uitgesneden.
                    // Anders blijven holes van niet-betrokken plantvakken intact.
                    const touchedExistingPlantbeds = existingPlantbeds.filter((existing) =>
                        movedPieces.some((piece) =>
                            polygonsActuallyTouchOrOverlap(existing.points, piece.points) ||
                            polygonContainsPolygon(existing.points, piece.points) ||
                            polygonContainsPolygon(piece.points, existing.points)
                        )
                    );

                    for (const existing of touchedExistingPlantbeds) {
                        const diffPieces = subtractPolygonsPieces(existing, movedPieces);

                        if (!diffPieces || diffPieces.length === 0) {
                            updatedObjects = updatedObjects.filter((o) => o.id !== existing.id);
                            continue;
                        }

                        updatedObjects = updatedObjects.filter((o) => o.id !== existing.id);

                        diffPieces.forEach((piece, idx) => {
                            if (piece.outer.length < 6) return;

                            updatedObjects.push({
                                ...existing,
                                id: idx === 0 ? existing.id : makeId(),
                                points: piece.outer,
                                holes: piece.holes?.length ? piece.holes : undefined,
                            });
                        });
                    }

                    continue;
                }

                // same-type merge, maar holes behouden
                const sameType = updatedObjects.filter((o) => o.type === moved.type);
                const drawPolys: PolyObject[] = cutPieces
                    .filter((piece) => piece.outer.length >= 6)
                    .map((piece, idx) => ({
                        ...moved,
                        id: idx === 0 ? moved.id : makeId(),
                        points: piece.outer,
                        holes: piece.holes?.length ? piece.holes : undefined,
                    }));

                const mergeInput = [...sameType, ...drawPolys];

                const mergedPieces =
                    mergeInput.length >= 2
                        ? (shouldUseCellMerge(mergeInput)
                            ? mergeSameTypeViaCells(mergeInput, SNAP_GRID_SIZE)
                            : unionSameTypePolygons(mergeInput))
                        : null;

                if (!mergedPieces) {
                    finalMoved.push(...drawPolys);
                    drawPolys.forEach((obj) => nextSelectedIdsSet.add(obj.id));
                } else {
                    const existingSameTypeIds = new Set(sameType.map((o) => o.id));
                    updatedObjects = updatedObjects.filter((o) => !existingSameTypeIds.has(o.id));

                    const primaryMergedIdx = pickPrimaryMergedShapeIndex(
                        mergedPieces.map((piece) => piece.outer),
                        moved.points
                    );

                    mergedPieces.forEach((piece, idx) => {
                        if (piece.outer.length < 6) return;

                        const nextId = idx === primaryMergedIdx ? moved.id : makeId();

                        finalMoved.push({
                            ...moved,
                            id: nextId,
                            points: piece.outer,
                            holes: piece.holes?.length ? piece.holes : undefined,
                        });

                        if (idx === primaryMergedIdx) {
                            nextSelectedIdsSet.add(nextId);
                        }
                    });
                }
            }

            const nextObjectsRaw = recalcLinePiecesForWorld([...updatedObjects, ...finalMoved]);

            const cmd: Command = {
                kind: "replaceMany",
                before: state.objects,
                after: nextObjectsRaw,
            };

            const nextSelectedIds = Array.from(nextSelectedIdsSet).filter((id) =>
                nextObjectsRaw.some((o) => o.id === id)
            );

            const nextSelectedObjectId =
                state.selectedObjectId && nextSelectedIds.includes(state.selectedObjectId)
                    ? state.selectedObjectId
                    : nextSelectedIds[0] ?? null;

            return {
                objects: nextObjectsRaw,
                selectedObjectId: nextSelectedObjectId,
                selectedObjectIds: nextSelectedIds,
                nextPlantbedNo: recalcNextPlantbedNo(nextObjectsRaw),
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    confirmModal: null,

    closeConfirmModal: () => set({ confirmModal: null }),

    openDeletePlantbedModal: (plantbedId) =>
        set((state) => {
            const pb = state.objects.find((o) => o.id === plantbedId && o.type === "plantbed");
            if (!pb) return state;

            const plantIds = state.plantbedLinks[plantbedId] ?? [];
            const plantbedNo = pb.plantbedNo ?? null;

            return {
                confirmModal: {
                    kind: "delete-plantbed",
                    plantbedId,
                    plantbedNo,
                    plantIds,
                },
            };
        }),

    openDeletePlantbedsModal: (payload) =>
        set(() => ({
            confirmModal: {
                kind: "delete-plantbeds",
                selectedIds: payload.selectedIds,
                plantbedIds: payload.plantbedIds,
                items: payload.items,
                totalSelected: payload.totalSelected,
            },
        })),

    requestDeleteSelected: () => {
        const state = get();

        const ids =
            state.selectedObjectIds && state.selectedObjectIds.length > 0
                ? state.selectedObjectIds
                : state.selectedObjectId
                    ? [state.selectedObjectId]
                    : [];

        if (ids.length === 0) return;

        const selectedObjects = state.objects.filter((o) => ids.includes(o.id));
        if (selectedObjects.length === 0) return;

        const selectedPlantbeds = selectedObjects.filter((o) => o.type === "plantbed");
        if (selectedPlantbeds.length === 0) {
            // geen plantvakken => geen links-probleem
            state.deleteSelected();
            return;
        }

        // plantvakken met gekoppelde planten
        const plantbedsWithLinks = selectedPlantbeds
            .map((pb) => {
                const plantIds = state.plantbedLinks[pb.id] ?? [];
                const linkedCount = state.plantbedLinkedCount[pb.id] ?? plantIds.length;
                return {
                    plantbedId: pb.id,
                    plantbedNo: pb.plantbedNo ?? null,
                    linkedCount,
                    plantIds,
                };
            })
            .filter((x) => x.plantIds.length > 0);

        // ✅ SINGLE: zelfde gedrag als eerst (modal met plantlijst)
        if (ids.length === 1) {
            const only = selectedObjects[0];
            if (only?.type === "plantbed") {
                const linked = state.plantbedLinks[only.id] ?? [];
                if (linked.length > 0) {
                    state.openDeletePlantbedModal(only.id);
                    return;
                }
            }
            state.deleteSelected();
            return;
        }

        if (plantbedsWithLinks.length > 0) {
            state.openDeletePlantbedsModal({
                selectedIds: [...ids],
                plantbedIds: plantbedsWithLinks.map((x) => x.plantbedId),
                items: plantbedsWithLinks,
                totalSelected: ids.length,
            });
            return;
        }

        // ✅ MULTI zonder gekoppelde planten -> direct verwijderen
        state.deleteSelected();
    },

    requestChangeObjectType: (objectId: string, nextType: ObjectType) => {
        const obj = get().objects.find((o: any) => o.id === objectId);
        if (!obj) return;

        // ✅ Alleen popup als het een plantvak is met gekoppelde planten
        if (obj.type === "plantbed" && nextType !== "plantbed") {
            const plantIds: string[] = get().plantbedLinks?.[objectId] ?? [];
            if (plantIds.length > 0) {
                const plantbedNo = (obj as any).plantbedNo ?? null;

                set({
                    confirmModal: {
                        kind: "change-plantbed-type",
                        plantbedId: objectId,
                        plantbedNo,
                        nextType,
                        plantIds,
                    },
                });

                return;
            }
        }

        // ✅ Geen popup nodig
        get().changeObjectType(objectId, nextType);
    },

    changeTreebedVariant: (id, nextVariant) =>
        set((state) => {
            const existing = state.objects.find((o) => o.id === id);
            if (!existing || existing.type !== "treebed") return state;

            const currentVariant = existing.treebedVariant ?? "standard";
            if (currentVariant === nextVariant) return state;

            const nextPoints = rebuildTreebedPointsForVariant(
                existing.points,
                nextVariant
            );

            const nextObj: PolyObject = {
                ...existing,
                points: nextPoints,
                treebedVariant: nextVariant,
            };

            const without = state.objects.filter((o) => o.id !== id) as PolyObject[];

            const cmd: Command = {
                kind: "replaceMany",
                before: state.objects,
                after: [...without, nextObj],
            };

            const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
            const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

            return {
                objects: nextObjects,
                selectedObjectId: nextObj.id,
                selectedObjectIds: [nextObj.id],
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    confirmModalPrimaryAction: () => {
        const dlg = get().confirmModal;
        if (!dlg) return;

        // ----------------------------
        // ✅ plantbed type-change (met links)
        // ----------------------------
        if (dlg.kind === "change-plantbed-type") {
            const objectId = dlg.plantbedId;
            const nextType = dlg.nextType;

            const pre = get();
            const existing = pre.objects.find((o) => o.id === objectId && o.type === "plantbed");

            if (!existing) {
                set({ confirmModal: null });
                return;
            }

            const removedLinks: PlantbedLinksMap = {
                [objectId]: [...(pre.plantbedLinks?.[objectId] ?? [])],
            };

            const removedCounts: Record<string, number> = {
                [objectId]:
                    pre.plantbedLinkedCount?.[objectId] ?? removedLinks[objectId].length,
            };

            const beforeUndoLen = pre.undoStack.length;

            get().changeObjectType(objectId, nextType);

            const post = get();
            const last = post.undoStack?.[post.undoStack.length - 1];

            if (!last || last.kind !== "replaceMany") {
                set({ confirmModal: null });
                return;
            }

            const upgraded: Command = {
                kind: "replaceManyWithPlantbedLinks",
                before: last.before,
                after: last.after,
                removedLinks,
                removedCounts,
            };

            const nextUndo = [
                ...post.undoStack.slice(0, Math.max(beforeUndoLen, 0)),
                upgraded,
            ];

            const nextLinks = { ...(post.plantbedLinks ?? {}) };
            delete nextLinks[objectId];

            const nextCounts = { ...(post.plantbedLinkedCount ?? {}) };
            delete nextCounts[objectId];

            set({
                confirmModal: null,
                undoStack: nextUndo,
                plantbedLinks: nextLinks,
                plantbedLinkedCount: nextCounts,
            });
            return;
        }

        set((state) => {
            const activeDialog = state.confirmModal;
            if (!activeDialog) return state;

            // ----------------------------
            // ✅ SINGLE plantbed delete (met links)
            // ----------------------------
            if (activeDialog.kind === "delete-plantbed") {
                const plantbedId = activeDialog.plantbedId;

                const pbObj = state.objects.find((o) => o.id === plantbedId && o.type === "plantbed");
                if (!pbObj) {
                    return { confirmModal: null };
                }

                const removedLinks: PlantbedLinksMap = {
                    [plantbedId]: [...(state.plantbedLinks[plantbedId] ?? [])],
                };

                const removedCounts: Record<string, number> = {
                    [plantbedId]: state.plantbedLinkedCount[plantbedId] ?? removedLinks[plantbedId].length,
                };

                const afterObjects = renumberPlantbedsSequential(
                    state.objects.filter((o) => o.id !== plantbedId)
                );

                const cmd: Command = {
                    kind: "replaceManyWithPlantbedLinks",
                    before: state.objects,
                    after: afterObjects,
                    removedLinks,
                    removedCounts,
                };

                const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

                const nextLinksMap: PlantbedLinksMap = { ...state.plantbedLinks };
                delete nextLinksMap[plantbedId];

                const nextCountsMap: Record<string, number> = { ...state.plantbedLinkedCount };
                delete nextCountsMap[plantbedId];

                return {
                    confirmModal: null,
                    objects: nextObjects,
                    selectedObjectId: null,
                    selectedObjectIds: [],
                    plantbedLinks: nextLinksMap,
                    plantbedLinkedCount: nextCountsMap,
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    undoStack: [...state.undoStack, cmd],
                    redoStack: [],
                };
            }

            // ----------------------------
            // ✅ MULTI plantbeds delete (met links)
            // ----------------------------
            if (activeDialog.kind === "delete-plantbeds") {
                const ids = activeDialog.selectedIds ?? [];

                if (ids.length === 0) return { confirmModal: null };

                const idSet = new Set(ids);
                const objectsToRemove = state.objects.filter((o) => idSet.has(o.id));
                if (objectsToRemove.length === 0) return { confirmModal: null };

                const plantbedsToRemove = objectsToRemove.filter((o) => o.type === "plantbed");

                const removedLinks: PlantbedLinksMap = {};
                const removedCounts: Record<string, number> = {};

                for (const pb of plantbedsToRemove) {
                    const pbId = pb.id;
                    const arr = state.plantbedLinks[pbId] ?? [];
                    removedLinks[pbId] = [...arr];
                    removedCounts[pbId] = state.plantbedLinkedCount[pbId] ?? arr.length;
                }

                const cmd: Command = {
                    kind: "removeManyWithPlantbedLinks",
                    objects: objectsToRemove,
                    removedLinks,
                    removedCounts,
                };

                const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
                const renumberedObjects = renumberPlantbedsSequential(nextObjectsRaw);
                const nextObjects = recalcLinePiecesForWorld(renumberedObjects);

                const nextLinksMap: PlantbedLinksMap = { ...state.plantbedLinks };
                const nextCountsMap: Record<string, number> = { ...state.plantbedLinkedCount };

                for (const pbId of Object.keys(removedLinks)) {
                    delete nextLinksMap[pbId];
                    delete nextCountsMap[pbId];
                }

                return {
                    confirmModal: null,
                    objects: nextObjects,
                    selectedObjectId: null,
                    selectedObjectIds: [],
                    plantbedLinks: nextLinksMap,
                    plantbedLinkedCount: nextCountsMap,
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    undoStack: [...state.undoStack, cmd],
                    redoStack: [],
                };
            }

            return state;
        });
    },

    /**
     * ✅ Bestaande deleteSelected blijft zoals jij hem had
     * (maar we gebruiken 'm straks niet meer direct bij plantvak met links)
     */
    deleteSelected: () =>
        set((state) => {
            const ids =
                state.selectedObjectIds && state.selectedObjectIds.length > 0
                    ? state.selectedObjectIds
                    : state.selectedObjectId
                        ? [state.selectedObjectId]
                        : [];

            if (ids.length === 0) return state;

            const removeIds = new Set(ids);
            const objectsToRemove = state.objects.filter((o) => removeIds.has(o.id));
            if (objectsToRemove.length === 0) return state;

            const afterObjects = renumberPlantbedsSequential(
                state.objects.filter((o) => !removeIds.has(o.id))
            );

            const cmd: Command = {
                kind: "replaceMany",
                before: state.objects,
                after: afterObjects,
            };

            const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
            const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

            return {
                objects: nextObjects,
                selectedObjectId: null,
                selectedObjectIds: [],
                plantbedLinkedCount: state.plantbedLinkedCount,
                nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                undoStack: [...state.undoStack, cmd],
                redoStack: [],
            };
        }),

    undo: () =>
        set((state) => {
            if (state.undoStack.length === 0) return state;

            const cmd = state.undoStack[state.undoStack.length - 1];
            const inverse = invertCommand(cmd);

            // ✅ 1) link/unlink inverse toepassen
            if (inverse.kind === "linkPlant") {
                const { plantbedLinks, plantbedLinkedCount } = applyLink(state as ProjectState, inverse.plantId, inverse.plantbedId);
                return {
                    plantbedLinks,
                    plantbedLinkedCount,
                    undoStack: state.undoStack.slice(0, -1),
                    redoStack: [...state.redoStack, cmd],
                };
            }

            if (inverse.kind === "unlinkPlant") {
                const { plantbedLinks, plantbedLinkedCount } = applyUnlink(state as ProjectState, inverse.plantId, inverse.plantbedId);
                return {
                    plantbedLinks,
                    plantbedLinkedCount,
                    undoStack: state.undoStack.slice(0, -1),
                    redoStack: [...state.redoStack, cmd],
                };
            }

            // ✅ 2) addManyWithPlantbedLinks (undo van delete) => objects terug + links/counts terug
            if (inverse.kind === "addManyWithPlantbedLinks") {
                const nextObjects = applyCommand(state as ProjectState, inverse);

                const nextLinksMap: PlantbedLinksMap = { ...state.plantbedLinks };
                const nextCountsMap: Record<string, number> = { ...state.plantbedLinkedCount };

                for (const [pbId, arr] of Object.entries(inverse.restoredLinks)) {
                    nextLinksMap[pbId] = [...arr];
                }
                for (const [pbId, c] of Object.entries(inverse.restoredCounts)) {
                    nextCountsMap[pbId] = c;
                }

                return {
                    objects: nextObjects,
                    plantbedLinks: nextLinksMap,
                    plantbedLinkedCount: nextCountsMap,
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    selectedObjectId: null,
                    selectedObjectIds: [],
                    undoStack: state.undoStack.slice(0, -1),
                    redoStack: [...state.redoStack, cmd],
                };
            }

            // ✅ 2B) undo type-change/merge-with-links: objects terug + links/counts terug
            if (inverse.kind === "replaceManyWithPlantbedLinks") {
                const nextObjects = applyCommand(state as ProjectState, inverse);

                if (cmd.kind === "replaceManyWithPlantbedLinks" && cmd.beforeLinks && cmd.beforeCounts) {
                    return {
                        objects: nextObjects,
                        plantbedLinks: clonePlantbedLinks(cmd.beforeLinks),
                        plantbedLinkedCount: { ...cmd.beforeCounts },
                        nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                        selectedObjectId: null,
                        selectedObjectIds: [],
                        undoStack: state.undoStack.slice(0, -1),
                        redoStack: [...state.redoStack, cmd],
                    };
                }

                const nextLinksMap: PlantbedLinksMap = { ...state.plantbedLinks };
                const nextCountsMap: Record<string, number> = { ...state.plantbedLinkedCount };

                for (const [pbId, arr] of Object.entries(inverse.removedLinks)) {
                    nextLinksMap[pbId] = [...arr];
                }
                for (const [pbId, c] of Object.entries(inverse.removedCounts)) {
                    nextCountsMap[pbId] = c;
                }

                return {
                    objects: nextObjects,
                    plantbedLinks: nextLinksMap,
                    plantbedLinkedCount: nextCountsMap,
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    selectedObjectId: null,
                    selectedObjectIds: [],
                    undoStack: state.undoStack.slice(0, -1),
                    redoStack: [...state.redoStack, cmd],
                };
            }

            const nextObjectsRaw = applyCommand(state as ProjectState, inverse);
            const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

            const nextSelectedIds = state.selectedObjectIds.filter((sid) => nextObjects.some((o) => o.id === sid));

            return {
                objects: nextObjects,
                compassDirection: inverse.kind === "rotateCanvas"
                    ? inverse.compassAfter
                    : state.compassDirection,
                selectedObjectIds: nextSelectedIds,
                selectedObjectId: nextSelectedIds.length > 0 ? nextSelectedIds[0] : null,
                nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                undoStack: state.undoStack.slice(0, -1),
                redoStack: [...state.redoStack, cmd],
            };
        }),

    redo: () =>
        set((state) => {
            if (state.redoStack.length === 0) return state;

            const cmd = state.redoStack[state.redoStack.length - 1];

            // ✅ 1) link/unlink direct toepassen
            if (cmd.kind === "linkPlant") {
                const { plantbedLinks, plantbedLinkedCount } = applyLink(state as ProjectState, cmd.plantId, cmd.plantbedId);
                return {
                    plantbedLinks,
                    plantbedLinkedCount,
                    redoStack: state.redoStack.slice(0, -1),
                    undoStack: [...state.undoStack, cmd],
                };
            }

            if (cmd.kind === "unlinkPlant") {
                const { plantbedLinks, plantbedLinkedCount } = applyUnlink(state as ProjectState, cmd.plantId, cmd.plantbedId);
                return {
                    plantbedLinks,
                    plantbedLinkedCount,
                    redoStack: state.redoStack.slice(0, -1),
                    undoStack: [...state.undoStack, cmd],
                };
            }

            // ✅ 2) redo delete-with-links: objects weg + links/counts weg
            if (cmd.kind === "removeManyWithPlantbedLinks") {
                const nextObjects = applyCommand(state as ProjectState, cmd);

                const nextLinksMap: PlantbedLinksMap = { ...state.plantbedLinks };
                const nextCountsMap: Record<string, number> = { ...state.plantbedLinkedCount };

                for (const pbId of Object.keys(cmd.removedLinks)) {
                    delete nextLinksMap[pbId];
                }
                for (const pbId of Object.keys(cmd.removedCounts)) {
                    delete nextCountsMap[pbId];
                }

                return {
                    objects: nextObjects,
                    plantbedLinks: nextLinksMap,
                    plantbedLinkedCount: nextCountsMap,
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    selectedObjectId: null,
                    selectedObjectIds: [],
                    redoStack: state.redoStack.slice(0, -1),
                    undoStack: [...state.undoStack, cmd],
                };
            }

            // ✅ 2B) redo type-change/merge-with-links: objects vooruit + links/counts vooruit
            if (cmd.kind === "replaceManyWithPlantbedLinks") {
                const nextObjects = applyCommand(state as ProjectState, cmd);

                if (cmd.afterLinks && cmd.afterCounts) {
                    return {
                        objects: nextObjects,
                        plantbedLinks: clonePlantbedLinks(cmd.afterLinks),
                        plantbedLinkedCount: { ...cmd.afterCounts },
                        nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                        selectedObjectId: null,
                        selectedObjectIds: [],
                        redoStack: state.redoStack.slice(0, -1),
                        undoStack: [...state.undoStack, cmd],
                    };
                }

                const nextLinksMap: PlantbedLinksMap = { ...state.plantbedLinks };
                const nextCountsMap: Record<string, number> = { ...state.plantbedLinkedCount };

                for (const pbId of Object.keys(cmd.removedLinks)) {
                    delete nextLinksMap[pbId];
                }
                for (const pbId of Object.keys(cmd.removedCounts)) {
                    delete nextCountsMap[pbId];
                }

                return {
                    objects: nextObjects,
                    plantbedLinks: nextLinksMap,
                    plantbedLinkedCount: nextCountsMap,
                    nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                    selectedObjectId: null,
                    selectedObjectIds: [],
                    redoStack: state.redoStack.slice(0, -1),
                    undoStack: [...state.undoStack, cmd],
                };
            }

            const nextObjectsRaw = applyCommand(state as ProjectState, cmd);
            const nextObjects = recalcLinePiecesForWorld(nextObjectsRaw);

            const nextSelectedIds = state.selectedObjectIds.filter((sid) => nextObjects.some((o) => o.id === sid));

            return {
                objects: nextObjects,
                compassDirection: cmd.kind === "rotateCanvas"
                    ? cmd.compassAfter
                    : state.compassDirection,
                selectedObjectIds: nextSelectedIds,
                selectedObjectId: nextSelectedIds.length > 0 ? nextSelectedIds[0] : null,
                nextPlantbedNo: recalcNextPlantbedNo(nextObjects),
                redoStack: state.redoStack.slice(0, -1),
                undoStack: [...state.undoStack, cmd],
            };
        }),
    clearHistory: () => set({ undoStack: [], redoStack: [] }),

    plantSidebarFocus: null,

    focusSidebarOnPlantbed: (plantbedId) =>
        set((s) => ({
            plantSidebarFocus: { plantbedId, nonce: (s.plantSidebarFocus?.nonce ?? 0) + 1 },
        })),

    canvasFocusRequest: null,

    focusCanvasOnObject: (objectId) =>
        set((s) => ({
            canvasFocusRequest: { objectId, nonce: (s.canvasFocusRequest?.nonce ?? 0) + 1 },
        })),

}));