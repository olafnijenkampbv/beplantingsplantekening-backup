"use client";

import React, { useState } from "react";
import { PlantImg } from "@/features/editor/components/PlantImg";
import { APP_NOTIFICATIONS, useAppNotify } from "@/state/allNotifications";
import type { ApiGardenMaterial, ApiGardenMaterialVariant } from "@/lib/db/gardenMaterialTypes";
import type { ViewMode } from "@/features/editor/lib/plantSelectionDummyData";

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    orange: "#E94E1B",
    text: "#111111",
    muted: "#6B7280",
    green: "#58694C",
};

const GREEN_ICON_FILTER =
    "brightness(0) saturate(100%) invert(36%) sepia(13%) saturate(707%) hue-rotate(56deg) brightness(92%) contrast(86%)";

function formatPrice(price: number): string {
    if (!price || price <= 0) return "";
    return `€${price.toFixed(2).replace(".", ",")} p/st`;
}

// One card per variant — matches the style of SearchModeGridCard / SearchModeListCard
function GardenMaterialGridCard(props: {
    material: ApiGardenMaterial;
    variant: ApiGardenMaterialVariant;
    onAddToPlantList: (material: ApiGardenMaterial, variant: ApiGardenMaterialVariant) => void;
}) {
    const { material, variant, onAddToPlantList } = props;
    const notify = useAppNotify();
    const [isAdded, setIsAdded] = useState(false);
    const [isCartHovered, setIsCartHovered] = useState(false);
    const inStock = variant.availability === "in_stock";

    const handleAdd = () => {
        onAddToPlantList(material, variant);
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(material.name));
        setIsAdded(true);
        window.setTimeout(() => setIsAdded(false), 3200);
    };

    return (
        <div
            className="overflow-hidden rounded-[8px] border"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor: COLORS.border,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
        >
            <div
                className="relative overflow-hidden bg-[#F1F1EE]"
                style={{ aspectRatio: "1 / 0.82" }}
            >
                <PlantImg
                    src={material.imageUrl}
                    alt={material.name}
                    className="block h-full w-full"
                />
                <div className="absolute right-2 top-2">
                    <span
                        className="inline-flex items-center gap-2 rounded-full px-3 py-[6px] text-[11px] font-semibold"
                        style={{
                            backgroundColor: inStock ? "#DEFFDE" : "#FDFFC6",
                            color: inStock ? "#008000" : "#807300",
                        }}
                    >
                        <span
                            className="rounded-full"
                            style={{ width: 7, height: 7, backgroundColor: inStock ? "#008000" : "#807300" }}
                        />
                        {inStock ? "Op voorraad" : "Binnen een week leverbaar"}
                    </span>
                </div>
            </div>

            <div className="flex min-h-[132px] flex-col p-3">
                <div
                    className="text-[15px] font-semibold leading-[1.35]"
                    style={{ color: COLORS.text }}
                >
                    {material.name}
                </div>

                {variant.sizeLabel ? (
                    <div
                        className="mt-3 text-[13px] leading-[1.35]"
                        style={{ color: COLORS.text }}
                    >
                        {variant.sizeLabel}
                    </div>
                ) : null}

                <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                    {formatPrice(variant.price) ? (
                        <div className="text-[13px]" style={{ color: "#FF0000" }}>
                            {formatPrice(variant.price)}
                        </div>
                    ) : <div />}

                    <button
                        type="button"
                        onClick={handleAdd}
                        onMouseEnter={() => setIsCartHovered(true)}
                        onMouseLeave={() => setIsCartHovered(false)}
                        className="flex shrink-0 cursor-pointer items-center justify-center rounded-[6px]"
                        style={{
                            width: 40,
                            height: 40,
                            backgroundColor: isAdded ? "#008000" : isCartHovered ? "#BF3D12" : COLORS.orange,
                            transition: "background-color 220ms ease, transform 220ms ease",
                            transform: isAdded ? "scale(1.06)" : "scale(1)",
                        }}
                    >
                        <img
                            src={isAdded ? "/icons/check.svg" : "/icons/add-to-cart.svg"}
                            alt=""
                            style={{
                                width: isAdded ? 20 : 16,
                                height: isAdded ? 20 : 16,
                                display: "block",
                                filter: "brightness(0) invert(1)",
                            }}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
}

