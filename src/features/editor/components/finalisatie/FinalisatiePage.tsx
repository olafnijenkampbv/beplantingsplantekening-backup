"use client";

import React, { useEffect, useState } from "react";
import { useRightStepMenuStore } from "@/features/editor/state/rightStepMenuStore";
import { usePlantSelectionStore } from "@/features/editor/state/plantSelectionStore";
import { useProjectStore } from "@/state/projectStore";
import { goBackToEditor } from "@/features/editor/lib/editorWorkflowNavigation";
import {
    getPlantSelectionSnapshotForDrawing,
    getRightStepSnapshotForDrawing,
    readActiveDrawingIdFromStorage,
    readDrawingsFromStorage,
    readPlantSelectionSnapshotsByDrawingIdFromStorage,
    readRightStepSnapshotsByDrawingIdFromStorage,
    writePlantSelectionSnapshotsByDrawingIdToStorage,
} from "@/features/editor/lib/appDrawingPersistence";
import FinalisatieProgress from "@/features/editor/components/finalisatie/FinalisatieProgress";
import FinalisatieContactCard from "@/features/editor/components/finalisatie/FinalisatieContactCard";
import FinalisatieSidePanel from "@/features/editor/components/finalisatie/FinalisatieSidePanel";
import FinalisatiePlantList from "@/features/editor/components/finalisatie/FinalisatiePlantList";
import FinalisatieDrawingBlock from "@/features/editor/components/finalisatie/FinalisatieDrawingBlock";

const COLORS = {
    pageBg: "#F5F4F2",
    text: "#111111",
    green: "#58694C",
    border: "#E3E2E2",
    cardBg: "#FFFFFF",
};

export default function FinalisatiePage() {
    const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);
    const [hasHydratedDrawingContext, setHasHydratedDrawingContext] = useState(false);

    const plantListItems = usePlantSelectionStore((s) => s.plantListItems);
    const exportPlantSelectionSnapshot = usePlantSelectionStore((s) => s.exportSnapshot);
    const loadPlantSelectionSnapshot = usePlantSelectionStore((s) => s.loadSnapshot);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const restoredDrawingId = readActiveDrawingIdFromStorage();
        const rightStepSnapshotsByDrawingId = readRightStepSnapshotsByDrawingIdFromStorage();
        const plantSelectionSnapshotsByDrawingId =
            readPlantSelectionSnapshotsByDrawingIdFromStorage();

        // Hydrate projectStore with objects/plantbedLinks/distributionOverrides from
        // the saved drawing snapshot so that the plant-coupling labels and advice
        // counts in FinalisatiePlantList are computed from real persisted data.
        const { drawings } = readDrawingsFromStorage();
        const restoredDrawing =
            drawings.find((d) => d.id === restoredDrawingId) ?? drawings[0];
        if (restoredDrawing?.snapshot) {
            useProjectStore.setState({
                objects: restoredDrawing.snapshot.objects ?? [],
                plantbedLinks: restoredDrawing.snapshot.plantbedLinks ?? {},
                distributionOverrides: restoredDrawing.snapshot.distributionOverrides ?? {},
                compassDirection: restoredDrawing.snapshot.compassDirection ?? "noord",
            });
        }

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
        plantListItems,
        exportPlantSelectionSnapshot,
    ]);

    return (
        <main
            className="min-h-screen w-full"
            style={{ backgroundColor: COLORS.pageBg }}
        >
            <div className="mx-auto w-full max-w-[1460px] px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:pt-10">
                <h1
                    className="text-[28px] font-bold leading-[1.2] sm:text-[34px]"
                    style={{ color: COLORS.text }}
                >
                    Beplantingsplan afronden
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
                        Terug
                    </span>
                </button>

                <div className="mt-8">
                    <FinalisatieProgress />
                </div>

                <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="space-y-6">
                        <FinalisatieContactCard />
                        <FinalisatiePlantList />

                        <FinalisatieDrawingBlock />
                    </div>

                    <div className="xl:sticky xl:top-8 xl:self-start">
                        <FinalisatieSidePanel />
                    </div>
                </div>
            </div>
        </main>
    );
}