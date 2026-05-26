"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    PersistedDrawingSnapshot,
    PersistedDrawingDocument,
    createDrawingDocument,
    createEmptyDrawingSnapshot,
    cloneDrawingSnapshot,
    clonePolyObject,
    clonePlantbedLinks,
    sanitizePlantbedLinksForObjects,
    buildPlantbedLinkedCountFromLinks,
    DEFAULT_DRAWING_VIEW_VISIBILITY,
} from "@/features/editor/editorDrawingsPersistence";
import {
    PersistedRightStepMenuSnapshot,
    createEmptyRightStepMenuSnapshot,
    sanitizeRightStepMenuSnapshot,
} from "@/features/editor/lib/rightStepMenuPersistence";
import {
    PersistedPlantSelectionSnapshot,
    createEmptyPlantSelectionSnapshot,
    usePlantSelectionStore,
} from "@/features/editor/state/plantSelectionStore";
import {
    readDrawingsFromStorage,
    writeActiveDrawingIdToStorage,
    writeDrawingsToStorage,
    readRightStepSnapshotsByDrawingIdFromStorage,
    writeRightStepSnapshotsByDrawingIdToStorage,
    readPlantSelectionSnapshotsByDrawingIdFromStorage,
    writePlantSelectionSnapshotsByDrawingIdToStorage,
    getPlantSelectionSnapshotForDrawing,
    readPanelModeForDrawing,
    writePanelModeForDrawing,
    type PersistedPlantSelectionSnapshotsByDrawingId,
    type EditorRightPanelMode,
} from "@/features/editor/lib/appDrawingPersistence";
import { useProjectStore } from "@/state/projectStore";
import { useRightStepMenuStore } from "@/features/editor/state/rightStepMenuStore";

export type { EditorRightPanelMode };

export type DrawingLifecycleReturn = {
    editorDrawings: PersistedDrawingDocument[];
    activeDrawingId: string | null;
    activeDrawing: PersistedDrawingDocument | null;
    isDrawingsHydrated: boolean;
    saveState: "saved" | "saving" | "unsaved";
    setSaveState: React.Dispatch<React.SetStateAction<"saved" | "saving" | "unsaved">>;
    rightPanelMode: EditorRightPanelMode;
    setRightPanelMode: (mode: EditorRightPanelMode) => void;
    rightStepSnapshotsByDrawingId: Record<string, PersistedRightStepMenuSnapshot>;
    plantSelectionSnapshotsByDrawingId: PersistedPlantSelectionSnapshotsByDrawingId;
    isDrawingsDashboardOpen: boolean;
    isCreateDrawingOpen: boolean;
    createDrawingOpenSource: "editor" | "dashboard";
    handleOpenDrawingsDashboard: () => void;
    handleCloseDrawingsDashboard: () => void;
    handleOpenCreateDrawingModal: (source: "editor" | "dashboard") => void;
    handleCloseCreateDrawingModal: () => void;
    handleOpenDrawingFromDashboard: (drawingId: string) => void;
    handleCreateDrawingFromDashboard: (name: string) => void;
    handleDuplicateDrawingFromDashboard: (drawingId: string) => void;
    handleDeleteDrawingFromDashboard: (drawingId: string) => void;
    handleRenameDrawingFromDashboard: (drawingId: string, nextName: string) => void;
    saveDrawingSnapshot: (snapshot: PersistedDrawingSnapshot, nowIso: string) => void;
    setRightStepSnapshot: (drawingId: string, snapshot: PersistedRightStepMenuSnapshot) => void;
    setPlantSelectionSnapshot: (drawingId: string, snapshot: PersistedPlantSelectionSnapshot) => void;
    isRestoringDrawingRef: React.MutableRefObject<boolean>;
    isRestoringRightStepMenuRef: React.MutableRefObject<boolean>;
};

