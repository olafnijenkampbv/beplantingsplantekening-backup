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
        materialId: "VIVIZUUR",
        shouldApply: (items) =>
            hasPlantingSoilStandardCategory(items) || hasTreeSupportStandardCategory(items),
        getQuantity: () => 1,
        getReason: (items) =>
            buildStandardReason(
                "DCM Vivimus zuurminnend kan goed van pas komen bij deze planten:",
                getVivimusStandardItems(items),
                "Deze beplanting kan profiteren van aanplantgrond die de bodemstructuur verbetert en de wortelaanslag ondersteunt, vooral bij soorten die een humusrijke of licht zure bodem waarderen."
            ),
    },
    {
        materialId: "TUTURF40",
        shouldApply: hasPlantingSoilStandardCategory,
        getQuantity: () => 1,
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

function uniqueSuggestionsByMaterial(
    rawSuggestions: unknown,
    materialsById: Map<string, ApiGardenMaterial>
): AccessoryAdviceSuggestion[] {
    if (!Array.isArray(rawSuggestions)) return [];

    const byMaterialId = new Map<
        string,
        { material: ApiGardenMaterial; suggestedQuantity: number; reasons: string[] }
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

        const existing = byMaterialId.get(material.id);
        if (existing) {
            existing.suggestedQuantity = Math.max(existing.suggestedQuantity, quantity);
            if (reason) existing.reasons.push(reason);
        } else {
            byMaterialId.set(material.id, {
                material,
                suggestedQuantity: quantity,
                reasons: reason ? [reason] : [],
            });
        }
    }

    return Array.from(byMaterialId.values()).map((suggestion) => ({
        material: suggestion.material,
        suggestedQuantity: suggestion.suggestedQuantity,
        reason: combineReasons(suggestion.reasons),
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
        const reason = rule.getReason(items);
        const existing = byMaterialId.get(material.id);

        if (existing) {
            byMaterialId.set(material.id, {
                ...existing,
                suggestedQuantity: Math.max(existing.suggestedQuantity, quantity),
                reason,
            });
        } else {
            byMaterialId.set(material.id, {
                material,
                suggestedQuantity: quantity,
                reason,
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
            max_tokens: 2048,
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
                        "Geef per voorstel een korte, concrete reden in het Nederlands die verwijst naar de specifieke plant(en) en/of vak-informatie waarop het voorstel is gebaseerd. " +
                        "Wanneer je een specifieke plant noemt, gebruik dan exact het opgegeven naamgebruik in adviesreden: 'De [Latijnse naam]'. Gebruik geen Nederlandse plantnaam in de reden. " +
                        "Wanneer één materiaal bij meerdere planten past, mag je die planten apart benoemen met alleen hun Latijnse naam. De server voegt dubbele materialen samen en maakt daar bulletpoints van. " +
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
                                            minimum: 1,
                                        },
                                        reason: {
                                            type: "string",
                                            description: "Korte reden in het Nederlands, max 1 zin.",
                                        },
                                    },
                                    required: ["materialId", "suggestedQuantity", "reason"],
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
