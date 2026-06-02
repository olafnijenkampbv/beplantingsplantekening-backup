/**
 * gardenMaterialTypes.ts
 *
 * TypeScript types for garden materials (tuinmaterialen).
 * Kept separate from plantTypes.ts — materials are not plants.
 */

// ---------------------------------------------------------------------------
// Database row types (server-only)
// ---------------------------------------------------------------------------

export type GardenMaterialRow = {
    id: string;           // trefnaam (SKU base)
    name: string;         // g:title from feed
    image_url: string;
    min_price: number;
    in_stock: number;     // 0 | 1
    updated_at: string;
};

export type GardenMaterialVariantRow = {
    id: string;
    material_id: string;
    size_label: string;
    price: number;
    availability: "in_stock" | "out_of_stock";
    updated_at: string;
};

// ---------------------------------------------------------------------------
// API types — what the browser receives from /api/garden-materials
// ---------------------------------------------------------------------------

export type ApiGardenMaterialVariant = {
    id: string;
    sizeLabel: string;
    price: number;
    availability: "in_stock" | "out_of_stock";
};

export type ApiGardenMaterial = {
    id: string;
    name: string;
    imageUrl: string;
    minPrice: number;
    inStock: boolean;
    variants: ApiGardenMaterialVariant[];
};

export type ApiGardenMaterialsResponse = {
    materials: ApiGardenMaterial[];
    total: number;
};
