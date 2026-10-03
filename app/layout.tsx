import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Kitchen OS",
  description: "AI-agent operating system for a multi-brand cloud kitchen (demo).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e9edf0",
};

// Light is the default. A saved choice of dark or system overrides it before first paint.
const themeScript = `try{var t=localStorage.getItem("kos-theme"),r=document.documentElement;if(t==="dark")r.setAttribute("data-theme","dark");else if(t==="system")r.removeAttribute("data-theme")}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} ${bricolage.variable} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
