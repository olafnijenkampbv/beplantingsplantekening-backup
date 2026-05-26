import { create } from "zustand";

interface DrawPreviewState {
    previewPoint: { x: number; y: number } | null;
    treebedPreviewPoint: { x: number; y: number } | null;
}

export const useDrawPreviewStore = create<DrawPreviewState>(() => ({
    previewPoint: null,
    treebedPreviewPoint: null,
}));

export function setDrawPreviewPoint(point: { x: number; y: number } | null) {
    const current = useDrawPreviewStore.getState().previewPoint;
    if (point === null && current === null) return;
    if (
        point !== null &&
        current !== null &&
        current.x === point.x &&
        current.y === point.y
    )
        return;
    useDrawPreviewStore.setState({ previewPoint: point });
}

export function setTreebedDrawPreviewPoint(point: { x: number; y: number } | null) {
    const current = useDrawPreviewStore.getState().treebedPreviewPoint;
    if (point === null && current === null) return;
    if (
        point !== null &&
        current !== null &&
        current.x === point.x &&
        current.y === point.y
    )
        return;
    useDrawPreviewStore.setState({ treebedPreviewPoint: point });
}
