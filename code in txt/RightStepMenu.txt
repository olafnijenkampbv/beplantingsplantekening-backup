"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RightStepStep1Location from "@/features/editor/components/editor/rightStepMenu/steps/RightStepStep1Location";
import RightStepStep2Conditions from "@/features/editor/components/editor/rightStepMenu/steps/RightStepStep2Conditions";
import RightStepStep3Structure from "@/features/editor/components/editor/rightStepMenu/steps/RightStepStep3Structure";
import RightStepStep4Experience from "@/features/editor/components/editor/rightStepMenu/steps/RightStepStep4Experience";
import {
    RIGHT_STEP_MENU_STEPS,
    RIGHT_STEP_STEP1_FOLLOW_UP_BY_LOCATION,
    RIGHT_STEP_STEP1_LOCATION_OPTIONS,
    RIGHT_STEP_STEP2_CERTIFICATION_OPTIONS,
    RIGHT_STEP_STEP2_MAINTENANCE_OPTIONS,
    RIGHT_STEP_STEP2_SOIL_OPTIONS,
    RIGHT_STEP_STEP2_STANDPLAATS_OPTIONS,
    RIGHT_STEP_STEP3_STRUCTURE_OPTIONS,
    type RightStepId,
    type RightStepMenuStep,
} from "@/features/editor/components/editor/rightStepMenu/rightStepMenuConfig";
import { useRightStepMenuStore } from "@/features/editor/state/rightStepMenuStore";
import { useProjectStore } from "@/state/projectStore";
import ConfirmModal from "@/features/editor/components/ConfirmModal";
import {
    getObjectLabel,
    getObjectMenuSections,
} from "@/features/editor/components/editor/objectMenuConfig";
import {
    APP_NOTIFICATIONS,
    useAppNotify,
} from "@/state/allNotifications";
import RightStepMenuSummaryOverlay from "@/features/editor/components/editor/rightStepMenu/RightStepMenuSummaryOverlay";

const COLORS = {
    orange: "#E94E1B",
    orangeLight: "#FFE5DD",
    orangeSoft: "#FFF4EF",
    green: "#58694C",
    greenLight: "#EEF0ED",
    border: "#E3E2E2",
    mutedText: "#6B7280",
    lightText: "#9CA3AF",
};

// zelfde offsets als PlantSidebar
const HEADER_HEIGHT = 56;
const TOOLBAR_OFFSET = 12;
const TOP_OFFSET = HEADER_HEIGHT + TOOLBAR_OFFSET;

