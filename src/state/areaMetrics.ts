import type { ObjectType, PolyObject } from "./projectStore";
import { AREA_MEASURABLE_OBJECT_TYPES } from "@/features/editor/components/editor/objectMenuConfig";
import { getBoundaryBandShape, isUnifiedBoundaryType } from "@/features/editor/lib/boundarySystem";
import { bulgedPolygonArea } from "@/features/editor/lib/bulgeMath";

export const EDITOR_METRIC_SCALE = {
    editorUnitsPerGridStep: 15,
    metersPerGridStep: 0.1,
} as const;

export const AREA_MEASURABLE_TYPES = AREA_MEASURABLE_OBJECT_TYPES;

const AREA_MEASURABLE_TYPE_SET = new Set<ObjectType>(AREA_MEASURABLE_TYPES);

export function isAreaMeasurableType(type: ObjectType): boolean {
    return AREA_MEASURABLE_TYPE_SET.has(type);
}

export function isAreaMeasurableObject(object: Pick<PolyObject, "type">): boolean {
    return isAreaMeasurableType(object.type);
}

export function getMetersPerGridStep(): number {
    return EDITOR_METRIC_SCALE.metersPerGridStep;
}

export function getEditorUnitsPerGridStep(): number {
    return EDITOR_METRIC_SCALE.editorUnitsPerGridStep;
}

export function getMetersPerEditorUnit(): number {
    return getMetersPerGridStep() / getEditorUnitsPerGridStep();
}

export function getMetersFromEditorUnits(units: number): number {
    return units * getMetersPerEditorUnit();
}

export function getSquareMetersPerEditorUnitSquared(): number {
    const metersPerUnit = getMetersPerEditorUnit();
    return metersPerUnit * metersPerUnit;
}

export function getSquareMetersFromEditorArea(editorArea: number): number {
    return editorArea * getSquareMetersPerEditorUnitSquared();
}

export function getPolygonSignedArea(points: number[]): number {
    if (!points || points.length < 6) return 0;

    let area = 0;
    const pointCount = points.length / 2;

    for (let i = 0; i < pointCount; i += 1) {
        const currentIndex = i * 2;
        const nextIndex = ((i + 1) % pointCount) * 2;

        const x1 = points[currentIndex];
        const y1 = points[currentIndex + 1];
        const x2 = points[nextIndex];
        const y2 = points[nextIndex + 1];

        area += x1 * y2 - x2 * y1;
    }

    return area / 2;
}

export function getPolygonAreaAbs(points: number[]): number {
    return Math.abs(getPolygonSignedArea(points));
}

export function getObjectAreaInEditorUnits(object: Pick<PolyObject, "type" | "points" | "holes" | "bulges">): number {
    if (!isAreaMeasurableObject(object)) return 0;
    if (!object.points || object.points.length < 4) return 0;

    if (isUnifiedBoundaryType(object.type)) {
        const shape = getBoundaryBandShape(object.points, object.type);

        if (!shape.outer || shape.outer.length < 6) return 0;

        const outerArea = getPolygonAreaAbs(shape.outer);
        const holesArea = (shape.holes ?? []).reduce((sum, hole) => sum + getPolygonAreaAbs(hole), 0);

        return Math.max(0, outerArea - holesArea);
    }

    if (object.points.length < 6) return 0;

    // ✅ BOGEN — boog-bewuste oppervlakteberekening
    const hasBulges = object.bulges?.some((b) => Math.abs(b) > 0.004);
    const outerArea = hasBulges
        ? bulgedPolygonArea(object.points, object.bulges!)
        : getPolygonAreaAbs(object.points);

    // Holes blijven recht in v1
    const holesArea = (object.holes ?? []).reduce((sum, hole) => sum + getPolygonAreaAbs(hole), 0);

    return Math.max(0, outerArea - holesArea);
}

export function getObjectAreaInSquareMeters(object: Pick<PolyObject, "type" | "points" | "holes" | "bulges">): number {
    return getSquareMetersFromEditorArea(getObjectAreaInEditorUnits(object));
}

export function getTotalAreaInEditorUnits(
    objects: Array<Pick<PolyObject, "type" | "points" | "holes">>
): number {
    return objects.reduce((sum, object) => sum + getObjectAreaInEditorUnits(object), 0);
}

export function getTotalAreaInSquareMeters(
    objects: Array<Pick<PolyObject, "type" | "points" | "holes">>
): number {
    return getSquareMetersFromEditorArea(getTotalAreaInEditorUnits(objects));
}

export function getSegmentLengthInEditorUnits(
    ax: number,
    ay: number,
    bx: number,
    by: number
): number {
    return Math.hypot(bx - ax, by - ay);
}

export function getSegmentLengthInMeters(
    ax: number,
    ay: number,
    bx: number,
    by: number
): number {
    return getMetersFromEditorUnits(getSegmentLengthInEditorUnits(ax, ay, bx, by));
}

export function getBoundingBoxFromPoints(points: number[]) {
    if (!points || points.length < 2) {
        return { x: 0, y: 0, w: 0, h: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return { x: 0, y: 0, w: 0, h: 0 };
    }

    return {
        x: minX,
        y: minY,
        w: Math.max(0, maxX - minX),
        h: Math.max(0, maxY - minY),
    };
}

export function getBoundingBoxDimensionsInMeters(points: number[]) {
    const bbox = getBoundingBoxFromPoints(points);

    return {
        widthMeters: getMetersFromEditorUnits(bbox.w),
        heightMeters: getMetersFromEditorUnits(bbox.h),
    };
}

export function formatMeters(valueInMeters: number, fractionDigits = 1): string {
    return `${valueInMeters.toFixed(fractionDigits)} m`;
}

export function formatSquareMeters(valueInSquareMeters: number, fractionDigits = 2): string {
    return `${valueInSquareMeters.toFixed(fractionDigits)} m²`;
}