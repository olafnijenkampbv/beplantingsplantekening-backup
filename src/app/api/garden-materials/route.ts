/**
 * GET /api/garden-materials
 *
 * Returns all garden materials (tuinmaterialen) with their variants.
 * Garden materials are not plants — they live in a separate table.
 *
 * Query parameters (all optional):
 *   q           string   Free-text search on name
 *   inStockOnly "true"   Only return materials with at least one in_stock variant
 *   sort        "a-z" | "z-a"
 *
 * Response shape: ApiGardenMaterialsResponse (see gardenMaterialTypes.ts)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPlantDb } from "@/lib/db/plantDatabase";
import type {
    ApiGardenMaterial,
    ApiGardenMaterialVariant,
    ApiGardenMaterialsResponse,
    GardenMaterialRow,
    GardenMaterialVariantRow,
} from "@/lib/db/gardenMaterialTypes";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = request.nextUrl;

        const q = (searchParams.get("q") ?? "").trim().toLowerCase();
        const inStockOnly = searchParams.get("inStockOnly") === "true";
        const rawSort = searchParams.get("sort");
        const sort: "a-z" | "z-a" | undefined =
            rawSort === "a-z" || rawSort === "z-a" ? rawSort : undefined;

        const db = getPlantDb();

        // Build WHERE clause
        const conditions: string[] = [];
        const bindings: (string | number)[] = [];

        if (q) {
            conditions.push("LOWER(m.name) LIKE ?");
            bindings.push(`%${q}%`);
        }
        if (inStockOnly) {
            conditions.push("m.in_stock = 1");
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const orderBy = sort === "z-a" ? "ORDER BY m.name DESC" : "ORDER BY m.name ASC";

        const materialRows = db
            .prepare<(string | number)[], GardenMaterialRow>(
                `SELECT m.id, m.name, m.image_url, m.min_price, m.in_stock, m.updated_at
                 FROM garden_materials m
                 ${where}
                 ${orderBy}`
            )
            .all(...bindings);

        if (materialRows.length === 0) {
            const response: ApiGardenMaterialsResponse = { materials: [], total: 0 };
            return NextResponse.json(response, { status: 200 });
        }

        // Fetch all variants for the matched materials in one query
        const ids = materialRows.map((m) => m.id);
        const placeholders = ids.map(() => "?").join(", ");
        const variantRows = db
            .prepare<string[], GardenMaterialVariantRow>(
                `SELECT id, material_id, size_label, price, availability, updated_at
                 FROM garden_material_variants
                 WHERE material_id IN (${placeholders})
                 ORDER BY price ASC`
            )
            .all(...ids);

        // Group variants by material_id
        const variantsByMaterial = new Map<string, ApiGardenMaterialVariant[]>();
        for (const v of variantRows) {
            const list = variantsByMaterial.get(v.material_id) ?? [];
            list.push({
                id: v.id,
                sizeLabel: v.size_label,
                price: v.price,
                availability: v.availability,
            });
            variantsByMaterial.set(v.material_id, list);
        }

        const materials: ApiGardenMaterial[] = materialRows.map((m) => ({
            id: m.id,
            name: m.name,
            imageUrl: m.image_url,
            minPrice: m.min_price,
            inStock: m.in_stock === 1,
            variants: variantsByMaterial.get(m.id) ?? [],
        }));

        const response: ApiGardenMaterialsResponse = {
            materials,
            total: materials.length,
        };

        return NextResponse.json(response, {
            status: 200,
            headers: {
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
            },
        });
    } catch (err) {
        console.error("[/api/garden-materials] Error:", err);
        return NextResponse.json(
            { error: "Failed to query garden materials", detail: String(err) },
            { status: 500 }
        );
    }
}
