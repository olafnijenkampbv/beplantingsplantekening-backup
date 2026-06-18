import React, { useEffect, useMemo, useState } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { OBJECT_STYLES, type ObjectType } from "@/state/projectStore";
import type { PolyObject } from "@/state/projectStore";
import { isBoundaryObjectType, OBJECT_LIBRARY } from "@/features/editor/components/editor/objectMenuConfig";
import { getBoundaryBandShapeForObject } from "@/features/editor/lib/boundarySystem";
import {
    getObjectBoundsRenderPoints,
    makeSvgPathForObject,
    makeSvgPathFromRings,
} from "@/features/editor/lib/svgObjectPath";
import ConfirmModal from "@/features/editor/components/ConfirmModal";
import { APP_NOTIFICATIONS, useAppNotify } from "@/state/allNotifications";

type DrawingPreviewObject = {
    id: string;
    type: ObjectType;
    points: number[];
    holes?: number[][];
    bulges?: number[];
    corners?: number[];
    boundarySegments?: number[][];
    customStyle?: {
        fill?: string;
        stroke?: string;
    };
    treebedVariant?: "standard" | "multi_stem" | "espalier" | "roof";
};

type DrawingDashboardItem = {
    id: string;
    name: string;
    budgetLabel: string;
    budget?: number;
    createdAtLabel: string;
    previewObjects: DrawingPreviewObject[];
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    showCloseButton?: boolean;
    onOpenCreate: () => void;
    drawings: DrawingDashboardItem[];
    activeDrawingId: string | null;
    onOpenDrawing: (drawingId: string) => void;
    onCreateDrawing: (name: string) => void;
    onDuplicateDrawing: (drawingId: string) => void;
    onDeleteDrawing: (drawingId: string) => void;
    onEditDrawing: (drawingId: string) => void;
};

const COLORS = {
    orange: "#E94E1B",
    orangeLight: "#FFE5DD",
    green: "#58694C",
    greenLight: "#EEF0ED",
    border: "#E3E2E2",
    text: "#1F1F1F",
    muted: "#8E8E8E",
    bg: "#F9F8F7",
};

const ITEMS_PER_PAGE = 4;

const PREVIEW_WIDTH = 200;
const PREVIEW_PADDING = 6;

function bboxFromPreviewObjects(objects: DrawingPreviewObject[]) {
    if (objects.length === 0) {
        return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const obj of objects) {
        const boundsPoints = getObjectBoundsRenderPoints(obj as PolyObject);

        for (let i = 0; i < boundsPoints.length; i += 2) {
            const x = boundsPoints[i];
            const y = boundsPoints[i + 1];

            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    }

    return { minX, minY, maxX, maxY };
}

function isLineOnlyType(type: ObjectType) {
    return isBoundaryObjectType(type) || OBJECT_LIBRARY[type]?.geometry === "polyline";
}

function getObjectBounds(points: number[]) {
    if (!points.length) {
        return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1, cx: 0.5, cy: 0.5 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];

        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1, cx: 0.5, cy: 0.5 };
    }

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    return {
        minX,
        minY,
        maxX,
        maxY,
        width,
        height,
        cx: minX + width / 2,
        cy: minY + height / 2,
    };
}

function getPreviewStyle(obj: DrawingPreviewObject) {
    if (obj.type === "treebed") {
        return {
            fill: "#008000",
            stroke: "#476D3C",
            strokeWidth: 1.2,
            opacity: 0.4,
        };
    }

    const baseStyle = {
        ...(OBJECT_STYLES[obj.type] ?? { fill: "#E7EADF", stroke: "#B8BEB1" }),
        ...(obj.customStyle ?? {}),
    };

    if (obj.type === "fence" || obj.type === "gate") {
        return {
            fill: "none",
            stroke: baseStyle.stroke,
            strokeWidth: 2,
            opacity: 1,
        };
    }

    return {
        fill: baseStyle.fill,
        stroke: baseStyle.stroke,
        strokeWidth: 1.2,
        opacity: 1,
    };
}

