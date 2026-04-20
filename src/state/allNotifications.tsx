"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";

export type AppNotificationKind = "success" | "warning" | "info";
export type AppNotificationPlacement = "bottom-center" | "top-left";

export type AppNotificationDefinition = {
    kind: AppNotificationKind;
    placement: AppNotificationPlacement;
    message: string;
    durationMs?: number;
    notificationKey?: string;
    sticky?: boolean;
    shortcut?: string;
    onClick?: () => void;
    dismissible?: boolean;
    onDismiss?: () => void;
};

export type AppNotificationItem = {
    id: string;
    kind: AppNotificationKind;
    placement: AppNotificationPlacement;
    message: string;
    durationMs: number;
    visible: boolean;
    notificationKey?: string;
    sticky?: boolean;
    shortcut?: string;
    onClick?: () => void;
    dismissible?: boolean;
    onDismiss?: () => void;
};

export const APP_NOTIFICATION_PRESETS = {
    success: {
        bg: "#DEFFDE",
        color: "#008000",
        icon: "/icons/check-icon.svg",
        defaultDurationMs: 5000,
    },
    warning: {
        bg: "#FDFFC6",
        color: "#807300",
        icon: "/icons/info.svg",
        defaultDurationMs: 4500,
    },
    info: {
        bg: "#58694C",
        color: "#ffffff",
        icon: "/icons/info.svg",
        defaultDurationMs: 1800,
    },
} as const;

