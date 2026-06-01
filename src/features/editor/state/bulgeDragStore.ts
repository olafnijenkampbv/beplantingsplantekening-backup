import { create } from "zustand";

/**
 * Live bulge drag UI state — updated every RAF frame during drag.
 * Only BulgeDragSection subscribes, so only that small component re-renders.
 */
interface BulgeDragLiveState {
    isActive: boolean;
    /** Screen-pixel position of the active apex handle */
    screenX: number;
    screenY: number;
    workingBulge: number;
    snapName: string | null;
    /** World coords of the chord endpoints (for the Konva chord line) */
    chordX1: number; chordY1: number;
    chordX2: number; chordY2: number;
    stageScale: number;
}

export const useBulgeDragStore = create<BulgeDragLiveState>(() => ({
    isActive: false,
    screenX: 0, screenY: 0,
    workingBulge: 0, snapName: null,
    chordX1: 0, chordY1: 0, chordX2: 0, chordY2: 0,
    stageScale: 1,
}));

export function setBulgeDragLive(state: Omit<BulgeDragLiveState, 'isActive'>) {
    useBulgeDragStore.setState({ ...state, isActive: true });
}

export function clearBulgeDrag() {
    const s = useBulgeDragStore.getState();
    if (!s.isActive) return;
    useBulgeDragStore.setState({ isActive: false });
}
