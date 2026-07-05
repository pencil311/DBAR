import type { Metadata, Viewport } from "next";
import { Rye, Special_Elite, IM_Fell_English } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { StatusBarSafeArea } from "@/components/StatusBarSafeArea";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const rye = Rye({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-poster",
  display: "swap",
});

const specialElite = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-ledger",
  display: "swap",
});

const imFellEnglish = IM_Fell_English({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-flavor",
  display: "swap",
  // Next has no fallback-metric data for this font, so its automatic
  // fallback-adjustment (size-adjust/ascent-override on the swapped-in
  // system font) has nothing to compute from and just warns on every build.
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "DBar — County Attendance Register",
  description: "Attendance tracker for the frontier campus.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DBar",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2b1d12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${rye.variable} ${specialElite.variable} ${imFellEnglish.variable}`}>
      <body>
        <StatusBarSafeArea />
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
