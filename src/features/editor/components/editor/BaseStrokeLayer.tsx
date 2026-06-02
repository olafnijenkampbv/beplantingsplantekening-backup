import React from "react";
import { Layer, Line, Shape } from "react-konva";
import { PolyObject, OBJECT_STYLES, ObjectType } from "@/state/projectStore";
import { isUnifiedBoundaryType, getBoundaryBandShapeForObject } from "@/features/editor/lib/boundarySystem";
import {
    PolygonWithHoles,
} from "@/features/editor/lib/editorCanvasPrimitives";
import { DynamicStrokeShape } from "@/features/editor/lib/treebedGeometry";
import { traceBulgedPath, STRAIGHT_THRESHOLD, densifyBulgedRing } from "@/features/editor/lib/bulgeMath";

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
                    const hasBulges = obj.bulges?.some((b) => Math.abs(b) > STRAIGHT_THRESHOLD);
                    const outerStrokePoints =
                        hasBulges && obj.bulges
                            ? densifyBulgedRing(obj.points, obj.bulges, 40)
                            : obj.points;
                    return (
                        <React.Fragment key={`stroke-${obj.id}`}>
                            <DynamicStrokeShape
                                points={outerStrokePoints}
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
                            bulges={obj.bulges}
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

                // ✅ BOGEN — gebruik PolygonWithHoles als het object bogen heeft
                const hasBulges = obj.bulges?.some((b) => Math.abs(b) > 0.004);
                if (hasBulges) {
                    return (
                        <PolygonWithHoles
                            key={`stroke-${obj.id}`}
                            points={obj.points}
                            holes={[]}
                            bulges={obj.bulges}
                            fill={undefined}
                            stroke={getObjectRenderStyle(obj).stroke}
                            strokeWidth={2}
                            opacity={1}
                            listening={false}
                            perfectDrawEnabled={false}
                        />
                    );
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

            {/* Erase PASS: snij strokes weg bij plantbed-rand — arc-bewust */}
            {unselectedPlantbeds.map((pb) => {
                const hasBulges = pb.bulges?.some((b) => Math.abs(b) > STRAIGHT_THRESHOLD);
                if (hasBulges && pb.bulges) {
                    const capturePts = pb.points;
                    const captureBulges = pb.bulges;
                    return (
                        <Shape
                            key={`pb-erase-${pb.id}`}
                            listening={false}
                            perfectDrawEnabled={false}
                            opacity={1}
                            sceneFunc={(ctx) => {
                                if (!capturePts || capturePts.length < 6) return;
                                ctx.beginPath();
                                traceBulgedPath(ctx as any, capturePts, captureBulges, true);
                                ctx.closePath();
                                (ctx as any).globalCompositeOperation = "destination-out";
                                (ctx as any).strokeStyle = "black";
                                (ctx as any).lineWidth = 3;
                                (ctx as any).stroke();
                                (ctx as any).globalCompositeOperation = "source-over";
                            }}
                        />
                    );
                }
                return (
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
                        globalCompositeOperation={"destination-out" as any}
                        opacity={1}
                    />
                );
            })}

            {/* Plantbed dashed outline bovenop — arc-bewust */}
            {unselectedPlantbeds
                .filter((pb) => dragOverPlantbedId !== pb.id)
                .map((pb) => {
                    const hasBulges = pb.bulges?.some((b) => Math.abs(b) > STRAIGHT_THRESHOLD);
                    if (hasBulges && pb.bulges) {
                        const capturePts = pb.points;
                        const captureBulges = pb.bulges;
                        const strokeColor = getObjectRenderStyle(pb).stroke;
                        return (
                            <Shape
                                key={`pb-dash-${pb.id}`}
                                listening={false}
                                perfectDrawEnabled={false}
                                opacity={1}
                                sceneFunc={(ctx) => {
                                    if (!capturePts || capturePts.length < 6) return;
                                    ctx.beginPath();
                                    traceBulgedPath(ctx as any, capturePts, captureBulges, true);
                                    ctx.closePath();
                                    (ctx as any).strokeStyle = strokeColor;
                                    (ctx as any).lineWidth = 2;
                                    (ctx as any).setLineDash([6, 4]);
                                    (ctx as any).stroke();
                                    (ctx as any).setLineDash([]);
                                }}
                            />
                        );
                    }
                    return getPlantbedOutlineSegments([pb]).map((seg, index) => (
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
                    ));
                })}

            {null}
        </Layer>
    );
});
