"use client";

import React, { useEffect, useRef, useState } from "react";
import RightStepMenuSummaryOverlay from "@/features/editor/components/editor/rightStepMenu/RightStepMenuSummaryOverlay";
import { useRightStepMenuStore } from "@/features/editor/state/rightStepMenuStore";
import { goBackToEditor } from "@/features/editor/lib/editorWorkflowNavigation";
import { usePlantSelectionStore } from "@/features/editor/state/plantSelectionStore";
import {
    EMPTY_ADVANCED_PLANT_SELECTION_FILTERS,
    GROUP_LABELS,
    type PlantSelectionAdvancedArrayFilterKey,
    type PlantSelectionAdvancedFilters,
} from "@/features/editor/lib/plantSelectionDummyData";
import { usePlantCatalogStore } from "@/features/editor/state/plantCatalogStore";
import type { PlantAppGroup } from "@/lib/db/plantTypes";
import PlantSelectionProgress from "@/features/editor/components/plantSelection/PlantSelectionProgress";
import PlantProposalGroupsCard from "@/features/editor/components/plantSelection/PlantProposalGroupsCard";
import PlantSelectionSummaryCard from "@/features/editor/components/plantSelection/PlantSelectionSummaryCard";
import PlantSelectionFiltersCard from "@/features/editor/components/plantSelection/PlantSelectionFiltersCard";
import PlantProposalGrid from "@/features/editor/components/plantSelection/PlantProposalGrid";
import GardenMaterialGrid from "@/features/editor/components/plantSelection/GardenMaterialGrid";
import { useGardenMaterialCatalogStore } from "@/features/editor/state/gardenMaterialCatalogStore";
import PlantSelectionListCard from "@/features/editor/components/plantSelection/PlantSelectionListCard";
import {
    getPlantSelectionSnapshotForDrawing,
    getRightStepSnapshotForDrawing,
    readActiveDrawingIdFromStorage,
    readPlantSelectionSnapshotsByDrawingIdFromStorage,
    readRightStepSnapshotsByDrawingIdFromStorage,
    writePlantSelectionSnapshotsByDrawingIdToStorage,
} from "@/features/editor/lib/appDrawingPersistence";

import { HEIGHT_BOUNDARIES, type ScoringInput } from "@/features/editor/lib/plantScoring";

// Maps step2 wizard grondsoort keys to the matching display value in
// PLANT_SELECTION_GRONDSOORT_OPTIONS (which are the real DB column values).
const STEP2_GRONDSOORT_TO_FILTER_OPTION: Record<string, string> = {
    "zandgrond":             "Zandgrond",
    "klei":                  "Klei",
    "lichte-klei-zandleem":  "Lichte klei",
    "humusrijk-bosgrond":    "Humusrijke grond",
    "veengrond-nat":         "Veengrond",
};


// Maps step4.heightStyle to the SQL exclusion boundaries.
// Only the truly incompatible height range is excluded; primary vs secondary
// distinction is handled by the scoring system (plantScoring.ts).
//
// laag-horizontaal : primary < 60cm, secondary 60–150cm, excluded > 150cm
// accent-op-hoogte : primary > 150cm, secondary 60–150cm, excluded < 60cm
// gelaagd-ruimtelijk: primary 60–150cm, secondary < 60 or > 150, nothing excluded
function heightStyleToRange(style: string | null): {
    minHeightCm: number | undefined;
    maxHeightCm: number | undefined;
} {
    if (style === "laag-horizontaal") return { minHeightCm: undefined, maxHeightCm: HEIGHT_BOUNDARIES.HIGH };
    if (style === "accent-op-hoogte") return { minHeightCm: HEIGHT_BOUNDARIES.LOW, maxHeightCm: undefined };
    // "gelaagd-ruimtelijk" and null: no exclusion
    return { minHeightCm: undefined, maxHeightCm: undefined };
}

const COLORS = {
    pageBg: "#F7F6F4",
    text: "#111111",
    orange: "#E94E1B",
    softText: "#A1A1A1",
};

