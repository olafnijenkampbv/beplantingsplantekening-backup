import type { PolyObject, ObjectType } from "@/state/projectStore";

export function pointInPolygon(px: number, py: number, poly: number[]) {
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

export function pointOnPolygonBoundary(
    px: number,
    py: number,
    poly: number[],
    eps = 1e-6
) {
    const n = poly.length / 2;
    if (n < 2) return false;

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = poly[i * 2];
        const ay = poly[i * 2 + 1];
        const bx = poly[j * 2];
        const by = poly[j * 2 + 1];

        const dx = bx - ax;
        const dy = by - ay;

        const t = Math.max(
            0,
            Math.min(
                1,
                ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
            )
        );

        const projX = ax + t * dx;
        const projY = ay + t * dy;

        const distX = px - projX;
        const distY = py - projY;

        if (Math.sqrt(distX * distX + distY * distY) <= eps) {
            return true;
        }
    }

    return false;
}

export function pointInPolygonInclusive(
    px: number,
    py: number,
    poly: number[],
    boundaryEps = 6
) {
    if (pointInPolygon(px, py, poly)) return true;
    return pointOnPolygonBoundary(px, py, poly, boundaryEps);
}

export function getPlantbedHitAtWorldPoint(
    worldX: number,
    worldY: number,
    plantbeds: PolyObject[]
) {
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

export function getOrthogonalEdgeOrientation(
    ax: number,
    ay: number,
    bx: number,
    by: number
) {
    if (ax === bx && ay !== by) return "vertical" as const;
    if (ay === by && ax !== bx) return "horizontal" as const;
    return null;
}

export function getEdgeResizeCursor(
    orientation: "vertical" | "horizontal"
) {
    return orientation === "vertical" ? "ew-resize" : "ns-resize";
}

function isFenceOrGate(type: ObjectType) {
    return type === "fence" || type === "gate";
}

export function canAutoCloseAgainstSameTypeBoundary(
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

    const lastX = base[base.length - 2];
    const lastY = base[base.length - 1];
    if (lastX === nextX && lastY === nextY) return false;

    return true;
}