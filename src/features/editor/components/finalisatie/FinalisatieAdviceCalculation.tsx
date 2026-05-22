"use client";

import React, { useEffect, useState } from "react";

// ─── Exported types ───────────────────────────────────────────────────────────
// Used by FinalisatieDrawingBlock to build the data that drives the popup.

export type VakStyle = {
    bg: string;
    border: string | null;
    text: string;
};

export type VakAdviceEntry = {
    objectId: string;
    /** e.g. "P26", "H1", "B3" */
    label: string;
    vakType: "plantbed" | "hedge" | "treebed";
    style: VakStyle;
    measurementMode: "area" | "length";
    /** Total object area in m² (always m², even for hedges — used for formula display) */
    totalArea: number;
    /** Distribution percentage assigned to this plant, 0–100 */
    distribution: number;
    /** Assigned area in m² (totalArea × distribution / 100) */
    assignedArea: number;
    /** Plants per m² — null for treebeds */
    density: number | null;
    /** Unrounded advice = assignedArea × density — null for treebeds */
    rawAdvice: number | null;
    /** Final ceiling'd advice count */
    advice: number;
    /** Hedges only: the assigned portion of the hedge length in meters */
    hedgeLength?: number;
    /** Hedges only: estimated width in meters (null when not estimable) */
    hedgeWidth?: number | null;
};

export type PlantAdviceInfo = {
    plantId: string;
    /** Primary (Latin / botanical) name */
    name: string;
    /** Secondary (Dutch common) name — shown in parentheses */
    latinName: string;
    vakken: VakAdviceEntry[];
};

// ─── Colour tokens ────────────────────────────────────────────────────────────

const C = {
    orange: "#E94E1B",
    orangeHover: "#ED724A",
    orangeSoft: "#FFE5DD",
    green: "#58694C",
    greenLight: "#EEF0ED",
    greenLightSoft: "#F4F6F1",
    border: "#E0DEDF",
    text: "#1F1F1F",
    muted: "#898988",
    mutedDark: "#6b6b6b",
    bg: "#F9F8F7",
    overlay: "rgba(0,0,0,0.33)",
    info: "#D9EDF7",
    infoBorder: "#BCE8F1",
    infoText: "#31708F",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
    return n.toLocaleString("nl-NL", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

// ─── Modal shell (backdrop + card) ────────────────────────────────────────────

type ModalShellProps = {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: number;
};

function ModalShell({ open, onClose, children, maxWidth = 720 }: ModalShellProps) {
    const [visible, setVisible] = useState(false);

    // Entrance animation: defer the "visible" flag by one RAF so the transition fires
    useEffect(() => {
        if (!open) {
            setVisible(false);
            return;
        }
        const raf = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(raf);
    }, [open]);

    // Escape key closes
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            onMouseDown={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: C.overlay,
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                zIndex: 9999,
                opacity: visible ? 1 : 0,
                transition: "opacity 180ms ease",
            }}
        >
            <div
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth,
                    background: "#FFFFFF",
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
                    overflow: "hidden",
                    transform: visible
                        ? "translateY(0) scale(1)"
                        : "translateY(10px) scale(0.985)",
                    opacity: visible ? 1 : 0,
                    transition:
                        "transform 220ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease",
                    maxHeight: "calc(100vh - 120px)",
                    display: "flex",
                    flexDirection: "column",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    color: C.text,
                    position: "relative",
                }}
            >
                {children}
            </div>
        </div>
    );
}

// ─── Close button ─────────────────────────────────────────────────────────────

function CloseButton({ onClose }: { onClose: () => void }) {
    return (
        <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            style={{
                position: "absolute",
                top: 18,
                right: 18,
                width: 28,
                height: 28,
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                zIndex: 1,
                color: C.muted,
                transition: "background 0.12s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F0EFED")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                    d="M2 2L14 14M14 2L2 14"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                />
            </svg>
        </button>
    );
}

// ─── Vak chip ─────────────────────────────────────────────────────────────────

function VakChip({
    entry,
    size = "normal",
}: {
    entry: VakAdviceEntry;
    size?: "small" | "normal";
}) {
    const { style, label } = entry;
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: size === "small" ? 30 : 36,
                padding: size === "small" ? "1px 7px" : "2px 8px",
                borderRadius: 4,
                fontSize: size === "small" ? 12 : 13,
                fontWeight: 700,
                background: style.bg,
                border: style.border ? `1.5px solid ${style.border}` : "none",
                color: style.text,
                lineHeight: 1.2,
                flexShrink: 0,
            }}
        >
            {label}
        </span>
    );
}

