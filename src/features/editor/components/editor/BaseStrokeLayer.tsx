import React from "react";
import { Layer, Line } from "react-konva";
import { PolyObject, OBJECT_STYLES, ObjectType } from "@/state/projectStore";
import { isUnifiedBoundaryType, getBoundaryBandShapeForObject } from "@/features/editor/lib/boundarySystem";
import {
    PolygonWithHoles,
} from "@/features/editor/lib/editorCanvasPrimitives";
import { DynamicStrokeShape } from "@/features/editor/lib/treebedGeometry";

type BaseStrokeLayerProps = {
    unselectedNonPlantbeds: PolyObject[];
    unselectedPlantbeds: PolyObject[];
    objects: PolyObject[];
    dragOverPlantbedId: string | null;
    getOneSidedPolylineRenderPoints: (
        points: number[],
        strokeWidth: number,
        side?: 1 | -1
    ) => number[];
    inferPolylineRenderSide: (
        points: number[],
        type: ObjectType,
        objects: PolyObject[],
        fallback?: 1 | -1
    ) => 1 | -1;
    getPlantbedOutlineSegments: (plantbeds: PolyObject[]) => Array<[number, number, number, number]>;
};

function getObjectRenderStyle(object: PolyObject) {
    return {
        ...OBJECT_STYLES[object.type],
        ...(object.customStyle ?? {}),
    };
}

// React.memo: only re-renders when objects actually change (not during pan/drag).
export default React.memo(function BaseStrokeLayer({
    unselectedNonPlantbeds,
    unselectedPlantbeds,
    objects,
    dragOverPlantbedId,
    getOneSidedPolylineRenderPoints,
    inferPolylineRenderSide,
    getPlantbedOutlineSegments,
}: BaseStrokeLayerProps) {
    return (
        <Layer>
            {/* Strokes voor unselected non-plantbeds */}
            {unselectedNonPlantbeds.map((obj) => {
                const hasHoles = (obj.holes?.length ?? 0) > 0;
                const isUnifiedBoundary = isUnifiedBoundaryType(obj.type);
                const boundaryBandShape = isUnifiedBoundary
                    ? getBoundaryBandShapeForObject(obj)
                    : null;

                if (obj.type === "hedge") {
                    return (
                        <React.Fragment key={`stroke-${obj.id}`}>
                            <DynamicStrokeShape
                                points={obj.points}
                                stroke={getObjectRenderStyle(obj).stroke}
                                strokeWidth={2}
                                seedKey={`hedge-stroke:${obj.id}:base:outer`}
                            />
                            {(obj.holes ?? []).map((hole, holeIndex) => (
                                <DynamicStrokeShape
                                    key={`stroke-${obj.id}-hole-${holeIndex}`}
                                    points={hole}
                                    stroke={getObjectRenderStyle(obj).stroke}
                                    strokeWidth={2}
                                    seedKey={`hedge-stroke:${obj.id}:base:hole:${holeIndex}`}
                                />
                            ))}
                        </React.Fragment>
                    );
                }

                if (hasHoles) {
                    return (
                        <PolygonWithHoles
                            key={`stroke-${obj.id}`}
                            points={obj.points}
                            holes={obj.holes}
                            fill={undefined}
                            stroke={getObjectRenderStyle(obj).stroke}
                            strokeWidth={2}
                            opacity={1}
                            listening={false}
                            perfectDrawEnabled={false}
                        />
                    );
                }

                if (isUnifiedBoundary && boundaryBandShape && boundaryBandShape.outer.length >= 6) {
                    return (
                        <PolygonWithHoles
                            key={`stroke-${obj.id}`}
                            points={boundaryBandShape.outer}
                            holes={boundaryBandShape.holes}
                            fill={undefined}
                            stroke={getObjectRenderStyle(obj).stroke}
                            strokeWidth={2}
                            opacity={1}
                            listening={false}
                            perfectDrawEnabled={false}
                        />
                    );
                }

                if (obj.type === "treebed") {
                    return null;
                }

                return (
                    <Line
                        key={`stroke-${obj.id}`}
                        points={obj.points}
                        closed
                        fillEnabled={false}
                        stroke={OBJECT_STYLES[obj.type].stroke}
                        strokeWidth={2}
                        lineCap="butt"
                        lineJoin="miter"
                        listening={false}
                        perfectDrawEnabled={false}
                        opacity={1}
                    />
                );
            })}

            {/* Erase PASS: snij alleen strokes weg bij plantbed-rand (fills zitten in andere layer => geen gap) */}
            {unselectedPlantbeds.map((pb) => (
                <Line
                    key={`pb-erase-${pb.id}`}
                    points={pb.points}
                    closed
                    fillEnabled={false}
                    stroke="black"
                    strokeWidth={3}
                    lineCap="butt"
                    lineJoin="miter"
                    listening={false}
                    perfectDrawEnabled={false}
                    globalCompositeOperation="destination-out"
                    opacity={1}
                />
            ))}

            {/* Plantbed dashed outline bovenop */}
            {unselectedPlantbeds
                .filter((pb) => dragOverPlantbedId !== pb.id)
                .flatMap((pb) =>
                    getPlantbedOutlineSegments([pb]).map((seg, index) => (
                        <Line
                            key={`pb-dash-seg-${pb.id}-${index}`}
                            points={seg}
                            closed={false}
                            fillEnabled={false}
                            stroke={getObjectRenderStyle(pb).stroke}
                            strokeWidth={2}
                            dash={[6, 4]}
                            dashEnabled
                            lineCap="butt"
                            lineJoin="miter"
                            listening={false}
                            perfectDrawEnabled={false}
                            opacity={1}
                        />
                    ))
                )}

            {null}
        </Layer>
    );
});
