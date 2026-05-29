"use client";

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useProjectStore, OBJECT_STYLES } from "@/state/projectStore";
import {
    usePlantSelectionStore,
    type PlantListItem,
} from "@/features/editor/state/plantSelectionStore";
import { useRightStepMenuStore } from "@/features/editor/state/rightStepMenuStore";
import { buildAdviceData, type ProjectPlantLike } from "@/features/editor/lib/plantAdvice";
import {
    OBJECT_LIBRARY,
    getObjectMenuSections,
    isBuildingObjectType,
    isBoundaryObjectType,
    type ObjectType,
} from "@/features/editor/components/editor/objectMenuConfig";
import TreebedVariantSwatch from "@/features/editor/components/TreebedVariantSwatch";
import type { PolyObject } from "@/state/projectStore";
import { getObjectAreaInSquareMeters, formatSquareMeters } from "@/state/areaMetrics";
import { EDITOR_GRID_SIZE } from "@/features/editor/constants/editorGeometry";
import { getBoundaryBandShapeForObject } from "@/features/editor/lib/boundarySystem";

// ─── Design tokens ────────────────────────────────────────────────────────────

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    borderSoft: "#E0DEDF",
    green: "#58694C",
    greenLight: "#EEF0ED",
    orange: "#E94E1B",
    orangeLight: "#FFF7F4",
    text: "#111111",
    softText: "#6B6B6B",
    muted: "#9CA3AF",
    canvasBg: "#F5F4F2",
    gridDot: "#D5D2CE",
    treebedFill: "rgba(0,128,0,0.35)",
    treebedStroke: "#476D3C",
    treebedTrunk: "#8B5E3C",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

type Transform = { panX: number; panY: number; zoom: number };
type BBox = { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number };

// ─── Pure-math helpers ────────────────────────────────────────────────────────

function pointsToSvgString(pts: number[]): string {
    const pairs: string[] = [];
    for (let i = 0; i + 1 < pts.length; i += 2) pairs.push(`${pts[i]},${pts[i + 1]}`);
    return pairs.join(" ");
}

function makePathD(pts: number[], holes?: number[][]): string {
    if (pts.length < 6) return "";
    const outer: string[] = [];
    for (let i = 0; i + 1 < pts.length; i += 2) outer.push(`${pts[i]},${pts[i + 1]}`);
    let d = `M ${outer.join(" L ")} Z`;
    if (holes) {
        for (const hole of holes) {
            if (hole.length < 6) continue;
            const hp: string[] = [];
            for (let i = 0; i + 1 < hole.length; i += 2) hp.push(`${hole[i]},${hole[i + 1]}`);
            d += ` M ${hp.join(" L ")} Z`;
        }
    }
    return d;
}

function getBoundingBox(objects: PolyObject[]): BBox | null {
    if (!objects.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of objects) {
        for (let i = 0; i + 1 < obj.points.length; i += 2) {
            if (obj.points[i] < minX) minX = obj.points[i];
            if (obj.points[i] > maxX) maxX = obj.points[i];
            if (obj.points[i + 1] < minY) minY = obj.points[i + 1];
            if (obj.points[i + 1] > maxY) maxY = obj.points[i + 1];
        }
        for (const hole of obj.holes ?? []) {
            for (let i = 0; i + 1 < hole.length; i += 2) {
                if (hole[i] < minX) minX = hole[i];
                if (hole[i] > maxX) maxX = hole[i];
                if (hole[i + 1] < minY) minY = hole[i + 1];
                if (hole[i + 1] > maxY) maxY = hole[i + 1];
            }
        }
    }
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function computeFit(bbox: BBox, cw: number, ch: number, padding = 52): Transform {
    if (bbox.w <= 0 || bbox.h <= 0) return { panX: cw / 2, panY: ch / 2, zoom: 1 };
    const zoom = Math.min((cw - padding * 2) / bbox.w, (ch - padding * 2) / bbox.h, 8);
    return {
        zoom,
        panX: cw / 2 - (bbox.minX + bbox.w / 2) * zoom,
        panY: ch / 2 - (bbox.minY + bbox.h / 2) * zoom,
    };
}

function getPolyLabel(obj: PolyObject, objects: PolyObject[]): string {
    if (!["plantbed", "hedge", "treebed"].includes(obj.type)) return "";
    const sameType = objects.filter((o) => o.type === obj.type);
    const idx = sameType.findIndex((o) => o.id === obj.id);
    const n =
        obj.type === "plantbed" && typeof obj.plantbedNo === "number"
            ? obj.plantbedNo
            : idx + 1;
    if (obj.type === "hedge") return `H${n}`;
    if (obj.type === "treebed") return `B${n}`;
    return `P${n}`;
}

function getCentroid(pts: number[]): { x: number; y: number } {
    let sx = 0, sy = 0;
    const n = pts.length / 2;
    for (let i = 0; i + 1 < pts.length; i += 2) { sx += pts[i]; sy += pts[i + 1]; }
    return { x: sx / n, y: sy / n };
}

// Match editor's contrast-aware label colour for plantbed fills (ported from BaseFillLayer.tsx)
function getReadablePlantbedLabelColor(fillColor: string): string {
    const hex = fillColor.trim().replace("#", "");
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return "#3F6B3F";
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const darken = (v: number) => Math.max(0, Math.round(v * 0.55));
    const lighten = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.55));
    if (hex.toUpperCase() === "F2FDEF") return "#3F6B3F";
    const rr = luminance > 0.62 ? darken(r) : lighten(r);
    const gg = luminance > 0.62 ? darken(g) : lighten(g);
    const bb = luminance > 0.62 ? darken(b) : lighten(b);
    const toHex = (v: number) => v.toString(16).padStart(2, "0").toUpperCase();
    return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

