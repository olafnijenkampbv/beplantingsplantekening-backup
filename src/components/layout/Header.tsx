"use client";

import Link from "next/link";
import { useState } from "react";

const COLORS = {
    green: "#5F6F4C",
    greenDark: "#556545",
    beige: "#D8D4C8",
    beigeText: "#6A735B",
    border: "#D8D8D8",
    text: "#FFFFFF",
};

const NAV_ITEMS = [
    "Planten",
    "Bomen",
    "Kant en klaar haag",
    "Fruit",
    "Bloembollen",
    "Bonsai",
    "Bosplantsoen",
    "Rhododendrons",
    "Rozen",
    "Dealers",
    "Tuinmaterialen",
];

export default function Header() {
    const [query, setQuery] = useState("");

    return (
        <header className="w-full">
            <div
                className="w-full"
                style={{ backgroundColor: COLORS.green }}
            >
                <div className="max-w-[1320px] mx-auto px-6">
                    <div className="h-[92px] flex items-center justify-between gap-8">
                        <div className="flex items-center gap-7 min-w-0">
                            <Link
                                href="/"
                                className="flex items-center gap-3 shrink-0"
                            >
                                <div
                                    className="flex items-center justify-center shrink-0"
                                    style={{
                                        width: 48,
                                        height: 48,
                                        backgroundColor: "#CFC8B8",
                                        color: "#FFFFFF",
                                        fontWeight: 700,
                                        fontSize: 18,
                                        lineHeight: 1,
                                    }}
                                >
                                    HO
                                </div>

                                <div className="flex flex-col leading-none">
                                    <span
                                        className="text-white font-medium"
                                        style={{ fontSize: 14 }}
                                    >
                                        Heeten Olaf Nijenkamp
                                    </span>
                                </div>
                            </Link>

                            <button
                                type="button"
                                className="h-[48px] px-6 flex items-center gap-3 text-white shrink-0"
                                style={{
                                    backgroundColor: "#82906D",
                                    fontSize: 15,
                                    fontWeight: 500,
                                }}
                            >
                                <span style={{ fontSize: 18, lineHeight: 1 }}>☰</span>
                                <span>Assortiment</span>
                            </button>
                        </div>

                        <div className="flex-1 flex justify-center min-w-0">
                            <div className="w-full max-w-[400px]">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Waar ben je naar op zoek?"
                                        className="w-full h-[40px] bg-white pl-5 pr-12 text-[14px] text-[#222] outline-none"
                                        style={{
                                            border: "1px solid rgba(0,0,0,0.18)",
                                            borderRadius: 2,
                                        }}
                                    />
                                    <span
                                        className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                                        style={{
                                            color: "#1E1E1E",
                                            fontSize: 18,
                                            lineHeight: 1,
                                        }}
                                    >
                                        🔍
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 shrink-0 text-white">
                            <button
                                type="button"
                                className="text-white whitespace-nowrap"
                                style={{ fontSize: 16, fontWeight: 500 }}
                            >
                                Mijn omgeving
                            </button>

                            <button
                                type="button"
                                className="text-white"
                                style={{ fontSize: 24, lineHeight: 1 }}
                            >
                                ♟
                            </button>

                            <button
                                type="button"
                                className="text-white"
                                style={{ fontSize: 22, lineHeight: 1 }}
                            >
                                ♥
                            </button>

                            <button
                                type="button"
                                className="text-white"
                                style={{ fontSize: 24, lineHeight: 1 }}
                            >
                                🛒
                            </button>

                            <button
                                type="button"
                                className="text-white"
                                style={{ fontSize: 18, lineHeight: 1 }}
                            >
                                <img
                                    src="/icons/chevron-up.svg"
                                    alt=""
                                    className="ml-1"
                                    style={{
                                        width: 10,
                                        height: 10,
                                        display: "inline-block",
                                        marginTop: 1,
                                        filter: "brightness(0) invert(1)", // wit maken
                                    }}
                                />
                            </button>
                        </div>
                    </div>

                    <nav className="h-[52px] flex items-center gap-8 flex-wrap">
                        {NAV_ITEMS.map((item) => (
                            <button
                                key={item}
                                type="button"
                                className="text-white shrink-0"
                                style={{ fontSize: 16, fontWeight: 400 }}
                            >
                                {item}
                                {[
                                    "Planten",
                                    "Bomen",
                                    "Bloembollen",
                                    "Rhododendrons",
                                    "Dealers",
                                    "Tuinmaterialen",
                                ].includes(item) ? (
                                        <img
                                            src="/icons/chevron-down.svg"
                                            alt=""
                                            className="ml-1"
                                            style={{
                                                width: 10,
                                                height: 10,
                                                display: "inline-block",
                                                marginTop: 1,
                                                filter: "brightness(0) invert(1)", // wit maken
                                            }}
                                        />
                                ) : null}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <div
                className="w-full border-b"
                style={{
                    backgroundColor: COLORS.beige,
                    borderColor: "#D2CEC2",
                }}
            >
                <div className="max-w-[1320px] mx-auto px-6 h-[56px] flex items-center justify-between gap-8">
                    <div
                        className="flex items-center gap-3"
                        style={{ color: COLORS.beigeText, fontSize: 14 }}
                    >
                        <img
                            src="/icons/chevron-down.svg"
                            alt=""
                            className="ml-1"
                            style={{
                                width: 10,
                                height: 10,
                                display: "inline-block",
                                marginTop: 1,
                                filter: "brightness(0) invert(1)", // wit maken
                            }}
                        />
                        <span>"Bestel voor donderdag 12:00 uur → levering volgende week"</span>
                    </div>

                    <div
                        className="flex items-center gap-12"
                        style={{ color: COLORS.beigeText, fontSize: 14 }}
                    >
                        <button type="button">Nieuws</button>
                        <button type="button">Over ons</button>
                        <button type="button">Klantenservice</button>
                        <button type="button" className="flex items-center gap-2">
                            <span>📞</span>
                            <span>0572 35 21 31</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}