export const APP_NOTIFICATIONS = {
    plantLinkedToPlantbed: (plantName: string, plantbedNo: number | string): AppNotificationDefinition => ({
        kind: "success",
        placement: "bottom-center",
        message: `${plantName} gekoppeld aan plantvak ${plantbedNo}`,
    }),

    plantAlreadyLinkedToPlantbed: (plantbedNo: number | string): AppNotificationDefinition => ({
        kind: "warning",
        placement: "bottom-center",
        message: `Je hebt deze plant al gekoppeld aan plantvak ${plantbedNo}`,
    }),

    plantsOnlyInPlantbeds: (): AppNotificationDefinition => ({
        kind: "warning",
        placement: "bottom-center",
        message: "Je kunt de planten alleen in plantvakken slepen",
    }),

    allPlantsLinkedReadyToGenerate: (): AppNotificationDefinition => ({
        kind: "success",
        placement: "bottom-center",
        message: "Alle planten gekoppeld. Je kan nu je beplantingstekening genereren.",
    }),

    generateBlockedByUnlinkedPlants: (linked: number, total: number): AppNotificationDefinition => ({
        kind: "warning",
        placement: "bottom-center",
        message: `${linked} van ${total} planten gekoppeld. Je kunt pas genereren wanneer alle planten in een plantvak staan.`,
    }),

    chooseObjectTypeFirst: (): AppNotificationDefinition => ({
        kind: "warning",
        placement: "bottom-center",
        message: "Kies eerst een objecttype in het linker menu.",
    }),

    drawingBlockedByViewToggle: (label: string): AppNotificationDefinition => ({
        kind: "warning",
        placement: "bottom-center",
        message: `Je hebt "${label}" uitgeschakeld in Weergave. Zet deze eerst aan om dit object te tekenen.`,
    }),

    polygonNeedsAtLeastThreePoints: (): AppNotificationDefinition => ({
        kind: "warning",
        placement: "bottom-center",
        message: "Zet minimaal 3 punten (klik 3x) voordat je afsluit met Enter.",
    }),

    fenceNeedsAtLeastTwoPoints: (): AppNotificationDefinition => ({
        kind: "warning",
        placement: "bottom-center",
        message: "Zet minimaal 2 punten voordat je de schutting/hek afrondt.",
    }),

    holdShiftForStraightLines: (onDismiss?: () => void): AppNotificationDefinition => ({
        kind: "info",
        placement: "top-left",
        message: "Houd SHIFT ingedrukt om rechte lijnen te tekenen",
        notificationKey: "draw-shift-hint",
        sticky: true,
        dismissible: true,
        onDismiss,
    }),

    holdShiftForRotateSnap: (onDismiss?: () => void): AppNotificationDefinition => ({
        kind: "info",
        placement: "top-left",
        message: "Houd SHIFT ingedrukt om in stappen van 15° te roteren",
        notificationKey: "rotate-shift-hint",
        sticky: true,
        dismissible: true,
        onDismiss,
    }),

    centeredCanvas: (onClick?: () => void): AppNotificationDefinition => ({
        kind: "info",
        placement: "top-left",
        message: "Centreren",
        notificationKey: "center-canvas-hint",
        sticky: true,
        onClick,
    }),

    duplicatedSelection: (onClick?: () => void): AppNotificationDefinition => ({
        kind: "info",
        placement: "top-left",
        message: "Dupliceren",
        notificationKey: "duplicate-selection-hint",
        sticky: true,
        shortcut: "Ctrl + D",
        onClick,
    }),

    deletedSelection: (): AppNotificationDefinition => ({
        kind: "info",
        placement: "top-left",
        message: "Verwijderen",
        durationMs: 1800,
    }),

    objectTypeChanged: (fromLabel: string, toLabel: string): AppNotificationDefinition => ({
        kind: "success",
        placement: "bottom-center",
        message: `${fromLabel} gewijzigd naar '${toLabel}'`,
    }),

    treebedVariantChanged: (fromLabel: string, toLabel: string): AppNotificationDefinition => ({
        kind: "success",
        placement: "bottom-center",
        message: `${fromLabel} gewijzigd naar '${toLabel}'`,
    }),

    undoPerformed: (): AppNotificationDefinition => ({
        kind: "info",
        placement: "top-left",
        message: "Ongedaan maken",
        durationMs: 1800,
    }),

    redoPerformed: (): AppNotificationDefinition => ({
        kind: "info",
        placement: "top-left",
        message: "Opnieuw",
        durationMs: 1800,
    }),

    locationChangedWithRemovedObjects: (
        fromLocationLabel: string,
        toLocationLabel: string,
        removedObjectTitles: string[]
    ): AppNotificationDefinition => {
        const uniqueTitles = Array.from(new Set(removedObjectTitles));

        const removedLabel = (() => {
            if (uniqueTitles.length === 0) return "";
            if (uniqueTitles.length === 1) return uniqueTitles[0];
            if (uniqueTitles.length === 2) return `${uniqueTitles[0]} en ${uniqueTitles[1]}`;

            return `${uniqueTitles.slice(0, -1).join(", ")} en ${uniqueTitles[uniqueTitles.length - 1]}`;
        })();

        return {
            kind: "success",
            placement: "bottom-center",
            durationMs: 6000,
            message:
                `Locatie van '${fromLocationLabel}' naar '${toLocationLabel}' gewijzigd.\n` +
                `Hierbij zijn de objecten: ${removedLabel} verwijderd`,
        };
    },

    rightStepMenuCompleted: (): AppNotificationDefinition => ({
        kind: "success",
        placement: "bottom-center",
        durationMs: 6000,
        message:
            "Je hebt alle stappen ingevuld. Stel nu jouw plantenlijst samen voor jouw beplanting in de volgende stap"
    }),

    plantAddedToPlantList: (plantName: string): AppNotificationDefinition => ({
        kind: "success",
        placement: "bottom-center",
        durationMs: 3200,
        message: `${plantName} is toegevoegd aan de plantlijst.`,
    }),

    plantRemovedFromPlantList: (plantName: string): AppNotificationDefinition => ({
        kind: "success",
        placement: "bottom-center",
        message: `${plantName} verwijderd uit plantenlijst`,
    }),

    multiplePlantsRemovedFromPlantList: (): AppNotificationDefinition => ({
        kind: "success",
        placement: "bottom-center",
        message: "Meerdere planten verwijderd uit plantenlijst",
    }),

    plantDuplicatedInPlantList: (plantName: string): AppNotificationDefinition => ({
        kind: "success",
        placement: "bottom-center",
        message: `${plantName} gedupliceerd`,
    }),

    multiplePlantsDuplicatedInPlantList: (): AppNotificationDefinition => ({
        kind: "success",
        placement: "bottom-center",
        message: "Meerdere planten gedupliceerd",
    }),
} as const;

export type AppNotificationKey = keyof typeof APP_NOTIFICATIONS;

type NotificationStoreState = {
    items: AppNotificationItem[];
    enqueue: (definition: AppNotificationDefinition) => void;
    dismissByKey: (notificationKey: string) => void;
    setVisible: (id: string, visible: boolean) => void;
    remove: (id: string) => void;
    removeWithDismiss: (id: string) => void;
};

