import { create } from "zustand";

export type RightStepId = 1 | 2 | 3 | 4;

export type RightStepStep1State = {
    locationType: string | null;
    gardenZones: string[];
};

export type RightStepStep2State = {
    standplaatsen: string[];
    groundTypes: string[];
    maintenanceLevel: string | null;
    certificationPreference: string | null;
};

export type RightStepStep3CustomPercentages = {
    bodembedekkers: string;
    vastePlanten: string;
    heestersEnStruiken: string;
    bomen: string;
};

export type RightStepStep3State = {
    structureStyle: string | null;
    customPercentages: RightStepStep3CustomPercentages;
};

export type RightStepStep4State = {
    seasonExperience: string | null;
    heightStyle: string | null;
};

export type RightStepMenuState = {
    activeStep: RightStepId;

    step1: RightStepStep1State;
    step2: RightStepStep2State;
    step3: RightStepStep3State;
    step4: RightStepStep4State;

    setActiveStep: (step: RightStepId) => void;
    goToPreviousStep: () => void;
    goToNextStep: () => void;

    setStep1LocationType: (value: string) => void;
    toggleStep1GardenZone: (value: string) => void;

    toggleStep2Standplaats: (value: string) => void;
    setStep2GroundType: (value: string) => void;
    setStep2MaintenanceLevel: (value: string) => void;
    setStep2CertificationPreference: (value: string) => void;

    setStep3StructureStyle: (value: string) => void;
    setStep3CustomPercentage: (
        key: keyof RightStepStep3CustomPercentages,
        value: string
    ) => void;

    setStep4SeasonExperience: (value: string) => void;
    setStep4HeightStyle: (value: string) => void;

    isStep1Complete: () => boolean;
    isStep2Complete: () => boolean;
    isStep3Complete: () => boolean;
    isStep4Complete: () => boolean;
    isStepAccessible: (step: RightStepId) => boolean;
    getMaxAccessibleStep: () => RightStepId;

    resetRightStepMenu: () => void;
};

const INITIAL_STEP1_STATE: RightStepStep1State = {
    locationType: null,
    gardenZones: [],
};

const INITIAL_STEP2_STATE: RightStepStep2State = {
    standplaatsen: [],
    groundTypes: [],
    maintenanceLevel: null,
    certificationPreference: null,
};

const INITIAL_STEP3_STATE: RightStepStep3State = {
    structureStyle: null,
    customPercentages: {
        bodembedekkers: "",
        vastePlanten: "",
        heestersEnStruiken: "",
        bomen: "",
    },
};

const INITIAL_STEP4_STATE: RightStepStep4State = {
    seasonExperience: null,
    heightStyle: null,
};

