"use client";

import React, { useState } from "react";

const COLORS = {
    orange: "#E94E1B",
    orangeSoft: "#FFF4EF",
    green: "#58694C",
    greenLight: "#EEF0ED",
    border: "#E3E2E2",
    mutedText: "#6B7280",
    softText: "#7A7A7A",
    text: "#111111",
    dotOuter: "#E5E8E3",
    dotMiddle: "#9BA594",
    dotCenter: "#58694C",
};

type SeasonOption = {
    value: string;
    label: string;
    features: string[];
};

type HeightOption = {
    value: string;
    label: string;
    imageSrc: string;
};

type RightStepStep4ExperienceProps = {
    stepLabel: string;
    selectedSeasonExperience: string;
    selectedHeightStyle: string;
    onSelectSeasonExperience: (value: string) => void;
    onSelectHeightStyle: (value: string) => void;
};

const SEASON_OPTIONS: SeasonOption[] = [
    {
        value: "seizoenspiek-voorjaar-zomer",
        label: "Seizoenspiek (voorjaar & zomer)",
        features: [
            "Meer vaste planten met lange bloei",
            "Meer kleuraccenten",
            "Visueel sterk in het seizoen, rustiger in de winter",
        ],
    },
    {
        value: "hele-jaar-aantrekkelijk",
        label: "Het hele jaar aantrekkelijk",
        features: [
            "Mix van bloeiers + groenblijvend + structuurplanten",
            "Meer heesters, siergrassen, winteraspecten",
            "Minder extreme pieken, meer continuïteit",
        ],
    },
    {
        value: "sterk-herfst-winter",
        label: "Ook sterk in herfst & winter",
        features: [
            "Meer groenblijvende planten",
            "Meer planten met bessen, zaadhoofden, siergrassen",
            "Meer focus op silhouet en vorm",
        ],
    },
];

const HEIGHT_OPTIONS: HeightOption[] = [
    {
        value: "laag-horizontaal",
        label: "Laag & horizontaal",
        imageSrc: "/images/laag-horizontaal.png",
    },
    {
        value: "gelaagd-ruimtelijk",
        label: "Gelaagd & ruimtelijk",
        imageSrc: "/images/gelaagd-ruimtelijk.png",
    },
    {
        value: "accent-op-hoogte",
        label: "Accent op hoogte",
        imageSrc: "/images/accent-op-hoogte.png",
    },
];

function ExperienceRow(props: {
    label: string;
    value: string;
    features: string[];
    checked: boolean;
    expanded: boolean;
    onRowClick: () => void;
    onToggleExpand: () => void;
}) {
    const { label, value, features, checked, expanded, onRowClick, onToggleExpand } = props;

    return (
        <div>
            <button
                type="button"
                onClick={onRowClick}
                className="w-full flex items-center gap-3 rounded-md border px-3 py-[11px] text-left transition-all"
                style={{
                    borderColor: checked ? COLORS.orange : COLORS.border,
                    background: checked ? COLORS.orangeSoft : "#FFFFFF",
                    color: "#374151",
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

                <span className="text-[12px] flex-1">{label}</span>

                <span
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggleExpand();
                    }}
                    className="flex items-center gap-1.5"
                    style={{
                        color: COLORS.green,
                        fontSize: 11,
                        flex: "0 0 auto",
                    }}
                >
                    <img
                        src={expanded ? "/icons/minus.svg" : "/icons/plus.svg"}
                        alt=""
                        style={{
                            width: 12,
                            height: 12,
                            display: "block",
                            filter:
                                "brightness(0) saturate(100%) invert(37%) sepia(15%) saturate(650%) hue-rotate(56deg) brightness(91%) contrast(88%)",
                        }}
                    />
                    <span>Kenmerken</span>
                </span>
            </button>

            {expanded ? (
                <div className="pl-[16px] pr-2 pt-2 pb-1">
                    <div className="flex gap-3">
                        <div
                            style={{
                                width: 2,
                                borderRadius: 999,
                                background: COLORS.green,
                                flex: "0 0 2px",
                            }}
                        />

                        <div className="flex-1 pt-0.5 space-y-2">
                            {features.map((feature) => (
                                <div key={`${value}-${feature}`} className="flex items-start gap-2">
                                    <img
                                        src="/icons/check-icon.svg"
                                        alt=""
                                        style={{
                                            width: 14,
                                            height: 14,
                                            marginTop: 1,
                                            flex: "0 0 auto",
                                        }}
                                    />

                                    <span
                                        className="text-[12px] leading-[1.45]"
                                        style={{ color: "#374151" }}
                                    >
                                        {feature}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function HeightCard(props: {
    label: string;
    imageSrc: string;
    isSelected: boolean;
    onClick: () => void;
}) {
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
                <img
                    src={imageSrc}
                    alt=""
                    className="block w-full h-full"
                    style={{
                        objectFit: "cover",
                        objectPosition: "center",
                    }}
                />

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

export default function RightStepStep4Experience(
    props: RightStepStep4ExperienceProps
) {
    const {
        stepLabel,
        selectedSeasonExperience,
        selectedHeightStyle,
        onSelectSeasonExperience,
        onSelectHeightStyle,
    } = props;

    const [expandedSeasonValue, setExpandedSeasonValue] = useState<string | null>(null);
    const [sliderIndex, setSliderIndex] = useState(0);

    const maxSliderIndex = Math.max(0, HEIGHT_OPTIONS.length - 2);
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

            <p
                className="text-[13px] leading-[1.5] mb-5"
                style={{ color: COLORS.text }}
            >
                Geef aan waar de nadruk ligt in de seizoensbeleving en hoe de
                beplanting ruimtelijk is opgebouwd.
            </p>

            <section className="mb-5">
                <h3
                    className="text-[14px] font-semibold mb-1"
                    style={{ color: COLORS.green }}
                >
                    Seizoensbeleving
                </h3>

                <p
                    className="text-[12px] leading-[1.45] mb-3"
                    style={{ color: COLORS.text }}
                >
                    Wanneer moet de beplanting het meest aantrekkelijk zijn?
                </p>

                <div className="space-y-2">
                    {SEASON_OPTIONS.map((option) => (
                        <ExperienceRow
                            key={option.value}
                            label={option.label}
                            value={option.value}
                            features={option.features}
                            checked={selectedSeasonExperience === option.value}
                            expanded={expandedSeasonValue === option.value}
                            onRowClick={() => onSelectSeasonExperience(option.value)}
                            onToggleExpand={() =>
                                setExpandedSeasonValue((prev) =>
                                    prev === option.value ? null : option.value
                                )
                            }
                        />
                    ))}
                </div>
            </section>

            <section>
                <h3
                    className="text-[14px] font-semibold mb-1"
                    style={{ color: COLORS.green }}
                >
                    Hoogtewerking
                </h3>

                <p
                    className="text-[12px] leading-[1.45] mb-3"
                    style={{ color: COLORS.text }}
                >
                    Hoe moet de beplanting zich ruimtelijk gedragen?
                </p>

                <div
                    style={{
                        overflow: "hidden",
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
                        }}
                    >
                        {HEIGHT_OPTIONS.map((option) => (
                            <div
                                key={option.value}
                                style={{
                                    flex: "0 0 calc(50% - 4px)",
                                }}
                            >
                                <HeightCard
                                    label={option.label}
                                    imageSrc={option.imageSrc}
                                    isSelected={selectedHeightStyle === option.value}
                                    onClick={() => onSelectHeightStyle(option.value)}
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
        </div>
    );
}