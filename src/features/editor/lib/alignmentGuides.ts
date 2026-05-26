import { PolyObject } from "@/state/projectStore";
import { bboxFromPoints } from "@/features/editor/lib/editorCanvasMath";

export type AlignmentGuide = {
    id: string;
    orientation: "vertical" | "horizontal";
    points: number[];
};

type AlignmentBox = {
    x: number;
    y: number;
    w: number;
    h: number;
};

type AlignmentCandidate = {
    sourceKind: string;
    delta: number;
    distance: number;
    crossAxisGap: number;
    score: number;
    guide: AlignmentGuide;
};

function getAlignmentBoxForObject(object: PolyObject) {
    const boundarySegmentPoints =
        object.boundarySegments?.flatMap((segment) => segment) ?? [];

    const holePoints =
        object.holes?.flatMap((hole) => hole) ?? [];

    const allPoints = [
        ...object.points,
        ...boundarySegmentPoints,
        ...holePoints,
    ];

    return bboxFromPoints(allPoints.length >= 4 ? allPoints : object.points);
}

function getRangeGap(
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number
) {
    const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);

    if (overlap >= 0) {
        return 0;
    }

    return Math.max(aStart, bStart) - Math.min(aEnd, bEnd);
}

function getSelectionAlignmentCandidateScore(
    snapDistance: number,
    crossAxisGap: number
) {
    return snapDistance * 1000 + crossAxisGap;
}

function getResizeAlignmentCandidateScore(
    snapDistance: number,
    crossAxisGap: number
) {
    return crossAxisGap * 1000 + snapDistance;
}

function isVerticalGuideBlocked(
    guideX: number,
    source: AlignmentBox,
    target: AlignmentBox,
    targetObjectId: string,
    targetObjects: PolyObject[],
    boxCache?: Map<string, AlignmentBox>
) {
    const sourceBottom = source.y + source.h;
    const targetBottom = target.y + target.h;

    const gapTop = Math.min(sourceBottom, targetBottom);
    const gapBottom = Math.max(source.y, target.y);

    if (gapBottom <= gapTop) return false;

    return targetObjects.some((object) => {
        if (object.id === targetObjectId) return false;

        const box = boxCache?.get(object.id) ?? getAlignmentBoxForObject(object);
        const boxBottom = box.y + box.h;

        const crossesGuideX =
            box.x <= guideX &&
            box.x + box.w >= guideX;

        const intersectsGapY =
            box.y < gapBottom &&
            boxBottom > gapTop;

        return crossesGuideX && intersectsGapY;
    });
}

function isHorizontalGuideBlocked(
    guideY: number,
    source: AlignmentBox,
    target: AlignmentBox,
    targetObjectId: string,
    targetObjects: PolyObject[],
    boxCache?: Map<string, AlignmentBox>
) {
    const sourceRight = source.x + source.w;
    const targetRight = target.x + target.w;

    const gapLeft = Math.min(sourceRight, targetRight);
    const gapRight = Math.max(source.x, target.x);

    if (gapRight <= gapLeft) return false;

    return targetObjects.some((object) => {
        if (object.id === targetObjectId) return false;

        const box = boxCache?.get(object.id) ?? getAlignmentBoxForObject(object);
        const boxRight = box.x + box.w;

        const crossesGuideY =
            box.y <= guideY &&
            box.y + box.h >= guideY;

        const intersectsGapX =
            box.x < gapRight &&
            boxRight > gapLeft;

        return crossesGuideY && intersectsGapX;
    });
}

function pickClosestGuidePerSourceKind(
    candidates: AlignmentCandidate[],
    targetDelta: number
) {
    const sameDeltaEpsilon = 1e-6;
    const bySourceKind = new Map<string, AlignmentCandidate>();

    candidates
        .filter((candidate) =>
            Math.abs(candidate.delta - targetDelta) <= sameDeltaEpsilon
        )
        .forEach((candidate) => {
            const existing = bySourceKind.get(candidate.sourceKind);

            if (!existing || candidate.score < existing.score) {
                bySourceKind.set(candidate.sourceKind, candidate);
            }
        });

    return Array.from(bySourceKind.values())
        .sort((a, b) => a.score - b.score)
        .map((candidate) => candidate.guide);
}

