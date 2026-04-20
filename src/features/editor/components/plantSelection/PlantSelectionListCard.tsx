"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    usePlantSelectionStore,
    type PlantListItem,
} from "@/features/editor/state/plantSelectionStore";
import { APP_NOTIFICATIONS, useAppNotify } from "@/state/allNotifications";
import ConfirmModal from "@/features/editor/components/ConfirmModal";

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    borderSoft: "#E0DEDF",
    green: "#58694C",
    greenLight: "#EEF0ED",
    orange: "#E94E1B",
    muted: "#6B7280",
    text: "#111111",
    searchBg: "#F2F2F2",
    searchText: "#898988",
};

const DUMMY_SIZE_OPTIONS = [
    "15-20 cm C1",
    "125-150 cm C10",
    "10-12HO draadkluit leivorm",
] as const;

function ProductRowNote(props: {
    value: string;
    onSave: (value: string) => void;
}) {
    const { value, onSave } = props;
    const [isEditing, setIsEditing] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [draftValue, setDraftValue] = useState(value);

    useEffect(() => {
        setDraftValue(value);
        if (value.length === 0) {
            setIsEditing(true);
            setIsFocused(false);
        }
    }, [value]);

    const handleSave = () => {
        const nextValue = draftValue.trim();
        onSave(nextValue);
        setIsFocused(false);
        setIsEditing(nextValue.length === 0);
    };

    if (!isEditing && value.length > 0) {
        return (
            <div
                className="flex h-[108px] items-start justify-between gap-3 overflow-hidden rounded-[4px] px-3 py-3 text-[14px]"
                style={{ color: COLORS.text }}
            >
                <span
                    className="min-w-0 flex-1 whitespace-normal leading-[1.35]"
                    style={{
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                    }}
                >
                    {value}
                </span>

                <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="shrink-0 cursor-pointer"
                    style={{ cursor: "pointer" }}
                >
                    <img
                        src="/icons/edit.svg"
                        alt=""
                        style={{
                            width: 16,
                            height: 16,
                            display: "block",
                            cursor: "pointer",
                        }}
                    />
                </button>
            </div>
        );
    }

    return (
        <div
            className="relative rounded-[4px] border bg-white"
            style={{
                height: 108,
                minHeight: 108,
                maxHeight: 108,
                borderColor: isFocused ? COLORS.orange : COLORS.borderSoft,
            }}
        >
            <textarea
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={handleSave}
                placeholder=""
                className="block h-full w-full resize-none overflow-hidden bg-transparent px-3 py-3 pr-10 text-[14px] leading-[1.35] outline-none"
                style={{
                    color: COLORS.text,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                }}
            />

            {!isEditing ? null : (
                <button
                    type="button"
                    onMouseDown={(event) => {
                        event.preventDefault();
                        setIsEditing(true);
                        setIsFocused(true);
                    }}
                    className="absolute right-[12px] top-[12px] cursor-pointer"
                    style={{
                        display: draftValue.length > 0 || isFocused ? "none" : "block",
                    }}
                >
                    <img
                        src="/icons/edit.svg"
                        alt=""
                        style={{
                            width: 16,
                            height: 16,
                            display: "block",
                            cursor: "pointer",
                        }}
                    />
                </button>
            )}
        </div>
    );
}
function AdviceBlock(props: {
    value: string;
    stacked?: boolean;
}) {
    const { value, stacked = false } = props;

    return (
        <div
            className="mt-3 flex min-h-[52px] gap-2 rounded-[4px] border px-3 py-2 text-[14px]"
            style={{
                backgroundColor: COLORS.greenLight,
                borderColor: COLORS.borderSoft,
                alignItems: stacked ? "flex-start" : "center",
            }}
        >
            <img
                src="/icons/help.svg"
                alt=""
                style={{
                    width: 18,
                    height: 18,
                    display: "block",
                    flex: "0 0 auto",
                    marginTop: stacked ? 1 : 0,
                }}
            />

            {stacked ? (
                <div className="leading-[1.3]">
                    <div
                        className="font-semibold"
                        style={{ color: COLORS.green }}
                    >
                        Ons advies:
                    </div>
                    <div style={{ color: COLORS.text }}>{value}</div>
                </div>
            ) : (
                <>
                    <span
                        className="font-semibold"
                        style={{ color: COLORS.green }}
                    >
                        Ons advies:
                    </span>

                    <span style={{ color: COLORS.text }}>{value}</span>
                </>
            )}
        </div>
    );
}

