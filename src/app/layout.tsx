import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import SessionProvider from "@/components/SessionProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Ambiance - Order Management",
  description: "Order & Production Tracking System",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <SessionProvider session={null}>
          <LanguageProvider>{children}</LanguageProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
