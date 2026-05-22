"use client";

import React, { useEffect, useLayoutEffect, useMemo } from "react";
import { useRightStepMenuStore } from "@/features/editor/state/rightStepMenuStore";
import {
    goToWorkflowStepFromPlantSelection,
    goToPlantSelectionPage,
    goToPlantLinkingEditor,
    goToFinalisatie,
} from "@/features/editor/lib/editorWorkflowNavigation";
import {
    getRightStepSnapshotForDrawing,
    readActiveDrawingIdFromStorage,
    readRightStepSnapshotsByDrawingIdFromStorage,
} from "@/features/editor/lib/appDrawingPersistence";

// useLayoutEffect fires synchronously after DOM mutations, before the browser
// paints — so store hydration and the resulting re-render both happen before
// the first paint, eliminating the grey-step flash after a page refresh.
// useEffect is used on the server where layout effects cannot run.
const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

const COLORS = {
    green: "#58694C",
    greenLight: "#EEF0ED",
    lineRest: "#DAD8D2",
    stepRestBg: "#F3F2F0",
    stepRestBorder: "#D7D5CF",
    stepRestText: "#8E8E8E",
    activeDash: "#AAB39E",
    text: "#111111",
};

const WORKFLOW_STEPS = [
    { id: 1, title: "Locatie\nbepalen" },
    { id: 2, title: "Situatie &\nrandvoorwaarden" },
    { id: 3, title: "Structuur &\nopbouw" },
    { id: 4, title: "Beleving &\nruimte" },
    { id: 5, title: "Plantenvoorstel &\naanpassen" },
    { id: 6, title: "Beplantingsplan\ntekenen" },
    { id: 7, title: "Beplantingsplan\nafronden" },
] as const;

const STEP_COUNT = WORKFLOW_STEPS.length;
const STEP_BUBBLE_SIZE = 52;
const STEP_LINE_HEIGHT = 4;
const STEP_LINE_TOP = STEP_BUBBLE_SIZE / 2 - STEP_LINE_HEIGHT / 2;

type WorkflowProgressProps = {
    activeStep: 5 | 7;
};

