import React from "react";
import { Arrow, Group, Rect, Text } from "react-konva";
import { formatMeters, getSegmentLengthInMeters } from "@/state/areaMetrics";

type MeasureToolOverlayProps = {
    stageScale: number;
    committedPoints: number[];
    previewPoint: { x: number; y: number } | null;
};

const COLORS = {
    blue: "#2962FF",
};

const LABEL_LAYOUT = {
    pillFontSize: 16,
    pillHeight: 28,
    pillPaddingX: 12,
    pillCornerRadius: 7,
    segmentOffset: -30,
};

function estimateTextWidth(text: string, fontSize: number) {
    return text.length * fontSize * 0.58;
}

function getSegmentMidpoint(ax: number, ay: number, bx: number, by: number) {
    return {
        x: (ax + bx) / 2,
        y: (ay + by) / 2,
    };
}

function getPerpendicularOffset(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    distance: number
) {
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);

    if (length <= 1e-6) {
        return { x: 0, y: 0 };
    }

    return {
        x: (-dy / length) * distance,
        y: (dx / length) * distance,
    };
}

function BluePillLabel({
    x,
    y,
    text,
    stageScale,
    rotation = 0,
}: {
    x: number;
    y: number;
    text: string;
    stageScale: number;
    rotation?: number;
}) {
    const clampedStageScale = Math.max(stageScale, 1);
    const visualScale = 1 / clampedStageScale;

    const fontSize = LABEL_LAYOUT.pillFontSize;
    const pillHeight = LABEL_LAYOUT.pillHeight;
    const paddingX = LABEL_LAYOUT.pillPaddingX;
    const cornerRadius = LABEL_LAYOUT.pillCornerRadius;
    const textWidth = estimateTextWidth(text, fontSize);
    const width = textWidth + paddingX * 2;

    return (
        <Group
            x={x}
            y={y}
            rotation={rotation}
            scaleX={visualScale}
            scaleY={visualScale}
            listening={false}
        >
            <Rect
                x={-width / 2}
                y={-pillHeight / 2}
                width={width}
                height={pillHeight}
                cornerRadius={cornerRadius}
                fill={COLORS.blue}
                listening={false}
                perfectDrawEnabled={false}
            />
            <Text
                x={-textWidth / 2}
                y={-fontSize / 2 - 1}
                text={text}
                fontSize={fontSize}
                fontStyle="700"
                fill="#ffffff"
                listening={false}
                perfectDrawEnabled={false}
            />
        </Group>
    );
}

export default function MeasureToolOverlay(props: MeasureToolOverlayProps) {
    const { committedPoints, previewPoint, stageScale } = props;

    if (committedPoints.length < 2) return null;

    const ax = committedPoints[0];
    const ay = committedPoints[1];

    const hasCommittedEnd = committedPoints.length >= 4;
    const bx = hasCommittedEnd ? committedPoints[2] : previewPoint?.x;
    const by = hasCommittedEnd ? committedPoints[3] : previewPoint?.y;

    if (typeof bx !== "number" || typeof by !== "number") return null;

    const meters = getSegmentLengthInMeters(ax, ay, bx, by);
    const labelText = formatMeters(meters);
    const midpoint = getSegmentMidpoint(ax, ay, bx, by);
    const offset = getPerpendicularOffset(ax, ay, bx, by, LABEL_LAYOUT.segmentOffset);

    const isVertical = Math.abs(ax - bx) < 1e-6 && Math.abs(ay - by) > 1e-6;

    return (
        <Group listening={false}>
            <Arrow
                points={[ax, ay, bx, by]}
                stroke={COLORS.blue}
                fill={COLORS.blue}
                strokeWidth={2}
                pointerLength={12}
                pointerWidth={12}
                pointerAtBeginning
                lineCap="round"
                lineJoin="round"
                listening={false}
                perfectDrawEnabled={false}
            />

            <BluePillLabel
                x={midpoint.x + offset.x}
                y={midpoint.y + offset.y}
                text={labelText}
                stageScale={stageScale}
                rotation={isVertical ? -90 : 0}
            />
        </Group>
    );
}