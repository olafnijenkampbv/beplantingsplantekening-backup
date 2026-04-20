import React, { useMemo } from "react";
import { Shape } from "react-konva";
import {
    PolyObject,
    ObjectType,
    TreebedVariant,
    OBJECT_STYLES,
} from "@/state/projectStore";
import {
    OBJECT_LABELS,
    isBuildingObjectType,
    getObjectVisibilityGroup,
} from "@/features/editor/components/editor/objectMenuConfig";
import {
    isUnifiedBoundaryType,
    getBoundaryStrokeWidth,
} from "@/features/editor/lib/boundarySystem";
import { EDITOR_GRID_SIZE } from "@/features/editor/constants/editorGeometry";
import { bboxFromPoints, rectsOverlap } from "@/features/editor/lib/editorCanvasMath";

const COLORS = {
    orange: "#E94E1B",
    orangeLight: "#FFE5DD",
    green: "#58694C",
    greenLight: "#EEF0ED",
    border: "#E3E2E2",
    grid: "#d7dcd5",
};

const FENCE_GATE_STROKE_WIDTH = 14;
const GRID_SIZE = EDITOR_GRID_SIZE;

export function PolygonWithHoles(props: {
    points: number[];
    holes?: number[][];
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    listening?: boolean;
    perfectDrawEnabled?: boolean;
    dash?: number[];
    dashEnabled?: boolean;
    lineCap?: CanvasLineCap;
    lineJoin?: CanvasLineJoin;
    draggable?: boolean;
    fillPriority?: "color" | "pattern" | "linear-gradient" | "radial-gradient";
    fillPatternImage?: HTMLImageElement;
    fillPatternRepeat?: "repeat" | "repeat-x" | "repeat-y" | "no-repeat";
    onMouseEnter?: (e: any) => void;
    onMouseLeave?: (e: any) => void;
    onMouseDown?: (e: any) => void;
    onClick?: (e: any) => void;
}) {
    const {
        points,
        holes = [],
        fill,
        stroke,
        strokeWidth = 2,
        opacity = 1,
        listening = true,
        perfectDrawEnabled = false,
        dash,
        dashEnabled,
        lineCap,
        lineJoin,
        draggable = false,
        fillPriority,
        fillPatternImage,
        fillPatternRepeat,
        onMouseEnter,
        onMouseLeave,
        onMouseDown,
        onClick,
    } = props;

    return (
        <Shape
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
            listening={listening}
            perfectDrawEnabled={perfectDrawEnabled}
            dash={dash}
            dashEnabled={dashEnabled}
            lineCap={lineCap}
            lineJoin={lineJoin}
            draggable={draggable}
            fillPriority={fillPriority}
            fillPatternImage={fillPatternImage}
            fillPatternRepeat={fillPatternRepeat}
            fillRule="evenodd"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onMouseDown={onMouseDown}
            onClick={onClick}
            sceneFunc={(ctx, shape) => {
                if (!points || points.length < 6) return;

                ctx.beginPath();

                // outer
                ctx.moveTo(points[0], points[1]);
                for (let i = 2; i < points.length; i += 2) {
                    ctx.lineTo(points[i], points[i + 1]);
                }
                ctx.closePath();

                // holes
                for (const h of holes) {
                    if (!h || h.length < 6) continue;
                    ctx.moveTo(h[0], h[1]);
                    for (let i = 2; i < h.length; i += 2) {
                        ctx.lineTo(h[i], h[i + 1]);
                    }
                    ctx.closePath();
                }

                ctx.fillStrokeShape(shape);
            }}
        />
    );
}

