/**
 * POST /api/plants/ai-proposal
 *
 * Generates a botanical plant proposal for empty beds using OpenAI gpt-4o.
 * Streams Server-Sent Events (SSE) with real-time progress while processing.
 *
 * Request body: AiProposalRequest (see types below)
 * Response: text/event-stream — ProgressEvent | ResultEvent | ErrorEvent
 */

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { queryPlants, queryVariantsForPlant } from "@/lib/db/plantQueries";
import {
    scorePlant,
    getLabelForScore,
    type ScoringInput,
    type SuitabilityLabel,
    HEIGHT_BOUNDARIES,
} from "@/features/editor/lib/plantScoring";
import type { ApiPlant, PlantAppGroup, BulkPriceTier } from "@/lib/db/plantTypes";

export const maxDuration = 60;

// ── Request types ──────────────────────────────────────────────────────────────

type EmptyBedSpec = {
    id: string;
    nr: string;
    title: string;
    type: string;
    nrBg: string;
    nrColor: string;
    nrBorder?: string | null;
};

type UserPlantSpec = {
    plantListItemId: string;
    plantId: string;
    latinName: string;
    dutchName: string;
    appGroup: string;
    maxHeightCm: number;
    standplaatsen: string[];
    grondsoorten: string[];
    keurmerken: string[];
    linkedBedIds: string[];
};

type NeighborPlantSpec = {
    latinName: string;
    dutchName: string;
    maxHeightCm: number;
    standplaatsen: string[];
    grondsoorten: string[];
    keurmerken: string[];
};

type NeighborContext = {
    bedId: string;
    neighborPlants: NeighborPlantSpec[];
};

type AiProposalRequest = {
    scoringInput: ScoringInput;
    emptyBeds: EmptyBedSpec[];
    userPlantList: UserPlantSpec[];
    neighborContext: NeighborContext[];
};

// ── Response types ─────────────────────────────────────────────────────────────

type ProposalVariant = {
    id: string;
    sizeLabel: string;
    price: number;
    availability: string;
    bulkPrices: BulkPriceTier[];
};

export type ProposalPlant = {
    id: string;
    apiPlant: ApiPlant;
    botanicalName: string;
    dutchName: string;
    imageUrl: string | null;
    suitability: SuitabilityLabel;
    keurmerken: string[];
    variants: ProposalVariant[];
};

export type ProposalSection = {
    bedId: string;
    bedNr: string;
    bedTitle: string;
    nrBg: string;
    nrColor: string;
    nrBorder?: string | null;
    plants: ProposalPlant[];
};

// ── Mappings ──────────────────────────────────────────────────────────────────

const STEP2_GRONDSOORT_TO_DB: Record<string, string> = {
    "zandgrond": "Zandgrond",
    "klei": "Klei",
    "lichte-klei-zandleem": "Lichte klei",
    "humusrijk-bosgrond": "Humusrijke grond",
    "veengrond-nat": "Veengrond",
};

const APPGROUPS_FOR_TYPE: Record<string, PlantAppGroup[]> = {
    plantbed: ["vaste-planten", "heesters-struiken", "bodembedekkers"],
    hedge: ["hagen"],
    treebed: ["bomen"],
};

// Step 3 structureStyle → desired distribution per appGroup for plantbed (%)
const STRUCTURE_DISTRIBUTIONS: Record<string, Partial<Record<PlantAppGroup, number>>> = {
    "gebalanceerd":      { "vaste-planten": 40, "heesters-struiken": 20, "bodembedekkers": 30 },
    "bloei-en-kleur":   { "vaste-planten": 55, "heesters-struiken": 20, "bodembedekkers": 20 },
    "structuur-en-rust": { "vaste-planten": 25, "heesters-struiken": 40, "bodembedekkers": 25 },
    "met-bomen":        { "vaste-planten": 30, "heesters-struiken": 30, "bodembedekkers": 20 },
};

