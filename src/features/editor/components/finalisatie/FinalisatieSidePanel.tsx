"use client";

import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useProjectStore } from "@/state/projectStore";
import { usePlantSelectionStore } from "@/features/editor/state/plantSelectionStore";
import { usePlantVariantStore } from "@/features/editor/state/plantVariantStore";
import { buildAdviceData, type ProjectPlantLike } from "@/features/editor/lib/plantAdvice";
import { getPlantUnitPriceForQuantity, withResolvedBulkPrices } from "@/features/editor/lib/plantPricing";
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

type PdfYesNoValue = boolean | null;
type PdfPriceType = "" | "wholesale" | "consumer" | "custom";

function PdfYesNoOption(props: {
    label: string;
    selected: boolean;
    onClick: () => void;
}) {
    const { label, selected, onClick } = props;

    return (
        <button
            type="button"
            onClick={onClick}
            className="flex h-9 items-center gap-2 rounded-[4px] border px-3 text-[13px] transition-all"
            style={{
                minWidth: 92,
                borderColor: selected ? COLORS.orange : COLORS.border,
                background: selected ? COLORS.orangeLight : "#FFFFFF",
                color: COLORS.text,
                cursor: "pointer",
            }}
        >
            <img
                src={selected ? "/icons/checkbox-checked.svg" : "/icons/checkbox-unchecked.svg"}
                alt=""
                style={{ width: 18, height: 18, display: "block" }}
            />
            <span>{label}</span>
        </button>
    );
}

function PdfYesNoField(props: {
    title: string;
    value: PdfYesNoValue;
    onChange: (value: PdfYesNoValue) => void;
}) {
    const { title, value, onChange } = props;

    return (
        <div>
            <div className="mb-3 text-[15px] font-bold leading-[1.25] text-black">
                {title}
            </div>
            <div className="flex gap-5">
                <PdfYesNoOption
                    label="Ja"
                    selected={value === true}
                    onClick={() => onChange(value === true ? null : true)}
                />
                <PdfYesNoOption
                    label="Nee"
                    selected={value === false}
                    onClick={() => onChange(value === false ? null : false)}
                />
            </div>
        </div>
    );
}

