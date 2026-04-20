"use client";

import React, { useMemo, useState } from "react";
import type {
    Step3StructureDistribution,
    Step3StructureOption,
} from "@/features/editor/components/editor/rightStepMenu/rightStepMenuConfig";

const COLORS = {
    orange: "#E94E1B",
    orangeSoft: "#FFF4EF",
    green: "#58694C",
    greenLight: "#EEF0ED",
    border: "#E3E2E2",
    lightBorder: "#E0DEDF",
    rowFill: "#EEF0ED",
    text: "#111111",
    mutedText: "#6B7280",
    softText: "#898988",
    track: "#F7F7F3",
    bodembedekkers: "#58694C",
    vastePlanten: "#9BA594",
    heestersEnStruiken: "#E94E1B",
    bomen: "#E0DED4",
    tipText: "#31708F",
    tipBorder: "#BCE8F1",
    tipFill: "#D9EDF7",
};

type Step3CustomPercentages = {
    bodembedekkers: string;
    vastePlanten: string;
    heestersEnStruiken: string;
    bomen: string;
};

type RightStepStep3StructureProps = {
    stepLabel: string;
    structureOptions: Step3StructureOption[];
    selectedStructureStyle: string;
    customPercentages: Step3CustomPercentages;
    onSelectStructureStyle: (value: string) => void;
    onChangeCustomPercentage: (
        key: keyof Step3CustomPercentages,
        value: string
    ) => void;
};

type DistributionKey = keyof Step3StructureDistribution;

const DISTRIBUTION_META: Array<{
    key: DistributionKey;
    label: string;
    color: string;
}> = [
        {
            key: "bodembedekkers",
            label: "Bodembedekkers",
            color: COLORS.bodembedekkers,
        },
        {
            key: "vastePlanten",
            label: "Vaste planten",
            color: COLORS.vastePlanten,
        },
        {
            key: "heestersEnStruiken",
            label: "Heesters & struiken",
            color: COLORS.heestersEnStruiken,
        },
        {
            key: "bomen",
            label: "Bomen",
            color: COLORS.bomen,
        },
    ];

function StructureChoiceCard(props: {
    option: Step3StructureOption;
    isSelected: boolean;
    onClick: () => void;
}) {
    const { option, isSelected, onClick } = props;

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
                    src={option.imageSrc}
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
                        src={
                            isSelected
                                ? "/icons/checkbox-checked.svg"
                                : "/icons/checkbox-unchecked.svg"
                        }
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
                className="px-3 pt-3 pb-3 flex flex-col"
                style={{
                    flex: "1 1 auto",
                    justifyContent: "space-between",
                }}
            >
                <div
                    className="text-[13px] font-semibold leading-[1.35]"
                    style={{ color: "#1F2937", minHeight: 36 }}
                >
                    {option.label}
                </div>

                <div
                    className="my-2"
                    style={{
                        height: 1,
                        background: COLORS.border,
                    }}
                />

                <p
                    className="text-[11px] italic leading-[1.45]"
                    style={{ color: "#4B5563" }}
                >
                    {option.description}
                </p>
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
                    filter: disabled ? "brightness(0) saturate(100%) opacity(0.35)" : "brightness(0) invert(1)",
                }}
            />
        </button>
    );
}

function PercentageBar(props: {
    value: number;
    color: string;
}) {
    const { value, color } = props;

    return (
        <div
            className="overflow-hidden rounded-full"
            style={{
                height: 8,
                background: "#FFFFFF",
                border: "1px solid #E0DEDF",
                boxSizing: "border-box",
            }}
        >
            <div
                style={{
                    width: `${Math.max(0, Math.min(100, value))}%`,
                    height: "100%",
                    background: color,
                    borderRadius: 999,
                }}
            />
        </div>
    );
}

