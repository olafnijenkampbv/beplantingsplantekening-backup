/**
 * POST /api/plant-advice/accessories
 *
 * Geeft een AI-advies voor aanplant-hulpmiddelen (tuinmaterialen) op basis van
 * de definitieve plantenlijst van de gebruiker. Het model kijkt naar plantnaam,
 * appGroup, maatvoering en aantal, en kiest passende producten uit de
 * bestaande garden_materials-catalogus.
 *
 * Request body: { items: AccessoryAdviceInputItem[] }
 * Response shape: AccessoryAdviceResponse
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getPlantDb } from "@/lib/db/plantDatabase";
import { getAccessoryCatalogMeta } from "@/lib/accessoryCatalogMeta";
import type {
    ApiGardenMaterial,
    ApiGardenMaterialVariant,
    GardenMaterialRow,
    GardenMaterialVariantRow,
} from "@/lib/db/gardenMaterialTypes";

export type AccessoryAdviceVakInfo = {
    vakType: "plantbed" | "hedge" | "treebed";
    areaM2: number;
    adviceCount: number;
};

export type AccessoryAdviceInputItem = {
    botanicalName: string;
    dutchName: string;
    category?: string;
    appGroup: string;
    size: string;
    quantity: number;
    volwassenHoogte?: string;
    kleuren?: string[];
    kleurBlad?: string[];
    bloeiperiode?: string;
    inheems?: boolean;
    stikstofbehoefte?: string;
    standplaatsen?: string[];
    grondsoorten?: string[];
    toelichting?: string;
    vakken?: AccessoryAdviceVakInfo[];
    /** Aantal gekoppelde boomvakken (treebeds) — bepalend voor het aantal boompalen/boomband, niet het aantal bomen. */
    treebedCount?: number;
};

export type AccessoryAdviceSuggestion = {
    material: ApiGardenMaterial;
    suggestedQuantity: number;
    reason: string;
    plantNames: string[];
};

export type AccessoryAdviceResponse = {
    suggestions: AccessoryAdviceSuggestion[];
};

type StandardAccessoryRule = {
    materialId: string;
    shouldApply: (items: AccessoryAdviceInputItem[]) => boolean;
    getQuantity: (items: AccessoryAdviceInputItem[]) => number;
    getReason: (items: AccessoryAdviceInputItem[]) => string;
};

function getTotalTreebedCount(items: AccessoryAdviceInputItem[]): number {
    return items.reduce((total, item) => total + Math.max(0, item.treebedCount ?? 0), 0);
}

function normalizeCategory(value: string): string {
    return value.toLowerCase().trim();
}

function hasCategoryStartingWith(items: AccessoryAdviceInputItem[], prefixes: string[]): boolean {
    return getItemsWithCategoryStartingWith(items, prefixes).length > 0;
}

function getItemsWithCategoryStartingWith(
    items: AccessoryAdviceInputItem[],
    prefixes: string[]
): AccessoryAdviceInputItem[] {
    return items.filter((item) => {
        const category = normalizeCategory(item.category || item.appGroup || "");
        return prefixes.some((prefix) => category.startsWith(prefix));
    });
}

const PLANTING_SOIL_STANDARD_CATEGORY_PREFIXES = [
    "heesters",
    "vaste planten",
    "rhododendron",
    "rozen",
    "bloembollen",
    "klimplanten",
    "fruit",
    "coniferen",
    "bosplantsoen",
];

const TREE_SUPPORT_STANDARD_CATEGORY_PREFIXES = [
    "meerstammig",
    "dak",
    "lei",
    "vormbomen",
    "bomen",
];

function hasPlantingSoilStandardCategory(items: AccessoryAdviceInputItem[]): boolean {
    return hasCategoryStartingWith(items, PLANTING_SOIL_STANDARD_CATEGORY_PREFIXES);
}

function hasTreeSupportStandardCategory(items: AccessoryAdviceInputItem[]): boolean {
    return hasCategoryStartingWith(items, TREE_SUPPORT_STANDARD_CATEGORY_PREFIXES);
}