export const useRightStepMenuStore = create<RightStepMenuState>((set, get) => ({
    activeStep: 1,

    step1: INITIAL_STEP1_STATE,
    step2: INITIAL_STEP2_STATE,
    step3: INITIAL_STEP3_STATE,
    step4: INITIAL_STEP4_STATE,

    setActiveStep: (step) => {
        const isAccessible = get().isStepAccessible(step);
        if (!isAccessible) return;

        set({ activeStep: step });
    },

    goToPreviousStep: () => {
        const current = get().activeStep;
        if (current <= 1) return;

        set({ activeStep: (current - 1) as RightStepId });
    },

    goToNextStep: () => {
        const current = get().activeStep;
        const maxAccessibleStep = get().getMaxAccessibleStep();

        if (current >= maxAccessibleStep) return;
        if (current >= 4) return;

        set({ activeStep: (current + 1) as RightStepId });
    },

    setStep1LocationType: (value) => {
        set((state) => {
            if (state.step1.locationType === value) {
                return state;
            }

            return {
                step1: {
                    ...state.step1,
                    locationType: value,
                    gardenZones: [],
                },
            };
        });
    },

    toggleStep1GardenZone: (value) => {
        set((state) => {
            const alreadySelected = state.step1.gardenZones.includes(value);

            return {
                step1: {
                    ...state.step1,
                    gardenZones: alreadySelected
                        ? state.step1.gardenZones.filter((item) => item !== value)
                        : [...state.step1.gardenZones, value],
                },
            };
        });
    },

    toggleStep2Standplaats: (value) => {
        set((state) => {
            const alreadySelected = state.step2.standplaatsen.includes(value);

            return {
                step2: {
                    ...state.step2,
                    standplaatsen: alreadySelected
                        ? state.step2.standplaatsen.filter((item) => item !== value)
                        : [...state.step2.standplaatsen, value],
                },
            };
        });
    },

    setStep2GroundType: (value) => {
        set((state) => {
            const alreadySelected = state.step2.groundTypes.includes(value);

            return {
                step2: {
                    ...state.step2,
                    groundTypes: alreadySelected
                        ? state.step2.groundTypes.filter((item) => item !== value)
                        : [...state.step2.groundTypes, value],
                },
            };
        });
    },

    setStep2MaintenanceLevel: (value) => {
        set((state) => ({
            step2: {
                ...state.step2,
                maintenanceLevel: state.step2.maintenanceLevel === value ? null : value,
            },
        }));
    },

    setStep2CertificationPreference: (value) => {
        set((state) => ({
            step2: {
                ...state.step2,
                certificationPreference:
                    state.step2.certificationPreference === value ? null : value,
            },
        }));
    },

    setStep3StructureStyle: (value) => {
        set((state) => ({
            step3: {
                ...state.step3,
                structureStyle: state.step3.structureStyle === value ? null : value,
            },
        }));
    },

    setStep3CustomPercentage: (key, value) => {
        const cleaned = value.replace(/[^\d]/g, "").slice(0, 3);
        const normalized =
            cleaned === "" ? "" : String(Math.min(100, Number(cleaned)));

        set((state) => ({
            step3: {
                ...state.step3,
                customPercentages: {
                    ...state.step3.customPercentages,
                    [key]: normalized,
                },
            },
        }));
    },

    setStep4SeasonExperience: (value) => {
        set((state) => ({
            step4: {
                ...state.step4,
                seasonExperience: state.step4.seasonExperience === value ? null : value,
            },
        }));
    },

    setStep4HeightStyle: (value) => {
        set((state) => ({
            step4: {
                ...state.step4,
                heightStyle: state.step4.heightStyle === value ? null : value,
            },
        }));
    },

    isStep1Complete: () => {
        const { step1 } = get();

        return Boolean(step1.locationType) && step1.gardenZones.length > 0;
    },

    isStep2Complete: () => {
        const { step2 } = get();

        return (
            step2.standplaatsen.length > 0 &&
            step2.groundTypes.length > 0 &&
            Boolean(step2.maintenanceLevel) &&
            Boolean(step2.certificationPreference)
        );
    },

    isStep3Complete: () => {
        const { step3 } = get();

        if (!step3.structureStyle) return false;
        if (step3.structureStyle !== "vrij-samenstellen") return true;

        const values = [
            Number(step3.customPercentages.bodembedekkers || 0),
            Number(step3.customPercentages.vastePlanten || 0),
            Number(step3.customPercentages.heestersEnStruiken || 0),
            Number(step3.customPercentages.bomen || 0),
        ];

        const hasAllValues = Object.values(step3.customPercentages).every(
            (value) => value !== ""
        );

        const total = values.reduce((sum, value) => sum + value, 0);

        return hasAllValues && total === 100;
    },

    isStep4Complete: () => {
        const { step4 } = get();

        return Boolean(step4.seasonExperience) && Boolean(step4.heightStyle);
    },

    isStepAccessible: (step) => {
        const maxAccessibleStep = get().getMaxAccessibleStep();
        return step <= maxAccessibleStep;
    },

    getMaxAccessibleStep: () => {
        const isStep1Complete = get().isStep1Complete();
        const isStep2Complete = get().isStep2Complete();
        const isStep3Complete = get().isStep3Complete();

        if (isStep1Complete && isStep2Complete && isStep3Complete) return 4;
        if (isStep1Complete && isStep2Complete) return 3;
        if (isStep1Complete) return 2;

        return 1;
    },

    resetRightStepMenu: () => {
        set({
            activeStep: 1,
            step1: INITIAL_STEP1_STATE,
            step2: INITIAL_STEP2_STATE,
            step3: INITIAL_STEP3_STATE,
            step4: INITIAL_STEP4_STATE,
        });
    },
}));