import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SlideQuill — Turn Documents into Editable PowerPoint Decks",
  description: "Turn PDF and Word documents into editable PowerPoint presentations with SlideQuill.",
  icons: {
    icon: "/logo-icon.png",
  },
  openGraph: {
    title: "SlideQuill — Turn Documents into Editable PowerPoint Decks",
    description: "Turn PDF and Word documents into editable PowerPoint presentations with SlideQuill.",
    images: [{ url: "/logo-icon.png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
