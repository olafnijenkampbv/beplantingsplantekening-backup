/**
 * feedSync.ts
 *
 * Full sync pipeline for the Olaf Nijenkamp shopping feed:
 *   1. Fetch XML from the feed URL
 *   2. Parse XML into structured items  (feedParser.ts)
 *   3. Deduplicate: group all size variants under one plant per trefnaam
 *   4. Determine the UI group (app_group) for each plant
 *   5. Write everything to SQLite in a single atomic transaction
 *
 * This module is used by:
 *   - The manual sync API route  (/api/admin/sync)
 *   - The nightly cron job (fase 5)
 *
 * Performance notes:
 *   - The full feed (~50 000 items) loads in ~2 seconds over the network
 *   - XML parsing takes ~1-2 seconds server-side
 *   - SQLite transaction write takes ~1-3 seconds
 *   - Total expected sync time: 5-10 seconds
 */

import { getPlantDb } from "./plantDatabase";
import { parseFeedXml, type ParsedFeedItem } from "./feedParser";
import type { PlantAppGroup } from "./plantTypes";

// Internal type that includes tuinmaterialen (not a PlantAppGroup — those go to garden_materials)
type InternalAppGroup = PlantAppGroup | "tuinmaterialen";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FEED_URL = "https://olaf-nijenkamp.nl/shopping_feed_assortiment";

// Safety guard: if the feed returns fewer than this many plants,
// the response is probably empty or corrupt — skip the database write.
const MIN_PLANTS_THRESHOLD = 50;

// Retry settings for the network fetch
const FETCH_MAX_ATTEMPTS = 3;
const FETCH_INITIAL_DELAY_MS = 10_000; // 10 s → 20 s → done

// ---------------------------------------------------------------------------
// Public result type — returned after every sync so callers know what happened
// ---------------------------------------------------------------------------

export type SyncResult = {
    success: boolean;
    plantsImported: number;       // unique plants written to `plants` table
    variantsImported: number;     // size variants written to `plant_variants`
    materialsImported: number;    // unique materials written to `garden_materials`
    skippedItems: number;         // feed items that had no trefnaam / kenmerken
    durationMs: number;
    error?: string;               // only present when success === false
};

// ---------------------------------------------------------------------------
// Internal: one group = one unique plant + all its size variants
// ---------------------------------------------------------------------------

type PlantGroup = {
    representative: ParsedFeedItem;  // provides plant-level fields (name, image, etc.)
    variants: ParsedFeedItem[];      // every size / partij for this plant
    minPrice: number;                // cheapest in-stock price (fallback: cheapest overall)
    inStock: boolean;                // true if at least one variant is in_stock
    keurmerken: Set<string>;         // unique certifications found across all variants
    additionalImageUrls: string[];   // extra productfoto's (uniek, zelfde voor alle varianten)
};

// ---------------------------------------------------------------------------
// Step 1 — Fetch the raw XML from the feed URL
// ---------------------------------------------------------------------------

async function fetchFeedXml(): Promise<string> {
    const response = await fetch(FEED_URL, {
        headers: { Accept: "application/xml, text/xml, */*" },
        // Bypass Next.js fetch cache — we always want fresh data during a sync
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(
            `Feed request failed: HTTP ${response.status} ${response.statusText}`
        );
    }

    return response.text();
}

// ---------------------------------------------------------------------------
// Helper: retry fetchFeedXml up to maxAttempts times with exponential backoff
// ---------------------------------------------------------------------------

async function fetchFeedXmlWithRetry(
    maxAttempts: number,
    initialDelayMs: number
): Promise<string> {
    let lastError: Error | null = null;
    let delayMs = initialDelayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fetchFeedXml();
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));

            if (attempt < maxAttempts) {
                console.warn(
                    `[sync] Fetch poging ${attempt}/${maxAttempts} mislukt: ${lastError.message}. ` +
                    `Volgende poging over ${delayMs / 1000}s...`
                );
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                delayMs *= 2;
            }
        }
    }

    throw new Error(
        `Feed niet bereikbaar na ${maxAttempts} pogingen. Laatste fout: ${lastError?.message ?? "onbekend"}`
    );
}

// ---------------------------------------------------------------------------
// Helper: write one row to sync_log (best-effort — never throws)
// ---------------------------------------------------------------------------

