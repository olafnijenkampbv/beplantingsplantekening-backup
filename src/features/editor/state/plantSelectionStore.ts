import { create } from "zustand";
import type { ApiPlant } from "@/lib/db/plantTypes";
import type { BulkPriceTier } from "@/lib/db/plantTypes";
import type {
    PlantGroupKey,
    ViewMode,
} from "@/features/editor/lib/plantSelectionDummyData";

export type PlantSelectionFiltersState = {
    opVoorraad: boolean;
    inheems: boolean;
};

export type PlantListItem = {
    id: string;
    plant: ApiPlant;
    size: string;
    fixedSize?: boolean;
    bulkPrices?: BulkPriceTier[];
    note: string;
    quantity: number;
    isSelected: boolean;
    /** Markeert items die via het AI-aanplant-hulpmiddelenadvies zijn toegevoegd, zodat ze in stap 7 verwijderbaar zijn. */
    addedFrom?: "accessory-advice";
    /** Het door AI aanbevolen aantal voor dit item (alleen bij addedFrom === "accessory-advice"). */
    adviceQuantity?: number;
    /** De door AI gegeven reden voor dit aanbevolen aantal (alleen bij addedFrom === "accessory-advice"). */
    adviceReason?: string;
};

export type PersistedPlantSelectionSnapshot = {
    selectedGroup: PlantGroupKey;
    viewMode: ViewMode;
    sortValue: string;
    filters: PlantSelectionFiltersState;
    plantListItems: PlantListItem[];
};

type PlantSelectionState = {
    selectedGroup: PlantGroupKey;
    viewMode: ViewMode;
    sortValue: string;
    filters: PlantSelectionFiltersState;
    isSummaryOpen: boolean;
    plantListItems: PlantListItem[];

    setSelectedGroup: (group: PlantGroupKey) => void;
    setViewMode: (mode: ViewMode) => void;
    setSortValue: (value: string) => void;
    toggleFilter: (key: keyof PlantSelectionFiltersState) => void;
    clearFilters: () => void;
    openSummary: () => void;
    closeSummary: () => void;

    addPlantToList: (plant: ApiPlant, size?: string, fixedSize?: boolean, bulkPrices?: BulkPriceTier[]) => void;
    setPlantListItems: (items: PlantListItem[]) => void;
    clearPlantList: () => void;

    exportSnapshot: () => PersistedPlantSelectionSnapshot;
    loadSnapshot: (snapshot: PersistedPlantSelectionSnapshot | null | undefined) => void;
    resetForNewDrawing: () => void;
};

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

function sanitizePlantListItems(value: unknown): PlantListItem[] {
    if (!Array.isArray(value)) return [];

    return value.filter((item): item is PlantListItem => {
        if (!item || typeof item !== "object") return false;
        const it = item as PlantListItem;
        return (
            typeof it.id === "string" &&
            !!it.plant &&
            typeof it.plant === "object" &&
            typeof it.plant.id === "string" &&
            typeof it.plant.botanicalName === "string" &&
            typeof it.size === "string" &&
            typeof it.note === "string" &&
            typeof it.quantity === "number" &&
            typeof it.isSelected === "boolean"
        );
    }).map((item) => ({
        ...item,
        bulkPrices: Array.isArray(item.bulkPrices) ? item.bulkPrices : [],
    }));
}

