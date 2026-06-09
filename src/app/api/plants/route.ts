/**
 * GET /api/plants
 *
 * Returns a paginated, filtered list of plants from the local SQLite database.
 * The browser never talks directly to the feed — only to this endpoint.
 *
 * Query parameters (all optional):
 *
 *   q             string    Free text search on botanical name or Dutch name
 *   appGroup      string    UI tab: bodembedekkers | vaste-planten | heesters-struiken | bomen | overig
 *   standplaats   string[]  e.g. "zon"  (repeatable — multiple values are OR-ed)
 *   grondsoort    string[]  e.g. "zandgrond" (repeatable)
 *   bloeiperiode  string[]  e.g. "mei - juni" (repeatable)
 *   kleur         string[]  Flower colour, e.g. "wit" (repeatable)
 *   inheems       "true" | "false"
 *   inStockOnly   "true" | "false"
 *   page          number    1-based page number  (default: 1)
 *   limit         number    Items per page       (default: 48, max: 200)
 *
 * Response shape: ApiPlantsResponse (see plantTypes.ts)
 *
 * Example:
 *   /api/plants?appGroup=vaste-planten&standplaats=zon&page=1&limit=48
 */

import { NextRequest, NextResponse } from "next/server";
import { queryPlants } from "@/lib/db/plantQueries";
import type { PlantQueryParams, PlantAppGroup } from "@/lib/db/plantTypes";

// Valid app_group values — used to reject invalid input early
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

        // --- Parse and validate query parameters ---

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

        const rawSort = searchParams.get("sort");
        const sort: "a-z" | "z-a" | undefined =
            rawSort === "a-z" || rawSort === "z-a" ? rawSort : undefined;

        const rawInitialLetter = searchParams.get("initialLetter") ?? undefined;
        const initialLetter =
            rawInitialLetter && /^[A-Za-z]$/.test(rawInitialLetter)
                ? rawInitialLetter.toUpperCase()
                : undefined;

        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
        const limit = Math.min(
            200,
            Math.max(1, parseInt(searchParams.get("limit") ?? "48", 10) || 48)
        );

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
            sort,
            initialLetter,
            page,
            limit,
        };

        // --- Query the database ---
        const result = queryPlants(params);

        // --- Return response ---
        // Cache for 5 minutes on the client — data only changes after a sync
        return NextResponse.json(result, {
            status: 200,
            headers: {
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
            },
        });
    } catch (err) {
        console.error("[/api/plants] Error:", err);
        return NextResponse.json(
            { error: "Failed to query plants", detail: String(err) },
            { status: 500 }
        );
    }
}
