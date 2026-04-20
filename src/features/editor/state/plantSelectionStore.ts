import { create } from "zustand";
import type {
    DummyPlant,
    PlantGroupKey,
    ViewMode,
} from "@/features/editor/lib/plantSelectionDummyData";

export type PlantSelectionFiltersState = {
    opVoorraad: boolean;
    inheems: boolean;
};

export type PlantListItem = {
    id: string;
    plant: DummyPlant;
    size: string;
    note: string;
    quantity: number;
    isSelected: boolean;
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

    addPlantToList: (plant: DummyPlant) => void;
    setPlantListItems: (items: PlantListItem[]) => void;
    clearPlantList: () => void;
};

export const usePlantSelectionStore = create<PlantSelectionState>((set) => ({
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

    addPlantToList: (plant) =>
        set((state) => ({
            plantListItems: [
                ...state.plantListItems,
                {
                    id: `plant-list-${plant.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    plant,
                    size: "15-20 cm C1",
                    note: "",
                    quantity: 120,
                    isSelected: false,
                },
            ],
        })),

    setPlantListItems: (items) => set({ plantListItems: items }),
    clearPlantList: () => set({ plantListItems: [] }),
}));