"use client";

/**
 * plantCatalogStore.ts
 *
 * Zustand store that manages the plant catalogue browser on the client side.
 * It fetches data from /api/plants (which reads from the local SQLite database)
 * and caches the result in memory while the user browses.
 *
 * Responsibilities:
 *  - Fetch and cache paginated plant lists
 *  - Manage filter state (appGroup, search, standplaats, grondsoort, etc.)
 *  - Expose helpers so the PlantSidebar only needs to call actions
 */

import { create } from "zustand";
import type { ApiPlant, ApiPlantsResponse, PlantAppGroup } from "@/lib/db/plantTypes";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

export type PlantCatalogFilters = {
    q: string;
    appGroup: PlantAppGroup | undefined;
    standplaatsen: string[];
    grondsoorten: string[];
    bloeiperiodes: string[];
    kleuren: string[];
    categories: string[];
    inheems: boolean | undefined;
    inStockOnly: boolean;
    minHeightCm: number | undefined;
    maxHeightCm: number | undefined;
    keurmerkFilter: "maakt-niet-uit" | "alleen-met-keurmerk" | "alleen-zonder-keurmerk" | undefined;
    keurmerken: string[];
    sort: "a-z" | "z-a" | undefined;
};

export const EMPTY_CATALOG_FILTERS: PlantCatalogFilters = {
    q: "",
    appGroup: undefined,
    standplaatsen: [],
    grondsoorten: [],
    bloeiperiodes: [],
    kleuren: [],
    categories: [],
    inheems: undefined,
    inStockOnly: false,
    minHeightCm: undefined,
    maxHeightCm: undefined,
    keurmerkFilter: undefined,
    keurmerken: [],
    sort: undefined,
};

// ---------------------------------------------------------------------------
// Store state + actions
// ---------------------------------------------------------------------------

