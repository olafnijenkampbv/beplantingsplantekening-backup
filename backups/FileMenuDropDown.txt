import React, { useEffect, useRef, useState } from "react";

type Props = {
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;

    drawingName: string;
    createdAtLabel: string;
    createdByLabel: string;
    onDrawingNameChange?: (nextName: string) => boolean;

    onNew: () => void;
    onOpen: () => void;
    onSave: () => void;
};

const FileMenuDropdown: React.FC<Props> = ({
    isOpen,
    onToggle,
    onClose,
    drawingName,
    createdAtLabel,
    createdByLabel,
    onDrawingNameChange,
    onNew,
    onOpen,
    onSave,
}) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const nameInputRef = useRef<HTMLInputElement | null>(null);

    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [isNameHovered, setIsNameHovered] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [localDrawingName, setLocalDrawingName] = useState(drawingName);
    const [shouldSelectAllOnFocus, setShouldSelectAllOnFocus] = useState(false);
    const [nameError, setNameError] = useState("");

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (!ref.current) return;
            if (!ref.current.contains(e.target as Node)) {
                onClose();
            }
        }

        function handleEsc(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleEsc);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEsc);
        };
    }, [isOpen, onClose]);

    const items = [
        { label: "Begin nieuwe tekening", shortcut: "Ctrl + N", icon: "/icons/new-drawing.svg", onClick: onNew },
        { label: "Mijn tekeningen", shortcut: "Ctrl + O", icon: "/icons/folder.svg", onClick: onOpen },
        { label: "Opslaan", shortcut: "Ctrl + S", icon: "/icons/save.svg", onClick: onSave },
    ];

    useEffect(() => {
        setLocalDrawingName(drawingName);
        setNameError("");
    }, [drawingName]);

    const activateNameEditing = () => {
        setShouldSelectAllOnFocus(true);
        setIsEditingName(true);

        requestAnimationFrame(() => {
            if (!nameInputRef.current) return;
            nameInputRef.current.focus();
        });
    };

    const resetNameInputView = () => {
        requestAnimationFrame(() => {
            if (!nameInputRef.current) return;

            nameInputRef.current.scrollLeft = 0;

            try {
                nameInputRef.current.setSelectionRange(0, 0);
            } catch { }
        });
    };

    const commitNameChange = () => {
        const trimmed = localDrawingName.trim();
        const nextName = trimmed.length > 0 ? trimmed : drawingName;

        if (nextName !== localDrawingName) {
            setLocalDrawingName(nextName);
        }

        const duplicateExists =
            nextName.trim().toLowerCase() !== drawingName.trim().toLowerCase() &&
            onDrawingNameChange?.(nextName) === false;

        if (duplicateExists) {
            setNameError("Er bestaat al een tekening met deze naam");
            return;
        }

        setNameError("");
        setIsEditingName(false);
        setShouldSelectAllOnFocus(false);
        resetNameInputView();
    };
    return (
        <div
            ref={ref}
            style={{
                position: "absolute",
                left: 16,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 70,
            }}
        >
            {/* Button */}
            <button
                type="button"
                onClick={onToggle}
                style={{
                    height: 28,
                    padding: "0 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "transparent",
                    border: "none",
                    color: "#ffffff",
                    cursor: "pointer",
                    borderRadius: 8,
                    fontSize: 14,
                }}
            >
                <img
                    src="/icons/file.svg"
                    style={{
                        width: 16,
                        height: 16,
                        filter: "brightness(0) invert(1)",
                    }}
                />
                <span>Bestand</span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div
                    style={{
                        position: "absolute",
                        top: 42,
                        left: -16,
                        width: 300,
                        background: "#ffffff",
                        border: "1px solid #E4E2E3",
                        borderTop: "none",
                        borderRadius: "0 0 10px 10px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
                        overflow: "hidden",
                    }}
                >
                    {/* Header */}
                    <div style={{ padding: "14px 16px 12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={localDrawingName}
                                onChange={(e) => {
                                    setLocalDrawingName(e.target.value);
                                    setNameError("");
                                }}
                                onFocus={() => {
                                    setIsEditingName(true);

                                    if (shouldSelectAllOnFocus) {
                                        requestAnimationFrame(() => {
                                            nameInputRef.current?.select();
                                            setShouldSelectAllOnFocus(false);
                                        });
                                    }
                                }}
                                onClick={() => {
                                    if (!isEditingName) {
                                        setShouldSelectAllOnFocus(true);
                                        activateNameEditing();
                                    }
                                }}
                                onBlur={() => commitNameChange()}
                                onMouseEnter={() => setIsNameHovered(true)}
                                onMouseLeave={() => setIsNameHovered(false)}
                                onKeyDown={(e) => {
                                    e.stopPropagation();

                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        commitNameChange();
                                        nameInputRef.current?.blur();
                                    }

                                    if (e.key === "Escape") {
                                        e.preventDefault();
                                        setLocalDrawingName(drawingName);
                                        setNameError("");
                                        setIsEditingName(false);
                                        setShouldSelectAllOnFocus(false);
                                        resetNameInputView();
                                        nameInputRef.current?.blur();
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    width: 0,
                                    border: "none",
                                    outline: "none",
                                    background: "transparent",
                                    padding: "0 0 10px 0",
                                    margin: 0,
                                    fontSize: 17,
                                    fontWeight: 600,
                                    lineHeight: 1.2,
                                    color: "#2B2B2B",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    borderBottom:
                                        isEditingName
                                            ? "1px solid #E94E1B"
                                            : isNameHovered
                                                ? "1px solid #000000"
                                                : "1px solid transparent",
                                    transition: "border-color 0.15s ease",
                                    cursor: "text",
                                }}
                            />

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    activateNameEditing();
                                }}
                                style={{
                                    width: 22,
                                    height: 22,
                                    padding: 0,
                                    border: "none",
                                    background: "transparent",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    flexShrink: 0,
                                }}
                            >
                                <img
                                    src="/icons/edit.svg"
                                    style={{
                                        width: 18,
                                        height: 18,
                                        flexShrink: 0,
                                        transform: "translateY(-6px)",
                                        filter:
                                            isEditingName
                                                ? "brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(3212%) hue-rotate(10deg) brightness(97%) contrast(88%)"
                                                : "none",
                                        transition: "filter 0.18s ease, transform 0.15s ease",
                                    }}
                                />
                            </button>
                        </div>

                        {nameError && (
                            <div
                                style={{
                                    marginTop: 4,
                                    fontSize: 11,
                                    fontStyle: "italic",
                                    color: "#E94E1B",
                                }}
                            >
                                * {nameError}
                            </div>
                        )}

                        <div
                            style={{
                                marginTop: 6,
                                fontSize: 11,
                                fontStyle: "italic",
                                fontWeight: 300,
                                color: "#8B8B8B",
                            }}
                        >
                            Aangemaakt op {createdAtLabel} door {createdByLabel}
                        </div>
                    </div>

                    <div style={{ height: 1, background: "#E4E2E3" }} />

                    {/* Items */}
                    {items.map((item, i) => (
                        <React.Fragment key={item.label}>
                            <button
                                onClick={() => {
                                    item.onClick();
                                    onClose();
                                }}
                                onMouseEnter={() => setHoveredItem(item.label)}
                                onMouseLeave={() => setHoveredItem(null)}
                                style={{
                                    width: "100%",
                                    height: 52,
                                    padding: "0 16px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    border: "none",
                                    background: hoveredItem === item.label ? "#f2f2f2" : "transparent",
                                    cursor: "pointer",
                                    transition: "background 0.15s ease",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <img src={item.icon} style={{ width: 18, height: 18, flexShrink: 0 }} />
                                    <span style={{ fontSize: 14, color: "#2B2B2B" }}>{item.label}</span>
                                </div>

                                <span style={{ fontSize: 12, color: "#A8A8A8", flexShrink: 0 }}>
                                    {item.shortcut}
                                </span>
                            </button>

                            
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FileMenuDropdown;