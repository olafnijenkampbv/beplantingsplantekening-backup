/**
 * plantTypes.ts
 *
 * TypeScript types for the plant catalogue.
 *
 * PlantRow        — mirrors a row in the `plants` table
 * PlantVariantRow — mirrors a row in the `plant_variants` table
 * PlantWithVariants — plant + its variants combined (used in detail views)
 * ApiPlant        — the shape returned by /api/plants to the browser
 */

// ---------------------------------------------------------------------------
// Database row types (server-only)
// ---------------------------------------------------------------------------

export type PlantRow = {
    id: string;
    botanical_name: string;
    dutch_name: string;
    category: string;
    app_group: PlantAppGroup;
    standplaats: string;
    grondsoort: string;
    bloeiperiode: string;
    kleur_bloem: string;
    kleur_blad: string;
    volwassen_hoogte: string;
    max_height_cm: number;
    planthoeveelheid_per_m2: number;
    inheems: number;           // 0 | 1
    stikstofbehoefte: string;
    toelichting: string;
    image_url: string;
    additional_image_urls: string;  // JSON: string[] — extra productfoto's
    min_price: number;
    in_stock: number;          // 0 | 1
    keurmerken: string;        // comma-separated, e.g. "MPS-A" or ""
    updated_at: string;
};

export type BulkPriceTier = {
    minQty: number;   // minimum aantal voor deze prijs
    price: number;    // prijs excl. BTW
};

export type PlantVariantRow = {
    id: string;
    plant_id: string;
    size_label: string;
    price: number;
    availability: "in_stock" | "out_of_stock";
    bulk_prices: string;   // JSON: BulkPriceTier[] — staffelprijzen
    updated_at: string;
};

export type PlantWithVariants = PlantRow & {
    variants: PlantVariantRow[];
};

// ---------------------------------------------------------------------------
// App group — the four tabs in the plant sidebar
// ---------------------------------------------------------------------------

export type PlantAppGroup =
    | "bodembedekkers"
    | "vaste-planten"
    | "hagen"
    | "heesters-struiken"
    | "bomen"
    | "overig";           // catch-all for categories that don't fit the main tabs

// ---------------------------------------------------------------------------
// API response type — what the browser receives from /api/plants
// ---------------------------------------------------------------------------

export type ApiPlant = {
    id: string;
    botanicalName: string;       // scientific / trade name
    dutchName: string;           // Nederlandse naam
    category: string;            // original feed category
    appGroup: PlantAppGroup;
    standplaatsen: string[];     // ["zon", "halfschaduw"]
    grondsoorten: string[];      // ["zandgrond", "neutrale grond"]
    bloeiperiode: string;        // "mei - juni"
    kleuren: string[];           // flower colours: ["wit", "roze"]
    kleurBlad: string[];         // leaf colours
    volwassenHoogte: string;
    maxHeightCm: number;
    planthoeveelheidPerM2: number;
    inheems: boolean;
    stikstofbehoefte: string;
    toelichting: string;
    imageUrl: string;
    additionalImageUrls: string[];  // extra productfoto's naast de hoofdfoto
    pricePerPiece: number;       // min_price — used in cost estimates
    inStock: boolean;
    keurmerken: string[];        // e.g. ["MPS-A"] or []
};

// ---------------------------------------------------------------------------
// Query parameters accepted by /api/plants
// ---------------------------------------------------------------------------

export type PlantQueryParams = {
    q?: string;                  // free-text search on name
    appGroup?: PlantAppGroup;    // filter by sidebar tab
    standplaats?: string;        // single value (legacy)
    grondsoort?: string;         // single value (legacy)
    bloeiperiode?: string;       // single value (legacy)
    kleur?: string;              // single value (legacy)
    standplaatsen?: string[];    // multi-value OR — takes precedence over standplaats
    grondsoorten?: string[];     // multi-value OR — takes precedence over grondsoort
    bloeiperiodes?: string[];    // multi-value OR — takes precedence over bloeiperiode
    kleuren?: string[];          // multi-value OR — takes precedence over kleur
    categories?: string[];       // multi-value OR — matches the category column
    inheems?: boolean;
    inStockOnly?: boolean;
    keurmerkFilter?: "alleen-met-keurmerk" | "alleen-zonder-keurmerk";
    keurmerken?: string[];
    minHeightCm?: number;        // max_height_cm >= minHeightCm (0 = unknown excluded)
    maxHeightCm?: number;        // max_height_cm <= maxHeightCm (0 = unknown allowed)
    sort?: "a-z" | "z-a";        // alphabetical sort on botanical_name
    initialLetter?: string;     // filter to botanical_name starting with this letter (A-Z)
    page?: number;               // 1-based
    limit?: number;              // items per page, default 48
};

// ---------------------------------------------------------------------------
// Pagination envelope returned by /api/plants
// ---------------------------------------------------------------------------

export type ApiPlantsResponse = {
    plants: ApiPlant[];
    total: number;               // total matching records (for pagination)
    page: number;
    limit: number;
    totalPages: number;
};