function getTreeSupportQuantity(items: AccessoryAdviceInputItem[]): number {
    return getTotalTreebedCount(items) || 1;
}

function formatPlantBulletList(items: AccessoryAdviceInputItem[]): string {
    const names = Array.from(new Set(items.map((item) => item.botanicalName).filter(Boolean)));
    return names.map((name) => `- ${name}`).join("\n");
}

function buildStandardReason(
    intro: string,
    items: AccessoryAdviceInputItem[],
    why: string
): string {
    const plantLines = formatPlantBulletList(items);
    if (!plantLines) return why;
    return `${intro}\n${plantLines}\n${why}`;
}

function getPlantingSoilStandardItems(items: AccessoryAdviceInputItem[]): AccessoryAdviceInputItem[] {
    return getItemsWithCategoryStartingWith(items, PLANTING_SOIL_STANDARD_CATEGORY_PREFIXES);
}

function getTreeSupportStandardItems(items: AccessoryAdviceInputItem[]): AccessoryAdviceInputItem[] {
    return getItemsWithCategoryStartingWith(items, TREE_SUPPORT_STANDARD_CATEGORY_PREFIXES);
}

function estimateContainerVolumeLiters(size: string): number {
    const s = size.toLowerCase().trim();

    const explicitL = s.match(/(\d+(?:[,.]\d+)?)\s*l\b/);
    if (explicitL) return parseFloat(explicitL[1].replace(",", "."));

    if (/\bgm[\s-]?p9\b|\bp9\b|\bp10\b|\bplug\b/.test(s)) return 0.7;
    if (/\bp11\b|\bp12\b/.test(s)) return 1.0;
    if (/\bp13\b|\bp14\b/.test(s)) return 1.5;
    if (/\bp15\b/.test(s)) return 2.0;
    if (/\bp17\b|\bp18\b/.test(s)) return 3.0;
    if (/\bc7\b|\bc8\b/.test(s)) return 6.0;
    if (/\bc10\b/.test(s)) return 10.0;

    if (/wortelgoed|kale\s*wortel/.test(s)) return 1.0;

    // HO draadkluit: "6-8 ho", "8-10 ho", etc.
    const hoMatch = s.match(/(\d+)-(\d+)\s*(?:ho|ha)/);
    if (hoMatch) {
        const avg = (parseInt(hoMatch[1]) + parseInt(hoMatch[2])) / 2;
        if (avg <= 7) return 15;
        if (avg <= 9) return 20;
        if (avg <= 11) return 30;
        if (avg <= 13) return 45;
        if (avg <= 15) return 60;
        if (avg <= 17) return 75;
        if (avg <= 19) return 100;
        if (avg <= 22.5) return 130;
        return 160;
    }

    // Hoogte in cm
    const cmMatch = s.match(/(\d+)(?:-(\d+))?\s*cm/);
    if (cmMatch) {
        const h = parseInt(cmMatch[2] || cmMatch[1]);
        if (h <= 30) return 1;
        if (h <= 60) return 2;
        if (h <= 100) return 5;
        if (h <= 150) return 10;
        if (h <= 200) return 15;
        return 25;
    }

    return 1;
}

function calculateSoilBagsNeeded(
    items: AccessoryAdviceInputItem[],
    bagVolumeLiters: number
): number {
    const totalLiters = items.reduce((sum, item) => {
        const vol = estimateContainerVolumeLiters(item.size || "");
        return sum + vol * 0.5 * Math.max(1, item.quantity);
    }, 0);
    return Math.max(1, Math.ceil(totalLiters / bagVolumeLiters));
}

function getVivimusStandardItems(items: AccessoryAdviceInputItem[]): AccessoryAdviceInputItem[] {
    return Array.from(
        new Map(
            [...getPlantingSoilStandardItems(items), ...getTreeSupportStandardItems(items)].map((item) => [
                item.botanicalName,
                item,
            ])
        ).values()
    );
}

