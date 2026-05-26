import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ObjectType, OBJECT_STYLES, TreebedVariant, useProjectStore, ViewVisibilityKey } from "@/state/projectStore";
import TreebedVariantSwatch from "@/features/editor/components/TreebedVariantSwatch";
import { isBuildingObjectType, OBJECT_LIBRARY } from "@/features/editor/components/editor/objectMenuConfig";
import {
  getObjectMenuSections,
  TREEBED_VARIANTS,
  type ObjectMenuSection as Section,
} from "@/features/editor/components/editor/objectMenuConfig";
import DrawAnimationPreview, { getPreviewInstructionText } from "@/features/editor/components/DrawAnimationPreview";

const COLORS = {
  green: "#58694C",
  bg: "#ffffff",
  border: "#E3E2E2",
  canvasBg: "#EEF0ED",
  accent: "#E94E1B",
  accentBg: "#FFE5DD",
  muted: "#6b7280",
};

// Kleurbare SVG icon renderer via mask (werkt met /public/icons/*.svg en kleurt mee met currentColor)
function MaskIcon({
  src,
  size = 16,
  className = "",
}: {
  src: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        display: "inline-block",
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
        maskImage: `url(${src})`,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
      }}
    />
  );
}

const SECTION_ICON: Record<Section["id"], string> = {
  ondergrond: "/icons/grass.svg",
  gebouwen: "/icons/home.svg",
  afbakening: "/icons/afbakening.svg",
  beplanting: "/icons/beplanting.svg",
  "verkeer-gebruik": "/icons/verkeer-gebruik.svg",
  randen: "/icons/rand.svg",
};

const CHEVRON_RIGHT = "/icons/chevron-right.svg";
const CHEVRON_DOWN = "/icons/chevron-down.svg";
const PANEL_LEFT = "/icons/panel-left.svg";

type Props = {
  locationType: string | null;
  activeDrawType: ObjectType | null;
  activeTreebedVariant: TreebedVariant;
  onPickDrawType: (t: ObjectType) => void;
  onPickTreebedVariant: (variant: TreebedVariant) => void;
};

// ─── Eye-slash icon (inline — no public icon available) ──────────────────────

function EyeSlashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ─── Hover preview popover ────────────────────────────────────────────────────

function HoverPreview({
  type,
  anchorRect,
  menuWidth,
  onDisable,
  onMouseEnter,
  onMouseLeave,
}: {
  type: ObjectType;
  anchorRect: DOMRect;
  menuWidth: number;
  onDisable: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const def = OBJECT_LIBRARY[type] as { label: string; geometry: string } | undefined;
  const label = def?.label ?? String(type);
  const instruction = getPreviewInstructionText(type);
  const isLine = def?.geometry === "polyline";
  const typeLabel = isLine ? "LIJN" : "VLAK";

  const PREVIEW_W = 240;
  const PREVIEW_H = 144;
  const PANEL_W   = PREVIEW_W + 24; // 12px horizontal padding each side

  // Position: right of menu, top aligned with the hovered item
  const left = menuWidth + 8;
  const PANEL_ESTIMATE = PREVIEW_H + 80; // approximate panel height
  const top = Math.max(8, Math.min(anchorRect.top, window.innerHeight - PANEL_ESTIMATE - 8));

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        left,
        top,
        width: PANEL_W,
        background: "#FFFFFF",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
        zIndex: 200,
        overflow: "hidden",
      }}
    >
      {/* Animated preview + disable button */}
      <div style={{ padding: "10px 12px 0", position: "relative" }}>
        <DrawAnimationPreview type={type} width={PREVIEW_W} height={PREVIEW_H} />

        {/* Eye-slash button — top-right corner of the animation */}
        <button
          type="button"
          onClick={onDisable}
          title="Tekenhints verbergen"
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            background: "rgba(0,0,0,0.28)",
            border: "none",
            borderRadius: 5,
            width: 26,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#ffffff",
            opacity: 0.55,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.55"; }}
        >
          <EyeSlashIcon size={14} />
        </button>
      </div>

      {/* Name + type badge */}
      <div
        style={{
          padding: "8px 12px 4px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#000000", lineHeight: 1.2 }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            background: isLine ? "#EDF2FB" : "#EEF3E8",
            color: isLine ? "#3B6CC7" : COLORS.green,
            padding: "2px 5px",
            borderRadius: 3,
            letterSpacing: "0.05em",
            lineHeight: 1.4,
            flexShrink: 0,
          }}
        >
          {typeLabel}
        </span>
      </div>

      {/* Instruction text */}
      <div
        style={{
          padding: "4px 12px 12px",
          fontSize: 11.5,
          color: COLORS.muted,
          lineHeight: 1.5,
        }}
      >
        {instruction}
      </div>
    </div>
  );
}