export default function PlantSelectionListCard() {
    const items = usePlantSelectionStore((s) => s.plantListItems);
    const setPlantListItems = usePlantSelectionStore((s) => s.setPlantListItems);
    const notify = useAppNotify();

    const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortValue, setSortValue] = useState("");

    const visibleItems = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        let nextItems = items.filter((item) => {
            if (!normalizedQuery) return true;

            return (
                item.plant.name.toLowerCase().includes(normalizedQuery) ||
                item.plant.latinName.toLowerCase().includes(normalizedQuery)
            );
        });

        nextItems = [...nextItems].sort((a, b) => {
            const compareValue = a.plant.name.localeCompare(b.plant.name);

            return sortValue === "naam-z-a" ? compareValue * -1 : compareValue;
        });

        return nextItems;
    }, [items, searchQuery, sortValue]);

    const selectedCount = useMemo(() => {
        return items.filter((item) => item.isSelected).length;
    }, [items]);

    const selectedItems = useMemo(() => {
        return items.filter((item) => item.isSelected);
    }, [items]);

    const totalQuantity = useMemo(() => {
        return items.reduce((sum, item) => sum + item.quantity, 0);
    }, [items]);

    const allSelected = items.length > 0 && items.every((item) => item.isSelected);

    const updateItem = (itemId: string, updater: (item: PlantListItem) => PlantListItem) => {
        setPlantListItems(items.map((item) => (item.id === itemId ? updater(item) : item)));
    };

    const handleToggleSelectAll = () => {
        const nextSelectedState = !allSelected;

        setPlantListItems(
            items.map((item) => ({
                ...item,
                isSelected: nextSelectedState,
            }))
        );
    };

    const handleToggleRow = (itemId: string) => {
        updateItem(itemId, (item) => ({
            ...item,
            isSelected: !item.isSelected,
        }));
    };

    const handleRemoveSelected = () => {
        if (selectedItems.length === 0) return;
        setIsRemoveConfirmOpen(true);
    };

    const handleCancelRemoveSelected = () => {
        setIsRemoveConfirmOpen(false);
    };

    const handleConfirmRemoveSelected = () => {
        if (selectedItems.length === 0) {
            setIsRemoveConfirmOpen(false);
            return;
        }

        setPlantListItems(items.filter((item) => !item.isSelected));
        setIsRemoveConfirmOpen(false);

        if (selectedItems.length === 1) {
            notify(APP_NOTIFICATIONS.plantRemovedFromPlantList(selectedItems[0].plant.name));
            return;
        }

        notify(APP_NOTIFICATIONS.multiplePlantsRemovedFromPlantList());
    };

    const handleDuplicateSelected = () => {
        const selectedItems = items.filter((item) => item.isSelected);
        if (selectedItems.length === 0) return;

        const duplicatedItems = selectedItems.map((item) => ({
            ...item,
            id: `${item.id}-copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            isSelected: false,
        }));

        const clearedOriginalItems = items.map((item) => ({
            ...item,
            isSelected: false,
        }));

        setPlantListItems([...clearedOriginalItems, ...duplicatedItems]);

        if (selectedItems.length === 1) {
            notify(APP_NOTIFICATIONS.plantDuplicatedInPlantList(selectedItems[0].plant.name));
            return;
        }

        notify(APP_NOTIFICATIONS.multiplePlantsDuplicatedInPlantList());
    };

    const handleChangeSize = (itemId: string, value: string) => {
        updateItem(itemId, (item) => ({
            ...item,
            size: value,
        }));
    };

    const handleChangeNote = (itemId: string, value: string) => {
        updateItem(itemId, (item) => ({
            ...item,
            note: value,
        }));
    };

    const handleChangeQuantity = (itemId: string, value: string) => {
        const parsedValue = Number(value.replace(/\D/g, ""));

        updateItem(itemId, (item) => ({
            ...item,
            quantity: Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0,
        }));
    };

    const handleIncreaseQuantity = (itemId: string) => {
        updateItem(itemId, (item) => ({
            ...item,
            quantity: item.quantity + 1,
        }));
    };

    const handleDecreaseQuantity = (itemId: string) => {
        updateItem(itemId, (item) => ({
            ...item,
            quantity: Math.max(0, item.quantity - 1),
        }));
    };

    const renderCheckbox = (checked: boolean) => (
        <img
            src={checked ? "/icons/checkbox-checked.svg" : "/icons/checkbox-unchecked.svg"}
            alt=""
            style={{
                width: 20,
                height: 20,
                display: "block",
                flex: "0 0 auto",
            }}
        />
    );

    return (
        <section
            className="rounded-[10px] border p-5"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor: COLORS.border,
                boxShadow: "5px 3px 46px -25px rgba(0, 0, 0, 0.25)",
            }}
        >
            <h2
                className="text-[22px] font-semibold"
                style={{ color: COLORS.green }}
            >
                Plantenlijst
            </h2>

            <p
                className="mt-3 text-[14px]"
                style={{ color: COLORS.text }}
            >
                In de plantenlijst bepaal je de aantallen en maten voor je definitieve plan.
            </p>

            {items.length === 0 ? (
                <div
                    className="mt-5 h-px w-full"
                    style={{ backgroundColor: COLORS.border }}
                />
            ) : null}

            {items.length === 0 ? (
                <>
                    <div
                        className="flex min-h-[340px] items-center justify-center rounded-[6px]"
                        style={{ color: "#B0B0B0" }}
                    >
                        <span className="text-center text-[16px]">
                            Kies een plant of boom hierboven om de plantenlijst te vullen
                        </span>
                    </div>

                    <div
                        className="h-px w-full"
                        style={{ backgroundColor: COLORS.border }}
                    />

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            disabled
                            className="h-[48px] rounded-[6px] px-8 text-[15px] font-semibold text-white"
                            style={{
                                minWidth: 144,
                                backgroundColor: "#F4C8B8",
                                color: "#CC8D75",
                                cursor: "not-allowed",
                            }}
                        >
                            Koppel de planten in mijn tekening
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-wrap items-center gap-5">
                                <button
                                    type="button"
                                    onClick={handleToggleSelectAll}
                                    className="flex cursor-pointer items-center gap-2 text-[14px]"
                                    style={{ color: COLORS.text }}
                                >
                                    {renderCheckbox(allSelected)}
                                    <span>Selecteer alles</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleRemoveSelected}
                                    disabled={selectedCount === 0}
                                    className="flex items-center gap-2 text-[14px]"
                                    style={{
                                        color: COLORS.text,
                                        opacity: selectedCount === 0 ? 0.5 : 1,
                                        cursor: selectedCount === 0 ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <img
                                        src="/icons/delete-tool.svg"
                                        alt=""
                                        style={{
                                            width: 16,
                                            height: 16,
                                            display: "block",
                                        }}
                                    />
                                    <span>Verwijder ({selectedCount})</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleDuplicateSelected}
                                    disabled={selectedCount === 0}
                                    className="flex items-center gap-2 text-[14px]"
                                    style={{
                                        color: COLORS.text,
                                        opacity: selectedCount === 0 ? 0.5 : 1,
                                        cursor: selectedCount === 0 ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <img
                                        src="/icons/duplicate.svg"
                                        alt=""
                                        style={{
                                            width: 16,
                                            height: 16,
                                            display: "block",
                                        }}
                                    />
                                    <span>Dupliceren ({selectedCount})</span>
                                </button>
                            </div>

                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <div
                                className="flex h-[44px] min-w-[290px] items-center gap-3 rounded-[4px] px-4"
                                style={{ backgroundColor: COLORS.searchBg }}
                            >
                                <img
                                    src="/icons/search.svg"
                                    alt=""
                                    style={{
                                        width: 18,
                                        height: 18,
                                        display: "block",
                                        opacity: 0.7,
                                    }}
                                />

                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Zoeken in plantenlijst..."
                                    className="h-full w-full bg-transparent text-[14px] outline-none"
                                    style={{ color: COLORS.searchText }}
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <label
                                    htmlFor="plant-list-sort"
                                    className="text-[14px]"
                                    style={{ color: COLORS.text }}
                                >
                                    Sorteren op
                                </label>

                                <div className="relative">
                                        <select
                                            id="plant-list-sort"
                                            value={sortValue}
                                            onChange={(event) => setSortValue(event.target.value)}
                                            className="h-[40px] min-w-[140px] appearance-none rounded-[4px] border bg-white pl-4 pr-10 text-[14px] font-semibold outline-none"
                                            style={{
                                                borderColor: COLORS.borderSoft,
                                                color: COLORS.text,
                                                cursor: "pointer",
                                            }}
                                        >
                                            <option value="">Geen sortering</option>
                                            <option value="naam-a-z">Naam (A-Z)</option>
                                            <option value="naam-z-a">Naam (Z-A)</option>
                                        </select>

                                    <img
                                        src="/icons/chevron-down.svg"
                                        alt=""
                                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                                        style={{
                                            width: 16,
                                            height: 16,
                                            display: "block",
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 overflow-x-auto">
                        <div className="min-w-[1120px]">
                                <div
                                    className="grid items-center gap-4 pb-4 text-[15px] font-semibold"
                                    style={{
                                        gridTemplateColumns: "32px 108px minmax(180px,1fr) minmax(220px,0.95fr) minmax(130px,0.75fr) minmax(180px,180px) 28px",
                                        color: COLORS.text,
                                    }}
                                >
                                <div />
                                <div>Product</div>
                                <div>Plantnaam</div>
                                <div>Maatvoering</div>
                                <div>Notitie</div>
                                <div>Aantal</div>
                                <div />
                            </div>

                            <div
                                className="h-px w-full"
                                style={{ backgroundColor: COLORS.borderSoft }}
                            />

                            {visibleItems.map((item) => (
                                <div key={item.id}>
                                    <div
                                        className="grid items-start gap-4 py-4"
                                        style={{
                                            gridTemplateColumns: "32px 108px minmax(180px,1fr) minmax(220px,0.95fr) minmax(130px,0.75fr) minmax(180px,180px) 28px",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleToggleRow(item.id)}
                                            className="mt-9 flex cursor-pointer justify-center"
                                        >
                                            {renderCheckbox(item.isSelected)}
                                        </button>

                                        <div className="pt-1">
                                            <div
                                                className="overflow-hidden rounded-[2px]"
                                                style={{
                                                    width: 108,
                                                    height: 108,
                                                    backgroundColor: "#F1F1EE",
                                                }}
                                            >
                                                <img
                                                    src={item.plant.imageSrc}
                                                    alt={item.plant.name}
                                                    className="block h-full w-full"
                                                    style={{
                                                        objectFit: "cover",
                                                        objectPosition: "center",
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex min-h-[108px] flex-col pt-1">
                                            <div
                                                className="text-[15px] font-semibold leading-[1.35]"
                                                style={{ color: COLORS.text }}
                                            >
                                                {item.plant.name}
                                            </div>

                                            <div
                                                className="mt-1 text-[14px] leading-[1.35]"
                                                style={{ color: COLORS.text }}
                                            >
                                                {item.plant.latinName}
                                            </div>

                                            <button
                                                type="button"
                                                className="mt-auto inline-flex cursor-pointer items-center gap-2 text-[14px]"
                                                style={{ color: COLORS.orange }}
                                            >
                                                <img
                                                    src="/icons/info.svg"
                                                    alt=""
                                                    style={{
                                                        width: 16,
                                                        height: 16,
                                                        display: "block",
                                                        filter:
                                                            "brightness(0) saturate(100%) invert(51%) sepia(84%) saturate(3601%) hue-rotate(6deg) brightness(95%) contrast(93%)",
                                                    }}
                                                />
                                                <span>Bekijk plantspecificaties</span>
                                            </button>
                                        </div>

                                        <div className="pt-2">
                                            <div className="relative">
                                                <select
                                                    value={item.size}
                                                    onChange={(event) =>
                                                        handleChangeSize(item.id, event.target.value)
                                                    }
                                                    className="h-[44px] w-full appearance-none rounded-[4px] border bg-white pl-3 pr-10 text-[14px] outline-none"
                                                    style={{
                                                        borderColor: COLORS.borderSoft,
                                                        color: COLORS.text,
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    {DUMMY_SIZE_OPTIONS.map((option) => (
                                                        <option key={option} value={option}>
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>

                                                <img
                                                    src="/icons/chevron-down.svg"
                                                    alt=""
                                                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                                                    style={{
                                                        width: 16,
                                                        height: 16,
                                                        display: "block",
                                                    }}
                                                />
                                            </div>

                                            <AdviceBlock value="15-20 cm C1" />
                                        </div>

                                        <div className="pt-2 self-stretch">
                                            <ProductRowNote
                                                value={item.note}
                                                onSave={(value) => handleChangeNote(item.id, value)}
                                            />
                                        </div>

                                        <div className="pt-2 min-w-0">
                                            <div
                                                className="grid h-[44px] w-full min-w-0 overflow-visible rounded-[4px] border"
                                                style={{
                                                    gridTemplateColumns: "minmax(0,1fr) 32px",
                                                    borderColor: COLORS.borderSoft,
                                                }}
                                            >
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={item.quantity}
                                                    onChange={(event) =>
                                                        handleChangeQuantity(item.id, event.target.value)
                                                    }
                                                    className="h-full w-full min-w-0 bg-white px-3 text-center text-[14px] outline-none"
                                                    style={{ color: COLORS.text }}
                                                />

                                                <div
                                                    className="grid h-full w-[32px] min-w-[32px] border-l"
                                                    style={{
                                                        gridTemplateRows: "1fr 1fr",
                                                        borderColor: COLORS.borderSoft,
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleIncreaseQuantity(item.id)}
                                                        className="flex h-full w-full cursor-pointer items-center justify-center border-b text-[14px] leading-none"
                                                        style={{ borderColor: COLORS.borderSoft }}
                                                    >
                                                        +
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleDecreaseQuantity(item.id)}
                                                        className="flex h-full w-full cursor-pointer items-center justify-center text-[14px] leading-none"
                                                    >
                                                        –
                                                    </button>
                                                </div>
                                            </div>

                                            <AdviceBlock value="120 stuks" stacked />
                                        </div>

                                        <div className="flex h-full items-center justify-center pt-2">
                                            <img
                                                src="/icons/drag-handle.svg"
                                                alt=""
                                                style={{
                                                    width: 18,
                                                    height: 18,
                                                    display: "block",
                                                    opacity: 0.9,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div
                                        className="h-px w-full"
                                        style={{ backgroundColor: COLORS.borderSoft }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div
                                className="text-[14px]"
                                style={{ color: COLORS.text }}
                            >
                                Totaal aantal planten:{" "}
                                <span className="font-semibold">{totalQuantity}</span>
                            </div>

                        <button
                            type="button"
                            className="h-[48px] rounded-[6px] px-8 text-[15px] font-semibold text-white"
                            style={{
                                minWidth: 144,
                                backgroundColor: items.length === 0 ? "#F4C8B8" : COLORS.orange,
                                color: items.length === 0 ? "#CC8D75" : "#FFFFFF",
                                cursor: items.length === 0 ? "not-allowed" : "pointer",
                            }}
                            disabled={items.length === 0}
                        >
                            Koppel de planten in mijn tekening
                        </button>
                    </div>
                </>
            )}
            <ConfirmModal
                open={isRemoveConfirmOpen}
                title={selectedItems.length === 1 ? "Product regel verwijderen" : "Product regels verwijderen"}
                description={
                    selectedItems.length === 1
                        ? "Weet je zeker dat je deze regel wilt verwijderen?"
                        : "Weet je zeker dat je deze regels wilt verwijderen?"
                }
                cancelText="Nee, ga terug"
                confirmText="Ja, verwijder"
                onCancel={handleCancelRemoveSelected}
                onConfirm={handleConfirmRemoveSelected}
            />
        </section>
    );
}