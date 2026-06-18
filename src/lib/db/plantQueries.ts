/**
 * plantQueries.ts
 *
 * All SQLite query functions for the plant catalogue.
 * Kept separate from the API route so query logic can be reused
 * (e.g. in server components or other API routes in the future).
 *
 * All functions here are synchronous — better-sqlite3 is a sync driver.
 */

import { getPlantDb, isDatabasePopulated } from "./plantDatabase";
import type {
    PlantRow,
    PlantVariantRow,
    ApiPlant,
    ApiPlantsResponse,
    PlantQueryParams,
} from "./plantTypes";

// ---------------------------------------------------------------------------
// Helper: split a comma-separated db string into a clean array
// "zon, halfschaduw" → ["zon", "halfschaduw"]
// "" → []
// ---------------------------------------------------------------------------

function splitValues(raw: string): string[] {
    if (!raw) return [];
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Helper: convert one PlantRow (database) → ApiPlant (browser-safe JSON)
// ---------------------------------------------------------------------------

function rowToApiPlant(row: PlantRow): ApiPlant {
    return {
        id: row.id,
        botanicalName: row.botanical_name,
        dutchName: row.dutch_name,
        category: row.category,
        appGroup: row.app_group,
        standplaatsen: splitValues(row.standplaats),
        grondsoorten: splitValues(row.grondsoort),
        bloeiperiode: row.bloeiperiode,
        kleuren: splitValues(row.kleur_bloem),
        kleurBlad: splitValues(row.kleur_blad),
        volwassenHoogte: row.volwassen_hoogte,
        maxHeightCm: row.max_height_cm,
        planthoeveelheidPerM2: row.planthoeveelheid_per_m2,
        inheems: row.inheems === 1,
        stikstofbehoefte: row.stikstofbehoefte,
        toelichting: row.toelichting,
        imageUrl: row.image_url,
        additionalImageUrls: (() => {
            try { return JSON.parse(row.additional_image_urls ?? "[]") as string[]; }
            catch { return []; }
        })(),
        pricePerPiece: row.min_price,
        inStock: row.in_stock === 1,
        keurmerken: splitValues(row.keurmerken),
    };
}

// ---------------------------------------------------------------------------
// Helper: build a dynamic WHERE clause from the supplied filter params
// Returns the SQL fragment and the ordered list of bind values
// ---------------------------------------------------------------------------

type WhereClause = {
    sql: string;           // e.g. "WHERE app_group = ? AND in_stock = 1"
    bindings: unknown[];   // values matching each ? placeholder in order
};

function buildWhereClause(params: PlantQueryParams): WhereClause {
    const conditions: string[] = [];
    const bindings: unknown[] = [];

    // --- Tab / UI group ---
    if (params.appGroup) {
        conditions.push("app_group = ?");
        bindings.push(params.appGroup);
    }

    // --- Free text search: matches botanical name OR Dutch name ---
    // Split into tokens so "hydrangea pan lime" matches "Hydrangea pan. 'Limelight'"
    // Each token must appear somewhere in the name (AND logic, OR across both name fields).
    if (params.q && params.q.trim()) {
        const tokens = params.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
        for (const token of tokens) {
            conditions.push("(LOWER(botanical_name) LIKE ? OR LOWER(dutch_name) LIKE ?)");
            const like = `%${token}%`;
            bindings.push(like, like);
        }
    }

    // --- Standplaats: exact word match in comma-separated column ---
    // Comma-boundary trick: prepend/append "," to both sides so "schaduw"
    // does NOT match "halfschaduw". Spaces are stripped before comparing.
    if (params.standplaatsen && params.standplaatsen.length > 0) {
        const clauses = params.standplaatsen.map(
            () => "(',' || REPLACE(LOWER(standplaats), ' ', '') || ',' LIKE ?)"
        );
        conditions.push(`(${clauses.join(" OR ")})`);
        for (const v of params.standplaatsen) {
            bindings.push(`%,${v.toLowerCase().replace(/\s/g, "")},%`);
        }
    } else if (params.standplaats) {
        conditions.push("(',' || REPLACE(LOWER(standplaats), ' ', '') || ',' LIKE ?)");
        bindings.push(`%,${params.standplaats.toLowerCase().replace(/\s/g, "")},%`);
    }

    // --- Grondsoort ---
    if (params.grondsoorten && params.grondsoorten.length > 0) {
        conditions.push(`(${params.grondsoorten.map(() => "grondsoort LIKE ?").join(" OR ")})`);
        for (const v of params.grondsoorten) bindings.push(`%${v}%`);
    } else if (params.grondsoort) {
        conditions.push("grondsoort LIKE ?");
        bindings.push(`%${params.grondsoort}%`);
    }

    // --- Bloeiperiode ---
    if (params.bloeiperiodes && params.bloeiperiodes.length > 0) {
        conditions.push(`(${params.bloeiperiodes.map(() => "bloeiperiode LIKE ?").join(" OR ")})`);
        for (const v of params.bloeiperiodes) bindings.push(`%${v}%`);
    } else if (params.bloeiperiode) {
        conditions.push("bloeiperiode LIKE ?");
        bindings.push(`%${params.bloeiperiode}%`);
    }

    // --- Category (plantgroep) ---
    if (params.categories && params.categories.length > 0) {
        conditions.push(`(${params.categories.map(() => "category LIKE ?").join(" OR ")})`);
        for (const v of params.categories) bindings.push(`%${v}%`);
    }

    // --- Flower colour ---
    if (params.kleuren && params.kleuren.length > 0) {
        conditions.push(`(${params.kleuren.map(() => "kleur_bloem LIKE ?").join(" OR ")})`);
        for (const v of params.kleuren) bindings.push(`%${v}%`);
    } else if (params.kleur) {
        conditions.push("kleur_bloem LIKE ?");
        bindings.push(`%${params.kleur}%`);
    }

    // --- Inheems: exact boolean ---
    if (params.inheems !== undefined) {
        conditions.push("inheems = ?");
        bindings.push(params.inheems ? 1 : 0);
    }

    // --- Stock filter ---
    if (params.inStockOnly) {
        conditions.push("in_stock = 1");
        // No binding needed — literal value in SQL
    }

    // --- Keurmerk filter (wizard: met/zonder) ---
    if (params.keurmerkFilter === "alleen-met-keurmerk") {
        conditions.push("keurmerken != ''");
    } else if (params.keurmerkFilter === "alleen-zonder-keurmerk") {
        conditions.push("keurmerken = ''");
    }

    // --- Keurmerk filter (zoek-zelf: specifieke keurmerken, OR-logica) ---
    if (params.keurmerken && params.keurmerken.length > 0) {
        conditions.push(`(${params.keurmerken.map(() => "keurmerken LIKE ?").join(" OR ")})`);
        for (const k of params.keurmerken) bindings.push(`%${k}%`);
    }

    // --- Height filters ---
    // Plants where max_height_cm = 0 (unknown) are always included as a safe fallback,
    // so the list doesn't empty out before the next sync populates heights.
    if (params.maxHeightCm !== undefined) {
        conditions.push("(max_height_cm = 0 OR max_height_cm <= ?)");
        bindings.push(params.maxHeightCm);
    }
    if (params.minHeightCm !== undefined) {
        conditions.push("(max_height_cm = 0 OR max_height_cm >= ?)");
        bindings.push(params.minHeightCm);
    }

    // --- Initial letter filter ---
    if (params.initialLetter && params.initialLetter.length === 1) {
        conditions.push("UPPER(SUBSTR(botanical_name, 1, 1)) = ?");
        bindings.push(params.initialLetter.toUpperCase());
    }

    const sql =
        conditions.length > 0
            ? "WHERE " + conditions.join(" AND ")
            : "";

    return { sql, bindings };
}

// ---------------------------------------------------------------------------
// Primary query: paginated + filtered plant list
// ---------------------------------------------------------------------------

export function queryPlants(params: PlantQueryParams): ApiPlantsResponse {
    // Graceful response when the database has never been synced
    if (!isDatabasePopulated()) {
        return {
            plants: [],
            total: 0,
            page: 1,
            limit: params.limit ?? 48,
            totalPages: 0,
        };
    }

    const db = getPlantDb();
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 48));
    const offset = (page - 1) * limit;

    const { sql: whereSql, bindings } = buildWhereClause(params);

    // Count total matching rows first (needed for pagination UI)
    const countRow = db
        .prepare(`SELECT COUNT(*) as total FROM plants ${whereSql}`)
        .get(...bindings) as { total: number };
    const total = countRow.total;

    // Fetch the requested page
    const orderBy =
        params.sort === "z-a"
            ? "ORDER BY botanical_name DESC, dutch_name DESC"
            : "ORDER BY botanical_name ASC, dutch_name ASC";

    const rows = db
        .prepare(
            `SELECT * FROM plants
             ${whereSql}
             ${orderBy}
             LIMIT ? OFFSET ?`
        )
        .all(...bindings, limit, offset) as PlantRow[];

    return {
        plants: rows.map(rowToApiPlant),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
    };
}