function writeSyncLog(
    result: SyncResult,
    startedAt: string,
    finishedAt: string
): void {
    try {
        const db = getPlantDb();
        db.prepare(`
            INSERT INTO sync_log
                (started_at, finished_at, success, plants_imported,
                 variants_imported, skipped_items, duration_ms, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            startedAt,
            finishedAt,
            result.success ? 1 : 0,
            result.plantsImported,
            result.variantsImported,
            result.skippedItems,
            result.durationMs,
            result.error ?? null
        );
    } catch (err) {
        // Logging failure must never mask the actual sync result
        console.error("[sync] sync_log schrijven mislukt:", err);
    }
}

// ---------------------------------------------------------------------------
// Helper: parse "volwassen_hoogte" text to an integer cm value (the maximum)
//
// Examples:
//   "30 cm"       → 30
//   "40-60 cm"    → 60    (range: take the upper bound)
//   "150-200 cm"  → 200
//   "2-3 m"       → 300   (metres × 100)
//   "10-15 m"     → 1500
//   "onbekend"    → 0     (no numeric value found)
// ---------------------------------------------------------------------------

function parseMaxHeightCm(raw: string): number {
    if (!raw) return 0;
    const lower = raw.toLowerCase().trim();

    // Detect metres: standalone "m", "meter" or "meters" present, but no "cm"
    const inMeters = /\b(?:meter|meters|m)\b/.test(lower) && !lower.includes("cm");

    // Extract every number (including decimals with . or ,)
    const matches = lower.match(/\d+(?:[.,]\d+)?/g);
    if (!matches || matches.length === 0) return 0;

    // For a range like "80-100", take the larger value (upper bound)
    const maxNum = Math.max(...matches.map((n) => parseFloat(n.replace(",", "."))));
    if (!Number.isFinite(maxNum) || maxNum <= 0) return 0;

    return inMeters ? Math.round(maxNum * 100) : Math.round(maxNum);
}

// ---------------------------------------------------------------------------
// Step 2 — Group all parsed items by trefnaam
//
// Each unique trefnaam (e.g. "RHICGRAN") represents one plant.
// Multiple items share the same trefnaam but have different maten / partijen.
// ---------------------------------------------------------------------------

function groupByTrefnaam(items: ParsedFeedItem[]): Map<string, PlantGroup> {
    const groups = new Map<string, PlantGroup>();

    for (const item of items) {
        const existing = groups.get(item.trefnaam);

        if (!existing) {
            // First time we see this trefnaam — create the group
            const keurmerken = new Set<string>();
            if (item.keurmerken) keurmerken.add(item.keurmerken);
            groups.set(item.trefnaam, {
                representative: item,
                variants: [item],
                minPrice: item.price > 0 ? item.price : Infinity,
                inStock: item.availability === "in_stock",
                keurmerken,
                additionalImageUrls: [...item.additionalImageUrls],
            });
        } else {
            // Add this variant to the existing group
            existing.variants.push(item);

            if (item.availability === "in_stock") {
                existing.inStock = true;
            }

            // If the current representative has no image, promote this item
            if (!existing.representative.imageUrl && item.imageUrl) {
                existing.representative = item;
            }

            // Collect all unique keurmerken across variants
            if (item.keurmerken) existing.keurmerken.add(item.keurmerken);

            // Merge extra afbeeldingen (dedupliceren op URL)
            for (const url of item.additionalImageUrls) {
                if (url && !existing.additionalImageUrls.includes(url)) {
                    existing.additionalImageUrls.push(url);
                }
            }
        }
    }

    // Second pass — calculate the definitive min_price for each group.
    // Priority: cheapest in-stock price. Fallback: cheapest overall price.
    for (const group of groups.values()) {
        const inStockPrices = group.variants
            .filter((v) => v.availability === "in_stock" && v.price > 0)
            .map((v) => v.price);

        if (inStockPrices.length > 0) {
            group.minPrice = Math.min(...inStockPrices);
        } else {
            const allPrices = group.variants
                .filter((v) => v.price > 0)
                .map((v) => v.price);
            group.minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
        }
    }

    return groups;
}

// ---------------------------------------------------------------------------
// Step 3 — Map a feed category to the UI app_group used in the plant sidebar
//
// The feed uses free-text categories (e.g. "Rhododendrons boskwaliteit").
// The app sidebar has four fixed tabs: bodembedekkers, vaste-planten,
// heesters-struiken, bomen.  "bodembedekkers" is handled separately later
// via Planthoeveelheid_per_m2 and height — for now they fall under
// vaste-planten and can be filtered client-side.
// ---------------------------------------------------------------------------

function getAppGroup(primaryCategory: string): InternalAppGroup {
    const cat = primaryCategory.toLowerCase().trim();

    // --- Bomen ---
    if (
        cat.startsWith("bomen") ||
        cat.startsWith("dak") ||          // "Dak, lei- & vormbomen" and variants
        cat.startsWith("meerstammig") ||
        cat.startsWith("bonsai") ||
        cat.startsWith("fruit")
    ) {
        return "bomen";
    }

    // --- Hagen ---
    if (cat.includes("haag")) {
        return "hagen";
    }

    // --- Tuinmaterialen ---
    if (cat.startsWith("tuinmaterialen")) {
        return "tuinmaterialen";
    }

    // --- Heesters & struiken ---
    if (
        cat.startsWith("heesters") ||
        cat.startsWith("coniferen") ||
        cat.startsWith("klimplanten") ||
        cat.startsWith("rhododendron") ||
        cat.startsWith("ericaceae") ||
        cat.startsWith("rozen") ||
        cat.startsWith("bosplantsoen")    // woodland shrubs/trees — overig would hide them from tabs
    ) {
        return "heesters-struiken";
    }

    // --- Vaste planten ---
    if (
        cat.startsWith("vaste planten") ||
        cat.startsWith("bloembollen") ||
        cat.startsWith("vijverplanten") ||
        cat.startsWith("perkgoed")
    ) {
        return "vaste-planten";
    }

    // --- Catch-all (visible in zoek-zelf, not in a category tab) ---
    return "overig";
}

// ---------------------------------------------------------------------------
// Step 4 — Write plant groups to SQLite in a single atomic transaction
//
// We do a full replace on every sync:
//   • DELETE all existing plants and variants
//   • INSERT everything fresh
//
// This keeps the data clean (no stale rows) and is safe because the whole
// operation is wrapped in one transaction — if anything fails, nothing changes.
// ---------------------------------------------------------------------------

type WriteResult = {
    plantsImported: number;
    variantsImported: number;
    materialsImported: number;
};

function writeToDatabase(
    groups: Map<string, PlantGroup>,
    nowIso: string
): WriteResult {
    const db = getPlantDb();

    // Prepare statements once — reusing them is 10-50× faster than re-parsing SQL
    const insertPlant = db.prepare(`
        INSERT OR REPLACE INTO plants (
            id, botanical_name, dutch_name, category, app_group,
            standplaats, grondsoort, bloeiperiode, kleur_bloem, kleur_blad,
            volwassen_hoogte, max_height_cm, planthoeveelheid_per_m2,
            inheems, stikstofbehoefte, toelichting, image_url, additional_image_urls,
            min_price, in_stock, keurmerken, updated_at
        ) VALUES (
            @id, @botanical_name, @dutch_name, @category, @app_group,
            @standplaats, @grondsoort, @bloeiperiode, @kleur_bloem, @kleur_blad,
            @volwassen_hoogte, @max_height_cm, @planthoeveelheid_per_m2,
            @inheems, @stikstofbehoefte, @toelichting, @image_url, @additional_image_urls,
            @min_price, @in_stock, @keurmerken, @updated_at
        )
    `);

    const insertVariant = db.prepare(`
        INSERT OR REPLACE INTO plant_variants (
            id, plant_id, size_label, price, availability, bulk_prices, updated_at
        ) VALUES (
            @id, @plant_id, @size_label, @price, @availability, @bulk_prices, @updated_at
        )
    `);

    const insertMaterial = db.prepare(`
        INSERT OR REPLACE INTO garden_materials (
            id, name, image_url, min_price, in_stock, subcategory, updated_at
        ) VALUES (
            @id, @name, @image_url, @min_price, @in_stock, @subcategory, @updated_at
        )
    `);

    const insertMaterialVariant = db.prepare(`
        INSERT OR REPLACE INTO garden_material_variants (
            id, material_id, size_label, price, availability, updated_at
        ) VALUES (
            @id, @material_id, @size_label, @price, @availability, @updated_at
        )
    `);

    // Everything inside db.transaction runs atomically.
    const runTransaction = db.transaction((): WriteResult => {
        // Full refresh — clear old data first
        db.prepare("DELETE FROM plant_variants").run();
        db.prepare("DELETE FROM plants").run();
        db.prepare("DELETE FROM garden_material_variants").run();
        db.prepare("DELETE FROM garden_materials").run();

        let plantsImported = 0;
        let variantsImported = 0;
        let materialsImported = 0;

        for (const [trefnaam, group] of groups) {
            const rep = group.representative;
            const appGroup = getAppGroup(rep.primaryCategory);

            if (appGroup === "tuinmaterialen") {
                // Write to garden_materials / garden_material_variants
                insertMaterial.run({
                    id: trefnaam,
                    name: rep.botanicalName,
                    image_url: rep.imageUrl,
                    min_price: group.minPrice,
                    in_stock: group.inStock ? 1 : 0,
                    subcategory: rep.subcategory || "Overig",
                    updated_at: nowIso,
                });
                materialsImported++;

                for (const variant of group.variants) {
                    insertMaterialVariant.run({
                        id: variant.productId,
                        material_id: trefnaam,
                        size_label: variant.sizeLabel,
                        price: variant.price,
                        availability: variant.availability,
                        updated_at: nowIso,
                    });
                }
            } else {
                // Write to plants / plant_variants
                insertPlant.run({
                    id: trefnaam,
                    botanical_name: rep.botanicalName,
                    dutch_name: rep.dutchName,
                    category: rep.primaryCategory,
                    app_group: appGroup,
                    standplaats: rep.standplaats,
                    grondsoort: rep.grondsoort,
                    bloeiperiode: rep.bloeiperiode,
                    kleur_bloem: rep.kleurBloem,
                    kleur_blad: rep.kleurBlad,
                    volwassen_hoogte: rep.volwassenHoogte,
                    max_height_cm: parseMaxHeightCm(rep.volwassenHoogte),
                    planthoeveelheid_per_m2: rep.planthoeveelheidPerM2,
                    inheems: rep.inheems ? 1 : 0,
                    stikstofbehoefte: rep.stikstofbehoefte,
                    toelichting: rep.toelichting,
                    image_url: rep.imageUrl,
                    additional_image_urls: JSON.stringify(group.additionalImageUrls),
                    min_price: group.minPrice,
                    in_stock: group.inStock ? 1 : 0,
                    keurmerken: [...group.keurmerken].join(", "),
                    updated_at: nowIso,
                });
                plantsImported++;

                for (const variant of group.variants) {
                    insertVariant.run({
                        id: variant.productId,
                        plant_id: trefnaam,
                        size_label: variant.sizeLabel,
                        price: variant.price,
                        availability: variant.availability,
                        bulk_prices: JSON.stringify(variant.bulkPrices),
                        updated_at: nowIso,
                    });
                    variantsImported++;
                }
            }
        }

        return { plantsImported, variantsImported, materialsImported };
    });

    return runTransaction();
}

// ---------------------------------------------------------------------------
// Main export — run a complete sync and return a result summary
// ---------------------------------------------------------------------------

export async function syncPlantFeed(): Promise<SyncResult> {
    const startMs = Date.now();
    const startedAt = new Date().toISOString();

    let result: SyncResult;

    try {
        // 1. Fetch — retries up to FETCH_MAX_ATTEMPTS times before giving up.
        //    If the feed is unreachable on all attempts, the database is never
        //    touched and the existing plant data stays intact.
        const xml = await fetchFeedXmlWithRetry(
            FETCH_MAX_ATTEMPTS,
            FETCH_INITIAL_DELAY_MS
        );

        // 2. Parse — items without trefnaam / kenmerken are filtered out
        const totalRaw = xml.match(/<item>/g)?.length ?? 0;
        const items = parseFeedXml(xml);
        const skippedItems = totalRaw - items.length;

        // 3. Minimum-items guard — a suspiciously small feed (empty response,
        //    maintenance page, partial download) must never wipe the database.
        if (items.length < MIN_PLANTS_THRESHOLD) {
            throw new Error(
                `Feed bevat slechts ${items.length} planten (minimum: ${MIN_PLANTS_THRESHOLD}). ` +
                `Database niet bijgewerkt — bestaande data blijft intact.`
            );
        }

        // 4. Deduplicate variants → unique plants
        const groups = groupByTrefnaam(items);

        // 5. Write to database (atomic transaction — rolls back on any error)
        const nowIso = new Date().toISOString();
        const { plantsImported, variantsImported, materialsImported } = writeToDatabase(groups, nowIso);

        result = {
            success: true,
            plantsImported,
            variantsImported,
            materialsImported,
            skippedItems,
            durationMs: Date.now() - startMs,
        };
    } catch (err) {
        result = {
            success: false,
            plantsImported: 0,
            variantsImported: 0,
            materialsImported: 0,
            skippedItems: 0,
            durationMs: Date.now() - startMs,
            error: err instanceof Error ? err.message : String(err),
        };
    }

    // Always log the outcome — so the sync-status endpoint has something to show
    writeSyncLog(result, startedAt, new Date().toISOString());
    return result;
}