export default function RightStepMenu() {
    const activeStep = useRightStepMenuStore((s) => s.activeStep);
    const step1 = useRightStepMenuStore((s) => s.step1);
    const step2 = useRightStepMenuStore((s) => s.step2);
    const step3 = useRightStepMenuStore((s) => s.step3);
    const step4 = useRightStepMenuStore((s) => s.step4);

    const setActiveStep = useRightStepMenuStore((s) => s.setActiveStep);
    const goToPreviousStep = useRightStepMenuStore((s) => s.goToPreviousStep);
    const goToNextStep = useRightStepMenuStore((s) => s.goToNextStep);

    const setStep1LocationType = useRightStepMenuStore((s) => s.setStep1LocationType);
    const toggleStep1GardenZone = useRightStepMenuStore((s) => s.toggleStep1GardenZone);

    const toggleStep2Standplaats = useRightStepMenuStore((s) => s.toggleStep2Standplaats);
    const setStep2GroundType = useRightStepMenuStore((s) => s.setStep2GroundType);
    const setStep2MaintenanceLevel = useRightStepMenuStore((s) => s.setStep2MaintenanceLevel);
    const setStep2CertificationPreference = useRightStepMenuStore((s) => s.setStep2CertificationPreference);

    const setStep3StructureStyle = useRightStepMenuStore((s) => s.setStep3StructureStyle);
    const setStep3CustomPercentage = useRightStepMenuStore((s) => s.setStep3CustomPercentage);

    const setStep4SeasonExperience = useRightStepMenuStore((s) => s.setStep4SeasonExperience);
    const setStep4HeightStyle = useRightStepMenuStore((s) => s.setStep4HeightStyle);

    const notify = useAppNotify();
    const router = useRouter();

    const isStep1Complete = useRightStepMenuStore((s) => s.isStep1Complete);
    const isStep2Complete = useRightStepMenuStore((s) => s.isStep2Complete);
    const isStep3Complete = useRightStepMenuStore((s) => s.isStep3Complete);
    const isStep4Complete = useRightStepMenuStore((s) => s.isStep4Complete);
    const isStepAccessible = useRightStepMenuStore((s) => s.isStepAccessible);
    const getMaxAccessibleStep = useRightStepMenuStore((s) => s.getMaxAccessibleStep);

    const objects = useProjectStore((s) => s.objects);
    const undoStack = useProjectStore((s) => s.undoStack);
    const redoStack = useProjectStore((s) => s.redoStack);
    const setObjectsWithHistory = useProjectStore((s) => s.setObjectsWithHistory);
    const setActiveDrawType = useProjectStore((s) => s.setActiveDrawType);

    const maxAccessibleStep = getMaxAccessibleStep();
    const isStep1Valid = isStep1Complete();
    const isStep2Valid = isStep2Complete();

    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [pendingLocationChange, setPendingLocationChange] = useState<null | {
        currentLocation: string;
        currentLocationLabel: string;
        nextLocation: string;
        nextLocationLabel: string;
        incompatibleObjects: { id: string; title: string }[];
        incompatibleObjectTitles: string[];
    }>(null);

    const locationChangeSyncRef = useRef<null | {
        previousLocation: string;
        nextLocation: string;
        removedObjectIds: string[];
    }>(null);

    const wizardCompletionNoticeRef = useRef({
        hasInitialized: false,
        wasComplete: false,
        shouldNotifyOnNextComplete: false,
    });

    const markWizardInputChanged = useCallback(() => {
        wizardCompletionNoticeRef.current.shouldNotifyOnNextComplete = true;
    }, []);

    const locationLabelByValue = useMemo(() => {
        return new Map(
            RIGHT_STEP_STEP1_LOCATION_OPTIONS.map((option) => [option.value, option.label])
        );
    }, []);

    const handleSelectLocation = useCallback((nextLocation: string) => {
        markWizardInputChanged();

        const currentLocation = step1.locationType;

        if (!currentLocation || currentLocation === nextLocation) {
            locationChangeSyncRef.current = null;
            setStep1LocationType(nextLocation);
            return;
        }

        const allowedObjectTypes = new Set(
            getObjectMenuSections(nextLocation).flatMap((section) =>
                section.items.map((item) => item.id)
            )
        );

        const incompatibleObjects = objects
            .filter((obj) => !allowedObjectTypes.has(obj.type))
            .map((obj) => ({
                id: obj.id,
                title: getObjectLabel(obj.type),
            }));

        const incompatibleObjectTitles = Array.from(
            new Set(incompatibleObjects.map((obj) => obj.title))
        );

        if (incompatibleObjects.length === 0) {
            locationChangeSyncRef.current = null;
            setActiveDrawType(null);
            setStep1LocationType(nextLocation);
            return;
        }

        setPendingLocationChange({
            currentLocation,
            currentLocationLabel:
                locationLabelByValue.get(currentLocation) ?? currentLocation,
            nextLocation,
            nextLocationLabel:
                locationLabelByValue.get(nextLocation) ?? nextLocation,
            incompatibleObjects,
            incompatibleObjectTitles,
        });
    }, [
        locationLabelByValue,
        objects,
        setActiveDrawType,
        markWizardInputChanged,
        setStep1LocationType,
        step1.locationType,
    ]);

    const handleCancelLocationChange = useCallback(() => {
        setPendingLocationChange(null);
    }, []);

    const handleConfirmLocationChange = useCallback(() => {
        if (!pendingLocationChange) return;

        const removeIds = new Set(
            pendingLocationChange.incompatibleObjects.map((item) => item.id)
        );

        const nextObjects = objects.filter((obj) => !removeIds.has(obj.id));

        setObjectsWithHistory(nextObjects, null);
        setActiveDrawType(null);
        setStep1LocationType(pendingLocationChange.nextLocation);

        locationChangeSyncRef.current = {
            previousLocation: pendingLocationChange.currentLocation,
            nextLocation: pendingLocationChange.nextLocation,
            removedObjectIds: pendingLocationChange.incompatibleObjects.map((item) => item.id),
        };

        notify(
            APP_NOTIFICATIONS.locationChangedWithRemovedObjects(
                pendingLocationChange.currentLocationLabel,
                pendingLocationChange.nextLocationLabel,
                pendingLocationChange.incompatibleObjectTitles
            )
        );

        setPendingLocationChange(null);
    }, [
        notify,
        objects,
        pendingLocationChange,
        setActiveDrawType,
        setObjectsWithHistory,
        setStep1LocationType,
    ]);

    useEffect(() => {
        const sync = locationChangeSyncRef.current;
        if (!sync) return;

        const removedObjectsPresent = sync.removedObjectIds.every((id) =>
            objects.some((obj) => obj.id === id)
        );

        const removedObjectsAbsent = sync.removedObjectIds.every((id) =>
            !objects.some((obj) => obj.id === id)
        );

        if (step1.locationType === sync.nextLocation && removedObjectsPresent) {
            setStep1LocationType(sync.previousLocation);
            return;
        }

        if (step1.locationType === sync.previousLocation && removedObjectsAbsent) {
            setStep1LocationType(sync.nextLocation);
        }
    }, [
        objects,
        redoStack.length,
        setStep1LocationType,
        step1.locationType,
        undoStack.length,
    ]);

    useEffect(() => {
        const allStepsComplete =
            isStep1Complete() &&
            isStep2Complete() &&
            isStep3Complete() &&
            isStep4Complete();

        const noticeState = wizardCompletionNoticeRef.current;

        if (!noticeState.hasInitialized) {
            noticeState.hasInitialized = true;
            noticeState.wasComplete = allStepsComplete;
            return;
        }

        if (!allStepsComplete) {
            noticeState.wasComplete = false;
            return;
        }

        if (!noticeState.wasComplete && noticeState.shouldNotifyOnNextComplete) {
            notify(APP_NOTIFICATIONS.rightStepMenuCompleted());
            noticeState.shouldNotifyOnNextComplete = false;
        }

        noticeState.wasComplete = true;
    }, [
        isStep1Complete,
        isStep2Complete,
        isStep3Complete,
        isStep4Complete,
        notify,
        step1,
        step2,
        step3,
        step4,
    ]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const rawStep = window.sessionStorage.getItem("plantSelectionReturnStep");
        if (!rawStep) return;

        const parsedStep = Number(rawStep);

        if (
            !Number.isInteger(parsedStep) ||
            parsedStep < 1 ||
            parsedStep > 4
        ) {
            window.sessionStorage.removeItem("plantSelectionReturnStep");
            return;
        }

        const targetStep = parsedStep as RightStepId;

        if (!isStepAccessible(targetStep)) {
            return;
        }

        if (activeStep !== targetStep) {
            setActiveStep(targetStep);
        }

        const clearTimer = window.setTimeout(() => {
            if (window.sessionStorage.getItem("plantSelectionReturnStep") === String(targetStep)) {
                window.sessionStorage.removeItem("plantSelectionReturnStep");
            }
        }, 500);

        return () => {
            window.clearTimeout(clearTimer);
        };
    }, [activeStep, isStepAccessible, setActiveStep]);

    const completedStepsCount = useMemo(() => {
        let count = 0;

        if (isStep1Complete()) count += 1;
        if (isStep2Complete()) count += 1;
        if (isStep3Complete()) count += 1;
        if (isStep4Complete()) count += 1;

        return count;
    }, [step1, step2, step3, step4, isStep1Complete, isStep2Complete, isStep3Complete, isStep4Complete]);

    const activeStepMeta = useMemo(() => {
        return (
            RIGHT_STEP_MENU_STEPS.find((step: RightStepMenuStep) => step.id === activeStep) ??
            RIGHT_STEP_MENU_STEPS[0]
        );
    }, [activeStep]);

    const step1FollowUpConfig = step1.locationType
        ? RIGHT_STEP_STEP1_FOLLOW_UP_BY_LOCATION[step1.locationType] ?? null
        : null;

    const handleStepClick = (stepId: RightStepId) => {
        if (!isStepAccessible(stepId)) return;
        setActiveStep(stepId);
    };

    const handlePrevious = () => {
        goToPreviousStep();
    };

    const handleNext = () => {
        // Stap 4 = naar plantenlijst pagina
        if (activeStep === 4) {
            if (!isStep4Complete()) return;
            router.push("/plantenlijst");
            return;
        }

        // Overige stappen blijven normaal werken
        goToNextStep();
    };

    const handleToggleGardenZone = (value: string) => {
        markWizardInputChanged();
        toggleStep1GardenZone(value);
    };

    const handleToggleStep2Standplaats = (value: string) => {
        markWizardInputChanged();
        toggleStep2Standplaats(value);
    };

    const handleSelectStep2GroundType = (value: string) => {
        markWizardInputChanged();
        setStep2GroundType(value);
    };

    const handleSelectStep2MaintenanceLevel = (value: string) => {
        markWizardInputChanged();
        setStep2MaintenanceLevel(value);
    };

    const handleSelectStep2CertificationPreference = (value: string) => {
        markWizardInputChanged();
        setStep2CertificationPreference(value);
    };

    const handleSelectStep3StructureStyle = (value: string) => {
        markWizardInputChanged();
        setStep3StructureStyle(value);
    };

    const handleChangeStep3CustomPercentage = (
        key: Parameters<typeof setStep3CustomPercentage>[0],
        value: string
    ) => {
        markWizardInputChanged();
        setStep3CustomPercentage(key, value);
    };

    const handleSelectStep4SeasonExperience = (value: string) => {
        markWizardInputChanged();
        setStep4SeasonExperience(value);
    };

    const handleSelectStep4HeightStyle = (value: string) => {
        markWizardInputChanged();
        setStep4HeightStyle(value);
    };

    const isNextDisabled =
        (activeStep === 1 && !isStep1Valid) ||
        (activeStep === 2 && !isStep2Valid) ||
        (activeStep === 3 && !isStep3Complete()) ||
        (activeStep < 4 && activeStep >= maxAccessibleStep);

    const isStep4NextDisabled = activeStep === 4 ? !isStep4Complete() : isNextDisabled;

    return (
        <div
            className="fixed z-30"
            style={{
                right: 18,
                bottom: 18,
                width: 420,
                maxWidth: "calc(100vw - 24px)",
                height: `calc(100vh - ${TOP_OFFSET + 18}px)`,
                maxHeight: `calc(100vh - ${TOP_OFFSET + 18}px)`,
            }}
        >
            <div
                className="relative rounded-2xl overflow-hidden border bg-white flex flex-col"
                style={{
                    height: "100%",
                    maxHeight: "100%",
                    borderColor: COLORS.border,
                    boxShadow: "0px 6px 18px rgba(0,0,0,0.18)",
                }}
            >
                <div
                    className="px-4 pt-4 pb-3 border-b shrink-0"
                    style={{ borderColor: COLORS.border }}
                >
                    <div className="flex items-center justify-between gap-2">
                        {RIGHT_STEP_MENU_STEPS.map((step: RightStepMenuStep, index: number) => {
                            const isCompleted = step.id < activeStep && step.id <= maxAccessibleStep;
                            const isActive = step.id === activeStep;
                            const isAccessible = isStepAccessible(step.id);

                            return (
                                <React.Fragment key={step.id}>
                                    <button
                                        type="button"
                                        onClick={() => handleStepClick(step.id)}
                                        disabled={!isAccessible}
                                        className="relative flex items-center justify-center rounded-full font-semibold transition-all"
                                        style={{
                                            width: 34,
                                            height: 34,
                                            border: isActive
                                                ? `2px dashed ${COLORS.green}`
                                                : `2px solid ${isCompleted ? COLORS.green : "#D9D9D9"}`,
                                            background: isCompleted
                                                ? COLORS.green
                                                : isActive
                                                    ? COLORS.greenLight
                                                    : "#F7F7F7",
                                            color: isCompleted
                                                ? "#FFFFFF"
                                                : isActive
                                                    ? COLORS.green
                                                    : "#8E8E8E",
                                            cursor: isAccessible ? "pointer" : "not-allowed",
                                            opacity: isAccessible ? 1 : 0.7,
                                            fontSize: 16,
                                            lineHeight: 1,
                                            flex: "0 0 auto",
                                        }}
                                        aria-label={step.label}
                                    >
                                        {step.id}
                                    </button>

                                    {index < RIGHT_STEP_MENU_STEPS.length - 1 && (
                                        <div
                                            style={{
                                                flex: 1,
                                                height: 2,
                                                background:
                                                    step.id < activeStep
                                                        ? COLORS.green
                                                        : "#E5E5E5",
                                                borderRadius: 999,
                                                minWidth: 18,
                                            }}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                <div
                    className="right-step-scroll flex-1 min-h-0 overflow-y-auto"
                    style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "#B8B8B8 transparent",
                    }}
                >
                    {activeStep === 1 && (
                        <RightStepStep1Location
                            stepLabel={activeStepMeta.title}
                            locationOptions={RIGHT_STEP_STEP1_LOCATION_OPTIONS}
                            gardenZoneQuestion={step1FollowUpConfig?.question ?? ""}
                            gardenZoneOptions={step1FollowUpConfig?.options ?? []}
                            selectedLocation={step1.locationType ?? ""}
                            selectedGardenZones={step1.gardenZones}
                            onSelectLocation={handleSelectLocation}
                            onToggleGardenZone={handleToggleGardenZone}
                        />
                    )}

                    {activeStep === 2 && (
                        <RightStepStep2Conditions
                            stepLabel={activeStepMeta.title}
                            selectedStandplaatsen={step2.standplaatsen}
                            selectedGroundTypes={step2.groundTypes}
                            selectedMaintenanceLevel={step2.maintenanceLevel ?? ""}
                            selectedCertificationPreference={step2.certificationPreference ?? ""}
                            standplaatsOptions={RIGHT_STEP_STEP2_STANDPLAATS_OPTIONS}
                            soilOptions={RIGHT_STEP_STEP2_SOIL_OPTIONS}
                            maintenanceOptions={RIGHT_STEP_STEP2_MAINTENANCE_OPTIONS}
                            certificationOptions={RIGHT_STEP_STEP2_CERTIFICATION_OPTIONS}
                            onToggleStandplaats={handleToggleStep2Standplaats}
                            onSelectGroundType={handleSelectStep2GroundType}
                            onSelectMaintenanceLevel={handleSelectStep2MaintenanceLevel}
                            onSelectCertificationPreference={handleSelectStep2CertificationPreference}
                        />
                    )}

                    {activeStep === 3 && (
                        <RightStepStep3Structure
                            stepLabel={activeStepMeta.title}
                            structureOptions={RIGHT_STEP_STEP3_STRUCTURE_OPTIONS}
                            selectedStructureStyle={step3.structureStyle ?? ""}
                            customPercentages={step3.customPercentages}
                            onSelectStructureStyle={handleSelectStep3StructureStyle}
                            onChangeCustomPercentage={handleChangeStep3CustomPercentage}
                        />
                    )}
                    {activeStep === 4 && (
                        <RightStepStep4Experience
                            stepLabel={activeStepMeta.title}
                            selectedSeasonExperience={step4.seasonExperience ?? ""}
                            selectedHeightStyle={step4.heightStyle ?? ""}
                            onSelectSeasonExperience={handleSelectStep4SeasonExperience}
                            onSelectHeightStyle={handleSelectStep4HeightStyle}
                        />
                    )}
                </div>

                <div
                    className="border-t px-4 pt-1 pb-4 shrink-0"
                    style={{ borderColor: COLORS.border }}
                >
                    <button
                        type="button"
                        onClick={() => setIsSummaryOpen(true)}
                        className="w-full mb-1 flex items-center justify-between gap-2 px-2 py-2 text-left transition-colors"
                        style={{
                            background: "transparent",
                            cursor: "pointer",
                        }}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div
                                className="flex items-center justify-center rounded-full"
                                style={{
                                    width: 32,
                                    height: 32,
                                    background: COLORS.green,
                                    flex: "0 0 auto",
                                }}
                            >
                                <img
                                    src="/icons/list.svg"
                                    alt=""
                                    style={{
                                        width: 16,
                                        height: 16,
                                        display: "block",
                                        filter: "brightness(0) invert(1)",
                                    }}
                                />
                            </div>

                            <div className="min-w-0">
                                <div
                                    className="font-semibold text-[14px] leading-[1.2]"
                                    style={{ color: "#111111" }}
                                >
                                    Samenvatting beplanting ({completedStepsCount})
                                </div>

                                <div
                                    className="text-[11px] leading-[1.3] italic"
                                    style={{ color: "#898988" }}
                                >
                                    Bekijk wat je hebt ingevuld
                                </div>
                            </div>
                        </div>

                        <img
                            src="/icons/chevron-down.svg"
                            alt=""
                            style={{
                                width: 16,
                                height: 16,
                                display: "block",
                                flex: "0 0 auto",
                                opacity: 0.7,
                            }}
                        />
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={handlePrevious}
                            disabled={activeStep === 1}
                            className="rounded-lg px-4 py-3 font-semibold border flex items-center justify-center gap-2 transition-colors"
                            style={{
                                borderColor: COLORS.border,
                                background: "#FFFFFF",
                                color: activeStep === 1 ? COLORS.lightText : "#7A7A7A",
                                cursor: activeStep === 1 ? "not-allowed" : "pointer",
                            }}
                        >
                            <img
                                src="/icons/chevron-left.svg"
                                alt=""
                                style={{
                                    width: 16,
                                    height: 16,
                                    flex: "0 0 auto",
                                    display: "block",
                                    filter: activeStep === 1
                                        ? "brightness(0) saturate(100%) opacity(0.45)"
                                        : "brightness(0) saturate(100%) opacity(0.7)",
                                }}
                            />
                            <span>Vorige</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={isStep4NextDisabled}
                            className="rounded-lg px-4 py-3 font-semibold border flex items-center justify-center gap-2 transition-colors"
                            style={{
                                borderColor: isStep4NextDisabled ? "#F4C8B8" : COLORS.orange,
                                background: isStep4NextDisabled ? "#FCE6DD" : COLORS.orange,
                                color: isStep4NextDisabled ? "#CC8D75" : "#FFFFFF",
                                cursor: isStep4NextDisabled ? "not-allowed" : "pointer",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: activeStep === 4 ? 14 : 15,
                                    lineHeight: 1.2,
                                }}
                            >
                                {activeStep === 4 ? "Kies jouw planten" : "Volgende"}
                            </span>
                            <img
                                src="/icons/chevron-right.svg"
                                alt=""
                                style={{
                                    width: 16,
                                    height: 16,
                                    flex: "0 0 auto",
                                    display: "block",
                                    opacity: isStep4NextDisabled ? 0.55 : 1,
                                    filter: isStep4NextDisabled
                                        ? "none"
                                        : "brightness(0) invert(1)",
                                }}
                            />
                        </button>
                    </div>

                    <div className="mt-3 text-[11px]" style={{ color: COLORS.mutedText }}>
                        Ondersteuning nodig?{" "}
                        <a
                            href="https://olaf-nijenkamp.nl/bezoekadres-en-contact"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                            style={{
                                color: COLORS.orange,
                                cursor: "pointer",
                            }}
                        >
                            Neem contact op
                        </a>{" "}
                        met ons team.
                    </div>
                </div>
            </div>
            <style jsx>{`
                .right-step-scroll::-webkit-scrollbar {
                    width: 8px;
                }

                .right-step-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }

                .right-step-scroll::-webkit-scrollbar-thumb {
                    background: #b8b8b8;
                    border-radius: 999px;
                    border: 2px solid transparent;
                    background-clip: padding-box;
                }

                .right-step-scroll::-webkit-scrollbar-thumb:hover {
                    background: #9f9f9f;
                    border: 2px solid transparent;
                    background-clip: padding-box;
                }
            `}</style>

            {isSummaryOpen && (
                <RightStepMenuSummaryOverlay
                    step1={step1}
                    step2={step2}
                    step3={step3}
                    step4={step4}
                    isStep1Complete={isStep1Complete()}
                    isStep2Complete={isStep2Complete()}
                    isStep3Complete={isStep3Complete()}
                    isStep4Complete={isStep4Complete()}
                    onClose={() => setIsSummaryOpen(false)}
                />
            )}

            <ConfirmModal
                open={pendingLocationChange !== null}
                title={
                    pendingLocationChange
                        ? `Locatie wijzigen van '${pendingLocationChange.currentLocationLabel}' naar '${pendingLocationChange.nextLocationLabel}' ?`
                        : ""
                }
                description={
                    pendingLocationChange ? (
                        <>
                            Je hebt al objecten getekend die horen bij de locatie{" "}
                            <strong>‘{pendingLocationChange.currentLocationLabel}’</strong>.
                            <br />
                            Bij het wijzigen van de locatie naar{" "}
                            <strong>‘{pendingLocationChange.nextLocationLabel}’</strong> worden{" "}
                            {pendingLocationChange.incompatibleObjects.length} niet-passende{" "}
                            {pendingLocationChange.incompatibleObjects.length === 1 ? "object" : "objecten"} verwijderd.
                            Objecten die in beide locaties beschikbaar zijn blijven bewaard.
                        </>
                    ) : null
                }
                listTitle="Objecten die verwijderd worden:"
                listVariant="bullets"
                items={
                    pendingLocationChange?.incompatibleObjectTitles.map((title) => ({
                        id: title,
                        title,
                    })) ?? []
                }
                maxPreviewItems={4}
                moreLabel={(hiddenCount: number) => `+ nog ${hiddenCount} andere`}
                cancelText="Nee, behouden"
                confirmText="Ja, wijzig locatie"
                onCancel={handleCancelLocationChange}
                onConfirm={handleConfirmLocationChange}
            />
        </div>
    );
}