import type { Metadata } from "next";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";

// We import the Font Awesome CSS ourselves above, so stop it injecting its own
// (prevents flicker / oversized icons during load).
config.autoAddCss = false;

export const metadata: Metadata = {
  title: {
    default: "School Management System",
    template: "%s — School Management System",
  },
  description:
    "School management system for basic schools — students, report cards, attendance, fees and timetables.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