export default function PlantSelectionPage() {
    const plantListSectionRef = useRef<HTMLDivElement | null>(null);
    const [isPlantListVisible, setIsPlantListVisible] = useState(false);
    const [isPlantListFabHovered, setIsPlantListFabHovered] = useState(false);
    const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);
    const [hasHydratedDrawingContext, setHasHydratedDrawingContext] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState<PlantSelectionAdvancedFilters>(
        EMPTY_ADVANCED_PLANT_SELECTION_FILTERS
    );

    const step1 = useRightStepMenuStore((s) => s.step1);
    const step2 = useRightStepMenuStore((s) => s.step2);
    const step3 = useRightStepMenuStore((s) => s.step3);
    const step4 = useRightStepMenuStore((s) => s.step4);
    const isStep1Complete = useRightStepMenuStore((s) => s.isStep1Complete);
    const isStep2Complete = useRightStepMenuStore((s) => s.isStep2Complete);
    const isStep3Complete = useRightStepMenuStore((s) => s.isStep3Complete);
    const isStep4Complete = useRightStepMenuStore((s) => s.isStep4Complete);

    const selectedGroup = usePlantSelectionStore((s) => s.selectedGroup);
    const viewMode = usePlantSelectionStore((s) => s.viewMode);
    const sortValue = usePlantSelectionStore((s) => s.sortValue);
    const filters = usePlantSelectionStore((s) => s.filters);
    const isSummaryOpen = usePlantSelectionStore((s) => s.isSummaryOpen);
    const plantListItems = usePlantSelectionStore((s) => s.plantListItems);

    const setSelectedGroup = usePlantSelectionStore((s) => s.setSelectedGroup);
    const setViewMode = usePlantSelectionStore((s) => s.setViewMode);
    const setSortValue = usePlantSelectionStore((s) => s.setSortValue);
    const toggleFilter = usePlantSelectionStore((s) => s.toggleFilter);
    const openSummary = usePlantSelectionStore((s) => s.openSummary);
    const closeSummary = usePlantSelectionStore((s) => s.closeSummary);
    const clearFilters = usePlantSelectionStore((s) => s.clearFilters);
    const addPlantToList = usePlantSelectionStore((s) => s.addPlantToList);
    const exportPlantSelectionSnapshot = usePlantSelectionStore((s) => s.exportSnapshot);
    const loadPlantSelectionSnapshot = usePlantSelectionStore((s) => s.loadSnapshot);

    const catalogPlants = usePlantCatalogStore((s) => s.plants);
    const catalogTotal = usePlantCatalogStore((s) => s.total);
    const catalogPage = usePlantCatalogStore((s) => s.page);
    const catalogTotalPages = usePlantCatalogStore((s) => s.totalPages);
    const catalogIsLoading = usePlantCatalogStore((s) => s.isLoading);
    const catalogError = usePlantCatalogStore((s) => s.error);
    const setCatalogFilter = usePlantCatalogStore((s) => s.setFilter);
    const setMultipleCatalogFilters = usePlantCatalogStore((s) => s.setMultipleFilters);
    const setCatalogSearch = usePlantCatalogStore((s) => s.setSearch);
    const loadMoreCatalogPlants = usePlantCatalogStore((s) => s.loadMorePlants);

    const gardenMaterials = useGardenMaterialCatalogStore((s) => s.materials);
    const gardenMaterialsTotal = useGardenMaterialCatalogStore((s) => s.total);
    const gardenMaterialsIsLoading = useGardenMaterialCatalogStore((s) => s.isLoading);
    const gardenMaterialsError = useGardenMaterialCatalogStore((s) => s.error);
    const fetchGardenMaterials = useGardenMaterialCatalogStore((s) => s.fetchMaterials);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const restoredDrawingId = readActiveDrawingIdFromStorage();
        const rightStepSnapshotsByDrawingId = readRightStepSnapshotsByDrawingIdFromStorage();
        const plantSelectionSnapshotsByDrawingId =
            readPlantSelectionSnapshotsByDrawingIdFromStorage();

        const rightStepSnapshot = getRightStepSnapshotForDrawing(
            restoredDrawingId,
            rightStepSnapshotsByDrawingId
        );

        useRightStepMenuStore.setState({
            activeStep: rightStepSnapshot.activeStep,
            step1: {
                locationType: rightStepSnapshot.step1.locationType,
                gardenZones: [...rightStepSnapshot.step1.gardenZones],
            },
            step2: {
                standplaatsen: [...rightStepSnapshot.step2.standplaatsen],
                groundTypes: [...rightStepSnapshot.step2.groundTypes],
                maintenanceLevel: rightStepSnapshot.step2.maintenanceLevel,
                certificationPreference: rightStepSnapshot.step2.certificationPreference,
            },
            step3: {
                structureStyle: rightStepSnapshot.step3.structureStyle,
                customPercentages: {
                    bodembedekkers:
                        rightStepSnapshot.step3.customPercentages.bodembedekkers,
                    vastePlanten:
                        rightStepSnapshot.step3.customPercentages.vastePlanten,
                    heestersEnStruiken:
                        rightStepSnapshot.step3.customPercentages.heestersEnStruiken,
                    bomen: rightStepSnapshot.step3.customPercentages.bomen,
                },
            },
            step4: {
                seasonExperience: rightStepSnapshot.step4.seasonExperience,
                heightStyle: rightStepSnapshot.step4.heightStyle,
            },
        });

        loadPlantSelectionSnapshot(
            getPlantSelectionSnapshotForDrawing(
                restoredDrawingId,
                plantSelectionSnapshotsByDrawingId
            )
        );

        setActiveDrawingId(restoredDrawingId);
        setHasHydratedDrawingContext(true);
    }, [loadPlantSelectionSnapshot]);

    useEffect(() => {
        if (!hasHydratedDrawingContext || !activeDrawingId) return;
        if (typeof window === "undefined") return;

        const snapshotsByDrawingId =
            readPlantSelectionSnapshotsByDrawingIdFromStorage();

        snapshotsByDrawingId[activeDrawingId] = exportPlantSelectionSnapshot();

        writePlantSelectionSnapshotsByDrawingIdToStorage(snapshotsByDrawingId);
    }, [
        activeDrawingId,
        hasHydratedDrawingContext,
        selectedGroup,
        viewMode,
        sortValue,
        filters,
        plantListItems,
        exportPlantSelectionSnapshot,
    ]);

    // Reset advanced filter state whenever the selected group changes.
    // No catalog side-effects here — the combined effect below owns all fetches.
    useEffect(() => {
        if (!hasHydratedDrawingContext) return;
        setAdvancedFilters(EMPTY_ADVANCED_PLANT_SELECTION_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGroup, hasHydratedDrawingContext]);

    // Syncs ALL catalog filters at once, gated behind hasHydratedDrawingContext.
    //
    // Category tabs (bodembedekkers, vaste-planten, etc.): driven exclusively by
    // the step 2–4 wizard answers. advancedFilters is intentionally ignored so
    // that changes made in "Zoek zelf" never bleed into the category views.
    //
    // Zoek-zelf: driven by advancedFilters only (the user's manual selections).
    // No height filter here — that's a step-4 concern for the category tabs.
    useEffect(() => {
        if (!hasHydratedDrawingContext) return;

        const { minHeightCm, maxHeightCm } = heightStyleToRange(step4.heightStyle);

        // Tuinmaterialen komen uit een aparte store — plantCatalogStore niet aanraken
        if (selectedGroup === "tuinmaterialen") return;

        if (selectedGroup === "zoek-zelf") {
            setMultipleCatalogFilters({
                appGroup: undefined,
                standplaatsen: advancedFilters.standplaatsen.map((s) => s.toLowerCase()),
                grondsoorten: advancedFilters.grondsoorten.map((g) => g.toLowerCase()),
                bloeiperiodes: advancedFilters.bloeiperiodes.map((b) => b.toLowerCase()),
                kleuren: advancedFilters.kleuren,
                categories: advancedFilters.plantgroepen,
                inStockOnly: filters.opVoorraad,
                inheems: filters.inheems ? true : undefined,
                minHeightCm: undefined,
                maxHeightCm: undefined,
            });
        } else {
            // Build step-2 terms directly — never touch advancedFilters for categories
            const standplaatsenTerms = step2.standplaatsen
                .filter((s) => s !== "wisselend-onbekend")
                .map((s) => s.toLowerCase());
            const grondsoortTerms = step2.groundTypes
                .map((g) => STEP2_GRONDSOORT_TO_FILTER_OPTION[g] ?? "")
                .filter(Boolean)
                .map((g) => g.toLowerCase());

            setMultipleCatalogFilters({
                q: "",  // always clear any text search on category tabs
                appGroup: selectedGroup as PlantAppGroup,
                standplaatsen: standplaatsenTerms,
                grondsoorten: grondsoortTerms,
                bloeiperiodes: advancedFilters.bloeiperiodes.map((b) => b.toLowerCase()),
                kleuren: advancedFilters.kleuren,
                categories: [],
                inStockOnly: filters.opVoorraad,
                inheems: filters.inheems ? true : undefined,
                minHeightCm,
                maxHeightCm,
            });
        }
    }, [
        hasHydratedDrawingContext,
        selectedGroup,
        step2.standplaatsen,
        step2.groundTypes,
        step4.heightStyle,
        advancedFilters.standplaatsen,
        advancedFilters.grondsoorten,
        advancedFilters.bloeiperiodes,
        advancedFilters.kleuren,
        advancedFilters.plantgroepen,
        filters.opVoorraad,
        filters.inheems,
        setMultipleCatalogFilters,
    ]);

    const handleToggleAdvancedFilter = (
        key: PlantSelectionAdvancedArrayFilterKey,
        value: string
    ) => {
        setAdvancedFilters((prev) => {
            const currentValues = prev[key];

            return {
                ...prev,
                [key]: currentValues.includes(value)
                    ? currentValues.filter((item: string) => item !== value)
                    : [...currentValues, value],
            };
        });
    };

    const handleRemoveFilterChip = (
        key: PlantSelectionAdvancedArrayFilterKey | keyof typeof filters,
        value?: string
    ) => {
        if (key === "opVoorraad" || key === "inheems") {
            if (filters[key]) {
                toggleFilter(key);
            }
            return;
        }

        if (!value) return;

        setAdvancedFilters((prev) => ({
            ...prev,
            [key]: prev[key].filter((item: string) => item !== value),
        }));
    };

    const handleClearAllFilters = () => {
        if (filters.opVoorraad) toggleFilter("opVoorraad");
        if (filters.inheems) toggleFilter("inheems");
        // Wipe all zoek-zelf filters; the combined effect re-fires and fetches unfiltered.
        setAdvancedFilters(EMPTY_ADVANCED_PLANT_SELECTION_FILTERS);
    };

    useEffect(() => {
        const sort =
            sortValue === "alfabetisch-a-z" ? "a-z" :
            sortValue === "alfabetisch-z-a" ? "z-a" :
            undefined;
        setCatalogFilter("sort", sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortValue]);

    // Fetch garden materials when the tuinmaterialen tab is opened (once)
    useEffect(() => {
        if (selectedGroup === "tuinmaterialen") {
            fetchGardenMaterials();
        }
    }, [selectedGroup, fetchGardenMaterials]);

    const visiblePlants = catalogPlants;

    useEffect(() => {
        const target = plantListSectionRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsPlantListVisible(entry.isIntersecting);
            },
            {
                threshold: 0.2,
            }
        );

        observer.observe(target);

        return () => {
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        const nextOffset = isPlantListVisible ? "24px" : "88px";

        root.style.setProperty("--app-bottom-center-offset", nextOffset);

        return () => {
            root.style.removeProperty("--app-bottom-center-offset");
        };
    }, [isPlantListVisible]);

    const handleBackToEditorWithStepsPanel = () => {
        if (typeof window !== "undefined") {
            const drawingId = activeDrawingId ?? readActiveDrawingIdFromStorage();

            if (drawingId) {
                window.sessionStorage.setItem(
                    `hello-editor:right-panel-mode:${drawingId}`,
                    "steps"
                );
            }
        }

        goBackToEditor();
    };

    const handleScrollToPlantList = () => {
        plantListSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    return (
        <>
            <main
                className="min-h-screen"
                style={{ backgroundColor: COLORS.pageBg }}
            >
                <div className="mx-auto w-full max-w-[1460px] px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:pt-10">
                    <div className="max-w-[980px]">
                        <h1
                            className="text-[28px] font-bold leading-[1.2] sm:text-[34px]"
                            style={{ color: COLORS.text }}
                        >
                            Stel je plantenlijst samen!
                        </h1>

                        <button
                            type="button"
                            onClick={handleBackToEditorWithStepsPanel}
                            className="group mt-4 inline-flex cursor-pointer items-center gap-3 text-left"
                            style={{ color: COLORS.text }}
                        >
                            <img
                                src="/icons/arrow-left.svg"
                                alt=""
                                className="shrink-0"
                                style={{ width: 16, height: 16, display: "block" }}
                            />
                            <span className="text-[14px] font-medium underline-offset-4 group-hover:underline group-focus-visible:underline">
                                Terug naar tekening met stappenmenu
                            </span>
                        </button>
                    </div>

                    <div className="mt-8">
                        <PlantSelectionProgress />
                    </div>

                    <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
                        <div className="space-y-6">
                            <PlantProposalGroupsCard
                                selectedGroup={selectedGroup}
                                onSelectGroup={setSelectedGroup}
                            />

                            <PlantSelectionSummaryCard onClick={openSummary} />
                            
                            <PlantSelectionFiltersCard
                                filters={filters}
                                advancedFilters={advancedFilters}
                                isSearchMode={selectedGroup === "zoek-zelf"}
                                onToggleFilter={toggleFilter}
                                onToggleAdvancedFilter={handleToggleAdvancedFilter}
                                onClearFilters={handleClearAllFilters}
                            />
                        </div>

                        <div className="space-y-6">
                            {selectedGroup === "tuinmaterialen" ? (
                                <>
                                    {gardenMaterialsError ? (
                                        <div
                                            className="rounded-[8px] border px-4 py-3 text-[14px]"
                                            style={{ borderColor: "#F4C8B8", backgroundColor: "#FFF7F4", color: "#E94E1B" }}
                                        >
                                            Tuinmaterialen konden niet worden geladen: {gardenMaterialsError}
                                        </div>
                                    ) : null}
                                    <GardenMaterialGrid
                                        materials={gardenMaterials}
                                        total={gardenMaterialsTotal}
                                        isLoading={gardenMaterialsIsLoading}
                                        viewMode={viewMode}
                                        sortValue={sortValue}
                                        onChangeSort={setSortValue}
                                        onChangeViewMode={setViewMode}
                                        onAddToPlantList={(material, variant) =>
                                            addPlantToList(
                                                {
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
                                                    pricePerPiece: variant.price,
                                                    inStock: variant.availability === "in_stock",
                                                },
                                                variant.sizeLabel,
                                                true
                                            )
                                        }
                                    />
                                </>
                            ) : (
                                <>
                                    {catalogError ? (
                                        <div
                                            className="rounded-[8px] border px-4 py-3 text-[14px]"
                                            style={{ borderColor: "#F4C8B8", backgroundColor: "#FFF7F4", color: "#E94E1B" }}
                                        >
                                            Planten konden niet worden geladen: {catalogError}
                                        </div>
                                    ) : null}
                                    <PlantProposalGrid
                                        key={selectedGroup}
                                        title={GROUP_LABELS[selectedGroup]}
                                        resultsCount={catalogTotal}
                                        currentPage={catalogPage}
                                        totalPages={catalogTotalPages}
                                        plants={visiblePlants}
                                        viewMode={viewMode}
                                        sortValue={sortValue}
                                        selectedGroup={selectedGroup}
                                        filters={filters}
                                        advancedFilters={advancedFilters}
                                        scoringInput={{
                                            heightStyle: step4.heightStyle as ScoringInput["heightStyle"],
                                            standplaatsen: step2.standplaatsen.filter((s) => s !== "wisselend-onbekend"),
                                            groundTypes: step2.groundTypes
                                                .map((g) => STEP2_GRONDSOORT_TO_FILTER_OPTION[g] ?? "")
                                                .filter(Boolean)
                                                .map((g) => g.toLowerCase()),
                                        }}
                                        onChangeSort={setSortValue}
                                        onChangeViewMode={setViewMode}
                                        onAddToPlantList={(plant, size) => addPlantToList(plant, size, !!size)}
                                        onRemoveFilterChip={handleRemoveFilterChip}
                                        onClearAllFilters={handleClearAllFilters}
                                        onLoadMoreFromApi={loadMoreCatalogPlants}
                                        onSearchQueryChange={setCatalogSearch}
                                    />
                                </>
                            )}
                        </div>

                        <div className="xl:col-span-2">
                            <div ref={plantListSectionRef}>
                                <PlantSelectionListCard />
                            </div>

                            <div
                                className="mt-6 text-[12px]"
                                style={{ color: COLORS.softText }}
                            >
                                Ondersteuning nodig?{" "}
                                <a
                                    href="https://olaf-nijenkamp.nl/bezoekadres-en-contact"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                    style={{ color: COLORS.orange }}
                                >
                                    Neem contact op
                                </a>{" "}
                                met ons team.
                            </div>
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleScrollToPlantList}
                    onMouseEnter={() => setIsPlantListFabHovered(true)}
                    onMouseLeave={() => setIsPlantListFabHovered(false)}
                    aria-label="Bekijk plantenlijst"
                    className="fixed z-[120] flex items-center overflow-hidden rounded-full border bg-white shadow-sm"
                    style={{
                        left: "50%",
                        bottom: 24,
                        height: 42,
                        paddingLeft: isPlantListFabHovered ? 14 : 0,
                        paddingRight: 0,
                        width: isPlantListFabHovered ? 180 : 42,
                        borderColor: "#E0DEDF",
                        backgroundColor: "#FFFFFF",
                        opacity: isPlantListVisible ? 0 : 1,
                        transform: `translateX(-50%) ${isPlantListVisible ? "translateY(8px)" : "translateY(0)"}`,
                        pointerEvents: isPlantListVisible ? "none" : "auto",
                        transition:
                            "opacity 220ms ease, transform 220ms ease, width 220ms ease, padding-left 220ms ease, box-shadow 220ms ease",
                        cursor: "pointer",
                    }}
                >
                    <span
                        style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            opacity: isPlantListFabHovered ? 1 : 0,
                            maxWidth: isPlantListFabHovered ? 150 : 0,
                            marginRight: isPlantListFabHovered ? 10 : 0,
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#111111",
                            transition:
                                "opacity 180ms ease, max-width 220ms ease, margin-right 220ms ease",
                        }}
                    >
                        Bekijk plantenlijst
                    </span>

                    <span
                        className="flex shrink-0 items-center justify-center rounded-full"
                        style={{
                            width: 40,
                            height: 40,
                        }}
                    >
                        <img
                            src="/icons/arrow-down.svg"
                            alt=""
                            style={{
                                width: 18,
                                height: 18,
                                display: "block",
                            }}
                        />
                    </span>
                </button>
            </main>

            {isSummaryOpen ? (
                <RightStepMenuSummaryOverlay
                    step1={step1}
                    step2={step2}
                    step3={step3}
                    step4={step4}
                    isStep1Complete={isStep1Complete()}
                    isStep2Complete={isStep2Complete()}
                    isStep3Complete={isStep3Complete()}
                    isStep4Complete={isStep4Complete()}
                    onClose={closeSummary}
                />
            ) : null}
        </>
    );
}