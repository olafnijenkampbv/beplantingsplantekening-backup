"use client";

import React from "react";

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    green: "#58694C",
    text: "#111111",
    softText: "#6B6B6B",
};

function ContactColumn(props: {
    title: string;
    companyName: string;
    address: string;
    email: string;
    phone: string;
}) {
    const { title, companyName, address, email, phone } = props;

    return (
        <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
                <span
                    className="text-[14px] font-semibold"
                    style={{ color: COLORS.green }}
                >
                    {title}
                </span>

                <button
                    type="button"
                    className="shrink-0 mt-0.5"
                    style={{ background: "transparent", border: "none", padding: 0 }}
                    aria-label="Bewerken"
                >
                    <img
                        src="/icons/edit-2.svg"
                        alt=""
                        style={{ width: 16, height: 16, display: "block" }}
                    />
                </button>
            </div>

            <div className="mt-3 space-y-1">
                <p
                    className="text-[15px] font-bold"
                    style={{ color: COLORS.text }}
                >
                    {companyName}
                </p>
                <p
                    className="text-[14px]"
                    style={{ color: COLORS.softText }}
                >
                    {address}
                </p>
            </div>

            <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                    <img
                        src="/icons/mail.svg"
                        alt=""
                        style={{ width: 16, height: 16, display: "block", flexShrink: 0 }}
                    />
                    <span
                        className="text-[14px]"
                        style={{ color: COLORS.softText }}
                    >
                        {email}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <img
                        src="/icons/phone.svg"
                        alt=""
                        style={{ width: 16, height: 16, display: "block", flexShrink: 0 }}
                    />
                    <span
                        className="text-[14px]"
                        style={{ color: COLORS.softText }}
                    >
                        {phone}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function FinalisatieContactCard() {
    return (
        <section
            className="rounded-[10px] border p-6"
            style={{
                backgroundColor: COLORS.cardBg,
                borderColor: COLORS.border,
                boxShadow: "5px 3px 46px -25px rgba(0, 0, 0, 0.25)",
            }}
        >
            <div className="flex gap-8">
                <ContactColumn
                    title="Beplantingsplan van"
                    companyName="Hoveniersbedrijf"
                    address="Adresgegevens hovenier"
                    email="email@hovenier.nl"
                    phone="Telefoon hovenier"
                />

                <div
                    className="w-px self-stretch"
                    style={{ backgroundColor: COLORS.border }}
                />

                <ContactColumn
                    title="Beplantingsplan voor"
                    companyName="Klantnaam"
                    address="Adresgegevens klant"
                    email="email@klant.nl"
                    phone="Telefoon klant"
                />
            </div>
        </section>
    );
}