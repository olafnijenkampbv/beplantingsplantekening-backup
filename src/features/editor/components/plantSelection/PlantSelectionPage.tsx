"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import RightStepMenuSummaryOverlay from "@/features/editor/components/editor/rightStepMenu/RightStepMenuSummaryOverlay";
import { useRightStepMenuStore } from "@/features/editor/state/rightStepMenuStore";
import { goBackToEditor } from "@/features/editor/lib/editorWorkflowNavigation";
import { usePlantSelectionStore } from "@/features/editor/state/plantSelectionStore";
import { DUMMY_PLANTS, GROUP_LABELS } from "@/features/editor/lib/plantSelectionDummyData";
import PlantSelectionProgress from "@/features/editor/components/plantSelection/PlantSelectionProgress";
import PlantProposalGroupsCard from "@/features/editor/components/plantSelection/PlantProposalGroupsCard";
import PlantSelectionSummaryCard from "@/features/editor/components/plantSelection/PlantSelectionSummaryCard";
import PlantSelectionFiltersCard from "@/features/editor/components/plantSelection/PlantSelectionFiltersCard";
import PlantProposalGrid from "@/features/editor/components/plantSelection/PlantProposalGrid";
import PlantSelectionListCard from "@/features/editor/components/plantSelection/PlantSelectionListCard";

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

    const setSelectedGroup = usePlantSelectionStore((s) => s.setSelectedGroup);
    const setViewMode = usePlantSelectionStore((s) => s.setViewMode);
    const setSortValue = usePlantSelectionStore((s) => s.setSortValue);
    const toggleFilter = usePlantSelectionStore((s) => s.toggleFilter);
    const openSummary = usePlantSelectionStore((s) => s.openSummary);
    const closeSummary = usePlantSelectionStore((s) => s.closeSummary);
    const clearFilters = usePlantSelectionStore((s) => s.clearFilters);
    const addPlantToList = usePlantSelectionStore((s) => s.addPlantToList);

    const visiblePlants = useMemo(() => {
        let nextPlants =
            selectedGroup === "zoek-zelf"
                ? [...DUMMY_PLANTS]
                : DUMMY_PLANTS.filter((plant) => plant.group === selectedGroup);

        if (filters.opVoorraad) {
            nextPlants = nextPlants.filter((plant) =>
                plant.stockLabel.toLowerCase().includes("op voorraad")
            );
        }

        if (sortValue === "meest-geschikt") {
            const badgePriority: Record<string, number> = {
                "zeer geschikt": 0,
                "geschikt": 1,
                "goede aanvulling": 2,
            };

            nextPlants = [...nextPlants].sort((a, b) => {
                const aPriority = badgePriority[a.badge?.toLowerCase() ?? ""] ?? 99;
                const bPriority = badgePriority[b.badge?.toLowerCase() ?? ""] ?? 99;

                if (aPriority !== bPriority) {
                    return aPriority - bPriority;
                }

                return a.name.localeCompare(b.name);
            });
        }

        if (sortValue === "alfabetisch-a-z") {
            nextPlants = [...nextPlants].sort((a, b) => a.name.localeCompare(b.name));
        }

        if (sortValue === "alfabetisch-z-a") {
            nextPlants = [...nextPlants].sort((a, b) => b.name.localeCompare(a.name));
        }

        return nextPlants;
    }, [filters.opVoorraad, selectedGroup, sortValue]);

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
                            onClick={goBackToEditor}
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
                                Terug naar tekening
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
                                onToggleFilter={toggleFilter}
                                onClearFilters={clearFilters}
                            />
                        </div>

                        <div className="space-y-6">
                            <PlantProposalGrid
                                title={GROUP_LABELS[selectedGroup]}
                                resultsCount={visiblePlants.length}
                                plants={visiblePlants}
                                viewMode={viewMode}
                                sortValue={sortValue}
                                onChangeSort={setSortValue}
                                onChangeViewMode={setViewMode}
                                onAddToPlantList={addPlantToList}
                            />
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