import type { ObjectType, PolyObject } from "@/state/projectStore";
import {
    getMetersFromEditorUnits,
    getObjectAreaInSquareMeters,
} from "@/state/areaMetrics";

export type ProjectPlantLike = {
    id: string;
    latin?: string;
    dutch?: string;
    name?: string;
    latinName?: string;
    botanicalName?: string;
    dutchName?: string;
    planthoeveelheidPerM2?: number | string | null;
    plantQuantityPerM2?: number | string | null;
    quantityPerSquareMeter?: number | string | null;
};

export type AdviceMeasurementMode = "area" | "length";

export type AdviceRow = {
    plantId: string;
    latinName: string;
    dutchName: string;
    distributionPercentage: number;
    assignedMeasureValue: number;
    quantityPerSquareMeter: number | null;
    adviceCount: number | null;
};

export type AdviceData = {
    measurementMode: AdviceMeasurementMode;
    totalMeasureValue: number;
    totalSquareMeters: number;
    totalAdviceCount: number;
    rows: AdviceRow[];
};

type HedgeOutlineSegment = {
    length: number;
};

export function parsePositiveNumber(value: unknown): number | null {
    if (typeof value === "number") {
        return Number.isFinite(value) && value > 0 ? value : null;
    }
    if (typeof value !== "string") return null;
    const normalized = value.trim().replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getPlantQuantityPerSquareMeter(
    projectPlant: ProjectPlantLike | undefined,
    _plantId: string
): number | null {
    return (
        parsePositiveNumber(projectPlant?.planthoeveelheidPerM2) ??
        parsePositiveNumber(projectPlant?.plantQuantityPerM2) ??
        parsePositiveNumber(projectPlant?.quantityPerSquareMeter) ??
        null
    );
}

export function getPlantDisplayNames(
    projectPlant: ProjectPlantLike | undefined,
    _plantId: string
): { latinName: string; dutchName: string } {
    return {
        latinName:
            projectPlant?.latin ??
            projectPlant?.name ??
            projectPlant?.botanicalName ??
            "Onbekende plant",
        dutchName:
            projectPlant?.dutch ??
            projectPlant?.latinName ??
            projectPlant?.dutchName ??
            "",
    };
}

function getHedgeOutlineSegments(points: number[]): HedgeOutlineSegment[] {
    if (!points || points.length < 6) return [];
    const segments: HedgeOutlineSegment[] = [];
    const pointCount = points.length / 2;
    for (let index = 0; index < pointCount; index += 1) {
        const currentIndex = index * 2;
        const nextIndex = ((index + 1) % pointCount) * 2;
        const ax = points[currentIndex];
        const ay = points[currentIndex + 1];
        const bx = points[nextIndex];
        const by = points[nextIndex + 1];
        const editorLength = Math.hypot(bx - ax, by - ay);
        const length = getMetersFromEditorUnits(editorLength);
        if (Number.isFinite(length) && length > 0.05) {
            segments.push({ length });
        }
    }
    return segments;
}

function getEstimatedHedgeWidthInMeters(segments: HedgeOutlineSegment[]): number | null {
    const sortedLengths = segments
        .map((segment) => segment.length)
        .filter((length) => Number.isFinite(length) && length > 0.05)
        .sort((a, b) => a - b);
    return sortedLengths[0] ?? null;
}

export function getEstimatedHedgeLengthInMeters(
    object: PolyObject,
    totalSquareMeters: number
): { hedgeLengthMeters: number; hedgeWidthMeters: number | null } {
    const segments = getHedgeOutlineSegments(object.points);
    const estimatedWidth = getEstimatedHedgeWidthInMeters(segments);
    if (!estimatedWidth || estimatedWidth <= 0 || segments.length === 0) {
        return { hedgeLengthMeters: totalSquareMeters, hedgeWidthMeters: null };
    }
    const widthSegmentThreshold = estimatedWidth * 1.8;
    const hedgeDirectionSegments = segments.filter(
        (segment) => segment.length > widthSegmentThreshold
    );
    const hedgeOutlineLength = hedgeDirectionSegments.reduce(
        (total, segment) => total + segment.length,
        0
    );
    const hedgeLengthMeters = hedgeOutlineLength / 2;
    return {
        hedgeLengthMeters: hedgeLengthMeters > 0 ? hedgeLengthMeters : totalSquareMeters,
        hedgeWidthMeters: estimatedWidth,
    };
}

export function buildAdviceData(params: {
    selectedObject: PolyObject;
    currentType: ObjectType;
    linkedPlantIds: string[];
    plants: ProjectPlantLike[];
    distributionOverrides?: Record<string, number>; // plantId -> percentage (0-100), som moet 100 zijn
}): AdviceData {
    const { selectedObject, currentType, linkedPlantIds, plants, distributionOverrides } = params;

    const totalSquareMeters = getObjectAreaInSquareMeters(selectedObject);
    const measurementMode: AdviceMeasurementMode = currentType === "hedge" ? "length" : "area";

    const hedgeMeasurement =
        measurementMode === "length"
            ? getEstimatedHedgeLengthInMeters(selectedObject, totalSquareMeters)
            : null;

    const totalMeasureValue =
        measurementMode === "length"
            ? hedgeMeasurement?.hedgeLengthMeters ?? totalSquareMeters
            : totalSquareMeters;

    const defaultDistribution = 100 / linkedPlantIds.length;

    // Normalize overrides so they always sum to 100 (e.g. after a plant is removed)
    let effectiveOverrides: Record<string, number> | undefined;
    if (distributionOverrides) {
        const relevantSum = linkedPlantIds.reduce(
            (sum, id) => sum + (distributionOverrides[id] ?? defaultDistribution),
            0
        );
        if (Math.abs(relevantSum - 100) > 0.5) {
            effectiveOverrides = Object.fromEntries(
                linkedPlantIds.map((id) => [
                    id,
                    ((distributionOverrides[id] ?? defaultDistribution) / relevantSum) * 100,
                ])
            );
        } else {
            effectiveOverrides = distributionOverrides;
        }
    }

    const isTreebed = currentType === "treebed";

    const rows: AdviceRow[] = linkedPlantIds.map((plantId) => {
        const projectPlant = plants.find((plant) => plant.id === plantId);
        const quantityPerSquareMeter = getPlantQuantityPerSquareMeter(projectPlant, plantId);

        const distributionPercentage =
            effectiveOverrides?.[plantId] ?? defaultDistribution;

        const assignedMeasureValue = totalMeasureValue * (distributionPercentage / 100);

        const assignedCalculationSquareMeters =
            measurementMode === "length" && hedgeMeasurement?.hedgeWidthMeters
                ? assignedMeasureValue * hedgeMeasurement.hedgeWidthMeters
                : totalSquareMeters * (distributionPercentage / 100);

        const adviceCount = isTreebed
            ? 1
            : quantityPerSquareMeter !== null
                ? Math.ceil(assignedCalculationSquareMeters * quantityPerSquareMeter)
                : null;

        return {
            plantId,
            ...getPlantDisplayNames(projectPlant, plantId),
            distributionPercentage,
            assignedMeasureValue,
            quantityPerSquareMeter,
            adviceCount,
        };
    });

    return {
        measurementMode,
        totalMeasureValue,
        totalSquareMeters,
        rows,
        totalAdviceCount: rows.reduce((total, row) => total + (row.adviceCount ?? 0), 0),
    };
}