function TotalBar(props: {
    distribution: Step3StructureDistribution;
}) {
    const { distribution } = props;

    return (
        <div>
            <div
                className="text-[16px] font-semibold mb-3"
                style={{ color: COLORS.text }}
            >
                Totaal
            </div>

            <div className="flex items-center gap-3">
                <div
                    className="text-[12px] leading-[1]"
                    style={{ color: COLORS.text, flex: "0 0 auto" }}
                >
                    0%
                </div>

                <div
                    className="overflow-hidden rounded-full flex-1"
                    style={{
                        height: 8,
                        background: COLORS.track,
                    }}
                >
                    {DISTRIBUTION_META.map((item) => {
                        const value = distribution[item.key] ?? 0;

                        return (
                            <div
                                key={item.key}
                                style={{
                                    width: `${Math.max(0, Math.min(100, value))}%`,
                                    height: "100%",
                                    background: item.color,
                                    float: "left",
                                }}
                            />
                        );
                    })}
                </div>

                <div
                    className="text-[12px] leading-[1]"
                    style={{ color: COLORS.text, flex: "0 0 auto" }}
                >
                    100%
                </div>
            </div>
        </div>
    );
}

function ExplanationBlock(props: {
    title: string;
    bullets: string[];
    tip: string;
}) {
    const { title, bullets, tip } = props;

    return (
        <div
            className="rounded-[8px] border px-4 py-4"
            style={{
                borderColor: COLORS.border,
                background: "#FFFFFF",
            }}
        >
            <div
                className="text-[15px] font-semibold mb-3"
                style={{ color: COLORS.text }}
            >
                {title}
            </div>

            <div className="space-y-2 mb-4">
                {bullets.map((bullet) => (
                    <div key={bullet} className="flex items-start gap-3">
                        <img
                            src="/icons/check-icon.svg"
                            alt=""
                            style={{
                                width: 18,
                                height: 18,
                                display: "block",
                                marginTop: 1,
                                flex: "0 0 auto",
                            }}
                        />

                        <div
                            className="text-[13px] leading-[1.45]"
                            style={{ color: COLORS.text }}
                        >
                            {bullet}
                        </div>
                    </div>
                ))}
            </div>

            <div
                className="rounded-[6px] border px-3 py-3 flex items-center gap-2"
                style={{
                    borderColor: COLORS.tipBorder,
                    background: COLORS.tipFill,
                }}
            >
                <img
                    src="/icons/info.svg"
                    alt=""
                    style={{
                        width: 16,
                        height: 16,
                        display: "block",
                        flex: "0 0 auto",
                        filter:
                            "brightness(0) saturate(100%) invert(38%) sepia(24%) saturate(1120%) hue-rotate(155deg) brightness(91%) contrast(88%)",
                    }}
                />

                <div
                    className="text-[12px] leading-[1.35]"
                    style={{ color: COLORS.tipText }}
                >
                    {tip}
                </div>
            </div>
        </div>
    );
}

