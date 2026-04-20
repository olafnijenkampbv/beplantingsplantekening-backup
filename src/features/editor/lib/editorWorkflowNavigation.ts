export function goBackToEditor() {
    if (typeof window === "undefined") {
        return;
    }

    window.location.assign("/");
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