function PdfDownloadModal(props: {
    open: boolean;
    onCancel: () => void;
    onDownload: (settings: {
        showQuantities: boolean;
        showPlantingDrawing: boolean;
        showPrices: boolean;
        priceType: PdfPriceType;
        customMargin: string;
    }) => void;
}) {
    const { open, onCancel, onDownload } = props;
    const [showQuantities, setShowQuantities] = React.useState<PdfYesNoValue>(null);
    const [showPlantingDrawing, setShowPlantingDrawing] = React.useState<PdfYesNoValue>(null);
    const [showPrices, setShowPrices] = React.useState<PdfYesNoValue>(null);
    const [priceType, setPriceType] = React.useState<PdfPriceType>("");
    const [customMargin, setCustomMargin] = React.useState("");
    const [priceTypeOpen, setPriceTypeOpen] = React.useState(false);

    useScrollLock(open);

    React.useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onCancel();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onCancel]);

    React.useEffect(() => {
        if (showPrices !== true) {
            setPriceType("");
            setCustomMargin("");
            setPriceTypeOpen(false);
        }
    }, [showPrices]);

    React.useEffect(() => {
        if (priceType !== "custom") {
            setCustomMargin("");
        }
    }, [priceType]);

    if (!open) return null;

    const priceTypeOptions: Array<{ value: Exclude<PdfPriceType, "">; label: string }> = [
        {
            value: "wholesale",
            label: "Groothandelprijs (prijzen worden in rood weergegeven)",
        },
        {
            value: "consumer",
            label: "Consumentenadviesprijs (100% marge)",
        },
        {
            value: "custom",
            label: "Eigen marge",
        },
    ];

    const selectedPriceTypeLabel =
        priceTypeOptions.find((option) => option.value === priceType)?.label ?? "";

    const handleDownload = () => {
        onDownload({
            showQuantities: showQuantities === true,
            showPlantingDrawing: showPlantingDrawing === true,
            showPrices: showPrices === true,
            priceType,
            customMargin,
        });
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{
                background: "rgba(0,0,0,0.33)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
            }}
            onMouseDown={onCancel}
        >
            <div
                className="relative w-[620px] max-w-[calc(100vw-48px)] overflow-visible rounded-md bg-white shadow-lg"
                style={{ border: `1px solid ${COLORS.border}` }}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    aria-label="Popup sluiten"
                    onClick={onCancel}
                    className="absolute right-4 top-4 flex items-center justify-center"
                    style={{
                        width: 24,
                        height: 24,
                        padding: 0,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        cursor: "pointer",
                        zIndex: 2,
                    }}
                >
                    <img
                        src="/icons/cancel.svg"
                        alt=""
                        style={{
                            width: 18,
                            height: 18,
                            display: "block",
                            filter: "brightness(0)",
                        }}
                    />
                </button>

                <div className="px-8 pt-7 pb-6">
                    <h2 className="text-[22px] font-bold text-black">
                        PDF Downloaden
                    </h2>
                </div>

                <div style={{ height: 1, background: COLORS.border }} />

                <div className="px-8 py-6">
                    <div className="flex flex-col gap-7">
                        <PdfYesNoField
                            title="Toon aantallen in PDF"
                            value={showQuantities}
                            onChange={setShowQuantities}
                        />
                        <PdfYesNoField
                            title="Toon beplantingsplantekening in PDF"
                            value={showPlantingDrawing}
                            onChange={setShowPlantingDrawing}
                        />
                        <PdfYesNoField
                            title="Toon prijzen in PDF"
                            value={showPrices}
                            onChange={setShowPrices}
                        />
                    </div>

                    {showPrices === true && (
                        <div className="mt-7">
                            <label
                                htmlFor="pdf-price-type"
                                className="mb-3 block text-[15px] font-bold text-black"
                            >
                                Prijs type
                            </label>

                            <div className="relative">
                                <button
                                    id="pdf-price-type"
                                    type="button"
                                    onClick={() => setPriceTypeOpen((value) => !value)}
                                    className="flex h-12 w-full items-center justify-between rounded-[4px] border-0 px-4 text-left text-[13px] outline-none transition-all"
                                    style={{
                                        background: "#F9F8F7",
                                        color: selectedPriceTypeLabel ? COLORS.text : "#898988",
                                        cursor: "pointer",
                                    }}
                                >
                                    <span className="truncate">
                                        {selectedPriceTypeLabel ||
                                            "Selecteer de prijstype voor de PDF..."}
                                    </span>
                                    <img
                                        src="/icons/chevron-down.svg"
                                        alt=""
                                        style={{
                                            width: 14,
                                            height: 14,
                                            flex: "0 0 auto",
                                            transform: priceTypeOpen ? "rotate(180deg)" : "none",
                                            transition: "transform 0.18s ease",
                                            filter:
                                                "brightness(0) saturate(100%) invert(56%) sepia(4%) saturate(38%) hue-rotate(314deg) brightness(95%) contrast(86%)",
                                        }}
                                    />
                                </button>

                                {priceTypeOpen && (
                                    <div
                                        className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-[8px] border bg-white py-1 shadow-lg"
                                        style={{
                                            borderColor: COLORS.border,
                                            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.12)",
                                        }}
                                    >
                                        {priceTypeOptions.map((option) => {
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setPriceType(option.value);
                                                        setPriceTypeOpen(false);
                                                    }}
                                                    className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] transition-colors"
                                                    style={{
                                                        background: "#FFFFFF",
                                                        color: COLORS.text,
                                                        fontWeight: 400,
                                                        cursor: "pointer",
                                                    }}
                                                    onMouseEnter={(event) => {
                                                        event.currentTarget.style.background = "#F9F8F7";
                                                    }}
                                                    onMouseLeave={(event) => {
                                                        event.currentTarget.style.background = "#FFFFFF";
                                                    }}
                                                >
                                                    <span>{option.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {priceType === "custom" && (
                                <div className="mt-4">
                                    <label
                                        htmlFor="pdf-custom-margin"
                                        className="mb-3 block text-[15px] font-bold text-black"
                                    >
                                        Eigen marge
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="pdf-custom-margin"
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={customMargin}
                                            onChange={(event) => {
                                                const raw = event.target.value;
                                                if (raw === "") {
                                                    setCustomMargin("");
                                                    return;
                                                }
                                                const next = Math.max(
                                                    0,
                                                    Math.min(100, Number(raw))
                                                );
                                                setCustomMargin(String(next));
                                            }}
                                            placeholder="Vul marge in..."
                                            className="h-12 w-full rounded-[4px] border-0 px-4 pr-10 text-[13px] outline-none"
                                            style={{
                                                background: "#F9F8F7",
                                                color: COLORS.text,
                                            }}
                                        />
                                        <span
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px]"
                                            style={{ color: "#898988" }}
                                        >
                                            %
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ height: 1, background: COLORS.border }} />

                <div className="flex items-center gap-4 px-8 py-5">
                    <button
                        type="button"
                        className="h-12 flex-1 rounded-md text-[16px] font-semibold"
                        style={{
                            cursor: "pointer",
                            border: "1px solid #BDBDBD",
                            background: "#F9F8F7",
                            color: "#898988",
                        }}
                        onClick={onCancel}
                    >
                        Annuleren
                    </button>

                    <button
                        type="button"
                        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md text-[13px] font-semibold text-white"
                        style={{
                            cursor: "pointer",
                            border: `1px solid ${COLORS.orange}`,
                            background: COLORS.orange,
                        }}
                        onClick={handleDownload}
                    >
                        <img
                            src="/icons/download.svg"
                            alt=""
                            style={{
                                width: 16,
                                height: 16,
                                display: "block",
                                filter: "brightness(0) invert(1)",
                            }}
                        />
                        Download PDF
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

function formatEuro(value: number): string {
    return new Intl.NumberFormat("nl-NL", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export default function FinalisatieSidePanel() {
    const [isPdfModalOpen, setIsPdfModalOpen] = React.useState(false);
    const objects = useProjectStore((s: { objects: PolyObject[] }) => s.objects);
    const plantbedLinks = useProjectStore((s: { plantbedLinks: Record<string, string[]> }) => s.plantbedLinks);
    const distributionOverrides = useProjectStore((s: { distributionOverrides: Record<string, Record<string, number>> }) => s.distributionOverrides);
    const plantListItems = usePlantSelectionStore((s) => s.plantListItems);
    const variantCache = usePlantVariantStore((s) => s.cache);
    const fetchVariants = usePlantVariantStore((s) => s.fetchVariants);

    React.useEffect(() => {
        for (const item of plantListItems) {
            if (item.plant.category !== "Tuinmaterialen") {
                fetchVariants(item.plant.id);
            }
        }
    }, [plantListItems, fetchVariants]);

    const pricedPlantListItems = useMemo(
        () =>
            plantListItems.map((item) =>
                withResolvedBulkPrices(item, variantCache[item.plant.id]?.variants ?? [])
            ),
        [plantListItems, variantCache]
    );

    // Splits planten en tuinmaterialen — tuinmaterialen nooit via plantbedLinks tellen
    const tuinmaterialenIds = useMemo(
        () => new Set(pricedPlantListItems.filter((i) => i.plant.category === "Tuinmaterialen").map((i) => i.id)),
        [pricedPlantListItems]
    );

    const plants = useMemo<ProjectPlantLike[]>(() => {
        return pricedPlantListItems
            .filter((item) => !tuinmaterialenIds.has(item.id))
            .map((item) => ({
                id: item.id,
                latin: item.plant.botanicalName,
                dutch: item.plant.dutchName,
                planthoeveelheidPerM2: item.plant.planthoeveelheidPerM2,
            }));
    }, [pricedPlantListItems, tuinmaterialenIds]);

    const { subtotal, btw, total } = useMemo(() => {
        const quantityByItemId = new Map<string, number>();

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

                const count = row.adviceCount;
                quantityByItemId.set(
                    row.plantId,
                    (quantityByItemId.get(row.plantId) ?? 0) + count
                );
            }
        }

        let subtotal = 0;
        for (const [itemId, adviceCount] of quantityByItemId) {
            const item = pricedPlantListItems.find((listItem) => listItem.id === itemId);
            const effectiveCount = item && item.quantity > 0 ? item.quantity : adviceCount;
            const pricePerPiece = getPlantUnitPriceForQuantity(item, effectiveCount) ?? 0;
            subtotal += effectiveCount * pricePerPiece;
        }

        // Tuinmaterialen altijd apart optellen (nooit via plantbedLinks)
        for (const item of pricedPlantListItems) {
            if (!tuinmaterialenIds.has(item.id)) continue;
            const count = item.quantity > 0 ? item.quantity : 1;
            const price = getPlantUnitPriceForQuantity(item, count) ?? 0;
            if (price <= 0) continue;
            subtotal += count * price;
        }

        const btw = subtotal * 0.09;
        const total = subtotal + btw;

        return { subtotal, btw, total };
    }, [objects, plantbedLinks, distributionOverrides, plants, pricedPlantListItems, tuinmaterialenIds]);

    return (
        <div className="flex flex-col gap-4">
            <PdfDownloadModal
                open={isPdfModalOpen}
                onCancel={() => setIsPdfModalOpen(false)}
                onDownload={() => {
                    setIsPdfModalOpen(false);
                }}
            />

            {/* Download PDF */}
            <button
                type="button"
                onClick={() => setIsPdfModalOpen(true)}
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
