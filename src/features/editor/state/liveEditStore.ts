import { create } from "zustand";

/**
 * Stores the live measurement data that changes every RAF frame during vertex drag,
 * edge resize, and treebed resize/rotate interactions.
 *
 * By writing here instead of calling setVertexDragTick/setEdgeResizeTick, we avoid
 * triggering a full HelloEditor re-render + EditorTopLayer re-render on every frame.
 * Only the isolated LiveMeasurementSection (subscriber) re-renders.
 */
interface LiveEditState {
    /** Live object with working points applied — null when not interacting */
    livePrimary: any; // PolyObject | null
    /** plantbedNumberLayouts with the live object's layout applied */
    liveLayouts: Map<string, any> | null;
}

export const useLiveEditStore = create<LiveEditState>(() => ({
    livePrimary: null,
    liveLayouts: null,
}));

export function setLiveEditMeasurement(
    livePrimary: any,
    liveLayouts: Map<string, any>
) {
    useLiveEditStore.setState({ livePrimary, liveLayouts });
}

export function clearLiveEditMeasurement() {
    const s = useLiveEditStore.getState();
    if (s.livePrimary === null && s.liveLayouts === null) return;
    useLiveEditStore.setState({ livePrimary: null, liveLayouts: null });
}
