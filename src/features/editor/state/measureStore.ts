import { create } from "zustand";

interface MeasureState {
    measurePreviewPoint: { x: number; y: number } | null;
}

export const useMeasureStore = create<MeasureState>(() => ({
    measurePreviewPoint: null,
}));

export function setMeasurePreviewPoint(point: { x: number; y: number } | null) {
    const current = useMeasureStore.getState().measurePreviewPoint;
    if (point === null && current === null) return;
    if (
        point !== null &&
        current !== null &&
        current.x === point.x &&
        current.y === point.y
    )
        return;
    useMeasureStore.setState({ measurePreviewPoint: point });
}
