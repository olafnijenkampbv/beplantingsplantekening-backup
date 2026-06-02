"use client";

import { create } from "zustand";
import type {
    ApiGardenMaterial,
    ApiGardenMaterialsResponse,
} from "@/lib/db/gardenMaterialTypes";

type GardenMaterialCatalogState = {
    materials: ApiGardenMaterial[];
    total: number;
    isLoading: boolean;
    hasFetched: boolean;
    error: string | null;

    fetchMaterials: () => Promise<void>;
};

export const useGardenMaterialCatalogStore = create<GardenMaterialCatalogState>((set, get) => ({
    materials: [],
    total: 0,
    isLoading: false,
    hasFetched: false,
    error: null,

    fetchMaterials: async () => {
        const { isLoading, hasFetched } = get();
        if (isLoading || hasFetched) return;

        set({ isLoading: true, error: null });

        try {
            const response = await fetch("/api/garden-materials");

            if (!response.ok) {
                throw new Error(`API error ${response.status}: ${response.statusText}`);
            }

            const data: ApiGardenMaterialsResponse = await response.json();

            set({
                materials: data.materials,
                total: data.total,
                isLoading: false,
                hasFetched: true,
                error: null,
            });
        } catch (err) {
            set({
                isLoading: false,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    },
}));
