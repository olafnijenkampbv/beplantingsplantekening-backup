import type { Metadata } from "next";
import "./globals.css";
import { DM_Sans } from "next/font/google";
import { AppNotificationsRenderer } from "@/state/allNotifications";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Olaf Nijenkamp",
  description: "Beplantingsplan tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className={`${dmSans.variable} antialiased`}>
        {children}
        <AppNotificationsRenderer />
      </body>
    </html>
  );
}