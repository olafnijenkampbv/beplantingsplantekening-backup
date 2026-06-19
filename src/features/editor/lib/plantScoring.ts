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

export type PlantScoreExplanationItem = {
    label: string;
    score: number;
    value: string;
    preference: string;
    summary: string;
};

export type PlantScoreExplanation = {
    totalScore: number | null;
    label: SuitabilityLabel | null;
    intro: string;
    items: PlantScoreExplanationItem[];
};

/** All step data needed to score a plant. Extend this as more filters are implemented. */
export type ScoringInput = {
    heightStyle: HeightStyle;
    standplaatsen: string[];   // step2 — e.g. ["zon", "halfschaduw"]
    groundTypes: string[];     // step2 — e.g. ["zandgrond", "klei"]
    keurmerkFilter?: "maakt-niet-uit" | "alleen-met-keurmerk" | "alleen-zonder-keurmerk";
    keurmerken?: string[];
    structureStyle?: string | null;  // step3 — e.g. "gebalanceerd", "bloei-en-kleur"
    structureCustomPercentages?: {   // step3 vrij-samenstellen custom values
        bodembedekkers: number;
        vastePlanten: number;
        heestersEnStruiken: number;
        bomen: number;
    } | null;
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
        if (maxHeightCm <= HEIGHT_BOUNDARIES.LOW) return "primary";   // <= 60cm
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
 * Score for standplaats: full match when the plant supports at least one of
 * the user's chosen standplaatsen. The catalog filter also treats these choices
 * as OR conditions.
 * Returns null if the user made no selection (filter not active).
 */
function scoreStandplaats(plant: ApiPlant, standplaatsen: string[]): number | null {
    if (standplaatsen.length === 0) return null;

    const plantStandplaatsen = plant.standplaatsen.map((s) => s.trim().toLowerCase());

    const matches = standplaatsen.filter((s) =>
        plantStandplaatsen.some((ps) => ps === s.toLowerCase())
    );

    return matches.length > 0 ? 100 : 0;
}

/**
 * Maps step2 grondsoort keys to the display values used in the plant database.
 * Must stay in sync with STEP2_GRONDSOORT_TO_DB in the AI proposal route.
 */
const GRONDSOORT_KEY_TO_DB: Record<string, string> = {
    "zandgrond":            "zandgrond",
    "klei":                 "klei",
    "lichte-klei-zandleem": "lichte klei",
    "humusrijk-bosgrond":   "humusrijke grond",
    "veengrond-nat":        "veengrond",
};

/**
 * Score for grondsoort: full match when the plant supports at least one of
 * the user's chosen grondsoorten. The catalog filter also treats these choices
 * as OR conditions.
 * Returns null if the user made no selection (filter not active).
 *
 * groundTypes uses step2 keys (e.g. "lichte-klei-zandleem"), plant.grondsoorten uses
 * display values (e.g. "Lichte klei"). The mapping above bridges the two.
 */
function scoreGrondsoort(plant: ApiPlant, groundTypes: string[]): number | null {
    if (groundTypes.length === 0) return null;

    const plantGrondsoorten = plant.grondsoorten.map((g) => g.toLowerCase());

    const matches = groundTypes.filter((g) => {
        const dbValue = GRONDSOORT_KEY_TO_DB[g.toLowerCase()] ?? g.toLowerCase();
        return plantGrondsoorten.some((pg) => pg.includes(dbValue));
    });

    return matches.length > 0 ? 100 : 0;
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

/**
 * Score based on step 3 structureStyle — rewards plants whose characteristics
 * (bloom, form, height, appGroup) match the chosen planting style.
 * Returns null when no structureStyle is set (filter inactive).
 */
function scoreStructureStyle(plant: ApiPlant, structureStyle: string | null): number | null {
    if (!structureStyle || structureStyle === "vrij-samenstellen") return null;

    const hasBloom = Boolean(plant.bloeiperiode && plant.bloeiperiode.trim().length > 0);
    const hasFlowerColor = plant.kleuren && plant.kleuren.length > 0;
    const isHeester = plant.appGroup === "heesters-struiken";
    const isBodembedekker = plant.appGroup === "bodembedekkers";
    const isTall = plant.maxHeightCm > 100;
    const isMedium = plant.maxHeightCm >= 50 && plant.maxHeightCm <= 120;

    if (structureStyle === "bloei-en-kleur") {
        // Planten met rijke bloei en kleur hebben voorkeur
        if (hasBloom && hasFlowerColor) return 100;
        if (hasBloom) return 72;
        if (hasFlowerColor) return 58;
        return 18;
    }

    if (structureStyle === "structuur-en-rust") {
        // Heesters en groene structuurplanten hebben voorkeur, minder nadruk op bloei
        if (isHeester && !hasBloom) return 100;
        if (isHeester) return 80;
        if (isBodembedekker) return 65;
        if (!hasBloom) return 50;
        return 30;
    }

    if (structureStyle === "met-bomen") {
        // Planten die diepte, hoogte en karakter toevoegen naast bomen
        if (isHeester && isTall) return 100;
        if (isHeester) return 80;
        if (isTall) return 68;
        if (isMedium) return 52;
        return 32;
    }

    if (structureStyle === "gebalanceerd") {
        // Goede mix: bloei én structuur zijn beide welkom
        if (hasBloom && isHeester) return 100;
        if (hasBloom && hasFlowerColor) return 90;
        if (hasBloom) return 72;
        if (isHeester) return 62;
        return 45;
    }

    return null;
}

function scoreKeurmerken(plant: ApiPlant, input: ScoringInput): number | null {
    const requestedKeurmerken = input.keurmerken ?? [];
    if (requestedKeurmerken.length > 0) {
        const plantKeurmerken = plant.keurmerken.map((k) => k.trim().toLowerCase());
        const matches = requestedKeurmerken.filter((k) =>
            plantKeurmerken.some((pk) => pk === k.trim().toLowerCase())
        );
        return (matches.length / requestedKeurmerken.length) * 100;
    }

    if (input.keurmerkFilter === "alleen-met-keurmerk") {
        return plant.keurmerken.length > 0 ? 100 : 0;
    }

    if (input.keurmerkFilter === "alleen-zonder-keurmerk") {
        return plant.keurmerken.length === 0 ? 100 : 0;
    }

    return null;
}

function formatList(values: string[]): string {
    return values
        .filter((value) => value.trim().length > 0)
        .map((value) => value.trim())
        .join(", ");
}

function formatScore(score: number): string {
    return `${Math.round(score)}%`;
}

function describeHeightStyle(heightStyle: HeightStyle): string {
    if (heightStyle === "laag-horizontaal") return "laag en horizontaal";
    if (heightStyle === "gelaagd-ruimtelijk") return "gelaagd en ruimtelijk";
    if (heightStyle === "accent-op-hoogte") return "accent op hoogte";
    return "";
}

function describeHeightGroup(group: HeightGroup): string {
    if (group === "primary") return "past sterk bij de gekozen hoogtewerking";
    if (group === "secondary") return "past als aanvullende hoogte in de opbouw";
    if (group === "unknown") return "heeft geen betrouwbare hoogtewaarde en telt daarom neutraal mee";
    return "past niet bij de gekozen hoogtewerking";
}

function firstOrFallback(values: string[], fallback: string): string {
    return values.find((value) => value.trim().length > 0)?.trim() ?? fallback;
}

// ---------------------------------------------------------------------------
// Total score
// ---------------------------------------------------------------------------

/** Minimum score (%) for a plant to appear in the proposal at all. */
export const MIN_SCORE_THRESHOLD = 40;

/** Only a perfect score gets "Zeer geschikt". */
const SCORE_ZEER_GESCHIKT = 100;

/** Score >= this threshold gets "Geschikt" (40–74% = "Goede aanvulling"). */
const SCORE_GESCHIKT = 75;

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

    const k = scoreKeurmerken(plant, input);
    if (k !== null) scores.push(k);

    const st = scoreStructureStyle(plant, input.structureStyle ?? null);
    if (st !== null) scores.push(st);

    // Future filters (onderhoudsniveau, seizoensbeleving) go here.

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
    if (score > SCORE_GESCHIKT) return "geschikt";
    return "goede-aanvulling";
}

export function explainPlantScore(plant: ApiPlant, input: ScoringInput): PlantScoreExplanation {
    const totalScore = scorePlant(plant, input);
    const label = getLabelForScore(totalScore);
    const items: PlantScoreExplanationItem[] = [];

    const standplaatsScore = scoreStandplaats(plant, input.standplaatsen);
    if (standplaatsScore !== null) {
        const selected = input.standplaatsen.map((s) => s.toLowerCase());
        const matches = plant.standplaatsen.filter((plantValue) =>
            selected.some((selectedValue) => plantValue.trim().toLowerCase() === selectedValue)
        );
        items.push({
            label: "Standplaats",
            score: standplaatsScore,
            value: matches.length > 0 ? formatList(matches) : formatList(input.standplaatsen),
            preference: formatList(input.standplaatsen),
            summary: matches.length > 0
                ? `Matcht met ${formatList(matches)}. Gekozen standplaatsen: ${formatList(input.standplaatsen)}.`
                : `Geen directe match met de gekozen standplaatsen: ${formatList(input.standplaatsen)}.`,
        });
    }

    const grondsoortScore = scoreGrondsoort(plant, input.groundTypes);
    if (grondsoortScore !== null) {
        const selected = input.groundTypes.map((g) => g.toLowerCase());
        const matches = plant.grondsoorten.filter((plantValue) =>
            selected.some((selectedValue) => plantValue.toLowerCase().includes(selectedValue))
        );
        items.push({
            label: "Grondsoort",
            score: grondsoortScore,
            value: matches.length > 0 ? formatList(matches) : formatList(input.groundTypes),
            preference: formatList(input.groundTypes),
            summary: matches.length > 0
                ? `Matcht met ${formatList(matches)}. Gekozen grondsoorten: ${formatList(input.groundTypes)}.`
                : `Geen directe match met de gekozen grondsoorten: ${formatList(input.groundTypes)}.`,
        });
    }

    const hoogteScore = scoreHoogte(plant, input.heightStyle);
    if (hoogteScore !== null) {
        const group = getHeightGroup(plant.maxHeightCm, input.heightStyle);
        const heightText = plant.volwassenHoogte || (plant.maxHeightCm > 0 ? `${plant.maxHeightCm} cm` : "onbekend");
        items.push({
            label: "Hoogtewerking",
            score: hoogteScore,
            value: heightText,
            preference: describeHeightStyle(input.heightStyle),
            summary: `Volwassen hoogte: ${heightText}. Deze plant ${describeHeightGroup(group)} voor "${describeHeightStyle(input.heightStyle)}".`,
        });
    }

    const keurmerkScore = scoreKeurmerken(plant, input);
    if (keurmerkScore !== null) {
        const requestedKeurmerken = input.keurmerken ?? [];
        const plantKeurmerken = formatList(plant.keurmerken);
        let summary = plant.keurmerken.length > 0
            ? `Deze plant heeft keurmerk${plant.keurmerken.length === 1 ? "" : "en"}: ${plantKeurmerken}.`
            : "Deze plant heeft geen keurmerk.";

        if (requestedKeurmerken.length > 0) {
            summary += ` Gekozen keurmerken: ${formatList(requestedKeurmerken)}.`;
        } else if (input.keurmerkFilter === "alleen-met-keurmerk") {
            summary += " Je voorkeur is alleen planten met keurmerk.";
        } else if (input.keurmerkFilter === "alleen-zonder-keurmerk") {
            summary += " Je voorkeur is alleen planten zonder keurmerk.";
        }

        items.push({
            label: "Keurmerken",
            score: keurmerkScore,
            value: plant.keurmerken.length > 0
                ? firstOrFallback(plant.keurmerken, "Keurmerk aanwezig")
                : "Geen keurmerk",
            preference: requestedKeurmerken.length > 0
                ? formatList(requestedKeurmerken)
                : input.keurmerkFilter === "alleen-met-keurmerk"
                    ? "Alleen met keurmerk"
                    : input.keurmerkFilter === "alleen-zonder-keurmerk"
                        ? "Alleen zonder keurmerk"
                        : "",
            summary,
        });
    }

    const stScore = scoreStructureStyle(plant, input.structureStyle ?? null);
    if (stScore !== null) {
        const styleLabels: Record<string, string> = {
            "gebalanceerd":      "Gebalanceerd",
            "bloei-en-kleur":   "Bloei & kleur",
            "structuur-en-rust": "Structuur & rust",
            "met-bomen":        "Met bomen",
        };
        const styleName = styleLabels[input.structureStyle ?? ""] ?? (input.structureStyle ?? "");
        const plantCharacter = plant.bloeiperiode
            ? `Bloei: ${plant.bloeiperiode}${plant.kleuren.length > 0 ? ` · ${plant.kleuren.join(", ")}` : ""}`
            : (plant.appGroup === "heesters-struiken" ? "Heester/struik, geen bloei" : `Geen bloeiperiode, ${plant.maxHeightCm}cm`);
        items.push({
            label: "Structuur & opbouw",
            score: stScore,
            value: plantCharacter,
            preference: styleName,
            summary: `Dit planttype scoort ${Math.round(stScore)}% voor de stijl "${styleName}".`,
        });
    }

    const intro = totalScore === null
        ? "Er zijn nog geen actieve scoringsfilters. Daarom krijgt dit voorstel standaard het hoogste label."
        : `Dit label komt uit de gemiddelde matchscore van de actieve filters: ${formatScore(totalScore)}.`;

    return { totalScore, label, intro, items };
}
