import { create } from "zustand";

interface BoxSelectState {
    selectionBox: { x: number; y: number; w: number; h: number } | null;
}

export const useBoxSelectStore = create<BoxSelectState>(() => ({
    selectionBox: null,
}));

export function setBoxSelectSelectionBox(
    box: { x: number; y: number; w: number; h: number } | null
) {
    const current = useBoxSelectStore.getState().selectionBox;
    if (box === null && current === null) return;
    if (
        box !== null &&
        current !== null &&
        current.x === box.x &&
        current.y === box.y &&
        current.w === box.w &&
        current.h === box.h
    )
        return;
    useBoxSelectStore.setState({ selectionBox: box });
}