// ─── Modal header ─────────────────────────────────────────────────────────────

function ModalHeader({ plant }: { plant: PlantAdviceInfo }) {
    const isMulti = plant.vakken.length > 1;
    return (
        <div style={{ padding: "26px 32px 0 32px", flexShrink: 0 }}>
            <div
                style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#000000",
                    lineHeight: 1.2,
                    paddingRight: 36,
                }}
            >
                Hoe is dit advies berekend?
            </div>

            <div style={{ marginTop: 16, height: 1, background: C.border }} />

            <div
                style={{
                    marginTop: 16,
                    fontSize: 14,
                    color: "#000000",
                    lineHeight: 1.45,
                }}
            >
                {"Voor "}
                <span style={{ fontWeight: 700 }}>{plant.name}</span>
                {plant.latinName ? (
                    <>
                        {" "}
                        <span style={{ fontStyle: "italic", color: C.mutedDark }}>
                            ({plant.latinName})
                        </span>
                    </>
                ) : null}
                {isMulti ? (
                    <>
                        {", verdeeld over "}
                        <span style={{ fontWeight: 700 }}>
                            {plant.vakken.length} plantvakken
                        </span>
                        {"."}
                    </>
                ) : (
                    "."
                )}
            </div>
        </div>
    );
}

// ─── Scrollable body ──────────────────────────────────────────────────────────

function ScrollableBody({
    children,
    paddingTop = 14,
}: {
    children: React.ReactNode;
    paddingTop?: number;
}) {
    return (
        <div
            style={{
                padding: `${paddingTop}px 32px 22px 32px`,
                overflowY: "auto",
                flex: "1 1 auto",
                minHeight: 0,
            }}
        >
            {children}
        </div>
    );
}

// ─── Modal footer + primary button ───────────────────────────────────────────

function ModalFooter({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                padding: "16px 32px 24px 32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 12,
                flexShrink: 0,
                borderTop: `1px solid ${C.border}`,
                background: "#FFFFFF",
            }}
        >
            {children}
        </div>
    );
}

function PrimaryButton({
    children,
    onClick,
}: {
    children: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                height: 42,
                background: C.orange,
                border: `1px solid ${C.orange}`,
                borderRadius: 6,
                color: "#FFFFFF",
                padding: "0 22px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s ease",
                fontFamily: "inherit",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.orangeHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.orange)}
        >
            {children}
        </button>
    );
}

// ─── Info banner ──────────────────────────────────────────────────────────────

function InfoBanner({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                borderRadius: 6,
                background: C.info,
                border: `1px solid ${C.infoBorder}`,
                color: C.infoText,
                padding: "10px 14px",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontSize: 13,
                lineHeight: 1.45,
            }}
        >
            {/* Info "i" icon */}
            <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ flex: "0 0 auto", marginTop: 2 }}
            >
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                <path
                    d="M8 7.5v4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                />
                <circle cx="8" cy="5.25" r="0.75" fill="currentColor" />
            </svg>
            <span>{children}</span>
        </div>
    );
}

// ─── Formula strip ────────────────────────────────────────────────────────────

function FormulaStrip({ variant = "plantbed" }: { variant?: "plantbed" | "hedge" }) {
    return (
        <div
            style={{
                background: C.greenLight,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                fontSize: 13,
                color: C.green,
                fontWeight: 600,
                lineHeight: 1.3,
            }}
        >
            {variant === "hedge" ? (
                <>
                    <span>Strekkende&nbsp;meter</span>
                    <span style={{ opacity: 0.5 }}>×</span>
                    <span>breedte</span>
                    <span style={{ opacity: 0.5 }}>×</span>
                    <span>planten&nbsp;per&nbsp;m²</span>
                    <span style={{ opacity: 0.5 }}>=</span>
                    <span style={{ color: C.orange, fontWeight: 700 }}>adviesaantal</span>
                </>
            ) : (
                <>
                    <span>Oppervlakte</span>
                    <span style={{ opacity: 0.5 }}>×</span>
                    <span>verdeling&nbsp;%</span>
                    <span style={{ opacity: 0.5 }}>×</span>
                    <span>planten&nbsp;per&nbsp;m²</span>
                    <span style={{ opacity: 0.5 }}>=</span>
                    <span style={{ color: C.orange, fontWeight: 700 }}>adviesaantal</span>
                </>
            )}
        </div>
    );
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({ label, value }: { label: string; value: string }) {
    return (
        <div
            style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "8px 10px",
            }}
        >
            <div style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>{label}</div>
            <div
                style={{
                    marginTop: 3,
                    fontSize: 15,
                    fontWeight: 700,
                    color: C.text,
                    lineHeight: 1.1,
                }}
            >
                {value}
            </div>
        </div>
    );
}

