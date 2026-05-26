import React, { useEffect, useRef, useState, useMemo } from "react";
import { ObjectType } from "@/state/projectStore";
import { OBJECT_LIBRARY } from "@/features/editor/components/editor/objectMenuConfig";

// ─── Math helpers ──────────────────────────────────────────────────────────
type Pt = { x: number; y: number };

function lerp(a: Pt, b: Pt, t: number): Pt {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function easeInOut(t: number) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function easeOut(t: number) {
    return 1 - Math.pow(1 - t, 3);
}

// ─── Pattern key derived from object type ───────────────────────────────────
function getPatternKey(type: ObjectType): "building" | "tiles" | "water" | "dots" | "wood" | null {
    const def = OBJECT_LIBRARY[type] as { isBuilding?: boolean };
    if (def?.isBuilding) return "building";
    switch (type) {
        case "tiles":        return "tiles";
        case "water":        return "water";
        case "gravel":
        case "sand":         return "dots";
        case "wood":
        case "patio":        return "wood";
        default:             return null;
    }
}

// ─── Instruction text shown in the preview popover ──────────────────────────
export function getPreviewInstructionText(type: ObjectType): string {
    const def = OBJECT_LIBRARY[type] as { geometry: string };
    if (type === "treebed") {
        return "Klik om het begin- en eindpunt te zetten en de grootte van je boom te bepalen.";
    }
    if (def?.geometry === "polyline") {
        return "Klik om het begin- en eindpunt te zetten, dubbelklik om de lijn af te sluiten.";
    }
    return "Klik om hoekpunten te zetten, klik op het beginpunt om het vlak af te sluiten.";
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const DA_ACCENT = "#E94E1B";

function CursorMark({ x, y, clicking }: { x: number; y: number; clicking: number }) {
    return (
        <g transform={`translate(${x},${y})`}>
            {clicking > 0 && (
                <circle r={2 + clicking * 10} fill="none" stroke={DA_ACCENT} strokeWidth="1.5" opacity={1 - clicking} />
            )}
            <g transform="translate(-1.5,-1.5)">
                <path
                    d="M0 0 L0 13 L3.4 10 L5.6 14.4 L7.6 13.5 L5.4 9.2 L9.6 9.2 Z"
                    fill="#FFFFFF"
                    stroke="#1F1F1F"
                    strokeWidth="1.1"
                    strokeLinejoin="round"
                />
            </g>
        </g>
    );
}

function LengthPill({ from, to }: { from: Pt; to: Pt }) {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.hypot(dx, dy) < 6) return null;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const tx = horizontal ? mx : mx + 14;
    const ty = horizontal ? my - 14 : my;
    const W = 36, H = 16;
    return (
        <g style={{ pointerEvents: "none" }}>
            <rect x={tx - W / 2} y={ty - H / 2} width={W} height={H} rx={H / 2} fill={DA_ACCENT} />
            <text
                x={tx} y={ty + 3.5}
                fill="#FFFFFF" fontSize="10" fontWeight="700"
                textAnchor="middle"
                fontFamily="'DM Sans', system-ui, sans-serif"
            >
                1,0 m
            </text>
        </g>
    );
}

function CornerDot({ x, y, hollow, pulse }: { x: number; y: number; hollow?: boolean; pulse?: number }) {
    return (
        <g style={{ pointerEvents: "none" }}>
            {pulse != null && pulse > 0 && (
                <circle cx={x} cy={y} r={3 + pulse * 6} fill={DA_ACCENT} opacity={0.25 * (1 - pulse)} />
            )}
            <circle cx={x} cy={y} r="3.5" fill={hollow ? "#FFFFFF" : DA_ACCENT} stroke={DA_ACCENT} strokeWidth="1.8" />
        </g>
    );
}

// ─── Phase definition ────────────────────────────────────────────────────────
type Phase = {
    d: number;
    kind: "move" | "click" | "hold";
    from?: Pt;
    to?: Pt;
    at?: Pt;
    drawingFrom?: Pt;
    placeIdx?: number;
    segIdx?: number;
    segFrom?: Pt;
    segTo?: Pt;
    finalize?: boolean;
    closing?: boolean;
};

function buildPhases(
    isTreebed: boolean,
    isLine: boolean,
    W: number,
    H: number,
): { phases: Phase[]; cycle: number } {
    const cx = W / 2, cy = H / 2;
    const half = Math.min(W, H) * 0.22;
    const G = 18;
    // Snap the CENTRE to the nearest grid intersection, then step out by an
    // integer number of grid cells — this guarantees width === height (square polygon).
    const origX   = Math.round(cx / G) * G;
    const origY   = Math.round(cy / G) * G;
    const hCells  = Math.max(1, Math.round(half / G));
    const tbCells = Math.max(1, Math.round(half * 0.8 / G));
    const rest: Pt = { x: Math.round(W * 0.12 / G) * G, y: Math.round(H * 0.88 / G) * G };

    if (isTreebed) {
        const A: Pt = { x: origX - tbCells * G, y: origY - tbCells * G };
        const B: Pt = { x: origX + tbCells * G, y: origY + tbCells * G };
        const phases: Phase[] = [
            { d: 600,  kind: "move",  from: rest, to: A },
            { d: 220,  kind: "click", at: A, placeIdx: 0 },
            { d: 1200, kind: "move",  from: A, to: B },
            { d: 280,  kind: "click", at: B, placeIdx: 1, finalize: true },
            { d: 2200, kind: "hold" },
        ];
        return { phases, cycle: 4500 };
    }

    if (isLine) {
        const A: Pt = { x: origX - hCells * G, y: origY };
        const B: Pt = { x: origX + hCells * G, y: origY };
        const phases: Phase[] = [
            { d: 700,  kind: "move",  from: rest, to: A },
            { d: 220,  kind: "click", at: A, placeIdx: 0 },
            { d: 1100, kind: "move",  from: A, to: B, drawingFrom: A },
            { d: 280,  kind: "click", at: B, placeIdx: 1, segIdx: 0, segFrom: A, segTo: B, finalize: true },
            { d: 2700, kind: "hold" },
        ];
        return { phases, cycle: 5000 };
    }

    // Polygon — use origX/origY ± hCells*G so width === height (square)
    const TL: Pt = { x: origX - hCells * G, y: origY - hCells * G };
    const TR: Pt = { x: origX + hCells * G, y: origY - hCells * G };
    const BR: Pt = { x: origX + hCells * G, y: origY + hCells * G };
    const BL: Pt = { x: origX - hCells * G, y: origY + hCells * G };
    const phases: Phase[] = [
        { d: 520,  kind: "move",  from: rest, to: TL },
        { d: 220,  kind: "click", at: TL, placeIdx: 0 },
        { d: 620,  kind: "move",  from: TL, to: TR, drawingFrom: TL },
        { d: 220,  kind: "click", at: TR, placeIdx: 1, segIdx: 0, segFrom: TL, segTo: TR },
        { d: 620,  kind: "move",  from: TR, to: BR, drawingFrom: TR },
        { d: 220,  kind: "click", at: BR, placeIdx: 2, segIdx: 1, segFrom: TR, segTo: BR },
        { d: 620,  kind: "move",  from: BR, to: BL, drawingFrom: BR },
        { d: 220,  kind: "click", at: BL, placeIdx: 3, segIdx: 2, segFrom: BR, segTo: BL },
        { d: 620,  kind: "move",  from: BL, to: TL, drawingFrom: BL, closing: true },
        { d: 280,  kind: "click", at: TL, segIdx: 3, segFrom: BL, segTo: TL, finalize: true },
        { d: 1840, kind: "hold" },
    ];
    const cycle = phases.reduce((s, p) => s + p.d, 0);
    return { phases, cycle };
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function DrawAnimationPreview({
    type,
    width = 220,
    height = 140,
}: {
    type: ObjectType;
    width?: number;
    height?: number;
}) {
    const def = OBJECT_LIBRARY[type] as { geometry: string; fill: string; stroke: string; isBuilding?: boolean };
    const isLine     = def.geometry === "polyline";
    const isTreebed  = type === "treebed";
    const patternKey = getPatternKey(type);
    const fillColor  = def.fill;
    const strokeColor = def.stroke;

    const W = width, H = height;
    const cx = W / 2, cy = H / 2;
    const half = Math.min(W, H) * 0.22;

    const { phases, cycle } = useMemo(
        () => buildPhases(isTreebed, isLine, W, H),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [type, W, H]
    );

    const [tick, setTick] = useState(0);
    const rafRef   = useRef<number | null>(null);
    const startRef = useRef<number | null>(null);

    useEffect(() => {
        startRef.current = null;
        const loop = (now: number) => {
            if (startRef.current === null) startRef.current = now;
            setTick((now - startRef.current) % cycle);
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [type, cycle]);

    // ─── Compute visual state from tick ────────────────────────────────────
    let acc = 0;
    let cursor: Pt = phases[0].from ?? { x: 0, y: 0 };
    const placed: Array<{ x: number; y: number; pulse: number } | null> = [];
    const solidSegs: Array<{ from: Pt; to: Pt } | null> = [];
    let dashed: { from: Pt; to: Pt } | null = null;
    let clicking = 0;
    let finalized = false;
    let timeIntoHold = 0;

    for (const p of phases) {
        const phaseEnd  = acc + p.d;
        const fullyPast = tick >= phaseEnd;
        const inPhase   = tick >= acc && tick < phaseEnd;
        const localT    = inPhase ? (tick - acc) / p.d : 1;

        if (p.kind === "move") {
            const pos = fullyPast ? p.to! : inPhase ? lerp(p.from!, p.to!, easeInOut(localT)) : null;
            if (pos) cursor = pos;
            if (inPhase && p.drawingFrom) dashed = { from: p.drawingFrom, to: cursor };
        } else if (p.kind === "click") {
            if (fullyPast || inPhase) {
                cursor = p.at!;
                if (p.placeIdx != null) {
                    placed[p.placeIdx] = { x: p.at!.x, y: p.at!.y, pulse: inPhase ? Math.max(0, 1 - localT * 1.5) : 0 };
                }
                if (p.segIdx != null) {
                    if (fullyPast) {
                        solidSegs[p.segIdx] = { from: p.segFrom!, to: p.segTo! };
                    } else if (inPhase) {
                        const k = easeOut(Math.min(1, localT * 2));
                        solidSegs[p.segIdx] = { from: p.segFrom!, to: lerp(p.segFrom!, p.segTo!, k) };
                    }
                }
                if (inPhase) clicking = Math.max(0, 1 - localT * 1.6);
                if (p.finalize && (fullyPast || (inPhase && localT > 0.5))) finalized = true;
            }
        } else if (p.kind === "hold") {
            if (inPhase) { timeIntoHold = tick - acc; finalized = true; }
            if (fullyPast) finalized = true;
        }
        acc = phaseEnd;
    }

    const fillProgress = finalized ? Math.min(1, (timeIntoHold || 250) / 250) : 0;

    // Snap render-time coordinates using the same centre-snap + integer-cell approach as buildPhases,
    // so the rendered polygon/circle exactly matches the animation corner points.
    const G_SN      = 18;
    const origX_R   = Math.round(cx / G_SN) * G_SN;
    const origY_R   = Math.round(cy / G_SN) * G_SN;
    const hCells_R  = Math.max(1, Math.round(half / G_SN));
    const tbCells_R = Math.max(1, Math.round((half * 0.8) / G_SN));

    const polyPoints = !isLine && !isTreebed
        ? `${origX_R - hCells_R * G_SN},${origY_R - hCells_R * G_SN} ${origX_R + hCells_R * G_SN},${origY_R - hCells_R * G_SN} ${origX_R + hCells_R * G_SN},${origY_R + hCells_R * G_SN} ${origX_R - hCells_R * G_SN},${origY_R + hCells_R * G_SN}`
        : null;
    const patId        = `da-pat-${type}-${W}`;
    const DA_GRID_LINE = "#E3E0D8";
    const DA_AXIS      = "#58694C";

    // Treebed sizes — snapped so finalized circle matches the animation path
    const TB_A: Pt = { x: origX_R - tbCells_R * G_SN, y: origY_R - tbCells_R * G_SN };
    const TB_B: Pt = { x: origX_R + tbCells_R * G_SN, y: origY_R + tbCells_R * G_SN };
    const tbMidX = (TB_A.x + TB_B.x) / 2;
    const tbMidY = (TB_A.y + TB_B.y) / 2;
    const tbR    = Math.hypot(TB_B.x - TB_A.x, TB_B.y - TB_A.y) * 0.45;

    // Polygon centre (for area label and parking icon)
    const polyCx = origX_R;
    const polyCy = origY_R;

    // Growing treebed circle during drag (after first click, before finalize)
    const pt0 = placed[0];
    let tbGrowing: { cx: number; cy: number; r: number } | null = null;
    if (isTreebed && pt0 != null && !finalized) {
        const dist = Math.hypot(cursor.x - pt0.x, cursor.y - pt0.y);
        if (dist >= 2) {
            tbGrowing = {
                cx: (pt0.x + cursor.x) / 2,
                cy: (pt0.y + cursor.y) / 2,
                r: dist * 0.45,
            };
        }
    }

    return (
        <svg
            width="100%"
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            style={{ display: "block", borderRadius: 4, background: "#F5F4EF" }}
        >
            <defs>
                <pattern id={`grid-${type}-${W}`} width={18} height={18} patternUnits="userSpaceOnUse">
                    <path d={`M18 0H0V18`} fill="none" stroke={DA_GRID_LINE} strokeWidth="1" />
                </pattern>
                {patternKey === "building" && (
                    <pattern id={patId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="5" height="5" fill={fillColor} />
                        <line x1="0" y1="0" x2="0" y2="5" stroke={strokeColor} strokeWidth="1.4" />
                    </pattern>
                )}
                {patternKey === "tiles" && (
                    <pattern id={patId} width="8" height="8" patternUnits="userSpaceOnUse">
                        <rect width="8" height="8" fill={fillColor} />
                        <path d="M0 0 H8 M0 0 V8" stroke={strokeColor} strokeWidth="0.6" opacity="0.6" />
                    </pattern>
                )}
                {patternKey === "water" && (
                    <pattern id={patId} width="10" height="6" patternUnits="userSpaceOnUse">
                        <rect width="10" height="6" fill={fillColor} />
                        <path d="M0 3 Q 2.5 0, 5 3 T 10 3" stroke={strokeColor} strokeWidth="0.6" fill="none" opacity="0.7" />
                    </pattern>
                )}
                {patternKey === "dots" && (
                    <pattern id={patId} width="5" height="5" patternUnits="userSpaceOnUse">
                        <rect width="5" height="5" fill={fillColor} />
                        <circle cx="2.5" cy="2.5" r="0.8" fill={strokeColor} opacity="0.7" />
                    </pattern>
                )}
                {patternKey === "wood" && (
                    <pattern id={patId} width="12" height="3" patternUnits="userSpaceOnUse">
                        <rect width="12" height="3" fill={fillColor} />
                        <line x1="0" y1="0" x2="12" y2="0" stroke={strokeColor} strokeWidth="0.5" opacity="0.5" />
                    </pattern>
                )}
            </defs>

            {/* Grid background */}
            <rect width={W} height={H} fill={`url(#grid-${type}-${W})`} />

            {/* Axis crosshair — under drawn content, over bare grid */}
            <line x1="0" y1={cursor.y} x2={W} y2={cursor.y} stroke={DA_AXIS} strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
            <line x1={cursor.x} y1="0" x2={cursor.x} y2={H} stroke={DA_AXIS} strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />

            {/* Filled area when finalized */}
            {!isLine && !isTreebed && polyPoints && fillProgress > 0 && (
                <polygon
                    points={polyPoints}
                    fill={patternKey ? `url(#${patId})` : fillColor}
                    stroke={strokeColor}
                    strokeWidth="1.8"
                    opacity={fillProgress}
                />
            )}

            {/* Treebed: growing circle during drag */}
            {tbGrowing && (
                <g opacity="0.8">
                    <circle cx={tbGrowing.cx} cy={tbGrowing.cy} r={tbGrowing.r} fill="#95CE86" stroke="#56793E" strokeWidth="1.5" />
                    <circle cx={tbGrowing.cx} cy={tbGrowing.cy} r={Math.max(2, tbGrowing.r * 0.14)} fill="#7A4B2A" stroke="#5C3519" strokeWidth="0.8" />
                </g>
            )}

            {/* Treebed: boomkroon that pops in after finalize */}
            {isTreebed && fillProgress > 0 && (
                <g opacity={fillProgress}>
                    <circle cx={tbMidX} cy={tbMidY} r={tbR} fill="#95CE86" stroke="#56793E" strokeWidth="1.5" />
                    {/* Brown trunk in the centre, matching real canvas */}
                    <circle cx={tbMidX} cy={tbMidY} r={tbR * 0.14} fill="#7A4B2A" stroke="#5C3519" strokeWidth="0.8" />
                </g>
            )}

            {/* Solid edges while drawing */}
            {!finalized && solidSegs.map((seg, i) =>
                seg ? (
                    <line key={i}
                        x1={seg.from.x} y1={seg.from.y} x2={seg.to.x} y2={seg.to.y}
                        stroke={DA_ACCENT} strokeWidth="2" strokeLinecap="round"
                    />
                ) : null
            )}

            {/* Dashed preview line tracking cursor */}
            {dashed && !finalized && (
                <>
                    <line
                        x1={dashed.from.x} y1={dashed.from.y} x2={dashed.to.x} y2={dashed.to.y}
                        stroke={DA_ACCENT} strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" opacity="0.9"
                    />
                    <LengthPill from={dashed.from} to={dashed.to} />
                </>
            )}

            {/* Final line for line-types */}
            {isLine && finalized && solidSegs[0] && (
                <line
                    x1={solidSegs[0].from.x} y1={solidSegs[0].from.y}
                    x2={solidSegs[0].to.x}  y2={solidSegs[0].to.y}
                    stroke={strokeColor} strokeWidth="3" strokeLinecap="round" opacity={fillProgress}
                />
            )}

            {/* Parking icon — park.svg centred in the polygon */}
            {type === "parking" && fillProgress > 0 && (
                <g opacity={fillProgress}>
                    <image
                        href="/icons/park.svg"
                        x={polyCx - 16}
                        y={polyCy - 22}
                        width={32}
                        height={32}
                        preserveAspectRatio="xMidYMid meet"
                    />
                    <text
                        x={polyCx} y={polyCy + 16}
                        fill={strokeColor} fontSize="10" fontWeight="700"
                        textAnchor="middle"
                        fontFamily="'DM Sans', system-ui, sans-serif"
                    >
                        1,00 m²
                    </text>
                </g>
            )}

            {/* Area label for all non-parking polygon types */}
            {!isLine && !isTreebed && type !== "parking" && fillProgress > 0.4 && (
                <text
                    x={polyCx} y={polyCy + 3.5}
                    fill={strokeColor} fontSize="11" fontWeight="700"
                    textAnchor="middle"
                    opacity={(fillProgress - 0.4) / 0.6}
                    fontFamily="'DM Sans', system-ui, sans-serif"
                >
                    1,00 m²
                </text>
            )}

            {/* Corner dots while drawing */}
            {!finalized && placed.map((pt, i) =>
                pt ? (
                    <CornerDot
                        key={i}
                        x={pt.x} y={pt.y}
                        hollow={i < placed.filter(Boolean).length - 1}
                        pulse={pt.pulse}
                    />
                ) : null
            )}

            {/* Cursor */}
            {(!finalized || timeIntoHold < 300) && (
                <CursorMark x={cursor.x} y={cursor.y} clicking={clicking} />
            )}
        </svg>
    );
}