// Minimum bounding dimension for proportional font sizing (mirrors treebed's r-based approach)
function getPolyMinDim(pts: number[]): number {
    if (pts.length < 4) return 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i + 1 < pts.length; i += 2) {
        if (pts[i] < minX) minX = pts[i];
        if (pts[i] > maxX) maxX = pts[i];
        if (pts[i + 1] < minY) minY = pts[i + 1];
        if (pts[i + 1] > maxY) maxY = pts[i + 1];
    }
    return Math.min(maxX - minX, maxY - minY);
}

// Bumpy/organic circle SVG path — matches the treebed outline rendered in the editor
function getBumpyCirclePath(cx: number, cy: number, r: number, steps = 48): string {
    const pts: string[] = [];
    for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const angle = t * Math.PI * 2;
        const bump = r * (
            1 +
            0.055 * Math.sin(t * 6.5 * Math.PI * 2 + 0.7) +
            0.02 * Math.sin(t * 11 * Math.PI * 2 + 1.3)
        );
        pts.push(`${cx + Math.cos(angle) * bump},${cy + Math.sin(angle) * bump}`);
    }
    return `M ${pts.join(" L ")} Z`;
}

// Canvas label: plain number only (no P/H/B prefix), matching the editor display
function getCanvasLabel(obj: PolyObject, objects: PolyObject[]): string {
    if (!["plantbed", "hedge", "treebed"].includes(obj.type)) return "";
    const sameType = objects.filter((o) => o.type === obj.type);
    const idx = sameType.findIndex((o) => o.id === obj.id);
    const n =
        obj.type === "plantbed" && typeof obj.plantbedNo === "number"
            ? obj.plantbedNo
            : idx + 1;
    return String(n);
}

// Simplified treebed visual geometry (no Konva dependency)
function getTreebedSvgVisual(obj: PolyObject) {
    const pts = obj.points;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i + 1 < pts.length; i += 2) {
        if (pts[i] < minX) minX = pts[i];
        if (pts[i] > maxX) maxX = pts[i];
        if (pts[i + 1] < minY) minY = pts[i + 1];
        if (pts[i + 1] > maxY) maxY = pts[i + 1];
    }
    const w = maxX - minX, h = maxY - minY;
    const cx = minX + w / 2, cy = minY + h / 2;
    const variant = obj.treebedVariant ?? "standard";

    if (variant === "espalier") {
        return { shape: "rect" as const, cx, cy, w, h, trunkR: Math.max(6, Math.min(w, h) * 0.22) };
    }
    if (variant === "roof") {
        const size = Math.min(w, h);
        return { shape: "rect" as const, cx, cy, w: size, h: size, trunkR: Math.max(6, size * 0.05) };
    }
    const r = Math.min(w, h) / 2;
    return {
        shape: "circle" as const,
        cx, cy, r,
        trunkR: Math.max(6, r * 0.09),
        isMultiStem: variant === "multi_stem",
    };
}

// ─── Building diagonal-line gradient (matches left object menu) ───────────────

function buildingBgImage(stroke: string): string {
    return `linear-gradient(135deg,transparent 0%,transparent 35%,${stroke} 35%,${stroke} 40%,transparent 40%,transparent 60%,${stroke} 60%,${stroke} 65%,transparent 65%,transparent 100%)`;
}

// ─── Swatch ──────────────────────────────────────────────────────────────────

function ObjectSwatch({ type, size = 12 }: { type: ObjectType; size?: number }) {
    const isTreebed = type === "treebed";
    const isBuilding = isBuildingObjectType(type);
    const styles = OBJECT_STYLES[type];

    if (isTreebed) {
        return <TreebedVariantSwatch variant="standard" size={size} />;
    }

    return (
        <span
            style={{
                display: "inline-block",
                width: size,
                height: size,
                borderRadius: 2,
                flexShrink: 0,
                border: `1px solid ${styles.stroke}`,
                backgroundColor: styles.fill,
                backgroundImage: isBuilding ? buildingBgImage(styles.stroke) : undefined,
                backgroundRepeat: "no-repeat",
                backgroundSize: "100% 100%",
                backgroundPosition: "center",
            }}
        />
    );
}

// ─── Vak label style ─────────────────────────────────────────────────────────

function getVakLabelStyle(obj: PolyObject): { bg: string; border: string | null; text: string } {
    if (obj.type === "hedge") {
        return { bg: "#95CE86", border: null, text: "#56793E" };
    }
    if (obj.type === "treebed") {
        return { bg: "#8FC38E", border: "#476D3C", text: "#476D3C" };
    }
    // plantbed – derive from the object's actual fill/stroke so custom colours show up
    const fill = obj.customStyle?.fill ?? OBJECT_STYLES["plantbed"]?.fill ?? "#DCE9DC";
    const stroke = obj.customStyle?.stroke ?? OBJECT_STYLES["plantbed"]?.stroke ?? "#4F6B4F";
    return { bg: fill, border: stroke, text: stroke };
}

type CategoryType = "plantbed" | "hedge" | "treebed";
const CATEGORY_ORDER: CategoryType[] = ["plantbed", "hedge", "treebed"];

function getCategoryLabel(type: CategoryType, uniqueCount: number): string {
    if (type === "plantbed") return uniqueCount === 1 ? "Plantvak" : "Plantvakken";
    if (type === "hedge") return uniqueCount === 1 ? "Haagvak" : "Haagvakken";
    return uniqueCount === 1 ? "Boomvak" : "Boomvakken";
}

// ─── SVG Building pattern (for canvas rendering) ─────────────────────────────

