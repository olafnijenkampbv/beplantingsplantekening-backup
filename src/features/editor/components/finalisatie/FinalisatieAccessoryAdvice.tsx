"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePlantSelectionStore, type PlantListItem } from "@/features/editor/state/plantSelectionStore";
import { GardenMaterialGridCard } from "@/features/editor/components/plantSelection/GardenMaterialGrid";
import type { ApiGardenMaterial, ApiGardenMaterialVariant } from "@/lib/db/gardenMaterialTypes";
import { useProjectStore, type PolyObject } from "@/state/projectStore";
import { buildPlantAdviceInfoForList } from "./FinalisatiePlantList";
import type { ProjectPlantLike } from "@/features/editor/lib/plantAdvice";
import type {
    AccessoryAdviceInputItem,
    AccessoryAdviceVakInfo,
} from "@/app/api/plant-advice/accessories/route";

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    green: "#58694C",
    muted: "#6B7280",
    text: "#111111",
    orange: "#E94E1B",
};

type AccessorySuggestion = {
    material: ApiGardenMaterial;
    suggestedQuantity: number;
    reason: string;
};

type CachedAccessoryAdvice = {
    key: string;
    suggestions: AccessorySuggestion[];
};

const ACCESSORY_ADVICE_CACHE_KEY = "finalisatie:accessory-advice:v5";

function buildAccessoryAdviceCacheKey(
    items: PlantListItem[],
    requestItems: AccessoryAdviceInputItem[]
): string {
    return items
        .map((item, index) => {
            const requestItem = requestItems[index];
            return `${item.id}:${item.plant.id}:${item.plant.category}:${item.size}:treebeds=${requestItem?.treebedCount ?? 0}`;
        })
        .sort((a, b) => a.localeCompare(b, "nl"))
        .join("|");
}