export function useDrawingLifecycle(): DrawingLifecycleReturn {
    const [editorDrawings, setEditorDrawings] = useState<PersistedDrawingDocument[]>([]);
    const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);
    const [isDrawingsHydrated, setIsDrawingsHydrated] = useState(false);
    const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
    const [rightPanelModeState, setRightPanelModeState] = useState<EditorRightPanelMode>("steps");
    const [rightStepSnapshotsByDrawingId, setRightStepSnapshotsByDrawingId] = useState<
        Record<string, PersistedRightStepMenuSnapshot>
    >({});
    const [plantSelectionSnapshotsByDrawingId, setPlantSelectionSnapshotsByDrawingId] =
        useState<PersistedPlantSelectionSnapshotsByDrawingId>({});
    const [isDrawingsDashboardOpen, setIsDrawingsDashboardOpen] = useState(false);
    const [isCreateDrawingOpen, setIsCreateDrawingOpen] = useState(false);
    const [createDrawingOpenSource, setCreateDrawingOpenSource] = useState<
        "editor" | "dashboard"
    >("editor");

    const persistToStorageTimerRef = useRef<number | null>(null);
    const persistRightStepTimerRef = useRef<number | null>(null);
    const isRestoringDrawingRef = useRef(false);
    const isRestoringRightStepMenuRef = useRef(false);

    const activeDrawing = useMemo(
        () => editorDrawings.find((d) => d.id === activeDrawingId) ?? null,
        [editorDrawings, activeDrawingId]
    );

    // setRightPanelMode also persists to localStorage so it survives browser restarts
    const setRightPanelMode = useCallback(
        (mode: EditorRightPanelMode) => {
            setRightPanelModeState(mode);
            writePanelModeForDrawing(activeDrawingId, mode);
        },
        [activeDrawingId]
    );

    // Restore rightPanelMode from localStorage when the active drawing changes
    useEffect(() => {
        if (!activeDrawingId) {
            setRightPanelModeState("steps");
            return;
        }
        setRightPanelModeState(readPanelModeForDrawing(activeDrawingId));
    }, [activeDrawingId]);

    // --- Internal helpers: load store state from a persisted snapshot ---

    const loadSnapshotIntoStore = useCallback(
        (snapshot: PersistedDrawingSnapshot | null | undefined) => {
            const safe = snapshot ? cloneDrawingSnapshot(snapshot) : createEmptyDrawingSnapshot();
            const nextObjects = safe.objects.map(clonePolyObject);
            const nextLinks = sanitizePlantbedLinksForObjects(
                clonePlantbedLinks(safe.plantbedLinks),
                nextObjects
            );
            const nextCounts = buildPlantbedLinkedCountFromLinks(nextLinks);

            useProjectStore.setState({
                objects: nextObjects,
                plantbedLinks: nextLinks,
                plantbedLinkedCount: nextCounts,
                distributionOverrides: safe.distributionOverrides ?? {},
                nextPlantbedNo: safe.nextPlantbedNo ?? 1,
                viewVisibility: {
                    ...DEFAULT_DRAWING_VIEW_VISIBILITY,
                    showTrafficUse: true,
                    ...safe.viewVisibility,
                },
                selectedObjectId: null,
                selectedObjectIds: [],
                undoStack: [],
                redoStack: [],
                confirmModal: null,
                compassDirection: safe.compassDirection ?? "noord",
            });
        },
        []
    );

    const loadRightStepMenuSnapshotIntoStore = useCallback(
        (snapshot: PersistedRightStepMenuSnapshot | null | undefined) => {
            const safe = snapshot
                ? sanitizeRightStepMenuSnapshot(snapshot)
                : createEmptyRightStepMenuSnapshot();

            useRightStepMenuStore.setState({
                activeStep: safe.activeStep,
                step1: {
                    locationType: safe.step1.locationType,
                    gardenZones: [...safe.step1.gardenZones],
                },
                step2: {
                    standplaatsen: [...safe.step2.standplaatsen],
                    groundTypes: [...safe.step2.groundTypes],
                    maintenanceLevel: safe.step2.maintenanceLevel,
                    certificationPreference: safe.step2.certificationPreference,
                },
                step3: {
                    structureStyle: safe.step3.structureStyle,
                    customPercentages: {
                        bodembedekkers: safe.step3.customPercentages.bodembedekkers,
                        vastePlanten: safe.step3.customPercentages.vastePlanten,
                        heestersEnStruiken: safe.step3.customPercentages.heestersEnStruiken,
                        bomen: safe.step3.customPercentages.bomen,
                    },
                },
                step4: {
                    seasonExperience: safe.step4.seasonExperience,
                    heightStyle: safe.step4.heightStyle,
                },
            });
        },
        []
    );

    // --- Hydration effect: runs once on mount ---
    useEffect(() => {
        if (typeof window === "undefined") return;

        // Flag set by in-app navigation (goBackToEditor, goToPlantLinkingEditor,
        // goToWorkflowStepFromPlantSelection). Absent on a fresh page load / browser restart.
        const isReturningToEditor =
            window.sessionStorage.getItem("hello-editor:return-to-editor") === "1";
        window.sessionStorage.removeItem("hello-editor:return-to-editor");

        const resetToEmptyAndShowDashboard = () => {
            isRestoringDrawingRef.current = true;
            isRestoringRightStepMenuRef.current = true;
            loadSnapshotIntoStore(null);
            loadRightStepMenuSnapshotIntoStore(null);
            usePlantSelectionStore.getState().resetForNewDrawing();
            setEditorDrawings([]);
            setRightStepSnapshotsByDrawingId({});
            setPlantSelectionSnapshotsByDrawingId({});
            setActiveDrawingId(null);
            setSaveState("saved");
            setIsDrawingsDashboardOpen(true);
            setIsDrawingsHydrated(true);
        };

        try {
            const { drawings: nextDrawings, activeDrawingId: restoredActiveDrawingId } =
                readDrawingsFromStorage();

            const nextRightStepSnapshotsByDrawingId =
                readRightStepSnapshotsByDrawingIdFromStorage();
            const nextPlantSelectionSnapshotsByDrawingId =
                readPlantSelectionSnapshotsByDrawingIdFromStorage();

            if (nextDrawings.length === 0 || !restoredActiveDrawingId) {
                resetToEmptyAndShowDashboard();
                return;
            }

            setEditorDrawings(nextDrawings);
            setRightStepSnapshotsByDrawingId(nextRightStepSnapshotsByDrawingId);
            setPlantSelectionSnapshotsByDrawingId(nextPlantSelectionSnapshotsByDrawingId);

            if (!isReturningToEditor) {
                // Only show dashboard on the very first visit ever.
                // On subsequent refreshes, go straight to the last active drawing.
                const HAS_VISITED_KEY = "hello-editor:has-visited";
                const hasVisited = window.localStorage.getItem(HAS_VISITED_KEY) === "1";
                window.localStorage.setItem(HAS_VISITED_KEY, "1");

                if (!hasVisited) {
                    isRestoringDrawingRef.current = true;
                    isRestoringRightStepMenuRef.current = true;
                    loadSnapshotIntoStore(null);
                    loadRightStepMenuSnapshotIntoStore(null);
                    usePlantSelectionStore.getState().resetForNewDrawing();
                    setActiveDrawingId(null);
                    setSaveState("saved");
                    setIsDrawingsDashboardOpen(true);
                    setIsDrawingsHydrated(true);
                    return;
                }
            }

            const restoredDrawing =
                nextDrawings.find((d) => d.id === restoredActiveDrawingId) ?? nextDrawings[0];

            setActiveDrawingId(restoredDrawing.id);
            isRestoringDrawingRef.current = true;
            isRestoringRightStepMenuRef.current = true;

            loadSnapshotIntoStore(restoredDrawing.snapshot);
            loadRightStepMenuSnapshotIntoStore(
                nextRightStepSnapshotsByDrawingId[restoredDrawing.id] ?? null
            );
            usePlantSelectionStore.getState().loadSnapshot(
                getPlantSelectionSnapshotForDrawing(
                    restoredDrawing.id,
                    nextPlantSelectionSnapshotsByDrawingId
                )
            );

            writeActiveDrawingIdToStorage(restoredDrawing.id);
            setSaveState("saved");
            setIsDrawingsDashboardOpen(false);
            setIsDrawingsHydrated(true);
        } catch {
            resetToEmptyAndShowDashboard();
        }
    }, [loadSnapshotIntoStore, loadRightStepMenuSnapshotIntoStore]);

    // --- Persistence effect: drawings list + activeDrawingId ---
    useEffect(() => {
        if (!isDrawingsHydrated || typeof window === "undefined") return;

        if (persistToStorageTimerRef.current !== null) {
            window.clearTimeout(persistToStorageTimerRef.current);
        }

        persistToStorageTimerRef.current = window.setTimeout(() => {
            writeDrawingsToStorage(editorDrawings, activeDrawingId);
            writeActiveDrawingIdToStorage(activeDrawingId);
            persistToStorageTimerRef.current = null;
        }, 400);

        return () => {
            if (persistToStorageTimerRef.current !== null) {
                window.clearTimeout(persistToStorageTimerRef.current);
                persistToStorageTimerRef.current = null;
            }
        };
    }, [activeDrawingId, editorDrawings, isDrawingsHydrated]);

    // --- Persistence effect: wizard snapshots + plant selection snapshots ---
    useEffect(() => {
        if (!isDrawingsHydrated || typeof window === "undefined") return;

        if (persistRightStepTimerRef.current !== null) {
            window.clearTimeout(persistRightStepTimerRef.current);
        }

        persistRightStepTimerRef.current = window.setTimeout(() => {
            writeRightStepSnapshotsByDrawingIdToStorage(rightStepSnapshotsByDrawingId);
            writePlantSelectionSnapshotsByDrawingIdToStorage(
                plantSelectionSnapshotsByDrawingId
            );
            persistRightStepTimerRef.current = null;
        }, 400);

        return () => {
            if (persistRightStepTimerRef.current !== null) {
                window.clearTimeout(persistRightStepTimerRef.current);
                persistRightStepTimerRef.current = null;
            }
        };
    }, [isDrawingsHydrated, rightStepSnapshotsByDrawingId, plantSelectionSnapshotsByDrawingId]);

    // --- Handlers ---

    const handleOpenDrawingsDashboard = useCallback(() => {
        setIsDrawingsDashboardOpen(true);
        setIsCreateDrawingOpen(false);
    }, []);

    const handleCloseDrawingsDashboard = useCallback(() => {
        setIsDrawingsDashboardOpen(false);
    }, []);

    const handleOpenCreateDrawingModal = useCallback(
        (source: "editor" | "dashboard") => {
            setCreateDrawingOpenSource(source);
            setIsDrawingsDashboardOpen(false);
            setIsCreateDrawingOpen(true);
        },
        []
    );

    const handleCloseCreateDrawingModal = useCallback(() => {
        setIsCreateDrawingOpen(false);
    }, []);

    const handleOpenDrawingFromDashboard = useCallback(
        (drawingId: string) => {
            const drawing = editorDrawings.find((d) => d.id === drawingId);
            if (!drawing) return;

            isRestoringDrawingRef.current = true;
            isRestoringRightStepMenuRef.current = true;

            loadSnapshotIntoStore(drawing.snapshot);
            loadRightStepMenuSnapshotIntoStore(
                rightStepSnapshotsByDrawingId[drawingId] ?? null
            );
            usePlantSelectionStore.getState().loadSnapshot(
                getPlantSelectionSnapshotForDrawing(drawingId, plantSelectionSnapshotsByDrawingId)
            );

            setActiveDrawingId(drawingId);
            writeActiveDrawingIdToStorage(drawingId);
            setSaveState("saved");
            setIsCreateDrawingOpen(false);
            setIsDrawingsDashboardOpen(false);
        },
        [
            editorDrawings,
            loadSnapshotIntoStore,
            loadRightStepMenuSnapshotIntoStore,
            rightStepSnapshotsByDrawingId,
            plantSelectionSnapshotsByDrawingId,
        ]
    );

    const handleCreateDrawingFromDashboard = useCallback(
        (name: string) => {
            const trimmed = name.trim();
            if (!trimmed) return;

            const nextDrawing = createDrawingDocument(trimmed);
            const emptyWizardSnapshot = createEmptyRightStepMenuSnapshot();

            setEditorDrawings((prev) => [...prev, nextDrawing]);
            setRightStepSnapshotsByDrawingId((prev) => ({
                ...prev,
                [nextDrawing.id]: emptyWizardSnapshot,
            }));
            setPlantSelectionSnapshotsByDrawingId((prev) => ({
                ...prev,
                [nextDrawing.id]: createEmptyPlantSelectionSnapshot(),
            }));

            isRestoringDrawingRef.current = true;
            isRestoringRightStepMenuRef.current = true;

            loadSnapshotIntoStore(nextDrawing.snapshot);
            loadRightStepMenuSnapshotIntoStore(emptyWizardSnapshot);
            usePlantSelectionStore.getState().resetForNewDrawing();

            // New drawings always start in wizard mode (steps 1-4)
            writePanelModeForDrawing(nextDrawing.id, "steps");

            setActiveDrawingId(nextDrawing.id);
            writeActiveDrawingIdToStorage(nextDrawing.id);
            setSaveState("saved");
            setIsCreateDrawingOpen(false);
            setIsDrawingsDashboardOpen(false);
        },
        [loadSnapshotIntoStore, loadRightStepMenuSnapshotIntoStore]
    );

    const handleDuplicateDrawingFromDashboard = useCallback(
        (drawingId: string) => {
            const sourceWizardSnapshot =
                rightStepSnapshotsByDrawingId[drawingId] ?? createEmptyRightStepMenuSnapshot();
            const sourcePlantSelectionSnapshot =
                plantSelectionSnapshotsByDrawingId[drawingId] ?? createEmptyPlantSelectionSnapshot();

            setEditorDrawings((prev) => {
                const source = prev.find((d) => d.id === drawingId);
                if (!source) return prev;

                const baseName = source.name.replace(/ kopie(?: (\d+))?$/, "");

                const usedNumbers = prev
                    .filter(
                        (d) =>
                            d.name === `${baseName} kopie` ||
                            d.name.startsWith(`${baseName} kopie `)
                    )
                    .map((d) => {
                        const match = d.name.match(/ kopie(?: (\d+))?$/);
                        if (!match) return null;
                        return match[1] ? Number(match[1]) : 1;
                    })
                    .filter((v): v is number => v !== null);

                const nextCopyNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
                const duplicateName =
                    nextCopyNumber === 1
                        ? `${baseName} kopie`
                        : `${baseName} kopie ${nextCopyNumber}`;

                const duplicatedDrawingId = `drawing-${Date.now()}`;

                const duplicatedDrawing: PersistedDrawingDocument = {
                    ...source,
                    id: duplicatedDrawingId,
                    name: duplicateName,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    snapshot: cloneDrawingSnapshot(source.snapshot),
                };

                setRightStepSnapshotsByDrawingId((prevSnapshots) => ({
                    ...prevSnapshots,
                    [duplicatedDrawingId]: sanitizeRightStepMenuSnapshot(sourceWizardSnapshot),
                }));

                setPlantSelectionSnapshotsByDrawingId((prevSnapshots) => ({
                    ...prevSnapshots,
                    [duplicatedDrawing.id]: {
                        selectedGroup: sourcePlantSelectionSnapshot.selectedGroup,
                        viewMode: sourcePlantSelectionSnapshot.viewMode,
                        sortValue: sourcePlantSelectionSnapshot.sortValue,
                        filters: { ...sourcePlantSelectionSnapshot.filters },
                        plantListItems: sourcePlantSelectionSnapshot.plantListItems.map((item) => ({
                            ...item,
                            plant: { ...item.plant },
                        })),
                    },
                }));

                return [...prev, duplicatedDrawing];
            });
        },
        [rightStepSnapshotsByDrawingId, plantSelectionSnapshotsByDrawingId]
    );

    const handleDeleteDrawingFromDashboard = useCallback(
        (drawingId: string) => {
            const nextDrawings = editorDrawings.filter((d) => d.id !== drawingId);

            setEditorDrawings(nextDrawings);
            setRightStepSnapshotsByDrawingId((prev) => {
                const next = { ...prev };
                delete next[drawingId];
                return next;
            });
            setPlantSelectionSnapshotsByDrawingId((prev) => {
                const next = { ...prev };
                delete next[drawingId];
                return next;
            });

            if (nextDrawings.length === 0) {
                isRestoringDrawingRef.current = true;
                isRestoringRightStepMenuRef.current = true;
                loadSnapshotIntoStore(null);
                loadRightStepMenuSnapshotIntoStore(null);
                setActiveDrawingId(null);
                setSaveState("saved");
                setIsDrawingsDashboardOpen(true);
                return;
            }

            if (drawingId === activeDrawingId) {
                const fallbackDrawing = nextDrawings[0];
                isRestoringDrawingRef.current = true;
                isRestoringRightStepMenuRef.current = true;
                loadSnapshotIntoStore(fallbackDrawing.snapshot);
                loadRightStepMenuSnapshotIntoStore(
                    rightStepSnapshotsByDrawingId[fallbackDrawing.id] ?? null
                );
                setActiveDrawingId(fallbackDrawing.id);
                setSaveState("saved");
            }
        },
        [
            activeDrawingId,
            editorDrawings,
            loadSnapshotIntoStore,
            loadRightStepMenuSnapshotIntoStore,
            rightStepSnapshotsByDrawingId,
        ]
    );

    const handleRenameDrawingFromDashboard = useCallback(
        (drawingId: string, nextName: string) => {
            const nowIso = new Date().toISOString();
            setEditorDrawings((prev) =>
                prev.map((d) =>
                    d.id === drawingId ? { ...d, name: nextName, updatedAt: nowIso } : d
                )
            );
        },
        []
    );

    // Called by HelloEditor's autosave effect and manual save handler
    const saveDrawingSnapshot = useCallback(
        (snapshot: PersistedDrawingSnapshot, nowIso: string) => {
            setEditorDrawings((prev) =>
                prev.map((d) =>
                    d.id === activeDrawingId ? { ...d, updatedAt: nowIso, snapshot } : d
                )
            );
        },
        [activeDrawingId]
    );

    // Called by HelloEditor's wizard sync effect
    const setRightStepSnapshot = useCallback(
        (drawingId: string, snapshot: PersistedRightStepMenuSnapshot) => {
            setRightStepSnapshotsByDrawingId((prev) => ({ ...prev, [drawingId]: snapshot }));
        },
        []
    );

    // Called by HelloEditor's plant selection sync effect
    const setPlantSelectionSnapshot = useCallback(
        (drawingId: string, snapshot: PersistedPlantSelectionSnapshot) => {
            setPlantSelectionSnapshotsByDrawingId((prev) => ({ ...prev, [drawingId]: snapshot }));
        },
        []
    );

    return {
        editorDrawings,
        activeDrawingId,
        activeDrawing,
        isDrawingsHydrated,
        saveState,
        setSaveState,
        rightPanelMode: rightPanelModeState,
        setRightPanelMode,
        rightStepSnapshotsByDrawingId,
        plantSelectionSnapshotsByDrawingId,
        isDrawingsDashboardOpen,
        isCreateDrawingOpen,
        createDrawingOpenSource,
        handleOpenDrawingsDashboard,
        handleCloseDrawingsDashboard,
        handleOpenCreateDrawingModal,
        handleCloseCreateDrawingModal,
        handleOpenDrawingFromDashboard,
        handleCreateDrawingFromDashboard,
        handleDuplicateDrawingFromDashboard,
        handleDeleteDrawingFromDashboard,
        handleRenameDrawingFromDashboard,
        saveDrawingSnapshot,
        setRightStepSnapshot,
        setPlantSelectionSnapshot,
        isRestoringDrawingRef,
        isRestoringRightStepMenuRef,
    };
}