// Base pool size per type — scaled up in the main handler based on actual bed count
const MAX_BASE_POOL = 60;
// Final candidate list shown to AI per bed
const MAX_CANDIDATES_PER_BED = 30;

function bedTypeFromNr(nr: string): string {
    if (nr.startsWith("H")) return "hedge";
    if (nr.startsWith("B")) return "treebed";
    return "plantbed";
}

function heightRange(style: string | null): { minHeightCm?: number; maxHeightCm?: number } {
    if (style === "laag-horizontaal") return { maxHeightCm: HEIGHT_BOUNDARIES.HIGH };
    if (style === "accent-op-hoogte") return { minHeightCm: HEIGHT_BOUNDARIES.LOW };
    return {};
}

// ── Candidate pool ─────────────────────────────────────────────────────────────

type ScoredCandidate = { plant: ApiPlant; score: number | null; suitability: SuitabilityLabel };

function scoreAndShuffle(plants: ApiPlant[], scoringInput: ScoringInput): ScoredCandidate[] {
    // Shuffle first so equal-score plants are random, not alphabetical
    const shuffled = [...plants].sort(() => Math.random() - 0.5);
    return shuffled
        .map((plant) => {
            const score = scorePlant(plant, scoringInput);
            const suitability = getLabelForScore(score);
            return { plant, score, suitability };
        })
        .filter((c): c is ScoredCandidate => c.suitability !== null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function buildCandidatePool(
    scoringInput: ScoringInput,
    bedTypes: Set<string>,
    maxBasePool: number = MAX_BASE_POOL,
): Map<string, ScoredCandidate[]> {
    const cleanStandplaatsen = (scoringInput.standplaatsen ?? []).filter(
        (s) => s !== "wisselend-onbekend",
    );
    const dbGrondsoorten = (scoringInput.groundTypes ?? [])
        .map((g) => STEP2_GRONDSOORT_TO_DB[g] ?? g)
        .filter(Boolean);
    const validKeurmerkFilter =
        scoringInput.keurmerkFilter === "alleen-met-keurmerk" ||
        scoringInput.keurmerkFilter === "alleen-zonder-keurmerk"
            ? scoringInput.keurmerkFilter
            : undefined;

    const poolByType = new Map<string, ScoredCandidate[]>();

    for (const type of bedTypes) {
        const appGroups = APPGROUPS_FOR_TYPE[type] ?? ["vaste-planten"];
        // Bomen negeren de hoogtewerking filter — laag-horizontaal mag geen bomen uitsluiten
        const range = type === "treebed" ? {} : heightRange(scoringInput.heightStyle ?? null);
        // Voor bomen ook de heightStyle uit de scoring halen, anders worden grote bomen alsnog weggefilterd
        const effectiveScoringInput = type === "treebed"
            ? { ...scoringInput, heightStyle: null as null }
            : scoringInput;

        // Score all candidates per appGroup separately
        const scoredByGroup = new Map<PlantAppGroup, ScoredCandidate[]>();
        for (const appGroup of appGroups) {
            const result = queryPlants({
                appGroup: appGroup as PlantAppGroup,
                standplaatsen: cleanStandplaatsen.length > 0 ? cleanStandplaatsen : undefined,
                grondsoorten: dbGrondsoorten.length > 0 ? dbGrondsoorten : undefined,
                keurmerkFilter: validKeurmerkFilter,
                ...range,
                limit: 9999,
                page: 1,
            });
            scoredByGroup.set(appGroup as PlantAppGroup, scoreAndShuffle(result.plants, effectiveScoringInput));
        }

        // Resolve distribution for slot allocation per appGroup
        let distribution: Partial<Record<PlantAppGroup, number>> | null = null;
        if (type === "plantbed" && scoringInput.structureStyle) {
            if (scoringInput.structureStyle === "vrij-samenstellen" && scoringInput.structureCustomPercentages) {
                const cp = scoringInput.structureCustomPercentages;
                distribution = {
                    "vaste-planten": cp.vastePlanten,
                    "heesters-struiken": cp.heestersEnStruiken,
                    "bodembedekkers": cp.bodembedekkers,
                };
            } else {
                distribution = STRUCTURE_DISTRIBUTIONS[scoringInput.structureStyle] ?? null;
            }
        }

        let pool: ScoredCandidate[];

        if (distribution && appGroups.length > 1) {
            // Allocate MAX_BASE_POOL slots proportionally to the structureStyle distribution
            const totalWeight = appGroups.reduce((sum, ag) => sum + (distribution![ag as PlantAppGroup] ?? 0), 0);
            const chosen = new Set<string>();
            const grouped: ScoredCandidate[] = [];

            for (const appGroup of appGroups) {
                const weight = distribution[appGroup as PlantAppGroup] ?? 0;
                const slots = totalWeight > 0
                    ? Math.max(1, Math.round((weight / totalWeight) * maxBasePool))
                    : Math.ceil(maxBasePool / appGroups.length);
                const candidates = scoredByGroup.get(appGroup as PlantAppGroup) ?? [];
                let added = 0;
                for (const c of candidates) {
                    if (added >= slots) break;
                    if (!chosen.has(c.plant.id)) {
                        grouped.push(c);
                        chosen.add(c.plant.id);
                        added++;
                    }
                }
            }
            pool = grouped.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        } else {
            // No distribution: merge all groups, deduplicate, sort by score, take top N
            const seen = new Set<string>();
            const merged: ScoredCandidate[] = [];
            for (const candidates of scoredByGroup.values()) {
                for (const c of candidates) {
                    if (!seen.has(c.plant.id)) {
                        merged.push(c);
                        seen.add(c.plant.id);
                    }
                }
            }
            pool = merged
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .slice(0, maxBasePool);
        }

        poolByType.set(type, pool);
    }

    return poolByType;
}

// ── Per-bed ranking using neighbor context ────────────────────────────────────

/**
 * Computes a neighbor compatibility bonus (0–40) for a candidate plant.
 * Based on:
 *  - Height complementarity: different height from avg neighbor → creates layering
 *  - Standplaats match: same conditions → ecological compatibility confirmed
 */
function neighborBonus(plant: ApiPlant, neighborPlants: NeighborPlantSpec[]): number {
    if (neighborPlants.length === 0) return 0;

    let bonus = 0;

    // Height complementarity — prefer plants at a different height than neighbors
    const neighborHeights = neighborPlants.map((n) => n.maxHeightCm).filter((h) => h > 0);
    if (neighborHeights.length > 0 && plant.maxHeightCm > 0) {
        const avgH = neighborHeights.reduce((a, b) => a + b, 0) / neighborHeights.length;
        const diff = Math.abs(plant.maxHeightCm - avgH);
        if (diff > 60) bonus += 25;
        else if (diff > 30) bonus += 12;
    }

    // Standplaats compatibility — same light conditions as neighbors = good ecological fit
    const neighborSP = new Set(
        neighborPlants.flatMap((n) => n.standplaatsen.map((s) => s.toLowerCase())),
    );
    if (plant.standplaatsen.some((s) => neighborSP.has(s.toLowerCase()))) {
        bonus += 15;
    }

    return Math.min(40, bonus);
}

/**
 * Re-ranks the base pool for a specific bed using neighbor context.
 * Combined score = 80% wizard quality score + 20% neighbor compatibility.
 * Returns the top MAX_CANDIDATES_PER_BED candidates for this bed.
 */
function rankForBed(
    basePool: ScoredCandidate[],
    neighborPlants: NeighborPlantSpec[],
): ScoredCandidate[] {
    if (neighborPlants.length === 0) {
        return basePool.slice(0, MAX_CANDIDATES_PER_BED);
    }

    return basePool
        .map((c) => {
            const base = c.score ?? 0;
            const bonus = neighborBonus(c.plant, neighborPlants);
            // Normalize bonus to 0–100 scale, then blend
            const combined = base * 0.8 + (bonus / 40) * 100 * 0.2;
            return { candidate: c, combined };
        })
        .sort((a, b) => b.combined - a.combined)
        .slice(0, MAX_CANDIDATES_PER_BED)
        .map((x) => x.candidate);
}

/**
 * Builds a per-bed candidate pool (bedId → top-30 candidates) by re-ranking
 * the shared type pool with neighbor context for each specific empty bed.
 */
function buildPerBedPools(
    emptyBeds: EmptyBedSpec[],
    poolByType: Map<string, ScoredCandidate[]>,
    neighborContext: NeighborContext[],
): Map<string, ScoredCandidate[]> {
    const neighborMap = new Map(neighborContext.map((nc) => [nc.bedId, nc.neighborPlants]));
    const perBedPool = new Map<string, ScoredCandidate[]>();
    // Per type: track how many no-neighbor beds we've seen, so we can stagger their pools
    const noNeighborIdxByType = new Map<string, number>();

    for (const bed of emptyBeds) {
        const type = bed.type || bedTypeFromNr(bed.nr);
        const basePool = poolByType.get(type) ?? [];
        const neighborPlants = neighborMap.get(bed.id) ?? [];

        if (neighborPlants.length > 0) {
            // Has neighbor context: re-rank the full base pool for this specific bed
            perBedPool.set(bed.id, rankForBed(basePool, neighborPlants));
        } else {
            // No neighbor context: give each consecutive no-neighbor bed a different slice
            // so the AI sees unique candidate sets and doesn't pick the same plants everywhere
            const idx = noNeighborIdxByType.get(type) ?? 0;
            noNeighborIdxByType.set(type, idx + 1);
            const offset = idx * MAX_CANDIDATES_PER_BED;
            const slice = basePool.slice(offset, offset + MAX_CANDIDATES_PER_BED);
            if (slice.length < MAX_CANDIDATES_PER_BED) {
                // Pool exhausted: top up from the start (different plants still lead the list)
                const extra = basePool.slice(0, MAX_CANDIDATES_PER_BED - slice.length);
                perBedPool.set(bed.id, [...slice, ...extra]);
            } else {
                perBedPool.set(bed.id, slice);
            }
        }
    }

    return perBedPool;
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(
    emptyBeds: EmptyBedSpec[],
    userPlantList: UserPlantSpec[],
    neighborContext: NeighborContext[],
    scoringInput: ScoringInput,
    perBedPool: Map<string, ScoredCandidate[]>,
): string {
    const lines: string[] = [];

    // ── Wizard-instellingen ──────────────────────────────────────────────────
    lines.push("## Wizard-instellingen van de gebruiker");
    lines.push(
        `Standplaats: ${scoringInput.standplaatsen?.length ? scoringInput.standplaatsen.join(", ") : "niet opgegeven"}`,
    );
    lines.push(
        `Grondsoort: ${scoringInput.groundTypes?.length ? scoringInput.groundTypes.join(", ") : "niet opgegeven"}`,
    );
    if (scoringInput.heightStyle) {
        lines.push(`Hoogtewerking: ${scoringInput.heightStyle}`);
        lines.push("  (Let op: de hoogtewerking is NIET van toepassing op boomvakken — alle boomhoogten blijven beschikbaar)");
    }
    if (scoringInput.keurmerkFilter && scoringInput.keurmerkFilter !== "maakt-niet-uit") {
        lines.push(`Keurmerk: ${scoringInput.keurmerkFilter}`);
    }

    if (scoringInput.structureStyle) {
        const STYLE_DESC: Record<string, string> = {
            "gebalanceerd":      "Gebalanceerd — goede balans tussen bloei, structuur en rust",
            "bloei-en-kleur":   "Bloei & kleur — focus op bloeiende planten met kleur en seizoensbeleving",
            "structuur-en-rust": "Structuur & rust — meer groen en vorm, rustig en tijdloos beeld, voorkeur voor heesters",
            "met-bomen":        "Met bomen — extra hoogte, diepte en karakter; voorkeur voor heesters en hogere planten",
            "vrij-samenstellen": "Vrij samengesteld (zie verdeling hieronder)",
        };
        lines.push(`Plantopbouw stijl: ${STYLE_DESC[scoringInput.structureStyle] ?? scoringInput.structureStyle}`);

        if (scoringInput.structureStyle === "vrij-samenstellen" && scoringInput.structureCustomPercentages) {
            const cp = scoringInput.structureCustomPercentages;
            lines.push(`Gewenste verdeling: ${cp.vastePlanten}% vaste planten, ${cp.heestersEnStruiken}% heesters/struiken, ${cp.bodembedekkers}% bodembedekkers, ${cp.bomen}% bomen`);
        } else {
            const dist = STRUCTURE_DISTRIBUTIONS[scoringInput.structureStyle];
            if (dist) {
                lines.push(`Gewenste verdeling: ${dist["vaste-planten"] ?? 0}% vaste planten, ${dist["heesters-struiken"] ?? 0}% heesters/struiken, ${dist["bodembedekkers"] ?? 0}% bodembedekkers`);
            }
        }
        lines.push("→ De kandidatenlijsten per vak zijn al op deze stijl gefilterd. Respecteer de verdeling bij je keuze.");
    }

    // ── Bestaande plantenlijst ───────────────────────────────────────────────
    lines.push("\n## Planten die de gebruiker al heeft (voor context en compatibiliteit)");
    if (userPlantList.length === 0) {
        lines.push("Geen planten in de lijst.");
    } else {
        for (const p of userPlantList) {
            const beds = p.linkedBedIds.length > 0
                ? ` → gekoppeld aan: ${p.linkedBedIds.join(", ")}`
                : "";
            lines.push(
                `- ${p.latinName} (${p.dutchName || "—"}) | ${p.maxHeightCm}cm | standplaats: ${p.standplaatsen.join("/")} | grond: ${p.grondsoorten.join("/")}${beds}`,
            );
        }
    }

    // ── Per-bed kandidatenlijst + burencontext ───────────────────────────────
    lines.push("\n## Lege vakken om in te vullen (met per-vak kandidatenlijst)");
    lines.push("Elke kandidatenlijst is al afgestemd op standplaats, grondsoort, structuurstijl én burencontext van dat specifieke vak.");

    const neighborMap = new Map(neighborContext.map((nc) => [nc.bedId, nc.neighborPlants]));

    for (const bed of emptyBeds) {
        const type = bed.type || bedTypeFromNr(bed.nr);
        const typeLabel = type === "hedge" ? "haagvak" : type === "treebed" ? "boomvak" : "plantvak";
        lines.push(`\n### Vak ${bed.nr} - "${bed.title}" (${typeLabel}, bedId: ${bed.id})`);

        const neighbors = neighborMap.get(bed.id) ?? [];
        if (neighbors.length > 0) {
            lines.push("Aangrenzende planten in naburige vakken:");
            for (const n of neighbors) {
                lines.push(
                    `  - ${n.latinName} (${n.dutchName || "—"}) | ${n.maxHeightCm}cm | ${n.standplaatsen.join("/")} | ${n.grondsoorten.join("/")}`,
                );
            }
        } else {
            lines.push("Geen aangrenzende gevulde vakken.");
        }

        const pool = perBedPool.get(bed.id) ?? [];
        if (pool.length === 0) {
            lines.push("Geen kandidaten beschikbaar voor dit vak.");
        } else {
            lines.push(`Beschikbare kandidaten voor dit vak (${pool.length} beste, gesorteerd op geschiktheid + burencontext):`);
            for (const { plant, score, suitability } of pool) {
                const scoreStr = score !== null ? `${Math.round(score)}%` : "—";
                const k = plant.keurmerken.length > 0 ? ` [keurmerk: ${plant.keurmerken.join(", ")}]` : "";
                const bloom = plant.bloeiperiode ? ` | bloei: ${plant.bloeiperiode}` : "";
                const appGrp = ` | type: ${plant.appGroup}`;
                lines.push(
                    `  ID:${plant.id} | ${plant.botanicalName} (${plant.dutchName || "—"}) | ${plant.maxHeightCm > 0 ? plant.maxHeightCm + "cm" : "hoogte onbekend"}${appGrp} | ${plant.standplaatsen.join("/")} | ${plant.grondsoorten.join("/")}${bloom} | score: ${scoreStr} (${suitability})${k}`,
                );
            }
        }
    }

    lines.push(`
## Instructies
Kies voor elk leeg vak PRECIES 3 planten uit de kandidatenlijst VAN DAT SPECIFIEKE VAK.
Gebruik uitsluitend plant-IDs die in de kandidatenlijst van dat vak staan — verzin geen IDs.
BELANGRIJK: Elk plant-ID mag over alle vakken samen maar één keer voorkomen. Gebruik NOOIT hetzelfde plant-ID in meerdere vakken.
Streef naar:
- Botanische compatibiliteit met aangrenzende planten (visuele harmonie, complementaire soorten)
- Variatie in hoogte voor gelaagdheid (tenzij hoogtewerking = laag-horizontaal; voor boomvakken geldt de hoogtewerking NOOIT)
- Spreiding in bloeiperiode voor seizoensbeleving
- Ecologische match op standplaats en grondsoort
- Respect voor de gewenste plantopbouw stijl

Geef je antwoord UITSLUITEND als geldige JSON-array, geen markdown, geen uitleg buiten de JSON:
[{"bedId":"<exact bedId>","plants":[{"id":"<exact plant ID uit de kandidatenlijst van dit vak>","reason":"<korte botanische motivering in het Nederlands>"},{"id":"...","reason":"..."},{"id":"...","reason":"..."}]}]`);

    return lines.join("\n");
}

// ── Parse AI response ─────────────────────────────────────────────────────────

type AiRecommendation = { bedId: string; plants: { id: string; reason: string }[] };

function parseAiResponse(content: string): AiRecommendation[] {
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Expected JSON array");
    return parsed as AiRecommendation[];
}

// ── Build variants for a plant ────────────────────────────────────────────────

function buildVariants(plantId: string): ProposalVariant[] {
    return queryVariantsForPlant(plantId)
        .slice(0, 5)
        .map((v) => ({
            id: String(v.id),
            sizeLabel: v.size_label,
            price: v.price,
            availability: v.availability,
            bulkPrices: (() => {
                try {
                    return (v.bulk_prices ? JSON.parse(v.bulk_prices) : []) as BulkPriceTier[];
                } catch {
                    return [];
                }
            })(),
        }));
}

// ── Build sections from AI recommendations ────────────────────────────────────

function buildSections(
    emptyBeds: EmptyBedSpec[],
    recommendations: AiRecommendation[],
    perBedPool: Map<string, ScoredCandidate[]>,
): ProposalSection[] {
    const recMap = new Map(recommendations.map((r) => [r.bedId, r.plants]));
    // Enforce uniqueness across all beds: a plant chosen for bed A is not available for bed B
    const globallyChosen = new Set<string>();

    return emptyBeds.map((bed) => {
        const pool = perBedPool.get(bed.id) ?? [];
        const poolById = new Map(pool.map((c) => [c.plant.id, c]));

        const recs = recMap.get(bed.id) ?? [];
        const chosen: ScoredCandidate[] = [];
        const chosenIds = new Set<string>();

        // AI-aanbevelingen (alleen geldige IDs uit de kandidatenpool, nog niet globaal gekozen)
        for (const rec of recs) {
            if (chosen.length >= 3) break;
            const entry = poolById.get(rec.id);
            if (entry && !chosenIds.has(rec.id) && !globallyChosen.has(rec.id)) {
                chosen.push(entry);
                chosenIds.add(rec.id);
                globallyChosen.add(rec.id);
            }
        }

        // Vul resterende plekken op met de volgende beste gescoorde kandidaten (globaal uniek)
        for (const candidate of pool) {
            if (chosen.length >= 3) break;
            if (!chosenIds.has(candidate.plant.id) && !globallyChosen.has(candidate.plant.id)) {
                chosen.push(candidate);
                chosenIds.add(candidate.plant.id);
                globallyChosen.add(candidate.plant.id);
            }
        }

        const plants: ProposalPlant[] = chosen.map(({ plant, suitability }) => ({
            id: plant.id,
            apiPlant: plant,
            botanicalName: plant.botanicalName,
            dutchName: plant.dutchName,
            imageUrl: plant.imageUrl ?? null,
            suitability,
            keurmerken: plant.keurmerken,
            variants: buildVariants(plant.id),
        }));

        return {
            bedId: bed.id,
            bedNr: bed.nr,
            bedTitle: bed.title,
            nrBg: bed.nrBg,
            nrColor: bed.nrColor,
            nrBorder: bed.nrBorder,
            plants,
        };
    });
}

// ── Fallback: score-based (without AI) ───────────────────────────────────────

function buildFallbackSections(
    emptyBeds: EmptyBedSpec[],
    perBedPool: Map<string, ScoredCandidate[]>,
): ProposalSection[] {
    const globallyChosen = new Set<string>();
    return emptyBeds.map((bed) => {
        const pool = perBedPool.get(bed.id) ?? [];
        const chosen: ScoredCandidate[] = [];
        for (const candidate of pool) {
            if (chosen.length >= 3) break;
            if (!globallyChosen.has(candidate.plant.id)) {
                chosen.push(candidate);
                globallyChosen.add(candidate.plant.id);
            }
        }

        const plants: ProposalPlant[] = chosen.map(({ plant, suitability }) => ({
            id: plant.id,
            apiPlant: plant,
            botanicalName: plant.botanicalName,
            dutchName: plant.dutchName,
            imageUrl: plant.imageUrl ?? null,
            suitability,
            keurmerken: plant.keurmerken,
            variants: buildVariants(plant.id),
        }));

        return {
            bedId: bed.id,
            bedNr: bed.nr,
            bedTitle: bed.title,
            nrBg: bed.nrBg,
            nrColor: bed.nrColor,
            nrBorder: bed.nrBorder,
            plants,
        };
    });
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
    // Parse body upfront — needed in both main flow and error handler
    let body: AiProposalRequest = {
        scoringInput: { heightStyle: null, standplaatsen: [], groundTypes: [] },
        emptyBeds: [],
        userPlantList: [],
        neighborContext: [],
    };
    try {
        body = (await request.json()) as AiProposalRequest;
    } catch {
        // use defaults
    }

    const encoder = new TextEncoder();
    const transform = new TransformStream();
    const writer = transform.writable.getWriter();

    const send = (data: object) =>
        writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)).catch(() => {});

    (async () => {
        try {
            const { scoringInput, emptyBeds = [], userPlantList = [], neighborContext = [] } = body;

            if (emptyBeds.length === 0) {
                await send({ type: "result", sections: [] });
                return;
            }

            // Stap 1 — Kandidaten ophalen + scoren vanuit SQLite
            await send({ type: "progress", step: "querying_db", pct: 10 });
            const bedTypes = new Set(emptyBeds.map((b) => b.type || bedTypeFromNr(b.nr)));
            // Scale pool size so each bed gets a unique slice of MAX_CANDIDATES_PER_BED candidates
            const maxBedCount = Math.max(...[...bedTypes].map((t) =>
                emptyBeds.filter((b) => (b.type || bedTypeFromNr(b.nr)) === t).length
            ));
            const maxBasePool = Math.max(MAX_BASE_POOL, maxBedCount * MAX_CANDIDATES_PER_BED);
            const poolByType = buildCandidatePool(scoringInput, bedTypes, maxBasePool);
            await send({ type: "progress", step: "scoring_candidates", pct: 25 });

            // Per-bed pools: re-rank base pool met burencontext per bed
            const perBedPool = buildPerBedPools(emptyBeds, poolByType, neighborContext);

            // Stap 2 — Prompt bouwen
            await send({ type: "progress", step: "building_prompt", pct: 40 });
            const userMessage = buildPrompt(
                emptyBeds,
                userPlantList,
                neighborContext,
                scoringInput,
                perBedPool,
            );

            // Stap 3 — OpenAI gpt-4o aanroepen met streaming
            await send({ type: "progress", step: "asking_openai", pct: 50 });

            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

            const systemPrompt =
                "Je bent een expert beplantingsontwerper gespecialiseerd in Nederlandse tuinen en botanische compatibiliteit. " +
                "Je geeft plantvoorstellen op basis van ecologische en esthetische criteria. " +
                "Je reageert altijd met exacte, geldige JSON zoals gevraagd — nooit met tekst of markdown.";

            let accumulated = "";
            let tokenCount = 0;
            let lastSentPct = 50;

            const stream = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                stream: true,
                temperature: 0.3,
                max_tokens: 2048,
            });

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content ?? "";
                accumulated += delta;
                tokenCount++;

                // Vloeiende progressie van 50 → 85% terwijl tokens binnenkomen
                const newPct = Math.round(50 + 35 * (1 - Math.exp(-tokenCount / 60)));
                if (newPct >= lastSentPct + 3) {
                    lastSentPct = newPct;
                    await send({ type: "progress", step: "generating", pct: newPct });
                }
            }

            // Stap 4 — Response parsen en secties bouwen
            await send({ type: "progress", step: "parsing_result", pct: 90 });

            let sections: ProposalSection[];
            try {
                const recommendations = parseAiResponse(accumulated);
                sections = buildSections(emptyBeds, recommendations, perBedPool);
            } catch {
                // AI gaf onparseerbare output → fallback op score-sort
                sections = buildFallbackSections(emptyBeds, perBedPool);
            }

            await send({ type: "progress", pct: 98 });
            await send({ type: "result", sections });
        } catch (err) {
            console.error("[ai-proposal] error:", err);
            // Probeer score-gebaseerde fallback terug te sturen
            try {
                const { scoringInput, emptyBeds = [], neighborContext: nc = [] } = body;
                const bedTypes = new Set(emptyBeds.map((b) => b.type || bedTypeFromNr(b.nr)));
                const maxBedCountFb = Math.max(...[...bedTypes].map((t) =>
                    emptyBeds.filter((b) => (b.type || bedTypeFromNr(b.nr)) === t).length
                ));
                const maxBasePoolFb = Math.max(MAX_BASE_POOL, maxBedCountFb * MAX_CANDIDATES_PER_BED);
                const poolByType = buildCandidatePool(scoringInput, bedTypes, maxBasePoolFb);
                const perBedPool = buildPerBedPools(emptyBeds, poolByType, nc);
                const sections = buildFallbackSections(emptyBeds, perBedPool);
                await send({ type: "result", sections, fallback: true });
            } catch {
                await send({ type: "error", message: "Internal error" });
            }
        } finally {
            await writer.close().catch(() => {});
        }
    })();

    return new Response(transform.readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
