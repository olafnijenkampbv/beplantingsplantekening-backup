"use client";

import React from "react";
import { GROUP_OPTIONS, type PlantGroupKey } from "@/features/editor/lib/plantSelectionDummyData";

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    green: "#58694C",
    greenSoft: "#F5F7F3",
    text: "#111111",
};

function SidebarGroupButton(props: {
    label: string;
    active: boolean;
    variant?: "primary" | "secondary" | "search";
    onClick: () => void;
}) {
    const { label, active, variant = "secondary", onClick } = props;

    const isSearch = variant === "search";

    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full cursor-pointer items-center justify-between rounded-[6px] px-4 py-3 text-left transition-colors"
            style={{
                backgroundColor: active
                    ? COLORS.green
                    : isSearch
                        ? "#EDF2EB"
                        : "#F8F7F6",
                color: active ? "#FFFFFF" : isSearch ? COLORS.green : COLORS.text,
                border: "none",
            }}
        >
            <span className="flex items-center gap-2.5">
                {isSearch ? (
                    <img
                        src="/icons/search.svg"
                        alt=""
                        style={{
                            width: 16,
                            height: 16,
                            display: "block",
                            flex: "0 0 auto",
                            filter: active ? "brightness(0) invert(1)" : "none",
                        }}
                    />
                ) : null}

                <span className="text-[14px] font-semibold">{label}</span>
            </span>

            {isSearch ? null : (
                <img
                    src={active ? "/icons/chevron-down.svg" : "/icons/chevron-right.svg"}
                    alt=""
                    style={{
                        width: 16,
                        height: 16,
                        display: "block",
                        flex: "0 0 auto",
                        filter: active ? "brightness(0) invert(1)" : "none",
                    }}
                />
            )}
        </button>
    );
}

type PlantProposalGroupsCardProps = {
    selectedGroup: PlantGroupKey;
    onSelectGroup: (group: PlantGroupKey) => void;
};

export default function PlantProposalGroupsCard(props: PlantProposalGroupsCardProps) {
    const { selectedGroup, onSelectGroup } = props;

    return (
        <section
            className="rounded-[10px] border p-4"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor: COLORS.border,
                boxShadow: "5px 3px 46px -25px rgba(0, 0, 0, 0.25)",
            }}
        >
            <h2 className="text-[18px] font-semibold" style={{ color: COLORS.text }}>
                Plantenvoorstel
            </h2>

            <div className="mt-4 h-px w-full" style={{ backgroundColor: COLORS.border }} />

            <div className="mt-4 space-y-3">
                {GROUP_OPTIONS.map((group) => (
                    <SidebarGroupButton
                        key={group.key}
                        label={group.label}
                        variant={group.variant}
                        active={selectedGroup === group.key}
                        onClick={() => onSelectGroup(group.key)}
                    />
                ))}
            </div>
        </section>
    );
}