function BuildingPatterns({ types }: { types: ObjectType[] }) {
    return (
        <>
            {types.map((type) => {
                const { fill, stroke } = OBJECT_STYLES[type];
                const id = `fg-bp-${type}`;
                return (
                    <pattern
                        key={type}
                        id={id}
                        width="22"
                        height="22"
                        patternUnits="userSpaceOnUse"
                    >
                        <rect width="22" height="22" fill={fill} />
                        <line x1="-22" y1="22" x2="22" y2="-22" stroke={stroke} strokeWidth="1" />
                        <line x1="0" y1="22" x2="44" y2="-22" stroke={stroke} strokeWidth="1" />
                        <line x1="22" y1="44" x2="66" y2="-22" stroke={stroke} strokeWidth="1" />
                        <line x1="-22" y1="44" x2="22" y2="0" stroke={stroke} strokeWidth="1" />
                    </pattern>
                );
            })}
        </>
    );
}

// ─── ProductRows ─────────────────────────────────────────────────────────────

type ProductRowsProps = {
    plantbedLinks: Record<string, string[]>;
    objects: PolyObject[];
    plants: ProjectPlantLike[];
    plantListItems: PlantListItem[];
    distributionOverrides: Record<string, Record<string, number>>;
    hoveredObjectId: string | null;
    hoveredRowObjectId: string | null;
    onRowHover: (id: string | null) => void;
};

