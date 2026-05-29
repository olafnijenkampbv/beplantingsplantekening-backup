/**
 * plantDatabase.ts
 *
 * Central SQLite database module for the plant catalogue.
 * Manages the connection singleton and table initialisation.
 *
 * The database file lives at <project-root>/data/plants.db and is generated
 * by importing the shopping feed — it is never committed to version control.
 *
 * Two tables:
 *   plants         — one row per unique plant / cultivar
 *   plant_variants — one row per purchasable product (size × price)
 */

import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

// ---------------------------------------------------------------------------
// Path to the database file
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "plants.db");

// Ensure the data directory exists (first run)
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Singleton — one connection per process
// Prevents "too many connections" errors during Next.js hot-reload in dev
// ---------------------------------------------------------------------------

const globalForDb = globalThis as unknown as {
    _plantDb: Database.Database | undefined;
};

function openDatabase(): Database.Database {
    const db = new Database(DB_PATH);

    // WAL mode: faster writes, safe concurrent reads
    db.pragma("journal_mode = WAL");
    // Enforce foreign-key constraints
    db.pragma("foreign_keys = ON");

    return db;
}

function getDb(): Database.Database {
    if (!globalForDb._plantDb) {
        globalForDb._plantDb = openDatabase();
        initialiseSchema(globalForDb._plantDb);
    }
    return globalForDb._plantDb;
}

// ---------------------------------------------------------------------------
// Schema — called once when the database is first opened
// CREATE TABLE IF NOT EXISTS means this is always safe to run
// ---------------------------------------------------------------------------

function initialiseSchema(db: Database.Database): void {
    db.exec(`
        -- ----------------------------------------------------------------
        -- plants
        -- One row per unique plant / cultivar (grouped by SKU base).
        -- "min_price" is the lowest in-stock variant price and is used as
        -- the reference price in beplanting cost estimates.
        -- ----------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS plants (
            id                      TEXT    PRIMARY KEY,   -- SKU base, e.g. "RHICGRAN"
            botanical_name          TEXT    NOT NULL,       -- scientific / trade name
            dutch_name              TEXT    NOT NULL,       -- Nederlandse_naam
            category                TEXT    NOT NULL,       -- feed category, e.g. "Vaste planten"
            app_group               TEXT    NOT NULL,       -- mapped UI group: bodembedekkers | vaste-planten | heesters-struiken | bomen | overig
            standplaats             TEXT    NOT NULL DEFAULT '',  -- "zon", "halfschaduw", "schaduw" (comma-separated when multiple)
            grondsoort              TEXT    NOT NULL DEFAULT '',  -- comma-separated soil types
            bloeiperiode            TEXT    NOT NULL DEFAULT '',  -- e.g. "mei - juni"
            kleur_bloem             TEXT    NOT NULL DEFAULT '',  -- comma-separated colours
            kleur_blad              TEXT    NOT NULL DEFAULT '',
            volwassen_hoogte        TEXT    NOT NULL DEFAULT '',
            max_height_cm           INTEGER NOT NULL DEFAULT 0,   -- parsed from volwassen_hoogte; 0 = unknown
            planthoeveelheid_per_m2 INTEGER NOT NULL DEFAULT 1,
            inheems                 INTEGER NOT NULL DEFAULT 0,   -- 0 = nee, 1 = ja
            stikstofbehoefte        TEXT    NOT NULL DEFAULT '',
            toelichting             TEXT    NOT NULL DEFAULT '',
            image_url               TEXT    NOT NULL DEFAULT '',
            min_price               REAL    NOT NULL DEFAULT 0,   -- cheapest in-stock variant
            in_stock                INTEGER NOT NULL DEFAULT 0,   -- 1 if any variant is in_stock
            updated_at              TEXT    NOT NULL               -- ISO-8601 timestamp
        );

        -- ----------------------------------------------------------------
        -- plant_variants
        -- One row per purchasable product (a specific size of a plant).
        -- Multiple variants belong to one plant.
        -- ----------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS plant_variants (
            id           TEXT    PRIMARY KEY,               -- product ID from feed
            plant_id     TEXT    NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
            size_label   TEXT    NOT NULL DEFAULT '',       -- e.g. "80-100 cm met kluit boskwaliteit"
            price        REAL    NOT NULL DEFAULT 0,
            availability TEXT    NOT NULL DEFAULT 'out_of_stock',  -- "in_stock" | "out_of_stock"
            updated_at   TEXT    NOT NULL
        );

        -- ----------------------------------------------------------------
        -- sync_log
        -- One row per sync attempt (success or failure).
        -- Used to monitor the nightly cron job and diagnose issues.
        -- ----------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS sync_log (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at        TEXT    NOT NULL,
            finished_at       TEXT    NOT NULL,
            success           INTEGER NOT NULL DEFAULT 0,    -- 0 | 1
            plants_imported   INTEGER NOT NULL DEFAULT 0,
            variants_imported INTEGER NOT NULL DEFAULT 0,
            skipped_items     INTEGER NOT NULL DEFAULT 0,
            duration_ms       INTEGER NOT NULL DEFAULT 0,
            error             TEXT                           -- NULL when success = 1
        );

        -- ----------------------------------------------------------------
        -- Indexes for fast filtering and searching
        -- ----------------------------------------------------------------
        CREATE INDEX IF NOT EXISTS idx_plants_app_group   ON plants (app_group);
        CREATE INDEX IF NOT EXISTS idx_plants_in_stock    ON plants (in_stock);
        CREATE INDEX IF NOT EXISTS idx_plants_inheems     ON plants (inheems);
        CREATE INDEX IF NOT EXISTS idx_plants_dutch_name  ON plants (dutch_name COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_variants_plant_id  ON plant_variants (plant_id);
    `);

    // Migrations: add columns that were introduced after the initial schema
    const columns = db.prepare("PRAGMA table_info(plants)").all() as { name: string }[];
    if (!columns.some((c) => c.name === "max_height_cm")) {
        db.exec("ALTER TABLE plants ADD COLUMN max_height_cm INTEGER NOT NULL DEFAULT 0");
    }
    if (!columns.some((c) => c.name === "toelichting")) {
        db.exec("ALTER TABLE plants ADD COLUMN toelichting TEXT NOT NULL DEFAULT ''");
    }
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/** Returns the shared database connection, opening it if necessary. */
export function getPlantDb(): Database.Database {
    return getDb();
}

/** Convenience: check whether the plants table has any rows. */
export function isDatabasePopulated(): boolean {
    const db = getDb();
    const row = db.prepare("SELECT COUNT(*) as count FROM plants").get() as {
        count: number;
    };
    return row.count > 0;
}
