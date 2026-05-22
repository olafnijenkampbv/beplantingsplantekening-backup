import { writeActiveDrawingIdToStorage } from "@/features/editor/lib/appDrawingPersistence";

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

export function goToWorkflowStepFromPlantSelection(stepId: number) {
    if (typeof window === "undefined") {
        return;
    }

    if (stepId >= 1 && stepId <= 4) {
        window.sessionStorage.setItem("plantSelectionReturnStep", String(stepId));
        window.location.assign("/");
        return;
    }

    if (stepId === 5) {
        return;
    }
}