export default function WorkflowProgress(props: WorkflowProgressProps) {
    const { activeStep } = props;

    // Selectors return boolean results, not function references.
    // Zustand compares selector output via Object.is: a stable function reference
    // never changes, so a selector returning (s) => s.isStep1Complete would never
    // trigger a re-render. Calling the function — (s) => s.isStep1Complete() —
    // returns a boolean that Zustand can meaningfully diff (false → true).
    const isStep1Complete = useRightStepMenuStore((s) => s.isStep1Complete());
    const isStep2Complete = useRightStepMenuStore((s) => s.isStep2Complete());
    const isStep3Complete = useRightStepMenuStore((s) => s.isStep3Complete());
    const isStep4Complete = useRightStepMenuStore((s) => s.isStep4Complete());

    useIsomorphicLayoutEffect(() => {
        const activeDrawingId = readActiveDrawingIdFromStorage();
        const rightStepSnapshotsByDrawingId = readRightStepSnapshotsByDrawingIdFromStorage();
        const snapshot = getRightStepSnapshotForDrawing(
            activeDrawingId,
            rightStepSnapshotsByDrawingId
        );

        useRightStepMenuStore.setState({
            activeStep: snapshot.activeStep,
            step1: {
                locationType: snapshot.step1.locationType,
                gardenZones: [...snapshot.step1.gardenZones],
            },
            step2: {
                standplaatsen: [...snapshot.step2.standplaatsen],
                groundTypes: [...snapshot.step2.groundTypes],
                maintenanceLevel: snapshot.step2.maintenanceLevel,
                certificationPreference: snapshot.step2.certificationPreference,
            },
            step3: {
                structureStyle: snapshot.step3.structureStyle,
                customPercentages: {
                    bodembedekkers: snapshot.step3.customPercentages.bodembedekkers,
                    vastePlanten: snapshot.step3.customPercentages.vastePlanten,
                    heestersEnStruiken: snapshot.step3.customPercentages.heestersEnStruiken,
                    bomen: snapshot.step3.customPercentages.bomen,
                },
            },
            step4: {
                seasonExperience: snapshot.step4.seasonExperience,
                heightStyle: snapshot.step4.heightStyle,
            },
        });
    }, []);

    const completedCount = useMemo(() => {
        let count = 0;
        if (isStep1Complete) count += 1;
        if (isStep2Complete) count += 1;
        if (isStep3Complete) count += 1;
        if (isStep4Complete) count += 1;
        return count;
    }, [isStep1Complete, isStep2Complete, isStep3Complete, isStep4Complete]);

    // Op stap 7 gelden stappen 5 en 6 ook als voltooid
    const effectiveCompletedCount =
        activeStep === 7 ? Math.max(completedCount, 6) : completedCount;

    const progressIndex = Math.min(effectiveCompletedCount + 1, STEP_COUNT);
    const progressRatio = (progressIndex - 1) / (STEP_COUNT - 1);

    const handleStepClick = (stepId: number) => {
        if (stepId >= 1 && stepId <= 4 && stepId <= completedCount) {
            goToWorkflowStepFromPlantSelection(stepId);
            return;
        }
        if (stepId === 5) {
            if (activeStep === 7) {
                goToPlantSelectionPage();
            }
            return;
        }
        if (stepId === 6) {
            if (activeStep === 7) {
                goToPlantLinkingEditor();
            }
            return;
        }
        if (stepId === 7) {
            if (activeStep === 5) {
                goToFinalisatie();
            }
            return;
        }
    };

    return (
        <div className="w-full overflow-x-auto">
            <div className="min-w-[980px] w-full">
                <div className="relative">
                    <div
                        className="absolute"
                        style={{
                            top: STEP_LINE_TOP,
                            left: `calc((100% / ${STEP_COUNT}) / 2)`,
                            right: `calc((100% / ${STEP_COUNT}) / 2)`,
                            height: STEP_LINE_HEIGHT,
                            backgroundColor: COLORS.lineRest,
                            borderRadius: 999,
                        }}
                    />

                    <div
                        className="absolute"
                        style={{
                            top: STEP_LINE_TOP,
                            left: `calc((100% / ${STEP_COUNT}) / 2)`,
                            width: `calc((100% - (100% / ${STEP_COUNT})) * ${progressRatio})`,
                            height: STEP_LINE_HEIGHT,
                            backgroundColor: COLORS.green,
                            borderRadius: 999,
                        }}
                    />

                    <div className="relative z-10 grid grid-cols-7">
                        {WORKFLOW_STEPS.map((step) => {
                            const isCompleted =
                                step.id < activeStep &&
                                step.id <= effectiveCompletedCount;
                            const isActive = step.id === activeStep;
                            const isClickable =
                                (step.id >= 1 &&
                                    step.id <= 4 &&
                                    step.id <= completedCount) ||
                                (step.id === 5 && activeStep === 7) ||
                                (step.id === 6 && activeStep === 7);

                            return (
                                <div
                                    key={step.id}
                                    className="flex flex-col items-center text-center"
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleStepClick(step.id)}
                                        disabled={!isClickable}
                                        className="flex items-center justify-center rounded-full font-semibold transition-all"
                                        style={{
                                            width: STEP_BUBBLE_SIZE,
                                            height: STEP_BUBBLE_SIZE,
                                            border: isActive
                                                ? `2px dashed ${COLORS.activeDash}`
                                                : `2px solid ${isCompleted ? COLORS.green : COLORS.stepRestBorder}`,
                                            backgroundColor: isCompleted
                                                ? COLORS.green
                                                : isActive
                                                    ? COLORS.greenLight
                                                    : COLORS.stepRestBg,
                                            color: isCompleted
                                                ? "#FFFFFF"
                                                : isActive
                                                    ? COLORS.green
                                                    : COLORS.stepRestText,
                                            cursor: isClickable ? "pointer" : "not-allowed",
                                            opacity: 1,
                                            fontSize: 18,
                                            lineHeight: 1,
                                            boxShadow: "none",
                                        }}
                                        aria-label={`Ga naar stap ${step.id}`}
                                    >
                                        {step.id}
                                    </button>

                                    <div
                                        className="mt-4 whitespace-pre-line text-[14px] leading-[1.35]"
                                        style={{
                                            color: COLORS.text,
                                            fontWeight: isActive ? 700 : 500,
                                        }}
                                    >
                                        {step.title}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}