const STANDARD_ACCESSORY_RULES: StandardAccessoryRule[] = [
    {
        materialId: "BOOMPALE",
        shouldApply: hasTreeSupportStandardCategory,
        getQuantity: getTreeSupportQuantity,
        getReason: (items) =>
            buildStandardReason(
                "Boompalen kunnen goed van pas komen bij deze bomen:",
                getTreeSupportStandardItems(items),
                "Deze jonge aanplant heeft steun nodig om recht te blijven staan en om windbelasting op de wortelkluit te verminderen."
            ),
    },
    {
        materialId: "BOOOMBAN",
        shouldApply: hasTreeSupportStandardCategory,
        getQuantity: getTreeSupportQuantity,
        getReason: (items) =>
            buildStandardReason(
                "Boomband kan goed van pas komen bij deze bomen:",
                getTreeSupportStandardItems(items),
                "De band bevestigt de stam aan de boompaal en helpt schuren of bastschade tijdens het aangroeien te voorkomen."
            ),
    },
    {
        materialId: "VIVIUNIV",
        shouldApply: (items) =>
            hasPlantingSoilStandardCategory(items) || hasTreeSupportStandardCategory(items),
        getQuantity: (items) => calculateSoilBagsNeeded(getVivimusStandardItems(items), 60),
        getReason: (items) =>
            buildStandardReason(
                "Dcm Vivimus universeel kan goed van pas komen bij deze planten:",
                getVivimusStandardItems(items),
                "Deze beplanting kan profiteren van aanplantgrond die de bodemstructuur verbetert en de wortelaanslag ondersteunt."
            ),
    },
    {
        materialId: "TUTURF40",
        shouldApply: hasPlantingSoilStandardCategory,
        getQuantity: (items) => calculateSoilBagsNeeded(getPlantingSoilStandardItems(items), 40),
        getReason: (items) =>
            buildStandardReason(
                "Tuinturf 40 liter kan goed van pas komen bij deze planten:",
                getPlantingSoilStandardItems(items),
                "Deze beplanting kan baat hebben bij extra organisch materiaal dat de bodem humusrijker, licht zuurder en beter vochthoudend maakt."
            ),
    },
];

function fetchAllGardenMaterials(): ApiGardenMaterial[] {
    const db = getPlantDb();

    const materialRows = db
        .prepare<[], GardenMaterialRow>(
            `SELECT id, name, image_url, min_price, in_stock, subcategory, updated_at
             FROM garden_materials
             ORDER BY name ASC`
        )
        .all();

    if (materialRows.length === 0) return [];

    const ids = materialRows.map((m) => m.id);
    const placeholders = ids.map(() => "?").join(", ");
    const variantRows = db
        .prepare<string[], GardenMaterialVariantRow>(
            `SELECT id, material_id, size_label, price, availability, updated_at
             FROM garden_material_variants
             WHERE material_id IN (${placeholders})
             ORDER BY price ASC`
        )
        .all(...ids);

    const variantsByMaterial = new Map<string, ApiGardenMaterialVariant[]>();
    for (const v of variantRows) {
        const list = variantsByMaterial.get(v.material_id) ?? [];
        list.push({
            id: v.id,
            sizeLabel: v.size_label,
            price: v.price,
            availability: v.availability,
        });
        variantsByMaterial.set(v.material_id, list);
    }

    return materialRows.map((m) => ({
        id: m.id,
        name: m.name,
        imageUrl: m.image_url,
        minPrice: m.min_price,
        inStock: m.in_stock === 1,
        subcategory: m.subcategory || "Overig",
        variants: variantsByMaterial.get(m.id) ?? [],
    }));
}

function sanitizeStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function sanitizeVakken(value: unknown): AccessoryAdviceVakInfo[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((raw): AccessoryAdviceVakInfo | null => {
            if (!raw || typeof raw !== "object") return null;
            const r = raw as Record<string, unknown>;
            if (
                r.vakType !== "plantbed" &&
                r.vakType !== "hedge" &&
                r.vakType !== "treebed"
            ) {
                return null;
            }
            if (typeof r.areaM2 !== "number" || typeof r.adviceCount !== "number") {
                return null;
            }
            return { vakType: r.vakType, areaM2: r.areaM2, adviceCount: r.adviceCount };
        })
        .filter((v): v is AccessoryAdviceVakInfo => v !== null);
}