export const useAllNotificationsStore = create<NotificationStoreState>((set, get) => ({
    items: [],

    enqueue: (definition) =>
        set((state) => {
            const preset = APP_NOTIFICATION_PRESETS[definition.kind];
            const durationMs = definition.durationMs ?? preset.defaultDurationMs;

            if (definition.notificationKey) {
                const existing = state.items.find(
                    (item) => item.notificationKey === definition.notificationKey
                );

                if (existing) {
                    return {
                        items: state.items.map((item) =>
                            item.notificationKey === definition.notificationKey
                                ? {
                                    ...item,
                                    kind: definition.kind,
                                    placement: definition.placement,
                                    message: definition.message,
                                    durationMs,
                                    sticky: definition.sticky ?? false,
                                    shortcut: definition.shortcut,
                                    onClick: definition.onClick,
                                    dismissible: definition.dismissible ?? false,
                                    onDismiss: definition.onDismiss,
                                    visible: true,
                                }
                                : item
                        ),
                    };
                }
            }

            const nextItem: AppNotificationItem = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
                kind: definition.kind,
                placement: definition.placement,
                message: definition.message,
                durationMs,
                visible: false,
                notificationKey: definition.notificationKey,
                sticky: definition.sticky ?? false,
                shortcut: definition.shortcut,
                onClick: definition.onClick,
                dismissible: definition.dismissible ?? false,
                onDismiss: definition.onDismiss,
            };
            return {
                items: [...state.items, nextItem],
            };
        }),

    dismissByKey: (notificationKey) =>
        set((state) => ({
            items: state.items.filter((item) => item.notificationKey !== notificationKey),
        })),

    setVisible: (id, visible) =>
        set((state) => ({
            items: state.items.map((item) =>
                item.id === id ? { ...item, visible } : item
            ),
        })),

    remove: (id) =>
        set((state) => ({
            items: state.items.filter((item) => item.id !== id),
        })),

    removeWithDismiss: (id) => {
        const item = get().items.find((x) => x.id === id);
        item?.onDismiss?.();

        set((state) => ({
            items: state.items.filter((x) => x.id !== id),
        }));
    },
}));

export function useAppNotify() {
    const enqueue = useAllNotificationsStore((s) => s.enqueue);

    return useCallback(
        (definition: AppNotificationDefinition) => {
            enqueue(definition);
        },
        [enqueue]
    );
}

export function useDismissAppNotification() {
    const dismissByKey = useAllNotificationsStore((s) => s.dismissByKey);

    return useCallback(
        (notificationKey: string) => {
            dismissByKey(notificationKey);
        },
        [dismissByKey]
    );
}

const NOTICE_FADE_MS = 250;
const MAX_STACK_VISIBLE = 3;

const HINT_MARGIN = 16;
const LEFT_MENU_WIDTH = 260;
const TOP_LEFT_HINT_MAX_WIDTH = 360;


