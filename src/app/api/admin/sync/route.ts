/**
 * /api/admin/sync
 *
 * Manually triggers a full plant feed sync.
 * Protected by a secret key so only authorised requests can run it.
 *
 * Usage:
 *   POST https://yoursite.com/api/admin/sync
 *   Header:  x-sync-secret: <SYNC_SECRET from .env.local>
 *
 * Response (success):
 *   {
 *     "success": true,
 *     "plantsImported": 4821,
 *     "variantsImported": 18304,
 *     "skippedItems": 312,
 *     "durationMs": 7423
 *   }
 *
 * Response (error):
 *   { "success": false, "error": "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { syncPlantFeed } from "@/lib/db/feedSync";

// The secret is set in .env.local — never hard-code it here
const SYNC_SECRET = process.env.SYNC_SECRET ?? "";

export async function POST(request: NextRequest): Promise<NextResponse> {
    // --- Security check ---
    // Reject requests that don't carry the correct secret header
    if (!SYNC_SECRET) {
        return NextResponse.json(
            { success: false, error: "SYNC_SECRET environment variable is not configured" },
            { status: 500 }
        );
    }

    const providedSecret = request.headers.get("x-sync-secret") ?? "";
    if (providedSecret !== SYNC_SECRET) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    // --- Run the sync ---
    console.log("[sync] Starting plant feed sync...");
    const result = await syncPlantFeed();

    if (result.success) {
        console.log(
            `[sync] Done — ${result.plantsImported} plants, ` +
            `${result.variantsImported} variants, ` +
            `${result.skippedItems} skipped, ` +
            `${result.durationMs}ms`
        );
        return NextResponse.json(result, { status: 200 });
    } else {
        console.error("[sync] Failed:", result.error);
        return NextResponse.json(result, { status: 500 });
    }
}

// Disable GET so the route can't be triggered by accidentally visiting the URL
export async function GET(): Promise<NextResponse> {
    return NextResponse.json(
        { error: "Use POST to trigger a sync" },
        { status: 405 }
    );
}