function sanitizeItems(value: unknown): AccessoryAdviceInputItem[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is Record<string, unknown> => {
            if (!item || typeof item !== "object") return false;
            const it = item as Record<string, unknown>;
            return (
                typeof it.botanicalName === "string" &&
                typeof it.dutchName === "string" &&
                typeof it.appGroup === "string" &&
                typeof it.size === "string" &&
                typeof it.quantity === "number"
            );
        })
        .map((it): AccessoryAdviceInputItem => ({
            botanicalName: it.botanicalName as string,
            dutchName: it.dutchName as string,
            category: typeof it.category === "string" ? it.category : undefined,
            appGroup: it.appGroup as string,
            size: it.size as string,
            quantity: it.quantity as number,
            volwassenHoogte: typeof it.volwassenHoogte === "string" ? it.volwassenHoogte : undefined,
            kleuren: sanitizeStringArray(it.kleuren),
            kleurBlad: sanitizeStringArray(it.kleurBlad),
            bloeiperiode: typeof it.bloeiperiode === "string" ? it.bloeiperiode : undefined,
            inheems: typeof it.inheems === "boolean" ? it.inheems : undefined,
            stikstofbehoefte: typeof it.stikstofbehoefte === "string" ? it.stikstofbehoefte : undefined,
            standplaatsen: sanitizeStringArray(it.standplaatsen),
            grondsoorten: sanitizeStringArray(it.grondsoorten),
            toelichting: typeof it.toelichting === "string" ? it.toelichting : undefined,
            vakken: sanitizeVakken(it.vakken),
            treebedCount: typeof it.treebedCount === "number" ? it.treebedCount : undefined,
        }));
}

function sanitizeReason(value: unknown): string {
    return typeof value === "string" ? value.replace(/[\u2013\u2014]/g, ",").trim() : "";
}