function readCachedAccessoryAdvice(fetchKey: string): AccessorySuggestion[] | null {
    if (typeof window === "undefined") return null;

    try {
        const raw = window.localStorage.getItem(ACCESSORY_ADVICE_CACHE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<CachedAccessoryAdvice>;
        if (parsed.key !== fetchKey || !Array.isArray(parsed.suggestions)) return null;

        return parsed.suggestions.filter((suggestion): suggestion is AccessorySuggestion => {
            return (
                !!suggestion &&
                typeof suggestion === "object" &&
                !!suggestion.material &&
                typeof suggestion.material.id === "string" &&
                typeof suggestion.suggestedQuantity === "number" &&
                typeof suggestion.reason === "string"
            );
        });
    } catch {
        return null;
    }
}

function writeCachedAccessoryAdvice(fetchKey: string, suggestions: AccessorySuggestion[]): void {
    if (typeof window === "undefined") return;

    try {
        const cache: CachedAccessoryAdvice = { key: fetchKey, suggestions };
        window.localStorage.setItem(ACCESSORY_ADVICE_CACHE_KEY, JSON.stringify(cache));
    } catch {
        // Cache is an optimization. If storage is unavailable, advice still works normally.
    }
}

export default function FinalisatieAccessoryAdvice() {
    const plantListItems = usePlantSelectionStore((s) => s.plantListItems);
    const setPlantListItems = usePlantSelectionStore((s) => s.setPlantListItems);

    const objects = useProjectStore((s: { objects: PolyObject[] }) => s.objects);
    const plantbedLinks = useProjectStore(
        (s: { plantbedLinks: Record<string, string[]> }) => s.plantbedLinks
    );
    const distributionOverrides = useProjectStore(
        (s: { distributionOverrides: Record<string, Record<string, number>> }) =>
            s.distributionOverrides
    );

    const [suggestions, setSuggestions] = useState<AccessorySuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasFetchedForRef = useRef<string | null>(null);
    const sliderRef = useRef<HTMLDivElement | null>(null);
    const CARD_WIDTH = 300;

    const scrollSlider = (direction: "left" | "right") => {
        sliderRef.current?.scrollBy({
            left: direction === "left" ? -CARD_WIDTH : CARD_WIDTH,
            behavior: "smooth",
        });
    };

    const plants = useMemo<ProjectPlantLike[]>(
        () =>
            plantListItems.map((item) => ({
                id: item.id,
                latin: item.plant.botanicalName,
                dutch: item.plant.dutchName,
                planthoeveelheidPerM2: item.plant.planthoeveelheidPerM2,
            })),
        [plantListItems]
    );

    useEffect(() => {
        const realItems = plantListItems.filter(
            (item) => item.plant.category !== "Tuinmaterialen"
        );

        if (realItems.length === 0) {
            setSuggestions([]);
            return;
        }

        const requestItems: AccessoryAdviceInputItem[] = realItems.map((item) => {
            const adviceInfo = buildPlantAdviceInfoForList(
                item.id,
                plantListItems,
                objects,
                plants,
                plantbedLinks,
                distributionOverrides
            );
            const vakken: AccessoryAdviceVakInfo[] =
                adviceInfo?.vakken.map((v) => ({
                    vakType: v.vakType,
                    areaM2: v.assignedArea,
                    adviceCount: v.advice,
                })) ?? [];

            const treebedCount = vakken.filter((v) => v.vakType === "treebed").length;

            return {
                botanicalName: item.plant.botanicalName,
                dutchName: item.plant.dutchName,
                category: item.plant.category,
                appGroup: item.plant.appGroup,
                size: item.size,
                quantity: item.quantity,
                volwassenHoogte: item.plant.volwassenHoogte,
                kleuren: item.plant.kleuren,
                kleurBlad: item.plant.kleurBlad,
                bloeiperiode: item.plant.bloeiperiode,
                inheems: item.plant.inheems,
                stikstofbehoefte: item.plant.stikstofbehoefte,
                standplaatsen: item.plant.standplaatsen,
                grondsoorten: item.plant.grondsoorten,
                toelichting: item.plant.toelichting,
                vakken,
                treebedCount,
            };
        });

        const fetchKey = buildAccessoryAdviceCacheKey(realItems, requestItems);

        if (hasFetchedForRef.current === fetchKey) return;
        hasFetchedForRef.current = fetchKey;

        const cachedSuggestions = readCachedAccessoryAdvice(fetchKey);
        if (cachedSuggestions) {
            setSuggestions(cachedSuggestions);
            setIsLoading(false);
            setError(null);
            return;
        }

        let isCancelled = false;
        setIsLoading(true);
        setError(null);

        fetch("/api/plant-advice/accessories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: requestItems,
            }),
        })
            .then(async (res) => {
                if (!res.ok) {
                    const body = await res.json().catch(() => null);
                    throw new Error(body?.error ?? `HTTP ${res.status}`);
                }
                return res.json();
            })
            .then((data: { suggestions: AccessorySuggestion[] }) => {
                if (isCancelled) return;
                const nextSuggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
                setSuggestions(nextSuggestions);
                writeCachedAccessoryAdvice(fetchKey, nextSuggestions);
            })
            .catch((err) => {
                if (isCancelled) return;
                setError(err instanceof Error ? err.message : String(err));
            })
            .finally(() => {
                if (!isCancelled) setIsLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [plantListItems]);

    const handleAddSuggestion = (
        suggestion: AccessorySuggestion,
        material: ApiGardenMaterial,
        variant: ApiGardenMaterialVariant
    ) => {
        const newItem: PlantListItem = {
            id: `plant-list-${material.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            plant: {
                id: material.id,
                botanicalName: material.name,
                dutchName: material.name,
                category: "Tuinmaterialen",
                appGroup: "overig",
                standplaatsen: [],
                grondsoorten: [],
                bloeiperiode: "",
                kleuren: [],
                kleurBlad: [],
                volwassenHoogte: "",
                maxHeightCm: 0,
                planthoeveelheidPerM2: 1,
                inheems: false,
                stikstofbehoefte: "",
                toelichting: "",
                imageUrl: material.imageUrl,
                additionalImageUrls: [],
                pricePerPiece: variant.price,
                inStock: variant.availability === "in_stock",
                keurmerken: [],
            },
            size: variant.sizeLabel,
            fixedSize: true,
            bulkPrices: [],
            note: "",
            quantity: suggestion.suggestedQuantity,
            isSelected: false,
            addedFrom: "accessory-advice",
            adviceQuantity: suggestion.suggestedQuantity,
            adviceReason: suggestion.reason,
        };

        const currentItems = usePlantSelectionStore.getState().plantListItems;
        setPlantListItems([...currentItems, newItem]);
    };

    if (suggestions.length === 0 && !isLoading && !error) return null;

    return (
        <section
            className="rounded-[10px] border p-5"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor: COLORS.border,
                boxShadow: "5px 3px 46px -25px rgba(0, 0, 0, 0.25)",
            }}
        >
            <h2
                className="text-[20px] font-semibold leading-[1.2]"
                style={{ color: COLORS.text }}
            >
                Aanplantmateriaal
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: COLORS.muted }}>
                Op basis van je plantenlijst stellen wij deze producten voor om het aanplanten te ondersteunen.
            </p>

            {isLoading ? (
                <div className="mt-5 flex items-center gap-3" style={{ color: COLORS.muted }}>
                    <div
                        style={{
                            width: 20,
                            height: 20,
                            border: "2.5px solid #E3E2E2",
                            borderTopColor: COLORS.green,
                            borderRadius: "50%",
                            animation: "spin 0.8s linear infinite",
                        }}
                    />
                    <span className="text-[14px]">We bekijken jou plantenlijst…</span>
                </div>
            ) : error ? (
                <div
                    className="mt-4 rounded-[8px] border px-4 py-3 text-[14px]"
                    style={{ borderColor: "#F4C8B8", backgroundColor: "#FFF7F4", color: COLORS.orange }}
                >
                    Advies kon niet worden opgehaald: {error}
                </div>
            ) : suggestions.length > 3 ? (
                <div className="relative mt-5">
                    <button
                        type="button"
                        onClick={() => scrollSlider("left")}
                        aria-label="Vorige producten"
                        className="absolute left-[-14px] top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white shadow-md"
                        style={{ border: `1px solid ${COLORS.border}` }}
                    >
                        <img src="/icons/chevron-left.svg" alt="" style={{ width: 16, height: 16, display: "block" }} />
                    </button>

                    <div
                        ref={sliderRef}
                        className="app-hidden-scrollbar flex items-stretch gap-4 overflow-x-auto"
                        style={{ scrollSnapType: "x proximity" }}
                    >
                        {suggestions.map((suggestion) => (
                            <div
                                key={suggestion.material.id}
                                style={{ flex: `0 0 ${CARD_WIDTH}px`, scrollSnapAlign: "start" }}
                            >
                                <GardenMaterialGridCard
                                    material={suggestion.material}
                                    reason={
                                        suggestion.suggestedQuantity > 1
                                            ? `${suggestion.reason} (aanbevolen aantal: ${suggestion.suggestedQuantity})`
                                            : suggestion.reason
                                    }
                                    onAddToPlantList={(material, variant) =>
                                        handleAddSuggestion(suggestion, material, variant)
                                    }
                                />
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => scrollSlider("right")}
                        aria-label="Volgende producten"
                        className="absolute right-[-14px] top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white shadow-md"
                        style={{ border: `1px solid ${COLORS.border}` }}
                    >
                        <img src="/icons/chevron-right.svg" alt="" style={{ width: 16, height: 16, display: "block" }} />
                    </button>
                </div>
            ) : (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {suggestions.map((suggestion) => (
                        <GardenMaterialGridCard
                            key={suggestion.material.id}
                            material={suggestion.material}
                            reason={
                                suggestion.suggestedQuantity > 1
                                    ? `${suggestion.reason} (aanbevolen aantal: ${suggestion.suggestedQuantity})`
                                    : suggestion.reason
                            }
                            onAddToPlantList={(material, variant) =>
                                handleAddSuggestion(suggestion, material, variant)
                            }
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
