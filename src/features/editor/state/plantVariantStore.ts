"use client";

/**
 * plantVariantStore.ts
 *
 * Lightweight cache for plant variants (sizes / partijen).
 * When a plant is added to the list, this store fetches the available maten
 * from /api/plants/[id]/variants and caches them so repeated opens of the
 * size-dropdown don't re-fetch.
 *
 * Usage:
 *   const { getVariants, fetchVariants } = usePlantVariantStore();
 *   await fetchVariants(plantId);
 *   const variants = getVariants(plantId); // ApiPlantVariant[]
 */

import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApiPlantVariant = {
    id: string;
    plantId: string;
    sizeLabel: string;
    price: number;
    availability: string;
};

type VariantFetchState = {
    status: "idle" | "loading" | "success" | "error";
    variants: ApiPlantVariant[];
    error: string | null;
};

type PlantVariantState = {
    /** keyed by plantId */
    cache: Record<string, VariantFetchState>;

    /** Get the cached variants for a plant (or empty array if not yet loaded) */
    getVariants: (plantId: string) => ApiPlantVariant[];

    /** Fetch variants for a plant — skips if already loaded or loading */
    fetchVariants: (plantId: string) => Promise<void>;

    /** Remove one entry from the cache (e.g. after a sync) */
    invalidate: (plantId: string) => void;

    /** Clear the entire cache (e.g. after a full sync) */
    invalidateAll: () => void;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePlantVariantStore = create<PlantVariantState>((set, get) => ({
    cache: {},

    getVariants: (plantId) => {
        return get().cache[plantId]?.variants ?? [];
    },

    fetchVariants: async (plantId) => {
        const existing = get().cache[plantId];

        // Skip if we already have data or are currently loading
        if (existing?.status === "loading" || existing?.status === "success") {
            return;
        }

        // Mark as loading
        set((state) => ({
            cache: {
                ...state.cache,
                [plantId]: { status: "loading", variants: [], error: null },
            },
        }));

        try {
            const response = await fetch(`/api/plants/${encodeURIComponent(plantId)}/variants`);

            if (!response.ok) {
                throw new Error(`API error ${response.status}: ${response.statusText}`);
            }

            const variants: ApiPlantVariant[] = await response.json();

            set((state) => ({
                cache: {
                    ...state.cache,
                    [plantId]: { status: "success", variants, error: null },
                },
            }));
        } catch (err) {
            set((state) => ({
                cache: {
                    ...state.cache,
                    [plantId]: {
                        status: "error",
                        variants: [],
                        error: err instanceof Error ? err.message : String(err),
                    },
                },
            }));
        }
    },

    invalidate: (plantId) => {
        set((state) => {
            const next = { ...state.cache };
            delete next[plantId];
            return { cache: next };
        });
    },

    invalidateAll: () => set({ cache: {} }),
}));
