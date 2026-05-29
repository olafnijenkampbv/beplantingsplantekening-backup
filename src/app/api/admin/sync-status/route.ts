/**
 * GET /api/admin/sync-status
 *
 * Returns the last sync log entry and current catalogue stats.
 * Protected by the same x-sync-secret header as the sync route.
 *
 * Usage:
 *   curl https://jouwsite.nl/api/admin/sync-status \
 *        -H "x-sync-secret: <SYNC_SECRET>"
 *
 * Response:
 *   {
 *     "lastSync": {
 *       "id": 42,
 *       "startedAt": "2025-05-29T02:00:01.234Z",
 *       "finishedAt": "2025-05-29T02:00:09.812Z",
 *       "success": true,
 *       "plantsImported": 4821,
 *       "variantsImported": 18304,
 *       "skippedItems": 312,
 *       "durationMs": 8578,
 *       "error": null
 *     },
 *     "stats": {
 *       "totalPlants": 4821,
 *       "totalVariants": 18304,
 *       "lastUpdated": "2025-05-29T02:00:09.500Z"
 *     }
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getLastSyncEntry, queryCatalogStats } from "@/lib/db/plantQueries";

const SYNC_SECRET = process.env.SYNC_SECRET ?? "";

export async function GET(request: NextRequest): Promise<NextResponse> {
    if (!SYNC_SECRET) {
        return NextResponse.json(
            { error: "SYNC_SECRET environment variable is not configured" },
            { status: 500 }
        );
    }

    const providedSecret = request.headers.get("x-sync-secret") ?? "";
    if (providedSecret !== SYNC_SECRET) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const lastSync = getLastSyncEntry();
    const stats = queryCatalogStats();

    return NextResponse.json({ lastSync, stats });
}
