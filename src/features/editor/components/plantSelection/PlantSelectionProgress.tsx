"use client";

import React, { useMemo } from "react";
import { useRightStepMenuStore } from "@/features/editor/state/rightStepMenuStore";
import { goToWorkflowStepFromPlantSelection } from "@/features/editor/lib/editorWorkflowNavigation";

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
    { id: 6, title: "Planten koppelen\nin tekening" },
    { id: 7, title: "Beplantingsplan\nafronden" },
] as const;

const STEP_COUNT = WORKFLOW_STEPS.length;
const STEP_BUBBLE_SIZE = 52;
const STEP_LINE_HEIGHT = 4;
const STEP_LINE_TOP = STEP_BUBBLE_SIZE / 2 - STEP_LINE_HEIGHT / 2;

export default function PlantSelectionProgress() {
    const step1 = useRightStepMenuStore((s) => s.step1);
    const step2 = useRightStepMenuStore((s) => s.step2);
    const step3 = useRightStepMenuStore((s) => s.step3);
    const step4 = useRightStepMenuStore((s) => s.step4);
    const isStepAccessible = useRightStepMenuStore((s) => s.isStepAccessible);

    const isStep1Completed = useMemo(() => {
        return !!step1.locationType && step1.gardenZones.length > 0;
    }, [step1]);

    const isStep2Completed = useMemo(() => {
        return (
            step2.standplaatsen.length > 0 &&
            step2.groundTypes.length > 0 &&
            !!step2.maintenanceLevel &&
            !!step2.certificationPreference
        );
    }, [step2]);

    const isStep3Completed = useMemo(() => {
        if (!step3.structureStyle) return false;

        if (step3.structureStyle !== "vrij-samenstellen") {
            return true;
        }

        const percentages = step3.customPercentages;
        const hasAllValues = Object.values(percentages).every((value) => value !== "");
        if (!hasAllValues) return false;

        const total =
            Number(percentages.bodembedekkers || 0) +
            Number(percentages.vastePlanten || 0) +
            Number(percentages.heestersEnStruiken || 0) +
            Number(percentages.bomen || 0);

        return total === 100;
    }, [step3]);

    const isStep4Completed = useMemo(() => {
        return !!step4.seasonExperience && !!step4.heightStyle;
    }, [step4]);

    const completedCount = useMemo(() => {
        let count = 0;

        if (isStep1Completed) count += 1;
        if (isStep2Completed) count += 1;
        if (isStep3Completed) count += 1;
        if (isStep4Completed) count += 1;

        return count;
    }, [
        isStep1Completed,
        isStep2Completed,
        isStep3Completed,
        isStep4Completed,
    ]);

    const progressIndex = Math.min(completedCount + 1, STEP_COUNT);
    const progressRatio = (progressIndex - 1) / (STEP_COUNT - 1);
    const handleStepClick = (stepId: number) => {
        const isClickableEditorStep =
            stepId >= 1 &&
            stepId <= 4 &&
            isStepAccessible(stepId as 1 | 2 | 3 | 4);

        if (isClickableEditorStep) {
            goToWorkflowStepFromPlantSelection(stepId);
            return;
        }

        if (stepId === 5) {
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
                            const isCompleted = step.id <= completedCount;
                            const isActive = step.id === 5;
                            const isClickable =
                                (step.id >= 1 &&
                                    step.id <= 4 &&
                                    isStepAccessible(step.id as 1 | 2 | 3 | 4)) ||
                                step.id === 5;

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