export function AppNotificationsRenderer(props?: {
    topLeftLeftOffset?: number;
}) {
    const items = useAllNotificationsStore((s) => s.items);
    const setVisible = useAllNotificationsStore((s) => s.setVisible);
    const remove = useAllNotificationsStore((s) => s.remove);
    const removeWithDismiss = useAllNotificationsStore((s) => s.removeWithDismiss);

    const fadeTimerByIdRef = useRef<Record<string, number>>({});
    const removeTimerByIdRef = useRef<Record<string, number>>({});
    const bootstrappedIdsRef = useRef<Set<string>>(new Set());

    const removeWithFade = useCallback(
        (id: string) => {
            if (removeTimerByIdRef.current[id]) return;

            const fadeTimerId = fadeTimerByIdRef.current[id];
            if (fadeTimerId) {
                window.clearTimeout(fadeTimerId);
                delete fadeTimerByIdRef.current[id];
            }

            setVisible(id, false);

            const removeTimerId = window.setTimeout(() => {
                remove(id);
                delete removeTimerByIdRef.current[id];
            }, NOTICE_FADE_MS);

            removeTimerByIdRef.current[id] = removeTimerId;
        },
        [remove, setVisible]
    );

    useEffect(() => {
        for (const item of items) {
            if (bootstrappedIdsRef.current.has(item.id)) continue;
            bootstrappedIdsRef.current.add(item.id);

            requestAnimationFrame(() => {
                setVisible(item.id, true);
            });

            if (!item.sticky) {
                const fadeTimerId = window.setTimeout(() => {
                    setVisible(item.id, false);

                    const removeTimerId = window.setTimeout(() => {
                        remove(item.id);
                        delete removeTimerByIdRef.current[item.id];
                    }, NOTICE_FADE_MS);

                    removeTimerByIdRef.current[item.id] = removeTimerId;
                }, item.durationMs);

                fadeTimerByIdRef.current[item.id] = fadeTimerId;
            }
        }

        const placements: AppNotificationPlacement[] = ["bottom-center", "top-left"];

        for (const placement of placements) {
            const visibleItems = items.filter(
                (item) => item.placement === placement && item.visible
            );

            if (visibleItems.length > MAX_STACK_VISIBLE) {
                const overflowCount = visibleItems.length - MAX_STACK_VISIBLE;
                visibleItems.slice(0, overflowCount).forEach((item) => {
                    removeWithFade(item.id);
                });
            }
        }
    }, [items, remove, removeWithFade, setVisible]);

    useEffect(() => {
        return () => {
            Object.values(fadeTimerByIdRef.current).forEach((id) => window.clearTimeout(id));
            Object.values(removeTimerByIdRef.current).forEach((id) => window.clearTimeout(id));
        };
    }, []);

    const bottomCenterItems = items
        .filter((item) => item.placement === "bottom-center")
        .slice(-4);

    const topLeftItems = items
        .filter((item) => item.placement === "top-left")
        .slice(-4);

    const resolvedTopLeftOffset = props?.topLeftLeftOffset ?? (LEFT_MENU_WIDTH + HINT_MARGIN);

    return (
        <>
            {topLeftItems.length > 0 && (
                <div
                    className="fixed top-[72px] z-[140] pointer-events-none flex flex-col items-start gap-2"
                    style={{
                        left: resolvedTopLeftOffset,
                        maxWidth: TOP_LEFT_HINT_MAX_WIDTH,
                    }}
                >
                    {topLeftItems.map((item) => {
                        const preset = APP_NOTIFICATION_PRESETS[item.kind];
                        const isInteractive = !!item.onClick || !!item.dismissible;

                        const content = (
                            <>
                                <img
                                    src={preset.icon}
                                    alt=""
                                    className="h-4 w-4 shrink-0"
                                    style={{
                                        filter: item.kind === "info" ? "brightness(0) invert(1)" : "none",
                                    }}
                                />
                                <span>{item.message}</span>

                                {item.shortcut && (
                                    <span
                                        style={{
                                            color: "#A3B497",
                                            marginLeft: 20,
                                            fontWeight: 400,
                                        }}
                                    >
                                        {item.shortcut}
                                    </span>
                                )}
                            </>
                        );

                        return (
                            <div
                                key={item.id}
                                style={{
                                    opacity: item.visible ? 1 : 0,
                                    transition: `opacity ${NOTICE_FADE_MS}ms ease`,
                                    pointerEvents: isInteractive ? "auto" : "none",
                                    width: "100%",
                                    maxWidth: TOP_LEFT_HINT_MAX_WIDTH,
                                }}
                            >
                                <div
                                    className="flex items-center rounded-md shadow-sm text-sm overflow-hidden"
                                    style={{
                                        background: preset.bg,
                                        color: preset.color,
                                        width: "100%",
                                        maxWidth: TOP_LEFT_HINT_MAX_WIDTH,
                                    }}
                                >
                                    {item.onClick ? (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                item.onClick?.();
                                            }}
                                            className="flex items-center gap-3 px-4 py-3 border-0"
                                            style={{
                                                background: "transparent",
                                                color: "inherit",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {content}
                                        </button>
                                    ) : (
                                        <div
                                            className="flex items-center gap-3 px-4 py-3"
                                            style={{
                                                background: "transparent",
                                                color: "inherit",
                                            }}
                                        >
                                            {content}
                                        </div>
                                    )}

                                    {item.dismissible && (
                                        <>
                                            <div
                                                style={{
                                                    width: 1,
                                                    alignSelf: "stretch",
                                                    background:
                                                        item.kind === "info"
                                                            ? "rgba(255,255,255,0.18)"
                                                            : "rgba(0,0,0,0.08)",
                                                }}
                                            />

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    item.onDismiss?.();
                                                    removeWithFade(item.id);
                                                }}
                                                className="flex items-center justify-center px-4 py-3 border-0"
                                                style={{
                                                    background: "transparent",
                                                    color: "inherit",
                                                    cursor: "pointer",
                                                    fontSize: 16,
                                                    lineHeight: 1,
                                                    width: 36,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                                aria-label="Sluiten"
                                            >
                                                ×
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {bottomCenterItems.length > 0 && (
                <div
                    className="fixed left-1/2 z-[140] -translate-x-1/2 pointer-events-none w-full flex justify-center"
                    style={{ bottom: "var(--app-bottom-center-offset, 24px)" }}
                >
                    <div className="flex flex-col items-center gap-2 max-w-[800px]">
                        {bottomCenterItems.map((item) => {
                            const preset = APP_NOTIFICATION_PRESETS[item.kind];

                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        opacity: item.visible ? 1 : 0,
                                        transition: `opacity ${NOTICE_FADE_MS}ms ease`,
                                    }}
                                >
                                    <div
                                        className="flex items-center gap-3 px-6 py-3 rounded-md shadow-sm text-sm max-w-[800px]"
                                        style={{
                                            background: preset.bg,
                                            color: preset.color,
                                            border: "1px solid #E3E2E2",
                                        }}
                                    >
                                        <img src={preset.icon} alt="" className="h-4 w-4 shrink-0" />
                                        <span style={{ whiteSpace: "pre-line" }}>{item.message}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}