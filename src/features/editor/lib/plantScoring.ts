/**
 * plantScoring.ts
 *
 * Central scoring system for plant proposals.
 * Determines which label a plant gets (Zeer geschikt / Geschikt / Goede aanvulling)
 * based on how well it matches the wizard filters from steps 2-4.
 *
 * Two-layer system:
 *   1. Hard exclusion  — plant is not shown at all (handled in DB query / SQL)
 *   2. Soft scoring    — plant is shown but gets a label based on match quality
 *
 * Labels are assigned based on the total weighted score (0–100%):
 *   >= 75%  → Zeer geschikt
 *   40–74%  → Geschikt
 *   < 40%   → Goede aanvulling
 *   (plants below the minimum threshold are excluded entirely)
 */

import type { ApiPlant } from "@/lib/db/plantTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeightStyle = "laag-horizontaal" | "gelaagd-ruimtelijk" | "accent-op-hoogte" | null;

/** Which height group a plant falls into for the chosen heightStyle. */
export type HeightGroup = "primary" | "secondary" | "excluded" | "unknown";

/** Label assigned to a plant based on its total score. */
export type SuitabilityLabel = "zeer-geschikt" | "geschikt" | "goede-aanvulling";

/** All step data needed to score a plant. Extend this as more filters are implemented. */
export type ScoringInput = {
    heightStyle: HeightStyle;
    standplaatsen: string[];   // step2 — e.g. ["zon", "halfschaduw"]
    groundTypes: string[];     // step2 — e.g. ["zandgrond", "klei"]
};

// ---------------------------------------------------------------------------
// Height boundaries
// ---------------------------------------------------------------------------

/** Shared height boundaries (cm) used by both the SQL filter and the scoring logic. */
export const HEIGHT_BOUNDARIES = {
    LOW: 60,   // below this = laag
    HIGH: 150, // above this = hoog
} as const;

/**
 * Returns which height group a plant falls into for the given heightStyle.
 *
 * Group meanings:
 *   primary   — best fit for the chosen style (full score)
 *   secondary — acceptable addition (half score)
 *   excluded  — should not be shown (hard filter in SQL)
 *   unknown   — max_height_cm = 0, no data, treated as secondary
 */
export function getHeightGroup(maxHeightCm: number, heightStyle: HeightStyle): HeightGroup {
    if (maxHeightCm === 0) return "unknown";

    if (heightStyle === "laag-horizontaal") {
        if (maxHeightCm > HEIGHT_BOUNDARIES.HIGH) return "excluded";  // > 150cm
        if (maxHeightCm < HEIGHT_BOUNDARIES.LOW) return "primary";    // < 60cm
        return "secondary";                                            // 60–150cm
    }

    if (heightStyle === "accent-op-hoogte") {
        if (maxHeightCm < HEIGHT_BOUNDARIES.LOW) return "excluded";   // < 60cm
        if (maxHeightCm > HEIGHT_BOUNDARIES.HIGH) return "primary";   // > 150cm
        return "secondary";                                            // 60–150cm
    }

    if (heightStyle === "gelaagd-ruimtelijk") {
        if (maxHeightCm >= HEIGHT_BOUNDARIES.LOW && maxHeightCm <= HEIGHT_BOUNDARIES.HIGH) {
            return "primary";   // 60–150cm
        }
        return "secondary";     // < 60cm or > 150cm
    }

    // No heightStyle selected — all plants are primary
    return "primary";
}

// ---------------------------------------------------------------------------
// Scoring per filter dimension (0–100%)
// ---------------------------------------------------------------------------

/**
 * Score for standplaats: percentage of user's chosen standplaatsen that the plant supports.
 * Returns null if the user made no selection (filter not active).
 */
function scoreStandplaats(plant: ApiPlant, standplaatsen: string[]): number | null {
    if (standplaatsen.length === 0) return null;

    const plantStandplaatsen = plant.standplaatsen.map((s) => s.trim().toLowerCase());

    const matches = standplaatsen.filter((s) =>
        plantStandplaatsen.some((ps) => ps === s.toLowerCase())
    );

    return (matches.length / standplaatsen.length) * 100;
}

/**
 * Score for grondsoort: percentage of user's chosen grondsoorten that the plant supports.
 * Returns null if the user made no selection (filter not active).
 *
 * groundTypes uses step2 keys (e.g. "zandgrond"), plant.grondsoort uses display values
 * (e.g. "Zandgrond"). Comparison is case-insensitive.
 */
function scoreGrondsoort(plant: ApiPlant, groundTypes: string[]): number | null {
    if (groundTypes.length === 0) return null;

    const plantGrondsoorten = plant.grondsoorten.map((g) => g.toLowerCase());

    const matches = groundTypes.filter((g) =>
        plantGrondsoorten.some((pg) => pg.includes(g.toLowerCase()))
    );

    return (matches.length / groundTypes.length) * 100;
}

/**
 * Score for hoogtewerking:
 *   primary   → 100%
 *   secondary → 50%
 *   unknown   → 50% (no data, neutral)
 *   excluded  → 0%  (should not reach here due to SQL hard filter)
 * Returns null if no heightStyle is selected.
 */
function scoreHoogte(plant: ApiPlant, heightStyle: HeightStyle): number | null {
    if (!heightStyle) return null;

    const group = getHeightGroup(plant.maxHeightCm, heightStyle);

    if (group === "primary") return 100;
    if (group === "secondary") return 50;
    if (group === "unknown") return 50;
    return 0; // excluded
}

// ---------------------------------------------------------------------------
// Total score
// ---------------------------------------------------------------------------

/** Minimum score (%) for a plant to appear in the proposal at all. */
export const MIN_SCORE_THRESHOLD = 40;

/** Score >= this threshold gets "Zeer geschikt". */
const SCORE_ZEER_GESCHIKT = 75;

/** Score >= this threshold gets "Geschikt" (40–74% = "Goede aanvulling"). */
const SCORE_GESCHIKT = 60;

/**
 * Calculates the total suitability score (0–100%) for a plant.
 * Only active filters (where both user input and plant data exist) count.
 * Returns null if no filters are active at all.
 */
export function scorePlant(plant: ApiPlant, input: ScoringInput): number | null {
    const scores: number[] = [];

    const s = scoreStandplaats(plant, input.standplaatsen);
    if (s !== null) scores.push(s);

    const g = scoreGrondsoort(plant, input.groundTypes);
    if (g !== null) scores.push(g);

    const h = scoreHoogte(plant, input.heightStyle);
    if (h !== null) scores.push(h);

    // Future filters (onderhoudsniveau, seizoensbeleving, keurmerken) go here.

    if (scores.length === 0) return null;

    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * Returns the suitability label for a given score.
 * Returns null if the plant should not be shown (below threshold).
 */
export function getLabelForScore(score: number | null): SuitabilityLabel | null {
    if (score === null) return "zeer-geschikt"; // no filters active → show all as very suitable
    if (score < MIN_SCORE_THRESHOLD) return null; // below threshold → excluded
    if (score >= SCORE_ZEER_GESCHIKT) return "zeer-geschikt";
    if (score >= SCORE_GESCHIKT) return "geschikt";
    return "goede-aanvulling";
}
