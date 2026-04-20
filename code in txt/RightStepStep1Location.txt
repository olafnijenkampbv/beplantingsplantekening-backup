"use client";

import React, { useState } from "react";
import WizardChoiceCard from "@/features/editor/components/editor/rightStepMenu/WizardChoiceCard";
import WizardOptionRow from "@/features/editor/components/editor/rightStepMenu/WizardOptionRow";
import type {
    WizardChoiceCardOption,
    WizardOptionRowOption,
} from "@/features/editor/components/editor/rightStepMenu/rightStepMenuConfig";

const COLORS = {
    green: "#58694C",
    border: "#E3E2E2",
    infoBg: "#DFF1FB",
    infoText: "#3C6B85",
};

type RightStepStep1LocationProps = {
    stepLabel: string;
    locationOptions: WizardChoiceCardOption[];
    gardenZoneQuestion: string;
    gardenZoneOptions: WizardOptionRowOption[];
    selectedLocation: string;
    selectedGardenZones: string[];
    onSelectLocation: (value: string) => void;
    onToggleGardenZone: (value: string) => void;
};

function SliderDots(props: {
    count: number;
    activeIndex: number;
}) {
    const { count, activeIndex } = props;

    return (
        <div className="flex items-center justify-center gap-[7px]">
            {Array.from({ length: count }).map((_, index) => {
                const isActive = index === activeIndex;

                return (
                    <span
                        key={index}
                        style={{
                            width: isActive ? 8 : 7,
                            height: isActive ? 8 : 7,
                            borderRadius: 999,
                            background: isActive ? COLORS.green : "#C9CEC5",
                            display: "block",
                            flex: "0 0 auto",
                        }}
                    />
                );
            })}
        </div>
    );
}

function SliderArrowButton(props: {
    direction: "prev" | "next";
    disabled: boolean;
    onClick: () => void;
}) {
    const { direction, disabled, onClick } = props;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="flex items-center justify-center rounded-[4px] border"
            style={{
                width: 18,
                height: 18,
                borderColor: disabled ? "#D8D8D8" : COLORS.green,
                background: disabled ? "#F2F2F2" : COLORS.green,
                cursor: disabled ? "not-allowed" : "pointer",
                flex: "0 0 auto",
            }}
        >
            <img
                src={
                    direction === "prev"
                        ? "/icons/chevron-left.svg"
                        : "/icons/chevron-right.svg"
                }
                alt=""
                style={{
                    width: 10,
                    height: 10,
                    display: "block",
                    filter:
                        disabled
                            ? "brightness(0) saturate(100%) opacity(0.35)"
                            : "brightness(0) invert(1)",
                }}
            />
        </button>
    );
}

export default function RightStepStep1Location(props: RightStepStep1LocationProps) {
    const {
        stepLabel,
        locationOptions,
        gardenZoneQuestion,
        gardenZoneOptions,
        selectedLocation,
        selectedGardenZones,
        onSelectLocation,
        onToggleGardenZone,
    } = props;

    const [sliderIndex, setSliderIndex] = useState(0);

    const maxSliderIndex = Math.max(0, locationOptions.length - 2);
    const sliderSlideCount = maxSliderIndex + 1;

    const handlePrev = () => {
        setSliderIndex((prev) => Math.max(0, prev - 1));
    };

    const handleNext = () => {
        setSliderIndex((prev) => Math.min(maxSliderIndex, prev + 1));
    };

    return (
        <div className="px-4 pt-4 pb-5">
            <h2
                className="text-[15px] font-semibold mb-1"
                style={{ color: COLORS.green }}
            >
                {stepLabel}
            </h2>

            <div className="text-[14px] font-medium mb-3">
                Waar komt de beplanting?
            </div>

            <section className="mb-5">
                <div
                    style={{
                        overflowX: "hidden",
                        overflowY: "visible",
                        width: "100%",
                    }}
                >
                    <div
                        className="flex gap-2"
                        style={{
                            width: "100%",
                            transform: `translateX(calc(-${sliderIndex} * (50% + 4px)))`,
                            transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
                            willChange: "transform",
                            paddingBottom: 2,
                        }}
                    >
                        {locationOptions.map((option) => (
                            <div
                                key={option.value}
                                style={{
                                    flex: "0 0 calc(50% - 4px)",
                                }}
                            >
                                <WizardChoiceCard
                                    label={option.label}
                                    imageSrc={option.imageSrc}
                                    isSelected={selectedLocation === option.value}
                                    onClick={() => onSelectLocation(option.value)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-4">
                    <SliderArrowButton
                        direction="prev"
                        disabled={sliderIndex === 0}
                        onClick={handlePrev}
                    />

                    <SliderDots
                        count={sliderSlideCount}
                        activeIndex={sliderIndex}
                    />

                    <SliderArrowButton
                        direction="next"
                        disabled={sliderIndex >= maxSliderIndex}
                        onClick={handleNext}
                    />
                </div>
            </section>

            {selectedLocation ? (
                <>
                    <div className="text-[14px] font-medium mb-3">
                        {gardenZoneQuestion}
                    </div>

                    <div className="space-y-2">
                        {gardenZoneOptions.map((option) => (
                            <WizardOptionRow
                                key={option.value}
                                label={option.label}
                                checked={selectedGardenZones.includes(option.value)}
                                onClick={() => onToggleGardenZone(option.value)}
                            />
                        ))}
                    </div>

                    <div
                        className="mt-4 rounded-md px-3 py-3 flex items-center gap-3"
                        style={{ background: COLORS.infoBg }}
                    >
                        <span
                            className="flex items-center justify-center rounded-full"
                            style={{
                                width: 18,
                                height: 18,
                                border: "1px solid #7AB6D4",
                                color: COLORS.infoText,
                                fontSize: 12,
                                lineHeight: 1,
                                flex: "0 0 auto",
                            }}
                        >
                            i
                        </span>

                        <p
                            className="text-[12px]"
                            style={{ color: COLORS.infoText }}
                        >
                            Je kunt dit later altijd nog aanpassen.
                        </p>
                    </div>
                </>
            ) : null}
        </div>
    );
}