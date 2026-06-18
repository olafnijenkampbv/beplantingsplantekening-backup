"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";

type ConfirmModalItem = {
    id: string;
    nr?: number | string;
    nrBg?: string;
    nrColor?: string;
    nrBorder?: string | null;
    title: string;
    subtitle?: string;
};

export type ConfirmModalProps = {
    open: boolean;
    title: string;
    description: React.ReactNode;

    items?: ConfirmModalItem[];
    listTitle?: React.ReactNode;
    listVariant?: "cards" | "bullets";
    maxPreviewItems?: number;
    moreLabel?: (hiddenCount: number) => string;
    lessLabel?: string;

    cancelText?: string;
    confirmText?: string;

    onCancel: () => void;
    onConfirm: () => void;
};

const COLORS = {
    orange: "#E94E1B",
    border: "#E0DEDF",
    green: "#58694C",
    overlay: "rgba(0,0,0,0.33)",
};

export default function ConfirmModal(props: ConfirmModalProps) {
    const {
        open,
        title,
        description,
        items = [],
        listTitle,
        listVariant = "cards",
        maxPreviewItems = 3,
        moreLabel,
        lessLabel = "Minder weergeven",
        cancelText = "Nee, behouden",
        confirmText = "Ja, verwijderen",
        onCancel,
        onConfirm,
    } = props;

    const [expanded, setExpanded] = useState(false);
    useScrollLock(open);

    useEffect(() => {
        if (!open) {
            setExpanded(false);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter") onConfirm();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onCancel, onConfirm]);

    const hasItems = items.length > 0;

    const { preview, hiddenCount } = useMemo(() => {
        const nextPreview = items.slice(0, maxPreviewItems);
        const nextHiddenCount = Math.max(0, items.length - nextPreview.length);

        return {
            preview: nextPreview,
            hiddenCount: nextHiddenCount,
        };
    }, [items, maxPreviewItems]);

    const visibleItems = expanded ? items : preview;
    const showMoreToggle = hasItems && hiddenCount > 0;
    const moreText = moreLabel?.(hiddenCount) ?? `+ ${hiddenCount} andere`;

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{
                background: COLORS.overlay,
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
            }}
            onMouseDown={onCancel}
        >
            <div
                className="relative w-[720px] max-w-[calc(100vw-48px)] rounded-md bg-white shadow-lg flex flex-col overflow-hidden"
                style={{
                    border: `1px solid ${COLORS.border}`,
                    maxHeight: "calc(100vh - 120px)",
                }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div
                    className="px-8 pt-7 pb-4 flex flex-col"
                    style={{ flex: "1 1 auto", minHeight: 0 }}
                >
                    <div className="text-[22px] font-bold text-black">{title}</div>

                    <div
                        className="mt-4"
                        style={{ height: 1, background: COLORS.border }}
                    />

                    <div className="mt-4 text-[14px] text-black leading-[1.35]">
                        {description}
                    </div>

                    {hasItems && (
                        <div
                            className="mt-4 flex flex-col"
                            style={{ flex: "1 1 auto", minHeight: 0 }}
                        >
                            {listTitle && (
                                <div className="mb-2 text-[13px] leading-[1.35] text-black">
                                    {listTitle}
                                </div>
                            )}

                            <div
                                className="flex flex-col"
                                style={{
                                    overflowY: "auto",
                                    minHeight: 0,
                                    paddingRight: 6,
                                }}
                            >
                                {listVariant === "bullets" ? (
                                    <ul
                                        style={{
                                            margin: 0,
                                            paddingLeft: 18,
                                            color: "#000000",
                                            fontSize: 13,
                                            lineHeight: 1.55,
                                            listStyleType: "disc",
                                            listStylePosition: "outside",
                                        }}
                                    >
                                        {visibleItems.map((it) => (
                                            <li
                                                key={it.id}
                                                style={{
                                                    marginBottom: 2,
                                                    display: "list-item",
                                                }}
                                            >
                                                {it.title}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    visibleItems.map((it, idx) => {
                                        const isLast = idx === visibleItems.length - 1;

                                        return (
                                            <div
                                                key={it.id}
                                                className="flex items-center gap-3 px-3 py-3"
                                                style={{
                                                    borderBottom: isLast
                                                        ? "none"
                                                        : `1px solid ${COLORS.border}`,
                                                }}
                                            >
                                                <div
                                                    className="h-7 w-7 flex items-center justify-center rounded-md text-[12px] font-bold"
                                                    style={{
                                                        background: it.nrBg ?? COLORS.green,
                                                        color: it.nrColor ?? "#ffffff",
                                                        border: it.nrBorder ? `1px solid ${it.nrBorder}` : "none",
                                                    }}
                                                >
                                                    {it.nr ?? ""}
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="text-[14px] font-bold text-black truncate">
                                                        {it.title}
                                                    </div>
                                                    {it.subtitle && (
                                                        <div className="text-[12px] text-[#6b6b6b] truncate">
                                                            {it.subtitle}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {showMoreToggle && (
                                <button
                                    type="button"
                                    className="mt-2 text-[12px] font-semibold"
                                    style={{
                                        color: "#898988",
                                        cursor: "pointer",
                                        textDecoration: "none",
                                        flex: "0 0 auto",
                                        alignSelf: "flex-start",
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLButtonElement).style.textDecoration = "underline";
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLButtonElement).style.textDecoration = "none";
                                    }}
                                    onClick={() => setExpanded((v) => !v)}
                                >
                                    {expanded ? lessLabel : moreText}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-8 pb-7 pt-4 flex items-center gap-4">
                    <button
                        type="button"
                        className="h-12 flex-1 rounded-md text-[13px] font-semibold"
                        style={{
                            cursor: "pointer",
                            border: "1px solid #BDBDBD",
                            background: "#F9F8F7",
                            color: "#898988",
                            transition: "background 0.3s ease, opacity 0.3s ease",
                        }}
                        onMouseEnter={(e) => {
                            const el = e.currentTarget as HTMLButtonElement;
                            el.style.background = "#F2F0EF";
                            el.style.opacity = "0.95";
                        }}
                        onMouseLeave={(e) => {
                            const el = e.currentTarget as HTMLButtonElement;
                            el.style.background = "#F9F8F7";
                            el.style.opacity = "1";
                        }}
                        onClick={onCancel}
                    >
                        {cancelText}
                    </button>

                    <button
                        type="button"
                        className="h-12 flex-1 rounded-md text-[13px] font-semibold text-white"
                        style={{
                            cursor: "pointer",
                            border: `1px solid ${COLORS.orange}`,
                            background: COLORS.orange,
                            transition: "background 0.3s ease, opacity 0.3s ease",
                        }}
                        onMouseEnter={(e) => {
                            const el = e.currentTarget as HTMLButtonElement;
                            el.style.background = "#ED724A";
                            el.style.opacity = "0.95";
                        }}
                        onMouseLeave={(e) => {
                            const el = e.currentTarget as HTMLButtonElement;
                            el.style.background = COLORS.orange;
                            el.style.opacity = "1";
                        }}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}