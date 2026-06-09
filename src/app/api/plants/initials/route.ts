/**
 * GET /api/plants/initials
 *
 * Returns the distinct first letters of botanical_name for all plants that
 * match the supplied filter parameters. Used by the alphabet filter bar in
 * the plant catalogue to determine which letters have results.
 *
 * Accepts the same filter query parameters as GET /api/plants, but ignores
 * page / limit / sort — all matching rows are always considered.
 *
 * Response shape: { initials: string[] }   e.g. { initials: ["A","B","C","R","S"] }
 */

import { NextRequest, NextResponse } from "next/server";
import { queryPlantInitials, type PlantInitialCount } from "@/lib/db/plantQueries";
import type { PlantQueryParams, PlantAppGroup } from "@/lib/db/plantTypes";

const VALID_APP_GROUPS = new Set<PlantAppGroup>([
    "bodembedekkers",
    "vaste-planten",
    "hagen",
    "heesters-struiken",
    "bomen",
    "overig",
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = request.nextUrl;

        const q = searchParams.get("q") ?? undefined;

        const rawAppGroup = searchParams.get("appGroup");
        const appGroup: PlantAppGroup | undefined =
            rawAppGroup && VALID_APP_GROUPS.has(rawAppGroup as PlantAppGroup)
                ? (rawAppGroup as PlantAppGroup)
                : undefined;

        const standplaatsen = searchParams.getAll("standplaats");
        const grondsoorten = searchParams.getAll("grondsoort");
        const bloeiperiodes = searchParams.getAll("bloeiperiode");
        const kleuren = searchParams.getAll("kleur");
        const categories = searchParams.getAll("category");

        const inheemsRaw = searchParams.get("inheems");
        const inheems =
            inheemsRaw === "true"
                ? true
                : inheemsRaw === "false"
                    ? false
                    : undefined;

        const inStockOnly = searchParams.get("inStockOnly") === "true";

        const rawMinHeight = searchParams.get("minHeightCm");
        const rawMaxHeight = searchParams.get("maxHeightCm");
        const minHeightCm = rawMinHeight ? (parseInt(rawMinHeight, 10) || undefined) : undefined;
        const maxHeightCm = rawMaxHeight ? (parseInt(rawMaxHeight, 10) || undefined) : undefined;

        const keurmerken = searchParams.getAll("keurmerk");

        const rawKeurmerkFilter = searchParams.get("keurmerkFilter");
        const keurmerkFilter: "alleen-met-keurmerk" | "alleen-zonder-keurmerk" | undefined =
            rawKeurmerkFilter === "alleen-met-keurmerk" || rawKeurmerkFilter === "alleen-zonder-keurmerk"
                ? rawKeurmerkFilter
                : undefined;

        const params: PlantQueryParams = {
            q,
            appGroup,
            standplaatsen: standplaatsen.length > 0 ? standplaatsen : undefined,
            grondsoorten: grondsoorten.length > 0 ? grondsoorten : undefined,
            bloeiperiodes: bloeiperiodes.length > 0 ? bloeiperiodes : undefined,
            kleuren: kleuren.length > 0 ? kleuren : undefined,
            categories: categories.length > 0 ? categories : undefined,
            inheems,
            inStockOnly,
            keurmerkFilter,
            keurmerken: keurmerken.length > 0 ? keurmerken : undefined,
            minHeightCm,
            maxHeightCm,
        };

        const initials: PlantInitialCount[] = queryPlantInitials(params);

        return NextResponse.json(
            { initials },
            {
                status: 200,
                headers: {
                    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
                },
            }
        );
    } catch (err) {
        console.error("[/api/plants/initials] Error:", err);
        return NextResponse.json(
            { error: "Failed to query initials", detail: String(err) },
            { status: 500 }
        );
    }
}
