import { PolyObject } from "@/state/projectStore";

export type CompassDirection = "noord" | "oost" | "zuid" | "west";

export type PersistedDrawingSnapshot = {
    objects: PolyObject[];
    plantbedLinks: Record<string, string[]>;
    distributionOverrides?: Record<string, Record<string, number>>;
    viewVisibility: {
        showPlantNumbers: boolean;
        showAreaLabels: boolean;
        showGround: boolean;
        showBuildings: boolean;
        showBoundaries: boolean;
        showPlantbeds: boolean;
        showTreebeds: boolean;
    };
    nextPlantbedNo: number;
    compassDirection: CompassDirection;
};

export type PersistedDrawingDocument = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    schemaVersion: number;
    snapshot: PersistedDrawingSnapshot;
    budget?: number;
};

export const DRAWINGS_STORAGE_KEY = "hello-editor:drawings:v1";
export const DRAWING_SCHEMA_VERSION = 1;

export const DEFAULT_DRAWING_VIEW_VISIBILITY: PersistedDrawingSnapshot["viewVisibility"] = {
    showPlantNumbers: true,
    showAreaLabels: true,
    showGround: true,
    showBuildings: true,
    showBoundaries: true,
    showPlantbeds: true,
    showTreebeds: true,
};

export function clonePolyObject(obj: PolyObject): PolyObject {
    return {
        ...obj,
        points: [...obj.points],
        holes: obj.holes?.map((hole) => [...hole]),
        renderPieces: obj.renderPieces?.map((piece) => [...piece]),
    };
}

export function clonePlantbedLinks(links: Record<string, string[]> = {}) {
    return Object.fromEntries(
        Object.entries(links).map(([plantbedId, plantIds]) => [plantbedId, [...plantIds]])
    );
}

export function createEmptyDrawingSnapshot(): PersistedDrawingSnapshot {
    return {
        objects: [],
        plantbedLinks: {},
        distributionOverrides: {},
        viewVisibility: { ...DEFAULT_DRAWING_VIEW_VISIBILITY },
        nextPlantbedNo: 1,
        compassDirection: "noord",
    };
}

export function cloneDrawingSnapshot(
    snapshot: PersistedDrawingSnapshot
): PersistedDrawingSnapshot {
    return {
        objects: snapshot.objects.map(clonePolyObject),
        plantbedLinks: clonePlantbedLinks(snapshot.plantbedLinks),
        distributionOverrides: snapshot.distributionOverrides
            ? Object.fromEntries(
                Object.entries(snapshot.distributionOverrides).map(([objectId, overrides]) => [
                    objectId,
                    { ...overrides },
                ])
            )
            : {},
        viewVisibility: {
            ...DEFAULT_DRAWING_VIEW_VISIBILITY,
            ...(snapshot.viewVisibility ?? {}),
        },
        nextPlantbedNo: snapshot.nextPlantbedNo ?? 1,
        compassDirection: snapshot.compassDirection ?? "noord",
    };
}

export function sanitizeDrawingSnapshot(value: any): PersistedDrawingSnapshot {
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

    const rawDistributionOverrides =
        value?.distributionOverrides && typeof value.distributionOverrides === "object"
            ? value.distributionOverrides
            : {};

    const sanitizedDistributionOverrides: Record<string, Record<string, number>> = {};
    for (const [objectId, overrides] of Object.entries(rawDistributionOverrides)) {
        if (!overrides || typeof overrides !== "object") continue;
        const sanitizedOverrides: Record<string, number> = {};
        for (const [plantId, percentage] of Object.entries(overrides as Record<string, unknown>)) {
            if (typeof percentage === "number" && Number.isFinite(percentage)) {
                sanitizedOverrides[plantId] = percentage;
            }
        }
        if (Object.keys(sanitizedOverrides).length > 0) {
            sanitizedDistributionOverrides[objectId] = sanitizedOverrides;
        }
    }

    return {
        objects: rawObjects.map((obj: PolyObject) => clonePolyObject(obj)),
        plantbedLinks: clonePlantbedLinks(rawPlantbedLinks),
        distributionOverrides: sanitizedDistributionOverrides,
        viewVisibility: {
            ...DEFAULT_DRAWING_VIEW_VISIBILITY,
            ...rawViewVisibility,
        },
        nextPlantbedNo: rawNextPlantbedNo,
        compassDirection: rawCompassDirection,
    };
}

export function sanitizeDrawingDocument(value: any): PersistedDrawingDocument | null {
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
        budget: typeof value.budget === "number" && value.budget >= 0 ? value.budget : undefined,
    };
}

export function getValidPlantbedIdsFromObjects(objects: PolyObject[]) {
    return new Set(
        objects
            .filter(
                (obj) =>
                    obj.type === "plantbed" ||
                    obj.type === "hedge" ||
                    obj.type === "treebed"
            )
            .map((obj) => obj.id)
    );
}

export function sanitizePlantbedLinksForObjects(
    links: Record<string, string[]>,
    objects: PolyObject[]
) {
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
}

export function buildPlantbedLinkedCountFromLinks(links: Record<string, string[]>) {
    return Object.fromEntries(
        Object.entries(links).map(([plantbedId, plantIds]) => [
            plantbedId,
            Array.isArray(plantIds) ? plantIds.length : 0,
        ])
    );
}

export function createDrawingDocument(
    name: string,
    budget?: number,
    snapshot?: PersistedDrawingSnapshot
): PersistedDrawingDocument {
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
        budget: budget ?? undefined,
    };
}

export function getCurrentDateTimeLabel(date: string | null): string {
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

export function getRelativeUpdatedAtLabel(date: string | null): string {
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