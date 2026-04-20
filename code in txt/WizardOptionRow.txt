"use client";

import React from "react";

const COLORS = {
    orange: "#E94E1B",
    orangeSoft: "#FFF4EF",
    border: "#E3E2E2",
    text: "#374151",
};

type WizardOptionRowProps = {
    label: string;
    checked: boolean;
    onClick: () => void;
};

export default function WizardOptionRow(props: WizardOptionRowProps) {
    const { label, checked, onClick } = props;

    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center gap-3 rounded-md border px-3 py-[9px] text-left transition-all"
            style={{
                borderColor: checked ? COLORS.orange : COLORS.border,
                background: checked ? COLORS.orangeSoft : "#FFFFFF",
                color: COLORS.text,
                cursor: "pointer",
            }}
        >
            <span
                className="flex items-center justify-center"
                style={{
                    width: 18,
                    height: 18,
                    flex: "0 0 auto",
                }}
            >
                <img
                    src={checked ? "/icons/checkbox-checked.svg" : "/icons/checkbox-unchecked.svg"}
                    alt=""
                    style={{
                        width: 18,
                        height: 18,
                        display: "block",
                    }}
                />
            </span>

            <span className="text-[12px]">{label}</span>
        </button>
    );
}