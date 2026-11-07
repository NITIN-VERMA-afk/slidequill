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

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://slidequill.in";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "SlideQuill — Turn Documents into Editable PowerPoint Decks",
  description: "Turn PDF and Word documents into editable PowerPoint presentations with 6 professionally designed templates on SlideQuill.",
  icons: {
    icon: "/logo-icon.png",
  },
  openGraph: {
    title: "SlideQuill — Turn Documents into Editable PowerPoint Decks",
    description: "Turn PDF and Word documents into editable PowerPoint presentations with 6 professionally designed templates on SlideQuill.",
    url: "/",
    siteName: "SlideQuill",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "SlideQuill — Turn Documents into Editable PowerPoint Decks",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SlideQuill — Turn Documents into Editable PowerPoint Decks",
    description: "Turn PDF and Word documents into editable PowerPoint presentations with 6 professionally designed templates on SlideQuill.",
    images: ["/og.png"],
  },
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
