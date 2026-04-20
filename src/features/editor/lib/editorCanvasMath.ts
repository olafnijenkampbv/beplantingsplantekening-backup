import type { PolyObject } from "@/state/projectStore";

export function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

export function estimateTextWidth(text: string, fontSize: number) {
    return text.length * fontSize * 0.58;
}

export function snapToGrid(value: number, gridSize: number) {
    return Math.round(value / gridSize) * gridSize;
}

export function snapPointsToGrid(points: number[], gridSize: number) {
    const next: number[] = [];

    for (let i = 0; i < points.length; i += 2) {
        next.push(
            snapToGrid(points[i], gridSize),
            snapToGrid(points[i + 1], gridSize)
        );
    }

    return next;
}

export function snapHolesToGrid(holes: number[][] | undefined, gridSize: number) {
    if (!holes || holes.length === 0) return holes;
    return holes.map((hole) => snapPointsToGrid(hole, gridSize));
}

export function snapPolyObjectToGrid(obj: PolyObject, gridSize: number): PolyObject {
    return {
        ...obj,
        points: snapPointsToGrid(obj.points, gridSize),
        holes: snapHolesToGrid(obj.holes, gridSize),
        renderPieces: obj.renderPieces?.map((piece) => snapPointsToGrid(piece, gridSize)),
    };
}

export function getPointerWorldPos(stage: any) {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;

    const scale = stage.scaleX();
    const pos = stage.position();

    return {
        x: (pointer.x - pos.x) / scale,
        y: (pointer.y - pos.y) / scale,
    };
}

export function getPointerWorldPosFromClient(stage: any, clientX: number, clientY: number) {
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

export function normalizeRect(x1: number, y1: number, x2: number, y2: number) {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    return { x, y, w, h };
}

export function bboxFromPoints(points: number[]) {
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

export function getObjectsBoundingBox(objects: PolyObject[]) {
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

export function distPointToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
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

export function pointToSegmentDistance(
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

export function rectContainsPoint(
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

export function rectsOverlap(
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