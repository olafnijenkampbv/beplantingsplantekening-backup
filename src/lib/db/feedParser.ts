/**
 * feedParser.ts
 *
 * Parses the Olaf Nijenkamp shopping feed XML (Google Shopping / RSS format)
 * into structured JavaScript objects ready for SQLite insertion.
 *
 * Feed format key facts (verified against live feed):
 *  - Root:          <rss xmlns:g="http://base.google.com/ns/1.0">
 *  - Each product:  <item> inside <channel>
 *  - Grouping key:  <trefnaam>  — same value for all size variants of one plant
 *  - Botanical name:<g:title>   — e.g. "Rhododendron 'Cunningham's White'"
 *  - Image:         <g:image_link>
 *  - Price:         <g:price>   — e.g. "43.60 EUR"
 *  - Availability:  <g:availability> — "in_stock" | "out_of_stock"
 *  - Size label:    <maatomschrijving> — e.g. "80-100 cm met kluit boskwaliteit"
 *  - Categories:    <plant_groepen>    — comma-separated, first is primary
 *  - Plant data:    <kenmerken>        — embedded JSON string
 *
 * Items without a <trefnaam> or without plant characteristics in <kenmerken>
 * are skipped (these are non-plant products such as garden materials).
 */

import { XMLParser } from "fast-xml-parser";
import type { BulkPriceTier } from "./plantTypes";

// ---------------------------------------------------------------------------
// Internal type: the JSON embedded in <kenmerken>
// All fields are optional — we handle missing values with safe defaults
// ---------------------------------------------------------------------------

type KenmerkenJson = {
    Nederlandse_naam?: string;
    Planthoeveelheid_per_m2?: string;
    Volwassen_hoogte?: string;
    Kleur_bloem?: string;
    Kleur_blad?: string;
    Bloeiperiode?: string;
    Inheems?: string;           // "ja" | "nee"
    Stikstofbehoefte?: string;
    Standplaats?: string;
    Grondsoort?: string;
    Toelichting?: string;
};

// ---------------------------------------------------------------------------
// Public type: one clean record per feed item, ready for the sync script
// ---------------------------------------------------------------------------

export type ParsedFeedItem = {
    // ---- variant level (goes into plant_variants table) ----
    productId: string;          // <g:id>
    trefnaam: string;           // <trefnaam>  — grouping key
    sizeLabel: string;          // <maatomschrijving>
    price: number;              // <g:price> parsed to float
    availability: "in_stock" | "out_of_stock";

    // ---- plant level (goes into plants table) ----
    botanicalName: string;      // <g:title>
    imageUrl: string;           // <g:image_link>
    primaryCategory: string;    // first value from <plant_groepen>
    allCategories: string;      // full <plant_groepen> string (for reference)

    // ---- from <kenmerken> JSON ----
    dutchName: string;                  // Nederlandse_naam
    planthoeveelheidPerM2: number;      // Planthoeveelheid_per_m2
    volwassenHoogte: string;            // Volwassen_hoogte
    kleurBloem: string;                 // Kleur_bloem
    kleurBlad: string;                  // Kleur_blad
    bloeiperiode: string;               // Bloeiperiode
    inheems: boolean;                   // Inheems === "ja"
    stikstofbehoefte: string;           // Stikstofbehoefte
    standplaats: string;                // Standplaats
    grondsoort: string;                 // Grondsoort
    toelichting: string;                // Toelichting

    // ---- from <keurmerken> XML field ----
    keurmerken: string;                 // e.g. "MPS-A" | "" (single value per variant)

    // ---- from <g:bulk_price> blokken ----
    bulkPrices: BulkPriceTier[];        // staffelprijzen, gesorteerd op minQty
};

// ---------------------------------------------------------------------------
// XML parser instance
// Created once and reused — XMLParser is stateless after construction
// ---------------------------------------------------------------------------

const XML_PARSER = new XMLParser({
    ignoreAttributes: true,     // no XML attributes needed
    parseTagValue: false,       // keep all values as raw strings (we parse manually)
    trimValues: true,           // strip leading/trailing whitespace from values
    // Ensure <item> is always an array even when there is only 1 product.
    // Ensure <g:bulk_price> is always an array so multiple staffeltiers per item werken.
    isArray: (_name: string, jpath: unknown) =>
        jpath === "rss.channel.item" ||
        jpath === "rss.channel.item.g:bulk_price",
});

// ---------------------------------------------------------------------------
// Helper: safely convert any XML value to a trimmed string
// ---------------------------------------------------------------------------

