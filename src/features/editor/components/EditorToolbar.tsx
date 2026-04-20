"use client";

import React, { useMemo, useRef, useState } from "react";
import { EditorTool } from "@/state/projectStore";

const COLORS = {
    green: "#58694C",
    border: "#E3E2E2",

    // NEW (jouw design)
    accent: "#E94E1B",        // actieve rand + icon
    accentBg: "#fff",      // actieve achtergrond
    hoverBg: "#f2f2f2",       // hover achtergrond
};

type Props = {
    activeTool: EditorTool;
    onSelectTool: (tool: EditorTool) => void;

    onUndo: () => void;
    onRedo: () => void;

    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    zoomPercent: number;

    onDelete: () => void;
    canDelete: boolean;
};

type Btn = {
    id: string;
    iconSrc: string;
    tooltipLabel: string;
    tooltipShortcut?: string;
    tooltipShortcutIconSrc?: string;
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
};

export default function EditorToolbar(props: Props) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [tooltipX, setTooltipX] = useState<number>(0);
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);
    // refs om positie te meten
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const hideTimerRef = useRef<number | null>(null);

    const buttonsLeft: Btn[] = useMemo(
        () => [
            {
                id: "tool-select",
                iconSrc:
                    props.activeTool === "select"
                        ? "/icons/selection-selected.png"
                        : "/icons/selection.png",
                tooltipLabel: "Selecteren",
                tooltipShortcut: "V",
                onClick: () => props.onSelectTool("select"),
                isActive: props.activeTool === "select",
            },
            {
                id: "tool-hand",
                iconSrc: "/icons/move-tool.svg",
                tooltipLabel: "Verplaatsen",
                tooltipShortcut: "H of houd muiswiel ingedrukt",
                onClick: () => props.onSelectTool("hand"),
                isActive: props.activeTool === "hand",
            },
            {
                id: "tool-cut",
                iconSrc: "/icons/cutting-tool.svg",
                tooltipLabel: "Knippen",
                tooltipShortcut: "C",
                onClick: () => props.onSelectTool("cut"),
                isActive: props.activeTool === "cut",
            },
            {
                id: "tool-measure",
                iconSrc: "/icons/ruler.svg",
                tooltipLabel: "Meten",
                tooltipShortcut: "L",
                onClick: () => props.onSelectTool("measure"),
                isActive: props.activeTool === "measure",
            },
        ],
        [props]
    );

    const buttonsRight: Btn[] = useMemo(
        () => [
            {
                id: "undo",
                iconSrc: "/icons/undo-tool.svg",
                tooltipLabel: "Ongedaan maken",
                tooltipShortcut: "Ctrl + Z",
                onClick: props.onUndo,
            },
            {
                id: "redo",
                iconSrc: "/icons/redo-tool.svg",
                tooltipLabel: "Opnieuw uitvoeren",
                tooltipShortcut: "Ctrl + Y",
                onClick: props.onRedo,
            },
            {
                id: "zoomin",
                iconSrc: "/icons/zoomin-tool.svg",
                tooltipLabel: "Inzoomen",
                tooltipShortcut: "Ctrl + Scroll omhoog",
                onClick: props.onZoomIn,
            },
            {
                id: "zoomout",
                iconSrc: "/icons/zoomout-tool.svg",
                tooltipLabel: "Uitzoomen",
                tooltipShortcut: "Ctrl + Scroll omlaag",
                onClick: props.onZoomOut,
            },
            {
                id: "reset",
                iconSrc: "",
                tooltipLabel: "Reset zoom",
                onClick: () => {
                    props.onResetZoom();
                },
            },
            {
                id: "delete",
                iconSrc: "/icons/delete-tool.svg",
                tooltipLabel: "Verwijderen",
                tooltipShortcut: "Delete / Backspace",
                onClick: props.onDelete,
                disabled: !props.canDelete,
            },
        ],
        [props]
    );

    const hoveredButton =
        buttonsLeft.find((b) => b.id === hoveredId) ??
        buttonsRight.find((b) => b.id === hoveredId) ??
        null;

    const showTooltip = Boolean(hoveredId);

    const buttonClass = (active?: boolean, disabled?: boolean) => {
        const base =
            "h-10 w-10 rounded-md border flex items-center justify-center cursor-pointer transition-colors";

        const activeCls = active
            ? "border-[#E94E1B] bg-[#FFE5DD]"
            : "border-[#E3E2E2] bg-white hover:bg-[#f2f2f2]";

        const disabledCls = disabled ? "opacity-40 pointer-events-none" : "";

        return [base, activeCls, disabledCls].join(" ");
    };

    const setBtnRef =
        (id: string) => (el: HTMLButtonElement | null) => {
            btnRefs.current[id] = el;
        };

    const handleEnter = (id: string) => {
    // cancel eventueel lopende fade-out
    if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
    }

  setHoveredId(id);
  setIsTooltipVisible(true);
    setHoveredId(id);
    setIsTooltipVisible(true);

        const wrapEl = wrapRef.current;
        const btnEl = btnRefs.current[id];
        if (!wrapEl || !btnEl) return;

        const wrapRect = wrapEl.getBoundingClientRect();
        const btnRect = btnEl.getBoundingClientRect();

        // center X van knop t.o.v. wrapper
        const x = btnRect.left + btnRect.width / 2 - wrapRect.left;
        setTooltipX(x);
    };

    const handleLeave = () => {
    setIsTooltipVisible(false);

    // wacht tot fade-out klaar is voordat we unmounten
    hideTimerRef.current = window.setTimeout(() => {
        setHoveredId(null);
        hideTimerRef.current = null;
    }, 150);
    };

    // helper: bepaal button styles op basis van active/hover
    const getBtnStyle = (id: string, active?: boolean) => {
        const isHover = hoveredId === id;
        return {
            borderColor: active ? COLORS.accent : COLORS.border,
            background: active ? COLORS.accentBg : isHover ? COLORS.hoverBg : "#ffffff",
        } as React.CSSProperties;
    };

    // helper: svg kleur via CSS filter (werkt voor svg/png als <img>)
    // Let op: dit is een best-effort filter. Perfect is inline-SVG, maar dit werkt vaak goed.
    const iconFilter = (active?: boolean) =>
        active
            ? "invert(33%) sepia(84%) saturate(2202%) hue-rotate(346deg) brightness(97%) contrast(96%)"
            : "none";

    return (
        <div ref={wrapRef} className="relative z-20">
            <div className="flex items-center gap-3">
                {/* Left group */}
                <div
                    className="flex items-center gap-2 rounded-xl border bg-white px-2 py-2 shadow-sm"
                    style={{ borderColor: COLORS.border }}
                >
                    {buttonsLeft.map((b) => (
                        <button
                            key={b.id}
                            ref={setBtnRef(b.id)}
                            className={buttonClass(b.isActive, b.disabled)}
                            style={getBtnStyle(b.id, b.isActive)}
                            onMouseEnter={() => handleEnter(b.id)}
                            onMouseLeave={handleLeave}
                            onClick={b.onClick}
                        >
                            <img
                                src={b.iconSrc}
                                alt={b.id}
                                className="h-5 w-5"
                                style={{ filter: iconFilter(b.isActive) }}
                            />
                        </button>
                    ))}
                </div>

                {/* Right group */}
                <div
                    className="flex items-center gap-2 rounded-xl border bg-white px-2 py-2 shadow-sm"
                    style={{ borderColor: COLORS.border }}
                >
                    {buttonsRight.map((b) => {
                        if (b.id === "reset") {
                            const isHover = hoveredId === b.id;

                            return (
                                <button
                                    key={b.id}
                                    ref={setBtnRef(b.id)}
                                    className="h-10 rounded-md border px-3 text-sm cursor-pointer transition-colors"
                                    style={{
                                        borderColor: COLORS.border,
                                        background: isHover ? COLORS.hoverBg : "#ffffff",
                                    }}
                                    onMouseEnter={() => handleEnter(b.id)}
                                    onMouseLeave={handleLeave}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        b.onClick();
                                    }}
                                >
                                    {props.zoomPercent}%
                                </button>
                            );
                        }

                        return (
                            <button
                                key={b.id}
                                ref={setBtnRef(b.id)}
                                className={buttonClass(false, b.disabled)}
                                style={getBtnStyle(b.id, false)}
                                onMouseEnter={() => handleEnter(b.id)}
                                onMouseLeave={handleLeave}
                                onClick={b.onClick}
                            >
                                <img
                                src={b.iconSrc}
                                alt={b.id}
                                className={
                                    b.id === "zoomin" || b.id === "zoomout" ? "h-6 w-6" : "h-5 w-5"
                                }
                                style={{ filter: iconFilter(false) }}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tooltip: positioneren onder de gehoverde knop */}
            {hoveredId && hoveredButton && (
                <div
                    className={`absolute top-full mt-2 z-50 transition-opacity duration-150 ease-out ${isTooltipVisible ? "opacity-100" : "opacity-0"
                        }`}
                    style={{
                        left: tooltipX,
                        transform: "translateX(-50%)",
                    }}
                >
                    {/* little pointer */}
                    <div
                        className="mx-auto h-0 w-0"
                        style={{
                            borderLeft: "8px solid transparent",
                            borderRight: "8px solid transparent",
                            borderBottom: `8px solid ${COLORS.green}`,
                        }}
                    />

                    <div
                        className="w-fit rounded-md px-4 py-2 text-sm shadow-sm -mt-[1px] whitespace-nowrap flex items-center transition-opacity duration-150 ease-out"
                        style={{ background: COLORS.green }}
                    >
                        <span className="whitespace-nowrap text-white font-medium">
                            {hoveredButton.tooltipLabel}
                        </span>

                        {hoveredButton.tooltipShortcut && (
                            <span
                                className="ml-4 inline-flex items-center gap-1 whitespace-nowrap"
                                style={{ color: "#A3B497" }}
                            >
                                <span>{hoveredButton.tooltipShortcut}</span>

                                {hoveredButton.tooltipShortcutIconSrc && (
                                    <img
                                        src={hoveredButton.tooltipShortcutIconSrc}
                                        alt=""
                                        className="inline-block h-4 w-4"
                                        style={{ filter: "brightness(0) saturate(100%) invert(74%) sepia(9%) saturate(418%) hue-rotate(53deg) brightness(92%) contrast(88%)" }}
                                    />
                                )}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}