export function sanitizePlantSelectionSnapshot(
    value: unknown
): PersistedPlantSelectionSnapshot {
    const empty = createEmptyPlantSelectionSnapshot();

    const selectedGroup =
        value &&
            typeof value === "object" &&
            typeof (value as PersistedPlantSelectionSnapshot).selectedGroup === "string"
            ? (value as PersistedPlantSelectionSnapshot).selectedGroup
            : empty.selectedGroup;

    const viewMode =
        value &&
            typeof value === "object" &&
            (
                (value as PersistedPlantSelectionSnapshot).viewMode === "grid" ||
                (value as PersistedPlantSelectionSnapshot).viewMode === "list"
            )
            ? (value as PersistedPlantSelectionSnapshot).viewMode
            : empty.viewMode;

    const sortValue =
        value &&
            typeof value === "object" &&
            typeof (value as PersistedPlantSelectionSnapshot).sortValue === "string"
            ? (value as PersistedPlantSelectionSnapshot).sortValue
            : empty.sortValue;

    const rawFilters =
        value &&
            typeof value === "object" &&
            (value as PersistedPlantSelectionSnapshot).filters &&
            typeof (value as PersistedPlantSelectionSnapshot).filters === "object"
            ? (value as PersistedPlantSelectionSnapshot).filters
            : empty.filters;

    const plantListItems =
        value &&
            typeof value === "object"
            ? sanitizePlantListItems((value as PersistedPlantSelectionSnapshot).plantListItems)
            : empty.plantListItems;

    return {
        selectedGroup: selectedGroup as PlantGroupKey,
        viewMode,
        sortValue,
        filters: {
            opVoorraad: !!rawFilters.opVoorraad,
            inheems: !!rawFilters.inheems,
        },
        plantListItems,
    };
}

export const usePlantSelectionStore = create<PlantSelectionState>((set, get) => ({
    selectedGroup: "bodembedekkers",
    viewMode: "grid",
    sortValue: "",
    filters: {
        opVoorraad: false,
        inheems: false,
    },
    isSummaryOpen: false,
    plantListItems: [],

    setSelectedGroup: (group) => set({ selectedGroup: group }),
    setViewMode: (mode) => set({ viewMode: mode }),
    setSortValue: (value) => set({ sortValue: value }),
    toggleFilter: (key) =>
        set((state) => ({
            filters: {
                ...state.filters,
                [key]: !state.filters[key],
            },
        })),
    clearFilters: () =>
        set({
            filters: {
                opVoorraad: false,
                inheems: false,
            },
        }),
    openSummary: () => set({ isSummaryOpen: true }),
    closeSummary: () => set({ isSummaryOpen: false }),

    addPlantToList: (plant, size?, fixedSize?, bulkPrices?) =>
        set((state) => ({
            plantListItems: [
                ...state.plantListItems,
                {
                    id: `plant-list-${plant.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    plant,
                    size: size ?? "",
                    fixedSize: fixedSize ?? false,
                    bulkPrices: Array.isArray(bulkPrices) ? bulkPrices : [],
                    note: "",
                    quantity: 0,
                    isSelected: false,
                },
            ],
        })),

    setPlantListItems: (items) => set({ plantListItems: items }),
    clearPlantList: () => set({ plantListItems: [] }),

    exportSnapshot: () => {
        const state = get();

        return {
            selectedGroup: state.selectedGroup,
            viewMode: state.viewMode,
            sortValue: state.sortValue,
            filters: {
                ...state.filters,
            },
            plantListItems: state.plantListItems.map((item) => ({
                ...item,
                plant: { ...item.plant },
                bulkPrices: Array.isArray(item.bulkPrices) ? [...item.bulkPrices] : [],
            })),
        };
    },

    loadSnapshot: (snapshot) => {
        const safeSnapshot = sanitizePlantSelectionSnapshot(snapshot);

        set({
            selectedGroup: safeSnapshot.selectedGroup,
            viewMode: safeSnapshot.viewMode,
            sortValue: safeSnapshot.sortValue,
            filters: {
                ...safeSnapshot.filters,
            },
            plantListItems: safeSnapshot.plantListItems.map((item) => ({
                ...item,
                plant: { ...item.plant },
                bulkPrices: Array.isArray(item.bulkPrices) ? [...item.bulkPrices] : [],
            })),
            isSummaryOpen: false,
        });
    },

    resetForNewDrawing: () => {
        const empty = createEmptyPlantSelectionSnapshot();

        set({
            selectedGroup: empty.selectedGroup,
            viewMode: empty.viewMode,
            sortValue: empty.sortValue,
            filters: { ...empty.filters },
            plantListItems: [],
            isSummaryOpen: false,
        });
    },
}));