function str(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

// De feed levert prijzen inclusief BTW (laag tarief 9%).
// De website en de app tonen prijzen exclusief BTW — dus delen door 1,09.
// Controle: €127,53 ÷ 1,09 = €117,00 ✓
const BTW_DIVISOR = 1.09;

// ---------------------------------------------------------------------------
// Helper: parse "127.53 EUR" → 117.00 (excl. 9% BTW)
// ---------------------------------------------------------------------------

function parsePrice(raw: string): number {
    // Strip everything that is not a digit or decimal point
    const numeric = raw.replace(/[^\d.]/g, "");
    const value = parseFloat(numeric);
    if (!Number.isFinite(value) || value < 0) return 0;
    // Round to 2 decimals to avoid floating-point drift
    return Math.round((value / BTW_DIVISOR) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Helper: parse the <kenmerken> JSON field safely
// Returns an empty object if the field is absent or invalid JSON
// ---------------------------------------------------------------------------

function parseKenmerken(raw: string): KenmerkenJson {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null) {
            return parsed as KenmerkenJson;
        }
        return {};
    } catch {
        // Invalid JSON — skip silently, the item will be filtered out later
        return {};
    }
}

// ---------------------------------------------------------------------------
// Helper: "Rhododendrons boskwaliteit, Rhododendrons" → "Rhododendrons boskwaliteit"
// The first (most specific) category is used as primary
// ---------------------------------------------------------------------------

function getPrimaryCategory(plantGroepen: string): string {
    if (!plantGroepen) return "";
    const first = plantGroepen.split(",")[0];
    return first ? first.trim() : "";
}

// ---------------------------------------------------------------------------
// Helper: parse Planthoeveelheid_per_m2 safely ("6" → 6, invalid → 1)
// ---------------------------------------------------------------------------

function parsePlanthoeveelheid(raw: string | undefined): number {
    if (!raw) return 1;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
}

// ---------------------------------------------------------------------------
// Helper: parse <g:bulk_price> blokken naar staffeltiers
//
// De parser levert een array van objecten:
//   [{ min_quantity: "25", price: "0.32 EUR" }, ...]
// Lege of ongeldige elementen worden overgeslagen.
// ---------------------------------------------------------------------------

function parseBulkPrices(raw: unknown): BulkPriceTier[] {
    if (!Array.isArray(raw)) return [];
    const tiers: BulkPriceTier[] = [];
    for (const bp of raw) {
        if (typeof bp !== "object" || bp === null) continue;
        const bpObj = bp as Record<string, unknown>;
        const minQty = parseInt(str(bpObj["min_quantity"]), 10);
        const price = parsePrice(str(bpObj["price"]));
        if (Number.isFinite(minQty) && minQty > 0 && price > 0) {
            tiers.push({ minQty, price });
        }
    }
    return tiers.sort((a, b) => a.minQty - b.minQty);
}

// ---------------------------------------------------------------------------
// Main export: parse the full XML string, return all valid plant items
// ---------------------------------------------------------------------------

export function parseFeedXml(xml: string): ParsedFeedItem[] {
    // Parse the entire XML document
    const doc = XML_PARSER.parse(xml) as {
        rss?: {
            channel?: {
                item?: Record<string, unknown>[];
            };
        };
    };

    const rawItems = doc?.rss?.channel?.item ?? [];
    const results: ParsedFeedItem[] = [];

    for (const item of rawItems) {
        // --- Required fields: skip if missing ---
        const productId = str(item["g:id"]);
        const trefnaam = str(item["trefnaam"]);

        if (!productId || !trefnaam) continue;

        // --- Categories ---
        const allCategories = str(item["plant_groepen"]);

        // Tuinmaterialen worden herkend via plant_groepen (ook als secundaire categorie)
        const isTuinmateriaal = allCategories.split(",").some(
            (c) => c.trim().toLowerCase() === "tuinmaterialen"
        );

        // --- Parse plant characteristics ---
        const kenmerken = parseKenmerken(str(item["kenmerken"]));

        // Skip non-plant products that are not explicitly tuinmaterialen
        if (!kenmerken.Nederlandse_naam && !isTuinmateriaal) continue;

        // --- Availability ---
        const availability: "in_stock" | "out_of_stock" =
            str(item["g:availability"]) === "in_stock"
                ? "in_stock"
                : "out_of_stock";

        // Tuinmaterialen gebruiken g:title als naam (geen Nederlandse_naam in kenmerken)
        const title = str(item["g:title"]);

        results.push({
            // Variant level
            productId,
            trefnaam,
            sizeLabel: str(item["maatomschrijving"]),
            price: parsePrice(str(item["g:price"])),
            availability,

            // Plant level
            botanicalName: isTuinmateriaal ? title : str(item["g:title"]),
            imageUrl: str(item["g:image_link"]),
            // Tuinmaterialen altijd als primaire categorie "Tuinmaterialen" zodat
            // getAppGroup() ze correct naar app_group "tuinmaterialen" mapt
            primaryCategory: isTuinmateriaal ? "Tuinmaterialen" : getPrimaryCategory(allCategories),
            allCategories,

            // From kenmerken JSON (leeg voor tuinmaterialen)
            dutchName: kenmerken.Nederlandse_naam ?? (isTuinmateriaal ? title : ""),
            planthoeveelheidPerM2: parsePlanthoeveelheid(kenmerken.Planthoeveelheid_per_m2),
            volwassenHoogte: kenmerken.Volwassen_hoogte ?? "",
            kleurBloem: kenmerken.Kleur_bloem ?? "",
            kleurBlad: kenmerken.Kleur_blad ?? "",
            bloeiperiode: kenmerken.Bloeiperiode ?? "",
            inheems: (kenmerken.Inheems ?? "nee").toLowerCase() === "ja",
            stikstofbehoefte: kenmerken.Stikstofbehoefte ?? "",
            standplaats: kenmerken.Standplaats ?? "",
            grondsoort: kenmerken.Grondsoort ?? "",
            toelichting: kenmerken.Toelichting ?? "",

            // From <keurmerken> XML field
            keurmerken: str(item["keurmerken"]),

            // Staffelprijzen uit <g:bulk_price> blokken
            bulkPrices: parseBulkPrices(item["g:bulk_price"]),
        });
    }

    return results;
}
