"use client";

import React from "react";
import type { ObjectType, PolyObjectStyle } from "@/state/projectStore";

const PANEL_UI = {
    width: 760,
    offsetLeft: 22,
    padding: 30,
    radius: 12,
    shadow: "0px 6px 18px 0px rgba(0,0,0,0.18)",
    border: "#E0DEDF",

    titleFontSize: 26,
    titleFontWeight: 700,

    closeButtonSize: 42,
    closeIconSize: 24,

    previewSize: 210,
    previewGap: 42,

    objectTitleFontSize: 26,
    objectMetaFontSize: 20,
    rowTextFontSize: 20,

    sectionTitleFontSize: 24,
    quickLabelFontSize: 20,

    colorBoxSize: 58,
    colorInputWidth: 220,
    colorControlHeight: 58,
    inputFontSize: 22,

    iconButtonSize: 66,
    iconSize: 32,

    quickSwatchSize: 44,

    footerButtonHeight: 64,
    footerButtonFontSize: 22,
    footerIconSize: 26,
    footerGap: 16,
} as const;

const COLORS = {
    orange: "#E94E1B",
    border: PANEL_UI.border,
    muted: "#898988",
    text: "#111111",
};

const QUICK_FILL_COLORS = [
    "#F2FDEF",
    "#8FA06F",
    "#9FB19E",
    "#9CB4BC",
    "#B6A8D1",
    "#D9B5AE",
    "#E1CFAC",
    "#F9DFA1",
    "#DA7747",
    "#8E6647",
    "#4B4B4B",
];

const QUICK_BORDER_COLORS = [
    "#3F6B3F", // bij #F2FDEF
    "#5F7344", // bij #8FA06F
    "#6F866E", // bij #9FB19E
    "#6C858D", // bij #9CB4BC
    "#7E6A9F", // bij #B6A8D1
    "#A97E77", // bij #D9B5AE
    "#A88D61", // bij #E1CFAC
    "#A8790B", // bij #F9DFA1
    "#A9562A", // bij #DA7747
    "#6C4B32", // bij #8E6647
    "#2D2D2D", // bij #4B4B4B
];
const DEFAULT_FILL = "#F2FDEF";
const DEFAULT_STROKE = "#3F6B3F";

type ObjectColorPanelProps = {
    labelText: string;
    currentType: ObjectType;
    fill: string;
    stroke: string;
    onApply: (style: PolyObjectStyle) => void;
    onClose: () => void;
};

