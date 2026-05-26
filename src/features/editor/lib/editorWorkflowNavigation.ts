import {
    readActiveDrawingIdFromStorage,
    readRightStepSnapshotsByDrawingIdFromStorage,
    writeActiveDrawingIdToStorage,
    writeRightStepSnapshotsByDrawingIdToStorage,
    writePanelModeForDrawing,
} from "@/features/editor/lib/appDrawingPersistence";

export function goBackToEditor() {
    if (typeof window === "undefined") return;

    const activeDrawingId = readActiveDrawingIdFromStorage();
    writeActiveDrawingIdToStorage(activeDrawingId);
    window.sessionStorage.setItem("hello-editor:return-to-editor", "1");
    window.location.assign("/");
}

export function goToPlantLinkingEditor() {
    if (typeof window === "undefined") return;

    const activeDrawingId = readActiveDrawingIdFromStorage();

    if (activeDrawingId) {
        writePanelModeForDrawing(activeDrawingId, "plants");
    }

    writeActiveDrawingIdToStorage(activeDrawingId);
    window.sessionStorage.setItem("hello-editor:return-to-editor", "1");
    window.location.assign("/");
}

export function goToPlantSelectionPage() {
    if (typeof window === "undefined") return;

    const activeDrawingId = readActiveDrawingIdFromStorage();
    writeActiveDrawingIdToStorage(activeDrawingId);
    window.location.assign("/plantenlijst");
}

export function goToFinalisatie() {
    if (typeof window === "undefined") return;
    window.location.assign("/beplantingsplan-afronden");
}

export function goToWorkflowStepFromPlantSelection(stepId: number) {
    if (typeof window === "undefined") return;

    if (stepId >= 1 && stepId <= 4) {
        const targetStep = stepId as 1 | 2 | 3 | 4;

        const activeDrawingId = readActiveDrawingIdFromStorage();
        if (activeDrawingId) {
            const snapshotsByDrawingId = readRightStepSnapshotsByDrawingIdFromStorage();
            const currentSnapshot = snapshotsByDrawingId[activeDrawingId];
            if (currentSnapshot) {
                writeRightStepSnapshotsByDrawingIdToStorage({
                    ...snapshotsByDrawingId,
                    [activeDrawingId]: { ...currentSnapshot, activeStep: targetStep },
                });
            }

            writePanelModeForDrawing(activeDrawingId, "steps");
        }

        window.sessionStorage.setItem("hello-editor:return-to-editor", "1");
        window.location.assign("/");
        return;
    }

    if (stepId === 5) {
        return;
    }
}