// ---------------------------------------------------------------------------
// Initials query: distinct first letters of botanical_name matching the filters
// Used by the alphabet filter bar in the plant catalogue
// ---------------------------------------------------------------------------

export type PlantInitialCount = { letter: string; count: number };

export function queryPlantInitials(params: PlantQueryParams): PlantInitialCount[] {
    if (!isDatabasePopulated()) return [];

    const db = getPlantDb();
    const { sql: whereSql, bindings } = buildWhereClause(params);

    const rows = db
        .prepare(
            `SELECT UPPER(SUBSTR(botanical_name, 1, 1)) AS letter, COUNT(*) AS count
             FROM plants
             ${whereSql}
             GROUP BY letter
             ORDER BY letter ASC`
        )
        .all(...bindings) as { letter: string; count: number }[];

    return rows.filter((r) => r.letter >= "A" && r.letter <= "Z");
}

// ---------------------------------------------------------------------------
// Variants query: all size/price options for one specific plant
// Used to populate the maat-dropdown in the plant list (step 6)
// ---------------------------------------------------------------------------

export function queryVariantsForPlant(plantId: string): PlantVariantRow[] {
    const db = getPlantDb();

    return db
        .prepare(
            `SELECT * FROM plant_variants
             WHERE plant_id = ?
             ORDER BY price ASC`
        )
        .all(plantId) as PlantVariantRow[];
}

