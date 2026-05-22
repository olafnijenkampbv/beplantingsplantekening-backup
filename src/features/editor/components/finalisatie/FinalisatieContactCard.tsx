"use client";

import React from "react";

const COLORS = {
    cardBg: "#FFFFFF",
    border: "#E3E2E2",
    green: "#58694C",
    text: "#111111",
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
                    className="shrink-0 mt-0.5 cursor-pointer"
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
                    style={{ color: COLORS.text }}
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
                        style={{ color: COLORS.text }}
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
                        style={{ color: COLORS.text }}
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
            <div
                className="flex flex-col sm:flex-row gap-6 sm:gap-8 rounded-[8px] border p-5"
                style={{ borderColor: COLORS.border }}
            >
                <ContactColumn
                    title="Beplantingsplan van"
                    companyName="Hoveniersbedrijf"
                    address="Adresgegevens hovenier"
                    email="email@hovenier.nl"
                    phone="Telefoon hovenier"
                />

                <div
                    className="hidden sm:block w-px self-stretch"
                    style={{ backgroundColor: COLORS.border }}
                />

                <div
                    className="block sm:hidden h-px w-full"
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