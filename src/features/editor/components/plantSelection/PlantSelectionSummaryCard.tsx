"use client";

import React from "react";

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    green: "#58694C",
    text: "#111111",
    softText: "#898988",
};

type PlantSelectionSummaryCardProps = {
    onClick: () => void;
};

export default function PlantSelectionSummaryCard(props: PlantSelectionSummaryCardProps) {
    const { onClick } = props;

    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-4 text-left"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor: COLORS.border,
                boxShadow: "5px 3px 46px -25px rgba(0, 0, 0, 0.25)",
            }}
        >
            <span
                className="flex items-center justify-center rounded-full"
                style={{
                    width: 22,
                    height: 22,
                    backgroundColor: COLORS.green,
                    color: "#FFFFFF",
                    fontSize: 12,
                }}
            >
                ☰
            </span>

            <span className="min-w-0">
                <span
                    className="block text-[15px] font-semibold"
                    style={{ color: COLORS.text }}
                >
                    Samenvatting beplanting
                </span>
                <span
                    className="block text-[12px]"
                    style={{ color: COLORS.softText }}
                >
                    Je keuzes in één overzicht
                </span>
            </span>
        </button>
    );
}