// The AI sometimes returns all names as one string element like "name1','name2',...]".
// This splits each element on "','" (the Python list separator) and strips surrounding
// brackets and quotes so every entry ends up as a clean botanical name.
function sanitizePlantNames(rawNames: string[]): string[] {
    const result: string[] = [];
    for (const raw of rawNames) {
        const stripped = raw.replace(/^\[['"]?/, "").replace(/['"]?\]$/, "").trim();
        const parts = stripped.split(/['"]\s*,\s*['"]/).map((p) =>
            p.replace(/^['"]|['"]$/g, "").trim()
        );
        for (const part of parts) {
            if (part.length > 0) result.push(part);
        }
    }
    return result;
}

function combineReasons(reasons: string[]): string {
    const uniqueReasons = Array.from(
        new Set(reasons.map((reason) => reason.trim()).filter(Boolean))
    );

    if (uniqueReasons.length <= 1) return uniqueReasons[0] ?? "";

    const sharedPlantReason = uniqueReasons
        .map((reason) => reason.match(/^(?:De|Het)\s+(.+?)\s+(heeft|kan|is|staat)\s+(.+)$/i))
        .filter((match): match is RegExpMatchArray => match !== null);

    if (
        sharedPlantReason.length === uniqueReasons.length &&
        sharedPlantReason.every(
            (match) => match[2] === sharedPlantReason[0][2] && match[3] === sharedPlantReason[0][3]
        )
    ) {
        const pluralVerb: Record<string, string> = {
            heeft: "hebben",
            kan: "kunnen",
            is: "zijn",
            staat: "staan",
        };
        const plantLines = sharedPlantReason
            .map((match) => `- ${match[1].replace(/\s+ook wel bekend als de\s+.+$/i, "")}`)
            .join("\n");
        const verb = sharedPlantReason[0][2].toLowerCase();
        return `Meerdere planten in je lijst zoals\n${plantLines}\n${pluralVerb[verb] ?? sharedPlantReason[0][2]} ${sharedPlantReason[0][3]}`;
    }

    return `Past bij meerdere planten in je lijst. ${uniqueReasons.join(" ")}`;
}

function extractNamesFromStandardReason(reason: string): { cleanReason: string; plantNames: string[] } {
    const lines = reason.split("\n");
    const intro: string[] = [];
    const names: string[] = [];
    const explanation: string[] = [];
    let inNames = false;
    for (const line of lines) {
        if (line.startsWith("- ")) {
            inNames = true;
            names.push(line.slice(2).trim());
        } else if (inNames) {
            explanation.push(line);
        } else {
            intro.push(line);
        }
    }
    const cleanIntro = intro.join(" ").replace(/:$/, "").trim();
    const cleanExplanation = explanation.join(" ").trim();
    const cleanReason = [cleanIntro, cleanExplanation].filter(Boolean).join(" ").trim();
    return { cleanReason, plantNames: names };
}

function uniqueSuggestionsByMaterial(
    rawSuggestions: unknown,
    materialsById: Map<string, ApiGardenMaterial>
): AccessoryAdviceSuggestion[] {
    if (!Array.isArray(rawSuggestions)) return [];

    const byMaterialId = new Map<
        string,
        { material: ApiGardenMaterial; suggestedQuantity: number; reasons: string[]; plantNames: string[] }
    >();

    for (const raw of rawSuggestions) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as Record<string, unknown>;
        if (typeof r.materialId !== "string") continue;

        const material = materialsById.get(r.materialId);
        if (!material) continue;

        const quantity =
            typeof r.suggestedQuantity === "number" && r.suggestedQuantity > 0
                ? Math.round(r.suggestedQuantity)
                : 1;
        const reason = sanitizeReason(r.reason);
        const plantNames = sanitizePlantNames(
            Array.isArray(r.plantNames)
                ? r.plantNames.filter((n): n is string => typeof n === "string" && n.length > 0)
                : []
        );

        const existing = byMaterialId.get(material.id);
        if (existing) {
            existing.suggestedQuantity = Math.max(existing.suggestedQuantity, quantity);
            if (reason) existing.reasons.push(reason);
            for (const name of plantNames) {
                if (!existing.plantNames.includes(name)) existing.plantNames.push(name);
            }
        } else {
            byMaterialId.set(material.id, {
                material,
                suggestedQuantity: quantity,
                reasons: reason ? [reason] : [],
                plantNames: [...plantNames],
            });
        }
    }

    return Array.from(byMaterialId.values()).map((suggestion) => ({
        material: suggestion.material,
        suggestedQuantity: suggestion.suggestedQuantity,
        reason: combineReasons(suggestion.reasons),
        plantNames: suggestion.plantNames,
    }));
}

function applyStandardAccessoryRules(
    suggestions: AccessoryAdviceSuggestion[],
    items: AccessoryAdviceInputItem[],
    materialsById: Map<string, ApiGardenMaterial>
): AccessoryAdviceSuggestion[] {
    const byMaterialId = new Map(suggestions.map((suggestion) => [suggestion.material.id, suggestion]));
    const standardMaterialIds: string[] = [];

    for (const rule of STANDARD_ACCESSORY_RULES) {
        if (!rule.shouldApply(items)) continue;

        const material = materialsById.get(rule.materialId);
        if (!material) continue;

        standardMaterialIds.push(material.id);
        const quantity = Math.max(1, Math.round(rule.getQuantity(items)));
        const rawReason = rule.getReason(items);
        const { cleanReason, plantNames } = extractNamesFromStandardReason(rawReason);
        const existing = byMaterialId.get(material.id);

        if (existing) {
            byMaterialId.set(material.id, {
                ...existing,
                suggestedQuantity: Math.max(existing.suggestedQuantity, quantity),
                reason: cleanReason,
                plantNames,
            });
        } else {
            byMaterialId.set(material.id, {
                material,
                suggestedQuantity: quantity,
                reason: cleanReason,
                plantNames,
            });
        }
    }

    const standardSuggestions = standardMaterialIds
        .map((materialId) => byMaterialId.get(materialId))
        .filter((suggestion): suggestion is AccessoryAdviceSuggestion => !!suggestion);
    const otherSuggestions = Array.from(byMaterialId.values()).filter(
        (suggestion) => !standardMaterialIds.includes(suggestion.material.id)
    );

    return [...standardSuggestions, ...otherSuggestions];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "OPENAI_API_KEY is niet geconfigureerd op de server." },
                { status: 503 }
            );
        }

        const body = await request.json().catch(() => null);
        const items = sanitizeItems(body?.items);

        if (items.length === 0) {
            const response: AccessoryAdviceResponse = { suggestions: [] };
            return NextResponse.json(response, { status: 200 });
        }

        // Daktuinen-producten (sedumdaken/groendaken) zijn voor deze app niet relevant
        // als aanplant-hulpmiddel en worden nooit voorgesteld — scheelt ook flink in
        // promptgrootte (en dus responstijd), want dit is een grote subcategorie.
        const materials = fetchAllGardenMaterials().filter((m) => m.subcategory !== "Daktuinen");
        if (materials.length === 0) {
            const response: AccessoryAdviceResponse = { suggestions: [] };
            return NextResponse.json(response, { status: 200 });
        }

        const materialsById = new Map(materials.map((m) => [m.id, m]));

        // Korte timeout: bij een trage/hangende OpenAI-aanvraag (de SDK-default is
        // 10 minuten) moet de gebruiker snel een foutmelding zien in plaats van
        // minutenlang te wachten op een spinner.
        const openai = new OpenAI({ apiKey, timeout: 25_000, maxRetries: 1 });

        const vakTypeLabel: Record<AccessoryAdviceVakInfo["vakType"], string> = {
            plantbed: "plantvak",
            hedge: "haagvak",
            treebed: "boomvak",
        };

        const plantSummaryText = items
            .map((item) => {
                const effectiveQuantity = item.quantity > 0 ? item.quantity : 1;
                const lines = [
                    `- ${item.dutchName} (${item.botanicalName}), groep: ${item.appGroup}, maatvoering: ${item.size || "onbekend"}, aantal: ${effectiveQuantity}`,
                    `  naamgebruik in adviesreden: De ${item.botanicalName}`,
                ];

                const specs: string[] = [];
                if (item.volwassenHoogte) specs.push(`volwassen hoogte: ${item.volwassenHoogte}`);
                if (item.kleuren?.length) specs.push(`kleur bloem: ${item.kleuren.join(", ")}`);
                if (item.kleurBlad?.length) specs.push(`kleur blad: ${item.kleurBlad.join(", ")}`);
                if (item.bloeiperiode) specs.push(`bloeiperiode: ${item.bloeiperiode}`);
                if (item.inheems !== undefined) specs.push(`inheems: ${item.inheems ? "ja" : "nee"}`);
                if (item.stikstofbehoefte) specs.push(`stikstofbehoefte: ${item.stikstofbehoefte}`);
                if (item.standplaatsen?.length) specs.push(`standplaats: ${item.standplaatsen.join(", ")}`);
                if (item.grondsoorten?.length) specs.push(`grondsoort: ${item.grondsoorten.join(", ")}`);
                if (specs.length) lines.push(`  specificaties: ${specs.join("; ")}`);

                if (item.toelichting) lines.push(`  toelichting: ${item.toelichting}`);

                if (item.vakken?.length) {
                    const vakText = item.vakken
                        .map(
                            (v) =>
                                `${vakTypeLabel[v.vakType]} van ${v.areaM2.toFixed(2)} m² (geadviseerd aantal hierin: ${v.adviceCount})`
                        )
                        .join("; ");
                    lines.push(`  gekoppeld aan: ${vakText}`);
                }

                if (item.treebedCount && item.treebedCount > 0) {
                    lines.push(
                        `  aantal boomvakken: ${item.treebedCount} (gebruik dit exacte aantal voor boompalen/boomband-sets bij deze plant, niet het aantal stuks)`
                    );
                }

                return lines.join("\n");
            })
            .join("\n");

        const materialsSummaryText = materials
            .map((m) => {
                const meta = getAccessoryCatalogMeta(m.id);
                return `- id: "${m.id}", naam: "${m.name}", categorie: "${meta.category}", beschrijving: "${meta.description || "geen beschrijving beschikbaar"}"`;
            })
            .join("\n");

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0,
            max_tokens: 4096,
            messages: [
                {
                    role: "system",
                    content:
                        "Je bent een hovenier-assistent. Je krijgt een definitieve plantenlijst met per plant volledige specificaties " +
                        "(standplaats, grondsoort, volwassen hoogte, stikstofbehoefte, toelichting) en, indien gekoppeld, het vaktype " +
                        "(plantvak/haagvak/boomvak) met de toegewezen oppervlakte in m² en het geadviseerde aantal planten daarin. " +
                        "Je krijgt ook een catalogus van tuinmaterialen/hulpmiddelen, elk met een categorie en beschrijving. " +
                        "Gebruik de plantspecificaties en vak-informatie om te bepalen WELK product het beste past (bijvoorbeeld: grondsoort/standplaats bepaalt het type bemesting; " +
                        "de m² van een vak bepaalt de hoeveelheid bemesting of bodembedekkingsmateriaal, niet het aantal planten). " +
                        "Voor boompalen en boomband geldt een vaste regel: het aanbevolen aantal moet exact gelijk zijn aan het 'aantal boomvakken' dat bij die plant vermeld staat " +
                        "(als dat veld aanwezig is) — gebruik nooit het aantal stuks/bomen daarvoor. " +
                        "Doorloop de volledige plantenlijst en stel voor ELKE plant apart na of er relevante materialen uit de catalogus bij passen — " +
                        "geef alle materialen terug die voor minstens één plant in de lijst relevant zijn, ook als dat er meer dan 3 of 5 zijn. Beperk jezelf niet tot een klein aantal voorstellen " +
                        "als de plantenlijst meerdere verschillende soorten/vakken bevat die elk hun eigen relevante producten hebben. " +
                        "Stel alleen materialen voor uit de aangeleverde catalogus (gebruik het exacte id) die daadwerkelijk helpen bij het planten/aanplanten van deze specifieke lijst. " +
                        "Negeer producten waarvan de beschrijving aangeeft dat het gereedschap/apparatuur voor de hovenier is. " +
                        "Stel niets voor bij twijfel of een onduidelijke/ontbrekende beschrijving. " +
                        "Stel elk relevant materiaal maximaal één keer voor in totaal, ook als het bij meerdere planten past. " +

                        "HOEVEELHEID BEREKENEN (suggestedQuantity) — volg deze stappen:\n" +

                        "Stap 1: bepaal het WORTELKLUITVOLUME per plant vanuit de maatvoering.\n" +
                        "• Als de maatvoering een expliciet volume bevat (bijv. '40L', '20L', '15L', '2,0L'), gebruik dan dat getal als containervolume.\n" +
                        "• Potcodevarianten zonder expliciet volume:\n" +
                        "  GM P9 / P9 / P10 / P10,5 / plug → 0,7L ; P11 / P12 / C1,3 / C1,5 → 1L ; P13 / P14 / C2 → 1,5L ;\n" +
                        "  P15 / C3 → 2L ; P17 / P18 / C5 → 3L ; C7 / C8 → 6L ; C10 → 10L.\n" +
                        "• Wortelgoed / kale wortel (bosplantsoen, 0/1, 1/0, 1/1, 1/2 enz.) → 1L ongeacht hoogte.\n" +
                        "• HO- of HA-draadkluit zonder expliciet volume (schatting op basis van stamomtrek):\n" +
                        "  6-8 HO → 15L ; 8-10 HO → 20L ; 10-12 HO → 30L ; 12-14 HO → 45L ;\n" +
                        "  14-16 HO → 60L ; 16-18 HO → 75L ; 18-20 HO → 100L ; 20-25 HO → 130L ; 25+ HO → 160L.\n" +
                        "• HO- of HA-container zonder expliciet volume: gebruik dezelfde schatting als draadkluit.\n" +
                        "• Alleen hoogte in cm (geen L, geen potcode) — schatting:\n" +
                        "  10-30 cm → 1L ; 30-60 cm → 2L ; 60-100 cm → 5L ; 100-150 cm → 10L ; 150-200 cm → 15L ; 200+ cm → 25L.\n" +
                        "• Haagelementformaten (bijv. 'Mobilane', 'Haagelement', '120x200') of bulk 'verpakt per X' → gebruik het vakoppervlak als basis, niet het wortelkluitvolume.\n" +

                        "Stap 2: bereken het BENODIGDE AANPLANTGRONDVOLUME.\n" +
                        "• Benodigde aanplantgrond per plant ≈ containervolume × 0,5 (mengverhouding 1:1 van aanplantgrond en bestaande grond).\n" +
                        "• Totaalvolume = som van (containervolume × 0,5 × aantal) over alle relevante planten.\n" +
                        "• Aantal zakken = ⌈ totaalvolume ÷ zakvolume_product ⌉ (zakvolume staat in de productbeschrijving).\n" +

                        "Stap 3: OVERIGE PRODUCTEN.\n" +
                        "• Boompalen / boomband: gebruik exact het opgegeven 'aantal boomvakken', nooit het stukaantal bomen.\n" +
                        "• Meststoffen met dosering per m² of per plant: bereken op basis van vakoppervlak (m²) of plantaantal en de productdosering.\n" +
                        "• Producten per toepassing (niet per plant/m²): gebruik 1.\n" +

                        "Vermeld de berekening beknopt in de 'reason', bijv.: 'Totaal ~135L aanplantgrond nodig (85 P9-planten × 0,35L + 2 bomen × 37L). 3 zakken van 60L.'\n\n" +

                        "Geef per voorstel een korte, concrete reden in het Nederlands (het 'reason'-veld) die uitlegt WAAROM dit product past en HOE het aantal is berekend. " +
                        "Noem GEEN plantnamen in het 'reason'-veld. Zet de Latijnse plantnamen (zonder prefix zoals 'De') in het 'plantNames'-array. " +
                        "Gebruik in de reden nooit een gedachtestreepje (—); gebruik gewone punten of komma's.",
                },
                {
                    role: "user",
                    content:
                        `Definitieve plantenlijst:\n${plantSummaryText}\n\n` +
                        `Beschikbare tuinmaterialen-catalogus:\n${materialsSummaryText}`,
                },
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "suggest_accessories",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            suggestions: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        materialId: {
                                            type: "string",
                                            description: "Het exacte id uit de aangeleverde materialencatalogus.",
                                        },
                                        suggestedQuantity: {
                                            type: "integer",
                                        },
                                        reason: {
                                            type: "string",
                                            description: "Korte uitleg in het Nederlands waarom dit product past. Noem GEEN plantnamen hier.",
                                        },
                                        plantNames: {
                                            type: "array",
                                            description: "Latijnse plantnamen (zonder 'De') waarvoor dit product relevant is.",
                                            items: { type: "string" },
                                        },
                                    },
                                    required: ["materialId", "suggestedQuantity", "reason", "plantNames"],
                                    additionalProperties: false,
                                },
                            },
                        },
                        required: ["suggestions"],
                        additionalProperties: false,
                    },
                },
            },
        });

        const rawContent = completion.choices[0]?.message?.content;
        const parsed = rawContent ? (JSON.parse(rawContent) as { suggestions?: unknown }) : null;

        const suggestions = applyStandardAccessoryRules(
            uniqueSuggestionsByMaterial(parsed?.suggestions, materialsById),
            items,
            materialsById
        );

        const response: AccessoryAdviceResponse = { suggestions };
        return NextResponse.json(response, { status: 200 });
    } catch (err) {
        console.error("[/api/plant-advice/accessories] Error:", err);
        return NextResponse.json(
            { error: "Failed to generate accessory advice", detail: String(err) },
            { status: 500 }
        );
    }
}
