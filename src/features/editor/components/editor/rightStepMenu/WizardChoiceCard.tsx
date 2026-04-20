"use client";

import React from "react";

const COLORS = {
    orange: "#E94E1B",
    orangeSoft: "#FFF4EF",
    border: "#E3E2E2",
};

type WizardChoiceCardProps = {
    label: string;
    imageSrc?: string;
    isSelected: boolean;
    onClick: () => void;
};

export default function WizardChoiceCard(props: WizardChoiceCardProps) {
    const { label, imageSrc, isSelected, onClick } = props;

    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full rounded-lg overflow-hidden border text-left transition-all flex flex-col bg-white"
            style={{
                borderColor: isSelected ? COLORS.orange : COLORS.border,
                background: isSelected ? COLORS.orangeSoft : "#FFFFFF",
                boxShadow: isSelected ? "0 0 0 1px rgba(233,78,27,0.08)" : "none",
                cursor: "pointer",
                height: "100%",
            }}
        >
            <div
                className="relative overflow-hidden"
                style={{
                    aspectRatio: "4 / 3",
                    background: "#E9E9E9",
                    flex: "0 0 auto",
                }}
            >
                {imageSrc ? (
                    <img
                        src={imageSrc}
                        alt=""
                        className="block w-full h-full"
                        style={{
                            objectFit: "cover",
                            objectPosition: "center",
                        }}
                    />
                ) : null}

                <div
                    className="absolute left-2 top-2 flex items-center justify-center"
                    style={{
                        width: 18,
                        height: 18,
                    }}
                >
                    <img
                        src={isSelected ? "/icons/checkbox-checked.svg" : "/icons/checkbox-unchecked.svg"}
                        alt=""
                        style={{
                            width: 18,
                            height: 18,
                            display: "block",
                        }}
                    />
                </div>
            </div>

            <div
                className="px-3 py-3 flex items-center"
                style={{
                    minHeight: 58,
                    flex: "1 1 auto",
                }}
            >
                <div
                    className="text-[13px] font-semibold leading-[1.35]"
                    style={{ color: "#1F2937" }}
                >
                    {label}
                </div>
            </div>
        </button>
    );
}