function ProductRows({
    plantbedLinks,
    objects,
    plants,
    plantListItems,
    distributionOverrides,
    hoveredObjectId,
    hoveredRowObjectId,
    onRowHover,
}: ProductRowsProps) {
    type FlatRow = {
        key: string;
        objectId: string;
        object: PolyObject;
        vakLabel: string;
        latinName: string;
        dutchName: string;
        maat: string;
        plantafstand: string;
        aantal: number;
    };

    const rows = useMemo<FlatRow[]>(() => {
        const result: FlatRow[] = [];

        for (const [objectId, linkedIds] of Object.entries(plantbedLinks)) {
            if (!linkedIds?.length) continue;
            const object = objects.find((o) => o.id === objectId);
            if (!object) continue;
            if (!["plantbed", "hedge", "treebed"].includes(object.type)) continue;

            const advice = buildAdviceData({
                selectedObject: object,
                currentType: object.type,
                linkedPlantIds: linkedIds,
                plants,
                distributionOverrides: distributionOverrides[objectId] ?? {},
            });

            const unitLabel = advice.measurementMode === "length" ? "/ m" : "/ m²";
            const vakLabel = getPolyLabel(object, objects);

            for (const r of advice.rows) {
                if (r.adviceCount === null) continue;

                const item = plantListItems.find((li) => li.plant.id === r.plantId);
                const count =
                    item && item.quantity > 0 ? item.quantity : (r.adviceCount ?? 0);

                const plantafstand =
                    r.quantityPerSquareMeter != null
                        ? `${r.quantityPerSquareMeter} ${unitLabel}`
                        : "–";

                result.push({
                    key: `${objectId}:${r.plantId}`,
                    objectId,
                    object,
                    vakLabel: vakLabel || OBJECT_LIBRARY[object.type as ObjectType]?.label || object.type,
                    latinName: item?.plant.botanicalName || r.latinName || r.plantId,
                    dutchName: item?.plant.dutchName || r.dutchName || "–",
                    maat: item?.size || "–",
                    plantafstand,
                    aantal: count,
                });
            }
        }

        return result;
    }, [plantbedLinks, objects, plants, plantListItems, distributionOverrides]);

    const grouped = useMemo(() => {
        const map = new Map<CategoryType, FlatRow[]>();

        for (const row of rows) {
            const type = row.object.type as CategoryType;
            if (!CATEGORY_ORDER.includes(type)) continue;

            if (!map.has(type)) {
                map.set(type, []);
            }

            map.get(type)!.push(row);
        }

        const getVakNumber = (row: FlatRow) => {
            const match = row.vakLabel.match(/\d+/);
            return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
        };

        return CATEGORY_ORDER.filter((t) => map.has(t)).map((t) => {
            const groupRows = map.get(t)!;

            return {
                type: t,
                rows: [...groupRows].sort((a, b) => {
                    const vakNumberDifference = getVakNumber(a) - getVakNumber(b);

                    if (vakNumberDifference !== 0) {
                        return vakNumberDifference;
                    }

                    return a.latinName.localeCompare(b.latinName);
                }),
                uniqueCount: new Set(groupRows.map((r) => r.objectId)).size,
            };
        });
    }, [rows]);

    if (!rows.length) {
        return (
            <p className="py-4 text-[13px]" style={{ color: COLORS.muted }}>
                Nog geen planten gekoppeld aan vakken.
            </p>
        );
    }

    const COL_HEADER = "text-[11px] font-semibold uppercase tracking-wide py-2 pr-3";
    const COL_CELL = "py-2.5 pr-3 text-[13px]";

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 900 }}>
                <colgroup>
                    <col style={{ width: 80 }} />
                    <col style={{ width: 220 }} />
                    <col style={{ width: 160 }} />
                    <col style={{ width: 260 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 30 }} />
                </colgroup>
                <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                        <th className={COL_HEADER} style={{ color: COLORS.text, textAlign: "left" }}>
                            Vak
                        </th>
                        <th className={COL_HEADER} style={{ color: COLORS.text, textAlign: "left" }}>
                            Latijnse naam
                        </th>
                        <th className={COL_HEADER} style={{ color: COLORS.text, textAlign: "left" }}>
                            Nederlandse naam
                        </th>
                        <th className={COL_HEADER} style={{ color: COLORS.text, textAlign: "left" }}>
                            Maatvoering
                        </th>
                        <th className={COL_HEADER} style={{ color: COLORS.text, textAlign: "left", whiteSpace: "nowrap" }}>
                            Planthoeveelheid per m²
                        </th>
                        <th
                            className={COL_HEADER}
                            style={{ color: COLORS.text, textAlign: "right", paddingRight: 0 }}
                        >
                            Aantal
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {grouped.map((group) => (
                        <React.Fragment key={group.type}>
                            {/* Category header */}
                            <tr>
                                <td
                                    colSpan={6}
                                    className="pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider"
                                    style={{
                                        color: "#898988",
                                        borderBottom: `1px solid ${COLORS.border}`,
                                    }}
                                >
                                    {getCategoryLabel(group.type, group.uniqueCount)}
                                </td>
                            </tr>

                            {/* Data rows */}
                            {group.rows.map((row) => {
                                const labelStyle = getVakLabelStyle(row.object);
                                const highlighted =
                                    hoveredObjectId === row.objectId ||
                                    hoveredRowObjectId === row.objectId;

                                return (
                                    <tr
                                        key={row.key}
                                        style={{
                                            borderBottom: `1px dashed ${COLORS.borderSoft}`,
                                            backgroundColor: highlighted
                                                ? COLORS.orangeLight
                                                : "transparent",
                                            cursor: "default",
                                            transition: "background-color 0.1s",
                                        }}
                                        onMouseEnter={() => onRowHover(row.objectId)}
                                        onMouseLeave={() => onRowHover(null)}
                                    >
                                        {/* Vak */}
                                        <td className={COL_CELL}>
                                            <span
                                                className="inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold"
                                                style={{
                                                    backgroundColor: labelStyle.bg,
                                                    border: labelStyle.border
                                                        ? `1.5px solid ${labelStyle.border}`
                                                        : "none",
                                                    color: labelStyle.text,
                                                }}
                                            >
                                                {row.vakLabel}
                                            </span>
                                        </td>
                                        {/* Latijnse naam */}
                                        <td className={COL_CELL} style={{ color: COLORS.text }}>
                                            {row.latinName}
                                        </td>
                                        {/* Nederlandse naam */}
                                        <td className={COL_CELL} style={{ color: COLORS.text }}>
                                            {row.dutchName}
                                        </td>
                                        {/* Maat */}
                                        <td className={COL_CELL} style={{ color: COLORS.text }}>
                                            {row.maat}
                                        </td>
                                        {/* Planthoeveelheid */}
                                        <td className={COL_CELL} style={{ color: COLORS.text }}>
                                            {row.plantafstand}
                                        </td>
                                        {/* Aantal */}
                                        <td
                                            className={COL_CELL}
                                            style={{
                                                color: COLORS.text,
                                                fontWeight: 600,
                                                textAlign: "right",
                                                paddingRight: 0,
                                            }}
                                        >
                                            {row.aantal} st.
                                        </td>
                                    </tr>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function FinalisatieDrawingBlock() {
    // ── Store ──────────────────────────────────────────────────────────────
    const objects = useProjectStore((s: { objects: PolyObject[] }) => s.objects);
    const plantbedLinks = useProjectStore(
        (s: { plantbedLinks: Record<string, string[]> }) => s.plantbedLinks
    );
    const distributionOverrides = useProjectStore(
        (s: { distributionOverrides: Record<string, Record<string, number>> }) =>
            s.distributionOverrides
    );
    const compassDirection = useProjectStore(
        (s: { compassDirection: string }) => s.compassDirection
    );
    const plantListItems = usePlantSelectionStore((s) => s.plantListItems);

    const plants = useMemo<ProjectPlantLike[]>(() => {
        const seen = new Set<string>();
        return plantListItems.flatMap((item) => {
            if (seen.has(item.plant.id)) return [];
            seen.add(item.plant.id);
            return [{ id: item.plant.id, latin: item.plant.botanicalName, dutch: item.plant.dutchName, planthoeveelheidPerM2: item.plant.planthoeveelheidPerM2 }];
        });
    }, [plantListItems]);
    const locationType = useRightStepMenuStore((s) => s.step1.locationType);

    // ── UI state ────────────────────────────────────────────────────────────
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [transform, setTransform] = useState<Transform>({ panX: 0, panY: 0, zoom: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [showHint, setShowHint] = useState(true);
    const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
    const [hoveredLegendType, setHoveredLegendType] = useState<ObjectType | null>(null);
    const [hoveredRowObjectId, setHoveredRowObjectId] = useState<string | null>(null);

    // ── Refs ────────────────────────────────────────────────────────────────
    const canvasRef = useRef<HTMLDivElement>(null);
    const panStartRef = useRef({ clientX: 0, clientY: 0, panX: 0, panY: 0 });
    const isPanningRef = useRef(false);

    // ── Computed ────────────────────────────────────────────────────────────
    const bbox = useMemo(() => getBoundingBox(objects), [objects]);

    const sortedObjects = useMemo(
        () =>
            [...objects].sort(
                (a, b) =>
                    (OBJECT_LIBRARY[a.type as ObjectType]?.zIndex ?? 0) -
                    (OBJECT_LIBRARY[b.type as ObjectType]?.zIndex ?? 0)
            ),
        [objects]
    );

    const buildingTypes = useMemo(
        () =>
            [
                ...new Set(
                    objects
                        .filter((o) => isBuildingObjectType(o.type as ObjectType))
                        .map((o) => o.type as ObjectType)
                ),
            ],
        [objects]
    );

    const presentTypes = useMemo(
        () => new Set(objects.map((o) => o.type as ObjectType)),
        [objects]
    );

    // Pre-compute boundary band shapes using ALL segments (not just obj.points)
    // so fences/walls along multiple sides are fully rendered
    const boundaryBandShapes = useMemo(() => {
        const map = new Map<string, { outer: number[]; holes: number[][] }>();
        for (const obj of objects) {
            if (
                isBoundaryObjectType(obj.type as ObjectType) ||
                OBJECT_LIBRARY[obj.type as ObjectType]?.geometry === "polyline"
            ) {
                map.set(obj.id, getBoundaryBandShapeForObject(obj));
            }
        }
        return map;
    }, [objects]);

    const legendSections = useMemo(() => {
        const sections = getObjectMenuSections(locationType);
        return sections
            .map((sec) => ({
                ...sec,
                items: sec.items.filter((item) => presentTypes.has(item.id)),
            }))
            .filter((sec) => sec.items.length > 0);
    }, [locationType, presentTypes]);

    // ── Auto-fit ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            const canvas = canvasRef.current;
            if (!bbox || !canvas) return;
            const { clientWidth: cw, clientHeight: ch } = canvas;
            if (cw > 0 && ch > 0) setTransform(computeFit(bbox, cw, ch));
        });
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFullscreen, bbox]);

    // ── Wheel zoom ──────────────────────────────────────────────────────────
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        setTransform((t) => {
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            const nextZoom = Math.min(Math.max(t.zoom * factor, 0.04), 25);
            const ratio = nextZoom / t.zoom;
            return { zoom: nextZoom, panX: cx - (cx - t.panX) * ratio, panY: cy - (cy - t.panY) * ratio };
        });
        setShowHint(false);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.addEventListener("wheel", handleWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", handleWheel);
    }, [handleWheel]);

    // ── Mouse pan ─────────────────────────────────────────────────────────────
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) return;
            isPanningRef.current = true;
            setIsPanning(true);
            panStartRef.current = {
                clientX: e.clientX,
                clientY: e.clientY,
                panX: transform.panX,
                panY: transform.panY,
            };
            setShowHint(false);
        },
        [transform.panX, transform.panY]
    );

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanningRef.current) return;
        const dx = e.clientX - panStartRef.current.clientX;
        const dy = e.clientY - panStartRef.current.clientY;
        setTransform((t) => ({ ...t, panX: panStartRef.current.panX + dx, panY: panStartRef.current.panY + dy }));
    }, []);

    const handleMouseUp = useCallback(() => {
        isPanningRef.current = false;
        setIsPanning(false);
    }, []);

    // ── Zoom controls ─────────────────────────────────────────────────────────
    const zoomFromCenter = useCallback((factor: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2;
        setTransform((t) => {
            const nextZoom = Math.min(Math.max(t.zoom * factor, 0.04), 25);
            const ratio = nextZoom / t.zoom;
            return { zoom: nextZoom, panX: cx - (cx - t.panX) * ratio, panY: cy - (cy - t.panY) * ratio };
        });
    }, []);

    const handleFit = useCallback(() => {
        const canvas = canvasRef.current;
        if (!bbox || !canvas) return;
        setTransform(computeFit(bbox, canvas.clientWidth, canvas.clientHeight));
    }, [bbox]);

    // ── Derived ───────────────────────────────────────────────────────────────
    const { panX, panY, zoom } = transform;
    const zoomPct = Math.round(zoom * 100);
    const canvasHeight = isFullscreen ? 720 : 540;
    const compassSrc = `/icons/compass-${compassDirection || "noord"}.svg`;

    // CSS dot-grid that follows pan
    const dotStep = 28;
    const gridBgStyle = {
        backgroundImage: `radial-gradient(circle, ${COLORS.gridDot} 1px, transparent 1px)`,
        backgroundSize: `${dotStep}px ${dotStep}px`,
        backgroundPosition: `${((panX % dotStep) + dotStep) % dotStep}px ${((panY % dotStep) + dotStep) % dotStep}px`,
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <section
            className="rounded-[10px] border"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor: COLORS.border,
                boxShadow: "5px 3px 46px -25px rgba(0,0,0,0.25)",
                overflow: "hidden",
            }}
        >
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
                <div>
                    <h2 className="text-[18px] font-bold" style={{ color: COLORS.green }}>
                        Beplantingsplantekening
                    </h2>
                    <p className="mt-0.5 text-[13px]" style={{ color: COLORS.softText }}>
                        Bekijk hieronder de technische tekening van jouw beplantingsplan.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setIsFullscreen((v) => !v)}
                    className="mt-0.5 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium"
                    style={{ border: `1px solid ${COLORS.border}`, backgroundColor: "transparent", color: COLORS.text }}
                >
                    {isFullscreen ? (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M5 2H2v3M9 2h3v3M5 12H2V9M9 12h3V9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 5V2h3M9 2h3v3M12 9v3H9M5 12H2V9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                    {isFullscreen ? "Verkleinen" : "Volledig scherm"}
                </button>
            </div>

            {/* ── Canvas + Legend (side by side) ── */}
            <div
                className="flex"
                style={{ borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}
            >
                {/* Canvas */}
                <div
                    ref={canvasRef}
                    className="relative min-w-0 flex-1 select-none overflow-hidden"
                    style={{
                        height: canvasHeight,
                        cursor: isPanning ? "grabbing" : "grab",
                        backgroundColor: COLORS.canvasBg,
                        ...gridBgStyle,
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* SVG drawing */}
                    <svg width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
                        <defs>
                            <BuildingPatterns types={buildingTypes} />
                            {/* Tiles grid overlay — matches renderTilesPattern() in objectPatterns.tsx */}
                            <pattern
                                id="fg-tiles-grid"
                                width={EDITOR_GRID_SIZE * 2}
                                height={EDITOR_GRID_SIZE * 2}
                                patternUnits="userSpaceOnUse"
                            >
                                <path
                                    d={`M ${EDITOR_GRID_SIZE * 2} 0 L 0 0 0 ${EDITOR_GRID_SIZE * 2}`}
                                    fill="none"
                                    stroke={OBJECT_STYLES["tiles" as ObjectType].stroke}
                                    strokeWidth={0.5}
                                    opacity={0.5}
                                />
                            </pattern>
                            {/* Per-object clip paths — labels are clipped to their own polygon so text
                                never bleeds into neighbouring objects. clipPathUnits="userSpaceOnUse"
                                means coordinates are in canvas space, matching obj.points exactly. */}
                            {sortedObjects.map((obj) => {
                                const def = OBJECT_LIBRARY[obj.type as ObjectType];
                                if (!def) return null;
                                if (obj.type === "treebed") return null;
                                if (
                                    isBoundaryObjectType(obj.type as ObjectType) ||
                                    def.geometry === "polyline"
                                ) return null;
                                if (obj.points.length < 6) return null;
                                return (
                                    <clipPath
                                        key={`fg-clip-${obj.id}`}
                                        id={`fg-clip-${obj.id}`}
                                        clipPathUnits="userSpaceOnUse"
                                    >
                                        {obj.holes?.length ? (
                                            <path
                                                d={makePathD(obj.points, obj.holes)}
                                                fillRule="evenodd"
                                            />
                                        ) : (
                                            <polygon points={pointsToSvgString(obj.points)} />
                                        )}
                                    </clipPath>
                                );
                            })}
                        </defs>

                        <g transform={`translate(${panX},${panY}) scale(${zoom})`}>
                            {sortedObjects.map((obj) => {
                                const def = OBJECT_LIBRARY[obj.type as ObjectType];
                                if (!def) return null;

                                const fill = obj.customStyle?.fill ?? OBJECT_STYLES[obj.type as ObjectType]?.fill ?? def.fill;
                                const stroke = obj.customStyle?.stroke ?? OBJECT_STYLES[obj.type as ObjectType]?.stroke ?? def.stroke;
                                const isBoundary = isBoundaryObjectType(obj.type as ObjectType);
                                const isBuilding = isBuildingObjectType(obj.type as ObjectType);
                                const isPlantbed = obj.type === "plantbed";
                                const isHedge = obj.type === "hedge";
                                const isTb = obj.type === "treebed";
                                const isLine = def.geometry === "polyline";

                                const isHovById = hoveredObjectId === obj.id || hoveredRowObjectId === obj.id;
                                const isHovByType = hoveredLegendType === (obj.type as ObjectType);

                                const canvasLabel = getCanvasLabel(obj, objects);
                                const areaText = (!isBoundary && !isLine)
                                    ? formatSquareMeters(getObjectAreaInSquareMeters(obj))
                                    : "";

                                // ── Treebed ──
                                if (isTb) {
                                    const v = getTreebedSvgVisual(obj);
                                    const trunkColor = COLORS.treebedTrunk;

                                    return (
                                        <g
                                            key={obj.id}
                                            onMouseEnter={() => setHoveredObjectId(obj.id)}
                                            onMouseLeave={() => setHoveredObjectId(null)}
                                        >
                                            {v.shape === "circle" ? (
                                                <>
                                                    <path
                                                        d={getBumpyCirclePath(v.cx, v.cy, v.r)}
                                                        fill={COLORS.treebedFill}
                                                        stroke={COLORS.treebedStroke}
                                                        strokeWidth={2}
                                                    />
                                                    {v.isMultiStem ? (
                                                        <>
                                                            <circle cx={v.cx - v.r * 0.2} cy={v.cy + v.r * 0.1} r={v.trunkR * 0.85} fill={trunkColor} />
                                                            <circle cx={v.cx - v.r * 0.1} cy={v.cy - v.r * 0.2} r={v.trunkR * 0.65} fill={trunkColor} />
                                                            <circle cx={v.cx + v.r * 0.2} cy={v.cy} r={v.trunkR * 0.75} fill={trunkColor} />
                                                        </>
                                                    ) : (
                                                        <circle cx={v.cx} cy={v.cy} r={v.trunkR} fill={trunkColor} />
                                                    )}
                                                    {/* Hover ring */}
                                                    {(isHovById || isHovByType) && (
                                                        <circle
                                                            cx={v.cx}
                                                            cy={v.cy}
                                                            r={v.r + 3}
                                                            fill="none"
                                                            stroke={isHovById ? COLORS.orange : COLORS.green}
                                                            strokeWidth={2}
                                                            strokeDasharray={isHovByType && !isHovById ? "6,4" : undefined}
                                                            style={{ pointerEvents: "none" }}
                                                        />
                                                    )}
                                                    {/* Labels: number above trunk, area below trunk */}
                                                    {canvasLabel && (
                                                        <>
                                                            <text
                                                                x={v.cx}
                                                                y={v.cy - v.trunkR - 2}
                                                                textAnchor="middle"
                                                                dominantBaseline="auto"
                                                                fontSize={Math.max(v.r * 0.3, 8)}
                                                                fontWeight="700"
                                                                fill={COLORS.treebedStroke}
                                                                style={{ pointerEvents: "none", userSelect: "none" }}
                                                            >
                                                                {canvasLabel}
                                                            </text>
                                                            {areaText && (
                                                                <text
                                                                    x={v.cx}
                                                                    y={v.cy + v.trunkR + 10}
                                                                    textAnchor="middle"
                                                                    dominantBaseline="auto"
                                                                    fontSize={Math.max(v.r * 0.22, 7)}
                                                                    fontWeight="400"
                                                                    fill={COLORS.treebedStroke}
                                                                    style={{ pointerEvents: "none", userSelect: "none" }}
                                                                >
                                                                    {areaText}
                                                                </text>
                                                            )}
                                                        </>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <rect
                                                        x={v.cx - v.w / 2}
                                                        y={v.cy - v.h / 2}
                                                        width={v.w}
                                                        height={v.h}
                                                        fill={COLORS.treebedFill}
                                                        stroke={COLORS.treebedStroke}
                                                        strokeWidth={2}
                                                    />
                                                    <circle cx={v.cx} cy={v.cy} r={v.trunkR} fill={trunkColor} />
                                                    {(isHovById || isHovByType) && (
                                                        <rect
                                                            x={v.cx - v.w / 2 - 3}
                                                            y={v.cy - v.h / 2 - 3}
                                                            width={v.w + 6}
                                                            height={v.h + 6}
                                                            fill="none"
                                                            stroke={isHovById ? COLORS.orange : COLORS.green}
                                                            strokeWidth={2}
                                                            strokeDasharray={isHovByType && !isHovById ? "6,4" : undefined}
                                                            style={{ pointerEvents: "none" }}
                                                        />
                                                    )}
                                                    {canvasLabel && (
                                                        <>
                                                            <text
                                                                x={v.cx}
                                                                y={v.cy - v.trunkR - 2}
                                                                textAnchor="middle"
                                                                dominantBaseline="auto"
                                                                fontSize={Math.max(Math.min(v.w, v.h) * 0.2, 8)}
                                                                fontWeight="700"
                                                                fill={COLORS.treebedStroke}
                                                                style={{ pointerEvents: "none", userSelect: "none" }}
                                                            >
                                                                {canvasLabel}
                                                            </text>
                                                            {areaText && (
                                                                <text
                                                                    x={v.cx}
                                                                    y={v.cy + v.trunkR + 10}
                                                                    textAnchor="middle"
                                                                    dominantBaseline="auto"
                                                                    fontSize={Math.max(Math.min(v.w, v.h) * 0.14, 7)}
                                                                    fontWeight="400"
                                                                    fill={COLORS.treebedStroke}
                                                                    style={{ pointerEvents: "none", userSelect: "none" }}
                                                                >
                                                                    {areaText}
                                                                </text>
                                                            )}
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </g>
                                    );
                                }

                                // ── Boundary / polyline — filled band polygon, all segments (matches editor) ──
                                if (isBoundary || isLine) {
                                    const band = boundaryBandShapes.get(obj.id);
                                    if (!band || band.outer.length < 6) return null;
                                    return (
                                        <g
                                            key={obj.id}
                                            onMouseEnter={() => setHoveredObjectId(obj.id)}
                                            onMouseLeave={() => setHoveredObjectId(null)}
                                        >
                                            <path
                                                d={makePathD(band.outer, band.holes)}
                                                fillRule="evenodd"
                                                fill={fill}
                                                stroke="none"
                                            />
                                            {(isHovById || isHovByType) && (
                                                <path
                                                    d={makePathD(band.outer, band.holes)}
                                                    fillRule="evenodd"
                                                    fill={isHovById ? COLORS.orange : COLORS.green}
                                                    opacity={0.35}
                                                    stroke="none"
                                                    style={{ pointerEvents: "none" }}
                                                />
                                            )}
                                        </g>
                                    );
                                }

                                // ── Regular polygon (plantbed, hedge, ground, building) ──
                                const patFill = isBuilding ? `url(#fg-bp-${obj.type})` : fill;
                                const dashArr = (isPlantbed || isHedge) ? "6 4" : undefined;

                                // Fixed font size for every polygon — keeps all labels "even groot".
                                // clipPath (defined in <defs>) clips text to the object so it can
                                // never bleed into neighbouring objects.
                                const polyMinDim = getPolyMinDim(obj.points);
                                const numFontSize = 12;
                                const areaFontSize = 9;
                                const labelHalfGap = 8;
                                const labelColor = isPlantbed
                                    ? getReadablePlantbedLabelColor(fill)
                                    : stroke;
                                // Only render a centroid when the object is large enough to hold text
                                const centroid = polyMinDim >= 22 && obj.points.length >= 6
                                    ? getCentroid(obj.points)
                                    : null;

                                const shapeProps = {
                                    fill: patFill,
                                    stroke,
                                    strokeWidth: 2,
                                    strokeDasharray: dashArr,
                                };

                                return (
                                    <g
                                        key={obj.id}
                                        onMouseEnter={() => setHoveredObjectId(obj.id)}
                                        onMouseLeave={() => setHoveredObjectId(null)}
                                    >
                                        {obj.holes?.length ? (
                                            <path d={makePathD(obj.points, obj.holes)} fillRule="evenodd" {...shapeProps} />
                                        ) : (
                                            <polygon points={pointsToSvgString(obj.points)} {...shapeProps} />
                                        )}

                                        {/* Tiles grid overlay — matches renderTilesPattern() in objectPatterns.tsx */}
                                        {obj.type === "tiles" && (
                                            obj.holes?.length ? (
                                                <path
                                                    d={makePathD(obj.points, obj.holes)}
                                                    fillRule="evenodd"
                                                    fill="url(#fg-tiles-grid)"
                                                    stroke="none"
                                                    style={{ pointerEvents: "none" }}
                                                />
                                            ) : (
                                                <polygon
                                                    points={pointsToSvgString(obj.points)}
                                                    fill="url(#fg-tiles-grid)"
                                                    stroke="none"
                                                    style={{ pointerEvents: "none" }}
                                                />
                                            )
                                        )}

                                        {/* Hover ring */}
                                        {(isHovById || isHovByType) && (
                                            <>
                                                {obj.holes?.length ? (
                                                    <path
                                                        d={makePathD(obj.points, obj.holes)}
                                                        fill="none"
                                                        fillRule="evenodd"
                                                        stroke={isHovById ? COLORS.orange : COLORS.green}
                                                        strokeWidth={2.5}
                                                        strokeDasharray={isHovByType && !isHovById ? "6,4" : undefined}
                                                        style={{ pointerEvents: "none" }}
                                                    />
                                                ) : (
                                                    <polygon
                                                        points={pointsToSvgString(obj.points)}
                                                        fill="none"
                                                        stroke={isHovById ? COLORS.orange : COLORS.green}
                                                        strokeWidth={2.5}
                                                        strokeDasharray={isHovByType && !isHovById ? "6,4" : undefined}
                                                        style={{ pointerEvents: "none" }}
                                                    />
                                                )}
                                            </>
                                        )}

                                        {/* Labels: number + area, fixed size, clipped to this object's shape */}
                                        {centroid && (canvasLabel || areaText) && (
                                            <g
                                                clipPath={`url(#fg-clip-${obj.id})`}
                                                style={{ pointerEvents: "none" }}
                                            >
                                                {canvasLabel && (
                                                    <text
                                                        x={centroid.x}
                                                        y={centroid.y - (areaText ? labelHalfGap : 0)}
                                                        textAnchor="middle"
                                                        dominantBaseline="central"
                                                        fontSize={numFontSize}
                                                        fontWeight="700"
                                                        fill={labelColor}
                                                        style={{ userSelect: "none" }}
                                                    >
                                                        {canvasLabel}
                                                    </text>
                                                )}
                                                {areaText && (
                                                    <text
                                                        x={centroid.x}
                                                        y={centroid.y + (canvasLabel ? labelHalfGap : 0)}
                                                        textAnchor="middle"
                                                        dominantBaseline="central"
                                                        fontSize={areaFontSize}
                                                        fontWeight="400"
                                                        fill={labelColor}
                                                        style={{ userSelect: "none" }}
                                                    >
                                                        {areaText}
                                                    </text>
                                                )}
                                            </g>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>

                    {/* Zoom controls */}
                    <div className="absolute right-3 top-3 flex flex-col gap-1" style={{ zIndex: 10 }}>
                        {[
                            {
                                title: "Inzoomen",
                                fn: () => zoomFromCenter(1.25),
                                icon: (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                        <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                ),
                            },
                            {
                                title: "Uitzoomen",
                                fn: () => zoomFromCenter(0.8),
                                icon: (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                ),
                            },
                            {
                                title: "Passend maken",
                                fn: handleFit,
                                icon: (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <path d="M2 5V2h3M9 2h3v3M12 9v3H9M5 12H2V9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                ),
                            },
                        ].map((btn) => (
                            <button
                                key={btn.title}
                                type="button"
                                title={btn.title}
                                onClick={btn.fn}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] bg-white shadow-sm"
                                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }}
                            >
                                {btn.icon}
                            </button>
                        ))}
                        <div
                            className="flex h-8 items-center justify-center rounded-[6px] bg-white px-1 text-[11px] font-semibold shadow-sm"
                            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.softText, minWidth: 32 }}
                        >
                            {zoomPct}%
                        </div>
                    </div>

                    {/* Compass (bottom-right) */}
                    <div
                        className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
                        style={{ border: `1px solid ${COLORS.border}`, zIndex: 10 }}
                    >
                        <img
                            src={compassSrc}
                            alt="Kompas"
                            style={{ width: 32, height: 32, display: "block" }}
                        />
                    </div>

                    {/* Pan hint */}
                    {showHint && objects.length > 0 && (
                        <div
                            className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-[6px] px-3 py-1.5 text-[12px] text-white"
                            style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10, whiteSpace: "nowrap" }}
                        >
                            Scroll om in te zoomen · Sleep om te verschuiven
                        </div>
                    )}

                    {/* Empty state */}
                    {objects.length === 0 && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <p className="text-[14px]" style={{ color: COLORS.muted }}>
                                Geen tekening beschikbaar
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Legend panel (right of canvas) ── */}
                {legendSections.length > 0 && (
                    <div
                        className="flex flex-col overflow-y-auto"
                        style={{
                            width: 220,
                            minWidth: 220,
                            borderLeft: `1px solid ${COLORS.border}`,
                            backgroundColor: COLORS.cardBg,
                            height: canvasHeight,
                        }}
                    >
                        <div className="px-4 pt-4 pb-2">
                            <p
                                className="text-[13px] font-semibold"
                                style={{ color: COLORS.green }}
                            >
                                Legenda
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 pb-4">
                            {legendSections.map((section) => (
                                <div key={section.id} className="mt-3 first:mt-0">
                                    <p
                                        className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider"
                                        style={{ color: COLORS.muted }}
                                    >
                                        {section.label}
                                    </p>
                                    <div className="space-y-0.5">
                                        {section.items.map((item) => {
                                            const isHov = hoveredLegendType === item.id;
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    className="flex w-full cursor-pointer items-center gap-2 rounded-[4px] px-1.5 py-1 text-left"
                                                    style={{
                                                        background: isHov ? COLORS.greenLight : "transparent",
                                                        border: "none",
                                                    }}
                                                    onMouseEnter={() => setHoveredLegendType(item.id)}
                                                    onMouseLeave={() => setHoveredLegendType(null)}
                                                >
                                                    <ObjectSwatch type={item.id} size={12} />
                                                    <span className="text-[12px]" style={{ color: COLORS.text }}>
                                                        {item.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Product rows (below canvas) ── */}
            <div className="px-6 py-5">
                <h3
                    className="mb-3 text-[15px] font-semibold"
                    style={{ color: COLORS.green }}
                >
                    Plantenlijst
                </h3>
                <ProductRows
                    plantbedLinks={plantbedLinks}
                    objects={objects}
                    plants={plants}
                    plantListItems={plantListItems}
                    distributionOverrides={distributionOverrides}
                    hoveredObjectId={hoveredObjectId}
                    hoveredRowObjectId={hoveredRowObjectId}
                    onRowHover={setHoveredRowObjectId}
                />
            </div>

        </section>
    );
}