// ─── Compact row (per vak) ────────────────────────────────────────────────────

function CompactRow({
    entry,
    isFirst,
}: {
    entry: VakAdviceEntry;
    isFirst: boolean;
}) {
    const isTreebed = entry.vakType === "treebed";
    const isHedge = entry.vakType === "hedge";
    const vakTypeLabel =
        entry.vakType === "treebed"
            ? "Boomvak"
            : entry.vakType === "hedge"
            ? "Haagvak"
            : "Plantvak";

    // Hedge-specific derived values
    const hasHedgeWidth =
        isHedge &&
        entry.hedgeLength != null &&
        entry.hedgeWidth != null &&
        entry.hedgeWidth > 0;
    const hedgeArea = hasHedgeWidth ? entry.hedgeLength! * entry.hedgeWidth! : null;

    const formulaLineStyle = {
        marginTop: 12,
        paddingTop: 10,
        borderTop: `1px dashed ${C.border}`,
        display: "flex",
        alignItems: "center" as const,
        gap: 8,
        flexWrap: "wrap" as const,
        fontSize: 12,
        color: C.mutedDark,
        fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
    };

    return (
        <div
            style={{
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "14px 16px",
                marginTop: isFirst ? 0 : 10,
                background: "#FFFFFF",
            }}
        >
            {/* Header: chip + label + advice count */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: isTreebed ? 0 : 12,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <VakChip entry={entry} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                        {vakTypeLabel} {entry.label}
                    </span>
                </div>
                <div
                    style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: C.orange,
                        whiteSpace: "nowrap",
                    }}
                >
                    {entry.advice} st.
                </div>
            </div>

            {isTreebed ? (
                /* Treebeds don't use an area formula */
                <div
                    style={{ marginTop: 6, fontSize: 13, color: C.mutedDark, lineHeight: 1.5 }}
                >
                    Voor bomen geldt een vast aantal per boomvak en heeft dus geen
                    oppervlakteberekening nodig.
                </div>
            ) : isHedge ? (
                /* Hedges: length × width → area → advice */
                hasHedgeWidth ? (
                    <>
                        {/* Stats: haaglengte, haagbreedte, oppervlakte, dichtheid */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                                gap: 10,
                            }}
                        >
                            <StatCell
                                label="Haaglengte"
                                value={`${fmt(entry.hedgeLength!)} m`}
                            />
                            <StatCell
                                label="Haagbreedte"
                                value={`${fmt(entry.hedgeWidth!)} m`}
                            />
                            <StatCell
                                label="Oppervlakte"
                                value={`${fmt(hedgeArea!)} m²`}
                            />
                            <StatCell
                                label="Dichtheid"
                                value={entry.density != null ? `${entry.density}/m²` : "–"}
                            />
                        </div>

                        {/* Formula: length × width = area → area × density = advice */}
                        {entry.density != null && (
                            <div style={formulaLineStyle}>
                                <span>
                                    {fmt(entry.hedgeLength!)} m × {fmt(entry.hedgeWidth!)} m&nbsp;={" "}
                                    <span style={{ color: C.text, fontWeight: 700 }}>
                                        {fmt(hedgeArea!)} m²
                                    </span>
                                </span>
                                <span style={{ color: C.muted }}>→</span>
                                <span>
                                    {fmt(hedgeArea!)} m² × {entry.density}/m²&nbsp;={" "}
                                    <span style={{ color: C.text, fontWeight: 700 }}>
                                        {fmt(hedgeArea! * entry.density)}
                                    </span>
                                </span>
                                <span style={{ color: C.muted }}>→ afgerond naar boven</span>
                                <span style={{ color: C.orange, fontWeight: 700 }}>
                                    {entry.advice} planten
                                </span>
                            </div>
                        )}
                    </>
                ) : (
                    /* Hedge fallback when width can't be estimated — area-based */
                    <>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                                gap: 10,
                            }}
                        >
                            <StatCell
                                label="Oppervlakte"
                                value={`${fmt(entry.totalArea)} m²`}
                            />
                            <StatCell
                                label="Verdeling"
                                value={`${fmt(entry.distribution, 0)}%`}
                            />
                            <StatCell
                                label="Toegewezen"
                                value={`${fmt(entry.assignedArea)} m²`}
                            />
                            <StatCell
                                label="Dichtheid"
                                value={entry.density != null ? `${entry.density}/m²` : "–"}
                            />
                        </div>
                        {entry.rawAdvice != null && entry.density != null && (
                            <div style={formulaLineStyle}>
                                <span>
                                    {fmt(entry.assignedArea)} m² × {entry.density}/m²&nbsp;={" "}
                                    <span style={{ color: C.text, fontWeight: 700 }}>
                                        {fmt(entry.rawAdvice)}
                                    </span>
                                </span>
                                <span style={{ color: C.muted }}>→ afgerond naar boven</span>
                                <span style={{ color: C.orange, fontWeight: 700 }}>
                                    {entry.advice} planten
                                </span>
                            </div>
                        )}
                    </>
                )
            ) : (
                /* Plantbeds: area × verdeling × dichtheid */
                <>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                            gap: 10,
                        }}
                    >
                        <StatCell
                            label="Oppervlakte"
                            value={`${fmt(entry.totalArea)} m²`}
                        />
                        <StatCell
                            label="Verdeling"
                            value={`${fmt(entry.distribution, 0)}%`}
                        />
                        <StatCell
                            label="Toegewezen"
                            value={`${fmt(entry.assignedArea)} m²`}
                        />
                        <StatCell
                            label="Dichtheid"
                            value={entry.density != null ? `${entry.density}/m²` : "–"}
                        />
                    </div>

                    {entry.rawAdvice != null && entry.density != null && (
                        <div style={formulaLineStyle}>
                            <span>
                                {fmt(entry.assignedArea)} m² × {entry.density}/m²&nbsp;={" "}
                                <span style={{ color: C.text, fontWeight: 700 }}>
                                    {fmt(entry.rawAdvice)}
                                </span>
                            </span>
                            <span style={{ color: C.muted }}>→ afgerond naar boven</span>
                            <span style={{ color: C.orange, fontWeight: 700 }}>
                                {entry.advice} planten
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Multi-vak total strip ────────────────────────────────────────────────────

function MultiVakTotal({
    vakken,
    totalAdvice,
}: {
    vakken: VakAdviceEntry[];
    totalAdvice: number;
}) {
    return (
        <div
            style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: C.greenLightSoft,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                gap: 16,
            }}
        >
            <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    Som van alle plantvakken
                </div>
                <div
                    style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: C.mutedDark,
                        fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
                    }}
                >
                    {vakken.map((v) => v.advice).join(" + ")} = {totalAdvice}
                </div>
            </div>
            <div
                style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: C.orange,
                    whiteSpace: "nowrap",
                }}
            >
                {totalAdvice} stuks
            </div>
        </div>
    );
}

