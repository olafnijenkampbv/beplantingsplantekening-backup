import { DRAWINGS_STORAGE_KEY } from "@/features/editor/editorDrawingsPersistence";

export type PersistedRightStepMenuSnapshot = {
    activeStep: 1 | 2 | 3 | 4;
    step1: {
        locationType: string | null;
        gardenZones: string[];
    };
    step2: {
        standplaatsen: string[];
        groundTypes: string[];
        maintenanceLevel: string | null;
        certificationPreference: string | null;
    };
    step3: {
        structureStyle: string | null;
        customPercentages: {
            bodembedekkers: string;
            vastePlanten: string;
            heestersEnStruiken: string;
            bomen: string;
        };
    };
    step4: {
        seasonExperience: string | null;
        heightStyle: string | null;
    };
};

export const RIGHT_STEP_MENU_STORAGE_KEY = `${DRAWINGS_STORAGE_KEY}::wizard`;

export function createEmptyRightStepMenuSnapshot(): PersistedRightStepMenuSnapshot {
    return {
        activeStep: 1,
        step1: {
            locationType: null,
            gardenZones: [],
        },
        step2: {
            standplaatsen: [],
            groundTypes: [],
            maintenanceLevel: null,
            certificationPreference: null,
        },
        step3: {
            structureStyle: null,
            customPercentages: {
                bodembedekkers: "",
                vastePlanten: "",
                heestersEnStruiken: "",
                bomen: "",
            },
        },
        step4: {
            seasonExperience: null,
            heightStyle: null,
        },
    };
}

function sanitizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
}

function sanitizeOptionalString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function sanitizeRightStepMenuSnapshot(
    value: any
): PersistedRightStepMenuSnapshot {
    const empty = createEmptyRightStepMenuSnapshot();

    const rawActiveStep = value?.activeStep;
    const activeStep =
        rawActiveStep === 1 ||
            rawActiveStep === 2 ||
            rawActiveStep === 3 ||
            rawActiveStep === 4
            ? rawActiveStep
            : 1;

    return {
        activeStep,
        step1: {
            locationType: sanitizeOptionalString(value?.step1?.locationType),
            gardenZones: sanitizeStringArray(value?.step1?.gardenZones),
        },
        step2: {
            standplaatsen: sanitizeStringArray(value?.step2?.standplaatsen),
            groundTypes: sanitizeStringArray(value?.step2?.groundTypes),
            maintenanceLevel: sanitizeOptionalString(value?.step2?.maintenanceLevel),
            certificationPreference: sanitizeOptionalString(value?.step2?.certificationPreference),
        },
        step3: {
            structureStyle: sanitizeOptionalString(value?.step3?.structureStyle),
            customPercentages: {
                bodembedekkers:
                    typeof value?.step3?.customPercentages?.bodembedekkers === "string"
                        ? value.step3.customPercentages.bodembedekkers
                        : empty.step3.customPercentages.bodembedekkers,
                vastePlanten:
                    typeof value?.step3?.customPercentages?.vastePlanten === "string"
                        ? value.step3.customPercentages.vastePlanten
                        : empty.step3.customPercentages.vastePlanten,
                heestersEnStruiken:
                    typeof value?.step3?.customPercentages?.heestersEnStruiken === "string"
                        ? value.step3.customPercentages.heestersEnStruiken
                        : empty.step3.customPercentages.heestersEnStruiken,
                bomen:
                    typeof value?.step3?.customPercentages?.bomen === "string"
                        ? value.step3.customPercentages.bomen
                        : empty.step3.customPercentages.bomen,
            },
        },
        step4: {
            seasonExperience: sanitizeOptionalString(value?.step4?.seasonExperience),
            heightStyle: sanitizeOptionalString(value?.step4?.heightStyle),
        },
    };
}

export function sanitizeRightStepMenuSnapshotsByDrawingId(
    value: unknown
): Record<string, PersistedRightStepMenuSnapshot> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([drawingId, snapshot]) => [
            drawingId,
            sanitizeRightStepMenuSnapshot(snapshot),
        ])
    );
}