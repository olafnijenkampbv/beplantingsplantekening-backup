import {
    readActiveDrawingIdFromStorage,
    readRightStepSnapshotsByDrawingIdFromStorage,
    writeActiveDrawingIdToStorage,
    writeRightStepSnapshotsByDrawingIdToStorage,
} from "@/features/editor/lib/appDrawingPersistence";

export function goBackToEditor() {
    if (typeof window === "undefined") {
        return;
    }

    const activeDrawingId =
        window.localStorage.getItem("hello-editor:drawings:v1::active-drawing");

    writeActiveDrawingIdToStorage(
        typeof activeDrawingId === "string" && activeDrawingId.trim() !== ""
            ? activeDrawingId
            : null
    );

    window.sessionStorage.setItem("hello-editor:return-to-editor", "1");
    window.location.assign("/");
}

export function goToPlantLinkingEditor() {
    if (typeof window === "undefined") {
        return;
    }

    const activeDrawingId =
        window.localStorage.getItem("hello-editor:drawings:v1::active-drawing");

    const normalizedActiveDrawingId =
        typeof activeDrawingId === "string" && activeDrawingId.trim() !== ""
            ? activeDrawingId
            : null;

    if (normalizedActiveDrawingId) {
        window.sessionStorage.setItem(
            `hello-editor:right-panel-mode:${normalizedActiveDrawingId}`,
            "plants"
        );
    }

    writeActiveDrawingIdToStorage(normalizedActiveDrawingId);
    window.sessionStorage.setItem("hello-editor:return-to-editor", "1");
    window.location.assign("/");
}

export function goToPlantSelectionPage() {
    if (typeof window === "undefined") {
        return;
    }

    const activeDrawingId =
        window.localStorage.getItem("hello-editor:drawings:v1::active-drawing");

    const normalizedActiveDrawingId =
        typeof activeDrawingId === "string" && activeDrawingId.trim() !== ""
            ? activeDrawingId
            : null;

    writeActiveDrawingIdToStorage(normalizedActiveDrawingId);
    window.location.assign("/plantenlijst");
}

export function goToFinalisatie() {
    if (typeof window === "undefined") {
        return;
    }

    window.location.assign("/beplantingsplan-afronden");
}

export function goToWorkflowStepFromPlantSelection(stepId: number) {
    if (typeof window === "undefined") {
        return;
    }

    if (stepId >= 1 && stepId <= 4) {
        const targetStep = stepId as 1 | 2 | 3 | 4;

        // Persist the target step directly in the snapshot so the editor loads
        // at the correct step on hydration, without relying on sessionStorage timing.
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

            // Ensure the editor opens the step wizard panel, not the plant list panel.
            window.sessionStorage.setItem(
                `hello-editor:right-panel-mode:${activeDrawingId}`,
                "steps"
            );
        }

        window.sessionStorage.setItem("hello-editor:return-to-editor", "1");
        window.location.assign("/");
        return;
    }

    if (stepId === 5) {
        return;
    }
}