export function calculateAlignmentSnapForSelection(args: {
    selectedObjects: PolyObject[];
    objects: PolyObject[];
    dx: number;
    dy: number;
    stageScale: number;
}) {
    const { selectedObjects, objects, dx, dy, stageScale } = args;

    if (selectedObjects.length === 0) {
        return { dx, dy, guides: [] as AlignmentGuide[] };
    }

    const selectedIds = new Set(selectedObjects.map((object) => object.id));

    const targetObjects = objects.filter(
        (object) =>
            object.type !== "treebed" &&
            !selectedIds.has(object.id) &&
            Array.isArray(object.points) &&
            object.points.length >= 4
    );

    if (targetObjects.length === 0) {
        return { dx, dy, guides: [] as AlignmentGuide[] };
    }

    const selectedPoints = selectedObjects.flatMap((object) => {
        const boundarySegmentPoints =
            object.boundarySegments?.flatMap((segment) => segment) ?? [];

        const holePoints =
            object.holes?.flatMap((hole) => hole) ?? [];

        return [
            ...object.points,
            ...boundarySegmentPoints,
            ...holePoints,
        ];
    });

    if (selectedPoints.length < 4) {
        return { dx, dy, guides: [] as AlignmentGuide[] };
    }

    const sourceBox = bboxFromPoints(
        selectedPoints.map((value, index) =>
            index % 2 === 0 ? value + dx : value + dy
        )
    );

    const sourceAnchorsX = [
        { kind: "left", value: sourceBox.x },
        { kind: "right", value: sourceBox.x + sourceBox.w },
    ];

    const sourceAnchorsY = [
        { kind: "top", value: sourceBox.y },
        { kind: "bottom", value: sourceBox.y + sourceBox.h },
    ];

    const snapThreshold = Math.max(4, 10 / Math.max(stageScale, 0.1));

    // Precompute bounding boxes for all target objects ONCE.
    // Previously getAlignmentBoxForObject() was called inside the forEach loop AND inside
    // isVerticalGuideBlocked/isHorizontalGuideBlocked — meaning O(N²) box calculations.
    // Now it's O(N) total.
    const targetBoxCache = new Map<string, AlignmentBox>();
    for (const obj of targetObjects) {
        targetBoxCache.set(obj.id, getAlignmentBoxForObject(obj));
    }

    const bestXRef: {
        current: {
            delta: number;
            distance: number;
            crossAxisGap: number;
            score: number;
            guide: AlignmentGuide;
        } | null;
    } = { current: null };

    const bestYRef: {
        current: {
            delta: number;
            distance: number;
            crossAxisGap: number;
            score: number;
            guide: AlignmentGuide;
        } | null;
    } = { current: null };

    const verticalGuideCandidates: AlignmentCandidate[] = [];
    const horizontalGuideCandidates: AlignmentCandidate[] = [];

    targetObjects.forEach((targetObject) => {
        const targetBox = targetBoxCache.get(targetObject.id)!;

        const crossAxisGapY = getRangeGap(
            sourceBox.y,
            sourceBox.y + sourceBox.h,
            targetBox.y,
            targetBox.y + targetBox.h
        );

        const crossAxisGapX = getRangeGap(
            sourceBox.x,
            sourceBox.x + sourceBox.w,
            targetBox.x,
            targetBox.x + targetBox.w
        );

        const targetAnchorsX = [
            targetBox.x,
            targetBox.x + targetBox.w,
        ];

        const targetAnchorsY = [
            targetBox.y,
            targetBox.y + targetBox.h,
        ];

        sourceAnchorsX.forEach((sourceAnchor) => {
            targetAnchorsX.forEach((targetX) => {
                const delta = targetX - sourceAnchor.value;
                const distance = Math.abs(delta);

                if (distance > snapThreshold) return;
                if (isVerticalGuideBlocked(targetX, sourceBox, targetBox, targetObject.id, targetObjects, targetBoxCache)) return;

                const score = getSelectionAlignmentCandidateScore(distance, crossAxisGapY);
                const minY = Math.min(sourceBox.y, targetBox.y);
                const maxY = Math.max(sourceBox.y + sourceBox.h, targetBox.y + targetBox.h);

                const candidate = {
                    sourceKind: sourceAnchor.kind,
                    delta,
                    distance,
                    crossAxisGap: crossAxisGapY,
                    score,
                    guide: {
                        id: `vertical-${targetObject.id}-${sourceAnchor.kind}-${targetX}`,
                        orientation: "vertical" as const,
                        points: [targetX, minY, targetX, maxY],
                    },
                };

                verticalGuideCandidates.push(candidate);

                if (!bestXRef.current || score < bestXRef.current.score) {
                    bestXRef.current = candidate;
                }
            });
        });

        sourceAnchorsY.forEach((sourceAnchor) => {
            targetAnchorsY.forEach((targetY) => {
                const delta = targetY - sourceAnchor.value;
                const distance = Math.abs(delta);

                if (distance > snapThreshold) return;
                if (isHorizontalGuideBlocked(targetY, sourceBox, targetBox, targetObject.id, targetObjects, targetBoxCache)) return;

                const score = getSelectionAlignmentCandidateScore(distance, crossAxisGapX);
                const minX = Math.min(sourceBox.x, targetBox.x);
                const maxX = Math.max(sourceBox.x + sourceBox.w, targetBox.x + targetBox.w);

                const candidate = {
                    sourceKind: sourceAnchor.kind,
                    delta,
                    distance,
                    crossAxisGap: crossAxisGapX,
                    score,
                    guide: {
                        id: `horizontal-${targetObject.id}-${sourceAnchor.kind}-${targetY}`,
                        orientation: "horizontal" as const,
                        points: [minX, targetY, maxX, targetY],
                    },
                };

                horizontalGuideCandidates.push(candidate);

                if (!bestYRef.current || score < bestYRef.current.score) {
                    bestYRef.current = candidate;
                }
            });
        });
    });

    const bestX = bestXRef.current;
    const bestY = bestYRef.current;

    const verticalGuides = bestX
        ? pickClosestGuidePerSourceKind(verticalGuideCandidates, bestX.delta)
        : [];

    const horizontalGuides = bestY
        ? pickClosestGuidePerSourceKind(horizontalGuideCandidates, bestY.delta)
        : [];

    const guidesById = new Map<string, AlignmentGuide>();

    [...verticalGuides, ...horizontalGuides].forEach((guide) => {
        guidesById.set(guide.id, guide);
    });

    return {
        dx: dx + (bestX?.delta ?? 0),
        dy: dy + (bestY?.delta ?? 0),
        guides: Array.from(guidesById.values()),
    };
}