function GardenMaterialListCard(props: {
    material: ApiGardenMaterial;
    variant: ApiGardenMaterialVariant;
    onAddToPlantList: (material: ApiGardenMaterial, variant: ApiGardenMaterialVariant) => void;
}) {
    const { material, variant, onAddToPlantList } = props;
    const notify = useAppNotify();
    const [isAdded, setIsAdded] = useState(false);
    const [isCartHovered, setIsCartHovered] = useState(false);
    const inStock = variant.availability === "in_stock";

    const handleAdd = () => {
        onAddToPlantList(material, variant);
        notify(APP_NOTIFICATIONS.plantAddedToPlantList(material.name));
        setIsAdded(true);
        window.setTimeout(() => setIsAdded(false), 3200);
    };

    return (
        <div
            className="flex items-stretch gap-5 rounded-[8px] border p-4"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor: COLORS.border,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                minHeight: 184,
            }}
        >
            <div
                className="shrink-0 overflow-hidden rounded-[6px] bg-[#F1F1EE]"
                style={{ width: 168, height: 168 }}
            >
                <PlantImg
                    src={material.imageUrl}
                    alt={material.name}
                    className="block h-full w-full"
                />
            </div>

            <div className="flex min-w-0 flex-1 items-stretch justify-between gap-6">
                <div className="flex min-w-0 flex-1 flex-col">
                    <div
                        className="text-[18px] font-semibold leading-[1.35]"
                        style={{ color: COLORS.text }}
                    >
                        {material.name}
                    </div>

                    {variant.sizeLabel ? (
                        <div
                            className="mt-2 text-[13px] leading-[1.35]"
                            style={{ color: COLORS.text }}
                        >
                            {variant.sizeLabel}
                        </div>
                    ) : null}

                    {formatPrice(variant.price) ? (
                        <div className="mt-2 text-[13px]" style={{ color: "#FF0000" }}>
                            {formatPrice(variant.price)}
                        </div>
                    ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-start justify-center gap-4">
                    <span
                        className="inline-flex items-center gap-2 rounded-full px-3 py-[6px] text-[11px] font-semibold"
                        style={{
                            backgroundColor: inStock ? "#DEFFDE" : "#FDFFC6",
                            color: inStock ? "#008000" : "#807300",
                        }}
                    >
                        <span
                            className="rounded-full"
                            style={{ width: 7, height: 7, backgroundColor: inStock ? "#008000" : "#807300" }}
                        />
                        {inStock ? "Op voorraad" : "Binnen een week leverbaar"}
                    </span>

                    <button
                        type="button"
                        onClick={handleAdd}
                        onMouseEnter={() => setIsCartHovered(true)}
                        onMouseLeave={() => setIsCartHovered(false)}
                        className="flex cursor-pointer items-center gap-2 rounded-[6px] px-4"
                        style={{
                            height: 44,
                            backgroundColor: isAdded ? "#008000" : isCartHovered ? "#BF3D12" : COLORS.orange,
                            color: "#FFFFFF",
                            transition: "background-color 220ms ease, transform 220ms ease",
                            transform: isAdded ? "scale(1.03)" : "scale(1)",
                        }}
                    >
                        <img
                            src={isAdded ? "/icons/check.svg" : "/icons/add-to-cart.svg"}
                            alt=""
                            style={{
                                width: isAdded ? 22 : 18,
                                height: isAdded ? 22 : 18,
                                display: "block",
                                filter: "brightness(0) invert(1)",
                            }}
                        />
                        <span className="text-[13px] font-semibold text-white">
                            {isAdded ? "Toegevoegd" : "Toevoegen aan plantenlijst"}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}

const INITIAL_VISIBLE_COUNT = 6;
const LOAD_MORE_STEP = 6;

type Combo = { key: string; material: ApiGardenMaterial; variant: ApiGardenMaterialVariant };

type GardenMaterialGridProps = {
    materials: ApiGardenMaterial[];
    total: number;
    isLoading: boolean;
    viewMode: ViewMode;
    sortValue: string;
    onChangeSort: (value: string) => void;
    onChangeViewMode: (mode: ViewMode) => void;
    onAddToPlantList: (material: ApiGardenMaterial, variant: ApiGardenMaterialVariant) => void;
};

export default function GardenMaterialGrid(props: GardenMaterialGridProps) {
    const {
        materials,
        total,
        isLoading,
        viewMode,
        sortValue,
        onChangeSort,
        onChangeViewMode,
        onAddToPlantList,
    } = props;

    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
    const sectionRef = React.useRef<HTMLElement | null>(null);

    // Flatten materials × variants — one card per variant, sorted by material name
    const combos: Combo[] = [...materials]
        .sort((a, b) => {
            if (sortValue === "alfabetisch-z-a") return b.name.localeCompare(a.name, "nl");
            return a.name.localeCompare(b.name, "nl");
        })
        .flatMap((material) =>
            material.variants.map((variant) => ({
                key: `${material.id}-${variant.id}`,
                material,
                variant,
            }))
        );

    const visibleCombos = combos.slice(0, visibleCount);
    const canLoadMore = visibleCount < combos.length;
    const canLoadLess = visibleCount > INITIAL_VISIBLE_COUNT && combos.length > INITIAL_VISIBLE_COUNT;

    // Reset when sort or data changes
    React.useEffect(() => {
        setVisibleCount(INITIAL_VISIBLE_COUNT);
    }, [sortValue, materials]);

    const handleLoadMore = () => setVisibleCount((prev) => prev + LOAD_MORE_STEP);
    const handleLoadLess = () => {
        setVisibleCount(INITIAL_VISIBLE_COUNT);
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // Total = number of variant cards shown
    const displayTotal = isLoading ? total : combos.length;

    return (
        <section
            ref={sectionRef}
            className="rounded-[10px] border p-5"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor: COLORS.border,
                boxShadow: "5px 3px 46px -25px rgba(0, 0, 0, 0.25)",
            }}
        >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="text-[28px] font-semibold leading-[1.2]" style={{ color: COLORS.text }}>
                        Tuinmaterialen{" "}
                        <span className="text-[14px] font-normal" style={{ color: COLORS.muted }}>
                            ({displayTotal} resultaten)
                        </span>
                    </h2>
                    <p className="mt-3 text-[14px]" style={{ color: COLORS.text }}>
                        In de plantenlijst bepaal je de aantallen voor je definitieve plan.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <select
                            value={sortValue}
                            onChange={(e) => onChangeSort(e.target.value)}
                            className="h-[40px] min-w-[170px] appearance-none rounded-[8px] border bg-white pl-4 pr-10 text-[14px] font-semibold outline-none"
                            style={{ borderColor: "#E0DEDF", color: COLORS.text }}
                        >
                            <option value="">Geen sortering</option>
                            <option value="alfabetisch-a-z">Naam (A-Z)</option>
                            <option value="alfabetisch-z-a">Naam (Z-A)</option>
                        </select>
                        <img
                            src="/icons/chevron-down.svg"
                            alt=""
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                            style={{ width: 16, height: 16, display: "block" }}
                        />
                    </div>

                    <div className="inline-flex overflow-hidden rounded-[8px] border bg-white" style={{ borderColor: "#E0DEDF" }}>
                        <button
                            type="button"
                            onClick={() => onChangeViewMode("grid")}
                            className="flex h-[40px] w-[56px] cursor-pointer items-center justify-center border-r"
                            style={{ backgroundColor: viewMode === "grid" ? "#58694C" : "#FFFFFF", borderRightColor: "#E0DEDF" }}
                        >
                            <img
                                src="/icons/grid.svg"
                                alt=""
                                style={{ width: 20, height: 20, display: "block", filter: viewMode === "grid" ? "brightness(0) invert(1)" : GREEN_ICON_FILTER }}
                            />
                        </button>
                        <button
                            type="button"
                            onClick={() => onChangeViewMode("list")}
                            className="flex h-[40px] w-[56px] cursor-pointer items-center justify-center"
                            style={{ backgroundColor: viewMode === "list" ? "#58694C" : "#FFFFFF" }}
                        >
                            <img
                                src="/icons/list.svg"
                                alt=""
                                style={{ width: 20, height: 20, display: "block", filter: viewMode === "list" ? "brightness(0) invert(1)" : GREEN_ICON_FILTER }}
                            />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-6">
                {isLoading ? (
                    <div className="flex min-h-[200px] items-center justify-center">
                        <span className="text-[14px]" style={{ color: COLORS.muted }}>
                            Tuinmaterialen laden...
                        </span>
                    </div>
                ) : combos.length === 0 ? (
                    <div className="flex min-h-[200px] items-center justify-center">
                        <span className="text-[14px]" style={{ color: COLORS.muted }}>
                            Geen tuinmaterialen gevonden.
                        </span>
                    </div>
                ) : (
                    <div className={viewMode === "grid"
                        ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                        : "space-y-4"
                    }>
                        {visibleCombos.map(({ key, material, variant }) =>
                            viewMode === "grid" ? (
                                <GardenMaterialGridCard
                                    key={key}
                                    material={material}
                                    variant={variant}
                                    onAddToPlantList={onAddToPlantList}
                                />
                            ) : (
                                <GardenMaterialListCard
                                    key={key}
                                    material={material}
                                    variant={variant}
                                    onAddToPlantList={onAddToPlantList}
                                />
                            )
                        )}
                    </div>
                )}
            </div>
            {(canLoadMore || canLoadLess) ? (
                <div className="mt-6 flex items-center justify-center gap-6">
                    {canLoadLess ? (
                        <button
                            type="button"
                            onClick={handleLoadLess}
                            className="cursor-pointer text-[14px] font-medium underline"
                            style={{ color: COLORS.muted }}
                        >
                            Minder laden
                        </button>
                    ) : null}
                    {canLoadMore ? (
                        <button
                            type="button"
                            onClick={handleLoadMore}
                            className="cursor-pointer text-[14px] font-medium underline"
                            style={{ color: COLORS.green }}
                        >
                            Meer laden ({combos.length - visibleCount})
                        </button>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
