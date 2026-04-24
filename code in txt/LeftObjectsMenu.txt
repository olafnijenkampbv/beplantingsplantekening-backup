import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ObjectType, OBJECT_STYLES, TreebedVariant, useProjectStore, ViewVisibilityKey } from "@/state/projectStore";
import TreebedVariantSwatch from "@/features/editor/components/TreebedVariantSwatch";
import { isBuildingObjectType } from "@/features/editor/components/editor/objectMenuConfig";
import {
  getObjectMenuSections,
  TREEBED_VARIANTS,
  type ObjectMenuSection as Section,
} from "@/features/editor/components/editor/objectMenuConfig";

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

export default function LeftObjectsMenu(props: Props) {
  const sections: Section[] = useMemo(
    () => getObjectMenuSections(props.locationType),
    [props.locationType]
  );

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [openSection, setOpenSection] = useState<Section["id"] | null>("ondergrond");

  const toggle = (id: Section["id"]) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setOpenSection(id);
      return;
    }

    setOpenSection((current) => (current === id ? null : id));
  };

  const viewVisibility = useProjectStore((s) => s.viewVisibility);
  const toggleViewVisibility = useProjectStore((s) => s.toggleViewVisibility);

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
    };
  }, []);

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

  return (
    <div
      ref={rootRef}
      className="h-full border-r relative flex flex-col overflow-visible"
      style={{
        width: isCollapsed ? 54 : 260,
        background: COLORS.bg,
        borderColor: COLORS.border,
      }}
    >
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

      <div
        className={[
          "mt-2 flex-1 min-h-0 overflow-y-auto leftmenu-scroll",
          isCollapsed ? "flex flex-col items-center gap-1 py-2" : "",
        ].join(" ")}
      >
        {sections.map((sec) => {
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
                    <MaskIcon src={isOpen ? CHEVRON_DOWN : CHEVRON_RIGHT} size={16} />
                  )}
                </button>

                {isOpen && (
                  <div className="pb-2">
                    {sec.items.map((it) => {
                      const active = props.activeDrawType === it.id;
                      const isBuilding = isBuildingObjectType(it.id);

                      const swatchFill = OBJECT_STYLES[it.id].fill;

                      if (it.id === "treebed") {
                        return (
                          <button
                            key={it.id}
                            ref={treebedButtonRef}
                            type="button"
                            onClick={toggleTreebedPanel}
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
                              <span>{it.label}</span>
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
                          onClick={() => props.onPickDrawType(it.id)}
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
                          <span
                            className="h-3 w-3 border"
                            style={{
                              borderRadius: "2px",
                              backgroundColor: OBJECT_STYLES[it.id].fill,
                              borderColor: OBJECT_STYLES[it.id].stroke,
                              backgroundImage: isBuilding
                                ? `linear-gradient(
                                    135deg,
                                    transparent 0%,
                                    transparent 35%,
                                    ${OBJECT_STYLES[it.id].stroke} 35%,
                                    ${OBJECT_STYLES[it.id].stroke} 40%,
                                    transparent 40%,
                                    transparent 60%,
                                    ${OBJECT_STYLES[it.id].stroke} 60%,
                                    ${OBJECT_STYLES[it.id].stroke} 65%,
                                    transparent 65%,
                                    transparent 100%
                                  )`
                                : undefined,
                              backgroundRepeat: "no-repeat",
                              backgroundSize: "100% 100%",
                              backgroundPosition: "center",
                            }}
                          />
                          <span>{it.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
    </div>
  );
}