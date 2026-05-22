"use client";

import React from "react";
import type { DummyPlantSpecificationRow } from "@/features/editor/lib/plantSelectionDummyData";

const COLORS = {
    borderSoft: "#E0DEDF",
    text: "#111111",
};

const GREEN_ICON_FILTER =
    "brightness(0) saturate(100%) invert(36%) sepia(13%) saturate(707%) hue-rotate(56deg) brightness(92%) contrast(86%)";

function PlantSpecificationInfoRow(props: DummyPlantSpecificationRow) {
    const { label, value, iconSrc } = props;

    return (
        <div
            className="grid items-start gap-4 py-3"
            style={{ gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)" }}
        >
            <div className="flex min-w-0 items-center gap-3">
                <img
                    src={iconSrc}
                    alt=""
                    style={{
                        width: 16,
                        height: 16,
                        display: "block",
                        flex: "0 0 auto",
                        filter: GREEN_ICON_FILTER,
                    }}
                />
                <span
                    className="text-[13px] font-semibold leading-[1.35]"
                    style={{ color: COLORS.text }}
                >
                    {label}
                </span>
            </div>
            <div
                className="min-w-0 text-[13px] leading-[1.5]"
                style={{
                    color: COLORS.text,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                }}
            >
                {value}
            </div>
        </div>
    );
}

export default function PlantSpecificationsPanel(props: {
    leftColumn: DummyPlantSpecificationRow[];
    rightColumn: DummyPlantSpecificationRow[];
}) {
    const { leftColumn, rightColumn } = props;

    return (
        <div
            className="rounded-[6px] border bg-white px-4 py-3"
            style={{ borderColor: COLORS.borderSoft }}
        >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
                <div>
                    {leftColumn.map((row, index) => (
                        <React.Fragment key={row.label}>
                            <PlantSpecificationInfoRow {...row} />
                            {index < leftColumn.length - 1 ? (
                                <div
                                    className="h-px w-full"
                                    style={{ backgroundColor: COLORS.borderSoft }}
                                />
                            ) : null}
                        </React.Fragment>
                    ))}
                </div>
                <div
                    className="hidden xl:block"
                    style={{ backgroundColor: COLORS.borderSoft }}
                />
                <div>
                    {rightColumn.map((row, index) => (
                        <React.Fragment key={row.label}>
                            <PlantSpecificationInfoRow {...row} />
                            {index < rightColumn.length - 1 ? (
                                <div
                                    className="h-px w-full"
                                    style={{ backgroundColor: COLORS.borderSoft }}
                                />
                            ) : null}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
}