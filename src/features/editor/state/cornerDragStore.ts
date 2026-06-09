import { create } from "zustand";

/**
 * Live corner-drag UI state — updated every RAF frame during drag.
 * Only CornerDragSection subscribes, so only that small component re-renders.
 */
interface CornerDragLiveState {
    isActive: boolean;
    /** Screen-pixel position of the active corner handle (apex) */
    screenX: number;
    screenY: number;
    workingRadius: number;
    snapName: string | null;
    stageScale: number;
}

export const useCornerDragStore = create<CornerDragLiveState>(() => ({
    isActive: false,
    screenX: 0, screenY: 0,
    workingRadius: 0, snapName: null,
    stageScale: 1,
}));

export function setCornerDragLive(state: Omit<CornerDragLiveState, 'isActive'>) {
    useCornerDragStore.setState({ ...state, isActive: true });
}

export function clearCornerDrag() {
    const s = useCornerDragStore.getState();
    if (!s.isActive) return;
    useCornerDragStore.setState({ isActive: false });
}