export default function RightStepStep3Structure(
    props: RightStepStep3StructureProps
) {
    const {
        stepLabel,
        structureOptions,
        selectedStructureStyle,
        customPercentages,
        onSelectStructureStyle,
        onChangeCustomPercentage,
    } = props;

    const [sliderIndex, setSliderIndex] = useState(0);

    const maxSliderIndex = Math.max(0, structureOptions.length - 2);
    const sliderSlideCount = maxSliderIndex + 1;
    const selectedOption =
        structureOptions.find((option) => option.value === selectedStructureStyle) ?? null;

    const resolvedDistribution = useMemo<Step3StructureDistribution>(() => {
        if (!selectedOption) {
            return {
                bodembedekkers: 0,
                vastePlanten: 0,
                heestersEnStruiken: 0,
                bomen: 0,
            };
        }

        if (selectedOption.value !== "vrij-samenstellen") {
            return selectedOption.distribution;
        }

        return {
            bodembedekkers: Number(customPercentages.bodembedekkers || 0),
            vastePlanten: Number(customPercentages.vastePlanten || 0),
            heestersEnStruiken: Number(customPercentages.heestersEnStruiken || 0),
            bomen: Number(customPercentages.bomen || 0),
        };
    }, [selectedOption, customPercentages]);

    const totalPercentage =
        (resolvedDistribution.bodembedekkers || 0) +
        (resolvedDistribution.vastePlanten || 0) +
        (resolvedDistribution.heestersEnStruiken || 0) +
        (resolvedDistribution.bomen || 0);

    const isOverLimit =
        selectedOption?.value === "vrij-samenstellen" && totalPercentage > 100;

    const isUnderLimit =
        selectedOption?.value === "vrij-samenstellen" && totalPercentage < 100;

    const showPercentageError =
        selectedOption?.value === "vrij-samenstellen" &&
        totalPercentage !== 100;

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
                Kies hoeveel ruimte je wilt geven aan bodembedekkers, vaste planten, heesters en bomen. Dit bepaalt de structuur en uitstraling van het plan.
            </p>

            <section className="mb-5">
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
                        {structureOptions.map((option) => (
                            <div
                                key={option.value}
                                style={{
                                    flex: "0 0 calc(50% - 4px)",
                                }}
                            >
                                <StructureChoiceCard
                                    option={option}
                                    isSelected={selectedStructureStyle === option.value}
                                    onClick={() => onSelectStructureStyle(option.value)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-center gap-3">
                    <SliderArrowButton
                        direction="prev"
                        disabled={sliderIndex <= 0}
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

            {selectedOption ? (
                <>
                    <section className="mb-5">
                        <div>
                            <h3
                                className="text-[15px] font-semibold"
                                style={{ color: COLORS.green }}
                            >
                                {selectedOption.label}
                            </h3>

                            {showPercentageError && (
                                <div
                                    style={{
                                        marginTop: 6,
                                        marginBottom: 10,
                                        fontSize: 12,
                                        color: COLORS.orange,
                                        fontStyle: "italic",
                                        lineHeight: 1.3,
                                    }}
                                >
                                    {isOverLimit
                                        ? "* Het totaal moet precies 100% zijn, je zit nu over de 100%"
                                        : "* Het totaal moet precies 100% zijn, je zit nu onder de 100%"}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            {DISTRIBUTION_META.map((item) => {
                                const value = resolvedDistribution[item.key] ?? 0;
                                const isCustom =
                                    selectedOption.value === "vrij-samenstellen";

                                return (
                                    <div
                                        key={item.key}
                                        className="rounded-[6px] border px-3 py-3"
                                        style={{
                                            background: COLORS.rowFill,
                                            borderColor: COLORS.lightBorder,
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="text-[12px] leading-[1.35]"
                                                style={{
                                                    color: COLORS.text,
                                                    flex: "0 0 104px",
                                                }}
                                            >
                                                {item.label}
                                            </div>

                                            <div className="flex-1">
                                                <PercentageBar
                                                    value={value}
                                                    color={item.color}
                                                />
                                            </div>

                                            {isCustom ? (
                                                <div
                                                    className="flex items-center overflow-hidden rounded-[4px] border"
                                                    style={{
                                                        borderColor: COLORS.lightBorder,
                                                        background: "#FFFFFF",
                                                        width: 74,
                                                        flex: "0 0 auto",
                                                    }}
                                                >
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={
                                                            customPercentages[
                                                            item.key as keyof Step3CustomPercentages
                                                            ]
                                                        }
                                                        onChange={(event) =>
                                                            onChangeCustomPercentage(
                                                                item.key as keyof Step3CustomPercentages,
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="..."
                                                        className="w-full bg-transparent px-2 py-[6px] text-[12px] outline-none"
                                                        style={{
                                                            color: COLORS.text,
                                                        }}
                                                    />
                                                    <div
                                                        className="px-2 py-[6px] text-[12px] font-semibold"
                                                        style={{
                                                            background: COLORS.green,
                                                            color: "#FFFFFF",
                                                        }}
                                                    >
                                                        %
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className="text-[12px] font-semibold"
                                                    style={{
                                                        color: COLORS.text,
                                                        flex: "0 0 32px",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    {value}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="mb-5">
                        <TotalBar distribution={resolvedDistribution} />
                    </section>

                    {selectedOption.explanationTitle &&
                        selectedOption.explanationBullets &&
                        selectedOption.explanationTip ? (
                        <section>
                            <ExplanationBlock
                                title={selectedOption.explanationTitle}
                                bullets={selectedOption.explanationBullets}
                                tip={selectedOption.explanationTip}
                            />
                        </section>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}