type PlantCatalogState = {
    // --- Data ---
    plants: ApiPlant[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;

    // --- Request state ---
    isLoading: boolean;
    /** True once the first successful fetch has returned */
    hasFetched: boolean;
    error: string | null;

    // --- Filters ---
    filters: PlantCatalogFilters;

    // --- Actions ---
    fetchPlants: () => Promise<void>;
    loadMorePlants: () => Promise<void>;
    setAppGroup: (group: PlantAppGroup | undefined) => void;
    setSearch: (q: string) => void;
    setFilter: <K extends keyof PlantCatalogFilters>(
        key: K,
        value: PlantCatalogFilters[K]
    ) => void;
    setMultipleFilters: (partial: Partial<PlantCatalogFilters>) => void;
    clearFilters: () => void;
    goToPage: (page: number) => void;
};

// ---------------------------------------------------------------------------
// Helper: build the query string from current state
// ---------------------------------------------------------------------------

function buildApiUrl(
    filters: PlantCatalogFilters,
    page: number,
    limit: number
): string {
    const params = new URLSearchParams();

    if (filters.q) params.set("q", filters.q);
    if (filters.appGroup) params.set("appGroup", filters.appGroup);
    for (const v of filters.standplaatsen) params.append("standplaats", v);
    for (const v of filters.grondsoorten) params.append("grondsoort", v);
    for (const v of filters.bloeiperiodes) params.append("bloeiperiode", v);
    for (const v of filters.kleuren) params.append("kleur", v);
    for (const v of filters.categories) params.append("category", v);
    if (filters.inheems !== undefined) params.set("inheems", String(filters.inheems));
    if (filters.inStockOnly) params.set("inStockOnly", "true");
    if (filters.minHeightCm !== undefined) params.set("minHeightCm", String(filters.minHeightCm));
    if (filters.maxHeightCm !== undefined) params.set("maxHeightCm", String(filters.maxHeightCm));
    if (filters.keurmerkFilter && filters.keurmerkFilter !== "maakt-niet-uit")
        params.set("keurmerkFilter", filters.keurmerkFilter);
    for (const v of filters.keurmerken) params.append("keurmerk", v);
    if (filters.sort) params.set("sort", filters.sort);
    params.set("page", String(page));
    params.set("limit", String(limit));

    return `/api/plants?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let latestFetchRequestId = 0;

export const usePlantCatalogStore = create<PlantCatalogState>((set, get) => ({
    // --- Initial data state ---
    plants: [],
    total: 0,
    page: 1,
    limit: 48,
    totalPages: 1,

    // --- Initial request state ---
    isLoading: false,
    hasFetched: false,
    error: null,

    // --- Initial filters ---
    filters: { ...EMPTY_CATALOG_FILTERS },

    // ---------------------------------------------------------------------------
    // fetchPlants — call the API and store the result
    // ---------------------------------------------------------------------------
    fetchPlants: async () => {
        const { filters, page, limit } = get();
        const requestId = ++latestFetchRequestId;

        set({ isLoading: true, error: null });

        try {
            const url = buildApiUrl(filters, page, limit);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`API error ${response.status}: ${response.statusText}`);
            }

            const data: ApiPlantsResponse = await response.json();
            if (requestId !== latestFetchRequestId) return;

            set({
                plants: data.plants,
                total: data.total,
                page: data.page,
                limit: data.limit,
                totalPages: data.totalPages,
                isLoading: false,
                hasFetched: true,
                error: null,
            });
        } catch (err) {
            if (requestId !== latestFetchRequestId) return;
            set({
                isLoading: false,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    },

    // ---------------------------------------------------------------------------
    // loadMorePlants — fetch the next page and APPEND to existing plants list
    // Called when the user clicks "Meer laden" after the local batch is exhausted
    // ---------------------------------------------------------------------------
    loadMorePlants: async () => {
        const { page, totalPages, isLoading, filters, limit } = get();
        if (isLoading || page >= totalPages) return;

        set({ isLoading: true, error: null });

        try {
            const nextPage = page + 1;
            const url = buildApiUrl(filters, nextPage, limit);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`API error ${response.status}: ${response.statusText}`);
            }

            const data: ApiPlantsResponse = await response.json();

            set((state) => ({
                plants: [...state.plants, ...data.plants],  // append, don't replace
                total: data.total,
                page: data.page,
                limit: data.limit,
                totalPages: data.totalPages,
                isLoading: false,
                hasFetched: true,
                error: null,
            }));
        } catch (err) {
            set({
                isLoading: false,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    },

    // ---------------------------------------------------------------------------
    // setAppGroup — switch the active tab and refetch from page 1
    // ---------------------------------------------------------------------------
    setAppGroup: (group) => {
        set((state) => ({
            filters: { ...state.filters, appGroup: group },
            page: 1,
        }));
        get().fetchPlants();
    },

    // ---------------------------------------------------------------------------
    // setSearch — update the free-text query and refetch from page 1
    // ---------------------------------------------------------------------------
    setSearch: (q) => {
        set((state) => ({
            filters: { ...state.filters, q },
            page: 1,
        }));
        get().fetchPlants();
    },

    // ---------------------------------------------------------------------------
    // setFilter — update any single filter and refetch from page 1
    // ---------------------------------------------------------------------------
    setFilter: (key, value) => {
        set((state) => ({
            filters: { ...state.filters, [key]: value },
            page: 1,
        }));
        get().fetchPlants();
    },

    // ---------------------------------------------------------------------------
    // setMultipleFilters — update several filters in one state write, then refetch
    // ---------------------------------------------------------------------------
    setMultipleFilters: (partial) => {
        set((state) => ({
            filters: { ...state.filters, ...partial },
            page: 1,
        }));
        get().fetchPlants();
    },

    // ---------------------------------------------------------------------------
    // clearFilters — reset all filters except appGroup, then refetch
    // ---------------------------------------------------------------------------
    clearFilters: () => {
        set((state) => ({
            filters: {
                ...EMPTY_CATALOG_FILTERS,
                // Keep the active tab — user doesn't want to lose their category
                appGroup: state.filters.appGroup,
            },
            page: 1,
        }));
        get().fetchPlants();
    },

    // ---------------------------------------------------------------------------
    // goToPage — load a different page of results
    // ---------------------------------------------------------------------------
    goToPage: (page) => {
        set({ page });
        get().fetchPlants();
    },
}));
