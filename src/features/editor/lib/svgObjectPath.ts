import type { PolyObject } from "@/state/projectStore";
import { normalizeBulges } from "@/state/projectStore";
import {
    densifyBulgedRing,
    normalizeCorners,
    STRAIGHT_THRESHOLD,
} from "@/features/editor/lib/bulgeMath";

type PointTransform = (x: number, y: number) => [number, number];

function hasPositiveCorner(value: number | undefined) {
    return (value || 0) > 0;
}

export function getObjectOuterRenderPoints(
    object: Pick<PolyObject, "points" | "bulges" | "corners">,
    segmentCount = 48
) {
    const points = object.points ?? [];
    if (points.length < 6) return points;

    const bulges = normalizeBulges(points, object.bulges);
    const corners = normalizeCorners(points, object.corners);
    const hasBulges = bulges.some((b) => Math.abs(b) > STRAIGHT_THRESHOLD);
    const hasCorners = corners.some(hasPositiveCorner);

    if (!hasBulges && !hasCorners) return points;

    return densifyBulgedRing(
        points,
        bulges,
        segmentCount,
        hasCorners ? corners : undefined
    );
}

export function getObjectBoundsRenderPoints(
    object: Pick<PolyObject, "points" | "holes" | "bulges" | "corners">
) {
    return [
        ...getObjectOuterRenderPoints(object),
        ...(object.holes ?? []).flatMap((hole) => hole),
    ];
}

export function makeSvgPathFromRings(
    outer: number[],
    holes?: number[][],
    transform?: PointTransform
) {
    const ringToPath = (ring: number[]) => {
        if (ring.length < 6) return "";

        const commands: string[] = [];
        for (let i = 0; i + 1 < ring.length; i += 2) {
            const [x, y] = transform
                ? transform(ring[i], ring[i + 1])
                : [ring[i], ring[i + 1]];
            commands.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
        }

        return `${commands.join(" ")} Z`;
    };

    const parts = [ringToPath(outer)];
    for (const hole of holes ?? []) {
        const d = ringToPath(hole);
        if (d) parts.push(d);
    }

    return parts.filter(Boolean).join(" ");
}

export function makeSvgPathForObject(
    object: Pick<PolyObject, "points" | "holes" | "bulges" | "corners">,
    transform?: PointTransform
) {
    return makeSvgPathFromRings(
        getObjectOuterRenderPoints(object),
        object.holes,
        transform
    );
}