export function calculateAlignmentSnapForEdgeResize(args: {
    objectId: string;
    orientation: "vertical" | "horizontal";
    x: number;
    y: number;
    workingPoints: number[];
    objects: PolyObject[];
    stageScale: number;
}) {
    const {
        objectId,
        orientation,
        x,
        y,
        workingPoints,
        objects,
        stageScale,
    } = args;

    const targetObjects = objects.filter(
        (object) =>
            object.type !== "treebed" &&
            object.id !== objectId &&
            Array.isArray(object.points) &&
            object.points.length >= 4
    );

    if (targetObjects.length === 0 || workingPoints.length < 4) {
        return { x, y, guides: [] as AlignmentGuide[] };
    }

    const sourceBox = bboxFromPoints(workingPoints);
    const snapThreshold = Math.max(4, 10 / Math.max(stageScale, 0.1));

    const bestGuideRef: {
        current: {
            value: number;
            distance: number;
            crossAxisGap: number;
            score: number;
            guide: AlignmentGuide;
        } | null;
    } = { current: null };

    targetObjects.forEach((targetObject) => {
        const targetBox = getAlignmentBoxForObject(targetObject);

        const crossAxisGapY = getRangeGap(
            sourceBox.y,
            sourceBox.y + sourceBox.h,
            targetBox.y,
            targetBox.y + targetBox.h
        );

        const crossAxisGapX = getRangeGap(
            sourceBox.x,
            sourceBox.x + sourceBox.w,
            targetBox.x,
            targetBox.x + targetBox.w
        );

        if (orientation === "vertical") {
            const targetAnchorsX = [
                targetBox.x,
                targetBox.x + targetBox.w,
            ];

            targetAnchorsX.forEach((targetX) => {
                const distance = Math.abs(targetX - x);

                if (distance > snapThreshold) return;
                if (isVerticalGuideBlocked(targetX, sourceBox, targetBox, targetObject.id, targetObjects)) return;

                const score = getResizeAlignmentCandidateScore(distance, crossAxisGapY);

                if (bestGuideRef.current && score >= bestGuideRef.current.score) return;

                const minY = Math.min(sourceBox.y, targetBox.y);
                const maxY = Math.max(sourceBox.y + sourceBox.h, targetBox.y + targetBox.h);

                bestGuideRef.current = {
                    value: targetX,
                    distance,
                    crossAxisGap: crossAxisGapY,
                    score,
                    guide: {
                        id: `vertical-resize-${targetObject.id}-${targetX}`,
                        orientation: "vertical",
                        points: [targetX, minY, targetX, maxY],
                    },
                };
            });

            return;
        }

        const targetAnchorsY = [
            targetBox.y,
            targetBox.y + targetBox.h,
        ];

        targetAnchorsY.forEach((targetY) => {
            const distance = Math.abs(targetY - y);

            if (distance > snapThreshold) return;
            if (isHorizontalGuideBlocked(targetY, sourceBox, targetBox, targetObject.id, targetObjects)) return;

            const score = getResizeAlignmentCandidateScore(distance, crossAxisGapX);

            if (bestGuideRef.current && score >= bestGuideRef.current.score) return;

            const minX = Math.min(sourceBox.x, targetBox.x);
            const maxX = Math.max(sourceBox.x + sourceBox.w, targetBox.x + targetBox.w);

            bestGuideRef.current = {
                value: targetY,
                distance,
                crossAxisGap: crossAxisGapX,
                score,
                guide: {
                    id: `horizontal-resize-${targetObject.id}-${targetY}`,
                    orientation: "horizontal",
                    points: [minX, targetY, maxX, targetY],
                },
            };
        });
    });

    const bestGuide = bestGuideRef.current;

    if (!bestGuide) {
        return { x, y, guides: [] as AlignmentGuide[] };
    }

    return orientation === "vertical"
        ? { x: bestGuide.value, y, guides: [bestGuide.guide] }
        : { x, y: bestGuide.value, guides: [bestGuide.guide] };
}