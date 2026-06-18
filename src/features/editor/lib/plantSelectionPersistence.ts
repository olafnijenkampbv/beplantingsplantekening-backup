import { DRAWINGS_STORAGE_KEY } from "@/features/editor/editorDrawingsPersistence";
import type {
    PlantGroupKey,
    ViewMode,
} from "@/features/editor/lib/plantSelectionDummyData";
import type { ApiPlant } from "@/lib/db/plantTypes";
import type { BulkPriceTier } from "@/lib/db/plantTypes";
import type {
    PlantListItem,
    PlantSelectionFiltersState,
} from "@/features/editor/state/plantSelectionStore";

export type PersistedPlantSelectionSnapshot = {
    selectedGroup: PlantGroupKey;
    viewMode: ViewMode;
    sortValue: string;
    filters: PlantSelectionFiltersState;
    plantListItems: PlantListItem[];
};

export const PLANT_SELECTION_STORAGE_KEY = `${DRAWINGS_STORAGE_KEY}::plant-selection`;

export function createEmptyPlantSelectionSnapshot(): PersistedPlantSelectionSnapshot {
    return {
        selectedGroup: "bodembedekkers",
        viewMode: "grid",
        sortValue: "",
        filters: {
            opVoorraad: false,
            inheems: false,
        },
        plantListItems: [],
    };
}

function sanitizeBoolean(value: unknown, fallback = false): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function sanitizeOptionalString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
}

function sanitizePlant(value: unknown): ApiPlant | null {
    if (!value || typeof value !== "object") return null;

    const plant = value as Record<string, unknown>;

    if (
        typeof plant.id !== "string" ||
        typeof plant.botanicalName !== "string" ||
        typeof plant.dutchName !== "string" ||
        typeof plant.imageUrl !== "string"
    ) {
        return null;
    }

    return value as ApiPlant;
}

function sanitizeBulkPrices(value: unknown): BulkPriceTier[] {
    if (!Array.isArray(value)) return [];

    return value
        .map((tier) => {
            if (!tier || typeof tier !== "object") return null;
            const raw = tier as Record<string, unknown>;
            const minQty = typeof raw.minQty === "number" ? raw.minQty : Number(raw.minQty);
            const price = typeof raw.price === "number" ? raw.price : Number(raw.price);
            if (!Number.isFinite(minQty) || minQty <= 0 || !Number.isFinite(price) || price <= 0) {
                return null;
            }
            return { minQty, price };
        })
        .filter((tier): tier is BulkPriceTier => tier !== null)
        .sort((a, b) => a.minQty - b.minQty);
}

function sanitizePlantListItem(value: unknown): PlantListItem | null {
    if (!value || typeof value !== "object") return null;

    const raw = value as PlantListItem;
    const plant = sanitizePlant(raw.plant);
    if (!plant) return null;
    if (typeof raw.id !== "string") return null;

    return {
        id: raw.id,
        plant,
        size: sanitizeOptionalString(raw.size, ""),
        fixedSize: sanitizeBoolean(raw.fixedSize, false),
        bulkPrices: sanitizeBulkPrices(raw.bulkPrices),
        note: sanitizeOptionalString(raw.note, ""),
        quantity:
            typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
                ? Math.max(0, raw.quantity)
                : 0,
        isSelected: sanitizeBoolean(raw.isSelected, false),
    };
}

export function sanitizePlantSelectionSnapshot(
    value: unknown
): PersistedPlantSelectionSnapshot {
    const empty = createEmptyPlantSelectionSnapshot();

    const raw = value as PersistedPlantSelectionSnapshot | undefined;

    const selectedGroup =
        raw?.selectedGroup === "bodembedekkers" ||
            raw?.selectedGroup === "vaste-planten" ||
            raw?.selectedGroup === "heesters-struiken" ||
            raw?.selectedGroup === "bomen" ||
            raw?.selectedGroup === "zoek-zelf"
            ? raw.selectedGroup
            : empty.selectedGroup;

    const viewMode =
        raw?.viewMode === "grid" || raw?.viewMode === "list"
            ? raw.viewMode
            : empty.viewMode;

    const plantListItems = Array.isArray(raw?.plantListItems)
        ? raw.plantListItems
            .map(sanitizePlantListItem)
            .filter((item): item is PlantListItem => item !== null)
        : empty.plantListItems;

    return {
        selectedGroup,
        viewMode,
        sortValue: sanitizeOptionalString(raw?.sortValue, empty.sortValue),
        filters: {
            opVoorraad: sanitizeBoolean(raw?.filters?.opVoorraad, empty.filters.opVoorraad),
            inheems: sanitizeBoolean(raw?.filters?.inheems, empty.filters.inheems),
        },
        plantListItems,
    };
}

export function sanitizePlantSelectionSnapshotsByDrawingId(
    value: unknown
): Record<string, PersistedPlantSelectionSnapshot> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([drawingId, snapshot]) => [
            drawingId,
            sanitizePlantSelectionSnapshot(snapshot),
        ])
    );
}