function normalizeHexInput(value: string) {
    const clean = value.trim().replace(/[^#a-fA-F0-9]/g, "");
    if (!clean.startsWith("#")) return `#${clean}`.slice(0, 7);
    return clean.slice(0, 7);
}

function isValidHex(value: string) {
    return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function ColorField(props: {
    title: string;
    value: string;
    fallbackValue: string;
    quickColors: string[];
    onChange: (value: string) => void;
}) {
    const { title, value, fallbackValue, quickColors, onChange } = props;
    const hiddenColorInputRef = React.useRef<HTMLInputElement | null>(null);

    const applyValue = (nextValue: string) => {
        const normalized = normalizeHexInput(nextValue).toUpperCase();
        onChange(normalized);
    };

    const openEyeDropper = async () => {
        const EyeDropperConstructor = (window as any).EyeDropper;

        if (!EyeDropperConstructor) {
            hiddenColorInputRef.current?.click();
            return;
        }

        try {
            const eyeDropper = new EyeDropperConstructor();
            const result = await eyeDropper.open();

            if (result?.sRGBHex) {
                applyValue(result.sRGBHex);
            }
        } catch {
            // gebruiker annuleert eyedropper
        }
    };

    return (
        <div>
            <div
                style={{
                    fontSize: PANEL_UI.sectionTitleFontSize,
                    fontWeight: 700,
                    color: COLORS.text,
                    marginBottom: 10,
                    lineHeight: 1,
                }}
            >
                {title}
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `${PANEL_UI.colorBoxSize}px ${PANEL_UI.colorInputWidth}px 1fr ${PANEL_UI.iconButtonSize}px ${PANEL_UI.iconButtonSize}px`,
                    columnGap: 10,
                    alignItems: "center",
                }}
            >
                <div
                    style={{
                        width: PANEL_UI.colorBoxSize,
                        height: PANEL_UI.colorBoxSize,
                        borderRadius: 4,
                        background: value,
                        border: `1px solid ${COLORS.border}`,
                    }}
                />

                <input
                    value={value}
                    onChange={(event) => applyValue(event.target.value)}
                    onBlur={(event) => {
                        if (!isValidHex(event.target.value)) {
                            applyValue(fallbackValue);
                        }
                    }}
                    style={{
                        width: PANEL_UI.colorInputWidth,
                        height: PANEL_UI.colorControlHeight,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 4,
                        padding: "0 14px",
                        fontSize: PANEL_UI.inputFontSize,
                        color: "#222222",
                        outline: "none",
                    }}
                />

                <div />

                <button
                    type="button"
                    onClick={openEyeDropper}
                    style={{
                        width: PANEL_UI.iconButtonSize,
                        height: PANEL_UI.iconButtonSize,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 4,
                        background: "#ffffff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                    }}
                >
                    <img src="/icons/color-picker.svg" alt="" style={{ width: PANEL_UI.iconSize, height: PANEL_UI.iconSize }} />
                </button>

                <button
                    type="button"
                    onClick={() => hiddenColorInputRef.current?.click()}
                    style={{
                        width: PANEL_UI.iconButtonSize,
                        height: PANEL_UI.iconButtonSize,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 4,
                        background: "#ffffff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                    }}
                >
                    <img src="/icons/color-wheel.svg" alt="" style={{ width: PANEL_UI.iconSize, height: PANEL_UI.iconSize }} />
                </button>

                <input
                    ref={hiddenColorInputRef}
                    type="color"
                    value={isValidHex(value) ? value : fallbackValue}
                    onChange={(event) => applyValue(event.target.value)}
                    style={{
                        position: "absolute",
                        width: 1,
                        height: 1,
                        opacity: 0,
                        pointerEvents: "none",
                    }}
                />
            </div>

            <div
                style={{
                    fontSize: PANEL_UI.quickLabelFontSize,
                    color: COLORS.text,
                    marginTop: 11,
                    marginBottom: 8,
                    lineHeight: 1,
                }}
            >
                Snelle kleuren
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    gap: 10,
                }}
            >
                {quickColors.map((color) => (
                    <button
                        key={`${title}-${color}`}
                        type="button"
                        onClick={() => onChange(color)}
                        style={{
                            width: PANEL_UI.quickSwatchSize,
                            height: PANEL_UI.quickSwatchSize,
                            borderRadius: 3,
                            border: `1px solid ${COLORS.border}`,
                            background: color,
                            cursor: "pointer",
                            flex: "0 0 auto",
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

export default function ObjectColorPanel(props: ObjectColorPanelProps) {
    const { labelText, fill, stroke, onApply, onClose } = props;
    const [draftFill, setDraftFill] = React.useState(fill);
    const [draftStroke, setDraftStroke] = React.useState(stroke);

    React.useEffect(() => {
        setDraftFill(fill);
        setDraftStroke(stroke);
    }, [fill, stroke]);

    return (
        <div
            className="absolute border bg-white"
            style={{
                zIndex: 1500,
                borderColor: COLORS.border,
                width: PANEL_UI.width,
                left: `calc(100% + ${PANEL_UI.offsetLeft}px)`,
                top: 0,
                borderRadius: PANEL_UI.radius,
                boxShadow: PANEL_UI.shadow,
                padding: PANEL_UI.padding,
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 18,
                }}
            >
                <div
                    style={{
                        fontSize: PANEL_UI.titleFontSize,
                        fontWeight: PANEL_UI.titleFontWeight,
                        color: COLORS.text,
                        lineHeight: 1,
                    }}
                >
                    Wijzig kleur
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        width: PANEL_UI.closeButtonSize,
                        height: PANEL_UI.closeButtonSize,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                    }}
                >
                    <img src="/icons/cancel.svg" alt="" style={{ width: PANEL_UI.closeIconSize, height: PANEL_UI.closeIconSize }} />
                </button>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `${PANEL_UI.previewSize}px 1fr`,
                    columnGap: PANEL_UI.previewGap,
                    alignItems: "start",
                }}
            >
                <div
                    style={{
                        width: PANEL_UI.previewSize,
                        height: PANEL_UI.previewSize,
                        background: draftFill,
                        border: `4px dashed ${draftStroke}`,
                    }}
                />

                <div style={{ paddingTop: 5 }}>
                    <div
                        style={{
                            fontSize: PANEL_UI.objectTitleFontSize,
                            fontWeight: 700,
                            color: COLORS.text,
                            lineHeight: 1.15,
                        }}
                    >
                        {labelText}
                    </div>

                    <div
                        style={{
                            fontSize: PANEL_UI.objectMetaFontSize,
                            color: "#444444",
                            marginTop: 6,
                            marginBottom: 15,
                            lineHeight: 1,
                        }}
                    >
                        Huidige stijl
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: `${PANEL_UI.colorBoxSize}px 1fr`,
                            columnGap: 14,
                            rowGap: 12,
                            alignItems: "center",
                        }}
                    >
                        <span
                            style={{
                                width: PANEL_UI.colorBoxSize,
                                height: PANEL_UI.colorBoxSize,
                                background: draftFill,
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: 3,
                            }}
                        />
                        <span style={{ fontSize: PANEL_UI.rowTextFontSize, color: "#333333" }}>
                            Vulling
                        </span>

                        <span
                            style={{
                                width: PANEL_UI.colorBoxSize,
                                height: PANEL_UI.colorBoxSize,
                                background: draftStroke,
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: 3,
                            }}
                        />
                        <span style={{ fontSize: PANEL_UI.rowTextFontSize, color: "#333333" }}>
                            Rand
                        </span>
                    </div>
                </div>
            </div>

            <div style={{ height: 1, background: COLORS.border, margin: "22px 0 18px" }} />

            <ColorField
                title="Vulling"
                value={draftFill}
                fallbackValue={DEFAULT_FILL}
                quickColors={QUICK_FILL_COLORS}
                onChange={setDraftFill}
            />

            <div style={{ height: 1, background: COLORS.border, margin: "20px 0 18px" }} />

            <ColorField
                title="Rand"
                value={draftStroke}
                fallbackValue={DEFAULT_STROKE}
                quickColors={QUICK_BORDER_COLORS}
                onChange={setDraftStroke}
            />

            <div style={{ height: 1, background: COLORS.border, margin: "22px 0 14px" }} />

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: PANEL_UI.footerGap,
                }}
            >
                <button
                    type="button"
                    onClick={() => {
                        setDraftFill(DEFAULT_FILL);
                        setDraftStroke(DEFAULT_STROKE);
                    }}
                    style={{
                        height: PANEL_UI.footerButtonHeight,
                        width: "100%",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 4,
                        background: "#ffffff",
                        color: COLORS.muted,
                        fontSize: PANEL_UI.footerButtonFontSize,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: 0,
                    }}
                >
                    <img src="/icons/herstellen.svg" alt="" style={{ width: PANEL_UI.footerIconSize, height: PANEL_UI.footerIconSize }} />
                    Standaard herstellen
                </button>

                <button
                    type="button"
                    onClick={() => {
                        onApply({
                            fill: draftFill,
                            stroke: draftStroke,
                        });
                        onClose();
                    }}
                    style={{
                        height: PANEL_UI.footerButtonHeight,
                        width: "100%",
                        border: "none",
                        borderRadius: 4,
                        background: COLORS.orange,
                        color: "#ffffff",
                        fontSize: PANEL_UI.footerButtonFontSize,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: 0,
                    }}
                >
                    <img src="/icons/check.svg" alt="" style={{ width: PANEL_UI.footerIconSize, height: PANEL_UI.footerIconSize }} />
                    Toepassen
                </button>
            </div>
        </div>
    );
}