/**
 * GET /api/plants/[id]/variants
 *
 * Returns all available size variants (partijen) for one specific plant.
 * Used to populate the maat-dropdown when a plant is added to the plant list.
 *
 * Example:
 *   /api/plants/RHICGRAN/variants
 *
 * Response:
 *   [
 *     { "id": "159963", "plantId": "RHICGRAN", "sizeLabel": "80-100 cm met kluit boskwaliteit", "price": 43.60, "availability": "in_stock" },
 *     { "id": "159964", "plantId": "RHICGRAN", "sizeLabel": "100-125 cm met kluit boskwaliteit", "price": 51.78, "availability": "in_stock" },
 *     ...
 *   ]
 *
 * Variants are ordered by price ascending (cheapest first).
 */

import { NextRequest, NextResponse } from "next/server";
import { queryVariantsForPlant } from "@/lib/db/plantQueries";
import type { PlantVariantRow, BulkPriceTier } from "@/lib/db/plantTypes";

type RouteParams = { params: Promise<{ id: string }> };

// Map PlantVariantRow to a clean API shape
function variantToApiShape(row: PlantVariantRow) {
    let bulkPrices: BulkPriceTier[] = [];
    try {
        bulkPrices = JSON.parse(row.bulk_prices ?? "[]");
    } catch {
        bulkPrices = [];
    }
    return {
        id: row.id,
        plantId: row.plant_id,
        sizeLabel: row.size_label,
        price: row.price,
        availability: row.availability,
        bulkPrices,
    };
}

export async function GET(
    _request: NextRequest,
    { params }: RouteParams
): Promise<NextResponse> {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: "Plant id is required" },
                { status: 400 }
            );
        }

        const variants = queryVariantsForPlant(id);

        return NextResponse.json(
            variants.map(variantToApiShape),
            {
                status: 200,
                headers: {
                    // Variants don't change between syncs — cache for 5 minutes
                    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
                },
            }
        );
    } catch (err) {
        console.error("[/api/plants/[id]/variants] Error:", err);
        return NextResponse.json(
            { error: "Failed to query variants", detail: String(err) },
            { status: 500 }
        );
    }
}