// ─── Object swatch (preserved exactly) ───────────────────────────────────────

function ObjectSwatch({ type }: { type: ObjectType }) {
  const isBuilding = isBuildingObjectType(type);
  return (
    <span
      className="h-3 w-3 border shrink-0"
      style={{
        borderRadius: "2px",
        backgroundColor: OBJECT_STYLES[type].fill,
        borderColor: OBJECT_STYLES[type].stroke,
        backgroundImage: isBuilding
          ? `linear-gradient(
              135deg,
              transparent 0%,
              transparent 35%,
              ${OBJECT_STYLES[type].stroke} 35%,
              ${OBJECT_STYLES[type].stroke} 40%,
              transparent 40%,
              transparent 60%,
              ${OBJECT_STYLES[type].stroke} 60%,
              ${OBJECT_STYLES[type].stroke} 65%,
              transparent 65%,
              transparent 100%
            )`
          : undefined,
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
      }}
    />
  );
}

// ─── Section item count badge ─────────────────────────────────────────────────

function CountBadge({ count, isOpen = false }: { count: number; isOpen?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: isOpen ? COLORS.accentBg : "#EEECE8",
        color: isOpen ? COLORS.accent : COLORS.muted,
        borderRadius: 3,
        minWidth: 18,
        height: 18,
        fontSize: 11,
        fontWeight: 600,
        padding: "0 5px",
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {count}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeftObjectsMenu(props: Props) {
  const sections: Section[] = useMemo(
    () => getObjectMenuSections(props.locationType),
    [props.locationType]
  );

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [openSection, setOpenSection] = useState<Section["id"] | null>("ondergrond");

  // ── Search ──────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!trimmedQuery) return null;
    const results: Array<{ sectionLabel: string; item: Section["items"][number] }> = [];
    for (const sec of sections) {
      for (const it of sec.items) {
        if (it.label.toLowerCase().includes(trimmedQuery)) {
          results.push({ sectionLabel: sec.label, item: it });
        }
      }
    }
    return results;
  }, [sections, trimmedQuery]);

  // ── Preview enabled / disabled (persisted in localStorage) ─────────────────
  // Start with `true` on both server and first client render to avoid hydration
  // mismatch, then sync from localStorage after mount.
  const [previewEnabled, setPreviewEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (localStorage.getItem("obj-preview-enabled") === "false") {
      setPreviewEnabled(false);
    }
  }, []);

  const enablePreview = useCallback(() => {
    setPreviewEnabled(true);
    localStorage.setItem("obj-preview-enabled", "true");
  }, []);

  // ── Hover preview ───────────────────────────────────────────────────────────
  const [hoverType, setHoverType] = useState<ObjectType | null>(null);
  const [hoverAnchorRect, setHoverAnchorRect] = useState<DOMRect | null>(null);
  const hoverLeaveTimerRef = useRef<number | null>(null);

  const handleItemMouseEnter = useCallback(
    (type: ObjectType, e: React.MouseEvent<HTMLButtonElement>) => {
      if (hoverLeaveTimerRef.current) {
        window.clearTimeout(hoverLeaveTimerRef.current);
        hoverLeaveTimerRef.current = null;
      }
      setHoverType(type);
      setHoverAnchorRect(e.currentTarget.getBoundingClientRect());
    },
    []
  );

  const handleItemMouseLeave = useCallback(() => {
    hoverLeaveTimerRef.current = window.setTimeout(() => {
      setHoverType(null);
      setHoverAnchorRect(null);
      hoverLeaveTimerRef.current = null;
    }, 400);
  }, []);

  const handlePopupMouseEnter = useCallback(() => {
    if (hoverLeaveTimerRef.current) {
      window.clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  }, []);

  const handlePopupMouseLeave = useCallback(() => {
    hoverLeaveTimerRef.current = window.setTimeout(() => {
      setHoverType(null);
      setHoverAnchorRect(null);
      hoverLeaveTimerRef.current = null;
    }, 200);
  }, []);

  // Clear hover when collapsing
  useEffect(() => {
    if (isCollapsed) {
      setHoverType(null);
      setHoverAnchorRect(null);
      setQuery("");
    }
  }, [isCollapsed]);

  // ── Section toggle ──────────────────────────────────────────────────────────
  const toggle = (id: Section["id"]) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setOpenSection(id);
      return;
    }

    setOpenSection((current) => (current === id ? null : id));
  };

  // ── View visibility ─────────────────────────────────────────────────────────
  const viewVisibility = useProjectStore((s) => s.viewVisibility);
  const toggleViewVisibility = useProjectStore((s) => s.toggleViewVisibility);

  // ── Panel refs ──────────────────────────────────────────────────────────────
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewButtonRef = useRef<HTMLButtonElement | null>(null);
  const viewPanelRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const treebedButtonRef = useRef<HTMLButtonElement | null>(null);
  const treebedPanelRef = useRef<HTMLDivElement | null>(null);
  const treebedCloseTimerRef = useRef<number | null>(null);

  const [isViewPanelMounted, setIsViewPanelMounted] = useState(false);
  const [isViewPanelVisible, setIsViewPanelVisible] = useState(false);
  const [viewPanelPos, setViewPanelPos] = useState<{ left: number; bottom: number } | null>(null);

  const [isTreebedPanelMounted, setIsTreebedPanelMounted] = useState(false);
  const [isTreebedPanelVisible, setIsTreebedPanelVisible] = useState(false);
  const [treebedPanelPos, setTreebedPanelPos] = useState<{ left: number; top: number } | null>(null);
  const [hoverTreebedVariant, setHoverTreebedVariant] = useState<TreebedVariant | null>(null);

  const TREEBED_VARIANTS = useMemo(
    () =>
      [
        { key: "standard" as const, label: "Standaard" },
        { key: "multi_stem" as const, label: "Meerstammig" },
        { key: "espalier" as const, label: "Leivorm" },
        { key: "roof" as const, label: "Dakvorm" },
      ],
    []
  );

  // ── View panel ──────────────────────────────────────────────────────────────
  const updateViewPanelPosition = useCallback(() => {
    const btn = viewButtonRef.current;
    if (!btn) return false;

    const rect = btn.getBoundingClientRect();

    setViewPanelPos({
      left: rect.right + 10,
      bottom: Math.max(8, window.innerHeight - rect.bottom),
    });

    return true;
  }, []);

  const closeViewPanel = useCallback(() => {
    setIsViewPanelVisible(false);

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setIsViewPanelMounted(false);
      setViewPanelPos(null);
    }, 160);
  }, []);

  const openViewPanel = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    const hasPosition = updateViewPanelPosition();
    if (!hasPosition) return;

    setIsViewPanelVisible(false);
    setIsViewPanelMounted(true);
  }, [updateViewPanelPosition]);

  const toggleViewPanel = useCallback(() => {
    if (isViewPanelMounted && isViewPanelVisible) {
      closeViewPanel();
      return;
    }

    openViewPanel();
  }, [closeViewPanel, isViewPanelMounted, isViewPanelVisible, openViewPanel]);

  // ── Treebed panel ───────────────────────────────────────────────────────────
  const updateTreebedPanelPosition = useCallback(() => {
    const btn = treebedButtonRef.current;
    if (!btn) return false;

    const rect = btn.getBoundingClientRect();

    setTreebedPanelPos({
      left: rect.right + 10,
      top: rect.top,
    });

    return true;
  }, []);

  const closeTreebedPanel = useCallback(() => {
    setIsTreebedPanelVisible(false);

    if (treebedCloseTimerRef.current) {
      window.clearTimeout(treebedCloseTimerRef.current);
    }

    treebedCloseTimerRef.current = window.setTimeout(() => {
      setIsTreebedPanelMounted(false);
      setTreebedPanelPos(null);
    }, 160);
  }, []);

  const openTreebedPanel = useCallback(() => {
    if (treebedCloseTimerRef.current) {
      window.clearTimeout(treebedCloseTimerRef.current);
    }

    const hasPosition = updateTreebedPanelPosition();
    if (!hasPosition) return;

    setIsTreebedPanelVisible(false);
    setIsTreebedPanelMounted(true);
  }, [updateTreebedPanelPosition]);

  const toggleTreebedPanel = useCallback(() => {
    if (isTreebedPanelMounted && isTreebedPanelVisible) {
      closeTreebedPanel();
      return;
    }

    openTreebedPanel();
  }, [closeTreebedPanel, isTreebedPanelMounted, isTreebedPanelVisible, openTreebedPanel]);

  useLayoutEffect(() => {
    if (!isViewPanelMounted || !viewPanelPos) return;

    const frame = window.requestAnimationFrame(() => {
      setIsViewPanelVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isViewPanelMounted, viewPanelPos]);

  useLayoutEffect(() => {
    if (!isTreebedPanelMounted || !treebedPanelPos) return;

    const frame = window.requestAnimationFrame(() => {
      setIsTreebedPanelVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isTreebedPanelMounted, treebedPanelPos]);

  useEffect(() => {
    if (!isViewPanelMounted && !isTreebedPanelMounted) return;

    const updatePosition = () => {
      if (isViewPanelMounted) {
        updateViewPanelPosition();
      }

      if (isTreebedPanelMounted) {
        updateTreebedPanelPosition();
      }
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isViewPanelMounted, isTreebedPanelMounted, updateViewPanelPosition, updateTreebedPanelPosition]);

  useEffect(() => {
    if (!isViewPanelMounted && !isTreebedPanelMounted) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const clickedViewButton = viewButtonRef.current?.contains(target);
      const clickedViewPanel = viewPanelRef.current?.contains(target);
      const clickedTreebedButton = treebedButtonRef.current?.contains(target);
      const clickedTreebedPanel = treebedPanelRef.current?.contains(target);

      if (!clickedViewButton && !clickedViewPanel) {
        closeViewPanel();
      }

      if (!clickedTreebedButton && !clickedTreebedPanel) {
        closeTreebedPanel();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeViewPanel();
        closeTreebedPanel();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isViewPanelMounted, isTreebedPanelMounted, closeViewPanel, closeTreebedPanel]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }

      if (treebedCloseTimerRef.current) {
        window.clearTimeout(treebedCloseTimerRef.current);
      }

      if (hoverLeaveTimerRef.current) {
        window.clearTimeout(hoverLeaveTimerRef.current);
      }
    };
  }, []);

  // ── View toggle helper ──────────────────────────────────────────────────────
  const renderViewToggle = (label: string, key: ViewVisibilityKey) => {
    const enabled = viewVisibility[key] ?? true;

    return (
      <button
        key={key}
        type="button"
        onClick={() => toggleViewVisibility(key)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors hover:bg-[#f7f7f7] cursor-pointer text-left"
      >
        <span
          className="relative shrink-0 inline-flex h-[18px] w-[32px] items-center rounded-full transition-colors"
          style={{
            backgroundColor: enabled ? COLORS.accent : "#D1D5DB",
          }}
        >
          <span
            className="inline-block h-[14px] w-[14px] rounded-full bg-white transition-transform"
            style={{
              transform: enabled ? "translateX(16px)" : "translateX(2px)",
            }}
          />
        </span>

        <span className="text-[13px] leading-[1.2] text-black">{label}</span>
      </button>
    );
  };

  // ── Render a single menu item button ───────────────────────────────────────
  const closeHoverPreview = useCallback(() => {
    if (hoverLeaveTimerRef.current) {
      window.clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    setHoverType(null);
    setHoverAnchorRect(null);
  }, []);

  const disablePreview = useCallback(() => {
    setPreviewEnabled(false);
    localStorage.setItem("obj-preview-enabled", "false");
    closeHoverPreview();
  }, [closeHoverPreview]);

  const renderItem = (it: Section["items"][number]) => {
    const active = props.activeDrawType === it.id;

    if (it.id === "treebed") {
      return (
        <button
          key={it.id}
          ref={treebedButtonRef}
          type="button"
          onClick={() => {
            closeHoverPreview();
            toggleTreebedPanel();
          }}
          onMouseEnter={(e) => handleItemMouseEnter(it.id, e)}
          onMouseLeave={handleItemMouseLeave}
          className={[
            "w-full pr-4 pl-10 py-2 flex items-center justify-between text-sm cursor-pointer",
            "hover:bg-[#f2f2f2] transition-colors",
            active ? "bg-[#FFE5DD]" : "bg-transparent",
          ].join(" ")}
          style={{
            borderLeft: active
              ? `3px solid ${COLORS.accent}`
              : "3px solid transparent",
          }}
        >
          <div className="flex items-center gap-2">
            <TreebedVariantSwatch variant="standard" size={14} />
            <span style={{ fontWeight: active ? 600 : 400 }}>{it.label}</span>
          </div>

          <MaskIcon
            src={isTreebedPanelMounted ? CHEVRON_DOWN : CHEVRON_RIGHT}
            size={16}
            className="text-black"
          />
        </button>
      );
    }

    return (
      <button
        key={it.id}
        type="button"
        onClick={() => {
          closeHoverPreview();
          props.onPickDrawType(it.id);
        }}
        onMouseEnter={(e) => handleItemMouseEnter(it.id, e)}
        onMouseLeave={handleItemMouseLeave}
        className={[
          "w-full pr-4 pl-10 py-2 flex items-center gap-2 text-sm cursor-pointer",
          "hover:bg-[#f2f2f2] transition-colors",
          active ? "bg-[#FFE5DD]" : "bg-transparent",
        ].join(" ")}
        style={{
          borderLeft: active
            ? `3px solid ${COLORS.accent}`
            : "3px solid transparent",
        }}
      >
        <ObjectSwatch type={it.id} />
        <span style={{ fontWeight: active ? 600 : 400 }}>{it.label}</span>
      </button>
    );
  };

  const menuWidth = isCollapsed ? 54 : 260;

  return (
    <div
      ref={rootRef}
      className="h-full border-r relative flex flex-col overflow-visible"
      style={{
        width: menuWidth,
        background: COLORS.bg,
        borderColor: COLORS.border,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={isCollapsed ? "px-0 pt-4" : "px-4 pt-4"}>
        {isCollapsed ? (
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => setIsCollapsed((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#f2f2f2] transition-colors cursor-pointer"
              aria-label="Menu uitklappen"
              title="Menu uitklappen"
            >
              <MaskIcon
                src={PANEL_LEFT}
                size={18}
                className="text-black"
              />
            </button>

            <div
              className="mt-4 h-px w-full"
              style={{ background: COLORS.border }}
            />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-lg font-bold" style={{ color: COLORS.green }}>
                  Objecten
                </div>
                <div className="mt-1 text-sm italic" style={{ color: "#000000" }}>
                  Kies wat je wilt tekenen.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCollapsed((v) => !v)}
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#f2f2f2] transition-colors cursor-pointer"
                aria-label="Menu inklappen"
                title="Menu inklappen"
              >
                <MaskIcon
                  src={PANEL_LEFT}
                  size={18}
                  className="text-black"
                />
              </button>
            </div>

            <div
              className="mt-4 h-px w-full"
              style={{ background: COLORS.border }}
            />
          </>
        )}
      </div>

      {/* ── Search (only when expanded) ───────────────────────────────────── */}
      {!isCollapsed && (
        <div className="px-4 pt-3 pb-2">
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderRadius: 5, background: "#f2f2f2" }}
          >
            {/* Search icon */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              style={{ color: "#898988", flexShrink: 0 }}
            >
              <path
                d="M9 3.5C5.96243 3.5 3.5 5.96243 3.5 9C3.5 12.0376 5.96243 14.5 9 14.5C10.2402 14.5 11.3823 14.0907 12.3006 13.3996L15.2004 16.2994C15.4933 16.5923 15.9682 16.5923 16.2611 16.2994C16.554 16.0065 16.554 15.5316 16.2611 15.2387L13.3996 12.3772C14.0907 11.4589 14.5 10.3168 14.5 9C14.5 5.96243 12.0376 3.5 9 3.5ZM5 9C5 6.79086 6.79086 5 9 5C11.2091 5 13 6.79086 13 9C13 11.2091 11.2091 13 9 13C6.79086 13 5 11.2091 5 9Z"
                fill="currentColor"
              />
            </svg>
            <input
              type="text"
              placeholder="Zoek object..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent outline-none left-menu-search-input"
              style={{ fontSize: 15, color: "#000", fontFamily: "inherit" }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  color: "#898988",
                  fontSize: 16,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                aria-label="Zoekopdracht wissen"
              >
                ×
              </button>
            )}
          </div>

          {/* Preview toggle row — only visible when preview is disabled */}
          {!previewEnabled && (
            <button
              type="button"
              onClick={enablePreview}
              className="w-full flex items-center gap-2.5 hover:bg-[#f7f7f7] transition-colors cursor-pointer"
              style={{
                marginTop: 8,
                padding: "7px 10px",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                background: "#ffffff",
              }}
            >
              {/* Eye-slash icon */}
              <span style={{ color: COLORS.muted, display: "flex", flexShrink: 0 }}>
                <EyeSlashIcon size={16} />
              </span>

              {/* Labels */}
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#000000", lineHeight: 1.3 }}>
                  Voorbeeld bij hover
                </div>
                <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.3 }}>
                  Verborgen
                </div>
              </div>

              {/* Toggle switch — off state */}
              <span
                className="relative shrink-0 inline-flex h-[18px] w-[32px] items-center rounded-full"
                style={{ backgroundColor: "#D1D5DB" }}
              >
                <span
                  className="inline-block h-[14px] w-[14px] rounded-full bg-white"
                  style={{ transform: "translateX(2px)" }}
                />
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Divider between search area and category list ─────────────────── */}
      {!isCollapsed && (
        <div className="mx-4 h-px" style={{ background: COLORS.border }} />
      )}

      {/* ── Scrollable section list ─────────────────────────────────────────── */}
      <div
        className={[
          "flex-1 min-h-0 overflow-y-auto leftmenu-scroll",
          isCollapsed ? "flex flex-col items-center gap-1 py-2" : "pt-1",
        ].join(" ")}
      >
        {/* Search results */}
        {!isCollapsed && searchResults !== null ? (
          <div>
            {searchResults.length === 0 ? (
              <div
                style={{
                  padding: "20px 16px",
                  fontSize: 13,
                  color: COLORS.muted,
                  textAlign: "center",
                }}
              >
                Geen resultaten voor &ldquo;{query}&rdquo;
              </div>
            ) : (
              <>
                <div
                  style={{
                    padding: "4px 16px 6px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: COLORS.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {searchResults.length} {searchResults.length === 1 ? "resultaat" : "resultaten"}
                </div>
                {searchResults.map(({ item }) => (
                  <div key={item.id} className="px-4">
                    {renderItem(item)}
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          /* Normal section list */
          sections.map((sec) => {
            const isOpen = !isCollapsed && openSection === sec.id;

            return (
              <div
                key={sec.id}
                className={isCollapsed ? "w-full flex justify-center" : ""}
              >
                <div className={isCollapsed ? "w-full" : "w-full"}>
                  <button
                    type="button"
                    className={[
                      "w-full hover:bg-[#f2f2f2] cursor-pointer transition-colors",
                      isCollapsed
                        ? "h-11 flex items-center justify-center"
                        : "px-4 py-3 flex items-center justify-between",
                    ].join(" ")}
                    onClick={() => toggle(sec.id)}
                    style={{ color: isOpen ? COLORS.accent : "#000000" }}
                    title={isCollapsed ? sec.label : undefined}
                    aria-label={sec.label}
                  >
                    <div
                      className={
                        isCollapsed
                          ? "w-full flex items-center justify-center"
                          : "flex items-center gap-3"
                      }
                    >
                      <MaskIcon src={SECTION_ICON[sec.id]} size={16} />
                      {!isCollapsed && <span className="text-sm font-medium">{sec.label}</span>}
                    </div>

                    {!isCollapsed && (
                      <div className="flex items-center gap-1.5">
                        <CountBadge count={sec.items.length} isOpen={isOpen} />
                        <MaskIcon src={isOpen ? CHEVRON_DOWN : CHEVRON_RIGHT} size={16} />
                      </div>
                    )}
                  </button>

                  {isOpen && (
                    <div className="pb-2">
                      {sec.items.map((it) => renderItem(it))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer (view / hulp) ────────────────────────────────────────────── */}
      <div
        className={[
          "w-full border-t shrink-0",
          isCollapsed ? "py-2 flex flex-col items-center gap-1" : "",
        ].join(" ")}
        style={{ borderColor: COLORS.border, background: COLORS.bg }}
      >
        <button
          ref={viewButtonRef}
          type="button"
          onClick={toggleViewPanel}
          className={[
            "hover:bg-[#f2f2f2] cursor-pointer transition-colors",
            isCollapsed
              ? "h-11 w-full flex items-center justify-center"
              : "w-full px-4 py-3 flex items-center justify-between",
          ].join(" ")}
          title={isCollapsed ? "Weergave" : undefined}
          aria-label="Weergave"
        >
          {isCollapsed ? (
            <MaskIcon
              src="/icons/eye.svg"
              size={16}
              className="text-black"
            />
          ) : (
            <>
              <span className="text-sm">Weergave</span>
              <MaskIcon
                src={isViewPanelMounted ? CHEVRON_DOWN : CHEVRON_RIGHT}
                size={16}
                className="text-black"
              />
            </>
          )}
        </button>

        <button
          type="button"
          className={[
            "hover:bg-[#f2f2f2] cursor-pointer transition-colors",
            isCollapsed
              ? "h-11 w-full flex items-center justify-center"
              : "w-full px-4 py-3 flex items-center justify-between",
          ].join(" ")}
          title={isCollapsed ? "Hulp" : undefined}
          aria-label="Hulp"
        >
          {isCollapsed ? (
            <MaskIcon src="/icons/question.svg" size={16} className="text-black" />
          ) : (
            <>
              <span className="text-sm">Hulp</span>
              <MaskIcon src={CHEVRON_RIGHT} size={16} className="text-black" />
            </>
          )}
        </button>
      </div>

      {/* ── View panel ──────────────────────────────────────────────────────── */}
      {isViewPanelMounted && viewPanelPos && (
        <div
          ref={viewPanelRef}
          className="fixed z-[80] w-[220px] rounded-md border transition-all duration-150"
          style={{
            left: viewPanelPos.left,
            bottom: viewPanelPos.bottom,
            background: COLORS.bg,
            borderColor: "#E0DEDF",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.08)",
            opacity: isViewPanelVisible ? 1 : 0,
            transform: isViewPanelVisible
              ? "translateX(0px) translateY(0px) scale(1)"
              : "translateX(-4px) translateY(0px) scale(0.985)",
            pointerEvents: isViewPanelVisible ? "auto" : "none",
          }}
        >
          <div className="p-2 flex flex-col gap-0.5">
            {renderViewToggle("Toon nummers", "showPlantNumbers")}
            {renderViewToggle("Toon m²", "showAreaLabels")}
            {renderViewToggle("Toon plant/haagvakken", "showPlantbeds")}
            {renderViewToggle("Toon boomvakken", "showTreebeds")}
            {renderViewToggle("Toon ondergrond", "showGround")}
            {renderViewToggle("Toon gebouwen", "showBuildings")}
            {renderViewToggle("Toon verkeer & gebruik", "showTrafficUse")}
            {renderViewToggle("Toon afbakening", "showBoundaries")}
          </div>
        </div>
      )}

      {/* ── Treebed flyout ──────────────────────────────────────────────────── */}
      {isTreebedPanelMounted && treebedPanelPos && (
        <div
          ref={treebedPanelRef}
          className="fixed rounded-xl border bg-white overflow-hidden z-[80] transition-all duration-150"
          style={{
            borderColor: "#E3E2E2",
            width: 200,
            left: treebedPanelPos.left,
            top: treebedPanelPos.top,
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.08)",
            opacity: isTreebedPanelVisible ? 1 : 0,
            transform: isTreebedPanelVisible
              ? "translateX(0px) translateY(0px) scale(1)"
              : "translateX(-4px) translateY(0px) scale(0.985)",
            pointerEvents: isTreebedPanelVisible ? "auto" : "none",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <div
              style={{
                background: "#EEF0ED",
                color: "#58694C",
                fontSize: 14,
                fontWeight: 600,
                padding: "8px 10px",
              }}
            >
              Boomvorm
            </div>

            {TREEBED_VARIANTS.map((item) => {
              const hovered = hoverTreebedVariant === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: hovered ? "#f2f2f2" : "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    color: "#000000",
                    fontSize: 13,
                    fontWeight: 400,
                    lineHeight: 1,
                  }}
                  onMouseEnter={() => setHoverTreebedVariant(item.key)}
                  onMouseLeave={() =>
                    setHoverTreebedVariant((v) => (v === item.key ? null : v))
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onPickTreebedVariant(item.key);
                    closeTreebedPanel();
                  }}
                >
                  <TreebedVariantSwatch variant={item.key} size={14} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Hover preview popover ────────────────────────────────────────────── */}
      {!isCollapsed && previewEnabled && hoverType && hoverAnchorRect && (
        <HoverPreview
          type={hoverType}
          anchorRect={hoverAnchorRect}
          menuWidth={menuWidth}
          onDisable={disablePreview}
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
        />
      )}
    </div>
  );
}