// ---------------------------------------------------------------------------
// Single plant lookup by id (trefnaam)
// ---------------------------------------------------------------------------

export function queryPlantById(id: string): ApiPlant | null {
    const db = getPlantDb();

    const row = db
        .prepare("SELECT * FROM plants WHERE id = ?")
        .get(id) as PlantRow | undefined;

    return row ? rowToApiPlant(row) : null;
}

// ---------------------------------------------------------------------------
// Sync log — last entry from the sync_log table
// ---------------------------------------------------------------------------

export type SyncLogEntry = {
    id: number;
    startedAt: string;
    finishedAt: string;
    success: boolean;
    plantsImported: number;
    variantsImported: number;
    skippedItems: number;
    durationMs: number;
    error: string | null;
};

export function getLastSyncEntry(): SyncLogEntry | null {
    const db = getPlantDb();

    const row = db
        .prepare(
            `SELECT id, started_at, finished_at, success,
                    plants_imported, variants_imported, skipped_items,
                    duration_ms, error
             FROM sync_log
             ORDER BY id DESC
             LIMIT 1`
        )
        .get() as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
        id: row.id as number,
        startedAt: row.started_at as string,
        finishedAt: row.finished_at as string,
        success: (row.success as number) === 1,
        plantsImported: row.plants_imported as number,
        variantsImported: row.variants_imported as number,
        skippedItems: row.skipped_items as number,
        durationMs: row.duration_ms as number,
        error: (row.error as string | null) ?? null,
    };
}

// ---------------------------------------------------------------------------
// Quick stats — used by the sync result display and health checks
// ---------------------------------------------------------------------------

export type CatalogStats = {
    totalPlants: number;
    totalVariants: number;
    lastUpdated: string | null;
};

export function queryCatalogStats(): CatalogStats {
    if (!isDatabasePopulated()) {
        return { totalPlants: 0, totalVariants: 0, lastUpdated: null };
    }

    const db = getPlantDb();

    const { totalPlants } = db
        .prepare("SELECT COUNT(*) as totalPlants FROM plants")
        .get() as { totalPlants: number };

    const { totalVariants } = db
        .prepare("SELECT COUNT(*) as totalVariants FROM plant_variants")
        .get() as { totalVariants: number };

    const { lastUpdated } = db
        .prepare("SELECT MAX(updated_at) as lastUpdated FROM plants")
        .get() as { lastUpdated: string | null };

    return { totalPlants, totalVariants, lastUpdated };
}
