import {
    DRAWINGS_STORAGE_KEY,
    PersistedDrawingDocument,
    sanitizeDrawingDocument,
} from "@/features/editor/editorDrawingsPersistence";
import {
    PersistedRightStepMenuSnapshot,
    RIGHT_STEP_MENU_STORAGE_KEY,
    createEmptyRightStepMenuSnapshot,
    sanitizeRightStepMenuSnapshot,
    sanitizeRightStepMenuSnapshotsByDrawingId,
} from "@/features/editor/lib/rightStepMenuPersistence";
import {
    PersistedPlantSelectionSnapshot,
    createEmptyPlantSelectionSnapshot,
    sanitizePlantSelectionSnapshot,
} from "@/features/editor/state/plantSelectionStore";

export const ACTIVE_DRAWING_STORAGE_KEY = `${DRAWINGS_STORAGE_KEY}::active-drawing`;
export const PLANT_SELECTION_STORAGE_KEY = `${DRAWINGS_STORAGE_KEY}::plant-selection`;
export const PANEL_MODE_STORAGE_KEY = `${DRAWINGS_STORAGE_KEY}::panel-mode`;

export type EditorRightPanelMode = "steps" | "plants";

export function readPanelModeForDrawing(
    drawingId: string | null
): EditorRightPanelMode {
    if (!drawingId || typeof window === "undefined") return "steps";
    try {
        const raw = window.localStorage.getItem(PANEL_MODE_STORAGE_KEY);
        if (!raw) return "steps";
        const parsed = JSON.parse(raw);
        return parsed[drawingId] === "plants" ? "plants" : "steps";
    } catch {
        return "steps";
    }
}

export function writePanelModeForDrawing(
    drawingId: string | null,
    mode: EditorRightPanelMode
): void {
    if (!drawingId || typeof window === "undefined") return;
    try {
        const raw = window.localStorage.getItem(PANEL_MODE_STORAGE_KEY);
        const current: Record<string, string> = raw ? JSON.parse(raw) : {};
        current[drawingId] = mode;
        window.localStorage.setItem(PANEL_MODE_STORAGE_KEY, JSON.stringify(current));
    } catch { }
}

export type PersistedPlantSelectionSnapshotsByDrawingId = Record<
    string,
    PersistedPlantSelectionSnapshot
>;

export function readDrawingsFromStorage(): {
    drawings: PersistedDrawingDocument[];
    activeDrawingId: string | null;
} {
    if (typeof window === "undefined") {
        return {
            drawings: [],
            activeDrawingId: null,
        };
    }

    try {
        const raw = window.localStorage.getItem(DRAWINGS_STORAGE_KEY);
        if (!raw) {
            return {
                drawings: [],
                activeDrawingId: null,
            };
        }

        const parsed = JSON.parse(raw);
        const rawDrawings = Array.isArray(parsed?.drawings) ? parsed.drawings : [];

        const drawings = rawDrawings
            .map((item: unknown) => sanitizeDrawingDocument(item))
            .filter((item: PersistedDrawingDocument | null): item is PersistedDrawingDocument => item !== null);

        const activeDrawingId =
            typeof parsed?.activeDrawingId === "string" &&
                drawings.some(
                    (drawing: PersistedDrawingDocument) =>
                        drawing.id === parsed.activeDrawingId
                )
                ? parsed.activeDrawingId
                : drawings[0]?.id ?? null;

        return {
            drawings,
            activeDrawingId,
        };
    } catch {
        return {
            drawings: [],
            activeDrawingId: null,
        };
    }
}

export function writeDrawingsToStorage(
    drawings: PersistedDrawingDocument[],
    activeDrawingId: string | null
) {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
        DRAWINGS_STORAGE_KEY,
        JSON.stringify({
            drawings,
            activeDrawingId,
        })
    );

    if (activeDrawingId) {
        window.localStorage.setItem(ACTIVE_DRAWING_STORAGE_KEY, activeDrawingId);
    } else {
        window.localStorage.removeItem(ACTIVE_DRAWING_STORAGE_KEY);
    }
}

export function readActiveDrawingIdFromStorage(): string | null {
    if (typeof window === "undefined") return null;

    const value = window.localStorage.getItem(ACTIVE_DRAWING_STORAGE_KEY);
    return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function writeActiveDrawingIdToStorage(activeDrawingId: string | null) {
    if (typeof window === "undefined") return;

    if (activeDrawingId) {
        window.localStorage.setItem(ACTIVE_DRAWING_STORAGE_KEY, activeDrawingId);
        return;
    }

    window.localStorage.removeItem(ACTIVE_DRAWING_STORAGE_KEY);
}

export function readRightStepSnapshotsByDrawingIdFromStorage(): Record<
    string,
    PersistedRightStepMenuSnapshot
> {
    if (typeof window === "undefined") return {};

    try {
        const raw = window.localStorage.getItem(RIGHT_STEP_MENU_STORAGE_KEY);
        if (!raw) return {};

        return sanitizeRightStepMenuSnapshotsByDrawingId(JSON.parse(raw));
    } catch {
        return {};
    }
}

export function writeRightStepSnapshotsByDrawingIdToStorage(
    snapshotsByDrawingId: Record<string, PersistedRightStepMenuSnapshot>
) {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
        RIGHT_STEP_MENU_STORAGE_KEY,
        JSON.stringify(snapshotsByDrawingId)
    );
}

export function readPlantSelectionSnapshotsByDrawingIdFromStorage(): PersistedPlantSelectionSnapshotsByDrawingId {
    if (typeof window === "undefined") return {};

    try {
        const raw = window.localStorage.getItem(PLANT_SELECTION_STORAGE_KEY);
        if (!raw) return {};

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).map(([drawingId, snapshot]) => [
                drawingId,
                sanitizePlantSelectionSnapshot(snapshot),
            ])
        );
    } catch {
        return {};
    }
}

export function writePlantSelectionSnapshotsByDrawingIdToStorage(
    snapshotsByDrawingId: PersistedPlantSelectionSnapshotsByDrawingId
) {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
        PLANT_SELECTION_STORAGE_KEY,
        JSON.stringify(snapshotsByDrawingId)
    );
}

export function getRightStepSnapshotForDrawing(
    drawingId: string | null,
    snapshotsByDrawingId: Record<string, PersistedRightStepMenuSnapshot>
): PersistedRightStepMenuSnapshot {
    if (!drawingId) {
        return createEmptyRightStepMenuSnapshot();
    }

    return sanitizeRightStepMenuSnapshot(
        snapshotsByDrawingId[drawingId] ?? createEmptyRightStepMenuSnapshot()
    );
}

export function getPlantSelectionSnapshotForDrawing(
    drawingId: string | null,
    snapshotsByDrawingId: PersistedPlantSelectionSnapshotsByDrawingId
): PersistedPlantSelectionSnapshot {
    if (!drawingId) {
        return createEmptyPlantSelectionSnapshot();
    }

    return sanitizePlantSelectionSnapshot(
        snapshotsByDrawingId[drawingId] ?? createEmptyPlantSelectionSnapshot()
    );
}