function getTreebedPreviewTrunks(obj: DrawingPreviewObject) {
    const bounds = getObjectBounds(obj.points);
    const trunkFill = "#8B5E3C";

    const baseRadius = Math.max(2.2, Math.min(bounds.width, bounds.height) * 0.055);

    switch (obj.treebedVariant) {
        case "multi_stem":
            return [
                { cx: bounds.cx - bounds.width * 0.08, cy: bounds.cy + bounds.height * 0.02, r: baseRadius, fill: trunkFill },
                { cx: bounds.cx + bounds.width * 0.06, cy: bounds.cy - bounds.height * 0.01, r: baseRadius, fill: trunkFill },
                { cx: bounds.cx - bounds.width * 0.04, cy: bounds.cy - bounds.height * 0.10, r: baseRadius, fill: trunkFill },
            ];

        case "espalier":
            return [
                { cx: bounds.cx, cy: bounds.cy, r: baseRadius, fill: trunkFill },
            ];

        case "roof":
            return [
                { cx: bounds.cx, cy: bounds.cy, r: baseRadius, fill: trunkFill },
            ];

        case "standard":
        default:
            return [
                { cx: bounds.cx, cy: bounds.cy, r: baseRadius, fill: trunkFill },
            ];
    }
}

const DrawingCardPreview: React.FC<{ objects: DrawingPreviewObject[] }> = ({ objects }) => {
    const previewHeight = 100;
    const bounds = useMemo(() => bboxFromPreviewObjects(objects), [objects]);

    const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY);

    const availableWidth = PREVIEW_WIDTH - PREVIEW_PADDING * 2;
    const availableHeight = previewHeight - PREVIEW_PADDING * 2;

    const aspectRatio = contentWidth / contentHeight;

    const adaptiveZoom =
        aspectRatio <= 0.45
            ? 1.42
            : aspectRatio <= 0.65
                ? 1.3
                : aspectRatio <= 0.9
                    ? 1.18
                    : aspectRatio <= 1.25
                        ? 1.08
                        : 1;

    const scale =
        Math.min(availableWidth / contentWidth, availableHeight / contentHeight) * adaptiveZoom;

    const offsetX = (PREVIEW_WIDTH - contentWidth * scale) / 2;
    const offsetY = (previewHeight - contentHeight * scale) / 2;

    const toSvgX = (x: number) => offsetX + (x - bounds.minX) * scale;
    const toSvgY = (y: number) => offsetY + (y - bounds.minY) * scale;

    return (
        <div
            style={{
                width: PREVIEW_WIDTH,
                height: "100%",
                minHeight: 100,
                alignSelf: "stretch",
                flexShrink: 0,
                borderRadius: 6,
                background: "linear-gradient(180deg, #DDE2D9 0%, #E8ECE5 100%)",
                border: `1px solid ${COLORS.border}`,
                overflow: "hidden",
                display: "flex",
            }}
        >
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${PREVIEW_WIDTH} ${previewHeight}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ display: "block" }}
            >
                {objects.map((obj) => {
                    const previewStyle = getPreviewStyle(obj);

                    if (isLineOnlyType(obj.type)) {
                        // Render as filled band polygon using all boundary segments
                        const band = getBoundaryBandShapeForObject(obj as unknown as PolyObject);
                        if (!band || band.outer.length < 6) return null;
                        // Transform raw canvas coords → SVG preview coords
                        const d = makeSvgPathFromRings(
                            band.outer,
                            band.holes,
                            (x, y) => [toSvgX(x), toSvgY(y)]
                        );
                        return (
                            <path
                                key={obj.id}
                                d={d}
                                fillRule="evenodd"
                                fill={previewStyle.stroke ?? "#888"}
                                stroke="none"
                            />
                        );
                    }

                    if (obj.type === "treebed") {
                        const trunks = getTreebedPreviewTrunks(obj);
                        const d = makeSvgPathForObject(
                            obj as PolyObject,
                            (x, y) => [toSvgX(x), toSvgY(y)]
                        );

                        return (
                            <g key={obj.id}>
                                <path
                                    d={d}
                                    fillRule="evenodd"
                                    fill={previewStyle.fill}
                                    fillOpacity={previewStyle.opacity ?? 1}
                                    stroke={previewStyle.stroke}
                                    strokeOpacity={previewStyle.opacity ?? 1}
                                    strokeWidth={previewStyle.strokeWidth}
                                    strokeLinejoin="round"
                                />
                                {trunks.map((trunk, index) => (
                                    <circle
                                        key={`${obj.id}-trunk-${index}`}
                                        cx={toSvgX(trunk.cx)}
                                        cy={toSvgY(trunk.cy)}
                                        r={Math.max(1.8, trunk.r * scale)}
                                        fill={trunk.fill}
                                    />
                                ))}
                            </g>
                        );
                    }

                    return (
                        <path
                            key={obj.id}
                            d={makeSvgPathForObject(
                                obj as PolyObject,
                                (x, y) => [toSvgX(x), toSvgY(y)]
                            )}
                            fillRule="evenodd"
                            fill={previewStyle.fill}
                            fillOpacity={previewStyle.opacity ?? 1}
                            stroke={previewStyle.stroke}
                            strokeOpacity={previewStyle.opacity ?? 1}
                            strokeWidth={previewStyle.strokeWidth}
                            strokeLinejoin="round"
                        />
                    );
                })}
            </svg>
        </div>
    );
};
const DrawingsDashboardModal: React.FC<Props> = ({
    isOpen,
    drawings,
    activeDrawingId,
    showCloseButton = true,
    onClose,
    onOpenCreate,
    onOpenDrawing,
    onCreateDrawing,
    onDuplicateDrawing,
    onDeleteDrawing,
    onEditDrawing,
}) => {
    const [searchValue, setSearchValue] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [hoveredDrawingId, setHoveredDrawingId] = useState<string | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<DrawingDashboardItem | null>(null);
    const notify = useAppNotify();
    useScrollLock(isOpen);
    useEffect(() => {
        if (!isOpen) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEsc);
        return () => {
            document.removeEventListener("keydown", handleEsc);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchValue]);

    const filteredDrawings = useMemo(() => {
        const query = searchValue.trim().toLowerCase();

        if (!query) return drawings;

        return drawings.filter((drawing) =>
            drawing.name.toLowerCase().includes(query)
        );
    }, [drawings, searchValue]);

    const totalPages = Math.max(1, Math.ceil(filteredDrawings.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);

    useEffect(() => {
        if (currentPage !== safePage) {
            setCurrentPage(safePage);
        }
    }, [currentPage, safePage]);

    const pageItems = useMemo(() => {
        const start = (safePage - 1) * ITEMS_PER_PAGE;
        return filteredDrawings.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredDrawings, safePage]);

    const handleDuplicateDrawing = (drawing: DrawingDashboardItem) => {
        onDuplicateDrawing(drawing.id);
        notify(APP_NOTIFICATIONS.drawingDuplicated(drawing.name));
    };

    const handleRequestDeleteDrawing = (drawing: DrawingDashboardItem) => {
        setDeleteCandidate(drawing);
    };

    const handleCancelDeleteDrawing = () => {
        setDeleteCandidate(null);
    };

    const handleConfirmDeleteDrawing = () => {
        if (!deleteCandidate) return;
        const deletedName = deleteCandidate.name;
        onDeleteDrawing(deleteCandidate.id);
        setDeleteCandidate(null);
        notify(APP_NOTIFICATIONS.drawingDeleted(deletedName));
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.33)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                zIndex: 2000,
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: 1300, //
                    height: "75vh",
                    padding: 32,
                    background: COLORS.bg,
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.18)",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {showCloseButton && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Sluiten"
                        style={{
                            position: "absolute",
                            top: 18,
                            right: 18,
                            width: 24,
                            height: 24,
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <img
                            src="/icons/cancel.svg"
                            alt=""
                            style={{ width: 18, height: 18, display: "block" }}
                        />
                    </button>
                )}

                <div
                    style={{
                        fontSize: 28,
                        lineHeight: 1.15,
                        fontWeight: 700,
                        color: COLORS.text,
                        marginBottom: 22,
                    }}
                >
                    Mijn tekeningen
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: 20,
                        background: "#FFFFFF",
                        border: `1px solid ${COLORS.border}`,
                        boxShadow: "5px 3px 46px -25px rgba(0,0,0,0.25)",
                        borderRadius: 8,
                        padding: 12,
                    }}
                >
                    <div
                        style={{
                            width: "50%",
                            minWidth: 260,
                            height: 44,
                            background: "#F9F8F7",
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                            padding: "0 14px",
                            gap: 8,
                        }}
                    >
                        <img
                            src="/icons/search.svg"
                            alt=""
                            style={{ width: 14, height: 14, opacity: 0.6 }}
                        />

                        <input
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                            }}
                            placeholder="Zoek tekening..."
                            style={{
                                width: "100%",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                fontSize: 14,
                                color: "#898988",
                            }}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onOpenCreate();
                        }}
                        style={{
                            height: 44,
                            border: "none",
                            borderRadius: 6,
                            background: COLORS.orange,
                            color: "#FFFFFF",
                            padding: "0 16px",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            whiteSpace: "nowrap",
                        }}
                    >
                        <img
                            src="/icons/plus.svg"
                            alt=""
                            style={{ width: 14, height: 14 }}
                        />
                        Tekening aanmaken
                    </button>
                </div>

                <div
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 16,
                        marginBottom: 16,
                        paddingRight: 4,
                    }}
                >
                    {pageItems.map((drawing) => {
                        const isActive = drawing.id === activeDrawingId;
                        const isHovered = drawing.id === hoveredDrawingId;

                        return (
                            <div
                                key={drawing.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => onOpenDrawing(drawing.id)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onOpenDrawing(drawing.id);
                                    }
                                }}
                                onMouseEnter={() => setHoveredDrawingId(drawing.id)}
                                onMouseLeave={() => setHoveredDrawingId((current) => (current === drawing.id ? null : current))}
                                style={{
                                    border: `1px solid ${isActive ? COLORS.orange : COLORS.border}`,
                                    borderRadius: 6,
                                    background: "#FFFFFF",
                                    padding: 14,
                                    cursor: "pointer",
                                    textAlign: "left",
                                    display: "flex",
                                    alignItems: "stretch",
                                    gap: 16,
                                    height: 205,
                                    transition: "box-shadow 0.2s ease, transform 0.2s ease",
                                    
                                }}
                            >
                                <div
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        display: "flex",
                                        flexDirection: "column",
                                    }}
                                >
                                    <div
                                        style={{
                                            marginBottom: 10,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 16,
                                                lineHeight: 1.2,
                                                fontWeight: 700,
                                                color: COLORS.text,
                                                minWidth: 0,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {drawing.name}
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            fontSize: 13,
                                            lineHeight: 1.4,
                                            color: COLORS.text,
                                            marginBottom: 6,
                                        }}
                                    >
                                        {drawing.budgetLabel}
                                    </div>

                                    <div
                                        style={{
                                            fontSize: 12,
                                            lineHeight: 1.4,
                                            color: COLORS.muted,
                                            marginBottom: "auto",
                                            fontStyle: "italic",
                                        }}
                                    >
                                        {drawing.createdAtLabel}
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 16,
                                            marginTop: 12,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDuplicateDrawing(drawing);
                                            }}
                                            style={{
                                                border: "none",
                                                background: "transparent",
                                                padding: "6px 8px",
                                                cursor: "pointer",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 6,
                                                fontSize: 12,
                                                color: COLORS.text,
                                                borderRadius: 4,
                                                transition: "all 0.15s ease",
                                            }}
                                            onMouseEnter={(e) => {
                                                const img = e.currentTarget.querySelector("img");
                                                if (img) img.style.filter = "brightness(0) saturate(100%) invert(39%) sepia(87%) saturate(2307%) hue-rotate(346deg) brightness(96%) contrast(92%)";
                                                e.currentTarget.style.color = COLORS.orange;
                                            }}
                                            onMouseLeave={(e) => {
                                                const img = e.currentTarget.querySelector("img");
                                                if (img) img.style.filter = "none";
                                                e.currentTarget.style.color = COLORS.text;
                                            }}
                                        >
                                            <img
                                                src="/icons/duplicate.svg"
                                                alt=""
                                                style={{ width: 14, height: 14, display: "block", transition: "0.15s" }}
                                            />
                                            Tekening dupliceren
                                        </button>

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRequestDeleteDrawing(drawing);
                                            }}
                                            style={{
                                                border: "none",
                                                background: "transparent",
                                                padding: "6px 8px",
                                                cursor: "pointer",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 6,
                                                fontSize: 12,
                                                color: COLORS.text,
                                                borderRadius: 4,
                                                transition: "all 0.15s ease",
                                            }}
                                            onMouseEnter={(e) => {
                                                const img = e.currentTarget.querySelector("img");
                                                if (img) img.style.filter = "brightness(0) saturate(100%) invert(39%) sepia(87%) saturate(2307%) hue-rotate(346deg) brightness(96%) contrast(92%)";
                                                e.currentTarget.style.color = COLORS.orange;
                                            }}
                                            onMouseLeave={(e) => {
                                                const img = e.currentTarget.querySelector("img");
                                                if (img) img.style.filter = "none";
                                                e.currentTarget.style.color = COLORS.text;
                                            }}
                                        >
                                            <img
                                                src="/icons/delete-tool.svg"
                                                alt=""
                                                style={{ width: 14, height: 14, display: "block", transition: "0.15s" }}
                                            />
                                            Tekening verwijderen
                                        </button>
                                    </div>
                                </div>

                                <div style={{ position: "relative", flexShrink: 0 }}>
                                    <DrawingCardPreview objects={drawing.previewObjects ?? []} />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEditDrawing(drawing.id);
                                        }}
                                        aria-label="Tekening bewerken"
                                        style={{
                                            position: "absolute",
                                            top: 7,
                                            right: 7,
                                            width: 26,
                                            height: 26,
                                            border: "none",
                                            background: "rgba(255,255,255,0.88)",
                                            borderRadius: 5,
                                            padding: 0,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = "#ffffff";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.88)";
                                        }}
                                    >
                                        <img
                                            src="/icons/edit.svg"
                                            alt=""
                                            style={{ width: 13, height: 13, display: "block" }}
                                        />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div
                    style={{
                        minHeight: pageItems.length === 0 ? 360 : 0,
                        display: pageItems.length === 0 ? "flex" : "none",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        marginBottom: 16,
                        paddingTop: 70,
                        color: "#898988",
                        fontSize: 14,
                        lineHeight: 1.4,
                        textAlign: "center",
                    }}
                >
                    Geen tekeningen gevonden. Maak er eerst een aan
                </div>

                <div
                    style={{
                        height: 44,
                        border: `1px solid ${COLORS.border}`,
                        flexShrink: 0,
                        marginTop: "auto",

                        borderRadius: 6,
                        background: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0 14px",
                    }}
                >
                    <div
                        style={{
                            fontSize: 12,
                            color: COLORS.text,
                        }}
                    >
                        {filteredDrawings.length} tekening{filteredDrawings.length === 1 ? "" : "en"}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            fontSize: 12,
                            color: COLORS.text,
                        }}
                    >
                        <span>
                            Pagina: {safePage} van {totalPages}
                        </span>

                        <button
                            type="button"
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={safePage <= 1}
                            style={{
                                width: 22,
                                height: 22,
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: 4,
                                background: safePage <= 1 ? "#F3F3F3" : "#FFFFFF",
                                opacity: safePage <= 1 ? 0.45 : 1,
                                cursor: safePage <= 1 ? "default" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 0,
                            }}
                        >
                            <img
                                src="/icons/page-left.svg"
                                alt=""
                                style={{ width: 12, height: 12, display: "block" }}
                            />
                        </button>

                        <button
                            type="button"
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={safePage >= totalPages}
                            style={{
                                width: 22,
                                height: 22,
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: 4,
                                background: safePage >= totalPages ? "#F3F3F3" : "#FFFFFF",
                                opacity: safePage >= totalPages ? 0.45 : 1,
                                cursor: safePage >= totalPages ? "default" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 0,
                            }}
                        >
                            <img
                                src="/icons/page-right.svg"
                                alt=""
                                style={{ width: 12, height: 12, display: "block" }}
                            />
                        </button>
                    </div>
                </div>
            </div>
            <ConfirmModal
                open={deleteCandidate !== null}
                title="Tekening verwijderen"
                description={
                    deleteCandidate
                        ? `Weet je zeker dat je de tekening "${deleteCandidate.name}" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`
                        : ""
                }
                cancelText="Nee, behouden"
                confirmText="Ja, verwijder"
                onCancel={handleCancelDeleteDrawing}
                onConfirm={handleConfirmDeleteDrawing}
            />
        </div>
    );
};

export default DrawingsDashboardModal;