export function GridShape(props: {
    canvasW: number;
    canvasH: number;
    stageScale: number;
    stagePos: { x: number; y: number };
    gridSize: number;
}) {
    const { canvasW, canvasH, stageScale, stagePos, gridSize } = props;

    const bounds = useMemo(() => {
        const left = (-stagePos.x) / stageScale;
        const top = (-stagePos.y) / stageScale;
        const right = (canvasW - stagePos.x) / stageScale;
        const bottom = (canvasH - stagePos.y) / stageScale;

        // kleine marge zodat je niet “gaten” ziet aan de randen
        const pad = gridSize * 2;

        const startX = Math.floor((left - pad) / gridSize) * gridSize;
        const endX = Math.ceil((right + pad) / gridSize) * gridSize;
        const startY = Math.floor((top - pad) / gridSize) * gridSize;
        const endY = Math.ceil((bottom + pad) / gridSize) * gridSize;

        return { startX, endX, startY, endY };
    }, [canvasW, canvasH, stagePos.x, stagePos.y, stageScale, gridSize]);

    return (
        <Shape
            listening={false}
            perfectDrawEnabled={false}
            sceneFunc={(ctx, shape) => {
                ctx.beginPath();

                // Vertical lines
                for (let x = bounds.startX; x <= bounds.endX; x += gridSize) {
                    ctx.moveTo(x, bounds.startY);
                    ctx.lineTo(x, bounds.endY);
                }

                // Horizontal lines
                for (let y = bounds.startY; y <= bounds.endY; y += gridSize) {
                    ctx.moveTo(bounds.startX, y);
                    ctx.lineTo(bounds.endX, y);
                }

                ctx.strokeStyle = COLORS.grid;
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.closePath();
                // @ts-ignore
                shape.getSceneFunc && shape.getSceneFunc();
            }}
        />
    );
}

export const TYPE_LABELS: Record<string, string> = OBJECT_LABELS;

export const TREEBED_VARIANT_LABELS: Record<TreebedVariant, string> = {
    standard: "standaard",
    multi_stem: "meerstammig",
    espalier: "leivorm",
    roof: "dakvorm",
};

export function getTreebedLabel(obj: Pick<PolyObject, "type" | "treebedVariant">) {
    if (obj.type !== "treebed") {
        return TYPE_LABELS[obj.type] ?? obj.type;
    }

    const variant = obj.treebedVariant ?? "standard";
    if (variant === "standard") return "Boomvak";

    return `Boomvak (${TREEBED_VARIANT_LABELS[variant]})`;
}

type BuildingType = ObjectType;

const BUILDING_PATTERN_CACHE = new Map<string, HTMLCanvasElement>();
const BUILDING_PATTERN_SIZE = 22;
const BUILDING_PATTERN_SPACING = 22;
const BUILDING_PATTERN_STROKE_WIDTH = 1;

export function clearBuildingPatternCache() {
    BUILDING_PATTERN_CACHE.clear();
}

export function isFenceOrGate(t: any): t is ObjectType {
    return typeof t === "string" && isUnifiedBoundaryType(t as ObjectType);
}

export function isBuildingType(t: any): t is BuildingType {
    return isBuildingObjectType(t as ObjectType);
}

export function getViewVisibilityKeyForType(type: ObjectType) {
    return getObjectVisibilityGroup(type);
}

export function getViewVisibilityLabelForType(type: ObjectType) {
    switch (getObjectVisibilityGroup(type)) {
        case "showGround":
            return "Toon ondergrond";
        case "showBuildings":
            return "Toon gebouwen";
        case "showBoundaries":
            return "Toon afbakening";
        case "showPlantbeds":
            return "Toon plantvak";
        case "showTreebeds":
            return "Toon boomvak";
    }
}

export function getBuildingPatternCanvas(type: BuildingType): HTMLCanvasElement | undefined {
    if (typeof document === "undefined") return undefined;

    const { fill, stroke } = OBJECT_STYLES[type];
    const key = `${fill}_${stroke}`;

    const cached = BUILDING_PATTERN_CACHE.get(key);
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    canvas.width = BUILDING_PATTERN_SIZE;
    canvas.height = BUILDING_PATTERN_SIZE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = stroke;
    ctx.lineWidth = BUILDING_PATTERN_STROKE_WIDTH;

    for (
        let offset = -BUILDING_PATTERN_SIZE;
        offset <= BUILDING_PATTERN_SIZE;
        offset += BUILDING_PATTERN_SPACING
    ) {
        ctx.beginPath();
        ctx.moveTo(offset, BUILDING_PATTERN_SIZE);
        ctx.lineTo(offset + BUILDING_PATTERN_SIZE, 0);
        ctx.stroke();
    }

    BUILDING_PATTERN_CACHE.set(key, canvas);
    return canvas;
}

export function getLineStrokeWidth(t: any) {
    if (typeof t !== "string") return 2;
    return isUnifiedBoundaryType(t as ObjectType)
        ? getBoundaryStrokeWidth(t as ObjectType)
        : 2;
}