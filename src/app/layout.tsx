import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobSathi — Your experience. Your next opportunity.",
  description:
    "Describe what you know, discover local opportunities, and connect with employers through an editable, evidence-backed profile.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
