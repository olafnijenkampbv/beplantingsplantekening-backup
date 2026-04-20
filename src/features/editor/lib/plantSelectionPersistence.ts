import { DRAWINGS_STORAGE_KEY } from "@/features/editor/editorDrawingsPersistence";
import type {
    DummyPlant,
    PlantGroupKey,
    ViewMode,
} from "@/features/editor/lib/plantSelectionDummyData";
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

function sanitizePlant(value: unknown): DummyPlant | null {
    if (!value || typeof value !== "object") return null;

    const plant = value as DummyPlant;

    if (
        typeof plant.id !== "string" ||
        typeof plant.group !== "string" ||
        typeof plant.name !== "string" ||
        typeof plant.latinName !== "string" ||
        typeof plant.stockLabel !== "string" ||
        typeof plant.imageSrc !== "string"
    ) {
        return null;
    }

    return {
        ...plant,
        badge: typeof plant.badge === "string" ? plant.badge : undefined,
    };
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
        size: sanitizeOptionalString(raw.size, "15-20 cm C1"),
        note: sanitizeOptionalString(raw.note, ""),
        quantity:
            typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
                ? Math.max(0, raw.quantity)
                : 120,
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