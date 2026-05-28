import { create } from "zustand";
import type { AlignmentGuide } from "@/features/editor/lib/alignmentGuides";

interface SelectionDragState {
    alignmentGuides: AlignmentGuide[];
}

export const useSelectionDragStore = create<SelectionDragState>(() => ({
    alignmentGuides: [],
}));

// Stable empty array to avoid creating a new reference every time guides are cleared.
const EMPTY_GUIDES: AlignmentGuide[] = [];

export function setSelectionDragAlignmentGuides(guides: AlignmentGuide[]) {
    const current = useSelectionDragStore.getState().alignmentGuides;
    // Skip if both are empty — most common case at drag end and during non-drag periods.
    if (guides.length === 0 && current.length === 0) return;
    useSelectionDragStore.setState({
        alignmentGuides: guides.length === 0 ? EMPTY_GUIDES : guides,
    });
}