// ─── Compact breakdown popup (Variant 1) ─────────────────────────────────────

function PopupCompact({
    plant,
    onClose,
}: {
    plant: PlantAdviceInfo;
    onClose: () => void;
}) {
    const totalAdvice = plant.vakken.reduce((s, v) => s + v.advice, 0);
    const isMulti = plant.vakken.length > 1;
    const formulaVariant = plant.vakken.every((v) => v.vakType === "hedge") ? "hedge" : "plantbed";

    return (
        <>
            <CloseButton onClose={onClose} />
            <ModalHeader plant={plant} />

            <ScrollableBody>
                <FormulaStrip variant={formulaVariant} />

                <div style={{ marginTop: 14 }}>
                    {plant.vakken.map((entry, i) => (
                        <CompactRow key={entry.objectId} entry={entry} isFirst={i === 0} />
                    ))}
                </div>

                {isMulti && (
                    <MultiVakTotal vakken={plant.vakken} totalAdvice={totalAdvice} />
                )}

                <div style={{ marginTop: 14 }}>
                    <InfoBanner>
                        Dit is een advies. Je kunt het aantal in de plantenlijst zelf
                        aanpassen.
                    </InfoBanner>
                </div>
            </ScrollableBody>

            <ModalFooter>
                <PrimaryButton onClick={onClose}>Sluiten</PrimaryButton>
            </ModalFooter>
        </>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────

type Props = {
    open: boolean;
    onClose: () => void;
    plant: PlantAdviceInfo | null;
};

export default function FinalisatieAdviceCalculation({ open, onClose, plant }: Props) {
    return (
        <ModalShell open={open} onClose={onClose}>
            {plant && <PopupCompact plant={plant} onClose={onClose} />}
        </ModalShell>
    );
}
