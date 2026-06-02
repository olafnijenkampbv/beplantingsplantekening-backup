"use client";

import React, { useMemo } from "react";
import { useProjectStore } from "@/state/projectStore";
import { usePlantSelectionStore } from "@/features/editor/state/plantSelectionStore";
import { buildAdviceData, type ProjectPlantLike } from "@/features/editor/lib/plantAdvice";
import type { PolyObject } from "@/state/projectStore";

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    green: "#58694C",
    orange: "#E94E1B",
    orangeLight: "#FFE5DD",
    text: "#111111",
    softText: "#6B6B6B",
};

function formatEuro(value: number): string {
    return new Intl.NumberFormat("nl-NL", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export default function FinalisatieSidePanel() {
    const objects = useProjectStore((s: { objects: PolyObject[] }) => s.objects);
    const plantbedLinks = useProjectStore((s: { plantbedLinks: Record<string, string[]> }) => s.plantbedLinks);
    const distributionOverrides = useProjectStore((s: { distributionOverrides: Record<string, Record<string, number>> }) => s.distributionOverrides);
    const plantListItems = usePlantSelectionStore((s) => s.plantListItems);

    // Splits planten en tuinmaterialen — tuinmaterialen nooit via plantbedLinks tellen
    const tuinmaterialenIds = useMemo(
        () => new Set(plantListItems.filter((i) => i.plant.category === "Tuinmaterialen").map((i) => i.id)),
        [plantListItems]
    );

    const plants = useMemo<ProjectPlantLike[]>(() => {
        return plantListItems
            .filter((item) => !tuinmaterialenIds.has(item.id))
            .map((item) => ({
                id: item.id,
                latin: item.plant.botanicalName,
                dutch: item.plant.dutchName,
                planthoeveelheidPerM2: item.plant.planthoeveelheidPerM2,
            }));
    }, [plantListItems, tuinmaterialenIds]);

    const { subtotal, btw, total } = useMemo(() => {
        let subtotal = 0;

        for (const [objectId, linkedPlantIds] of Object.entries(plantbedLinks)) {
            if (!linkedPlantIds || linkedPlantIds.length === 0) continue;

            const object = objects.find((o) => o.id === objectId);
            if (!object) continue;

            // Stale tuinmaterialen-IDs uitsluiten
            const plantOnlyIds = linkedPlantIds.filter((id) => !tuinmaterialenIds.has(id));
            if (plantOnlyIds.length === 0) continue;

            const adviceData = buildAdviceData({
                selectedObject: object,
                currentType: object.type,
                linkedPlantIds: plantOnlyIds,
                plants,
                distributionOverrides: distributionOverrides[objectId] ?? {},
            });

            for (const row of adviceData.rows) {
                if (row.adviceCount === null) continue;

                const listItem = plantListItems.find(
                    (item) => item.id === row.plantId
                );

                const effectiveCount =
                    listItem && listItem.quantity > 0
                        ? listItem.quantity
                        : row.adviceCount;

                const pricePerPiece = listItem?.plant?.pricePerPiece ?? 0;

                subtotal += effectiveCount * pricePerPiece;
            }
        }

        // Tuinmaterialen altijd apart optellen (nooit via plantbedLinks)
        for (const item of plantListItems) {
            if (!tuinmaterialenIds.has(item.id)) continue;
            const price = item.plant.pricePerPiece ?? 0;
            if (price <= 0) continue;
            const count = item.quantity > 0 ? item.quantity : 1;
            subtotal += count * price;
        }

        const btw = subtotal * 0.09;
        const total = subtotal + btw;

        return { subtotal, btw, total };
    }, [objects, plantbedLinks, distributionOverrides, plants, plantListItems, tuinmaterialenIds]);

    return (
        <div className="flex flex-col gap-4">
            {/* Download PDF */}
            <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] py-3 font-semibold text-white"
                style={{
                    backgroundColor: COLORS.orange,
                    border: "none",
                    fontSize: 15,
                }}
            >
                <img
                    src="/icons/download.svg"
                    alt=""
                    style={{
                        width: 18,
                        height: 18,
                        display: "block",
                        filter: "brightness(0) invert(1)",
                    }}
                />
                Download PDF
            </button>

            {/* Visualiseer met AI */}
            <button
                type="button"
                className="flex w-full cursor-pointer items-start gap-3 rounded-[10px] px-4 py-3 text-left"
                style={{
                    backgroundColor: "#E0DED4",
                    border: "none",
                }}
            >
                <img
                    src="/icons/magic-wand.svg"
                    alt=""
                    style={{ width: 18, height: 18, display: "block", flexShrink: 0, marginTop: 2 }}
                />
                <div className="min-w-0">
                    <p
                        className="text-[14px] font-semibold"
                        style={{ color: COLORS.green }}
                    >
                        Visualiseer tekening met AI
                    </p>
                    <p
                        className="mt-0.5 text-[13px]"
                        style={{ color: COLORS.text }}
                    >
                        Genereer een realistische impressie van de tekening.
                    </p>
                </div>
            </button>

            {/* Prijsopgave */}
            <section
                className="rounded-[10px] border p-5"
                style={{
                    backgroundColor: COLORS.cardBg,
                    borderColor: COLORS.border,
                    boxShadow: "5px 3px 46px -25px rgba(0, 0, 0, 0.25)",
                }}
            >
                <h2
                    className="text-[17px] font-bold"
                    style={{ color: COLORS.green }}
                >
                    Prijsopgave
                </h2>

                <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span
                            className="text-[14px]"
                            style={{ color: COLORS.text }}
                        >
                            Totaal (excl. BTW)
                        </span>
                        <span
                            className="text-[14px] font-semibold"
                            style={{ color: COLORS.orange }}
                        >
                            {formatEuro(subtotal)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between">
                        <span
                            className="text-[14px]"
                            style={{ color: COLORS.text }}
                        >
                            BTW (9%)
                        </span>
                        <span
                            className="text-[14px]"
                            style={{ color: COLORS.text }}
                        >
                            {formatEuro(btw)}
                        </span>
                    </div>
                </div>

                <div
                    className="my-4 h-[2px] w-full"
                    style={{ backgroundColor: COLORS.border }}
                />

                <div className="flex items-center justify-between">
                    <span
                        className="text-[15px] font-bold"
                        style={{ color: COLORS.text }}
                    >
                        Totaalbedrag
                    </span>
                    <span
                        className="text-[15px] font-bold"
                        style={{ color: COLORS.text }}
                    >
                        {formatEuro(total)}
                    </span>
                </div>

                <button
                    type="button"
                    className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] py-3 font-semibold text-white"
                    style={{
                        backgroundColor: COLORS.orange,
                        border: "none",
                        fontSize: 15,
                    }}
                >
                    <img
                        src="/icons/offerte.svg"
                        alt=""
                        style={{
                            width: 18,
                            height: 18,
                            display: "block",
                            filter: "brightness(0) invert(1)",
                        }}
                    />
                    Offerte direct bestellen
                </button>
            </section>
        </div>
    );
}