import React, { useState } from "react";
import { createPortal } from "react-dom";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void;
    drawings: { name: string }[];
};

const COLORS = {
    orange: "#E94E1B",
    border: "#E0DEDF",
    text: "#1F1F1F",
    muted: "#898988",
};

const CreateDrawingModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onSubmit,
    drawings,
}) => {
    const [value, setValue] = useState("");
    const [showRequiredError, setShowRequiredError] = useState(false);
    const [showDuplicateError, setShowDuplicateError] = useState(false);

    if (!isOpen) return null;

    return createPortal(
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.33)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
            }}
        >
            <div
                style={{
                    width: 420,
                    background: "#FFFFFF",
                    borderRadius: 8,
                    padding: 24,
                    position: "relative",
                }}
            >
                <button
                    onClick={() => {
                        setValue("");
                        setShowRequiredError(false);
                        onClose();
                    }}
                    style={{
                        position: "absolute",
                        top: 16,
                        right: 16,
                        width: 24,
                        height: 24,
                        padding: 0,
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <img
                        src="/icons/cancel.svg"
                        alt="close"
                        style={{
                            width: 18,
                            height: 18,
                            display: "block",
                            filter: "brightness(0)", // zwart maken
                        }}
                    />
                </button>

                {/* TITLE */}
                <div
                    style={{
                        fontSize: 18,
                        fontWeight: 700,
                        marginBottom: 6,
                        color: COLORS.text,
                    }}
                >
                    Geef een naam aan de tekening
                </div>

                <div
                    style={{
                        fontSize: 13,
                        color: COLORS.text,
                        marginBottom: 16,
                    }}
                >
                    Waar is de tekening voor
                </div>

                {/* INPUT */}
                <input
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);

                        if (showRequiredError) {
                            setShowRequiredError(false);
                        }

                        if (showDuplicateError) {
                            setShowDuplicateError(false);
                        }
                    }}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                    }}
                    placeholder="Vul hier de naam in..."
                    style={{
                        width: "100%",
                        height: 40,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 6,
                        padding: "0 12px",
                        fontSize: 14,
                        outline: "none",
                        marginBottom: 16,
                        color: COLORS.text,
                    }}
                />

                {showRequiredError && (
                    <div
                        style={{
                            marginTop: -6,
                            marginBottom: 14,
                            fontSize: 12,
                            color: COLORS.orange,
                            fontStyle: "italic",
                            lineHeight: 1.3,
                        }}
                    >
                        * Het is verplicht om een naam in te vullen
                    </div>
                )}

                {showDuplicateError && (
                    <div
                        style={{
                            marginTop: -6,
                            marginBottom: 14,
                            fontSize: 12,
                            color: COLORS.orange,
                            fontStyle: "italic",
                            lineHeight: 1.3,
                        }}
                    >
                        * Er bestaat al een tekening met deze naam
                    </div>
                )}

                {/* BUTTON */}
                <button
                    onClick={() => {
                        const trimmed = value.trim();

                        if (!trimmed) {
                            setShowRequiredError(true);
                            setShowDuplicateError(false);
                            return;
                        }

                        const alreadyExists = drawings.some(
                            (d) => d.name.trim().toLowerCase() === trimmed.toLowerCase()
                        );

                        if (alreadyExists) {
                            setShowDuplicateError(true);
                            setShowRequiredError(false);
                            return;
                        }

                        onSubmit(trimmed);

                        setValue("");
                        setShowRequiredError(false);
                        setShowDuplicateError(false);
                    }}
                    style={{
                        width: "100%",
                        height: 42,
                        background: COLORS.orange,
                        border: "none",
                        borderRadius: 6,
                        color: "#FFFFFF",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                    }}
                >
                    Begin met tekenen
                    <img
                        src="/icons/chevron-right.svg"
                        style={{ filter: "invert(1)", width: 16 }}
                    />
                </button>
            </div>
        </div>,
        document.body
    );
};

export default CreateDrawingModal;